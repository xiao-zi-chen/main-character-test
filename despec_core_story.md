# DeSpec 核心论文故事

更新时间：2026-05-29  
目标：整理一个可用于 AAAI 投稿的 DeSpec 主线故事。

## 1. 一句话

**DeSpec: Learning to Answer at the Right Specificity for Reliable Multimodal Models**

中文：

**DeSpec：让多模态模型学会回答到正确粒度**

核心主张：

> 多模态模型真正缺的不是单纯拒答能力，而是回答粒度控制能力。

## 2. 核心洞察

现有多模态幻觉工作大多把问题看成二分类：

```text
回答是正确的 / 回答是幻觉
应该回答 / 应该拒答
```

但真实场景不是这样。很多时候，图像不是完全没有信息，而是只支持一个**较粗粒度的答案**。

例如：

| 图像证据 | 模型不该说 | 模型也不该完全拒答 | 理想回答 |
| --- | --- | --- | --- |
| 能看出有一辆车 | 这是红色 Toyota SUV | 我无法回答 | 图中有一辆车，但品牌/车型无法确认 |
| 能看出有文字但模糊 | 发票号是 INV-739204 | 我无法回答任何内容 | 这里有发票编号区域，但具体数字不可辨认 |
| 能看出有人拿东西 | 他拿着蓝色雨伞 | 无法判断图中内容 | 他手里似乎拿着物体，但无法确认是雨伞 |
| 能看出有动物 | 这是一只金毛犬 | 我不知道 | 图中有一只狗，但品种无法确认 |

因此 DeSpec 的核心观点是：

> **幻觉常常不是模型完全没看图，而是模型说得比视觉证据允许的更具体。**

这个失败模式可以称为：

> **Unsupported Specificity**

中文：

> **不被视觉证据支持的过度具体化**

## 3. 论文问题定义

DeSpec 不做普通 hallucination correction，也不做普通 refusal。

它解决的是：

> 给定一张图和一个问题，模型应该输出视觉证据支持的**最具体但仍可靠**的答案。

也就是：

```text
不是越具体越好
也不是越保守越好
而是 right-specific
```

DeSpec 把多模态幻觉缓解从：

```text
answer vs abstain
```

重新定义为：

```text
answer at the right specificity
```

## 4. 方法故事

DeSpec 构造一个回答粒度空间，也就是 specificity lattice。

例子 1：普通物体识别

```text
red Toyota SUV
→ Toyota SUV
→ SUV
→ car
→ vehicle
→ object
```

例子 2：OCR / 文档

```text
invoice number is INV-739204
→ invoice number region is visible but unreadable
→ some document text is visible
→ a document is present
```

例子 3：细粒度动作/属性

```text
the man is holding a blue umbrella
→ the man is holding an umbrella
→ the man is holding an object
→ there is a man
```

模型不再直接选择“回答”或“拒答”，而是在这个粒度链里选择：

> **视觉证据支持的最细粒度答案。**

如果细节不支持，就 de-specify，把答案降到支持的层级。  
如果粗粒度也不支持，再拒答。

## 5. 训练故事：Spec-DPO

DeSpec 可以进一步提出：

> **Spec-DPO: Specificity-Aware Preference Optimization**

普通 DPO 通常学习：

```text
正确答案 > 错误答案
```

Spec-DPO 学习的是：

```text
right-specific answer > over-specific hallucination
right-specific answer > over-vague refusal
```

例子：

| 类型 | 回答 |
| --- | --- |
| over-specific | 发票号是 INV-739204 |
| over-vague | 我无法回答 |
| right-specific | 图中有发票编号区域，但具体数字不可辨认 |

这就是训练特色：

> 模型不是学“少说”，而是学“说到刚好”。

## 6. 最强英文故事

> Existing MLLM hallucination mitigation focuses on suppressing unsupported claims or abstaining under uncertainty. We argue that this binary view misses a central failure mode: models often hallucinate by being more specific than the image warrants. DeSpec teaches MLLMs to answer at the maximally visually supported specificity, avoiding both over-specific hallucination and over-vague refusal.

## 7. 中文故事

现有多模态幻觉缓解方法主要关注如何抑制不被图像支持的输出，或者在不确定时直接拒答。然而，这种“回答或拒答”的二元视角忽略了一个核心失败模式：模型并不总是完全看错，而是经常说出了超过视觉证据边界的细节。

DeSpec 将多模态幻觉缓解重新定义为回答粒度控制。模型不应追求尽可能具体，也不应在不确定时过度拒答，而应输出视觉证据能够支持的最细粒度答案。通过构造回答的 specificity lattice，并使用 over-specific / right-specific / over-vague 三元偏好进行训练，DeSpec 让模型学会在可靠性和有用性之间取得平衡。

## 8. 和 HalCECE 的区别

不要把 DeSpec 写成“我们也做层级编辑”。应该这样讲：

> HalCECE explains and edits hallucinated captions. DeSpec changes the response policy of MLLMs: given a user query, the model learns to choose the right specificity level of the answer, and is trained with over-specific / right-specific / over-vague preferences across VQA, OCR, unanswerable QA, and fine-grained hallucination benchmarks.

中文：

> HalCECE 是修 caption；DeSpec 是让 MLLM 在交互式问答中学会回答到正确粒度。

核心区别：

| HalCECE | DeSpec |
| --- | --- |
| 修 caption 中的 hallucinated concept | 改变 MLLM 的回答策略 |
| detection / explanation / edit recommendation | 直接输出 right-specific answer |
| 主要面向 image captioning | 面向 VQA、OCR、不可回答问题、细粒度负向查询 |
| 关注 hallucinated caption 如何编辑 | 关注用户问题下模型应该回答到什么粒度 |
| 没有训练 right-specific behavior | 使用 over-specific / right-specific / over-vague 三元偏好训练 |

## 9. 推荐贡献写法

Contribution 1：

> We identify unsupported specificity as a common yet underexplored failure mode of MLLM hallucination.

Contribution 2：

> We formulate hallucination mitigation as evidence-bounded specificity selection rather than binary answer-or-abstain.

Contribution 3：

> We propose DeSpec, which constructs a specificity lattice and returns the maximally visually supported answer.

Contribution 4：

> We introduce Spec-DPO, a specificity-aware preference optimization method that prefers right-specific answers over both over-specific hallucinations and over-vague refusals.

Contribution 5：

> We evaluate DeSpec across OCR hallucination, unanswerable visual QA, fine-grained negative queries, and object hallucination benchmarks.

## 10. 推荐标题

1. **DeSpec: Learning to Answer at the Right Specificity for Reliable Multimodal Models**
2. **When Not to Be Specific: Evidence-Bounded Specificity Control for Multimodal Hallucination**
3. **Beyond Abstention: De-Specifying Unsupported Details in Multimodal Large Language Models**
4. **Right-Specific Answers: Mitigating Multimodal Hallucination without Over-Refusal**

我最推荐：

> **DeSpec: Learning to Answer at the Right Specificity for Reliable Multimodal Models**

