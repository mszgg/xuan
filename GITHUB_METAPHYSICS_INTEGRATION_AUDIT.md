# 命理开源组件接入审查

审查日期：2026-09-15
范围：`6tail/lunar-javascript`、`SylarLong/iztro`、`87529324wen-jpg/xuanxue-bazi`。本文件评估的是工程可接入性，而非命理结论的文化或学术正确性。

## 结论总览

| 项目 | 结论 | 适用位置 | 是否可直接作为生产依赖 |
| --- | --- | --- | --- |
| [lunar-javascript](https://github.com/6tail/lunar-javascript) | **MVP 条件接入** | 八字、农历、节气、黄历与择日的确定性基础计算 | 可以；锁定版本、补充回归测试并先统一历法口径 |
| [iztro](https://github.com/SylarLong/iztro) | **第二阶段条件接入** | 紫微斗数命盘和运限的确定性计算 | 可以；先完成 Cloudflare Worker 打包 PoC 与标准盘验证 |
| [xuanxue-bazi](https://github.com/87529324wen-jpg/xuanxue-bazi) | **仅人工资料参考** | 原典索引、报告结构、术语候选 | 不可以；不得整体部署、整体 RAG 或使用其 Python 引擎排盘 |

推荐的生产组合是：`lunar-javascript` 负责八字/择日基础计算，`iztro` 负责紫微计算，LLM 只解释经过适配的 `chartJson`。任何知识文字都应来自自建、逐条审核的知识库。

## 统一接入原则

1. **先计算、后解释。** 命盘、节气、干支、宫位和运限由确定性库生成；模型不能自行推算或补造字段。
2. **隔离第三方 API。** 每个库只通过后端 adapter 调用，业务层永远读取本项目的 `chartJson`，不直接依赖第三方对象结构。
3. **锁定供应链。** 使用精确 npm 版本和 lockfile；上线前记录对应 Git commit、许可证副本、审查日期和升级责任人。
4. **把流派选择当作产品配置。** 立春换年、节气边界、子初换日、真太阳时、紫微流派等均需固定，并显示在报告的计算说明中。
5. **不把出生信息交给浏览器或第三方托管 AI。** 浏览器仅发送表单到我们的 Worker；第三方库在 Worker 内运行；中转站只得到最小化、可脱敏的 `chartJson` 与问题。

---

## 一、`6tail/lunar-javascript`

仓库：[github.com/6tail/lunar-javascript](https://github.com/6tail/lunar-javascript)
审阅版本：npm `1.7.7`（接入时应再次复核并精确锁定）
许可证：MIT
运行时依赖：无第三方运行时依赖

### API 能力

该库是八字 MVP 最合适的计算底座，覆盖公历/农历转换、干支、节气、黄历、宜忌、冲煞，以及八字相关的五行、十神、大运、流年和流月等。

核心调用链示例：

```ts
import { Solar } from 'lunar-javascript';

const solar = Solar.fromYmdHms(1998, 8, 10, 9, 30, 0);
const lunar = solar.getLunar();
const eightChar = lunar.getEightChar();

// 产品必须固定该配置的含义，并写入 calculationPolicy
eightChar.setSect(2);

const chart = {
  solar: solar.toYmdHms(),
  lunar: lunar.toString(),
  pillars: {
    year: eightChar.getYear(),
    month: eightChar.getMonth(),
    day: eightChar.getDay(),
    time: eightChar.getTime()
  },
  dayMaster: eightChar.getDayGan(),
  hiddenStems: eightChar.getDayHideGan(),
  fortuneCycles: eightChar.getYun(0).getDaYun()
};
```

仓库测试已覆盖的能力信号包括：`Solar.fromYmdHms(...).getLunar().getEightChar()`、四柱、藏干、十神、纳音、命宫/身宫、大运、流年与流月；也包含立春、节气临界，以及通过 `eightChar.setSect(1)` 处理 23 点日柱边界的测试。还提供 `Solar.fromBaZi(...)` 由四柱反推候选公历时间的能力。

### 测试覆盖审查

- 有 Jest 测试，仓库中约有 24 个测试相关条目，覆盖 `Lunar`、`JieQi`、`LunarYear`、`EightChar` 等关键域。
- `package.json` 将 `jest` 作为测试命令；开发依赖为 Jest `^26.6.3`。
- 未见 GitHub Actions 自动化工作流信号。因此，不能把“仓库有测试”理解为每次发布都经过云端持续验证。
- 未取得可审计的 coverage 百分比；不要在选型材料中宣称具体覆盖率。

结论：**领域边界测试较有价值，但仍必须建立我们自己的黄金案例。** 特别是节气前后、闰月、午夜、时区、历史日期与升级前后差异。

### 许可证与供应链

MIT 允许商用、修改、分发和私有部署；分发其代码或 substantial portions 时必须保留 copyright 与许可声明。建议在仓库保存 `THIRD_PARTY_NOTICES.md`，记录包名、版本、仓库 URL、MIT 文本和升级日期。

主要技术风险不是许可证，而是计算口径：

- 年柱采用农历新年还是立春切换；
- 子时是否在 23:00 换日（`setSect` 相关）；
- 用户输入的本地时间如何映射到出生地时区；
- 真太阳时是否启用、经度来源与误差如何标示。

这些不是库能替产品决定的。首期建议只接受带 UTC offset 的出生时间，采用北京时间/出生地标准时，不启用真太阳时；界面明确说明。真太阳时作为后续带地点经纬度和可复现算法的独立能力。

### 放入 Cloudflare Worker 的具体方式

安装时锁定精确版本：

```bash
npm install --save-exact lunar-javascript@1.7.7
```

建立一个很薄的 adapter，禁止路由层直接调用第三方包：

```ts
// worker/src/calculators/bazi.ts
import { Solar } from 'lunar-javascript';

export const BAZI_POLICY = {
  version: 'bazi-policy-1',
  timezone: 'Asia/Shanghai',
  yearBoundary: 'lichun',
  dayBoundary: 'documented-sect-value',
  trueSolarTime: false
} as const;

export function calculateBazi(input: { birthAt: string; gender: 'male' | 'female' }) {
  // 此处先将 ISO 时间按 BAZI_POLICY 标准化，再拆成年月日时分秒。
  // 不要将 Date 的服务器时区行为直接作为命理规则。
  const parts = normalizeBirthAt(input.birthAt, BAZI_POLICY.timezone);
  const lunar = Solar.fromYmdHms(...parts).getLunar();
  const eightChar = lunar.getEightChar();
  // 选定 sect 后固定写测试；下方值仅示意，不应未经口径确认上线。
  // eightChar.setSect(SELECTED_SECT);
  return toBaziChartJson(lunar, eightChar, input.gender, BAZI_POLICY);
}
```

Worker bundle 中运行后，应在 CI 执行 `wrangler dev --test-scheduled` 或 Vitest/Miniflare 的真实 bundle smoke test；这比只在 Node.js 内 import 更能发现兼容性问题。

必须补充的本地测试：

| 类别 | 最少案例 |
| --- | --- |
| 节气 | 立春前后各一例，验证年柱/月柱 |
| 日界 | 同一日期 22:59、23:00、00:00，验证选定 sect 的日柱/时柱 |
| 历法 | 闰月、公农历双向转换、跨年 |
| 输入 | `+08:00`、UTC、非法日期、缺失分钟 |
| 升级 | 至少 20 个已人工确认的生日快照，比较完整 `chartJson` |

---

## 二、`SylarLong/iztro`

仓库：[github.com/SylarLong/iztro](https://github.com/SylarLong/iztro)
审阅版本：npm `2.6.1`（接入时应再次复核并精确锁定）
许可证：MIT
运行时依赖：`dayjs`、`i18next`、`lunar-lite`、`lunar-typescript`

### API 能力

`iztro` 用于生成紫微斗数结构化命盘，具有十二宫、四柱、星曜、四化、三方四正、空宫、各类运限以及流年/流月/流日/流时等能力；还支持配置与插件以适应不同流派。

README 所示本地入口：

```ts
import { astro } from 'iztro';

const astrolabe = astro.bySolar(
  '2000-8-16', // 公历生日
  2,           // 时辰序号；接入时必须由我们统一转换
  '女',
  true,
  'zh-CN'
);

const palace = astrolabe.palaces.find((item) => item.name === '命宫');
```

也提供 `astro.byLunar(...)`。注意：README 同时宣传 `iztro-ziwei-v3`、`iztro-qimen-v3` 等托管 AI/Chat 服务；那是独立外部服务，不能因本仓库是 MIT 而视为可免费、自托管或可替代本项目中转站的能力。本项目只考虑本地排盘 API。

### 测试覆盖审查

- 有约 13 个测试相关条目，涵盖 `astro`、`analyzer`、`palace`、`plugin`、星曜定位、i18n 和工具函数。
- `package.json` 的测试命令为 `jest --config jestconfig.json --coverage`；`prepublishOnly` 会执行测试、lint 与 UMD build，是较好的发布门槛信号。
- 仓库有 3 个 GitHub workflow，维护与自动化信号强于本次审查的另两个项目。
- 同样没有审阅到可作为合同承诺的覆盖率门槛/百分比；应描述为“有覆盖收集与关键域单测”，不能声称全盘正确。

结论：**三个项目中工程维护信号最强，但领域输出更加复杂，且有运行时依赖，需先做 Worker 兼容性验证。**

### 许可证与供应链

项目主体是 MIT，仍需保留其声明。因其有四项直接依赖，生产 lockfile、依赖漏洞扫描与升级回归不能省略。应在 CI 加入：

```bash
npm ci
npm test
npm audit --omit=dev
```

`npm audit` 是风险提示而非放行标准；真正的放行仍取决于 bundle、标准盘快照、许可证变更和人工复核。

### 放入 Cloudflare Worker 的具体方式

先实现隔离 adapter 与序列化器：

```ts
// worker/src/calculators/ziwei.ts
import { astro } from 'iztro';

export function calculateZiwei(input: ZiweiInput): ZiweiChartJson {
  const birth = normalizeZiweiBirth(input); // ISO/农历、时辰、性别、流派配置
  const astrolabe = astro.bySolar(birth.date, birth.hourIndex, birth.gender, true, 'zh-CN');

  return {
    schemaVersion: 'ziwei-chart-1',
    calculationPolicy: ZIWEI_POLICY,
    pillars: mapPillars(astrolabe),
    palaces: astrolabe.palaces.map(mapPalace),
    transformations: mapTransformations(astrolabe),
    periods: mapPeriods(astrolabe)
  };
}
```

不要把 `astrolabe` 原对象直接存入 D1 或喂给 LLM：对象结构与字段可能随库升级变化，字段过多会抬高 token 成本，也会让模型编造解释。仅保存稳定、白名单化的 `ZiweiChartJson`。

建议的 PoC 验收顺序：

1. 在新 Worker 中只 import `iztro` 并执行一个 `astro.bySolar`；用 `wrangler dev` 和 `wrangler deploy --dry-run` 验证 bundle。
2. 检查最终 bundle 体积、冷启动及单次计算耗时；设置 Worker CPU 限额告警。
3. 选至少 10 个经人工确认的标准命盘，比较宫位、主星、四化、运限快照。
4. 固定语言、时辰索引、农历/公历入口和流派配置；所有配置进入 `calculationPolicy`。
5. 完成后才接入统一 `/api/v1/analyses`，并将 `module: 'ziwei'` 放开。

额外隐私要求：完整盘计算和个人资料均留在 Worker。不要让浏览器调用托管 AI API，也不要把完整出生资料传到与本产品无数据处理协议的第三方服务。

---

## 三、`87529324wen-jpg/xuanxue-bazi`

仓库：[github.com/87529324wen-jpg/xuanxue-bazi](https://github.com/87529324wen-jpg/xuanxue-bazi)
许可证文件标识：MIT
维护/社区信号：约 2 stars、0 forks；未见 workflow 或自动化单测目录

### 内容与 API 能力

这不是可替代 `lunar-javascript` 的成熟 JavaScript SDK，更像一个八字资料与实验工程集合。内容包括：

- `knowledge/` 下的经典精读笔记、神煞速查、十神关系、断命流程、穷通宝鉴等；
- `references/` 下的流日、择期、合婚、合名和“八字 × 中医诊断”等资料；
- `scripts/bazi_engine.py` Python 实验引擎；
- 原典、现代注释/整理文本与 AI 整理笔记。

README 自述其使用 `sxtwl` 排盘，整理了 11 部经典、约 14,639 行笔记。审阅 `scripts/bazi_engine.py` 发现存在标注 `# wrong` 的可疑/未完成逻辑，且自定义十神、旺衰与神煞实现没有相应测试覆盖。

### 测试与维护审查

- 未见自动化单元测试目录和 CI workflow。
- 没有版本化的 API 合约、发布包或可审计覆盖率。
- Python 引擎的关键规则没有可复现的黄金案例；代码内已有错误标记。

结论：**不可作为生产排盘引擎，不可作为 API 服务基础。** 即便经修补，也要先按全新自研模块重新设计、测试与审计，成本通常高于采用 `lunar-javascript`。

### 许可证和内容权利风险

仓库根目录使用 MIT，只能说明仓库作者对其可授权部分的声明；**不能自动给其包含的每一本原典、现代注释、作者文本、AI 整理内容和参考资料授予再分发、商业检索或训练许可。** 尤其应注意：

- 现代作者的注释、选编与译注通常独立受版权保护；
- “AI 整理”不等于来源、准确性或可再许可得到证明；
- 医疗诊断、药方、符咒与绝对化断语有内容安全、合规与产品责任风险；
- 把整个仓库向量化后用于 RAG，仍可能构成复制、存储和输出受保护内容，不因模型“只总结”而消失。

### 可接受的使用方式

只允许作为人工研究索引，不直接进入线上运行环境。若希望吸收其中某一条内容，必须走如下流程：

```text
候选片段 → 定位原始出处 → 确认版权/许可 → 人工改写为自有中立词条
        → 标记适用条件与禁止用途 → 专家/编辑审核 → 发布到受控知识库
```

每个入库词条至少保存：`source_url`、原作者/出处、许可结论、摘录范围、改写人、审核人、审核日期、版本、适用模块、风险级别。排除医疗诊断、药方、符咒、危害性建议，以及对人生/投资/法律的确定性断言。

---

## 后端落地蓝图

```text
Pages 表单
   │ HTTPS（出生信息）
   ▼
Worker 路由 + 参数/同意/限流校验
   ├─ BaziAdapter  ── lunar-javascript
   ├─ ZiweiAdapter ── iztro（第二阶段）
   └─ Chart schema validator
   ▼
受控 chartJson + 审核知识片段 + 用户问题（最小化）
   ▼
现有 OpenAI 兼容中转站（Worker Secret 保存 Key）
   ▼
报告 JSON Schema 校验 → D1（有期限存储）→ 前端报告页
```

建议目录：

```text
worker/src/
  calculators/
    bazi.ts                 # 只依赖 lunar-javascript
    ziwei.ts                # 只依赖 iztro
    chart-types.ts          # 本项目稳定 DTO
  policies/
    bazi-policy.ts          # 节气、换日、时区
    ziwei-policy.ts         # 流派、时辰、语言
  __tests__/
    bazi.golden.test.ts
    ziwei.golden.test.ts
    worker-smoke.test.ts
  third-party/
    THIRD_PARTY_NOTICES.md
```

统一 chart DTO 必须包含版本和计算策略，便于复算与解释追溯：

```json
{
  "schemaVersion": "bazi-chart-1",
  "calculator": { "name": "lunar-javascript", "version": "1.7.7" },
  "calculationPolicy": {
    "timezone": "Asia/Shanghai",
    "yearBoundary": "lichun",
    "dayBoundary": "chosen-sect",
    "trueSolarTime": false
  },
  "pillars": { "year": "", "month": "", "day": "", "hour": "" }
}
```

## 上线门槛与决策

### 八字 MVP（可现在开始）

- 引入并锁定 `lunar-javascript@1.7.7`；
- 产品负责人确认 `BAZI_POLICY` 的年/月/日边界；
- 完成不少于 20 个黄金快照、节气与午夜边界案例；
- Worker bundle smoke test、输入时区校验和报告 JSON 校验通过；
- 加入 MIT notice 与依赖升级流程。

### 紫微（二期准入）

- 先完成 `iztro@2.6.1` 的 Worker PoC；
- 至少 10 个标准盘经人工核验；
- 固定时辰转换、语言和流派配置；
- 确认 bundle/CPU/依赖审计可接受，再开通线上模块。

### 明确禁止

- 将 `xuanxue-bazi` 整库或其原始资料直接嵌入、向量化、RAG 或公开分发；
- 使用其 `scripts/bazi_engine.py` 作为生产计算器；
- 让 LLM 代替确定性排盘；
- 将任何第三方托管 AI 宣传 API 当作开源计算库的一部分；
- 在命理报告中输出医疗诊断、药方、法律/投资指令或决定性预言。

## 复审触发条件

出现以下任一情况，应重跑本审查：升级依赖版本、修改节气/换日/流派策略、增加真太阳时、切换模型或中转站、开始将外部文字引入知识库、或计划公开分发包含第三方代码/文本的产品包。
