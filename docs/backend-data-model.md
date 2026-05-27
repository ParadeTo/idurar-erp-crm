# Backend Data Model

本文档基于 `backend/src/models/**`、相关 controller 和 setup 默认设置文件生成。项目使用 Mongoose；未发现独立数据库 migration 目录，初始化逻辑在 `backend/src/setup/setup.js` 和默认 settings JSON 中。

## 模型总览

| 模型 | 文件 | 集合职责 | 主要使用位置 |
|---|---|---|---|
| `Admin` | `backend/src/models/coreModels/Admin.js` | 后台登录用户资料 | Auth、Profile、createdBy 关系 |
| `AdminPassword` | `backend/src/models/coreModels/AdminPassword.js` | 密码 hash、token、登录会话 | Auth 登录/登出/重置密码 |
| `Setting` | `backend/src/models/coreModels/Setting.js` | 应用、公司、财务、金额格式等配置 | Settings 页面、PDF、invoice number |
| `Upload ` | `backend/src/models/coreModels/Upload.js` | 上传文件元数据 | 未发现实际写入调用；模型名包含尾随空格 |
| `Client` | `backend/src/models/appModels/Client.js` | 客户资料 | Customer 页面、Invoice/Payment 关联 |
| `Invoice` | `backend/src/models/appModels/Invoice.js` | 发票主数据和明细行 | Invoice 页面、Payment 记录 |
| `Payment` | `backend/src/models/appModels/Payment.js` | 收款记录 | Payment 页面、Invoice record payment |

## Core Models

### Admin

文件：`backend/src/models/coreModels/Admin.js`

职责：保存登录后台的管理员资料。当前角色枚举只有 `owner`。

字段：

| 字段 | 类型 | 约束/默认 | 含义 |
|---|---|---|---|
| `removed` | Boolean | default `false` | 软删除标记 |
| `enabled` | Boolean | default `false` | 是否启用；setup 创建的 demo admin 会设为 true |
| `email` | String | required, lowercase, trim | 登录邮箱 |
| `name` | String | required | 名 |
| `surname` | String | 无 | 姓 |
| `photo` | String | trim | 头像路径，如 `public/uploads/admin/...` |
| `created` | Date | default `Date.now` | 创建时间 |
| `role` | String | default `owner`, enum `['owner']` | 角色 |

关系：

- `AdminPassword.user` 引用 `Admin`。
- `Client.createdBy`、`Client.assigned` 可引用 `Admin`。
- `Invoice.createdBy` 必填引用 `Admin`。
- `Payment.createdBy` 必填引用 `Admin`。

创建/更新位置：

- `setup/setup.js` 创建默认 `admin@admin.com`。
- `createAuthMiddleware/authUser.js` 登录时返回 Admin 摘要。
- `createUserController/updateProfile.js` 更新 profile。

索引：schema 中未显式定义索引；`email` 未定义 unique。

### AdminPassword

文件：`backend/src/models/coreModels/AdminPassword.js`

职责：保存 Admin 密码 hash、salt、邮箱 token、重置 token、登录会话 token。

字段：

| 字段 | 类型 | 约束/默认 | 含义 |
|---|---|---|---|
| `removed` | Boolean | default `false` | 软删除标记 |
| `user` | ObjectId ref `Admin` | required, unique | 所属 Admin |
| `password` | String | required | bcrypt hash |
| `salt` | String | required | hash salt，代码中与明文密码拼接 |
| `emailToken` | String | 无 | 邮箱验证 token |
| `resetToken` | String | 无 | 重置密码 token |
| `emailVerified` | Boolean | default `false` | 邮箱是否验证 |
| `authType` | String | default `email` | 认证类型 |
| `loggedSessions` | String[] | default `[]` | 已登录 JWT 列表；logout 时移除 |

方法：

- `generateHash(salt, password)`：bcrypt hash。
- `validPassword(salt, userpassword)`：bcrypt compare。

创建/更新位置：

- setup 创建默认密码 `admin123`。
- login 成功时 `$push` token 到 `loggedSessions`。
- logout 时移除 token。
- forget/reset/update password 更新 `resetToken` 或 password hash。

索引：

- `user` 字段定义 `unique: true`。
- 代码中有注释掉的 `AdminPasswordSchema.index({ user: 1 })`。

### Setting

文件：`backend/src/models/coreModels/Setting.js`

职责：保存可配置项。前端 Settings 页面和后端 PDF、金额、日期、invoice number 都依赖它。

字段：

| 字段 | 类型 | 约束/默认 | 含义 |
|---|---|---|---|
| `removed` | Boolean | default `false` | 软删除标记 |
| `enabled` | Boolean | default `true` | 是否启用 |
| `settingCategory` | String | required, lowercase | 配置分类，如 `app_settings` |
| `settingKey` | String | required, lowercase | 配置 key |
| `settingValue` | Mixed | 无 | 配置值 |
| `valueType` | String | default `String` | 值类型描述 |
| `isPrivate` | Boolean | default `false` | 是否对 listAll 隐藏 |
| `isCoreSetting` | Boolean | default `false` | 是否核心设置 |

默认数据来源：

- `backend/src/setup/defaultSettings/appSettings.json`
- `clientSettings.json`
- `companySettings.json`
- `financeSettings.json`
- `invoiceSettings.json`
- `moneyFormatSettings.json`
- `quoteSettings.json`

创建/更新位置：

- setup 批量 insert 默认 settings。
- Settings APIs：`updateBySettingKey`、`updateManySetting`、`upload`。
- `invoiceController/create.js` 通过 `increaseBySettingKey({ settingKey: 'last_invoice_number' })` 自增发票编号。

索引：未发现显式索引；`settingKey` 未定义 unique。

### Upload

文件：`backend/src/models/coreModels/Upload.js`

职责：定义上传文件元数据结构。

字段：

| 字段 | 类型 | 约束/默认 | 含义 |
|---|---|---|---|
| `removed` | Boolean | default `false` | 软删除标记 |
| `enabled` | Boolean | default `true` | 是否启用 |
| `modelName` | String | trim | 关联模型名 |
| `fieldId` | String | required | 关联记录 id |
| `fileName` | String | required | 文件名 |
| `fileType` | String enum | required | 文件类型，支持图片、文档、视频、音频等 |
| `isPublic` | Boolean | required | 是否公开 |
| `userID` | ObjectId | required | 上传者 |
| `isSecure` | Boolean | required | 是否安全文件 |
| `path` | String | required | 文件路径 |
| `created` | Date | default `Date.now` | 创建时间 |

注意：

- `module.exports = mongoose.model('Upload ', uploadSchema);` 中模型名有尾随空格。
- 当前上传 middleware 只把路径写到 req.body，没有发现实际创建 `Upload ` 文档的位置。

## App Models

### Client

文件：`backend/src/models/appModels/Client.js`

业务含义：客户，也就是前端页面中的 Customer。

字段：

| 字段 | 类型 | 约束/默认 | 含义 |
|---|---|---|---|
| `removed` | Boolean | default `false` | 软删除标记 |
| `enabled` | Boolean | default `true` | 是否启用 |
| `name` | String | required | 客户名称 |
| `phone` | String | 无 | 电话 |
| `country` | String | 无 | 国家 |
| `address` | String | 无 | 地址 |
| `email` | String | 无 | 邮箱 |
| `createdBy` | ObjectId ref `Admin` | 无 | 创建人 |
| `assigned` | ObjectId ref `Admin` | 无 | 负责人 |
| `created` | Date | default `Date.now` | 创建时间 |
| `updated` | Date | default `Date.now` | 更新时间 |

关系：

- `Invoice.client` 必填引用 `Client`，autopopulate。
- `Payment.client` 必填引用 `Client`，autopopulate。
- `Client.summary` 通过 `$lookup` Invoice 判断活跃客户。

创建/更新位置：

- 前端 `/customer` 使用 CrudModule + DynamicForm。
- 后端使用通用 CRUD controller。

索引：未发现显式索引。

### Invoice

文件：`backend/src/models/appModels/Invoice.js`

业务含义：发票，包含客户、明细行、税、金额、支付状态和 PDF 文件名。

字段：

| 字段 | 类型 | 约束/默认 | 含义 |
|---|---|---|---|
| `removed` | Boolean | default `false` | 软删除标记 |
| `createdBy` | ObjectId ref `Admin` | required | 创建人 |
| `number` | Number | required | 发票编号 |
| `year` | Number | required | 年份 |
| `content` | String | 无 | 内容 |
| `recurring` | String enum | `daily/week/monthly/annually/quarter` | 重复周期 |
| `date` | Date | required | 发票日期 |
| `expiredDate` | Date | required | 到期日期 |
| `client` | ObjectId ref `Client` | required, autopopulate | 客户 |
| `converted` | Object | 无 | 从 quote/offer 转换来源 |
| `items` | Array | required fields inside | 明细行 |
| `taxRate` | Number | default `0` | 税率 |
| `subTotal` | Number | default `0` | 未税小计 |
| `taxTotal` | Number | default `0` | 税额 |
| `total` | Number | default `0` | 总额 |
| `currency` | String | default `NA`, uppercase, required | 币种 |
| `credit` | Number | default `0` | 已收款金额 |
| `discount` | Number | default `0` | 折扣 |
| `payment` | ObjectId[] ref `Payment` | 无 | 关联收款 |
| `paymentStatus` | String enum | default `unpaid`; `unpaid/paid/partially` | 收款状态 |
| `isOverdue` | Boolean | default `false` | 是否逾期 |
| `approved` | Boolean | default `false` | 是否批准 |
| `notes` | String | 无 | 备注 |
| `status` | String enum | default `draft`; `draft/pending/sent/refunded/cancelled/on hold` | 发票状态 |
| `pdf` | String | 无 | PDF 文件名 |
| `files` | Array | 无 | 附件元数据 |
| `updated` | Date | default `Date.now` | 更新时间 |
| `created` | Date | default `Date.now` | 创建时间 |

`items[]` 字段：

- `itemName`：String, required
- `description`：String
- `quantity`：Number, required, default 1
- `price`：Number, required
- `total`：Number, required

关系：

- `createdBy` -> `Admin`
- `client` -> `Client`
- `payment[]` -> `Payment`
- `converted.quote` -> `Quote`，`converted.offer` -> `Offer`，但 `Quote`/`Offer` 模型未发现。

创建/更新位置：

- `invoiceController/create.js`：Joi 校验，计算金额，设置 `createdBy`，保存后写 `pdf`，递增 `last_invoice_number`。
- `invoiceController/update.js`：重新计算金额，保留原 currency，按 credit 计算 paymentStatus。
- `paymentController/create/update/remove.js`：回写 `credit`、`payment`、`paymentStatus`。

索引：未发现显式索引。

### Payment

文件：`backend/src/models/appModels/Payment.js`

业务含义：收款记录，关联客户和发票。

字段：

| 字段 | 类型 | 约束/默认 | 含义 |
|---|---|---|---|
| `removed` | Boolean | default `false` | 软删除标记 |
| `createdBy` | ObjectId ref `Admin` | required, autopopulate | 创建人 |
| `number` | Number | required | 收款编号 |
| `client` | ObjectId ref `Client` | required, autopopulate | 客户 |
| `invoice` | ObjectId ref `Invoice` | required, autopopulate | 发票 |
| `date` | Date | default `Date.now`, required | 收款日期 |
| `amount` | Number | required | 收款金额 |
| `currency` | String | default `NA`, uppercase, required | 币种 |
| `ref` | String | 无 | 参考号 |
| `description` | String | 无 | 描述 |
| `updated` | Date | default `Date.now` | 更新时间 |
| `created` | Date | default `Date.now` | 创建时间 |

关系：

- `client` -> `Client`
- `invoice` -> `Invoice`
- `createdBy` -> `Admin`
- Payment 创建、更新、删除都会同步 Invoice 的 `credit` 和 `paymentStatus`。

创建/更新位置：

- `paymentController/create.js`：校验金额，创建 Payment，回写 Invoice。
- `paymentController/update.js`：按金额差回写 Invoice。
- `paymentController/remove.js`：软删除并回退 Invoice。

注意：

- 前端 `PaymentForm` 和 controller update 使用 `paymentMode`，但 `Payment` schema 未定义该字段。
- controller create 尝试设置 `pdf`，但 `Payment` schema 未定义 `pdf` 字段。

索引：未发现显式索引。

## 关系图摘要

- `Admin 1 -> 1 AdminPassword`
- `Admin 1 -> n Invoice.createdBy`
- `Admin 1 -> n Payment.createdBy`
- `Client 1 -> n Invoice`
- `Client 1 -> n Payment`
- `Invoice 1 -> n Payment`
- `Setting` 独立存在，但被 PDF、前端设置、发票编号等流程读取。

## 未发现或不闭合模型

- `Quote`：README、前端 QuoteModule、PDF 模板、Invoice.converted 引用存在；后端 model 未发现，routes 不会生成 `/api/quote/*`。
- `Offer`：PDF 模板和 Invoice.converted 引用存在；后端 model 未发现。
- `Taxes`：setup 引用 `models/appModels/Taxes`，前端 TaxForm/路由引用存在；模型文件未发现。
- `PaymentMode`：setup 引用 `models/appModels/PaymentMode`，前端 PaymentForm 使用 entity `paymentMode`；模型文件未发现。
- `Product`：Invoice.items 中 product 引用被注释；前端存在 Inventory/Order 表单片段；后端 model 未发现。
- 独立 `service` 层：未发现。
