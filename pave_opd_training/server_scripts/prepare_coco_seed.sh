#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$PWD}"
VENV_DIR="${VENV_DIR:-$PROJECT_ROOT/.venv}"
MAX_SAMPLES="${MAX_SAMPLES:-1000}"

cd "$PROJECT_ROOT"
source "$VENV_DIR/bin/activate"

mkdir -p data/raw/coco data/annotations images

download_file() {
  local url="$1"
  local output="$2"
  if [[ -f "$output" ]]; then
    echo "Exists: $output"
    return
  fi
  if command -v aria2c >/dev/null 2>&1; then
    aria2c -x 8 -s 8 -o "$(basename "$output")" -d "$(dirname "$output")" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -c "$url" -O "$output"
  else
    curl -L --retry 5 --continue-at - "$url" -o "$output"
  fi
}

COCO_BASE="${COCO_BASE:-http://images.cocodataset.org}"
VAL_ZIP="data/raw/coco/val2014.zip"
ANN_ZIP="data/raw/coco/annotations_trainval2014.zip"

download_file "$COCO_BASE/zips/val2014.zip" "$VAL_ZIP"
download_file "$COCO_BASE/annotations/annotations_trainval2014.zip" "$ANN_ZIP"

if [[ ! -d images/val2014 ]]; then
  unzip -q "$VAL_ZIP" -d images
fi

if [[ ! -f data/annotations/instances_val2014.json ]]; then
  unzip -q "$ANN_ZIP" -d data
fi

python pave_opd_training/dataset_tools/build_coco_pave_seed.py \
  --instances_json data/annotations/instances_val2014.json \
  --captions_json data/annotations/captions_val2014.json \
  --image_dir images/val2014 \
  --output data/pave_coco_seed.jsonl \
  --split val2014 \
  --max_samples "$MAX_SAMPLES"

cp data/pave_coco_seed.jsonl data/pave_opd_train.jsonl

python - <<'PY'
from pathlib import Path
import json

path = Path("data/pave_opd_train.jsonl")
rows = [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]
print("seed_samples", len(rows))
print("first_id", rows[0]["id"] if rows else "NONE")
if rows:
    image = Path(rows[0]["image"])
    print("first_image_exists", image.exists(), image)
    print("fields", sorted(rows[0].keys()))
PY

echo "COCO PAVE seed ready: data/pave_opd_train.jsonl"

