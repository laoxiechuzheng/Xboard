# admin-next 规格：users（用户管理与流量重置）

> 状态：只读调研产出，2026-10-28。依据：官方后台编译包 `public/assets/admin/assets/index-CEIYH7i8.js`、官方语言包 `public/assets/admin/locales/zh-CN.js`、后端源码（路由 `app/Http/Routes/V2/AdminRoute.php`，控制器 `app/Http/Controllers/V2/Admin/UserController.php`、`TrafficResetController.php`、`StatController.php::getStatUser`、`OrderController.php::assign`，请求校验 `app/Http/Requests/Admin/User*.php`、`OrderAssign.php`，模型 `User`、`StatUser`、`TrafficResetLog`，服务 `UserService`、`TrafficResetService`、`MailService`、`AuthService`，观察者 `app/Observers/UserObserver.php`）。
>
> 约定：标注【官方】= 官方编译后台的实际行为；【后端】= 后端代码事实；【新UI】= 对新后台（`/{secure_path}/next`）的实现要求/建议；【BUG】= 官方 UI 或后端已确认的缺陷。新后台与旧后台并存，旧后台不动。
>
> 编译包定位（便于复核）：API 定义 @541900 附近（`oT/aT/lT/cT/dT/uT/hT/gT/pT/mT/fT/_T`）；用户模块 @6404645–6478600；流量重置日志页 @6500900–6519500；分配订单弹窗 `f6t` @6323963；格式化函数 `SS/kS/DS/RS/IS` @415448–416700；分页组件 `AGt`；排序表头 `eQt` @5856596。

---

## 0. 通用约定（本域所有接口）

### 0.1 请求基础
- baseURL：`${window.settings.base_url || '/'}api/v2`，所有本域接口再加前缀 `/${window.settings.secure_path}`，即 `/api/v2/{secure_path}/user/fetch` 等。
- 中间件：`admin`（Sanctum token 用户且 `is_admin=true`，否则 HTTP 403 `{"message":"Unauthorized"}`）+ `log`（审计）。
- 请求头：`Authorization: <token>`（官方从登录态取，原样放入，不拼 `Bearer`，由登录接口返回的 auth_data 决定）；`Content-Language: zh-CN|en-US|ru-RU`（后端 `Language` 中间件据此 `App::setLocale`，影响 `reset_type_name`、`trigger_source_name`、流量重置提示语等后端文案）；`Content-Type: application/json`。
- 官方 axios 超时 30s。【新UI】`user/generate`（最多 500 个用户，逐个 bcrypt）与 `user/dumpCSV`（全量导出）建议单独把超时提到 ≥120s。
- 全局中间件 `TrimStrings` + `ConvertEmptyStringsToNull`：**空字符串会被后端当作 null**（影响 generate 的 `password`、`email_prefix` 等）。
- 审计：`RequestLog` 对**所有 POST** 请求写 `admin_audit_log`（剔除 `password/token/secret/key/api_key` 键）。官方用 POST 调 `user/fetch`、`stat/getStatUser`，因此每次翻页/筛选都会写一条审计（`action=user.fetch`）。`user/fetch`、`stat/getStatUser` 路由是 `any`，GET 也可用（见风险 R-17）。

### 0.2 响应形态（本域出现 5 种，必须分别处理）
| 形态 | 结构 | 出现位置 |
|---|---|---|
| A. ApiResponse | `{"status":"success"|"fail","message":string,"data":any,"error":any}`；HTTP 状态码 = 业务码前 3 位（`success()` 为 200，`fail([400202,..])` 为 400，`fail([422,..])` 为 422，`fail([500,..])` 为 500）。成功默认 message `操作成功` | update、resetSecret、generate(单个)、sendMail、ban、destroy、getUserInfoById、order/assign |
| B. 分页 | `{"total":int,"current_page":int,"per_page":int,"last_page":int,"data":[...]}`（无 status 包装） | user/fetch |
| C. 裸 JSON | 各自结构，无 status 包装 | stat/getStatUser `{data,total}`；traffic-reset/* `{data,...}`；generate 批量 JSON `{code:0,message,data}` |
| D. 文件流 | `text/csv` 下载 | dumpCSV、generate(download_csv=true 且批量) |
| E. Laravel 校验错误 | HTTP 422 `{"message":"第一条错误","errors":{"field":["..."]}}` | 所有 FormRequest/`$request->validate` |

- 官方拦截器：成功时返回响应体（`response.data`）；失败时 toast `response.data.message`，无 message 时按状态码 toast：401 `登录已过期`、403 `没有权限`、404 `资源或接口不存在`、其它 `未知异常`；401/403 会登出跳转登录。
- 【新UI】以 `responseType: 'blob'` 请求的接口（dumpCSV、generate 下载）失败时错误体也是 Blob，需要把 Blob 读成文本再 `JSON.parse` 取 `message`，官方未处理（只会弹通用错误）。

### 0.3 单位与格式化（官方实现，新 UI 需等价）
- 流量：后端一律**字节**。官方 `formatBytes(RS)`：`null 或 <=0 → "0 B"`；单位 `B/KB/MB/GB/TB`，`n=floor(log(v)/log(1024))` 截断到 [0,4]，输出 `parseFloat((v/1024^n).toFixed(2)) + " " + 单位`（例：`1.5 GB`、`512 MB`）。GB 换算常数 `1073741824`。
- 金额：数据库存**分**。`user/fetch` 已在后端 `/100` 转成**元**（浮点）；`user/update` 接收**元**、后端 `*100` 入库；`getUserInfoById` 返回原始**分**；订单分配 `total_amount` 传**分**。官方金额显示 `DS(v)`：字符串先 parseFloat，NaN → `"0.00"`，否则 `toFixed(2)`，前面加 `¥`。
- 时间：用户相关字段为 **Unix 秒**（`created_at/updated_at/expired_at/next_reset_at/last_reset_at/last_login_at/t/record_at`）；`last_online_at` 为数据库 datetime 字符串（`YYYY-MM-DD HH:mm:ss`，应用时区）；流量重置日志的 `reset_time/created_at` 为 ISO8601 UTC 字符串（如 `2025-06-21T08:00:00.000000Z`）。官方 `formatDate(SS)(v, fmt='yyyy-MM-dd HH:mm:ss')`：`v==null → ""`；若 `floor(v)` 为 10 位数字则 `*1000`；再 `new Date(v)` 用 date-fns 格式化（本地时区）。`kS` = `SS(v,'yyyy-MM-dd')`。
- 复制：官方 `IS(text)` 用 clipboard.js，复制后 toast `复制成功`（`common:copy.success`）；【新UI】用 `navigator.clipboard.writeText`，失败 toast `复制失败`。

---

## 1. 页面结构与入口

| 页面/组件 | 类型 | 入口 | 路由（官方 SPA 内） |
|---|---|---|---|
| 用户管理 | 页面 | 侧边栏「用户管理」分组（`nav:userManagement`，图标 users）→ 子项「用户管理」 | `/user/manage`，支持查询参数 `?email=xxx` |
| 流量重置日志 | 页面（**隐藏路由，侧边栏无入口**；`nav.trafficResetLogs` 文案存在但未挂菜单） | 只能直接输入 URL | `/user/traffic-reset-logs` |
| 创建用户 | 弹窗（Dialog） | 用户列表工具栏左侧按钮「创建用户」 | — |
| 高级筛选 | 右侧抽屉（Sheet，宽 540px） | 工具栏「高级筛选」 | — |
| 操作（批量）菜单 | 下拉菜单 | 工具栏「操作」 | — |
| 发送邮件 | 弹窗 | 操作菜单「发送邮件」 | — |
| 批量封禁确认 | AlertDialog | 操作菜单「批量封禁」 | — |
| 用户详情 | 弹窗（max-w-xl） | 点击列表「邮箱」列里的邮箱文字 | — |
| 编辑用户 | 右侧抽屉（Sheet，max-w 90%） | 行操作「编辑」；**工单详情页也复用**（工单页挂载了同一 Provider + 抽屉） | — |
| 分配订单 | 弹窗（订单域组件复用，预填 email） | 行操作「分配订单」 | — |
| 流量使用记录 | 弹窗（sm:max-w 700px） | 行操作「TA的流量记录」；**工单详情页也复用** | — |
| 流量重置 | 弹窗（max-w-4xl，含 2 个 Tab） | 行操作「重置流量」 | — |
| 删除确认 | AlertDialog（移动端为 Drawer） | 行操作「删除」 | — |

页面标题区：用户管理页 `h2` = `用户管理`，副标题 = `在这里可以管理用户，包括增加、删除、编辑、查询等操作。`；流量重置日志页 `h2` = `流量重置日志`，副标题 = `查看系统中所有流量重置操作的详细记录`。

跨域跳转（新 UI 需保持）：
- 行操作「TA的订单」→ `/finance/order?user_id=eq:{id}`（订单页把 `user_id` 查询参数作为字符串 filter `{id:'user_id', value:'eq:5'}`）。
- 用户详情「邀请人」→ `/user/manage?email={invite_user.email}`。
- 订单详情弹窗里的用户邮箱、邀请人邮箱 → `/user/manage?email=...`（订单域，指向本页）。
- 工单详情：用户信息按钮打开本域「编辑用户」抽屉；流量按钮打开本域「流量使用记录」弹窗；订单按钮 → `/finance/order?user_id={id}`（注意无 `eq:`）。

【新UI】新后台内建议保持相同相对路由：`/user/manage`、`/user/traffic-reset-logs`；并把「流量重置日志」挂到侧边栏（官方是隐藏的，属可选增强）。编辑抽屉、流量记录弹窗、流量重置弹窗做成可复用组件（工单域要用）。

---

## 2. 用户列表（`/user/manage`）

### 2.1 数据加载
- 页面挂载时并行请求：
  - `POST user/fetch`（见 2.2）
  - `GET plan/fetch`（`RD()`）→ `data: Plan[]`，取 `id/name` 作为订阅下拉选项（高级筛选「订阅」、创建用户、编辑用户都用）。
  - `GET server/group/fetch`（`iD()`）→ 官方取回后**没有使用**（死代码）。【新UI】可不请求。
- 查询参数 `email`：页面 mount 时若 URL 有 `?email=xxx` 且当前筛选中没有 `email` 项，则追加筛选 `{id:'email', value:'xxx'}`（模糊匹配，非精确）。
- 状态：`pagination={pageIndex:0,pageSize:20}`；`sorting=[]`；`columnFilters=[]`；`rowSelection={}`（`getRowId = String(row.id)`）。任一变化即重新请求（react-query key `['userList', pagination, filters, sorting]`）。
- 【官方】筛选变化时**不重置页码**（`manualPagination` 下不自动回第一页），可能出现空页。【新UI】筛选/排序变化时回到第 1 页。

### 2.2 接口：`user/fetch`
- 方法/路径：`ANY /api/v2/{secure_path}/user/fetch`（官方用 POST + JSON body）。
- 请求体（官方实际发送）：
```json
{
  "pageSize": 20,
  "current": 1,
  "filter": [ { "id": "email", "value": "abc" }, { "id": "id", "value": "gt:100" } ],
  "sort":   [ { "id": "total_used", "desc": true } ]
}
```
- 后端读取：`current`（默认 1）、`pageSize`（默认 10，**无上限**）、`filter`（数组，每项 `id`、`value`、可选 `logic`）、`sort`（数组，每项 `id`、`desc`）。注意 `app/Http/Requests/Admin/UserFetch.php`（`filter.*.key/condition/value` 旧格式）**未被 fetch 使用**，是遗留文件。
- 查询构造：`User::with(['plan:id,name','invite_user:id,email','group:id,name'])->select('v2_user.*')->selectRaw('(u + d) as total_used')` → hook `admin.user.fetch.query` → 应用 filter → 应用 sort → 最后**总是追加** `orderBy('id','desc')` → `paginate(pageSize, page=current)`。
- **filter 语义（后端 `buildFilterQuery`，逐项 AND 连接；某项 `logic:'or'` 时该项用 `orWhere` 连接）**：
  1. `id === 'subscription_status'`：`value='active'` → `expired_at IS NULL OR expired_at >= now`；`value='expired'` → `expired_at IS NOT NULL AND expired_at < now`；其它值无效果。【官方未使用】
  2. `id` 含 `.`（关联字段，如 `invite_user.email`、`plan.name`、`group.name`）：`whereHas(relation, ...)`；value 为数组 → `whereIn`；value 为含 `:` 的字符串 → 按运算符；否则 `like %value%`。
  3. value 为数组 → `whereIn(id, value)`；特例 `id='group_ids'` 映射到列 `group_id`。【官方未使用】
  4. value 不是字符串或不含 `:` → `where(id, 'like', "%value%")`（**数字 5 会变成 LIKE '%5%'，务必发字符串 `eq:5`**）。
  5. value 形如 `op:val`（只按第一个 `:` 切分）：`val` 若是数字字符串则转 int/float；`id='total_used'` 时字段替换为 `DB::raw('(u + d)')`；运算符映射（`QueryOperators`）：

| op | SQL | 值处理 |
|---|---|---|
| `eq` | `=` | 原值 |
| `gt` | `>` | 原值 |
| `gte` | `>=` | 原值 |
| `lt` | `<` | 原值 |
| `lte` | `<=` | 原值 |
| `like` | `like` | `%val%` |
| `notlike` | `not like` | `%val%` |
| `null` | `IS NULL` | 忽略 val |
| `notnull` | `IS NOT NULL` | 忽略 val |
| 其它任何字符串 | `like` | 原值（**不加 %**） |

  - 注意：值本身含 `:` 时会被误解析（如备注搜 `a:b`）。字段名不做白名单，未知列会导致 SQL 错误 500。
- **sort 语义**：每项 `orderBy(sort.id, sort.desc ? 'DESC' : 'ASC')`，在默认 `id desc` 之前生效。`total_used` 可排序（select 别名）。字段名不校验，未知列 500。
- 响应（形态 B）：`{total, current_page, per_page, last_page, data: UserRow[]}`。
- **UserRow 字段**（= `v2_user` 全部列除 `password` + 关联 + 追加字段，经 `transformUserData` 与 hook `admin.user.transform`）：

| 字段 | 类型/单位 | 说明 |
|---|---|---|
| `id` | int | |
| `email` | string | 小写 |
| `password_algo` | string\|null | 【风险】敏感，会下发 |
| `password_salt` | string\|null | 【风险】敏感，会下发 |
| `invite_user_id` | int\|null | |
| `telegram_id` | int\|null | |
| `balance` | float，**元** | 后端已 `/100` |
| `commission_balance` | float，**元** | 后端已 `/100` |
| `commission_type` | int | 0=跟随系统 1=循环返利 2=首次返利 |
| `commission_rate` | float\|null | 百分比整数 0–100（模型 cast float，如 `10.0`） |
| `discount` | int\|null | 专享折扣 0–100（%） |
| `t` | int（秒） | 最后一次流量上报时间，0=从未在线 |
| `u` / `d` | int（字节） | 已用上行/下行 |
| `total_used` | int（字节） | `u+d`（selectRaw） |
| `transfer_enable` | int（字节） | 总流量 |
| `banned` | bool | |
| `is_admin` / `is_staff` | bool | |
| `last_login_at` | int\|null（秒） | |
| `last_login_ip` | int\|null | 列类型为 integer，官方原样显示 |
| `uuid` | string | |
| `token` | string | 订阅 token |
| `group_id` / `plan_id` | int\|null | |
| `speed_limit` | int\|null（Mbps） | |
| `device_limit` | int\|null | null=不限 |
| `online_count` | int\|null | 当前在线设备数 |
| `last_online_at` | string\|null | datetime 字符串 |
| `remind_expire` / `remind_traffic` | bool | |
| `expired_at` | int\|null（秒） | null=长期有效；历史数据可能为 `0`（迁移默认值），官方会显示为 1970 且“已过期” |
| `next_reset_at` / `last_reset_at` | int\|null（秒） | |
| `reset_count` | int | |
| `remarks` | string\|null | |
| `created_at` / `updated_at` | int（秒） | |
| `plan` | `{id,name}`\|null | |
| `group` | `{id,name}`\|null | |
| `invite_user` | `{id,email}`\|null | |
| `subscribe_url` | string | `Helper::getSubscribeUrl(token)`；若配置了多个 `subscribe_url`，**每次请求随机挑一个域名** |
| 插件附加（仅当 `phone_auth` 插件通过 hook 注入时存在） | `phone`、`phone_national_number`、`phone_country_code`、`phone_default_country_code`、`phone_auth_enabled`(bool)、`phone_auth_countries`(`[{code,name,dial_code}]`)、`identity`、`identity_type` | 本仓库无该插件；新 UI 需按字段存在与否条件渲染 |

### 2.3 列定义（官方顺序与显示）

默认隐藏列（官方 `initialState.columnVisibility`）：`is_admin`、`is_staff`、`plan_id`（订阅）、`commission_balance`（佣金）、`created_at`（注册时间）；官方**没有列显隐切换控件**，所以这些列实际永远看不到。【新UI】提供“显示列”切换（common 文案 `显示列`/`切换显示列`），默认值与官方相同。`actions` 列固定在右侧（column pinning right）。

| # | accessor / id | 标题 | 可排序 | 显示 |
|---|---|---|---|---|
| 1 | `select` | （复选框） | 否 | 表头复选框=选中当前页全部行（`选择全部`），行复选框（`选择用户`）；当前页无数据时表头禁用 |
| 2 | `is_admin` | 管理员 | 否 | 默认隐藏，无自定义 cell |
| 3 | `is_staff` | 员工 | 否 | 默认隐藏，无自定义 cell |
| 4 | `id` | ID | 是 | outline 徽标显示 id；不可隐藏 |
| 5 | `email` | 邮箱 | 否 | 见下「邮箱单元格」 |
| 6 | `online_count` | 在线设备 | 是 | outline 徽标 `"{online_count||0} / {device_limit===null ? '∞' : device_limit}"`；当 `device_limit!==null && online>=device_limit` 用红色（destructive）样式，否则 primary 样式；悬停提示：`device_limit===null` → `无设备数限制`，否则 `最多可同时在线 {count} 台设备` |
| 7 | `banned` | 状态 | 是 | 居中徽标：`banned` → `封禁`（红），否则 `正常`（绿） |
| 8 | `plan_id` | 订阅 | 否 | 默认隐藏；`plan?.name || '-'` |
| 9 | `group_id` | 权限组 | 否 | outline 徽标 `group?.name || '-'` |
| 10 | `total_used` | 已用流量 | 是 | 上行：左 `formatBytes(total_used)`，右 `{pct.toFixed(1)}%`；下：进度条宽 `min(pct,100)%`，`pct>90` 红色否则主色；`pct = total_used/transfer_enable*100 || 0`（transfer_enable=0 且已用>0 时为 Infinity，官方显示 `Infinity%`，【新UI】应显示 `—` 或 100%）；悬停提示 `总流量: {formatBytes(transfer_enable)}` |
| 11 | `transfer_enable` | 总流量 | 是 | `formatBytes(transfer_enable)`（灰色字） |
| 12 | `expired_at` | 到期时间 | 是 | 满宽 outline 徽标：`expired_at==null` → `长期有效`（主色）；已过期（`expired_at < now`）→ 红色；未过期 → 绿色；文本 `yyyy-MM-dd`。悬停提示：有到期时间时显示 `到期时间: yyyy-MM-dd HH:mm:ss`、`已过期 {days} 天`（红）或 `剩余 {days} 天`（绿），`days = ceil((expired_at*1000-now)/86400000)` 取绝对值；若 `next_reset_at` 存在再加一行 `下次重置时间: yyyy-MM-dd HH:mm:ss`；无到期时间显示 `长期有效` |
| 13 | `balance` | 余额 | 是 | `¥` + `DS(balance)`（已是元） |
| 14 | `commission_balance` | 佣金 | 是 | 默认隐藏；`¥` + `DS(commission_balance)` |
| 15 | `created_at` | 注册时间 | 是 | 默认隐藏；`yyyy-MM-dd HH:mm:ss` |
| 16 | `actions` | 操作 | 否 | 「…」按钮打开行操作菜单（见 2.7） |

「邮箱单元格」细节：
- 左侧圆点：`isOnline = now/1000 - t < 120`（t 为秒）→ 绿色，否则灰色。
- 主文字 `identity = row.identity || row.phone || row.email`，可点击（下划线 hover）→ 打开「用户详情」弹窗；若 `identity_type==='phone'` 或（有 phone 且 identity===phone），下方小字再显示 email。
- 悬停整行显示复制按钮（aria `Copy Email`），点击复制 `identity` 并 toast `复制成功`（阻止冒泡，不打开详情）。
- 悬停提示（多行）：在线 → `当前在线`；`t===0` → `从未在线`；否则 `最后在线时间: {formatDate(t)}` + 换行 + 离线时长（优先级：天>小时>分钟>秒）：`离线时长: {n}天` / `离线时长: {n}小时` / `离线时长: {n}分钟` / `离线时长: {n}秒`。

排序交互（官方 `eQt`）：可排序列表头为按钮，点击在 asc↔desc 间切换（未排序 → asc；asc → desc；desc → asc，**无法取消**），图标：未排序双箭头、asc 上箭头、desc 下箭头。单列排序。sort 发给后端为 `[{id, desc}]`。【新UI】允许第三次点击取消排序。

### 2.4 分页
- 后端分页，参数名 `current`（1 起）、`pageSize`；总数取响应 `total`。
- 官方分页条：左侧 `已选择 {selected} 项，共 {total} 项`（这里 total 实为**当前页行数**）；`每页显示` 下拉 `[10,20,30,40,50,100,500]`，默认 20；`第 [输入框] 页，共 {pageCount} 页`（输入框回车/失焦跳页，越界恢复原值）；首页/上一页/下一页/末页按钮（首末页在 lg 以上显示）。
- 加载中：骨架行（`min(pageSize,10)` 行）；空数据：`暂无数据`。
- 移动端（官方 `p8e()` 为小屏）：改为卡片列表，主字段 `email`，网格字段 `online_count`、`transfer_enable`、`used_traffic`（官方写错了，应为 `total_used`）、`expired_at`。

### 2.5 工具栏
左侧：
1. 按钮 `创建用户`（outline，小号，`+` 图标）→ 创建用户弹窗（§3）。
2. 搜索框 placeholder `搜索用户邮箱...`，绑定筛选项 `{id:'email', value:输入值}`（后端 `like %v%`）；官方逐字符即时请求，【新UI】做 300ms 防抖。

右侧：
3. 按钮 `高级筛选`（虚线边框，漏斗图标），已配置条件数>0 时追加数字徽标（数的是抽屉里的“条件草稿”数量）。
4. 当存在任意筛选时显示 ghost 按钮 `重置` + X 图标 → 清空全部 columnFilters 并清空高级筛选草稿。
5. 下拉按钮 `操作`（虚线）→ 菜单：
   - `发送邮件` + 范围后缀
   - `导出 CSV` + 范围后缀
   - 分隔线
   - `批量封禁`（红字）+ 范围后缀
   - 范围（scope）自动判定：有选中行 → `selected`，后缀 `(N)`（N=当前页选中行数，带脉冲动画）；否则有筛选 → `filtered`，后缀 `(筛选)`；否则 `all`，后缀 `(全部)`。

### 2.6 高级筛选抽屉
- 标题 `高级筛选`，描述 `添加一个或多个筛选条件来精确查找用户`；小节标题 `筛选条件`，按钮 `添加条件`（追加 `{field:'',operator:'',value:''}`）。
- 每个条件卡片：标题 `条件 {n}`，右上 X 删除；字段下拉（placeholder `选择字段`）；选了字段后出现运算符下拉（placeholder `选择操作符`）——**切换字段时自动选中该字段的第一个运算符**，并把 value 重置为 `''`（boolean 字段重置为 `false`）；选了运算符后出现值输入。
- 字段与运算符（完整，按官方顺序）：

| 字段 value（发给后端的 id） | 中文 | 类型 | 运算符（顺序） | 值输入 |
|---|---|---|---|---|
| `email` | 邮箱 | text | 包含 `contains`、等于 `eq` | 文本框（placeholder `输入值`） |
| `phone`（仅 `phone_auth` 插件已安装且启用时出现） | 手机号 | text | 包含、等于 | 文本框 |
| `id` | 用户ID | number | 等于 `eq`、大于 `gt`、小于 `lt` | 数字框（placeholder `输入数值()`） |
| `plan_id` | 订阅 | select | 等于 | 下拉：plan/fetch 的 `name`→`id` |
| `transfer_enable` | 流量 | number（单位 GB） | 大于、小于、等于 | 数字框（placeholder `输入数值(GB)`，右侧 `GB`）；**输入 GB，存字节 = GB×1073741824**，回显时字节/1073741824 |
| `total_used` | 已用流量 | number（GB） | 大于、小于、等于 | 同上（后端映射 `(u+d)`） |
| `online_count` | 在线设备 | number | 等于、大于、小于 | 数字框 |
| `expired_at` | 到期时间 | date | 小于 `lt`、大于 `gt`、等于 `eq` | 内嵌日历单选（本地 00:00:00） |
| `uuid` | UUID | text | 等于 | 文本框 |
| `token` | Token | text | 等于 | 文本框 |
| `banned` | 账号状态 | select | 等于 | 下拉：`0`=正常，`1`=禁用 |
| `remarks` | 备注 | text | 包含、等于 | 文本框 |
| `invite_user.email` | 邀请人邮箱 | text | 包含、等于 | 文本框（后端走 whereHas 关联） |
| `invite_user_id` | 邀请人ID | number | 等于 | 数字框 |
| `is_admin` | 管理员 | boolean | 等于 | 开关 + 文字 `是`/`否` |
| `is_staff` | 员工 | boolean | 等于 | 开关 + 文字 `是`/`否` |

- 底部按钮：
  - `重置`：清空条件草稿并关闭抽屉（**不清除已应用的表格筛选**，官方行为）。
  - `应用筛选`：丢弃 field/operator 为空或 `value===''` 的条件，转换后 **整体替换** columnFilters（会把搜索框的 `email` 筛选也冲掉），关闭抽屉。转换规则：
    - 运算符 `contains` → `{id: field, value: 原值}`（后端 like）；
    - 其它运算符 → `{id: field, value: `${op}:${v}`}`，其中 date 类型 `v = floor(Date.getTime()/1000)`，boolean 类型 `v = true?1:0`，number(GB) 已是字节，select 为字符串 id。
- 筛选值示例：`{id:'total_used', value:'gt:10737418240'}`、`{id:'expired_at', value:'lt:1767196800'}`、`{id:'banned', value:'eq:1'}`、`{id:'invite_user.email', value:'eq:a@b.com'}`、`{id:'is_admin', value:'eq:1'}`。
- 【新UI】注意 `expired_at` 的 `lt/gt` 不包含 `expired_at IS NULL`（长期有效）用户；可额外提供后端已支持但官方未用的 `subscription_status`（active/expired）快捷筛选（可选增强）。

### 2.7 行操作菜单（每行「…」，官方顺序）
| 顺序 | 文案 | 行为 | 接口 |
|---|---|---|---|
| 1 | 编辑 | 设置 editingUser=该行，打开编辑抽屉（§4） | 提交时 `user/update` |
| 2 | 分配订单 | 打开订单分配弹窗，email 预填该行 email（§9）；官方未传 refetch，成功后不刷新用户列表 | `order/assign` |
| 3 | 复制订阅URL | 复制 `row.subscribe_url`，toast `复制成功`（官方无论成功与否都提示成功） | 无 |
| 4 | 重置UUID及订阅URL | **官方无确认，点击立即执行**；成功 `data` 为真 → toast `重置成功`（硬编码中文）并刷新列表 | `user/resetSecret`（§7） |
| 5 | TA的订单 | 路由跳转 `/finance/order?user_id=eq:{id}` | 订单域 |
| 6 | TA的邀请 | 把表格筛选**替换**为 `[{id:'invite_user_id', value:'eq:{id}'}]` | `user/fetch` |
| 7 | TA的流量记录 | 打开流量使用记录弹窗（§10） | `stat/getStatUser` |
| 8 | 重置流量 | 打开流量重置弹窗（§11），成功后刷新列表 | `traffic-reset/reset-user`、`traffic-reset/user/{id}/history` |
| 9 | 删除（红字） | 确认弹窗，标题 `确认删除用户`，内容 `此操作将永久删除用户 {email} 及其所有相关数据，包括订单、优惠码、流量记录、工单记录等信息。删除后无法恢复，是否继续？`，按钮 `取消` / `确认`（destructive）；成功 `data` 为真 → toast `删除成功` + 刷新；异常 → toast `删除失败` | `user/destroy`（§8） |

- 语言包里有 `查看详情`（`actions_menu.view_details`）但官方菜单没有该项，详情只能点邮箱打开。【新UI】可加「查看详情」菜单项（可选）。
- 【新UI】「重置UUID及订阅URL」必须加确认弹窗（会立刻让用户原订阅链接失效），见风险 R-9。

---

## 3. 创建用户弹窗（`user/generate`）

### 3.1 表单（官方 zod schema 与默认值）
默认值：`{email_prefix:'', email_suffix:'', password:'', expired_at:null, plan_id:null, generate_count:undefined, download_csv:false}`，校验模式 onChange。

| key | 类型 | 中文标签 / placeholder | 必填 | 默认 | 显示条件 / 联动 | 校验 |
|---|---|---|---|---|---|---|
| `email_prefix` | string | 与域名同一行的左输入框，placeholder `帐号(批量生成请留空)` | 条件必填 | `''` | 当 `generate_count` 有值时**隐藏** | 见 refine |
| `email_suffix` | string | 标签 `邮箱`（带必填星号），右输入框 placeholder `域`，两框之间固定文字 `@` | 是 | `''` | 始终显示 | `min(1)` |
| `password` | string | 标签 `密码`，placeholder `留空则密码与邮件相同` | 否 | `''` | | 无 |
| `expired_at` | number\|null（秒） | 标签 `到期时间`；按钮显示已选日期 `yyyy-MM-dd HH:mm:ss` 或 placeholder `请选择用户到期日期，留空为长期有效` | 否 | `null` | 弹层：顶部按钮 `长期有效`（置 null）+ 日历单选（选中日期本地 00:00 → `getTime()/1000`） | |
| `plan_id` | number\|null | 标签 `订阅计划`，下拉首项 `无`（值 `null`）+ 套餐列表 | 否 | `null` | 弹窗打开时请求 `plan/fetch` | |
| `generate_count` | number\|null | 标签 `生成数量`，数字框，placeholder `如果为批量生产请输入生成数量` | 条件必填 | `undefined` | 当 `email_prefix` 有值时**隐藏**；输入转 `parseInt`，空 → `null` | 后端 `max:500` |
| `download_csv` | boolean | 标签 `导出为 CSV 文件`，开关（带边框的一行） | 否 | `false` | 仅当 `generate_count` 为真值时显示 | |

- refine：`generate_count !== null || (email_prefix !== undefined && email_prefix !== '')`，否则在 `email_prefix` 报 `Email prefix is required when generate_count is null`。【BUG】由于 `generate_count` 默认是 `undefined` 而非 `null`，两者都不填也能提交，后端走空分支返回空响应，官方无提示无反应。【新UI】校验改为「`email_prefix` 非空 或 `generate_count` ≥1」二选一必填。
- 布局：邮箱一行；密码一行；到期时间 + 订阅计划两列；生成数量；CSV 开关。弹窗标题 `创建用户`，底部 `取消` / 提交按钮（官方用通用对话框默认文案；语言包有 `生成`，新 UI 用 `生成`）。

### 3.2 提交
- `download_csv=true`：`POST user/generate`，`responseType:'blob'`，拿到 Blob 后触发下载，文件名 `users_{Date.now()}.csv`，toast `生成成功`，重置表单、刷新列表、关弹窗。
- 否则：`POST user/generate`（JSON），响应 `data` 为真值 → toast `生成成功`，重置、刷新、关闭。
- 发送体为整个表单值（包括 `email_prefix:''`、`password:''`、`download_csv:false` 等），空串经后端中间件变 null。

### 3.3 后端 `UserController::generate` + `UserGenerate`
校验：
```php
'generate_count' => 'nullable|integer|max:500',
'expired_at'     => 'nullable|integer',
'plan_id'        => 'nullable|integer',
'email_prefix'   => 'nullable',
'email_suffix'   => 'required',
'password'       => 'nullable'
// messages: generate_count.integer=生成数量必须为数字; generate_count.max=生成数量最大为500个
```
分支：
1. `email_prefix` 有值且无 `generate_count`：单个创建 `email = prefix@suffix`；已存在 → 400 `邮箱已存在于系统中`；成功 → 形态 A `data:true`。
2. `email_prefix` 有值且有 `generate_count`：批量 `prefix_1@suffix … prefix_N@suffix`，任一已存在 → 400 `邮箱 {email} 已存在于系统中`（【官方 UI 无法触发此分支】，因两个输入互斥显示）。
3. 无 `email_prefix`、有 `generate_count`：批量随机 `randomChar(6)@suffix`（不查重，撞库会唯一键失败 → 整体回滚 → 500 `生成失败`）。
4. 都没有：返回空响应（HTTP 200，无 body）。
- 每个用户 `UserService::createUser({email, password: password ?? email, plan_id, expired_at})`：
  - 密码 bcrypt；`uuid=guid(true)`、`token=guid()`；`remind_expire/remind_traffic` 取系统默认；`expired_at` 先置 null 再按传入覆盖。
  - 有 `plan_id` 且套餐存在：`plan_id/group_id` 取套餐，`transfer_enable = plan.transfer_enable × 1073741824`，`speed_limit` 取套餐；`expired_at` 仅在传入时设置（**不传即长期有效**）；`device_limit` **不**从套餐带入。
  - 无 `plan_id`：若系统配置了试用套餐 `try_out_plan_id`，则赋予试用套餐，`expired_at = now + try_out_hour×3600`，**覆盖管理员填写的到期时间**。
  - email 由模型 mutator 转小写去空格；后端**不校验邮箱格式**。
  - 观察者 `created`：重算 `next_reset_at`，派发 `NodeUserSyncJob(created)`。
- 批量成功返回：
  - `download_csv` 真：流式 CSV，`Content-Type: text/csv`，`Content-Disposition: attachment; filename="users.csv"`，**无 BOM**；表头 `账号,密码,过期时间,UUID,创建时间,订阅地址`；过期时间 `Y-m-d H:i:s` 或 `长期有效`；密码为传入密码或邮箱本身（明文）。
  - 否则 JSON（形态 C）：`{"code":0,"message":"批量生成成功","data":[{"email","password","expired_at"(字符串或"长期有效"),"uuid","created_at"("Y-m-d H:i:s"),"subscribe_url"}]}`。官方只 toast，不展示该列表。
- 【新UI】建议：批量 JSON 结果用结果表格展示并可复制（可选增强）；下载 CSV 时客户端在 Blob 前补 UTF-8 BOM（`﻿`）避免 Excel 中文乱码；邮箱前缀/域名做格式校验。

---

## 4. 编辑用户抽屉（`user/update`）

### 4.1 打开与初始化
- 打开时请求 `plan/fetch` 作为订阅选项。
- 用列表行数据 `row` 初始化（`form.reset`）：
  - 展开 `row` 全部字段；
  - `invite_user_email = row.invite_user?.email || null`
  - `country_code = row.phone_country_code || row.phone_default_country_code || 'CN'`（仅手机号插件）
  - `phone = row.phone_national_number || row.phone || null`（仅手机号插件）
  - `password = null`
  - `u = row.u ? (row.u/1024/1024/1024).toFixed(3) : ''`（GB 字符串，3 位小数）
  - `d = row.d ? (row.d/1024^3).toFixed(3) : ''`
  - 其余直接用行值：`balance`/`commission_balance` 为**元**；`transfer_enable` 为**字节**；`expired_at` 秒或 null。
- 抽屉标题 `用户管理`（`edit.title`），无描述。

### 4.2 字段（官方顺序；zod：`yy`=coerce number，`dy`=number，`uy`=boolean，`cy`=string）
| key | 前端类型 | 中文标签 / placeholder | 默认 | 控件与转换 | 前端校验 | 后端规则（UserUpdate） |
|---|---|---|---|---|---|---|
| `id` | number | （隐藏） | 0 | 总是发送 | | `required|integer` |
| `email` | string | `邮箱` / `请输入邮箱` | `''` | 文本框，autocomplete username | `email()` | `email:strict`（非必填）；与他人重复 → 400 `邮箱已被使用` |
| `invite_user_email` | string\|null | `邀请人邮箱` / `请输入邮箱` | `null` | 文本框，空串 → `null` | `email()` 或 null | **不在 rules 中**，后端直接 `$request->input` 读取（见 4.4 第 4 步与 R-1） |
| `country_code` | string\|null | `国家/地区` | `null` | 下拉：`phone_auth_countries` 每项显示 `{name} +{dial_code}`，值 `code`；国家数 ≤1 时禁用 | | 核心无规则（被丢弃），需插件 hook 扩展 |
| `phone` | string\|null | `手机号` / `请输入手机号` | `null` | 文本框，空 → null | | 同上 |
| — | | 以上两项仅当 `row.phone_auth_enabled` 为真时显示（两列布局 10rem + 1fr） | | | | |
| `password` | string\|null | `密码` / `如需修改密码请输入` | `null` | 密码框，autocomplete new-password | 无 | `nullable|min:8`（`密码长度最小8位`）；后端 `password_hash(PASSWORD_DEFAULT)`，`password_algo=NULL` |
| `balance` | number（元） | `余额` / `请输入余额`，右缀 `¥` | 0 | 数字框，显示 `value||''`（0 显示为空） | coerce number | `numeric`；后端 `×100` 存分 |
| `commission_balance` | number（元） | `佣金余额` / `请输入佣金余额`，右缀 `¥` | 0 | 同上 | coerce number | `numeric`；后端 `×100` |
| `u` | string→number（GB） | `已用上行` / `已用上行`，右缀 `GB` | 0 | 数字框 `step=any`；**提交时若 dirty：`Math.round(parseFloat(u)×1073741824)` 字节** | coerce number | `integer`（字节） |
| `d` | 同上 | `已用下行`，右缀 `GB` | 0 | 同上 | | `integer`（字节） |
| `transfer_enable` | number（字节） | `流量` / `请输入流量`，右缀 `GB` | 0 | 显示 `value/1024^3 || ''`；输入 `onChange = parseInt(输入)×1073741824`（**只支持整数 GB**，小数被截断；清空得 NaN → 前端校验失败阻止提交） | number | `numeric`（字节） |
| `expired_at` | number\|null（秒） | `到期时间`；按钮显示 `yyyy-MM-dd HH:mm:ss` 或 `请选择用户到期日期，留空为长期有效` | null | 弹层（向上弹出，点外部/ESC 不关闭）：按钮行 `长期有效`（null）、`一个月`（今天+1 月 23:59:59.999 → 取整秒）、`三个月`（+3 月同理）；日历（**禁选今天之前的日期**；选中日期保留原值或当前时刻的时分秒）；`具体时间` 区：`设为当天结束` 链接按钮（今天 23:59:59）、`datetime-local`（step=1，值 `yyyy-MM-dd'T'HH:mm:ss`）+ `确定` 按钮关闭弹层 | number\|null | `nullable|integer` |
| `plan_id` | number\|null | `订阅计划`，下拉首项 `无`（值 `"null"`→null）+ 套餐 | null | 选中 `parseInt` | | `nullable|integer`；非 null 时套餐不存在 → 400 `订阅计划不存在`；存在则**自动把 `group_id` 设为套餐的 group_id**；**不会**改 transfer_enable/speed_limit/device_limit |
| `banned` | boolean | `账户状态`，下拉 `封禁`(true) / `正常`(false) | false | | boolean | `bool`；为真时后端删除该用户全部 Sanctum token（强制下线） |
| `commission_type` | number | `佣金类型`，下拉 `0` 跟随系统设置 / `1` 循环返利 / `2` 首次返利 | 0 | `parseInt` | number | `integer`（无枚举校验） |
| `commission_rate` | number\|null | `推荐返利比例` / `为空则跟随站点设置返利比例`，右缀 `%` | null | `parseInt(v)||null`（**0 会变成 null**） | | `nullable|integer|min:0|max:100` |
| `discount` | number\|null | `专享折扣比例` / `为空则不享受专享折扣`，右缀 `%` | null | 同上（0→null） | | `nullable|integer|min:0|max:100` |
| `speed_limit` | number\|null | `限速` / `留空则不限速`，右缀 `Mbps` | null | 同上（0→null） | | `nullable|integer` |
| `device_limit` | number\|null | `设备限制` / `留空则不限制`，右缀 `台` | null | 同上（0→null） | | `nullable|integer` |
| `is_admin` | boolean | `是否管理员`，开关 | false | | | `boolean` |
| `is_staff` | boolean | `是否员工`，开关 | false | | | `boolean` |
| `remarks` | string\|null | `备注` / `请在这里记录`，多行文本（h-24） | null | | | `nullable` |

后端 rules 全文（`app/Http/Requests/Admin/UserUpdate.php`，经 hook `admin.user.update.rules` 可被插件扩展）：
```php
'id' => 'required|integer',
'email' => 'email:strict',
'password' => 'nullable|min:8',
'transfer_enable' => 'numeric',
'expired_at' => 'nullable|integer',
'banned' => 'bool',
'plan_id' => 'nullable|integer',
'commission_rate' => 'nullable|integer|min:0|max:100',
'discount' => 'nullable|integer|min:0|max:100',
'is_admin' => 'boolean',
'is_staff' => 'boolean',
'u' => 'integer',
'd' => 'integer',
'balance' => 'numeric',
'commission_type' => 'integer',
'commission_balance' => 'numeric',
'remarks' => 'nullable',
'speed_limit' => 'nullable|integer',
'device_limit' => 'nullable|integer'
```
自定义消息（hook `admin.user.update.messages`）：`email.required 邮箱不能为空`、`email.email 邮箱格式不正确`、`transfer_enable.numeric 流量格式不正确`、`expired_at.integer 到期时间格式不正确`、`banned.in 是否封禁格式不正确`、`is_admin.required 是否管理员不能为空`、`is_admin.in 是否管理员格式不正确`、`is_staff.required 是否员工不能为空`、`is_staff.in 是否员工格式不正确`、`plan_id.integer 订阅计划格式不正确`、`commission_rate.integer/nullable 推荐返利比例格式不正确`、`commission_rate.min 推荐返利比例最小为0`、`commission_rate.max 推荐返利比例最大为100`、`discount.integer/nullable 专属折扣比例格式不正确`、`discount.min 专属折扣比例最小为0`、`discount.max 专属折扣比例最大为100`、`u.integer 上行流量格式不正确`、`d.integer 下行流量格式不正确`、`balance.integer 余额格式不正确`、`commission_balance.integer 佣金格式不正确`、`password.min 密码长度最小8位`、`speed_limit.integer 限速格式不正确`、`device_limit.integer 设备数量格式不正确`。

注意：
- 只有 rules 里的键进入 `validated()`；**`group_id`、`telegram_id`、`remind_*`、`token`、`uuid` 等不能通过本接口修改**（`group_id` 只能随 `plan_id` 联动）。
- `email` 若前端 zod 认为不合法（历史脏数据），整个表单无法提交。

### 4.3 提交转换（官方）
```js
payload = { id }
if (dirty.u) payload.u = Math.round(parseFloat(u) * 1073741824)
if (dirty.d) payload.d = Math.round(parseFloat(d) * 1073741824)
for (key of Object.keys(parsed)) if (key not in ['u','d','id'] && dirty[key]) payload[key] = parsed[key]
POST user/update payload
// 成功 data 为真 → toast「修改成功」，关闭抽屉，刷新列表
```
- **只发送被修改过的字段**（react-hook-form `dirtyFields`）。
- 底部按钮 `取消` / `提交`。

### 4.4 后端处理顺序（`UserController::update`）
1. `User::find(id)`，不存在 → 400 `用户不存在`。
2. 传了 `email`：被其他用户占用 → 400 `邮箱已被使用`。
3. `password` 非空 → 哈希，`password_algo=NULL`；为空则不改。
4. `plan_id` 非 null → 查套餐（不存在 400 `订阅计划不存在`），`group_id = plan.group_id`。`plan_id=null` 时会把用户套餐置空但 **group_id 保持不变**。
5. **邀请人**：`invite_user_email` 有值且能查到用户 → `invite_user_id = 该用户 id`；**否则一律 `invite_user_id = null`**（包括没传该字段、传了不存在的邮箱）。不校验自邀。
6. `banned` 为真 → `AuthService::removeAllSessions()`（删除全部 token）。
7. `balance`、`commission_balance` 传了则 `×100`。
8. hook `admin.user.update.params` → `admin.user.update.before` → `$user->update($params)`（异常 → 500 `保存失败`）→ `admin.user.update.after`。
9. 成功：形态 A `data:true`。
10. 观察者 `updated`（afterCommit）：`plan_id` 或 `expired_at` 变化 → 重算 `next_reset_at`；`group_id/uuid/speed_limit/device_limit/banned/expired_at/transfer_enable/u/d/plan_id` 任一变化 → 派发 `NodeUserSyncJob(updated, oldGroupId)` 推送节点。

### 4.5 【新UI】要求
- **每次提交都带上 `invite_user_email`（当前值，无邀请人时为 null/省略均会清空，故有邀请人时必须带原值）**，否则会把邀请关系清掉（官方 BUG，见 R-1）。
- 修改邀请人时，前端可先用 `user/fetch` 精确查询 `invite_user.email`/`email eq:` 校验邮箱存在，避免静默清空。
- 金额提交保留两位小数（`Math.round(v*100)/100`），避免浮点误差。
- `transfer_enable` 支持小数 GB（`Math.round(GB×1073741824)`）；`commission_rate/discount/speed_limit/device_limit` 的 0 应保留为 0 而不是 null（`device_limit=0` 语义需与节点端确认，见 R-12），空才是 null。
- 目标用户为当前登录管理员本人时，取消 `is_admin` / 设为封禁需二次确认。

---

## 5. 用户详情弹窗（点击邮箱）

官方直接使用**列表行数据**（不请求 `getUserInfoById`）。弹窗标题 `用户详情`；标题下一行：`用户ID：{id}` + 状态徽标（优先级：`banned` → `已封禁`(destructive)；`is_admin` → `管理员`(红底)；`is_staff` → `员工`(蓝底)；否则 `正常`(绿底)）。每行为「标签(w-28 灰色) + 值」，值为空显示 `-`。分组：

1. **基本信息**：`邮箱`=email；`手机号`=phone||'-'（仅 `phone_auth_enabled`）；`UUID`=uuid（等宽小字）；`Token`=token（等宽小字）；`备注`=remarks；`Telegram ID`=telegram_id||'-'。
2. **订阅信息**：`订阅套餐`=plan?.name；`权限组`=group?.name；`到期时间`=null→`长期有效`，否则 `yyyy-MM-dd`，悬停提示同列表到期列（含 `下次重置时间`）；`设备限制`=device_limit||'-'；`速度限制`=speed_limit ? `${speed_limit} Mbps` : '-'。
3. **流量信息**：`总流量`=formatBytes(transfer_enable) 或 '-'（0 也显示 '-'）；`上传已用`=formatBytes(u)；`下载已用`=formatBytes(d)；`总已用`=formatBytes(total_used)（主色）；分隔线；`上次重置`=formatDate(last_reset_at)；`下次重置`=formatDate(next_reset_at)；`重置次数`=reset_count||'0'。
4. **财务信息**：`余额`、`佣金余额`、`佣金类型`、`佣金比例`。【BUG】官方 `余额 = ¥(balance/100).toFixed(2)`、`佣金余额` 同理，但行数据已经是元，结果被**再除 100**；`佣金比例 = (commission_rate×100).toFixed(2)%`（10 → `1000.00%`）；`佣金类型` 直接显示数字 0/1/2。【新UI】余额/佣金直接 `¥{toFixed(2)}`；佣金比例 `{commission_rate}%` 或 `跟随系统`；佣金类型显示 `跟随系统设置/循环返利/首次返利`。
5. **活动信息**：`最后登录`=formatDate(last_login_at)；`最后登录IP`=last_login_ip||'-'（整数原样；【新UI】可尝试按 IPv4 整数转点分，或原样显示）；`最后在线`=formatDate(last_online_at)；`在线设备`=online_count||'0'。
6. **邀请信息**（仅 `invite_user` 存在）：`邀请人`=链接 `/user/manage?email={invite_user.email}`；`邀请人ID`=invite_user.id。
7. **时间信息**：`创建时间`、`更新时间`（`yyyy-MM-dd HH:mm:ss`）。
8. **订阅链接**（仅 `subscribe_url` 存在）：`订阅链接`=新窗口打开的 `<a>`（`noopener noreferrer`），可断行。

---

## 6. 批量操作（scope 机制）

### 6.1 后端 scope 解析（`resolveScope`，dumpCSV/sendMail/ban 共用）
- 读 `scope`（`selected|filtered|all`）与 `user_ids`。
- `scope` 不合法或缺省时自动推断：`user_ids` 含数字 → `selected`；否则 `filter` 非空 → `filtered`；否则 → **`all`**。
- `selected`：`user_ids` 去重转 int，过滤非数字；为空 → 422 `user_ids不能为空`（形态 A，`status:fail`）。
- `filtered`：执行 `applyFiltersAndSorts`（与 fetch 同语义）。**若 `scope:'filtered'` 但 `filter` 为空数组，等同全部用户**（危险，见 R-4）。
- `all`：忽略 filter/sort。

### 6.2 发送邮件弹窗 → `POST user/sendMail`
UI：标题 `发送邮件`，描述 `向所选或已筛选的用户发送邮件`，宽 max-w-2xl。字段：
1. `发送范围`（下拉）：`仅选中（N）`（无选中时禁用）、`筛选后的用户`（无筛选时禁用）、`全部用户`；打开时默认 = 2.5 中自动判定的 scope。
2. `主题`（文本框，placeholder `例如：系统通知（支持占位符）`），下方提示 `支持占位符：{{key}} 或 {{key|默认值}}（未知变量会原样保留）`。
3. `内容`（多行，min-h 220px，placeholder `请输入邮件正文（可使用占位符）`），标签右侧按钮 `填入系统通知模板`：主题填 `【{{app.name}}】系统通知（{{now}}）`，内容填 `尊敬的用户 {{user.email}} 您好：\n\n这里是来自 {{app.name}} 的系统通知。\n\n如有问题请访问：{{app.url}}\n`；下方提示 `content 默认按纯文本处理（会转义），不支持 HTML 富文本。`
4. `可用变量` 区：`{{app.name}} {{app.url}} {{now}} {{user.id}} {{user.email}} {{user.uuid}} {{user.plan_name}} {{user.expired_at}} {{user.transfer_enable}} {{user.transfer_used}} {{user.transfer_left}}`。
- 提交按钮 `发送`（提交中 `发送中...`，带图标）；取消 `取消`。主题或内容为空 → toast `请填写所有必填字段`（不发请求）。成功 → toast `邮件发送成功`，关闭并清空；异常 → `邮件发送失败`。
- 官方请求体：
  - selected：**对每个选中用户各发一次** `{subject, content, filter:[{id:'id', value:'eq:{id}'}]}`（无 scope，后端推断为 filtered），选中为空 toast `请先选择用户`。
  - filtered：`{subject, content, filter: columnFilters, sort: sorting[0]?.id, sort_type: sorting[0]?.desc ? 'DESC':'ASC'}`。
  - all：`{subject, content}`。
- 后端（`UserSendMail` 校验 `subject required 主题不能为空`、`content required 发送内容不能为空`）：按 scope 取用户，`chunk(1000)`，每个用户派发 `SendEmailJob`（队列 `send_email_mass`，模板 `notify`，`content_mode:'text'`），变量：`app.name`(app_name 设置，默认 XBoard)、`app.url`、`now`(`Y-m-d H:i:s`)、`user.id`、`user.email`、`user.uuid`、`user.plan_name`(无则空)、`user.expired_at`(`Y-m-d H:i:s` 或空)、`user.transfer_enable`/`user.transfer_used`/`user.transfer_left`（**原始字节整数**，未格式化）。渲染：`{{key}}`/`{{key|默认}}`，值为 null/空串时用默认值，无默认则原样保留；主题和内容都渲染；text 模式内容 HTML 转义。若数据库存在名为 `notify` 的邮件模板则用 DB 模板覆盖。每封写 `MailLog`。返回形态 A `data:true`（仅代表已入队）。
- 【BUG】filtered 且当前有排序时，后端 `orderBy($sort)` 后又 `applySorting` 把字符串 `sort` 当数组取 `['id']` → PHP 抛错 → 500（见 R-3）。
- 【新UI】selected 一次请求：`{scope:'selected', user_ids:[...], subject, content}`；filtered：`{scope:'filtered', filter, subject, content}`（**不要发 sort/sort_type**）；all：`{scope:'all', subject, content}`，且 all 需二次确认（显示将发送的总人数，可用当前无筛选时的 fetch total）。

### 6.3 导出 CSV → `POST user/dumpCSV`
- 官方点击菜单即执行（无确认、无 loading）。请求（`responseType:'blob'`）：
  - selected：`{scope:'selected', user_ids:[当前页选中 id]}`
  - filtered：`{scope:'filtered', filter: columnFilters, sort: sorting[0]?.id, sort_type}`
  - all：`{scope:'all'}`
- 成功：保存为 `users_{new Date().toISOString()}.csv`，toast 标题 `成功` 描述 `导出成功`；失败：标题 `错误` 描述 `导出失败`。
- 后端：`ini_set memory_limit -1`；查询 `email,balance,commission_balance,transfer_enable,u,d,expired_at,token,plan_id` + `plan:id,name`，`orderBy id asc`，`chunk(500)` 流式输出；`Content-Type: text/csv; charset=UTF-8`，`Content-Disposition: attachment; filename="users_Y-m-d_His.csv"`，**带 UTF-8 BOM**。列：

| 表头 | 内容 |
|---|---|
| 邮箱 | email |
| 余额 | `number_format(balance/100, 2)`（含千分位逗号，如 `1,234.00`） |
| 推广佣金 | `number_format(commission_balance/100, 2)` |
| 总流量 | `trafficConvert(transfer_enable)`（`> 1GB` 显示 `x.xx GB`，否则 MB/KB/B，负数 `0`） |
| 剩余流量 | `trafficConvert(transfer_enable - (u+d))` |
| 套餐到期时间 | `Y-m-d H:i:s` 或 `长期有效` |
| 订阅计划 | 套餐名或 `无订阅` |
| 订阅地址 | `getSubscribeUrl(token)` |

- 【BUG】filtered + 有排序时同 R-3（`applySorting` 收到字符串 sort）→ 500；selected 为空 → 422 JSON（但前端以 blob 接收）。
- 【新UI】filtered 时不发 `sort`（或发数组 `[{id,desc}]`，但因后端先 `orderBy id asc`，排序只是次级，意义不大）；加 loading 状态，按钮防重复点击。

### 6.4 批量封禁 → `POST user/ban`
- 确认弹窗：标题 `确认批量封禁`；描述：selected → `将对选中的 {N} 个用户执行封禁`；filtered → `此操作将封禁所有符合当前筛选条件的用户。此操作无法撤销。`；all → `此操作将封禁系统中的所有用户。此操作无法撤销。`；按钮 `取消` / `确认封禁`（红色，执行中 `封禁中...`，两按钮禁用）。
- 请求：selected `{scope, user_ids}`；filtered `{scope, filter, sort, sort_type}`；all `{scope:'all'}`。
- 成功：toast `成功`/`批量封禁成功` 并刷新；失败：`错误`/`批量封禁失败`；最后关闭弹窗。
- 后端：查询构造后 `->update(['banned'=>1])`（**查询构建器批量更新，不触发模型事件**：不推送节点同步、不删除用户 token；代码注释 “Full refresh not implemented”）；异常 → 500 `处理失败`；成功 `data:true`。
- 【BUG】filtered + 有排序同 R-3。
- 【新UI】all 范围需要输入确认（如输入 `BAN ALL`）；后端没有排除管理员自身，见 R-5。封禁后提示“节点侧需等待下次同步生效”。若需要立即生效，可改为对选中用户逐个 `user/update {id, banned:true}`（触发踢下线+节点同步），作为可选模式。

---

## 7. 重置 UUID 及订阅 URL → `POST user/resetSecret`
- 请求：`{id}`。
- 后端：`User::find(id)`，不存在 → 400 `用户不存在`；`token = guid()`（32 位 md5），`uuid = guid(true)`（UUID 格式）；保存；成功后 hook `admin.user.secret.reset`；返回形态 A `data: true|false`。
- 副作用：旧订阅链接立即失效；uuid 变化触发观察者 `NodeUserSyncJob`（节点端旧 uuid 失效，客户端需重新导入订阅）。
- 官方：无确认，成功 toast `重置成功`，刷新列表。

## 8. 删除用户 → `POST user/destroy`
- 请求：`{id}`。
- 校验：`id required|exists:App\Models\User,id` → 422，消息 `用户ID不能为空` / `用户不存在`。
- 后端事务：hook `admin.user.destroy.before` → 删除该用户 `orders`、`codes`（邀请码）、`stat`（v2_stat_user 流量统计）、`tickets`（工单主表，用查询删除，**工单消息不删**）→ 删除用户 → 提交 → hook `admin.user.destroy.after`；异常回滚 → 500 `删除失败`；成功 `data:true`。
- 未清理：工单消息、佣金日志、流量重置日志、礼品卡使用记录、被邀请人的 `invite_user_id` 仍指向已删 id。观察者 `deleted`：有 group_id 时派发节点同步删除。
- 不阻止删除当前管理员本人。

## 9. 分配订单弹窗（订单域组件，行操作复用）→ `POST order/assign`
- 标题 `订单分配`；字段（zod：`email min(1)`、`plan_id number`、`period string`、`total_amount number`；默认 `{email:'', plan_id:0, total_amount:0, period:''}`，本域打开时 `email` 预填行邮箱）：

| key | 标签 | 控件 | 转换 |
|---|---|---|---|
| `email` | `用户邮箱`（placeholder `请输入用户邮箱`） | 文本框 | |
| `plan_id` | `订阅计划`（placeholder `请选择订阅计划`） | 下拉（打开时请求 plan/fetch） | `parseInt` |
| `period` | `订单周期`（placeholder `请选择购买时长`） | 下拉：`month_price`月付、`quarter_price`季付、`half_year_price`半年付、`year_price`年付、`two_year_price`两年付、`three_year_price`三年付、`onetime_price`一次性、`reset_price`流量重置包 | |
| `total_amount` | `支付金额`（placeholder `请输入需要支付的金额`，右侧 `CNY`） | 数字框，显示 `value/100`，输入 `parseFloat×100` | **分** |

- 后端 `OrderAssign`：`plan_id required`（订阅不能为空）、`email required`（邮箱不能为空）、`total_amount required`（支付金额不能为空）、`period required|in:month_price,quarter_price,half_year_price,year_price,two_year_price,three_year_price,onetime_price,reset_price`（订阅周期不能为空/订阅周期格式有误）。用户不存在 400 `该用户不存在`；套餐不存在 400 `该订阅不存在`；用户有未完成订单 400 `该用户还有待支付的订单，无法分配`；订单类型自动判定（重置包/升级/续费/新购）；返回 `data: trade_no`。成功 toast `添加成功`，关闭并重置。
- 本域行操作调用时官方未传 refetch。订单细节以 orders 规格为准。

## 10. 流量使用记录弹窗 → `stat/getStatUser`
- 标题 `流量使用记录`（`traffic:trafficRecord.title`）。打开后才请求（关闭时不请求）。
- 请求：`POST stat/getStatUser`，`{user_id, pageSize, page}`（`pageSize` 默认 20，`page` 从 1）。
- 后端：`user_id required|integer`（422）；`StatUser::where(user_id)->orderBy('record_at','DESC')->paginate(pageSize)`（页码读 `page`）；返回形态 C `{data: StatUser[], total}`。**日记录(`record_type='d'`)与月记录(`'m'`)混在一起返回**，不做区分；`v2_stat_user` 只保留约 2 个月（`ResetLog` 命令清理）。
- StatUser 字段：`id`、`user_id`、`server_rate`（decimal，JSON 为字符串如 `"1.00"`）、`u`、`d`（字节，**已乘过倍率**，即计费流量）、`record_type`（`d`/`m`）、`record_at`（秒，日记录为当日 0 点，月记录为当月 1 日 0 点）、`created_at`、`updated_at`。
- 列（表头为硬编码中文）：

| 列 | 显示 |
|---|---|
| 时间 | `kS(record_at)` → `yyyy-MM-dd` |
| 上行流量 | 绿色上箭头 + `formatBytes(u / parseFloat(server_rate))`（即还原为实际流量） |
| 下行流量 | 蓝色下箭头 + `formatBytes(d / parseFloat(server_rate))` |
| 倍率 | outline 徽标 `{server_rate}x` |
| 总计 | 右对齐 `formatBytes(u + d)`（计费流量，**未除倍率**） |

- 分页：后端分页；底部左 `每页显示 [10|20|30|40|50] 条记录`，右 `第 {current} / {total} 页` + 上一页/下一页图标按钮（加载中禁用）。加载骨架行；空 `暂无记录`。
- 【新UI】倍率为 0 时避免除零（显示 `—`）；可增加 `record_type` 标识（日/月）。

## 11. 流量重置弹窗（行操作「重置流量」）

### 11.1 UI
- 通用对话框：标题 `流量重置`；破坏性提交按钮 `确认重置`（带图标，提交中 loading）；取消 `取消`；宽 max-w-4xl。**提交按钮在两个 Tab 下都可见**。
- Tab `重置流量`（默认）：
  - 卡片 `用户信息`：`邮箱`=email；`已用流量`=formatBytes(total_used)（红）；`总流量`=formatBytes(transfer_enable)；`到期时间`=formatDate(expired_at) 或 `长期有效`。
  - 警示卡（琥珀色）标题 `重要提醒`，三条：`流量重置操作不可逆，请谨慎操作`、`重置后用户的上传和下载流量将清零`、`所有重置操作都会被记录在系统日志中`。
  - `重置原因` 多行文本（placeholder `请输入重置流量的原因（可选）`），下方提示 `此字段为可选项，用于记录重置原因`。
- Tab `重置历史`：打开弹窗即请求历史（`limit=10`）；加载中转圈。
  - 卡片 `重置概览`：`重置次数`=user.reset_count；`最后重置`=formatDate(last_reset_at) 或 `从未重置`；`下次重置`=formatDate(next_reset_at) 或 `无定时重置`。
  - 卡片 `重置记录`（副标题 `最近10次重置记录`，高 300px 滚动）：每条显示两个徽标 `reset_type_name`（outline）、`trigger_source_name`（secondary），`重置时间`=formatDate(reset_time)，`清除流量`=old_traffic.formatted（红）；空 `暂无重置记录`。
- 提交：`POST traffic-reset/reset-user {user_id, reason: reason.trim() || undefined}`；响应 `data` 存在 → toast `流量重置成功`，关闭、清空原因、刷新用户列表。失败由拦截器 toast 后端 `message`。
- 【官方缺陷】重置成功后历史查询缓存（key `['trafficResetHistory', id]`）不失效，再次打开可能看到旧历史。【新UI】打开时总是重新请求。

### 11.2 `POST traffic-reset/reset-user`
- 校验：`user_id required|integer|exists:v2_user,id`；`reason nullable|string|max:255`（422）。
- 前置：`TrafficResetService::canReset($user)` = 用户未封禁 && (`expired_at` 为 null 或 > now) && `plan_id` 非 null && 套餐存在；否则 **HTTP 400** `{"message":"该用户当前不能重置流量（用户未激活或无有效套餐）"}`（形态 C，无 status）。
- 执行 `manualReset` → `performReset(user, 'manual')`（事务）：记录旧 u/d，`u=0,d=0,last_reset_at=now,reset_count+1,next_reset_at=重新计算`；写 `v2_traffic_reset_logs`（`reset_type` 按套餐重置方式推导，**不是固定 manual**；`trigger_source='manual'`）；清缓存；hook `traffic.reset.after`。失败 → HTTP 500 `{"message":"流量重置失败，请查看日志获取详细信息"}`。
- 成功 HTTP 200：`{"message":"流量重置成功","data":{"user_id","email","reset_time"(ISO UTC),"next_reset_at"(秒|null)}}`。
- 【BUG】控制器把 `reason`、`admin_id` 组装进 `$metadata` 传给 `manualReset`，但 `manualReset` **丢弃了 metadata**，日志 `metadata` 恒为 null —— 重置原因实际不会被保存（R-8）。

### 11.3 `GET traffic-reset/user/{userId}/history`
- 参数：路径 `userId`；查询 `limit`（`nullable|integer|min:1|max:50`，默认 10）。
- 用户不存在 → 404（`findOrFail`）。
- 响应：
```json
{"data":{
  "user":{"id":1,"email":"a@b.com","reset_count":3,"last_reset_at":1730000000,"next_reset_at":1732600000},
  "history":[{"id":9,"reset_type":"monthly","reset_type_name":"按月重置","reset_time":"2025-06-21T08:00:00.000000Z",
              "old_traffic":{"upload":123,"download":456,"total":579,"formatted":"579 B"},
              "trigger_source":"manual","trigger_source_name":"手动触发","metadata":null}]
}}
```
- 按 `reset_time desc`。`formatted` 由后端 `formatTraffic`（B/KB/MB/GB/TB，round 2）。

---

## 12. 流量重置日志页（`/user/traffic-reset-logs`，隐藏路由）

### 12.1 接口 `GET traffic-reset/logs`
- 查询参数（后端校验）：`user_id nullable|integer`、`user_email nullable|string`（`whereHas user email like %v%`）、`reset_type nullable|in:monthly,first_day_month,yearly,first_day_year,manual,purchase`、`trigger_source nullable|in:auto,manual,api,cron,user_access`（**不含实际会出现的 `order`、`gift_card`**）、`start_date nullable|date`（`reset_time >= start_date`）、`end_date nullable|date|after_or_equal:start_date`（`reset_time <= end_date 23:59:59`）、`per_page nullable|integer|min:1|max:10000`（默认 20）、`page nullable|integer|min:1`。
- 固定排序 `reset_time desc`（**不支持前端排序参数**）。
- 响应（形态 C）：
```json
{"data":[{"id":1,"user_id":2,"user_email":"a@b.com"|"N/A","reset_type":"monthly","reset_type_name":"按月重置",
          "reset_time":"ISO","old_traffic":{"upload","download","total","formatted"},
          "new_traffic":{"upload","download","total","formatted"},
          "trigger_source":"cron","trigger_source_name":"定时任务","metadata":null,"created_at":"ISO"}],
 "pagination":{"current_page":1,"last_page":5,"per_page":20,"total":98}}
```
- 名称映射（后端 zh-CN，按 `Content-Language`）：reset_type `monthly 按月重置`、`first_day_month 每月1号重置`、`yearly 按年重置`、`first_day_year 每年1月1日重置`、`manual 手动重置`、`purchase 购买重置包`；trigger_source `auto 自动触发`、`manual 手动触发`、`api API调用`、`cron 定时任务`、`user_access 用户访问`；`order`、`gift_card` 无翻译，原样返回英文。实际写入来源：`cron`（定时任务）、`user_access`（用户访问时检查）、`manual`（管理员）、`order`（订单开通/重置包）、`gift_card`（礼品卡）；`auto` 基本不会出现。

### 12.2 官方 UI
- 状态：`pagination {pageIndex:0,pageSize:20}`；`sorting [{id:'created_at',desc:true}]`（**不发给后端**）；`columnVisibility {reset_time:false}`。
- 请求参数：`page=pageIndex+1`、`per_page=pageSize` + 筛选（空值不发）。
- 工具栏（桌面）：
  - 搜索框 placeholder `搜索用户邮箱...` → `user_email`；
  - `重置类型` 下拉：`全部类型`(清空) / `按月重置` / `每月1号重置` / `按年重置` / `每年1月1日重置` / `手动重置`（无 purchase）；
  - `触发源` 下拉：`全部来源` / `自动触发` / `手动触发` / `定时任务`（缺 user_access/order/gift_card/api）；
  - `开始日期`、`结束日期` 两个日期按钮（日历单选，显示 `yyyy-MM-dd`）；任一已选时出现 `应用筛选` 按钮，点击后才写入 `date_range` 筛选并转为 `start_date`/`end_date`（`yyyy-MM-dd`）；
  - 有筛选时 ghost 按钮 `重置筛选`（清空筛选与日期）；
  - 右侧 `导出日志` 按钮（导出中 `导出中...`）。
- 移动端：顶部一个 `重置类型` 按钮（显示筛选数）打开底部抽屉（标题 `筛选条件`，描述 `设置筛选条件来查找特定的流量重置记录`），内容同上（日期显示 `MM-dd`），另有导出按钮。
- 列：

| accessor | 标题 | 显示 |
|---|---|---|
| `id` | 日志ID | outline 徽标 |
| `user_email` | 用户 | 用户图标 + 邮箱（粗）+ 下方 `ID: {user_id}` |
| `trigger_source` | 触发源 | 带图标彩色徽标 + `trigger_source_name`；颜色 manual=橙、cron=靛蓝、auto=翠绿、其它=灰；悬停提示名称 + 描述：manual `管理员手动执行的流量重置`、cron `系统定时任务自动执行`、auto `系统根据条件自动触发`、其它 `其他方式触发` |
| `reset_type` | 重置类型 | 彩色徽标 `reset_type_name`；manual=蓝、monthly=绿、yearly=紫、first_day_month=橙、first_day_year=靛蓝、其它=灰 |
| `old_traffic` | 清除流量 | 居中 `old_traffic.formatted`（红）+ 小字 `已清除`；悬停 `上传: {upload/1024^3 toFixed(2)} GB`、`下载: {download/1024^3 toFixed(2)} GB` |
| `reset_time` | 重置时间 | 默认隐藏；`SS(reset_time,'MM-DD')` / `SS(reset_time,'HH:mm')` |
| `created_at` | 记录时间 | `SS(created_at,'YYYY-MM-DD')` / `SS(created_at,'H:m:s')` |

- 导出：以当前筛选 + `page=1, per_page=10000` 请求，客户端生成 CSV（无 BOM，逗号拼接，含逗号的字符串加引号），列 `ID,用户邮箱,用户ID,重置类型,触发源,清零流量,上传流量(GB),下载流量(GB),重置时间,记录时间`（GB 两位小数，时间 `yyyy-MM-dd HH:mm:ss`），文件名 `traffic-reset-logs-{yyyy-MM-dd}.csv`，toast `导出成功` / `导出失败`。
- 【BUG 汇总，官方此页基本不可用】
  1. `created_at` 列用 date-fns 格式 `YYYY-MM-DD`，date-fns v3 对 `YYYY`/`DD` 直接抛 RangeError → **只要有数据，渲染即崩溃**（`reset_time` 列的 `MM-DD` 同样会抛，但默认隐藏）。
  2. 列表 `rowCount` 取 `response.total`，而后端总数在 `pagination.total` → 总数恒为 0，**无法翻页**。
  3. 导出读取 `response.data.data`（应为 `response.data`）→ 必然进 catch，**导出永远失败**。
  4. 排序 UI 可点但不发送给后端。
  5. 触发源/重置类型下拉缺少实际存在的取值（user_access、order、gift_card、purchase）。
- 【新UI】时间统一 `yyyy-MM-dd HH:mm:ss`（本地时区）；总数用 `pagination.total`；导出用 `data`，补 BOM；触发源下拉列出 `auto/manual/api/cron/user_access`（`order/gift_card` 后端校验不接受，不能作为筛选值，只在列表中显示原值）；可加 `user_id` 筛选（后端支持），并从用户行操作提供「查看重置日志」跳转（可选增强）；侧边栏挂入口（可选）。

### 12.3 `GET traffic-reset/stats`（官方未使用）
- 参数 `days`（`nullable|integer|min:1|max:365`，默认 30），统计 `reset_time >= now - days 的 0 点`。
- 响应：`{"data":{"total_resets":int,"auto_resets":int,"manual_resets":int,"cron_resets":int}}`（只统计 auto/manual/cron 三类，`user_access/order/gift_card` 只计入 total）。
- 语言包已有整套文案（`user.traffic_reset.stats.*`：`流量重置统计`、`查看系统流量重置的统计信息`、`统计时间范围`、`总重置次数`、`自动重置`、`手动重置`、`定时重置`、`最近 {{days}} 天`、`重置类型分布`、`各类型重置操作的百分比分布`、`自动重置占比`、`手动重置占比`、`定时重置占比`；时间范围选项 `最近一周`/`最近一月`/`最近三月`/`最近一年` → days 7/30/90/365），工具栏 `actions.traffic_reset_stats` = `流量重置统计`。【新UI】可选：在日志页顶部加统计卡片（非官方现有功能，不计入最低标准）。

---

## 13. 后端存在但官方 UI 未使用 / 不可用的接口

| 接口 | 说明 |
|---|---|
| `GET user/getUserInfoById?id=` | 校验 `id required|numeric`（`用户ID不能为空`）；返回形态 A，`data` 为**原始用户模型**（`balance/commission_balance` 为**分**、无 `subscribe_url/total_used/plan/group`、含 `invite_user` 完整对象和 `password_salt/password_algo`），经 hook `admin.user.detail`。id 不存在时对 null 调 `load()` → **500**。新 UI 如需单用户刷新可用 `user/fetch` + `filter [{id:'id',value:'eq:N'}]` 代替（金额单位一致）。 |
| `POST user/setInviteUser` | 路由存在但 `UserController` **没有该方法** → 调用必 500。新 UI 不得调用；设置邀请人用 `user/update` 的 `invite_user_email`。 |
| `GET traffic-reset/stats` | 见 12.3。 |
| `user/fetch` 的 `subscription_status`、数组 whereIn、`group_ids`、`logic:'or'`、关联字段任意 `relation.field`、运算符 `gte/lte/like/notlike/null/notnull` | 官方只用到 `contains/eq/gt/lt`；新 UI 可按需扩展。 |
| GET 方式调用 `user/fetch`、`stat/getStatUser` | 路由为 any，可避免每次查询写审计日志（见 R-17）。 |

---

## 14. 差异与风险（实现者必读）

- **R-1【高危，数据丢失】编辑用户会清空邀请人**：后端在请求没有 `invite_user_email`（或查不到该邮箱）时把 `invite_user_id` 置 null；官方只提交 dirty 字段，所以**任何未改动邀请人的编辑都会清掉邀请关系**，输错邀请人邮箱也会静默清空。新 UI 必须每次提交带上当前 `invite_user_email`；修改时先校验邮箱存在。（如允许改后端，可改为“仅当请求包含该键时才处理”，需评估旧后台兼容性——旧后台依赖现状无影响。）
- **R-2【高危】批量封禁/群发邮件/导出的 `all` 范围**：未选中且无筛选时，官方菜单直接以“全部用户”为范围；批量封禁 all 会封禁包括当前管理员在内的所有用户（管理员登录接口会拒绝封禁用户，导致之后无法再登录）。新 UI：all 范围必须强确认（显示人数 + 手动输入确认词），并建议默认排除 `is_admin` 用户（需前端在 filtered 模式下追加 `{id:'is_admin',value:'eq:0'}` 而非用 all）。
- **R-3【BUG】filtered 范围 + 有排序 → 500**：官方给 sendMail/ban/dumpCSV 传 `sort` 为字符串，后端 `applySorting` 按数组处理 `$sort['id']` → PHP 抛错（Laravel 转为异常）。新 UI 在批量接口中不传 `sort/sort_type`。
- **R-4【高危】`scope:'filtered'` 而 `filter=[]` 等于全部用户**：新 UI 只有在 filter 非空时才允许 filtered。
- **R-5** 所有接口都不阻止对当前管理员本人执行：封禁、删除、取消 is_admin、重置密钥。新 UI 对 `row.id === 当前管理员 id` 的危险操作加醒目确认。
- **R-6** 批量封禁用查询构建器 `update`，不触发观察者：不推送节点、不踢下线；单个编辑设 `banned=true` 则会踢下线并推送节点。两者效果不同，UI 文案需说明。
- **R-7** 删除用户不可恢复，且不清理工单消息、佣金日志、重置日志、礼品卡记录与被邀请人的 `invite_user_id`。
- **R-8【BUG】流量重置原因不落库**：`manualReset` 丢弃 metadata。新 UI 可保留“原因”输入（与官方一致），但不要宣称已记录；或在规格外推动后端修复。
- **R-9** 「重置UUID及订阅URL」官方无确认即执行，会让用户所有客户端订阅失效。新 UI 加确认弹窗。
- **R-10【BUG】用户详情弹窗金额与比例显示错误**（余额/佣金被二次除 100；佣金比例乘 100；佣金类型显示数字）。新 UI 按 §5 修正。
- **R-11** 编辑表单把 `commission_rate/discount/speed_limit/device_limit` 的 0 转为 null；`transfer_enable` 只能整数 GB。新 UI 修正（见 4.5）。
- **R-12** `device_limit=0` 的语义（不允许任何设备 vs 不限）需与节点端确认；在线设备列中 `device_limit=0` 会显示 `x / 0` 红色。
- **R-13** `user/fetch` 下发 `password_salt`、`password_algo`、`token`、`uuid` 等敏感字段；新 UI 不要渲染 salt/algo，也不要写入日志/本地存储。
- **R-14** `user/fetch` 的 `pageSize` 无上限、filter/sort 字段无白名单；新 UI 只使用本文列出的字段与 `[10,20,30,40,50,100,500]` 页大小，避免 500。
- **R-15** 生成用户：未选套餐且系统配置了试用套餐时，管理员填写的到期时间被试用时长覆盖；选了套餐但未填到期时间则为长期有效；批量随机邮箱不查重；生成的 CSV 无 BOM 且含明文密码（传输/保存需谨慎）。
- **R-16** `subscribe_url` 在配置多个订阅域名时每次 fetch 随机选取，列表刷新后同一用户的链接可能变化（复制结果不稳定属正常）。
- **R-17** 官方以 POST 调用 `user/fetch` 与 `stat/getStatUser`，每次查询都写一条 `admin_audit_log`；改用 GET 可减少审计噪音，但会改变审计行为（是否改由主会话决定）。
- **R-18** `expired_at` 历史数据可能为 0（迁移默认值），会被显示为 1970 且“已过期”；`subscription_status=expired` 也会把它算作过期。
- **R-19** 流量重置日志页官方实现崩溃/不能翻页/不能导出（§12.2），新 UI 不能照抄其格式字符串与字段读取。
- **R-20** `UserFetch.php`（旧 `key/condition` 格式）是死代码，不要按它实现筛选。
- **R-21** 时区：Unix 秒在浏览器本地时区显示；日期筛选（`expired_at` 日历、日志 `start_date/end_date`）使用本地日期，而后端比较用服务器时区。管理员与服务器不同时区时会有偏差。
- **R-22** 搜索框 `email` 与 URL `?email=` 都是模糊匹配（like），不是精确匹配；从订单/详情跳来的 `?email=` 可能匹配到多个用户。

---

## 15. 接口清单（汇总）

| 方法 | 路径（前缀 `/api/v2/{secure_path}`） | 官方使用 | 用途 |
|---|---|---|---|
| POST(any) | `/user/fetch` | 是 | 用户分页列表 |
| POST | `/user/update` | 是 | 编辑用户 |
| GET | `/user/getUserInfoById` | 否 | 单用户原始数据（id 不存在 500） |
| POST | `/user/generate` | 是 | 创建单个/批量用户，可返回 CSV |
| POST | `/user/dumpCSV` | 是 | 导出 CSV（scope） |
| POST | `/user/sendMail` | 是 | 群发邮件（scope） |
| POST | `/user/ban` | 是 | 批量封禁（scope） |
| POST | `/user/resetSecret` | 是 | 重置 token + uuid |
| POST | `/user/setInviteUser` | 否 | **路由存在但方法缺失，必 500** |
| POST | `/user/destroy` | 是 | 删除用户及关联数据 |
| POST(any) | `/stat/getStatUser` | 是 | 用户流量记录 |
| GET | `/traffic-reset/logs` | 是（页面有 BUG） | 重置日志 |
| GET | `/traffic-reset/stats` | 否 | 重置统计 |
| GET | `/traffic-reset/user/{userId}/history` | 是 | 用户重置历史 |
| POST | `/traffic-reset/reset-user` | 是 | 手动重置流量 |
| GET | `/plan/fetch` | 是（依赖） | 套餐下拉 |
| GET | `/server/group/fetch` | 是（结果未用） | 可省略 |
| POST | `/order/assign` | 是（依赖） | 分配订单 |
| GET | `/plugin/getPlugins` | 是（依赖） | 判断 `phone_auth` 插件是否 `is_installed && is_enabled`（决定手机号筛选项） |

---

## 16. 新 UI 验收清单（最低标准 = 官方功能全覆盖 + 修正上述 BUG）
1. 列表：16 列定义、默认隐藏列、显示列切换、排序（可排序列与 asc/desc/取消）、后端分页（页大小 7 档 + 跳页）、行选择、移动端卡片。
2. 筛选：邮箱搜索（防抖）、`?email=` 预填、高级筛选 16 个字段（含条件出现的手机号）与各自运算符和单位换算、应用/重置语义、TA的邀请快捷筛选。
3. 创建用户：单个/批量（随机前缀）/CSV 下载，二选一校验，套餐与到期时间。
4. 编辑用户：§4 全部字段、dirty 提交 + 始终带 `invite_user_email`、单位换算、到期时间快捷按钮、手机号插件条件字段、成功刷新。
5. 详情弹窗：§5 八个分组，金额与比例按正确单位显示。
6. 行操作 9 项（编辑、分配订单、复制订阅URL、重置UUID及订阅URL（加确认）、TA的订单、TA的邀请、TA的流量记录、重置流量、删除）。
7. 批量：发送邮件（范围选择、模板填充、变量提示，selected 单请求）、导出 CSV（loading、错误 Blob 解析）、批量封禁（强确认），三者均不传 sort。
8. 流量记录弹窗：5 列、倍率还原、分页 5 档。
9. 流量重置弹窗：两 Tab、原因输入、400/500 错误提示、成功刷新列表与历史。
10. 流量重置日志页：可用的列表/翻页（`pagination.total`）/筛选/导出（含 BOM）/正确时间格式。
11. 可复用组件导出给工单域：编辑用户抽屉、流量记录弹窗。
