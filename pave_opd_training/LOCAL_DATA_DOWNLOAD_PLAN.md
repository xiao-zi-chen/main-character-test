# PAVE-OPD 本地数据下载计划

目标不是“数据越多越好”，而是优先拿到能构造以下样本的图像和标注：

- false premise：问题预设的物体/属性/关系不存在
- unsupported specificity：能看出粗粒度对象，但不能确认品牌、品种、材质、型号、文字细节
- OCR uncertainty：图中文字模糊、缺失、不可读时不乱编
- supported normal QA：确实能回答时不要过度拒答

建议所有大数据都先下载到本地 `I:\多模态幻觉\raw_datasets\`，整理出小批量训练子集后再上传服务器。

## 当前已有

```text
I:\多模态幻觉\annotations_trainval2014.zip
I:\多模态幻觉\images\val2014\                  # 当前 104 张 seed 图
服务器: /root/autodl-tmp/pave_opd_project/data/pave_opd_train.jsonl
服务器: /root/autodl-tmp/pave_opd_project/images/val2014/
```

当前 300 条 seed 样本已经够做链路验证，但不够做论文主实验。

## P0：最应该先下

### 1. COCO 2014 train/val 的小批量图片

用途：

- object false premise
- count
- common object supported QA
- 基础 caption / object grounding

本地建议路径：

```text
I:\多模态幻觉\raw_datasets\coco2014\annotations_trainval2014.zip
I:\多模态幻觉\raw_datasets\coco2014\val2014\
I:\多模态幻觉\raw_datasets\coco2014\train2014\
```

建议策略：

- 不要一上来全下 COCO train2014。
- 先从 annotation 里抽 2k-5k 张图，按 image list 下载对应图片。
- 目标先扩到 5k-15k 条 PAVE-DeSpec 样本。

是否必须全量下载：

```text
否。当前阶段只需要 selected images。
```

### 2. Visual Genome

用途：

- object / attribute / relation / bbox
- 构造 specificity_chain
- 构造关系类 false premise，比如 "person holding umbrella" 但图中没有 holding 关系
- 构造属性类 unsupported specificity，比如颜色、材质、细粒度类别

本地建议路径：

```text
I:\多模态幻觉\raw_datasets\visual_genome\
  images\
  objects.json
  attributes.json
  relationships.json
  region_descriptions.json
  image_data.json
```

建议先下载：

```text
image metadata
objects
attributes
relationships
region descriptions
images part 1 / part 2
```

优先级：

```text
非常高。它比 COCO 更适合做“颗粒度控制”和“关系幻觉”。
```

### 3. TextVQA + TextOCR

用途：

- OCR 幻觉
- 图中文字证据不足
- 模糊/不可读文字时不编具体内容
- 看得见文本时正常回答，避免模型只会拒答

本地建议路径：

```text
I:\多模态幻觉\raw_datasets\textvqa\
  train_questions.json
  val_questions.json
  train_images\
  ocr_tokens\

I:\多模态幻觉\raw_datasets\textocr\
  train_val_annotations.json
  images\
```

建议策略：

- TextVQA 先下 train/val questions、OCR tokens、train images。
- TextOCR 如果空间足够再下，它能给更细的文字框和 unreadable 标注。

优先级：

```text
非常高。你的任务里 OCR uncertainty 是强论文点。
```

### 4. RLHF-V / RLAIF-V

用途：

- 直接提供 hallucinated span / chosen-rejected / correctional feedback
- 适合转成 OPD 的正负样本
- 适合做 baseline：DPO/OPD on generic hallucination preference data

本地建议路径：

```text
I:\多模态幻觉\raw_datasets\rlhf_v\
I:\多模态幻觉\raw_datasets\rlaif_v\
```

建议策略：

- 先下 RLHF-V，因为它是细粒度 correctional human feedback，更贴近 hallucination repair。
- RLAIF-V 可以作为大规模 preference 补充，但要过滤掉过长、过泛的 caption。

优先级：

```text
高。它们不替代 PAVE-DeSpec，但很适合做 OPD 的偏好来源和对比实验。
```

## P1：第二阶段下载

### 5. VQA-v2

用途：

- supported normal QA
- 防止模型训练后过度保守
- yes/no、count、attribute 的常规问答

本地建议路径：

```text
I:\多模态幻觉\raw_datasets\vqav2\
  questions\
  annotations\
  images -> 可以复用 COCO train2014/val2014
```

建议策略：

- 先下 questions/annotations。
- 图片尽量复用本地 COCO，不重复下载。

### 6. LLaVA-Instruct-150K

用途：

- 保留通用视觉指令能力
- 做 SFT base mix
- supported instruction 样本

本地建议路径：

```text
I:\多模态幻觉\raw_datasets\llava_instruct_150k\
```

注意：

- 它通常依赖 COCO 图片。
- 不要让它在 OPD 阶段占比太高，否则会冲淡 specificity 控制。

### 7. ShareGPT4V

用途：

- 高质量长 caption
- 视觉概念覆盖更丰富
- 作为 general instruction/caption base

本地建议路径：

```text
I:\多模态幻觉\raw_datasets\sharegpt4v\
```

注意：

- 长 caption 很容易强化“说得很细”的习惯。
- 对你的任务只能少量混入，必须搭配 PAVE-DeSpec 的 over-specific 负样本。

## P2：暂时不急

### 8. A-OKVQA / OK-VQA

用途：

- 外部知识相关 VQA
- 区分“图像证据不足”和“可以靠常识/外部知识回答”

不急原因：

- 它不是你主问题的第一优先级。
- 容易引入知识推理变量，论文主线会变散。

### 9. VCR

用途：

- 复杂关系、动作、因果、视觉常识

不急原因：

- 格式更复杂。
- 数据处理成本高。
- 等 PAVE-DeSpec 主链路跑通后再加。

## 不建议现在下载或混入训练

```text
POPE / AMBER / MMHal-Bench / HallusionBench
```

原因：

- 更适合作为评测，不适合作为主训练来源。
- 混进训练会让 reviewer 质疑 test contamination。

## 第一版论文训练数据目标

建议先做这个规模：

```text
PAVE-DeSpec custom: 20k-40k
General VQA / instruction: 5k-10k
Hallucination preference converted: 5k-10k
OCR uncertainty: 5k-10k
Dev: 1k
Test: 2k，最好人工抽查或人工修订
```

第一版配比：

```text
SFT:
  PAVE-DeSpec custom                 45%
  supported normal QA                15%
  OCR uncertainty                    15%
  hallucination preference converted 15%
  general instruction                10%

OPD:
  PAVE-DeSpec custom                 70%
  hallucination preference converted 20%
  supported normal QA                10%
```

## 本地下载后上传服务器的目录约定

本地：

```text
I:\多模态幻觉\raw_datasets\
I:\多模态幻觉\processed_datasets\
I:\多模态幻觉\processed_datasets\pave_opd_train.jsonl
I:\多模态幻觉\processed_datasets\pave_opd_dev.jsonl
I:\多模态幻觉\processed_datasets\pave_opd_test.jsonl
I:\多模态幻觉\processed_datasets\images\
```

服务器：

```text
/root/autodl-tmp/pave_opd_project/data/
/root/autodl-tmp/pave_opd_project/images/
```

原则：

- 原始大包尽量留本地。
- 服务器只放训练需要的 JSONL 和 selected images。
- 先抽样、转换、校验，再上传。
