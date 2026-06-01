# 前后端数据流说明

选择 3 个最具代表性的核心流程，逐层说明数据如何从用户操作流转到数据库再返回 UI。

---

## 流程 1：用户登录

**触发**：用户在 `/login` 填写 email + password，点击"Login"按钮。

```
[用户输入 email + password]
         │
         ▼
[LoginForm.onFinish(values)]
  ↓ dispatch(login({ loginData: { email, password, remember } }))
  ↓ 前端状态变化：auth.isLoading = true
         │
         ▼
[src/auth/auth.service.js → authService.login()]
  ↓ axios.POST http://localhost:8888/api/login
  ↓ 携带：{ email, password, remember }
         │
         ▼ HTTP 到达后端
[src/routes/coreRoutes/coreAuth.js]
  → router.route('/login').post(adminAuth.login)
         │
         ▼
[src/controllers/middlewaresControllers/createAuthMiddleware/login.js]
  1. Joi 校验 email 格式 + password 非空 → 失败返回 409
  2. Admin.findOne({ email, removed:false }) → 找不到返回 404
  3. 检查 admin.enabled → false 返回 409
  4. 调用 authUser()
         │
         ▼
[createAuthMiddleware/authUser.js]
  1. bcrypt.compare(salt+password, databasePassword.password) → 不匹配返回 403
  2. jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: remember?'8760h':'24h' })
  3. AdminPassword.findOneAndUpdate($push { loggedSessions: token })
  4. res.json({ success:true, result: { _id, name, email, token, ... } })
         │
         ▼ HTTP 响应回前端
[src/redux/auth/actions.js]
  → data.success === true
  → dispatch({ type: REQUEST_SUCCESS, payload: data.result })
  → auth.current = { _id, name, email, token, ... }
  → auth.isLoggedIn = true
  → localStorage.setItem('auth', JSON.stringify(auth_state))
         │
         ▼
[IdurarOs.jsx]
  → useSelector(selectAuth).isLoggedIn === true
  → 渲染 <ErpApp>（替换 <AuthRouter>）
  → ErpApp 挂载后 dispatch(settingsAction.list) 加载配置
```

**失败路径**：
- 404/403/409 → `errorHandler` 弹出 Ant Design notification → auth 保持 INITIAL_STATE（isLoggedIn=false）

---

## 流程 2：创建发票

**触发**：用户在 `/invoice/create` 填写表单，点击"Save"按钮。

```
[用户填写 InvoiceForm]
  字段：client(AutoComplete异步搜索), number, year, status,
        date, expiredDate, items[], taxRate, discount, currency, notes
         │
  [InvoiceForm.onValuesChange]
    → calculate.multiply(qty, price) → setSubTotal(本地 state)
    → calculate.add(subTotal * taxRate) → 显示实时小计
         │
         ▼
[ErpPanelModule/CreateItem.jsx → SaveForm.handelClick()]
  ↓ form.submit()
  ↓ form.onFinish(values) → dispatch(erp.create({ entity:'invoice', jsonData: values }))
  ↓ 前端状态：erp.create.isLoading = true
         │
         ▼
[src/redux/erp/actions.js → erp.create()]
  ↓ request.create({ entity:'invoice', jsonData })
  ↓ axios.POST /api/invoice/create
  ↓ headers: { Authorization: 'Bearer <token from localStorage auth.current.token>' }
         │
         ▼ HTTP 到达后端
[src/routes/appRoutes/appApi.js]
  → erpApiRouter 经过 isValidAuthToken 中间件
  → router.route('/invoice/create').post(invoiceController.create)
         │
         ▼
[isValidAuthToken.js]
  1. 从 Authorization header 提取 token
  2. jwt.verify(token, JWT_SECRET)
  3. AdminPassword.findOne({ user: verified.id }) → 检查 loggedSessions.includes(token)
  4. 通过 → req.admin = Admin 文档 → next()
         │
         ▼
[invoiceController/create.js]
  1. Joi schema.validate(body)
     必填：client, number, year, status, date, expiredDate, items[]
     → 失败返回 400
  2. 计算金额（currency.js 精度安全计算）：
     items.forEach → item.total = qty × price
     subTotal = Σ item.total
     taxTotal = subTotal × taxRate/100
     total = subTotal + taxTotal
  3. paymentStatus = (total-discount === 0) ? 'paid' : 'unpaid'
  4. body.createdBy = req.admin._id
  5. new Model(body).save() → MongoDB 写入 Invoice 文档
  6. Model.findOneAndUpdate({ _id }, { pdf: 'invoice-{_id}.pdf' }) → 更新 pdf 字段
  7. increaseBySettingKey('last_invoice_number') → Setting 自增
  8. res.json({ success:true, result: updatedInvoice })
         │
         ▼ HTTP 响应
[src/redux/erp/actions.js]
  → data.success === true
  → dispatch({ type: REQUEST_SUCCESS, keyState:'create', payload: data.result })
  → dispatch({ type: CURRENT_ITEM, payload: data.result })
  → erp.create.isSuccess = true
         │
         ▼
[CreateItem.jsx useEffect([isSuccess])]
  → isSuccess === true
  → form.resetFields()
  → navigate('/invoice/')
         │
         ▼
[/invoice 路由加载 InvoiceDataTableModule]
  → dispatch(erp.list({ entity:'invoice', options:{page:1,items:10} }))
  → 表格刷新，新发票出现在列表中
```

---

## 流程 3：记录付款（Record Payment）

**触发**：用户在发票列表或详情页点击"Record Payment"，填写付款表单后提交。

```
[DataTable.handleRecordPayment(record)]
  ↓ dispatch(erp.currentAction({ actionType:'recordPayment', data:record }))
  ↓ erp.recordPayment.current = 当前发票记录
  ↓ navigate('/invoice/pay/:id')
         │
         ▼
[RecordPaymentModule/RecordPayment.jsx 挂载]
  ↓ useSelector(selectRecordPaymentItem).current → 读取当前发票
  ↓ 计算 maxAmount = invoice.total - invoice.discount - invoice.credit
  ↓ 渲染 PaymentForm（限制金额上限为 maxAmount）
         │
  [用户填写：amount, date, ref, description, paymentMode]
         │
         ▼
[RecordPayment.onSubmit(fieldsValue)]
  ↓ fieldsValue.invoice = currentInvoice._id
  ↓ fieldsValue.client = currentInvoice.client._id
  ↓ dispatch(erp.recordPayment({ entity:'payment', jsonData: fieldsValue }))
  ↓ 前端状态：erp.recordPayment.isLoading = true
         │
         ▼
[request.create({ entity:'payment', jsonData })]
  ↓ axios.POST /api/payment/create
  ↓ Bearer token 自动附加
         │
         ▼ 后端
[isValidAuthToken → paymentController/create.js]
  1. 校验 amount > 0 → 否返回 202
  2. Invoice.findOne({ _id: req.body.invoice }) → 获取当前发票
  3. 计算 maxAmount = total - discount - credit
  4. 校验 amount <= maxAmount → 超额返回 202（含提示最大金额）
  5. body.createdBy = req.admin._id
  6. Payment.create(body) → 写入 payments 集合
  7. Payment.findOneAndUpdate(_id, { pdf: 'payment-{_id}.pdf' })
  8. 计算新 paymentStatus：
     paid = (total-discount === credit+amount)
     partially = (credit+amount > 0)
     unpaid = 其他
  9. Invoice.findOneAndUpdate(_id, {
       $push: { payment: paymentId },
       $inc:  { credit: amount },
       $set:  { paymentStatus: newStatus }
     })
  10. res.json({ success:true, result: updatedPayment })
         │
         ▼ 响应
[erp/actions.js → recordPayment action]
  → REQUEST_SUCCESS, keyState:'recordPayment'
  → CURRENT_ITEM = data.result.invoice（更新为最新的 Invoice 状态）
  → erp.recordPayment.isSuccess = true
         │
         ▼
[RecordPayment.jsx useEffect([isSuccess])]
  → form.resetFields()
  → dispatch(erp.resetAction({ actionType:'recordPayment' }))
  → dispatch(erp.list({ entity:'invoice' })) ← 刷新发票列表，paymentStatus 已更新
  → navigate('/invoice/')
         │
         ▼
[Invoice 列表 UI 更新]
  → paymentStatus 列显示 "paid" / "partially"
  → credit（已付）列显示新值
```

---

## 通用错误处理

```
[request.js 捕获 axios error]
  → errorHandler(error)
  → 检查 navigator.onLine → 无网络提示
  → 检查 response.data.jwtExpired === true
      → localStorage.removeItem('auth')
      → window.location.href = '/logout'
  → 其他错误 → Ant Design notification.error({ message: 'Request error 40x', description: ... })
```

**JWT 失效联动**：token 过期或被登出后任何请求都会触发 `errorHandler` 自动清空 localStorage 并跳转到登出页，无需手动处理。
