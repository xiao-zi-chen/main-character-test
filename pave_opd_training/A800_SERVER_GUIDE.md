# Single A800 Server Guide

This guide is for a single A800 server. The recommended mode is:

```text
Train server: Qwen3-VL-8B student LoRA/SFT/rollout
Teacher: offline or separate short-rented 32B service
```

Do not keep a 32B teacher permanently on the same A800 unless you are only debugging with 4-bit teacher loading.

## 1. Recommended Server

```text
GPU: 1 x A800 80GB
CPU: 24-32 cores
RAM: 128GB minimum, 256GB preferred
Disk: 2TB NVMe
CUDA image: CUDA 12.1/12.4, PyTorch 2.4+
```

If the rented A800 is not 80GB, use `pave_opd_qwen3vl8b_a800_qlora.yaml`.

## 2. Upload Files

Upload at least:

```text
pave_opd_training/
pave_opd_training_plan.md
data/pave_opd_train.jsonl
images/
```

On Windows, create a zip:

```powershell
powershell -ExecutionPolicy Bypass -File pave_opd_training/server_scripts/pack_for_server.ps1
```

Then upload `pave_opd_server_package.zip` and your real data/images.

If you want to upload from Windows with the provided SSH endpoint, run locally:

```powershell
powershell -ExecutionPolicy Bypass -File pave_opd_training/server_scripts/pack_for_server.ps1
powershell -ExecutionPolicy Bypass -File pave_opd_training/server_scripts/install_ssh_key_seetacloud.ps1
powershell -ExecutionPolicy Bypass -File pave_opd_training/server_scripts/upload_to_seetacloud.ps1
```

The SSH key script asks for the server password once, then later uploads can use key login. The upload script intentionally does not store a password.

## 3. Server Setup

```bash
unzip pave_opd_server_package.zip -d pave_opd_project
cd pave_opd_project
bash pave_opd_training/server_scripts/setup_a800.sh
```

Before downloading gated models or using an API teacher, set secrets on the server:

```bash
bash pave_opd_training/server_scripts/set_server_secrets.sh
```

This creates `.env` with permission `600`. Do not put real keys in code or config files.

## 3.1 No-GPU / CPU Mode Preparation

Yes, you can boot the instance without GPU first if your provider keeps the same disk after switching to A800.

Use no-GPU mode for:

```text
installing Python packages
downloading Qwen3-VL-8B weights
downloading datasets
unpacking images
converting raw benchmark files to jsonl
checking file paths
```

Do not use no-GPU mode for:

```text
CUDA correctness check
bitsandbytes GPU check
training speed test
model forward/backward test
```

CPU download:

```bash
bash pave_opd_training/server_scripts/setup_a800.sh
bash pave_opd_training/server_scripts/download_assets_cpu.sh
```

On AutoDL, if `/etc/network_turbo` says the region is unsupported, the script falls back to:

```bash
export HF_ENDPOINT=https://hf-mirror.com
```

Only download the 32B teacher on this disk if you have enough disk space:

```bash
TEACHER=1 bash pave_opd_training/server_scripts/download_assets_cpu.sh
```

After switching to A800, run:

```bash
source .venv/bin/activate
python - <<'PY'
import torch
print(torch.cuda.is_available())
print(torch.cuda.get_device_name(0))
print(torch.cuda.is_bf16_supported())
PY
```

If you upload data separately:

```bash
mkdir -p data images
# put train jsonl into data/pave_opd_train.jsonl
# put image files under images/
```

## 4. Run SFT

If you want a quick first seed from COCO without downloading the full val2014 zip:

```bash
bash pave_opd_training/server_scripts/prepare_coco_seed_light.sh
```

This creates:

```text
data/pave_opd_train.jsonl
images/val2014/...
```

```bash
bash pave_opd_training/server_scripts/run_sft_a800.sh
```

Equivalent explicit command:

```bash
CONFIG=pave_opd_training/configs/pave_opd_qwen3vl8b_a800_lora.yaml \
TRAIN_FILE=data/pave_opd_train.jsonl \
IMAGE_ROOT=. \
OUTPUT_DIR=outputs/a800_qwen3vl8b_pave_sft \
bash pave_opd_training/server_scripts/run_sft_a800.sh
```

## 5. Teacher Strategy

Recommended:

```text
1. Run SFT on A800.
2. Generate student rollouts.
3. Score/rewrite rollouts with Qwen3-VL-32B on a separate teacher machine or short-rented instance.
4. Continue training on A800 with cached teacher annotations.
```

The current training script supports local teacher OPD. For one A800, this is only for debugging:

```bash
bash pave_opd_training/server_scripts/run_opd_a800_with_local_teacher.sh
```

It uses `--teacher_load_in_4bit true`, but it may still be slow or unstable depending on sequence length and image tokens.

## 6. Evaluate

After inference, save predictions as `outputs/predictions.jsonl`, then:

```bash
bash pave_opd_training/server_scripts/run_eval_a800.sh
```

The important numbers are:

```text
fpr_on_negative
tnr_on_negative
refusal_recall
over_refusal_rate_supported
right_specific_rate
```

## 7. A800 Defaults

The A800 config uses:

```text
max_length: 3072
batch size: 1
grad accumulation: 32
LoRA rank: 64
bf16: true
vision tower: frozen
projector: trainable
```

If out of memory:

```text
1. switch to pave_opd_qwen3vl8b_a800_qlora.yaml
2. reduce max_length to 2048
3. set train_projector: false
4. reduce LoRA rank to 32
```

If there is still headroom:

```text
1. increase max_length to 4096
2. increase LoRA rank to 128
3. set num_rollouts to 2 for rollout generation
```
