# 灵机阁（Lingji Pavilion）

一个由静态网页、Cloudflare Worker 和 AI 解读接口组成的命理体验项目。

## 项目结构

```text
site/       静态网站源码：HTML、CSS、浏览器脚本和图片资源
worker/     Cloudflare API Worker：八字排盘、受控知识片段、AI 解读
scripts/    发布辅助脚本
research/   仅保留上游资料来源索引；原始研究副本不提交到 GitHub
```

## 本地开发

API Worker：

```powershell
cd worker
npm install
npm test
npm run typecheck
npm run dev -- --port 8788
```

本地 AI 调试需要复制 `worker/.dev.vars.example` 为 `worker/.dev.vars` 并填入自己的网关配置。这个文件被 Git 忽略，不能提交。

## 发布

完整的生产发布、密钥配置、静态网站部署、验证与回滚说明见 [DEPLOYMENT_AND_MAINTENANCE.md](DEPLOYMENT_AND_MAINTENANCE.md)。

API Worker 发布：

```powershell
cd worker
npm run deploy
```

静态网站发布（会包含 `site/assets/` 中的图片）：

```powershell
cd worker
npm run deploy:site
```

## 本地计算引擎

四个模块都先在 API Worker 内生成结构化结果，再将结果与用户问题交给 AI 生成文字解读；排盘与筛选不依赖外部排盘 API。

| 模块 | 本地依赖 | 计算结果 |
| --- | --- | --- |
| 八字 | `lunar-javascript@1.7.7` | 四柱、日主、五行、十神 |
| 紫微斗数 | `iztro@2.6.1` | 十二宫、星曜等命盘结构 |
| 奇门遁甲 | `3meta@2.6.0` | 时家转盘九宫、阴阳遁、局数、八门、九星、八神、值符值使与格局摘要 |
| 择日 | `lunar-javascript@1.7.7` | 黄历宜忌、冲煞、日神吉凶与候选日期排序 |

`3meta` 是 MIT 许可的本地 Node.js 依赖，不需要 API Key、账号或按次付费。奇门当前采用 `Asia/Shanghai` 墙上时间与拆补法口径；尚未启用真太阳时、经度和历史夏令时校正。

## 安全与内容边界

- AI 网关密钥仅保存在 Cloudflare Worker Secret 和本地 `.dev.vars`。
- 浏览器只调用 Worker API，不直接接触 AI Key。
- 八字排盘由确定性代码完成；AI 仅基于受控盘面数据与产品知识片段生成传统文化参考性解读。
- 奇门使用本地 `3meta` 生成时家转盘、拆补法的九宫盘；AI 仅解释结构化盘面，不负责起盘。
- 原始上游研究资料不随项目公开发布；资料来源索引见 `research/UPSTREAM_SOURCES.md`。

## 开源许可

本仓库尚未声明开源许可证。在添加 `LICENSE` 前，代码默认不授予他人复制、修改或分发的权限。公开仓库前请由项目所有者选择合适的许可证。
