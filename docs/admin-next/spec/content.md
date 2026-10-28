# admin-next 规格：content 域（工单 / 公告 / 知识库）

- 核实日期：2026-10-28（只读调研，未改动后端与旧后台）
- 目标：新后台（Vue 3 + TypeScript + Naive UI，入口 `/{secure_path}/next`，旧后台 `/{secure_path}` 原样保留）在本域**不少于**官方后台的全部功能；本文件 + 后端代码即可实现。
- 实现提醒：本域含聊天气泡、Markdown 编辑器、拖拽排序等 UI 渲染工作，按用户要求由主会话模型实现，不交给 `executor`。

## 0. 资料来源与通用约定

### 0.1 资料来源（均已逐一核对）

| 类别 | 位置 |
| --- | --- |
| 路由 | `app/Http/Routes/V2/AdminRoute.php`（notice L156-166、ticket L168-175、knowledge L214-224） |
| 控制器 | `app/Http/Controllers/V2/Admin/TicketController.php`、`NoticeController.php`、`KnowledgeController.php` |
| 表单校验 | `app/Http/Requests/Admin/NoticeSave.php`、`KnowledgeSave.php`（`KnowledgeSort.php`、`KnowledgeCategorySave.php`、`KnowledgeCategorySort.php` 为遗留类，**控制器未使用**） |
| 模型 | `app/Models/Ticket.php`、`TicketMessage.php`、`Notice.php`、`Knowledge.php`、`User.php` |
| 服务 / 任务 | `app/Services/TicketService.php`、`app/Console/Commands/CheckTicket.php`（`app/Console/Kernel.php` L36 每分钟执行） |
| 迁移 | `database/migrations/2023_03_19_000000_create_v2_tables.php`、`2025_01_12_190315_add_sort_to_v2_notice_table.php`、`2026_04_21_000001_fix_ticket_reply_status.php` |
| 官方前端编译包 | `public/assets/admin/assets/index-CEIYH7i8.js`：API 定义 @540600（notice/knowledge）、@542495（ticket）；菜单 @5094096；路由 @4404372 / @4406599；枚举 @5644112；公告模块 @6042275–6052600；知识库模块 @6052600–6064900；工单模块 @6478200–6501500 |
| 官方中文语言包 | `public/assets/admin/locales/zh-CN.js`：`notice` L1591-1652、`ticket` L2779-2843、`knowledge` L3003-3049、`common` L3050-3129 |
| 用户侧消费方（理解字段语义用） | `app/Http/Controllers/V1/User/NoticeController.php`、`KnowledgeController.php`、`TicketController.php`；用户主题 `theme/Xboard/assets/umi.js` |

### 0.2 请求约定

- Base URL：`{window.settings.base_url || "/"}api/v2`，所有本域接口路径为 `/api/v2/{secure_path}/<module>/<action>`。
- 中间件：`admin`（Sanctum token 且 `is_admin=true`，否则 HTTP 403 `{"message":"Unauthorized"}`）+ `log`。
- 请求头：`Authorization: <token>`、`Content-Language: <i18nextLng|zh-CN>`、`Content-Type: application/json`。POST 一律 JSON body。
- 全局中间件 `TrimStrings` + `ConvertEmptyStringsToNull` 对 JSON body 同样生效：**字符串会被 trim，空串变 `null`**。后果见各接口说明（例如 `img_url: ""` 变 `null` 可通过 `nullable|url`；`category: ""` 变 `null` 触发“分类不能为空”）。

### 0.3 响应约定

- `success($data)`：HTTP 200，`{"status":"success","message":"操作成功","data":<data>,"error":null}`。
- `fail([code, msg])`：HTTP 状态取 code 前三位（`400202`→400、`500101`→500、`422`→422、`500`→500），body `{"status":"fail","message":msg,"data":null,"error":null}`。
- `throw new ApiException(msg)`：默认 code 400 → HTTP 400，body 同 fail。
- 校验失败（FormRequest / `$request->validate`）：HTTP 422，Laravel 默认 `{"message":"<第一条错误>","errors":{"field":["..."]}}`。
- 未捕获的 PHP Error（如对 null 调用方法）：HTTP 500，`{"message":"Uh-oh, we've had some problems, we're working on it."}`（debug 模式下为异常详情）。
- **例外**：`ticket/fetch` 列表分支直接返回 `{"data":[...],"total":N}`（无 status/message）。
- 官方前端 axios 拦截器：成功返回 `response.data`（即上面的 body）；非 2xx 时 toast `body.message` 或按状态码兜底（401“登录已过期”、403“没有权限”、404“资源或接口不存在”、其他“未知异常”），401/403 触发登出。新后台应保持同等行为。

### 0.4 通用展示约定（官方实现）

- 时间格式化 `SS(ts, fmt="yyyy-MM-dd HH:mm:ss")`：`null/undefined` → 空串；10 位整数视为秒并 ×1000；按**浏览器本地时区**格式化。本域所有时间列都用默认格式 `yyyy-MM-dd HH:mm:ss`。
- 通用确认弹窗默认文案：标题“确认操作”、描述“确定要执行此操作吗？”、取消“取消”、确认“确认”、按钮样式 default；移动端用 Drawer 形态。
- 通用表格分页条（客户端/服务端分页共用）：左侧“已选择 {selected} 项，共 {total} 项”；“每页显示” 下拉 `[10,20,30,40,50,100,500]`；“第 [输入框] 页，共 {N} 页”（回车或失焦跳页，非法值回滚）；首页/上一页/下一页/末页按钮。
- 表格空状态文案：`common.table.noData` = “暂无数据”；首次加载显示骨架行（行数 = min(pageSize,10)）。
- 移动端（官方 `useIsMobile`）表格改为卡片列表，字段见各列表说明；弹窗改为底部 Drawer。
- Badge 变体（shadcn）：`default`=主色实心（浅色主题下近黑）、`secondary`=灰、`destructive`=红、`outline`=描边。Naive UI 建议映射：default→`type="primary"`（或 default 实心）、secondary→`type="default"`、destructive→`type="error"`、outline→`bordered` 的 default tag。

## 1. 菜单与路由

| 页面 | 官方菜单位置 | 官方路由（SPA 内） | 菜单图标 |
| --- | --- | --- | --- |
| 公告管理 | 系统管理（`nav:systemManagement`）→ 公告管理（`nav:noticeManagement`），位于“主题配置”之后、“支付配置”之前 | `/config/notice` | 喇叭类图标 |
| 知识库管理 | 系统管理 → 知识库管理（`nav:knowledgeManagement`），该分组最后一项 | `/config/knowledge` | 书本类图标 |
| 工单管理 | 用户管理（`nav:userManagement`）→ 工单管理（`nav:ticketManagement`），位于“用户管理”之后 | `/user/ticket` | `IconTicket` |

其他入口：

- 仪表盘“待处理工单”卡片（`dashboard:stats.pendingTickets`，值 `ticketPendingTotal` = `status=0` 的工单数，>0 时橙色高亮）点击跳转 `/user/ticket`。
- 新后台建议沿用同样的子路径与菜单分组，挂在 `/{secure_path}/next` 入口下；旧后台不受影响。

---

## 2. 工单管理（`/user/ticket`）

### 2.1 页面结构

```
工单管理页（UserEditProvider 包裹，refreshData = noop）
├─ 页头：h2 “工单管理”（ticket.title）+ 描述 “在这里可以查看用户工单，包括查看、回复、关闭等操作。”（ticket.description）
├─ 工具栏：状态 Tabs + “优先级” 多选筛选
├─ 工单表格（服务端分页）
├─ 工单详情弹窗（点行操作“查看详情”或移动端点卡片打开）
│   ├─ 左侧：工单列表侧栏（可折叠，带本地搜索）
│   └─ 右侧：工单头部（主题、状态、关闭按钮、用户/创建时间/优先级、快捷按钮）+ 消息流 + 回复框
│       ├─ “用户信息” → 打开用户编辑抽屉（user 域组件，页面级挂载）
│       ├─ “流量记录” → 打开用户流量记录弹窗（user 域组件）
│       └─ “订单记录” → 跳转订单页
└─ 用户编辑抽屉（user 域 UserEditSheet，页面级挂载一次）
```

无批量操作、无行选择列、无新建工单（管理员不能代用户开单）、无删除工单、无重新打开工单。

### 2.2 枚举

| 字段 | 值 | 中文（locale key） | 备注 |
| --- | --- | --- | --- |
| `status` | `0` OPENING | “处理中”（`ticket.status.processing`） | Tab 文案；DB 注释“已开启” |
| `status` | `1` CLOSED | “已关闭”（`ticket.status.closed`） | |
| `reply_status` | `0` 待回复（用户最后发言） | “待回复”（`ticket.status.pending`） | 2026-04-21 迁移已统一语义：0=待回复、1=已回复；新建工单默认 0 |
| `reply_status` | `1` 已回复（管理员最后发言） | “已回复”（`ticket.status.replied`） | |
| `level` | `0` LOW | “低优先”（`ticket.level.low`） | 用户侧校验 `in:0,1,2`；提现工单固定 2 |
| `level` | `1` MIDDLE | “中优先”（`ticket.level.medium`） | |
| `level` | `2` HIGH | “高优先”（`ticket.level.high`） | |

**合成状态（官方函数 `m9t`）**——列表、侧栏、详情头共用的“状态徽标”：

1. `status === 1` → “已关闭”；
2. 否则 `reply_status === 1` → “已回复”；
3. 否则 → “待回复”。

徽标颜色：列表列中 已关闭=`default`、已回复=`secondary`、待回复=`destructive`；侧栏与详情头中 已关闭=`secondary`、已回复=`secondary`、待回复=`destructive`（官方两处不一致，新后台可统一为：已关闭灰、已回复灰/绿、待回复红）。详情尚未加载时头部徽标显示“处理中”（`secondary`）。

### 2.3 列表

**数据源**：`POST ticket/fetch`，服务端分页 / 筛选 / 排序（TanStack `manualPagination/manualFiltering/manualSorting=true`）。
**查询键**：`["ticketList", pagination, columnFilters, sorting]`；无轮询。

**初始状态**：`pagination = {pageIndex:0, pageSize:20}`；`columnFilters = [{id:"status", value:"0"}]`（注意是字符串 `"0"`）；`sorting = []`。

**请求体**（官方实际发送）：

```json
{
  "pageSize": 20,
  "current": 1,
  "filter": [{"id": "status", "value": "0"}, {"id": "level", "value": [0, 2]}],
  "sort": [{"id": "updated_at", "desc": true}]
}
```

**工具栏**（`Q8t`）：

| 控件 | 行为 |
| --- | --- |
| 状态 Tabs（两格，移动端全宽） | “处理中” value `"0"`、“已关闭” value `"1"`；设置 `status` 列筛选值（字符串）。非受控，默认选中 `"0"`。切换不重置页码（官方缺陷，新后台应重置到第 1 页）。 |
| “优先级” 多选筛选（虚线按钮 + Popover 命令面板） | 选项：低优先（值 0，减号图标）、中优先（值 1，箭头图标）、高优先（值 2，箭头图标）——选项定义里带 `color: gray/yellow/red`，但筛选组件并未渲染颜色，图标统一为灰色；多选值数组写入 `level` 列筛选（空则清除）；已选 ≤2 个时在按钮内显示标签，>2 显示 “N selected”；面板底部 “Clear filters”；搜索框 placeholder 为“优先级”，无结果 “No results found.”（英文硬编码）。 |

官方列表**没有**邮箱/主题搜索框，也没有回复状态筛选（后端支持，见 2.6）。

**列定义**（顺序即显示顺序，`actions` 固定在右侧）：

| # | accessor / id | 中文标题（key） | 显示 | 排序 | 其他 |
| --- | --- | --- | --- | --- | --- |
| 1 | `id` | 工单号（`columns.id`） | `outline` 徽标显示数字 | 不可排序 | 不可隐藏 |
| 2 | `subject` | 主题（`columns.subject`） | 信封图标 + 粗体文本，`max-w-[500px]` 单行截断 | 不可排序 | 不可隐藏；宽列（size 4000） |
| 3 | `level` | 优先级（`columns.level`） | 徽标：0→“低优先”`default`、1→“中优先”`secondary`、其他→“高优先”`destructive` | **可排序**（未显式禁用，点表头发送 `sort:[{id:"level",...}]`） | `filterFn: value ∈ 选中集合`（服务端已筛，仅本地兜底） |
| 4 | `status` | 状态（`columns.status`） | 合成状态徽标（见 2.2），使用 `row.reply_status ?? 0` | 可排序（同上） | |
| 5 | `updated_at` | 最后更新（`columns.updated_at`） | 时钟图标 + `SS(updated_at)`，灰色小字 | 可排序 | |
| 6 | `created_at` | 创建时间（`columns.created_at`） | `SS(created_at)` 灰色小字 | 可排序 | 弹性宽度 |
| 7 | `actions` | 操作（`columns.actions`，右对齐） | 见下 | — | 右侧固定 |

表头排序交互（通用组件 `eQt`）：可排序列表头是 ghost 按钮，点击在 升序 ↔ 降序 间切换（未排序时先升序），图标：未排序双箭头、升序上箭头、降序下箭头。单列排序（替换而非叠加）。

**行操作**：

1. “查看详情”（眼睛图标按钮，title `actions.view_details`=“查看详情”）→ 记录 `ticketId=row.id`、`statusFilter=row.status`，打开详情弹窗。
2. “关闭工单”（X 图标，title `actions.close_ticket`=“关闭工单”）——仅 `status !== 1` 时显示。确认弹窗：
   - 标题 `actions.close_confirm_title` “确认关闭工单”
   - 描述 `actions.close_confirm_description` “确定要关闭这个工单吗？关闭后会移入已关闭列表，但仍可继续回复。”
   - 确认按钮 `actions.close_confirm_button` “确认关闭”（`destructive`），取消 `common:cancel` “取消”
   - 确认后 `POST ticket/close {id}` → toast `actions.close_success` “工单已关闭” → 刷新列表，并失效 `["ticketSidebarList"]`、`["ticketDetail"]`。

**移动端卡片**：主字段 `subject`；次字段 `id`、`status`；网格字段 `level`、`updated_at`；点卡片打开详情；卡片动作槽：未关闭时显示关闭按钮（同上确认流程，点击阻止冒泡）。

**分页**：显示通用分页条；`rowCount = response.total`；页码参数 `current = pageIndex + 1`、`pageSize`。

### 2.4 工单详情弹窗（`b9t`）

**容器**：桌面为 Dialog（`max-w-6xl`、高 `90vh`、无内边距、左右分栏）；移动端为底部 Drawer（高 `92vh`）。DialogTitle 仅供读屏（内容=工单主题，缺省“查看工单”）。

**状态**：`activeTicketId`（初值=打开时的 ticketId）、`sidebarSearch`、`replyDraft`、`sending`、`sidebarCollapsed`（初值=是否移动端）。关闭弹窗时：`activeTicketId` 重置为入参 ticketId，清空侧栏搜索与回复草稿。

#### 2.4.1 左侧：工单列表侧栏

- 宽 320px（桌面可折叠为 0，过渡 0.25s；移动端为覆盖层 `w-[86vw] max-w-80`，打开时右侧出现半透明遮罩，点遮罩收起）。
- 标题：`list.title` “工单列表”（小号大写灰字）。
- 搜索框：放大镜图标 + placeholder `list.search_placeholder` “搜索工单标题或用户邮箱”；**纯前端过滤**：`subject` 或 `user.email` 小写包含关键字（trim 后）。
- 数据：`POST ticket/fetch {filter:[{id:"status", value:[statusFilter]}]}`（值为数组 → 后端 `whereIn`），**未传 pageSize → 后端默认 10 条**，按 `updated_at` 倒序。查询键 `["ticketSidebarList", open, statusFilter]`，仅弹窗打开时请求。
  - 官方局限：侧栏最多只显示最近更新的 10 张同状态工单，搜索也只在这 10 条里搜。新后台建议传 `pageSize`（如 50）或做滚动加载，并可把搜索下沉为服务端 `filter subject like` / `email`。
- 加载中：4 组骨架。
- 空状态：有关键字 → `list.no_search_results` “未找到匹配的工单”；`statusFilter===1` → `list.no_closed_tickets` “暂无已关闭工单”；否则 `list.no_open_tickets` “暂无处理中工单”。（`list.no_tickets` “暂无工单” 未使用。）
- 列表项（`v9t`）：
  - 第一行：主题（单行截断，粗体）+ 合成状态徽标；
  - 第二行：`user.email`（灰色截断）；
  - 第三行：`SS(updated_at)`（灰色）+ 优先级胶囊：高=红底红字、中=黄底黄字、低=绿底绿字、其他=灰。
  - 当前选中项背景高亮；点击 → 切换 `activeTicketId`；移动端点击后自动收起侧栏。

#### 2.4.2 右侧头部

- 折叠按钮：桌面为头部左侧方形描边按钮（左箭头，折叠后旋转 180°），title 在 `list.expand` “展开列表” / `list.collapse` “收起列表” 间切换；移动端为左上角浮动圆形按钮（列表图标 / X 图标）。
- 第一行：`h2` 主题（截断）+ 合成状态徽标 + （未关闭时）“关闭工单” ghost 小按钮（X 图标 + `actions.close_ticket`，hover 变红）。确认弹窗同 2.3；确认后 `POST ticket/close {id: activeTicketId}` → toast “工单已关闭” → 刷新详情、刷新侧栏、失效 `["ticketList"]`。
- 第二行（灰色小字，竖线分隔）：用户图标 + `user.email`；时钟图标 + `detail.created_at` “创建于” + 空格 + `SS(created_at)`；优先级 `outline` 徽标（`level` 为 null 时空）。
- 右侧快捷按钮（仅 `ticket.user` 存在时显示，均为 ghost 图标按钮）：
  1. “用户信息”（`detail.user_info`）→ `setEditingUser(ticket.user)` 并打开用户编辑抽屉（user 域）。传入对象即 `transformUserData` 结果（见 2.6.2），**不含 `invite_user` 关系**，抽屉只提交改动字段，因此不影响邀请人。抽屉保存后页面 `refreshData` 为空操作，详情依靠 5 秒轮询刷新。
  2. “流量记录”（`detail.traffic_records`）→ 打开用户流量记录弹窗（user 域 `E8t`）：标题“流量使用记录”，`POST stat/getStatUser {user_id, pageSize, page}`（服务端分页，默认 20，可选 10/20/30/40/50），列：时间（`record_at`，`yyyy-MM-dd`）、上行流量（`u / server_rate`，字节换算 B/KB/MB/GB/TB 保留 2 位）、下行流量（`d / server_rate`）、倍率（`{server_rate}x` 描边徽标）、总计（`u + d`，右对齐）；空状态“暂无记录”；分页文案“每页显示 [n] 条记录”、“第 {current} / {total} 页”。
  3. “订单记录”（`detail.order_records`）→ 路由跳转 `/finance/order?user_id=<user.id>`（**官方缺陷**：未带 `eq:` 前缀，订单页会按 `user_id like %id%` 模糊匹配，详见 §5 R-T1）。

#### 2.4.3 消息流

- 数据：`GET ticket/fetch?id=<activeTicketId>`，查询键 `["ticketDetail", activeTicketId, open]`；**弹窗打开时每 5 秒轮询**（`refetchInterval: 5000`，后台标签页不轮询）；失败重试 3 次。首次加载显示骨架（标题 + 3 个气泡）。
- `messages.length === 0` → 居中灰字 `detail.no_messages` “暂无消息记录”。
- 每条消息：`isAdmin = msg.is_from_admin ?? !msg.is_me`；
  - 管理员消息：靠右（`sent`），主色背景、主色前景文字，圆角（左侧与右上）；
  - 用户消息：靠左（`received`），次要背景；
  - 气泡最大宽 60%，内容：顶部 10px 小字发送者 `detail.sender_admin` “管理员” / `detail.sender_user` “用户”；正文 `whitespace-pre-wrap break-words` **纯文本渲染**（不得 v-html / Markdown）；底部右对齐 10px 时间 `SS(created_at)`。
- 自动滚动：弹窗打开或 `messages` 变化时，先瞬时滚到底，再 300ms 后平滑滚到底。
- 官方未展示 `last_reply_user`、消息 `user.email`；新后台可在气泡发送者处补充显示 `msg.user.email`（管理员多人协作时有用），属增强项。

#### 2.4.4 回复框

- 已关闭时上方提示 `detail.input.closed_hint` “该工单已关闭，你仍可以继续回复，新的消息会追加到当前工单。”
- 多行输入（`ChatInput`，`resize-none`，约 2 行高）：placeholder 未关闭 `detail.input.reply_placeholder` “输入回复内容...”、已关闭 `detail.input.closed_reply_placeholder` “工单已关闭，仍可继续回复...”；发送中禁用。
- 键盘：`Enter` 发送；`Shift+Enter` 换行。（新后台注意 IME 组合输入：`isComposing` 时不应发送，官方未处理。）
- 发送按钮：文案 `detail.input.send` “发送” / 发送中 `detail.input.sending` “发送中...”；`sending || draft.trim()===""` 时禁用；移动端全宽。
- 发送流程：`message = draft.trim()`；为空或发送中直接返回 → `POST ticket/reply {id: activeTicketId, message}` → 成功后清空草稿 → 并行刷新详情 / 侧栏 / 失效 `["ticketList"]` → 滚到底 → 输入框重新聚焦；失败由全局拦截器 toast，草稿保留。
- 官方切换侧栏工单时**不清空草稿**（易误发到另一工单），新后台建议切换时清空或按工单分别保存草稿。

### 2.5 接口

#### 2.5.1 `ANY ticket/fetch` —— 列表分支（`id` 为空 / 0 / 未传）

官方用 `POST` + JSON body。后端读取：

| 参数 | 类型 | 后端行为 | 官方是否使用 |
| --- | --- | --- | --- |
| `current` | int，默认 1 | 页码（`$request->integer`） | 是 |
| `pageSize` | int，默认 10 | 每页条数，无上限 | 列表是（20）；侧栏否（→10） |
| `filter` | `Array<{id:string, value:string\|number\|array}>` | 逐项 `where(id, ...)`：value 为数组 → `whereIn(id, value)`；否则 → `where(id, 'like', "%value%")`。`id` 直接作为列名（必须是 `v2_ticket` 的列，否则 SQL 错误 500） | 是：`status`（列表为字符串 → like；侧栏为数组 → whereIn）、`level`（数组） |
| `sort` | `Array<{id:string, desc:boolean}>` | 逐项 `orderBy(id, desc?DESC:ASC)`；**缺 `desc` 键会 500**；之后总是追加 `latest('updated_at')` | 是 |
| `status` | int | `where('status', value)`；**键存在即生效**，空串会被转 null → `whereNull` → 结果为空 | 否 |
| `reply_status` | int[] | `whereIn('reply_status', value)`，必须是数组 | 否 |
| `email` | string | `whereHas('user', email = value)` **精确匹配**；空串同样会导致结果为空 | 否 |

默认排序：用户 `sort` 之后按 `updated_at DESC`。可用于 filter 的有效列：`id`、`user_id`、`subject`、`level`、`status`、`reply_status`、`last_reply_user_id`、`created_at`、`updated_at`。可用于 sort 的同上。

响应（HTTP 200，无 status 包装）：

```json
{ "data": [TicketListItem, ...], "total": 123 }
```

#### 2.5.2 `GET ticket/fetch?id=<id>` —— 详情分支

- 加载关系：`messages.user:id,email,is_admin,is_staff`、`user`、`lastReplyUser:id,email,is_admin,is_staff`。
- 成功：`success(TicketDetail)`。
- 不存在：HTTP 400 `{"status":"fail","message":"工单不存在"}`。

#### 2.5.3 `POST ticket/reply`

| 参数 | 校验 | 说明 |
| --- | --- | --- |
| `id` | `required|numeric`（“工单ID不能为空”） | 工单 ID |
| `message` | `required|string`（“消息不能为空”） | 会被 trim；全空白 → null → 422 |

- 成功：`success(true)`。
- 副作用（`TicketService::replyByAdmin`）：
  1. 事务内新增 `v2_ticket_message`（`user_id` = 当前管理员）；
  2. `reply_status` = 1（若操作者恰是工单发起人本人则为 0）；`last_reply_user_id` = 管理员 ID；`updated_at` 刷新；**`status` 不变**（已关闭的工单保持关闭，回复照样追加）；
  3. 触发插件钩子 `ticket.reply.admin.after`，参数 `[Ticket, TicketMessage]`；
  4. 给工单发起人发邮件（队列 `SendEmailJob`，模板 `notify`，主题“您在{app_name}的工单得到了回复”，内容含主题与回复正文），**同一用户 30 分钟内只发一次**（缓存键 `ticket_sendEmailNotify_{user_id}`）。
- 错误：422 校验；HTTP 400 “工单不存在” / “工单回复失败”（ApiException）。

#### 2.5.4 `POST ticket/close`

- 参数：`id`（`required|numeric`，“工单ID不能为空”）。官方发送 `{"id": 41}`。
- 成功：`success(true)`；副作用：`status = 1`，`updated_at` 刷新。无通知、无钩子。
- 错误：HTTP 400 “工单不存在”；HTTP 500 “关闭失败”。
- **没有“重新打开”接口**：关闭后管理员只能继续回复，无法恢复为处理中；用户侧对已关闭工单回复会被拒绝（“The ticket is closed and cannot be replied”）。

#### 2.5.5 相关接口（他域，工单页会调用）

| 接口 | 用途 | 归属规格 |
| --- | --- | --- |
| `POST stat/getStatUser {user_id, pageSize, page}` → `{data: StatUser[], total}` | 流量记录弹窗 | user 域 |
| `POST user/update`（仅改动字段）、`GET plan/fetch` | 用户编辑抽屉 | user 域 |
| `POST order/fetch {filter:[{id:"user_id", value:"eq:<id>"}], ...}` | 订单记录跳转后的订单页 | finance 域 |

#### 2.5.6 后端有但官方 UI 未用

- `ticket/fetch` 的 `status`、`reply_status`、`email` 顶层参数，以及 `filter` 的 `subject`（like）/ `reply_status`（数组）——可直接用于新后台增强筛选（主题搜索、邮箱搜索、回复状态筛选），无需改后端。
- `TicketController::show($ticketId)` 方法存在但**没有路由**，不可用。

### 2.6 数据结构

#### 2.6.1 `v2_ticket` / `v2_ticket_message`

| 表.列 | 类型 | 说明 |
| --- | --- | --- |
| `v2_ticket.id` | int PK | |
| `user_id` | int | 发起用户 |
| `subject` | varchar(255) | 主题 |
| `level` | int | 0/1/2 |
| `status` | int 默认 0 | 0 开启、1 关闭 |
| `reply_status` | int 默认 0 | 0 待回复、1 已回复 |
| `last_reply_user_id` | int null | 最后回复人 |
| `created_at` / `updated_at` | int（Unix 秒） | 模型 `dateFormat='U'`，JSON 输出为整数秒 |
| `v2_ticket_message.id` | int PK | |
| `user_id` / `ticket_id` | int | |
| `message` | text | 纯文本（用户输入，可能含 HTML/脚本，必须转义显示） |
| `created_at` / `updated_at` | int（Unix 秒） | |

#### 2.6.2 TypeScript 类型（按后端实际输出）

```ts
type TicketStatus = 0 | 1;           // 0 处理中/开启, 1 已关闭
type TicketReplyStatus = 0 | 1;      // 0 待回复, 1 已回复
type TicketLevel = 0 | 1 | 2;        // 低/中/高

interface UserBrief { id: number; email: string; is_admin: boolean; is_staff: boolean }

// UserController::transformUserData：User::toArray()（隐藏 password）+ 转换
interface TicketUser {
  id: number; email: string;
  balance: number;              // 已 /100，单位“元”
  commission_balance: number;   // 已 /100，单位“元”
  subscribe_url: string;        // Helper::getSubscribeUrl(token)
  // 其余为 v2_user 全部列（u、d、transfer_enable、expired_at、plan_id、banned、is_admin、is_staff、token、remarks …）
  // 另可能被插件钩子 admin.user.transform 追加字段
  [k: string]: unknown;
}

interface TicketListItem {
  id: number; user_id: number; subject: string; level: TicketLevel;
  status: TicketStatus; reply_status: TicketReplyStatus | null;
  last_reply_user_id: number | null;
  created_at: number; updated_at: number;
  user: TicketUser;
  last_reply_user: UserBrief | null;
}

interface TicketMessage {
  id: number; user_id: number; ticket_id: number; message: string;
  created_at: number; updated_at: number;
  is_from_user: boolean;   // message.user_id === ticket.user_id
  is_from_admin: boolean;  // message.user_id !== ticket.user_id
  user: UserBrief | null;
}

interface TicketDetail extends TicketListItem { messages: TicketMessage[] }  // 消息未显式排序，建议前端按 id 升序
```

注意：后端 `level` 等数值字段为 number，官方用 `===` 比较；新后台建议统一 `Number()` 归一化再比较。

### 2.7 后台任务、配置与插件

- 自动关闭：`check:ticket` 每分钟执行，把 `status=0`、`reply_status=1`、`updated_at ≤ now-24h` 且 `last_reply_user_id ≠ user_id` 的工单关闭（管理员回复后用户 24 小时未回应即自动关闭）。新后台可在页面描述或关闭提示中说明，但无需额外接口。
- 系统配置 `ticket_must_wait_reply`（“工单等待回复限制”，在系统配置-站点里，settings 域）：只影响用户侧连续发言，不影响管理员回复。
- 插件钩子：`ticket.create.after`（Ticket）、`ticket.reply.user.after`（Ticket）、`ticket.reply.admin.after`（[Ticket, TicketMessage]）。
- **AI 自动回复调研结论**：
  - 官方后台 UI 中没有任何 AI 自动回复相关入口、开关、标识或文案（编译包与 zh-CN 语言包均无 `auto_reply` / `ai_reply` / “自动回复”）；聊天气泡组件自带的 `layout:"ai"` 变体在工单页**未被使用**。
  - 仓库 `plugins/` 目录为空（仅 `.gitignore`）；`plugins-core/` 中与工单相关的只有 `Telegram` 插件：配置项 `enable_ticket_notify`（“开启工单通知”，默认 true），在用户新建/回复工单时推送 TG 通知；管理员在 TG 中回复该通知消息即调用 `TicketService::replyByAdmin` 代为回复（所以详情页可能出现非本页面发出的管理员消息，靠 5 秒轮询显示）。
  - 若将来安装 AI 回复插件，其管理页面会走通用插件页面路由 `plugins/:pluginCode/*`（plugin 域），工单页无需预留专门位置；消息若由插件以某账号身份写入，仍按 `is_from_admin` 区分左右。

---

## 3. 公告管理（`/config/notice`）

### 3.1 页面结构

```
公告管理页
├─ 页头：h2 “公告管理”（notice.title）+ 描述 “在这里可以配置公告，包括添加、删除、编辑等操作。”
├─ 工具栏：[添加公告] [搜索公告标题...] [重置]            右侧：[编辑排序 / 保存排序]（仅 md 以上）
├─ 公告表格（客户端分页/搜索/排序；排序模式下支持行拖拽）
└─ 公告表单弹窗（添加 / 编辑共用）
```

### 3.2 列表

- 数据：`GET notice/fetch`，一次取全部；查询键 `["notices"]`；数据拷贝到本地数组用于拖拽重排。
- 默认分页：`pageSize 50`（排序模式下 99999 且隐藏分页条）。
- 搜索：`title` 列客户端过滤（不区分大小写的包含匹配），placeholder `table.toolbar.search` “搜索公告标题...”；有筛选时出现 ghost 按钮 `table.toolbar.reset` “重置”（带 X 图标），点击清空全部筛选。排序模式下隐藏“添加公告”、搜索框和重置按钮。
- 列定义：

| # | accessor / id | 中文标题（key） | 显示 | 排序 | 其他 |
| --- | --- | --- | --- | --- | --- |
| 1 | `drag-handle` | （空） | 拖拽手柄图标（cursor-move） | 否 | 仅排序模式可见；宽 40 |
| 2 | `id` | ID（`table.columns.id`） | `outline` 等宽徽标 | 可（客户端） | 宽 60 |
| 3 | `show` | 显示状态（`table.columns.show`） | Switch（非受控 `defaultChecked=row.show`） | 否 | 宽 100；排序模式下仍可点 |
| 4 | `title` | 标题（`table.columns.title`） | 粗体，`max-w-[500px]` 单行截断 | 否 | 宽列 |
| 5 | `actions` | 操作（`table.columns.actions`，右对齐） | 编辑图标按钮、删除图标按钮 | — | 右侧固定；排序模式下隐藏 |

（官方未展示 `content`、`tags`、`img_url`、`created_at/updated_at`；列可见性状态里出现的 `content`、`created_at` 并无对应列。新后台可增加“标签”“更新时间”列作为增强。）

- “显示状态” Switch：切换即 `POST notice/show {id}`（后端取反）；返回 `data` 为假值时重新拉取列表；请求异常时官方不回滚 Switch（缺陷，新后台应受控 + 失败回滚）。
- 行操作：
  1. 编辑（铅笔图标，读屏文案 `table.actions.edit` “编辑”）→ 打开表单弹窗（type=edit，初值为该行完整对象）。
  2. 删除（垃圾桶图标，hover 红色，读屏文案“删除确认”）→ 确认弹窗：标题 `table.actions.delete.title` “删除确认”、描述 `table.actions.delete.description` “确定要删除该条公告吗？此操作无法撤销。”、确认按钮使用默认“确认”（default 样式，非 destructive）、取消“取消” → `POST notice/drop {id}` → toast `table.actions.delete.success` “删除成功” → 重新拉取。（官方不检查返回 data。）
- 移动端卡片：主字段 `title`；排序按钮在移动端不显示（无法排序）。
- 表格虽开启 `enableRowSelection`，但没有选择列，无批量操作。

### 3.3 排序模式

- 入口：工具栏右侧按钮，`rowCount > 0` 且桌面宽度时显示；非排序模式文案 `table.toolbar.sort.edit` “编辑排序”（outline），排序模式 `table.toolbar.sort.save` “保存排序”（default 实心）。
- 进入排序模式：显示拖拽列、隐藏操作列、`pageSize=99999` 并回到第一页、隐藏分页条、隐藏添加/搜索/重置。
- 拖拽：HTML5 原生 DnD，整行 `draggable`；拖起时行半透明，悬停目标行加 `bg-muted`；放下时把本地数组 `from → to` 移位（索引来自当前渲染行序号）。
- 保存：`POST notice/sort {ids: 本地数组的 id 顺序}` → toast “排序保存成功”（硬编码中文）→ 退出排序模式 → 重新拉取；请求失败也会退出排序模式（`finally`）。
- **官方缺陷**：拖拽索引取的是“当前渲染行”的序号，而重排的是完整本地数组；若进入排序模式前存在标题筛选或按 ID 排序，会排错。新后台进入排序模式时应清空筛选与排序（或直接对可见行列表重排）。
- 后端排序语义：`sort = 数组下标 + 1`；列表按 `sort ASC, id DESC`。新建公告 `sort` 为 NULL，MySQL 中 NULL 在 ASC 排序里排最前，所以**新公告默认置顶**，直到保存一次排序。

### 3.4 表单弹窗（添加 / 编辑）

- 触发：工具栏“添加公告”按钮（outline sm，`+` 图标 + `form.add.button` “添加公告”）；行内编辑按钮。
- 容器：Dialog `max-w-4xl`，头部标题 add→`form.add.title` “添加公告”、edit→`form.edit.title` “编辑公告”；副标题 `form.description`（zh-CN 无此 key，回落文案“发布或编辑系统公告，支持 Markdown 格式。”）；内容区最大高度 70vh 可滚动；底部 `取消`（`form.buttons.cancel`）/ `提交`（`form.buttons.submit`）。
- zod schema（`H2t`）与默认值（`z2t`）：

| 字段 key | 类型 | 中文标签（key） | 必填 | 默认值（新增） | 前端校验 | 控件 / 联动 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | number \| null | —（隐藏） | 否 | `null` | `number().nullable()` | 编辑时为行 id |
| `title` | string | 标题（`form.fields.title.label`） | 是 | `""` | `min(1).max(250)` | 单行输入，placeholder “请输入公告标题” |
| `content` | string | 公告内容（`form.fields.content.label`） | 是 | `""` | `min(1)` | Markdown 编辑器（见下），高 400px |
| `img_url` | string \| null | 公告背景（`form.fields.img_url.label`） | 否 | `""` | `string().nullable()`（前端不校验 URL） | 单行输入，placeholder “请输入公告背景图片URL”；`null` 显示为空串 |
| `tags` | string[] | 节点标签（`form.fields.tags.label`，官方文案如此，实为“公告标签”） | 否 | `[]` | `array(string())` | 标签输入（见下），placeholder “输入后回车添加标签” |
| `show` | boolean | 显示（`form.fields.show.label`） | 否 | `false` | `boolean()` | Switch |

布局：标题 → 内容 → 公告背景 → 两列网格（标签 | 显示）。校验模式 `onChange`，出错聚焦首个错误字段，错误文字 10px（zod 默认英文提示；新后台建议换成中文：“标题不能为空”“内容不能为空”等，与后端一致）。

- Markdown 编辑器（官方 `react-markdown-editor-lite` + `markdown-it({html:true})`）：配置 `view {menu:true, md:true, html:false}`、`canView {menu:true, md:true, html:false, fullScreen:false, hideMenu:false}` —— 即**只有工具栏 + Markdown 文本区，无预览、无全屏**。onChange 取纯文本。新后台可用任一 Vue Markdown 编辑器或 `NInput type="textarea"` + 工具栏；若增加预览，必须做 HTML 消毒（见 §5 R-X2）。引入新的编辑器依赖需主会话确认。
- 标签输入（`InputTags`）：已选标签显示为 `secondary` 徽标，每个带 X 删除；输入框按 `Enter` 或 `,` 把当前文本加为标签（Set 去重、不 trim）；输入中含逗号时按逗号拆分并 trim 后批量加入（可能产生空串标签——官方缺陷，新后台应过滤空串）；输入为空时 `Backspace` 删除最后一个标签；非数组值按空数组显示。
- 提交：`handleSubmit` 通过后 `POST notice/save <zod 解析后的值>`（zod 会剥离 `sort/created_at/updated_at` 等多余键），即：

```json
{ "id": null, "title": "维护公告", "content": "**markdown**", "img_url": "", "tags": ["弹窗"], "show": false }
```

  成功（`data` 为真）→ toast `form.buttons.success` “提交成功” → 刷新列表 → 关闭弹窗。官方**新增成功后不重置表单**（再次打开“添加公告”会带出上次内容），新后台应在新增成功或关闭时重置。
- 编辑初值：行对象（`notices` 列表项），`tags` 若为 `null` 会使 zod `array` 校验失败而无法提交（官方缺陷），新后台初始化时应 `tags ?? []`、`img_url ?? ""`。

### 3.5 接口

| 方法 路径 | 官方请求 | 后端读取与校验 | 响应 / 副作用 | 错误 |
| --- | --- | --- | --- | --- |
| `GET notice/fetch` | 无参数 | — | `success(Notice[])`，全部记录，`ORDER BY sort ASC, id DESC` | — |
| `POST notice/save` | 见 3.4 | `NoticeSave`：`title` required（“标题不能为空”）、`content` required（“内容不能为空”）、`img_url` `nullable|url`（“图片URL格式不正确”）、`tags` `nullable|array`（“标签格式不正确”）；写入字段 `only(title, content, img_url, tags, show, popup)`；`id` 为真 → 更新，否则新增 | `success(true)` | 422 校验；新增失败 HTTP 500 “保存失败”；更新时 id 不存在 → 对 null 调方法，HTTP 500 通用错误（未被 `catch(\Exception)` 捕获）；**传入 `popup` 会因列不存在而 SQL 报错**（见 R-N1） |
| `POST notice/show` | `{id}` | `id` 为空 → HTTP 500 “公告ID不能为空” | 取反 `show`，`success(true)` | HTTP 400 “公告不存在”；HTTP 500 “保存失败” |
| `POST notice/drop` | `{id}` | `id` 为空 → HTTP 422 “公告ID不能为空” | 物理删除，`success(true)` | HTTP 400 “公告不存在”；HTTP 500 “删除失败” |
| `POST notice/sort` | `{ids: number[]}` | `ids` `required|array` | 事务内逐个 `findOrFail` 并写 `sort = index+1`（会刷新 `updated_at`），`success(true)` | 422；任一 id 不存在整体回滚 → HTTP 500 “排序保存失败” |
| `POST notice/update` | 官方未使用 | **控制器没有 `update` 方法** | 调用即 HTTP 500（BadMethodCallException） | 新后台**不得使用** |

### 3.6 数据结构

`v2_notice`：`id` int PK、`sort` int null（有索引）、`title` varchar(255)、`content` text、`show` tinyint 默认 0、`img_url` varchar(255) null、`tags` varchar(255) null（模型 cast `array`，存 JSON 字符串）、`created_at`/`updated_at` int（Unix 秒）。**没有 `popup` 列。**

```ts
interface Notice {
  id: number; sort: number | null; title: string; content: string;
  show: boolean; img_url: string | null; tags: string[] | null;
  created_at: number; updated_at: number;
}
```

用户侧语义（理解字段用）：用户端 `GET /user/notice/fetch` 只返回 `show=true`、每页 5 条、同样 `sort ASC, id DESC`；默认用户主题（`theme/Xboard`）把**含标签“弹窗”的第一条公告**作为登录后弹窗，`img_url` 作为公告卡片背景，`content` 按 Markdown 渲染。新后台可在标签输入旁给出“添加标签‘弹窗’即在用户端弹窗显示”的提示（增强，不改接口）。

---

## 4. 知识库管理（`/config/knowledge`）

### 4.1 页面结构

```
知识库管理页
├─ 页头：h2 “知识库管理”（knowledge.title）+ 描述 “在这里可以配置知识库，包括添加、删除、编辑等操作。”
├─ 工具栏：非排序模式 [添加知识] [搜索知识...] [分类 多选筛选] [重置]   右侧：[编辑排序 / 保存排序]（md 以上）
│          排序模式 提示文字 “拖拽知识条目进行排序，完成后点击保存”
├─ 知识表格（客户端分页/搜索/筛选/排序；排序模式下拖拽）
└─ 知识表单弹窗（添加 / 编辑共用；编辑时按 id 拉取详情）
```

### 4.2 列表

- 数据：`GET knowledge/fetch`（只含 `id,title,category,show,updated_at`，按 `sort ASC`）；查询键 `["knowledge"]`；拷贝到本地数组。
- 分页：客户端，`pageSize 10`（组件初值 20，挂载后被排序模式副作用改为 10；排序模式 99999 并隐藏分页条）。
- 工具栏（非排序模式）：
  - 添加按钮（outline sm，`+` 图标 + `form.add` “添加知识”）。
  - 搜索框：`title` 列客户端过滤，placeholder `toolbar.searchPlaceholder` “搜索知识...”。
  - “分类” 多选筛选（`columns.category`）：选项 = 当前数据中 `category` 去重（label=value=分类名），选项右侧显示该分类条数（faceted 计数）；已选 ≤2 显示标签、>2 显示 “N selected”；“Clear filters”、“No results found.” 英文硬编码。**官方缺陷**：列使用默认 `auto` 过滤函数（字符串包含），多选时把数组 `toString()` 成 “a,b” 去做包含匹配，导致**多选基本无结果、单选是子串匹配**；新后台应实现“分类 ∈ 选中集合”的精确匹配。
  - 有筛选时显示 ghost 按钮 `toolbar.reset` “重置”（带 X 图标）。
- 列定义：

| # | accessor / id | 中文标题（key） | 显示 | 排序 | 其他 |
| --- | --- | --- | --- | --- | --- |
| 1 | `drag-handle` | （无表头） | 拖拽图标；排序模式 `cursor-move`，否则透明 | 否 | 仅排序模式可见；宽 40 |
| 2 | `id` | ID（`columns.id`） | `outline` 等宽徽标 | 可（客户端） | 宽 70 |
| 3 | `show` | 状态（`columns.status`） | Switch（非受控） | 否 | 宽 100 |
| 4 | `title` | 标题（`columns.title`） | 粗体，最多两行（line-clamp-2） | 可 | 宽 600 |
| 5 | `category` | 分类（`columns.category`） | `secondary` 徽标，最大宽 180px 截断 | 可 | 宽 1800 |
| 6 | `actions` | 操作（`columns.actions`，右对齐） | 编辑、删除图标按钮 | — | 右侧固定；排序模式隐藏 |

（官方列表**不显示语言**——列表接口也不返回 `language`。见 §5 R-K3。）

- “状态” Switch：`POST knowledge/show {id}`（取反）；`data` 为假值时重新拉取；异常不回滚（同公告缺陷）。
- 行操作：
  1. 编辑（铅笔图标，读屏 `form.edit` “编辑知识”）→ 打开表单弹窗 type=edit，初值为行对象，打开后拉取详情覆盖。
  2. 删除（垃圾桶图标）→ 确认弹窗：标题 `messages.deleteConfirm` “确认删除”、描述 `messages.deleteDescription` “此操作将永久删除该知识库记录，删除后无法恢复。确定要继续吗？”、确认 `messages.deleteButton` “删除”（`destructive`）、取消“取消” → `POST knowledge/drop {id}` → `data` 为真时 toast `messages.operationSuccess` “操作成功” 并重新拉取。
- 移动端卡片：主字段 `title`，网格字段 `category`、`show`；移动端无排序按钮。

### 4.3 排序模式

与公告一致（§3.3），差异点：

- 进入排序模式：列可见性 `{drag-handle: true, actions: false}`；`pageSize=99999`；工具栏左侧替换为提示 `toolbar.sortModeHint` “拖拽知识条目进行排序，完成后点击保存”（搜索、分类筛选、添加按钮隐藏，但已生效的筛选/排序状态仍保留——同样会导致拖拽索引错位）。
- 按钮文案 `toolbar.editSort` “编辑排序” / `toolbar.saveSort` “保存排序”。
- 保存：`POST knowledge/sort {ids}` → 重新拉取 → 退出排序模式 → toast “排序保存成功”（硬编码）。失败时官方**不退出**排序模式（无 finally）。
- 后端：逐个 `find` 后写 `sort = index+1`，**关闭时间戳**（不刷新 `updated_at`）；写库异常 → 回滚并抛“保存失败”（HTTP 400）；但任一 id 不存在时是对 null 赋值（PHP Error，`catch(\Exception)` 抓不到）→ HTTP 500 通用错误，事务随连接结束回滚。
- 新建知识 `sort` 为 NULL，同样默认排在最前。
- 注意排序是全局的（不分语言、不分分类）；用户端按 `language` 过滤后再按 `sort ASC` 并按分类分组，所以全局顺序决定了每个分类内的文章顺序。

### 4.4 表单弹窗（添加 / 编辑）

- 容器：Dialog `max-w-4xl`；标题 add→`form.add` “添加知识”、edit→`form.edit` “编辑知识”；副标题 `form.description`（缺 key，回落“发布或编辑知识库文章，支持多语言和 Markdown 格式。”）；内容最大高 70vh 滚动；底部 `form.cancel` “取消” / `form.submit` “提交”。
- 编辑模式：弹窗打开且有 `id` 时 `GET knowledge/fetch?id=<id>`，用返回的完整记录 `reset` 表单（期间显示的是行对象里的 title/category/show，`language`/`body` 为空）。新后台应在详情加载完成前显示 loading 并禁用提交。
- zod schema（`Z2t`）与默认值（`Y2t`）：

| 字段 key | 类型 | 中文标签（key） | 必填（后端） | 默认值（新增） | 前端校验 | 控件 / 联动 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | number \| null | —（隐藏） | 否 | `null` | `number().nullable()` | |
| `title` | string | 标题（`form.title`） | 是 | `""` | `min(1).max(250)` | 单行输入，placeholder `form.titlePlaceholder` “请输入知识标题” |
| `category` | string | 分类（`form.category`） | 是 | `""` | `max(250)`（前端允许空，后端 required → 422 “分类不能为空”） | 自由文本输入，placeholder `form.categoryPlaceholder` “请输入分类，分类将会自动归类”；官方未提供下拉建议 |
| `language` | string | 语言（`form.language`） | 是 | `"zh-CN"` | `max(250)` | 下拉，placeholder `form.languagePlaceholder` “请选择语言”；选项见下 |
| `show` | boolean | 显示（`form.show`） | 否 | `false` | `boolean()` | Switch |
| `body` | string | 内容（`form.content`） | 是 | `""` | `min(1)` | Markdown 编辑器，配置同公告（§3.4），高 400px |

布局：两列（标题 | 分类）→ 两列（语言 | 显示）→ 内容。

- 语言选项（value → 显示文案 `knowledge.languages.*`，各语言包均为本族语名）：

| value | 显示 |
| --- | --- |
| `en-US` | English |
| `ja-JP` | 日本語 |
| `ko-KR` | 한국어 |
| `vi-VN` | Tiếng Việt |
| `zh-CN` | 简体中文 |
| `zh-TW` | 繁體中文 |
| `ru-RU` | Русский |

  DB 列 `language char(5)`，只能存 5 字符代码；新后台不要允许自由输入。

- 提交：`POST knowledge/save <zod 解析后的值>`：

```json
{ "id": null, "language": "zh-CN", "category": "使用教程", "title": "Windows 客户端", "body": "...", "show": false }
```

  成功（`data` 为真）→ 表单 `reset()` → toast `messages.operationSuccess` “操作成功” → 关闭弹窗 → 重新拉取列表。

- 正文能力提示（官方 UI 未提示，后端用户侧已支持，建议新后台在编辑器下方给出说明，纯文案增强）：
  - 占位符：`{{siteName}}`（站点名）、`{{subscribeUrl}}`（当前用户订阅链接）、`{{urlEncodeSubscribeUrl}}`（URL 编码后的订阅链接）、`{{safeBase64SubscribeUrl}}`（URL 安全 Base64 的订阅链接）；
  - 付费可见区块：`<!--access start-->...<!--access end-->` 之间的内容仅对有有效订阅的用户显示，否则替换为“需要有效订阅才能查看”的提示块。

### 4.5 接口

| 方法 路径 | 官方请求 | 后端读取与校验 | 响应 / 副作用 | 错误 |
| --- | --- | --- | --- | --- |
| `GET knowledge/fetch` | 无参数 | — | `success(KnowledgeListItem[])`：只选 `title,id,updated_at,category,show`，`ORDER BY sort ASC` | — |
| `GET knowledge/fetch?id=<id>` | `id` 查询参数 | `id` 为真走详情 | `success(Knowledge)` 完整记录 | id 不存在 → 对 null 调 `toArray()`，HTTP 500 通用错误（后面的“知识不存在”判断是死代码） |
| `GET knowledge/getCategory` | 官方未使用 | — | `success(string[])`：全表（含隐藏文章、所有语言）按 `category` 分组后的分类名，去重，按首次出现顺序（查询无 ORDER BY，通常即 id 顺序） | — |
| `POST knowledge/save` | 见 4.4 | `KnowledgeSave`：`category` required（“分类不能为空”）、`language` required（“语言不能为空”）、`title` required（“标题不能为空”）、`body` required（“内容不能为空”）、`show` `nullable|boolean`（“显示状态必须为布尔值”）；写入 `validated()` 字段（即这 5 个，`sort` 不可经此接口修改）；`id` 为真 → 更新 | `success(true)` | 422；新增失败 HTTP 500 “创建失败”；更新时 id 不存在 → 对 null 调方法，HTTP 500 通用错误（`catch(\Exception)` 抓不到 Error） |
| `POST knowledge/show` | `{id}` | `id` `required|numeric`（“知识库ID不能为空”） | 取反 `show`，`success(true)` | 422；HTTP 400 “知识不存在” / “保存失败” |
| `POST knowledge/drop` | `{id}` | `id` `required|numeric`（“知识库ID不能为空”） | 物理删除，`success(true)` | 422；HTTP 400 “知识不存在”；HTTP 500 “删除失败” |
| `POST knowledge/sort` | `{ids: number[]}` | `ids` `required|array`（“参数有误”） | 事务内写 `sort=index+1`，不改 `updated_at`，`success(true)` | 422；HTTP 400 “保存失败”；含不存在的 id → HTTP 500 通用错误 |

遗留但**未接线**的请求类：`KnowledgeSort`（`knowledge_ids`）、`KnowledgeCategorySave`（`name`,`language`）、`KnowledgeCategorySort`（`knowledge_category_ids`）——不存在知识分类表与接口，分类只是 `v2_knowledge.category` 文本列，新后台不要实现“分类管理”CRUD。

### 4.6 数据结构

`v2_knowledge`：`id` int PK、`language` char(5)、`category` varchar(255)、`title` varchar(255)、`body` text、`sort` int null、`show` tinyint 默认 0、`created_at`/`updated_at` int（Unix 秒）。

```ts
interface KnowledgeListItem { id: number; title: string; category: string; show: boolean; updated_at: number }
interface Knowledge extends KnowledgeListItem { language: string; body: string; sort: number | null; created_at: number }
```

用户侧语义：`GET /user/knowledge/fetch?language=<用户界面语言>&keyword=` 只返回 `show=1` 且语言精确匹配的文章，按 `sort ASC` 后按 `category` 分组；所以“语言”决定文章出现在哪个语言界面，“分类”决定分组标题。

---

## 5. 差异与风险

### 5.1 官方 UI 与后端不一致 / 官方缺陷（新后台应修正，均不需改后端）

| 编号 | 问题 | 新后台处理 |
| --- | --- | --- |
| R-T1 | 工单详情“订单记录”跳转 `/finance/order?user_id=<id>`，订单页把它作为 `like %id%` 过滤，会混入其他用户（如 id 12 匹配 112、120）。用户列表页的同类入口用的是 `user_id=eq:<id>`。 | 跳转时使用 `user_id=eq:<id>`。 |
| R-T2 | 详情侧栏未传 `pageSize`，只拿到 10 条；侧栏搜索只在这 10 条中进行。 | 传更大的 `pageSize` 或分页加载；搜索可走服务端（`filter subject like` / `email`）。 |
| R-T3 | 列表状态筛选用字符串 `"0"/"1"` 走 `like` 匹配（碰巧可用）；切换 Tab 不重置页码。 | 用数组 `[0]`/`[1]` 走 `whereIn`，切换筛选时重置到第 1 页。 |
| R-T4 | 列表与侧栏/详情头的“已关闭”徽标颜色不一致。 | 统一颜色映射。 |
| R-T5 | 切换侧栏工单不清空回复草稿，存在误发风险；Enter 发送未处理 IME 组合输入。 | 切换时清空或按工单隔离草稿；`isComposing` 时不发送。 |
| R-N2 | 编辑 `tags=null` 的公告时 zod `array` 校验失败，无法提交。 | 初始化 `tags ?? []`、`img_url ?? ""`。 |
| R-N3 | 新增公告成功后不重置表单。 | 新增成功/关闭时重置。 |
| R-N4 | 标签输入粘贴含逗号文本可能产生空串标签；不 trim。 | trim 并过滤空串、去重。 |
| R-S1 | 公告/知识“显示”Switch 非受控，接口失败不回滚。 | 受控 + 失败回滚 + loading。 |
| R-S2 | 排序模式下拖拽索引取渲染行序号，与完整数组错位（存在筛选或列排序时排错）。 | 进入排序模式时清空筛选和列排序。 |
| R-S3 | 知识库排序保存失败不退出排序模式；公告失败也退出（行为不一致）。 | 统一：失败保留排序模式并提示，成功退出。 |
| R-K1 | 知识分类多选筛选因默认过滤函数而失效。 | 精确匹配集合过滤。 |
| R-K2 | 知识分类前端允许空、后端必填；官方不提供已有分类建议。 | 前端必填；用 `knowledge/getCategory` 做 `NAutoComplete`/可输入下拉。 |
| R-K3 | 知识列表不显示语言（列表接口不返回 `language`），多语言站点难以区分同名文章。 | 平价实现可不显示；如需“按语言展示/筛选”，需后端在 `fetch` 的 `select` 中追加 `language`（加列不影响旧后台，但属于后端改动，需先与用户确认）。在未改后端前，不要为此对每行请求详情。 |
| R-X1 | zod 校验错误提示为英文默认文案。 | 使用中文提示，与后端文案对齐。 |

### 5.2 后端风险点（实现时规避，不在本次范围内修改）

| 编号 | 风险 | 规避 |
| --- | --- | --- |
| R-N1 | `NoticeController::save` 会写入请求中的 `popup`，但 `v2_notice` **没有 `popup` 列**（全仓库迁移均无）：新增时 SQL 报错 HTTP 500；更新时返回 “保存失败”。仓库中已移除的旧 `admin-v2` 页面（`public/assets/admin-v2/pages/content.js`）和测试桩 `tests/browser/admin-v2-harness.html` 都带 `popup`，说明这是遗留不一致。 | 新后台**不发送 `popup`**；“弹窗公告”用标签“弹窗”实现（用户主题已支持）。如确需独立 popup 字段，需新增迁移，属后端变更，先与用户确认。 |
| R-N5 | `notice/update` 路由存在但控制器无方法，调用必 500。 | 不使用；编辑统一走 `notice/save` 带 `id`。 |
| R-N6 | `tags` 存于 varchar(255) 的 JSON；`title`、`img_url` 也是 255。后端未限长，超长在严格模式下 SQL 报错。 | 前端限制：标题 ≤250、`img_url` ≤255、`JSON.stringify(tags).length ≤ 255`（或标签总数/单个长度上限并提示）。 |
| R-K4 | `knowledge/fetch?id=` 与 `knowledge/save`（更新）对不存在的 id 返回 500 通用错误；`notice/save` 更新同理。 | 前端以列表数据为准；遇 500 时提示“记录不存在或已被删除，请刷新”并刷新列表。 |
| R-T6 | `ticket/fetch` 的 `filter[].id`、`sort[].id` 直接作为列名；非法列或缺 `sort[].desc` → 500。 | 前端白名单：filter id ∈ {`status`,`level`,`reply_status`,`subject`,`id`,`user_id`}；sort id ∈ {`id`,`level`,`status`,`updated_at`,`created_at`}；`desc` 始终为布尔。 |
| R-T7 | 顶层 `status` / `email` 键只要存在就生效，空值会被转为 `null` 并查出空结果；`reply_status` 必须是数组。 | 空值时**不要**带该键。 |
| R-T8 | `transformUserData(User $user)` 不接受 null；若存在用户已被删除但工单残留（正常的后台删除用户会同时删工单，直接改库或历史迁移可能残留），**整个列表与该工单详情都会 500**。 | 列表 500 时给出可读错误；如遇到需后端加空值保护，属后端变更，先与用户确认。 |
| R-T9 | 管理员回复会给用户发邮件（30 分钟节流）并触发插件钩子，属对外不可逆副作用；如果管理员账号同时是工单发起人，回复会被记为用户消息（`reply_status=0`、`is_from_admin=false`）。 | 发送按钮不做自动重试；防重复提交（发送中禁用）。 |

### 5.3 危险操作清单（新后台需二次确认）

| 操作 | 接口 | 可逆性 | 确认文案（沿用官方） |
| --- | --- | --- | --- |
| 关闭工单 | `ticket/close` | 后台无“重新打开”接口，用户也无法再回复 | “确认关闭工单” / “确定要关闭这个工单吗？关闭后会移入已关闭列表，但仍可继续回复。” / “确认关闭” |
| 回复工单 | `ticket/reply` | 不可撤回、会发邮件/触发钩子 | 官方无确认（直接发送）；新后台保持一致即可 |
| 删除公告 | `notice/drop` | 物理删除，不可恢复 | “删除确认” / “确定要删除该条公告吗？此操作无法撤销。”（建议确认按钮改为红色“删除”） |
| 删除知识 | `knowledge/drop` | 物理删除，不可恢复 | “确认删除” / “此操作将永久删除该知识库记录，删除后无法恢复。确定要继续吗？” / “删除” |
| 保存排序 | `notice/sort`、`knowledge/sort` | 覆盖全部 `sort` 值（可再次调整） | 官方无确认 |
| 显示开关 | `notice/show`、`knowledge/show` | 立即对用户端生效（可再切回） | 官方无确认 |

### 5.4 XSS 与渲染安全

- R-X2：工单消息来自终端用户，必须**纯文本**渲染（保留换行），禁止 `v-html` / Markdown 渲染。
- R-X3：公告 `content`、知识 `body` 在用户端按 Markdown（允许 HTML）渲染。官方后台编辑器不开预览，因此后台侧不执行这些 HTML。新后台若增加预览，必须对渲染结果做 HTML 消毒（或 markdown-it `html:false`），因为后台页面持有管理员 token。

---

## 6. 新后台实现要点与验收清单

### 6.1 前端状态与刷新关系（对齐官方）

| 动作 | 需要刷新 |
| --- | --- |
| 列表关闭工单 | 工单列表、详情侧栏、工单详情 |
| 详情内关闭 / 回复 | 工单详情、详情侧栏、工单列表 |
| 公告保存 / 删除 / 排序保存 | 公告列表；显示开关成功后不必整表刷新（失败时刷新/回滚） |
| 知识保存 / 删除 / 排序保存 | 知识列表；编辑弹窗每次打开重新拉详情 |
| 工单详情 | 弹窗打开期间每 5 秒轮询；关闭弹窗停止 |

### 6.2 Naive UI 组件映射建议（非约束）

- 列表：`NDataTable`（工单 `remote` 服务端分页；公告/知识本地分页 + 本地过滤），右侧固定操作列 `fixed: 'right'`。
- 工单状态 Tabs：`NTabs type="segment"`；优先级/分类多选：`NPopselect multiple` 或 `NSelect multiple` + 计数。
- 确认：`NPopconfirm` 或 `useDialog().warning`；Toast：`useMessage()`。
- 工单详情：桌面 `NModal`（preset card，宽约 1152px、高 90vh）；移动端 `NDrawer placement="bottom" height="92vh"`；左侧侧栏可折叠（`NLayoutSider collapse-mode="width"` 或自绘）；消息区 `NScrollbar` + 自动滚到底；输入 `NInput type="textarea" :autosize`。
- 表单：`NForm` + rules（中文提示）；标签输入 `NDynamicTags` 或 `NSelect filterable tag multiple`；开关 `NSwitch`；语言 `NSelect`；分类 `NAutoComplete`（数据来自 `knowledge/getCategory`）。
- 拖拽排序：仅桌面；建议用无新依赖的原生 DnD 或项目已有的拖拽方案；新增依赖需主会话确认。

### 6.3 验收清单

工单：
- [ ] 菜单“用户管理 → 工单管理”可进入；默认显示处理中工单，每页 20，按最后更新时间倒序。
- [ ] “处理中 / 已关闭” 切换、优先级多选筛选、按优先级/状态/最后更新/创建时间排序、分页均走服务端且结果正确。
- [ ] 7 列显示与官方一致（工单号、主题、优先级、状态、最后更新、创建时间、操作），状态徽标按合成规则显示。
- [ ] 行内“查看详情”打开详情；未关闭工单显示“关闭工单”并经确认后关闭，toast “工单已关闭”，列表/侧栏/详情同步刷新。
- [ ] 详情：侧栏列表与本地搜索、空状态文案、折叠/展开；头部主题/状态/邮箱/创建时间/优先级；三个快捷按钮可用（订单记录使用 `eq:`）。
- [ ] 消息左右区分、发送者标签、时间、纯文本换行；5 秒轮询；自动滚到底。
- [ ] 回复：Enter 发送、Shift+Enter 换行、空内容禁用、发送中禁用；已关闭工单显示提示并仍可回复。
- [ ] 移动端卡片与 Drawer 形态可用。

公告：
- [ ] 菜单“系统管理 → 公告管理”；列表按 `sort ASC, id DESC`，每页 50；标题搜索与重置。
- [ ] 添加/编辑弹窗 6 个字段（含隐藏 id）、校验、Markdown 编辑器、标签输入行为；提交 toast “提交成功”。
- [ ] 显示开关、删除确认、编辑排序（拖拽 + 保存，toast “排序保存成功”）。
- [ ] 不发送 `popup`；`tags=null` 的历史数据可正常编辑保存。

知识库：
- [ ] 菜单“系统管理 → 知识库管理”；列表 6 列、每页 10；标题搜索、分类多选（精确匹配）、重置；ID/标题/分类可排序。
- [ ] 添加/编辑弹窗字段（标题、分类、语言 7 选项默认 zh-CN、显示、内容）；编辑时拉详情；提交 toast “操作成功”。
- [ ] 状态开关、删除确认（红色“删除”）、编辑排序与保存。
- [ ] 旧后台 `/{secure_path}` 的三个页面功能不受影响（新后台只调用同一套接口，不改后端）。
