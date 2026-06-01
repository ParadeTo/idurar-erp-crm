#!/usr/bin/env bash
# install-deps.sh — IDURAR ERP/CRM 本地中间件安装脚本
# 依赖 Podman（需提前安装并运行 podman machine）
# 用法：bash scripts/install-deps.sh

set -eo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/scripts/install-log.md"
MONGO_CONTAINER="idurar-mongo"
MONGO_PORT=27017
MONGO_DB="idurar"
DATABASE_URI="mongodb://localhost:${MONGO_PORT}/${MONGO_DB}"

# ── 颜色 ──────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✔ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
err()  { echo -e "${RED}✘ $*${NC}" >&2; }
step() { echo -e "\n${YELLOW}━━ $* ━━${NC}"; }

# ── 日志辅助 ──────────────────────────────────────────────
log_section() { echo -e "\n## $*" >> "$LOG_FILE"; }
log()         { echo "$*" >> "$LOG_FILE"; }

# ── 初始化 log ────────────────────────────────────────────
cat > "$LOG_FILE" <<'LOGHEADER'
# 安装日志

> 由 `scripts/install-deps.sh` 自动生成

LOGHEADER
log "**执行时间**：$(date '+%Y-%m-%d %H:%M:%S')"
log "**项目路径**：$PROJECT_ROOT"

# ══════════════════════════════════════════════════════════
# 1. 检查 Podman
# ══════════════════════════════════════════════════════════
step "检查 Podman"
log_section "1. Podman"

if ! command -v podman &>/dev/null; then
  err "Podman 未安装，请先安装：https://podman.io/getting-started/installation"
  log "- ❌ Podman 未找到，脚本中止"
  exit 1
fi

PODMAN_VER=$(podman --version | awk '{print $3}')
ok "Podman $PODMAN_VER"
log "- Podman 版本：$PODMAN_VER"

# 确保 podman machine 在运行
MACHINE_STATE=$(podman machine list --format '{{.LastUp}}' 2>/dev/null | head -1 || echo "")
if echo "$MACHINE_STATE" | grep -qiE "currently running|running"; then
  ok "Podman machine 已运行"
  log "- Podman machine 状态：运行中"
else
  warn "Podman machine 未运行，尝试启动..."
  log "- 问题：Podman machine 未运行 → 执行 podman machine start"
  if podman machine start 2>&1; then
    ok "Podman machine 已启动"
    log "- 修复：podman machine start 成功"
  else
    err "Podman machine 启动失败，请手动运行：podman machine start"
    log "- ❌ podman machine start 失败，脚本中止"
    exit 1
  fi
fi

# ══════════════════════════════════════════════════════════
# 2. MongoDB（必填，唯一需要本地容器的中间件）
# ══════════════════════════════════════════════════════════
step "安装 MongoDB（Podman 容器）"
log_section "2. MongoDB"
log "- 镜像：mongo:8"
log "- 容器名：$MONGO_CONTAINER"
log "- 端口：$MONGO_PORT"
log "- 数据库：$MONGO_DB"

# 检查容器是否已存在
if podman container exists "$MONGO_CONTAINER" 2>/dev/null; then
  CONTAINER_STATUS=$(podman inspect "$MONGO_CONTAINER" --format '{{.State.Status}}' 2>/dev/null || echo "unknown")
  if [ "$CONTAINER_STATUS" = "running" ]; then
    ok "容器 $MONGO_CONTAINER 已在运行，跳过创建"
    log "- 已存在运行中的容器，跳过创建"
  else
    warn "容器 $MONGO_CONTAINER 已存在但未运行（状态：$CONTAINER_STATUS），启动中..."
    log "- 容器已存在（状态：$CONTAINER_STATUS） → 执行 podman start"
    podman start "$MONGO_CONTAINER"
    ok "容器已启动"
    log "- 执行：podman start $MONGO_CONTAINER → 成功"
  fi
else
  warn "容器不存在，拉取镜像并创建..."
  log "- 执行：podman run -d --name $MONGO_CONTAINER -p $MONGO_PORT:27017 mongo:8"
  podman run -d \
    --name "$MONGO_CONTAINER" \
    -p "${MONGO_PORT}:27017" \
    --restart unless-stopped \
    mongo:8
  ok "MongoDB 容器已创建并启动"
  log "- 创建命令：\`podman run -d --name $MONGO_CONTAINER -p $MONGO_PORT:27017 --restart unless-stopped mongo:8\`"
fi

# 等待 MongoDB 就绪（最多 30 秒）
step "等待 MongoDB 就绪"
log "- 等待 MongoDB 响应（最多 30 秒）..."
READY=0
for i in $(seq 1 30); do
  if podman exec "$MONGO_CONTAINER" mongosh --quiet --eval "db.adminCommand('ping').ok" &>/dev/null; then
    READY=1
    break
  fi
  echo -n "."
  sleep 1
done
echo ""

if [ "$READY" -eq 0 ]; then
  err "MongoDB 30 秒内未就绪，查看容器日志："
  podman logs --tail 20 "$MONGO_CONTAINER"
  log "- ❌ MongoDB 启动超时（30s），脚本中止"
  exit 1
fi

ok "MongoDB 就绪（${i}s）"
log "- MongoDB 就绪，等待时间：${i}s"

# 验证端口可达
if ! nc -z localhost "$MONGO_PORT" 2>/dev/null; then
  warn "端口 $MONGO_PORT 暂时不可达，等待 3s..."
  sleep 3
fi
log "- 端口 $MONGO_PORT 可达"

# ══════════════════════════════════════════════════════════
# 3. 写入 backend/.env
# ══════════════════════════════════════════════════════════
step "配置 backend/.env"
log_section "3. backend/.env 配置"

ENV_FILE="$PROJECT_ROOT/backend/.env"

# 写入或更新 DATABASE 行
if grep -q "^DATABASE=" "$ENV_FILE" 2>/dev/null; then
  # 已存在且未注释 → 替换
  sed -i.bak "s|^DATABASE=.*|DATABASE=\"${DATABASE_URI}\"|" "$ENV_FILE"
  log "- 更新：DATABASE 已存在，覆盖为 $DATABASE_URI"
elif grep -q "^#DATABASE" "$ENV_FILE" 2>/dev/null; then
  # 被注释 → 在注释行后插入
  sed -i.bak "s|^#DATABASE.*|DATABASE=\"${DATABASE_URI}\"|" "$ENV_FILE"
  log "- 启用：DATABASE 原被注释，改为 $DATABASE_URI"
else
  # 不存在 → 追加
  echo "DATABASE=\"${DATABASE_URI}\"" >> "$ENV_FILE"
  log "- 追加：DATABASE=\"$DATABASE_URI\""
fi

# 确保 JWT_SECRET 是真实值（不是占位符）
if grep -q 'your_private_jwt_secret_key' "$ENV_FILE"; then
  JWT_SECRET_VAL="idurar_local_$(LC_ALL=C tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 32 || true)"
  sed -i.bak "s|your_private_jwt_secret_key|${JWT_SECRET_VAL}|" "$ENV_FILE"
  log "- JWT_SECRET 占位符 → 自动替换为随机值（${JWT_SECRET_VAL:0:8}...）"
fi

# 清理 sed 备份文件
rm -f "${ENV_FILE}.bak"

ok ".env 已配置"
log "- 最终 DATABASE：$DATABASE_URI"

# 显示最终 .env（隐藏敏感值）
log "\n最终 .env（敏感值打码）："
log '```'
sed 's/\(JWT_SECRET=\).*/\1"***"/' "$ENV_FILE" | sed 's/\(RESEND_API=\).*/\1"***"/' >> "$LOG_FILE"
log '```'

# ══════════════════════════════════════════════════════════
# 4. npm install（后端 + 前端）
# ══════════════════════════════════════════════════════════
step "安装 npm 依赖"
log_section "4. npm 依赖安装"

NODE_VER=$(node -v 2>/dev/null || echo "not-found")
NPM_VER=$(npm -v 2>/dev/null || echo "not-found")
log "- Node.js：$NODE_VER（要求 v20）"
log "- npm：$NPM_VER（要求 v10）"

if [[ "$NODE_VER" != v20* ]]; then
  warn "Node.js 版本为 $NODE_VER，建议使用 v20。继续尝试..."
  log "- ⚠ Node.js 版本不符，继续执行（可能出错）"
fi

echo "→ 后端 npm install..."
cd "$PROJECT_ROOT/backend"
npm install --prefer-offline 2>&1 | tail -5
ok "后端依赖安装完成"
log "- 后端：cd backend && npm install ✔"

echo "→ 前端 npm install..."
cd "$PROJECT_ROOT/frontend"
npm install --prefer-offline 2>&1 | tail -5
ok "前端依赖安装完成"
log "- 前端：cd frontend && npm install ✔"

cd "$PROJECT_ROOT"

# ══════════════════════════════════════════════════════════
# 5. npm run setup（写入初始数据）
# ══════════════════════════════════════════════════════════
step "初始化数据库（npm run setup）"
log_section "5. 数据库初始化"

# 检查是否已初始化（admins 集合非空）
ALREADY_SETUP=$(podman exec "$MONGO_CONTAINER" mongosh --quiet \
  "mongodb://localhost:27017/${MONGO_DB}" \
  --eval "db.admins.countDocuments({})" 2>/dev/null || echo "0")

if [ "$ALREADY_SETUP" -gt 0 ] 2>/dev/null; then
  warn "数据库已有 $ALREADY_SETUP 条 admin 记录，跳过 setup（避免重复写入）"
  log "- 跳过：数据库已初始化（admins 集合有 $ALREADY_SETUP 条记录）"
else
  cd "$PROJECT_ROOT/backend"
  SETUP_OUTPUT=$(npm run setup 2>&1 || true)
  echo "$SETUP_OUTPUT" | tail -8

  if echo "$SETUP_OUTPUT" | grep -q "Setup completed :Success!"; then
    ok "数据库初始化成功"
    log "- 执行：cd backend && npm run setup ✔"
    log "- 写入：admins / adminpasswords / settings / paymentmodes / taxes"
    log "- 默认账号：admin@admin.com / admin123"
  elif echo "$SETUP_OUTPUT" | grep -q "Admin created" && echo "$SETUP_OUTPUT" | grep -q "PaymentMode"; then
    # OSS 已知问题：PaymentMode / Taxes model 文件缺失，但 Admin + Settings 已成功写入
    # 直接用 mongosh 补充插入这两个集合
    warn "setup.js 因缺少 PaymentMode/Taxes 模型报错（已知 OSS 限制），改用 mongosh 直接插入..."
    log "- 问题：setup.js require PaymentMode/Taxes 失败（OSS 版 model 文件缺失）"
    log "- 修复：通过 mongosh 直接插入 paymentmodes / taxes 集合"

    podman exec "$MONGO_CONTAINER" mongosh --quiet \
      "mongodb://localhost:27017/${MONGO_DB}" --eval '
        db.paymentmodes.countDocuments({}) === 0 &&
        db.paymentmodes.insertOne({
          name: "Default Payment",
          description: "Default Payment Mode (Cash , Wire Transfer)",
          isDefault: true,
          enabled: true,
          removed: false
        });
        db.taxes.countDocuments({}) === 0 &&
        db.taxes.insertOne({
          taxName: "Tax 0%",
          taxValue: "0",
          isDefault: true,
          enabled: true,
          removed: false
        });
        print("paymentmodes: " + db.paymentmodes.countDocuments({}));
        print("taxes: " + db.taxes.countDocuments({}));
      '

    ok "PaymentMode / Taxes 已通过 mongosh 补充写入"
    log "- 执行：mongosh 直接 insertOne paymentmodes + taxes ✔"
    log "- 默认账号：admin@admin.com / admin123（已由 setup.js 写入）"
  else
    err "setup 脚本遇到未知错误，请检查："
    echo "$SETUP_OUTPUT"
    log "- ❌ npm run setup 未知错误"
    log '```'
    echo "$SETUP_OUTPUT" >> "$LOG_FILE"
    log '```'
    exit 1
  fi
  cd "$PROJECT_ROOT"
fi

# ══════════════════════════════════════════════════════════
# 6. 最终验证
# ══════════════════════════════════════════════════════════
step "最终验证"
log_section "6. 最终验证"

# MongoDB ping
PING=$(podman exec "$MONGO_CONTAINER" mongosh --quiet \
  "mongodb://localhost:27017/${MONGO_DB}" \
  --eval "db.adminCommand('ping').ok" 2>/dev/null || echo "0")
if [ "$PING" = "1" ]; then
  ok "MongoDB ping: OK"
  log "- MongoDB ping: ✔"
else
  err "MongoDB ping 失败"
  log "- MongoDB ping: ❌"
fi

# admin 记录数
ADMIN_COUNT=$(podman exec "$MONGO_CONTAINER" mongosh --quiet \
  "mongodb://localhost:27017/${MONGO_DB}" \
  --eval "db.admins.countDocuments({})" 2>/dev/null || echo "?")
ok "admins 集合：$ADMIN_COUNT 条记录"
log "- admins 集合：$ADMIN_COUNT 条"

# 端口
if nc -z localhost "$MONGO_PORT" 2>/dev/null; then
  ok "端口 $MONGO_PORT 可达"
  log "- 端口 $MONGO_PORT: ✔"
else
  err "端口 $MONGO_PORT 不可达"
  log "- 端口 $MONGO_PORT: ❌"
fi

# ══════════════════════════════════════════════════════════
# 完成
# ══════════════════════════════════════════════════════════
log_section "总结"
log "| 组件 | 状态 | 说明 |"
log "|---|---|---|"
log "| MongoDB | ✅ | 容器 \`$MONGO_CONTAINER\`，端口 $MONGO_PORT |"
log "| backend npm | ✅ | cd backend && npm install |"
log "| frontend npm | ✅ | cd frontend && npm install |"
log "| 数据库初始化 | ✅ | npm run setup |"
log ""
log "**启动命令**："
log "\`\`\`bash"
log "# 后端（新终端）"
log "cd backend && npm run dev"
log ""
log "# 前端（新终端）"
log "cd frontend && npm run dev"
log "\`\`\`"
log ""
log "**访问地址**：http://localhost:3000  "
log "**账号**：admin@admin.com / admin123"

echo ""
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo -e "${GREEN}  安装完成！${NC}"
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo ""
echo "  MongoDB:  localhost:$MONGO_PORT  (容器: $MONGO_CONTAINER)"
echo "  DATABASE: $DATABASE_URI"
echo ""
echo "  启动后端: cd backend && npm run dev"
echo "  启动前端: cd frontend && npm run dev"
echo "  访问地址: http://localhost:3000"
echo "  账号:     admin@admin.com / admin123"
echo ""
echo "  详细日志: scripts/install-log.md"
