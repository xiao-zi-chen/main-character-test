#!/usr/bin/env python
"""Build a PAVE-DeSpec seed set from COCO annotations.

This is a starter converter, not a final paper dataset builder. It uses COCO
object annotations to create reliable object-existence and coarse-specificity
samples without needing pycocotools.
"""

from __future__ import annotations

import argparse
import json
import random
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence


BREED_LIKE = {
    "dog": "golden retriever",
    "cat": "siamese cat",
    "bird": "parrot",
    "horse": "thoroughbred horse",
    "cow": "holstein cow",
    "sheep": "merino sheep",
}

BRAND_LIKE = {
    "car": "Toyota SUV",
    "truck": "Ford truck",
    "bus": "Mercedes bus",
    "motorcycle": "Harley-Davidson motorcycle",
    "bicycle": "Trek bicycle",
    "boat": "Yamaha boat",
}

TYPE_LIKE = {
    "chair": "wooden dining chair",
    "couch": "leather sofa",
    "backpack": "hiking backpack",
    "handbag": "designer handbag",
    "suitcase": "Samsonite suitcase",
    "cup": "ceramic coffee mug",
    "bottle": "glass wine bottle",
    "knife": "stainless steel kitchen knife",
}


def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def image_file_name(image: Dict[str, Any], split: str) -> str:
    file_name = image.get("file_name")
    if file_name:
        return file_name
    image_id = int(image["id"])
    prefix = "COCO_val2014" if "val" in split else "COCO_train2014"
    return f"{prefix}_{image_id:012d}.jpg"


def article(noun: str) -> str:
    return "an" if noun[:1].lower() in {"a", "e", "i", "o", "u"} else "a"


def choose_absent(all_categories: Sequence[str], present: set[str]) -> str:
    candidates = [x for x in all_categories if x not in present]
    return random.choice(candidates)


def specificity_phrase(category: str) -> str:
    if category in BREED_LIKE:
        return BREED_LIKE[category]
    if category in BRAND_LIKE:
        return BRAND_LIKE[category]
    if category in TYPE_LIKE:
        return TYPE_LIKE[category]
    return f"specific kind of {category}"


def make_false_premise_sample(
    image_path: str,
    image_id: int,
    absent: str,
    present_example: str | None,
    idx: int,
) -> Dict[str, Any]:
    q = f"What color is the {absent}?"
    target = f"I do not see {article(absent)} {absent} in the image, so its color cannot be determined."
    chain = [
        f"the {absent} is blue",
        f"{article(absent)} {absent} is visible",
        "some object is visible" if present_example is None else f"{article(present_example)} {present_example} is visible",
        f"the requested {absent} is not visible",
    ]
    return {
        "id": f"coco_false_premise_{image_id}_{idx}",
        "image": image_path,
        "question": q,
        "visual_premises": [{"text": f"{article(absent)} {absent} is visible", "status": "contradicted", "type": "object"}],
        "answerability": "unanswerable",
        "truth_label": "contradicted",
        "hallucination_type": "object",
        "specificity_chain": chain,
        "target_specificity_index": 3,
        "over_specific_indices": [0, 1],
        "over_vague_indices": [],
        "right_specific_answer": target,
        "bad_answers": [f"The {absent} is blue.", f"I can see {article(absent)} {absent}."],
        "critical_phrases": [absent, "not visible", "cannot be determined"],
        "bad_phrases": [f"{absent} is blue", f"see {article(absent)} {absent}", f"{absent} is visible"],
    }


def make_unsupported_specificity_sample(
    image_path: str,
    image_id: int,
    category: str,
    idx: int,
) -> Dict[str, Any]:
    specific = specificity_phrase(category)
    q = f"What exact type or brand is the {category}?"
    target = f"The image shows {article(category)} {category}, but the exact type or brand cannot be verified."
    chain = [
        f"the {category} is {article(specific)} {specific}",
        f"the exact type or brand of the {category} is visible",
        f"{article(category)} {category} is visible",
        "an object is visible",
    ]
    return {
        "id": f"coco_unsupported_specificity_{image_id}_{idx}",
        "image": image_path,
        "question": q,
        "visual_premises": [{"text": f"the exact type or brand of the {category} is visible", "status": "insufficient", "type": "attribute"}],
        "answerability": "partially_answerable",
        "truth_label": "insufficient",
        "hallucination_type": "attribute",
        "specificity_chain": chain,
        "target_specificity_index": 2,
        "over_specific_indices": [0, 1],
        "over_vague_indices": [3],
        "right_specific_answer": target,
        "bad_answers": [f"It is {article(specific)} {specific}.", "I cannot answer anything about the image."],
        "critical_phrases": [category, "cannot be verified", "exact type"],
        "bad_phrases": [specific, f"exact type or brand of the {category} is visible"],
    }


def make_supported_count_sample(
    image_path: str,
    image_id: int,
    category: str,
    count: int,
    idx: int,
) -> Dict[str, Any]:
    q = f"How many {category}s are visible?"
    target = f"There {'is' if count == 1 else 'are'} {count} {category}{'' if count == 1 else 's'} visible."
    chain = [
        target,
        f"{category}s are visible",
        "objects are visible",
        "something is visible",
    ]
    return {
        "id": f"coco_supported_count_{image_id}_{idx}",
        "image": image_path,
        "question": q,
        "visual_premises": [{"text": f"{category}s are visible", "status": "supported", "type": "count"}],
        "answerability": "answerable",
        "truth_label": "supported",
        "hallucination_type": "count",
        "specificity_chain": chain,
        "target_specificity_index": 0,
        "over_specific_indices": [],
        "over_vague_indices": [1, 2, 3],
        "right_specific_answer": target,
        "bad_answers": ["I cannot answer.", f"There are {count + 1} {category}s visible."],
        "critical_phrases": [category, str(count)],
        "bad_phrases": [f"{count + 1} {category}", "cannot answer"],
    }


def iter_samples(args: argparse.Namespace) -> Iterable[Dict[str, Any]]:
    instances = load_json(args.instances_json)
    categories = {int(c["id"]): c["name"] for c in instances["categories"]}
    all_category_names = sorted(set(categories.values()))
    images = {int(img["id"]): img for img in instances["images"]}

    by_image: Dict[int, List[str]] = defaultdict(list)
    counts: Dict[int, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for ann in instances["annotations"]:
        if ann.get("iscrowd", 0):
            continue
        image_id = int(ann["image_id"])
        category = categories[int(ann["category_id"])]
        by_image[image_id].append(category)
        counts[image_id][category] += 1

    image_ids = list(by_image)
    random.shuffle(image_ids)

    emitted = 0
    idx = 0
    for image_id in image_ids:
        image = images.get(image_id)
        if not image:
            continue
        rel_path = str(Path(args.image_dir) / image_file_name(image, args.split))
        present = set(by_image[image_id])
        if not present:
            continue
        present_sorted = sorted(present)
        present_example = random.choice(present_sorted)

        absent = choose_absent(all_category_names, present)
        yield make_false_premise_sample(rel_path, image_id, absent, present_example, idx)
        emitted += 1
        idx += 1
        if args.max_samples > 0 and emitted >= args.max_samples:
            return

        category = random.choice(present_sorted)
        yield make_unsupported_specificity_sample(rel_path, image_id, category, idx)
        emitted += 1
        idx += 1
        if args.max_samples > 0 and emitted >= args.max_samples:
            return

        count_category = random.choice(present_sorted)
        count = counts[image_id][count_category]
        if 1 <= count <= 5:
            yield make_supported_count_sample(rel_path, image_id, count_category, count, idx)
            emitted += 1
            idx += 1
            if args.max_samples > 0 and emitted >= args.max_samples:
                return


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--instances_json", required=True)
    parser.add_argument("--captions_json", default=None, help="Reserved for future caption-aware templates.")
    parser.add_argument("--image_dir", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--split", default="val2014")
    parser.add_argument("--max_samples", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with output.open("w", encoding="utf-8") as f:
        for sample in iter_samples(args):
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")
            n += 1
    print(f"Wrote {n} samples to {output}")


if __name__ == "__main__":
    main()

