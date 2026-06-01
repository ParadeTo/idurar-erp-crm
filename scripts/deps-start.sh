#!/usr/bin/env bash
# deps-start.sh — 启动 IDURAR 所需的所有本地中间件
# 中间件：MongoDB（Podman 容器 idurar-mongo，端口 27017）

set -eo pipefail

MONGO_CONTAINER="idurar-mongo"
MONGO_PORT=27017

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✔ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
err()  { echo -e "${RED}✘ $*${NC}" >&2; exit 1; }

# ── 1. Podman machine ──────────────────────────────────────
echo "→ 检查 Podman machine..."
if ! podman machine list --format '{{.LastUp}}' 2>/dev/null | grep -qi "currently running\|running"; then
  warn "Podman machine 未运行，正在启动..."
  podman machine start
fi
ok "Podman machine 运行中"

# ── 2. MongoDB ─────────────────────────────────────────────
echo "→ 检查 MongoDB 容器 ($MONGO_CONTAINER)..."

if ! podman container exists "$MONGO_CONTAINER" 2>/dev/null; then
  err "容器 $MONGO_CONTAINER 不存在，请先运行 scripts/install-deps.sh"
fi

STATUS=$(podman inspect "$MONGO_CONTAINER" --format '{{.State.Status}}' 2>/dev/null || echo "unknown")

if [ "$STATUS" = "running" ]; then
  warn "MongoDB 已在运行，跳过启动"
else
  echo "  status: $STATUS, starting..."
  podman start "$MONGO_CONTAINER"
fi

# ── 3. 等待 MongoDB 就绪 ───────────────────────────────────
echo "→ 等待 MongoDB 就绪（最多 30s）..."
for i in $(seq 1 30); do
  if podman exec "$MONGO_CONTAINER" mongosh --quiet \
       --eval "db.adminCommand('ping').ok" &>/dev/null; then
    break
  fi
  printf "."
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo ""
    err "MongoDB 30s 内未就绪，查看日志：podman logs $MONGO_CONTAINER"
  fi
done
echo ""

ok "MongoDB ready (port ${MONGO_PORT})"
echo ""
echo -e "${GREEN}All middleware started and ready.${NC}"
echo "  MongoDB: localhost:${MONGO_PORT}  (container: ${MONGO_CONTAINER})"
