# 冒烟测试报告

**执行时间**：2026-06-02  
**测试环境**：本地开发（macOS）  
**前端**：http://localhost:3000  
**后端**：http://localhost:8888  
**数据库**：mongodb://localhost:27017/idurar

---

## 结果总览

| 通过 | 失败 | 跳过 |
|---|---|---|
| 22 | 0 | 0 |

> T11（创建发票）首次因入参包含 schema 不允许的字段失败，自主修复后通过。

---

## 详细结果

### 基础连通性

| ID | 测试项 | 预期 | 实际 | 状态 |
|---|---|---|---|---|
| T01 | 前端 HTTP 响应 | 200 | 200 | ✅ |
| T02 | 未认证访问受保护接口 | 401 | 401 | ✅ |

### 认证流程

| ID | 测试项 | 预期 | 实际 | 状态 |
|---|---|---|---|---|
| T03 | 错误密码登录 | `success: false` | `"Invalid credentials."` | ✅ |
| T04 | 正确凭据登录 | JWT token + role:owner | token 171 chars，role:owner | ✅ |
| T21 | 登出 | `success: true` | `success: true` | ✅ |
| T22 | 登出后原 token 失效 | 401 | 401 | ✅ |

### 设置模块

| ID | 测试项 | 预期 | 实际 | 状态 |
|---|---|---|---|---|
| T05 | 获取全量设置 | success + 记录数 > 0 | 54 条 | ✅ |

### 客户（Client）模块

| ID | 测试项 | 预期 | 实际 | 状态 |
|---|---|---|---|---|
| T06 | 客户列表（初始空） | `count: 0` | count: 0 | ✅ |
| T08 | 创建客户 | success + _id | Smoke Test Client 创建成功 | ✅ |
| T09 | 读取客户 | `name: Smoke Test Client` | name 匹配 | ✅ |
| T10 | 搜索客户（name 模糊） | found: 1 | found: 1 | ✅ |
| T17 | 客户汇总统计 | success | new%:100 active%:100 | ✅ |
| T18 | 软删除客户 | `removed: true` | removed: true | ✅ |

### 发票（Invoice）模块

| ID | 测试项 | 预期 | 实际 | 状态 |
|---|---|---|---|---|
| T07 | 发票列表（初始空） | `count: 0` | count: 0 | ✅ |
| T11 | 创建发票（含行项目 + 10% 税） | subTotal:1000 taxTotal:100 total:1100 paymentStatus:unpaid | 完全匹配 | ✅ |
| T12 | 读取发票（含 client 自动填充） | client.name 可见 | `Smoke Test Client` | ✅ |
| T13 | 发票汇总统计 | total:1100 total_undue:1100 | 完全匹配 | ✅ |
| T15 | 付款后发票状态联动 | credit:550 paymentStatus:partially | 完全匹配 | ✅ |

### 付款（Payment）模块

| ID | 测试项 | 预期 | 实际 | 状态 |
|---|---|---|---|---|
| T14 | 记录付款（550/1100） | success + amount:550 | 完全匹配 | ✅ |
| T16 | 付款汇总统计 | count:1 total:550 | 完全匹配 | ✅ |

### 管理员（Admin）模块

| ID | 测试项 | 预期 | 实际 | 状态 |
|---|---|---|---|---|
| T19 | 读取 admin profile | name:IDURAR role:owner | 完全匹配 | ✅ |

### PDF 下载

| ID | 测试项 | 预期 | 实际 | 状态 |
|---|---|---|---|---|
| T20 | GET /download/invoice/{id}.pdf | HTTP 200 + PDF 文件 | 200 | ✅ |

---

## 发现的问题

### 问题 1：Invoice create Joi schema 不接受额外字段

**测试**：T11  
**表现**：POST `/api/invoice/create` 传入 `discount` 字段返回 `"discount" is not allowed`；去掉后再传 `currency` 返回 `"currency" is not allowed`。  
**根因**：`invoiceController/schemaValidate.js` 使用 `Joi.object()` 默认为严格模式（不允许 schema 之外的任何字段）。允许的字段仅有：`client / number / year / status / notes / expiredDate / date / items / taxRate`。  
**影响**：前端 `InvoiceForm` 提交时应仅传这 9 个字段（`currency`、`discount` 由后端从 Model 默认值或其他途径处理）。后端本身行为正确，是测试脚本构造请求有误。  
**修复**：测试脚本去掉多余字段后一次通过。**无需修改业务代码**。

---

## 业务逻辑验证

| 场景 | 验证结果 |
|---|---|
| 金额计算：qty×price=subTotal，subTotal×taxRate%=taxTotal，subTotal+taxTotal=total | ✅ 1000+100=1100 |
| paymentStatus 状态机：创建时 unpaid，部分付款后 partially | ✅ |
| 付款创建后 Invoice.credit 自动累加 | ✅ credit=550 |
| 软删除：DELETE 接口设 `removed:true` 而非物理删除 | ✅ |
| JWT session：登出后 token 从 AdminPassword.loggedSessions 移除，后续请求 401 | ✅ |
| 客户搜索按 name 模糊匹配 | ✅ |
| autopopulate：Invoice 读取时 client 字段自动展开 | ✅ client.name 可见 |
| PDF 按需生成：GET /download 返回 200 | ✅ |
