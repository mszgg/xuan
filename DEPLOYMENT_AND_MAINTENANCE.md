# 灵机阁：发布与维护手册

本项目由两个独立的 Cloudflare Worker 组成：一个托管 `site/` 中的静态网页，另一个处理 `worker/` 中的排盘和 AI 解读。发布时两者都要考虑，但它们的更新频率不同。

## 本地目录约定

```text
E:\xuan\site\             静态网页源码；页面、样式、脚本和 assets 都只在这里修改
E:\xuan\worker\           API Worker 源码、依赖、测试与本地 .dev.vars
E:\xuan\research\         上游资料与研究文件，不参与网站静态发布包
E:\xuan\scripts\          维护辅助脚本
```

网页改动只应提交到 `site/`。图片也应保存在 `site/assets/`，CSS 使用普通相对路径（例如 `url("assets/hero-celestial.webp")`）；不要将图片 Base64 内嵌到 CSS。日常发布通过 Wrangler 直接部署整个 `site/` 目录。

## 当前线上架构

| 组件 | 当前地址 | 责任 |
| --- | --- | --- |
| 静态网站 | `https://young-bonus-6df5.827793958.workers.dev` | 首页、八字表单、结果展示和静态资源 |
| API Worker | `https://lingji-analysis-api.827793958.workers.dev` | 排盘、CORS、知识片段选择、调用 AI 网关 |

八字页面中的 `data-api-base` 已指向 API Worker，因此静态网站不保存 AI Key。调用链为：

```text
用户浏览器 → 静态站点 bazi.html → lingji-analysis-api → AI 网关 → 返回解读
```

## 敏感配置

以下配置必须保存在 Cloudflare Worker Secret 中，绝不可写进 HTML、JavaScript、`wrangler.toml` 或提交到版本库：

| Secret | 用途 |
| --- | --- |
| `AI_API_KEY` | AI 网关的认证密钥 |
| `AI_BASE_URL` | OpenAI 兼容网关地址，通常以 `/v1` 结尾 |
| `AI_MODEL` | 解读使用的模型名称 |
| `ALLOWED_ORIGIN` | 允许调用 API 的静态站点来源，不带末尾 `/` |

当前 `ALLOWED_ORIGIN` 应设为：

```text
https://young-bonus-6df5.827793958.workers.dev
```

更新任意 Secret：

```powershell
cd E:\xuan\worker
npx wrangler secret put AI_API_KEY
```

将命令最后的变量名替换为目标 Secret。命令提示输入时粘贴值并回车；Secret 更新后无需将值记录到文档中。

## 首次发布流程

### 1. 登录 Cloudflare

```powershell
cd E:\xuan\worker
npx wrangler login
```

浏览器会打开授权页。确认后回到终端继续。

### 2. 设置 API Worker Secret

本地开发使用 `worker/.dev.vars`；生产环境必须分别设置以下 Secret：

```powershell
npx wrangler secret put AI_API_KEY
npx wrangler secret put AI_BASE_URL
npx wrangler secret put AI_MODEL
npx wrangler secret put ALLOWED_ORIGIN
```

`ALLOWED_ORIGIN` 的值必须是静态网站的完整 Origin，例如 `https://young-bonus-6df5.827793958.workers.dev`，没有结尾斜杠。

### 3. 发布 API Worker

先执行本地校验：

```powershell
npm test
npm run typecheck
```

再部署：

```powershell
npm run deploy
```

部署完成后检查：

```text
https://lingji-analysis-api.827793958.workers.dev/api/health
```

预期结果：

```json
{"ok":true}
```

### 4. 发布静态网站

静态网站使用 `worker/wrangler.site.toml` 配置，名称为 `young-bonus-6df5`。该配置只上传 `../site` 的全部内容（包括 `assets/`），不会更改 API Worker。

```powershell
cd E:\xuan\worker
npm run deploy:site
```

首次执行会使用已有的 Wrangler 登录状态；若尚未登录，先运行 `npx wrangler login`。完成后打开：

```text
https://young-bonus-6df5.827793958.workers.dev
https://young-bonus-6df5.827793958.workers.dev/assets/hero-celestial.webp
```

第二个地址应直接显示图片。Wrangler 是图片、字体等二进制静态资源的正式发布方式；不要再使用 Dashboard 中只支持 HTML/CSS/JS 的“Upload static files”上传器。

## 日常维护流程

### 只修改 AI / API 代码

例如修改 `worker/src`、知识片段、接口参数或 CORS：

```powershell
cd E:\xuan\worker
npm test
npm run typecheck
npm run deploy
```

随后测试健康检查和八字提交。静态网站不需要重新上传，除非接口路径或前端展示契约发生变化。

### 只修改网页样式或交互

例如修改 `site/` 中的 `bazi.html`、`tool.js`、CSS 或图片：

1. 确认 `bazi.html` 的 `data-api-base` 仍是 API Worker 地址。
2. 执行 `cd E:\xuan\worker` 后运行 `npm run deploy:site`。
3. 打开首页、图片地址和 `/bazi.html` 实测表单提交。

### 同时修改前后端

按此顺序降低兼容风险：

1. 先部署向后兼容的 API Worker。
2. 使用 PowerShell 或浏览器测试新接口。
3. 运行 `npm run deploy:site` 发布静态网站。
4. 用线上静态网站测试完整链路。

## 上线后验证清单

1. `GET /api/health` 返回 `{"ok":true}`。
2. 打开静态站点首页无 404，图片和样式正常。
3. 打开 `/bazi.html`，输入有效出生时间与性别。
4. 提交后页面出现年柱、月柱、日柱、时柱和 AI 文本。
5. 浏览器开发者工具的 Network 中，`/api/v1/analyses/interpret` 不出现 CORS 错误。
6. AI Key 不出现在网页源码、浏览器 Network 请求正文或控制台。

## 常见故障

| 现象 | 优先检查 |
| --- | --- |
| 网页可以打开，但提交后提示网络错误 | `bazi.html` 的 `data-api-base` 是否为 API Worker 地址；`ALLOWED_ORIGIN` 是否为当前静态站点 Origin |
| API 返回 `503 ai_not_configured` | 重新设置 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL` Secret |
| API 返回 `502 ai_provider_error` | 检查 AI 网关地址、模型名、密钥权限和网关服务状态 |
| 浏览器报 CORS 错误 | `ALLOWED_ORIGIN` 不应带末尾 `/`，并应与浏览器地址栏中的协议、域名完全一致 |
| 首页图片 404 或无法显示 | 确认图片位于 `site/assets/`，CSS 路径为 `assets/文件名`，然后执行 `npm run deploy:site`；不要使用 Dashboard 静态上传器 |
| 页面仍显示旧内容 | 确认 `npm run deploy:site` 成功完成，刷新时使用 Ctrl+F5 或无痕窗口 |
| `**标题**` 显示为星号 | 当前前端安全地以纯文本渲染 AI Markdown；这是显示优化项，不影响接口或结果 |

## 回滚

Cloudflare Dashboard 的 Worker 部署历史中可以选择前一个版本并回滚。发生问题时：

1. 先回滚 API Worker 或静态部署到上一个正常版本。
2. 再检查 Secret 是否被误改；Secret 不会随代码回滚自动恢复。
3. 用健康检查和八字表单各测试一次后再恢复流量。

不要通过删除 Worker、删除域名或删除 Secret 来处理普通发布故障；优先使用版本回滚。
