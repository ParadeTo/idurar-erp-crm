# P0 测试补充计划

> 基于 `docs/test-gaps.md` 的 P0 条目（T1–T8）制定，按  
> **改造路径上的 Characterization → 核心链路集成 → 复杂逻辑单元** 的顺序排批次。  
> 批次间有依赖时须顺序执行；同一批次内多个 test case 可并行开发。

---

## 前置：基础设施（非测试缺口，所有批次的先决条件）

在开始任何批次前需一次性完成：

| 动作 | 说明 |
|---|---|
| 安装依赖 | `backend`: `jest`, `supertest`, `mongodb-memory-server`；`frontend`: `vitest`, `@testing-library/react` |
| 创建 `backend/src/__tests__/setup.js` | beforeAll 启动内存 MongoDB，afterAll 关闭；afterEach 清空所有 collection |
| 创建测试 helper：`createAdminAndLogin()` | 写入 Admin + AdminPassword 文档，调用 `POST /api/login`，返回 `{ token, adminId }` |
| 配置 `jest.config.js` | `testEnvironment: node`, `globalSetup` / `globalTeardown` 挂 mongodb-memory-server |

> 预期工作量：**1 天**。完成后所有批次共享同一套 DB 生命周期管理，不需要重复搭建。

---

## 批次计划总览

| 批次 | 覆盖 Gap | 测试类型 | 覆盖核心链路 | 预计工作量 |
|---|---|---|---|---|
| **Batch 1** | T7 + T8 | Characterization Test | 链路 5（JWT Session 双查）、链路 6（登录/登出对称） | 1 天 |
| **Batch 2** | T2 | Characterization Test | 链路 1（付款创建 → 发票状态联动） | 1 天 |
| **Batch 3** | T3 | 集成测试 | 链路 2（付款更新 → 差值重算） | 0.5 天 |
| **Batch 4** | T1 | 集成测试 | 链路 1（付款金额超额校验） | 0.5 天 |
| **Batch 5** | T6 | 集成测试 | 链路 4（发票更新 → 保留旧 credit 重算状态） | 0.5 天 |
| **Batch 6** | T5 | 集成测试 | 链路 3（发票创建 → 序号自增） | 0.5 天 |
| **Batch 7** | T4 | 单元测试 | 链路 3（发票金额计算纯函数） | 0.5 天 |

**总计（不含基础设施）：4.5 天**

---

## 批次详情

### Batch 1 — Auth Session 全流程 Characterization
**类型**：Characterization Test  
**覆盖**：T7 + T8 | 链路 5、链路 6

**为什么最先做**：  
所有后续集成测试都需要一个有效 token 才能调用受保护接口。先把 auth 行为固定下来，后续批次才能安全地复用 `createAdminAndLogin()` helper。  
`loggedSessions` 双重 DB 查验是项目特有行为（标准 JWT 中间件不做此检查），极容易在重构 auth 时被无意绕过——Characterization Test 可以将这个隐性约束显式化。

**需要编写的 test case**：

| # | 输入 | 断言 |
|---|---|---|
| 1-a | 合法 JWT + token 在 loggedSessions | 受保护接口返回 200，非 401 |
| 1-b | 合法 JWT + token **不在** loggedSessions | 返回 401，body 含 `jwtExpired: true` |
| 1-c | `POST /api/login` 成功 | AdminPassword.loggedSessions 包含返回的 token |
| 1-d | 登录后 `POST /api/logout` | AdminPassword.loggedSessions 不再包含该 token |
| 1-e | 登出后用同一 token 访问受保护接口 | 返回 401，body 含 `jwtExpired: true` |

---

### Batch 2 — 付款创建 → 发票状态联动 Characterization
**类型**：Characterization Test  
**覆盖**：T2 | 链路 1

**为什么是 Characterization**：  
Payment.create 和 Invoice.$inc 是两次无事务写入，中间没有原子保证。将当前行为作为"黄金记录"钉住，任何重构导致联动中断时测试立即报错，不需要人工检查 DB。

**需要编写的 test case**：

| # | 场景 | 断言 |
|---|---|---|
| 2-a | 付款金额 < 发票余额（部分付款） | Invoice.credit 累加该金额；paymentStatus = `"partially"` |
| 2-b | 付款金额 = 发票余额（全额付清） | Invoice.credit = total − discount；paymentStatus = `"paid"` |
| 2-c | 两次部分付款累计 = 全额 | 两次后 paymentStatus = `"paid"`，credit 正确累加（非覆盖） |

---

### Batch 3 — 付款更新差值重算
**类型**：集成测试  
**覆盖**：T3 | 链路 2

**依赖**：Batch 2 的 fixture 可直接复用（已有 Invoice + Payment）。

**需要编写的 test case**：

| # | 场景 | 断言 |
|---|---|---|
| 3-a | 将付款金额从 100 改为 150（增加 50） | Invoice.credit += 50（不是覆盖为 150） |
| 3-b | 将付款金额从 100 改为 60（减少 40） | Invoice.credit -= 40；paymentStatus 可能从 paid 退为 partially |

---

### Batch 4 — 付款金额超额校验
**类型**：集成测试  
**覆盖**：T1 | 链路 1

**依赖**：Batch 2 的 Invoice fixture（需要一张已知余额的发票）。

**需要编写的 test case**：

| # | 场景 | 断言 |
|---|---|---|
| 4-a | amount > (total − discount − credit) | 请求被拒绝（4xx），Payment 文档未写入，Invoice.credit 不变 |
| 4-b | amount = (total − discount − credit)（恰好等于余额） | 正常写入，paymentStatus = `"paid"` |

---

### Batch 5 — 发票更新保留旧 credit
**类型**：集成测试  
**覆盖**：T6 | 链路 4

**需要编写的 test case**：

| # | 场景 | 断言 |
|---|---|---|
| 5-a | 已有部分付款，更新 Invoice total（调高） | Invoice.credit 不变；paymentStatus 根据新 total 重算（可能从 paid 退为 partially） |
| 5-b | 已有部分付款，更新 Invoice discount（调高使余额 ≤ 0） | paymentStatus 变为 `"paid"`，credit 仍为原值 |

---

### Batch 6 — 发票序号自增
**类型**：集成测试  
**覆盖**：T5 | 链路 3

**需要编写的 test case**：

| # | 场景 | 断言 |
|---|---|---|
| 6-a | 创建一张发票 | `GET /api/setting/listAll` 返回的 `last_invoice_number` 较创建前 +1 |
| 6-b | 连续创建两张发票 | `last_invoice_number` 累计 +2，无跳号 |

---

### Batch 7 — 发票金额计算纯函数
**类型**：单元测试  
**覆盖**：T4 | 链路 3

**为什么最后做**：  
该逻辑不依赖 DB，可完全独立测试，无需 supertest / mongodb-memory-server。放最后是因为：集成测试已能间接检测计算结果是否落库正确；单元测试提供更细粒度的失败定位。

**需要编写的 test case**：

| # | 场景 | 断言 |
|---|---|---|
| 7-a | 单行 item，无税率 | subTotal = price × qty；taxTotal = 0；total = subTotal |
| 7-b | 单行 item，含税率 | taxTotal = subTotal × taxRate；total = subTotal + taxTotal |
| 7-c | 多行 item | 各行分别计算后汇总，结果与预期精度一致 |
| 7-d | 含 discount | total = subTotal + taxTotal − discount |

---

## 执行顺序与依赖关系

```
基础设施
    └── Batch 1（Auth Characterization）
            └── Batch 2（Payment create Characterization）
                    ├── Batch 3（Payment update delta）
                    └── Batch 4（Payment amount validation）
            └── Batch 5（Invoice update credit）
            └── Batch 6（Invoice sequence number）
    └── Batch 7（Invoice amount calc，独立）
```

- Batch 1 必须在 Batch 2–6 之前完成（后者依赖 `createAdminAndLogin()` helper）。
- Batch 3 和 Batch 4 依赖 Batch 2 的 fixture，应在 Batch 2 之后做。
- Batch 5、6、7 与 Batch 3/4 无数据依赖，可并行开发。
