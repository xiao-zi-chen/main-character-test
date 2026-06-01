# 自己的多模态幻觉解决 Idea：V-CAGE / Causal Visual Evidence Gate

更新时间：2026-05-29  
目标：设计一个有辨识度、能打现有 hallucination benchmark 的方法，而不是只做普通 prompt engineering。

## 1. 方法一句话

**V-CAGE: Visual Causal Evidence Gate for Hallucination Mitigation**

中文名可以叫：

**视觉因果证据门控：基于局部证据干预的多模态幻觉抑制方法**

核心思想：

> 如果一个视觉 claim 真的来自图像证据，那么遮掉/弱化对应视觉区域后，模型对这个 claim 的支持应该明显下降；如果答案不受图像局部干预影响，说明它更可能来自语言先验或猜测，应当否定、拒答或触发二次验证。

这和普通 CoT、VCD、OPERA、DPO 的区别是：你不是单纯让模型“多想一步”，也不是对整张图做泛化扰动，而是对每个细粒度 claim 做**局部、因果、可解释的证据敏感性测试**。

## 2. 为什么这个 idea 有特色

现有方法大致分几类：

| 方法类型 | 代表工作 | 局限 |
| --- | --- | --- |
| 对比解码 | VCD、HALC、OPERA、ConVis | 多数是整图或 token-level 对比，不一定知道某个具体 claim 对应哪个证据 |
| 注意力/层干预 | Attention Causal Decoding、CAAC、ClearSight | 需要模型内部访问，且多聚焦 object hallucination |
| DPO/SFT | HA-DPO、OPA-DPO、TL-DPO、FINER-Tuning | 需要训练数据，容易只学 benchmark bias |
| 后验纠错 | Woodpecker、self-check | 往往先生成再纠错，拒答和证据不足处理弱 |
| OCR 专项 | ZoomText、Grounded Layer Correction | 对 scene text 有效，但不通用于 object/attribute/relation |

V-CAGE 的特色：

1. **Claim-level**：不是整句判断，而是拆成 object、attribute、relation、count、OCR claim。
2. **Causal intervention**：不是问模型“你确定吗”，而是改图像证据后看答案是否变化。
3. **Evidence sufficiency**：能输出 `supported / contradicted / insufficient`，天然适合 MoHoBench、KIE-HVQA 这种不可回答任务。
4. **Training-free 起步，training-enhanced 升级**：第一版可以只靠推理时多视图验证，第二版再用 DPO/LoRA。
5. **跨 benchmark**：能同时打 object false-positive、细粒度负向查询、OCR 幻觉、不可回答问题、长推理漂移。

## 3. 核心算法

### Step 1：Claim Decomposition

把用户问题或模型初答拆成细粒度 claim。

示例：

问题：`Is the man in the red shirt holding a blue umbrella?`

拆成：

1. `There is a man.`
2. `The man is wearing a red shirt.`
3. `The man is holding an umbrella.`
4. `The umbrella is blue.`

对 OCR 问题：

问题：`What is the invoice number?`

拆成：

1. `There is visible invoice-number text.`
2. `The invoice number is readable.`
3. `The invoice number equals X.`

### Step 2：Evidence Proposal

为每个 claim 找候选证据区域。

第一版不依赖外部检测器，做轻量方案：

| 方案 | 做法 | 优点 |
| --- | --- | --- |
| Grid crop search | 把图切成 3x3 或 4x4 crop，问模型哪个 crop 最支持 claim | 黑盒可用 |
| Attention token map | 如果能拿到模型 attention，用 claim token 对视觉 token 的注意力做 heatmap | 白盒更快 |
| OCR zoom crop | 对文档/OCR，把高分 crop 放大再问 | 对 KIE-HVQA/TextHalu 有用 |
| Full-image fallback | 找不到证据时保留全图判定 | 防止过早拒答 |

### Step 3：Causal Evidence Interventions

对每个 claim 构造 4 种视图：

| 视图 | 含义 | 用途 |
| --- | --- | --- |
| `I_orig` | 原图 | 正常回答 |
| `I_keep` | 只保留候选证据区域，其他区域模糊/灰化 | 检查局部证据是否足够 |
| `I_remove` | 遮掉候选证据区域，其他保留 | 检查 claim 是否依赖该证据 |
| `I_prior` | 空图/强模糊图/无图文本-only | 测语言先验强度 |

关键判据：

> 真实视觉 claim 应满足：`support(I_orig)` 高，`support(I_keep)` 仍较高，`support(I_remove)` 明显下降，`support(I_prior)` 低。

如果 `I_prior` 也高，说明模型可能在凭常识猜。  
如果 `I_remove` 后支持仍高，说明 claim 没有真正依赖视觉证据。  
如果 `I_keep` 也低，说明候选证据不充分，应拒答或重新找证据。

### Step 4：Causal Evidence Score

对每个 claim 计算：

```text
CES(c) = Support(I_orig, c)
       + Support(I_keep, c)
       - Support(I_remove, c)
       - Support(I_prior, c)
```

黑盒模型没有 token probability 时，用多次固定格式问答得到 label vote：

```text
support = P(label = supported)
contradiction = P(label = contradicted)
unknown = P(label = insufficient)
```

最终三分类：

| 条件 | 判定 |
| --- | --- |
| CES 高，contradiction 低 | supported |
| contradiction 高 | contradicted |
| CES 低，unknown 高 | insufficient evidence |

### Step 5：Answer Gate

根据所有 claim 的状态决定输出：

| Claim 状态 | 输出策略 |
| --- | --- |
| 全部 supported | 正常回答 |
| 任一关键 claim contradicted | 否定或纠正 |
| 任一关键 claim insufficient | 拒答：图像证据不足，无法确定 |
| OCR claim unreadable | 不编造具体文本 |
| attribute/relation claim 不稳定 | 输出保守答案或请求更清晰图像 |

这一步是你和普通 hallucination mitigation 的关键区别：你不是单纯降低 yes 率，而是显式区分**错误、缺证据、可回答**。

## 4. 怎么打榜

### 4.1 DASH-B / POPE / RePOPE

目标：降低 false-positive object hallucination。

对象 claim：

```text
There is a [object] in the image.
```

V-CAGE 预期有效原因：

如果物体不存在，模型可能因为场景先验回答 yes。但 grid crop 找不到稳定证据，`I_prior` 支持可能不低，`I_keep` 不稳定，因此 gate 会把它判为 `insufficient/contradicted`，降低 FPR。

主指标：

| 指标 | 预期 |
| --- | --- |
| FPR | 明显下降 |
| TNR | 上升 |
| F1 | 不应大幅下降 |
| yes-rate | 更平衡 |

### 4.2 FINER

目标：识别细粒度负向查询里的微小错误。

对象 claim：

| FINER 类型 | V-CAGE claim |
| --- | --- |
| multi-object | 每个 object existence claim |
| multi-attribute | object + attribute claim |
| multi-relation | subject-relation-object claim |
| what questions | answer candidate + evidence sufficiency |

预期有效原因：

FINER 的难点是“整体描述大体正确，只有一个细节错”。普通模型容易被上下文带偏。V-CAGE 会对每个局部 claim 单独做证据干预，更容易发现 attribute/relation 的不稳定。

### 4.3 MoHoBench

目标：不可回答视觉问题时不瞎猜。

对象 claim：

```text
The image contains enough evidence to answer the question.
```

V-CAGE 策略：

如果 `I_keep` 和 `I_orig` 都不能稳定支持答案，判为 `insufficient evidence`，输出拒答。

必须同时报告：

| 指标 | 原因 |
| --- | --- |
| Refusal Rate | 看是否更愿意拒答 |
| Refusal Rationality | 看拒答是否合理 |
| Helpfulness | 防止全拒答 |
| Over-refusal | 明明能回答却拒答的问题比例 |

### 4.4 KIE-HVQA / TextHalu-Bench

目标：看不清文本时不编造 OCR。

对象 claim：

```text
The queried text region is visible.
The text is readable.
The text equals [candidate answer].
```

V-CAGE 策略：

1. 用 crop/zoom 找文字区域。
2. 对原图、zoom crop、遮挡文字区、模糊文字区分别询问。
3. 如果答案在 zoom crop 和原图之间不一致，或者遮挡后答案仍然自信，判为 hallucination risk。

预期结果：

| 指标 | 预期 |
| --- | --- |
| OCR hallucination rate | 下降 |
| refusal on degraded text | 上升 |
| answerable OCR accuracy | 尽量保持 |

### 4.5 RH-Bench / Common-O

目标：长推理和多图推理不脱离视觉证据。

V-CAGE 扩展：

在推理前先生成 `visual fact sheet`，每个视觉事实都必须通过 causal evidence gate。后续推理只能引用通过验证的事实。

输出格式：

```text
Verified visual facts:
1. ...
2. ...

Unverified / insufficient:
1. ...

Answer:
...
```

预期：

| Benchmark | 预期 |
| --- | --- |
| RH-Bench | RH-AUC 更稳，长推理不明显下降 |
| Common-O | 共同物体误报下降 |

## 5. Baseline 该怎么设计

主对比不要太多，但必须覆盖三类：

### Prompt baseline

| Baseline | 作用 |
| --- | --- |
| Direct | 原始模型 |
| CoT | 检验“多想”是否有用 |
| Evidence-first | 检验“先列证据”是否足够 |
| Abstention Prompt | 检验单纯允许拒答是否足够 |

### Decoding / inference baseline

| Baseline | 作用 |
| --- | --- |
| VCD | 对比整图扰动式 contrastive decoding |
| OPERA | 对比过度关注 summary token 的抑制 |
| HALC | 对比 focal-contrast decoding |
| ZoomText / OCR-specific | OCR 任务专项对比 |

### Training baseline

| Baseline | 作用 |
| --- | --- |
| HA-DPO | hallucination-aware preference baseline |
| OPA-DPO | on-policy DPO 强 baseline |
| FINER-Tuning | FINER 上的专门训练方法 |

你的方法主表可以写：

```text
Base
+ CoT
+ Evidence-first
+ VCD / OPERA
+ V-CAGE
+ V-CAGE + DPO
```

## 6. 第一版最小实验

第一版不要贪多。建议：

| 模块 | 选择 |
| --- | --- |
| 模型 | Qwen2.5-VL-7B、LLaVA-OneVision-7B、InternVL-8B/14B |
| Benchmark | DASH-B、AMBER、MoHoBench、KIE-HVQA、FINER |
| 方法 | Direct、CoT、Evidence-first、V-CAGE |
| 可选 baseline | VCD 或 OPERA 选一个 |
| 主要指标 | FPR、TNR、Hallucination Rate、Refusal Precision/Recall、Over-refusal、Type-wise Acc |

如果资源紧，只跑：

```text
Qwen2.5-VL-7B + DASH-B + MoHoBench + KIE-HVQA + FINER
```

只要这四个点能成立，就有论文雏形：

1. DASH-B：FPR 降。
2. MoHoBench：合理拒答升，over-refusal 不爆炸。
3. KIE-HVQA：OCR 编造减少。
4. FINER：attribute/relation 细节错误识别更好。

## 7. Ablation 设计

| Ablation | 验证什么 |
| --- | --- |
| no `I_keep` | 只遮挡不保留证据是否不够 |
| no `I_remove` | 不做因果移除是否无法判断依赖 |
| no `I_prior` | 不测语言先验是否容易被场景常识骗 |
| no claim decomposition | 句子级判断是否弱于 claim 级 |
| no abstention gate | 只纠错不拒答是否不够 |
| grid crop vs attention map | 黑盒方案和白盒方案对比 |
| threshold sweep | 看拒答阈值和 over-refusal 的 trade-off |

关键图：

1. FPR vs over-refusal 曲线。
2. 不同 hallucination type 的提升柱状图。
3. `I_orig / I_keep / I_remove / I_prior` 的案例可视化。
4. CoT 越长 hallucination 越高，但 V-CAGE 锁定证据后曲线更平。

## 8. 第二阶段：V-CAGE-DPO

如果 training-free 版有效，再做训练增强。

### 数据构造

对每个样本构造 preference pair：

| 情况 | chosen | rejected |
| --- | --- | --- |
| supported | 正确回答 + 证据 | 拒答或错误回答 |
| contradicted | 正确否定/纠正 | 确认错误 claim |
| insufficient | 拒答 + 原因 | 编造具体答案 |
| OCR unreadable | 说明无法辨认 | 编造文字 |

### Reward 设计

```text
R = correctness
  + evidence_consistency
  + correct_abstention
  - over_refusal
  - unsupported_claims
```

这一步能把你的方法从“推理策略”升级成“训练框架”。

## 9. 论文贡献可以这样写

Contribution 1：

提出 V-CAGE，一个 claim-level 的视觉因果证据门控框架，用局部保留/移除/先验视图检测视觉 claim 是否真正由图像支持。

Contribution 2：

把 hallucination mitigation 从二分类 correct/incorrect 扩展为 `supported / contradicted / insufficient evidence`，同时处理错误前提和不可回答问题。

Contribution 3：

在 object hallucination、fine-grained negative queries、OCR hallucination、unanswerable VQA 上系统验证，显示 V-CAGE 能降低 false-positive hallucination，同时控制 over-refusal。

Contribution 4：

进一步提出 V-CAGE-DPO，把因果证据分数转化为 preference data 或 reward，提升模型的 evidence-aware answering 能力。

## 10. 可能被 reviewer 质疑的点

| 质疑 | 回应 |
| --- | --- |
| 这是不是只是 prompt engineering？ | 不是。核心是图像局部干预和 causal evidence score，prompt 只是实现接口。 |
| 多次调用模型成本高 | 报告 cost；提供 fast mode：只对高风险 claim 触发 V-CAGE。 |
| 遮挡会改变图像分布 | 同时使用 `I_keep`、`I_remove`、`I_prior` 和 threshold calibration，避免单一扰动误判。 |
| 会不会过度拒答 | 必须报告 over-refusal，并做 threshold sweep。 |
| claim decomposition 本身会错 | 做 no-decomposition ablation；也可以用简单 parser + MLLM 双路径。 |
| 和 VCD/HALC 有什么区别 | VCD/HALC 是 decoding-level contrast；V-CAGE 是 claim-level causal evidence gating，并显式支持 insufficient evidence。 |

## 11. 最适合你的投稿故事

最稳的故事不是“我们又提出一个新 benchmark”，而是：

> Existing MLLM hallucination mitigation methods suppress unsupported generations, but they rarely ask whether the visual evidence is causally necessary for each fine-grained claim. We propose V-CAGE, a claim-level causal evidence gate that verifies support through localized visual interventions and routes responses into answer, correction, or abstention.

中文：

> 现有多模态幻觉抑制方法大多关注“少说错”，但没有显式判断每个细粒度视觉陈述是否真的依赖图像证据。我们提出 V-CAGE，通过局部视觉证据保留、移除和先验对照来估计 claim 的因果证据分数，并据此选择回答、纠正或拒答。

这个故事有自己的特色，也能自然打你关心的榜。

