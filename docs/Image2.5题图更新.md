# Image 2.5 题图与选择反馈

2026-10-20，40 道题的 320 张题图已全部重新生成并替换为 1536×1024 写实照片。每题仍为题干场景、左右选项和五档反应，题目编号、A/B 顺序及计分不变。

- 主站：https://xiao-zi-chen.github.io/main-character-test/
- 全题图预览：https://xiao-zi-chen.github.io/main-character-test/question-art-review.html

左右选项图片下方恢复完整选项文字。点击端点、五档标签或松开滑杆后，短暂放大展示对应的 `scale-0` 至 `scale-4` 图片；图片加载后约 1.8 秒收起，支持关闭按钮和 Escape。预览不抢夺键盘焦点，也不自动提交或跳到下一题。拖动中的临时值不触发预览；取消拖动保留原答案。当前题图仍可手动放大。

生成使用用户指定的 ChatAnywhere API，经 imagegen 技能自带 CLI 调用 `gpt-image-2.5-flare`，`quality=medium`，每张独立请求。三个密钥及两个 Host 均通过鉴权，三个密钥均实际完成生成。密钥只供本地进程使用，未放入前端或仓库。

首轮 320 张全部生成成功，另进行了 34 次针对性补画，最终替换 28 张。逐题检查全部八张图片的选项方向、具体动作、场景关联和明显干扰物，并用本地 RapidOCR 扫描全部最终图片；检测出的背景招牌和钟面数字已重画，其余识别框经查看为窗框、建筑、植物、手部等误识别。视觉检查和 OCR 不能保证发现每个极小的偶然痕迹。

同题使用一致的人物描述和服装，通过动作、视线、参与程度以及道具区分五档。独立文生图仍可能导致人物长相、配角和布景细节变化，未声称严格的人物身份锁定。

## 文件与复查

- `public/question-art/`：网站使用的 320 张 WebP 和校验清单。
- `content/question-art-image25-prompts.json`、`content/question-art-production.json`：最终实际请求的完整提示词。
- `content/question-art-image25-refinements.json`：28 张图片的修正原因和动作。
- `content/question-art-image25-review.json`：逐题视觉复查记录和原图哈希。
- `output/imagegen/chatanywhere-image25/`：本机 PNG 原图、对照图、文字扫描和费用记录；该目录不提交到 GitHub。

清单里的 `promptIdType=local-job-id` 明确表示本地任务编号，不冒充供应商请求 ID；供应商 ID 未由技能 CLI 保存，记为 null。随机种子未传入 API，记为 null。每张图保存来源哈希、提示词哈希和最终 WebP 哈希。

`prepare_chatanywhere_art.py` 生成三个不含密钥的 CLI 批次，跳过已经存在的完整原图；`review_image25_art.py` 制作八图对照页；`install_image25_art.py` 在全量图片与复查哈希匹配后备份旧素材并安装。`npm run media:questions` 检查全量图片与提示词、尺寸、哈希、题目顺序；`npm test`、相关 Playwright 场景及构建产物校验用于发布验证。
