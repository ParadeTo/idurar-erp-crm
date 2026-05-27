# Data Flow

本文档选择三个当前代码中闭环较完整的流程，说明用户操作如何经过前端状态、API、后端 controller/model，再回到 UI。

## Flow 1: 创建 Invoice

### 1. 用户操作

- 用户进入 `/invoice/create`。
- `InvoiceCreate` 设置 `entity = 'invoice'` 并渲染 `CreateInvoiceModule`。
- `CreateInvoiceModule` 使用 `ErpLayout`，内部渲染 `CreateItem` 和 `InvoiceForm`。

### 2. 前端表单和状态

- `InvoiceForm`：
  - 从 Redux `settings.finance_settings.last_invoice_number` 读取下一发票号。
  - 通过 `AutoCompleteAsync entity='client'` 搜索客户。
  - 使用本地 state 维护 `taxRate`、`taxTotal`、`total`。
- `CreateItem`：
  - 在 `onValuesChange` 中根据 items 计算 `subTotal`。
  - 提交时再次为每个 item 写入 `item.total`。

### 3. API 请求

- `CreateItem.onSubmit` dispatch：

```js
erp.create({ entity: 'invoice', jsonData: fieldsValue })
```

- `redux/erp/actions.create` 调用：

```js
request.create({ entity: 'invoice', jsonData })
```

- `request.create` 发出：

```http
POST /api/invoice/create
Authorization: Bearer <token>
```

### 4. 后端路由和认证

- `app.js` 匹配：

```js
app.use('/api', adminAuth.isValidAuthToken, erpApiRouter)
```

- `isValidAuthToken`：
  - 读取 Authorization header。
  - `jwt.verify(token, JWT_SECRET)`。
  - 查询 `Admin` 和 `AdminPassword`。
  - 确认 token 在 `loggedSessions`。
  - 设置 `req.admin`。

### 5. Controller 和模型

- `appApiRouter` 动态生成 `POST /invoice/create`。
- `invoiceController/create.js`：
  - 用 Joi 校验 `client/number/year/status/date/expiredDate/items/taxRate`。
  - 后端重新计算每个 item total、`subTotal`、`taxTotal`、`total`。
  - 设置 `paymentStatus`。
  - 设置 `createdBy = req.admin._id`。
  - `new Invoice(body).save()`。
  - 更新 `pdf = invoice-<id>.pdf`。
  - `increaseBySettingKey({ settingKey: 'last_invoice_number' })`。

### 6. 数据库变化

- 新增 `Invoice` 文档。
- 更新同一 Invoice 的 `pdf` 字段。
- 更新 `Setting.last_invoice_number`。

### 7. 响应和 UI 更新

- API 返回：

```json
{
  "success": true,
  "result": { "_id": "...", "number": 1 },
  "message": "Invoice created successfully"
}
```

- `erp.create` 写入：
  - `erp.create.result`
  - `erp.current.result`
- `CreateItem` 监听 `isSuccess`：
  - 重置表单。
  - reset `create` action。
  - `navigate('/invoice/read/<id>')`。

## Flow 2: 为 Invoice 记录 Payment

### 1. 用户操作

- 用户在 `/invoice` 列表 action dropdown 中点击 `Record Payment`，或直接进入 `/invoice/pay/:id`。
- `RecordPaymentModule` 从 URL 读取 `id`。

### 2. 前端状态

- `RecordPaymentModule`：
  - 先尝试从 `erp.list.result.items` 中找当前 invoice。
  - 找不到则 dispatch `erp.read({ entity: 'invoice', id })`。
  - 将 invoice 写入 `erp.current`。
  - 再写入 `erp.recordPayment.current`。
- `RecordPayment`：
  - 从当前 invoice 计算 `maxAmount = total - discount - credit`。
  - 提交 PaymentForm 时补充 `invoice` 和 `client` 字段。

### 3. API 请求

```js
erp.recordPayment({
  entity: 'payment',
  jsonData: {
    invoice,
    client,
    number,
    date,
    amount,
    paymentMode,
    ref,
    description
  }
})
```

对应请求：

```http
POST /api/payment/create
Authorization: Bearer <token>
```

### 4. 后端 controller

- `paymentController/create.js`：
  - 拒绝 `amount === 0`。
  - 查询当前 `Invoice`。
  - 计算最大可收金额 `total - discount - credit`。
  - 如果 amount 超过可收金额，返回 202。
  - 设置 `createdBy = req.admin._id`。
  - 创建 `Payment`。
  - 尝试更新 Payment `pdf` 字段。
  - 计算新的 `paymentStatus`。
  - 更新 Invoice：
    - `$push: { payment: paymentId }`
    - `$inc: { credit: amount }`
    - `$set: { paymentStatus }`

### 5. 数据库变化

- 新增 `Payment`。
- 更新对应 `Invoice.credit`、`Invoice.payment[]`、`Invoice.paymentStatus`。

### 6. 响应和 UI 更新

- `erp.recordPayment` 写入 `recordPayment.result`。
- 成功后 `RecordPayment`：
  - reset 表单。
  - reset recordPayment action。
  - dispatch `erp.list({ entity: 'invoice' })`。
  - navigate `/invoice/`。

### 7. 已发现的不一致

- `PaymentForm` 提交 `paymentMode`，controller update 也处理 `paymentMode`，但 `Payment` schema 未定义该字段。
- `paymentController/create` 尝试写 `pdf`，但 `Payment` schema 未定义 `pdf`。

## Flow 3: 更新 Settings

### 1. 用户操作

- 用户进入 `/settings` 或 `/settings/edit/:settingsKey`。
- `Settings` 页面以 Tabs 展示 General、Company、Company Logo、Currency、Finance。

### 2. 前端状态

- `ErpApp` mount 时 dispatch：

```js
settingsAction.list({ entity: 'setting' })
```

- 成功后：
  - API 返回 `Setting[]`。
  - `dispatchSettingsData` 按 `settingCategory` 聚合。
  - 写入 Redux `settings.result`。
  - 写入 localStorage `settings`。

### 3. 批量更新普通设置

- `UpdateSettingForm` 收集当前 tab 的 AntD Form 字段。
- 转换为：

```json
{
  "settings": [
    { "settingKey": "company_name", "settingValue": "..." }
  ]
}
```

- dispatch：

```js
settingsAction.updateMany({ entity: 'setting', jsonData: { settings } })
```

- API：

```http
PATCH /api/setting/updateManySetting
Authorization: Bearer <token>
```

### 4. 后端 controller

- `settingController/updateManySetting.js`：
  - 遍历 `settings`。
  - 每个 item 必须包含 `settingKey` 和 `settingValue`。
  - 生成 `bulkWrite(updateOne[])`。
  - 执行 `Setting.bulkWrite(updateDataArray)`。

### 5. 响应和 UI 更新

- 成功后 `settingsAction.updateMany` 再次调用 `request.listAll({ entity: 'setting' })`。
- Redux `settings.result` 和 localStorage `settings` 被刷新。
- 使用 settings 的组件，例如 `useMoney`、`useDate`、InvoiceForm，会在 state 更新后读取新值。

### 6. Company Logo 上传分支

- `CompanyLogoSettingsModule` 传入 `withUpload` 和 `uploadSettingKey="company_logo"`。
- 前端限制 jpg/png，小于 5MB。
- API：

```http
PATCH /api/setting/upload/company_logo
Content-Type: multipart/form-data
```

- 后端 middleware：
  - `singleStorageUpload({ entity: 'setting', fieldName: 'settingValue', fileType: 'image' })`
  - 文件写入 `src/public/uploads/setting`
  - `req.body.settingValue` 写成 public 路径
- Controller 复用 `updateBySettingKey` 更新 Setting。
