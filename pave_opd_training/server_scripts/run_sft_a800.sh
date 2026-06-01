#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$PWD}"
VENV_DIR="${VENV_DIR:-$PROJECT_ROOT/.venv}"
CONFIG="${CONFIG:-pave_opd_training/configs/pave_opd_qwen3vl8b_a800_lora.yaml}"
TRAIN_FILE="${TRAIN_FILE:-data/pave_opd_train.jsonl}"
IMAGE_ROOT="${IMAGE_ROOT:-.}"
OUTPUT_DIR="${OUTPUT_DIR:-outputs/a800_qwen3vl8b_pave_sft}"
LOCAL_STUDENT_MODEL="${LOCAL_STUDENT_MODEL:-$PROJECT_ROOT/cache/huggingface/models/Qwen3-VL-8B-Instruct}"

cd "$PROJECT_ROOT"
source "$VENV_DIR/bin/activate"

export HF_HOME="${HF_HOME:-$PROJECT_ROOT/cache/huggingface}"
export TRANSFORMERS_CACHE="${TRANSFORMERS_CACHE:-$HF_HOME/transformers}"
export TOKENIZERS_PARALLELISM=false
export PYTORCH_CUDA_ALLOC_CONF="${PYTORCH_CUDA_ALLOC_CONF:-expandable_segments:True}"

mkdir -p "$OUTPUT_DIR" logs

MODEL_ARGS=()
if [[ -d "$LOCAL_STUDENT_MODEL" ]]; then
  MODEL_ARGS+=(--student_model_name_or_path "$LOCAL_STUDENT_MODEL")
fi

accelerate launch --num_processes 1 pave_opd_training/train_pave_opd.py \
  --config "$CONFIG" \
  --stage sft \
  --train_file "$TRAIN_FILE" \
  --image_root "$IMAGE_ROOT" \
  --output_dir "$OUTPUT_DIR" \
  "${MODEL_ARGS[@]}" \
  2>&1 | tee "logs/sft_a800_$(date +%Y%m%d_%H%M%S).log"
