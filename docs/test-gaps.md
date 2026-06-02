# 测试缺口分析

> 对照 `docs/critical-paths.md`（应测什么）与 `docs/test-status.md`（现在测了什么）。  
> 当前状态：**零测试覆盖**，所有 8 条关键链路均无自动化保护。  
> 本文只列核心链路上的缺口，追求"关键路径有兜底"而非覆盖率指标。

---

## 缺口汇总表

| # | 优先级 | 关联链路 | 场景描述 | 为什么必须 | 建议测试类型 |
|---|---|---|---|---|---|
| T1 | **P0** | 链路 1 | 创建付款时 amount > (total−discount−credit)，请求被拒绝返回错误 | 核心业务校验；漏检会把超额款项写入 DB，Invoice.credit 永久超过 total，金额不可逆 | 集成测试 |
| T2 | **P0** | 链路 1 | 创建付款后 Invoice.credit 正确累加、paymentStatus 转换为 paid / partially / unpaid | 两次无事务写入（Payment + Invoice）是最高风险路径；任一步逻辑变动都会导致发票状态静默出错 | 集成测试 |
| T3 | **P0** | 链路 2 | 更新付款金额后，Invoice.credit 仅变化差值（changedAmount = new − old），不全量覆盖 | 差值计算是链路 2 的唯一高风险点；若误写成全量替换，历史已付数据被覆盖，无法自动发现 | 集成测试 |
| T4 | **P0** | 链路 3 | 创建发票时，后端正确计算 subTotal / taxTotal / total（前端不承担最终金额计算） | 金额计算是纯函数，可独立验证；出错则所有新建发票总额永久错误，影响所有下游链路 | 单元测试 |
| T5 | **P0** | 链路 3 | 创建发票后，Setting.last_invoice_number 自增 1 | `Invoice.save()` 与 `increaseBySettingKey()` 是两个独立操作，互不感知；失败时跳号但无报错，改造时极易引入静默回归 | 集成测试 |
| T6 | **P0** | 链路 4 | 更新发票 total / discount 后，用**旧** Invoice.credit 重算 paymentStatus，旧 credit 值不变 | 忘记读旧 credit 直接用请求体是链路 4 最典型错误，会把已付款发票误判为 unpaid；已有手工记录的付款数据将显示错误状态 | 集成测试 |
| T7 | **P0** | 链路 5 | JWT 签名有效，但 token 不在 AdminPassword.loggedSessions → 返回 401 + `jwtExpired:true` | 这是该项目特有的 DB 层 Session 二重校验，标准 JWT 中间件不做此检查；改 Admin 模型或引入新认证方式时最容易被跳过 | 集成测试 |
| T8 | **P0** | 链路 6 | 登录后 token 写入 loggedSessions；登出后 token 被 `$pull` 移除，同 token 再请求返回 401 | `$push` / `$pull` 对称性是多设备登录的基础；任一端逻辑变动（如换 token 存储格式）会让另一端静默失效 | 集成测试 |
| T9 | **P1** | 链路 1–4 | paymentStatus 状态机三档阈值边界：credit = 0（unpaid）、0 < credit < total（partially）、credit ≥ total（paid） | 链路 1–4 共用同一判定逻辑；阈值出错时所有发票状态同时错误，但因无测试改一行就全坏 | 单元测试 |
| T10 | **P1** | 链路 2 | 并发两次更新同一笔付款，Invoice.credit 最终值仍正确（不出现差值双重累加） | 无事务保护下，并发读旧值 → 写差值会导致余额膨胀；当前手动测试无法覆盖并发场景 | 集成测试 |
| T11 | **P1** | 链路 5 | JWT 签名无效或已过期 → 返回 401 | 防止 `jwt.verify` 配置错误（如 algorithm 不匹配）静默放行无效 token | 集成测试 |
| T12 | **P1** | 链路 7 | `GET /api/setting/listAll` 返回包含 `last_invoice_number` 在内的完整 Settings 集合 | Settings 是全局渲染门控（`isSuccess` 控制 ErpApp 是否渲染）；字段缺失或接口报错会导致页面白屏，上线前无感知 | 集成测试 |
| T13 | **P1** | 链路 8 | `GET /download/:dir/:file` 返回 HTTP 200 + `Content-Type: application/pdf`，响应体可被解析为有效 PDF | PDF 依赖 PhantomJS 二进制 + 文件系统写权限 + pug 模板 + Settings 四个外部因素；任一失效后端可能静默返回空文件或 500，需 Characterization Test 固定当前行为 | 集成测试（Characterization Test） |

---

## 优先级说明

**P0（改造前必须有）**：T1–T8，共 8 项。
- 这 8 项覆盖所有涉及**金额写入**、**状态机跃迁**和**认证 Session 维护**的核心操作。
- 没有这些测试，任何改动都可能在不知情的情况下破坏数据一致性或安全性。

**P1（有了更好）**：T9–T13，共 5 项。
- 状态机边界（T9）、并发安全（T10）、标准 JWT 校验（T11）补充 P0 测试的覆盖盲点。
- Settings 接口（T12）和 PDF（T13）风险可通过手动冒烟兜底，但有测试后回归成本更低。

---

## 推荐引入方式

| 层 | 框架 | 说明 |
|---|---|---|
| 后端单元 + 集成 | Jest + supertest + mongodb-memory-server | supertest 驱动 Express app，mongodb-memory-server 提供内存 MongoDB，测试间完全隔离 |
| 前端单元 | Vitest + @testing-library/react | 测 Redux reducer（paymentStatus 状态机）和 Settings selector，无需启动浏览器 |

> P0 的 8 项全部可用后端集成测试实现（T4 可降级为纯单元），无需 E2E，引入成本低。
