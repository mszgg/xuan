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

## 本地排盘依赖与奇门口径

排盘不是由大模型生成。API Worker 先在本地计算结构化结果，再仅将结果和用户问题发送到 AI 网关生成文字解读。

| 模块 | 本地依赖 | 说明 |
| --- | --- | --- |
| 八字、择日 | `lunar-javascript@1.7.7` | 四柱/历法与黄历候选日计算 |
| 紫微斗数 | `iztro@2.6.1` | 十二宫、星曜命盘计算 |
| 奇门遁甲 | `3meta@2.6.0` | 时家转盘九宫、局数、门星神、值符值使与格局摘要 |

`3meta` 是本地 MIT 依赖，不调用 3meta 官方 API，也不需要密钥或额外按次费用。当前奇门接口返回 `qimen-hour-chart-1`，采用以下固定口径：

- 时家转盘奇门、拆补法；
- `Asia/Shanghai` 墙上时间；
- 暂不做真太阳时、经度或历史夏令时校正；
- AI 只解释 Worker 返回的完整九宫盘，不负责起盘。

### 奇门回归验证

`worker/test/qimen.test.ts` 固定了 8 组公开交叉验证样例，覆盖不同年份、阴阳遁与节气时段。其局数和三元已与 3meta 在线盘及 Mingpan 公共排盘结果逐项比对后记录。每次修改奇门逻辑或升级 `3meta` 前后必须执行：

```powershell
cd E:\xuan\worker
npm test -- qimen.test.ts
```

若任何样例变化，不应直接更新测试期望值；先重新与独立公开参考盘交叉核对，并记录采用的时间、时区与起局口径。

## 敏感配置

以下配置必须保存在 Cloudflare Worker Secret 中，绝不可写进 HTML、JavaScript、`wrangler.toml` 或提交到版本库：

| Secret | 用途 |
| --- | --- |
| `AI_API_KEY` | AI 网关的认证密钥 |
| `AI_BASE_URL` | OpenAI 兼容网关地址，通常以 `/v1` 结尾 |
| `AI_MODEL` | 解读使用的模型名称 |
| `ALLOWED_ORIGIN` | 允许调用 API 的静态站点来源，不带末尾 `/` |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile 的 Secret Key，仅 API Worker 使用 |

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

### 启用人机验证与滥用防护

网站的 AI 解读接口必须由 Turnstile 保护。先在 Cloudflare Dashboard 的 **Turnstile** 创建一个 Managed widget，将当前静态站点域名加入 Hostnames。

#### Key 的职责与存放位置

| 值 | 是否公开 | 存放位置 | 用途 |
| --- | --- | --- | --- |
| Turnstile Site Key | 是 | 静态站 Worker `young-bonus-6df5` 的 `TURNSTILE_SITE_KEY` 绑定 | 标识 widget；静态 Worker 将它注入网页 HTML，浏览器据此加载 Turnstile。 |
| Turnstile Secret Key | 否 | API Worker `lingji-analysis-api` 的 `TURNSTILE_SECRET_KEY` Secret | API Worker 调用 Cloudflare `siteverify` 验证 token。绝不能传给浏览器、写入静态站或提交 Git。 |

Site Key 被浏览器看到是正常且必要的；它本身不能验证 token 或调用 AI。只有 Secret Key 才能完成服务器端验证。

#### 用 Wrangler 保存 Key

在 `E:\xuan\worker` 执行以下命令。每条命令会提示粘贴对应的值，输入不会写入仓库或终端命令历史：

```powershell
# API Worker：粘贴 Turnstile 的 Secret Key（必须保密）
npx wrangler secret put TURNSTILE_SECRET_KEY

# 静态站 Worker：粘贴 Turnstile 的 Site Key（公开值）
npx wrangler secret put TURNSTILE_SITE_KEY --config wrangler.site.toml
```

也可在 Cloudflare Dashboard → Worker → Settings → Variables 中设置同名绑定。`TURNSTILE_SITE_KEY` 可以是普通变量或 Secret；本项目使用 Secret 绑定统一通过 Wrangler 管理，但它仍会被注入最终 HTML。不要误把 Secret Key 填到 `TURNSTILE_SITE_KEY`。

#### 完整请求流程

```text
1. 用户打开工具页面。
2. 静态站 Worker 将 TURNSTILE_SITE_KEY 注入 HTML；浏览器加载 Cloudflare Turnstile widget。
3. Turnstile 完成必要挑战后，在浏览器中签发短时有效的 token。
4. 浏览器提交业务参数和 turnstileToken 到 API Worker 的 /api/v1/analyses/interpret。
5. API Worker 先限制请求体大小，并向 Durable Object 按 CF-Connecting-IP 检查限流。
6. 未超限时，API Worker 使用仅自己持有的 TURNSTILE_SECRET_KEY 调用 Cloudflare siteverify。
7. siteverify 成功，API Worker 才调用 AI 网关；失败、过期或缺失 token 则返回 403，不消耗 AI 额度。
8. 超出限流则直接返回 429 和 Retry-After，不调用 Turnstile 或 AI 网关。
```

这不是 Cloudflare WAF 在 Worker 之前的自动拦截：请求仍会到达 API Worker，但在 token 校验和限流通过前绝不会请求 AI 网关。

#### 限流规则

API Worker 使用 Durable Object 对每个 `CF-Connecting-IP` 独立计数：

| 接口 | 限制 | 超限响应 |
| --- | --- | --- |
| `/api/v1/analyses/preview` | 每 IP 每分钟 30 次 | HTTP 429 |
| `/api/v1/analyses/interpret` | 每 IP 每 10 分钟 8 次 | HTTP 429 + `Retry-After` |

限流阈值定义于 `worker/src/index.ts` 的 `RATE_LIMITS`。Turnstile 会提高机器人自动化成本，但不能替代限流或全站预算控制；若 AI 费用需要严格上限，应额外实现每小时/每天的全站调用额度。

#### 发布顺序

先保存两个 Key，再依次部署 API Worker 和静态站 Worker。API 会拒绝没有有效 Turnstile token 的解读请求。

静态站 Worker 会发送 CSP、禁止框架嵌入、禁止 MIME 嗅探等安全响应头。若新增第三方脚本、字体或 API 域名，必须先相应更新 `worker/src/static-site.ts` 的 CSP，否则浏览器会主动阻止它。

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

若改动 `worker/src/calculators`、升级 `lunar-javascript`、`iztro` 或 `3meta`，除上述命令外，还要分别提交对应模块的预览请求；奇门必须通过“奇门回归验证”。

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
| 奇门结果与外部参考盘不一致 | 先确认输入时间、`Asia/Shanghai` 时区、时家转盘与拆补法口径一致；再运行 `npm test -- qimen.test.ts`，不要直接修改回归样例 |
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
