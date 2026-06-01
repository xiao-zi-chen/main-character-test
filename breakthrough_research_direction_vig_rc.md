# 突破型研究方向：VIG-RC 视觉信息增益风险控制

更新时间：2026-05-29  
目标：避免“堆模块式 hallucination mitigation”，形成一个更有原则、更有故事、更容易讲清楚贡献的研究方向。

## 1. 先把问题重新定义

前面提出的 V-CAGE 是可做的，但你的直觉是对的：如果只是 claim decomposition、crop、remove、self-check、DPO 一起堆，论文故事会显得工程化。

更好的切入点不是：

> 怎么让模型少幻觉一点？

而是：

> **当用户给定一个可接受幻觉风险，比如 5%，多模态模型能不能只在视觉证据足够时回答，并把已回答样本中的幻觉风险控制在这个预算内？**

这就是从“平均提升 benchmark accuracy”变成“可控可靠性”。

## 2. 推荐主方向

### 名字

**VIG-RC: Visual Information Gain Risk Control for Multimodal Hallucination**

中文：

**视觉信息增益风险控制：面向多模态幻觉的可控回答与拒答**

一句话：

> 我们不再只问模型“你自信吗”，而是问：图像本身到底给这个答案带来了多少额外信息？如果答案在有图和无图/模糊图/错误图下几乎一样，那么它很可能不是被视觉证据支持，而是语言先验驱动，应被拒答或二次取证。

## 3. 核心思想

现有幻觉抑制方法常见缺陷：

1. **VCD/OPERA/HALC**：能降 object hallucination，但主要是 decoding trick，很少给用户风险保证。
2. **CoT/self-check**：模型会自我合理化，不能证明它真的看到了。
3. **DPO/RLHF**：能训练得更保守，但不知道什么时候该答、什么时候该拒。
4. **普通 refusal prompt**：容易把模型训成“全拒答”，over-refusal 高。
5. **普通 region verification**：能验证局部，但缺少整体的风险校准目标。

VIG-RC 的核心突破：

> 用视觉信息增益衡量答案是否真的依赖图像，再用 conformal / selective prediction 做风险控制，在目标风险下最大化回答覆盖率。

也就是说，我们把多模态幻觉问题变成：

```text
给定风险预算 alpha：
在保证 answered samples 的 hallucination risk <= alpha 的前提下，
尽可能多回答问题。
```

这比单纯报告 accuracy 更强。

## 4. 方法主干

### Step 1：生成候选答案

给定图像 `I` 和问题 `q`，基础 MLLM 生成候选答案 `a`。

```text
a = M(I, q)
```

### Step 2：构造视觉对照条件

不是只看原图，而是构造三个条件：

| 条件 | 含义 | 目的 |
| --- | --- | --- |
| `I_full` | 原图 | 正常视觉输入 |
| `I_prior` | 空图、强模糊图、文本-only 或无关图 | 测语言先验 |
| `I_perturb` | 轻微裁剪、遮挡、低清、局部 zoom | 测答案稳定性 |

如果是 OCR/document，可以加：

| 条件 | 含义 |
| --- | --- |
| `I_zoom` | 高分辨率局部文字 crop |
| `I_text_removed` | 遮掉候选文字区域 |

### Step 3：计算视觉信息增益

如果能拿到 logits，定义：

```text
VIG(a) = log P(a | I_full, q) - log P(a | I_prior, q)
```

如果是多选题，可以用 KL：

```text
VIG(q) = KL( P(y | I_full, q) || P(y | I_prior, q) )
```

直觉：

| 情况 | 含义 |
| --- | --- |
| 高 confidence + 高 VIG | 答案确实依赖图像，比较可靠 |
| 高 confidence + 低 VIG | 模型很自信，但图像没有提供多少信息，幻觉风险高 |
| 低 confidence + 高 VIG | 图像有信息但模型不稳定，可触发 zoom / active evidence |
| 低 confidence + 低 VIG | 证据不足，应拒答 |

### Step 4：加入视觉稳定性

只看 `I_full` vs `I_prior` 还不够，需要看轻微扰动下答案是否稳定。

```text
Stability(a) = agreement( M(I_full, q), M(I_perturb_1, q), ..., M(I_perturb_k, q) )
```

OCR 场景：

```text
TextStability = agreement( M(I_full, q), M(I_zoom, q), M(I_text_removed, q) )
```

如果遮掉文字区域后模型仍然给同一个具体 invoice number，这就是强烈的 OCR hallucination 信号。

### Step 5：定义 hallucination risk score

```text
RiskScore = w1 * PriorLeakage
          + w2 * Instability
          + w3 * LowVisualGain
          + w4 * UnsupportedSpecificity
```

其中：

```text
PriorLeakage = P(a | I_prior, q)
LowVisualGain = - VIG(a)
Instability = 1 - Stability(a)
UnsupportedSpecificity = 答案越具体但视觉增益越低，风险越高
```

具体性很关键。比如：

| 回答 | 风险 |
| --- | --- |
| “看不清具体编号” | 低风险 |
| “发票号是 INV-739204” 但 VIG 很低 | 高风险 |

### Step 6：风险校准，而不是拍脑袋调阈值

使用一小部分 calibration set，选择阈值 `tau_alpha`。

目标：

```text
Answer if RiskScore <= tau_alpha
Abstain / ask for zoom / correction if RiskScore > tau_alpha
```

这里可以借用 conformal prediction / selective prediction 思想：

> 在交换性假设下，用校准集把风险阈值调到目标水平，使 answered subset 的错误风险受控。

不要夸张说“绝对保证不幻觉”。安全写法是：

> We provide empirical and conformal-style marginal risk control under standard calibration assumptions.

中文：

> 在标准校准假设下提供边际风险控制，并实证展示在给定风险预算下显著提高覆盖率。

## 5. 这个方向为什么不是堆东西

V-CAGE 是一个机制；VIG-RC 是一个原则。

| 维度 | 堆模块方案 | VIG-RC |
| --- | --- | --- |
| 核心问题 | 多加几步检查，减少幻觉 | 给定风险预算，什么时候可以回答 |
| 关键变量 | crop、遮挡、self-check | 视觉信息增益、先验泄漏、风险阈值 |
| 理论来源 | 工程验证 | 信息论 + 选择性预测 + conformal calibration |
| 评测方式 | accuracy / hallucination rate | risk-coverage curve、coverage at target risk |
| 论文故事 | 我们方法更强 | 现有方法不能控制风险，我们能控制 |

这会更像一个真正的研究问题。

## 6. 和现有工作的区别

| 近邻工作 | 它做了什么 | 我们怎么区别 |
| --- | --- | --- |
| [VCD](https://github.com/DAMO-NLP-SG/VCD) | 原图和扰动图做 contrastive decoding | 我们不是直接改 decoding，而是估计视觉信息增益并做风险控制 |
| [OPERA](https://github.com/shikiw/OPERA) | 抑制 over-trust attention / token | 我们不依赖 attention penalty，且输出可拒答 |
| [HALC](https://billchan226.github.io/HALC) | focal contrast decoding | 我们用 risk-coverage 目标，而不是只优化生成 |
| [ReCoVERR](https://arxiv.org/abs/2402.15610) | 选择性预测中收集视觉证据，减少过度拒答 | 我们关注 hallucination benchmark，核心分数是 image-vs-prior information gain，并加入风险校准 |
| [Learning Conformal Abstention Policies](https://arxiv.org/abs/2502.06884) | 用 conformal abstention 管理 LLM/VLM 风险 | 我们不是通用 uncertainty，而是视觉先验泄漏和视觉信息增益驱动的 hallucination risk |
| CoReVe | region verification | 我们不主张首创区域验证，重点是 risk-controlled answering |
| CHASD | attention-guided local perturbation self-distillation | 我们不是自蒸馏，也不是只做 object hallucination |
| KIE-HVQA 原论文 | OCR hallucination benchmark + GRPO 缓解 | 我们把 OCR 作为 evidence insufficiency 的一个场景，统一到风险控制框架 |
| HALP | pre-generation probe 预测 hallucination risk | 我们是输入级视觉信息增益，黑盒/白盒都可用，并有风险覆盖目标 |

## 7. 最适合打哪些榜

### 第一优先级

| Benchmark | 为什么适合 VIG-RC | 主要指标 |
| --- | --- | --- |
| KIE-HVQA | OCR 看不清时，模型若仍输出具体文本，通常是低 VIG 高 specificity | Hallucination rate、Refusal precision、Answerable accuracy |
| MoHoBench / HumbleBench | 不可回答问题天然对应低 visual information gain | Refusal rationality、NOTA accuracy、Over-refusal |
| DASH-B | false-positive object 很多来自语言/场景先验 | FPR、TNR、risk-coverage |
| FINER | 细粒度负向查询可检测 attribute/relation 的 visual gain 是否足够 | type-wise accuracy、FPR |

### 第二优先级

| Benchmark | 用途 |
| --- | --- |
| AMBER / POPE | reviewer 熟悉，做通用补充 |
| TextHalu-Bench | scene text 语义先验导致 OCR 幻觉，适合扩展 |
| RH-Bench | 长推理时用 VIG 控制中间视觉事实是否可用 |
| Common-O | 多图共同物体推理中检测 common-object claim 的信息增益 |

## 8. 评测不要再只报 accuracy

你的主图应该是：

### 图 1：Risk-Coverage Curve

x 轴：Coverage，也就是回答比例。  
y 轴：Hallucination risk 或 error rate。

结论要是：

> 在同样 5% hallucination risk 下，VIG-RC 能回答更多问题。

这比“accuracy 提高 2%”更有说服力。

### 图 2：Visual Gain vs Hallucination

把样本按 VIG 分桶：

| VIG 桶 | 预期 |
| --- | --- |
| 高 VIG | 幻觉低 |
| 中 VIG | 混合 |
| 低 VIG + 高 confidence | 幻觉高 |

如果这个图成立，你的论文就有核心发现。

### 图 3：Answerable / Unanswerable 分离

要证明不是全拒答：

| 子集 | 目标 |
| --- | --- |
| Answerable | accuracy 保持或提升 |
| Unanswerable | over-answer 降低 |
| Ambiguous / degraded | 合理拒答提升 |

### 图 4：Specificity-Risk 曲线

越具体的答案，应该要求越高的视觉信息增益。

例子：

| 答案类型 | 需要的 VIG |
| --- | --- |
| “有一个人” | 中 |
| “红衣男子拿着蓝伞” | 高 |
| “发票号是 INV-739204” | 很高 |

## 9. 第一版实验怎么做

### 最小可行版本

先不要做复杂 crop，也不要训练。

| 步骤 | 内容 |
| --- | --- |
| 1 | 跑 base model 得到 answer 和 confidence/logprob |
| 2 | 用 `I_full` 和 `I_prior` 计算 VIG |
| 3 | 用 2-3 个简单 perturbation 测 stability |
| 4 | 在 calibration split 上调 risk threshold |
| 5 | 在 test split 上画 risk-coverage curve |

模型：

| 模型 | 原因 |
| --- | --- |
| Qwen2.5-VL-7B | 主力，OCR/中文强 |
| LLaVA-OneVision-7B | 常见 baseline |
| InternVL-8B/14B | 强开源模型 |

Benchmark：

| 批次 | Benchmark |
| --- | --- |
| 第 1 批 | DASH-B、KIE-HVQA、HumbleBench 或 MoHoBench |
| 第 2 批 | FINER、AMBER、POPE |
| 第 3 批 | TextHalu-Bench、RH-Bench |

Baseline：

| Baseline | 作用 |
| --- | --- |
| Confidence threshold | 最直接不确定性 |
| Entropy / self-consistency | 语言生成不确定性 |
| Abstention prompt | 普通拒答提示 |
| ReCoVERR | 选择性预测视觉证据收集 |
| VCD / OPERA / HALC | hallucination mitigation |
| Conformal abstention | 通用风险校准 |
| VIG-RC | 我们的方法 |

## 10. 可能最容易成功的实验假设

### Hypothesis 1

> 幻觉样本往往具有“高文本自信 + 低视觉信息增益”。

验证：

在 DASH-B、KIE-HVQA、FINER 上画 `confidence vs VIG`。  
如果 hallucinated answers 集中在 high-confidence / low-VIG 区域，这就是核心发现。

### Hypothesis 2

> VIG 比 confidence 更能预测 multimodal hallucination。

验证：

比较 AUROC：

| Score | AUROC for hallucination detection |
| --- | --- |
| confidence |
| entropy |
| self-consistency |
| VIG |
| VIG + stability |

### Hypothesis 3

> 在固定 hallucination risk 下，VIG-RC 比 confidence threshold 保留更多回答。

验证：

报告：

```text
Coverage @ 5% hallucination risk
Coverage @ 10% hallucination risk
```

这会比单纯 accuracy 更像安全可靠 AI 论文。

### Hypothesis 4

> 对具体答案施加更高 visual gain requirement，可以显著减少 OCR 和 attribute hallucination。

验证：

在 KIE-HVQA 和 FINER multi-attribute 子集上做 specificity-aware threshold。

## 11. 第二阶段可以加的创新

### 11.1 Active Visual Information Acquisition

如果 `RiskScore` 不确定，不直接拒答，而是主动获取证据：

```text
选择最可能提升 VIG 的 crop / zoom / region question
```

这来自 active perception / active learning。

流程：

1. 原图回答。
2. 计算 risk。
3. 若 risk 中等，选择一个 crop/zoom。
4. 如果 VIG 上升并稳定，则回答；否则拒答。

这样可以避免过度拒答。

和 ReCoVERR 的区别：

| ReCoVERR | VIG-RC + Active Evidence |
| --- | --- |
| 生成相关问题收集证据 | 选择能最大提升视觉信息增益的视觉操作 |
| 主要减少 over-abstention | 同时控制 hallucination risk |
| 依赖 NLI 判断 evidence relevance | 使用 VIG 和 risk threshold |

### 11.2 VIG-DPO

如果第一版有效，再把 VIG 用作自动偏好信号。

构造 preference：

| 情况 | chosen | rejected |
| --- | --- | --- |
| 高 VIG 正确答案 | grounded answer | refusal 或错误答案 |
| 低 VIG 具体答案 | abstention | hallucinated specific answer |
| 高 prior leakage | conservative answer | confident answer |
| OCR low VIG | “无法辨认” | 编造具体文本 |

这比普通 DPO 更有特色：偏好来自视觉信息增益，而不是纯 judge。

## 12. 为什么这个方向更好投稿

这个方向可以讲四个贡献：

1. **发现**：MLLM 幻觉常表现为 high confidence but low visual information gain。
2. **方法**：提出 VIG-RC，用 image-vs-prior visual information gain 估计 hallucination risk。
3. **保证/校准**：通过 conformal-style calibration 在目标风险下做 selective answering。
4. **实验**：在 object hallucination、OCR hallucination、unanswerable VQA、fine-grained negative queries 上统一验证，并报告 risk-coverage。

这比“我们又设计了一个 prompt/crop/verifier”强很多，因为它有：

1. 一个新的可解释变量：visual information gain。
2. 一个明确优化目标：maximize coverage under bounded hallucination risk。
3. 一个跨 benchmark 的统一视角：低视觉信息增益导致不可靠回答。
4. 一个能自然扩展到训练的方法：VIG-DPO。

## 13. 我最终建议

主线不要再写 V-CAGE 了，改成：

> **VIG-RC：用视觉信息增益做多模态幻觉风险控制。**

V-CAGE 里的 keep/remove/crop 可以保留，但只作为计算 VIG / stability 的工具，而不是论文核心。

最强故事：

> 现有方法追求平均 hallucination rate 下降，却不能告诉用户“这次回答的风险是否可接受”。我们发现，很多幻觉答案并不是低置信度，而是高置信但低视觉信息增益。基于此，我们提出 VIG-RC，用图像相对语言先验带来的信息增益来估计幻觉风险，并通过风险校准在给定风险预算下选择回答或拒答。

第一批实验就做：

1. DASH-B：证明 high-confidence false positive 往往低 VIG。
2. KIE-HVQA：证明具体 OCR 编造往往低 VIG，高 specificity。
3. MoHoBench / HumbleBench：证明低 VIG 样本应该拒答。
4. FINER：证明 attribute/relation 细粒度错误也能被低 VIG / instability 捕捉。

这比单纯堆 benchmark 和 baseline 更像一个有中心思想的研究。

