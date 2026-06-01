# AAAI 投稿主线建议：DeSpec / Evidence-Bounded Specificity Control

更新时间：2026-05-29  
目标：给出一个比“堆验证器/打 benchmark”更像 AAAI 论文的故事，并尽量避开已有 hallucination mitigation 工作。

## 1. 先说结论

我建议不要把论文主线写成 V-CAGE，也不要把 VIG-RC 作为主线。

原因：

1. V-CAGE 容易被 reviewer 看成 `crop + remove + self-check + abstention` 的组合。
2. VIG-RC 比 V-CAGE 更有原则，但 2026-05-27 已经出现 [Risk-aware Selective Prompting](https://arxiv.org/abs/2605.28123)，它也在讲“verification prompting 是有风险的，应该选择性触发”。如果我们继续讲 risk-aware selective verification，容易撞。
3. 现在更适合投 AAAI 的故事应该改变输出范式，而不是再加一个验证步骤。

最终推荐主线：

> **DeSpec: Evidence-Bounded Specificity Control for Multimodal Hallucination**

中文：

> **DeSpec：面向多模态幻觉的证据边界化回答粒度控制**

一句话：

> 多模态幻觉很多时候不是“完全答错”，而是模型说得比图像证据允许的更具体。我们不再让模型在“自信回答”和“完全拒答”之间二选一，而是让它回答到视觉证据能够支持的最细粒度。

这比“少幻觉一点”更像一个新问题定义。

## 2. 核心洞察

现有方法默认把输出分成两类：

```text
answer or abstain
correct or hallucinated
```

但真实多模态场景里，很多错误是**过度具体化**：

| 图像证据实际支持 | 模型输出 | 问题 |
| --- | --- | --- |
| 有一辆车 | 一辆红色丰田 SUV | 品牌/颜色/车型过度具体 |
| 有文字但模糊 | 发票号是 INV-739204 | OCR 具体文本过度编造 |
| 有人在拿东西 | 男人拿着蓝色雨伞 | 物体和属性过度具体 |
| 能看出室内场景 | 这是医院急诊室 | 场景类别过度推断 |
| 能看出两个物体靠近 | 杯子在盘子左侧 | 空间关系过度具体 |

所以新定义是：

> Hallucination is often unsupported specificity.

中文：

> 幻觉常常不是凭空生成，而是回答的粒度超过了视觉证据边界。

这个故事能绕开大多数现有工作，因为它们主要做 hallucination suppression、contrastive decoding、region verification、DPO 或 refusal，而不是系统控制回答的**语义粒度**。

## 3. 我们做到了，别人没做到

| 维度 | 现有方法 | DeSpec |
| --- | --- | --- |
| 输出策略 | 回答 / 拒答二选一 | 在“最细可支持粒度”回答 |
| 幻觉理解 | 错误 object、错误属性、错误关系 | unsupported specificity |
| 拒答问题 | 容易全拒答或过度保守 | 能给出部分有用答案 |
| OCR/文档 | 看不清时经常编造具体字符串 | 退回到“文本存在但不可辨认” |
| 细粒度查询 | 判断 yes/no | 识别哪个具体细节超出证据边界 |
| 训练信号 | 正确 vs 错误 | 过具体 / 合适粒度 / 过模糊 三元偏好 |
| 评测 | accuracy / hallucination rate | hallucination + specificity + helpfulness |

安全的论文 claim：

> Existing hallucination mitigation methods suppress unsupported outputs or abstain, but they rarely ask whether the **specificity level** of an answer is justified by visual evidence. We propose DeSpec, which selects the maximally specific answer that remains visually supportable.

中文：

> 现有方法主要抑制不被支持的输出或直接拒答，但很少判断“回答的具体程度”是否被视觉证据允许。DeSpec 选择视觉证据可支持的最具体回答。

## 4. 方法核心：Specificity Lattice

### 4.1 从一个答案生成语义粒度梯

对模型初始答案 `a0`，构造从细到粗的 specificity lattice。

例子 1：

```text
red Toyota SUV
→ red SUV
→ SUV
→ car
→ vehicle
→ object
```

例子 2：

```text
invoice number is INV-739204
→ invoice number is visible but unreadable
→ there is some document text
→ a document is present
```

例子 3：

```text
the man is holding a blue umbrella
→ the man is holding an umbrella
→ the man is holding an object
→ there is a man
```

### 4.2 判断每个粒度是否被视觉支持

对每个 node `z` 估计视觉支持分数：

```text
Support(z | I, q)
```

实现可以先简单：

1. 直接问 VLM：该粒度陈述是否由图像支持？
2. 对 `I_full`、`I_blur/no-image`、`I_crop/zoom` 做一致性检查。
3. 对 OCR 节点，必须要求 zoom 后仍支持，遮掉文字后不支持。

### 4.3 选择最细可支持回答

核心决策：

```text
a* = argmax specificity(z)
     subject to Support(z | I, q) >= tau
```

如果没有任何有效视觉支持：

```text
abstain
```

如果粗粒度支持但细粒度不支持：

```text
de-specify
```

这就是 DeSpec 的核心，不是堆模块。

## 5. 训练版本：Specificity-Aware DPO

如果只做 inference-time，可能不够强。AAAI 更建议有一个轻量训练版：

**Spec-DPO：specificity-aware preference optimization**

构造三种答案：

| 类型 | 示例 | 偏好 |
| --- | --- | --- |
| over-specific | `The invoice number is INV-739204.` 但看不清 | rejected |
| maximally supported | `The invoice number area is visible, but the exact number is unreadable.` | chosen |
| over-vague | `I cannot answer anything about the image.` 但其实能看出是发票 | rejected |

偏好目标不是简单“正确 > 错误”，而是：

```text
maximally supported specificity > over-specific hallucination
maximally supported specificity > over-vague refusal
```

这个训练信号很有特色。现有 DPO 多数只学“不幻觉”，很少学“不要太具体，也不要太保守”。

## 6. 这个故事适合打哪些榜

### 最适合主打

| Benchmark | 为什么适合 DeSpec | 预期结果 |
| --- | --- | --- |
| KIE-HVQA | OCR 编造本质是具体字符串超过视觉证据 | 减少文本编造，同时保持部分有用回答 |
| MoHoBench / HumbleBench | 不可回答问题不等于什么都不能说 | 提高合理拒答和 helpfulness，降低过度拒答 |
| FINER | 细粒度负向查询正好是“某个细节过具体/错误” | attribute/relation/what 子类提升 |
| DASH-B | false-positive object 是 object-level unsupported specificity | FPR 降，TNR 升 |

### 作为补充

| Benchmark | 用法 |
| --- | --- |
| AMBER / POPE | reviewer 熟悉，证明基础 object hallucination 不差 |
| ViCrit / R2-HalBench | 对长 caption 中错误 span 做 de-specification，而不是整句删除 |
| TextHalu-Bench | scene text 中具体词/数字编造很适合 DeSpec |

## 7. 你真正的实验指标

不要只报 accuracy。主指标应该体现“不过度具体，也不过度拒答”。

### 7.1 Supported Specificity Score

衡量回答是否达到视觉证据支持的最细粒度。

```text
SSS = supported_specificity - hallucinated_specificity - over_vagueness
```

直觉：

| 回答 | SSS |
| --- | --- |
| 具体且被图像支持 | 高 |
| 具体但不被支持 | 低 |
| 完全拒答但图像有粗证据 | 低 |
| 粗但被支持 | 中 |

### 7.2 Overspecification Rate

```text
OSR = unsupported fine-grained claims / all fine-grained claims
```

### 7.3 Helpful Abstention

把拒答分成：

| 类型 | 说明 |
| --- | --- |
| good abstention | 证据确实不足 |
| over-abstention | 粗粒度可答却完全拒答 |
| de-specified answer | 不给具体细节，但给出被支持的粗答案 |

这正好补 MoHoBench/HumbleBench 的 helpfulness 维度。

## 8. 近邻论文防撞

### 8.1 已经很近的工作

| 工作 | 它做什么 | 为什么不等于 DeSpec |
| --- | --- | --- |
| [Risk-aware Selective Prompting](https://arxiv.org/abs/2605.28123) | 选择性触发 verification prompt | 它还是验证/不验证；DeSpec 控制回答语义粒度 |
| [ReCoVERR](https://arxiv.org/abs/2402.15610) | 低置信时找额外视觉证据，减少过度拒答 | 它目标是 answer vs abstain；DeSpec 是 max supported specificity |
| [Learning Conformal Abstention Policies](https://arxiv.org/abs/2502.06884) | conformal abstention / risk management | 它是通用风险阈值；DeSpec 是语义粒度选择 |
| CoReVe | 区域验证 object hallucination | 它验证对象是否存在；DeSpec 处理 object/attribute/OCR/relation 的粒度边界 |
| CHASD | token-specific localized perturbation contrastive decoding | 它是 decoding；DeSpec 是输出粒度重写和偏好训练 |
| KIE-HVQA 原论文 | OCR hallucination + GRPO | 它关注 OCR 拒答；DeSpec 用 OCR 证明过度具体化问题 |
| VCD / OPERA / HALC | decoding-level hallucination suppression | 它们不处理 over-vague refusal，也不学习 max specificity |

### 8.2 不能说的话

不要写：

1. “我们首次做 hallucination abstention。”
2. “我们首次做视觉证据验证。”
3. “我们首次做风险控制。”
4. “我们首次做局部裁剪。”

### 8.3 应该说的话

可以写：

1. “We identify unsupported specificity as a common failure mode of MLLM hallucination.”
2. “We formulate hallucination mitigation as evidence-bounded specificity selection rather than binary abstention.”
3. “We propose specificity-aware preference optimization, where the preferred response is neither the most detailed nor the most conservative, but the most specific visually supportable answer.”
4. “We evaluate both hallucination reduction and helpfulness preservation.”

## 9. AAAI 论文结构

### Title 候选

1. **When Not to Be Specific: Evidence-Bounded Specificity Control for Multimodal Hallucination**
2. **DeSpec: Learning to Answer at the Right Specificity for Reliable Multimodal Models**
3. **Beyond Abstention: De-Specifying Unsupported Details in Multimodal Large Language Models**

我最推荐第 1 个。

### Abstract 故事

1. MLLM hallucination 不是只有 object fabrication。
2. 我们观察到很多幻觉来自 unsupported specificity：模型说出了图像证据无法支持的细节。
3. 现有方法常在回答和拒答之间二选一，导致要么过度具体，要么过度拒答。
4. 我们提出 DeSpec，构造答案的语义粒度 lattice，选择视觉证据支持的最细粒度答案。
5. 进一步提出 Spec-DPO，让模型偏好“恰当粒度答案”，而不是过具体或过模糊。
6. 在 KIE-HVQA、MoHoBench/HumbleBench、FINER、DASH-B 等 benchmark 上，DeSpec 降低幻觉并保持 helpfulness。

### Contributions

1. 提出 unsupported specificity 作为 MLLM hallucination 的新视角。
2. 将 hallucination mitigation 从 binary abstention 重新定义为 evidence-bounded specificity selection。
3. 提出 DeSpec 和 Spec-DPO，通过语义粒度 lattice 与偏好优化选择最细可支持回答。
4. 在 OCR、不可回答、细粒度负向查询和 object hallucination 上验证，显示 DeSpec 同时降低 over-specific hallucination 和 over-vague refusal。

## 10. 最小实验版本

### 第 1 批

| 内容 | 选择 |
| --- | --- |
| 模型 | Qwen2.5-VL-7B、LLaVA-OneVision-7B、InternVL-8B/14B |
| Benchmark | KIE-HVQA、MoHoBench/HumbleBench、FINER、DASH-B |
| Baseline | Direct、CoT、Abstention Prompt、ReCoVERR、Risk-aware Selective Prompting、VCD/OPERA |
| Ours | DeSpec inference-time |
| 指标 | hallucination rate、over-abstention、SSS、OSR、helpfulness |

### 第 2 批

| 内容 | 选择 |
| --- | --- |
| 训练 | Spec-DPO LoRA |
| 数据 | 从 KIE-HVQA、FINER、AMBER/POPE 自动构造 over-specific / right-specific / over-vague 三元组 |
| 目标 | 证明不是单纯 prompt，模型学会回答到合适粒度 |

## 11. 为什么它比 VIG-RC 更适合 AAAI

| 维度 | VIG-RC | DeSpec |
| --- | --- | --- |
| 容易撞 | 风险控制、selective prompting 已经很热 | specificity control 在 MLLM hallucination 里更少见 |
| 故事 | 什么时候答/拒 | 答到什么粒度才对 |
| 贡献 | 风险分数 + 校准 | 新失败模式 + 新输出范式 + 新训练信号 |
| 实验 | risk-coverage | hallucination + helpfulness + specificity |
| reviewer 记忆点 | 低 VIG 高风险 | 幻觉是 unsupported specificity |

## 12. 最后建议

如果目标是 AAAI，我建议主线改成：

> **不是让模型更会拒答，而是让模型学会“不说超过证据边界的细节”。**

这句话很重要，因为它把你从普通 hallucination mitigation 里拉出来了。

最稳的论文故事是：

> Existing MLLM hallucination mitigation often treats uncertainty as a binary decision: answer or abstain. We argue that this misses a central failure mode: models often hallucinate by being more specific than the image warrants. We propose DeSpec, an evidence-bounded specificity control framework that returns the maximally specific visually supported answer, avoiding both over-specific hallucination and over-vague refusal.

