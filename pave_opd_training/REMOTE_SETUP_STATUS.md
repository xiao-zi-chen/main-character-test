# Remote Setup Status

Project root: `/root/autodl-tmp/pave_opd_project`

Completed:

- SSH key login works.
- PAVE-OPD package uploaded and extracted.
- Python virtualenv created at `.venv`.
- PyTorch / Transformers / Accelerate / PEFT / qwen-vl-utils installed.
- Qwen3-VL-8B-Instruct downloaded locally under `cache/huggingface/models/Qwen3-VL-8B-Instruct`.
- Local config and processor load successfully.
- Evaluation script runs on sample predictions.

Current mode:

- No GPU attached. `nvidia-smi` reports no devices.
- Switch the instance to A800 before training.

Next required user files:

- `data/pave_opd_train.jsonl`
- image files under `images/` or paths referenced by the JSONL.

Recommended next command after switching to A800:

```bash
cd /root/autodl-tmp/pave_opd_project
source .venv/bin/activate
python - <<'PY'
import torch
print(torch.cuda.is_available())
print(torch.cuda.get_device_name(0))
print(torch.cuda.is_bf16_supported())
PY
bash pave_opd_training/server_scripts/run_sft_a800.sh
```

