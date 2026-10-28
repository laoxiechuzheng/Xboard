# admin-next 规格：commerce（套餐 / 订单 / 佣金 / 支付 / 优惠券 / 礼品卡）

> 调研日期：2026-10-28。只读调研产物，供 `/{secure_path}/next` 新后台（Vue 3 + TypeScript + Naive UI）实现使用。
> 依据：
> - 官方后台编译包 `public/assets/admin/assets/index-CEIYH7i8.js`（下文“官方 UI”“官方前端”均指它；引用的压缩变量名仅用于溯源，例如 `c6t` 是套餐列表组件）。
> - 官方语言包 `public/assets/admin/locales/zh-CN.js`。
> - 后端：`app/Http/Routes/V2/AdminRoute.php`、`app/Http/Controllers/V2/Admin/{Plan,Order,Payment,Coupon,GiftCard}Controller.php`、`app/Http/Requests/Admin/*`、`app/Models/{Plan,Order,Payment,Coupon,CommissionLog,GiftCardTemplate,GiftCardCode,GiftCardUsage}.php`、`app/Services/{PlanService,OrderService,PaymentService,GiftCardService,UserService}.php`、`database/migrations/*`、`plugins-core/*/Plugin.php`。
>
> 标注约定：**【官方】** = 官方 UI 现有行为（最低标准，必须做到）；**【后端】** = 后端实际行为；**【建议】** = 新 UI 可选改进（不影响兼容）；**【风险】** = 不一致、bug 或危险操作。没有标注的描述以官方行为为准。

---

## 0. 通用约定

### 0.1 请求基址与鉴权

- 基址：`{window.settings.base_url || "/"}` + `api/v2` + `/{secure_path}`，即所有接口为 `/api/v2/{secure_path}/<module>/<action>`。官方前端从 `window.settings.secure_path` 取 `secure_path`。
- 中间件：`admin` + `log`（所有请求会写操作日志）。
- 请求头：`Authorization: <token>`（官方把本地保存的登录凭据原样放入，格式由登录模块决定，不在本域）、`Content-Language: <i18nextLng 或 zh-CN>`、`Content-Type: application/json`。超时 30 s。
- 后端全局中间件含 `TrimStrings` 与 `ConvertEmptyStringsToNull`：**空字符串会被转成 `null`**，前端发 `""` 等同于发 `null`。

### 0.2 响应封装（`app/Helpers/ApiResponse.php`）

| 情况 | HTTP 状态 | Body |
|---|---|---|
| `success($data)` | 200 | `{"status":"success","message":"操作成功","data":<data>,"error":null}` |
| `fail([code,msg])` | `code` 的前 3 位（如 `400202`→400、`500`→500） | `{"status":"fail","message":"<msg>","data":null,"error":null}` |
| `paginate($paginator)` | 200 | `{"total":N,"current_page":N,"per_page":N,"last_page":N,"data":[...]}`（**没有** status/message 包装） |
| Laravel `$request->validate()` / FormRequest 校验失败 | 422 | `{"message":"<第一条错误>","errors":{"field":["..."]}}` |
| `PlanSave` 自定义校验失败 | 422 | `{"data":false,"message":"<第一条错误>","errors":{...}}` |
| `ApiException` | code 前 3 位 | 同 fail，`error` 可能带 errors |
| 未捕获异常 | 500 | Laravel 默认 `{"message":"..."}` |
| 控制器 `return;`（无返回值） | 200 | 空 body（见 coupon/update、coupon/generate 批量） |

官方前端 axios 拦截器：成功时返回 `response.data`（即上表 body），所以调用处写 `const {data} = await api()`；失败时 toast `body.message`（无 message 时按 401「登录已过期」/403「没有权限」/404「资源或接口不存在」/其它「未知异常」），401/403 会登出，然后 reject `body`。**新 UI 应保持：错误统一 toast `message`，成功提示由各页面自己决定。**

### 0.3 单位与格式

| 数据 | 存储单位 | 显示 | 提交转换 |
|---|---|---|---|
| 套餐价格 `plan.prices.*` | **元**（浮点，JSON） | `¥{value}` 原样显示 | 不转换（发元） |
| 订单金额 `total_amount`/`balance_amount`/`discount_amount`/`surplus_amount`/`surplus_credit`/`handling_amount`/`commission_balance`/`actual_commission_balance` | **分**（int） | `¥(v/100).toFixed(2)` | 分配订单 `total_amount` 发分（元×100） |
| 支付 `handling_fee_fixed` | **分**（int） | 元（÷100） | 元×100 |
| 支付 `handling_fee_percent` | 百分数（decimal(5,2)，0–100） | 原样 | 原样 |
| 优惠券 `value`（type=1 金额） | **分** | 元 | 元×100（官方 `Math.round`） |
| 优惠券 `value`（type=2 比例） | 百分数整数 | 原样 + `%` | 原样 |
| 礼品卡奖励 `rewards.balance` | **分** | 元 | 元×100（`Math.round`） |
| 礼品卡奖励 `rewards.transfer_enable` | **字节** | GB（÷1024³）；列表用自动单位 | GB×1024³（`Math.round`） |
| 套餐 `transfer_enable` | **GB**（int） | GB | 原样 |
| 套餐 `speed_limit` | Mbps | Mbps | 原样 |
| 时间戳（全部 `*_at`、`started_at`/`ended_at`/`expires_at`） | Unix **秒** | 官方 `SS(ts, fmt)`：10 位数字×1000 后按 `fmt` 格式化，`null` 显示空串 | 秒 |

官方金额格式化函数 `TS(cents)`：`null/NaN → "¥0.00"`，否则 `¥` + `(cents/100).toFixed(2)`。
官方流量格式化函数 `RS(bytes)`：`≤0 → "0 B"`，否则按 1024 进位选 `B/KB/MB/GB/TB`，保留 2 位小数并去掉多余 0（`parseFloat(x.toFixed(2))`）。

### 0.4 周期（period）枚举：新格式 vs 旧格式

数据库自 `2025_01_13_000000_convert_order_period_fields` 起，`v2_order.period` 存**新格式**；`/order/fetch`、`/order/detail` 返回时用 `PlanService::getLegacyPeriod()` 转回**旧格式**；`/order/assign` 只接受**旧格式**并存为新格式；优惠券 `limit_period` 存/返**新格式**。

| 新格式（plan.prices 键 / coupon.limit_period / DB order.period） | 旧格式（order 接口出入参） | 套餐列表标签 `subscribe.plan.columns.price_period.*` | 订单标签 `order.period.*` | 优惠券标签 `coupon.period.*` | 后端名称 `Plan::getAvailablePeriods` | 月数 | 天数 |
|---|---|---|---|---|---|---|---|
| `monthly` | `month_price` | 月付 | 月付 | 月 | 月付 | 1 | 30 |
| `quarterly` | `quarter_price` | 季付 | 季付 | 季度 | 季付 | 3 | 90 |
| `half_yearly` | `half_year_price` | 半年付 | 半年付 | 半年 | 半年付 | 6 | 180 |
| `yearly` | `year_price` | 年付 | 年付 | 年 | 年付 | 12 | 365 |
| `two_yearly` | `two_year_price` | 两年付 | 两年付 | 两年 | 两年付 | 24 | 730 |
| `three_yearly` | `three_year_price` | 三年付 | 三年付 | 三年 | 三年付 | 36 | 1095 |
| `onetime` | `onetime_price` | 流量包 | 一次性 | 一次性 | 一次性 | -1 | -1 |
| `reset_traffic` | `reset_price` | 重置包 | 流量重置包 | 重置流量 | 重置流量 | -1 | -1 |

### 0.5 其它枚举

**订单状态 `order.status`**（`Order::STATUS_*`；官方 `Z$t`）

| 值 | 键 | 中文 | 官方图标颜色 | 详情徽标 class |
|---|---|---|---|---|
| 0 | PENDING | 待支付 | yellow-500 | `bg-yellow-100 text-yellow-800` |
| 1 | PROCESSING | 开通中 | blue-500 | `bg-blue-100 text-blue-800` |
| 2 | CANCELLED | 已取消 | red-500 | `bg-red-100 text-red-800` |
| 3 | COMPLETED | 已完成 | green-500 | `bg-green-100 text-green-800` |
| 4 | DISCOUNTED | 已折抵 | green-500 | `bg-gray-100 text-gray-800` |

**订单类型 `order.type`**（`Order::TYPE_*`；官方 `Q$t`）

| 值 | 键 | 中文 | 筛选颜色 |
|---|---|---|---|
| 1 | NEW | 新购 | green-500 |
| 2 | RENEWAL | 续费 | blue-500 |
| 3 | UPGRADE | 升级 | purple-500 |
| 4 | RESET_FLOW | 流量重置 | orange-500 |

**佣金状态 `order.commission_status`**（官方 `J$t`；DB 注释“0待确认1发放中2有效3无效”）

| 值 | 键 | 中文 | 颜色 / 徽标 class |
|---|---|---|---|
| 0 | PENDING | 待确认 | yellow-500 / `bg-yellow-100 text-yellow-800` |
| 1 | PROCESSING | 发放中 | blue-500 / `bg-blue-100 text-blue-800` |
| 2 | VALID | 有效 | green-500 / `bg-green-100 text-green-800` |
| 3 | INVALID | 无效 | red-500 / `bg-red-100 text-red-800` |

**套餐流量重置方式 `plan.reset_traffic_method`**

| 值 | 官方选项文案（`plan.form.reset_method.options.*`） | 后端含义（`Plan::getResetTrafficMethods`） |
|---|---|---|
| `null` | 跟随系统设置（`follow_system`） | 跟随系统设置 |
| 0 | 每月首日（`monthly_first`） | 每月1号 |
| 1 | 每月购买日（`monthly_reset`） | 按月重置 |
| 2 | 不重置（`no_reset`） | 不重置 |
| 3 | 每年首日（`yearly_first`） | 每年1月1日 |
| 4 | 每年购买日（`yearly_reset`） | 按年重置 |

**优惠券类型 `coupon.type`**（官方 `oqt`）：`1` = 按金额优惠（AMOUNT），`2` = 按比例优惠（PERCENTAGE）。

**礼品卡类型 `gift_card_template.type`**（`GiftCardTemplate::getTypeMap`，后端只接受 1–3）：`1` 通用礼品卡、`2` 套餐礼品卡、`3` 盲盒礼品卡。语言包另有 `4` 任务礼品卡（后端不接受）。

**兑换码状态 `gift_card_code.status`**（`GiftCardCode::STATUS_*`）：`0` 未使用、`1` 已使用、`2` 已过期、`3` 已禁用。
【风险】官方语言包 `giftCard.code.status` 写成 `2:已禁用、3:已过期`，与后端相反；新 UI 必须按后端：2=已过期、3=已禁用。

### 0.6 官方通用组件行为（新 UI 用 Naive UI 等价实现）

- **数据表**（`HGt`）：分页条有“每页显示”下拉 `[10,20,30,40,50,100,500]`、页码输入跳转、首页/上一页/下一页/末页、“已选择 {{selected}} 项，共 {{total}} 项”；空数据显示“暂无数据”；加载中显示骨架；移动端以卡片展示（`mobilePrimaryField` 作标题，`mobileGridFields` 作网格字段）。部分页提供“显示列”按钮（列显隐，文案“显示列/切换显示列”）。
- **确认弹窗**（`hQt`）：默认标题“确认操作”、描述“确定要执行此操作吗？”、取消“取消”、确认“确认”；移动端为抽屉。
- **表单弹窗**（`XXt`）：标题 + 可选描述；底部左侧 `extraButtons`、右侧“取消”+“提交/确认”（提交中按钮 loading，取消禁用）；移动端为底部抽屉（最大高 90vh）。
- **多选筛选器**（`g6t`/`D6t`/`i3t`）：虚线按钮 + 弹出命令面板，可搜索、多选（勾选框）、显示每项计数、底部“Clear filters”；选中 >2 项时按钮内显示“N selected”。选中值写入 TanStack 列筛选：`{id: 列名, value: 值数组}`，全部取消则移除该筛选。
- **复制**（`IS`）：clipboard.js，成功 toast“复制成功”。
- 列表开关（Switch）都用 `defaultChecked`（非受控），接口失败时通过 refetch 回滚。

---

## 1. 菜单与路由

官方侧边栏（`nav:*`），新 UI 建议在 `/{secure_path}/next` 内沿用相同的前端路径：

| 一级菜单 | 二级菜单 | 官方前端路径 | 页面 | 本文章节 |
|---|---|---|---|---|
| 系统管理（systemManagement） | 支付配置（paymentConfig） | `/config/payment` | 支付方式列表 | §4 |
| 订阅管理（subscriptionManagement） | 套餐管理（planManagement） | `/finance/plan` | 套餐列表 | §2 |
| 订阅管理 | 订单管理（orderManagement） | `/finance/order` | 订单列表（含佣金处理） | §3 |
| 订阅管理 | 优惠券管理（couponManagement） | `/finance/coupon` | 优惠券列表 | §5 |
| 订阅管理 | 礼品卡管理（giftCardManagement） | `/finance/gift-card` | 4 个 Tab | §6 |

没有独立的“佣金”页面；佣金在订单列表的“佣金金额/佣金状态”列与订单详情“佣金信息”中处理（§3）。

外部跳入订单页的链接（新 UI 必须支持这些 query）：
- 仪表盘“待确认佣金”卡片：`/finance/order?commission_status=0&status=3&commission_balance=gt:0`
- 用户管理行菜单“订单”：`/finance/order?user_id=eq:<用户ID>`
- 工单详情“订单记录”：`/finance/order?user_id=<用户ID>`（无 `eq:` 前缀）

每个页面顶部：标题 `h2` + 描述 `p`（文案见各节），右上角是全局搜索/主题/用户菜单（属于布局，不在本域）。

---

## 2. 套餐管理（Plan）

### 2.1 页面结构

- 路由 `/finance/plan`。标题“订阅套餐”（`subscribe.plan.title`），描述“在这里可以配置订阅计划，包括添加、删除、编辑等操作。”。
- 主体：套餐表格（前端分页/筛选/排序）。
- 弹窗：添加/编辑套餐（同一个表单弹窗，`l6t`）；删除确认弹窗；表单内“添加分组”子弹窗（权限组创建，`c4t`）。

### 2.2 数据加载

- `GET /plan/fetch`，无参数。一次拉取全部套餐（**不分页**），前端分页/筛选/排序。query key `planList`。
- 响应 `data`：数组，按 `sort ASC`。每项字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int | |
| `name` | string | |
| `group_id` | int\|null | 权限组 |
| `group` | `{id,name}`\|null | 关联权限组 |
| `transfer_enable` | int | **GB** |
| `speed_limit` | int\|null | Mbps |
| `device_limit` | int\|null | |
| `capacity_limit` | int\|null | 见风险：`null`=不限，`0`=售罄 |
| `show` | bool | cast boolean |
| `sell` | 0/1 | **未 cast**，返回 0/1 |
| `renew` | bool | cast boolean |
| `prices` | object\|null | 键为新格式周期，值为元（可能是数字、字符串或 null，见风险） |
| `reset_traffic_method` | int\|null | |
| `content` | string\|null | Markdown/HTML |
| `tags` | string[]\|null | |
| `sort` | int\|null | |
| `users_count` | int | 所有 `plan_id=该套餐` 的用户数 |
| `active_users_count` | int | 其中 `expired_at > now` 或 `expired_at IS NULL` 的用户数 |
| `created_at` / `updated_at` | int | 秒 |

### 2.3 表格列（`n6t`）

| # | 列 id / accessorKey | 标题 | 显示 | 排序 | 可隐藏 |
|---|---|---|---|---|---|
| 0 | `drag-handle` | （无） | 拖拽把手图标，**仅排序模式可见**（列显隐由排序模式控制），宽 40 | 否 | — |
| 1 | `id` | ID | outline 徽标 | 是（前端） | 否 |
| 2 | `show` | 显示 | Switch，切换即 `POST /plan/update {id, show:bool}` | 否 | 否 |
| 3 | `sell` | 新购 | Switch → `POST /plan/update {id, sell:bool}` | 否 | 否 |
| 4 | `renew` | 续费（表头带 tooltip“在订阅停止销售时，已购用户是否可以续费”） | Switch → `POST /plan/update {id, renew:bool}` | 否 | 否 |
| 5 | `name` | 名称 | 粗体，超长截断 | 否 | 否 |
| 6 | `users_count` | 统计 | 两个小块：①灰色“人形图标 + users_count”，tooltip 标题“总用户数”、说明“所有使用该套餐的用户（包括已过期）”；②绿色“图标 + active_users_count”，tooltip“有效期内用户”/“当前仍在有效期内的活跃用户”，若 users_count>0 再显示“活跃率：{round(active/users*100)}%” | 是（前端，按 users_count） | 是 |
| 7 | `group` | 权限组 | secondary 徽标显示 `group.name`（null 时空徽标） | 否 | 否 |
| 8 | `prices` | 价格 | 对 8 个周期依次判断 `prices[key] != null`，显示徽标 `"{周期名} ¥{值}{单位}"`；单位：月付“元/月”、季付“元/季”、半年付“元/半年”、年付“元/年”、两年付“元/两年”、三年付“元/三年”、流量包（onetime）无单位、重置包（reset_traffic）“元/次”。`prices` 为空/null 时显示虚线徽标“无价格”。值原样输出（不做 ÷100） | 否 | 是 |
| 9 | `actions` | 操作（右对齐，固定在右侧） | 编辑图标按钮（打开编辑弹窗）、删除图标按钮（确认后删除） | 否 | — |

开关交互：调用后若响应 `data` 为假值则 refetch（回滚显示）；成功无 toast。

### 2.4 工具栏（`J3t`）

- 左：按钮“添加套餐”（图标 +，打开空白表单）；搜索框 placeholder“搜索套餐...”，对 `name` 列做前端包含过滤。
- 右（仅 md 以上且有数据时显示）：按钮“编辑排序”；排序模式下按钮变为实心“保存排序”。

### 2.5 拖拽排序

- 点击“编辑排序”：进入排序模式 → 显示拖拽列、行可拖拽（HTML5 DnD，拖动行半透明、悬停行高亮）、分页条隐藏、每页条数设为 99999（全量）。
- 拖放后在前端数组中移动该行。
- 点击“保存排序”：`POST /plan/sort {ids:[按当前顺序的全部 id]}` → toast“排序保存成功” → 退出排序模式 → refetch。（无论成功失败都会退出排序模式。）
- 退出排序模式后每页条数重置为 10（**官方实际默认每页 10**）。

### 2.6 添加/编辑套餐表单（弹窗 `l6t`）

标题：添加时“添加套餐”，编辑时“编辑套餐”。提交按钮“提交”，取消按钮“取消”。编辑模式底部左侧额外有复选框“强制更新用户套餐”（`force_update`）。打开弹窗时拉取权限组列表 `GET /server/group/fetch`。

表单默认值（`s6t`）：
```json
{ "id": null, "group_id": null, "name": "", "tags": [], "content": "", "transfer_enable": "",
  "prices": { "monthly": "", "quarterly": "", "half_yearly": "", "yearly": "", "two_yearly": "", "three_yearly": "", "onetime": "", "reset_traffic": "" },
  "speed_limit": "", "capacity_limit": "", "device_limit": "", "force_update": false, "reset_traffic_method": null }
```
编辑时用 `{...默认值, ...行数据}` 重置（行数据中的 `prices` 整体覆盖默认 prices）。

布局（两列网格，移动端单列），逐字段：

| 字段 key | 控件 | 中文标签 | 必填 | 默认 | 前端校验（zod `r6t`） | 后端校验（`PlanSave`） | 说明 |
|---|---|---|---|---|---|---|---|
| `name` | 文本 | 套餐名称（placeholder“请输入套餐名称”） | 是 | `""` | string 1–250 | `required|string|max:255`；“套餐名称不能为空”“套餐名称不能超过 255 个字符” | |
| `tags` | 标签输入（`W2t`） | 标签（placeholder“输入标签后按回车确认”） | 否 | `[]` | string[] 可空 | `array|nullable`；“标签格式必须是数组” | 输入中出现英文逗号即按逗号拆分、trim、去重后追加；每个标签徽标带删除按钮 |
| `group_id` | 下拉（选项=权限组 `name`，值=`id`） | 服务器分组（placeholder“请选择服务器分组”）；标签右侧链接按钮“添加分组” | 否 | `null` | number\|string 可空 | `integer|nullable`；“权限组ID必须是整数” | 选中后转 `Number`；“添加分组”打开权限组创建弹窗（见 2.6.2），成功后重新拉取分组列表 |
| `transfer_enable` | 数字输入，后缀“GB” | 流量（placeholder“请输入流量限制”） | 是 | `""` | number≥0 或 string 长度≥1 | `integer|required|min:1`；“流量配额不能为空/必须是整数/必须大于 0” | 单位 GB，原样提交 |
| `speed_limit` | 数字，后缀“Mbps” | 速度限制（placeholder“请输入速度限制”） | 否 | `""` | number\|string 可空 | `integer|nullable|min:0` | 空=不限速 |
| `device_limit` | 数字，后缀“台” | 设备限制（placeholder“请输入设备限制”） | 否 | `""` | 同上 | `integer|nullable|min:0` | 空=不限 |
| `capacity_limit` | 数字，后缀“人” | 容量限制（placeholder“请输入容量限制”） | 否 | `""` | 同上 | `integer|nullable|min:0` | 见风险：0=售罄 |
| `reset_traffic_method` | 下拉 | 流量重置方式（placeholder“请选择重置方式”） | 否 | `null` | number 可空 | `integer|nullable` | 选项见 §0.5；`"null"` 选项提交 `null`，其余提交数字 |
| `prices.*` | 价格分组（见下） | 价格设置 | 否 | 各 `""` | 每项 number\|string 可空 | `prices` `nullable|array`；`prices.*` `nullable|numeric|min:0`；`withValidator` 检查键必须是 8 个新格式周期之一（“不支持的订阅周期: x”）、值必须数字（“价格必须是数字格式”）且 ≥0（“价格必须大于等于 0（如不需要此周期请留空）”） | 单位元，原样提交 |
| `content` | Markdown 编辑器（高 300px） | 套餐说明；下方说明“支持 Markdown 格式” | 否 | `""` | string 可空 | `nullable|string` | 见 2.6.1 |
| `force_update` | 复选框（仅编辑） | 强制更新用户套餐 | 否 | `false` | boolean | 未校验，`$request->input('force_update')` | 见 2.9 危险操作 |

价格分组（虚线框，标题“价格设置”）：
- 标题右侧：“基础价格”数字输入（前缀 ¥，step 0.01）——输入即按下表自动计算 8 个周期价格并 `toFixed(2)` 写入（字符串）：

  | 周期 | 月数 | 折扣 | 计算 |
  |---|---|---|---|
  | monthly | 1 | 1 | base×1×1 |
  | quarterly | 3 | 0.95 | base×3×0.95 |
  | half_yearly | 6 | 0.9 | base×6×0.9 |
  | yearly | 12 | 0.85 | base×12×0.85 |
  | two_yearly | 24 | 0.8 | base×24×0.8 |
  | three_yearly | 36 | 0.75 | base×36×0.75 |
  | onetime | 1 | 1 | base |
  | reset_traffic | 1 | 1 | base |

  输入非数字时忽略。
- 一个垃圾桶图标按钮（官方只有图标，未渲染文字/tooltip；语言包有 `plan.form.price.clear.button`“清空”、`plan.form.price.clear.tooltip`“清空所有价格”可用）：把 8 个价格都设为 `""`。
- 第一行网格（2/3/4 列响应式）：monthly、quarterly、half_yearly、yearly、two_yearly、three_yearly，标签用列表周期名（月付、季付、半年付、年付、两年付、三年付），前缀 ¥，step 0.01。
- 分隔线后两列：onetime（标签“流量包”，说明“一次性流量包，无时间限制”）、reset_traffic（标签“重置包”，说明“重置流量包，可多次使用”）。

#### 2.6.1 套餐说明编辑器

- 官方使用 react-markdown-editor-lite（菜单栏 + Markdown 编辑区，不显示 HTML 预览区，禁全屏），渲染用 markdown-it（`html:true`）。
- 标签右侧两个按钮：
  - “使用模板”（tooltip key `plan.form.content.template.tooltip`“使用默认模板”）：把内容**整体替换**为模板：
    ```
    ## 套餐详情

    - 流量：{{transfer}} GB
    - 速度限制：{{speed}} Mbps
    - 同时在线设备：{{devices}} 台

    ## 服务说明

    1. 流量{{reset_method}}重置
    2. 支持多平台使用
    3. 7×24小时技术支持
    ```
    【更正】这些占位符是有意保留的：后端 `PlanResource::formatContent` 在用户端/游客端套餐接口和 `OrderResource` 输出时按套餐实际值替换 `{{transfer}}`/`{{speed}}`/`{{devices}}`/`{{reset_method}}`。新 UI 插入模板时保留占位符原文，不写死数值；只在预览中按当前表单值替换显示（`MarkdownEditor` 的 `previewTransform`）。
  - “显示预览/隐藏预览”：开启后在编辑器右侧（lg 两栏）显示 markdown-it 渲染结果（`prose`，高 300px 可滚动）。

#### 2.6.2 “添加分组”子弹窗（权限组创建，属 server 域，套餐表单复用）

- 标题“创建权限组”，描述“创建新的权限组，可以为不同的用户分配不同的权限。”
- 字段 `name`：标签“组名称”，placeholder“请输入权限组名称”，说明“权限组名称用于标识不同的用户组，建议使用有意义的名称。”；校验 2–50 字符（“组名至少需要2个字符”/“组名不能超过50个字符”），正则 `^[a-zA-Z0-9一-龥_-]+$`（“组名只能包含字母、数字、中文、下划线和连字符”）。
- 按钮“取消”/“创建权限组”（表单无效时禁用）。提交 `POST /server/group/save {name}` → toast“创建成功” → 刷新套餐表单的分组下拉。

#### 2.6.3 提交

- 校验失败：toast 所有字段错误 message 用换行拼接，或“表单校验失败，请检查并修正错误后重试。”。
- 提交 `POST /plan/save`，body 为 zod 解析后的对象（zod 会剔除未声明字段，因此编辑时行里的 `show/sell/renew/sort/group/created_at` 不会发送）：
  ```json
  { "id": 3 | null, "group_id": 1 | null, "name": "...", "tags": ["..."], "content": "...",
    "transfer_enable": "100" | 100, "prices": { "monthly": "10.00", "quarterly": "", ... },
    "speed_limit": "" | "100", "capacity_limit": "", "device_limit": "",
    "force_update": false, "reset_traffic_method": null | 0..4,
    "users_count": 12, "active_users_count": 3 }
  ```
  数字输入框官方以字符串提交；空串经后端中间件变 `null`。
- 成功（`data` 为 true）：toast“套餐添加成功”/“套餐更新成功” → 关闭弹窗 → 重置表单 → refetch 列表。失败：拦截器 toast 后端 message。

### 2.7 删除

- 删除图标 → 确认弹窗：标题“确认删除”，描述“此操作将永久删除该订阅，删除后无法恢复。确定要继续吗？”，确认按钮“删除”（destructive），取消“取消”。
- `POST /plan/drop {id}` → `data` 为真时 toast“删除成功” → refetch。
- 后端拒绝：存在该套餐订单 → 400“该订阅下存在订单无法删除”；存在该套餐用户 → 400“该订阅下存在用户无法删除”；不存在 → 400“该订阅不存在”。

### 2.8 接口明细

| 方法 | 路径 | 请求 | 响应 data | 副作用 / 错误 |
|---|---|---|---|---|
| GET | `/plan/fetch` | 无 | 套餐数组（§2.2） | — |
| POST | `/plan/save` | 见 2.6.3。后端只取 `validated()` 中的 `id,name,content,reset_traffic_method,transfer_enable,prices,group_id,speed_limit,device_limit,capacity_limit,tags`；`force_update` 另读；`show/sell/renew/sort` **不能**通过 save 修改 | `true` | 无 `id` → `Plan::create`（新套餐 `show=0`、`sell=0`、`renew=1` 取 DB 默认值，即**新建后默认不显示、不可新购**）；有 `id` → 事务更新，`force_update` 为真时批量改用户（见 2.9）。错误：422 校验（`PlanSave` 格式）、400202“该订阅不存在”、500“保存失败”/“创建失败” |
| POST | `/plan/update` | `{id:int, show?:bool, sell?:bool, renew?:bool}`（官方每次只发一个开关） | `true` | `$request->only(['show','renew','sell'])` 后更新；400202“该订阅不存在”；500“保存失败”。`PlanUpdate` FormRequest 存在但控制器未使用 |
| POST | `/plan/drop` | `{id:int}` | `true` | 见 2.7 |
| POST | `/plan/sort` | `{ids:int[]}` | `true` | 按数组下标写 `sort = index+1`（事务）。`ids` 必填数组（422）；某 id 不存在时 `find()` 返回 null 导致 PHP Error（不是 Exception，绕过 catch → 500）。`PlanSort` FormRequest（`plan_ids`）未使用 |
| GET | `/server/group/fetch` | 无 | 权限组数组 `[{id,name,...}]` | 属 server 域 |
| POST | `/server/group/save` | `{name}` | — | 属 server 域 |

### 2.9 差异与风险（套餐）

1. 【风险·危险操作】`force_update=true` 会对**所有** `plan_id=该套餐` 的用户执行 `group_id`、`transfer_enable=GB×1073741824`、`speed_limit`、`device_limit` 覆盖写，会抹掉单个用户被手动调整或礼品卡追加的流量/设备数。新 UI 勾选时应二次确认并说明影响人数（可用 `users_count`）。
2. 【风险】`PlanSave::passedValidation()` 想把价格清洗为“仅保留 >0 的数值并 round(2)”，但控制器用的是 `$request->validated()`（取自校验器数据，merge 不影响它——按 Laravel 标准实现推断，仓库未带 vendor，未运行验证），因此 `prices` 很可能按原样入库：字符串 `"10.00"`、`null`、`0` 都可能存进 JSON。后果：`PlanService::validatePurchase` 只判断 `=== null`，**价格填 0 会变成 0 元可购买**；列表对 `null` 不显示、对 `0` 显示“¥0”。【建议】新 UI 提交前自行清洗：只保留数值 >0 的周期，转为 `Number` 并保留 2 位，其余周期**不发送**（不要发 0 或空串）。
3. 【风险】`capacity_limit`：`null`=不限；`0`=容量为 0（新用户无法购买，`hasCapacity` 返回 false）。迁移注释写“0 for unlimited”是错的。新 UI 应在说明中提示“留空不限制，0 表示停售”。
4. 前端允许 `transfer_enable=0` 或小数，后端要求整数且 ≥1，会返回 422。新 UI 前端即校验整数≥1。
5. 官方 zod `name` 上限 250，后端 255；新 UI 用 255。
6. 新建套餐默认 `show=0, sell=0`（不显示、不可新购），需要在列表里手动打开开关；新 UI 可在创建成功后提示。
7. 列表“统计”排序/搜索/分页均为前端处理；全部套餐一次加载。
8. 官方列表价格徽标对字符串价格原样拼接（如“¥10.00元/月”），新 UI 统一 `Number(v).toFixed(2)`。

---

## 3. 订单管理（Order，含佣金）

### 3.1 页面结构

- 路由 `/finance/order`。标题“订单管理”，描述“在这里可以查看用户订单，包括分配、查看、删除等操作。”
- 主体：订单表格（**后端分页/筛选/排序**）。
- 弹窗：订单详情（点订单号打开）、订单分配（工具栏“添加订单”）。
- 行内下拉菜单：待支付订单的“标记为已支付/取消订单”；待确认佣金的“发放中/无效”。

### 3.2 数据加载

- `POST /order/fetch`（路由为 `any`），query key `["orderList", pagination, filters, sorting]`，任一变化重新请求。
- 请求体：
  ```json
  { "pageSize": 20, "current": 1,
    "filter": [ { "id": "trade_no", "value": "abc" }, { "id": "status", "value": [0, 3] } ],
    "sort":   [ { "id": "created_at", "desc": true } ] }
  ```
  - 初始 `pageSize=20`、`current=pageIndex+1`。
  - 页面加载时从 URL query 读取预置筛选：`user_id`(string)、`order_id`(string)、`commission_status`(number)、`status`(number)、`commission_balance`(string)；存在即作为 `{id, value}` 加入 `filter`（number 类型 `parseInt`）。
- 后端过滤规则（`OrderController::buildFilterQuery`，每个 filter 用 `where(function)` 包裹，AND 组合）：
  - `value` 是数组 → `whereIn(id, value)`。
  - `value` 不是字符串或不含 `:` → `where(id, 'like', "%value%")`（数字也走 like）。
  - `value` 形如 `op:val` → `op ∈ eq(=)、gt(>)、gte(>=)、lt(<)、lte(<=)、like、notlike(not like)、null、notnull`，其它当 like；`val` 为数字串时转 int/float；like/notlike 两侧加 `%`。（注意：`null`/`notnull` 的实现把闭包当作操作符传入 `where`，行为不可靠，不建议使用。）
- 后端排序：每个 `{id, desc}` → `orderBy(id, desc?'DESC':'ASC')`，之后再追加 `latest('created_at')`。
- 额外参数 `is_commission`（bool）：为真时只看 `invite_user_id IS NOT NULL AND status=3 AND commission_balance>0`。**官方 UI 未使用**。
- `OrderFetch` FormRequest（`filter.*.key/condition`）未被控制器使用，忽略。
- 响应（paginate 格式）：`{total, current_page, per_page, last_page, data:[订单]}`。每个订单：`v2_order` 全部列 + 关联：
  - 列：`id, invite_user_id, user_id, plan_id, coupon_id, payment_id, type, period(旧格式), trade_no, callback_no, total_amount, handling_amount, discount_amount, surplus_amount, surplus_credit, balance_amount, surplus_order_ids(array|null), status, commission_status, commission_balance, actual_commission_balance, paid_at, created_at, updated_at`。
  - 【风险】本 fork 迁移 `2026_05_30_000000_rename_refund_amount_to_surplus_credit` 把 `refund_amount` 改名为 `surplus_credit`（升级订单折抵后多出的金额，开通时加回用户余额）。官方 UI 仍读 `refund_amount`，永远显示 ¥0.00。
  - 关联：`plan:{id,name}`、`user:{id,email}`、`invite_user:{id,email}|null`、`payment:{id,name,payment,enable}|null`。

### 3.3 表格列（`N6t`）

| # | accessorKey | 标题 | 显示 | 后端排序 | 筛选 |
|---|---|---|---|---|---|
| 1 | `trade_no` | 订单号 | ghost 按钮，等宽字体显示 `前3位...后3位`（长度≤6 原样）+ 外链图标；点击打开订单详情弹窗（按 `id`） | 否 | 工具栏搜索框写入此列（like） |
| 2 | `type` | 类型 | slate 徽标，文案 `order.type.{NEW/RENEWAL/UPGRADE/RESET_FLOW}`，未知值显示原数字 | 否 | 多选“类型”：新购/续费/升级/流量重置（值 1–4） |
| 3 | `plan.name` | 订阅计划 | 文本，超长截断；无则“-” | 否 | — |
| 4 | `period` | 周期 | slate 徽标，文案 `order.period.{旧格式}`；null 显示“-” | 否 | 多选“周期”：8 个旧格式值（见风险 3） |
| 5 | `total_amount` | 支付金额 | 等宽 `¥{(v/100).toFixed(2)}`，非数字显示 `¥N/A` | 是 | — |
| 6 | `status` | 订单状态（表头问号 tooltip“标记为[已支付]后将会由系统进行开通后并完成”） | 状态图标（颜色见 §0.5）+ 文案；**仅待支付(0)** 时右侧有“…”菜单按钮（sr-only“打开菜单”），菜单项“标记为已支付”“取消订单”（红色） | 是 | 多选“订单状态”：5 个状态 |
| 7 | `commission_balance` | 佣金金额 | 非 0 显示 `¥{(v/100).toFixed(2)}`，否则“-” | 是 | — |
| 8 | `commission_status` | 佣金状态 | 当 `commission_balance != 0` 时显示图标+文案（`order.commission.*`），否则“-”；当佣金状态=待确认(0) **且** 订单状态=已完成(3) 时右侧有“…”菜单：“发放中”“无效”（红色） | 是 | 多选“佣金状态”：4 个状态 |
| 9 | `created_at` | 创建时间 | `yyyy/MM/dd HH:mm:ss`，等宽 | 是 | — |

全部列不可隐藏。移动端卡片：主字段 `trade_no`，网格 `plan.name,total_amount,status,created_at`。分页条显示（每页选项见 §0.6）。

行操作（均**无确认弹窗**，点击即调用，结束后 refetch，成功不 toast，失败由拦截器 toast）：
- 标记为已支付：`POST /order/paid {trade_no}`
- 取消订单：`POST /order/cancel {trade_no}`
- 佣金“发放中”：`POST /order/update {trade_no, commission_status:1}`
- 佣金“无效”：`POST /order/update {trade_no, commission_status:3}`

【建议】新 UI 为“标记为已支付”“取消订单”“佣金无效”加确认弹窗（它们会开通套餐/退余额/作废佣金，不可撤销）。

### 3.4 工具栏（`_6t`）

从左到右：
1. “添加订单”按钮（图标 +）→ 打开订单分配弹窗（§3.6）。
2. 搜索框 placeholder“搜索订单...”→ 列筛选 `trade_no`（字符串，后端 like）。
3. 多选筛选器：“类型”“周期”“订单状态”“佣金状态”（选项、颜色见 §0.5 与 3.3）。
4. 有任一筛选时显示 ghost 按钮“重置”（清空所有列筛选）。

### 3.5 订单详情弹窗（`y6t`）

- 打开时 `POST /order/detail {id}`。
- 标题“订单信息”；标题下方：“订单号：{trade_no}” + 状态徽标（官方条件 `!!status`，因此**待支付(0) 不显示徽标**——【建议】新 UI 修正为始终显示）。
- 分区（每行左标签宽 7rem，右值；空值显示“-”）：
  1. **基本信息**：
     - 用户邮箱：链接到 `/user/manage?email={email}`（悬停显示外链图标）
     - 用户手机号：仅当 `user.phone` 存在时显示（【后端】detail 只 select `id,email`，永远不显示）
     - 订单周期：`order.period.{period}`
     - 订阅计划：`plan.name`
     - 回调单号：`callback_no`（等宽；手动标记已支付的为 `manual_operation`）
  2. **金额信息**：支付金额 `TS(total_amount)`（主色）；分隔线；余额支付 `TS(balance_amount)`；优惠金额 `TS(discount_amount)`（绿）；退回金额 `TS(refund_amount)`（红，见 3.2 风险，新 UI 改读 `surplus_credit`）；折抵金额 `TS(surplus_amount)`。
  3. **时间信息**：创建时间、更新时间（`yyyy-MM-dd HH:mm:ss`）。
  4. **佣金信息**（仅当 `commission_status !== undefined && commission_balance` 为真值时显示）：佣金状态徽标；佣金金额 `TS(commission_balance)`（橙）；实际佣金 `TS(actual_commission_balance)`（仅非空时）；若有邀请人：分隔线、邀请人（链接 `/user/manage?email=...`）、邀请人ID。
- 响应 `data` 字段：订单全部列 + `user{id,email}`、`plan{id,name}`、`payment{id,name,payment,enable}|null`、`commission_log`（数组：`{id,invite_user_id,user_id,trade_no,order_amount(分),get_amount(分),created_at,updated_at}`）、`invite_user{id,email}|null`；若 `surplus_order_ids` 非空另有 `surplus_orders`（被折抵订单数组，完整订单列）；`period` 为旧格式。错误：400“订单不存在”。
- 【建议】官方未展示但后端已返回、新 UI 可补充：支付方式 `payment.name`、手续费 `handling_amount`、支付时间 `paid_at`、优惠券 `coupon_id`、`surplus_credit`、`commission_log` 明细、`surplus_orders` 列表。

### 3.6 订单分配弹窗（`f6t`）

- 触发：工具栏“添加订单”。标题“订单分配”。打开时拉取 `GET /plan/fetch` 作为订阅计划下拉。
- 字段：

| key | 控件 | 中文标签 | placeholder | 必填 | 默认 | 前端校验 | 后端校验（`OrderAssign`） | 提交转换 |
|---|---|---|---|---|---|---|---|---|
| `email` | 文本 | 用户邮箱 | 请输入用户邮箱 | 是 | `""` | string min 1 | `required`（“邮箱不能为空”） | 后端 `strtolower(trim())` 精确匹配 |
| `plan_id` | 下拉（套餐 name/id） | 订阅计划 | 请选择订阅计划 | 是 | `0` | number | `required`（“订阅不能为空”） | `parseInt` |
| `period` | 下拉（8 个旧格式值，文案 `order.period.*`：月付、季付、半年付、年付、两年付、三年付、一次性、流量重置包） | 订单周期 | 请选择购买时长 | 是 | `""` | string（官方未限制非空） | `required|in:month_price,quarter_price,half_year_price,year_price,two_year_price,three_year_price,onetime_price,reset_price`（“订阅周期不能为空/格式有误”） | 原样（旧格式） |
| `total_amount` | 数字，后缀“CNY” | 支付金额 | 请输入需要支付的金额 | 是 | `0` | number | `required`（“支付金额不能为空”） | 显示 `value/100`，输入时存 `100*parseFloat(输入)`（分） |

- 提交 `POST /order/assign {email, plan_id, period, total_amount}` → 响应 `data` 为新订单 `trade_no`（字符串）→ refetch、重置、关闭、toast“添加成功”。按钮“取消”/“确认”（通用提交文案）。
- 【后端】逻辑：用户不存在 400“该用户不存在”；套餐不存在 400“该订阅不存在”；用户有待支付或开通中订单（status 0/1）→ 400“该用户还有待支付的订单，无法分配”。创建 **待支付(0)** 订单：`trade_no=Helper::guid()`，`period` 转新格式；类型判定：reset_price→流量重置(4)；用户已有其它套餐→升级(3)；同套餐且未过期→续费(2)；否则新购(1)；计算邀请佣金（`setInvite`）。**不校验该套餐是否有此周期价格、不扣余额、不应用折扣/折抵**。之后需管理员再“标记为已支付”才会开通。
- 【风险】`100*parseFloat("1.1")` = `110.00000000000001`，后端只校验 required，存入 int 列由数据库截断/取整。【建议】新 UI 用 `Math.round(元*100)`，并前端校验 ≥0。

### 3.7 接口明细

| 方法 | 路径 | 请求 | 响应 | 副作用 / 错误 |
|---|---|---|---|---|
| POST/GET | `/order/fetch` | 见 3.2 | paginate | — |
| POST | `/order/detail` | `{id:int}` | `data`=订单（3.5） | 400 订单不存在 |
| POST | `/order/paid` | `{trade_no}` | `true` | 只允许 status=0，否则 400“只能对待支付的订单进行操作”；`OrderService::paid('manual_operation')`：status→1、`paid_at=now`、`callback_no='manual_operation'`，同步执行 `OrderHandleJob` 开通（成功后 status→3）；失败 500“更新失败” |
| POST | `/order/cancel` | `{trade_no}` | `true` | 只允许 status=0；status→2，若用了余额（`balance_amount`）则退回用户余额；失败 400“更新失败” |
| POST | `/order/update` | `{trade_no, commission_status: 0\|1\|3}` | `true` | 只更新 `commission_status`；校验 `commission_status in:0,1,3`（“佣金状态格式不正确”）、`status in:0,1,2,3`（但 status 不会被写入）；订单不存在 400；500“更新失败” |
| POST | `/order/assign` | 见 3.6 | `data`=trade_no | 见 3.6 |
| GET | `/order/getOrder` | — | — | 实为 `StatController::getOrder`（仪表盘统计），不属于订单页 |

佣金流转（`app/Console/Commands/CheckCommission.php`）：开启 `commission_auto_check_enable` 时，已完成且更新超过 3 天、佣金待确认(0) 的订单自动改为发放中(1)；定时任务对发放中(1) 的订单发放佣金并置为有效(2)。所以后台“发放中”=人工批准立即进入发放队列，“无效”=作废佣金。

### 3.8 差异与风险（订单）

1. 【风险】周期筛选：官方把**旧格式**（`month_price`…）发给 `whereIn('period', ...)`，但库里已是新格式（`monthly`…），筛选永远无结果。【建议】新 UI 筛选发送新格式值，显示仍用旧格式→中文映射（或两种都发）。
2. 【风险】URL 预置筛选 `user_id=<id>`（无 `eq:`）会变成 `like %id%`，用户 1 会匹配 10、11、21…。`status`/`commission_status` 数字也走 like。`order_id` 不是 `v2_order` 的列，带它会 SQL 报错（500）。【建议】新 UI 解析 query 时把纯数字转为 `eq:` 形式，`order_id` 映射为 `id`。
3. 【风险】`filter[].id` 与 `sort[].id` 未做白名单，任意列名都会进入 SQL（Laravel 会给标识符加引号，主要风险是 500 报错）。新 UI 只发送已知列。
4. 退回金额字段见 3.2（`surplus_credit`）。
5. “标记为已支付”会立即开通/改写用户套餐，“取消”会退余额，“佣金发放中”会让定时任务打款——官方都没有确认，新 UI 应加确认。
6. 详情弹窗待支付状态不显示徽标（官方 bug）。

---

## 4. 支付配置（Payment）

### 4.1 页面结构

- 路由 `/config/payment`（菜单在“系统管理”下）。标题“支付配置”，描述“在这里可以配置支付方式，包括支付宝、微信等。”
- 主体：支付方式表格（前端分页/筛选/排序）。
- 弹窗：添加/编辑支付方式（同一组件 `JXt`，`type` = add/edit）；删除确认。

### 4.2 数据加载

- `GET /payment/fetch`，query key `paymentList`，返回 `data` 数组（按 `sort ASC`），前端把 `enable` 转 `Boolean`。每项字段：`id, uuid(8 位随机), payment(支付方法键，如 EPay), name, icon, config(对象，**含明文密钥**), notify_domain, handling_fee_fixed(分), handling_fee_percent(decimal 字符串如 "1.50"), enable(bool), sort, created_at, updated_at, notify_url`。
- `notify_url` 由后端拼：`url("/api/v1/guest/payment/notify/{payment}/{uuid}")`；若设置了 `notify_domain`，替换为 `notify_domain + 该 URL 的 path`。

### 4.3 表格列（`pQt`）

| # | 列 | 标题 | 显示 | 排序 |
|---|---|---|---|---|
| 0 | `drag-handle` | — | 把手；非排序模式透明（`opacity-0`），排序模式显示 | 否 |
| 1 | `id` | ID | outline 等宽徽标 | 是（前端） |
| 2 | `enable` | 启用 | Switch → `POST /payment/show {id}`（后端取反）；若响应 `data` 假值则 refetch | 否 |
| 3 | `name` | 显示名称 | 粗体，最大宽 200 截断 | 否 |
| 4 | `payment` | 支付接口 | 文本 | 否 |
| 5 | `notify_url` | 通知地址（表头问号 tooltip“支付网关将会把数据通知到本地址，请通过防火墙放行本地址。”） | URL 截断（最大宽 260）+ 悬停出现复制按钮 → 复制，toast“复制成功” | 否 |
| 6 | `actions` | 操作（固定右侧） | 编辑图标（打开编辑弹窗，默认值=该行完整对象）、删除图标（确认） | 否 |

移动端：主字段 `name`，网格 `payment,enable`。

### 4.4 工具栏（`mQt`）与排序

- 非排序模式左侧：“添加支付方式”按钮；搜索框“搜索支付方式...”（前端过滤 `name`）；有筛选时“重置”按钮。
- 排序模式左侧替换为提示文字“拖拽支付方式进行排序，完成后点击保存”。
- 右侧（md 以上且有数据）：“编辑排序” / “保存排序”。
- 排序模式：显示拖拽列、**隐藏操作列**、每页 99999、隐藏分页；保存时 `POST /payment/sort {ids:[...]}` → refetch → 退出排序模式 → toast“排序保存成功”。退出后每页 10。

### 4.5 删除

- 确认弹窗：标题“删除确认”，描述“确定要删除该支付方式吗？此操作无法撤销。”，按钮“取消”/“确认”。
- `POST /payment/drop {id}` → `data` 真则 refetch（官方无成功 toast；语言包有“删除成功”可用）。
- 【后端】直接删除，不检查是否有订单引用 `payment_id`；历史订单详情的 `payment` 变为 null。

### 4.6 添加/编辑表单（`JXt`）

标题“添加支付方式”/“编辑支付方式”，按钮“取消”/“确认”（通用提交文案）。

默认值（`QXt`）：`{id:null, name:"", icon:"", notify_domain:"", handling_fee_fixed:0, handling_fee_percent:0, payment:"", config:{}}`；编辑时为该行完整对象。

打开弹窗时 `GET /payment/getPaymentMethods` 填充“支付接口”下拉。

| key | 控件 | 中文标签 / placeholder / 说明 | 必填 | 前端校验（zod） | 后端校验 | 提交转换 |
|---|---|---|---|---|---|---|
| `name` | 文本 | 显示名称 / 请输入支付名称 / 用于前端显示 | 是（红星） | string 2–30（“名称至少需要2个字符”“名称不能超过30个字符”） | `required`（“显示名称不能为空”） | — |
| `icon` | 文本 | 图标URL / `https://example.com/icon.svg` / 用于前端显示的图标地址 | 否 | string 可空 | `nullable` | — |
| `notify_domain` | 文本 | 通知域名 / `https://example.com` / 网关通知将发送到该域名 | 否 | 空或匹配 `^https?:\/\/\S+`（“请输入有效的URL”） | `nullable|url`（“自定义通知域名格式有误”） | — |
| `handling_fee_percent` | 数字，后缀 % | 百分比手续费(%) / `0-100` | 否 | coerce number 0–100 可空 | `nullable|numeric|between:0,100`（“百分比手续费范围须在0-100之间”） | — |
| `handling_fee_fixed` | 数字，后缀“元” | 固定手续费 / `0` | 否 | coerce number ≥0 可空 | `nullable|integer`（“固定手续费格式有误”） | 显示 `value?value/100:""`；输入存 `100*parseFloat(输入)`（分） |
| `payment` | 下拉（选项=方法键字符串，显示同值） | 支付接口 / 请选择支付接口 / 选择要使用的支付接口 | 是（红星） | string min1（“请选择支付接口”） | `required`（“网关参数不能为空”） | — |
| `config.*` | 动态（见 4.7） | 分组标题“支付配置” | 视插件 | `record<string,string>` | `config` `required`（“配置参数不能为空”），控制器把它当 `array` 处理 | 对象 |

联动：弹窗打开且 `payment` 有值时（以及 `payment` 改变时），调用 `POST /payment/getPaymentForm {payment, id?}`（编辑时带 `id`）；把返回的字段描述存为动态表单 schema，并用每个字段的 `value` 生成 `config` 初值（`json/yaml` 类型的非字符串值 `JSON.stringify(v,null,2)`）。接口失败时清空动态字段。

提交 `POST /payment/save`，body = 整个表单对象（编辑时含该行所有字段，如 `uuid/enable/sort/notify_url/created_at`，后端只取校验过的键）→ `data` 真：toast“保存成功”、重置、refetch、关闭。

### 4.7 动态配置表单（`getPaymentForm` 返回格式与渲染）

后端 `PaymentService::form()` 把插件 `form()` 的每个字段规整为：
```json
{ "<field_key>": { "type": "string|text|number|percentage|select|boolean|json|yaml|password|...",
                   "label": "", "placeholder": "", "description": "",
                   "value": "<当前配置值 ?? 字段 default ?? ''>",
                   "options": "<select_options ?? options ?? []>" } }
```
注意：插件字段里的 `required` **不会**透传（官方渲染的必填星号因此永远不出现）。

请求参数：`payment`（必填，方法键）、`id`（可选，编辑时取已存配置作为 value）、`safe`（**本 fork 新增**，bool，为真时 `type=password` 字段的 `value` 置空并加 `sensitive:true`）。官方 UI **不发** `safe`。方法不存在/插件未启用 → 400“支付方式不存在或未启用”。

官方渲染（`IYt`，`namePrefix="config"`，单列网格）：

| type | 控件 | 规则 |
|---|---|---|
| `string` | 单行输入 | 标签 = `label || description`；有 label 时 description 作说明文字 |
| `number` / `percentage` | 数字输入（percentage 后缀 %） | 输入值 `Number()`；percentage 夹到 0–100 |
| `select` | 下拉 | 选项来自 `options`，按 `[{value,label}]` 读取 |
| `boolean` | 带边框的 Switch 行 | |
| `text` | 多行文本（min-h 80px） | |
| `json` / `yaml` | Monaco 编辑器（高 150px 可拖拽调整），json 粘贴/输入自动格式化 | |
| 其它（含 `password`） | **不渲染** | |

内置支付插件（`plugins-core`，方法键 → 字段，全部是 `string`/`text`）：
- `AlipayF2F`（支付宝当面付）、`BTCPay`、`Coinbase`、`CoinPayments`、`EPay`（易支付：`url` 支付网关地址、`pid` 商户ID、`key` 通信密钥、`type` 支付类型）、`MGate`。`getPaymentMethods` 只返回**已启用**插件注册的方法键（`available_payment_methods` 过滤器的键）。

【建议】新 UI 动态表单：
- 支持 `password` 类型（掩码输入）；编辑时请求 `getPaymentForm` 带 `safe:1`，密码字段留空表示“保持不变”（后端 `preserveEmptyPasswordConfig` 会保留旧值），placeholder 提示“留空保持不变”。
- `options` 同时兼容 `[{value,label}]` 与 `{value: label}` 对象两种写法。
- `config` 值按字段类型保留原类型（官方 zod 要求全为字符串，number/boolean 字段会让表单校验失败）。

### 4.8 接口明细

| 方法 | 路径 | 请求 | 响应 data | 副作用 / 错误 |
|---|---|---|---|---|
| GET | `/payment/fetch` | 无 | 数组（4.2） | — |
| GET | `/payment/getPaymentMethods` | 无 | `string[]` 方法键 | 会初始化已启用插件 |
| POST | `/payment/getPaymentForm` | `{payment:string, id?:int, safe?:bool}` | 字段描述对象（4.7） | 400“支付方式不存在或未启用” |
| POST | `/payment/save` | `{id?, name, icon?, payment, config:object, notify_domain?, handling_fee_fixed?:int(分), handling_fee_percent?:number}` | `true` | 前置：站点配置 `app_url` 未设置 → 400“请在站点配置中配置站点地址”；新建自动生成 `uuid`（8 位，`enable` 默认 false，即**新建后默认停用**）；编辑时空字符串的 password 字段保留原值；400202“支付方式不存在”；500“保存失败” |
| POST | `/payment/drop` | `{id}` | `true` | 直接删除 |
| POST | `/payment/show` | `{id}` | `true` | `enable` 取反 |
| POST | `/payment/sort` | `{ids:int[]}` | `true` | `sort=index+1`；`ids` 必填数组（422“参数有误”）；500“保存失败” |

### 4.9 差异与风险（支付）

1. 【风险·安全】`/payment/fetch` 用 `makeVisible('config')` 返回所有网关的**明文密钥**；`safe` 模式只作用于 `getPaymentForm`。新 UI 列表不要展示/缓存 `config`；是否让后端 fetch 隐去 config 需另行评估（官方 UI 编辑时并不依赖 fetch 的 config，而是重新调用 getPaymentForm）。
2. 【风险】`handling_fee_fixed` 官方 `100*parseFloat` 会产生浮点（如 1.1→110.00000000000001），后端 `integer` 校验失败返回 422。新 UI 用 `Math.round`。
3. 【风险】编辑一个其插件已被停用的支付方式时，`preserveEmptyPasswordConfig` 内 `new PaymentService()` 抛 `ApiException`；其 `catch (Exception $e)` 未导入命名空间，捕获不到，异常冒泡到外层 `catch(\Exception)` → 500“保存失败”。
4. 新建支付方式默认 `enable=false`，需在列表打开开关。
5. 修改 `payment`（换插件）会改变 `notify_url` 路径；修改 `notify_domain` 也会改变回调地址，需同步到支付网关后台。
6. 删除支付方式不做引用检查。

---

## 5. 优惠券管理（Coupon）

### 5.1 页面结构

- 路由 `/finance/coupon`。标题“优惠券管理”，描述“在这里可以查看优惠券，包括增加、查看、删除等操作。”
- 主体：优惠券表格（**后端分页/筛选/排序**）。
- 弹窗：添加优惠券（工具栏）、编辑优惠券（行操作，同一组件 `I6t`）；删除确认。

### 5.2 数据加载

- `POST /coupon/fetch`（路由 any），query key `["couponList", pagination, filters, sorting]`。
- 请求：`{pageSize, current, filter:[{id,value}], sort:[{id,desc}]}`，初始 `pageSize=20`。
- 后端过滤（`CouponController::applyFiltersAndSorts`）：数组 → `whereIn`；否则 `like %value%`（**不支持** `eq:` 等操作符）。排序 `orderBy(id, desc?DESC:ASC)` 后再 `orderBy('created_at','desc')`。
- 响应 paginate；每项：`id, code, name, type, value, show(bool), limit_use(int|null), limit_use_with_user(int|null), limit_plan_ids(int[]|null), limit_period(新格式 string[]，库里为 null 时访问器返回 [])`, `started_at, ended_at, created_at, updated_at`。

### 5.3 表格列（`P6t`）

| # | accessorKey | 标题 | 显示 | 后端排序 |
|---|---|---|---|---|
| 1 | `id` | ID | 默认徽标 | 是 |
| 2 | `show` | 启用 | Switch → `POST /coupon/update {id, show:bool}`；响应 `data` 假值则 refetch（后端成功时返回空 body，所以官方总会 refetch） | 否 |
| 3 | `name` | 卷名称 | 文本（宽列） | 否 |
| 4 | `type` | 类型 | outline 徽标“按金额优惠”/“按比例优惠” | 是 |
| 5 | `code` | 卷码 | secondary 徽标 | 是 |
| 6 | `limit_use` | 剩余次数 | outline 徽标；`null` 显示“无限次” | 是 |
| 7 | `limit_use_with_user` | 可用次数/用户 | outline 徽标；`null` 显示“无限制” | 是 |
| 8 | `#`（validity） | 有效期 | 折叠块：左侧状态徽标 + `MM/dd HH:mm -> MM/dd HH:mm` + 展开箭头；展开后显示“开始时间 yyyy/MM/dd HH:mm”“结束时间 yyyy/MM/dd HH:mm” | 否 |
| 9 | `actions` | 操作（固定右侧） | 编辑图标、删除图标 | 否 |

有效期状态（`now` 毫秒，`start=started_at*1000`，`end=ended_at*1000`）：
- `now > end`：红色“已过期{{days}}天”，`days = |ceil((end-now)/86400000)|`
- `now < start`：黄色“{{days}}天后开始”，`days = |ceil((start-now)/86400000)|`
- 否则：绿色“剩余{{days}}天”，`days = ceil((end-now)/86400000)`

【风险】官方列表**没有显示优惠值 `value`**；`limit_use` 列标题叫“剩余次数”，实际是“最大使用次数”字段（使用后由下单流程递减）。【建议】新 UI 增加“优惠值”列：type=1 显示 `¥(value/100)`，type=2 显示 `value%`。

移动端：主字段 `name`，网格 `code,type,limit_use`。

### 5.4 工具栏（`R6t`）

- 左：“添加优惠券”按钮；搜索框“搜索优惠券...”→ 列筛选 `name`（后端 like）。
- 右：多选“类型”（按金额优惠=1、按比例优惠=2，后端 whereIn）；有筛选时“重置”。

### 5.5 删除

- 确认弹窗：标题“确认删除”，描述“此操作将永久删除该优惠券，删除后无法恢复。确定要继续吗？”，确认“删除”（destructive）。
- `POST /coupon/drop {id}` → `data` 真则 toast“删除成功”、refetch。错误：422（id 必填/数字）、400“优惠券不存在”、500“删除失败”。

### 5.6 添加/编辑表单（`I6t`）

标题“添加优惠券”/“编辑优惠券”；描述“创建或编辑优惠券，支持金额、百分比优惠及多种限制。”；弹窗加宽（max-w-2xl）；挂载时拉取 `GET /plan/fetch` 作为“指定订阅”选项。

默认值（`T6t`，新建）：
```json
{ "name": "", "code": null, "type": 1, "value": 0,
  "started_at": <now 秒>, "ended_at": <now 秒 + 604800>,
  "limit_use": null, "limit_use_with_user": null,
  "limit_plan_ids": [], "limit_period": [], "generate_count": null }
```
编辑：默认值 = 行对象（含 `id/show/created_at/updated_at` 等）。

字段（自上而下）：

| key | 控件 | 中文标签 / placeholder / 说明 | 显示条件 | 必填 | 前端校验 | 后端校验（`CouponGenerate`） | 提交转换 |
|---|---|---|---|---|---|---|---|
| `name` | 文本 | 优惠券名称 / 请输入优惠券名称 | 总是 | 是 | min1“请输入优惠券名称” | `required`“名称不能为空” | — |
| `generate_count` | 数字 | 批量生成数量 / 批量生成优惠码数量，留空则生成单个 / 批量生成多个优惠码，留空则只生成单个优惠码 | **仅新建** | 否 | coerce number 可空 | `nullable|integer|max:500`（“生成数量必须为数字”“生成数量最大为500个”） | 数字 |
| `code` | 文本 | 自定义优惠码 / 自定义优惠码，留空则自动生成 / 可以自定义优惠码，留空则系统自动生成 | `generate_count` 为空/0 时 | 否 | string 可空 | 无规则（`''`，原样进入 validated） | 空 → 后端 `Helper::randomChar(8)` |
| `type` + `value` | 组合控件：左下拉（按金额优惠/按比例优惠）+ 中数字输入（step any，min 0）+ 右后缀（type=1 显示“¥”，type=2 显示“%”） | 优惠券类型和值 / 下拉 placeholder“优惠券类型”/ 输入 placeholder“请输入值” | 总是 | 是 | `type`、`value` coerce number | `type required|in:1,2`（“类型不能为空/格式有误”）；`value required|integer`（“金额或比例不能为空/格式有误”） | type=1：显示 `value/100`，输入存 `Math.round(100*输入)`；type=2：显示/存原值（`parseFloat`）；切换类型时若 value 非 0：金额→比例 `value/100`，比例→金额 `value*100`；输入清空时存 `""` |
| `started_at` / `ended_at` | 日期范围弹出层 | 优惠券有效期 | 总是 | 是 | coerce number；`ended_at > started_at`（“结束时间必须晚于开始时间”，错误挂在 ended_at） | 均 `required|integer` | 秒 |
| `limit_use` | 数字 | 最大使用次数 / 限制最大使用次数，留空则不限制 / 设置优惠券的总使用次数限制，留空表示不限制使用次数 | 总是 | 否 | string\|number 可空 | `nullable|integer`（“最大使用次数格式有误”） | 空串→null |
| `limit_use_with_user` | 数字 | 每个用户可使用次数 / 限制每个用户可使用次数，留空则不限制 / 限制每个用户可使用该优惠券的次数，留空表示不限制单用户使用次数 | 总是 | 否 | 同上 | `nullable|integer`（“限制用户使用次数格式有误”） | 同上 |
| `limit_period` | 多选（可搜索） | 指定周期 / 限制指定周期可以使用优惠，留空则不限制 / 选择可以使用优惠券的订阅周期，留空表示不限制使用周期；无匹配“没有找到匹配的周期” | 总是 | 否 | 新格式枚举数组 | `nullable|array`（“指定周期格式有误”） | 选项显示 `coupon.period.*`（月、季度、半年、年、两年、三年、一次性、重置流量），值为新格式 `monthly…reset_traffic` |
| `limit_plan_ids` | 多选（可搜索） | 指定订阅 / 限制指定订阅可以使用优惠，留空则不限制 / 选择可以使用优惠券的订阅计划，留空表示不限制计划；无匹配“没有找到匹配的订阅” | 总是 | 否 | number[] | `nullable|array`（“指定订阅格式有误”） | 套餐 id 数组（Number） |

有效期弹出层：
- 触发按钮显示 `yyyy-MM-dd HH:mm:ss - yyyy-MM-dd HH:mm:ss`。
- 顶部“快速设置”：1周(7天)、2周(14)、1个月(30)、3个月(90)、6个月(180)、1年(365)——点击设 `started_at=now`、`ended_at=now+天数*86400`。
- 中部（sm 以上）：双月范围日历；选日期时保留原时分秒。
- 底部：两个 `datetime-local`（step 1 秒）输入，“开始时间” TO “结束时间”。

提交：
- `POST /coupon/generate`，body = zod 解析后的完整表单（编辑时含 `id`）。
- 若 `generate_count` 有值且响应是字符串（CSV 文本）：生成 Blob `text/csv;charset=utf-8;` 下载为 `coupons_<毫秒时间戳>.csv`。
- 之后关闭弹窗；新建模式重置为默认值；refetch。**官方无成功 toast**（失败由拦截器 toast；语言包有“保存优惠券失败”未使用）。

### 5.7 接口明细

| 方法 | 路径 | 请求 | 响应 | 副作用 / 错误 |
|---|---|---|---|---|
| POST/GET | `/coupon/fetch` | 见 5.2 | paginate | — |
| POST | `/coupon/generate`（单个新建） | 无 `generate_count`（或为 0/null），无 `id` | `{status:success,data:true}` | `Coupon::create(validated)`；未提供 code 时随机 8 位；**`show` 取 DB 默认 0，即新建单券默认停用**；500“创建失败” |
| POST | `/coupon/generate`（编辑） | 带 `id`，无 `generate_count` | `data:true` | `Coupon::find(id)->update(validated)`；id 不存在时 null->update 为 PHP Error（500）；500“保存失败” |
| POST | `/coupon/generate`（批量） | `generate_count` 1–500 | **CSV 纯文本**（HTTP 200，非 JSON，由 `echo` 输出） | 批量 `insert`，`show=1`（**批量券默认启用**），每张 `code=randomChar(8)`，`limit_plan_ids/limit_period` json_encode；CSV 表头 `名称,类型,金额或比例,开始时间,结束时间,可用次数,可用于订阅,券码,生成时间`，类型列“金额/比例”，金额列 type=1 为 `value/100`，`limit_use` 空为“不限制”，订阅列为 id 用 `/` 连接或“不限制”，时间 `Y-m-d H:i:s`，行尾 `\r\n`，无 BOM；失败 500“生成失败”。注意批量时即使带了 `id` 也走新建 |
| POST | `/coupon/update` | `{id:numeric, show?:bool}` | **空 body**（HTTP 200） | 只更新 `show`；`id` 必填数字（422“优惠券ID不能为空/必须为数字”）；不存在或失败 → 500“保存失败” |
| POST | `/coupon/drop` | `{id}` | `data:true` | 见 5.5 |
| POST | `/coupon/show` | `{id}` | `data:true` | `show` 取反。**官方 UI 未使用**（用 update 代替） |

### 5.8 差异与风险（优惠券）

1. 【风险】单个新建默认停用、批量生成默认启用，行为不一致；官方 UI 无提示。【建议】新 UI 新建成功后提示“当前未启用”或在表单加“启用”开关（创建后再调 `/coupon/update`）。
2. 【风险】`/coupon/update` 成功返回空 body，新 UI 的请求层要把“HTTP 200 + 空 body”当作成功。
3. 【风险】比例券 `value` 必须整数，官方允许输入小数（如 12.5）会 422。新 UI 对 type=2 限制整数 1–100。
4. 【风险】`code` 无唯一性校验，自定义券码可能重复；后端不校验 `ended_at > started_at`。
5. 批量 CSV 无 UTF-8 BOM，Excel 直接打开中文可能乱码；【建议】新 UI 下载时在 Blob 前加 `﻿`。
6. 生成数量上限 500（后端）；官方前端未限制。
7. `limit_period` 编辑回显依赖新格式值；历史数据若存旧格式，访问器会转换为新格式。`limit_plan_ids` 若历史存为字符串数组，官方回显匹配不到（`includes(number)`），新 UI 比较时统一转 Number。

---

## 6. 礼品卡管理（Gift Card）

### 6.1 页面结构

- 路由 `/finance/gift-card`。标题“礼品卡管理”，描述“在这里可以管理礼品卡模板、兑换码和使用记录等功能。”
- 4 个等宽 Tab（默认 `templates`）：

| Tab 值 | 标签 | 小标题 | 说明 | 组件 |
|---|---|---|---|---|
| `templates` | 模板管理 | 模板管理 | 管理礼品卡模板，包括创建、编辑和删除模板。 | `Y6t` |
| `codes` | 兑换码管理 | 兑换码管理 | 管理礼品卡兑换码，包括生成、查看和导出兑换码。 | `t8t` |
| `usages` | 使用记录 | 使用记录 | 查看礼品卡的使用记录和详细信息。 | `i8t` |
| `statistics` | 统计数据 | 统计数据 | 查看礼品卡的统计数据和使用情况分析。 | `r8t` |

### 6.2 模板管理 Tab

#### 6.2.1 加载

- `POST /gift-card/templates`，body `{per_page, page, filter:[...], sort:[...]}`，初始 `per_page=20`。query key `["giftCardTemplates", pagination, filters, sorting]`。
- 【后端】只认 `type`（1–10）、`status`（0/1）、`page`、`per_page`（1–1000，默认 15）；**忽略 `filter`/`sort`**；固定 `orderBy sort asc, created_at desc`。
- 响应 paginate。【风险】控制器里构造的增强数据（`type_name`、`codes_count`、`used_count`）被丢弃，实际返回原始模型：`id, name, description, type, status(bool), conditions, rewards, limits, special_config, icon, background_image, theme_color, sort, admin_id, created_at, updated_at`。

#### 6.2.2 表格列（`U6t`）

| # | accessorKey | 标题 | 显示 | 排序标记 |
|---|---|---|---|---|
| 1 | `id` | ID | 徽标 | 可点（但后端忽略） |
| 2 | `status` | 状态 | 受控 Switch（请求中禁用）→ `POST /gift-card/update-template {id, status:bool}`；`data` 真：toast“模板更新成功”+refetch；否则/异常 toast“更新模板失败” | 否 |
| 3 | `name` | 名称 | 文本 | 否 |
| 4 | `type` | 类型 | outline 徽标 `giftCard.types.{type}` | 可点 |
| 5 | `rewards` | 奖励内容 | 奖励摘要（见下） | 否 |
| 6 | `sort` | 排序 | secondary 徽标 | 可点 |
| 7 | `created_at` | 创建时间 | `yyyy-MM-dd HH:mm:ss` | 可点 |
| 8 | `actions` | 操作 | outline 小按钮“编辑”（图标+文字）、“删除”（确认） | 否 |

奖励摘要（每项一个 outline 徽标，纵向排列；都没有时 secondary 徽标“无奖励”）：
- `rewards.balance` 真 → `余额: {balance/100} 元`
- `rewards.transfer_enable` 真 → `流量: {RS(transfer_enable)}`
- `rewards.expire_days` 真 → `有效期: {n}天`
- `rewards.device_limit` 真 → `设备数: {n}`
- type=2 且 `plan_id` → `套餐: {plan_id}`（官方显示 id，【建议】显示套餐名）
- type=2 且 `plan_validity_days` → `套餐有效期: {n}天`
- type=3 且 `random_rewards` 非空 → `盲盒礼品卡`

#### 6.2.3 工具栏（`Z6t`）

- 左：搜索框“搜索礼品卡...”（写入 `name` 列筛选）；多选“类型”（选项值 "1"–"10"，文案 `types.1..10`，5–10 语言包缺失会显示 key）；多选“状态”（“已启用”="true"、“已禁用”="false"）；有筛选时“重置”。【风险】这些筛选随 `filter` 发给后端但**全部被忽略**。
- 右：“添加模板”按钮；“显示列”列显隐菜单。

#### 6.2.4 删除

- 确认弹窗：标题“确认删除”，描述“此操作将永久删除该模板，确定要继续吗？”，确认“删除”。
- `POST /gift-card/delete-template {id}` → 成功 toast“模板删除成功”+refetch；失败 toast“删除模板失败”。
- 【后端】`id` 必须存在（422）；模板下存在任何兑换码 → 400“该模板下存在兑换码，无法删除”；500“删除失败”。

#### 6.2.5 添加/编辑模板表单（`q6t`）

标题“添加模板”/“编辑模板”；打开时拉取 `GET /plan/fetch`（失败 toast “Failed to load plan list”）。表单分 6 个卡片区块：

新建默认值：
```json
{ "name": "", "description": "", "type": 1, "status": true, "sort": 0, "icon": "", "background_image": "",
  "conditions": {}, "limits": {}, "rewards": { "random_rewards": [] }, "special_config": {} }
```
编辑回填：`conditions/limits/special_config` 为对象才回填（数组视为 `{}`）；`limits.invite_reward_rate` 假值转 `undefined`；`rewards.balance` ÷100（元）；`rewards.transfer_enable` ÷1024³（GB）；`random_rewards[*]` 同样换算（只回填 `weight,balance,transfer_enable,expire_days,device_limit`）；`rewards` 其它键回填 `expire_days,device_limit,reset_package,plan_id,plan_validity_days`。

**区块 1：基础配置**（“基础配置”）

| key | 控件 | 标签 / placeholder | 校验（前端 zod `$6t`） | 后端 |
|---|---|---|---|---|
| `name` | 文本 | 模板名称 / 请输入模板名称 | min1“请输入模板名称” | `required|string|max:255`（“礼品卡名称不能为空”） |
| `type` | 下拉：1 通用礼品卡、2 套餐礼品卡、3 盲盒礼品卡 | 类型 / 请选择礼品卡类型 | coerce number 1–4 | `required|integer|in:1,2,3`（“礼品卡类型不能为空”“无效的礼品卡类型”） |
| `description` | 多行文本 | 描述 / 请输入礼品卡描述 | 可选 | `nullable|string` |
| `sort` | 数字 | 排序 / “0” | coerce number ≥0 | `integer|min:0` |
| `status` | Switch（虚线框） | 状态；说明“禁用后，此模板将无法生成或兑换新的礼品卡。” | boolean | `boolean` |

**区块 2：奖励内容**（“奖励内容”）——按 `type` 条件显示：
- type=1（通用）：
  - `rewards.balance` 数字，后缀 ¥，标签“奖励余额 (元)”，placeholder“请输入奖励的金额(元)”
  - `rewards.transfer_enable` 数字，后缀 GB，“奖励流量 (GB)”，“请输入奖励的流量(GB)”
  - `rewards.expire_days` 数字，后缀“天”，“延长有效期 (天)”，“请输入延长的天数”
  - `rewards.device_limit` 数字，“增加设备数”，“请输入增加的设备数量”
  - `rewards.reset_package` Switch，“重置当月流量”，说明“开启后，兑换时会将用户当前套餐的已用流量清零。”
- type=2（套餐）：
  - `rewards.plan_id` 下拉（套餐 name/id，`parseInt`），“指定套餐”，“请选择一个套餐”
  - `rewards.plan_validity_days` 数字，后缀“天”，“套餐有效期 (天)”，“留空则使用套餐默认有效期”
- type=3（盲盒）：
  - 标签“随机奖励池”，右侧按钮“添加随机奖励项”→ 追加 `{weight:10, balance:undefined, transfer_enable:undefined, expire_days:undefined, device_limit:undefined}`
  - 每项一行（序号 `#n`）：`weight`“权重”、`balance`“奖励余额 (元)” ¥、`transfer_enable`“奖励流量 (GB)” GB、`expire_days`“延长有效期 (天)” 后缀 d、删除按钮。（`device_limit` 在 schema 中但官方没有输入框）
- type=4：显示说明“任务礼品卡的具体奖励将在任务系统中配置。”（下拉不提供 4）

**区块 3：使用条件**（“使用条件”）
- `conditions.new_user_max_days` 数字，后缀“天”，“新用户注册天数限制”，“例如: 7 (仅限注册7天内的用户)”
- 三个 Switch：`conditions.new_user_only`“仅限新用户”、`conditions.paid_user_only`“仅限付费用户”、`conditions.require_invite`“需要邀请关系”
- `conditions.allowed_plans` 多选套餐（int[]），“允许的套餐”，“选择允许兑换的套餐 (留空则不限制)”；回显未知 id 显示 `ID: {id}`
- `conditions.disallowed_plans` 多选套餐，“禁止的套餐”，“选择禁止兑换的套餐 (留空则不限制)”

**区块 4：使用限制**（“使用限制”）
- `limits.max_use_per_user` 数字，“单用户最大使用次数”，“留空则不限制”
- `limits.cooldown_hours` 数字，后缀 h，“同类卡冷却时间(小时)”，“留空则不限制”
- `limits.invite_reward_rate` 数字，后缀 %，“邀请人奖励比例”，“例如: 0.2 (代表20%)”，说明“使用者有邀请人时，给邀请人的奖励 = 余额奖励 * 此比例”

**区块 5：特殊配置**（“特殊配置”）
- `special_config.start_time` 单日期选择（显示 `PPP` 格式；值=所选日期本地 0 点的 Unix 秒），“活动开始时间”，“请选择开始日期”
- `special_config.end_time` 同上，“活动结束时间”，“请选择结束日期”
- `special_config.festival_bonus` 数字，后缀 x，“节日奖励乘数”，“例如: 1.5 (代表1.5倍)”

**区块 6：显示效果**（“显示效果”）
- `icon` 文本，“图标”，“请输入图标的URL”（后端 `nullable|string|max:255`）
- `background_image` 文本，“背景图片”，“请输入背景图片的URL”（后端 `nullable|string|url|max:255`，“背景图片必须是有效的URL”）
- `theme_color` **官方无输入框**（后端 `nullable|regex:/^#[0-9A-Fa-f]{6}$/`，新建缺省 `#1890ff`，语言包有“主题颜色”）

前端 zod 中所有数值字段为 `z.coerce.number().optional()`：清空输入框会变成 `0` 提交。

提交转换（`q6t` onSubmit）：
1. 深拷贝（`JSON.parse(JSON.stringify())`，去掉 `undefined`）。
2. `rewards.balance` 若为数字 → `Math.round(balance*100)`（分）；`rewards.transfer_enable` 若为数字 → `Math.round(GB*1024*1024*1024)`（字节）；`random_rewards[*]` 的 `balance`、`transfer_enable` 同样换算。
3. `conditions/limits/rewards/special_config` 缺省补 `{}`。
4. 编辑：`POST /gift-card/update-template {id, ...全部字段}` → toast“模板更新成功”；新建：`POST /gift-card/create-template {...}` → 响应真值时 toast“模板创建成功”。随后 refetch、关闭。
5. 校验失败 toast“请检查表单输入是否正确”；接口 422 时官方尝试把 `errors` 映射到字段（因拦截器 reject 的是 body，`K0t.response` 不存在，实际映射不生效，只有拦截器 toast）。

#### 6.2.6 后端奖励语义（`GiftCardTemplate` / `GiftCardService`）

| 键 | 单位 | 生效逻辑 |
|---|---|---|
| `rewards.balance` | 分 | `addBalance` |
| `rewards.transfer_enable` | 字节 | 加到 `user.transfer_enable` |
| `rewards.device_limit` | 个 | 加到 `user.device_limit` |
| `rewards.expire_days` | 天 | 延长订阅（在 `plan_id` 分支之外） |
| `rewards.reset_package` | bool | 重置当月流量 |
| `rewards.plan_id` / `plan_validity_days` | id / 天 | 开通指定套餐（天数 0/缺省=套餐默认） |
| `rewards.random_rewards[]` | `{weight, ...奖励键}` | 仅 type=3：按权重随机抽一项**合并**进基础奖励 |
| `rewards.invite_reward_rate` | 比例（0.2=20%） | **后端从 rewards 读取**：存在且用户有邀请人时，邀请人获得 `balance*rate`、`transfer_enable*rate` |
| `conditions.new_user_only` + `new_user_max_days`(默认 7) | — | 注册超过 N 天不可兑换 |
| `conditions.paid_user_only` | — | 无已完成订单不可兑换 |
| `conditions.allowed_plans` | int[] | 用户当前套餐不在列表不可兑换（用户无套餐时不检查） |
| `conditions.require_invite` | — | 无邀请人不可兑换 |
| `conditions.disallowed_plans` | — | **后端未实现** |
| `limits.max_use_per_user` | 次 | 同模板每用户兑换上限 |
| `limits.cooldown_hours` | 小时 | 同模板两次兑换间隔 |
| `special_config.festival_bonus` + `start_time` + `end_time` | 倍率 / 秒 | 时间窗内且倍率>1 时，所有数值奖励 `intval(v*bonus)` |
| type=1 通用 | — | 含流量/天数/重置包奖励时要求用户已有套餐 |
| type=2 套餐 | — | 要求用户当前**没有**有效订阅 |

### 6.3 兑换码管理 Tab

#### 6.3.1 加载

- `POST /gift-card/codes`，body `{per_page, page, filter, sort}`，初始 20。
- 【后端】只认 `template_id`、`batch_id`、`status`(0–3)、`page`、`per_page`(1–500，默认 15)；**忽略 filter/sort**；`orderBy created_at desc`。
- 响应 paginate。【风险】控制器构造的精简数据（`template_name`、`status_name`、脱敏 `user_email`）被丢弃，实际返回原始模型 + 关联：`id, template_id, code, batch_id, status, user_id, used_at, expires_at, actual_rewards, usage_count, max_usage, metadata, created_at, updated_at, template{完整模板}, user{完整用户，仅隐藏 password}|null`。

#### 6.3.2 表格列（`e8t`）

| # | accessorKey | 标题 | 显示 |
|---|---|---|---|
| 1 | `id` | ID | 徽标 |
| 2 | `code` | 兑换码 | secondary 徽标 + 复制按钮（toast“复制成功”） |
| 3 | `template_name` | 模板名称 | 纯文本——【风险】后端不返回该字段，官方此列恒为空。【建议】新 UI 取 `template.name` |
| 4 | `status` | 状态 | 徽标：1→secondary、2/3→destructive、其它→default；文案见 §0.5（新 UI 用后端正确映射）；当 status=0 或 3 时右侧 Switch（checked = status≠3），切换调用 `POST /gift-card/toggle-code {id, action:"enable"|"disable"}` → 成功 toast“兑换码状态更新成功”+refetch，失败 toast“兑换码状态更新失败” |
| 5 | `expires_at` | 过期时间 | `yyyy-MM-dd HH:mm:ss`；null 显示空（【建议】显示“长期有效”） |
| 6 | `usage_count` | 已用次数 | outline 徽标 |
| 7 | `max_usage` | 可用次数 | outline 徽标 |
| 8 | `created_at` | 创建时间 | `yyyy-MM-dd HH:mm:ss` |

无行操作列（更新/删除兑换码官方未实现）。

#### 6.3.3 工具栏（`J6t`）

- 左：搜索框“搜索礼品卡...”（写入 `code` 列筛选，后端忽略）；多选“状态”（选项来自语言包 `code.status`，值 "0"–"3"，后端忽略）；“重置”。
- 右：“生成兑换码”按钮；“导出”按钮（**禁用**，未实现）；“显示列”。

#### 6.3.4 生成兑换码弹窗（`Q6t`）

标题“生成兑换码”。打开时 `POST /gift-card/templates {per_page:1000, page:1}` 作为模板下拉。

默认值：`{count:10, prefix:"", expires_hours:720, max_usage:1, download_csv:false}`（`template_id` 无默认）。

| key | 控件 | 标签 | 必填 | 前端校验 | 后端校验 | 说明 |
|---|---|---|---|---|---|---|
| `template_id` | 下拉（模板 name/id，`parseInt`） | 选择模板（placeholder“请选择一个模板来生成兑换码”） | 是 | number ≥1“请选择一个模板” | `required|integer|exists`（“请选择礼品卡模板”）；模板 `status=false` → 400“模板已被禁用” | |
| `count` | 数字（`parseInt||0`） | 生成数量 | 是 | 1–10000（“生成数量必须大于0”“单次最多生成10000个”） | `required|integer|min:1|max:10000`（“请指定生成数量”“单次最多生成10000个兑换码”） | |
| `prefix` | 文本 | 自定义前缀 (可选) | 否 | string | `nullable|string|max:10|regex:/^[A-Z0-9]*$/`（“前缀只能包含大写字母和数字”） | 空 → 后端默认 `GC`；码 = 前缀 + 12 位大写十六进制 |
| `expires_hours` | 数字，后缀 H | 有效期 (小时) | 是 | ≥1“有效期必须大于0” | `nullable|integer|min:1` | `expires_at = now + h*3600`；后端允许不传=永久，官方不允许 |
| `max_usage` | 数字 | 最大使用次数 | 是 | ≥1“最大使用次数必须大于0” | `integer|min:1|max:1000`，缺省 1 | |
| `download_csv` | Switch（边框行） | 导出CSV | 否 | boolean | 真值 → 返回 CSV 流 | |

提交：
- `download_csv=false`：`POST /gift-card/generate-codes` → 响应 `data={batch_id, count, message:"生成成功"}` → toast“兑换码生成成功”、refetch、关闭、重置。
- `download_csv=true`：同接口但 `responseType:"blob"` → 下载 `gift_codes_<毫秒时间戳>.csv` → 同样 toast/refetch/关闭/重置。后端 CSV（`fputcsv`，文件名 `gift_codes.csv`）列：`兑换码,前缀,有效期(Y-m-d H:i:s 或“长期有效”),最大使用次数,批次号,创建时间,模板名称,模板类型(数字),模板奖励(JSON),状态(中文),使用者(user_id),使用时间,备注`（“前缀”“备注”字段模型中不存在，恒为空）。
- 失败：500“生成失败”；blob 模式下错误体是 Blob，拦截器拿不到 message。

### 6.4 使用记录 Tab（`i8t`）

- `POST /gift-card/usages`，body `{per_page, page, filter, sort}`，初始 20。【后端】只认 `template_id`、`user_id`（需存在于 v2_user）、`page`、`per_page`(≤500)；忽略 filter/sort；`created_at desc`。
- 响应 paginate，`data` 为**已转换**数组：`{id, code, template_name, user_email(完整), invite_user_email(脱敏 "abc***@***"|null), rewards_given(对象), invite_rewards(对象|null), multiplier_applied(float), created_at}`。
- 列：ID（徽标）、兑换码（secondary 徽标）、用户邮箱、模板名称、使用时间（`yyyy-MM-dd HH:mm:ss`）。
- 顶部搜索框 placeholder“搜索用户邮箱...”（写入 `user_email` 筛选，后端忽略）。
- 无分页外的操作。语言包还有“获得奖励/邀请奖励/倍数加成/IP地址/操作/查看详情”，官方未渲染。【建议】新 UI 增加奖励摘要列与详情抽屉（`rewards_given`、`invite_rewards`、`multiplier_applied`）。注意 `ip_address` 后端未写入（`createRecord` 中被注释）。

### 6.5 统计数据 Tab（`r8t`）

- `POST /gift-card/statistics {}`（官方不传日期）。query key `giftCardStats`。
- 显示 4 张卡片（加载中骨架）：模板总数 `total_stats.templates_count`、活跃模板数 `active_templates_count`、兑换码总数 `codes_count`、已使用兑换码 `used_codes_count`（空值显示 0）。
- 后端完整响应：
  ```json
  { "total_stats": { "templates_count": 0, "active_templates_count": 0, "codes_count": 0, "used_codes_count": 0, "usages_count": 0 },
    "daily_usages": [ { "date": "2026-10-01", "count": 3 } ],
    "type_stats": [ { "template_name": "...", "type_name": "通用礼品卡", "count": 5 } ] }
  ```
  参数 `start_date`/`end_date`（`Y-m-d`，默认近 30 天）只影响 `daily_usages`。
- 【建议】语言包已有“使用记录数”“每日使用量/使用量趋势图”“类型统计/类型分布图”“日期范围/开始日期/结束日期”，新 UI 可补第 5 张卡片、日期范围选择、折线图与分布图。

### 6.6 接口明细

| 方法 | 路径 | 请求 | 响应 | 副作用 / 错误 | 官方使用 |
|---|---|---|---|---|---|
| ANY | `/gift-card/templates` | `type?:1-10, status?:0/1, page?, per_page?:1-1000`（官方另发被忽略的 filter/sort） | paginate（原始模板） | — | 是 |
| POST | `/gift-card/create-template` | `name*, description?, type*:1-3, status?:bool(默认 true), conditions?:object, rewards*:object, limits?:object, special_config?:object, icon?, background_image?:url, theme_color?:#RRGGBB(默认 #1890ff), sort?:int≥0(默认 0)` | `data`=新模板 | `admin_id`=当前管理员；500“创建失败” | 是 |
| POST | `/gift-card/update-template` | `id*` + 上述任意字段（`sometimes`） | `data`=更新后模板（无字段时原样） | 404“模板不存在”；500“更新失败” | 是（含状态开关） |
| POST | `/gift-card/delete-template` | `id*` | `data:true` | 有兑换码 → 400；500 | 是 |
| POST | `/gift-card/generate-codes` | `template_id*, count*:1-10000, prefix?, expires_hours?:≥1, max_usage?:1-1000, download_csv?` | `{batch_id,count,message}` 或 CSV 流 | 批量插入；模板禁用 → 400；500“生成失败” | 是 |
| ANY | `/gift-card/codes` | `template_id?, batch_id?, status?:0-3, page?, per_page?:1-500` | paginate（原始码 + template + user） | — | 是 |
| POST | `/gift-card/toggle-code` | `id*, action*: "disable"\|"enable"` | `{message:"已禁用"\|"已启用"}` | disable：任何状态直接置 3；enable：仅当 status=3 时置 0，否则无变化但仍返回成功；500“操作失败” | 是 |
| GET | `/gift-card/export-codes` | `batch_id*`（须存在） | `text/plain` 附件 `gift_cards_{batch_id}.txt`，每行一个码（按创建时间升序） | — | **否** |
| POST | `/gift-card/update-code` | `id*, expires_at?:int\|null, max_usage?:1-1000, status?:0-3` | `data`=更新后码 | 404/500“更新失败” | **否** |
| POST | `/gift-card/delete-code` | `id*` | `{message:"删除成功"}` | 已使用(1) → 400“该礼品卡已被使用，无法删除”；有使用记录 → 400“该礼品卡存在使用记录，无法删除”；500 | **否** |
| ANY | `/gift-card/usages` | `template_id?, user_id?, page?, per_page?:1-500` | paginate（转换后） | — | 是 |
| ANY | `/gift-card/statistics` | `start_date?, end_date?`（Y-m-d） | 见 6.5 | — | 是 |
| GET | `/gift-card/types` | 无 | `{"1":"通用礼品卡","2":"套餐礼品卡","3":"盲盒礼品卡"}` | — | **否** |

### 6.7 差异与风险（礼品卡）

1. 【风险】兑换码状态 2/3 文案在官方语言包中颠倒（§0.5）。
2. 【风险】模板/兑换码/使用记录的搜索与筛选、模板列表的排序，官方都发 `filter`/`sort`，后端全部忽略，看起来能用实际无效。【建议】新 UI 改用后端真实支持的参数：模板 `type`/`status`；兑换码 `template_id`/`batch_id`/`status`；使用记录 `template_id`/`user_id`；不支持的搜索项不提供（或在后端补实现后再提供）。
3. 【风险】`codes` 返回完整 `user` 对象（含 token、uuid 等，仅隐藏 password），`templates`/`codes` 的增强字段被丢弃。新 UI 不要展示 user 敏感字段；“模板名称”从 `template.name` 取。
4. 【风险】`invite_reward_rate` 官方存在 `limits` 中，但后端只从 `rewards` 读取，所以官方配置的“邀请人奖励比例”**不生效**；且后端默认比例 0.2 只在 `rewards.invite_reward_rate` 存在时触发。`disallowed_plans` 后端未实现。新 UI 若要让该功能生效，应把它写入 `rewards.invite_reward_rate`（与后端对齐）并在说明中注明；`disallowed_plans` 需标注“暂未生效”或后端补实现。
5. 【风险】切换模板类型时，旧类型的奖励键仍保留在 `rewards` 中并被提交；后端 `giveRewards` 不区分类型，会一起发放（例如 type=2 套餐卡附带残留余额）。【建议】新 UI 提交前按类型裁剪：type1 保留 `balance,transfer_enable,expire_days,device_limit,reset_package`；type2 保留 `plan_id,plan_validity_days`；type3 保留 `random_rewards`（及可选基础奖励，需明确说明会与随机项合并）。
6. 【风险】数值输入清空后 zod coerce 成 0 提交（例如 `limits.max_use_per_user=0` 会导致无人可兑换）。新 UI 空值应删除该键。
7. 【风险】`limits.invite_reward_rate` 的输入单位官方标 `%` 但说明写 0.2=20%，自相矛盾；按后端以小数比例为准。
8. 【风险】`special_config.start_time/end_time` 只到日期（本地 0 点），`end_time` 选当天会在当天 0 点结束。【建议】结束时间取当天 23:59:59 或使用日期时间选择器。
9. 生成兑换码官方强制设置有效期（默认 720 小时），无法生成永久码；后端支持不传 `expires_hours`。【建议】新 UI 提供“永久有效”选项。
10. 官方“导出”按钮禁用；后端已有按批次导出 TXT 与生成时 CSV。【建议】新 UI 在兑换码列表增加批次号列/筛选，并接入 `export-codes`（GET，需带 Authorization，用 blob 下载）。
11. 后端已有 `update-code`（改过期时间/最大次数/状态）、`delete-code`、`types`，官方未使用。【建议】新 UI 在兑换码行增加“编辑”“删除”（删除需确认，已用码/有记录的码按钮禁用或提示）。
12. 模板类型筛选给出 1–10，后端只存在 1–3；新 UI 只给 1–3（类型选项可来自 `GET /gift-card/types`）。

---

## 7. 汇总

### 7.1 本域全部接口（前缀 `/api/v2/{secure_path}`）

| 模块 | 方法 | 路径 | 官方 UI 使用 |
|---|---|---|---|
| plan | GET | `/plan/fetch` | 是（套餐页、订单分配、优惠券表单、礼品卡模板表单） |
| plan | POST | `/plan/save` | 是 |
| plan | POST | `/plan/drop` | 是 |
| plan | POST | `/plan/update` | 是（show/sell/renew 开关） |
| plan | POST | `/plan/sort` | 是 |
| order | ANY | `/order/fetch` | 是 |
| order | POST | `/order/detail` | 是 |
| order | POST | `/order/paid` | 是 |
| order | POST | `/order/cancel` | 是 |
| order | POST | `/order/update` | 是（佣金状态） |
| order | POST | `/order/assign` | 是 |
| payment | GET | `/payment/fetch` | 是 |
| payment | GET | `/payment/getPaymentMethods` | 是 |
| payment | POST | `/payment/getPaymentForm` | 是（不带 safe） |
| payment | POST | `/payment/save` | 是 |
| payment | POST | `/payment/drop` | 是 |
| payment | POST | `/payment/show` | 是（启用开关） |
| payment | POST | `/payment/sort` | 是 |
| coupon | ANY | `/coupon/fetch` | 是 |
| coupon | POST | `/coupon/generate` | 是 |
| coupon | POST | `/coupon/drop` | 是 |
| coupon | POST | `/coupon/update` | 是（启用开关） |
| coupon | POST | `/coupon/show` | 否 |
| gift-card | ANY | `/gift-card/templates` | 是 |
| gift-card | POST | `/gift-card/create-template` | 是 |
| gift-card | POST | `/gift-card/update-template` | 是 |
| gift-card | POST | `/gift-card/delete-template` | 是 |
| gift-card | POST | `/gift-card/generate-codes` | 是 |
| gift-card | ANY | `/gift-card/codes` | 是 |
| gift-card | POST | `/gift-card/toggle-code` | 是 |
| gift-card | GET | `/gift-card/export-codes` | 否 |
| gift-card | POST | `/gift-card/update-code` | 否 |
| gift-card | POST | `/gift-card/delete-code` | 否 |
| gift-card | ANY | `/gift-card/usages` | 是 |
| gift-card | ANY | `/gift-card/statistics` | 是 |
| gift-card | GET | `/gift-card/types` | 否 |
| server | GET | `/server/group/fetch` | 是（套餐表单分组下拉） |
| server | POST | `/server/group/save` | 是（套餐表单“添加分组”） |

### 7.2 危险操作清单（新 UI 必须二次确认或明确提示）

| 操作 | 接口 | 影响 |
|---|---|---|
| 套餐“强制更新用户套餐” | `/plan/save` + `force_update` | 批量覆盖该套餐所有用户的权限组/流量/限速/设备数 |
| 删除套餐 | `/plan/drop` | 不可恢复（有订单/用户时后端拒绝） |
| 标记订单已支付 | `/order/paid` | 立即开通/变更用户套餐，`callback_no=manual_operation` |
| 取消订单 | `/order/cancel` | 订单作废并退回已扣余额 |
| 佣金设为发放中 / 无效 | `/order/update` | 发放中=进入自动打款；无效=作废佣金 |
| 手动分配订单 | `/order/assign` | 创建待支付订单（金额由管理员指定，不校验套餐价格） |
| 修改/删除支付方式、修改通知域名 | `/payment/save` `/payment/drop` | 回调地址变化或失效会导致支付回调失败 |
| 删除优惠券 | `/coupon/drop` | 不可恢复 |
| 批量生成优惠券 | `/coupon/generate` + `generate_count` | 最多 500 张且默认启用 |
| 删除礼品卡模板 | `/gift-card/delete-template` | 不可恢复（有兑换码时拒绝） |
| 禁用/启用兑换码、生成兑换码（最多 10000） | `/gift-card/toggle-code` `/gift-card/generate-codes` | — |

### 7.3 新 UI 关键实现要点（与官方保持兼容的前提下）

1. 请求层：统一处理三种成功体（`{status,data}` 包装、paginate 裸结构、空 body）、CSV/Blob 下载、422 `errors` 映射到表单字段。
2. 金额：所有“元→分”换算一律 `Math.round(元*100)`；显示一律 `(分/100).toFixed(2)`。
3. 套餐价格提交前清洗（只发 >0 的周期）；`capacity_limit` 文案明确“留空不限，0=停售”。
4. 订单周期筛选发新格式；URL 预置筛选的纯数字转 `eq:`；`surplus_credit` 替代 `refund_amount`。
5. 支付编辑使用 `getPaymentForm` 的 `safe:1`，支持 `password` 字段“留空不变”；列表不展示 config。
6. 优惠券 `/coupon/update` 空 body 视为成功；比例券整数校验；新增优惠值列。
7. 礼品卡：兑换码状态用后端映射；筛选只用后端支持的参数；“模板名称”取 `template.name`；奖励按类型裁剪；空数值不提交；`invite_reward_rate` 与后端对齐问题需与用户确认后再定（是否修后端）。
