#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$PWD}"
VENV_DIR="${VENV_DIR:-$PROJECT_ROOT/.venv}"
MAX_SAMPLES="${MAX_SAMPLES:-1000}"
SKIP_IMAGE_DOWNLOAD="${SKIP_IMAGE_DOWNLOAD:-0}"

cd "$PROJECT_ROOT"
source "$VENV_DIR/bin/activate"

mkdir -p data/raw/coco data/annotations images/val2014

download_file() {
  local url="$1"
  local output="$2"
  if [[ -f "$output" ]]; then
    echo "Exists: $output"
    return
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -c "$url" -O "$output"
  else
    curl -L --retry 5 --continue-at - "$url" -o "$output"
  fi
}

COCO_BASE="${COCO_BASE:-http://images.cocodataset.org}"
ANN_ZIP="data/raw/coco/annotations_trainval2014.zip"

download_file "$COCO_BASE/annotations/annotations_trainval2014.zip" "$ANN_ZIP"

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

python - <<'PY' > data/coco_seed_images.txt
import json
from pathlib import Path

paths = set()
for line in Path("data/pave_coco_seed.jsonl").read_text(encoding="utf-8").splitlines():
    if not line.strip():
        continue
    paths.add(json.loads(line)["image"])
for path in sorted(paths):
    print(path)
PY

echo "Downloading selected images only..."
if [[ "$SKIP_IMAGE_DOWNLOAD" == "1" ]]; then
  echo "SKIP_IMAGE_DOWNLOAD=1, only writing data/coco_seed_images.txt"
else
  while IFS= read -r rel_path; do
    file_name="$(basename "$rel_path")"
    out_path="images/val2014/$file_name"
    if [[ -f "$out_path" ]]; then
      continue
    fi
    download_file "$COCO_BASE/val2014/$file_name" "$out_path"
  done < data/coco_seed_images.txt
fi

cp data/pave_coco_seed.jsonl data/pave_opd_train.jsonl

python - <<'PY'
from pathlib import Path
import json

path = Path("data/pave_opd_train.jsonl")
rows = [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]
missing = [r["image"] for r in rows if not Path(r["image"]).exists()]
print("seed_samples", len(rows))
print("unique_images", len(set(r["image"] for r in rows)))
print("missing_images", len(missing))
print("first_id", rows[0]["id"] if rows else "NONE")
if rows:
    print("first_image", rows[0]["image"])
    print("fields", sorted(rows[0].keys()))
PY

echo "Light COCO PAVE seed ready: data/pave_opd_train.jsonl"
