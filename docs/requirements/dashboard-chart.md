# 需求草稿：Dashboard 每日开票 / 收款走势图（双 Y 轴）

> 状态：草稿，待产品评审  
> 日期：2026-06-05  
> 相关文档：[api-list.md](../api-list.md) · [backend-data-model.md](../backend-data-model.md) · [frontend-state-model.md](../frontend-state-model.md)

---

## 1. 业务目标

让运营/财务人员在 Dashboard 用**一张双 Y 轴折线图**同时看到每日开票总额（Invoice total，左轴）和每日实收金额（Payment amount，右轴）的走势，共用横坐标（日期），方便对比开票节奏与到账节奏。

---

## 2. 用户场景

### 典型场景

| 场景 | 操作路径 | 期望结果 |
|---|---|---|
| 月末对账 | 打开 Dashboard，选"本月" | 一张图：横轴日期，左轴开票金额折线（蓝），右轴收款金额折线（绿），一眼看出哪几天开票多、哪几天到账 |
| 周度复盘 | 切换到"本周" | 两条折线各展示 7 个数据点，收款线持续低于开票线说明有大量应收账款未到 |
| 自定义区间 | 选择任意开始/结束日期 | 图表按新区间重新渲染，两条线同步刷新 |

### 当前痛点

- Dashboard 现有 4 张 `SummaryCard`（Invoices / Quote / Paid / Unpaid）只展示**当前周期合计数**，没有时间维度。
- 现有 `GET /api/invoice/summary` 和 `GET /api/payment/summary` 的**日期过滤代码全部被注释掉**（见 `invoiceController/summary.js` 第 30-33 行、`paymentController/summary.js` 第 30-33 行），返回的是全量累计值，无法支持走势分析。
- 用户无法从当前界面判断趋势，只能手工导出数据到 Excel 计算。

---

## 3. 接口契约

两条折线共用同一横坐标（日期），数据来自 Invoice 和 Payment 两个 Model，后端需保证两组数据**日期严格对齐**后一并返回。因此用**一个合并接口**，比前端并发两个请求再手动 merge 更简洁可靠。

### 新增接口：GET /api/dashboard/trend

> 认证：Bearer JWT；响应结构：`{ success, result, message }`

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 | 示例 |
|---|---|---|---|---|
| `startDate` | String (YYYY-MM-DD) | 是 | 区间起始日，含当日 | `2026-05-01` |
| `endDate` | String (YYYY-MM-DD) | 是 | 区间结束日，含当日 | `2026-05-31` |
| `currency` | String | 否 | 货币代码（大写）；不传则汇总所有货币 | `USD` |

**返回（200）**：

```json
{
  "success": true,
  "result": {
    "days": [
      { "date": "2026-05-01", "invoiceTotal": 12000, "paymentAmount": 8000 },
      { "date": "2026-05-02", "invoiceTotal": 0,     "paymentAmount": 3500 },
      ...
    ]
  },
  "message": "Successfully fetched dashboard trend"
}
```

- `invoiceTotal`：当天 `Invoice.date` 落在该日、`removed: false` 的 Invoice `total` 之和。
- `paymentAmount`：当天 `Payment.date` 落在该日、`removed: false` 的 Payment `amount` 之和。
- 字段名刻意区分，避免前端误用；两者单位相同（货币数值），但语义不同，分别对应左/右 Y 轴。
- `days` 覆盖 `startDate` 到 `endDate` 每一天，无数据的日期两个字段均为 `0`，不能缺日期。

**错误码**：

| HTTP 状态 | 场景 |
|---|---|
| 400 | 参数缺失、格式非法、`endDate < startDate`、区间超 366 天 |
| 401 | JWT 无效或已过期 |

**实现位置**：
- Controller：`backend/src/controllers/appControllers/dashboardController/trend.js`
- 路由：在 `backend/src/routes/appRoutes/appApi.js` 手动追加（不对应单一 Model，无法走 glob 自动注册）
- 聚合：Invoice 和 Payment 各跑一次 `$match + $group by date`，Node.js 层按日期 merge，补零填充缺日

---

## 4. 边界场景清单

| # | 场景 | 类别 | 预期行为 |
|---|---|---|---|
| E1 | 某天没有任何发票也没有任何付款 | 数据为空 | 该日返回 `{ date, total: 0 }` / `{ date, amount: 0 }`，**不能缺这一天**，否则前端折线图会出现日期跳跃 |
| E2 | 整个查询区间内完全没有数据（新账号）| 数据为空 | `days` 返回全 0 填充的数组，HTTP 200；**不返回 404** |
| E3 | 同一 entity 内存在多种货币（如 USD 和 EUR 的 Invoice 混存）| 多货币 | 沿用现有 SummaryCard 行为：前端传 `default_currency_code`，接口按 `currency` 过滤，不做汇率换算 —— 基于现有代码约定（`DashboardModule/index.jsx` 已这样处理）|
| E4 | Invoice.date 与 Payment.date 不在同一天（先开票后到账）| 日期语义 | 两图各自按自己的日期字段聚合，完全独立，不存在"对齐"问题 —— 两图分开后此场景自然消解 |
| E5 | `removed: true` 的 Invoice 或 Payment | 软删除 | 遵循项目约定，始终过滤 `removed: false`，不计入走势 —— 基于现有代码约定（CLAUDE.md 来源） |
| E6 | Invoice.status = 'draft' 的发票 | 状态过滤 | **待产品决策**：草稿是否计入 total？建议排除 draft，但需产品确认 |
| E7 | `endDate - startDate > 366 天` | 大区间 | 返回 400，message 提示最大区间限制 —— 防止 MongoDB 聚合超时 |
| E8 | `startDate = endDate`（单天查询）| 最小区间 | 合法，返回 1 个数据点的 `days` 数组 |
| E9 | Invoice.total 由后端用 `currency.js` 精度安全计算，Payment.amount 也同理 | 精度 | 聚合用 MongoDB `$sum`，精度损失风险与现有 summary 接口相同；**不在 Node 层重新用 currency.js 叠加**（参见 CLAUDE.md 金额计算约定）—— 基于现有代码约定 |
| E10 | 并发请求（用户快速切换时间范围）| 并发 | 前端取消上一次请求（AbortController）或用节流，后端无需特殊处理 —— **待产品决策（前端实现方式）** |
| E11 | `currency` 参数传入不存在的货币代码 | 入参异常 | 返回全 0 数据（无记录匹配），不报错 —— 基于现有代码约定 |
| E12 | 日期字符串含时区偏移（如 `2026-05-01T00:00:00+08:00`）| 时区 | **待产品决策**：后端目前无统一时区配置，Invoice.date 存储为 UTC Date。建议接口文档明确要求前端传 `YYYY-MM-DD` 裸日期，后端解析为 `[startOfDay(UTC), endOfDay(UTC)]` |

---

## 5. 老项目约束

与本需求直接相关的约束：

| 约束 | 来源 | 影响 |
|---|---|---|
| **软删除**：所有查询必须加 `{ removed: false }`，不做物理删除 | CLAUDE.md — 关键约定·后端 | 聚合 pipeline 的 `$match` 阶段必须包含此条件，漏掉会把用户已删除的发票/付款计入走势 |
| **金额由后端计算，前端只展示**：前端不写最终金额到后端 | CLAUDE.md — 关键约定·后端 | 图表渲染直接用接口返回的 `total` / `amount` 字段，不在前端做二次聚合后回传 |
| **路由自动注册依赖 appModels glob**：在 `appModels/` 新增 Model 后路由自动注册 | CLAUDE.md — 关键约定·后端 | `dashboard/trend` 不对应任何单一 Model，**不能走自动注册**，需在 `appApi.js` 手动追加，或单独建 `dashboardRouter` 挂到 `app.js` |
| **Settings 在所有页面渲染前加载**：ErpApp 等 `settings.isSuccess === true` 才渲染 | CLAUDE.md — 关键约定·前端 | 图表组件可直接从 Redux `settings` slice 读取货币符号（`useMoney()`），无需二次请求 |
| **erp vs crud slice 分工**：Invoice/Payment 用 `erp`，Customer 用 `crud` | CLAUDE.md — 关键约定·前端 | 走势图数据是跨 Invoice 和 Payment 的聚合，建议**不挂载到现有 `erp` slice**，使用 `useFetch` / `useOnFetch` hook 管理本地状态（Dashboard 现有代码已这样使用，见 `DashboardModule/index.jsx`） |
| **`adavancedCrud` 拼写错误保持原样** | CLAUDE.md — 历史包袱 | 若新 slice 文件跨引用，不要"修正"此拼写 |
| **现有 summary 接口日期过滤已注释**：`invoice/summary` 和 `payment/summary` 中的日期过滤全部被注释 | 代码观察（`invoiceController/summary.js:30-33`、`paymentController/summary.js:30-33`）| 本需求**新建独立接口**，不修改现有 summary 接口，避免影响 Dashboard 现有 SummaryCard |

---

## 6. 不在这次范围里的事

以下是候选项，**最终由产品决定**：

| 候选项 | 说明 |
|---|---|
| 多货币汇率换算 | 不同货币金额统一换算到基准货币后再聚合；需引入汇率数据源 |
| 按客户分组 | 走势图可下钻到单个客户 |
| 与上一周期对比线 | 同图显示上月/上周同期数据，辅助环比分析 |
| Quote 走势 | 报价单金额趋势（OSS 版后端无 Quote Model，暂无法实现） |
| 未收款（total_undue）趋势线 | 应收账款随时间的变化 |
| 数据导出（CSV / PDF）| 导出图表数据为文件 |
| 图表类型切换（柱状图 / 面积图）| 当前只做折线图 |
| 预测 / 趋势外推 | 基于历史数据预测未来走势 |
| 阈值告警 | paid 连续 N 天低于 total 的 X% 时发出通知 |
| 实时刷新 | WebSocket 或轮询推送最新数据 |
| 周 / 月粒度聚合（后端） | 当前固定按天，如需更粗粒度由前端聚合或后端另加参数 |
| 移动端适配细节 | `useResponsive()` 已存在，响应式断点策略待定 |
