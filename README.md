# 主角请就位

40 道日常情境题，解锁属于你的短剧主角人生。完整提供网站源码、二十种角色的影片与画像、题库、原生对白脚本和部署工具。

**作者：陈嘉恒、卜俊程、李家兴、肖宇诚。**

![首页预览](docs/assets/home-preview.jpg)

## 使用

需要 Node.js 22.12 或更新版本，推荐 Node.js 24。

```bash
npm ci
npm run dev
```

打开终端显示的本地地址。Windows 也可以双击 `启动网站.cmd`。

## 功能

- 18 个常规角色、2 个隐藏角色；新角色带有 15 秒原生对白短片。
- 四十道题分四幕呈现，支持返回修改、自动保存和继续答题。
- 人物档案、倾向雷达图、对白脚本、声音开关与独立视频下载。
- 900×1920 角色卡导出，完整保留竖版人物画像，含作者署名。
- 桌面和手机布局、键盘操作、减少动态效果支持。
- 彩蛋入口、隐藏结果解锁、持久记录及重置；详见 [第二季说明](docs/第二季与隐藏角色.md)。

这是一款剧情娱乐测试，不是心理诊断或标准 MBTI 量表。回答和解锁状态只保存在访客自己的浏览器中。

## 部署

现成部署 ZIP 在 [Releases](https://github.com/xiao-zi-chen/main-character-test/releases/latest) 下载，已包含完整影片和图片。解压后把全部内容上传到静态网站托管平台，让 `index.html` 位于发布根目录即可。

也可以自行构建：

```bash
npm run build
npm run preview
```

发布目录为 `dist/`。项目使用 Hash 路由与相对资源路径，支持根目录和子目录部署，不需要后端或数据库。

仓库还提供手动触发的 GitHub Pages 工作流：在仓库 **Settings → Pages** 中选择 **GitHub Actions**，然后在 **Actions → Deploy GitHub Pages** 运行工作流。这个工作流不会仅因推送代码而自动上线。

## 开发与验证

```bash
npm test             # 计分、角色可达性、隐藏条件与存储容错
npm run build        # 生产构建
npm run test:e2e     # 桌面/手机完整流程、视频与二十种角色卡
```

浏览器测试使用 Microsoft Edge。常规运行和构建只需要 Node.js；Python、Pillow、FFmpeg 只用于重新导入题库、处理媒体或打包。

## 项目文件

| 路径 | 内容 |
| --- | --- |
| `src/` | 页面、计分、隐藏规则、题目文案、角色卡及场景效果 |
| `public/media/` | 二十条影片、人物画像、封面、头像、字幕及原声音轨 |
| `public/worlds/` | 世界场景插画 |
| `tests/` | 单元与浏览器检查 |
| `scripts/` | 题库导入、媒体检查、画面导出与打包工具 |
| `content/season2/` | 第二季十个人设与完整原生对白 Prompt |
| `docs/` | 计分说明、部署说明、隐藏规则与素材校验记录 |

Word 和 Excel 原题保留在根目录。`src/data/question-copy.js` 对二十二道题的显示文案作了优化，保留题号、A/B 顺序与计分方向。

媒体已完整放入仓库，克隆后即可运行。大于 GitHub 单文件限制的部署 ZIP 作为 Release 附件提供。
