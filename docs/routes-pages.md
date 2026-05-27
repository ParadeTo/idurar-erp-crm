# Frontend Routes and Pages

本文档基于 `frontend/src/router/AuthRouter.jsx`、`frontend/src/router/AppRouter.jsx`、`frontend/src/router/routes.jsx`、`frontend/src/pages/**`、`frontend/src/apps/IdurarOs.jsx` 和 layout 代码生成。

## 全局路由规则

- `RootApp` 包裹 `BrowserRouter` 和 Redux `Provider`。
- `IdurarOs` 读取 `selectAuth.isLoggedIn`：
  - 未登录：渲染 `AuthRouter`。
  - 已登录：渲染 `Localization -> AppContextProvider -> ErpApp`。
- 认证状态来自 Redux `auth`，初始值由 `storePersist.get('auth')` 从 localStorage 恢复。
- 未发现基于 role 的细粒度页面权限；只有登录/未登录分流。

## AuthRouter

| 路由 | 页面组件 | 动态参数 | Layout | 权限 | 页面职责 |
|---|---|---|---|---|---|
| `/` | `Login` | 无 | `AuthLayout` via `AuthModule` | 未登录分支 | 登录页 |
| `/login` | `Login` | 无 | `AuthLayout` | 未登录分支 | 登录页 |
| `/logout` | `Navigate to /login` | 无 | 无 | 未登录分支 | 未登录状态下强制回登录 |
| `/forgetpassword` | `ForgetPassword` | 无 | `AuthLayout` | 未登录分支 | 提交邮箱请求重置密码 |
| `/resetpassword/:userId/:resetToken` | `ResetPassword` | `userId`, `resetToken` | `AuthLayout` | 未登录分支 | 提交新密码并登录 |
| `*` | `NotFound` | 无 | 无 | 未登录分支 | 404 |

## 已登录 AppRouter

`AppRouter` 将 `routes.jsx` 中所有 route 扁平化后交给 `useRoutes`。路径变化时会把 AppContext 的 `currentApp` 设置为对应 route group；如果路径是 `/`，调用 `app.default()`。

| 路由 | 页面组件 | 动态参数 | Layout | 权限 | 页面职责 |
|---|---|---|---|---|---|
| `/login` | `Navigate to /` | 无 | 已登录 app shell | 需登录 | 已登录访问登录页时重定向到首页 |
| `/logout` | `Logout` | 无 | 已登录 app shell | 需登录 | 清空 auth/settings，调用后端 logout，跳到 login |
| `/about` | `About` | 无 | 已登录 app shell | 需登录 | About 页面 |
| `/` | `Invoice` | 无 | `ErpApp` + `ErpLayout` | 需登录 | 首页实际展示 Invoice 列表，不是 DashboardModule |
| `/customer` | `Customer` | 无 | `CrudLayout` via `CrudModule` | 需登录 | 客户 CRUD |
| `/invoice` | `Invoice` | 无 | `ErpLayout` | 需登录 | 发票列表 |
| `/invoice/create` | `InvoiceCreate` | 无 | `ErpLayout` | 需登录 | 创建发票 |
| `/invoice/read/:id` | `InvoiceRead` | `id` | `ErpLayout` | 需登录 | 查看发票详情 |
| `/invoice/update/:id` | `InvoiceUpdate` | `id` | `ErpLayout` | 需登录 | 更新发票 |
| `/invoice/pay/:id` | `InvoiceRecordPayment` | `id` | `ErpLayout` | 需登录 | 为发票记录收款 |
| `/payment` | `Payment` | 无 | `ErpLayout` | 需登录 | 收款列表 |
| `/payment/read/:id` | `PaymentRead` | `id` | `ErpLayout` | 需登录 | 查看收款详情 |
| `/payment/update/:id` | `PaymentUpdate` | `id` | `ErpLayout` | 需登录 | 更新收款 |
| `/settings` | `Settings` | 无 | `ErpApp` content | 需登录 | 设置 tabs，默认 tab 由 TabsContent 处理 |
| `/settings/edit/:settingsKey` | `Settings` | `settingsKey` | `ErpApp` content | 需登录 | 打开指定设置 tab |
| `/profile` | `Profile` | 无 | `ProfileLayout` via `ProfileModule` | 需登录 | 当前 Admin 资料和密码 |
| `*` | `NotFound` | 无 | 已登录 app shell | 需登录 | 404 |

## Settings 内部 tabs

`Settings.jsx` 使用 `TabsContent`，不是独立 route。`settingsKey` 会作为默认 active tab。

| Tab key | 子页面 | 模块 | 职责 |
|---|---|---|---|
| `general_settings` | `GeneralSettings` | `GeneralSettingsModule` | 日期格式、应用邮箱等 |
| `company_settings` | `CompanySettings` | `CompanySettingsModule` | 公司名称、地址、邮箱、税号等 |
| `company_logo` | `CompanyLogoSettings` | `CompanyLogoSettingsModule` | 上传公司 logo |
| `currency_settings` | `MoneyFormatSettings` | `MoneyFormatSettingsModule` | 默认币种、符号、分隔符 |
| `finance_settings` | `FinanceSettings` | `FinanceSettingsModule` | last invoice/payment/quote number |

## 导航菜单

`NavigationContainer.jsx` 声明的菜单入口：

- `/` dashboard label，但实际 route 是 `Invoice`。
- `/customer`
- `/invoice`
- `/quote`
- `/payment`
- `/payment/mode`
- `/taxes`
- `/settings`
- `/about`

## 未闭合路由

以下 route 在 `routes.jsx` 或导航中出现，但当前文件没有形成可运行闭环：

| 路由 | 发现情况 | 问题 |
|---|---|---|
| `/quote` | routes.jsx 使用 `<Quote />` | 未发现 `const Quote = lazy(...)` import；后端 `Quote` model 未发现 |
| `/quote/create` | routes.jsx 使用 `<QuoteCreate />` | 未发现 page import；后端 API 不会生成 |
| `/quote/read/:id` | routes.jsx 使用 `<QuoteRead />` | 未发现 page import；后端 API 不会生成 |
| `/quote/update/:id` | routes.jsx 使用 `<QuoteUpdate />` | 未发现 page import；后端 API 不会生成 |
| `/payment/mode` | routes.jsx 使用 `<PaymentMode />` | 未发现 page import；后端 `PaymentMode` model 未发现 |
| `/taxes` | routes.jsx 使用 `<Taxes />` | 未发现 page import；后端 `Taxes` model 未发现 |
| DashboardModule | `frontend/src/modules/DashboardModule` 存在 | 未发现 route/page 引用；`/` 实际指向 Invoice |

## Layout 关系

- Auth pages：`AuthModule` -> `AuthLayout`。
- ERP app shell：`ErpApp` 渲染 AntD `Layout`，包含 `Navigation`、`HeaderContent`、`Content`。
- Invoice/Payment pages：各自 module 使用 `ErpLayout`，提供 `ErpContextProvider`。
- Customer page：`DefaultLayout`/`CrudLayout` 提供 `CrudContextProvider` 和 CRUD 侧边面板。
- Profile page：`ProfileLayout` 提供 `ProfileContextProvider`。
