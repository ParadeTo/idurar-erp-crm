# Backend API List

本文档基于 `backend/src/app.js`、`backend/src/routes/**`、`backend/src/controllers/**`、`backend/src/models/**` 和前端 `frontend/src/request/**` 扫描生成。项目没有发现独立 `service` 目录；后端业务逻辑主要在 controller 和 middleware 中完成。

## 全局约定

- API 入口：`app.js` 将多个 router 注册到同一个 Express app。
- 公开 API：`/api/login`、`/api/forgetpassword`、`/api/resetpassword`。
- 认证 API：`/api` 下的 coreApiRouter 和 erpApiRouter 均经过 `adminAuth.isValidAuthToken`。
- 认证方式：前端 `request.js` 从 localStorage 的 `auth.current.token` 注入 `Authorization: Bearer <token>`。
- 常见成功结构：

```json
{
  "success": true,
  "result": {},
  "message": "..."
}
```

- 列表接口常见结构：

```json
{
  "success": true,
  "result": [],
  "pagination": { "page": 1, "pages": 1, "count": 1 },
  "message": "..."
}
```

## Auth

### `POST /api/login`

- 说明：Admin 登录。
- 入参：`email`、`password`、可选 `remember`。
- 返回：`result` 包含 `_id`、`name`、`surname`、`role`、`email`、`photo`、`token`、`maxAge`。
- 认证：不需要。
- Controller：`controllers/coreControllers/adminAuth/index.js` -> `createAuthMiddleware('Admin')` -> `login.js`、`authUser.js`。
- Model：`Admin`、`AdminPassword`。

### `POST /api/forgetpassword`

- 说明：根据 email 生成 reset token，并通过 Resend 发送密码重置邮件。
- 入参：`email`。
- 返回：`result: null`，提示检查邮箱。
- 认证：不需要。
- Controller：`createAuthMiddleware/forgetPassword.js`。
- Model：`Admin`、`AdminPassword`、`Setting`。
- 外部集成：`Resend`，环境变量 `RESEND_API`，邮件发件人来自 settings 的 `idurar_app_email`。

### `POST /api/resetpassword`

- 说明：用 `userId` 和 `resetToken` 重设密码，成功后直接登录并返回 token。
- 入参：`password`、`userId`、`resetToken`。
- 返回：同登录结构。
- 认证：不需要。
- Controller：`createAuthMiddleware/resetPassword.js`。
- Model：`Admin`、`AdminPassword`。

### `POST /api/logout`

- 说明：从 `AdminPassword.loggedSessions` 移除当前 token。
- 入参：Authorization header 中的 Bearer token。
- 返回：通用 success 结构。
- 认证：需要。
- Controller：`createAuthMiddleware/logout.js`。
- Model：`AdminPassword`。

## Admin/Profile

### `GET /api/admin/read/:id`

- 说明：读取 Admin 基本资料。
- 入参：路径参数 `id`。
- 返回：`_id`、`enabled`、`email`、`name`、`surname`、`photo`、`role`。
- 认证：需要。
- Controller：`createUserController/read.js`。
- Model：`Admin`。

### `PATCH /api/admin/password-update/:id`

- 说明：按 admin id 修改密码。
- 入参：路径参数 `id`；body: `password`。
- 返回：空对象。
- 认证：需要。
- Controller：`createUserController/updatePassword.js`。
- Model：`AdminPassword`。
- 注意：前端当前主要使用 profile password API；该路径存在但未发现普通页面直接调用。

### `PATCH /api/admin/profile/password`

- 说明：当前登录用户修改自己的密码。
- 入参：`password`、`passwordCheck`。
- 返回：空对象。
- 认证：需要。
- Controller：`createUserController/updateProfilePassword.js`。
- Model：`AdminPassword`。
- 前端调用：`ProfileModule/components/PasswordModal.jsx` 通过 `request.patch({ entity: 'admin/profile/password/' })`。

### `PATCH /api/admin/profile/update`

- 说明：当前登录用户修改个人资料，可上传头像。
- 入参：multipart 或普通表单；`email`、`name`、`surname`、可选 `file/photo`。
- 返回：更新后的 admin 摘要和原 token。
- 认证：需要。
- Middleware：`singleStorageUpload({ entity: 'admin', fieldName: 'photo', fileType: 'image' })`。
- Controller：`createUserController/updateProfile.js`。
- Model：`Admin`。
- 前端调用：`redux/auth/actions.updateProfile` 使用 `request.updateAndUpload({ entity: 'admin/profile' })`，最终请求 `PATCH /api/admin/profile/update/`，Express 可匹配 `/admin/profile/update`。

## Settings

### `POST /api/setting/create`

- 说明：创建 setting 文档，使用通用 CRUD。
- 入参：`settingCategory`、`settingKey`、`settingValue`、`valueType` 等。
- 返回：创建后的 `Setting`。
- 认证：需要。
- Controller：`settingController.create` -> `createCRUDController('Setting').create`。
- Model：`Setting`。

### `GET /api/setting/read/:id`

- 说明：按 `_id` 读取 setting。
- 入参：路径参数 `id`。
- 返回：`Setting`。
- 认证：需要。
- Controller：通用 CRUD read。
- Model：`Setting`。

### `PATCH /api/setting/update/:id`

- 说明：按 `_id` 更新 setting。
- 入参：路径参数 `id`；body 为可更新字段。
- 返回：更新后的 `Setting`。
- 认证：需要。
- Controller：通用 CRUD update。
- Model：`Setting`。

### `GET /api/setting/search`

- 说明：按字段模糊搜索 settings。
- Query：`q`、可选 `fields`，默认字段是 `name`，但 `Setting` 模型没有 `name` 字段；实际搜索应显式传 `fields`。
- 返回：数组。
- 认证：需要。
- Controller：通用 CRUD search。
- Model：`Setting`。

### `GET /api/setting/list`

- 说明：分页列出 settings。
- Query：`page`、`items`、`sortBy`、`sortValue`、`filter`、`equal`、`fields`、`q`。
- 返回：`result` 和 `pagination`。
- 认证：需要。
- Controller：通用 CRUD paginatedList。
- Model：`Setting`。

### `GET /api/setting/listAll`

- 说明：列出所有非私有 settings。
- Query：可选 `sort`。
- 返回：`Setting[]`。
- 认证：需要。
- Controller：`settingController/listAll.js`。
- Model：`Setting`。
- 前端调用：`settingsAction.list({ entity: 'setting' })`。

### `GET /api/setting/filter`

- 说明：按 `filter=字段名&equal=值` 过滤 settings。
- Query：`filter`、`equal`。
- 返回：`Setting[]`。
- 认证：需要。
- Controller：通用 CRUD filter。
- Model：`Setting`。

### `GET /api/setting/readBySettingKey/:settingKey`

- 说明：按 `settingKey` 读取单项设置。
- 入参：路径参数 `settingKey`。
- 返回：`Setting`。
- 认证：需要。
- Controller：`settingController/readBySettingKey.js`。
- Model：`Setting`。

### `GET /api/setting/listBySettingKey`

- 说明：按多个 settingKey 读取设置。
- Query：`settingKeyArray=key1,key2`。
- 返回：`Setting[]`。
- 认证：需要。
- Controller：`settingController/listBySettingKey.js`。
- Model：`Setting`。

### `PATCH /api/setting/updateBySettingKey/:settingKey?`

- 说明：按 settingKey 更新单项设置。
- 入参：路径参数 `settingKey`；body: `settingValue`。
- 返回：更新后的 `Setting`。
- 认证：需要。
- Controller：`settingController/updateBySettingKey.js`。
- Model：`Setting`。

### `PATCH /api/setting/upload/:settingKey?`

- 说明：上传图片并把文件路径写入指定 setting。
- 入参：multipart `file`；路径参数 `settingKey`。
- 前端实际使用示例：`PATCH /api/setting/upload/company_logo`。
- 返回：更新后的 `Setting`。
- 认证：需要。
- Middleware：`singleStorageUpload({ entity: 'setting', fieldName: 'settingValue', fileType: 'image' })`。
- Controller：`settingController/updateBySettingKey.js`。
- Model：`Setting`。
- 前端调用：Company Logo settings。

### `PATCH /api/setting/updateManySetting`

- 说明：批量更新 settings。
- 入参：

```json
{
  "settings": [
    { "settingKey": "company_name", "settingValue": "..." }
  ]
}
```

- 返回：`result: []`。
- 认证：需要。
- Controller：`settingController/updateManySetting.js`。
- Model：`Setting`。

### 未发现

- `DELETE /api/setting/delete/:id` 被注释，未暴露。
- `controllers/coreControllers/setup.js` 存在，但未在 `app.js` 或 routes 中发现注册。

## ERP Generic Routes

`backend/src/routes/appRoutes/appApi.js` 根据 `backend/src/models/appModels/**/*.js` 动态生成实体路由。当前实际发现的 app models：

- `Client` -> entity: `client`
- `Invoice` -> entity: `invoice`
- `Payment` -> entity: `payment`

因此以下模板对 `client`、`invoice`、`payment` 有效。

### `POST /api/:entity/create`

- 说明：创建实体。
- 入参：按实体模型或自定义 controller 要求。
- 返回：创建后的实体。
- 认证：需要。
- Generic controller：`createCRUDController/create.js`。
- Custom controller：`invoiceController/create.js`、`paymentController/create.js` 覆盖了通用创建。
- Model：`Client`、`Invoice`、`Payment`。

### `GET /api/:entity/read/:id`

- 说明：按 `_id` 读取实体。
- 入参：路径参数 `id`。
- 返回：实体。
- 认证：需要。
- Generic controller：`createCRUDController/read.js`。
- Custom controller：`invoiceController/read.js` 会 populate `createdBy`；Payment/Client 使用通用 read。

### `PATCH /api/:entity/update/:id`

- 说明：按 `_id` 更新实体。
- 入参：路径参数 `id`；body 为可更新字段。
- 返回：更新后的实体。
- 认证：需要。
- Generic controller：`createCRUDController/update.js`。
- Custom controller：`invoiceController/update.js`、`paymentController/update.js` 覆盖了通用更新。

### `DELETE /api/:entity/delete/:id`

- 说明：软删除实体，通常设置 `removed: true`。
- 入参：路径参数 `id`。
- 返回：被删除的实体。
- 认证：需要。
- Generic controller：`createCRUDController/remove.js`。
- Custom controller：`invoiceController/remove.js` 会同时软删除关联 payments；`paymentController/remove.js` 会回写 invoice credit/paymentStatus。

### `GET /api/:entity/search`

- 说明：模糊搜索实体。
- Query：`q`、可选 `fields`，默认 `name`。
- 返回：最多 20 条结果。
- 认证：需要。
- Controller：通用 CRUD search。

### `GET /api/:entity/list`

- 说明：分页列表。
- Query：`page`、`items`、`sortBy`、`sortValue`、`filter`、`equal`、`fields`、`q`。
- 返回：`result` 和 `pagination`。
- 认证：需要。
- Generic controller：通用 paginatedList。
- Custom controller：`invoiceController/paginatedList.js` 覆盖 invoice list。

### `GET /api/:entity/listAll`

- 说明：列出全部未删除实体。
- Query：可选 `sort`、`enabled`。
- 返回：实体数组。
- 认证：需要。
- Controller：通用 CRUD listAll。

### `GET /api/:entity/filter`

- 说明：按字段精确过滤。
- Query：`filter`、`equal`。
- 返回：实体数组。
- 认证：需要。
- Controller：通用 CRUD filter。

### `GET /api/:entity/summary`

- 说明：统计摘要。
- Query：部分 custom controller 支持 `type=week|month|year`。
- 返回：按 controller 不同而不同。
- 认证：需要。
- Generic controller：通用 summary。
- Custom controller：`clientController/summary.js`、`invoiceController/summary.js`、`paymentController/summary.js`。

## Client APIs

Client 使用 ERP generic routes，特殊点：

- Entity：`client`
- Model：`Client`
- Controller：`clientController/index.js` 使用通用 CRUD，并覆盖 `summary`。
- 有效路径：
  - `POST /api/client/create`
  - `GET /api/client/read/:id`
  - `PATCH /api/client/update/:id`
  - `DELETE /api/client/delete/:id`
  - `GET /api/client/search`
  - `GET /api/client/list`
  - `GET /api/client/listAll`
  - `GET /api/client/filter`
  - `GET /api/client/summary`
- `GET /api/client/summary` 返回 `{ new, active }`，通过 Client 聚合并 lookup Invoice 计算活跃客户比例。
- 前端页面：`/customer`。

## Invoice APIs

Invoice 使用 ERP generic routes，并覆盖 create/read/update/delete/list/summary/mail。

通用有效路径还包括：

- `GET /api/invoice/read/:id`
- `GET /api/invoice/search`
- `GET /api/invoice/listAll`
- `GET /api/invoice/filter`

### `POST /api/invoice/create`

- 入参：
  - `client`：Client id 或对象
  - `number`、`year`
  - `status`
  - `date`、`expiredDate`
  - `items[]`：`itemName`、`description`、`quantity`、`price`、`total`
  - `taxRate`
  - 可选 `notes`
- 后端行为：Joi 校验；重新计算 `subTotal`、`taxTotal`、`total`；设置 `paymentStatus`、`createdBy`、`pdf`；递增 `last_invoice_number`。
- 返回：创建后的 Invoice。
- Controller：`invoiceController/create.js`。
- Model：`Invoice`、`Setting`。

### `PATCH /api/invoice/update/:id`

- 入参：类似 create。
- 后端行为：重新计算金额；保留原币种；根据 `credit` 计算 `paymentStatus`；更新 `pdf` 文件名。
- Controller：`invoiceController/update.js`。
- Model：`Invoice`。

### `DELETE /api/invoice/delete/:id`

- 后端行为：将 Invoice `removed` 置为 true；将关联 Payment `removed` 置为 true。
- Controller：`invoiceController/remove.js`。
- Model：`Invoice`、`Payment`。

### `GET /api/invoice/list`

- Query：分页、排序、filter/equal、fields/q。
- 返回：发票列表和分页，populate `createdBy`。
- Controller：`invoiceController/paginatedList.js`。
- Model：`Invoice`。

### `GET /api/invoice/summary`

- Query：可选 `type=week|month|year`，其他值返回 400。
- 返回：`total`、`total_undue`、`type`、`performance`。
- Controller：`invoiceController/summary.js`。

### `POST /api/invoice/mail`

- 说明：当前代码没有实际发邮件，直接返回升级提示。
- 入参：前端 `useMail` 发送 `{ id }`。
- 返回：`success: true, result: null`。
- Controller：`invoiceController/sendMail.js`。
- Model：`Invoice`。

## Payment APIs

Payment 使用 ERP generic routes，并覆盖 create/update/delete/summary/mail。

通用有效路径还包括：

- `GET /api/payment/read/:id`
- `GET /api/payment/search`
- `GET /api/payment/list`
- `GET /api/payment/listAll`
- `GET /api/payment/filter`

### `POST /api/payment/create`

- 入参：`invoice`、`client`、`number`、`date`、`amount`、`currency`、可选 `ref`、`description`。
- 前端还会提交 `paymentMode`，但 `Payment` schema 未定义该字段。
- 后端行为：校验 amount 不为 0 且不超过发票未付金额；创建 Payment；尝试写 `pdf`；把 payment id push 到 Invoice.payment；累加 Invoice.credit；更新 Invoice.paymentStatus。
- 返回：Payment 更新结果。
- Controller：`paymentController/create.js`。
- Model：`Payment`、`Invoice`。

### `PATCH /api/payment/update/:id`

- 入参：`number`、`date`、`amount`、`paymentMode`、`ref`、`description`。
- 后端行为：按金额差更新 Payment；同步调整 Invoice.credit 和 paymentStatus。
- Controller：`paymentController/update.js`。
- Model：`Payment`、`Invoice`。
- 注意：`Payment` schema 未定义 `paymentMode`。

### `DELETE /api/payment/delete/:id`

- 后端行为：软删除 Payment；从 Invoice.payment pull 掉 payment id；回退 Invoice.credit；更新 paymentStatus。
- Controller：`paymentController/remove.js`。
- Model：`Payment`、`Invoice`。

### `GET /api/payment/summary`

- Query：可选 `type=week|month|year`，其他值返回 400。
- 返回：`{ count, total }`。
- Controller：`paymentController/summary.js`。
- Model：`Payment`。

### `POST /api/payment/mail`

- 说明：当前代码没有实际发邮件，直接返回升级提示。
- 入参：前端 `useMail` 发送 `{ id }`。
- 返回：`success: true, result: null`。
- Controller：`paymentController/sendMail.js`。
- Model：`Payment`。

## Download/Public

### `GET /download/:directory/:file`

- 说明：按目录和文件名推导 model 和 id，生成 PDF 并下载。
- 入参：例如 `/download/invoice/invoice-<id>.pdf`。
- 前端实际使用示例：
  - `GET /download/invoice/invoice-:id.pdf`
  - `GET /download/payment/payment-:id.pdf`
- 返回：文件下载；失败返回 JSON 错误。
- 认证：不需要。
- Handler：`routes/coreRoutes/coreDownloadRouter.js` -> `handlers/downloadHandler/downloadPdf.js` -> `controllers/pdfController/index.js`。
- Model：按 `directory` 推导，例如 `invoice` -> `Invoice`。
- 文件：`src/public/download/<directory>/<file>`。

### `GET /public/:subPath/:directory/:file`

- 说明：安全读取 `backend/src/public` 下的文件。
- 入参：路径参数 `subPath`、`directory`、`file`。
- 返回：文件；非法路径返回 400，缺失文件返回 404。
- 认证：不需要。
- Handler：`routes/coreRoutes/corePublicRouter.js`。

## 前端引用但后端未发现有效 API

这些能力在前端路由、表单或翻译中出现，但当前后端 appModels 或 routes 中未发现闭环：

- `/quote`、`/quote/create`、`/quote/read/:id`、`/quote/update/:id`：前端 routes.jsx 引用 `Quote` 系列组件，但没有对应 page import；后端未发现 `Quote` model，因此 `appApiRouter` 不会生成 `/api/quote/*`。
- `/payment/mode`：前端 routes.jsx 引用 `PaymentMode`，`PaymentForm` 的 `SelectAsync` 会请求 `GET /api/paymentMode/list`；后端未发现 `PaymentMode` model。
- `/taxes`：前端 routes.jsx 引用 `Taxes`，InvoiceForm 的 tax selector 配置了 entity `taxes`；如果改成异步选择器会对应 `GET /api/taxes/list`，但当前代码实际使用 AntD `Select` 而不是 `SelectAsync`；后端未发现 `Taxes` model。
- Product/Inventory/Order/Employee/Lead：存在部分 form 文件或 README 文字，但未发现当前 routes 中有效页面和后端模型闭环。
