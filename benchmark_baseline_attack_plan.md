# 多模态幻觉 Benchmark 攻打方案与 Baseline 设计

更新时间：2026-05-29  
目标：基于现有多模态幻觉 benchmark，设计可执行实验、baseline 和可以尝试投稿的改进 idea。

## 1. 最推荐的实验主线

建议主线不要写成“我又提出一个幻觉 benchmark”，而是写成：

> Evidence-aware abstention and verification for fine-grained multimodal hallucination.

中文表述：

> 面向细粒度多模态幻觉的视觉证据感知拒答与校验方法。

核心观点是：模型幻觉不只是因为“看错”，还因为它不知道什么时候证据不足。你可以在 FINER、MoHoBench、KIE-HVQA、DASH-B、TextHalu-Bench、ViCrit-Bench 上共同验证一个方法：先判断视觉证据是否支持 query，再回答；证据不足时拒答；证据矛盾时纠正或否定。

## 2. Benchmark 优先级

| 优先级 | Benchmark | 为什么值得打 | 公开可用性 | 推荐用途 |
| --- | --- | --- | --- | --- |
| P0 | [DASH-B](https://huggingface.co/datasets/YanNeu/DASH-B) | 比 POPE 更难，专门挖 systematic false-positive object hallucination | Hugging Face，2682 test samples | 快速主结果；检验 false-positive 抑制 |
| P0 | [RePOPE / POPE](https://github.com/YanNeu/RePOPE) 和 [POPE](https://github.com/RUCAIBox/POPE) | 经典物体幻觉基线，容易跑，reviewer 熟悉 | GitHub / HF | sanity check；不要作为唯一贡献 |
| P0 | [AMBER](https://arxiv.org/abs/2311.07397) | object、attribute、relation 多维度，LLM-free 评测 | 官方代码可用 | 通用幻觉主结果 |
| P0 | [MoHoBench](https://arxiv.org/abs/2507.21503) | 不可回答视觉问题，直接测试 honesty/refusal | 论文称数据和代码开放 | 你的核心主线之一 |
| P0 | [KIE-HVQA](https://huggingface.co/datasets/bytedance-research/KIE-HVQA) | 退化文档 OCR 幻觉，证据不足很明显 | HF 数据集，约 582MB | OCR/文档方向核心结果 |
| P0 | [FINER](https://arxiv.org/abs/2603.17662) | 细粒度负向查询，和你的 idea 最匹配 | 论文称 code、benchmark、models 已开放 | 主结果；若代码顺利可优先打 |
| P1 | [TextHalu-Bench](https://arxiv.org/abs/2506.05551) | scene text 中语义先验导致读错 | HF 上有数据痕迹 | OCR 专项扩展 |
| P1 | [ViCrit-Bench](https://arxiv.org/abs/2506.10128) | 定位长 caption 中错误 span | HF 上有 ViCrit-Bench / Train | span-level critic 扩展 |
| P1 | [RH-Bench](https://github.com/MLRM-Halu/MLRM-Halu) | 检查 reasoning 越长越幻觉 | GitHub 释放 small-scale RH-Bench | 推理链副作用实验 |
| P1 | [Common-O Bench](https://openreview.net/forum?id=d0F0N0cu4n) | 多图共同物体推理，单图方法不一定有效 | HF 上有 MM-Hallu/Common-O-Bench | 多图扩展 |
| P2 | FREAK | 反常识编辑图像很新 | 需确认数据/代码是否完整开放 | 等数据稳定后补充 |
| P2 | SimpleVQA | 更偏 factuality，不是纯视觉幻觉 | ICCV 2025 | 相关性补充，不建议做主结果 |

## 3. Baseline 矩阵

### 3.1 模型 baseline

先选 4-6 个开放模型，不要一开始铺太大。

| 类型 | 模型 | 用途 |
| --- | --- | --- |
| 轻量可复现 | Qwen2.5-VL-7B-Instruct | 主力开源 baseline，OCR/中文也比较强 |
| 轻量可复现 | LLaVA-OneVision-7B | 社区常用，便于和旧工作比较 |
| 轻量可复现 | MiniCPM-V / MiniCPM-o 系列 | 端侧强模型，对 hallucination 指标有公开报告 |
| 中等规模 | InternVL2.5/3.x 8B-14B | 视觉能力强，适合主结果 |
| 强模型 | Qwen2.5-VL-32B/72B 或 InternVL 大模型 | 如果显存/API 允许，作为强开源上界 |
| 闭源可选 | GPT/Gemini/Claude 类视觉模型 | 只做参考上界，注意成本和可复现性 |

建议主表至少包含：`LLaVA-OneVision-7B`、`Qwen2.5-VL-7B`、`MiniCPM-V`、`InternVL-8B/14B`。如果资源有限，先只跑两个：`Qwen2.5-VL-7B` 和 `LLaVA-OneVision-7B`。

### 3.2 方法 baseline

| Baseline | 是否训练 | 适合 benchmark | 作用 |
| --- | --- | --- | --- |
| Direct Answer | 否 | 全部 | 最基础零样本 |
| Strict Yes/No Prompt | 否 | POPE、DASH-B、FINER | 避免格式错误 |
| CoT Prompt | 否 | RH-Bench、Common-O、FREAK | 看推理是否改善或放大幻觉 |
| Evidence-first Prompt | 否 | FINER、MoHoBench、KIE-HVQA、TextHalu | 让模型先列视觉证据再回答 |
| Abstention-aware Prompt | 否 | MoHoBench、KIE-HVQA、HaloQuest 类 | 允许“不知道/证据不足” |
| Self-check / Self-verification | 否 | FINER、DASH-B、ViCrit | 回答后再检查是否有视觉证据 |
| Crop/Zoom Prompting | 否 | OCR、TextHalu、KIE-HVQA | 对局部文本和小物体有效 |
| [VCD](https://github.com/DAMO-NLP-SG/VCD) | 否 | POPE、AMBER、DASH-B | 经典视觉对比解码 |
| [OPERA](https://github.com/shikiw/OPERA) | 否 | caption / object hallucination | 解码期 over-trust penalty |
| [HALC](https://billchan226.github.io/HALC) | 否 | object hallucination | adaptive focal-contrast decoding |
| [Woodpecker](https://github.com/BradyFU/Woodpecker) | 否/外部工具 | 开放生成 caption | 检测并纠正 hallucination |
| [HA-DPO](https://github.com/opendatalab/HA-DPO) | 是 | POPE、AMBER、MMHal-Bench | DPO 类训练基线 |
| [OPA-DPO](https://github.com/zhyang2226/OPA-DPO) | 是 | AMBER、Object-Hal、POPE | 更强 DPO 训练基线 |
| FINER-Tuning | 是 | FINER、DASH-B、AMBER | 细粒度负向查询专用训练对照 |

低成本论文实验可以先做 prompt baseline + 你的方法；训练型 baseline 只选 HA-DPO 或 OPA-DPO 一个做对比即可。

## 4. 你可以打的三个 idea

### Idea A：Evidence-Gated Abstention，最推荐

适合主投方向。方法是把回答拆成三步：

1. Query decomposition：把问题拆成 object、attribute、relation、count、OCR 等视觉 claim。
2. Evidence verification：对每个 claim 判断 `supported / contradicted / insufficient evidence`。
3. Answer policy：全部 supported 才回答；出现 contradicted 就否定；出现 insufficient evidence 就拒答或说明无法判断。

推荐 benchmark：

| Benchmark | 预期提升点 |
| --- | --- |
| FINER | 查询里藏了一个细粒度错误，claim-level verification 正好对症 |
| MoHoBench | 证据不足时拒答，提升 honesty/refusal |
| KIE-HVQA | 看不清文本时避免 OCR 编造 |
| DASH-B | 减少不存在物体的 false positive |
| TextHalu-Bench | 避免用语义先验补全随机/模糊文本 |

实验组：

| 组别 | 描述 |
| --- | --- |
| Base | 原模型 direct answer |
| +CoT | 普通 chain-of-thought |
| +Evidence-first | 先列证据再回答 |
| +Evidence-Gate | claim 分解 + support 判断 + answer policy |
| +Evidence-Gate + Crop/Zoom | 对小物体/OCR 区域增加 crop/zoom |
| +DPO/SFT | 小规模 preference tuning，chosen 是 grounded answer/refusal |

可以主打的结论：

> CoT 不一定减少 hallucination，但 evidence-gated verification 能同时降低 false positive 和过度拒答。

### Idea B：Direction-Aware Prompt Routing

适合快速做出结果。很多 benchmark 的 overall accuracy 会掩盖两种错误：

1. Yes-bias：模型总说有，导致 false positive hallucination。
2. No-bias / over-refusal：模型太保守，明明有也说没有或拒答。

方法：

1. 先在小验证集上测每个模型的 FP/FN 倾向。
2. 如果模型 yes-bias 强，使用 skeptical prompt：要求必须有明确视觉证据才回答 yes。
3. 如果模型 no-bias 强，使用 grounded prompt：要求先定位证据，避免过度拒答。
4. 对不同 benchmark 或不同 query type 自动切换 prompt。

推荐 benchmark：

| Benchmark | 为什么适合 |
| --- | --- |
| POPE/RePOPE | yes/no object hallucination，能清楚看 FP/FN |
| DASH-B | false-positive 挑战强，适合 skeptical routing |
| AMBER discriminative split | 多维度 yes/no |
| MoHoBench | 检查 skeptical prompt 是否导致合理拒答还是过度拒答 |

优势：几乎不用训练，能快速得到一套 baseline 和分析图。  
风险：创新性比 Idea A 弱，需要和 evidence verification 结合才更像论文贡献。

### Idea C：Reasoning-Budget Control for RH-Bench

针对“More Thinking, Less Seeing?”这条线。方法不是让模型想更多，而是让模型先锁定视觉事实，再进行短推理。

实验设置：

| 组别 | 描述 |
| --- | --- |
| Direct | 直接回答 |
| Long CoT | 要求详细推理 |
| Visual Facts First | 先输出 3-5 条可见事实，再回答 |
| Evidence-Locked Short Reasoning | 只允许基于已列事实推理 |
| Periodic Visual Check | 每 N 个推理步骤重新检查图像证据 |

推荐 benchmark：RH-Bench、HallusionBench、Common-O Bench。  
核心指标：RH-AUC、accuracy、false-positive rate、response length、evidence consistency。

可以主打的结论：

> 推理长度本身不是可靠性的来源，视觉事实锁定和推理预算控制比单纯 CoT 更稳定。

## 5. 最小可执行实验方案

如果你现在想尽快做第一版结果，建议这样跑：

### 第一批：两周内能完成

| 内容 | 选择 |
| --- | --- |
| Benchmark | DASH-B、RePOPE/POPE、AMBER、MoHoBench 小子集、KIE-HVQA |
| 模型 | Qwen2.5-VL-7B、LLaVA-OneVision-7B、MiniCPM-V、InternVL-8B/14B |
| Baseline | Direct、CoT、Evidence-first、Abstention-aware |
| 你的方法 | Evidence-Gated Abstention |
| 指标 | Acc、F1、TPR、TNR、FPR、Refusal Rate、Over-refusal、type-wise error |

### 第二批：能形成论文亮点

| 内容 | 选择 |
| --- | --- |
| Benchmark | FINER、TextHalu-Bench、ViCrit-Bench、RH-Bench、Common-O |
| Baseline | VCD、OPERA、HALC、HA-DPO/OPA-DPO |
| 你的方法升级 | crop/zoom evidence gate + small-scale DPO |
| 指标 | hallucination rate、abstention precision/recall、evidence grounding accuracy、RH-AUC |

## 6. 推荐主表结构

### 主表 1：通用 hallucination

| Model/Method | POPE F1 | RePOPE F1 | DASH-B Acc | DASH-B TNR | AMBER Acc | AMBER Hall. Rate |
| --- | --- | --- | --- | --- | --- | --- |
| Base |  |  |  |  |  |  |
| +CoT |  |  |  |  |  |  |
| +Evidence-first |  |  |  |  |  |  |
| +Ours |  |  |  |  |  |  |

### 主表 2：证据不足和拒答

| Model/Method | MoHo Refusal Rate | MoHo Rationality | KIE-HVQA Acc | KIE-HVQA Hall. Rate | Over-refusal |
| --- | --- | --- | --- | --- | --- |
| Base |  |  |  |  |  |
| +Abstention Prompt |  |  |  |  |  |
| +Ours |  |  |  |  |  |

### 主表 3：细粒度负向查询

| Model/Method | FINER Multi-object | FINER Multi-attr | FINER Multi-rel | FINER What | Avg |
| --- | --- | --- | --- | --- | --- |
| Base |  |  |  |  |  |
| +CoT |  |  |  |  |  |
| +Evidence-Gate |  |  |  |  |  |
| +Ours+DPO |  |  |  |  |  |

### 主表 4：推理和多图扩展

| Model/Method | RH-Bench Acc | RH-AUC | Common-O Acc | Common-O Complex | HallusionBench |
| --- | --- | --- | --- | --- | --- |
| Direct |  |  |  |  |  |
| Long CoT |  |  |  |  |  |
| Visual Facts First |  |  |  |  |  |
| Ours |  |  |  |  |  |

## 7. Ablation 必须做

| Ablation | 目的 |
| --- | --- |
| no decomposition | 验证 claim-level 分解是否有用 |
| no abstention | 验证拒答策略是否有用 |
| no crop/zoom | 验证局部证据增强是否有用 |
| supported-only vs supported/contradicted/unknown | 验证三分类证据判断是否优于二分类 |
| prompt-only vs small DPO | 验证训练是否带来额外提升 |
| by hallucination type | 看 object、attribute、relation、OCR 哪类最受益 |

## 8. 风险和规避

| 风险 | 规避方式 |
| --- | --- |
| 只提升 refusal rate，但 accuracy 下降 | 必须报告 over-refusal，并在可回答样本上单独评估 |
| CoT 泄露或格式不稳定 | 所有 benchmark 固定输出 schema，使用 deterministic decoding |
| LLM-as-judge 被质疑 | 优先用 LLM-free 指标；MoHo rationality 可只作为辅指标 |
| benchmark 数据未完全开放 | 主结果放 DASH-B、AMBER、POPE/RePOPE、KIE-HVQA；FINER/FREAK 放第二阶段 |
| 方法太像 prompt engineering | 加入 claim decomposition、support-state policy 和小规模 DPO ablation |
| 只在 object hallucination 有效 | 必须覆盖 attribute、relation、OCR、unanswerable 至少三类 |

## 9. 最建议你先做的版本

第一版不要太大，先做：

1. Benchmark：DASH-B、AMBER、MoHoBench、KIE-HVQA、FINER。
2. 模型：Qwen2.5-VL-7B、LLaVA-OneVision-7B、InternVL-8B/14B。
3. Baseline：Direct、CoT、Evidence-first、Abstention-aware、VCD。
4. Ours：Evidence-Gated Abstention。
5. 指标：FPR/TNR、Refusal Precision/Recall、Over-refusal、Hallucination Rate、Type-wise Error。

如果第一版结果显示 `Ours` 在 DASH-B 降 FPR、在 MoHo/KIE 提升合理拒答、在 FINER 提升细粒度负向查询准确率，这条线就值得继续扩成论文。

