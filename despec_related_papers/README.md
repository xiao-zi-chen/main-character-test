# DeSpec 相近幻觉论文整理

更新时间：2026-05-29

这个文件夹收集的是和 `DeSpec / right-specific answer / unsupported specificity` 最接近的一批多模态幻觉论文 PDF。

| 文件 | 论文 | 来源 | 和 DeSpec 的关系 |
| --- | --- | --- | --- |
| `01_HalCECE_Conceptual_Counterfactuals_Image_Captioning.pdf` | HalCECE: A Framework for Explainable Hallucination Detection through Conceptual Counterfactuals in Image Captioning | https://arxiv.org/abs/2503.00436 | 最危险近邻；caption 场景中已有 hierarchical edits、too generic / erroneously specific 等概念 |
| `02_Woodpecker_Hallucination_Correction_MLLMs.pdf` | Woodpecker: Hallucination Correction for Multimodal Large Language Models | https://arxiv.org/abs/2310.16045 | 做 hallucination correction，但不是回答粒度控制 |
| `03_FaithScore_Fine_grained_Evaluation_Hallucinations_LVLMs.pdf` | FaithScore: Fine-grained Evaluations of Hallucinations in Large Vision-Language Models | https://arxiv.org/abs/2311.01477 | atomic fact / claim 级幻觉评测，可作为 DeSpec verifier/metric 近邻 |
| `04_M-HalDetect_Detecting_Preventing_Hallucinations_LVLMs.pdf` | Detecting and Preventing Hallucinations in Large Vision Language Models | https://arxiv.org/abs/2308.06394 | 细粒度 hallucination detection + preference optimization，但不是 right-specific preference |
| `05_VBackChecker_R2-HalBench_Backward_Visual_Grounding.pdf` | Seeing Is Believing: Rich-Context Hallucination Detection for MLLMs via Backward Visual Grounding | https://arxiv.org/abs/2511.12140 | backward visual grounding 检测 object/attribute/relation 幻觉；不是把错误细节降级成可支持答案 |
| `06_ViCrit_Verifiable_RL_Proxy_Task_Visual_Perception.pdf` | ViCrit: A Verifiable Reinforcement Learning Proxy Task for Visual Perception in VLMs | https://arxiv.org/abs/2506.10128 | 找 long caption 中的 corrupted span；不是生成 right-specific answer |
| `07_KIE-HVQA_OCR_Hallucinations_MLLMs.pdf` | Seeing is Believing? Mitigating OCR Hallucinations in Multimodal Large Language Models | https://openreview.net/forum?id=bjoHB7IN6b | OCR 看不清时拒答，和 DeSpec 的 OCR 过度具体化场景很近 |

重点阅读顺序：

1. `01_HalCECE`：先看，判断 DeSpec 是否会撞。
2. `05_VBackChecker_R2-HalBench`、`06_ViCrit`：看细粒度/长描述幻觉检测和定位。
3. `02_Woodpecker`、`04_M-HalDetect`：看 correction 和 DPO 类思路。
4. `07_KIE-HVQA`：看 OCR hallucination 和拒答场景。
5. `03_FaithScore`：看 atomic fact 级评测。

