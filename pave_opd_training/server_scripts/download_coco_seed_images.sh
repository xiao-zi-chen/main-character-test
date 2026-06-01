#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$PWD}"
IMAGE_LIST="${IMAGE_LIST:-data/coco_seed_images.txt}"
LIMIT="${LIMIT:-0}"
COCO_BASE="${COCO_BASE:-http://images.cocodataset.org}"

cd "$PROJECT_ROOT"
mkdir -p images/val2014

download_one() {
  local rel_path="$1"
  local file_name
  file_name="$(basename "$rel_path")"
  local out_path="images/val2014/$file_name"
  if [[ -f "$out_path" && -s "$out_path" ]]; then
    return
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -q --show-progress -T 20 -t 2 "$COCO_BASE/val2014/$file_name" -O "$out_path"
  else
    curl -L --retry 2 --connect-timeout 20 "$COCO_BASE/val2014/$file_name" -o "$out_path"
  fi
}

count=0
while IFS= read -r rel_path; do
  [[ -z "$rel_path" ]] && continue
  download_one "$rel_path"
  count=$((count + 1))
  if [[ "$LIMIT" != "0" && "$count" -ge "$LIMIT" ]]; then
    break
  fi
done < "$IMAGE_LIST"

echo "downloaded_or_existing=$count"
find images/val2014 -type f | wc -l

