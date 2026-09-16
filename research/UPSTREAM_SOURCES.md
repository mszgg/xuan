# 上游资料本地镜像清单

这些目录用于离线审阅 API、许可证、测试和升级差异；它们不是网站静态资源，也不是 Cloudflare Worker 的部署输入。不得将其中的原始知识文本、Python 脚本或第三方版权内容直接复制到线上知识库。

| 名称 | 本地目录 | 来源 | 锁定 commit | 允许用途 |
| --- | --- | --- | --- | --- |
| lunar-javascript | `upstream/lunar-javascript` | https://github.com/6tail/lunar-javascript | `4c45a59f79b856125516f31aefa8295035c16afd` | 审查与比对；生产实际通过 `worker/package-lock.json` 安装 `1.7.7` |
| iztro | `upstream/iztro` | https://github.com/SylarLong/iztro | `2c7ef9be669df7b19d1799f4dce335fed3794f78` | 审查、Worker PoC、紫微标准盘验证；尚未加入生产依赖 |
| xuanxue-bazi | `upstream/xuanxue-bazi` | https://github.com/87529324wen-jpg/xuanxue-bazi | `2b3b87a5b181dbb545c218d730c9b5df78b8ef3f` | 仅人工资料溯源与结构研究；禁止整体 RAG、部署或作为排盘引擎 |

## 更新流程

1. 先查看上游 `LICENSE`、提交差异和测试变化。
2. 在本清单记录新的 commit、审查日期与结论。
3. 对 npm 依赖，升级精确版本与 `worker/package-lock.json`，执行黄金命盘测试、类型检查及 Worker bundle 预检。
4. 未经来源和版权核验，不将资料目录内容移入产品知识库。
