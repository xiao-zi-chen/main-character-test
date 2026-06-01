# 多模态大模型视觉幻觉 Benchmark 整理优化版

更新时间：2026-05-29  
用途：综述、开题、选题判断、实验 benchmark 组合设计

## 1. 先给结论

你原始表格的选题方向是对的，覆盖了 2025-2026 年视觉幻觉评测里最值得关注的几个新趋势：细粒度负向查询、反常识/微编辑、跨图/长推理/多轮、OCR 文档退化、拒答诚实性、误导性视觉输入。不过现在的表格还像“论文清单”，不够像“研究地图”。建议做以下整改：

1. 按“幻觉机制”重排，而不是按论文出现顺序排。
2. 给每篇论文补上“任务形式、数据构造、指标、可复现性、与已有工作的差异、可延展研究点”。
3. 把 benchmark、mitigation、factuality、robustness 分开标注，避免把所有东西都笼统叫“幻觉 benchmark”。
4. 对 2026 年未来会议条目保留精确状态。当前日期是 2026-05-29，CVPR 2026 正式会议时间 2026-06-03 至 2026-06-07，ICML 2026 正式会议时间 2026-07-06 至 2026-07-11，因此这些条目最好写成“已录用/官网或预印本可查，会议尚未召开”。
5. 如果你严格使用“近 9 个月”窗口，以 2026-05-29 往前推，窗口起点应是 2025-08-29。你原表里写的 2025-08-11 不一致；FIHA 是 2025-07，适合放在“背景/方法基线”，不适合放在严格近 9 个月主表。

最值得做研究的方向不是再做一个普通 object hallucination yes/no benchmark，而是做以下三类之一：

1. 细粒度负向查询 + 不可回答/拒答校准 + 视觉证据 grounding。
2. 多图/多轮/长推理中的 hallucination propagation，即错误如何被上下文历史和推理链放大。
3. OCR/文档/视频等真实场景中的不确定视觉证据，要求模型知道“看不清、证据不足、不能回答”。

## 2. 建议采用的新分类体系

| 一级类别 | 关注问题 | 典型任务 | 代表 benchmark |
| --- | --- | --- | --- |
| 物体存在性幻觉 | 模型是否把不存在的物体说成存在 | yes/no VQA、caption object matching | CHAIR、POPE、DASH、HALLUCINOGEN |
| 细粒度视觉事实幻觉 | 对属性、数量、空间关系、局部细节的错误确认 | fine-grained QA、counterfactual edit detection | FINER、FREAK、MED、FIHA、AMBER |
| 长描述/开放生成幻觉 | 长 caption 或开放回答中哪一段是错的 | span localization、claim verification、sentence-level judge | ViCrit、R2-HalBench、M-HalDetect、ARGUS |
| 推理链放大幻觉 | 推理越长越脱离图像，语言先验压过视觉证据 | controlled reasoning length、CoT/ToT 对比 | RH-Bench、HallusionBench |
| 多图/跨场景幻觉 | 两张或多张图共同推理时误报共性物体/关系 | common object、multi-image VQA | Common-O Bench |
| 多轮对话幻觉 | 前几轮错误如何污染后续视觉判断 | multi-turn dialogue、error propagation | [MMHalSnowball](https://aclanthology.org/2024.acl-long.648/) / MM-Snowball 类工作 |
| 不可回答与诚实性 | 图像信息不足时模型能否拒答 | unanswerable VQA、none-of-the-above | MoHoBench、HumbleBench、HaloQuest |
| 场景文字/OCR 幻觉 | 模型用语义先验补全看不清的文本 | scene text QA、KIE、degraded document QA | TextHalu-Bench、KIE-HVQA |
| 误导性/反常识视觉输入 | 模型面对错觉、遮挡、反常识图像是否稳健 | adversarial visual input、synthetic edit | MVI-Bench、FREAK、PhD、GHOST |
| 视频幻觉 | 时间、事件、动作、长视频聚合是否出错 | video QA、video captioning、temporal ordering | VideoHallucer、VidHalluc、ARGUS、ELV-Halluc |

## 3. 对你原始表格的逐条整改

| 原类别 | 推荐改名 | 优先级 | 整改意见 |
| --- | --- | --- | --- |
| 细粒度负向查询幻觉：FINER | 细粒度负向查询与 false-positive hallucination | P0 | 保留为核心主线。FINER 明确覆盖 multi-object、multi-attribute、multi-relation 和 what questions；亮点是“长且基本正确的查询里藏一个细微错误”。建议把它放在细粒度主线第一篇。来源：[FINER 项目页](https://explainableml.github.io/finer-project/) |
| 细粒度反常识视觉幻觉：FREAK | 反常识细节编辑下的细粒度感知幻觉 | P0 | 保留。FREAK 用 photorealistic counter-commonsense edits，比普通 yes/no object 检测更难；也适合研究 CoT 是否真的改善视觉感知。来源：[OpenReview](https://openreview.net/forum?id=YeagC09j2K) |
| 系统性物体幻觉挖掘：DASH | 开放世界系统性物体幻觉挖掘 | P0 | 保留。DASH 的价值不是单个 benchmark，而是自动发现真实图像中成簇的系统性 false-positive object hallucination。可作为“自动挖掘难例”的方法基线。来源：[CVF ICCV 2025](https://openaccess.thecvf.com/content/ICCV2025/html/Augustin_DASH_Detection_and_Assessment_of_Systematic_Hallucinations_of_VLMs_ICCV_2025_paper.html) |
| 长 caption 幻觉批判 / 可验证 RL：ViCrit | span-level caption hallucination critic | P0 | 保留。ViCrit 很适合引出“从回答正确率转向定位错误 span”的趋势，也能连接 RL 可验证奖励。来源：[NeurIPS 2025 poster](https://nips.cc/virtual/2025/poster/116500) |
| 可控微编辑 / 细粒度差异检测：Hallucination at a Glance | 控制微编辑与 visual difference detection | P0 | 保留。MED 的价值在于将属性、数量、位置、存在性改成可控视觉差异，适合训练和评测模型是否真的看见细节。来源：[NeurIPS 2025 proceedings](https://papers.nips.cc/paper_files/paper/2025/hash/c518f504ad5894ccb264a9890f0f5544-Abstract-Conference.html) |
| 自动化细粒度幻觉评测：FIHA | scene graph 自动生成细粒度正负 QA | P1 | 保留为背景/方法基线，但如果按当前日期 2026-05-29 的近 9 个月窗口，它早于 2025-08-29。它适合说明“用 scene graph 自动造 object/attribute/relation QA”的前置路线。来源：[ACL Anthology](https://aclanthology.org/2025.findings-acl.622/) |
| 多图 / 跨场景推理幻觉：Common-O | 多图跨场景共同物体推理幻觉 | P0 | 保留。Common-O 是很好的新切口，因为单图 benchmark 已逐渐饱和，多图共同推理更能暴露 co-occurrence prior。来源：[OpenReview](https://openreview.net/forum?id=d0F0N0cu4n) |
| 长推理放大幻觉：RH-Bench | reasoning-length induced hallucination | P0 | 保留。建议把它放入“推理链放大幻觉”而不是普通 benchmark。它的关键是 RH-AUC：看视觉 grounding 是否随推理长度下降。来源：[OpenReview](https://openreview.net/forum?id=KzU33wR875) |
| 场景文字语义幻觉：TextHalu-Bench | scene text semantic hallucination | P1/P0 | 如果你做 OCR/文档方向，升为 P0；如果做通用图像幻觉，作为专项补充。亮点是“语义上合理但视觉上错误”的文本补全。来源：[OpenReview](https://openreview.net/forum?id=BbWrp6O8Lm) |
| 退化文档 OCR 幻觉：KIE-HVQA | degraded document OCR uncertainty hallucination | P0 | 很值得保留。它直接把 hallucination 与 visual uncertainty/refusal 连接起来，研究价值高。来源：[OpenReview](https://openreview.net/forum?id=bjoHB7IN6b) |
| 多模态事实性 / 图像事实问答：SimpleVQA | 多模态 factuality，不是严格视觉幻觉 | P1 | 建议不要放在 hallucination 主表核心区。它更偏 factuality / knowledge-grounded VQA，可以放“相关评测”。来源：[CVF ICCV 2025](https://openaccess.thecvf.com/content/ICCV2025/html/Cheng_SimpleVQA_Multimodal_Factuality_Evaluation_for_Multimodal_Large_Language_Models_ICCV_2025_paper.html) |
| 富上下文长描述幻觉检测：R2-HalBench | rich-context hallucination detection with backward grounding | P0 | 保留。它和 ViCrit、M-HalDetect 同属“长描述/开放生成检查器”路线，但 R2-HalBench 强调 backward visual grounding 和 mask-level evidence。来源：[AAAI 2026](https://ojs.aaai.org/index.php/AAAI/article/view/40345) |
| 不可回答视觉问题 / 诚实性：MoHoBench | visually unanswerable QA and honesty alignment | P0 | 保留并提高重要性。它是研究“模型应该拒答而不是猜”的关键基准。来源：[AAAI 2026](https://ojs.aaai.org/index.php/AAAI/article/view/40159) |
| 误导性视觉输入鲁棒性：MVI-Bench | misleading visual input robustness | P0 | 保留。arXiv v3 已更新到 2026-05-27，内容很新，适合写“视觉输入本身具有误导性”的路线。ICML 2026 录用状态建议以官方 poster/accepted listing 为准再写死。来源：[arXiv 2511.14159](https://arxiv.org/abs/2511.14159) |
| 多轮对话幻觉滚雪球：MM-Snowball | multi-turn hallucination snowballing | P0，但需核验 | 这个方向非常值得做，但你给的 ICML 2026 poster 页面目前不易公开检索；公开文献里更稳定能查到的是 [MMHalSnowball](https://aclanthology.org/2024.acl-long.648/) / multimodal hallucination snowballing 一类工作。建议暂时写成“MM-Snowball（待核验官网/PDF）”，不要把 CAVR 等细节写死，除非你已下载到论文。 |

## 4. 补充必须读的经典与近两年论文

### 4.1 基础评测与早期基准

| 论文 / Benchmark | 时间 | 重点 | 为什么要读 |
| --- | --- | --- | --- |
| [Object Hallucination in Image Captioning](https://arxiv.org/abs/1809.02156) / CHAIR | EMNLP 2018 | image captioning 中的 object hallucination 与 CHAIR 指标 | 视觉幻觉最早的量化框架之一，写综述必须提 |
| [Evaluating Object Hallucination in Large Vision-Language Models](https://arxiv.org/abs/2305.10355) / POPE | EMNLP 2023 | polling-based object hallucination evaluation | MLLM 幻觉评测最常用 baseline 之一 |
| [Detecting and Preventing Hallucinations in LVLMs](https://arxiv.org/abs/2308.06394) / M-HalDetect | AAAI 2024 | 16k 细粒度 hallucination detection annotations | 从 object 走向 entity/attribute/relation 级别 |
| [Aligning Large Multimodal Models with Factually Augmented RLHF](https://aclanthology.org/2024.findings-acl.775/) / MMHal-Bench | ACL Findings 2024 | 96 image-question pairs，GPT-4/human judge | 连接 evaluation 与 RLHF alignment |
| [AMBER](https://arxiv.org/abs/2311.07397) | 2023/2024 | LLM-free，多维度存在/属性/关系幻觉评测 | 低成本自动化评测代表 |
| [HallusionBench](https://arxiv.org/abs/2310.14566) | CVPR 2024 | visual illusion 与 language hallucination 纠缠 | 反常识/视觉错觉方向的前置工作 |
| [HaloQuest](https://arxiv.org/abs/2407.15680) | ECCV 2024 | false premises、insufficient contexts、visual challenges | 与不可回答、合成图、reasoning hallucination 有关 |

### 4.2 2025-2026 细粒度与反常识方向

| 论文 / Benchmark | 时间 | 重点 | 可用作什么 |
| --- | --- | --- | --- |
| [FINER](https://explainableml.github.io/finer-project/) | CVPR 2026 Oral | 细粒度负向查询，multi-object/attribute/relation/what | 主 benchmark、DPO 训练对照 |
| [FREAK](https://openreview.net/forum?id=YeagC09j2K) | ICLR 2026 Poster | photorealistic counter-commonsense edits | 反常识视觉细节感知 |
| [DASH](https://openaccess.thecvf.com/content/ICCV2025/html/Augustin_DASH_Detection_and_Assessment_of_Systematic_Hallucinations_of_VLMs_ICCV_2025_paper.html) | ICCV 2025 | 自动挖掘开放世界 systematic object hallucination | 难例挖掘方法 |
| [Hallucination at a Glance / MED](https://papers.nips.cc/paper_files/paper/2025/hash/c518f504ad5894ccb264a9890f0f5544-Abstract-Conference.html) | NeurIPS 2025 | 控制微编辑，50k+ image-text pairs | 微小视觉变化检测 |
| [PhD](https://openaccess.thecvf.com/content/CVPR2025/html/Liu_PhD_A_ChatGPT-Prompted_Visual_Hallucination_Evaluation_Dataset_CVPR_2025_paper.html) | CVPR 2025 | 102k VQA triplets，日常图 + 反常识图 + context modes | 大规模 objective VHE |
| [HALLUCINOGEN](https://arxiv.org/abs/2412.20622) | 2024/2025 | contextual reasoning prompts as hallucination attacks | 攻击式评测 |
| [GHOST](https://arxiv.org/abs/2509.25178) | 2025/2026 | 生成能诱发 hallucination 的自然图像 | 模型特异性 stress-test |
| [MVI-Bench](https://arxiv.org/abs/2511.14159) | 2025/2026 | misleading visual inputs，concept/attribute/relationship | 鲁棒性与误导性视觉输入 |

### 4.3 长描述、span-level critic 与 grounding

| 论文 / Benchmark | 时间 | 重点 | 可用作什么 |
| --- | --- | --- | --- |
| [ViCrit](https://nips.cc/virtual/2025/poster/116500) | NeurIPS 2025 | 定位长 caption 中被注入的错误 span | 可验证 RL reward、critic model |
| [R2-HalBench / VBackChecker](https://ojs.aaai.org/index.php/AAAI/article/view/40345) | AAAI 2026 | backward visual grounding，object/attribute/relation hallucination | reference-free checker |
| [FIHA](https://aclanthology.org/2025.findings-acl.622/) | ACL Findings 2025 | Davidson Scene Graph 自动生成正负 QA | 自动化 benchmark 生成 |
| M-HalDetect | AAAI 2024 | detailed VQA responses 的细粒度 hallucination annotations | 训练 hallucination detector |
| DOCCI-Critique / VNLI-Critique | 2025 | paragraph captions 的 sentence-level factual annotations | 长 caption 检查路线 |

### 4.4 推理、多图、多轮与拒答诚实性

| 论文 / Benchmark | 时间 | 重点 | 可用作什么 |
| --- | --- | --- | --- |
| [Common-O Bench](https://openreview.net/forum?id=d0F0N0cu4n) | NeurIPS 2025 Datasets & Benchmarks | 两张图共同物体推理 | 多图 hallucination |
| [RH-Bench](https://openreview.net/forum?id=KzU33wR875) | NeurIPS 2025 | 推理链变长时视觉 grounding 下降 | reasoning hallucination |
| [MoHoBench](https://ojs.aaai.org/index.php/AAAI/article/view/40159) | AAAI 2026 | 12k+ visually unanswerable questions | refusal / honesty alignment |
| [HumbleBench](https://arxiv.org/abs/2509.09658) | 2025 | none-of-the-above，object/relation/attribute | epistemic humility |
| HaloQuest | ECCV 2024 | false premise 与 insufficient context | 合成/真实图不可回答 |
| [MMHalSnowball](https://aclanthology.org/2024.acl-long.648/) / MM-Snowball 类工作 | 2024-2026 | 初始错误在多轮对话中滚雪球 | 多轮 hallucination propagation |

### 4.5 OCR、文档、场景文字

| 论文 / Benchmark | 时间 | 重点 | 可用作什么 |
| --- | --- | --- | --- |
| [TextHalu-Bench](https://openreview.net/forum?id=BbWrp6O8Lm) | NeurIPS 2025 | scene text 中语义合理但视觉错误的文本幻觉 | scene text spotting/understanding |
| [KIE-HVQA](https://openreview.net/forum?id=bjoHB7IN6b) | NeurIPS 2025 | 模糊、遮挡、低对比文档 OCR 幻觉 | visual uncertainty + refusal |
| SimpleVQA | ICCV 2025 | 图像 + 外部/常识知识 factuality | factuality 相关，不是纯视觉幻觉 |

### 4.6 视频幻觉方向

如果你的“大多模态”包括视频，这一块很值得补，因为 2025-2026 的趋势很明显：从静态图像 object hallucination 转向 temporal grounding、event aggregation 和 freeform video captioning。

| 论文 / Benchmark | 时间 | 重点 | 可用作什么 |
| --- | --- | --- | --- |
| [VideoHallucer](https://videohallucer.github.io/) | 2024 | intrinsic/extrinsic hallucination，object-relation、temporal、semantic detail | 视频 hallucination 基础 benchmark |
| [VidHalluc](https://arxiv.org/abs/2412.03735) | CVPR 2025 | action、temporal sequence、scene transition hallucination | temporal hallucination |
| [ARGUS](https://openaccess.thecvf.com/content/ICCV2025/html/Rawal_ARGUS_Hallucination_and_Omission_Evaluation_in_Video-LLMs_ICCV_2025_paper.html) | ICCV 2025 | freeform video captioning 中 hallucination 和 omission 双指标 | 开放生成视频评测 |
| [ELV-Halluc](https://elv-halluc.github.io/) | 2025 | long-video semantic aggregation hallucination | 长视频事件聚合 |
| EventHallusion | 2024 | event hallucination in VideoLLMs | 事件级视频幻觉 |

## 5. 推荐把综述写成这条主线

### 5.1 从粗粒度到细粒度

早期评测主要看“有没有把不存在的物体说出来”，例如 CHAIR、POPE、MMHal-Bench。问题是这类 benchmark 容易被强模型刷高，也不能覆盖属性、关系、局部文本、视觉不确定性等真实错误。

2025-2026 的新趋势是细粒度化：FINER、FREAK、MED、FIHA、DASH 都在强调 object 之外的属性、关系、数量、位置、反常识细节和开放世界难例。这说明你的综述主题可以定为：

> Multimodal hallucination evaluation is moving from coarse object existence checks to fine-grained, context-sensitive, and evidence-aware reliability testing.

### 5.2 从单图识别到复杂上下文

Common-O、RH-Bench、MoHoBench、MM-Snowball 类工作说明：幻觉不是只发生在“看图说物体”里，而是在多图比较、长推理、多轮历史和不可回答问题中被放大。这个转变非常适合做研究，因为实际产品不会只问一个短 yes/no 问题。

### 5.3 从“答错”到“不会拒答”

MoHoBench、HumbleBench、KIE-HVQA、HaloQuest 都指向同一个核心问题：模型的失败不只是给错答案，而是无法判断证据不足。这个方向很值得做，因为它同时连接 hallucination、uncertainty calibration、safety alignment 和 visual grounding。

### 5.4 从静态图像到视频和文档

视频方向的 ARGUS、VidHalluc、ELV-Halluc 和 OCR 方向的 TextHalu/KIE-HVQA 表明，新的可靠性问题越来越依赖任务域：时间顺序、场景切换、文档退化、文字可见性。这些都比普通 COCO object hallucination 更有新意。

## 6. 最推荐的研究选题

### 题目建议

**Evidence-Aware Fine-Grained Abstention Benchmark for Multimodal Hallucination**

中文可以写作：

**面向细粒度视觉证据不足场景的多模态幻觉与拒答校准评测**

### 核心思想

把 FINER 的“细粒度负向查询”、MoHoBench/HumbleBench 的“不可回答/拒答”、R2-HalBench/ViCrit 的“证据定位”合在一起，做一个更接近真实可靠性的 benchmark：

模型不仅要判断一个视觉陈述是否正确，还要判断：

1. 图像中是否有足够证据回答；
2. 如果陈述错误，错误在 object、attribute、relation、count、OCR 还是 spatial detail；
3. 如果证据不足，是否能拒答而不是编造；
4. 如果回答了，是否能给出图像中的 grounding evidence。

### 和已有工作的差异

| 已有工作 | 它解决什么 | 你的可创新点 |
| --- | --- | --- |
| FINER | 查询里有细粒度错误，模型应拒绝 false query | 增加“不可判定/证据不足”而不是只有 yes/no 或多选 |
| MoHoBench | 图像问题不可回答时是否诚实 | 增加细粒度类型和 grounding evidence |
| HumbleBench | none-of-the-above 选项测试 epistemic humility | 从多选扩展到开放回答和证据定位 |
| KIE-HVQA | 退化文档 OCR 不确定性 | 扩展到通用图像 object/attribute/relation/OCR 混合场景 |
| R2-HalBench | 生成描述的 hallucination detection | 从检测回答转向“问答前的证据可判定性” |

### 数据设计

建议每个样本包含：

| 字段 | 内容 |
| --- | --- |
| image | 真实图像、编辑图像或退化图像 |
| query | 细粒度视觉陈述或问题 |
| answerability | answerable / unanswerable / ambiguous |
| truth_label | true / false / insufficient_evidence |
| hallucination_type | object / attribute / relation / count / position / OCR / scene-text / temporal |
| evidence | box、mask、OCR region、caption span 或 scene graph node |
| hard_negative_source | edit、distractor object、language prior、semantic prior、degradation、multi-turn history |
| expected_behavior | answer / correct / refuse / ask for clarification |

### 指标建议

| 指标 | 含义 |
| --- | --- |
| False Positive Hallucination Rate | 不存在/错误细节被模型确认的比例 |
| Abstention Precision | 模型拒答时，有多少确实证据不足 |
| Abstention Recall | 证据不足问题中模型能拒答的比例 |
| Over-refusal Rate | 明明可回答却拒答的比例 |
| Evidence Grounding Accuracy | 回答或拒答是否能对应正确视觉证据区域 |
| Type-wise Error Rate | object/attribute/relation/OCR 等分类型错误率 |
| Calibration ECE | 置信度与正确率是否匹配 |
| Dialogue Propagation Rate | 如果扩展到多轮，前轮错误在后轮被继承/放大的比例 |

### 实验模型建议

开放模型：

| 模型 | 作用 |
| --- | --- |
| Qwen2.5-VL / Qwen3-VL 系列 | 中文和 OCR 能力强，适合主力 |
| InternVL 系列 | 通用视觉能力强，FINER 也使用过 |
| LLaVA-OneVision | 开源基线常用 |
| MiniCPM-V | 轻量、中文友好 |
| Phi-4-multimodal / Phi 系列 | 适合中小模型对比 |

闭源模型：

| 模型 | 作用 |
| --- | --- |
| GPT-4o / GPT-4.1 / GPT-4.1-mini | 强基线和 judge |
| Gemini 2.x | 多图/视频/OCR 强基线 |
| Claude 3.5/3.7 Sonnet | 长文本和拒答行为对比 |

### 训练或缓解方法

1. SFT：用正样本、负样本、不可回答样本混合训练。
2. DPO：构造 chosen/rejected responses，chosen 强调 grounded answer 或正确 refusal。
3. GRPO/RL：奖励由 answer correctness、refusal correctness、evidence grounding 三部分组成。
4. Test-time self-check：先做 visual evidence retrieval，再回答。
5. Counterfactual data augmentation：参考 FINER、MED、GHOST、MVI 的思路造 hard negatives。

### 最小可发表版本

如果资源有限，可以做一个小而强的版本：

1. 选 2k-5k 高质量样本，不追求 10 万规模。
2. 每个样本都有人工核验的 answerability 和 evidence。
3. 覆盖 object、attribute、relation、OCR 四类。
4. 评测 8-12 个主流 MLLM。
5. 做一个轻量 mitigation：prompting + DPO 或 evidence-aware decoding。

这个版本比“再做一个大规模自动 yes/no benchmark”更有新意，也更容易讲清楚贡献。

## 7. 不建议继续做的方向

1. 不建议只做普通 object existence yes/no benchmark。POPE、DASH、AMBER、HALLUCINOGEN 已经很多，除非你有全新的自动挖掘机制。
2. 不建议只用 LLM-as-a-judge 且没有人工校准。现在 reviewer 会质疑 judge bias 和 circular evaluation。
3. 不建议只做英文通用图像。中文、多语言、OCR、文档、医学、遥感、视频都有更强应用价值。
4. 不建议只做 synthetic counterfactual images。如果没有人工过滤和真实图像迁移实验，容易被认为分布不自然。
5. 不建议只报告 overall accuracy。必须有 type-wise、answerability、refusal、grounding 或 calibration 指标。

## 8. 你原表可以改成的最终主表

| 主线 | Benchmark | 时间/状态 | 任务形式 | 主要幻觉类型 | 研究价值 |
| --- | --- | --- | --- | --- | --- |
| 细粒度负向查询 | FINER | CVPR 2026 Oral；会议 2026-06-03 至 2026-06-07 | multiple-choice / fine-grained negative queries | object、attribute、relation、what | 当前最核心的细粒度 false-positive benchmark |
| 反常识细节 | FREAK | ICLR 2026 Poster；OpenReview 2026-01-26 发布 | counter-commonsense edited images + QA | detection、counting、attribute、position、OCR | 检查强模型是否真的感知局部细节 |
| 开放世界系统性错误 | DASH | ICCV 2025 | automatic mining + benchmark | systematic object hallucination | 适合做难例挖掘和模型脆弱性分析 |
| 长 caption critic | ViCrit | NeurIPS 2025 | corrupted span localization | object、attribute、count、spatial relation | 可验证 RL 和 hallucination critic |
| 微编辑差异检测 | MED | NeurIPS 2025 | image pair / edit detection | attribute、count、position、existence | 控制变量强，适合训练与诊断 |
| 自动生成细粒度 QA | FIHA | ACL Findings 2025；严格近 9 个月外 | DSG-based QA generation | object、attribute、relation | 方法基线，不建议作为最新主打 |
| 跨场景推理 | Common-O | NeurIPS 2025 D&B | two-image common object reasoning | object hallucination | 多图推理新切口 |
| 推理链放大 | RH-Bench | NeurIPS 2025 | controlled reasoning length | grounding drift | 适合研究 CoT/long reasoning 副作用 |
| 场景文字 | TextHalu-Bench | NeurIPS 2025 | scene text QA | semantic text hallucination | OCR/scene text 专项 |
| 退化文档 OCR | KIE-HVQA | NeurIPS 2025 | degraded document QA | OCR hallucination、uncertainty | 很适合做拒答/不确定性 |
| 多模态 factuality | SimpleVQA | ICCV 2025 | bilingual short-answer VQA | factuality error | 放相关工作，不放核心 hallucination |
| 富上下文检测 | R2-HalBench | AAAI 2026；论文集 2026-03-14 | rich-context description checking | object、attribute、relation | 适合 grounding checker |
| 不可回答视觉问题 | MoHoBench | AAAI 2026；论文集 2026-03-14 | unanswerable visual QA | over-answering / dishonest answer | 诚实性与拒答核心基准 |
| 误导性视觉输入 | MVI-Bench | arXiv 2025-11-18，v3 2026-05-27；ICML 状态需最终核验 | misleading visual input QA | concept、attribute、relationship | 鲁棒性新方向 |
| 多轮滚雪球 | MM-Snowball / MMHalSnowball | 需核验具体 ICML 2026 页面和 PDF | multi-turn dialogue | propagation hallucination | 方向很强，但条目细节需二次确认 |

## 9. 推荐阅读顺序

第一周：建立基础  
CHAIR、POPE、MMHal-Bench、AMBER、HallusionBench、M-HalDetect。

第二周：进入 2025-2026 细粒度主线  
FINER、FREAK、MED、DASH、FIHA、PhD、HALLUCINOGEN。

第三周：复杂上下文和拒答  
Common-O、RH-Bench、MoHoBench、HumbleBench、HaloQuest、ViCrit、R2-HalBench。

第四周：专项方向  
如果做 OCR/文档，读 TextHalu-Bench、KIE-HVQA、SimpleVQA。  
如果做视频，读 VideoHallucer、VidHalluc、ARGUS、ELV-Halluc。  
如果做鲁棒性和攻击，读 MVI-Bench、GHOST、PhD-ccs、FREAK。

## 10. 可以直接写进开题的研究问题

1. 现有细粒度 hallucination benchmark 多数只区分 true/false，缺少对“视觉证据是否足够”的建模。
2. 当前拒答 benchmark 多聚焦 unanswerable QA，但较少细分 object、attribute、relation、OCR 等不同视觉证据类型。
3. 长推理和多轮对话会放大幻觉，但现有评测很少同时标注错误来源、传播路径和视觉证据。
4. 场景文字、退化文档和长视频中的幻觉更接近真实应用，但与通用图像 hallucination 之间缺少统一指标。
5. 纯 accuracy 不能衡量可靠性，应该同时评估 correct answer、correct refusal、over-refusal、evidence grounding 和 calibration。

## 11. 一句话版本

如果只保留一个最有潜力的方向，我建议做：

> 面向细粒度负向查询和不可回答视觉问题的 evidence-aware hallucination benchmark，要求 MLLM 同时做到看清细节、拒绝错误前提、承认证据不足，并给出可定位的视觉证据。

这个方向能自然连接 FINER、MoHoBench、HumbleBench、KIE-HVQA、R2-HalBench、ViCrit，而且比普通 object hallucination benchmark 更容易形成新贡献。
