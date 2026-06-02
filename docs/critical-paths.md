# 核心链路清单

> 选取标准：**改造时容易出问题**的链路，而不是所有链路。  
> 共 8 条，按出错概率排序，越靠前越脆弱。

---

## 链路表

| # | 链路名 | 起点（接口） | 关键节点 | 终点（成功状态） |
|---|---|---|---|---|
| 1 | **付款创建 → 发票状态联动** | `POST /api/payment/create` | ① 校验 amount ≤ (total−discount−credit)；② `Payment.create()`；③ `Invoice.$inc(credit, amount)` + `$set(paymentStatus)` | Payment 写入，Invoice.credit 累加，paymentStatus 转为 paid / partially / unpaid |
| 2 | **付款更新 → 差值重算发票状态** | `PATCH /api/payment/update/:id` | ① 读旧 amount；② changedAmount = new−old；③ `Payment.$set(amount)`；④ `Invoice.$inc(credit, changedAmount)` + 重算 paymentStatus | Invoice.credit 仅变化差值，paymentStatus 状态机结果正确 |
| 3 | **发票创建 → 金额计算 + 序号自增** | `POST /api/invoice/create` | ① Joi validate（仅 9 个字段）；② 后端计算 subTotal / taxTotal / total；③ `Invoice.save()`；④ `increaseBySettingKey('last_invoice_number')` | Invoice 落库，金额正确，Setting.last_invoice_number +1 |
| 4 | **发票更新 → 保留已付金额重算状态** | `PATCH /api/invoice/update/:id` | ① 读旧 Invoice.credit；② 用新 total/discount 和旧 credit 判定 paymentStatus；③ `Invoice.findOneAndUpdate()` | 已付金额不变，paymentStatus 根据新 total 重新判定 |
| 5 | **JWT 认证守卫 → Session 双重校验** | 所有受保护接口（`/api` 除认证外） | ① `jwt.verify(token, JWT_SECRET)`；② 并行查 Admin + AdminPassword；③ `loggedSessions.includes(token)` | 三关全过才 next()，任意一关失败返回 401 + jwtExpired:true |
| 6 | **登录 → Token 注册 / 登出 → Token 注销** | `POST /api/login` / `POST /api/logout` | 登录：`jwt.sign()` → `AdminPassword.$push(loggedSessions, token)`；登出：`AdminPassword.$pull(loggedSessions, token)` | 登录后 token 在 loggedSessions；登出后 token 被移除，同 token 再请求返回 401 |
| 7 | **Settings 全量加载 → 前端渲染门控** | `ErpApp` mount → `GET /api/setting/listAll` | ① listAll 返回 54 条；② Redux settings.isSuccess = true；③ ErpApp 才渲染页面；④ InvoiceForm 读 `last_invoice_number` | settings.isSuccess = true，页面正常渲染，表单默认序号正确 |
| 8 | **PDF 按需生成 → 磁盘写入 → 流式下载** | `GET /download/:dir/:file` | ① DB 查对应记录；② pug 模板渲染 HTML；③ html-pdf（PhantomJS）生成文件到 `src/public/download/`；④ `res.download()` 流式返回 | HTTP 200 + Content-Type: application/pdf，文件可正常打开 |

---

## 为什么这 8 条最脆弱

| 链路 | 高风险原因 |
|---|---|
| 1. 付款创建联动 | 两次 DB 写入（Payment + Invoice）没有事务，任意一步失败导致数据不一致 |
| 2. 付款更新差值 | 差值计算 `changedAmount = new − old` 依赖读旧值；并发或重试时易出现双重计数 |
| 3. 发票创建序号 | `Invoice.save()` 和 `increaseBySettingKey()` 是两个独立操作，失败不回滚，序号可能跳号 |
| 4. 发票更新状态 | 修改 total/discount 时需用**旧 credit**重算状态，忘记读旧值直接用请求体会误判为 unpaid |
| 5. JWT Session 双查 | 每个受保护请求都触发两次并行 DB 查询；改 Admin 模型字段、重置 DB、或 `removed` 字段逻辑变动都会让守卫意外拒绝合法用户 |
| 6. 登录/登出 Session 对称 | Push 和 Pull 必须对称维护；任何一端逻辑变更（如换 token 存储方式）都可能让另一端失效 |
| 7. Settings 门控 | `isSuccess` 是全局渲染门控；API 报错、字段改名或 Redux 结构变动都会让页面白屏 |
| 8. PDF 生成链路 | 依赖 PhantomJS 二进制（html-pdf）、文件系统写权限、pug 模板和 Settings 配置四个外部因素，任一变动均可静默失败 |
