# 后端数据模型

所有 Mongoose Model 位于 `src/models/`，统一使用 `removed: Boolean`（默认 false）作软删除标记，查询时始终带 `{ removed: false }`。

---

## Core Models（`src/models/coreModels/`）

### Admin

**文件**：`Admin.js`  
**集合名**：`admins`  
**说明**：系统管理员账号。OSS 版 role 只有 `owner`，无多角色权限体系。

| 字段 | 类型 | 说明 | 约束 |
|---|---|---|---|
| _id | ObjectId | 主键 | 自动生成 |
| removed | Boolean | 软删除标记 | 默认 false |
| enabled | Boolean | 账号是否启用 | 默认 **false**（setup 脚本设为 true） |
| email | String | 登录邮箱 | 必填，lowercase，trim |
| name | String | 名字 | 必填 |
| surname | String | 姓氏 | 可选 |
| photo | String | 头像文件路径 | 可选，trim |
| role | String | 角色 | enum: `['owner']`，默认 owner |
| created | Date | 创建时间 | 默认 `Date.now` |

**写入位置**：`setup.js`（初始化）、`updateProfile` controller（profile 更新）  
**关联**：Invoice.createdBy、Client.createdBy / assigned、Payment.createdBy

---

### AdminPassword

**文件**：`AdminPassword.js`  
**集合名**：`adminpasswords`  
**说明**：与 Admin 1:1 绑定，分离存储密码信息和会话 token 列表。

| 字段 | 类型 | 说明 | 约束 |
|---|---|---|---|
| _id | ObjectId | 主键 | |
| removed | Boolean | 软删除 | 默认 false |
| user | ObjectId → Admin | 关联管理员 | 必填，**unique** |
| password | String | bcrypt 哈希值 | 必填 |
| salt | String | 密码盐（shortid 生成） | 必填 |
| emailToken | String | 邮件验证 token | 可选 |
| resetToken | String | 密码重置 token（shortid） | 由 forgetPassword 写入 |
| emailVerified | Boolean | 邮件是否已验证 | 默认 false |
| authType | String | 认证方式 | 默认 `'email'` |
| loggedSessions | [String] | 在线 JWT token 列表 | 默认 `[]`，登录时 $push，登出时 $pull |

**方法**：
- `generateHash(salt, password)` → bcrypt hash
- `validPassword(salt, password)` → boolean

**写入位置**：`login.js`（push token）、`logout.js`（pull token）、`forgetPassword.js`（set resetToken）、`updateProfilePassword.js`（set new hash）

---

### Setting

**文件**：`Setting.js`  
**集合名**：`settings`  
**说明**：键值对配置中心，按 `settingCategory` 分组管理全局设置。

| 字段 | 类型 | 说明 | 约束 |
|---|---|---|---|
| _id | ObjectId | 主键 | |
| removed | Boolean | 软删除 | 默认 false |
| enabled | Boolean | 是否启用 | 默认 true |
| settingCategory | String | 分组名 | 必填，lowercase |
| settingKey | String | 设置键名 | 必填，lowercase |
| settingValue | Mixed | 设置值 | 可为任意类型 |
| valueType | String | 值类型提示（'string'/'number'/'boolean'/'image'） | 默认 'String' |
| isPrivate | Boolean | 是否私密（不返回前端） | 默认 false |
| isCoreSetting | Boolean | 是否核心设置 | 默认 false |

**默认分类**（来自 `setup/defaultSettings/*.json`）：

| settingCategory | 常用 settingKey |
|---|---|
| finance_settings | last_invoice_number, last_quote_number, last_payment_number, invoice_prefix, quote_prefix |
| app_settings | idurar_app_date_format, idurar_app_language, idurar_app_email, idurar_base_url |
| company_settings | company_name, company_logo, company_address, company_email, company_tax_number |
| money_format_settings | currency_symbol, currency_position |
| crm_settings | （内容见 clientSettings.json） |

**写入位置**：`settingController/updateBySettingKey.js`、`updateManySetting.js`、`increaseBySettingKey.js`（每次创建 Invoice/Payment 时自增计数器）

---

### Upload

**文件**：`Upload.js`  
**集合名**：`upload s`（注意：代码中 `mongoose.model('Upload ', ...)` 有一个尾部空格 bug）  
**说明**：文件上传元数据记录。

| 字段 | 类型 | 说明 | 约束 |
|---|---|---|---|
| _id | ObjectId | 主键 | |
| removed | Boolean | | 默认 false |
| enabled | Boolean | | 默认 true |
| modelName | String | 关联的业务模型名 | trim |
| fieldId | String | 关联文档的 id | 必填 |
| fileName | String | 服务器存储文件名 | 必填 |
| fileType | String | 文件类型 | 必填，enum（jpeg/png/pdf/csv/xlsx 等） |
| isPublic | Boolean | 是否公开访问 | 必填 |
| userID | ObjectId | 上传用户 | 必填 |
| isSecure | Boolean | 是否加密存储 | 必填 |
| path | String | 文件路径 | 必填 |
| created | Date | 上传时间 | 默认 Date.now |

---

## App Models（`src/models/appModels/`）

### Client

**文件**：`Client.js`  
**集合名**：`clients`  
**说明**：业务客户（Customer）。通过 `AutoCompleteAsync` 在 Invoice/Payment 表单中引用。

| 字段 | 类型 | 说明 | 约束 |
|---|---|---|---|
| _id | ObjectId | 主键 | |
| removed | Boolean | 软删除 | 默认 false |
| enabled | Boolean | 是否启用 | 默认 true |
| name | String | 客户名称 | 必填 |
| phone | String | 电话 | |
| country | String | 国家 | |
| address | String | 地址 | |
| email | String | 客户邮箱 | |
| createdBy | ObjectId → Admin | 创建者 | |
| assigned | ObjectId → Admin | 负责人 | |
| created | Date | | 默认 Date.now |
| updated | Date | | 默认 Date.now |

**插件**：`mongoose-autopopulate`（autopopulate 需在引用处设置 `autopopulate: true`）  
**关联**：Invoice.client（autopopulate）、Payment.client（autopopulate）

---

### Invoice

**文件**：`Invoice.js`  
**集合名**：`invoices`  
**说明**：核心业务文档，代表向客户开具的发票。

| 字段 | 类型 | 说明 | 约束/枚举 |
|---|---|---|---|
| _id | ObjectId | 主键 | |
| removed | Boolean | 软删除 | 默认 false |
| createdBy | ObjectId → Admin | 创建者 | 必填 |
| number | Number | 发票编号（年内序号） | 必填，来自 last_invoice_number+1 |
| year | Number | 年份 | 必填 |
| content | String | 备注内容 | |
| recurring | String | 周期类型 | enum: daily/weekly/monthly/annually/quarter |
| date | Date | 发票日期 | 必填；**已建索引**（供 dashboard/trend 聚合查询）|
| expiredDate | Date | 到期日期 | 必填 |
| client | ObjectId → Client | 客户 | 必填，autopopulate |
| converted.from | String | 来源类型 | enum: 'quote'/'offer' |
| converted.quote | ObjectId → Quote | 来源 Quote | |
| items | Array | 明细行 | 见下 |
| items[].itemName | String | 商品/服务名 | 必填 |
| items[].description | String | 描述 | |
| items[].quantity | Number | 数量 | 必填，默认 1 |
| items[].price | Number | 单价 | 必填 |
| items[].total | Number | 小计（quantity×price） | 必填，由后端计算 |
| taxRate | Number | 税率（百分比，如 10 = 10%） | 默认 0 |
| subTotal | Number | 税前合计 | 由后端计算 |
| taxTotal | Number | 税额合计 | 由后端计算 |
| total | Number | 含税总额 | 由后端计算 |
| currency | String | 货币代码（大写） | 必填，默认 'NA' |
| credit | Number | 已付金额 | 默认 0，由 Payment.create 更新 |
| discount | Number | 优惠金额 | 默认 0 |
| payment | [ObjectId → Payment] | 关联付款记录列表 | |
| paymentStatus | String | 付款状态 | enum: unpaid/paid/partially |
| isOverdue | Boolean | 是否逾期 | 默认 false |
| approved | Boolean | 是否审批通过 | 默认 false |
| notes | String | 备注 | |
| status | String | 发票状态 | enum: draft/pending/sent/refunded/cancelled/on hold，默认 draft |
| pdf | String | PDF 文件名（invoice-{_id}.pdf） | 创建/更新时自动设置 |
| files | Array | 附件列表（id/name/path/description/isPublic） | |
| updated | Date | | 默认 Date.now |
| created | Date | | 默认 Date.now |

**paymentStatus 计算规则**：
- `paid`：`total - discount == credit`
- `partially`：`credit > 0`
- `unpaid`：`credit == 0`

**插件**：`mongoose-autopopulate`

---

### Payment

**文件**：`Payment.js`  
**集合名**：`payments`  
**说明**：记录客户针对某张发票的一次付款。创建时同步更新 Invoice.credit 和 paymentStatus。

| 字段 | 类型 | 说明 | 约束 |
|---|---|---|---|
| _id | ObjectId | 主键 | |
| removed | Boolean | 软删除 | 默认 false |
| createdBy | ObjectId → Admin | 创建者 | 必填，autopopulate |
| number | Number | 付款编号 | 必填 |
| client | ObjectId → Client | 客户 | 必填，autopopulate |
| invoice | ObjectId → Invoice | 关联发票 | 必填，autopopulate |
| date | Date | 付款日期 | 必填，默认 Date.now；**已建索引**（供 dashboard/trend 聚合查询）|
| amount | Number | 付款金额 | 必填，校验：> 0 且 ≤ 剩余未付金额 |
| currency | String | 货币代码 | 必填，默认 'NA' |
| ref | String | 交易参考号 | |
| description | String | 说明 | |
| updated | Date | | 默认 Date.now |
| created | Date | | 默认 Date.now |

**插件**：`mongoose-autopopulate`

---

## 模型关系图

```
Admin (1) ──createdBy──► Invoice (N)
Admin (1) ──createdBy──► Client (N)
Admin (1) ──assigned───► Client (N)
Admin (1) ──createdBy──► Payment (N)
Client (1) ─────────────► Invoice (N)  [Invoice.client]
Client (1) ─────────────► Payment (N)  [Payment.client]
Invoice (1) ────────────► Payment (N)  [Invoice.payment[] / Payment.invoice]
Admin (1) ──user────────► AdminPassword (1)
```

---

## 未发现的模型（OSS 版缺失）

| 模型名 | 说明 | 来源证据 |
|---|---|---|
| Quote | 报价单 | setup/defaultSettings/quoteSettings.json、frontend QuoteModule、financeSettings last_quote_number |
| PaymentMode | 付款方式（现金、转账等） | setup.js 中 `PaymentMode.insertMany`、Payment UI 中 `paymentMode.name` 列 |
| Taxes | 税率配置 | setup.js 中 `Taxes.insertMany`、前端 TaxForm.jsx |
| Offer | 报价（另一类型） | Invoice.converted.from 枚举含 'offer'，Invoice.converted.offer 字段 |

这些模型的文件不在当前 `src/models/appModels/` 目录中，路由注册依赖 glob 扫描，因此对应 API 未被注册。
