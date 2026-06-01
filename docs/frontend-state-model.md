# 前端状态模型

状态层由 Redux store 和 React Context 共同构成，通过 `localStorage` 持久化两类关键状态。

---

## 一、Redux Store

文件：`src/redux/store.js`，根 reducer：`src/redux/rootReducer.js`

```
store
├── auth       ← 认证状态（持久化）
├── erp        ← Invoice / Payment / Quote 业务数据
├── crud       ← Customer 业务数据
├── adavancedCrud ← 扩展 CRUD（当前未明确使用方）
└── settings   ← 全局系统配置（持久化）
```

### 1. auth slice

文件：`src/redux/auth/`

**State 结构**：
```js
{
  current: {              // 登录用户信息
    _id, name, surname, role, email, photo,
    token,                // JWT Bearer Token
    maxAge                // null 或 365（remember me）
  },
  isLoggedIn: false,
  isLoading: false,
  isSuccess: false
}
```

| 维度 | 说明 |
|---|---|
| **负责数据** | 当前登录用户 + JWT token |
| **主要读者** | `IdurarOs`（isLoggedIn 守卫）、`request.js`（自动附加 Authorization 头）、Profile 页（current 用户信息） |
| **主要写者** | `login` action（登录成功）、`logout` action（退出）、`updateProfile` action（改资料） |
| **更新入口** | `src/redux/auth/actions.js` |
| **持久化** | ✅ 写入 `localStorage['auth']`；应用启动时 `store.js` 从 localStorage 恢复 preloadedState |
| **清除时机** | 登出、JWT 过期（`errorHandler` 检测到 `jwtExpired:true` 后清除并跳 /logout） |

**关键 Actions**：

| Action | API | 副作用 |
|---|---|---|
| `login({ loginData })` | POST /api/login | 写 localStorage['auth']，删除 isLogout 标记 |
| `logout()` | POST /api/logout | 先清 localStorage 再请求，失败时恢复状态 |
| `updateProfile({ entity, jsonData })` | PATCH /api/admin/profile/update | 写入新 auth state + localStorage |
| `resetPassword({ resetPasswordData })` | POST /api/resetpassword | 登录态设为 true |

---

### 2. erp slice

文件：`src/redux/erp/`

**State 结构**：
```js
{
  current:       { result: null },    // 当前选中的单条记录
  list:          { result: { items: [], pagination: {...} }, isLoading, isSuccess },
  create:        { result, isLoading, isSuccess },
  update:        { result, isLoading, isSuccess },
  delete:        { result, isLoading, isSuccess },
  read:          { result, isLoading, isSuccess },
  recordPayment: { result, current, isLoading, isSuccess },
  search:        { result: [], isLoading, isSuccess },
  summary:       { result, isLoading, isSuccess },
  mail:          { result, isLoading, isSuccess }
}
```

| 维度 | 说明 |
|---|---|
| **负责数据** | Invoice、Payment、Quote 的列表/详情/操作中间状态 |
| **主要读者** | `InvoiceDataTableModule`（list）、`ReadInvoiceModule`（read）、`CreateItem`（create.isSuccess）、`RecordPayment`（recordPayment） |
| **主要写者** | `src/redux/erp/actions.js` 中的所有 erp 动作 |
| **更新入口** | 各 Module 组件内 dispatch |
| **持久化** | ❌ 不持久化，页面刷新后重置 |

**keyState 机制**：reducer 用 `action.keyState` 动态更新对应子 slice（`list`/`create`/`update`/…），避免写多个 reducer。

**重要 Selector**：

```js
selectListItems      → erp.list（发票/付款列表）
selectCurrentItem    → erp.current（当前选中记录）
selectCreatedItem    → erp.create（创建状态，用于成功后跳转）
selectReadItem       → erp.read（详情数据）
selectRecordPaymentItem → erp.recordPayment（记录付款）
selectMailItem       → erp.mail（发送邮件状态）
```

---

### 3. crud slice

文件：`src/redux/crud/`

结构与 `erp` 相同，少 `recordPayment`、`summary`、`mail` 子状态。

| 维度 | 说明 |
|---|---|
| **负责数据** | Customer（Client）列表/详情/操作状态 |
| **主要读者** | `CrudModule`（Customer 页所有操作） |
| **主要写者** | `src/redux/crud/actions.js` |
| **持久化** | ❌ 不持久化 |

---

### 4. adavancedCrud slice（注意：名称有拼写错误）

文件：`src/redux/adavancedCrud/`

| 维度 | 说明 |
|---|---|
| **负责数据** | 高级 CRUD 操作状态，可能用于未来或 premium 功能 |
| **主要读者** | `context/adavancedCrud/` 同名 Context 中引用 |
| **持久化** | ❌ |

---

### 5. settings slice

文件：`src/redux/settings/`

**State 结构**：
```js
{
  result: {
    crm_settings:           { ... },
    finance_settings:       { last_invoice_number, last_quote_number, invoice_prefix, ... },
    company_settings:       { company_name, company_logo, company_address, ... },
    app_settings:           { idurar_app_date_format, idurar_app_language, idurar_app_email, ... },
    money_format_settings:  { currency_symbol, currency_position, ... }
  },
  isLoading: false,
  isSuccess: false   // ← ErpApp 用此字段判断设置是否已加载完成再渲染页面
}
```

**数据转换**：从 API 返回的 `[{ settingCategory, settingKey, settingValue }]` 数组，通过 `dispatchSettingsData()` 转为分组对象。

| 维度 | 说明 |
|---|---|
| **负责数据** | 全局业务配置（货币、语言、发票编号、公司信息等） |
| **主要读者** | `InvoiceForm`（last_invoice_number）、`useMoney()`、`useDate()`、`useLanguage()`、PDF 模板 |
| **主要写者** | `settingsAction.list`（ErpApp mount）、`settingsAction.update`、`settingsAction.updateMany`、`settingsAction.upload` |
| **更新入口** | `src/redux/settings/actions.js` |
| **持久化** | ✅ 每次成功后写入 `localStorage['settings']`；但初始化时不从 localStorage 恢复到 Redux store（每次进入应用都重新请求 listAll） |

---

## 二、React Context

### AppContext

文件：`src/context/appContext/`

```js
state: {
  isNavMenuClose: boolean,   // 侧边栏收起状态
  currentApp: string         // 当前激活的 App 名（default/expense/…）
}
```

- **更新**：`AppRouter` 监听路由变化，调用 `app.open(appName)` / `app.default()`。
- **读者**：`Navigation` 组件（控制菜单高亮）。

### ErpContext

文件：`src/context/erp/`

```js
state: {
  modal: { isOpen: boolean }  // DeleteModal 开关
}
```

- **更新**：`DataTable` 点击 Delete 时调用 `modal.open()`；`DeleteModal` 确认/取消后调用 `modal.close()`。

### ProfileContext

文件：`src/context/profileContext/`

```js
state: {
  read:     { isOpen: boolean },   // 显示资料卡片
  update:   { isOpen: boolean },   // 显示编辑表单
  password: { isOpen: boolean }    // 显示修改密码 Modal
}
```

---

## 三、自定义 Hooks

| Hook | 文件 | 负责数据 | 更新方式 |
|---|---|---|---|
| `useLanguage()` | `src/locale/useLanguage.jsx` | 翻译函数 `translate(key)` | 读 settings.app_settings.idurar_app_language，静态翻译表 |
| `useMoney()` | `src/settings/useMoney.jsx` | `moneyFormatter({ amount, currency_code })` | 读 settings.money_format_settings |
| `useDate()` | `src/settings/useDate.jsx` | `dateFormat`（如 DD/MM/YYYY） | 读 settings.app_settings.idurar_app_date_format |
| `useResponsive()` | `src/hooks/useResponsive.jsx` | `{ isMobile: boolean, screenSize }` | window resize 事件（全局单例监听） |
| `useMail({ entity })` | `src/hooks/useMail.jsx` | `{ send(id), isLoading }` | dispatch erp.mail action |
| `useFetch(fetchFn)` | `src/hooks/useFetch.jsx` | `{ result, isLoading, isSuccess, error }` | 调用时执行 fetchFn，本地 useState |
| `useDebounce` | `src/hooks/useDebounce.jsx` | 防抖值 | 计时器 |

---

## 四、localStorage 状态

| Key | 写入时机 | 读取时机 | 内容 |
|---|---|---|---|
| `auth` | 登录成功、updateProfile 成功 | 应用启动（store preloadedState）、request.js（取 token） | `{ current: { token, ...userInfo }, isLoggedIn, isLoading, isSuccess }` |
| `settings` | settingsAction.list/update/updateMany/upload 成功 | 无（每次进入应用都重新请求，localStorage 为备份） | 与 settings.result 同结构的对象 |
| `isLogout` | logout action 开始时 | errorHandler（区分主动登出与 token 过期跳转） | `{ isLogout: true }` |

---

## 五、URL 状态

- 发票 ID、付款 ID 通过 `/invoice/read/:id`、`/payment/read/:id` 等路径传递，组件内用 `useParams().id` 读取。
- 设置 Tab 通过 `/settings/edit/:settingsKey` 传递默认激活 Tab。
- **无发现** query string 驱动的状态（如 `?page=2` URL 分页同步）：分页状态在 Redux `erp.list.result.pagination` 中维护，不写入 URL。
