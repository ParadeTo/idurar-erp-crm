# 前端用户操作清单

按页面分组，列出所有用户可触发的核心操作。  
状态层说明：`erp` Redux slice 用于 Invoice/Payment/Quote，`crud` slice 用于 Customer，`settings` slice 用于全局配置。

---

## 1. 认证页面

### 登录页（`/login`）

| 操作 | 入口 | 触发 | 调用方法 | 影响状态 | 请求 API | 本地存储 |
|---|---|---|---|---|---|---|
| 提交登录 | 点击"Login"按钮 | `onFinish(values)` | `dispatch(login({ loginData }))` | `auth.isLoading → false, auth.isLoggedIn → true, auth.current → 用户信息` | POST /api/login | 写入 `localStorage['auth']` |
| 登录失败 | — | `REQUEST_FAILED` | — | `auth → INITIAL_STATE` | — | — |

### 忘记密码页（`/forgetpassword`）

| 操作 | 触发 | 调用 | 影响状态 | API |
|---|---|---|---|---|
| 提交邮箱 | 表单提交 | `authService.forgetPassword` | 无 Redux 变更，本地 loading state | POST /api/forgetpassword |

### 重置密码页（`/resetpassword/:userId/:resetToken`）

| 操作 | 触发 | 调用 | API |
|---|---|---|---|
| 提交新密码 | 表单提交 | `dispatch(resetPassword({ resetPasswordData }))` | POST /api/resetpassword |
| 成功后 | — | Redux `REQUEST_SUCCESS` | 自动写 localStorage['auth']，跳转首页 |

---

## 2. Invoice 发票

### 发票列表（`/invoice`）

| 操作 | 入口组件 | 触发 | 调用 | 影响状态 | API | 存储 |
|---|---|---|---|---|---|---|
| 初始加载列表 | `DataTable` useEffect | 组件挂载 / 翻页 | `dispatch(erp.list({ entity:'invoice', options:{page,items} }))` | `erp.list.result.items`、`erp.list.result.pagination` | GET /api/invoice/list | 否 |
| 按客户名搜索 | `AutoCompleteAsync` | 输入防抖后 | `dispatch(erp.search({ entity:'client', options:{q} }))` | `erp.search.result` | GET /api/client/search | 否 |
| 添加新发票 | "Add Invoice"按钮 | 点击 | `navigate('/invoice/create')` | 无 | 否 | 否 |
| 查看发票 | 下拉菜单"Show" | 点击 | `dispatch(erp.currentItem({data:record}))` → `navigate('/invoice/read/:id')` | `erp.current.result` | 否 | 否 |
| 编辑发票 | 下拉菜单"Edit" | 点击 | `dispatch(erp.currentAction({actionType:'update',data}))` → `navigate('/invoice/update/:id')` | `erp.update.current` | 否 | 否 |
| 下载 PDF | 下拉菜单"Download" | 点击 | `window.open(DOWNLOAD_BASE_URL + 'invoice/invoice-{id}.pdf')` | 无 | GET /download/invoice/{file} | 否 |
| 记录付款 | 下拉菜单"Record Payment" | 点击 | `dispatch(erp.currentAction({actionType:'recordPayment',data}))` → `navigate('/invoice/pay/:id')` | `erp.recordPayment.current` | 否 | 否 |
| 删除发票 | 下拉菜单"Delete" | 点击 | `dispatch(erp.currentAction({actionType:'delete',data}))` → `modal.open()` | `erp.delete.current`，弹出确认框 | DELETE /api/invoice/delete/:id（确认后） | 否 |
| 确认删除 | DeleteModal "Confirm" | 点击 | `dispatch(erp.delete({entity,id}))` | `erp.delete.isSuccess` | DELETE /api/invoice/delete/:id | 否 |

### 创建发票（`/invoice/create`）

| 操作 | 入口 | 触发 | 调用 | 影响状态 | API |
|---|---|---|---|---|---|
| 页面加载 | `useEffect` | 挂载 | `dispatch(settingsAction.list({ entity:'setting' }))` | `settings.result` | GET /api/setting/listAll |
| 选择客户 | `AutoCompleteAsync` 输入 | 输入防抖 | `request.search({ entity:'client', options:{q} })` | 组件内部 local state | GET /api/client/search |
| 填写行项目 | Form.List 动态增加 | onValuesChange | `calculate.multiply(qty, price)` → `setSubTotal` | 组件 local state（subTotal） | 否 |
| 调整税率 | `InputNumber` | onChange | 更新 local state（taxRate, total） | 组件 local state | 否 |
| 提交保存 | "Save"按钮 | `form.submit()` | `dispatch(erp.create({ entity:'invoice', jsonData }))` | `erp.create.isLoading → true` | POST /api/invoice/create |
| 创建成功 | `useEffect(isSuccess)` | `isSuccess` 变为 true | `form.resetFields()` → `navigate('/invoice/')` | `erp.create.isSuccess` 重置 | — |

### 发票详情（`/invoice/read/:id`）

| 操作 | 触发 | 调用 | API |
|---|---|---|---|
| 加载发票 | `useLayoutEffect([id])` | `dispatch(erp.read({entity:'invoice', id}))` | GET /api/invoice/read/:id |
| 编辑 | 点击"Edit" | `navigate('/invoice/update/:id')` | — |
| 下载 PDF | 点击"Download" | `window.open(...)` | GET /download/invoice/ |
| 发送邮件 | 点击"Send Mail" | `useMail.send(id)` → `dispatch(erp.mail({entity,jsonData}))` | POST /api/invoice/mail（OSS stub）|
| 记录付款 | 点击"Record Payment" | `navigate('/invoice/pay/:id')` | — |
| 删除 | 点击"Delete" | `dispatch(erp.delete)` | DELETE /api/invoice/delete/:id |
| 返回列表 | 点击"Back" | `navigate(-1)` | — |

### 编辑发票（`/invoice/update/:id`）

| 操作 | 触发 | 调用 | API |
|---|---|---|---|
| 加载数据 | `useLayoutEffect` | `dispatch(erp.read)` | GET /api/invoice/read/:id |
| 提交修改 | "Save"按钮 | `dispatch(erp.update({ entity, id, jsonData }))` | PATCH /api/invoice/update/:id |
| 删除 | "Delete" | `dispatch(erp.delete)` | DELETE /api/invoice/delete/:id |

### 记录付款（`/invoice/pay/:id`）

| 操作 | 触发 | 调用 | 影响状态 | API |
|---|---|---|---|---|
| 加载当前发票 | `useLayoutEffect` | `dispatch(erp.currentAction({actionType:'recordPayment', data}))` | `erp.recordPayment.current` | — |
| 填写付款信息 | PaymentForm（金额/日期/方式/参考号） | `onFinish` | — | — |
| 提交付款 | "Record Payment"按钮 | `dispatch(erp.recordPayment({ entity:'payment', jsonData }))` | `erp.recordPayment.isLoading → true` | POST /api/payment/create |
| 成功后 | `useEffect(isSuccess)` | `form.resetFields()` → `dispatch(erp.list)` → `navigate('/invoice/')` | 刷新发票列表 | — |

---

## 3. Customer 客户

### 客户列表（`/customer`）

`CrudModule` 将列表和表单内嵌在同一页，操作通过 `crud` Redux slice。

| 操作 | 触发 | 调用 | API |
|---|---|---|---|
| 加载列表 | 挂载 | `dispatch(crud.list({ entity:'client' }))` | GET /api/client/list |
| 搜索客户 | 输入关键字 | `dispatch(crud.search({ entity:'client', options:{q} }))` | GET /api/client/search |
| 新建客户 | 点击"Add Client" | 打开 SidePanel，`DynamicForm` 渲染字段 | — |
| 提交新建 | SidePanel 表单提交 | `dispatch(crud.create({ entity:'client', jsonData }))` | POST /api/client/create |
| 编辑客户 | 点击"Edit" | 打开 SidePanel 并预填当前数据 | — |
| 提交编辑 | 表单提交 | `dispatch(crud.update({ entity:'client', id, jsonData }))` | PATCH /api/client/update/:id |
| 删除客户 | 点击"Delete" → 确认 | `dispatch(crud.delete({ entity:'client', id }))` | DELETE /api/client/delete/:id（软删除） |

---

## 4. Payment 付款

### 付款列表（`/payment`）

| 操作 | 触发 | 调用 | API |
|---|---|---|---|
| 加载列表 | 挂载 | `dispatch(erp.list({ entity:'payment' }))` | GET /api/payment/list |
| 查看详情 | "Show" | `navigate('/payment/read/:id')` | — |
| 编辑付款 | "Edit" | `navigate('/payment/update/:id')` | — |
| 下载 PDF | "Download" | `window.open(DOWNLOAD_BASE_URL + 'payment/payment-{id}.pdf')` | GET /download/payment/ |
| 删除 | "Delete" → 确认 | `dispatch(erp.delete)` | DELETE /api/payment/delete/:id |

**注意**：付款记录从发票的"Record Payment"入口创建，不能在 `/payment` 直接新建（`disableAdd: true`）。

### 编辑付款（`/payment/update/:id`）

| 操作 | API |
|---|---|
| 加载 | GET /api/payment/read/:id |
| 提交修改 | PATCH /api/payment/update/:id（同步更新关联 Invoice.credit） |

---

## 5. Settings 设置

所有设置操作最终都会重新 listAll settings 并更新 `localStorage['settings']`。

| 操作 | 入口 | 触发 | 调用 | API |
|---|---|---|---|---|
| 初始加载设置 | `ErpApp` useLayoutEffect | 应用启动 | `dispatch(settingsAction.list({ entity:'setting' }))` | GET /api/setting/listAll |
| 更新单项设置 | 各 Settings 子组件表单提交 | `onFinish` | `dispatch(settingsAction.update({ entity, settingKey, jsonData }))` | PATCH /api/setting/updateBySettingKey/:key |
| 批量更新设置 | Company / Finance / General 表单提交 | `onFinish` | `dispatch(settingsAction.updateMany({ entity, jsonData }))` | PATCH /api/setting/updateManySetting |
| 上传 Logo | CompanyLogoSettings 文件选择 | `onChange` | `dispatch(settingsAction.upload({ entity, settingKey, jsonData }))` | PATCH /api/setting/upload/:settingKey |
| 更新货币格式 | MoneyFormatSettings | `onFinish` | `dispatch(settingsAction.updateCurrency({data}))` | — （本地只更新 Redux） |

---

## 6. Profile 个人中心

文件：`src/modules/ProfileModule/`

| 操作 | 触发 | 调用 | 影响状态 | API |
|---|---|---|---|---|
| 查看资料 | 进入 /profile | `ProfileContext` 默认 read.isOpen=true | — | — |
| 点击"Edit"编辑 | 按钮 | `profileContextAction.update.open()` | `profileContext.update.isOpen` | — |
| 提交资料更新 | 表单提交（含照片上传） | `dispatch(updateProfile({ entity:'admin/profile/update', jsonData }))` | `auth.current`（含新 token） | PATCH /api/admin/profile/update |
| 更新成功 | `useEffect(isSuccess)` | 更新 `localStorage['auth']` | `auth.current` | — |
| 修改密码 | 点击"Change Password" | 打开 `PasswordModal` | `profileContext.password.isOpen` | — |
| 提交新密码 | Modal 表单提交 | `request.patch({ entity:'admin/profile/password', jsonData })` | 无 Redux 变更 | PATCH /api/admin/profile/password |
| 退出登录 | Header 下拉 / Logout 页 | `dispatch(logout())` | `auth → INITIAL_STATE`，清空 localStorage | POST /api/logout |

---

## 未发现的操作

- Quote 相关操作（创建/编辑/删除报价）：前端组件存在但路由未完整注册，后端无对应 API。
- PaymentMode 管理操作：`/payment/mode` 路由在 routes.jsx 中有路径但无 import。
- Taxes 管理操作：同上，`/taxes` 路由无 import。
- 发票邮件实际发送：OSS 版 `/api/invoice/mail` 和 `/api/payment/mail` 返回"请升级 Premium"。
- 多用户管理（创建/邀请其他 Admin）：OSS 版无此功能，只有单一 owner 角色。
