# PAVE-OPD Dataset Build Guide

PAVE-OPD 的效果上限主要由数据决定。OPD 是训练方式，真正解决幻觉问题的是数据里是否明确覆盖：

```text
false premise
insufficient evidence
unsupported specificity
over-vague refusal
right-specific answer
```

## 1. 你需要的数据集

需要。不是必须从零做一个很大的 benchmark，但必须整理一个高质量训练集和一个干净评测集。

建议拆成两部分：

| 数据 | 目标 | 数量建议 |
| --- | --- | --- |
| Train set | 训练 PAVE-OPD 行为 | 20k-80k |
| Dev set | 调 prompt、阈值、ablation | 1k-2k |
| Test set | 论文主表 | 2k-5k，最好人工核验 |

最小能跑论文雏形：

```text
train: 10k-20k
dev: 500-1000
test: 1000-2000
```

## 1.1 能不能用别人的常见训练数据做底座

可以，而且建议用。但要注意：**公开通用数据只能做能力底座，不能替代你的 PAVE/DeSpec 数据。**

推荐把数据分成三层：

| 层级 | 作用 | 是否必须 |
| --- | --- | --- |
| General VLM instruction base | 保持模型基本看图问答能力，避免训坏 | 建议 |
| Hallucination / preference base | 提供通用幻觉对齐信号 | 建议 |
| PAVE-DeSpec custom data | 学会前提修复、证据状态、颗粒度控制 | 必须 |

如果只用通用底座数据，模型会变得更会聊天/描述，但不一定会：

```text
识别错误问题前提
承认证据不足
选择正确颗粒度
避免 over-specific 和 over-vague
```

所以论文贡献必须落在第三层。

## 1.2 推荐公开数据底座

### 原始图像/问题/caption 来源

这些数据更适合当“原材料”，不是直接当 PAVE-OPD 的最终训练样本：

| 数据类型 | 常见数据集/来源 | 在 PAVE-OPD 里的用法 |
| --- | --- | --- |
| 通用图像-caption | MSCOCO / COCO, Flickr30k | 取图像和基础 caption，生成 supported normal QA 和粗粒度 chain |
| 密集视觉标注 | Visual Genome | 用 object / attribute / relation / bbox 构造 specificity chain 和 hard negatives |
| 视觉问答 | VQA-v2, A-OKVQA / OKVQA, TextVQA | 构造问答 instruction，补 supported 样本，避免过度拒答 |
| 视觉推理/复杂场景 | VCR | 构造复杂关系、动作、因果前提的偏好对 |
| 视觉指令数据 | LLaVA-Instruct-150K, ShareGPT4V, Silkie / VLFeedback | 做 SFT / preference 底座，保留通用指令能力 |
| 多域图像 | MovieNet, Google Landmark v2 等 | 增加图像域多样性，减少只在 COCO 场景有效 |

你的主训练样本应该是：

```text
原始图像/问题/caption 来源
-> 抽取视觉前提
-> 构造 specificity chain
-> 构造 over-specific / over-vague / right-specific responses
-> 用 SFT + OPD 训练
```

不要把 `COCO caption`、`VQA-v2 answer` 或 `LLaVA-Instruct answer` 原样当作你的核心贡献数据。它们缺少 `evidence state` 和 `target_specificity_index`，无法直接训练“说到刚好”。

### 通用视觉指令底座

| 数据 | 用途 | 使用建议 |
| --- | --- | --- |
| LLaVA-Instruct-150K | 通用视觉 instruction tuning | 抽 20k-80k，作为 supported normal QA 和通用能力保留 |
| ShareGPT4V | 高质量图像描述和视觉指令 | 可抽 20k-100k，但不要让长 caption 占比太高 |
| LLaVA-OneVision data mix | 多图/视频/复杂视觉任务能力 | 如果下载和格式转换顺利，可少量混入 |

注意：长 caption 数据可能鼓励模型“说得很细”。对你的任务来说，这类数据必须配合 PAVE-DeSpec 样本，否则会强化 over-specific hallucination。

### 幻觉/偏好底座

| 数据 | 用途 | 使用建议 |
| --- | --- | --- |
| RLAIF-V | 多模态 preference，覆盖多任务多领域 | 可转成 chosen/rejected 或 bad phrase |
| RLHF-V | 细粒度 correctional feedback | 很适合抽 hallucinated span / bad phrase |
| HA-DPO data | hallucination-aware positive/negative pairs | 可作为 DPO/OPD baseline 数据 |
| VLFeedback / Silkie-style data | AI feedback preference | 可作为通用 preference 对齐补充 |

这些数据能帮你减少通用幻觉，但多数没有明确的 `specificity_chain`。因此它们不能直接证明你的颗粒度控制创新，最好转化后再用：

```text
chosen -> right_specific_answer
rejected -> bad_answers / bad_phrases
hallucinated span -> over_specific_indices 或 bad phrase
```

### 不建议直接当训练集的 benchmark

| Benchmark | 建议 |
| --- | --- |
| POPE | 主要当评测和 sanity check，不建议直接当主训练集 |
| MMHal-Bench | 样本少，适合评估和分析，不适合作为主训练来源 |
| AMBER | 可少量转训练，但更建议保留为主评测 |
| HallusionBench | 可做鲁棒性评测，谨慎混训练，避免污染评测 |

更稳的做法是：

```text
训练集: COCO/VG/VQA/TextVQA/LLaVA/ShareGPT4V/RLAIF-V/RLHF-V + 自构造 PAVE-DeSpec
测试集: FINER/MoHo/KIE-HVQA/AMBER/POPE-DASH
```

这样 reviewer 更难质疑你把 benchmark 训练进去了。

### OCR / 文本底座

| 数据 | 用途 | 使用建议 |
| --- | --- | --- |
| KIE-HVQA | 模糊/退化文档 OCR 幻觉 | P0，直接适配证据不足 |
| LLaVAR-style text-rich data | 文本图像理解能力 | 可补 OCR 能力，但要加入 unreadable/insufficient 样本 |
| TextHalu-Bench | 场景文字语义幻觉 | 可做专项扩展 |

## 1.3 推荐数据混合比例

第一版 A800 训练建议：

```text
PAVE-DeSpec custom data: 40%
LLaVA/ShareGPT4V general instruction: 20%
KIE/OCR uncertainty data: 15%
RLAIF-V/RLHF-V/HA-DPO hallucination preference: 15%
supported normal QA anti-over-refusal: 10%
```

OPD 阶段建议更聚焦：

```text
PAVE-DeSpec custom data: 70%
hallucination/preference converted data: 20%
supported normal QA anti-over-refusal: 10%
```

不要在 OPD 阶段大量混普通 caption 数据。OPD 要修的是学生自己的错误轨迹，数据越贴近 false premise / unsupported specificity，收益越明显。

## 1.4 为什么 OPD 可以用，但不能单独代表贡献

可以用 OPD，而且 PAVE-OPD 就是用 OPD。

不能把论文写成“我用了 OPD 所以解决幻觉”，原因是：

```text
OPD 是训练机制；
幻觉/颗粒度控制是任务定义和数据监督；
没有前提标注、证据状态和 specificity chain，OPD 只是在学生自己的输出上模仿 teacher。
```

正确写法：

> We use on-policy distillation as the optimization mechanism, but the key contribution is premise-aware and specificity-aware supervision over student-generated hallucination trajectories.

也就是：

```text
OPD 负责“从模型自己的错误分布中学习”
PAVE-DeSpec 数据负责“告诉模型什么叫正确颗粒度”
```

这两者不冲突，应该组合起来。

## 2. 必须覆盖的错误类型

| 类型 | 占比建议 | 解决的问题 |
| --- | --- | --- |
| object false premise | 20% | 问题预设不存在物体 |
| attribute over-specific | 15% | 颜色、品牌、材质、品种等说太细 |
| relation / spatial | 15% | 关系、位置、交互编造 |
| OCR / text uncertainty | 20% | 看不清却编具体文字 |
| count / small object | 10% | 数量和小物体误判 |
| over-vague refusal | 10% | 明明能粗粒度回答却拒答 |
| supported normal QA | 10% | 防止模型学成保守拒答器 |

关键：训练集必须同时有 negative 和 supported 样本，否则模型会只学会“不确定/无法判断”。

## 3. 每条样本必须有的字段

```json
{
  "id": "sample_000001",
  "image": "images/sample.jpg",
  "question": "What brand is the Toyota?",
  "visual_premises": [
    {"text": "the vehicle is a Toyota", "status": "insufficient", "type": "attribute"}
  ],
  "answerability": "partially_answerable",
  "truth_label": "insufficient",
  "hallucination_type": "attribute",
  "specificity_chain": [
    "the vehicle is a Toyota SUV",
    "the vehicle is a Toyota",
    "the vehicle is an SUV",
    "the image shows a vehicle"
  ],
  "target_specificity_index": 3,
  "over_specific_indices": [0, 1, 2],
  "over_vague_indices": [],
  "right_specific_answer": "The image shows a vehicle, but I cannot verify that it is a Toyota.",
  "bad_answers": [
    "It is a Toyota SUV.",
    "I cannot answer anything about the image."
  ],
  "critical_phrases": ["vehicle", "cannot verify", "Toyota"],
  "bad_phrases": ["Toyota SUV", "It is a Toyota"]
}
```

真正的颗粒度控制依赖这四个字段：

```text
specificity_chain
target_specificity_index
over_specific_indices
over_vague_indices
```

如果没有这些字段，模型仍然能学到拒答/前提修复，但论文里的 DeSpec/right-specific 贡献会变弱。

## 4. 数据来源建议

| 来源 | 用途 | 优先级 |
| --- | --- | --- |
| FINER | 细粒度负向查询、false premise | P0 |
| MoHoBench | 不可回答问题、诚实拒答 | P0 |
| KIE-HVQA | OCR 模糊和证据不足 | P0 |
| AMBER | object/attribute/relation 通用幻觉 | P0 |
| POPE / DASH-B | 物体存在性 false positive | P0 |
| 自构造 DeSpec 样本 | specificity chain 和 over-vague refusal | P0 |
| TextHalu-Bench | scene text 补充 | P1 |
| ViCrit / R2-HalBench | span-level bad phrase 补充 | P1 |

## 5. 构造流程

### Step 1：统一原始数据

把所有 benchmark 转成统一字段：

```text
image
question
truth_label
hallucination_type
right_specific_answer
```

### Step 2：抽取视觉前提

从问题里抽出视觉前提：

```text
What color is the umbrella?
-> premise: an umbrella is visible
```

```text
What brand is the Toyota?
-> premise: the vehicle is a Toyota
```

### Step 3：标注 evidence state

每个 premise 必须是：

```text
supported / contradicted / insufficient
```

### Step 4：构造 specificity chain

每条样本构造 3-6 个层级：

```text
red Toyota SUV
-> Toyota SUV
-> SUV
-> car
-> vehicle
```

OCR：

```text
invoice number is INV-739204
-> invoice number is visible and readable
-> invoice number area is visible but unreadable
-> document is visible
```

### Step 5：标注 target index

选择视觉证据支持的最细层级。

```text
target_specificity_index = 视觉证据支持的最细层
```

### Step 6：构造坏答案

至少三类：

```text
over-specific hallucination
over-vague refusal
false-premise-following answer
```

## 6. 质量控制

每条样本检查：

| 检查项 | 必须满足 |
| --- | --- |
| target level 是否被图像支持 | 是 |
| over-specific 是否确实不被支持 | 是 |
| right_specific_answer 是否没有编造 | 是 |
| supported 样本是否没有被误标成拒答 | 是 |
| OCR 样本是否区分 unreadable 和 absent | 是 |

建议人工核验：

```text
dev/test: 100%
train: 抽检 10-20%
```

## 7. 最小可行数据配比

第一版建议：

```text
FINER-like negative queries: 4000
MoHo-like unanswerable QA: 3000
KIE/OCR uncertainty: 3000
AMBER/POPE/DASH object-relation: 3000
supported normal QA: 3000
over-vague refusal correction: 2000
```

总计约 18k。这个规模可以先在单 A800 上跑 SFT 和 PAVE-Lite。

论文增强版：

```text
train: 50k+
dev: 2k
test: 3k-5k
```

## 8. 你现在要做什么

按顺序做：

1. 确认图片和 benchmark 是否能下载。
2. 先整理 1k 条小样本，跑通全链路。
3. 确认 `specificity_chain` 和 `target_specificity_index` 标注方式稳定。
4. 扩到 10k-20k 训练集。
5. 在 A800 上跑 SFT。
6. 生成 student rollouts。
7. 用 32B teacher/API 离线补 premise label、bad span、right-specific rewrite。
8. 跑 PAVE-OPD / PAVE-Lite。
9. 用 dev set 看 FPR、over-refusal、specificity exact。
10. 再扩数据和跑正式主表。

## 9. 能解决什么，不能解决什么

能重点解决：

```text
false premise hallucination
unsupported specificity
OCR/text uncertainty hallucination
over-vague refusal
object/attribute/relation false positive
```

不能保证完全解决：

```text
所有开放世界幻觉
外部知识 factuality
复杂医学/法律/专业图像判断
视频长时序幻觉
完全无标注场景
```

论文里不要写“解决全部幻觉”。更稳的写法是：

> We target evidence-bounded specificity failures, where MLLMs either follow unsupported visual premises, over-specify beyond image evidence, or over-refuse despite partially supported evidence.
