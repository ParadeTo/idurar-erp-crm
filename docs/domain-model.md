# 业务领域模型

梳理前后端共同的核心业务概念，说明每个模型的业务含义、前端展示位置、后端实现位置、关键字段与关联关系。

---

## 1. Admin（管理员/用户）

**业务含义**：系统的使用者账号。OSS 版只有一个角色 `owner`，不支持多用户/权限分级。

| 维度 | 说明 |
|---|---|
| **前端展示** | `/profile` 页面（查看/修改姓名、邮箱、头像）；Header 区域显示用户名；登录页填写 email/password |
| **后端 API** | POST /api/login, POST /api/logout, POST /api/forgetpassword, POST /api/resetpassword, GET /api/admin/read/:id, PATCH /api/admin/profile/update, PATCH /api/admin/profile/password |
| **后端 Model** | `Admin`（src/models/coreModels/Admin.js）+ `AdminPassword`（分离存储密码和 session） |
| **关键字段** | email（唯一登录标识）、name、surname、photo（头像路径）、role（固定为 owner）、enabled（false 时无法登录） |
| **关联** | Invoice.createdBy → Admin、Client.createdBy / assigned → Admin、Payment.createdBy → Admin |
| **特殊规则** | admin@demo.com 禁止改资料；admin@admin.com 禁止改密码（demo 保护）；Token 存在 AdminPassword.loggedSessions[] 中，退出时删除 |

---

## 2. Client（客户）

**业务含义**：接受服务或产品的客户实体，是 Invoice 和 Payment 的核心关联对象。前端称为"Customer"，后端 Model 名为"Client"，API 路径为 `/api/client/*`。

| 维度 | 说明 |
|---|---|
| **前端展示** | `/customer` 页面（CrudModule 列表 + SidePanel 新增/编辑）；Invoice 表单的客户选择器（AutoCompleteAsync）；Invoice 详情和 Payment 列表中显示 client.name |
| **后端 API** | POST /api/client/create, GET /api/client/read/:id, PATCH /api/client/update/:id, DELETE /api/client/delete/:id, GET /api/client/search, GET /api/client/list, GET /api/client/summary |
| **后端 Model** | `Client`（src/models/appModels/Client.js）|
| **关键字段** | name（必填，搜索字段）、email、phone、country、address、enabled、createdBy（→Admin）、assigned（→Admin 负责人） |
| **关联** | Invoice.client → Client（autopopulate）、Payment.client → Client（autopopulate）|
| **summary 返回** | `{ new: 百分比, active: 百分比 }`，active = 有关联 Invoice 的客户比例 |

---

## 3. Invoice（发票）

**业务含义**：核心业务文档，代表公司向客户开具的一张账单。包含行项目（items[]）、税率、折扣、付款状态。是 Payment 的被引用方。

| 维度 | 说明 |
|---|---|
| **前端展示** | `/invoice`（列表）、`/invoice/create`（新建）、`/invoice/read/:id`（详情）、`/invoice/update/:id`（编辑）、`/invoice/pay/:id`（记录付款） |
| **后端 API** | POST /api/invoice/create, GET /api/invoice/read/:id, PATCH /api/invoice/update/:id, DELETE /api/invoice/delete/:id, GET /api/invoice/list, GET /api/invoice/summary, POST /api/invoice/mail |
| **后端 Model** | `Invoice`（src/models/appModels/Invoice.js）|
| **关键字段** | number（年内序号）、year、date、expiredDate、client（→Client）、items[]（行项目）、taxRate、subTotal、taxTotal、total、currency、credit（已付）、discount、paymentStatus（unpaid/paid/partially）、status（draft/pending/sent/…）、pdf（文件路径） |
| **关联** | Invoice.client → Client、Invoice.createdBy → Admin、Invoice.payment[] → Payment（push 关联）、Invoice.converted.quote → Quote |
| **金额计算** | 后端自动：subTotal = Σ(qty×price)；taxTotal = subTotal × taxRate/100；total = subTotal + taxTotal |
| **paymentStatus 规则** | paid = (total-discount==credit)；partially = (credit>0)；unpaid = (credit==0) |
| **PDF** | 创建/更新后设置 pdf 字段为 `invoice-{_id}.pdf`，通过 GET /download/invoice/{file} 按需生成 |

---

## 4. Payment（付款记录）

**业务含义**：记录客户对某张 Invoice 的一次付款行为。创建时自动更新 Invoice.credit（已付金额）和 Invoice.paymentStatus。

| 维度 | 说明 |
|---|---|
| **前端展示** | `/payment`（列表）、`/payment/read/:id`（详情）、`/payment/update/:id`（编辑）；从 Invoice 详情页或列表"Record Payment"操作进入创建流程（路径 `/invoice/pay/:id`） |
| **后端 API** | POST /api/payment/create, GET /api/payment/read/:id, PATCH /api/payment/update/:id, DELETE /api/payment/delete/:id, GET /api/payment/list, GET /api/payment/summary |
| **后端 Model** | `Payment`（src/models/appModels/Payment.js）|
| **关键字段** | number（付款编号）、invoice（→Invoice autopopulate）、client（→Client autopopulate）、amount（必填，校验不超过剩余未付金额）、date、currency、ref（交易参考号）、description |
| **关联** | Payment.invoice → Invoice（反向：Invoice.payment[] push 此记录的 id）、Payment.client → Client |
| **业务约束** | amount > 0；amount ≤ (invoice.total - invoice.discount - invoice.credit)；超额返回 202 错误 |
| **更新联动** | create/update 时 Invoice.$inc credit，$set paymentStatus |
| **PDF** | 同 Invoice，通过 GET /download/payment/{file} 生成 |

---

## 5. Setting（系统配置）

**业务含义**：键值对配置中心，存储影响整个应用行为的全局参数，分为 5 个类别。前端通过 Redux settings slice 全局缓存，所有需要配置的组件从 store 读取。

| 维度 | 说明 |
|---|---|
| **前端展示** | `/settings` 页面（5 个 Tab：General / Company / Company Logo / Currency / Finance）；所有页面通过 useMoney() / useDate() / useLanguage() 隐式消费 |
| **后端 API** | GET /api/setting/listAll, PATCH /api/setting/updateBySettingKey, PATCH /api/setting/updateManySetting, PATCH /api/setting/upload/:settingKey |
| **后端 Model** | `Setting`（src/models/coreModels/Setting.js）|
| **关键字段** | settingCategory（分组）、settingKey（键）、settingValue（值，Mixed 类型）、valueType（展示类型提示） |
| **重要配置** | last_invoice_number（每次创建 Invoice 自增）、last_quote_number、idurar_app_language、idurar_app_date_format、company_name / company_logo（出现在 PDF 模板中） |
| **初始化** | `npm run setup` 从 `src/setup/defaultSettings/*.json` 批量写入 |

---

## 6. Quote（报价单）— OSS 版部分实现

**业务含义**：向客户提出的报价文档，可转换为 Invoice（Invoice.converted.from = 'quote'）。与 Invoice 结构相似，有独立的 last_quote_number 计数器。

| 维度 | 说明 |
|---|---|
| **前端展示** | `QuoteModule` 组件存在（src/modules/QuoteModule/）；`QuoteForm` 与 InvoiceForm 几乎相同；路由 /quote、/quote/create 等在 routes.jsx 有路径配置但无 import 完整实现 |
| **后端 API** | **未发现**：appModels 目录无 Quote.js，路由未注册 |
| **后端 Model** | **未发现**：appModels 目录无 Quote.js |
| **参考依据** | setup/defaultSettings/quoteSettings.json（quote_prefix）、financeSettings.json（last_quote_number）、Invoice.converted.quote 字段、Invoice.converted.from enum 含 'quote' |
| **结论** | OSS 版 Quote 功能未完整交付；完整实现在企业版 |

---

## 7. PaymentMode（付款方式）— OSS 版缺失

**业务含义**：付款方式配置（如现金、银行转账、支票等），Payment 记录中会关联一条 paymentMode。

| 维度 | 说明 |
|---|---|
| **前端展示** | Payment 列表显示 `paymentMode.name` 列；PaymentModeForm.jsx 存在（src/forms/PaymentModeForm.jsx）；路由 /payment/mode 在 routes.jsx 有路径无 import |
| **后端 API** | **未发现**，model 文件不在 appModels 目录 |
| **后端 Model** | **未发现**（setup.js 中 `require('../models/appModels/PaymentMode')` 存在，说明模型文件被删除或未包含在 OSS 版本） |
| **初始值** | setup.js 插入一条默认记录：`{ name: 'Default Payment', description: '...', isDefault: true }` |

---

## 8. Taxes（税率配置）— OSS 版缺失

**业务含义**：可复用的税率配置条目，供 Invoice/Quote 表单选择。

| 维度 | 说明 |
|---|---|
| **前端展示** | TaxForm.jsx 存在（src/forms/TaxForm.jsx）；路由 /taxes 在 routes.jsx 有路径无 import |
| **后端 API** | **未发现** |
| **后端 Model** | **未发现**（setup.js 中 `require('../models/appModels/Taxes')` 存在） |
| **初始值** | setup.js 插入：`{ taxName: 'Tax 0%', taxValue: '0', isDefault: true }` |

---

## 领域关系总览

```
Admin ───────────────────────────────────────────┐
  │ createdBy                                     │ createdBy
  ▼                                               ▼
Client ─────── Invoice ──── Payment ─────────── Admin
  │              │    │         │
  │ client       │    └── pdf   │ invoice
  │ (autopo.)    │              │ client
  └──────────────┘              │ (autopo.)
                                └───────────────▶ Invoice (反向)

Setting ─── 影响 ──▶ InvoiceForm（number 自增）
                 ──▶ useMoney（格式化货币）
                 ──▶ useDate（日期格式）
                 ──▶ PDF 模板（公司信息）
```
