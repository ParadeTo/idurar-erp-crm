# Frontend State Model

本文档基于 `frontend/src/redux/**`、`frontend/src/context/**`、`frontend/src/hooks/**`、`frontend/src/request/**`、pages 和 modules 生成。

## Redux Store

`frontend/src/redux/store.js` 使用 Redux Toolkit `configureStore`，组合 reducer：

- `auth`
- `crud`
- `erp`
- `adavancedCrud`
- `settings`

初始 `auth` 会从 `storePersist.get('auth')` 恢复。

### auth

- 文件：`redux/auth/actions.js`、`reducer.js`、`selectors.js`。
- 负责数据：当前登录 Admin、登录状态、认证请求 loading/success。
- 状态结构：
  - `current`
  - `isLoggedIn`
  - `isLoading`
  - `isSuccess`
- 主要读者：
  - `IdurarOs` 判断登录分支。
  - `HeaderContent`、`ProfileModule` 读取当前 Admin。
  - `Login/ResetPassword` 读取 loading/success。
- 主要写者：
  - `login`
  - `resetPassword`
  - `logout`
  - `updateProfile`
- 更新入口：
  - `POST /api/login`
  - `POST /api/resetpassword`
  - `POST /api/logout`
  - `PATCH /api/admin/profile/update`
- 是否持久化：是。登录、重置密码、更新 profile 成功都会写 localStorage `auth`；logout 移除。

### crud

- 文件：`redux/crud/**`。
- 负责数据：通用 CRUD 页面状态，当前主要用于 Customer。
- 状态结构：
  - `current.result`
  - `list.result.items/pagination`
  - `create/update/delete/read/search`
  - 每个 action state 有 `result/current/isLoading/isSuccess`
- 主要读者：
  - `CrudModule`
  - `components/DataTable`
  - `CreateForm`
  - `UpdateForm`
  - `DeleteModal`
  - `SearchItem`
- 主要写者：`crud` actions。
- 更新入口：
  - `crud.list/search/create/read/update/delete`
  - `crud.currentItem/currentAction/resetAction/resetState`
- 是否持久化：否。

### erp

- 文件：`redux/erp/**`。
- 负责数据：Invoice、Payment 等 ERP 单据模块的列表、当前项和操作状态。
- 状态结构：
  - `current.result`
  - `list.result.items/pagination`
  - `create/update/delete/read/recordPayment/search/summary/mail`
- 主要读者：
  - `ErpPanelModule`
  - `InvoiceModule`
  - `PaymentModule`
  - `useMail`
- 主要写者：`erp` actions。
- 更新入口：
  - `erp.list/read/create/update/delete`
  - `erp.recordPayment`
  - `erp.summary`
  - `erp.mail`
  - `erp.convert`
- 是否持久化：否。

### settings

- 文件：`redux/settings/**`。
- 负责数据：按 settingCategory 组织的 settings。
- 状态结构：
  - `result.crm_settings`
  - `result.finance_settings`
  - `result.company_settings`
  - `result.app_settings`
  - `result.money_format_settings`
  - `isLoading/isSuccess`
- 主要读者：
  - `ErpApp` 判断 settings 是否加载完成。
  - `InvoiceForm` 读取 `selectFinanceSettings.last_invoice_number`。
  - `useMoney`、`useDate`。
  - Settings modules。
- 主要写者：`settingsAction`。
- 更新入口：
  - `list`: `GET /api/setting/listAll`
  - `update`: `PATCH /api/setting/updateBySettingKey/:settingKey`
  - `updateMany`: `PATCH /api/setting/updateManySetting`
  - `upload`: `PATCH /api/setting/upload/:settingKey`
  - `updateCurrency`: 前端本地更新 money format slice。
- 是否持久化：是。`list/update/updateMany/upload` 成功后写 localStorage `settings`。

### adavancedCrud

- 文件：`redux/adavancedCrud/**` 和 `context/adavancedCrud/**`。
- 负责数据：高级 CRUD/单据风格状态，结构类似 `erp`。
- 主要读者/写者：当前扫描未发现主要页面直接使用该 Redux slice。
- 是否持久化：否。
- 注意：文件名拼写为 `adavancedCrud`。

## Context State

### appContext

- 文件：`context/appContext/**`。
- 负责数据：
  - `isNavMenuClose`
  - `currentApp`
- 主要读者：
  - `NavigationContainer`
  - `AppRouter`
- 主要写者：
  - `navMenu.open/close/collapse`
  - `app.open/default`
- 更新入口：路由变化、导航折叠。
- 是否持久化：否。

### crudContext

- 文件：`context/crud/**`。
- 负责数据：
  - `isModalOpen`
  - `isPanelClose`
  - `isBoxCollapsed`
  - `isReadBoxOpen`
  - `isAdvancedBoxOpen`
  - `isEditBoxOpen`
- 主要读者：
  - `CrudModule`
  - `CreateForm`
  - `UpdateForm`
  - `DeleteModal`
  - `DataTable`
- 主要写者：`crudContextAction`。
- 更新入口：Customer 的 Add/Show/Edit/Delete/search 交互。
- 是否持久化：否。

### erpContext

- 文件：`context/erp/**`。
- 负责数据：
  - `create/update/read/recordPayment/deleteModal/dataTableList` 的 `isOpen`
- 主要读者：
  - `ErpLayout`
  - `ErpPanelModule`
  - `DeleteItem`
- 主要写者：`erpContextAction`。
- 更新入口：ERP list 的 panel/modal 操作。
- 是否持久化：否。

### profileContext

- 文件：`context/profileContext/**`。
- 负责数据：
  - `read.isOpen`
  - `update.isOpen`
  - `passwordModal.isOpen`
- 主要读者：
  - `ProfileModule/components/Profile.jsx`
  - `AdminInfo`
  - `UpdateAdmin`
  - `PasswordModal`
- 主要写者：`profileContextAction`。
- 更新入口：Profile 的 Edit、Update Password、Close。
- 是否持久化：否。

### adavancedCrudContext

- 文件：`context/adavancedCrud/**`。
- 状态结构类似 `erpContext`。
- 当前扫描未发现主要页面直接使用。

## Component State

常见局部状态：

- `InvoiceForm`：
  - `total`、`taxRate`、`taxTotal`、`currentYear`、`lastNumber`
  - 由 settings 和表单值变化更新。
- `CreateItem`：
  - `subTotal`、`offerSubTotal`
  - 由 `onValuesChange` 从 items 计算。
- `UpdateItem`：
  - `subTotal`、`currentErp`
  - 用于更新单据表单和金额预览。
- `RecordPayment`：
  - `maxAmount`
  - 从当前 invoice 的 `total - discount - credit` 计算。
- `AutoCompleteAsync` / `SelectAsync`：
  - `selectOptions`、`currentValue`、searching/debounce 状态。
- `Settings UpdateSettingForm`：
  - AntD Form 内部状态；提交后转成 settings 数组。
- `Profile PasswordModal`：
  - AntD Form 状态和 `useOnFetch` 局部请求状态。

## Hooks and Cache

### useFetch

- 输入：返回 promise 的 `fetchFunction`。
- 输出：`result`、`isLoading`、`isSuccess`、`error`。
- 行为：mount 后调用 fetchFunction；依赖数组包含 `isLoading`。
- 是否持久化：否。

### useOnFetch

- 输入：手动传入 callback promise。
- 输出：`onFetch`、`result`、`isSuccess`、`isLoading`。
- 使用位置：ForgetPassword、AutoCompleteAsync、PasswordModal 等。
- 是否持久化：否。

### useMail

- 输入：`entity`。
- 输出：`send(id)`、`isLoading`。
- 行为：dispatch `erp.mail({ entity, jsonData: { id } })`。
- 是否持久化：否。

### useDebounce

- 使用位置：搜索组件和 AutoCompleteAsync。
- 行为：延迟更新搜索关键字，减少请求频率。

### useMoney / useDate

- 从 Redux settings selectors 读取 money/date setting。
- 输出金额和日期格式化函数。
- 是否持久化：依赖 settings slice，settings 会同步 localStorage。

## URL State

- `/invoice/read/:id`、`/invoice/update/:id`、`/invoice/pay/:id`：`id` 决定当前 invoice。
- `/payment/read/:id`、`/payment/update/:id`：`id` 决定当前 payment。
- `/resetpassword/:userId/:resetToken`：用于重置密码 API 入参。
- `/settings/edit/:settingsKey`：用于 Settings 默认 active tab。

## Local Storage

| Key | 写入位置 | 读取位置 | 含义 |
|---|---|---|---|
| `auth` | 登录、重置密码、更新 profile | store 初始化、request token 注入、errorHandler | 当前登录用户和 token |
| `settings` | settingsAction list/update/updateMany/upload | logout 恢复、可能供后续扩展 | 设置快照 |
| `isLogout` | logout | errorHandler/logout 失败恢复 | 标记正在登出 |
| `lang` | `useLanguage` fallback | `useLanguage` | 缺失翻译 key 的本地记录 |

## 浏览器状态/副作用

- `window.location.href = '/logout'`：request errorHandler 在 JWT 过期或 JsonWebTokenError 时触发。
- `window.open(downloadUrl, '_blank')`：下载 PDF。
- `navigator.onLine`：errorHandler 判断网络状态。
- `localStorageHealthCheck` 存在但在 store 中被注释，未启用。
