# Dataset Tools

These tools help build PAVE-DeSpec JSONL data.

## Recommended Dataset Strategy

Do not train directly on raw caption datasets. Use them as image/question/caption sources, then convert them into:

```text
visual premises
evidence state
specificity chain
target specificity level
right-specific answer
bad answers
```

## First Seed Dataset

Use COCO val/train object annotations to create a small high-quality seed:

```bash
python pave_opd_training/dataset_tools/build_coco_pave_seed.py \
  --instances_json /path/to/annotations/instances_val2014.json \
  --captions_json /path/to/annotations/captions_val2014.json \
  --image_dir images/val2014 \
  --output data/pave_coco_seed.jsonl \
  --split val2014 \
  --max_samples 1000
```

This generates:

- false-premise object questions
- unsupported specificity questions, such as breed/brand/type
- supported normal object/count questions

Use this as the first 1k seed, then manually inspect 100-200 examples before scaling.

