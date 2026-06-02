---
name: env-bootstrap
description: 新接手项目、重置本地环境、定期验证环境健康时使用。触发词：搭环境、跑起来、重置环境、环境坏了、验证环境、smoke test、冒烟测试。
allowed-tools:
  - Read
  - Bash
  - Write
---

# env-bootstrap — 环境引导技能

## 适用场景

- 新成员第一次在本机跑这个项目
- 环境出问题（端口冲突、容器丢失、依赖损坏）需要重置
- 定期确认本地环境是否健康

## 执行顺序

```
依赖盘点 → 装中间件 → 启停脚本验证 → 编译启动 → 接口冒烟
```

每一步完成后写入阶段结论，失败立即停下说明原因，不要跳过。

---

## Phase 1：依赖盘点

**目标**：确认所有前置工具已就绪，版本符合要求。

```bash
node -v          # 要求 v20+
npm -v           # 要求 v10+
podman --version # 要求 v4+
git --version    # 任意版本
```

读取 `docs/env-checklist.md`，对照"前置条件"章节逐项确认。

**输出**：每个工具打印 `✔ tool vX.X.X` 或 `✘ tool 未找到`。  
**阻塞条件**：Node 版本 < v20 或 Podman 未安装 → 停下，告知用户安装方法后退出。

---

## Phase 2：装中间件

**目标**：确保 MongoDB 容器运行并就绪，`backend/.env` 配置正确。

### 2a. 检查是否已装过

```bash
podman container exists idurar-mongo && \
  podman inspect idurar-mongo --format '{{.State.Status}}'
```

- 结果为 `running` → 跳到 2d（直接验证就绪）
- 结果为 `exited` → 跳到 2c（直接 start）
- 容器不存在 → 执行 2b

### 2b. 首次安装（运行一键脚本）

```bash
bash scripts/install-deps.sh
```

脚本会自动：拉 mongo:8 镜像 → 创建容器 → 等待就绪 → 写 `.env` → npm install → npm run setup。

**已知问题**：`npm run setup` 会报 `Cannot find module PaymentMode`（OSS 版缺失），脚本已内置 mongosh 补充插入，**不需要手动处理**。

### 2c. 容器已存在但未运行

```bash
podman machine start 2>/dev/null || true
podman start idurar-mongo
```

### 2d. 验证 MongoDB 就绪

```bash
podman exec idurar-mongo mongosh --quiet \
  "mongodb://localhost:27017/idurar" \
  --eval 'db.adminCommand("ping").ok'
```

返回 `1` = 就绪。否则等 5s 重试，最多 3 次。

### 2e. 验证 .env 配置

```bash
grep -E "^DATABASE=" backend/.env   # 不能是注释行
grep -E "^JWT_SECRET=" backend/.env # 不能是占位符
```

若 DATABASE 被注释（`#DATABASE`），执行：
```bash
sed -i.bak 's|^#DATABASE.*|DATABASE="mongodb://localhost:27017/idurar"|' backend/.env
```

### 2f. 验证数据库已初始化

```bash
podman exec idurar-mongo mongosh --quiet "mongodb://localhost:27017/idurar" \
  --eval '["admins","settings","paymentmodes","taxes"].forEach(c =>
    print(c + ": " + db[c].countDocuments({})))'
```

预期：`admins ≥ 1`，`settings = 54`，`paymentmodes ≥ 1`，`taxes ≥ 1`。

若 `paymentmodes` 或 `taxes` 为 0（OSS 版 setup 中途失败导致），补充插入：

```bash
podman exec idurar-mongo mongosh --quiet "mongodb://localhost:27017/idurar" --eval '
  db.paymentmodes.countDocuments({}) === 0 &&
    db.paymentmodes.insertOne({name:"Default Payment",isDefault:true,enabled:true,removed:false});
  db.taxes.countDocuments({}) === 0 &&
    db.taxes.insertOne({taxName:"Tax 0%",taxValue:"0",isDefault:true,enabled:true,removed:false});
'
```

---

## Phase 3：启停脚本验证

**目标**：确认 `deps-start / deps-stop / deps-status` 三个脚本可正常使用。

```bash
bash scripts/deps-status.sh   # 查看当前状态
bash scripts/deps-stop.sh     # 停止 MongoDB
bash scripts/deps-start.sh    # 重新启动并等待就绪
bash scripts/deps-status.sh   # 再次确认 ● running
```

验收：最后一次 `deps-status.sh` 输出中 MongoDB 行显示 `● running`，port 27017 `● listening`。

---

## Phase 4：编译启动

**目标**：后端和前端都能正常启动，端口监听正常。

### 4a. 安装依赖（幂等，已装过会很快）

```bash
cd backend && npm install 2>&1 | tail -3
cd ../frontend && npm install 2>&1 | tail -3
cd ..
```

### 4b. 后台启动后端，等待就绪

```bash
cd backend && npm run dev > /tmp/idurar-backend.log 2>&1 &
BACKEND_PID=$!

for i in $(seq 1 30); do
  nc -z localhost 8888 2>/dev/null && break
  sleep 1
done
nc -z localhost 8888 && echo "✔ backend:8888" || echo "✘ backend failed"
```

若失败，读取日志定位原因：
```bash
tail -30 /tmp/idurar-backend.log
```

常见原因：端口被占用（`lsof -ti:8888`）、MongoDB 连接失败（DATABASE 配错）。

### 4c. 后台启动前端，等待就绪

```bash
cd frontend && npm run dev > /tmp/idurar-frontend.log 2>&1 &
FRONTEND_PID=$!

for i in $(seq 1 30); do
  nc -z localhost 3000 2>/dev/null && break
  sleep 1
done
nc -z localhost 3000 && echo "✔ frontend:3000" || echo "✘ frontend failed"
```

若失败：
```bash
tail -30 /tmp/idurar-frontend.log
```

---

## Phase 5：接口冒烟

**目标**：通过 curl 验证核心链路。每条测试打印 `✔` 或 `✘`。

```bash
BASE="http://localhost:8888/api"

# 1. 未认证 → 401
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/invoice/list)
[ "$CODE" = "401" ] && echo "✔ T01 auth guard" || echo "✘ T01 expected 401 got $CODE"

# 2. 登录
RESP=$(curl -s -X POST $BASE/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@admin.com","password":"admin123"}')
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['token'])" 2>/dev/null)
[ -n "$TOKEN" ] && echo "✔ T02 login → token" || echo "✘ T02 login failed: $RESP"

# 3. 设置列表
COUNT=$(curl -s -H "Authorization: Bearer $TOKEN" $BASE/setting/listAll \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('result',[])))" 2>/dev/null)
[ "$COUNT" -gt 0 ] 2>/dev/null && echo "✔ T03 settings ($COUNT items)" || echo "✘ T03 settings empty"

# 4. 登出 + token 失效
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BASE/logout > /dev/null
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" $BASE/invoice/list)
[ "$CODE" = "401" ] && echo "✔ T04 logout + token invalidated" || echo "✘ T04 token still valid after logout"
```

全部 `✔` = 冒烟通过。有 `✘` → 读对应日志定位，修复后从该 Phase 重跑。

---

## 输出物

全流程跑完后，将关键信息汇总写入 `docs/startup-log.md`：

```markdown
# 启动日志

**执行时间**：YYYY-MM-DD  
**Node.js**：vX.X.X  

## 服务地址
| 服务 | 地址 |
|---|---|
| 前端 | http://localhost:3000 |
| 后端 API | http://localhost:8888/api |
| MongoDB | mongodb://localhost:27017/idurar |

**默认账号**：admin@admin.com / admin123

## 问题与修复
（记录本次遇到的报错和修复步骤）
```

---

## 快速参考

| 情况 | 命令 |
|---|---|
| 每天开始工作 | `bash scripts/deps-start.sh` |
| 查看状态 | `bash scripts/deps-status.sh` |
| 下班停服务 | `bash scripts/deps-stop.sh` |
| 完全重置数据库 | `cd backend && npm run reset`（危险，清空所有数据） |
| 查看后端日志 | `tail -f /tmp/idurar-backend.log` |
| 查看前端日志 | `tail -f /tmp/idurar-frontend.log` |
