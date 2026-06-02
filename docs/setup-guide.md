# 新人本地环境搭建指南

> 基于实际安装和启动过程整理，所有踩坑均来自真实报错记录。  
> 预计完成时间：**15–30 分钟**（首次，含镜像拉取）。

---

## 前置条件

在开始之前，确认以下工具已安装：

| 工具 | 要求版本 | 验证命令 | 安装参考 |
|---|---|---|---|
| Node.js | **v20**（最低）| `node -v` | https://nodejs.org 或 `nvm install 20` |
| npm | **v10** | `npm -v` | 随 Node.js 安装 |
| Podman | v4 以上 | `podman --version` | https://podman.io/getting-started/installation |
| Git | 任意 | `git --version` | — |

> **注意**：项目用 Podman 管理 MongoDB 容器，不需要安装 Docker。  
> macOS 上 Podman 需要一个后台 VM（`podman machine`），首次使用需要初始化。

---

## 第一步：克隆项目

```bash
git clone https://github.com/idurar/idurar-erp-crm.git
cd idurar-erp-crm
```

---

## 第二步：初始化 Podman Machine（仅首次）

macOS 上 Podman 容器运行在一个轻量 VM 里，首次需要创建：

```bash
podman machine init    # 首次创建（约 1 分钟）
podman machine start   # 启动 VM
```

以后每次开机后只需 `podman machine start`，或直接用下面的脚本自动处理。

---

## 第三步：一键安装所有依赖（含数据库）

```bash
bash scripts/install-deps.sh
```

这个脚本会依次完成：
1. 检查并启动 Podman machine
2. 拉取 `mongo:8` 镜像并创建容器（端口 27017）
3. 等待 MongoDB 就绪
4. 写入 `backend/.env`（设置 `DATABASE` + 随机 `JWT_SECRET`）
5. `npm install`（后端 504 个包，前端 384 个包）
6. `npm run setup`（写入初始 Admin 账号 + 54 条默认配置）

脚本幂等，多次执行安全（不会重复写入已存在的数据）。

**预期最后输出**：
```
✔ MongoDB ready (port 27017)
All middleware started and ready.
```

---

## 第四步：配置 backend/.env

脚本已自动写入以下最小配置，通常无需手动修改即可本地运行：

```env
DATABASE="mongodb://localhost:27017/idurar"
JWT_SECRET="idurar_local_<随机字符串>"
NODE_ENV = "production"
OPENSSL_CONF='/dev/null'
PUBLIC_SERVER_FILE="http://localhost:8888/"
```

**可选配置**（暂不填也能启动，只影响对应功能）：

```env
RESEND_API="re_..."          # 忘记密码邮件才需要
OPENAI_API_KEY="sk-..."      # OSS 版暂无实际调用
```

---

## 第五步：启动应用

需要两个终端窗口，分别启动后端和前端。

**终端 1 — 后端**：
```bash
cd backend
npm run dev
```
成功标志：`Express running → On PORT : 8888`

**终端 2 — 前端**：
```bash
cd frontend
npm run dev
```
成功标志：`VITE v5.x.x  ready in xxx ms`

---

## 服务地址

| 服务 | 地址 | 说明 |
|---|---|---|
| **前端** | http://localhost:3000 | 打开浏览器访问 |
| **后端 API** | http://localhost:8888/api | REST API 入口 |
| **MongoDB** | mongodb://localhost:27017/idurar | 本地容器 |

**默认登录账号**：`admin@admin.com` / `admin123`

---

## 日常启停（装好之后）

```bash
# 启动所有依赖中间件（Podman machine + MongoDB）
bash scripts/deps-start.sh

# 查看运行状态（中间件 + 端口）
bash scripts/deps-status.sh

# 停止所有中间件
bash scripts/deps-stop.sh
```

---

## 常见踩坑

### 1. `npm run setup` 报 `Cannot find module '../models/appModels/PaymentMode'`

**原因**：这是 OSS 版的已知问题。`setup.js` 里引用了 `PaymentMode` 和 `Taxes` 两个 Model 文件，但这两个文件只在企业版里有。Admin 账号和 Settings 实际上已经写入成功，只是脚本在最后一步崩了。

**解决**：运行 `scripts/install-deps.sh` 会自动检测并用 `mongosh` 补充插入这两个集合，无需手动处理。如果你是手动 setup 的，执行一次：

```bash
podman exec idurar-mongo mongosh --quiet "mongodb://localhost:27017/idurar" --eval '
  db.paymentmodes.countDocuments({}) === 0 &&
    db.paymentmodes.insertOne({ name:"Default Payment", isDefault:true, enabled:true, removed:false });
  db.taxes.countDocuments({}) === 0 &&
    db.taxes.insertOne({ taxName:"Tax 0%", taxValue:"0", isDefault:true, enabled:true, removed:false });
'
```

---

### 2. 前端报 `ERR_OSSL_EVP_UNSUPPORTED`

**原因**：Node.js v17+ 对 OpenSSL 的兼容性变化，webpack/vite 在某些配置下触发。

**解决**：`backend/.env` 里已有 `OPENSSL_CONF='/dev/null'`。如果是前端报错，在启动前设置环境变量：

```bash
export NODE_OPTIONS=--openssl-legacy-provider
npm run dev
```

或者升级到 Node.js v20（推荐，问题不会出现）。

---

### 3. Podman machine 未运行，容器无法启动

**现象**：`podman start idurar-mongo` 卡住，或报连接错误。

**解决**：

```bash
podman machine start
```

重启电脑后需要重新执行此命令（或用 `deps-start.sh` 自动处理）。

---

### 4. `npm run setup` 报 `MongoServerError: Document failed validation` 或 admin 已存在

**原因**：`setup.js` 不做幂等检查，重复执行会尝试创建已存在的 admin 邮箱（有唯一性约束）。

**解决**：只需执行一次 setup。若不小心执行了多次，用以下命令检查数据库：

```bash
podman exec idurar-mongo mongosh --quiet "mongodb://localhost:27017/idurar" \
  --eval 'db.admins.countDocuments({})'
```

只要结果 ≥ 1 即表示已初始化完成，无需再次 setup。

---

### 5. 后端启动后 API 报 500，提示 MongoDB 连接失败

**现象**：后端输出 `🔥 Common Error caused issue → : check your .env file first`

**解决**：

```bash
# 确认 MongoDB 容器在跑
bash scripts/deps-status.sh

# 确认 .env 里 DATABASE 没有被注释
grep DATABASE backend/.env
```

正确格式：`DATABASE="mongodb://localhost:27017/idurar"`（不要有 `#` 前缀）。

---

### 6. Invoice 创建 API 返回 `"xxx" is not allowed`

**原因**：`invoiceController/schemaValidate.js` 使用 Joi 严格模式，只接受以下字段：`client / number / year / status / notes / expiredDate / date / items / taxRate`。`currency`、`discount` 等字段不在入参里（由后端从 Model 默认值处理）。

**影响**：只影响直接调用 API 的开发测试，前端表单实际上不会传这些字段。

---

## 验证清单

安装完成后，逐项确认：

- [ ] `bash scripts/deps-status.sh` 显示 MongoDB `● running`，port 27017 `● listening`
- [ ] 后端终端显示 `Express running → On PORT : 8888`
- [ ] 前端终端显示 `VITE vX.X.X ready in XXX ms`
- [ ] 浏览器打开 http://localhost:3000 看到登录页
- [ ] 用 `admin@admin.com` / `admin123` 登录成功，跳转到发票列表
- [ ] 数据库初始化完整：

```bash
podman exec idurar-mongo mongosh --quiet "mongodb://localhost:27017/idurar" --eval '
  ["admins","adminpasswords","settings","paymentmodes","taxes"]
    .forEach(c => print(c + ": " + db[c].countDocuments({})));
'
```

预期输出：`admins: 1 / adminpasswords: 1 / settings: 54 / paymentmodes: 1 / taxes: 1`

---

## 参考文档

| 文档 | 内容 |
|---|---|
| [docs/env-checklist.md](env-checklist.md) | 完整环境变量清单（含可选项） |
| [docs/api-list.md](api-list.md) | 后端接口清单 |
| [docs/domain-model.md](domain-model.md) | 业务模型说明 |
| [docs/data-flow.md](data-flow.md) | 核心业务数据流（登录 / 创建发票 / 记录付款） |
| [scripts/install-log.md](../scripts/install-log.md) | 首次安装详细记录（含踩坑修复过程） |
| [CLAUDE.md](../CLAUDE.md) | 项目架构导航（给 AI 和开发者看的快速索引） |
