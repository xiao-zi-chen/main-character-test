#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$PWD}"
cd "$PROJECT_ROOT"

echo "[disk]"
df -h /root/autodl-tmp 2>/dev/null || df -h .

echo
echo "[memory]"
free -h || true

echo
echo "[gpu]"
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi || true
else
  echo "nvidia-smi not found"
fi

echo
echo "[model]"
MODEL_DIR="${LOCAL_STUDENT_MODEL:-$PROJECT_ROOT/cache/huggingface/models/Qwen3-VL-8B-Instruct}"
if [[ -d "$MODEL_DIR" ]]; then
  du -sh "$MODEL_DIR"
else
  echo "missing: $MODEL_DIR"
fi

echo
echo "[data]"
if [[ -f data/pave_opd_train.jsonl ]]; then
  "$PROJECT_ROOT/.venv/bin/python" - <<'PY'
from pathlib import Path
import json

root = Path(".").resolve()
train = root / "data/pave_opd_train.jsonl"
rows = [json.loads(x) for x in train.read_text(encoding="utf-8").splitlines() if x.strip()]
missing = [r["image"] for r in rows if not (root / r["image"]).exists()]
print("train_samples", len(rows))
print("unique_images", len(set(r["image"] for r in rows)))
print("missing_images", len(missing))
if missing:
    print("missing_example", missing[:5])
raw = root / "data/raw_datasets_ready"
if raw.exists():
    files = [p for p in raw.rglob("*") if p.is_file()]
    print("raw_ready_files", len(files))
    print("raw_ready_gb", round(sum(p.stat().st_size for p in files) / 1024**3, 3))
else:
    print("raw_ready_missing")
PY
else
  echo "missing: data/pave_opd_train.jsonl"
fi
