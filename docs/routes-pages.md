# 前端路由与页面清单

路由系统使用 `react-router-dom v6`，入口为 `src/router/`。  
权限控制基于 Redux `auth.isLoggedIn`，在 `IdurarOs.jsx` 做整体守卫。

---

## 认证判断逻辑

```
IdurarOs.jsx
  isLoggedIn == false → <AuthRouter>  （公开路由）
  isLoggedIn == true  → <ErpApp>
                          → <Navigation> + <HeaderContent> + <AppRouter>
```

所有 `AppRouter` 下的页面都已通过 `isLoggedIn` 守卫，无需逐页校验。  
页面组件全部使用 `React.lazy` 懒加载。

---

## 公开路由（AuthRouter）

文件：`src/router/AuthRouter.jsx`

| 路径 | 页面组件 | 说明 |
|---|---|---|
| `/` | `Login` | 登录页（默认路由） |
| `/login` | `Login` | 登录页 |
| `/logout` | `<Navigate to="/login">` | 未登录时访问 /logout 直接跳登录 |
| `/forgetpassword` | `ForgetPassword` | 忘记密码，输入邮箱发送重置链接 |
| `/resetpassword/:userId/:resetToken` | `ResetPassword` | 重置密码，带动态参数 |
| `*` | `NotFound` | 404 |

**Layout**：无专门 Layout，各页面自带 Ant Design Card 居中样式。

---

## 受保护路由（AppRouter）

文件：`src/router/routes.jsx`  
Layout：`ErpLayout`（侧边导航 + 顶部 Header + 内容区）

### 概览 / Invoice

| 路径 | 动态参数 | 页面组件 | 模块 | 职责 |
|---|---|---|---|---|
| `/` | — | `Invoice`（重定向） | `InvoiceDataTableModule` | 默认首页，展示发票列表 |
| `/invoice` | — | `Invoice` | `InvoiceDataTableModule` | 发票列表（分页、搜索、操作菜单） |
| `/invoice/create` | — | `InvoiceCreate` | `CreateInvoiceModule` | 新建发票表单 |
| `/invoice/read/:id` | `id`=发票 ObjectId | `InvoiceRead` | `ReadInvoiceModule` | 发票详情页 |
| `/invoice/update/:id` | `id` | `InvoiceUpdate` | `UpdateInvoiceModule` | 编辑发票 |
| `/invoice/pay/:id` | `id`=发票 ObjectId | `InvoiceRecordPayment` | `RecordPaymentModule` | 针对此发票记录一笔付款 |

**Invoice 页面关键行为**：
- 列表页：通过 `erp.list` 分页拉取；右键/下拉菜单提供 Show / Edit / Download / Record Payment / Delete。
- 详情页：`useLayoutEffect` 触发 `erp.read`；提供 Edit / Download PDF / Send Email（premium stub）/ Record Payment 按钮。
- 创建/编辑页：`InvoiceForm` 内含行项目数组（动态增减）、客户异步搜索（`AutoCompleteAsync`）、税率/折扣计算。

---

### Customer（Client）

| 路径 | 页面组件 | 模块 | 职责 |
|---|---|---|---|
| `/customer` | `Customer` | `CrudModule` + `DynamicForm` | 客户列表 + 内联创建/编辑/删除 |

**说明**：`CrudModule` 在列表页内嵌 SidePanel 实现新建和编辑，无独立的 /customer/create、/customer/read 路由。  
**字段（来自 config.js）**：name / country / address / phone / email。

---

### Payment

| 路径 | 动态参数 | 页面组件 | 模块 | 职责 |
|---|---|---|---|---|
| `/payment` | — | `Payment` | `PaymentDataTableModule` | 付款记录列表（无"新建"按钮，disableAdd:true） |
| `/payment/read/:id` | `id` | `PaymentRead` | `ReadPaymentModule` | 付款详情 |
| `/payment/update/:id` | `id` | `PaymentUpdate` | `UpdatePaymentModule` | 编辑付款金额/日期 |

---

### Quote（报价单）

| 路径 | 动态参数 | 页面组件 | 说明 |
|---|---|---|---|
| `/quote` | — | `Quote` | 报价单列表（前端组件存在，后端 Model **未发现**） |
| `/quote/create` | — | `QuoteCreate` | 新建报价单 |
| `/quote/read/:id` | `id` | `QuoteRead` | 报价详情 |
| `/quote/update/:id` | `id` | `QuoteUpdate` | 编辑报价单 |

**注意**：`routes.jsx` 中引用了 Quote / QuoteCreate / QuoteRead / QuoteUpdate，但这 4 个组件没有 import 语句，会导致运行时错误。后端 `/api/quote/*` 也未注册（无 Quote Mongoose Model）。这些属于 OSS 版的未完成功能。

---

### Settings（设置）

| 路径 | 动态参数 | 页面组件 | 职责 |
|---|---|---|---|
| `/settings` | — | `Settings` | Tabs 切换多个设置分组 |
| `/settings/edit/:settingsKey` | `settingsKey` | `Settings` | 带默认激活 Tab |

**设置 Tab 分组**：

| Tab key | 组件 | 设置类别 |
|---|---|---|
| general_settings | `GeneralSettings` | 语言、日期格式、时区、邮箱 |
| company_settings | `CompanySettings` | 公司名、地址、税号、银行账号 |
| company_logo | `CompanyLogoSettings` | 公司 Logo 上传 |
| currency_settings | `MoneyFormatSettings` | 货币符号、位置 |
| finance_settings | `FinanceSettings` | 发票/报价前缀、序号 |

---

### Profile

| 路径 | 页面组件 | 模块 | 职责 |
|---|---|---|---|
| `/profile` | `Profile` | `ProfileModule` | 查看/修改个人信息、修改密码 |

**状态来源**：`ProfileContext`（read/update 面板切换）。

---

### 其他

| 路径 | 页面组件 | 职责 |
|---|---|---|
| `/about` | `About` | 关于页（静态） |
| `/logout` | `Logout` | 触发 logout action，清空 localStorage，跳转到 /login |
| `*` | `NotFound` | 404 |

**注意**：`routes.jsx` 还引用了 `/payment/mode → <PaymentMode>` 和 `/taxes → <Taxes>`，同样没有 import，为未完成功能。

---

## 未发现的独立路由

- `/customer/read/:id`、`/customer/create`：Customer 页使用 `CrudModule` 内嵌 SidePanel 操作，无独立路由。
- `/dashboard`：无 dashboard 路由，`/` 直接展示发票列表。
