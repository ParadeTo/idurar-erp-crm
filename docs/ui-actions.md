# Frontend UI Actions

本文档基于前端 pages、modules、components、redux actions、request service 生成。所有列出的有效 API 均可在 `docs/api-list.md` 中找到；未闭合引用单独标注。

## Auth

### 登录

- 入口页面/组件：`/login` 或未登录 `/`，`pages/Login.jsx` + `forms/LoginForm.jsx`。
- 触发事件：提交登录表单。
- 调用方法：`redux/auth/actions.login` -> `auth.service.login`。
- API：`POST /api/login`。
- 状态影响：`auth.isLoading` -> `auth.current/isLoggedIn/isSuccess`。
- 本地存储：成功后写入 localStorage `auth`，移除 `isLogout`。
- UI 更新：`Login.jsx` 监听 `isSuccess` 后 `navigate('/')`。

### 登出

- 入口页面/组件：Header/Profile 的 logout link 或 `/logout`。
- 触发事件：进入 `pages/Logout.jsx`。
- 调用方法：`redux/auth/actions.logout`。
- API：`POST /api/logout`。
- 状态影响：立即 dispatch `LOGOUT_SUCCESS`，同时 reset `crud` 和 `erp` 状态。
- 本地存储：移除 `auth`、`settings`，写入 `isLogout`；后端 logout 失败时恢复旧 auth/settings。
- UI 更新：跳转 `/login`。

### 忘记密码

- 入口页面/组件：`/forgetpassword`，`pages/ForgetPassword.jsx`。
- 触发事件：提交 email。
- 调用方法：`request.post({ entity: 'forgetpassword' })` 包装在 `useOnFetch`。
- API：`POST /api/forgetpassword`。
- 状态影响：组件局部 `useOnFetch` 的 `isLoading/isSuccess/result`。
- 本地存储：无直接写入。
- UI 更新：成功后显示 AntD `Result`。

### 重置密码

- 入口页面/组件：`/resetpassword/:userId/:resetToken`。
- 触发事件：提交新密码。
- 调用方法：`redux/auth/actions.resetPassword` -> `auth.service.resetPassword`。
- API：`POST /api/resetpassword`。
- 状态影响：`auth` slice 更新为登录成功状态。
- 本地存储：成功后写入 `auth`。
- UI 更新：成功后跳转 `/`。

## Customer

Customer 页面使用 `CrudModule`、`DynamicForm`、`redux/crud` 和 `context/crud`。

### 打开客户列表

- 入口页面/组件：`/customer`，`pages/Customer/index.jsx`。
- 触发事件：页面 mount。
- 调用方法：`components/DataTable/DataTable.jsx` dispatch `crud.list({ entity: 'client' })`。
- API：`GET /api/client/list`。
- 状态影响：`crud.list.result.items/pagination/isLoading/isSuccess`。
- 本地存储：无。

### 搜索客户

- 入口页面/组件：Customer 的顶部 SearchItem 或表格输入框。
- 触发事件：输入搜索关键字。
- 调用方法：
  - `SearchItem`：debounce 后 dispatch `crud.search({ entity: 'client', options })`。
  - `DataTable`：输入框 dispatch `crud.list({ entity: 'client', options: { q, fields } })`。
- API：`GET /api/client/search` 或 `GET /api/client/list`。
- 状态影响：`crud.search` 或 `crud.list`。
- 本地存储：无。

### 新增客户

- 入口页面/组件：Customer 顶部 `AddNewItem` 按钮 + `CreateForm`。
- 触发事件：点击新增后提交表单。
- 调用方法：`crud.create({ entity: 'client', jsonData })`。
- API：`POST /api/client/create`。
- 状态影响：`crud.create`、`crud.current`；成功后刷新 `crud.list`。
- 本地存储：无。

### 查看/编辑/删除客户

- 入口页面/组件：Customer 表格 action dropdown。
- 触发事件：Show/Edit/Delete。
- 调用方法：
  - Show：dispatch `crud.currentItem`，打开 read side panel。
  - Edit：dispatch `crud.currentAction({ actionType: 'update' })`，提交时 `crud.update`。
  - Delete：打开 `DeleteModal`，确认后 `crud.delete`。
- API：`PATCH /api/client/update/:id`、`DELETE /api/client/delete/:id`。
- 状态影响：`crud.current/update/delete/list`；`context/crud` 控制 panel/modal。
- 本地存储：无。

## Invoice

Invoice 页面使用 `ErpPanelModule`、`InvoiceModule`、`redux/erp` 和 `context/erp`。

### 打开发票列表

- 入口页面/组件：`/` 或 `/invoice`，`pages/Invoice/index.jsx`。
- 触发事件：页面 mount。
- 调用方法：`ErpPanelModule/DataTable` dispatch `erp.list({ entity: 'invoice' })`。
- API：`GET /api/invoice/list`。
- 状态影响：`erp.list`。
- 本地存储：无。

### 筛选/刷新发票列表

- 入口页面/组件：Invoice 列表 PageHeader。
- 触发事件：AutoCompleteAsync 选择 client 或点击 Refresh。
- 调用方法：
  - filter：`erp.list({ entity: 'invoice', options: { equal: value, filter: 'client' } })`。
  - refresh：`erp.list({ entity: 'invoice', options: pagination })`。
- API：`GET /api/invoice/list`。
- 状态影响：`erp.list`。
- 本地存储：无。

### 创建发票

- 入口页面/组件：`/invoice/create`，`CreateInvoiceModule` + `CreateItem` + `InvoiceForm`。
- 触发事件：提交 Save。
- 调用方法：`erp.create({ entity: 'invoice', jsonData })`。
- API：`POST /api/invoice/create`。
- 状态影响：`erp.create`、`erp.current`；成功后 reset create action。
- 本地存储：无直接写入；读取 settings 来获得 `last_invoice_number`。
- UI 更新：成功后 `navigate('/invoice/read/:id')`。

### 查看发票

- 入口页面/组件：列表 Show 或 `/invoice/read/:id`。
- 触发事件：进入详情页。
- 调用方法：若列表中已有该 id，使用 `selectItemById`；否则 dispatch `erp.read({ entity: 'invoice', id })`。
- API：`GET /api/invoice/read/:id`。
- 状态影响：`erp.current`、`erp.read`。
- 本地存储：无。

### 更新发票

- 入口页面/组件：详情页 Edit 或 `/invoice/update/:id`。
- 触发事件：提交 update form。
- 调用方法：`erp.update({ entity: 'invoice', id, jsonData })`。
- API：`PATCH /api/invoice/update/:id`。
- 状态影响：`erp.update`、`erp.current`。
- 本地存储：无。
- UI 更新：成功后跳转 `/invoice/read/:id`。

### 删除发票

- 入口页面/组件：Invoice 列表 action dropdown。
- 触发事件：Delete -> modal OK。
- 调用方法：`erp.delete({ entity: 'invoice', id })`。
- API：`DELETE /api/invoice/delete/:id`。
- 状态影响：`erp.delete`；成功后刷新 `erp.list`。
- 后端副作用：关联 Payment 会被软删除。
- 本地存储：无。

### 下载发票 PDF

- 入口页面/组件：列表 action dropdown 或详情页 Download PDF。
- 触发事件：点击 Download。
- 调用方法：`window.open(`${DOWNLOAD_BASE_URL}invoice/invoice-${id}.pdf`)`。
- API：`GET /download/invoice/invoice-:id.pdf`。
- 状态影响：无 Redux 状态变化。
- 本地存储：无。

### 发送发票邮件

- 入口页面/组件：Invoice 详情页 Send by Email。
- 触发事件：点击按钮。
- 调用方法：`useMail({ entity: 'invoice' }).send(id)` -> `erp.mail`。
- API：`POST /api/invoice/mail`。
- 状态影响：`erp.mail.isLoading/isSuccess`。
- 本地存储：无。
- 注意：后端当前返回升级提示，不发送真实邮件。

### 记录收款

- 入口页面/组件：Invoice 列表 action dropdown 的 Record Payment，或 `/invoice/pay/:id`。
- 触发事件：提交 PaymentForm。
- 调用方法：`erp.recordPayment({ entity: 'payment', jsonData })`。
- API：`POST /api/payment/create`。
- 状态影响：`erp.recordPayment`，成功后刷新 invoice list 并导航回 `/invoice/`。
- 后端副作用：创建 Payment，更新 Invoice.credit/payment/paymentStatus。
- 本地存储：无。

## Payment

### 打开收款列表

- 入口页面/组件：`/payment`。
- 触发事件：页面 mount。
- 调用方法：`erp.list({ entity: 'payment' })`。
- API：`GET /api/payment/list`。
- 状态影响：`erp.list`。

### 查看/更新/删除收款

- 入口页面/组件：Payment 列表 action dropdown；`/payment/read/:id`；`/payment/update/:id`。
- 触发事件：Show/Edit/Delete/Submit。
- 调用方法：
  - read：`erp.read({ entity: 'payment', id })`
  - update：`erp.update({ entity: 'payment', id, jsonData })`
  - delete：`erp.delete({ entity: 'payment', id })`
- API：`GET /api/payment/read/:id`、`PATCH /api/payment/update/:id`、`DELETE /api/payment/delete/:id`。
- 状态影响：`erp.current/read/update/delete/list`。
- 后端副作用：update/delete 会同步 Invoice.credit/paymentStatus。
- 本地存储：无。

### 下载/发送收款

- 入口页面/组件：Payment list/detail。
- API：
  - 下载：`GET /download/payment/payment-:id.pdf`
  - 发送：`POST /api/payment/mail`
- 状态影响：下载无 Redux；发送使用 `erp.mail`。
- 注意：后端 mail 当前返回升级提示。

## Settings

### 加载设置

- 入口页面/组件：`ErpApp` mount、`CreateItem` mount、`/settings`、`/settings/edit/:settingsKey`。
- 调用方法：`settingsAction.list({ entity: 'setting' })`。
- API：`GET /api/setting/listAll`。
- 状态影响：`settings.result`、`settings.isSuccess`。
- 本地存储：成功后写入 localStorage `settings`。
- UI 更新：`/settings/edit/:settingsKey` 的 `settingsKey` 作为默认 active tab。

### 批量更新设置

- 入口页面/组件：Settings tabs 中 General/Company/Finance/MoneyFormat。
- 触发事件：点击 Save。
- 调用方法：`settingsAction.updateMany({ entity: 'setting', jsonData: { settings } })`。
- API：`PATCH /api/setting/updateManySetting`；成功后再次 `GET /api/setting/listAll`。
- 状态影响：`settings.isLoading/result/isSuccess`。
- 本地存储：更新后重写 `settings`。

### 上传公司 Logo

- 入口页面/组件：CompanyLogoSettings tab。
- 触发事件：选择图片并点击 Save。
- 调用方法：`settingsAction.upload({ entity: 'setting', settingKey: 'company_logo', jsonData })`。
- API：`PATCH /api/setting/upload/company_logo`；成功后再次 `GET /api/setting/listAll`。
- 状态影响：`settings` slice。
- 本地存储：更新后重写 `settings`。
- 文件限制：前端只允许 jpg/png，小于 5MB；后端使用 upload middleware。

## Profile

### 查看个人资料

- 入口页面/组件：`/profile`，`ProfileModule/components/AdminInfo.jsx`。
- 数据来源：Redux `auth.current`。
- API：无新增读取；登录时或 profile update 时已经把 admin 写入 auth。
- 状态影响：`profileContext.read` 控制显示。

### 编辑个人资料

- 入口页面/组件：Profile 的 Edit 按钮。
- 触发事件：提交 `UpdateAdmin` 表单。
- 调用方法：`redux/auth/actions.updateProfile({ entity: 'admin/profile', jsonData })`。
- API：`PATCH /api/admin/profile/update`。
- 状态影响：`auth.current` 更新；`profileContext` 关闭 update panel。
- 本地存储：成功后重写 localStorage `auth`。

### 修改密码

- 入口页面/组件：Profile 的 Update Password 按钮。
- 触发事件：PasswordModal OK。
- 调用方法：`request.patch({ entity: 'admin/profile/password/' })`。
- API：`PATCH /api/admin/profile/password`。
- 状态影响：组件局部 `useOnFetch`；modal 关闭。
- 本地存储：无。

## About and Navigation

### 查看 About 页面

- 入口页面/组件：导航菜单 `/about`，`pages/About.jsx`。
- 触发事件：点击 Navigation 中的 About。
- 调用方法：React Router route 渲染静态页面组件。
- API：无。
- 状态影响：`AppRouter` 根据 pathname 更新 `appContext.currentApp`；无 Redux 数据请求。
- 本地存储：无。

### 打开侧边导航

- 入口页面/组件：`apps/Navigation/NavigationContainer.jsx`。
- 触发事件：点击导航项、折叠菜单。
- 调用方法：`useAppContext` 中的 `appContextAction.navMenu` 和 React Router `Link`。
- API：无。
- 状态影响：`appContext.isNavMenuClose/currentApp`。
- 本地存储：无。

## 未闭合/风险动作

- Quote 相关按钮：`ReadItem` 中存在 `erp.convert({ entity, id })`，仅当 entity 是 `quote` 显示；但当前 Quote route/page/model/API 不闭合。
- Quote 路由：`/quote`、`/quote/create`、`/quote/read/:id`、`/quote/update/:id` 在 `routes.jsx` 中出现，但对应页面 import 和后端模型未发现。
- Payment Mode 路由：`/payment/mode` 在 `routes.jsx` 和导航中出现，但对应 page import 和后端模型未发现。
- PaymentForm 的 Payment Mode：`SelectAsync entity='paymentMode'` 会请求 `/api/paymentMode/list`；后端 `PaymentMode` model 未发现。
- InvoiceForm 的 tax selector：表单中配置了 `entity='taxes'` 和 `/taxes` redirect，但当前使用的是 AntD `Select`，未发现有效后端 `Taxes` model。
