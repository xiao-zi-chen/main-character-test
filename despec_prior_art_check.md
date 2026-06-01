# DeSpec Idea 近邻论文检索与冲突判断

更新时间：2026-05-29  
问题：`DeSpec / Evidence-Bounded Specificity Control` 是否已经有人做过？是否还值得尝试投 AAAI？

## 1. 结论

我没有检索到一个已经完整做了下面这件事的论文：

> 将多模态幻觉明确重新定义为 unsupported specificity，并提出一个面向 MLLM 开放问答/OCR/不可回答/细粒度负向查询的 evidence-bounded specificity selection 方法，使模型输出“视觉证据支持的最细粒度答案”，同时避免 over-specific hallucination 和 over-vague refusal。

但它不是完全无人触碰的空白区。已经有几类工作分别做了其中一部分：

1. **specificity / granularity 的评测**：已经有人做，而且很近。
2. **medical taxonomy / abstraction alignment**：非常近，尤其是医学分类层级。
3. **image caption specificity**：有人从 caption 角度研究 specificity，但不是 hallucination mitigation。
4. **abstention / selective answering**：很多人做 answer-or-abstain，但没有系统做“答到什么粒度”。
5. **hallucination DPO / decoding / verification**：很多人做降低幻觉，但主要是 answer correctness 或 unsupported claim，不是 specificity boundary。

因此：**可以尝试，但必须把论文中心写成“specificity control / de-specification”，不要写成普通 verification、abstention 或 risk control。**

## 2. 直接关键词检索结果

我检索了这些关键词组合：

```text
"unsupported specificity" multimodal hallucination
"evidence-bounded specificity" multimodal
"answer specificity" "vision-language" hallucination
"specificity control" "vision-language" hallucination
"right specificity" "vision-language"
"answer at the right specificity" "large language models"
"de-specification" hallucination
"DeSpec" hallucination vision
"over-specific hallucination" vision
"answer granularity" multimodal hallucination
"semantic granularity" vision-language models hallucination
```

结果：

1. 没有发现 `DeSpec` 作为 MLLM hallucination mitigation 方法名。
2. 没有发现 `Evidence-Bounded Specificity Control` 这个完整提法。
3. `unsupported specificity` 在 RAG/groundedness 工程文章中出现过，但我没有看到它作为 MLLM 视觉幻觉论文的核心概念。
4. `specificity` 和 `granularity` 在 VLM evaluation / taxonomy / captioning 里已经很多。

## 3. 最危险的近邻论文

### 3.1 Taxonomy-Aware Evaluation of Vision-Language Models

来源：[CVPR 2025 / arXiv](https://arxiv.org/abs/2504.05457)

它做了什么：

- 针对 VLM 开放分类回答，指出传统 accuracy 无法评价“答得不够具体但仍然相关”的情况。
- 用 taxonomy 把生成文本映射到层级标签。
- 用 hierarchical precision / recall 衡量 correctness 和 specificity。

与 DeSpec 的重叠：

- 都关心 specificity。
- 都用层级/taxonomy 处理细粒度与粗粒度。
- 都反对简单 binary correct/incorrect。

关键差异：

- 它主要是 **evaluation metric**，不是 hallucination mitigation 方法。
- 它关注 fine-grained recognition / classification，不是 OCR、不可回答、负向查询、开放回答中的幻觉控制。
- 它没有提出“选择视觉证据支持的最细粒度答案”作为输出策略，也没有处理 over-vague refusal。

风险等级：**高**。  
必须在 related work 里重点对比。

### 3.2 Measuring and Aligning Abstraction in Vision-Language Models with Medical Taxonomies

来源：[arXiv 2601.14827](https://arxiv.org/abs/2601.14827)

它做了什么：

- 在 chest X-ray 分类中用 medical taxonomy 衡量 VLM abstraction errors。
- 提出 Catastrophic Abstraction Errors。
- 用 risk-constrained thresholding 和 taxonomy-aware fine-tuning with radial embeddings 减少严重抽象错误。

与 DeSpec 的重叠：

- 非常接近“回答层级/抽象级别是否合适”。
- 也有 risk-constrained thresholding。
- 也有 taxonomy-aware fine-tuning。

关键差异：

- 它是医学分类 / chest X-ray taxonomy 场景。
- 目标是分类层级 alignment，不是 MLLM 生成回答的 de-specification。
- 没有把幻觉表述为 unsupported specificity，也没有覆盖 OCR hallucination、unanswerable VQA、fine-grained negative queries。
- 没有三元偏好：over-specific / right-specific / over-vague。

风险等级：**很高**。  
这是目前最接近 DeSpec 的论文之一。如果做 DeSpec，必须主动承认它是 abstraction/taxonomy 方向近邻，并强调我们是生成式 MLLM hallucination + answer helpfulness。

### 3.3 When More Words Say Less: Decoupling Length and Specificity in Image Description Evaluation

来源：[arXiv 2601.04609](https://arxiv.org/abs/2601.04609)，[OpenReview](https://openreview.net/forum?id=ANZRE6aGVe)

它做了什么：

- 研究 image description 中 length 和 specificity 的区别。
- 定义 specificity relative to a contrast set。
- 说明更长不一定更具体，VLM caption 的 specificity 应该独立评估。

与 DeSpec 的重叠：

- 都强调 specificity 是独立于长度的语义变量。
- 都可以引用 possible-world / contrast set 视角。

关键差异：

- 它是 image description evaluation，不是 hallucination mitigation。
- 它不处理 answer-or-abstain，也不处理不可回答问题。
- 它不做 specificity lattice 选择或 Spec-DPO。

风险等级：**中高**。  
适合作为理论动机和 specificity 定义近邻。

### 3.4 Benchmarking Zero-Shot Recognition with VLMs: Granularity and Specificity

来源：[arXiv 2306.16048](https://arxiv.org/abs/2306.16048)，[OpenReview](https://openreview.net/forum?id=hdYqGkSr9S)

它做了什么：

- 构造 benchmark 测 VLM 在 semantic granularity 和 text specificity 下的 zero-shot recognition 稳定性。
- 发现 VLM 对不同粒度和文本具体度不稳。

与 DeSpec 的重叠：

- 也是 granularity / specificity。
- 也说明 VLM 面对细粒度描述很脆弱。

关键差异：

- 它是 recognition benchmark，不是生成式 MLLM 幻觉缓解。
- 不做“把回答降到证据支持的粒度”。
- 不处理 refusal/helpfulness。

风险等级：**中**。

### 3.5 ReCoVERR

来源：[arXiv 2402.15610](https://arxiv.org/abs/2402.15610)

它做了什么：

- 针对 vision-language reasoning 的 selective prediction。
- 在不确定时收集额外视觉证据，减少不必要的 abstention。

与 DeSpec 的重叠：

- 都反对简单过度拒答。
- 都关心视觉证据和选择性回答。

关键差异：

- ReCoVERR 的核心还是 answer vs abstain。
- DeSpec 的核心是 answer at the right specificity。
- DeSpec 可以在“不能给具体答案”时给粗粒度有用答案，而不是二选一。

风险等级：**中高**。

### 3.6 Learning Conformal Abstention Policies

来源：[arXiv 2502.06884](https://arxiv.org/abs/2502.06884)

它做了什么：

- 用 conformal abstention 管理 LLM/VLM 的风险。
- 关注什么时候回答/什么时候拒答。

与 DeSpec 的重叠：

- 都涉及可靠回答和拒答。

关键差异：

- 它是 risk / abstention policy，不是 specificity selection。
- DeSpec 不是简单拒答，而是把回答粒度降到证据边界内。

风险等级：**中**。

### 3.7 Risk-aware Selective Prompting

来源：[arXiv 2605.28123](https://arxiv.org/abs/2605.28123)

它做了什么：

- 研究 verification prompting 并非总是有帮助，应该 risk-aware 地选择何时触发。

与 DeSpec 的重叠：

- 都想避免盲目 verification / prompt 堆叠。

关键差异：

- 它解决“什么时候验证”。
- DeSpec 解决“回答到什么粒度”。

风险等级：**中**。

### 3.8 Know Your Limits: A Survey of Abstention in LLMs

来源：[TACL 2025](https://aclanthology.org/2025.tacl-1.26/)，[arXiv](https://arxiv.org/abs/2407.18418)

它做了什么：

- 系统整理 LLM abstention，包括 outright refusal 和 partial abstention。

与 DeSpec 的重叠：

- partial abstention 这个概念接近 DeSpec 的“不完全拒答”。

关键差异：

- 它是 LLM survey，不是多模态 hallucination 方法。
- 它没有提出 visual evidence bounded specificity。

风险等级：**中**。

## 4. 其他相关但不直接冲突的工作

| 方向 | 代表 | 与 DeSpec 的关系 |
| --- | --- | --- |
| Decoding mitigation | VCD、OPERA、HALC | 降 hallucination，但不做语义粒度控制 |
| Preference optimization | V-DPO、HA-DPO、OPA-DPO、mDPO、TARS | 降 hallucination，但偏好通常是 correct vs hallucinated，不是 over-specific/right-specific/over-vague |
| Region verification | CoReVe、Woodpecker 类 | 验证 claim，但不选择最细可支持答案 |
| OCR hallucination | KIE-HVQA 原论文 | OCR 看不清拒答很近，但不是统一 specificity framework |
| Unanswerable VQA | MoHoBench、HumbleBench、HaloQuest | 评估拒答/诚实性，但不做 answer granularity |
| Fine-grained negative queries | FINER、FREAK | 可作为 DeSpec benchmark，但不是同一方法 |
| Caption specificity | pragmatic captioning、When More Words Say Less | specificity 动机近，但不是 hallucination mitigation |

## 5. 是否还能做？

我的判断：**能做，但要收紧成一个非常明确的贡献。**

不能写成：

> 我们提出一个新的 hallucination mitigation 方法。

这样会被 VCD/DPO/abstention/verification 一堆工作淹没。

应该写成：

> 我们发现并形式化 unsupported specificity：MLLM 的很多幻觉不是完全错误，而是回答粒度超过视觉证据边界。我们将 hallucination mitigation 从 binary answer-or-abstain 重新定义为 evidence-bounded specificity selection，并提出 DeSpec / Spec-DPO，让模型偏好“最细可支持答案”，同时避免 over-specific hallucination 和 over-vague refusal。

## 6. 推荐修改后的 novelty 边界

### 不安全 claim

不要声称：

1. 首次研究 specificity。
2. 首次研究 granularity。
3. 首次做 abstention。
4. 首次做 taxonomy-aware VLM。
5. 首次做 hallucination DPO。
6. 首次做 visual evidence verification。

### 安全 claim

可以主张：

1. 首次将 MLLM hallucination mitigation 系统表述为 **evidence-bounded specificity selection**。
2. 首次针对 over-specific hallucination 和 over-vague refusal 同时建模。
3. 首次构造 over-specific / right-specific / over-vague 三元偏好来训练 MLLM。
4. 首次在 OCR hallucination、unanswerable visual QA、fine-grained negative queries、object hallucination 上统一评估 answer specificity control。
5. 提出 Supported Specificity Score / Overspecification Rate / Over-vagueness Rate 这类指标。

## 7. 如果继续做，必须补的实验

为了避免 reviewer 说“这只是 taxonomy-aware evaluation 的应用”，需要有以下实验：

1. **不只做分类 taxonomy**：必须包含 OCR、开放 VQA、不可回答视觉问题。
2. **不只做评测指标**：必须有 inference-time DeSpec 或 Spec-DPO 方法。
3. **不只降低 hallucination**：必须显示 helpfulness 保持或提升。
4. **必须报告 over-vague refusal**：证明 DeSpec 不是简单保守化。
5. **必须做 human eval**：让人判断答案是否 right-specific。
6. **必须和 abstention baselines 对比**：例如 Abstention Prompt、ReCoVERR、conformal abstention。
7. **必须和 taxonomy/abstraction 近邻对比**：至少在 related work 中对比 Taxonomy-Aware Evaluation 和 Medical Abstraction Alignment。

## 8. 最小可发表版本

如果你要尝试，建议版本如下：

### 方法

1. DeSpec inference-time：从初始答案生成 specificity lattice，选择最细可支持 node。
2. Spec-DPO：用 over-specific / right-specific / over-vague 三元组做 LoRA-DPO。

### Benchmark

| Benchmark | 目的 |
| --- | --- |
| KIE-HVQA | OCR 过度具体化 |
| MoHoBench / HumbleBench | 不可回答但可部分回答 |
| FINER | 细粒度属性/关系错误 |
| DASH-B / AMBER | object false-positive |

### Baseline

| Baseline | 目的 |
| --- | --- |
| Direct | 原模型 |
| CoT | 普通推理 |
| Abstention Prompt | 二元拒答 |
| ReCoVERR / conformal abstention | selective answering |
| VCD / OPERA / DPO | hallucination mitigation |
| Taxonomy-aware prompting | 粒度相关 baseline |

### 指标

1. Hallucination Rate
2. Overspecification Rate
3. Over-vagueness Rate
4. Supported Specificity Score
5. Helpfulness
6. Human preference: right-specific vs too-specific vs too-vague

## 9. 最后判断

**DeSpec 不是完全无近邻，但还没有被完整做掉。**

最大风险来自：

1. [Taxonomy-Aware Evaluation of VLMs](https://arxiv.org/abs/2504.05457)
2. [Measuring and Aligning Abstraction in VLMs with Medical Taxonomies](https://arxiv.org/abs/2601.14827)
3. [When More Words Say Less](https://arxiv.org/abs/2601.04609)
4. [ReCoVERR](https://arxiv.org/abs/2402.15610)
5. [Learning Conformal Abstention Policies](https://arxiv.org/abs/2502.06884)

但如果你把贡献写成：

> binary abstention 之外的 evidence-bounded specificity control for MLLM hallucination

并且做出 Spec-DPO + 跨 OCR/unanswerable/FINER/object benchmark 的结果，它仍然有尝试价值。

