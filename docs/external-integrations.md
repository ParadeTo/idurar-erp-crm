# 外部集成清单

---

## 1. MongoDB（必须）

**用途**：唯一数据存储，所有业务数据和配置均存储于此。

| 维度 | 说明 |
|---|---|
| **调用位置** | `src/server.js`：`mongoose.connect(process.env.DATABASE)` |
| **库** | `mongoose ^8`、`mongoose-autopopulate ^1` |
| **连接时机** | 服务器启动时，连接失败打印错误并不退出（继续监听但所有 DB 操作失败） |
| **输入** | 所有 CRUD 操作通过 Mongoose Model |
| **输出** | 返回 Mongoose 文档对象 |
| **失败处理** | `mongoose.connection.on('error', ...)` 打印错误日志；API 层 `catchErrors` 捕获 Mongoose 异常，通过 `errorHandlers.productionErrors` 返回 500 |
| **环境变量** | `DATABASE="mongodb://..."` 或 Atlas URI |
| **索引** | 无显式索引定义（AdminPassword.user 注释了 index），依赖默认 `_id` 索引；`removed: false` 字段无索引（全量扫描） |

---

## 2. JWT 认证（必须）

**用途**：无状态身份验证 token，附在所有受保护 API 的 Authorization 头。

| 维度 | 说明 |
|---|---|
| **调用位置（签发）** | `createAuthMiddleware/authUser.js`：`jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '24h' 或 '8760h' })` |
| **调用位置（验证）** | `createAuthMiddleware/isValidAuthToken.js`：`jwt.verify(token, JWT_SECRET)` |
| **库** | `jsonwebtoken ^9`、`bcryptjs ^2`（密码哈希） |
| **输入** | 登录时：email + password + remember；后续请求：`Authorization: Bearer <token>` |
| **输出** | 登录成功：token 写入响应，前端存入 localStorage；请求验证：req.admin 注入 |
| **失败处理** | 无 token → 401 `jwtExpired:true`；token 不在 loggedSessions 中 → 401；前端 `errorHandler` 检测 `jwtExpired` 后清 localStorage + 跳转 /logout |
| **环境变量** | `JWT_SECRET="your_private_jwt_secret_key"` |
| **会话存储** | Token 列表存储在 `AdminPassword.loggedSessions[]`；退出时 $pull；remember=false 时 24h 自然过期 |

---

## 3. bcryptjs（密码哈希，必须）

**用途**：密码加盐哈希存储和验证。

| 维度 | 说明 |
|---|---|
| **调用位置** | `AdminPassword.generateHash(salt, password)`、`authUser.js` 的 `bcrypt.compare()` |
| **输入** | salt（shortid 生成）+ 用户明文密码 |
| **输出** | 哈希字符串（存入 AdminPassword.password） |
| **失败处理** | 哈希不匹配 → 403 "Invalid credentials" |
| **库** | `bcryptjs ^2`（纯 JS，无 native binding） |

---

## 4. Resend（邮件服务，可选/Premium）

**用途**：发送密码重置邮件；发票/付款通知邮件（Premium 版本）。

| 维度 | 说明 |
|---|---|
| **调用位置（密码重置）** | `createAuthMiddleware/sendMail.js` → 调用 Resend SDK |
| **调用位置（Invoice 邮件）** | `invoiceController/sendMail.js`（OSS 版 stub，直接返回"请升级 Premium"） |
| **调用位置（Payment 邮件）** | `paymentController/sendMail.js`（同上，stub） |
| **输入** | `{ email, name, link, subject, idurar_app_email, type }` |
| **输出** | Resend API 响应 |
| **失败处理** | OSS 版密码重置邮件若 RESEND_API 未配置会抛出异常（被 catchErrors 捕获返回 500） |
| **环境变量** | `RESEND_API="re_..."` |
| **依赖设置** | 还需要在 Setting 中配置 `idurar_app_email`（发件人）和 `idurar_base_url`（重置链接域名） |

---

## 5. OpenAI（可选）

**用途**：AI 辅助功能。

| 维度 | 说明 |
|---|---|
| **调用位置** | `server.js` 中读取 `process.env.OPENAI_API_KEY`，但当前代码未见具体调用 |
| **库** | `openai ^4` |
| **环境变量** | `OPENAI_API_KEY="sk-..."` |
| **现状** | 包已安装，key 已读取，但在扫描到的源文件中未发现实际的 OpenAI API 调用逻辑，可能为 Premium 功能预留位置 |

---

## 6. AWS S3（可选，替代本地存储）

**用途**：文件上传的云端存储后端（替代 Multer 本地磁盘）。

| 维度 | 说明 |
|---|---|
| **调用位置** | `src/middlewares/uploadMiddleware/DoSingleStorage.js` |
| **库** | `@aws-sdk/client-s3 ^3` |
| **输入** | 本地临时文件 |
| **输出** | S3 对象 URL |
| **与本地存储关系** | `singleStorageUpload` 选择 LocalSingleStorage（Multer 磁盘）或 DoSingleStorage（S3）；具体路由选择见 uploadMiddleware/index.js |
| **环境变量** | `VITE_FILE_BASE_URL`（前端用于拼接 S3 文件 URL） |
| **失败处理** | S3 SDK 异常由 catchErrors 捕获 |

---

## 7. Multer（本地文件上传，必须）

**用途**：头像、公司 logo、发票附件等文件的本地磁盘上传。

| 维度 | 说明 |
|---|---|
| **调用位置** | `src/middlewares/uploadMiddleware/singleStorageUpload.js`（Multer diskStorage） |
| **存储路径** | `src/public/uploads/{entity}/`（entity = admin / setting / invoice 等） |
| **文件名规则** | `{slug(originalname)}-{5位随机ID}{extension}` |
| **库** | `multer ^1`、`transliteration ^2`（将非 ASCII 文件名转义） |
| **文件过滤** | `LocalfileFilter.js` 限制允许的 MIME 类型 |
| **路由使用** | `PATCH /api/admin/profile/update`（头像）、`PATCH /api/setting/upload/:settingKey`（logo） |
| **失败处理** | Multer 错误由 callback 传递给 Express 错误处理中间件 |
| **环境变量** | `PUBLIC_SERVER_FILE="http://localhost:8888/"`（前端拼接文件 URL） |

---

## 8. html-pdf + pug（PDF 生成，必须）

**用途**：生成发票、付款、报价单的 PDF 文件，通过 `/download/:dir/:file` 接口下载。

| 维度 | 说明 |
|---|---|
| **调用位置** | `src/controllers/pdfController/index.js`，在 `invoiceController/create.js`、`paymentController/create.js` 等设置 pdf 字段名后按需生成（GET /download 触发） |
| **模板** | `src/pdf/Invoice.pug`、`src/pdf/Payment.pug`、`src/pdf/Quote.pug`、`src/pdf/Offer.pug` |
| **输入** | MongoDB 查询结果（Invoice/Payment 记录）+ Settings（公司信息、货币格式、语言） |
| **输出** | PDF 文件写入磁盘，然后通过 `res.download()` 流式返回 |
| **生成时机** | 按需（GET /download 时），已存在则删除重新生成 |
| **失败处理** | 文件生成失败由 catchErrors 捕获返回 503 |
| **库** | `html-pdf ^3`（PhantomJS 内核）、`pug ^3`（模板引擎） |

---

## 9. express-rate-limit（请求限流）

| 维度 | 说明 |
|---|---|
| **调用位置** | `src/app.js` 或中间件层（代码中已安装，具体 limit 配置需确认） |
| **库** | `express-rate-limit ^7` |
| **失败处理** | 超出限制返回 429 Too Many Requests |
| **环境变量** | 无 |

---

## 10. 浏览器 API

| API | 使用位置 | 说明 |
|---|---|---|
| `localStorage` | `storePersist.js`、`auth/actions.js`、`settings/actions.js`、`errorHandler.js` | 持久化 auth 和 settings；登出时清除 |
| `window.open()` | `ErpPanelModule/DataTable.jsx`、`ErpPanelModule/ReadItem.jsx` | 新标签页打开 PDF 下载 URL |
| `window.addEventListener('resize')` | `hooks/useResponsive.jsx` | 响应式布局判断，全局单例 |
| `navigator.onLine` | `request/errorHandler.js` | 区分网络错误和服务器错误 |
| `window.location.href` | `request/errorHandler.js` | JWT 过期时强制跳转 /logout |

---

## 11. 部署平台

| 维度 | 说明 |
|---|---|
| **Docker** | 未发现 Dockerfile 或 docker-compose 文件 |
| **CI/CD** | 未发现 .github/workflows 配置 |
| **推荐平台** | README 中提及 DigitalOcean（赞助商）；企业版部署于 `cloud.idurarapp.com` |
| **启动命令** | 后端：`npm run dev`（开发）/ `npm start`（生产）；前端：`npm run dev`（Vite）/ `npm run build`（生产构建） |
| **环境变量汇总** | 见下表 |

### 完整环境变量参考

| 变量名 | 位置 | 必需 | 说明 |
|---|---|---|---|
| `DATABASE` | backend/.env | ✅ | MongoDB 连接 URI |
| `JWT_SECRET` | backend/.env | ✅ | JWT 签名密钥 |
| `PORT` | backend/.env | 否 | 默认 8888 |
| `NODE_ENV` | backend/.env | 否 | production / development |
| `PUBLIC_SERVER_FILE` | backend/.env | ✅ | 文件访问基础 URL（如 http://localhost:8888/） |
| `OPENSSL_CONF` | backend/.env | 否 | Node 17+ OpenSSL 兼容 |
| `RESEND_API` | backend/.env | 否 | Resend 邮件 API Key |
| `OPENAI_API_KEY` | backend/.env | 否 | OpenAI API Key |
| `VITE_BACKEND_SERVER` | frontend/.env | 否（生产必需） | 后端 URL（生产环境必须设置） |
| `VITE_DEV_REMOTE` | frontend/.env | 否 | 设为 'remote' 时连接远程后端 |
| `VITE_FILE_BASE_URL` | frontend/.env | 否 | S3 文件 CDN 基础 URL |
