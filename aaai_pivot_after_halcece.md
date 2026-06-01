# HalCECE 之后：DeSpec 是否还能做，以及更好的 AAAI 方向

更新时间：2026-05-29

## 1. 先说实话

如果我们的 DeSpec 只是：

```text
hallucinated detailed caption
→ 用层级知识找到更粗的正确概念
→ 做最小语义编辑
```

那它和 HalCECE 确实非常像，AAAI 投稿风险很高。

HalCECE 已经做了：

1. image captioning hallucination detection；
2. conceptual counterfactual explanations；
3. hierarchical knowledge；
4. semantically minimal edits；
5. 判断概念是 `too generic`、`erroneously specific`、需要 delete 或 replace。

所以不能再把核心创新写成：

> 我们发现模型会过度具体化，并把错误具体概念退回到更粗概念。

这个点已经不够安全。

## 2. DeSpec 和 HalCECE 还能有什么区别？

可以有区别，但这些区别偏“扩展”，不一定足够强：

| 维度 | HalCECE | DeSpec 可能区别 | 强度 |
| --- | --- | --- | --- |
| 任务 | image captioning | MLLM VQA / OCR / unanswerable / FINER | 中 |
| 目标 | detection / explanation / edit recommendation | 直接生成 right-specific answer | 中 |
| 训练 | 不强调训练 MLLM 行为 | Spec-DPO 三元偏好训练 | 中高 |
| refusal | 不处理 over-vague refusal | 同时避免 over-specific 和 over-vague | 中高 |
| benchmark | caption hallucination | OCR、不可回答、负向查询、object false-positive | 中 |

问题是：reviewer 可能仍然说：

> 你们只是把 HalCECE 从 caption 扩展到 MLLM QA，再加了 DPO。

这不是不能投，但不够稳。

## 3. 我更推荐的 pivot：从“语义粒度编辑”转向“问题前提修复”

### 名字

**PremiseRepair: Presupposition-Aware Hallucination Mitigation for MLLMs**

中文：

**问题前提修复：面向多模态大模型的预设感知幻觉抑制**

### 核心洞察

很多视觉幻觉不是答案粒度问题，而是用户问题本身带有错误前提。

例子：

| 用户问题 | 图像事实 | 普通模型风险 | PremiseRepair 输出 |
| --- | --- | --- | --- |
| What color is the umbrella? | 图里没有 umbrella | 编一个颜色 | I do not see an umbrella in the image. |
| What is the text on the red sign? | 没有 red sign，只有 blue sign | 读错对象 | I do not see a red sign; there is a blue sign, but the text is unclear. |
| How many dogs are on the sofa? | 有猫，没有狗 | 编 dog 数量 | I do not see dogs on the sofa; there appears to be a cat. |
| What brand is the Toyota? | 只能看到一辆车 | 编品牌 | The image shows a car, but I cannot verify it is a Toyota. |

这里的关键不是“把 Toyota 降成 car”，而是：

> 先检测问题里的 presupposition 是否被图像支持；如果前提不成立，修复问题，再回答可支持部分。

### 为什么比 DeSpec 更安全

HalCECE 处理的是 caption 中的概念编辑。PremiseRepair 处理的是 **user query 的 false presupposition**。

这更贴近 MLLM 交互场景，也更适合 FINER、MoHoBench、HaloQuest、KIE-HVQA。

### 方法核心

1. Extract visual presuppositions from question.
2. Verify each presupposition against image.
3. If all premises supported, answer normally.
4. If some premises false, repair the question:
   ```text
   Original: What color is the umbrella?
   Repaired: Is there an umbrella? If not, state that it is absent.
   ```
5. Return a premise-aware answer:
   ```text
   I do not see an umbrella, so its color cannot be determined.
   ```

### 训练信号

构造三元偏好：

| 类型 | 示例 |
| --- | --- |
| hallucinated answer | The umbrella is blue. |
| pure refusal | I cannot answer. |
| premise-aware repair | I do not see an umbrella, so its color cannot be determined. |

偏好：

```text
premise-aware repair > pure refusal > hallucinated answer
```

这比 DeSpec 的 right-specific 更容易和 HalCECE 拉开。

### 最适合 benchmark

| Benchmark | 适配原因 |
| --- | --- |
| FINER | 细粒度负向查询本质上常有错误前提 |
| MoHoBench | 不可回答视觉问题包含 false premise 和 insufficient evidence |
| HaloQuest | 明确覆盖 false premises、insufficient contexts、visual challenges |
| KIE-HVQA | OCR 问题常预设文本可读 |
| DASH-B | object false-positive 可表述为 object-existence premise failure |

### AAAI 故事

> Existing MLLM hallucination mitigation verifies answers after generation. We instead verify the visual presuppositions in the user query before answering. When a premise is false or visually unsupported, the model repairs the question and answers only the supportable part, preventing hallucinations induced by misleading questions.

这个故事比 DeSpec 更像“新的问题机制”。

## 4. 第二个可行方向：Contradiction-Aware Visual Dialogue Immunization

### 名字

**V-Immunity: Immunizing MLLMs Against Hallucination Propagation in Multimodal Dialogue**

中文：

**视觉免疫：阻断多轮对话中的幻觉传播**

### 核心洞察

多轮对话里，模型前一轮一旦接受了错误视觉事实，后续会继续沿用它。现有很多方法只检查当前图像-问题，不处理历史中的错误视觉记忆。

例子：

```text
Turn 1 user: Is the dog wearing a red collar?
Model: Yes.
Turn 2 user: What is written on the collar?
Model: It says Max.
```

如果图里根本没有 red collar，第二轮就是 snowballing。

### 方法

维护一个 **Visual Fact Ledger**：

| fact | status |
| --- | --- |
| dog exists | supported |
| red collar exists | contradicted |
| text on collar | invalid because parent premise contradicted |

回答新问题前，先检查它依赖的历史视觉事实是否仍被图像支持。

### 和已有工作的区别

MMHalSnowball 评估 snowballing；我们做 **fact-ledger immunization**，把历史文本事实分成 supported / contradicted / contaminated，并阻止 contaminated facts 进入后续推理。

### 适合 benchmark

MMHalSnowball、MoHoBench multi-turn extension、自己从 FINER/DASH-B 构造多轮版本。

风险：需要构造或扩展多轮数据，工作量更大。

## 5. 第三个可行方向：Visual Evidence Contract

### 名字

**VEC: Visual Evidence Contracts for Trustworthy MLLM Answers**

中文：

**视觉证据契约：让多模态回答显式声明可验证边界**

### 核心洞察

模型回答时应该同时给出“哪些部分是图像直接支持的，哪些是推断，哪些不可验证”。不是只给答案，而是给一个 evidence contract。

输出格式：

```text
Answer: The sign appears to contain text, but the exact words are unreadable.
Supported by image: there is a sign; there is text-like content.
Not visually verifiable: exact text content.
Should not claim: "STOP" or any specific word.
```

### 优点

很适合 OCR、医疗、文档、遥感等高风险场景。

### 风险

容易被 reviewer 认为是 structured prompting，除非有训练和自动评估。

## 6. 我最终建议

如果你想避开 HalCECE，我建议优先做：

> **PremiseRepair：问题前提修复**

理由：

1. 和 HalCECE 差异最大：它修 caption 概念，我们修用户问题前提。
2. 和幻觉 benchmark 高度匹配：FINER、MoHoBench、HaloQuest、KIE-HVQA、DASH-B 都能解释成 premise failure。
3. 故事清楚：幻觉不是只来自回答生成，还来自问题中未被验证的视觉前提。
4. 方法可做：premise extraction + visual premise verification + question repair + preference training。
5. AAAI 记忆点强：**verify the question before answering**。

一句话版本：

> 现有方法主要在模型生成答案后检测或纠错幻觉；我们发现很多多模态幻觉在回答前已经由用户问题中的错误视觉前提触发。PremiseRepair 在回答前验证问题前提，修复不成立的视觉预设，并只回答被图像支持的部分。

## 7. 如果你仍想保留 DeSpec

可以把 DeSpec 降级为 PremiseRepair 的一个输出策略：

```text
false premise detected
→ repair question
→ answer at the right specificity
```

这样 DeSpec 不再和 HalCECE 正面撞，而是服务于一个更大的、不同的问题：**false visual premise repair**。

