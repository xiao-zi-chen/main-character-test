# 最佳打榜选择、论文故事与近邻论文防撞图

更新时间：2026-05-29  
目标：判断哪个 hallucination benchmark 最值得先打，形成一个“别人没做到、我们做到了”的清晰故事，并整理潜在冲突论文。

## 1. 最终建议

不要把主线定成“我们又做了一个 hallucination mitigation prompt”。建议主线定成：

> **Counterfactual Evidence-Gated Abstention for Multimodal Hallucination Mitigation**

中文：

> **基于反事实视觉证据门控的多模态幻觉抑制与拒答校准**

可以继续用前面设计的名字 **V-CAGE**，但论文里要把关键词压在三个点上：

1. **Counterfactual evidence**：不是让模型自我反思，而是通过 `keep / remove / prior` 三种反事实视图检验视觉 claim 是否真的依赖图像证据。
2. **Claim-level**：不是整句或整图判断，而是把回答拆成 object、attribute、relation、count、OCR、answerability claim。
3. **Answer / correct / abstain routing**：不是只降低 yes 率，而是区分 `supported / contradicted / insufficient evidence`，分别回答、纠正、拒答。

这个故事能把你和 VCD、OPERA、HALC、CoReVe、CHASD、DPO 类方法拉开。

## 2. 哪个榜最好打

### 2.1 综合排序

评分含义：5 分最好。  
`好打` = 数据公开、样本量适中、评测稳定、能用 inference-time 方法快速出结果。  
`故事强` = 能体现你的特色，而不是只能证明普通 object hallucination 降了。  
`冲突小` = 现有同类方法没有完全覆盖。

| 排名 | Benchmark | 好打 | 故事强 | 方法适配 | 冲突风险 | 建议定位 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | [DASH-B](https://huggingface.co/datasets/YanNeu/DASH-B) | 5 | 3 | 5 | 2 | 第一批必跑，用来证明 false-positive object hallucination 能降 |
| 2 | [KIE-HVQA](https://huggingface.co/datasets/bytedance-research/KIE-HVQA) | 4 | 5 | 5 | 4 | 非常适合讲“看不清不要编”，但要避开原论文方法冲突 |
| 3 | [MoHoBench](https://ojs.aaai.org/index.php/AAAI/article/view/40159) | 3 | 5 | 5 | 3 | 最适合作为“拒答诚实性”主故事 |
| 4 | [HumbleBench](https://arxiv.org/abs/2509.09658) | 4 | 5 | 5 | 3 | 建议额外加入，none-of-the-above 很适合 evidence-gated abstention |
| 5 | [FINER](https://explainableml.github.io/finer-project/) | 3 | 5 | 5 | 4 | 旗舰榜；一旦能跑通，很能证明细粒度能力 |
| 6 | [AMBER](https://arxiv.org/abs/2311.07397) | 4 | 3 | 4 | 2 | 主流通用表，适合做 sanity + reviewer 熟悉对比 |
| 7 | [POPE/RePOPE](https://github.com/YanNeu/RePOPE) | 5 | 2 | 4 | 2 | 必跑但不要主打，容易被认为太老 |
| 8 | [TextHalu-Bench](https://openreview.net/forum?id=BbWrp6O8Lm) | 3 | 4 | 5 | 4 | OCR/scene text 扩展，等数据稳定后加 |
| 9 | [RH-Bench](https://github.com/MLRM-Halu/MLRM-Halu) | 3 | 4 | 3 | 3 | 推理链扩展，不建议第一批主攻 |
| 10 | [Common-O](https://openreview.net/forum?id=d0F0N0cu4n) | 3 | 4 | 3 | 3 | 多图扩展，放第二阶段 |

### 2.2 我最建议的打榜组合

第一阶段不要贪多，先打这四个：

| 组别 | Benchmark | 目的 | 预期最容易提升的指标 |
| --- | --- | --- | --- |
| 必胜 sanity | DASH-B | 看不存在物体是否还被确认 | FPR 下降、TNR 上升 |
| 主故事 1 | KIE-HVQA | 看不清文本时不编造 | OCR hallucination rate 下降、合理拒答上升 |
| 主故事 2 | MoHoBench / HumbleBench | 图像信息不足时承认证据不足 | refusal rationality、NOTA accuracy、over-answer rate |
| 旗舰挑战 | FINER | 细粒度负向查询中抓出局部错误 | multi-attribute、multi-relation accuracy |

第二阶段再加：

| Benchmark | 为什么第二阶段 |
| --- | --- |
| AMBER / POPE | 做通用补充，证明不是只在新榜有效 |
| TextHalu-Bench | 证明 OCR/scene text 泛化 |
| RH-Bench | 证明长推理前先锁证据能减少推理漂移 |
| Common-O | 证明多图共同物体推理也能降低 hallucination |

### 2.3 如果只能选一个主榜

如果只选一个最有希望打出特色的主榜，我建议选：

> **KIE-HVQA + MoHoBench/HumbleBench 组合，而不是只选 POPE 或 AMBER。**

原因：

1. 这组榜天然要求模型知道“证据不足”，和你的 V-CAGE 最匹配。
2. 单纯 object hallucination 很卷，VCD/HALC/OPERA/DPO 都做过。
3. KIE/OCR 场景可以直观看到“遮掉文本后模型还自信回答”的问题，案例非常有说服力。
4. MoHoBench/HumbleBench 能证明你不是让模型少答，而是做**合理拒答**。
5. 再用 DASH-B 做快速 false-positive 结果，FINER 做细粒度旗舰结果，论文结构就完整。

## 3. 最好的论文故事

### 3.1 当前领域还没解决好的问题

现有 hallucination mitigation 主要在回答这个问题：

> 怎样让模型少说不存在的物体？

但真实可靠性需要回答三个更细的问题：

1. 这个视觉 claim 是否有局部图像证据支持？
2. 这个 claim 是否真的依赖这块证据，而不是来自语言先验？
3. 如果证据不足，模型是否应该拒答，而不是编造？

因此你的故事应该从：

> suppress hallucination

升级成：

> verify whether each fine-grained visual claim is causally supported before answering.

### 3.2 我们做到了，别人没做到

| 维度 | 现有方法常见做法 | 我们的做法 |
| --- | --- | --- |
| 验证粒度 | 整句、整图、object token | claim-level：object/attribute/relation/OCR/answerability |
| 视觉干预 | 全图扰动、noisy image、attention 调整 | 局部 `keep / remove / prior` 反事实视图 |
| 目标 | 降低 hallucination rate | 同时做到 answer、correct、abstain |
| 不可回答问题 | 很少显式建模 | 把 insufficient evidence 作为一等状态 |
| OCR/文档退化 | 多数通用方法不覆盖 | 用 zoom + remove text region 检查 OCR 是否编造 |
| 过度拒答 | 很少系统报告 | 报告 over-refusal，画 FPR vs over-refusal 曲线 |
| 可解释性 | 多数只给最终答案 | 给出 claim 状态和关键证据视图 |

论文主张可以写成：

> Existing methods reduce hallucinated generations, but they rarely test whether each fine-grained claim is causally supported by localized visual evidence. We propose V-CAGE, a counterfactual evidence gate that verifies support through keep/remove/prior visual interventions and routes the model to answer, correct, or abstain.

中文主张：

> 现有方法大多抑制幻觉输出，但很少验证每个细粒度视觉陈述是否真的由局部图像证据因果支持。我们提出 V-CAGE，通过保留证据、移除证据和先验对照三种反事实视图估计证据充分性，并据此选择回答、纠正或拒答。

## 4. 方法要怎么设计才不撞

### 4.1 不建议强调的 claim

这些表述容易撞现有工作：

1. “我们首次使用视觉区域验证 hallucination。”  
   风险：CoReVe、Woodpecker、grounding checker 类工作已经有 region/verification。
2. “我们首次用局部扰动缓解 hallucination。”  
   风险：CHASD、VCD/HALC 变体、localized perturbation 类工作已经接近。
3. “我们首次使用因果分析解释 hallucination。”  
   风险：HalluTrace、CausalMM、AllPath、FarSight 等已经用 causal/path/intervention 语言。
4. “我们首次做拒答。”  
   风险：MoHoBench、HumbleBench、MM-AQA、TUBench、HaloQuest 都关注 answerability/abstention。

### 4.2 建议强调的安全 claim

更安全、更有特色的表述：

1. **Claim-level counterfactual evidence gating**：每个细粒度 claim 单独验证。
2. **Necessity + sufficiency + prior leakage**：同时用 `remove` 测必要性、`keep` 测充分性、`prior` 测语言先验泄漏。
3. **Answer/correct/abstain routing**：把 hallucination mitigation 和拒答校准统一起来。
4. **Cross-benchmark evidence insufficiency**：在 object hallucination、fine-grained negative queries、unanswerable VQA、OCR hallucination 上统一验证。
5. **Risk-controlled abstention**：不只提高拒答率，还报告 over-refusal 和 trade-off curve。

### 4.3 最小方法定义

对每个 claim `c`，构造四种视图：

```text
I_orig   = 原图
I_keep   = 只保留候选证据区域
I_remove = 移除候选证据区域
I_prior  = 空图、强模糊图或文本-only 先验
```

估计：

```text
CES(c) = S(I_orig, c) + S(I_keep, c) - S(I_remove, c) - S(I_prior, c)
```

判定：

| 条件 | 状态 | 行为 |
| --- | --- | --- |
| 高 CES，低 contradiction | supported | 回答 |
| contradiction 高 | contradicted | 否定或纠正 |
| CES 低且 uncertainty 高 | insufficient | 拒答 |
| prior 高但 remove 后不降 | prior-driven | 降低置信或触发二次验证 |

这套定义是你和普通 evidence prompt、self-check、VCD 的核心差异。

## 5. 近邻论文防撞表

### 5.1 最危险的直接近邻

| 论文 / 方法 | 时间 | 它做了什么 | 与我们冲突点 | 我们怎么避开 |
| --- | --- | --- | --- | --- |
| [CoReVe: Chain of Region Verification](https://arxiv.org/abs/2502.10451) | 2025 | 对可疑 object hallucination 做 region-level verification | region verification 很近 | 我们不主张首创 region verification；强调 `keep/remove/prior` 因果证据分数和 answer/correct/abstain |
| [CHASD](https://arxiv.org/abs/2507.14317) | 2025 | 用 attention-guided localized perturbation 做对比自蒸馏，缓解 object hallucination | 局部扰动很近 | 我们不是 decoding self-distillation；单位是 claim，目标含 insufficient evidence 和拒答 |
| [Visual Evidence Prompting](https://arxiv.org/abs/2408.16902) | 2024 | 用轻量 visual model 提供 visual evidence，减少 hallucination | evidence prompting 很近 | 我们不是外部证据描述，而是反事实证据敏感性测试 |
| [HalluTrace](https://arxiv.org/abs/2505.16886) | 2025 | 用 causal tracing / counterfactual attention ablations 定位 object hallucination 来源 | causal 语言很近 | 我们做输入层局部反事实 + answer policy，不是内部来源追踪 |
| [VIHD](https://arxiv.org/abs/2506.15683) | 2025 | 把 hallucination detection 视为 visual instruction matching 问题 | hallucination detection 近 | 我们是 mitigation + abstention routing，不只是 detection |
| [Seeing is Believing? / KIE-HVQA](https://arxiv.org/abs/2506.20168) | 2025 | 针对退化文档 OCR hallucination，提出 benchmark 和 GRPO 缓解 | OCR + refusal 很近 | 我们把 OCR 作为一个场景，方法通用于 object/attribute/relation/unanswerable |

### 5.2 Decoding / inference mitigation

| 论文 / 方法 | 重点 | 我们的区别 |
| --- | --- | --- |
| [VCD: Visual Contrastive Decoding](https://github.com/DAMO-NLP-SG/VCD) | 原图 vs 扰动图的 decoding contrast | 我们不是只对整图扰动，而是 claim-level 局部证据必要性/充分性 |
| [OPERA](https://github.com/shikiw/OPERA) | over-trust penalty + retrospection-allocation | 我们不依赖内部 token attention penalty，目标含拒答 |
| [HALC](https://billchan226.github.io/HALC) | adaptive focal-contrast decoding | 我们的 focal 是 claim evidence，且输出 supported/contradicted/insufficient |
| ICD / Instruction Contrastive Decoding | 利用 instruction contrast 降 hallucination | 我们不是 instruction-level contrast |
| AIR / Adaptive Inference-time Intervention | 推理时干预模型内部状态 | 我们可黑盒运行，核心是输入反事实 |
| GACD / other contrastive decoding | 解码时降低先验偏差 | 我们显式测 prior leakage，并做拒答校准 |

### 5.3 Training / alignment mitigation

| 论文 / 方法 | 重点 | 我们的区别 |
| --- | --- | --- |
| [HA-DPO](https://github.com/opendatalab/HA-DPO) | hallucination-aware DPO | 我们第一版 training-free；第二版 DPO 数据来自因果证据分数 |
| [OPA-DPO](https://github.com/zhyang2226/OPA-DPO) | on-policy preference optimization | 我们不是单纯偏好训练，而是先定义 claim evidence states |
| RLHF-V | 用人类偏好缓解 hallucination | 我们降低人工成本，用 counterfactual evidence 自动构造偏好 |
| FGAIF / fine-grained AI feedback | 细粒度 feedback | 我们的 feedback 来自视觉干预，而不是纯 judge |
| FINER-Tuning | 针对细粒度负向查询训练 | 我们可在 FINER 上 training-free 对比，也可把 V-CAGE 状态转成 DPO 数据 |

### 5.4 Benchmark / answerability 近邻

| Benchmark | 重点 | 对我们的意义 |
| --- | --- | --- |
| [MoHoBench](https://ojs.aaai.org/index.php/AAAI/article/view/40159) | visually unanswerable questions | 主故事 benchmark |
| [HumbleBench](https://arxiv.org/abs/2509.09658) | none-of-the-above / epistemic humility | 非常适合补充拒答能力 |
| HaloQuest | false premise / insufficient context | 可做相关工作，不一定首批跑 |
| MM-AQA | knowing when not to answer in multimodal reasoning | answerability 近邻，需要在 related work 提 |
| TUBench | unanswerable VQA / trustworthiness | 可作为补充小榜 |
| [FINER](https://explainableml.github.io/finer-project/) | fine-grained negative queries | 旗舰细粒度 benchmark |
| [DASH-B](https://huggingface.co/datasets/YanNeu/DASH-B) | systematic false-positive objects | 首批 sanity + object false-positive |
| [KIE-HVQA](https://huggingface.co/datasets/bytedance-research/KIE-HVQA) | degraded document OCR hallucination | 证明 evidence insufficiency 的真实场景价值 |

## 6. 第一批实验该怎么跑

### 6.1 最小可执行版本

| 项 | 选择 |
| --- | --- |
| 模型 | Qwen2.5-VL-7B、LLaVA-OneVision-7B、InternVL-8B/14B |
| Benchmark | DASH-B、KIE-HVQA、MoHoBench/HumbleBench、FINER |
| Baseline | Direct、CoT、Evidence-first、Abstention Prompt、VCD 或 OPERA |
| Ours | V-CAGE training-free |
| 指标 | FPR/TNR、Hallucination Rate、Refusal Precision/Recall、Over-refusal、Type-wise Acc |

### 6.2 第一批成功标准

| Benchmark | 成功标准 |
| --- | --- |
| DASH-B | FPR 下降明显，TNR 上升，F1 不大幅下降 |
| KIE-HVQA | OCR hallucination rate 下降，answerable accuracy 不崩 |
| MoHoBench/HumbleBench | 合理拒答上升，over-refusal 可控 |
| FINER | attribute/relation/what 子类至少有稳定提升 |

### 6.3 不要只报 overall accuracy

必须报这些曲线或分项：

1. FPR vs over-refusal 曲线。
2. answerable 和 unanswerable 分开。
3. object、attribute、relation、OCR 分开。
4. `I_orig / I_keep / I_remove / I_prior` 可视化案例。
5. cost/latency，因为 V-CAGE 多次调用模型。

## 7. 最强故事版论文结构

### Title 候选

1. **Do Multimodal Models Really See It? Counterfactual Evidence-Gated Abstention for Hallucination Mitigation**
2. **V-CAGE: Claim-Level Counterfactual Visual Evidence Gating for Reliable Multimodal Responses**
3. **From Seeing to Knowing When Not to Answer: Counterfactual Evidence Gates for MLLM Hallucination**

### Abstract 逻辑

1. MLLM hallucination mitigation 多关注减少错误生成。
2. 但可靠模型还需要判断每个 claim 是否由视觉证据支持，以及证据不足时是否拒答。
3. 我们提出 V-CAGE，对每个 claim 构造 keep/remove/prior 反事实视图，估计 causal evidence score。
4. 根据 supported/contradicted/insufficient 三状态选择回答、纠正或拒答。
5. 在 DASH-B、KIE-HVQA、MoHoBench/HumbleBench、FINER 上验证，降低 false-positive hallucination，同时控制 over-refusal。

### Contribution 写法

1. 提出 claim-level counterfactual evidence gating，用视觉证据保留、移除和先验对照评估 claim 的视觉依赖性。
2. 提出统一的 answer/correct/abstain policy，把 hallucination mitigation 与 evidence insufficiency / refusal calibration 结合。
3. 在 object、fine-grained negative query、OCR、unanswerable VQA 四类 benchmark 上系统评估，并报告 over-refusal trade-off。
4. 可选：提出 V-CAGE-DPO，用反事实证据状态构造 preference pairs，进一步提升可靠性。

## 8. 风险最高的点

| 风险 | 解决方式 |
| --- | --- |
| 和 CoReVe/CHASD 太像 | related work 主动承认 region verification / local perturbation 已存在；强调三视图证据分数 + 拒答路由 |
| 只是在 prompt engineering | 需要有公式、视图构造、阈值校准、ablation，不要只展示 prompt |
| 过度拒答导致 accuracy 虚高 | 必须报告 over-refusal 和 answerable subset accuracy |
| KIE-HVQA 原论文已有 OCR mitigation | 把 KIE-HVQA 作为一个验证场景，不声称 OCR 专项 SOTA；强调跨 benchmark 统一方法 |
| FINER 数据或官方代码不稳定 | FINER 放旗舰挑战；若暂时跑不通，用 DASH-B + KIE-HVQA + HumbleBench/MoHoBench 先出第一版 |
| 多次调用模型成本高 | 设计 fast mode：只对高风险 claim 触发 keep/remove/prior |

## 9. 最终路线图

### 第 1 周：快速验证

1. 跑 Qwen2.5-VL-7B on DASH-B。
2. 实现简版 V-CAGE：grid crop + remove + prior，不做训练。
3. 看 FPR/TNR 是否改善。

### 第 2 周：打主故事

1. 跑 KIE-HVQA 小子集。
2. 加 OCR zoom crop。
3. 报告 readable/unreadable 分组和 hallucination rate。

### 第 3 周：拒答校准

1. 跑 MoHoBench 或 HumbleBench。
2. 调阈值，画 over-refusal trade-off。
3. 加 Direct、CoT、Abstention Prompt、Evidence-first 对比。

### 第 4 周：旗舰细粒度

1. 跑 FINER。
2. 做 object/attribute/relation/what 分项。
3. 如果有效，写第一版 paper outline。

## 10. 最后判断

最好打、最快出结果：**DASH-B**。  
最能体现你特色：**KIE-HVQA + MoHoBench/HumbleBench**。  
最适合当旗舰挑战：**FINER**。  
最适合做 reviewer 熟悉的补充：**AMBER + POPE/RePOPE**。

论文故事不要写“我们降低了幻觉”，要写：

> 我们让模型在回答前验证每个视觉 claim 是否真的被局部图像证据因果支持；当证据矛盾时纠正，当证据不足时拒答。

这个故事有自己的特色，也最能解释为什么你能同时打 object hallucination、OCR hallucination、unanswerable VQA 和 fine-grained negative queries。

