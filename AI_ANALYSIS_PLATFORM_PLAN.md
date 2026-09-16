# 灵机阁 AI 分析平台实施方案

## 1. 目标与边界

将当前静态体验页升级为统一的分析平台。八字、紫微、奇门、择日共用同一套：

- 表单提交与任务状态；
- 后端鉴权、限流、模型调用；
- 分析结果 JSON 协议；
- 报告页渲染组件；
- 数据保存、历史记录与后续 PDF 导出能力。

第一阶段只上线 **八字命盘** 的真实链路。其余模块先复用页面与协议，待各自的确定性计算模块完成后接入。

> AI 只负责解释、组织报告和提出建议；八字、紫微、奇门、择日的排盘或历法规则必须由可验证的计算模块提供。

## 2. 推荐部署架构

```text
浏览器 / Cloudflare Pages
        │
        ├── 静态首页、表单页、报告页
        │
        ▼
Cloudflare Worker（API 层）
        ├── Turnstile 校验、限流、参数校验
        ├── 命理计算模块（结构化命盘）
        ├── 报告提示词组装与中转站模型调用
        └── 任务状态管理
        │
        ├── Cloudflare D1：任务与报告
        ├── Cloudflare R2：后续 PDF
        └── Cloudflare Queues / Workflows：长任务与 PDF（第二阶段）
```

建议前端和 API 使用同一主域名：

```text
https://lingji.example.com/                # Pages
https://lingji.example.com/api/...         # Worker 路由
```

同域部署可避免 CORS 配置。若 API 使用单独域名，则严格限制允许的前端域名。

## 3. 模块与统一任务协议

### 模块标识

| 模块 | `module` 值 | 第一版状态 |
| --- | --- | --- |
| 八字命盘 | `bazi` | 真实接入 |
| 紫微斗数 | `ziwei` | 协议预留 |
| 奇门遁甲 | `qimen` | 协议预留 |
| 择日 | `calendar` | 协议预留 |

### 创建分析任务

```http
POST /api/v1/analyses
Content-Type: application/json
```

统一请求体：

```json
{
  "module": "bazi",
  "input": {
    "name": "可选昵称",
    "gender": "female",
    "birthDateTime": "1998-08-10T09:30:00+08:00",
    "birthLocation": "上海市",
    "currentLocation": "杭州市",
    "focus": "career",
    "question": "今年是否适合转职？"
  },
  "consent": {
    "privacyAccepted": true,
    "allowStorageDays": 30
  },
  "turnstileToken": "客户端令牌"
}
```

即时返回：

```json
{
  "analysisId": "ana_01J...",
  "status": "queued",
  "pollUrl": "/api/v1/analyses/ana_01J..."
}
```

### 查询任务

```http
GET /api/v1/analyses/:analysisId
```

状态枚举：

```text
queued → calculating → generating → completed
                              └────→ failed
```

前端每 2 秒查询一次；完成后使用统一 `report` 字段渲染报告。后续可升级为 SSE 流式输出，无须更改报告数据结构。

## 4. 统一 AI 报告输出规范

模型必须只返回 JSON，禁止返回 Markdown、前后说明、代码块或额外字段。后端使用 JSON Schema 校验，不合格时进行一次“格式修复”重试。

```json
{
  "schemaVersion": "1.0",
  "module": "bazi",
  "title": "你的八字人生地图",
  "summary": {
    "headline": "一句话核心结论，20 字以内",
    "overview": "100—180 字的中立概览",
    "confidence": "guidance"
  },
  "chart": {
    "label": "命盘摘要",
    "items": [
      { "label": "日主", "value": "甲木", "note": "示例说明" },
      { "label": "五行倾向", "value": "木火偏旺", "note": "示例说明" }
    ]
  },
  "insights": [
    {
      "id": "personality",
      "icon": "✦",
      "title": "核心特质",
      "content": "80—160 字，基于命盘数据解释。",
      "evidence": ["命盘字段或规则依据 1", "命盘字段或规则依据 2"]
    },
    {
      "id": "career",
      "icon": "⌁",
      "title": "事业与行动",
      "content": "80—160 字。",
      "evidence": ["依据 1"]
    },
    {
      "id": "relationship",
      "icon": "◌",
      "title": "关系与协作",
      "content": "80—160 字。",
      "evidence": ["依据 1"]
    }
  ],
  "timeline": [
    {
      "period": "未来 3 个月",
      "theme": "准备与观察",
      "opportunity": "可把握的方向",
      "caution": "应避免的风险"
    },
    {
      "period": "未来 6—12 个月",
      "theme": "推进与选择",
      "opportunity": "可把握的方向",
      "caution": "应避免的风险"
    }
  ],
  "actions": [
    { "priority": 1, "action": "一条具体、可执行的建议", "when": "本周" },
    { "priority": 2, "action": "一条具体、可执行的建议", "when": "本月" },
    { "priority": 3, "action": "一条具体、可执行的建议", "when": "未来三个月" }
  ],
  "reflectionQuestions": [
    "用于自我反思的开放问题 1",
    "用于自我反思的开放问题 2"
  ],
  "disclaimer": "本报告用于文化、娱乐与自我反思，不构成医疗、法律、投资或其他专业建议。"
}
```

### 各模块如何复用

所有模块使用相同顶层字段；只有 `chart.items`、`insights` 的具体内容不同。

| 模块 | `chart.items` 建议字段 | `insights` 建议分区 |
| --- | --- | --- |
| 八字 | 四柱、日主、五行、十神、流年 | 特质、事业、关系、节奏 |
| 紫微 | 命宫、身宫、重点宫位、四化、周期 | 人格、事业、财富、关系 |
| 奇门 | 时间、用神、宫位、门星神、方向 | 判断、方向、时间、风险 |
| 择日 | 事件、推荐日期、时段、冲煞、地点 | 推荐、日期理由、准备、避开事项 |

## 5. 后端处理流程

### `POST /api/v1/analyses` 内部步骤

1. 校验请求体、模块字段和用户同意状态。
2. 校验 Turnstile；以 IP + 匿名会话 ID 进行限流。
3. 创建 D1 任务记录，状态为 `queued`。
4. 标准化出生地点、时区和日期格式。
5. 运行对应的确定性计算器，获得 `chartJson`。
6. 将 `chartJson`、用户问题、统一输出约束放入模型提示词。
7. 通过中转站调用大模型，要求 `application/json` 输出。
8. 校验并清理模型 JSON；写入 `reportJson`。
9. 更新任务为 `completed`，返回分析 ID。

### 推荐的 Worker 目录

```text
worker/
  src/
    index.ts                    # 路由入口
    routes/analyses.ts          # 创建、查询分析任务
    calculators/
      bazi.ts                   # 八字确定性计算
      ziwei.ts                  # 第二阶段
      qimen.ts                  # 第二阶段
      calendar.ts               # 第二阶段
    prompts/
      common.ts                 # 输出协议与安全边界
      bazi.ts                   # 八字解释提示词
    services/
      llm.ts                    # 调用中转站
      validation.ts             # Zod / JSON Schema 校验
      privacy.ts                # 脱敏、过期清理
  wrangler.toml
```

## 6. 模型调用契约

Worker 使用 Secret，不让浏览器看到模型密钥：

```text
AI_BASE_URL=https://你的中转站/v1
AI_API_KEY=仅保存于 Cloudflare Secret
AI_MODEL=中转站支持的模型名称
```

系统提示词必须包含：

```text
你是灵机阁的报告撰写助手。
只能依据提供的 chartJson 和用户问题进行解释，不能编造命盘字段。
必须输出符合 schemaVersion 1.0 的合法 JSON，禁止 Markdown 和代码块。
语气应温和、清晰、非决定论。
不得给出医疗诊断、投资指令、法律结论、绝对化预言或危害性建议。
所有结论应表述为“倾向”“可能”“建议观察”，而非确定事实。
```

用户提示词由后端组装：

```text
模块：bazi
用户关注：career
用户问题：今年是否适合转职？
确定性命盘数据：<chartJson>
请严格按统一 JSON 协议输出。
```

## 7. D1 数据表

```sql
CREATE TABLE analyses (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  chart_json TEXT,
  report_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  expires_at TEXT NOT NULL
);

CREATE INDEX analyses_status_created_idx
ON analyses(status, created_at);

CREATE INDEX analyses_expires_idx
ON analyses(expires_at);
```

建议：

- 默认只保留 30 天；
- 不记录模型密钥、完整请求日志或精确 IP；
- 日志只保留任务 ID、模块、耗时、状态和错误码；
- 提供“删除我的报告”接口：`DELETE /api/v1/analyses/:analysisId`。

## 8. 前端改造清单

1. 将 [bazi.html](bazi.html) 表单接入统一 API。
2. 新建 `report.html`：根据 `analysisId` 查询并渲染统一报告 JSON。
3. 增加生成中状态：步骤进度、错误重试、超时提示。
4. 将四个模块表单字段标准化为 `input` 对象。
5. 其余三个页面暂保留静态演示结果；计算器完成后只替换提交逻辑。

## 9. 分阶段实施

### 阶段 A：八字最小可用版本

- Cloudflare Pages 部署当前前端；
- Worker + D1 + Secret 配置；
- 八字计算器；
- `POST/GET /api/v1/analyses`；
- 大模型报告生成与统一 JSON 校验；
- `report.html` 结果页；
- Turnstile 与基础限流。

### 阶段 B：稳定性与产品化

- 分析历史、删除与过期清理；
- SSE 流式显示生成进度；
- PDF 导出并存入 R2；
- 模型失败重试、额度预警、可观测性；
- 中英文输出与版本化提示词。

### 阶段 C：扩展模块

- 紫微计算器；
- 奇门计算器；
- 择日历法与规则引擎；
- 模块专属图表，但保持统一报告顶层协议。

## 10. 验收标准

- 表单不会将模型 Key 暴露到浏览器；
- 所有报告均可被统一报告页渲染；
- 模型输出不合法 JSON 时用户看到可读错误，不会白屏；
- 没有确定性计算结果时，不调用模型生成具体命盘结论；
- 删除和过期机制可移除用户输入与报告；
- 单个分析请求可追踪任务状态、耗时和失败原因。

## 10.1 本地 Worker 启动与验证记录

当前八字计算 Worker 位于 [`worker/`](worker)，使用 Wrangler 在本机模拟 Cloudflare Workers Runtime。此流程仅监听 `127.0.0.1`，不会部署代码、绑定域名或调用线上模型。

首次安装依赖：

```powershell
cd E:\xuan\worker
npm install
```

启动本地 Worker：

```powershell
cd E:\xuan\worker
npx wrangler dev --port 8788
```

本地检查地址：

```text
GET  http://127.0.0.1:8788/api/health
POST http://127.0.0.1:8788/api/v1/analyses/preview
```

PowerShell 八字预览请求示例：

```powershell
$payload = @{
  module = 'bazi'
  input = @{
    birthDateTime = '1998-08-10T09:30:00+08:00'
    gender = 'female'
  }
} | ConvertTo-Json -Compress

Invoke-RestMethod http://127.0.0.1:8788/api/v1/analyses/preview `
  -Method Post `
  -ContentType 'application/json' `
  -Body $payload
```

本地质量检查：

```powershell
cd E:\xuan\worker
npm test
npm run typecheck
npx wrangler deploy --dry-run
```

停止方式：在启动 Worker 的终端按 `Ctrl+C`。若终端已关闭但端口仍被占用，可先确认端口对应进程后，只停止监听 `8788` 的进程；不要使用广泛的进程终止命令。

## 11. GitHub 参考项目清单

以下项目用于技术选型与资料审查。Star 数与开源许可证仅作为初步筛选信号，不等同于命理内容的学术或文化权威性；接入前必须复核版本、许可证全文、测试用例及计算结果。

| 方向 | 项目 | 地址 | 初步用途与判断 |
| --- | --- | --- | --- |
| 农历、节气、八字、黄历、择日基础 | `6tail/lunar-javascript` | <https://github.com/6tail/lunar-javascript> | MIT；优先评估。覆盖农历、干支、节气、八字、五行、十神、宜忌、冲煞等，可作为八字与择日的基础历法库。 |
| 农历与历法能力（现代替代项） | `6tail/tyme4ts` | <https://github.com/6tail/tyme4ts> | MIT；作为 `lunar-javascript` 的补充或后续替代项进行评估。 |
| 紫微斗数排盘 | `SylarLong/iztro` | <https://github.com/SylarLong/iztro> | MIT；优先评估。用于生成紫微斗数命盘、宫位和运限等结构化数据。 |
| 紫微斗数 React 可视化 | `SylarLong/react-iztro` | <https://github.com/SylarLong/react-iztro> | MIT；仅在前端迁移到 React 后考虑，用于命盘展示，不替代后端计算与校验。 |
| 奇门遁甲起盘 | `arc119226/qimen_dunjia` | <https://github.com/arc119226/qimen_dunjia> | MIT；社区体量较小，只作为研究起点。必须建立标准案例集，与可信排盘结果交叉验证后才能使用。 |
| 天文历算、农历、八字、紫微 | `RedSC1/js-ephemeris-lite` | <https://github.com/RedSC1/js-ephemeris-lite> | MPL-2.0；可作为真太阳时、天文历算和多模块计算方向的候选，需重点评估 MPL 的文件级开源义务。 |
| 八字 AI 知识整理 | `87529324wen-jpg/xuanxue-bazi` | <https://github.com/87529324wen-jpg/xuanxue-bazi> | MIT；可审阅其模块化组织方式与原典索引，不能未经内容、出处和版权核验直接导入 RAG。 |
| 八字 / 紫微 AI Skill 参考 | `ai-freer/fortune-skill` | <https://github.com/ai-freer/fortune-skill> | PolyForm Noncommercial；可参考提示词和流程设计，不能直接用于商业产品或复制其内容。 |
| 命理 AI Skill 与排盘整合 | `dzcmemory-web/bazi-ziwei-skills` | <https://github.com/dzcmemory-web/bazi-ziwei-skills> | MIT；可参考其排盘与报告生成的工程结构，仍需独立验证底层依赖与输出结论。 |

### 建议采用的初始组合

```text
八字 / 择日基础计算：lunar-javascript
紫微计算：iztro
奇门计算：单独选择候选库，并以测试案例验证
AI 解释知识：自建、经人工审核、带出处与版本号的知识库
```

### 引入前的审查清单

1. 锁定具体 commit 或发布版本，避免生产环境跟随仓库默认分支变化。
2. 阅读许可证全文，确认商用、修改、分发和署名义务。
3. 用已知出生信息、节气切换日、闰月、跨时区等边界案例验证排盘结果。
4. 对知识资料逐条保留来源、许可、审核人、审核日期与适用模块。
5. 不将未经核验的第三方“断语”直接作为模型事实；模型只能基于经批准的知识片段和确定性命盘数据生成解释。
