# 运行环境依赖清单

> 基于 `backend/package.json`、`frontend/package.json`、`.env` 模板及源码 `process.env.*` 扫描生成。  
> 标注 **必填** 的项目缺失会导致启动失败或核心功能不可用。

---

## 一、运行时环境

### Node.js

| 项目 | 要求 |
|---|---|
| 版本 | **v20.9.0**（`engines.node` 精确声明） |
| 最低主版本 | v20 |
| 验证 | `node -v` |
| 端口 | — |
| 初始化 | 无 |

> Node 17 以下在某些系统会触发 OpenSSL 兼容报错，需设 `OPENSSL_CONF='/dev/null'` 绕过。

### npm

| 项目 | 要求 |
|---|---|
| 版本 | **10.2.4**（`engines.npm` 精确声明） |
| 验证 | `npm -v` |
| 初始化 | `cd backend && npm install`；`cd frontend && npm install` |

---

## 二、必填外部服务

### MongoDB

| 项目 | 说明 |
|---|---|
| **必填** | ✅ 启动时立即连接，失败则所有 API 报错 |
| 主版本 | v6 / v7 / v8（mongoose ^8 兼容） |
| 默认端口 | **27017** |
| 连接信息 | 本地：`mongodb://localhost:27017/idurar`<br>Atlas：`mongodb+srv://<user>:<pass>@cluster.mongodb.net/<db>` |
| 环境变量 | `DATABASE="<连接 URI>"` |
| 初始化 | 创建库后运行 `npm run setup`（写入 Admin 账号 + 默认 Settings） |
| 验证 | `mongosh "$DATABASE" --eval "db.adminCommand('ping')"` |

**setup 写入内容**：

| 集合 | 写入内容 |
|---|---|
| `admins` | `admin@admin.com` / `admin123`（enabled: true） |
| `adminpasswords` | 对应密码哈希 + 空 loggedSessions |
| `settings` | 约 50 条默认配置（货币、语言、发票前缀等） |
| `paymentmodes` | Default Payment（现金/转账） |
| `taxes` | Tax 0% |

---

## 三、后端环境变量（`backend/.env`）

复制 `backend/.env` 并按下表填写（已有文件，直接编辑）。

| 变量名 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `DATABASE` | ✅ | 无 | MongoDB 连接 URI |
| `JWT_SECRET` | ✅ | `"your_private_jwt_secret_key"` | JWT 签名密钥，生产环境必须换成强随机字符串 |
| `PUBLIC_SERVER_FILE` | ✅ | `"http://localhost:8888/"` | 后端文件访问基础 URL（头像、Logo 等），结尾带 `/` |
| `PORT` | 否 | `8888` | Express 监听端口 |
| `NODE_ENV` | 否 | `"production"` | 环境标识 |
| `OPENSSL_CONF` | 否 | `'/dev/null'` | Node 17+ OpenSSL 兼容，报 `ERR_OSSL_EVP_UNSUPPORTED` 时填 |
| `RESEND_API` | 否 | 无 | Resend 邮件 API Key（忘记密码邮件必须，Invoice 邮件为 Premium） |
| `OPENAI_API_KEY` | 否 | 无 | OpenAI API Key（AI 功能，当前 OSS 版未见实际调用） |
| `DO_SPACES_KEY` | 否 | 无 | DigitalOcean Spaces 访问 Key（S3 文件存储，替代本地磁盘） |
| `DO_SPACES_SECRET` | 否 | 无 | Spaces 密钥 |
| `DO_SPACES_URL` | 否 | 无 | Spaces endpoint，格式：`<region>.digitaloceanspaces.com` |
| `DO_SPACES_NAME` | 否 | 无 | Spaces Bucket 名 |
| `REGION` | 否 | 无 | S3 region（如 `us-east-1`） |

---

## 四、前端环境变量（`frontend/.env`）

复制 `frontend/temp.env` 为 `frontend/.env` 并按下表填写。

| 变量名 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `VITE_BACKEND_SERVER` | 生产必填 | 无 | 后端完整 URL，格式：`http://your-server.com/`（结尾带 `/`）。开发环境不设则自动用 `http://localhost:8888/` |
| `VITE_FILE_BASE_URL` | 否 | 无 | 文件 CDN 基础 URL（用 S3 存储时设为 Spaces 公开地址） |
| `VITE_DEV_REMOTE` | 否 | 无 | 设为 `remote` 时开发模式连接 `VITE_BACKEND_SERVER` 指向的远程后端 |

> `PROD` 和 `import.meta.env.PROD` 由 Vite 自动注入，无需手动设置。

---

## 五、可选外部服务

### Resend（邮件）

| 项目 | 说明 |
|---|---|
| 用途 | 密码重置邮件（OSS 必须）；Invoice/Payment 通知邮件（Premium） |
| 端口 | — 云 API，无本地端口 |
| 连接信息 | `https://api.resend.com`（SDK 内置） |
| 环境变量 | `RESEND_API="re_..."` |
| 额外配置 | 在 `/settings` → General Settings 填写 `idurar_app_email`（Resend 已验证的发件人地址）和 `idurar_base_url`（重置密码链接域名） |
| 未配置后果 | 忘记密码接口返回 500；Invoice/Payment 邮件按钮返回 Premium 提示 |

### DigitalOcean Spaces / AWS S3（文件存储）

| 项目 | 说明 |
|---|---|
| 用途 | 替代本地 Multer 磁盘存储（头像、Logo、发票附件） |
| 端口 | — 云 API |
| 连接信息 | endpoint：`https://<DO_SPACES_URL>` |
| 环境变量 | `DO_SPACES_KEY`、`DO_SPACES_SECRET`、`DO_SPACES_URL`、`DO_SPACES_NAME`、`REGION` |
| 未配置后果 | 默认退回本地磁盘存储（`backend/src/public/uploads/`），功能正常 |

### OpenAI

| 项目 | 说明 |
|---|---|
| 用途 | AI 辅助功能（当前 OSS 版代码中未见实际 API 调用，为预留位置） |
| 环境变量 | `OPENAI_API_KEY="sk-..."` |
| 未配置后果 | 无影响 |

---

## 六、隐式运行时依赖（npm install 自动处理）

| 依赖 | 版本 | 说明 | 注意事项 |
|---|---|---|---|
| PhantomJS | 内置于 html-pdf ^3 | PDF 生成引擎 | `npm install` 时自动下载 binary，网络受限环境可能失败 |
| Pug | ^3 | PDF HTML 模板引擎 | 无需单独安装 |
| Multer | ^1 | 本地文件上传（头像、Logo） | 自动创建 `backend/src/public/uploads/` 目录 |

---

## 七、端口汇总

| 服务 | 默认端口 | 环境变量控制 |
|---|---|---|
| Express 后端 API | **8888** | `PORT` |
| Vite 前端 Dev Server | **3000** | Vite 配置（`vite.config.js`） |
| MongoDB | **27017** | 在 `DATABASE` URI 中指定 |

---

## 八、最小启动检查清单

首次启动前逐项确认：

- [ ] Node.js v20 已安装（`node -v`）
- [ ] npm v10 已安装（`npm -v`）
- [ ] MongoDB 实例可访问（本地或 Atlas）
- [ ] `backend/.env` 已填写 `DATABASE`、`JWT_SECRET`、`PUBLIC_SERVER_FILE`
- [ ] `cd backend && npm install` 已执行
- [ ] `cd backend && npm run setup` 已执行且输出"Setup completed :Success!"
- [ ] `cd frontend && npm install` 已执行
- [ ] 生产部署时 `frontend/.env` 已填写 `VITE_BACKEND_SERVER`
