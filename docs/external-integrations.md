# External Integrations

本文档基于 package、env、README/INSTALLATION、前后端代码和 GitHub 配置生成。

## MongoDB

- 类型：数据库。
- 调用位置：
  - `backend/src/server.js`
  - `backend/src/setup/setup.js`
  - `backend/src/setup/reset.js`
- 环境变量：`DATABASE`。
- 输入：MongoDB connection URI。
- 输出：Mongoose connection；所有 model 读写依赖它。
- 失败处理：
  - `server.js` 监听 `mongoose.connection.on('error')`，打印检查 `.env` 和 MongoDB URL 的提示。
- 使用数据：
  - Admin、AdminPassword、Setting、Client、Invoice、Payment。

## JWT Authentication

- 类型：认证。
- 调用位置：
  - `createAuthMiddleware/authUser.js`
  - `createAuthMiddleware/isValidAuthToken.js`
  - `createAuthMiddleware/resetPassword.js`
- 环境变量：`JWT_SECRET`。
- 输入：
  - 登录时 Admin id。
  - 请求时 Authorization Bearer token。
- 输出：
  - 登录/reset password 返回 JWT。
  - 认证中间件设置 `req.admin`。
- 失败处理：
  - 无 token、verify 失败、用户不存在、loggedSessions 不包含 token 时返回 401，并带 `jwtExpired: true`。
  - 前端 `request/errorHandler.js` 发现 `jwtExpired` 会清除 localStorage auth 并跳转 `/logout`。

## bcryptjs

- 类型：密码 hash。
- 调用位置：
  - `AdminPassword.generateHash`
  - `authUser.js`
  - `resetPassword.js`
  - `updatePassword.js`
  - `updateProfilePassword.js`
- 输入：`salt + password`。
- 输出：bcrypt hash 或 compare 结果。
- 失败处理：密码不匹配返回 403。

## Resend Email

- 类型：邮件服务。
- 调用位置：
  - `controllers/middlewaresControllers/createAuthMiddleware/sendMail.js`
  - `forgetPassword.js`
- 环境变量：`RESEND_API`。
- 输入：
  - `email`
  - `name`
  - `link`
  - `idurar_app_email`
  - `subject`
- 输出：`resend.emails.send` 返回的 data。
- 失败处理：
  - sendMail 本身没有局部 try/catch；由外层 `catchErrors` 或 Express error handler 处理。
- 注意：
  - Invoice/Payment 的 `/mail` API 当前不使用 Resend，只返回升级提示。

## Local File Upload

- 类型：本地文件上传。
- 调用位置：
  - `middlewares/uploadMiddleware/singleStorageUpload.js`
  - `middlewares/uploadMiddleware/LocalSingleStorage.js`
  - `routes/coreRoutes/coreApi.js`
- 使用接口：
  - `PATCH /api/admin/profile/update`
  - `PATCH /api/setting/upload/:settingKey`
- 输入：multipart `file`。
- 输出：
  - 文件写入 `backend/src/public/uploads/<entity>`。
  - `req.upload` 记录文件元数据。
  - `req.body[fieldName]` 写为 `public/uploads/<entity>/<filename>`。
- 失败处理：
  - file filter 不通过时由 multer 错误流程处理。
- 环境变量：无。

## Public File Serving

- 类型：静态文件读取。
- 调用位置：
  - `routes/coreRoutes/corePublicRouter.js`
- API：`GET /public/:subPath/:directory/:file`
- 输入：路径参数。
- 输出：`res.sendFile`。
- 失败处理：
  - 使用 `isPathInside` 防止路径逃逸；非法路径返回 400。
  - 文件不存在返回 404。
- 环境变量：前端使用 `VITE_FILE_BASE_URL` 拼头像/logo URL。

## PDF Generation

- 类型：服务端 PDF 生成。
- 调用位置：
  - `handlers/downloadHandler/downloadPdf.js`
  - `controllers/pdfController/index.js`
- API：`GET /download/:directory/:file`
- 依赖：
  - `pug`
  - `html-pdf`
  - `moment`
  - settings/useMoney/useDate/useLanguage
- 输入：
  - URL directory 和 file 推导 modelName 和 id。
  - Mongoose 查询对应实体。
  - Pug 模板：`Invoice.pug`、`Payment.pug`、`Quote.pug`、`Offer.pug`。
- 输出：
  - `src/public/download/<folder>/<file>.pdf`
  - `res.download`。
- 环境变量：
  - `PUBLIC_SERVER_FILE`，用于 PDF 模板中的公司 logo URL。
- 失败处理：
  - model 不存在返回 404。
  - id/validation 问题返回 400。
  - 文件下载失败返回 500。

## DigitalOcean Spaces / S3

- 类型：对象存储。
- 调用位置：
  - `middlewares/uploadMiddleware/DoSingleStorage.js`
- 依赖：`@aws-sdk/client-s3`。
- 环境变量：
  - `DO_SPACES_SECRET`
  - `DO_SPACES_KEY`
  - `DO_SPACES_URL`
  - `REGION`
  - `DO_SPACES_NAME`
- 输入：`req.files.file`。
- 输出：上传到 bucket，ACL `public-read`，并设置 `req.body[fieldName]`。
- 失败处理：上传失败返回 403。
- 当前状态：未发现该 middleware 被 `uploadMiddleware/index.js` 导出，也未发现路由使用；因此标为声明存在但未接入主链路。

## OpenAI

- 类型：第三方 SDK。
- 调用位置：
  - `backend/package.json` 声明 `openai`。
  - `backend/src/server.js` 读取 `OPENAI_API_KEY` 到常量。
- 环境变量：`OPENAI_API_KEY`。
- 当前状态：未发现 `new OpenAI`、OpenAI API 调用或业务 controller 使用。

## Browser APIs

### localStorage

- 调用位置：
  - `redux/storePersist.js`
  - `redux/auth/actions.js`
  - `redux/settings/actions.js`
  - `request/errorHandler.js`
  - `locale/useLanguage.jsx`
- 用途：
  - 保存 `auth`、`settings`、`isLogout`、`lang`。
- 失败处理：
  - `storePersist.get` 会检查 JSON 格式，不合法则移除 key。
  - `localStorageHealthCheck` 存在但未启用。

### navigator.onLine

- 调用位置：`request/errorHandler.js`。
- 用途：区分网络离线和服务器连接失败。
- 失败处理：显示 AntD notification 并返回统一错误对象。

### window.open

- 调用位置：
  - `ErpPanelModule/DataTable.jsx`
  - `ErpPanelModule/ReadItem.jsx`
- 用途：打开 PDF 下载 URL。

### window.location.href

- 调用位置：`request/errorHandler.js`。
- 用途：JWT 失效时跳转 `/logout`。

## Vite Dev Proxy and Frontend Env

- 调用位置：
  - `frontend/vite.config.js`
  - `frontend/src/config/serverApiConfig.js`
- 环境变量：
  - `VITE_BACKEND_SERVER`
  - `VITE_FILE_BASE_URL`
  - `VITE_DEV_REMOTE`
- 行为：
  - dev server 端口 3000。
  - `/api` proxy 默认指向 `http://localhost:8888/`。
  - `VITE_DEV_REMOTE=remote` 时 proxy 使用 `VITE_BACKEND_SERVER`。

## GitHub Workflows

- 文件：
  - `.github/workflows/codesee-arch-diagram.yml`
  - `.github/workflows/github-repo-stats.yml`
- 集成：
  - CodeSee action。
  - github-repo-stats scheduled workflow。
- 环境/secret：
  - `CODESEE_ARCH_DIAG_API_TOKEN`
  - `ghrs_github_api_token`

## Deployment Platform

- README/INSTALLATION 指向本地 npm 运行和 MongoDB 集群。
- `doc/README.sp.md`、`doc/README.fr.md` 提到 `docker-compose.yml`，但仓库扫描未发现 Dockerfile 或 docker-compose 文件。
- 未发现 Vercel、Render、Fly、Railway 等部署平台配置。

## Node Runtime

- 后端 package engines：Node `20.9.0`、npm `10.2.4`。
- 前端 package engines：Node `20.9.0`、npm `10.2.4`。
- 后端 `server.js` 检查 Node major 至少 20。
