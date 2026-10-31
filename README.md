# 看见你自己 · black-mirror 分支

此分支同步自 personality-test-clean，包含黑洞封面、20 题随机答题、十五档量表、4 秒揭幕动画、黑屏人格卡片、笑脸 GIF、文艺版两段文字、人格解析和匿名采集。

## 启动

需要 Node.js 22.12 或更新版本。在本目录打开终端：

```bash
npm ci
npm run dev
```

打开终端显示的本地网址。开发服务会将 API 请求转发至本地 3000 端口的后端。

要部署到 NBTI 本地正式服务，在上一级 NBTI 目录运行：

```powershell
node scripts/build-frontend.mjs --skip-media-hashes
powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

访问 http://127.0.0.1:3000/。已有后端运行时，应先执行 `scripts/stop-local.ps1 -AppOnly`，再启动以重新加载静态资源白名单。现有数据库和答卷保留。

## 构建与检查

```bash
npm test
npm run build
npm run preview
```

`dist/` 内是已经构建好的当前页面。通过本地 HTTP 服务或静态托管访问；不要直接双击 `dist/index.html`。

桌面与手机交互检查使用 Microsoft Edge：

```bash
npm run test:e2e
```

## 保留的文件

- 当前页面及其所需源码、样式、题库、量表和存储逻辑。
- 40 道题使用的 320 张答题图片及图片清单。
- 黑洞封面、笑脸 GIF、图标和采集脚本。
- 构建配置、依赖锁文件、答题进度/反应文案单元测试和当前交互的浏览器测试。

历史角色/视频源码、素材与工具保留在仓库中；本分支入口及 dist 发布产物只包含当前人格测试需要的内容。浏览器测试默认运行本分支的 mirror-flow 用例；旧角色、视频和分享页面用例保留作历史参考。

## 后端接口

本目录只包含前端，数据库及后端服务在上一级 NBTI 目录。开发/预览服务默认把 `/api/` 和 `/public-config.js` 转发到 `http://127.0.0.1:3000`。

真实收集需要接通 `/api/collect`，人数展示需要 `/api/participation`。接口不可用时，采集记录暂存在浏览器等待重试，首页隐藏人数。浏览器测试会模拟这些接口，不写入真实数据库。
