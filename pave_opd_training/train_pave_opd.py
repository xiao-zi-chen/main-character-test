#!/usr/bin/env python
"""PAVE-OPD training scaffold for multimodal hallucination mitigation.

The script supports:
  1) SFT cold start on premise-aware right-specific answers.
  2) On-policy distillation from student-generated rollouts.

It is designed for Qwen3-VL/Qwen2.5-VL style processors, but keeps the model
loader generic enough for other HuggingFace VLMs that support image+text input.
"""

from __future__ import annotations

import argparse
import copy
import json
import math
import os
import random
from dataclasses import dataclass, fields
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import torch
import torch.nn.functional as F
import yaml
from accelerate import Accelerator
from accelerate.utils import set_seed
from PIL import Image, ImageFilter
from torch.optim import AdamW
from torch.utils.data import DataLoader, Dataset
from tqdm.auto import tqdm
from transformers import AutoConfig, AutoProcessor, BitsAndBytesConfig, get_scheduler

try:
    from transformers import AutoModelForImageTextToText
except ImportError:  # pragma: no cover - depends on transformers version.
    AutoModelForImageTextToText = None

try:
    from transformers import AutoModelForVision2Seq
except ImportError:  # pragma: no cover
    AutoModelForVision2Seq = None

try:
    from transformers import AutoModelForCausalLM
except ImportError:  # pragma: no cover
    AutoModelForCausalLM = None

try:
    from peft import LoraConfig, PeftConfig, PeftModel, get_peft_model, prepare_model_for_kbit_training
except ImportError:  # pragma: no cover
    LoraConfig = None
    PeftConfig = None
    PeftModel = None
    get_peft_model = None
    prepare_model_for_kbit_training = None


REFUSAL_MARKERS = [
    "cannot determine",
    "cannot be determined",
    "cannot verify",
    "not visible",
    "not readable",
    "unreadable",
    "unclear",
    "insufficient",
    "i do not see",
    "i can't see",
    "unable to",
    "无法",
    "不能",
    "不可",
    "看不清",
    "看不到",
    "无法确认",
    "无法判断",
]

OVER_REFUSAL_MARKERS = [
    "i cannot answer",
    "cannot answer",
    "unable to answer",
    "无法回答",
    "不能回答",
]


@dataclass
class TrainConfig:
    student_model_name_or_path: str = "Qwen/Qwen3-VL-8B-Instruct"
    teacher_model_name_or_path: Optional[str] = None
    stage: str = "sft"
    train_file: str = "data/pave_opd_train.jsonl"
    image_root: str = "."
    output_dir: str = "outputs/pave_opd"

    bf16: bool = True
    fp16: bool = False
    load_in_4bit: bool = False
    teacher_load_in_4bit: bool = False
    trust_remote_code: bool = True
    gradient_checkpointing: bool = True
    freeze_vision_tower: bool = True
    train_projector: bool = True

    use_lora: bool = True
    lora_rank: int = 64
    lora_alpha: int = 128
    lora_dropout: float = 0.05
    lora_target_modules: List[str] = None  # type: ignore[assignment]

    max_length: int = 4096
    max_new_tokens: int = 160
    per_device_train_batch_size: int = 1
    gradient_accumulation_steps: int = 32
    num_train_epochs: int = 1
    max_steps: int = -1
    learning_rate: float = 1.0e-5
    weight_decay: float = 0.0
    warmup_ratio: float = 0.03
    max_grad_norm: float = 1.0
    logging_steps: int = 5
    save_steps: int = 200
    seed: int = 42

    num_rollouts: int = 2
    rollout_temperature: float = 0.7
    rollout_top_p: float = 0.9
    failure_rollout_weight: float = 1.0
    success_rollout_weight: float = 0.25
    opd_beta: float = 1.0
    sft_anchor_weight: float = 0.2
    unlikelihood_weight: float = 0.05
    phrase_weight: float = 3.0
    ocr_value_weight: float = 4.0
    refusal_weight: float = 3.0
    entropy_threshold: float = 4.0
    entropy_temperature: float = 0.5
    visual_advantage_scale: float = 0.5
    visual_advantage_temperature: float = 1.0
    disable_visual_advantage: bool = True
    opd_on_failures_only: bool = False

    def __post_init__(self) -> None:
        if self.lora_target_modules is None:
            self.lora_target_modules = [
                "q_proj",
                "k_proj",
                "v_proj",
                "o_proj",
                "gate_proj",
                "up_proj",
                "down_proj",
            ]


def str_to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    value = str(value).strip().lower()
    if value in {"1", "true", "yes", "y"}:
        return True
    if value in {"0", "false", "no", "n"}:
        return False
    raise argparse.ArgumentTypeError(f"Invalid boolean value: {value}")


def load_config() -> TrainConfig:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, default=None)
    parser.add_argument("--stage", type=str, default=None, choices=["sft", "opd"])
    parser.add_argument("--train_file", type=str, default=None)
    parser.add_argument("--image_root", type=str, default=None)
    parser.add_argument("--output_dir", type=str, default=None)
    parser.add_argument("--student_model_name_or_path", type=str, default=None)
    parser.add_argument("--teacher_model_name_or_path", type=str, default=None)
    parser.add_argument("--max_steps", type=int, default=None)
    parser.add_argument("--num_rollouts", type=int, default=None)
    parser.add_argument("--max_new_tokens", type=int, default=None)
    parser.add_argument("--per_device_train_batch_size", type=int, default=None)
    parser.add_argument("--gradient_accumulation_steps", type=int, default=None)
    parser.add_argument("--learning_rate", type=float, default=None)
    parser.add_argument("--disable_visual_advantage", type=str_to_bool, default=None)
    parser.add_argument("--load_in_4bit", type=str_to_bool, default=None)
    parser.add_argument("--teacher_load_in_4bit", type=str_to_bool, default=None)
    args = parser.parse_args()

    data: Dict[str, Any] = {}
    if args.config:
        with open(args.config, "r", encoding="utf-8") as f:
            loaded = yaml.safe_load(f) or {}
            if not isinstance(loaded, dict):
                raise ValueError("Config YAML must contain a mapping.")
            data.update(loaded)

    for key, value in vars(args).items():
        if key == "config" or value is None:
            continue
        data[key] = value

    known = {f.name for f in fields(TrainConfig)}
    unknown = sorted(set(data) - known)
    if unknown:
        raise ValueError(f"Unknown config fields: {unknown}")
    return TrainConfig(**data)


class JsonlDataset(Dataset):
    def __init__(self, path: str):
        self.path = path
        self.rows: List[Dict[str, Any]] = []
        with open(path, "r", encoding="utf-8") as f:
            for line_no, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Invalid JSON at {path}:{line_no}: {exc}") from exc
                self.rows.append(row)
        if not self.rows:
            raise ValueError(f"No samples found in {path}")

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        return copy.deepcopy(self.rows[idx])


def resolve_image_path(image_root: str, image_value: str) -> str:
    path = Path(image_value)
    if path.is_absolute():
        return str(path)
    return str(Path(image_root) / path)


def load_image(path: str, degraded: bool = False) -> Image.Image:
    image = Image.open(path).convert("RGB")
    if not degraded:
        return image
    # A cheap no/weak-image proxy for visual-advantage weighting.
    return image.convert("L").convert("RGB").filter(ImageFilter.GaussianBlur(radius=12))


def get_premise_status(record: Dict[str, Any]) -> str:
    if record.get("truth_label"):
        return str(record["truth_label"]).lower()
    premises = record.get("visual_premises") or []
    statuses = [str(p.get("status", "")).lower() for p in premises if isinstance(p, dict)]
    if "contradicted" in statuses:
        return "contradicted"
    if "insufficient" in statuses:
        return "insufficient"
    if "supported" in statuses:
        return "supported"
    if str(record.get("answerability", "")).lower() in {"unanswerable", "ambiguous"}:
        return "insufficient"
    return "supported"


def format_premises(record: Dict[str, Any]) -> str:
    premises = record.get("visual_premises") or []
    if not premises:
        return "No structured premise annotations are provided."
    lines = []
    for item in premises:
        if isinstance(item, dict):
            text = item.get("text", "")
            status = item.get("status", "unknown")
            ptype = item.get("type", "visual")
            lines.append(f"- [{ptype}; {status}] {text}")
        else:
            lines.append(f"- {item}")
    return "\n".join(lines)


def format_specificity_chain(record: Dict[str, Any]) -> str:
    chain = record.get("specificity_chain") or []
    if not chain:
        return "No specificity chain is provided."
    target = record.get("target_specificity_index", None)
    lines = []
    for idx, item in enumerate(chain):
        marker = "target" if target is not None and int(target) == idx else "candidate"
        lines.append(f"- level {idx} [{marker}]: {item}")
    return "\n".join(lines)


def build_user_prompt(record: Dict[str, Any]) -> str:
    question = record.get("question") or record.get("query") or ""
    hallucination_type = record.get("hallucination_type", "unknown")
    premise_text = format_premises(record)
    specificity_text = format_specificity_chain(record)
    return (
        "You are a careful vision-language assistant. Verify the visual "
        "presuppositions in the question before answering. If a premise is "
        "contradicted by the image, state that correction. If the image has "
        "insufficient evidence, say what can and cannot be verified. Answer at "
        "the most specific level supported by the visual evidence.\n\n"
        f"Question: {question}\n"
        f"Hallucination type hint: {hallucination_type}\n"
        f"Visual premise annotations:\n{premise_text}\n\n"
        f"Specificity candidates, from most specific to coarser or repaired:\n{specificity_text}\n\n"
        "Return a concise answer. Do not invent object attributes, OCR text, "
        "counts, brands, or relations that are not visually verifiable. If a "
        "specificity chain is provided, choose the target level supported by "
        "the image rather than an over-specific or over-vague level."
    )


def get_target_answer(record: Dict[str, Any]) -> str:
    return (
        record.get("_generated_response")
        or record.get("assistant_response")
        or record.get("right_specific_answer")
        or record.get("answer")
        or ""
    )


def make_messages(record: Dict[str, Any], image_path: str, answer: Optional[str]) -> List[Dict[str, Any]]:
    user_content = [
        {"type": "image", "image": image_path},
        {"type": "text", "text": build_user_prompt(record)},
    ]
    messages: List[Dict[str, Any]] = [{"role": "user", "content": user_content}]
    if answer is not None:
        messages.append({"role": "assistant", "content": [{"type": "text", "text": answer}]})
    return messages


def apply_chat_template(processor: Any, messages: List[Dict[str, Any]], add_generation_prompt: bool) -> str:
    if hasattr(processor, "apply_chat_template"):
        return processor.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=add_generation_prompt,
        )
    # Fallback for processors without a chat template.
    user_text = ""
    assistant_text = ""
    for message in messages:
        chunks = message.get("content", [])
        if isinstance(chunks, str):
            text = chunks
        else:
            text = "\n".join(c.get("text", "") for c in chunks if c.get("type") == "text")
        if message.get("role") == "assistant":
            assistant_text += text
        else:
            user_text += text
    prompt = f"<image>\n{user_text}\nAssistant:"
    if assistant_text:
        return f"{prompt} {assistant_text}"
    return prompt


def processor_call(
    processor: Any,
    texts: Sequence[str],
    images: Sequence[Image.Image],
    cfg: TrainConfig,
) -> Dict[str, torch.Tensor]:
    kwargs = {
        "text": list(texts),
        "images": list(images),
        "padding": True,
        "truncation": True,
        "max_length": cfg.max_length,
        "return_tensors": "pt",
    }
    try:
        return processor(**kwargs)
    except TypeError:
        kwargs.pop("truncation", None)
        kwargs.pop("max_length", None)
        return processor(**kwargs)


def count_nonpad(input_ids: torch.Tensor, pad_token_id: int) -> torch.Tensor:
    return (input_ids != pad_token_id).sum(dim=1)


def find_subsequence(sequence: Sequence[int], pattern: Sequence[int]) -> Iterable[int]:
    if not pattern or len(pattern) > len(sequence):
        return []
    matches = []
    first = pattern[0]
    plen = len(pattern)
    for idx in range(0, len(sequence) - plen + 1):
        if sequence[idx] == first and list(sequence[idx : idx + plen]) == list(pattern):
            matches.append(idx)
    return matches


def phrase_token_ids(tokenizer: Any, phrase: str) -> List[List[int]]:
    if not phrase:
        return []
    variants = [phrase, " " + phrase]
    ids = []
    for variant in variants:
        encoded = tokenizer(variant, add_special_tokens=False).get("input_ids", [])
        if encoded:
            ids.append(encoded)
    return ids


def record_critical_phrases(record: Dict[str, Any]) -> List[str]:
    phrases: List[str] = []
    for key in ("critical_phrases", "evidence_phrases"):
        value = record.get(key)
        if isinstance(value, list):
            phrases.extend(str(x) for x in value)
    for premise in record.get("visual_premises") or []:
        if isinstance(premise, dict) and premise.get("text"):
            phrases.append(str(premise["text"]))
    chain = record.get("specificity_chain") or []
    target_idx = record.get("target_specificity_index")
    if isinstance(chain, list) and target_idx is not None:
        try:
            phrases.append(str(chain[int(target_idx)]))
        except (IndexError, TypeError, ValueError):
            pass
    status = get_premise_status(record)
    if status in {"contradicted", "insufficient", "unanswerable"}:
        phrases.extend(["cannot verify", "not visible", "not readable", "cannot be determined"])
    return sorted({p.strip() for p in phrases if p and p.strip()})


def record_bad_phrases(record: Dict[str, Any]) -> List[str]:
    phrases: List[str] = []
    value = record.get("bad_phrases")
    if isinstance(value, list):
        phrases.extend(str(x) for x in value)
    for answer in record.get("bad_answers") or []:
        if isinstance(answer, str):
            phrases.append(answer)
    chain = record.get("specificity_chain") or []
    if isinstance(chain, list):
        for key in ("over_specific_indices", "over_vague_indices"):
            indices = record.get(key) or []
            if isinstance(indices, list):
                for idx in indices:
                    try:
                        phrases.append(str(chain[int(idx)]))
                    except (IndexError, TypeError, ValueError):
                        continue
    return sorted({p.strip() for p in phrases if p and p.strip()})


class PaveCollator:
    def __init__(self, processor: Any, cfg: TrainConfig, degraded_images: bool = False):
        self.processor = processor
        self.cfg = cfg
        self.degraded_images = degraded_images
        self.tokenizer = processor.tokenizer if hasattr(processor, "tokenizer") else processor
        if self.tokenizer.pad_token_id is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.tokenizer.padding_side = "right"

    def __call__(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        full_texts = []
        prompt_texts = []
        images = []
        image_paths = []
        for record in records:
            image_path = resolve_image_path(self.cfg.image_root, record["image"])
            answer = get_target_answer(record)
            full_messages = make_messages(record, image_path, answer=answer)
            prompt_messages = make_messages(record, image_path, answer=None)
            full_texts.append(apply_chat_template(self.processor, full_messages, add_generation_prompt=False))
            prompt_texts.append(apply_chat_template(self.processor, prompt_messages, add_generation_prompt=True))
            images.append(load_image(image_path, degraded=self.degraded_images))
            image_paths.append(image_path)

        full = processor_call(self.processor, full_texts, images, self.cfg)
        prompt = processor_call(self.processor, prompt_texts, images, self.cfg)

        input_ids = full["input_ids"]
        attention_mask = full["attention_mask"]
        labels = input_ids.clone()
        response_mask = torch.zeros_like(input_ids, dtype=torch.float32)
        token_weights = torch.ones_like(input_ids, dtype=torch.float32)
        unlikelihood_mask = torch.zeros_like(input_ids, dtype=torch.float32)

        pad_id = self.tokenizer.pad_token_id
        prompt_lens = count_nonpad(prompt["input_ids"], pad_id)
        for row_idx, prompt_len_tensor in enumerate(prompt_lens):
            prompt_len = int(prompt_len_tensor.item())
            prompt_len = min(prompt_len, input_ids.shape[1])
            labels[row_idx, :prompt_len] = -100
            response_mask[row_idx, prompt_len:] = attention_mask[row_idx, prompt_len:].float()

        labels[attention_mask == 0] = -100

        for row_idx, record in enumerate(records):
            seq = input_ids[row_idx].tolist()
            response_positions = response_mask[row_idx].bool()
            status = get_premise_status(record)
            hallucination_type = str(record.get("hallucination_type", "")).lower()
            weight_value = self.cfg.ocr_value_weight if "ocr" in hallucination_type else self.cfg.phrase_weight

            for phrase in record_critical_phrases(record):
                phrase_weight = self.cfg.refusal_weight if phrase.lower() in REFUSAL_MARKERS else weight_value
                for ids in phrase_token_ids(self.tokenizer, phrase):
                    for start in find_subsequence(seq, ids):
                        end = min(start + len(ids), input_ids.shape[1])
                        mask_slice = response_positions[start:end]
                        if mask_slice.any():
                            token_weights[row_idx, start:end] = torch.maximum(
                                token_weights[row_idx, start:end],
                                torch.full_like(token_weights[row_idx, start:end], phrase_weight),
                            )

            if status in {"contradicted", "insufficient", "unanswerable"}:
                for marker in REFUSAL_MARKERS:
                    for ids in phrase_token_ids(self.tokenizer, marker):
                        for start in find_subsequence(seq, ids):
                            end = min(start + len(ids), input_ids.shape[1])
                            token_weights[row_idx, start:end] = torch.maximum(
                                token_weights[row_idx, start:end],
                                torch.full_like(token_weights[row_idx, start:end], self.cfg.refusal_weight),
                            )

            for phrase in record_bad_phrases(record):
                for ids in phrase_token_ids(self.tokenizer, phrase):
                    for start in find_subsequence(seq, ids):
                        end = min(start + len(ids), input_ids.shape[1])
                        unlikelihood_mask[row_idx, start:end] = response_mask[row_idx, start:end]

        full["labels"] = labels
        full["response_mask"] = response_mask
        full["token_weights"] = token_weights
        full["unlikelihood_mask"] = unlikelihood_mask
        full["records"] = records
        full["image_paths"] = image_paths
        return full


def move_batch_to_device(batch: Dict[str, Any], device: torch.device) -> Dict[str, Any]:
    moved = {}
    for key, value in batch.items():
        if isinstance(value, torch.Tensor):
            moved[key] = value.to(device)
        else:
            moved[key] = value
    return moved


def model_inputs(batch: Dict[str, Any], include_labels: bool = False) -> Dict[str, torch.Tensor]:
    skip = {"records", "image_paths", "response_mask", "token_weights", "unlikelihood_mask"}
    if not include_labels:
        skip.add("labels")
    return {k: v for k, v in batch.items() if k not in skip}


def get_model_class():
    for cls in (AutoModelForImageTextToText, AutoModelForVision2Seq, AutoModelForCausalLM):
        if cls is not None:
            return cls
    raise RuntimeError("No suitable AutoModel class is available in transformers.")


def dtype_from_cfg(cfg: TrainConfig) -> Optional[torch.dtype]:
    if cfg.bf16:
        return torch.bfloat16
    if cfg.fp16:
        return torch.float16
    return None


def load_processor(model_name_or_path: str, cfg: TrainConfig) -> Any:
    processor = AutoProcessor.from_pretrained(
        model_name_or_path,
        trust_remote_code=cfg.trust_remote_code,
    )
    tokenizer = processor.tokenizer if hasattr(processor, "tokenizer") else processor
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    return processor


def load_model(model_name_or_path: str, cfg: TrainConfig, is_teacher: bool = False) -> torch.nn.Module:
    model_cls = get_model_class()
    quantize = cfg.teacher_load_in_4bit if is_teacher else cfg.load_in_4bit
    kwargs: Dict[str, Any] = {
        "trust_remote_code": cfg.trust_remote_code,
    }
    dtype = dtype_from_cfg(cfg)
    if dtype is not None:
        kwargs["torch_dtype"] = dtype
    if quantize:
        kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=dtype or torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )

    adapter_config_path = os.path.join(model_name_or_path, "adapter_config.json")
    if os.path.exists(adapter_config_path):
        if PeftConfig is None or PeftModel is None:
            raise ImportError("peft is required to load adapter checkpoints.")
        peft_config = PeftConfig.from_pretrained(model_name_or_path)
        base_model_name = peft_config.base_model_name_or_path
        model = model_cls.from_pretrained(base_model_name, **kwargs)
        model = PeftModel.from_pretrained(model, model_name_or_path, is_trainable=not is_teacher)
        setattr(model, "_pave_has_peft_adapter", True)
    else:
        model = model_cls.from_pretrained(model_name_or_path, **kwargs)
    if hasattr(model, "config"):
        model.config.use_cache = False
    if cfg.gradient_checkpointing and hasattr(model, "gradient_checkpointing_enable") and not is_teacher:
        model.gradient_checkpointing_enable()
    return model


def apply_freezing_and_lora(model: torch.nn.Module, cfg: TrainConfig) -> torch.nn.Module:
    if getattr(model, "_pave_has_peft_adapter", False):
        return model

    if cfg.freeze_vision_tower:
        for name, param in model.named_parameters():
            lname = name.lower()
            if "vision" in lname or "visual" in lname or "vit" in lname:
                param.requires_grad = False

    if cfg.train_projector:
        projector_keys = ["projector", "mm_projector", "multi_modal_projector", "merger", "vision_proj"]
        for name, param in model.named_parameters():
            lname = name.lower()
            if any(key in lname for key in projector_keys):
                param.requires_grad = True

    if not cfg.use_lora:
        return model
    if get_peft_model is None or LoraConfig is None:
        raise ImportError("peft is required when use_lora=true")
    if cfg.load_in_4bit and prepare_model_for_kbit_training is not None:
        model = prepare_model_for_kbit_training(model)

    lora_config = LoraConfig(
        r=cfg.lora_rank,
        lora_alpha=cfg.lora_alpha,
        lora_dropout=cfg.lora_dropout,
        target_modules=cfg.lora_target_modules,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    if hasattr(model, "print_trainable_parameters"):
        model.print_trainable_parameters()
    return model


def validate_teacher_student(student: torch.nn.Module, teacher: torch.nn.Module) -> None:
    student_vocab = getattr(getattr(student, "config", None), "vocab_size", None)
    teacher_vocab = getattr(getattr(teacher, "config", None), "vocab_size", None)
    if student_vocab is not None and teacher_vocab is not None and student_vocab != teacher_vocab:
        raise ValueError(
            "Token-level OPD requires matching vocabularies. "
            f"student vocab={student_vocab}, teacher vocab={teacher_vocab}"
        )


def response_contains_any(response: str, markers: Sequence[str]) -> bool:
    text = response.lower()
    return any(marker.lower() in text for marker in markers)


def diagnose_rollout(record: Dict[str, Any], response: str) -> Tuple[bool, str]:
    status = get_premise_status(record)
    bad_hit = response_contains_any(response, record_bad_phrases(record))
    cautious = response_contains_any(response, REFUSAL_MARKERS)
    over_refusal = response_contains_any(response, OVER_REFUSAL_MARKERS)

    if status in {"contradicted", "insufficient", "unanswerable"}:
        if bad_hit:
            return False, "bad_phrase"
        if not cautious:
            return False, "missing_uncertainty_or_correction"
        return True, "premise_aware"
    if status == "supported":
        if over_refusal:
            return False, "over_refusal"
        return True, "supported_answer"
    return (not bad_hit), "unknown_status"


@torch.no_grad()
def generate_rollouts(
    model: torch.nn.Module,
    processor: Any,
    records: List[Dict[str, Any]],
    cfg: TrainConfig,
    device: torch.device,
) -> List[Dict[str, Any]]:
    model.eval()
    generated_records: List[Dict[str, Any]] = []
    collator = PaveCollator(processor, cfg)

    prompt_texts = []
    images = []
    for record in records:
        image_path = resolve_image_path(cfg.image_root, record["image"])
        prompt_messages = make_messages(record, image_path, answer=None)
        prompt_texts.append(apply_chat_template(processor, prompt_messages, add_generation_prompt=True))
        images.append(load_image(image_path, degraded=False))

    prompt_inputs = processor_call(processor, prompt_texts, images, cfg)
    prompt_inputs = move_batch_to_device(prompt_inputs, device)
    input_lens = prompt_inputs["attention_mask"].sum(dim=1).tolist()

    for _ in range(cfg.num_rollouts):
        outputs = model.generate(
            **prompt_inputs,
            do_sample=True,
            temperature=cfg.rollout_temperature,
            top_p=cfg.rollout_top_p,
            max_new_tokens=cfg.max_new_tokens,
            pad_token_id=collator.tokenizer.pad_token_id,
            eos_token_id=collator.tokenizer.eos_token_id,
        )
        for row_idx, record in enumerate(records):
            start = int(input_lens[row_idx])
            gen_ids = outputs[row_idx, start:]
            text = collator.tokenizer.decode(gen_ids, skip_special_tokens=True).strip()
            new_record = copy.deepcopy(record)
            new_record["_generated_response"] = text
            success, reason = diagnose_rollout(record, text)
            new_record["_rollout_success"] = success
            new_record["_rollout_reason"] = reason
            generated_records.append(new_record)

    return generated_records


def sequence_logprobs(logits: torch.Tensor, target_ids: torch.Tensor) -> torch.Tensor:
    logp = F.log_softmax(logits, dim=-1)
    return logp.gather(dim=-1, index=target_ids.unsqueeze(-1)).squeeze(-1)


def compute_entropy_aware_kl(
    student_logits: torch.Tensor,
    teacher_logits: torch.Tensor,
    mask: torch.Tensor,
    token_weights: torch.Tensor,
    cfg: TrainConfig,
    visual_advantage_weights: Optional[torch.Tensor] = None,
) -> torch.Tensor:
    # Position i predicts token i+1.
    s_logits = student_logits[:, :-1, :]
    t_logits = teacher_logits[:, :-1, :]
    active = mask[:, 1:].float()
    weights = token_weights[:, 1:].float()
    if visual_advantage_weights is not None:
        weights = weights * visual_advantage_weights[:, 1:].float()

    s_logp = F.log_softmax(s_logits, dim=-1)
    t_logp = F.log_softmax(t_logits, dim=-1)
    s_prob = s_logp.exp()
    t_prob = t_logp.exp()

    reverse_kl = (s_prob * (s_logp - t_logp)).sum(dim=-1)
    forward_kl = (t_prob * (t_logp - s_logp)).sum(dim=-1)
    entropy = -(t_prob * t_logp).sum(dim=-1)

    alpha = torch.sigmoid((entropy - cfg.entropy_threshold) / max(cfg.entropy_temperature, 1.0e-6))
    mixed_kl = (1.0 - alpha) * reverse_kl + alpha * 0.5 * (reverse_kl + forward_kl)

    weighted = mixed_kl * active * weights
    denom = (active * weights).sum().clamp_min(1.0)
    return weighted.sum() / denom


def compute_visual_advantage_weights(
    teacher_logits: torch.Tensor,
    degraded_teacher_logits: torch.Tensor,
    input_ids: torch.Tensor,
    response_mask: torch.Tensor,
    cfg: TrainConfig,
) -> torch.Tensor:
    target_ids = input_ids[:, 1:]
    full_logp = sequence_logprobs(teacher_logits[:, :-1, :], target_ids)
    degraded_logp = sequence_logprobs(degraded_teacher_logits[:, :-1, :], target_ids)
    advantage = full_logp - degraded_logp
    scaled = torch.sigmoid(advantage / max(cfg.visual_advantage_temperature, 1.0e-6))
    weights_next = 1.0 + cfg.visual_advantage_scale * scaled
    weights = torch.ones_like(response_mask, dtype=torch.float32)
    weights[:, 1:] = weights_next
    return weights * response_mask.float() + (1.0 - response_mask.float())


def compute_unlikelihood_loss(
    student_logits: torch.Tensor,
    input_ids: torch.Tensor,
    unlikelihood_mask: torch.Tensor,
) -> torch.Tensor:
    active = unlikelihood_mask[:, 1:].float()
    if active.sum() < 1:
        return student_logits.new_tensor(0.0)
    probs = F.softmax(student_logits[:, :-1, :], dim=-1)
    next_ids = input_ids[:, 1:]
    token_probs = probs.gather(dim=-1, index=next_ids.unsqueeze(-1)).squeeze(-1)
    loss = -torch.log((1.0 - token_probs).clamp_min(1.0e-6)) * active
    return loss.sum() / active.sum().clamp_min(1.0)


def apply_rollout_weights(batch: Dict[str, Any], cfg: TrainConfig) -> None:
    records = batch["records"]
    response_mask = batch["response_mask"]
    weights = batch["token_weights"]
    for idx, record in enumerate(records):
        success = bool(record.get("_rollout_success", False))
        rollout_weight = cfg.success_rollout_weight if success else cfg.failure_rollout_weight
        if cfg.opd_on_failures_only and success:
            rollout_weight = 0.0
        weights[idx] = weights[idx] * (1.0 + response_mask[idx] * (rollout_weight - 1.0))


def save_checkpoint(accelerator: Accelerator, model: torch.nn.Module, processor: Any, output_dir: str) -> None:
    accelerator.wait_for_everyone()
    if accelerator.is_main_process:
        os.makedirs(output_dir, exist_ok=True)
    unwrapped = accelerator.unwrap_model(model)
    if accelerator.is_main_process:
        unwrapped.save_pretrained(output_dir, save_function=accelerator.save)
        processor.save_pretrained(output_dir)
    accelerator.wait_for_everyone()


def total_training_steps(cfg: TrainConfig, dataset_len: int) -> int:
    if cfg.max_steps and cfg.max_steps > 0:
        return cfg.max_steps
    steps_per_epoch = math.ceil(dataset_len / max(cfg.per_device_train_batch_size, 1))
    update_steps = math.ceil(steps_per_epoch / max(cfg.gradient_accumulation_steps, 1))
    return max(update_steps * cfg.num_train_epochs, 1)


def train_sft(
    cfg: TrainConfig,
    accelerator: Accelerator,
    student: torch.nn.Module,
    processor: Any,
    dataset: JsonlDataset,
) -> None:
    collator = PaveCollator(processor, cfg)
    loader = DataLoader(
        dataset,
        batch_size=cfg.per_device_train_batch_size,
        shuffle=True,
        collate_fn=collator,
    )
    optimizer = AdamW(
        [p for p in student.parameters() if p.requires_grad],
        lr=cfg.learning_rate,
        weight_decay=cfg.weight_decay,
    )
    max_train_steps = total_training_steps(cfg, len(dataset))
    warmup_steps = int(max_train_steps * cfg.warmup_ratio)
    scheduler = get_scheduler("cosine", optimizer, num_warmup_steps=warmup_steps, num_training_steps=max_train_steps)

    student, optimizer, loader, scheduler = accelerator.prepare(student, optimizer, loader, scheduler)
    progress = tqdm(total=max_train_steps, disable=not accelerator.is_main_process, desc="SFT")
    global_step = 0

    student.train()
    for _epoch in range(cfg.num_train_epochs):
        for batch in loader:
            with accelerator.accumulate(student):
                batch = move_batch_to_device(batch, accelerator.device)
                outputs = student(**model_inputs(batch, include_labels=True))
                loss = outputs.loss
                accelerator.backward(loss)
                if accelerator.sync_gradients:
                    accelerator.clip_grad_norm_(student.parameters(), cfg.max_grad_norm)
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad()

            if accelerator.sync_gradients:
                global_step += 1
                progress.update(1)
                if global_step % cfg.logging_steps == 0:
                    accelerator.print(f"step={global_step} sft_loss={loss.detach().float().item():.4f}")
                if global_step % cfg.save_steps == 0:
                    save_checkpoint(accelerator, student, processor, os.path.join(cfg.output_dir, f"step_{global_step}"))
                if global_step >= max_train_steps:
                    break
        if global_step >= max_train_steps:
            break

    progress.close()
    save_checkpoint(accelerator, student, processor, cfg.output_dir)


def train_opd(
    cfg: TrainConfig,
    accelerator: Accelerator,
    student: torch.nn.Module,
    teacher: torch.nn.Module,
    processor: Any,
    dataset: JsonlDataset,
) -> None:
    raw_loader = DataLoader(
        dataset,
        batch_size=cfg.per_device_train_batch_size,
        shuffle=True,
        collate_fn=lambda rows: rows,
    )
    optimizer = AdamW(
        [p for p in student.parameters() if p.requires_grad],
        lr=cfg.learning_rate,
        weight_decay=cfg.weight_decay,
    )
    max_train_steps = total_training_steps(cfg, len(dataset))
    warmup_steps = int(max_train_steps * cfg.warmup_ratio)
    scheduler = get_scheduler("cosine", optimizer, num_warmup_steps=warmup_steps, num_training_steps=max_train_steps)

    student, optimizer, raw_loader, scheduler = accelerator.prepare(student, optimizer, raw_loader, scheduler)
    teacher.to(accelerator.device)
    teacher.eval()
    validate_teacher_student(accelerator.unwrap_model(student), teacher)

    rollout_collator = PaveCollator(processor, cfg)
    degraded_collator = PaveCollator(processor, cfg, degraded_images=True)
    progress = tqdm(total=max_train_steps, disable=not accelerator.is_main_process, desc="PAVE-OPD")
    global_step = 0

    for _epoch in range(cfg.num_train_epochs):
        for records in raw_loader:
            student_for_gen = accelerator.unwrap_model(student)
            rollout_records = generate_rollouts(student_for_gen, processor, records, cfg, accelerator.device)
            if not rollout_records:
                continue

            with accelerator.accumulate(student):
                student.train()
                opd_batch = rollout_collator(rollout_records)
                apply_rollout_weights(opd_batch, cfg)
                opd_batch = move_batch_to_device(opd_batch, accelerator.device)

                with torch.no_grad():
                    teacher_outputs = teacher(**model_inputs(opd_batch, include_labels=False))
                    teacher_logits = teacher_outputs.logits.detach()
                    va_weights = None
                    if not cfg.disable_visual_advantage and cfg.visual_advantage_scale > 0:
                        degraded_batch = degraded_collator(rollout_records)
                        degraded_batch = move_batch_to_device(degraded_batch, accelerator.device)
                        degraded_outputs = teacher(**model_inputs(degraded_batch, include_labels=False))
                        va_weights = compute_visual_advantage_weights(
                            teacher_logits=teacher_logits,
                            degraded_teacher_logits=degraded_outputs.logits.detach(),
                            input_ids=opd_batch["input_ids"],
                            response_mask=opd_batch["response_mask"],
                            cfg=cfg,
                        )

                student_outputs = student(**model_inputs(opd_batch, include_labels=False))
                opd_loss = compute_entropy_aware_kl(
                    student_logits=student_outputs.logits,
                    teacher_logits=teacher_logits,
                    mask=opd_batch["response_mask"],
                    token_weights=opd_batch["token_weights"],
                    cfg=cfg,
                    visual_advantage_weights=va_weights,
                )
                ul_loss = compute_unlikelihood_loss(
                    student_outputs.logits,
                    opd_batch["input_ids"],
                    opd_batch["unlikelihood_mask"],
                )

                loss = cfg.opd_beta * opd_loss + cfg.unlikelihood_weight * ul_loss

                if cfg.sft_anchor_weight > 0:
                    gold_batch = rollout_collator(records)
                    gold_batch = move_batch_to_device(gold_batch, accelerator.device)
                    gold_outputs = student(**model_inputs(gold_batch, include_labels=True))
                    loss = loss + cfg.sft_anchor_weight * gold_outputs.loss
                    sft_loss_value = gold_outputs.loss.detach().float().item()
                else:
                    sft_loss_value = 0.0

                accelerator.backward(loss)
                if accelerator.sync_gradients:
                    accelerator.clip_grad_norm_(student.parameters(), cfg.max_grad_norm)
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad()

            if accelerator.sync_gradients:
                global_step += 1
                progress.update(1)
                if global_step % cfg.logging_steps == 0:
                    success_rate = sum(bool(r.get("_rollout_success", False)) for r in rollout_records) / len(rollout_records)
                    accelerator.print(
                        "step={} loss={:.4f} opd={:.4f} ul={:.4f} sft={:.4f} rollout_success={:.3f}".format(
                            global_step,
                            loss.detach().float().item(),
                            opd_loss.detach().float().item(),
                            ul_loss.detach().float().item(),
                            sft_loss_value,
                            success_rate,
                        )
                    )
                if global_step % cfg.save_steps == 0:
                    save_checkpoint(accelerator, student, processor, os.path.join(cfg.output_dir, f"step_{global_step}"))
                if global_step >= max_train_steps:
                    break
        if global_step >= max_train_steps:
            break

    progress.close()
    save_checkpoint(accelerator, student, processor, cfg.output_dir)


def main() -> None:
    cfg = load_config()
    set_seed(cfg.seed)
    if torch.cuda.is_available():
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
    accelerator = Accelerator(
        gradient_accumulation_steps=cfg.gradient_accumulation_steps,
        mixed_precision="bf16" if cfg.bf16 else ("fp16" if cfg.fp16 else "no"),
    )
    if accelerator.is_main_process:
        os.makedirs(cfg.output_dir, exist_ok=True)
        with open(os.path.join(cfg.output_dir, "resolved_config.yaml"), "w", encoding="utf-8") as f:
            yaml.safe_dump(cfg.__dict__, f, allow_unicode=True, sort_keys=True)

    dataset = JsonlDataset(cfg.train_file)
    processor = load_processor(cfg.student_model_name_or_path, cfg)
    student = load_model(cfg.student_model_name_or_path, cfg, is_teacher=False)
    student = apply_freezing_and_lora(student, cfg)

    accelerator.print(f"Loaded {len(dataset)} samples from {cfg.train_file}")
    accelerator.print(f"Stage: {cfg.stage}")

    if cfg.stage == "sft":
        train_sft(cfg, accelerator, student, processor, dataset)
    elif cfg.stage == "opd":
        if not cfg.teacher_model_name_or_path:
            raise ValueError("teacher_model_name_or_path is required for OPD stage.")
        teacher = load_model(cfg.teacher_model_name_or_path, cfg, is_teacher=True)
        for param in teacher.parameters():
            param.requires_grad = False
        train_opd(cfg, accelerator, student, teacher, processor, dataset)
    else:
        raise ValueError(f"Unsupported stage: {cfg.stage}")


if __name__ == "__main__":
    main()
