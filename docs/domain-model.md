# Domain Model

本文档把前后端共同出现的核心概念整理为业务领域模型。每个模型都标注前端展示位置、后端 API、后端数据模型和关联关系；未形成闭环的概念明确标为未发现。

## Admin / User

- 业务含义：系统后台使用者。当前后端模型只发现 `Admin`，角色 enum 只有 `owner`。
- 前端展示位置：
  - Login/Logout/ResetPassword
  - Header avatar
  - Profile page
- 后端 API：
  - `POST /api/login`
  - `POST /api/logout`
  - `POST /api/forgetpassword`
  - `POST /api/resetpassword`
  - `GET /api/admin/read/:id`
  - `PATCH /api/admin/profile/update`
  - `PATCH /api/admin/profile/password`
- 后端数据模型：
  - `Admin`
  - `AdminPassword`
- 关键字段：
  - `Admin.email/name/surname/photo/role/enabled`
  - `AdminPassword.password/salt/resetToken/loggedSessions`
- 关联关系：
  - `AdminPassword.user -> Admin`
  - `Invoice.createdBy -> Admin`
  - `Payment.createdBy -> Admin`

## Customer / Client

- 业务含义：客户。前端叫 Customer，后端模型和 API entity 叫 Client/client。
- 前端展示位置：
  - `/customer`
  - InvoiceForm 的 client autocomplete
  - Invoice/Payment table 和 detail
- 后端 API：
  - `GET /api/client/list`
  - `GET /api/client/search`
  - `POST /api/client/create`
  - `GET /api/client/read/:id`
  - `PATCH /api/client/update/:id`
  - `DELETE /api/client/delete/:id`
  - `GET /api/client/summary`
- 后端数据模型：`Client`
- 关键字段：`name` required，`phone`、`country`、`address`、`email`、`createdBy`、`assigned`。
- 关联关系：
  - `Invoice.client -> Client`
  - `Payment.client -> Client`
- 注意：Client 使用通用 CRUD，summary 是自定义聚合。

## Invoice

- 业务含义：发票，包含客户、明细、税额、总额、状态和收款状态。
- 前端展示位置：
  - `/` 和 `/invoice`
  - `/invoice/create`
  - `/invoice/read/:id`
  - `/invoice/update/:id`
  - `/invoice/pay/:id`
- 后端 API：
  - `GET /api/invoice/list`
  - `POST /api/invoice/create`
  - `GET /api/invoice/read/:id`
  - `PATCH /api/invoice/update/:id`
  - `DELETE /api/invoice/delete/:id`
  - `GET /api/invoice/summary`
  - `POST /api/invoice/mail`
  - `GET /download/invoice/invoice-:id.pdf`
- 后端数据模型：`Invoice`
- 关键字段：
  - 编号：`number`、`year`
  - 日期：`date`、`expiredDate`
  - 客户：`client`
  - 明细：`items.itemName/description/quantity/price/total`
  - 金额：`taxRate/subTotal/taxTotal/total/currency/discount/credit`
  - 状态：`status/paymentStatus/isOverdue/approved`
  - 文件：`pdf/files`
- 关联关系：
  - `createdBy -> Admin`
  - `client -> Client`
  - `payment[] -> Payment`
- 业务规则：
  - 前端会预计算行金额，但后端 create/update 会重新计算金额。
  - 创建后自增 Setting `last_invoice_number`。
  - 删除发票会软删除相关 Payment。

## Payment

- 业务含义：收款记录，表示某张发票收到的一笔金额。
- 前端展示位置：
  - `/payment`
  - `/payment/read/:id`
  - `/payment/update/:id`
  - `/invoice/pay/:id`
- 后端 API：
  - `GET /api/payment/list`
  - `POST /api/payment/create`
  - `GET /api/payment/read/:id`
  - `PATCH /api/payment/update/:id`
  - `DELETE /api/payment/delete/:id`
  - `GET /api/payment/summary`
  - `POST /api/payment/mail`
  - `GET /download/payment/payment-:id.pdf`
- 后端数据模型：`Payment`
- 关键字段：`number`、`client`、`invoice`、`date`、`amount`、`currency`、`ref`、`description`。
- 关联关系：
  - `createdBy -> Admin`
  - `client -> Client`
  - `invoice -> Invoice`
- 业务规则：
  - 创建/更新/删除 Payment 会同步 Invoice 的 `credit` 和 `paymentStatus`。
  - amount 不能为 0，不能超过发票剩余可收金额。
- 注意：
  - 前端使用 `paymentMode`，但 `Payment` schema 未定义该字段。
  - 后端尝试写 Payment `pdf`，但 schema 未定义 `pdf` 字段。

## Setting

- 业务含义：系统配置，包括应用、公司、财务编号、币种格式、发票/报价文案等。
- 前端展示位置：
  - `/settings`
  - `/settings/edit/:settingsKey`
  - `InvoiceForm` 读取 `last_invoice_number`
  - Header/Profile 读取文件基础 URL 和当前用户信息
- 后端 API：
  - `GET /api/setting/listAll`
  - `PATCH /api/setting/updateManySetting`
  - `PATCH /api/setting/updateBySettingKey/:settingKey`
  - `PATCH /api/setting/upload/:settingKey`
  - 其他通用 CRUD/search/filter/read API
- 后端数据模型：`Setting`
- 关键字段：`settingCategory`、`settingKey`、`settingValue`、`valueType`、`isPrivate`、`isCoreSetting`。
- 关联关系：
  - 不是关系型外键；被前后端多个流程按 key 读取。
- 业务规则：
  - `listAll` 排除 `isPrivate: true`。
  - settingsAction 会把 settings 按 category 聚合后写入 localStorage。
  - 创建 Invoice 时 `last_invoice_number` 自增。

## File / Upload / PDF

- 业务含义：头像、公司 logo、PDF 下载文件。
- 前端展示位置：
  - Profile avatar
  - Company Logo settings
  - Invoice/Payment 下载 PDF 按钮
- 后端 API：
  - `PATCH /api/admin/profile/update`
  - `PATCH /api/setting/upload/:settingKey`
  - `GET /download/:directory/:file`
  - `GET /public/:subPath/:directory/:file`
- 后端数据模型：
  - `Upload ` 模型存在，但未发现实际写入。
  - Invoice 有 `pdf` 字段和 `files[]`。
- 关键字段：
  - 文件路径通常是 `public/uploads/<entity>/<file>`。
  - PDF 路径是 `src/public/download/<directory>/<file>`。
- 关联关系：
  - Admin.photo 存头像路径。
  - Setting.settingValue 可存 company_logo 路径。
  - Invoice.pdf 存 PDF 文件名。

## Quote

- 业务含义：报价单。
- 前端展示位置：
  - `QuoteModule` 文件存在。
  - `routes.jsx` 引用 `/quote` 系列路由。
  - `Navigation` 有 `/quote` 菜单。
- 后端 API：未发现有效 `/api/quote/*`，因为 `Quote` model 未发现。
- 后端数据模型：未发现。
- 关联关系：
  - `Invoice.converted.quote` 引用 `Quote`，但目标模型未发现。
- 结论：概念存在于 README、前端模块和 PDF 模板，但当前代码闭环不完整。

## Taxes

- 业务含义：税率配置。
- 前端展示位置：
  - `TaxForm.jsx` 存在。
  - `routes.jsx` 引用 `/taxes`。
  - `InvoiceForm` 中税率字段配置了 redirect 到 `/taxes`。
- 后端 API：未发现有效 `/api/taxes/*`。
- 后端数据模型：未发现 `Taxes` model。
- 注意：setup 代码尝试 require/使用 `Taxes`，但文件不存在。

## PaymentMode

- 业务含义：收款方式。
- 前端展示位置：
  - `PaymentModeForm.jsx` 存在。
  - `PaymentForm` 使用 `SelectAsync entity='paymentMode'`。
  - `routes.jsx` 引用 `/payment/mode`。
- 后端 API：未发现有效 `/api/paymentMode/*`。
- 后端数据模型：未发现 `PaymentMode` model。
- 注意：setup 代码尝试 require/使用 `PaymentMode`，但文件不存在。

## Product / Inventory / Order / Employee / Lead

- 业务含义：README 提到 Inventory/HR，前端有若干表单文件。
- 前端展示位置：
  - `InventoryForm.jsx`
  - `OrderForm.jsx`
  - `EmployeeForm.jsx`
  - `LeadForm.jsx`
- 后端 API：未发现有效模型和 routes。
- 后端数据模型：未发现。
- 结论：当前主干业务闭环不包含这些领域对象。
