---
name: sync-docs-on-code-change
description: Use when making code changes to a project that has a docs/ directory with API, model, route, or architecture documentation. Triggers on: adding/removing API endpoints, changing DB schemas, adding frontend routes, changing Redux state shape, adding external dependencies, or changing architectural conventions.
---

# 代码变更时同步更新文档

## 概述

代码改了但文档没跟上，下一个读代码的人（人类或 AI）会拿着一张过时的地图走路。**在同一个 commit 里**把受影响的文档段落一并更新。

## 代码变更 → 需要更新的文档

| 代码里改了什么 | 需要更新的文档 |
|---|---|
| 新增 / 删除 / 重命名 API 接口 | `docs/api-list.md` |
| Mongoose Schema 字段新增 / 删除 / 改名 | `docs/backend-data-model.md` · `docs/domain-model.md` |
| 前端路由新增 / 删除 | `docs/routes-pages.md` · `docs/ui-actions.md` |
| Redux slice 结构或 action 变化 | `docs/frontend-state-model.md` |
| 外部服务 / 环境变量新增或删除 | `docs/external-integrations.md` |
| 新增中间件、服务调用或数据流步骤 | `docs/data-flow.md` |
| 架构约定或项目规则改变 | `CLAUDE.md` |
| 重大结构变化（新增层、新增模块） | `docs/` 下相关 SVG 图 |

## 操作步骤

1. 提交前，对照上表确认哪几行适用。
2. 只打开受影响的文档，定位到相关段落。
3. **就地修改**：只改动变化的那几行/段，不要重新生成整个文档。
4. 代码和文档改动一起 `git add`，放在同一个 commit 里提交。

## 危险信号 — 遇到这些立刻停下来补文档

- "文档待会儿再更新" → 待会儿永远不来，现在就更新。
- 提交代码但没有碰任何文档 → 回去对照上表检查。
- 只改了一行却重写整篇文档 → 只改变化的部分。
- 文档改了但没有 stage → 必须和代码一起提交。

## 文档"跑偏"长什么样

- `api-list.md` 里描述了一个已经不存在的接口。
- `backend-data-model.md` 里展示了一个已被删除的字段。
- `routes-pages.md` 里有个路径访问会 404。
- `CLAUDE.md` 里描述了一条已被悄悄改掉的约定。
