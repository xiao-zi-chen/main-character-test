# DeSpec 在“幻觉研究”里的近邻工作

更新时间：2026-05-29  
问题：是否已经有人在多模态幻觉领域做过类似 DeSpec / unsupported specificity / evidence-bounded specificity control？

## 1. 最重要结论

在“多模态幻觉”这个领域里，**确实有人做过很接近的部分**，尤其是：

1. caption 里的 hallucinated token/span localization；
2. hallucination correction；
3. concept-level / hierarchy-based caption dehallucination；
4. visual grounding verification；
5. OCR / unanswerable 场景的拒答。

但我目前没有看到一个工作完整做到：

> 对开放式 MLLM 回答构造 specificity lattice，并选择“视觉证据支持的最细粒度答案”，同时避免 over-specific hallucination 和 over-vague refusal，再用 over-specific / right-specific / over-vague 三元偏好训练模型。

最危险的直接近邻是 **HalCECE**。如果继续做 DeSpec，必须重点避开和它的冲突。

## 2. 最危险近邻：HalCECE

来源：[HalCECE: A Framework for Explainable Hallucination Detection through Conceptual Counterfactuals in Image Captioning](https://arxiv.org/abs/2503.00436)，另见 [Springer 版本](https://link.springer.com/chapter/10.1007/978-3-032-08330-2_5)

它怎么做：

- 面向 image captioning。
- 使用 conceptual counterfactual explanations。
- 基于 hierarchical knowledge 给出从 hallucinated caption 到 non-hallucinated caption 的 semantically minimal edits。
- 不只是打分，还能给修改方向。
- 它的结果里会区分概念是否 `too generic`、`erroneously specific`、应删除、应替换。

为什么接近 DeSpec：

- 它已经意识到 caption 里的概念可能“过泛化”或“错误具体化”。
- 它使用层级语义知识，和 DeSpec 的 specificity lattice 很像。
- 它不仅检测 hallucination，还建议如何改成 non-hallucinated state。

关键差异：

- HalCECE 主要是 image captioning，不是开放式 MLLM VQA / OCR / unanswerable QA。
- 它是 detection / explanation / edit recommendation，不是训练 MLLM 学会 right-specific answer。
- 它没有把输出策略定义为“视觉证据支持的最细粒度答案”。
- 它没有显式处理 over-vague refusal。

风险等级：**最高**。  
如果做 DeSpec，必须在 related work 里正面对比：  
**HalCECE does conceptual counterfactual correction for captions; DeSpec learns response-level specificity control for MLLM answers across QA, OCR, unanswerable, and fine-grained hallucination benchmarks.**

## 3. Hallucination correction 类近邻

### 3.1 Woodpecker

来源：[Woodpecker: Hallucination Correction for Multimodal Large Language Models](https://arxiv.org/abs/2310.16045)

它怎么做：

- training-free。
- 五步 pipeline：key concept extraction、question formulation、visual knowledge validation、visual claim generation、hallucination correction。
- 用视觉知识验证和纠正 MLLM 输出中的不一致内容。

为什么接近：

- 它会改 hallucinated text。
- 它不是单纯 detection，而是 correction。
- 它可以把错误细节改掉。

关键差异：

- 它没有“粒度控制”的概念。
- 它的目标是纠错，不是找到 max supported specificity。
- 它没有 over-specific / right-specific / over-vague 三元偏好。

风险等级：**高**。

### 3.2 ESREAL

来源：[ESREAL: Exploiting Semantic Reconstruction to Mitigate Hallucinations in Vision-Language Models](https://arxiv.org/abs/2403.16167)

它怎么做：

- 面向长 caption hallucination。
- 先基于生成 caption 重建图像，再把重建图像和原图区域对齐。
- 计算 token-level hallucination score。
- 用 PPO 选择性惩罚 hallucinated tokens。

为什么接近：

- 它已经是 token-level hallucination mitigation。
- 它用语义重建找出哪些 token 不被图像支持。

关键差异：

- 它是 token penalty，不是回答粒度选择。
- 它不会把“red Toyota SUV”降成“car”这类 right-specific answer。
- 它主要在 caption generation 场景。

风险等级：**中高**。

## 4. Fine-grained / atomic fact verification 类近邻

### 4.1 FaithScore

来源：[FaithScore: Fine-grained Evaluations of Hallucinations in Large Vision-Language Models](https://arxiv.org/abs/2311.01477)

它怎么做：

- reference-free。
- 从 LVLM 自由回答中抽取 descriptive sub-sentences。
- 再拆成 atomic facts。
- 用 visual entailment model 检查每个 atomic fact 是否和图像一致。

为什么接近：

- 它已经做 claim/atomic fact 级 hallucination verification。
- 它适合做 DeSpec 的评价或辅助 verifier。

关键差异：

- 它是 evaluation metric，不是 mitigation。
- 它不选择“更粗但仍有用”的答案。
- 它没有 specificity lattice / right-specific preference。

风险等级：**中高**。

### 4.2 M-HalDetect / FDPO

来源：[Detecting and Preventing Hallucinations in Large Vision Language Models](https://arxiv.org/abs/2308.06394)

它怎么做：

- 构造 16k fine-grained hallucination annotations。
- 标注详细图像回答中的 entity、attribute、relationship 等不忠实内容。
- 训练 reward model / 用 FDPO 减少 hallucination。

为什么接近：

- 已经做细粒度幻觉检测和偏好优化。
- 已经覆盖 object / entity / relationship。

关键差异：

- 偏好信号主要是 accurate vs inaccurate。
- DeSpec 的偏好是 over-specific / right-specific / over-vague。
- M-HalDetect 不强调“回答粒度是否越界”。

风险等级：**中高**。

### 4.3 VBackChecker / R2-HalBench

来源：[Seeing Is Believing: Rich-Context Hallucination Detection for MLLMs via Backward Visual Grounding](https://ojs.aaai.org/index.php/AAAI/article/view/40345)

它怎么做：

- reference-free hallucination detection。
- 用 pixel-level grounding LLM 对 MLLM 生成内容做 backward visual grounding。
- 如果能 grounding，输出 segmentation mask；否则 reject。
- R2-HalBench 覆盖 object、attribute、relationship。

为什么接近：

- 已经做“每个描述是否能被视觉证据 grounding”。
- 很适合检测 over-specific claim。

关键差异：

- 它是 supported/rejected 二分。
- DeSpec 是从被 reject 的细粒度 claim 退回到可支持的粗粒度 claim。
- 它不处理 over-vague refusal。

风险等级：**高**。

## 5. Span/token-level hallucination localization 类近邻

### 5.1 ViCrit

来源：[ViCrit: A Verifiable Reinforcement Learning Proxy Task for Visual Perception in VLMs](https://arxiv.org/abs/2506.10128)

它怎么做：

- 在 200 词级别的人写 caption 中注入一个细微视觉错误。
- 错误可能是 object、attribute、count、spatial relation、scene text。
- 训练 VLM 找出 corrupted span。
- 用 exact match reward 做可验证 RL。

为什么接近：

- 它已经把幻觉定义成局部 span 错误。
- 它训练模型识别细粒度错误。

关键差异：

- 它是找错 span，不是把答案降级到正确粒度。
- 它不研究回答 helpfulness 或 over-vague refusal。

风险等级：**中高**。

### 5.2 DetailVerifyBench / HalLoc / TLDR

来源：

- [DetailVerifyBench](https://arxiv.org/abs/2604.05623)
- [HalLoc](https://arxiv.org/abs/2506.10286)
- [TLDR](https://arxiv.org/abs/2410.04734)

它们怎么做：

- 把 hallucination localization 从句子级推进到 token/span 级。
- 让模型找出长 caption 中错误 token。
- TLDR 用 token-level reward model 给细粒度反馈并辅助 self-correction。

为什么接近：

- 它们已经做“哪些词不该说”。
- 这和 DeSpec 的“哪些具体细节不该说”非常相关。

关键差异：

- 它们通常是定位/打分/删除错误 token。
- DeSpec 需要生成替代的、证据支持的更合适粒度答案。
- DeSpec 要同时惩罚“过度具体”和“过度模糊”。

风险等级：**中**。

## 6. OCR / unanswerable / refusal 类近邻

### 6.1 KIE-HVQA

来源：[KIE-HVQA](https://huggingface.co/datasets/bytedance-research/KIE-HVQA)，论文：[Seeing is Believing? Mitigating OCR Hallucinations in MLLMs](https://openreview.net/forum?id=bjoHB7IN6b)

它怎么做：

- 关注退化文档 OCR hallucination。
- 模型需要在文字模糊、遮挡、低对比时避免编造。
- 原论文还有 GRPO 类 mitigation。

为什么接近：

- OCR 过度具体化是 DeSpec 最强案例之一。
- “看不清具体文本”就是 right-specific answer。

关键差异：

- 它是 OCR 专项。
- DeSpec 应该把 OCR 作为 unsupported specificity 的一个实例，扩展到 object/attribute/relation/unanswerable。

风险等级：**高，但可作为主实验场景**。

### 6.2 MoHoBench / HumbleBench / HaloQuest

来源：

- [MoHoBench](https://ojs.aaai.org/index.php/AAAI/article/view/40159)
- [HumbleBench](https://arxiv.org/abs/2509.09658)
- [HaloQuest](https://arxiv.org/abs/2407.15680)

它们怎么做：

- 评估 MLLM 是否能面对不可回答、错误前提、信息不足问题。
- 重点是 honesty / refusal / none-of-the-above。

为什么接近：

- 它们会质疑模型是否应该回答。
- 和 DeSpec 的 over-vague refusal / partial answer 有关。

关键差异：

- 它们多数还是 answer vs refuse。
- DeSpec 的主张是：不可回答具体细节时，也许可以回答更粗粒度内容。

风险等级：**中**。

## 7. 结论：别人有没有在 hallucination 里做过类似 DeSpec？

答案分三层：

### 7.1 已经有人做过的部分

已经有人做过：

1. 细粒度幻觉检测：FaithScore、M-HalDetect、VBackChecker。
2. span/token 级定位：ViCrit、DetailVerifyBench、HalLoc、TLDR。
3. hallucination correction：Woodpecker、ESREAL。
4. 层级语义编辑：HalCECE。
5. OCR/不可回答拒答：KIE-HVQA、MoHoBench、HumbleBench。

### 7.2 最像 DeSpec 的

最像的是：

> **HalCECE**

因为它已经在 image captioning hallucination 里使用 hierarchical knowledge 和 conceptual counterfactuals，并明确出现 `too generic / erroneously specific / delete / replace` 这种语义编辑判断。

如果 reviewer 知道 HalCECE，他会问：

> 你们的 DeSpec 和 HalCECE 有什么区别？

必须准备回答：

> HalCECE explains and edits hallucinated captions through conceptual counterfactuals. DeSpec formulates MLLM hallucination mitigation as response specificity control: given a user query, the model should output the maximally specific visually supported answer, and we train this behavior with over-specific / right-specific / over-vague preferences across VQA, OCR, unanswerable, and fine-grained query settings.

### 7.3 还没人完整做掉的部分

我目前没有看到完整做掉：

1. 把多模态幻觉统一解释为 `unsupported specificity`。
2. 明确优化 `maximally specific visually supported answer`。
3. 同时处理 over-specific hallucination 和 over-vague refusal。
4. 用三元偏好 `over-specific / right-specific / over-vague` 训练 MLLM。
5. 跨 KIE-HVQA、MoHoBench/HumbleBench、FINER、DASH-B 评测这种行为。

## 8. 如果继续做，建议改名和收缩贡献

不要叫太泛的 `DeSpec` 也可以，建议更学术一点：

1. **RightSpec**: Learning the Right Specificity for Reliable Multimodal Answers
2. **EBS-Control**: Evidence-Bounded Specificity Control
3. **SpecAlign**: Aligning Multimodal Answers to Visually Supported Specificity

推荐主 claim：

> We shift hallucination mitigation from detecting unsupported claims to selecting the most specific visually supported response. Unlike prior caption correction and hallucination localization methods, our framework explicitly models both over-specific hallucination and over-vague refusal, and trains MLLMs with right-specific preferences.

