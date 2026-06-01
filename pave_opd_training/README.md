# PAVE-OPD Training Code

This folder contains a practical training scaffold for **PAVE-OPD: Premise-Aware Visual Evidence On-Policy Distillation**.

It supports two stages:

1. `sft`: cold-start supervised fine-tuning on right-specific / premise-aware answers.
2. `opd`: student rollout + teacher KL distillation with phrase weighting, entropy-aware KL, optional visual-advantage weighting, SFT anchor, and unlikelihood penalty.

The code is intentionally framework-light: HuggingFace Transformers + PEFT + Accelerate.

## Data

Use JSONL. One row per sample:

```json
{
  "id": "demo_001",
  "image": "images/demo.jpg",
  "question": "What color is the umbrella?",
  "visual_premises": [
    {"text": "an umbrella is visible", "status": "contradicted", "type": "object"}
  ],
  "answerability": "unanswerable",
  "truth_label": "contradicted",
  "hallucination_type": "object",
  "specificity_chain": [
    "the umbrella is blue",
    "an umbrella is visible",
    "an object is visible",
    "the requested umbrella is not visible"
  ],
  "target_specificity_index": 3,
  "right_specific_answer": "I do not see an umbrella in the image, so its color cannot be determined.",
  "critical_phrases": ["umbrella", "color", "cannot be determined"],
  "bad_phrases": ["blue umbrella", "red umbrella"]
}
```

## Install

```bash
pip install -r pave_opd_training/requirements.txt
```

Qwen3-VL/Qwen2.5-VL normally requires a recent `transformers` and `qwen-vl-utils`.

For a single A800 server, use [A800_SERVER_GUIDE.md](A800_SERVER_GUIDE.md).
For dataset construction, use [DATASET_BUILD_GUIDE.md](DATASET_BUILD_GUIDE.md).

## Run SFT

```bash
accelerate launch pave_opd_training/train_pave_opd.py \
  --config pave_opd_training/configs/pave_opd_qwen3vl8b_lora.yaml \
  --stage sft \
  --train_file /path/to/train.jsonl \
  --image_root /path/to/images \
  --output_dir outputs/pave_opd_sft
```

## Run OPD

```bash
accelerate launch pave_opd_training/train_pave_opd.py \
  --config pave_opd_training/configs/pave_opd_qwen3vl8b_lora.yaml \
  --stage opd \
  --train_file /path/to/train.jsonl \
  --image_root /path/to/images \
  --student_model_name_or_path outputs/pave_opd_sft \
  --teacher_model_name_or_path Qwen/Qwen3-VL-32B-Instruct \
  --output_dir outputs/pave_opd_opd
```

## Teacher Choices

Recommended full setting:

```text
student: Qwen/Qwen3-VL-8B-Instruct
teacher: Qwen/Qwen3-VL-32B-Instruct
```

For a cheaper training server, do not keep the teacher on the training node. Use the student-only config for SFT/rollout, then score rollouts offline with a stronger teacher:

```bash
accelerate launch pave_opd_training/train_pave_opd.py \
  --config pave_opd_training/configs/pave_opd_qwen3vl8b_student_only_lora.yaml \
  --stage sft \
  --train_file /path/to/train.jsonl \
  --image_root /path/to/images \
  --output_dir outputs/pave_opd_sft
```

Token-level OPD still needs teacher logits. If the teacher is not on the server, use iterative offline teacher scoring or treat the cheap run as `PAVE-Lite`, not the final full method.

## Evaluate

After inference, save predictions as JSONL with the original gold metadata plus a `prediction` field:

```json
{"id":"demo_001","truth_label":"contradicted","hallucination_type":"object","bad_phrases":["blue umbrella"],"prediction":"I do not see an umbrella, so its color cannot be determined."}
```

Then run:

```bash
python pave_opd_training/evaluate_pave_opd.py \
  --pred_file outputs/predictions.jsonl \
  --by_type
```

Core metrics are `fpr_on_negative`, `tnr_on_negative`, `refusal_recall`, `over_refusal_rate_supported`, `right_specific_rate`, `specificity_exact_rate`, `over_specific_rate`, and `over_vague_rate`.

## Notes

- Token-level OPD assumes the student and teacher share a tokenizer/vocabulary.
- For first debugging, use `--max_steps 20 --num_rollouts 1 --disable_visual_advantage true`.
- For real experiments, use the config defaults as a starting point and run ablations.
