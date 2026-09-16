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

## 安全与内容边界

- AI 网关密钥仅保存在 Cloudflare Worker Secret 和本地 `.dev.vars`。
- 浏览器只调用 Worker API，不直接接触 AI Key。
- 八字排盘由确定性代码完成；AI 仅基于受控盘面数据与产品知识片段生成传统文化参考性解读。
- 原始上游研究资料不随项目公开发布；资料来源索引见 `research/UPSTREAM_SOURCES.md`。

## 开源许可

本仓库尚未声明开源许可证。在添加 `LICENSE` 前，代码默认不授予他人复制、修改或分发的权限。公开仓库前请由项目所有者选择合适的许可证。
