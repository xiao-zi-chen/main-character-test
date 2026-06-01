#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$PWD}"
VENV_DIR="${VENV_DIR:-$PROJECT_ROOT/.venv}"
PYTHON_BIN="${PYTHON_BIN:-}"

cd "$PROJECT_ROOT"

if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
  set +a
fi

if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python)"
  elif [[ -x /root/miniconda3/bin/python ]]; then
    PYTHON_BIN="/root/miniconda3/bin/python"
  else
    echo "No Python interpreter found. Install Python or set PYTHON_BIN=/path/to/python." >&2
    exit 1
  fi
fi

mkdir -p "$PROJECT_ROOT/cache/pip" "$PROJECT_ROOT/cache/huggingface"
export PIP_CACHE_DIR="${PIP_CACHE_DIR:-$PROJECT_ROOT/cache/pip}"
export HF_HOME="${HF_HOME:-$PROJECT_ROOT/cache/huggingface}"
export TRANSFORMERS_CACHE="${TRANSFORMERS_CACHE:-$HF_HOME/transformers}"

if [[ -f /etc/network_turbo ]]; then
  # shellcheck disable=SC1091
  source /etc/network_turbo || true
fi

"$PYTHON_BIN" -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

python -m pip install --upgrade pip setuptools wheel

python - <<'PY' || NEED_TORCH=1
import torch
assert torch.cuda.is_available(), "CUDA is not available"
print("Existing torch:", torch.__version__, "CUDA:", torch.version.cuda, "GPU:", torch.cuda.get_device_name(0))
PY

if [[ "${NEED_TORCH:-0}" == "1" ]]; then
  python -m pip install --upgrade torch torchvision --index-url https://download.pytorch.org/whl/cu124
fi

python -m pip install -r pave_opd_training/requirements.txt

python - <<'PY'
import torch
import transformers
import accelerate
print("torch:", torch.__version__)
print("cuda available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("gpu:", torch.cuda.get_device_name(0))
    print("bf16 supported:", torch.cuda.is_bf16_supported())
print("transformers:", transformers.__version__)
print("accelerate:", accelerate.__version__)
PY

mkdir -p data images outputs logs cache

cat <<'EOF'

Setup finished.

Before training, put files here:
  data/pave_opd_train.jsonl
  images/...

Then run:
  bash pave_opd_training/server_scripts/run_sft_a800.sh
EOF
