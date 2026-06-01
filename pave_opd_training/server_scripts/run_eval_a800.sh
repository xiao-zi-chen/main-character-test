#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$PWD}"
VENV_DIR="${VENV_DIR:-$PROJECT_ROOT/.venv}"
PRED_FILE="${PRED_FILE:-outputs/predictions.jsonl}"

cd "$PROJECT_ROOT"
source "$VENV_DIR/bin/activate"

python pave_opd_training/evaluate_pave_opd.py \
  --pred_file "$PRED_FILE" \
  --by_type
