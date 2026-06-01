# 安装日志

> 由 `scripts/install-deps.sh` 执行生成，手工补充修复记录。

**执行时间**：2026-06-01  
**项目路径**：`/Users/youxingzhi/ayou/idurar-erp-crm`  
**操作系统**：macOS Darwin 24.2.0

---

## 1. Podman

| 项目 | 结果 |
|---|---|
| 版本 | 5.8.0 |
| Machine 状态 | 第一次执行时未运行，脚本自动 `podman machine start` 成功 |
| 最终命令 | `podman machine start`（首次）；之后自动保持运行 |

---

## 2. MongoDB

**目标**：mongo:8，端口 27017，容器名 idurar-mongo

| 步骤 | 命令 | 结果 |
|---|---|---|
| 拉取镜像 | `podman pull docker.io/library/mongo:8` | ✅ 成功，从 docker.io 拉取 |
| 创建容器 | `podman run -d --name idurar-mongo -p 27017:27017 --restart unless-stopped mongo:8` | ✅ 成功 |
| 就绪等待 | 轮询 `db.adminCommand('ping')` | ✅ 1 秒内就绪 |
| 端口验证 | `nc -z localhost 27017` | ✅ 可达 |

**最终运行命令**：
```bash
podman run -d \
  --name idurar-mongo \
  -p 27017:27017 \
  --restart unless-stopped \
  mongo:8
```

---

## 3. backend/.env 配置

**原始文件**：`DATABASE` 行被注释（`#DATABASE = "mongodb://localhost:27017"`）

**修复操作**：
- 将注释行替换为 `DATABASE="mongodb://localhost:27017/idurar"`
- `JWT_SECRET` 原为占位符 `your_private_jwt_secret_key`，自动替换为随机生成值

**最终 .env（敏感值打码）**：
```
DATABASE="mongodb://localhost:27017/idurar"
JWT_SECRET="idurar_local_***"
NODE_ENV = "production"
OPENSSL_CONF='/dev/null'
PUBLIC_SERVER_FILE="http://localhost:8888/"
```

---

## 4. npm 依赖安装

| 目录 | 命令 | 包数量 | 结果 |
|---|---|---|---|
| backend/ | `npm install` | 504 packages | ✅ 成功 |
| frontend/ | `npm install` | 384 packages | ✅ 成功 |

---

## 5. 数据库初始化 — 遇到的问题与修复

### 问题一：`set -u` 严格模式导致变量未绑定

**错误**：`NODE_VER: unbound variable`（line 186）

**原因**：`set -euo pipefail` 的 `-u` 选项在 macOS shell 对命令替换结果产生误判。

**修复**：将 `set -euo pipefail` 改为 `set -eo pipefail`，变量默认值改为 ASCII（`"not-found"` 替代中文字符串）。

---

### 问题二：`npm run setup` 因 OSS 缺失 Model 报错

**错误**：
```
Error: Cannot find module '../models/appModels/PaymentMode'
```

**原因**：`backend/src/setup/setup.js` 第 54 行 require 了 `PaymentMode` 和 `Taxes`，但这两个文件在 OSS 版不存在（企业版功能，见 `docs/backend-data-model.md`）。

Admin 账号和 Settings 已在报错前成功写入（setup 打印了 "Admin created :Done!" 和 "Settings created :Done!"）。

**修复**：脚本检测到此特定错误后，改用 `mongosh` 直接插入缺失集合：

```bash
podman exec idurar-mongo mongosh --quiet "mongodb://localhost:27017/idurar" --eval '
  db.paymentmodes.countDocuments({}) === 0 &&
    db.paymentmodes.insertOne({
      name: "Default Payment", isDefault: true, enabled: true, removed: false
    });
  db.taxes.countDocuments({}) === 0 &&
    db.taxes.insertOne({
      taxName: "Tax 0%", taxValue: "0", isDefault: true, enabled: true, removed: false
    });
'
```

---

## 6. 最终验证

| 集合 | 记录数 | 状态 |
|---|---|---|
| admins | 1 | ✅ |
| adminpasswords | 1 | ✅ |
| settings | 54 | ✅ |
| paymentmodes | 1 | ✅（mongosh 补充插入） |
| taxes | 1 | ✅（mongosh 补充插入） |

| 服务 | 端口 | 状态 |
|---|---|---|
| MongoDB | 27017 | ✅ ping OK |

---

## 总结

| 组件 | 最终安装命令 | 状态 |
|---|---|---|
| Podman Machine | `podman machine start` | ✅ |
| MongoDB 容器 | `podman run -d --name idurar-mongo -p 27017:27017 --restart unless-stopped mongo:8` | ✅ |
| backend npm | `cd backend && npm install` | ✅ |
| frontend npm | `cd frontend && npm install` | ✅ |
| 数据库初始化 | `npm run setup`（Admin+Settings）+ mongosh 补充（PaymentMode+Taxes） | ✅ |

**启动命令**：
```bash
cd backend && npm run dev   # 后端，新终端
cd frontend && npm run dev  # 前端，新终端
```

**访问地址**：http://localhost:3000  
**默认账号**：`admin@admin.com` / `admin123`

---

## 已知问题（供后续维护参考）

| 问题 | 位置 | 说明 |
|---|---|---|
| PaymentMode / Taxes model 缺失 | `backend/src/setup/setup.js:54` | OSS 版不含这两个 Model，setup.js 报 `MODULE_NOT_FOUND`，需 mongosh 手动插入 |
| Upload model 注册名有尾部空格 | `backend/src/models/coreModels/Upload.js` | `mongoose.model('Upload ', ...)` 末尾多一个空格，可能影响跨文件引用 |
