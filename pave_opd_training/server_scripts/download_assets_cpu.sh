#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$PWD}"
VENV_DIR="${VENV_DIR:-$PROJECT_ROOT/.venv}"

cd "$PROJECT_ROOT"
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
  set +a
fi
source "$VENV_DIR/bin/activate"

export HF_HOME="${HF_HOME:-$PROJECT_ROOT/cache/huggingface}"
export TRANSFORMERS_CACHE="${TRANSFORMERS_CACHE:-$HF_HOME/transformers}"
export HF_HUB_ENABLE_HF_TRANSFER="${HF_HUB_ENABLE_HF_TRANSFER:-1}"
export PIP_CACHE_DIR="${PIP_CACHE_DIR:-$PROJECT_ROOT/cache/pip}"

if [[ -f /etc/network_turbo ]]; then
  # AutoDL academic proxy. Some regions print a message and do not export proxy
  # variables; that is fine because we fall back to hf-mirror below.
  # shellcheck disable=SC1091
  source /etc/network_turbo || true
fi

export HF_ENDPOINT="${HF_ENDPOINT:-https://hf-mirror.com}"

python -m pip install -U "huggingface_hub[cli]" hf_transfer

mkdir -p "$HF_HOME" data images

cat <<'EOF'
Downloading model snapshots. This does not require a GPU.
If a repo is gated, run:
  huggingface-cli login
EOF

echo "HF_ENDPOINT=${HF_ENDPOINT}"

download_repo() {
  local repo_id="$1"
  local local_dir="$2"
  if command -v hf >/dev/null 2>&1; then
    hf download "$repo_id" --local-dir "$local_dir"
  else
    huggingface-cli download "$repo_id" --local-dir "$local_dir" --local-dir-use-symlinks False
  fi
}

download_repo Qwen/Qwen3-VL-8B-Instruct "$HF_HOME/models/Qwen3-VL-8B-Instruct"

cat <<'EOF'

Student model downloaded.

Optional teacher download, only if disk/network budget allows:
  TEACHER=1 bash pave_opd_training/server_scripts/download_assets_cpu.sh
EOF

if [[ "${TEACHER:-0}" == "1" ]]; then
  download_repo Qwen/Qwen3-VL-32B-Instruct "$HF_HOME/models/Qwen3-VL-32B-Instruct"
fi
