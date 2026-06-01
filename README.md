# AAAI2027-hy

Research notes and training scaffold for multimodal hallucination mitigation, centered on PAVE-OPD and DeSpec-style right-specific answering.

## Repository Layout

- `pave_opd_training/`: runnable PAVE-OPD training and evaluation code, configs, server scripts, dataset builders, and small example JSONL files.
- `pave_opd_training_plan.md`: training and experiment plan.
- `despec_related_papers/`: local literature notes and nearby paper references.
- `*.md` at the repository root: research direction notes, prior-art checks, and benchmark/story planning.
- `coco_seed_images.txt`: small reproducibility list for seed image selection.

## Data Policy

Datasets, COCO images, Hugging Face caches, server upload bundles, model checkpoints, and generated training outputs are intentionally excluded from git. Rebuild local data with the scripts and guides under `pave_opd_training/dataset_tools/` and `pave_opd_training/server_scripts/`.

## Quick Start

```bash
pip install -r pave_opd_training/requirements.txt
python -m py_compile pave_opd_training/train_pave_opd.py pave_opd_training/evaluate_pave_opd.py
```

See `pave_opd_training/README.md`, `pave_opd_training/DATASET_BUILD_GUIDE.md`, and `pave_opd_training/A800_SERVER_GUIDE.md` for training and server details.
