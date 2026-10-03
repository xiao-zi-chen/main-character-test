# 主角请就位

40 道日常情境题，解锁属于你的短剧主角人生。完整提供网站源码、二十种角色的影片与画像、题库、原生对白脚本和部署工具。

**作者：陈嘉恒、卜俊程、李家兴、肖宇诚。**

![首页预览](docs/assets/home-preview.jpg)

## 使用

需要 Node.js 22.12 或更新版本，推荐 Node.js 24。
当前目录是 NBTI 的可编辑 React 前端；采集接口和 MySQL 由上一级 NBTI 项目提供。
先启动后端，再启动前端开发页面：

```bash
# 在 NBTI 根目录
npm ci
npm run local:start
cd main-character-test
npm ci
npm run dev
```

打开终端显示的本地地址。Windows 也可以在后端已启动后双击 `启动网站.cmd`。
开发服务和构建预览会把 `/api/` 与 `/public-config.js` 请求代理到 `127.0.0.1:3000`。
后端未启动时，可以预览页面，选择记录会留在浏览器队列中，无法写入数据库。

## 功能

- 18 个常规角色、2 个隐藏角色；新角色带有 15 秒原生对白短片。
- 四十道题分四幕呈现，每题使用 15 档量表（0～14，7 为中立），支持返回修改、自动保存和继续答题。
- 人物档案、倾向雷达图、对白脚本、声音开关与独立视频下载。
- 900×1920 角色卡导出，完整保留竖版人物画像，含作者署名。
- 桌面和手机布局、键盘操作、减少动态效果支持。
- 彩蛋入口、隐藏结果解锁、持久记录及重置；详见 [第二季说明](docs/第二季与隐藏角色.md)。
- 同一浏览器使用同一匿名编号，点击下一题/最终揭晓时记录量表值与本题用时；支持离线暂存和恢复同步。

这是一款剧情娱乐测试，不是心理诊断或标准 MBTI 量表。答题进度和解锁状态保存在当前浏览器；选择和用时通过 NBTI 接口匿名保存到 MySQL，用于研究数据收集。

## 部署

原静态发布 ZIP 在 [Releases](https://github.com/xiao-zi-chen/main-character-test/releases/latest) 下载，包含完整影片和图片，可用于页面及媒体预览。当前数据收集版需要 NBTI 的 Node.js 服务和 MySQL，单独上传静态文件不会使采集队列入库。

在本源码目录检查并构建页面：

```bash
npm ci
npm test
npm run build
npm run preview
```

构建目录为 `dist/`。修改源码后，在 NBTI 根目录执行统一重建命令：

```bash
cd ..
npm run frontend:build
```

该命令运行 `scripts/build-frontend.mjs`，构建源码的 `dist/`，同步根目录的 `index.html`、`assets/`、`collector.js`、`favicon.svg` 和最终显示题库，并将旧产物备份到 `.local/frontend-backups/`。之后使用 NBTI 根目录服务提供页面和采集接口；云端发布步骤见根目录 `CLOUD_DEPLOY.txt`。

采集脚本在 `public/collector.js` 维护。`public-config.js` 的正式响应由根 Node.js 服务按运行环境生成，静态占位仅使用本地媒体回退，不包含数据库或 COS 凭据。网站采用 Hash 路由，无需设置页面路由重写。

仓库原有的 GitHub Pages 工作流仍用于静态页面预览：在 **Settings → Pages** 中选择 **GitHub Actions**，然后在 **Actions → Deploy GitHub Pages** 手动运行。纯静态托管不提供当前数据收集版的入库接口。

## 开发与验证

```bash
# 在 main-character-test/ 内
npm test             # 计分、角色可达性、隐藏条件与存储容错
npm run build        # 生产构建

# 在 NBTI 根目录
npm run test:frontend # 真实构建产物：桌面/iPhone 16 套件，使用隔离数据库
npm run test:e2e      # 采集、COS 媒体配置与安全全链路验证
```

浏览器测试使用 Microsoft Edge。`test:frontend` 针对真实构建产物验证页面流程，测试记录写入隔离数据库；根目录 `test:e2e` 运行前需按根部署说明启动项目。前端开发和构建只需要 Node.js，真实采集还需要根 Node.js 接口及 MySQL；Python、Pillow、FFmpeg 只用于重新导入题库、处理媒体或原有打包工具。

## 项目文件

| 路径 | 内容 |
| --- | --- |
| `src/` | 页面、计分、隐藏规则、题目文案、角色卡及场景效果 |
| `public/collector.js` | 匿名选择与用时采集、浏览器队列及同步逻辑 |
| `public/public-config.js` | 静态媒体配置占位；正式运行由根 Node.js 服务生成响应 |
| `public/media/` | 二十条影片、人物画像、封面、头像、字幕及原声音轨 |
| `public/worlds/` | 世界场景插画 |
| `tests/` | 单元与浏览器检查 |
| `scripts/` | 题库导入、媒体检查、画面导出与打包工具 |
| `content/season2/` | 第二季十个人设与完整原生对白 Prompt |
| `docs/` | 计分说明、部署说明、隐藏规则与素材校验记录 |

Word 和 Excel 原题保留在根目录。`src/data/question-copy.js` 对二十二道题的显示文案作了优化，保留题号、A/B 顺序与计分方向。
量表左右端点对应原 A/B 两种行为，数值按原方向归一化；角色原型、权重、排序与隐藏阈值保持原样。
调整量表仅暂存草稿，不触发采集；最后一题确认后才能查看个人结果。返回改题并进入下一题时追加一次确认，导出取每题最后确认值。
新版本清理旧 A/B 浏览器进度和上传队列。旧数据库由管理员执行根目录迁移脚本删除答卷并更换字段，详情见根目录 `DATABASE.txt`。

媒体已完整放入仓库，克隆后按上述步骤安装依赖并启动即可使用。大于 GitHub 单文件限制的部署 ZIP 作为 Release 附件提供。

根目录 `scripts/instrument-bundle.mjs` 保留为历史静态产物注入工具；当前源码构建已直接包含采集挂钩，不再使用该脚本。
