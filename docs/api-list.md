# API 清单

后端运行在 `http://localhost:8888`，统一前缀 `/api`。  
所有响应体结构：`{ success: boolean, result: any, message: string }`。

---

## 认证规则

| 路由组 | 认证 | 实现位置 |
|---|---|---|
| `/api/login` `/api/forgetpassword` `/api/resetpassword` | 无需认证 | `coreAuthRouter` |
| 其他 `/api/*` | Bearer JWT（`Authorization: Bearer <token>`） | `isValidAuthToken` middleware |
| `/download/*` | 无需认证 | `coreDownloadRouter` |

Token 由登录接口签发，存入 `AdminPassword.loggedSessions[]`；退出时从数组中删除。

---

## 1. 认证模块（Auth）

路由文件：`src/routes/coreRoutes/coreAuth.js`  
Controller：`src/controllers/middlewaresControllers/createAuthMiddleware/`

### POST /api/login

**说明**：用 email + password 登录，返回 JWT token。  
**认证**：无  
**入参（Body）**：
```json
{ "email": "admin@admin.com", "password": "admin123", "remember": false }
```
`remember: true` → token 有效期 365 天；否则 24 小时。

**返回（200）**：
```json
{
  "result": {
    "_id": "...", "name": "...", "surname": "...",
    "role": "owner", "email": "...", "photo": "...",
    "token": "<jwt>", "maxAge": null
  }
}
```
**失败**：404（用户不存在）、403（密码错误）、409（账号已禁用 / 参数校验失败）

---

### POST /api/forgetpassword

**说明**：生成 resetToken，通过 Resend 发送重置邮件（需配置 `RESEND_API` 和 `idurar_app_email` 设置）。  
**认证**：无  
**入参**：`{ "email": "..." }`  
**返回（200）**：`{ "result": null, "message": "Check your email inbox..." }`  
**失败**：404（用户不存在）、409（邮箱格式错误）

---

### POST /api/resetpassword

**说明**：通过 userId + resetToken 重置密码。  
**认证**：无  
**入参**：`{ "userId": "...", "resetToken": "...", "password": "..." }`  
**返回（200）**：成功后返回新 token（与登录返回相同结构）

---

### POST /api/logout

**说明**：从 `AdminPassword.loggedSessions` 中删除当前 token。  
**认证**：需要 JWT  
**入参**：无  
**返回（200）**：`{ "result": {}, "message": "Successfully logout" }`

---

## 2. 管理员模块（Admin）

路由文件：`src/routes/coreRoutes/coreApi.js`  
Controller：`src/controllers/middlewaresControllers/createUserController/`

### GET /api/admin/read/:id

**说明**：读取指定管理员信息。  
**认证**：JWT  
**返回**：Admin 文档（不含密码）

### PATCH /api/admin/password-update/:id

**说明**：由管理员更新某 id 用户的密码。  
**认证**：JWT  
**入参**：`{ "password": "...", "passwordConfirm": "..." }`

### PATCH /api/admin/profile/password

**说明**：当前登录用户修改自己的密码（至少 8 位，二次确认）。  
**认证**：JWT  
**入参**：`{ "password": "...", "passwordCheck": "..." }`  
**注意**：demo 账号（admin@admin.com）被禁止修改密码

### PATCH /api/admin/profile/update

**说明**：更新当前用户的 name / surname / email / photo（multipart/form-data）。  
**认证**：JWT  
**入参**：Form 字段 `name, surname, email, photo(file)`  
**返回**：更新后的 Admin 对象（含新 token）  
**注意**：demo 账号（admin@demo.com）被禁止更新

---

## 3. 系统设置模块（Setting）

路由文件：`src/routes/coreRoutes/coreApi.js`  
Controller：`src/controllers/coreControllers/settingController/`  
Model：`Setting`（settingCategory / settingKey / settingValue）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/setting/create | 新建一条设置项 |
| GET | /api/setting/read/:id | 按 ObjectId 读取 |
| PATCH | /api/setting/update/:id | 更新设置项 |
| GET | /api/setting/search | 模糊搜索（`?q=&fields=`） |
| GET | /api/setting/list | 分页列表（`?page=&items=`） |
| GET | /api/setting/listAll | 全量列表（无分页） |
| GET | /api/setting/filter | 按字段等值过滤（`?filter=&equal=`） |
| GET | /api/setting/readBySettingKey/:settingKey | 按 settingKey 读取单项 |
| GET | /api/setting/listBySettingKey | 批量按 settingKey 读取 |
| PATCH | /api/setting/updateBySettingKey/:settingKey? | 按 settingKey 更新 settingValue |
| PATCH | /api/setting/upload/:settingKey? | 上传图片并更新 settingValue（multipart） |
| PATCH | /api/setting/updateManySetting | 批量更新 `[{settingKey, settingValue}]` |

常用 settingKey 见 `src/setup/defaultSettings/`。

---

## 4. Invoice 模块

路由文件：`src/routes/appRoutes/appApi.js`（自动生成）  
Controller：`src/controllers/appControllers/invoiceController/`  
Model：`Invoice`

| 方法 | 路径 | 说明 | 认证 |
|---|---|---|---|
| POST | /api/invoice/create | 创建发票 | JWT |
| GET | /api/invoice/read/:id | 读取发票（含 Client 自动填充） | JWT |
| PATCH | /api/invoice/update/:id | 更新发票，重新计算金额 | JWT |
| DELETE | /api/invoice/delete/:id | 软删除（`removed: true`） | JWT |
| GET | /api/invoice/search | 模糊搜索（`?q=&fields=`，最多 20 条） | JWT |
| GET | /api/invoice/list | 分页列表（`?page=&items=&sortBy=&sortValue=&filter=&equal=`） | JWT |
| GET | /api/invoice/listAll | 全量列表 | JWT |
| GET | /api/invoice/filter | 等值过滤 | JWT |
| GET | /api/invoice/summary | 统计汇总（`?type=week/month/year`） | JWT |
| POST | /api/invoice/mail | 发送发票邮件（OSS 版返回"请升级到 Premium"） | JWT |

**create 入参（Body）**：
```json
{
  "client": "<clientId>",
  "number": 1,
  "year": 2024,
  "status": "draft",
  "date": "2024-01-01",
  "expiredDate": "2024-02-01",
  "items": [{ "itemName": "服务费", "quantity": 1, "price": 1000, "total": 1000 }],
  "taxRate": 10,
  "discount": 0,
  "currency": "USD",
  "notes": ""
}
```
后端自动计算 `subTotal / taxTotal / total / paymentStatus`，并自增 `last_invoice_number`。

**summary 返回**：
```json
{
  "total": 50000,
  "total_undue": 12000,
  "type": "month",
  "performance": [{ "status": "paid", "count": 3, "percentage": 60 }]
}
```

---

## 5. Client（Customer）模块

路由文件：`src/routes/appRoutes/appApi.js`  
Controller：`src/controllers/appControllers/clientController/` + `createCRUDController('Client')`  
Model：`Client`

| 方法 | 路径 | 说明 | 认证 |
|---|---|---|---|
| POST | /api/client/create | 创建客户 | JWT |
| GET | /api/client/read/:id | 读取客户 | JWT |
| PATCH | /api/client/update/:id | 更新客户 | JWT |
| DELETE | /api/client/delete/:id | 软删除 | JWT |
| GET | /api/client/search | 按 name 模糊搜索 | JWT |
| GET | /api/client/list | 分页列表 | JWT |
| GET | /api/client/listAll | 全量列表 | JWT |
| GET | /api/client/filter | 等值过滤 | JWT |
| GET | /api/client/summary | 统计（`?type=week/month/year`）返回 new/active 客户百分比 | JWT |

**create 入参**：`{ "name": "...", "phone": "...", "country": "...", "address": "...", "email": "..." }`

---

## 6. Payment 模块

路由文件：`src/routes/appRoutes/appApi.js`  
Controller：`src/controllers/appControllers/paymentController/`  
Model：`Payment`

| 方法 | 路径 | 说明 | 认证 |
|---|---|---|---|
| POST | /api/payment/create | 记录付款，同步更新 Invoice.credit 和 paymentStatus | JWT |
| GET | /api/payment/read/:id | 读取付款记录（含 Invoice、Client 自动填充） | JWT |
| PATCH | /api/payment/update/:id | 更新付款，同步调整 Invoice.credit | JWT |
| DELETE | /api/payment/delete/:id | 软删除 | JWT |
| GET | /api/payment/search | 搜索 | JWT |
| GET | /api/payment/list | 分页列表 | JWT |
| GET | /api/payment/listAll | 全量 | JWT |
| GET | /api/payment/filter | 过滤 | JWT |
| GET | /api/payment/summary | 汇总（total count + total amount） | JWT |
| POST | /api/payment/mail | 发送邮件（OSS 版为 stub） | JWT |

**create 入参**：
```json
{
  "invoice": "<invoiceId>",
  "client": "<clientId>",
  "amount": 500,
  "date": "2024-01-15",
  "currency": "USD",
  "ref": "TXN-001",
  "description": "..."
}
```
后端校验：`amount > 0`，`amount <= (total - discount - credit)`；超额返回 202。

---

## 7. PDF 下载

路由文件：`src/routes/coreRoutes/coreDownloadRouter.js`  
Handler：`src/handlers/downloadHandler/downloadPdf.js`

### GET /download/:directory/:file

**说明**：按需生成并下载 PDF 文件。  
**认证**：无  
**参数**：`directory` = invoice/payment/quote，`file` = invoice-{id}.pdf  
**示例**：`GET /download/invoice/invoice-6643a1b2c3.pdf`  
**实现**：从 MongoDB 查询记录，用 pug 模板 + html-pdf 渲染，写入 `src/public/{directory}/`，然后流式响应。

---

## 未发现的 API

- Quote 后端 API（`/api/quote/*`）：路由注册器 `appApi.js` 依赖 appModels glob，当前 appModels 目录中**无 Quote.js 文件**，因此 Quote 路由**未注册**。
- PaymentMode API（`/api/paymentmode/*`）：同上，无 PaymentMode.js model 文件。
- Taxes API（`/api/taxes/*`）：同上，无 Taxes.js model 文件。
- 文件上传独立接口：上传通过 `singleStorageUpload` Multer 中间件附加到各自的 update/upload 路由。
