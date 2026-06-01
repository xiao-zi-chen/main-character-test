# Server Data Status

Server project root:

```text
/root/autodl-tmp/pave_opd_project
```

Current usable training seed:

```text
data/pave_opd_train.jsonl
images/val2014/
```

Verified status:

```text
train_samples: 300
unique_images: 104
missing_images: 0
```

Uploaded raw-ready dataset subset:

```text
data/raw_datasets_ready/
files: 28
size: 1.8G
```

Included complete sources:

```text
coco2014/annotations_trainval2014.zip
visual_genome/annotations/*.json.zip
vqav2/*.zip
textvqa/*.json
textocr/*.json
llava_instruct_150k/*.json
sharegpt4v/sharegpt4v_instruct_gpt4-vision_cap100k.json
```

Not included because incomplete or too large for current stage:

```text
COCO train2014.zip
COCO val2014.zip
Visual Genome image zips
TextVQA train_val_images.zip
RLHF-V parquet
RLAIF-V parquet
```

Current server capacity:

```text
/root/autodl-tmp: 100G total, about 73G free after cleanup
RAM: about 1.0TiB
GPU: not attached at last check
Qwen3-VL-8B cache: present, about 17G
```

First A800 training command after GPU is attached:

```bash
cd /root/autodl-tmp/pave_opd_project
source .venv/bin/activate
nvidia-smi
bash pave_opd_training/server_scripts/run_sft_a800.sh
```

This first run is a pipeline validation run, not the final paper-scale experiment. For paper-scale experiments, expand selected images and converted PAVE-DeSpec samples before running final SFT/OPD.
