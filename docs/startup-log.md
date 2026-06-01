# 启动日志

**执行时间**：2026-06-01  
**操作系统**：macOS Darwin 24.2.0  
**Node.js**：v22.22.2

---

## 启动步骤

### 1. 中间件（MongoDB）

```bash
bash scripts/deps-start.sh
```

| 组件 | 状态 | 耗时 |
|---|---|---|
| Podman machine | 已在运行，跳过 | — |
| MongoDB 容器 idurar-mongo | 已在运行，跳过 | — |
| MongoDB ping 就绪 | ✅ | < 1s |

无报错，一次通过。

---

### 2. 后端（Express）

```bash
cd backend && npm run dev
```

| 项目 | 结果 |
|---|---|
| 启动命令 | `nodemon src/server.js --ignore public/` |
| 端口 | 8888 |
| 就绪耗时 | 1s |
| 日志输出 | `Express running → On PORT : 8888` |
| 报错 | 无 |

---

### 3. 前端（Vite）

```bash
cd frontend && npm run dev
```

| 项目 | 结果 |
|---|---|
| 启动命令 | `vite` |
| 端口 | 3000 |
| 就绪耗时 | 1s（Vite ready in 800ms） |
| 日志输出 | `VITE v5.4.8  ready in 800 ms` |
| 报错 | 无 |

---

## 最终服务地址

| 服务 | 地址 | 说明 |
|---|---|---|
| 前端 | http://localhost:3000 | Vite dev server |
| 后端 API | http://localhost:8888/api | Express REST API |
| MongoDB | mongodb://localhost:27017/idurar | Podman 容器 |

**默认账号**：`admin@admin.com` / `admin123`

---

## 问题与修复

本次启动**无任何报错**，全部一次通过。

（历史修复记录见 `scripts/install-log.md`）
