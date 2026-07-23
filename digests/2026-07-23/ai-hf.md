# Hugging Face 热门模型日报 2026-07-23

> 数据来源: [Hugging Face Hub](https://huggingface.co/) | 共 30 个模型 | 生成时间: 2026-07-23 13:37 UTC

---

好的，作为AI模型生态分析师，以下是为您生成的《Hugging Face 热门模型日报》。

---

### **Hugging Face 热门模型日报 | 2026-07-23**

#### **今日速览**

本周 Hugging Face 生态呈现多极化爆发态势。**百度**的 OCR 模型 `Unlimited-OCR` 以压倒性的下载量领跑，展示了实用型多模态模型的巨大需求。**MoE（混合专家）** 架构成为绝对主流，`zai-org/GLM-5.2` 和基于 Qwen3.6 的多个衍生模型包揽了热度前列。同时，**极端量化（1-bit、2-bit）** 和 **未审查（Uncensored）** 社区版本持续活跃，`prism-ml` 和 `DavidAU` 等团队贡献了大量高下载量模型。此外，**谷歌**的 `gemma-4-31B-it` 凭借强大的基础能力获得了极高的关注。

#### **热门模型**

##### 🧠 语言模型（LLM、对话模型、指令微调）

| 模型 | 作者 | 点赞 | 下载 | 简要说明 |
| :--- | :--- | ---: | ---: | :--- |
| [zai-org/GLM-5.2](https://huggingface.co/zai-org/GLM-5.2) | zai-org | 4,354 | 596,442 | 本周关注度最高的基础模型之一，采用了 MoE-DSA 架构，在对话和文本生成任务上表现亮眼。 |
| [google/gemma-4-31B-it](https://huggingface.co/google/gemma-4-31B-it) | google | 3,341 | 12,666,488 | 谷歌开源的 Gemma 4 系列指令微调版本，拥有庞大的用户基础，是当前最受欢迎的主流大模型之一。 |
| [upstage/Solar-Open2-250B](https://huggingface.co/upstage/Solar-Open2-250B) | upstage | 387 | 362 | 参数规模达 250B 的巨型开源模型，代表了开源社区在超大模型领域的探索。 |

##### 🎨 多模态与生成（图像、视频、音频、文本到X）

| 模型 | 作者 | 点赞 | 下载 | 简要说明 |
| :--- | :--- | ---: | ---: | :--- |
| [baidu/Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) | baidu | 2,823 | 2,414,259 | 百度的通用 OCR 模型，下载量惊人，证明了其在图像文字识别场景中的强大实用价值。 |
| [HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive](https://huggingface.co/HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive) | HauhauCS | 3,020 | 2,027,080 | 基于 Qwen3.6 的 MoE 视觉语言模型，具有“未审查”和“激进”特性，社区关注度极高。 |
| [empero-ai/Qwythos-9B-Claude-Mythos-5-1M-GGUF](https://huggingface.co/empero-ai/Qwythos-9B-Claude-Mythos-5-1M-GGUF) | empero-ai | 2,430 | 2,126,755 | 一款强调推理能力的多模态 GGUF 模型，结合了 Qwen3.5 与 Mythos 数据集，下载量巨大。 |
| [OpenMOSS-Team/MOSS-Transcribe-Diarize](https://huggingface.co/OpenMOSS-Team/MOSS-Transcribe-Diarize) | OpenMOSS-Team | 317 | 111,598 | 专注于音频文字转录与说话人分离（Diarization）的专用模型，填补了音频任务的热门需求。 |
| [nvidia/Cosmos3-Edge](https://huggingface.co/nvidia/Cosmos3-Edge) | nvidia | 93 | 28,493 | 英伟达推出的 Cosmos 系列边缘端模型，专注于轻量级图像生成。 |

##### 🔧 专用模型（代码、数学、医疗、嵌入）

| 模型 | 作者 | 点赞 | 下载 | 简要说明 |
| :--- | :--- | ---: | ---: | :--- |
| [moonshotai/Kimi-K2.7-Code](https://huggingface.co/moonshotai/Kimi-K2.7-Code) | moonshotai | 1,237 | 766,522 | 月之暗面推出的代码专用模型，采用压缩张量技术，在代码生成领域表现突出。 |
| [nvidia/nemotron-3.5-asr-streaming-0.6b](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b) | nvidia | 923 | 750,118 | 英伟达流式语音识别模型，参数仅 0.6B，适合实时语音转写场景。 |
| [nvidia/Cosmos3-Edge](https://huggingface.co/nvidia/Cosmos3-Edge) | nvidia | 93 | 28,493 | 属于文本到图像（text-to-image）的专用模型，采用 Diffusers 框架。 |

##### 📦 微调与量化（社区微调、GGUF、AWQ）

| 模型 | 作者 | 点赞 | 下载 | 简要说明 |
| :--- | :--- | ---: | ---: | :--- |
| [prism-ml/Ternary-Bonsai-27B-gguf](https://huggingface.co/prism-ml/Ternary-Bonsai-27B-gguf) | prism-ml | 967 | 576,083 | 采用极端的“三进制（2-bit）”量化技术，在极低比特下实现了 27B 模型的运行，引发了社区对量化极限的讨论。 |
| [prism-ml/Bonsai-27B-gguf](https://huggingface.co/prism-ml/Bonsai-27B-gguf) | prism-ml | 610 | 1,910,116 | 采用 1-bit 量化的 Bonsai 模型，下载量巨大，体现了社区对极致轻量化模型的热衷。 |
| [DavidAU/Qwen3.6-27B-Fable-Fusion-711...](https://huggingface.co/DavidAU/Qwen3.6-27B-Fable-Fusion-711-Uncensored-Heretic-NM-DAU-NEO-MAX-MTP-GGUF) | DavidAU | 370 | 334,847 | 社区微调模型的典型代表，对 Qwen3.6 进行了大量自定义微调，主打“未审查”风格。 |
| [thinkingmachines/Inkling](https://huggingface.co/thinkingmachines/Inkling) | thinkingmachines | 1,486 | 24,669 | 一个全新的多模态对话模型，上线首周即获得高赞，展示了社区对新架构的渴望。 |
| [conradlocke/krea2-identity-edit](https://huggingface.co/conradlocke/krea2-identity-edit) | conradlocke | 510 | 0 | 基于 Krea-2 的身份编辑 LoRA，虽然下载量为 0，但点赞数高，说明其在图像编辑细分领域具备潜在影响力。 |

#### **生态信号**

本周生态呈现三个显著信号：**第一，MoE 与 Qwen 家族统治力极强**。从原始模型（如 GLM-5.2）到大量社区微调版（如 Qwen3.6 系列），MoE 架构已成为主流，且 Qwen 系列成为了最受欢迎的基座。**第二，量化技术走向极端**。1-bit 和 2-bit 的 `Bonsai` 模型系列获得了海量下载，表明社区对个人设备上运行大模型的渴望促使量化技术不断突破极限。**第三，“Uncensored” 文化持续发酵**。多个高赞的 GGUF 模型都明确标注了 “Uncensored”（未审查）或类似标签，反映了开源社区对高自由度内容生成的追求，但也值得关注其潜在的合规风险。

#### **值得探索**

1.  **[zai-org/GLM-5.2](https://huggingface.co/zai-org/GLM-5.2)**：作为本周热度最高的基础模型，建议深入评估其 MoE-DSA 架构的实际性能表现，它可能代表了下一代高效 MoE 的方向。
2.  **[prism-ml/Ternary-Bonsai-27B-gguf](https://huggingface.co/prism-ml/Ternary-Bonsai-27B-gguf)**：这是一个极具实验性质的模型，探索了 27B 模型在极端 2-bit 量化下的效果。对于关注模型压缩和边缘计算的开发者来说，是必须研究的对象。
3.  **[moonshotai/Kimi-K2.7-Code](https://huggingface.co/moonshotai/Kimi-K2.7-Code)**：作为国内头部大模型公司开源的代码专用模型，其采用“压缩张量”技术，在效率和能力之间取得了平衡，值得开发者测试其在代码生成任务上的实际表现。

---
*本日报由 [agents-radar](https://github.com/zhoukeke99/agents-radar) 自动生成。*