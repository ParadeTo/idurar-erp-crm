#!/usr/bin/env bash
# deps-stop.sh — 停止 IDURAR 所需的所有本地中间件

set -eo pipefail

MONGO_CONTAINER="idurar-mongo"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✔ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }

# ── MongoDB ────────────────────────────────────────────────
echo "→ 停止 MongoDB 容器 ($MONGO_CONTAINER)..."

if ! podman container exists "$MONGO_CONTAINER" 2>/dev/null; then
  warn "容器 $MONGO_CONTAINER 不存在，跳过"
else
  STATUS=$(podman inspect "$MONGO_CONTAINER" --format '{{.State.Status}}' 2>/dev/null || echo "unknown")
  if [ "$STATUS" = "running" ]; then
    podman stop "$MONGO_CONTAINER"
    ok "MongoDB 已停止"
  else
    warn "MongoDB 未运行（状态：$STATUS），无需停止"
  fi
fi

echo ""
echo -e "${GREEN}所有中间件已停止。${NC}"
echo "  提示：Podman machine 仍在运行（不停止，避免影响其他容器）"
echo "  如需完全停止：podman machine stop"
