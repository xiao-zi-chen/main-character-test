# PAVE-OPD 训练方案：面向多模态幻觉的前提感知在策略蒸馏

更新时间：2026-06-01

## 1. 论文主线

建议把方法命名为：

**PAVE-OPD: Premise-Aware Visual Evidence On-Policy Distillation**

中文：

**前提感知视觉证据在策略蒸馏**

一句话主张：

> 许多多模态幻觉不是模型完全看错，而是模型沿着用户问题中的错误视觉前提继续回答，或说出了超过视觉证据支持边界的细节。PAVE-OPD 让模型在自己的生成轨迹上学习：先验证问题前提，再输出视觉证据支持的最具体答案。

核心问题从普通 DPO 的：

```text
chosen answer > rejected answer
```

升级为：

```text
student-generated failure trajectory
→ teacher/evidence-guided token-level correction
→ premise-aware right-specific answer policy
```

## 1.1 你真正要达成的效果

这篇论文不能只追求“训练后模型更保守”。真正要达成的是四个同时成立的效果：

| 目标效果 | 具体含义 | 为什么重要 |
| --- | --- | --- |
| 少编 | 问题前提错误或证据不足时，不沿着错误前提编答案 | 解决 false premise hallucination |
| 不乱拒 | 图像能支持粗粒度答案时，不直接说无法回答 | 避免把方法做成保守拒答器 |
| 说到刚好 | 能回答到视觉证据支持的最细粒度，但不越界 | 对应 DeSpec / right-specific 核心价值 |
| 跨类型有效 | object、attribute、relation、OCR、unanswerable 都有效 | 避免只在 POPE 类 object benchmark 上有效 |

一句话验收标准：

> PAVE-OPD 应该同时降低 false-positive hallucination 和 over-refusal，并提升 right-specific answer rate。

更准确地说，你要解决的不是单一拒答问题，而是一个三轴控制问题：

```text
Premise correctness: 问题前提是否成立
Evidence sufficiency: 图像证据是否足够
Specificity level: 答案应该具体到哪一层
```

PAVE-OPD 必须同时学会：

```text
false premise -> repair
insufficient evidence -> refuse or de-specify
partial evidence -> answer at supported coarser level
full evidence -> answer specifically
```

这才是真正的“颗粒度控制”，不是简单拒答。

## 1.2 论文级成功线

第一版实验建议用下面的目标作为是否继续投入的判断线。

| Benchmark | 最重要指标 | 论文级目标 |
| --- | --- | --- |
| FINER | negative-query accuracy / FPR | 相比 SFT 或 DPO 提升 5-10 个点，且超过 OPA-DPO |
| MoHoBench | refusal recall + over-refusal | 合理拒答提升，同时 supported 子集不明显掉点 |
| KIE-HVQA | OCR hallucination rate | 模糊 OCR 编造率显著下降，不能只提高拒答率 |
| AMBER | hallucination rate | 不牺牲通用 object/attribute/relation 能力 |
| POPE/DASH-B | FPR / TNR | FPR 明显低于 base/SFT，最好优于 DPO 类 baseline |

最低可发表信号：

```text
PAVE-OPD > SFT
PAVE-OPD > vanilla DPO
PAVE-OPD >= OPA-DPO/HA-DPO on most hallucination metrics
PAVE-OPD does not substantially increase over-refusal
```

强论文信号：

```text
PAVE-OPD 在 FINER / MoHo / KIE 三个机制不同的 benchmark 上都有效；
standard OPD 有提升但不如 PAVE-OPD；
去掉 premise-aware 或 visual-token weighting 后明显下降。
```

## 2. 为什么不用普通 DPO 作为主方法

DPO 可以作为 baseline，但不建议作为主方法。

| 方法 | 优点 | 对本题的缺陷 |
| --- | --- | --- |
| SFT | 简单稳定 | 容易学格式，不一定修正自生成幻觉 |
| DPO | 对 chosen/rejected 偏好有效 | 静态 pair 难覆盖推理时真实暴露的 false premise 和 over-specific failure |
| HA-DPO / OPA-DPO | 是强训练 baseline | 更偏通用幻觉偏好，不专门建模前提验证和证据粒度 |
| 普通 OPD | 缓解 train-test exposure bias | 如果所有 token 均匀 KL，容易被模板 token 稀释视觉监督 |
| PAVE-OPD | 在学生自己的错误轨迹上做证据感知蒸馏 | 需要 teacher logits、rollout 和更复杂的数据管线 |

PAVE-OPD 的论文优势是：它不是把 DPO 换成 OPD，而是把 OPD 改成适合多模态幻觉问题的训练机制。

## 3. 方法创新点

### 3.1 Premise-Aware Rollout

训练时不只喂标准答案，而是让学生模型对图像和问题自己生成回答。然后识别它是否犯了：

| 错误类型 | 示例 |
| --- | --- |
| false-premise following | 问“雨伞什么颜色”，图里没有雨伞，模型回答“蓝色” |
| over-specific hallucination | 图里只能看出车，模型说“红色 Toyota SUV” |
| over-vague refusal | 图里能看出有车，模型却说“无法回答任何内容” |
| OCR hallucination | 文本模糊不可读，模型编出具体数字 |
| relation/attribute hallucination | 关系或属性被语言先验补全 |

这使训练直接对准模型推理时会出现的错误，而不是只学习静态偏好。

### 3.2 Specificity Lattice Control

PAVE-OPD 必须显式维护一个 specificity chain，而不是只给一个最终答案。

例子：

```text
red Toyota SUV
→ Toyota SUV
→ SUV
→ car
→ vehicle
→ object
```

对每个样本标注：

```text
specificity_chain: 从最具体到最粗粒度的候选答案
target_specificity_index: 视觉证据支持的最细层级
```

训练目标不是“拒答越多越好”，而是：

```text
target level > over-specific levels
target level > over-vague levels
target level > pure refusal, if coarse answer is supported
```

这就是你论文里最核心的颗粒度控制。

### 3.3 Evidence-State Policy

每个问题前提都标注为三态：

```text
supported / contradicted / insufficient
```

对应回答策略：

| premise state | policy |
| --- | --- |
| supported | 正常回答 |
| contradicted | 否定错误前提，并回答可支持部分 |
| insufficient | 说明证据不足，避免编造 |
| partially supported | de-specify 到可支持粒度 |

### 3.4 Visual-Advantage Token Weighting

普通 OPD 对所有 token 做同等 KL，视觉信号会被大量模板词稀释。PAVE-OPD 给真正依赖视觉证据的 token 更高权重：

```text
normal token: 1.0
object / attribute / relation token: 3.0
OCR / count / exact value token: 4.0
refusal / cannot verify / unreadable token: 3.0
unsupported hallucinated span: unlikelihood penalty
```

可选视觉优势分数：

```text
VA_t = log P_teacher(y_t | image) - log P_teacher(y_t | degraded/no-image)
```

如果某个 token 在有图时概率显著上升，它更可能是视觉证据相关 token，应提高蒸馏权重。

### 3.5 Entropy-Aware OPD

教师在高不确定位置不应被强行模仿成单一答案。PAVE-OPD 采用熵感知 KL：

```text
low teacher entropy  -> reverse KL, 鼓励学生贴近教师确定判断
high teacher entropy -> reverse KL + forward KL, 避免过度自信和模式坍缩
```

这对 OCR 模糊、遮挡、细粒度属性不清楚的样本尤其重要。

### 3.6 Failure-Guided KL Mask

对已经正确的学生轨迹，不需要强行改变；对错误轨迹，增加 OPD 权重：

```text
bad rollout  -> KL weight high
good rollout -> KL weight low or only SFT anchor
```

这能避免 teacher 抹掉学生已经学到的正确行为。

## 4. 数据格式

每条样本建议保存为 jsonl：

```json
{
  "id": "sample_000001",
  "image": "images/sample.jpg",
  "question": "What color is the umbrella?",
  "visual_premises": [
    {"text": "an umbrella is visible", "status": "contradicted", "type": "object"}
  ],
  "answerability": "unanswerable",
  "truth_label": "contradicted",
  "hallucination_type": "object",
  "evidence_regions": [],
  "right_specific_answer": "I do not see an umbrella in the image, so its color cannot be determined.",
  "specificity_chain": [
    "the umbrella is blue",
    "an umbrella is visible",
    "an object is visible",
    "the requested umbrella is not visible"
  ],
  "target_specificity_index": 3,
  "over_specific_indices": [0, 1],
  "over_vague_indices": [],
  "bad_answers": [
    "The umbrella is blue.",
    "I cannot answer anything about the image."
  ],
  "critical_phrases": ["umbrella", "color", "cannot be determined"],
  "bad_phrases": ["blue umbrella", "red umbrella"]
}
```

字段解释：

| 字段 | 作用 |
| --- | --- |
| `image` | 图像路径 |
| `question` | 原始用户问题 |
| `visual_premises` | 问题中的视觉前提 |
| `status` | `supported` / `contradicted` / `insufficient` |
| `right_specific_answer` | SFT anchor 和 OPD 参考行为 |
| `specificity_chain` | 从最具体到最粗粒度/修复答案的候选层级 |
| `target_specificity_index` | 正确颗粒度层级 |
| `over_specific_indices` | 视觉证据不支持、太具体的层级 |
| `over_vague_indices` | 比目标层级更粗或过度拒答的层级 |
| `critical_phrases` | 提高 token 权重的关键词 |
| `bad_phrases` | 用 unlikelihood 惩罚的幻觉短语 |

## 5. 训练流程

### Stage 0：数据构造

数据来源建议：

| 数据 | 作用 |
| --- | --- |
| FINER | 细粒度负向查询、false premise |
| MoHoBench | 不可回答视觉问题和拒答 |
| KIE-HVQA | 模糊 OCR / 文档证据不足 |
| DASH-B / POPE | 物体存在性 false positive |
| AMBER | object / attribute / relation 通用幻觉 |
| 自构造 DeSpec 样本 | right-specific answer 和 over-vague refusal 对比 |

### Stage 1：Cold-Start SFT

目标：让模型先学会回答格式和基本策略，避免 OPD 早期 rollout 太差。

建议：

```text
student: Qwen3-VL-8B-Instruct 或 Qwen2.5-VL-7B-Instruct
samples: 20k-60k
epochs: 1-2
lr: 1e-5 到 2e-5
LoRA rank: 64 或 128
vision tower: freeze
projector: trainable
```

目标输出尽量短：

```text
Premise: contradicted
Answer: I do not see an umbrella, so its color cannot be determined.
```

### Stage 2：On-Policy Rollout

对每个样本生成多个学生回答：

```text
num_rollouts: 2-4
temperature: 0.7
top_p: 0.9
max_new_tokens: 128-256
```

自动判断 rollout 是否失败：

| 情况 | 失败判断 |
| --- | --- |
| contradicted premise | 仍然回答被否定对象的属性 |
| insufficient evidence | 编出具体值 |
| supported premise | 过度拒答 |
| OCR | 出现具体不可验证字符/数字 |

### Stage 3：PAVE-OPD

总 loss：

```text
L = L_opd
  + lambda_sft * L_sft_anchor
  + lambda_ul * L_unlikelihood_bad_span
```

OPD loss：

```text
L_opd = mean_t w_t * KL_t(student || teacher)
```

熵感知版本：

```text
alpha_t = sigmoid((H_teacher_t - entropy_threshold) / entropy_temperature)

KL_t = (1 - alpha_t) * reverse_KL(student || teacher)
     + alpha_t * 0.5 * [reverse_KL(student || teacher) + forward_KL(teacher || student)]
```

Token 权重：

```text
w_t = rollout_weight
    * phrase_weight_t
    * visual_advantage_weight_t
```

## 6. 模型配置建议

### 最推荐主配置

| 角色 | 模型 |
| --- | --- |
| student | Qwen3-VL-8B-Instruct |
| debug student | Qwen2.5-VL-7B-Instruct |
| transfer backbone | LLaVA-OneVision-7B |
| local teacher | Qwen3-VL-32B-Instruct |
| labeling teacher | GPT-4.1 / Gemini 2.5 Pro / Qwen3-VL-235B-A22B API |

注意：token-level OPD 最好要求 student 和 teacher 同 tokenizer。否则只能做 answer-level scoring 或 DPO/GRPO，不能直接 KL。

### 6.1 教师模型最终选择

默认推荐：

```text
student: Qwen3-VL-8B-Instruct
teacher: Qwen3-VL-32B-Instruct
```

理由：

1. 同一 Qwen3-VL 家族，tokenizer 和输入格式最容易对齐，适合 token-level KL。
2. 32B teacher 比 8B student 足够强，能提供更可靠的视觉前提和 OCR 判断。
3. Qwen3-VL-8B/32B 都能围绕同一套 processor、chat template 和图像 token 管线实现，工程风险低。

如果第一阶段想更稳：

```text
student: Qwen2.5-VL-7B-Instruct
teacher: Qwen2.5-VL-32B-Instruct
```

这个组合生态更成熟，适合先把数据、loss、评估跑通。最终论文主结果再迁到 Qwen3-VL。

不建议：

| Teacher | 为什么不建议做主 OPD teacher |
| --- | --- |
| GPT/Gemini/Claude API | 通常拿不到完整 token logits，适合标注，不适合 KL OPD |
| 不同 tokenizer 的 VLM | token-level KL 对不齐，只能做 answer-level reward/scoring |
| 8B self-teacher only | 便宜但创新和上限都弱，只适合消融或低成本版 |

### 6.2 可以不在训练服务器上跑 teacher 吗

可以，而且建议你优先采用这个省钱方案。

有三种模式：

| 模式 | 训练服务器是否跑 teacher | 效果 | 成本 | 推荐程度 |
| --- | --- | --- | --- | --- |
| Full PAVE-OPD | 是，32B teacher 常驻或按 batch 加载 | 最强 | 最高 | 最终大实验 |
| Offline-Teacher PAVE-OPD | 否，teacher 在别处离线打分/缓存 | 接近 Full，略弱 | 中 | 最推荐 |
| PAVE-OPD-Lite / Self-teacher | 否，只用 API 标签 + SFT/rollout/unlikelihood | 可做初版 | 低 | 快速验证 |

#### Offline-Teacher PAVE-OPD

流程：

```text
1. 训练服务器只跑 student，生成 on-policy rollouts。
2. 把 rollout jsonl 发到 teacher 机器或短租 teacher 机器。
3. teacher 对 rollout 做：
   - premise correctness scoring
   - right-specific answer rewrite
   - bad span / critical phrase 标注
   - 可选 top-k token logprob 缓存
4. 训练服务器读缓存继续训练 student。
```

这不是最纯的 step-by-step online OPD，但论文上仍然可以合理表述为：

> iterative on-policy distillation with offline teacher scoring

关键是 rollouts 来自当前 student，所以仍然保留 on-policy 的核心：训练样本来自 student 自己的错误分布。

#### PAVE-OPD-Lite

如果你暂时完全不想跑 32B teacher，则用：

```text
API teacher 生成 gold answer / premise labels / bad phrases
student rollout
heuristic diagnosis
SFT anchor + unlikelihood + failure-weighted self-training
```

这个版本服务器最省，但严格说它不是完整 token-level OPD。建议作为：

```text
PAVE-Lite
```

不要把它当最终主方法，只做预实验或低资源 ablation。

### LoRA 参数

```yaml
bf16: true
lora_rank: 64
lora_alpha: 128
lora_dropout: 0.05
target_modules:
  - q_proj
  - k_proj
  - v_proj
  - o_proj
  - gate_proj
  - up_proj
  - down_proj
train_projector: true
freeze_vision_tower: true
```

### 训练超参

```yaml
stage: opd
max_length: 4096
max_new_tokens: 160
per_device_train_batch_size: 1
gradient_accumulation_steps: 32
learning_rate: 1.0e-5
warmup_ratio: 0.03
num_train_epochs: 1
opd_beta: 1.0
sft_anchor_weight: 0.2
unlikelihood_weight: 0.05
entropy_threshold: 4.0
visual_advantage_scale: 0.5
```

## 7. Baseline 设计

训练型 baseline：

| Baseline | 必要性 |
| --- | --- |
| Base | 必须 |
| SFT | 必须 |
| Vanilla DPO | 必须 |
| HA-DPO | 必须 |
| OPA-DPO | 必须 |
| Standard OPD | 必须 |
| Vision-OPD style crop self-distillation | 建议 |
| PAVE-OPD | 主方法 |

Prompt / decoding baseline：

| Baseline | 用途 |
| --- | --- |
| Direct | 最基础 |
| CoT | 证明长推理不一定降低幻觉 |
| Evidence-first | 强 prompt baseline |
| Abstention-aware | 拒答 baseline |
| Self-check | 生成后校验 baseline |
| VCD / HALC / OPERA | decoding 类幻觉 baseline |

## 8. Ablation

| Ablation | 目的 |
| --- | --- |
| w/o premise extraction | 验证前提建模是否关键 |
| w/o visual token weighting | 验证视觉 token 加权是否有效 |
| w/o entropy-aware KL | 验证不确定位置是否需要特殊处理 |
| w/o failure-guided mask | 验证是否需要只重点修失败轨迹 |
| w/o SFT anchor | 看 OPD 是否会漂移 |
| standard OPD | 证明不是普通 OPD 即可解决 |
| DPO vs OPD | 证明 on-policy 真实错误轨迹更有效 |

## 9. 指标

必须报告：

```text
Accuracy
FPR / TNR
Hallucination Rate
Refusal Precision
Refusal Recall
Over-refusal Rate
Answerable-only Accuracy
Unanswerable-only Accuracy
Type-wise Error Rate
```

最好补充：

```text
Premise Verification Accuracy
Right-Specific Rate
OCR Hallucination Rate
Evidence Grounding Accuracy
Calibration ECE
```

## 10. 服务器配置

### Debug 版

```text
GPU: 1 x A100 80GB 或 1 x H100 80GB
用途: Qwen2.5-VL-7B / Qwen3-VL-8B LoRA SFT，小规模 OPD
限制: 不建议本地跑 32B teacher
```

### 省钱推荐版：teacher 不在训练服务器

```text
GPU: 1 x A800 80GB
更强备选: 1 x H100 80GB
同级备选: 1 x A100 80GB
再省: 2 x L40S 48GB 或 1 x L40S 48GB + QLoRA/短序列
CPU: 24-32 核
RAM: 128GB 起，建议 256GB
NVMe: 2TB
用途: Qwen3-VL-8B student LoRA/SFT/rollout，teacher 离线标注或远程打分
```

这是你现在最应该租的配置。原因是训练服务器只承担 student，显存压力主要来自 8B VLM、图像 token、梯度和 rollout，不需要同时塞 32B teacher。单张 A800 80GB 优先用 `pave_opd_qwen3vl8b_a800_lora.yaml`；如果显存紧张，再切到 `pave_opd_qwen3vl8b_a800_qlora.yaml`。

### 推荐论文版

```text
GPU: 4 x A100 80GB 或 4 x H100 80GB
CPU: 32 核+
RAM: 256GB+
NVMe: 2TB 起，建议 4TB
用途: Qwen3-VL-8B student + Qwen3-VL-32B teacher logits + 2-4 rollouts
```

### 强力最终版

```text
GPU: 8 x H100 80GB
CPU: 64 核+
RAM: 512GB+
NVMe: 4TB+
用途: 多 backbone、大规模 ablation、32B teacher 常驻、更多 rollouts
```

不建议主实验租 A100 40GB。它可以做 4B/7B QLoRA 调试，但跑多模态 OPD + teacher logits 容易卡显存和吞吐。

如果 teacher 不在训练服务器，A100 40GB 可以做小规模 QLoRA debug，但不建议做正式主表。正式主表至少用 80GB 显存卡，避免 max visual tokens、batch 和 checkpointing 被压得太狠。

## 11. 最小可发表路线

第一版先做：

```text
student: Qwen2.5-VL-7B-Instruct
teacher: Qwen2.5-VL-32B-Instruct 或 Qwen3-VL-32B-Instruct
benchmarks: FINER, MoHoBench, KIE-HVQA, AMBER, POPE/DASH-B
baselines: Base, SFT, DPO, HA-DPO, OPA-DPO, standard OPD, PAVE-OPD
```

如果结果显示：

```text
FINER: 降低 false-positive / 提高细粒度负向查询准确率
MoHoBench: 提高合理拒答，且不过度拒答
KIE-HVQA: 降低 OCR 编造
AMBER/POPE: 不牺牲通用 object/attribute/relation 准确率
```

这条线就足够扩成论文。

## 12. 是否需要参考别人的训练模式

需要，但不能照搬。建议参考这些训练模式：

| 参考方向 | 借鉴点 | 不能照搬的原因 |
| --- | --- | --- |
| GKD / On-policy KD | 学生自生成轨迹 + teacher KL | 纯文本为主，不懂视觉前提 |
| SKD | teacher 过滤低质量学生 token | 更偏 token 接受/替换，不直接解决幻觉类型 |
| EOPD | 高熵区域 KL 稳定性 | 不是多模态证据任务 |
| VOLD | SFT cold-start + RL/OPD 联合 | 目标是推理迁移，不是 false premise |
| VA-OPD | 视觉相关 token 加权 | 需要改造成 premise/evidence-specific weighting |
| Vision-OPD | crop/full-image 自蒸馏 | 需要加入问题前提和 right-specific policy |

论文写法应该是：

> We are inspired by on-policy distillation, but standard OPD treats all tokens uniformly and does not distinguish visual premise failures from ordinary language errors. PAVE-OPD introduces premise-aware rollout diagnosis, evidence-state answer policy, and visual-advantage token weighting for hallucination mitigation.

## 13. 参考训练范式

这些工作适合放在 related work 或方法动机里，但 PAVE-OPD 需要明确强调自己的视觉前提和证据粒度设计。

| 方向 | 链接 |
| --- | --- |
| GKD / On-Policy KD | https://arxiv.org/abs/2306.13649 |
| Speculative Knowledge Distillation | https://arxiv.org/abs/2410.11325 |
| EOPD | https://arxiv.org/abs/2603.07079 |
| EOPD code | https://github.com/WLS04/EOPD |
| VOLD | https://arxiv.org/abs/2510.23497 |
| VA-OPD | https://arxiv.org/abs/2605.21924 |
| Vision-OPD | https://arxiv.org/abs/2605.18740 |
| Vision-OPD code | https://github.com/VisionOPD/Vision-OPD |
| Qwen3-VL | https://github.com/QwenLM/Qwen3-VL |
| Qwen2.5-VL | https://github.com/QwenLM/Qwen2.5-VL |
