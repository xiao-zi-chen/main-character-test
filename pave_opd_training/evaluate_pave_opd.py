#!/usr/bin/env python
"""Evaluate PAVE-OPD style generations.

Input is a JSONL file where each row contains gold metadata and a model
prediction. The script can use explicit behavior labels if available, and falls
back to transparent phrase heuristics otherwise.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Tuple


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

HALLUCINATION_LABELS = {"hallucinate", "hallucinated", "false_positive", "over_specific"}
REFUSAL_LABELS = {"refuse", "refusal", "repair", "de-specify", "despecify", "right_specific_refusal"}
RIGHT_SPECIFIC_LABELS = {"right_specific", "repair", "de-specify", "despecify", "answer", "refuse"}


def read_jsonl(path: str) -> List[Dict[str, Any]]:
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON at {path}:{line_no}: {exc}") from exc
    return rows


def safe_div(num: float, den: float) -> float:
    return num / den if den else 0.0


def contains_any(text: str, markers: Iterable[str]) -> bool:
    lower = text.lower()
    return any(marker.lower() in lower for marker in markers)


def get_prediction(row: Dict[str, Any]) -> str:
    return str(
        row.get("prediction")
        or row.get("model_output")
        or row.get("response")
        or row.get("generated_answer")
        or ""
    )


def get_status(row: Dict[str, Any]) -> str:
    if row.get("truth_label"):
        return str(row["truth_label"]).lower()
    premises = row.get("visual_premises") or []
    statuses = [str(x.get("status", "")).lower() for x in premises if isinstance(x, dict)]
    if "contradicted" in statuses:
        return "contradicted"
    if "insufficient" in statuses:
        return "insufficient"
    if "supported" in statuses:
        return "supported"
    if str(row.get("answerability", "")).lower() in {"unanswerable", "ambiguous"}:
        return "insufficient"
    return "supported"


def get_gold_behavior(row: Dict[str, Any], status: str) -> str:
    if row.get("gold_behavior"):
        return str(row["gold_behavior"]).lower()
    if row.get("expected_behavior"):
        return str(row["expected_behavior"]).lower()
    if status == "supported":
        return "answer"
    if status == "contradicted":
        return "repair"
    if status in {"insufficient", "unanswerable", "ambiguous"}:
        return "refuse"
    return "answer"


def get_bad_phrases(row: Dict[str, Any]) -> List[str]:
    phrases = []
    if isinstance(row.get("bad_phrases"), list):
        phrases.extend(str(x) for x in row["bad_phrases"])
    if isinstance(row.get("bad_answers"), list):
        phrases.extend(str(x) for x in row["bad_answers"] if isinstance(x, str))
    return [x.strip() for x in phrases if x and x.strip()]


def infer_specificity_index(row: Dict[str, Any], prediction: str) -> int | None:
    if row.get("prediction_specificity_index") is not None:
        try:
            return int(row["prediction_specificity_index"])
        except (TypeError, ValueError):
            return None
    chain = row.get("specificity_chain") or []
    if not isinstance(chain, list):
        return None
    lower = prediction.lower()
    best_idx = None
    best_len = -1
    for idx, item in enumerate(chain):
        text = str(item).strip().lower()
        if text and text in lower and len(text) > best_len:
            best_idx = idx
            best_len = len(text)
    return best_idx


def infer_behavior(row: Dict[str, Any], prediction: str, status: str) -> Dict[str, bool]:
    explicit = str(row.get("prediction_behavior") or row.get("pred_behavior") or "").lower()
    bad_hit = contains_any(prediction, get_bad_phrases(row))
    refusal = contains_any(prediction, REFUSAL_MARKERS)
    over_refusal = contains_any(prediction, OVER_REFUSAL_MARKERS)
    pred_spec_idx = infer_specificity_index(row, prediction)
    target_spec_idx = row.get("target_specificity_index")
    over_specific = False
    over_vague = False
    specificity_exact = False
    specificity_distance = None
    if pred_spec_idx is not None and target_spec_idx is not None:
        try:
            target = int(target_spec_idx)
            specificity_exact = pred_spec_idx == target
            specificity_distance = abs(pred_spec_idx - target)
            over_specific = pred_spec_idx < target
            over_vague = pred_spec_idx > target
        except (TypeError, ValueError):
            pass

    if explicit:
        hallucinated = explicit in HALLUCINATION_LABELS
        refusal = refusal or explicit in REFUSAL_LABELS
        over_refusal = over_refusal or explicit == "over_refuse"
        right_specific = explicit in RIGHT_SPECIFIC_LABELS and not hallucinated
    else:
        hallucinated = bad_hit or (status in {"contradicted", "insufficient", "unanswerable"} and not refusal)
        if status == "supported":
            right_specific = not hallucinated and not over_refusal
        elif status in {"contradicted", "insufficient", "unanswerable"}:
            right_specific = refusal and not bad_hit
        else:
            right_specific = not hallucinated

    return {
        "bad_hit": bad_hit,
        "refusal": refusal,
        "over_refusal": over_refusal,
        "hallucinated": hallucinated,
        "right_specific": right_specific,
        "over_specific": over_specific,
        "over_vague": over_vague,
        "specificity_exact": specificity_exact,
        "specificity_distance": specificity_distance,
    }


def update_counter(counter: Dict[str, float], key: str, value: float = 1.0) -> None:
    counter[key] += value


def evaluate(rows: List[Dict[str, Any]]) -> Tuple[Dict[str, float], Dict[str, Dict[str, float]]]:
    c: Dict[str, float] = defaultdict(float)
    by_type: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for row in rows:
        prediction = get_prediction(row)
        status = get_status(row)
        gold_behavior = get_gold_behavior(row, status)
        htype = str(row.get("hallucination_type") or "unknown").lower()
        negative = status in {"contradicted", "insufficient", "unanswerable", "false"}
        supported = status == "supported"
        behavior = infer_behavior(row, prediction, status)

        update_counter(c, "n")
        update_counter(by_type[htype], "n")

        if negative:
            update_counter(c, "negative_n")
            update_counter(by_type[htype], "negative_n")
        if supported:
            update_counter(c, "supported_n")
            update_counter(by_type[htype], "supported_n")

        for name in ("hallucinated", "refusal", "over_refusal", "right_specific", "bad_hit"):
            if behavior[name]:
                update_counter(c, name)
                update_counter(by_type[htype], name)

        if row.get("target_specificity_index") is not None:
            update_counter(c, "specificity_n")
            update_counter(by_type[htype], "specificity_n")
            if behavior["specificity_exact"]:
                update_counter(c, "specificity_exact")
                update_counter(by_type[htype], "specificity_exact")
            if behavior["over_specific"]:
                update_counter(c, "over_specific")
                update_counter(by_type[htype], "over_specific")
            if behavior["over_vague"]:
                update_counter(c, "over_vague")
                update_counter(by_type[htype], "over_vague")
            if behavior["specificity_distance"] is not None:
                update_counter(c, "specificity_distance_sum", float(behavior["specificity_distance"]))
                update_counter(by_type[htype], "specificity_distance_sum", float(behavior["specificity_distance"]))

        if negative and behavior["hallucinated"]:
            update_counter(c, "false_positive")
            update_counter(by_type[htype], "false_positive")
        if negative and not behavior["hallucinated"]:
            update_counter(c, "true_negative")
            update_counter(by_type[htype], "true_negative")
        if negative and behavior["refusal"]:
            update_counter(c, "needed_refusal_hit")
            update_counter(by_type[htype], "needed_refusal_hit")
        if supported and behavior["over_refusal"]:
            update_counter(c, "supported_over_refusal")
            update_counter(by_type[htype], "supported_over_refusal")

        predicted_behavior = str(row.get("prediction_behavior") or row.get("pred_behavior") or "").lower()
        if predicted_behavior:
            update_counter(c, "explicit_behavior_n")
            if predicted_behavior == gold_behavior:
                update_counter(c, "behavior_exact")

    metrics = summarize_counter(c)
    type_metrics = {htype: summarize_counter(counter) for htype, counter in by_type.items()}
    return metrics, type_metrics


def summarize_counter(c: Dict[str, float]) -> Dict[str, float]:
    n = c.get("n", 0.0)
    negative_n = c.get("negative_n", 0.0)
    supported_n = c.get("supported_n", 0.0)
    refusal_n = c.get("refusal", 0.0)
    metrics = {
        "n": n,
        "hallucination_rate": safe_div(c.get("hallucinated", 0.0), n),
        "right_specific_rate": safe_div(c.get("right_specific", 0.0), n),
        "bad_phrase_rate": safe_div(c.get("bad_hit", 0.0), n),
        "fpr_on_negative": safe_div(c.get("false_positive", 0.0), negative_n),
        "tnr_on_negative": safe_div(c.get("true_negative", 0.0), negative_n),
        "refusal_precision": safe_div(c.get("needed_refusal_hit", 0.0), refusal_n),
        "refusal_recall": safe_div(c.get("needed_refusal_hit", 0.0), negative_n),
        "over_refusal_rate_supported": safe_div(c.get("supported_over_refusal", 0.0), supported_n),
        "supported_n": supported_n,
        "negative_n": negative_n,
        "specificity_exact_rate": safe_div(c.get("specificity_exact", 0.0), c.get("specificity_n", 0.0)),
        "over_specific_rate": safe_div(c.get("over_specific", 0.0), c.get("specificity_n", 0.0)),
        "over_vague_rate": safe_div(c.get("over_vague", 0.0), c.get("specificity_n", 0.0)),
        "mean_specificity_distance": safe_div(c.get("specificity_distance_sum", 0.0), c.get("specificity_n", 0.0)),
        "specificity_n": c.get("specificity_n", 0.0),
    }
    if c.get("explicit_behavior_n", 0.0):
        metrics["behavior_exact_match"] = safe_div(c.get("behavior_exact", 0.0), c["explicit_behavior_n"])
    return metrics


def print_metrics(title: str, metrics: Dict[str, float]) -> None:
    print(f"\n{title}")
    for key in sorted(metrics):
        value = metrics[key]
        if key.endswith("_n") or key == "n":
            print(f"  {key}: {int(value)}")
        else:
            print(f"  {key}: {value:.4f}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pred_file", required=True, help="JSONL with predictions and gold metadata.")
    parser.add_argument("--by_type", action="store_true", help="Print type-wise metrics.")
    args = parser.parse_args()

    rows = read_jsonl(args.pred_file)
    metrics, by_type = evaluate(rows)
    print_metrics("Overall", metrics)
    if args.by_type:
        for htype in sorted(by_type):
            print_metrics(f"Type: {htype}", by_type[htype])


if __name__ == "__main__":
    main()
