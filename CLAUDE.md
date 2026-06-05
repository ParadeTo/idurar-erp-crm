# IDURAR ERP/CRM — CLAUDE.md

> 给 AI 助手看的项目导航手册。改代码前先读这里，细节查 `docs/`。

---

## 项目定位

开源 ERP / CRM，核心场景：**发票管理、客户管理、收款记录**。
技术栈：Node.js 20 + Express 4 + MongoDB（后端）/ React 18 + Vite + Ant Design 5 + Redux（前端）。
OSS 版与企业版并存：Quote（报价单）、PaymentMode、Taxes 等模块的后端 Model **在当前仓库中缺失**，是企业版功能，改动时不要假设它们存在。

---

## 目录结构

```
/
├── backend/          Node.js/Express API 服务
│   └── src/
│       ├── server.js         入口：连 MongoDB，glob 加载所有 Model，启动 Express
│       ├── app.js            挂载路由、全局中间件
│       ├── routes/           coreRoutes（auth/admin/setting）+ appRoutes（invoice/client/payment）
│       ├── controllers/      coreControllers + appControllers + middlewaresControllers（工厂）
│       ├── models/           coreModels（Admin/Setting/Upload）+ appModels（Client/Invoice/Payment）
│       ├── middlewares/      JWT 验证、Multer 上传、Settings 读写
│       ├── pdf/              Pug 模板（Invoice/Payment/Quote/Offer）
│       └── setup/            初始化脚本 + defaultSettings JSON
└── frontend/         React/Vite SPA
    └── src/
        ├── main.jsx / RootApp.jsx   入口
        ├── apps/                    IdurarOs（auth 守卫）+ ErpApp（主框架）
        ├── router/                  AppRouter + AuthRouter + routes.jsx
        ├── pages/                   每个路由对应一个薄包装页
        ├── modules/                 业务模块（InvoiceModule/PaymentModule/CrudModule/…）
        ├── redux/                   auth / erp / crud / settings / adavancedCrud slices
        ├── request/                 axios 封装（request.js + errorHandler）
        └── context/                 AppContext / ErpContext / ProfileContext
```

---

## 核心架构

→ 架构总览图：[docs/system-architecture.svg](docs/system-architecture.svg)  
→ 前端架构图：[docs/frontend-architecture.svg](docs/frontend-architecture.svg)  
→ 后端架构图：[docs/backend-architecture.svg](docs/backend-architecture.svg)  
→ 模块依赖图：[docs/module-deps.svg](docs/module-deps.svg)

**三条关键链路**：

1. **认证**：前端 `auth/auth.service.js` → `POST /api/login` → JWT 签发 → 存 `localStorage['auth']` → `request.js` 自动附加 Bearer header。Token 同时写入 `AdminPassword.loggedSessions[]`，退出时删除。

2. **业务 CRUD**：前端 dispatch `erp` / `crud` Redux action → `request.js` axios → 后端 `isValidAuthToken` middleware → `appApi.js` 路由（自动根据 appModels glob 注册）→ Controller（自定义或 `createCRUDController` 工厂）→ Mongoose Model → MongoDB。

3. **配置下发**：ErpApp 挂载时 dispatch `settingsAction.list` → `GET /api/setting/listAll` → 写 Redux `settings` slice + `localStorage['settings']` → 全局通过 `useMoney()` / `useDate()` / `useLanguage()` 消费。

---

## 关键模块

| 模块 | 位置 | 一句话职责 |
|---|---|---|
| `createCRUDController` | `backend/src/controllers/middlewaresControllers/createCRUDController/` | 工厂函数，给任意 Mongoose Model 生成 create/read/update/delete/list/search/filter/summary 方法 |
| `createAuthMiddleware` | `backend/src/controllers/middlewaresControllers/createAuthMiddleware/` | 工厂函数，生成 login/logout/isValidAuthToken/forgetPassword/resetPassword |
| `appApi.js` 路由注册 | `backend/src/routes/appRoutes/appApi.js` | glob 扫描 appModels 目录，自动为每个 Model 注册 RESTful 路由 + 自定义扩展（mail/convert）|
| `request.js` | `frontend/src/request/request.js` | axios 统一封装，自动读 localStorage auth.token 注入 Authorization 头，JWT 失效时跳 /logout |
| `erp` Redux slice | `frontend/src/redux/erp/` | 管理 Invoice / Payment / Quote 的 list/read/create/update/delete/recordPayment/mail 状态，用 keyState 动态路由到子 slice |
| `ErpPanelModule` | `frontend/src/modules/ErpPanelModule/` | 通用 ERP 面板：DataTable（列表）+ CreateItem + ReadItem + UpdateItem + DeleteItem，被各业务 Module 复用 |
| `pdfController` | `backend/src/controllers/pdfController/index.js` | 按需生成 PDF：pug 模板 + html-pdf，GET /download 触发 |
| `storePersist` | `frontend/src/redux/storePersist.js` | localStorage 读写封装，管理 auth / settings / isLogout 三个 key |

---

## 关键约定

### 后端

- **软删除**：所有 Model 都有 `removed: Boolean`，删除只做 `$set: { removed: true }`，查询始终加 `{ removed: false }`。不要物理删除文档。
- **路由自动注册**：在 `backend/src/models/appModels/` 新增 Model 文件后，路由和基础 CRUD Controller 会自动注册，无需修改路由文件。如需自定义行为，在 `controllers/appControllers/{modelName}Controller/` 下创建同名目录并 export 覆盖方法。
- **金额计算**：Invoice/Payment 所有金额由后端用 `currency.js` 精度安全计算，前端只展示，不要在前端写入最终金额到后端。
- **Setting 自增**：每次创建 Invoice 后调用 `increaseBySettingKey('last_invoice_number')`，创建 Payment 类似。不要跳过这一步。
- **认证 token 存储**：Token 列表在 `AdminPassword.loggedSessions[]`，退出用 `$pull`，不是清空整个数组（支持多设备登录）。

### 前端

- **erp vs crud slice**：Invoice / Payment / Quote 用 `erp` slice；Customer 用 `crud` slice。两者结构几乎一致，不要混用。
- **页面是薄包装**：`src/pages/` 下的组件只做配置组装（entity name、labels、column 定义），实际逻辑在 `src/modules/` 对应 Module 里。
- **Settings 在所有页面渲染前加载**：`ErpApp` 等 `settings.isSuccess === true` 才渲染内容，新组件如需配置值直接从 Redux `settings` slice selector 读取，不要重复请求。
- **errorHandler 统一处理**：检测到 `jwtExpired: true` 会自动清 localStorage 并跳转 `/logout`，不需要在业务代码里再处理 401。
- **`adavancedCrud` 拼写错误**：代码中 `adavancedCrud`（少一个 n）是已有写法，保持原样，不要"修正"。

---

## 怎么跑

```bash
# 1. 配置后端环境变量
cp backend/temp.env backend/.env
# 编辑 .env，至少填写：DATABASE、JWT_SECRET、PUBLIC_SERVER_FILE

# 2. 安装并初始化后端
cd backend && npm install
npm run setup          # 写入默认 Admin (admin@admin.com / admin123) 和 Settings

# 3. 启动后端（port 8888）
npm run dev

# 4. 安装并启动前端（port 3000，新终端）
cd frontend && npm install
npm run dev
```

访问 `http://localhost:3000`，用 `admin@admin.com` / `admin123` 登录。

**其他脚本**：
- `backend/npm run reset` — 清空数据库（危险）
- `backend/npm run upgrade` — 数据迁移
- `frontend/npm run dev:remote` — 连远程后端（需设置 `VITE_BACKEND_SERVER`）

---

## 详细参考文档

| 文档 | 内容 |
|---|---|
| [docs/api-list.md](docs/api-list.md) | 全部后端接口（方法、路径、入参、返回、权限） |
| [docs/backend-data-model.md](docs/backend-data-model.md) | 所有 Mongoose Schema 字段说明与关联关系 |
| [docs/routes-pages.md](docs/routes-pages.md) | 前端路由与页面组件对照表 |
| [docs/ui-actions.md](docs/ui-actions.md) | 用户操作 → Redux → API 的完整映射 |
| [docs/frontend-state-model.md](docs/frontend-state-model.md) | Redux slice / Context / Hook / localStorage 说明 |
| [docs/domain-model.md](docs/domain-model.md) | 业务领域模型（含 OSS 缺失模块说明） |
| [docs/data-flow.md](docs/data-flow.md) | 登录、创建发票、记录付款三条完整数据流 |
| [docs/external-integrations.md](docs/external-integrations.md) | 外部依赖（MongoDB/JWT/Resend/S3/pdf/Multer）与环境变量汇总 |

---

## 禁区

> 待补充：记录不能动的代码、不能改的接口约定、生产数据相关的注意事项。

---

## 历史包袱

> 待补充：记录绕不开的历史决策、已知技术债、迁移中途的半成品。

已知条目（从代码中观察，待确认）：
- `adavancedCrud` 拼写错误贯穿前端代码，无法单独修正。
- `Upload` Model 注册名有尾部空格（`mongoose.model('Upload ', ...)`），可能导致 model 引用问题。
- Quote / PaymentMode / Taxes 功能属企业版，OSS 版无后端 Model 也无页面组件。原 `routes.jsx` 中的对应路由定义会触发 `ReferenceError`，已删除这 6 条路由。
