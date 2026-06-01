#!/usr/bin/env bash
# deps-status.sh — 查看 IDURAR 所有依赖中间件的运行状态

MONGO_CONTAINER="idurar-mongo"
MONGO_PORT=27017

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'

print_row() {
  # $1=name $2=status_symbol $3=status_color $4=detail
  printf "  %-12s %b%-10s%b %s\n" "$1" "$3" "$2" "$NC" "$4"
}

echo ""
echo -e "${BOLD}IDURAR 依赖中间件状态${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "  %-12s %-10s %s\n" "服务" "状态" "详情"
echo "────────────────────────────────────────"

# ── Podman machine ────────────────────────────────────────
MACHINE_UP=$(podman machine list --format '{{.LastUp}}' 2>/dev/null | head -1 || echo "")
if echo "$MACHINE_UP" | grep -qi "currently running\|running"; then
  print_row "Podman VM" "● running" "$GREEN" "$(podman machine list --format '{{.Name}}' 2>/dev/null | head -1)"
else
  print_row "Podman VM" "○ stopped" "$YELLOW" "运行 'podman machine start' 启动"
fi

# ── MongoDB ───────────────────────────────────────────────
if ! podman container exists "$MONGO_CONTAINER" 2>/dev/null; then
  print_row "MongoDB" "✘ missing" "$RED" "容器不存在，请运行 scripts/install-deps.sh"
else
  CONTAINER_STATUS=$(podman inspect "$MONGO_CONTAINER" \
    --format '{{.State.Status}}' 2>/dev/null || echo "unknown")

  if [ "$CONTAINER_STATUS" = "running" ]; then
    # ping 检查
    PING=$(podman exec "$MONGO_CONTAINER" mongosh --quiet \
      --eval "db.adminCommand('ping').ok" 2>/dev/null || echo "0")

    # 端口监听检查
    PORT_OPEN=""
    if nc -z localhost "$MONGO_PORT" 2>/dev/null; then
      PORT_OPEN="port $MONGO_PORT ✔"
    else
      PORT_OPEN="port $MONGO_PORT ✘"
    fi

    if [ "$PING" = "1" ]; then
      # 数据统计
      ADMIN_COUNT=$(podman exec "$MONGO_CONTAINER" mongosh --quiet \
        "mongodb://localhost:27017/idurar" \
        --eval "db.admins.countDocuments({})" 2>/dev/null || echo "?")
      print_row "MongoDB" "● running" "$GREEN" "$PORT_OPEN  |  admins: $ADMIN_COUNT  |  容器: $MONGO_CONTAINER"
    else
      print_row "MongoDB" "⚡ starting" "$YELLOW" "$PORT_OPEN  |  容器运行但 MongoDB 未就绪"
    fi
  else
    print_row "MongoDB" "○ stopped" "$YELLOW" "容器状态: $CONTAINER_STATUS  |  运行 scripts/deps-start.sh 启动"
  fi
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 端口汇总 ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}端口监听汇总${NC}"
echo "────────────────────────────────────────"
for port in $MONGO_PORT 8888 3000; do
  if nc -z localhost "$port" 2>/dev/null; then
    PROC=$(lsof -ti ":$port" 2>/dev/null | head -1 || echo "")
    CMD=""
    if [ -n "$PROC" ]; then
      CMD=$(ps -p "$PROC" -o comm= 2>/dev/null || echo "")
    fi
    printf "  %-6s %b%-12s%b %s\n" ":$port" "$GREEN" "● listening" "$NC" "$CMD"
  else
    LABEL=""
    case $port in
      $MONGO_PORT) LABEL="MongoDB" ;;
      8888)        LABEL="Express 后端" ;;
      3000)        LABEL="Vite 前端" ;;
    esac
    printf "  %-6s %b%-12s%b %s\n" ":$port" "$YELLOW" "○ closed" "$NC" "$LABEL"
  fi
done
echo ""
