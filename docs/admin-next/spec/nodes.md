# 功能域规格：节点（nodes）

> 适用对象：新后台 `/{secure_path}/next`（Vue 3 + TypeScript + Naive UI）实现者。旧后台（`public/assets/admin/assets/index-CEIYH7i8.js`）保持不动。
> 资料来源（全部为本仓库实际代码，2026-10-28 只读调研）：
> - 后端：`app/Http/Routes/V2/AdminRoute.php`、`app/Http/Controllers/V2/Admin/Server/{ManageController,MachineController,GroupController,RouteController}.php`、`app/Http/Requests/Admin/ServerSave.php`、`app/Models/{Server,ServerMachine,ServerMachineLoadHistory,ServerGroup,ServerRoute}.php`、`app/Services/{ServerService,NodeSyncService}.php`、`app/Observers/{ServerObserver,ServerRouteObserver}.php`、`app/Http/Controllers/V2/Server/MachineController.php`（节点端上报，决定 load_status 结构）、`database/migrations/*`。
> - 官方前端：编译包中的节点表单（zod schema / defaultValues / 字段 name）、表格列（accessorKey / header）、toast 与确认弹窗文案；中文文案取自 `public/assets/admin/locales/zh-CN.js`（命名空间 `server`、`machine`、`group`、`route`、`nav`、`common`）。
> - 标注约定：**[事实]** = 读代码确认；**[推断]** = 根据代码推理但未运行验证；**[建议]** = 新实现推荐做法（与官方行为不同的地方会明确说明）。

---

## 0. 总览

### 0.1 菜单与路由（官方）

侧边栏分组「节点管理」(`nav.nodeManagement`)，位于「系统管理」分组之后、「订阅管理」分组之前，子项顺序：

| 顺序 | 菜单文案（nav.*） | 官方 SPA 路径 | 页面 i18n 命名空间 | 说明 |
|---|---|---|---|---|
| 1 | 服务器管理 (`machineManagement`) | `/server/machine` | `machine` | 机器（官方 UI 称“服务器”）列表 + 详情抽屉 |
| 2 | 节点管理 (`nodeManagement`) | `/server/manage` | `server` | 节点列表 + 新建/编辑节点弹窗 |
| 3 | 权限组管理 (`permissionGroupManagement`) | `/server/group` | `group` | 权限组 CRUD |
| 4 | 路由管理 (`routeManagement`) | `/server/route` | `route` | 路由规则 CRUD |

URL 查询参数（官方行为，新实现需保留）：
- `/server/manage?machine_id={id}`：按机器过滤节点列表并显示横幅；再加 `&open_create=1` 时自动打开“新建节点”弹窗并预填 `machine_id={id}, enabled=true`，打开后从 URL 删除 `open_create`。
- `/server/machine?machine_id={id}`：自动打开该机器的详情抽屉；打开详情时写入该参数，关闭时删除。

**术语**：后端 `server` = 节点（`v2_server` 表）；后端 `machine` = 物理服务器（`v2_server_machine`），官方 UI 中文称“服务器”，ID 显示为 `SID:{id}`。新 UI 沿用该叫法。

### 0.2 通用请求约定

- 基础路径：`{base_url}/api/v2/{secure_path}/...`，`base_url` 来自 `window.settings.base_url`，`secure_path` 来自 `window.settings.secure_path`。中间件 `admin` + `log`。
- 请求头：`Authorization: {auth_data}`（登录接口返回的 `auth_data` 原样放入，它本身已是 `Bearer xxx` 形式，见 `AuthService`）、`Content-Type: application/json`、`Content-Language: {i18nextLng|zh-CN}`。
- GET 参数走 query string；POST 走 JSON body。
- 成功响应（`ApiResponse::success`）：HTTP 200，`{"status":"success","message":"操作成功","data":<见各接口>,"error":null}`。
- 失败响应（`ApiResponse::fail([code,msg])`）：HTTP 状态码 = `code` 的前三位（如 `400202`→400、`422`→422、`500`→500），body `{"status":"fail","message":msg,"data":null,"error":null}`。
- `ApiException`（如 route/drop 抛出）：同上格式，默认 HTTP 400。
- Laravel 表单校验失败（`$request->validate` / `ServerSave`）：HTTP 422，body `{"message":"<首条错误>（以及 N 个其它错误）","errors":{"字段路径":["消息"]}}`。
- 非管理员：HTTP 403 `{"message":"Unauthorized"}`。
- 官方前端 axios 拦截器：成功时返回 body 本身（组件取 `res.data`）；非 2xx 时 toast `body.message`，否则按状态码 toast：401「登录已过期」、403「没有权限」、404「资源或接口不存在」、其它「未知异常」；401/403 会触发登出。**新实现应保持：任何非 2xx 统一 toast `message`，422 时可额外把 `errors` 映射到表单字段。**
- 全局中间件 `TrimStrings` + `ConvertEmptyStringsToNull`：**JSON body 中所有（含嵌套）字符串会被 trim，空字符串会被转为 `null`**。这影响多个校验规则（见 §9 风险）。
- `log` 中间件：所有 POST 请求体（剔除顶层 `password/token/secret/key/api_key`）写入 `admin_audit_log`。注意节点 `protocol_settings` 内的 Reality 私钥、ECH key 是嵌套字段，**会被写入审计日志**。
- 本域所有列表接口均**不分页**，官方前端全部做**前端分页/筛选/排序**（TanStack Table）。

### 0.3 通用格式化函数（官方实现，需等价实现）

| 名称 | 规则 |
|---|---|
| formatBytes(n) | `null` 或 `<=0` → `"0 B"`；单位 `B/KB/MB/GB/TB`，1024 进制，`parseFloat(x.toFixed(2))`（去掉多余 0），如 `1.5 GB`、`512 MB` |
| formatUptime(sec) | 空/负 → `"-"`；`d>0` → `"{d}d {h}h"`；`h>0` → `"{h}h {m}m"`；`m>0` → `"{m}m {s}s"`；否则 `"{s}s"` |
| formatSpeed(bytes/s) | 空/负 → `"-"`；`<1024` → `"{n.toFixed(0)} B/s"`；`<1MiB` → `"{x.toFixed(1)} KB/s"`；`<1GiB` → `"{x.toFixed(1)} MB/s"`；否则 `"{x.toFixed(2)} GB/s"` |
| relativeAgo(unixSec) | 空 → `"-"`；差值 `<60` → `"{n}s"`；`<3600` → `"{n}m"`；`<86400` → `"{n}h"`；否则 `"{n}d"`（无“前”字） |
| 节点类型显示名 | shadowsocks→`Shadowsocks`，vmess→`VMess`，trojan→`Trojan`，hysteria→`Hysteria`，vless→`VLess`，tuic→`TUIC`，socks→`SOCKS`，naive→`Naive`，http→`HTTP`，mieru→`Mieru`，anytls→`AnyTLS` |
| 节点类型颜色 | shadowsocks `#489851`，vmess `#CB3180`，trojan `#EBB749`，hysteria `#5684e6`，vless `#1a1a1a`，tuic `#00C853`，socks `#2196F3`，naive `#9C27B0`，http `#FF5722`，mieru `#4CAF50`，anytls `#7E57C2` |

类型下拉的顺序（官方 `rqt`）：shadowsocks, vmess, trojan, hysteria, vless, tuic, socks, naive, http, mieru, anytls。

---

## 1. 数据模型

### 1.1 `v2_server`（节点）列

| 列 | 类型 | 说明 |
|---|---|---|
| id | bigint PK | 节点 ID（“原始ID”） |
| type | string | 11 种之一（`Server::VALID_TYPES`）：`hysteria, vless, trojan, vmess, tuic, shadowsocks, anytls, socks, naive, http, mieru`。别名 `v2ray→vmess`、`hysteria2→hysteria` 只用于节点端 API，后台保存时**不接受别名** |
| code | string null | 自定义节点 ID（节点端可用 code 或 id 拉配置）。唯一索引 `unique(type, code)` |
| parent_id | unsigned int null | 父节点 ID；`0` 或 `null` 均表示无父节点 |
| machine_id | bigint null | 绑定的机器，FK → `v2_server_machine.id`，机器删除时置 null |
| group_ids | json null | 权限组 ID 数组。**官方 UI 写入的是字符串数组**（如 `["1","9"]`），后端多处用 `whereJsonContains('group_ids', (string)$id)` 依赖字符串形式 |
| route_ids | json null | 路由规则 ID 数组，官方 UI 写入字符串数组 |
| name | string | 节点名称 |
| rate | decimal(8,2) | 基础倍率。MySQL 下 JSON 输出为字符串（如 `"1.00"`）**[推断]** |
| rate_time_enable | bool default false | 是否启用按时段倍率 |
| rate_time_ranges | json null | `[{start:"HH:mm", end:"HH:mm", rate:number|string}]` |
| transfer_enable | bigint null | 节点流量上限（字节），`0/null` = 不限。`u+d >= transfer_enable` 时节点不再下发给用户订阅 |
| u / d | bigint default 0 | 节点累计上/下行流量（字节） |
| tags | json null | 字符串数组 |
| host | string | 连接地址（域名/IP） |
| port | string | 用户连接端口；可为区间 `"20000-30000"`（订阅生成时随机取端口，并下发 `ports` 用于端口跳跃） |
| server_port | int | 节点后端实际监听端口 |
| protocol_settings | json null | 协议参数，见 §2.5 与 §4.8 |
| custom_outbounds | json null | 自定义 outbounds（JSON 数组） |
| custom_routes | json null | 自定义 routes（JSON 数组） |
| cert_config | json null | 证书申请配置（见 §4.6.1） |
| show | bool default false | 是否对用户显示 |
| enabled | bool null default true | 仅对“机器托管”的节点有意义：机器只拉起 `enabled=true` 的节点 |
| sort | int null | 排序（升序；null 排最前 [推断 MySQL 行为]） |
| created_at / updated_at | timestamp | JSON 输出为 Unix 秒（cast `timestamp`） |

**没有** `excludes`、`ips`、`spectific_key`、`banned`、`listen_address` 列（见 §9）。

### 1.2 `v2_server_machine`（机器）

| 列 | 说明 |
|---|---|
| id | 机器 ID（UI 显示 `SID:{id}`） |
| name | 名称 |
| token | 64 位以内随机串（`Str::random(32)`），`$hidden`，仅 `getToken/resetToken/save(新建)` 返回 |
| notes | text null |
| is_active | bool default true |
| last_seen_at | unsigned int null（Unix 秒，节点端心跳/上报更新） |
| load_status | json null：`{cpu: float(0-100), mem:{total,used}, swap:{total,used}, disk:{total,used}, updated_at: int, net?:{in_speed: float, out_speed: float}}`（字节、字节/秒） |
| created_at / updated_at | JSON 输出 Unix 秒 |

`v2_server_machine_load_history`：`machine_id, cpu, mem_total, mem_used, disk_total, disk_used, net_in_speed(null), net_out_speed(null), recorded_at`；节点端每次上报写一条，约 5% 概率清理 24 小时前数据（即最多保留约 24h）。

### 1.3 `v2_server_group`（权限组）
`id, name, created_at(int), updated_at(int)`。

### 1.4 `v2_server_route`（路由规则）
`id, remarks(string), match(text, cast array), action(string(11)), action_value(string null), created_at(int), updated_at(int)`。

---

## 2. 接口规格

### 2.1 节点 `server/manage/*`

#### 2.1.1 `GET server/manage/getNodes`
- 参数：无。
- 响应 `data`：数组，按 `sort ASC`（DB 原始顺序）。每项字段：

| 字段 | 类型 | 来源/含义 |
|---|---|---|
| v2_server 全部列 | — | 见 §1.1；`protocol_settings` 经模型 accessor 按类型补全默认值并丢弃未知键（§2.5.3） |
| last_check_at | int\|null | 缓存 `SERVER_{TYPE}_LAST_CHECK_AT`（节点拉取/心跳时间）。**子节点取父节点的缓存** |
| last_push_at | int\|null | 缓存 `SERVER_{TYPE}_LAST_PUSH_AT`（最近流量上报时间），子节点取父节点 |
| online | int | 缓存 `SERVER_{TYPE}_ONLINE_USER`，最近一次流量上报中的用户数，默认 0；子节点取父节点 |
| is_online | 0\|1 | `time()-300 > last_check_at ? 0 : 1` |
| available_status | 0\|1\|2 | 0=未运行（5 分钟内无 check）；1=无人使用或异常（有 check，5 分钟内无 push）；2=运行正常 |
| cache_key | string | `"{type}-{id}-{updated_at}-{is_online}"` |
| load_status | object\|null | 节点上报：`{cpu, mem:{total,used}, swap:{total,used}, disk:{total,used}, updated_at, kernel_status}` |
| metrics | object\|null | 节点上报：`{uptime, goroutines, active_connections, total_connections, total_users, active_users, inbound_speed, outbound_speed, cpu_per_core[], load{load1?,load5?,load15?}, speed_limiter{has_limits?,limited_users?}, gc{last_pause_ms?}, api{success,failure}, ws{enabled,connected}, limits{device_limit_events?}, updated_at, kernel_status(bool)}`（子结构内容由节点端决定） |
| online_conn | int | `metrics.active_connections ?? 0` |
| groups | `[{name, id}]` | 由 `group_ids` 查 `v2_server_group` |
| parent | object\|null | 父节点完整对象（不含上述计算字段） |

- 副作用：无。数据量 = 全部节点，不分页。

#### 2.1.2 `POST server/manage/save`
- 新建：body 不含 `id`；编辑：body 含 `id`。
- 校验：`App\Http\Requests\Admin\ServerSave`（全文见 §2.5.1）。
- 额外业务校验（controller）：
  - `parent_id` 非空且非 0 时：父节点不存在 → 422 `父节点不存在`；父节点=自身 → 422 `节点不能选择自己作为父节点`；沿父链检测循环 → 422 `现有父子节点关系中存在循环，请先修复` / `父子节点关系不能形成循环`。
  - 编辑时 id 不存在 → 400 `服务器不存在`。
- 写库：`Server::update($validated)` / `Server::create($validated)`；异常 → 500 `保存失败` / `创建失败`（如 `unique(type,code)` 冲突、`server_port` 非整数、`machine_id` 不存在触发外键）。
- 响应 `data`：`true`。
- 副作用（`ServerObserver`，afterCommit）：新建 → 通知所属机器节点集变化；更新时 `group_ids` 变化 → 对该节点 full sync（配置+用户）；`server_port/protocol_settings/type/route_ids/custom_outbounds/custom_routes/cert_config` 变化 → 推送配置；`machine_id/enabled` 变化 → 通知新旧机器。推送仅在节点 WS 在线时发生（Redis `node:push`）。

#### 2.1.3 `POST server/manage/update`（快速切换）
- body：`{id: int 必填, show?: int|null, machine_id?: int|null, enabled?: bool|null}`。官方还会附带 `type`，后端忽略。
- 语义：**按 key 是否存在**决定是否更新：`show` → `(int)`；`machine_id` → `value ?: null`（传 `null`/`0` 即解绑）；`enabled` → `(bool)`。
- 错误：id 不存在 → 400 `服务器不存在`；保存失败 → 500 `保存失败`。
- 响应：`true`。触发 Observer。
- 官方调用：列表“显隐”开关 `{id,type,show:1|0}`；机器详情里切换激活 `{id,type,enabled:!enabled}`；解绑 `{id,type,machine_id:null,enabled:false}`。

#### 2.1.4 `POST server/manage/drop`
- body：`{id: int}`。不存在 → 400 `服务器不存在`；失败 → 500 `删除失败`。响应 `true`。触发 Observer（通知原机器）。
- 不检查是否有子节点引用它（子节点 parent_id 会悬空）。

#### 2.1.5 `POST server/manage/copy`
- body：`{id}`（无校验规则；不存在 → 400 `服务器不存在`）。
- 行为：`replicate()` 全部字段（含 group_ids、route_ids、machine_id、enabled、parent_id、sort、protocol_settings、cert_config…），然后 `show=0`、`code=null`、`u=0`、`d=0`，新 id/新时间戳。
- 响应：`true`。注意 SS2022 的 server key 由 `created_at` 派生，副本密钥与原节点不同（子节点除外，子节点用父节点 created_at）。

#### 2.1.6 `POST server/manage/sort`
- body：**JSON 数组**（根即数组）：`[{"id":1,"order":1},{"id":7,"order":2},...]`；校验 `*.id numeric`、`*.order numeric`。
- 行为：事务内逐条 `sort = order`；失败 → 500 `保存失败`。响应 `true`。
- 官方发送的是**全部节点**按当前本地顺序，`order` 从 1 开始连续编号。

#### 2.1.7 `POST server/manage/batchDelete`
- body：`{ids: int[]}`（required|array）。空数组 → 400 `请选择要删除的节点`。
- 行为：`whereIn(id)->delete()`（**查询构造器删除，不触发 Observer，机器不会收到节点集变化通知**）。失败 → 500 `批量删除失败`。响应 `true`。

#### 2.1.8 `POST server/manage/batchUpdate`
- body：`{ids: int[] 必填, show?: 0|1|null, enabled?: bool|null, machine_id?: int|null}`。
- 可批量修改的字段**只有**：`show`（null 忽略）、`enabled`（null 忽略）、`machine_id`（**只要 key 出现就更新**，null/0 → 解绑）。
- 无可更新字段 → 400 `没有可更新的字段`；`ids` 为空 → 400 `请选择要更新的节点`；异常 → 500 `批量更新失败`。
- 行为：逐个 `$server->update()`（触发 Observer）。响应 `true`。
- 官方调用：批量显示 `{ids, show:1}`、批量隐藏 `{ids, show:0}`、批量启用 `{ids, enabled:true}`、批量禁用 `{ids, enabled:false}`、机器详情“关联已有节点” `{ids, machine_id, enabled:true}`。

#### 2.1.9 `POST server/manage/resetTraffic`
- body：`{id: int}`；不存在 → 400；行为 `u=0,d=0`；失败 500 `重置失败`。响应 `true`。

#### 2.1.10 `POST server/manage/batchResetTraffic`
- body：`{ids: int[]}`；空 → 400 `请选择要重置的节点`；行为 `whereIn update u=0,d=0`（不触发 Observer）；失败 500 `批量重置失败`。响应 `true`。

#### 2.1.11 `GET server/manage/generateEchKey`
- query：`public_name`（可选，默认 `ech.example.com`，长度 1–253，否则 400 `public_name must be a valid domain (1-253 bytes)`）。
- 行为：生成 X25519 密钥对与 ECHConfig（draft-18，kem 0x0020，套件 HKDF-SHA256 + AES-128-GCM / ChaCha20Poly1305）。依赖 PHP sodium 扩展。
- 响应 `data`：`{"key":"-----BEGIN ECH KEYS-----\n...\n-----END ECH KEYS-----","config":"-----BEGIN ECH CONFIGS-----\n...\n-----END ECH CONFIGS-----"}`。
- 官方调用时**不传 public_name**（axios 丢弃 undefined），因此生成的 config 外层 SNI 恒为 `ech.example.com`。[建议] 新 UI 可传当前 `server_name`（不改变后端），但需在实现说明里注明与官方不同。

### 2.2 机器 `server/machine/*`

| 接口 | 参数 | 响应 `data` | 说明/错误 |
|---|---|---|---|
| `GET fetch` | 无 | `[{id, name, notes, is_active, last_seen_at, load_status, servers_count, created_at, updated_at}]`，按 id 升序 | `servers_count` = 绑定该机器的全部节点数（含 enabled=false） |
| `POST save` | `{id?: int(exists), name: string required max255, notes?: string\|null, is_active?: bool}` | 新建：`{id, token, install_command}`；编辑：`true` | 编辑时只更新 name，以及请求中出现的 notes/is_active；新建 `is_active` 缺省 true 并生成 token。id 不存在 → 422 |
| `POST drop` | `{id}`（exists） | `true` | 先把 `machine_id=该id` 的节点批量置 null（不触发 Observer），再删机器（历史记录级联删除），再通知 WS 进程清理注册表。不删节点 |
| `POST resetToken` | `{id}` | `{token}` | 旧 token 立即失效 |
| `GET getToken` | `?id=` | `{token}` | |
| `GET installCommand` | `?id=` | `{command}` | 格式：`curl -fsSL https://raw.githubusercontent.com/cedar2025/xboard-node/dev/install.sh \| sudo bash -s -- --mode machine --panel '<panel_url>' --token '<token>' --machine-id <id>`；`panel_url = admin_setting('app_url')` 或当前请求的 scheme+host，去尾 `/` |
| `GET nodes` | `?machine_id=` | `[{id, name, type, host, port, show, enabled, sort}]`，按 sort | |
| `GET history` | `?machine_id=&limit=(10..1440,默认60)&range_hours=(1..24,可选)` | `[{cpu, mem_total, mem_used, disk_total, disk_used, net_in_speed, net_out_speed, recorded_at}]`，按时间**升序** | 先按 recorded_at 降序取 limit 条再反转 |

### 2.3 权限组 `server/group/*`

| 接口 | 参数 | 响应 `data` | 说明/错误 |
|---|---|---|---|
| `GET fetch` | 无 | `[{id, name, created_at, updated_at, users_count, server_count}]`，按 id **降序** | `users_count` = `v2_user.group_id` 计数；`server_count` = `whereJsonContains(group_ids, (string)id)` 计数 |
| `POST save` | `{id?, name}` | `true` | name 为空 → 422 `组名不能为空`。后端无长度/字符校验。id 不存在时会抛 500（对 null 赋值） |
| `POST drop` | `{id}` | `true` | 不存在 → 400 `组不存在`；被节点使用 → 400 `该组已被节点所使用，无法删除`；被套餐使用 → 400 `该组已被订阅所使用，无法删除`；被用户使用 → 400 `该组已被用户所使用，无法删除`。**节点占用检查的坑见 §9** |

### 2.4 路由 `server/route/*`

| 接口 | 参数 | 响应 | 说明/错误 |
|---|---|---|---|
| `GET fetch` | 无 | **`{"data":[{id, remarks, match:string[], action, action_value, created_at, updated_at}]}`**（无 status/message 包装） | 不排序（DB 自然顺序） |
| `POST save` | `{id?, remarks: required, match: required\|array, action: required\|in:block,direct,dns,proxy, action_value: nullable}` | `{status:"success",...,data:true}` | 自定义消息：`备注不能为空`、`匹配值不能为空`、`动作类型不能为空`、`动作类型参数有误`。`match = array_filter(match)`（**保留原下标**，见 §9）。编辑时 id 不存在 → 500 `保存失败`；新建异常 → 500 `创建失败` |
| `POST drop` | `{id}` | **`{"data":true}`** | 不存在 → 400 `路由不存在`；删除失败 → 400 `删除失败`。不检查节点是否引用 |

`ServerRouteObserver`：路由更新/删除时，对 `show=1` 且 `route_ids` 包含该 id 的节点推送配置。

match 格式：每项为一个字符串，原样下发给节点端（`routes: [{id, match, action, action_value}]`），由节点内核解释（生产数据中多为域名关键字/域名，如 `"falundafa"`、`"bbc.com"`）。后端不做格式校验。

action 枚举：

| 值 | 下拉文案 `route.actions.*` | 列表“动作值”列 `route.columns.action_value.*` | action_value |
|---|---|---|---|
| block | 禁止访问 | 阻止访问（红色文字） | 不需要（提交时清空为 `""`→后端 null） |
| dns | 指定DNS服务器进行解析 | `DNS: {value}` | DNS 服务器地址，必填（前端标星） |
| direct | 直连 | 直连 | 不需要 |
| proxy | 转发 | `转发 ({value})` | Outbound Tag，必填（前端标星） |

### 2.5 节点保存的校验与持久化

#### 2.5.1 `ServerSave` 规则全文（照录 `app/Http/Requests/Admin/ServerSave.php`）

```php
private const UTLS_RULES = [
    'utls.enabled' => 'nullable|boolean',
    'utls.fingerprint' => 'nullable|string',
];
private const MULTIPLEX_RULES = [
    'multiplex.enabled' => 'nullable|boolean',
    'multiplex.protocol' => 'nullable|string',
    'multiplex.max_connections' => 'nullable|integer',
    'multiplex.min_streams' => 'nullable|integer',
    'multiplex.max_streams' => 'nullable|integer',
    'multiplex.padding' => 'nullable|boolean',
    'multiplex.brutal.enabled' => 'nullable|boolean',
    'multiplex.brutal.up_mbps' => 'nullable|integer',
    'multiplex.brutal.down_mbps' => 'nullable|integer',
];
private const ECH_RULES = [
    'enabled' => 'nullable|boolean',
    'config' => 'nullable|string',
    'query_server_name' => 'nullable|string',
    'key' => 'nullable|string',
];
private const REALITY_RULES = [
    'reality_settings.allow_insecure' => 'nullable|boolean',
    'reality_settings.server_name' => 'nullable|string',
    'reality_settings.server_port' => 'nullable|integer',
    'reality_settings.public_key' => 'nullable|string',
    'reality_settings.private_key' => 'nullable|string',
    'reality_settings.short_id' => 'nullable|string',
];
private const PROTOCOL_RULES = [
    'shadowsocks' => [
        'cipher' => 'required|string',
        'obfs' => 'nullable|string',
        'obfs_settings.path' => 'nullable|string',
        'obfs_settings.host' => 'nullable|string',
        'plugin' => 'nullable|string',
        'plugin_opts' => 'nullable|string',
    ],
    'vmess' => [
        'tls' => 'required|integer',
        'network' => 'required|string',
        'network_settings' => 'nullable|array',
        'rules' => 'nullable|array',
    ],
    'trojan' => [
        'tls' => 'nullable|integer',
        'network' => 'required|string',
        'network_settings' => 'nullable|array',
        'server_name' => 'nullable|string',
        'allow_insecure' => 'nullable|boolean',
    ],
    'hysteria' => [
        'version' => 'required|integer',
        'alpn' => 'nullable|string',
        'obfs.open' => 'nullable|boolean',
        'obfs.type' => 'string|nullable',
        'obfs.password' => 'string|nullable',
        'bandwidth.up' => 'nullable|integer',
        'bandwidth.down' => 'nullable|integer',
        'hop_interval' => 'integer|nullable',
    ],
    'vless' => [
        'tls' => 'required|integer',
        'network' => 'required|string',
        'network_settings' => 'nullable|array',
        'flow' => 'nullable|string',
        'encryption' => 'nullable|array',
        'encryption.enabled' => 'nullable|boolean',
        'encryption.encryption' => 'nullable|string',
        'encryption.decryption' => 'nullable|string',
    ],
    'socks' => [ 'tls' => 'nullable|integer' ],
    'naive' => [ 'tls' => 'required|integer' ],
    'http'  => [ 'tls' => 'required|integer' ],
    'tuic' => [
        'version' => 'nullable|integer',
        'congestion_control' => 'nullable|string',
        'alpn' => 'nullable|array',
        'udp_relay_mode' => 'nullable|string',
    ],
    'mieru' => [
        'transport' => 'required|string|in:TCP,UDP',
        'traffic_pattern' => 'string',
    ],
    'anytls' => [
        'tls' => 'nullable|array',
        'alpn' => 'nullable|string',
        'padding_scheme' => 'nullable|array',
    ],
];

// 基础规则
'type' => 'required|in:hysteria,vless,trojan,vmess,tuic,shadowsocks,anytls,socks,naive,http,mieru',
'spectific_key' => 'nullable|string',
'code' => 'nullable|string',
'show' => '',
'name' => 'required|string',
'group_ids' => 'nullable|array',
'route_ids' => 'nullable|array',
'parent_id' => 'nullable|integer',
'machine_id' => 'nullable|integer',
'enabled' => 'nullable|boolean',
'host' => 'required',
'port' => 'required',
'server_port' => 'required',
'tags' => 'nullable|array',
'excludes' => 'nullable|array',
'ips' => 'nullable|array',
'rate' => 'required|numeric',
'rate_time_enable' => 'nullable|boolean',
'rate_time_ranges' => 'nullable|array',
'custom_outbounds' => 'nullable|array',
'custom_routes' => 'nullable|array',
'cert_config' => 'nullable|array',
'rate_time_ranges.*.start' => 'required_with:rate_time_ranges|string|date_format:H:i',
'rate_time_ranges.*.end' => 'required_with:rate_time_ranges|string|date_format:H:i',
'rate_time_ranges.*.rate' => 'required_with:rate_time_ranges|numeric|min:0',
'protocol_settings' => 'array',
'transfer_enable' => 'nullable|integer|min:0',
```

按类型合并（`protocol_settings.` 前缀省略）：

| type | 合并的公共规则 |
|---|---|
| vmess | 自身 + `tls_settings.{server_name,allow_insecure,ech}` + `tls_settings.ech.{enabled,config,query_server_name,key}` + MULTIPLEX + UTLS |
| trojan | 自身 + `tls_settings`(nullable\|array) + tls_settings.* + ech.* + REALITY + MULTIPLEX + UTLS |
| hysteria | 自身 + `tls.{server_name,allow_insecure,ech}` + `tls.ech.*` |
| tuic | 自身 + `tls.*` + `tls.ech.*` |
| mieru | 自身 + MULTIPLEX |
| vless | 自身 + tls_settings.* + ech.* + REALITY + MULTIPLEX + UTLS |
| socks | 自身 + tls_settings.* + ech.*（无 `tls_settings` 根规则） |
| naive / http | 自身 + `tls_settings` 根 + tls_settings.* + ech.* |
| anytls | 自身（含 `tls` nullable\|array 根）+ `tls.*` + `tls.ech.*` |
| shadowsocks | 仅自身 |

自定义消息（`messages()`）：`name.required` 节点名称不能为空；`host.required` 节点地址不能为空；`port.required` 连接端口不能为空；`server_port.required` 后端服务端口不能为空；`rate.required` 倍率不能为空；`rate.numeric` 倍率格式不正确；`group_ids.array` 权限组格式不正确；`route_ids.array` 路由组格式不正确；`parent_id.integer` 父ID格式不正确；`tags.array` 标签格式不正确；`transfer_enable.integer` 流量上限必须是整数；`transfer_enable.min` 流量上限不能小于0；`protocol_settings.*.required/required_if` `:attribute 不能为空`；`.string` `:attribute 必须是字符串`；`.integer` `:attribute 必须是整数`；`.in` `:attribute 的值不合法`。属性名映射见 `attributes()`（如 `protocol_settings.cipher`→加密方式、`protocol_settings.network`→传输协议、`protocol_settings.transport`→传输方式、`protocol_settings.traffic_pattern`→Traffic Pattern、`protocol_settings.version`→协议版本、multiplex/utls/ech 各项中文名）。

#### 2.5.2 哪些字段真正落库（两层过滤）

1. `validated()` 只返回规则里出现的键（Laravel 12 默认 `excludeUnvalidatedArrayKeys=true`：若某个 array 字段同时有子规则，则只保留有规则的子键 **[推断，依据框架默认值]**）。
2. `Server` 用 `$guarded=['id']`：`fill()` 会**静默丢弃表中不存在的列**（`excludes`、`ips`、`spectific_key`、`listen_address`、`banned`、`groups`、`parent`、`online` 等）。
3. `protocol_settings` 的 setter 按 `PROTOCOL_CONFIGURATIONS[$type]` 重新构造：**只保留定义过的键**，缺失的标量键填默认值，`object` 类型键若未提供则为 `null`（提供了才递归补默认）；按类型强转：`integer→(int)`、`boolean→(bool)`、`string→(string)`、`array→(array)`。
   - 注意：`type` 必须先于 `protocol_settings` 赋值（validated 顺序中 `type` 在前，满足）。

#### 2.5.3 `PROTOCOL_CONFIGURATIONS`（持久化结构与默认值）

公共子结构：

- `tls_settings` / `tls`（TLS 对象）：`server_name: string=null`，`allow_insecure: bool=false`，`ech: {enabled: bool=false, config: string=null, query_server_name: string=null, key: string=null, key_path: string=null, config_path: string=null}`
- `reality_settings`：`server_name: string=null`，`server_port: string=null`（**存为字符串**），`public_key: string=null`，`private_key: string=null`，`short_id: string=null`，`allow_insecure: bool=false`
- `multiplex`：`enabled: bool=false`，`protocol: string='yamux'`，`max_connections: int=null`，`padding: bool=false`，`brutal: {enabled: bool=false, up_mbps: int=null, down_mbps: int=null}`（`min_streams/max_streams` 被注释掉，**不落库**）
- `utls`：`enabled: bool=false`，`fingerprint: string='chrome'`

| type | 持久化键（类型=默认） |
|---|---|
| trojan | `tls int=1`, `network string=null`, `network_settings array=null`, `server_name string=null`, `allow_insecure bool=false`, `tls_settings`, `reality_settings`, `multiplex`, `utls` |
| vmess | `tls int=0`, `network`, `rules array=null`, `network_settings`, `tls_settings`, `multiplex`, `utls` |
| vless | `tls int=0`, `tls_settings`, `flow string=null`, `encryption {enabled bool=false, encryption string=null, decryption string=null}(未提供=null)`, `network`, `network_settings`, `reality_settings`, `multiplex`, `utls` |
| shadowsocks | `cipher string=null`, `obfs string=null`, `obfs_settings array=null`, `plugin string=null`, `plugin_opts string=null` |
| hysteria | `version int=2`, `bandwidth {up int=null, down int=null}`, `obfs {open bool=false, type string='salamander', password string=null}`, `tls`, `hop_interval int=null` |
| tuic | `version int=5`, `congestion_control string='cubic'`, `alpn array=['h3']`, `udp_relay_mode string='native'`, `tls` |
| anytls | `padding_scheme array=` 默认 9 行（见 §4.8.9），`tls` |
| socks / naive / http | `tls int=0`, `tls_settings` |
| mieru | `transport string='TCP'`, `traffic_pattern string=''`, `multiplex` |

#### 2.5.4 节点端实际拿到的配置（`ServerService::buildNodeConfig`，便于理解字段用途）
- 公共：`protocol, listen_ip=0.0.0.0, server_port, network, networkSettings`，并附 `routes`（route_ids 非空）、`custom_outbounds`、`custom_routes`、`cert_config`（`cert_mode != none` 时，`mode` 会规范为 `cert_mode`）。
- trojan/vless：`tls=2` 时 `tls_settings` 取 `reality_settings`，否则取 `tls_settings`；vless 的 `decryption` 仅在 `encryption.enabled=true` 时下发。
- hysteria：v1 下发 `obfs=obfs.password`；v2 下发 `obfs=(obfs.open? obfs.type : null)` 与 `obfs-password`；`up_mbps/down_mbps=(int)bandwidth`。
- tuic：下发 `congestion_control`、`tls_settings`，另固定 `auth_timeout=3s, zero_rtt_handshake=false, heartbeat=3s`（注意：`alpn`、`udp_relay_mode` 不在下发里，只用于订阅）。
- anytls：`padding_scheme`、`tls_settings`。shadowsocks：`cipher, plugin, plugin_opts`，2022-blake3 时附 `server_key`。

---

## 3. 页面：节点管理 `/server/manage`

### 3.1 页面结构与数据加载

- 标题 `server.manage.title`「节点管理」，副标题 `server.manage.description`「管理所有节点，包括添加、删除、编辑等操作。」。
- 数据：
  - 节点：`GET getNodes`，缓存键 `nodeList`，**每 30 秒自动刷新**（排序模式中暂停刷新，且排序模式中本地列表不被远端数据覆盖）。
  - 权限组：`GET server/group/fetch`（用于筛选项）。
  - 机器：`GET server/machine/fetch`，staleTime 30s，**每 60 秒刷新**（用于部署方式列与筛选）。
- 表格：前端分页，默认 `pageSize=500`，可选 10/20/30/40/50/100/500；底部显示「已选择 {selected} 项，共 {total} 项」、「每页显示」、页码输入跳转。`actions` 列固定在右侧。
- 加载态：骨架行（最多 10 行）；空态：「暂无数据」。

### 3.2 机器过滤横幅（`?machine_id=`）

当 URL 有 `machine_id` 且在机器列表中找到时，表格上方显示横幅：
- 文本：`server.manage.filtered_by_server`「当前正在查看服务器 {{server}} (SID:{{id}}) 下的节点」；说明 `filtered_by_server_description`「在这里新增节点时，可以直接复用当前服务器作为部署目标。」
- 右侧：徽标 `SID:{id}`；按钮「新增节点到此服务器」(`add_node_to_server`) → 打开新建弹窗并预填 `machine_id`、`enabled=true`；按钮「清除服务器筛选」(`clear_server_filter`) → 删除 URL 的 `machine_id`/`open_create` 并清空部署方式筛选。
- 进入页面时若有 `machine_id`，自动设置“部署方式”列筛选值 `[machine_id]`。

### 3.3 工具栏

普通模式（桌面）从左到右：
1. 「添加节点」按钮（`form.add_node`，outline，带 + 图标）→ 打开新建弹窗（不预填）。
2. 搜索框 placeholder「搜索节点...」(`toolbar.search`)：对 `name` 做**不区分大小写子串**匹配（前端）。
3. 多选筛选（弹出带搜索的勾选列表，选中项以徽标显示，>2 项显示「N selected」，底部「Clear filters」，每项右侧显示命中数量）：
   - 「类型」(`toolbar.type`)：选项 Shadowsocks、VMess、Trojan、Hysteria、VLess、TUIC、SOCKS、Naive、HTTP、Mieru（**官方漏了 AnyTLS**；且官方对多选使用默认字符串包含匹配，多选时会失效）。[建议] 新实现包含 AnyTLS，语义为“type ∈ 选中集合”。
   - 「服务器」(`toolbar.server`)：首项「独立部署」(值 `__standalone__`，匹配 `machine_id == null`)，其余 `"{name} · SID:{id}"`（值为 id 字符串）。语义：任一匹配。
   - 「权限组」(`columns.groups.title`)：选项为全部权限组 `name`，值为 id 字符串；语义：节点 `group_ids` 含任一选中值。
4. 有筛选时显示「重置」按钮（`toolbar.reset`）清空所有列筛选。
5. 「操作」下拉（`toolbar.actions`，批量操作；未勾选时各项禁用，已勾选时项尾显示 `(n)`）：
   - 显示节点 (`batch_show.menu`) → `batchUpdate {ids, show:1}` → 成功「成功显示 {count} 个节点」，失败「批量显示失败」
   - 隐藏节点 (`batch_hide.menu`) → `{ids, show:0}` →「成功隐藏 {count} 个节点」/「批量隐藏失败」
   - 分隔线
   - 启用节点 (`batch_enable.menu`) → `{ids, enabled:true}` →「成功启用 {count} 个节点」/「批量启用失败」
   - 禁用节点 (`batch_disable.menu`) → `{ids, enabled:false}` →「成功禁用 {count} 个节点」/「批量禁用失败」
   - 分隔线
   - 重置流量 (`batch_reset_traffic.menu`) → 确认框：标题「确认批量重置流量」，内容「确定要重置选中的 {count} 个节点的流量吗？此操作将清零流量并解除禁用状态。」，确认按钮「确认重置」（默认样式）→ `batchResetTraffic {ids}` →「成功重置 {count} 个节点的流量」/「批量重置流量失败」
   - 分隔线
   - 删除节点 (`batch_delete.menu`，红色) → 确认框：标题「确认批量删除」，内容「确定要删除选中的 {count} 个节点吗？此操作不可恢复。」，确认按钮「确认删除」（destructive）→ `batchDelete {ids}` →「成功删除 {count} 个节点」/「批量删除失败」
   - 每个批量操作成功后：清空勾选 + 刷新列表。确认框取消按钮「取消」。
6. 右侧：表格有数据时显示「编辑排序」按钮（`toolbar.sort.edit`，仅桌面）。

批量操作作用于“筛选后且被勾选”的行（`getFilteredSelectedRowModel`）。官方节点列表**没有**批量绑定机器的入口（只在机器详情里）。

### 3.4 列定义（顺序即显示顺序）

| # | 列 id / accessor | 标题（i18n） | 显示 | 排序 | 默认可见 |
|---|---|---|---|---|---|
| 1 | `select` | —（表头为全选当前页复选框） | 行复选框 | 否 | 是 |
| 2 | `id` | 节点ID (`columns.nodeId`) | 描边徽标，边框色=类型色，内容 `code ?? id`；若有 parent 则追加 `→ {parent.code \|\| parent.id}`。悬停出现复制按钮（复制 `code \|\| id`，toast「复制成功」）。Tooltip：第一行类型显示名（子节点加「(子节点)」），「自定义ID」：code 或 `—`（有值带复制），「原始ID」：id（带复制） | 是（按 id） | 是 |
| 3 | `show` | 显隐 (`columns.show`) | 开关，开启时底色=类型色。切换即乐观更新并调用 `update {id, type, show: 1\|0}`；失败回滚并刷新 | 否 | 是 |
| 4 | `name` | 节点 (`columns.node`)，表头 Tooltip 为三种状态图例 | 状态圆点 + 名称。圆点颜色：`available_status` 0 红（未运行）/1 黄（无人使用或异常）/2 绿（运行正常）。圆点 Tooltip 见 §3.4.1 | 否 | 是 |
| 5 | `machine`（accessorFn=`machine_id ?? "__standalone__"`） | 部署方式 (`columns.deployment.title`)，Tooltip `deployment.tooltip` | 无机器：图标 +「独立部署」；有机器：机器状态圆点（online 绿/offline 红/inactive 灰；never 视为 offline）+ 机器名 + 状态徽标（「服务器在线」/「服务器离线」/「服务器未激活」）+ 若节点 `enabled` 为假显示灰徽标「节点停用」 | 否 | 是 |
| 6 | `host` | 地址 (`columns.address`) | 等宽 `host:port`；若端口不同追加灰字「(内部端口 {server_port})」。官方用严格比较 `port !== server_port`，而 `port` 是字符串、`server_port` 是整数，[推断] 导致几乎总是显示；[建议] 新实现用 `String(port) !== String(server_port)`。悬停复制按钮，Tooltip「复制连接地址」，复制 `host:port` | 否 | 是 |
| 7 | `online` | 在线人数，Tooltip「在线人数根据服务端上报频率而定」 | 用户图标 + 数字 | 是 | 是 |
| 8 | `rate` | 倍率，Tooltip「流量扣费倍率」 | 次要徽标 `"{rate} x"`（原值，如 `1.00 x`） | 否 | 是 |
| 9 | `group_ids` | 权限组，Tooltip「可订阅到该节点的权限组」 | `groups[].name` 徽标列表；空则「--」 | 否 | 是 |
| 10 | `type` | 类型 | 描边徽标（边框色=类型色），内容为原始 type | 否 | **否（隐藏，仅用于筛选）** |
| 11 | `traffic` | 流量使用，Tooltip「节点流量使用情况，显示已用流量和限制」 | `used=u+d`，`total=transfer_enable??0`。`total<=0`：只显示 formatBytes(used)；否则显示宽 48px 进度条（`pct=min(used/total*100,100)`，`pct>90` 红色否则主色）+ formatBytes(used)；Tooltip「已用: x」「总流量: y」「使用率: z.z%」 | 否 | 是 |
| 12 | `actions` | 操作 | 行操作下拉（§3.5） | 否 | 是（右固定） |

#### 3.4.1 状态圆点 Tooltip 内容（`name` 列）
- 第一行：`columns.status.{available_status}` 文案（未运行 / 无人使用或异常 / 运行正常）。
- 若有 `load_status`：三条进度：CPU 使用率 `round(cpu)%`；内存使用 `formatBytes(used) / formatBytes(total)` + 百分比；磁盘使用同上。颜色阈值：`>=90` 红、`>=70` 黄、否则绿。百分比 = `total>0 ? round(used/total*100) : 0`。
- 若有 `metrics`：两列网格：运行时长 `formatUptime(uptime)`；实时/总连接 `active_connections` + (若有 total) ` / total_connections`；出站速率 `formatBytes(outbound_speed)/s`；入站速率 `formatBytes(inbound_speed)/s`；在线用户 `active_users / total_users`；并发协程 `goroutines`；若 `load.load5` 存在显示 `load5.toFixed(2)`；若 `api` 存在显示 `success/failure`（failure>0 时图标红色闪烁）；若 `ws.enabled` 显示 `WS-OK`/`WS-ERR`；若有 `kernel_status` 或 `gc`：`ON`/`OFF` + (若有) ` ({gc.last_pause_ms}ms)`；若 `speed_limiter.has_limits` 或 `limits.device_limit_events>0`：红底 `"{limited_users} Limit"` + (若有事件) `" | {n} Events"`。各项 title 取 `columns.loadStatus.metrics.*`。

### 3.5 行操作（`actions` 下拉）
1. 编辑 (`actions_dropdown.edit`) → 打开编辑弹窗（§4），带入该行数据。
2. 复制 (`actions_dropdown.copy`) → `copy {id}` → toast「复制成功」→ 刷新。无确认。
3. 重置流量 → 确认框：标题「确认重置流量」，内容「此操作将清零该节点的上传和下载流量，并解除禁用状态。确定要继续吗？」，按钮「重置流量」→ `resetTraffic {id}` → toast「流量重置成功」→ 刷新。
4. 分隔线
5. 删除（红色）→ 确认框（destructive）：标题「确认删除」，内容「此操作将永久删除该节点，删除后无法恢复。确定要继续吗？」，按钮「删除」→ `drop {id}` → toast「删除成功」→ 刷新。

### 3.6 排序模式（拖拽）
- 点击「编辑排序」进入：工具栏替换为提示「拖拽节点进行排序，完成后点击保存」+「保存排序」按钮（primary）。
- 进入时：停止 30 秒轮询；列可见性变为仅 `select`、`id`、`name`（加宽）、`traffic`；隐藏分页并把 pageSize 设为全部；行可整行拖拽（官方用 HTML5 DnD，悬停目标行高亮）。
- 拖拽改变的是**本地完整节点数组**的顺序（按 id 定位）。
- 保存：`POST sort` 发送**全部节点** `[{id, order: index+1}]` → toast「排序保存成功」→ 刷新 → 退出排序模式（无论成功失败都会退出）。没有“取消排序”按钮（官方）。[建议] 新实现增加“取消”按钮，丢弃本地顺序。

### 3.7 移动端
窄屏改为卡片列表：主字段 `name`，网格字段 `type, machine, online, rate, group_ids`；工具栏两行（添加+搜索 / 筛选 / 重置+操作）；无排序入口。

---

## 4. 新建 / 编辑节点弹窗

### 4.1 外观与生命周期
- 模态弹窗（宽约 `max-w-xl`，内容区高约 75vh，可滚动）。
- 头部：标题「新建节点」(`form.new_node`) / 「编辑节点」(`form.edit_node`)；已选类型时显示彩色类型徽标；右侧为**类型选择下拉**（placeholder「选择协议类型」），编辑时也可更换类型；副标题 `manage.description`。
- 打开时并行加载：`server/group/fetch`、`server/route/fetch`、`server/manage/getNodes`、`server/machine/fetch`（机器只保留 `is_active !== false`）。
- 底部左侧：「高级设置」按钮（仅已选类型时显示，§4.6）；右侧「取消」(`form.cancel`)、「提交」(`form.submit`)。
- 关闭/取消：重置表单、清空编辑对象。
- 官方**不在提交前做前端 schema 拦截**（直接 getValues 提交，前端 zod 只在输入时显示字段错误）。未选类型点提交 → toast「请先选择协议类型」(`form.type.select_error`)。[建议] 新实现提交前做前端校验，规则见下表“前端校验”列。
- 成功：关闭弹窗，toast「提交成功」(`form.success`)，刷新列表。失败由全局拦截器 toast 后端 message。

### 4.2 通用字段（按显示顺序）

| key | 控件 | 中文标签 / 占位 / 说明 | 默认值（新建） | 前端校验（官方 zod，onChange 显示） | 后端规则 | 提交转换/备注 |
|---|---|---|---|---|---|---|
| name | 文本 | 节点名称 / 请输入节点名称 | `""` | 非空：「请输入有效的节点名称」 | required\|string | — |
| rate | 数字输入（min 0，step 0.1，后缀 `x`） | 基础倍率 | `"1"` | 非空「基础倍率不能为空」；是数字「基础倍率必须是数字」；≥0「基础倍率必须大于或等于0」 | required\|numeric | **当 parent_id 非 "0" 且非 null 时禁用输入**，并在下方显示「子节点倍率继承自父节点」（`form.rate.child_node_note`）。官方仍会把当前值提交 |
| rate_time_enable | 开关 | 启用动态倍率 / 根据时间段设置不同的倍率乘数 | `false` | — | nullable\|boolean | — |
| rate_time_ranges | 规则列表（rate_time_enable=true 时显示） | 区块标题「时间段规则」；按钮「添加规则」；每条标题「规则 {index}」+ 删除图标；字段「开始时间」「结束时间」(time 输入，HH:mm)、「倍率乘数」(数字 min0 step0.1，placeholder 1.0)；无规则时「暂无规则，点击上方按钮添加」 | `[]`；新增一条默认 `{start:"00:00", end:"23:59", rate:"1"}` | start 非空「开始时间不能为空」；end 非空「结束时间不能为空」；rate 非空/数字/≥0（三条 multiplier_error*） | `*.start/end` date_format:H:i；`*.rate` numeric\|min:0（required_with） | 关闭开关不清空规则，仍会提交。区间匹配逻辑见 §9（不支持跨午夜） |
| transfer_enable_gb（虚拟字段） | 数字（min0 step1） | 流量限制 (GB) / 0 表示不限制 | `""` | — | → `transfer_enable` nullable\|integer\|min:0 | **提交：`gb>0 ? round(gb*1024^3) : 0` 写入 `transfer_enable`，并删除 `transfer_enable_gb`**；编辑回填 `transfer_enable ? (transfer_enable/1073741824).toFixed(2) : "0"` |
| code | 文本 | 自定义节点ID (选填) / 请输入自定义节点ID | `""` | — | nullable\|string | 空串→null；同类型下唯一（DB 唯一索引，冲突 500） |
| tags | 标签输入（回车或逗号添加，Backspace 删除最后一个，去重） | 节点标签 / 输入后回车添加标签 | `[]` | — | nullable\|array | 字符串数组 |
| group_ids | 多选（可搜索） | 权限组 / 请选择权限组；无结果「未找到结果」；标签右侧链接「添加权限组」→ 打开权限组创建弹窗（§6.2），成功后刷新选项 | `[]` | — | nullable\|array | **值为 id 字符串**（`["1","2"]`），选项 label=组名 |
| host | 文本 | 节点地址 / 请输入节点域名或者IP | `""` | 非空「节点地址不能为空」 | required | — |
| port | 文本 | 连接端口 / 用户连接端口；标签 Tooltip「用户实际连接使用的端口号。如果使用了中转或隧道，这个端口可能与服务器实际监听的端口不同。」；右侧小按钮（Tooltip「同步到服务端口」）把 port 值复制到 server_port | `""` | 非空「连接端口不能为空」 | required | 字符串；允许 `"a-b"` 端口区间 |
| server_port | 文本 | 服务端口 / 请输入服务端口；Tooltip「服务器上的实际监听端口。」 | `""` | 非空「服务端口不能为空」 | required | DB 为 int；[建议] 前端校验 1–65535 整数（见 §9） |
| protocol_settings | 协议区块（§4.8） | 未选类型时显示「请先选择协议类型」 | 选择类型时按该类型 schema 默认值生成 | 见各类型 | 见 §2.5 | 对象 |
| parent_id | 下拉 | 父级节点 / 选择父节点；首项「无」(值 "0") | `"0"` | — | nullable\|integer | 候选 = 全部节点中 `parent_id ∈ {0,null}` 且 `type == 当前类型` 且 `id != 当前编辑 id`，显示 name。提交值为字符串 "0" 或 id |
| route_ids | 多选 | 路由组 / 选择路由组；无结果「未找到结果」 | `[]` | — | nullable\|array | 值为 id 字符串，label=remarks |
| machine_id | 下拉 | 绑定服务器 / 选择服务器（可选）；首项「独立部署」；其余：状态圆点 + 名称 + 灰字 `SID:{id}`（仅 is_active 的机器） | `null`（来自 `?machine_id` 预填时为该 id） | — | nullable\|integer | 选择机器且 enabled 为 null 时自动置 `enabled=true`；选回“独立部署”时置 `enabled=null` |
| enabled | 开关（仅 machine_id 非空时显示，嵌在机器信息卡片里） | 卡片显示机器名 + 状态圆点 + 说明「选择是否由此服务器管理该节点」 | `null`（预填时 true） | — | nullable\|boolean | 开关显示值 `enabled ?? true` |

官方表单还会提交、但后端忽略或不落库的键：`id`（编辑时有，作为定位）、`specific_key`(null)、`show`（新建 false；编辑沿用）、`banned`、`excludes`([])、`ips`([])、`listen_address`("")、以及编辑时整行带入的 `groups/parent/online/...` 计算字段。新实现**不必发送**这些键（`show` 例外：新建时发送 `show:false` 与官方一致，编辑时可不发送以免覆盖列表上的切换——但官方会发送当前值）。

### 4.3 提交数据（官方实际 body）
```jsonc
{
  // 表单全部值（去掉 transfer_enable_gb）
  "id": 12,                    // 编辑时
  "name": "...", "rate": "1", "rate_time_enable": false, "rate_time_ranges": [],
  "tags": [], "group_ids": ["1"], "route_ids": [], "host": "a.com", "port": "443", "server_port": "443",
  "parent_id": "0", "code": "", "show": false,
  "machine_id": null, "enabled": null,
  "custom_outbounds": [], "custom_routes": [],
  "cert_config": { "cert_mode": "none", ... },   // 仅当打开过高级设置/编辑时已有
  "protocol_settings": { ... },                   // 当前类型子表单的完整值（含 routing:{}、cert_config:{...} 等被后端丢弃的键）
  "type": "vless",
  "transfer_enable": 0
}
```

[建议] 新实现提交时做规范化：
- `group_ids`、`route_ids` 转为**字符串数组**（与现有数据和后端 JSON 查询一致）。
- `parent_id`：无父节点发送 `0`（或 `null`），有则发送数字。
- `rate` 发送数字或数字字符串均可。
- `rate_time_ranges[].rate` 发送数字。
- 不发送 `transfer_enable_gb/excludes/ips/listen_address/banned/specific_key`。
- `protocol_settings` 只发送 §4.8 中列出的键，删除 `routing`、`cert_config`（子表单内的那份）。
- mieru 的 `traffic_pattern` 为空时**不要发送该键**（见 §9）。

### 4.4 编辑回填
- `protocol_settings`：若为字符串先 `JSON.parse`；官方用该类型 zod schema `safeParse`：成功则使用解析结果（会补默认值并**剥离 schema 未定义的键**，如 shadowsocks 的 `obfs/obfs_settings`、vmess 的 `rules`），失败则使用原始对象（常见于后端字段为 `null` 而 schema 要求字符串时）。
- [建议] 新实现：以“该类型默认值”深合并“后端值”（后端 `null` 视为未填，用默认值/空串展示），**保留未知键**，提交时再按白名单输出，避免官方那种隐式丢字段。
- `transfer_enable_gb` 回填见 §4.2。其余字段直接取行数据。

### 4.5 类型切换
- 官方为每种类型缓存一份 protocol_settings（Map）：切走时保存当前类型的值；切到某类型时取其缓存（无则 `{}`）并用该类型 schema 补默认值。编辑已有节点时，原类型的缓存为节点原值。关闭弹窗清空缓存。
- 切换类型不清空通用字段。parent 候选随类型变化。

### 4.6 高级设置弹窗（Advanced）
触发按钮「高级设置」(`dynamic_form.advanced.trigger_label`)，按钮右侧在有配置时显示小标记：`TLS`（cert_config.cert_mode 存在且 ≠ none）、`MUX`（protocol_settings.multiplex.enabled，点击直达多路复用 Tab）、`RT`（custom_outbounds 或 custom_routes 非空，点击直达 Outbounds Tab）。

弹窗标题「高级协议配置」(`advanced.dialog_title`)，Tabs（按可用性动态组成）：

| Tab | 条件 | 内容 |
|---|---|---|
| TLS (`advanced.tls_tab`) | 类型 schema 含 cert_config：vmess、vless、trojan、hysteria、tuic、anytls、http、naive | §4.6.1，直接编辑顶层 `cert_config` |
| 多路复用 (`advanced.multiplex_tab`) | 类型 schema 含 multiplex：vmess、vless、trojan | §4.7.4，前缀 `protocol_settings.multiplex` |
| 自定义 Outbounds (`routing.outbounds_tab`) | 总是 | 文本域「自定义 Outbounds (JSON)」，placeholder `[{"tag": "proxy", "protocol": "shadowsocks", ...}]` |
| 自定义 Routes (`routing.routes_tab`) | 总是 | 文本域「自定义 Routes (JSON)」，placeholder `[{"outboundTag": "proxy", "domain": ["domain:google.com"], ...}]` |

默认打开的 Tab：TLS（若可用）→ 多路复用（若可用）→ Outbounds。打开时：Outbounds/Routes 文本域填入当前数组的 `JSON.stringify(x,null,2)`（空数组显示空），dns_env 文本由对象转为 `KEY=VALUE` 行。

底部「取消」「保存」(`common.save`)：保存时解析两个文本域——空 → `[]`；非数组 → 字段下红字「必须是一个 JSON 数组 []」；非法 JSON →「无效的 JSON 格式」；有错误不关闭。注意：TLS/多路复用 Tab 的修改是**即时写入表单**的，“取消”不会回滚它们（官方行为）。

注：mieru 后端支持 multiplex，但官方 UI 不提供入口；shadowsocks/socks/mieru 没有 TLS 证书 Tab。

#### 4.6.1 证书配置 `cert_config`（顶层字段）

| key | 控件 | 标签 | 显示条件 | 默认 |
|---|---|---|---|---|
| cert_mode | 下拉 | 证书模式；选项：`none`→「none」、`http`→「http-01 (ACME)」、`dns`→「dns-01 (ACME)」、`self`→「self-signed」、`content`→「content (Cert Push)」 | 总是 | `none` |
| domain | 文本 placeholder `example.com` | 证书域名 | mode ∈ http/dns/self/content | `""` |
| email | 文本 placeholder `admin@example.com` | 通知邮箱 | mode ∈ http/dns | `""` |
| http_port | 数字 | 认证端口；说明「ACME 认证端口 (默认 80)」 | mode = http | 80 |
| dns_provider | 文本 placeholder `cloudflare / alidns / dnspod` | DNS 提供商；下方链接「查看 DNS 提供商配置指南」→ https://go-acme.github.io/lego/dns/ | mode = dns | `""` |
| dns_env | 多行文本 placeholder `CF_API_TOKEN=xxxxxx\nALIDNS_ACCESS_KEY_ID=xxxx` | 环境变量 (API 密钥)；说明「每行一个 KEY=VALUE 配置」 | mode = dns | `{}` |
| cert_content | 多行 placeholder `-----BEGIN CERTIFICATE-----\n...` | 证书内容 (Public Key) | mode = content | `""` |
| key_content | 多行 placeholder `-----BEGIN RSA PRIVATE KEY-----\n...` | 密钥内容 (Private Key) | mode = content | `""` |

模式说明文字（下拉下方）：none「选择证书申请方式，仅部分后端节点支持」；self「自签名模式：仅需填写域名，证书由节点后端自动生成（10年有效期）」；http「HTTP-01 模式：需要 80 端口可正常访问以完成认证」；dns「DNS-01 模式：通过 DNS 解析记录认证，支持申请泛域名证书」；content「内容推送模式：直接将证书内容下发至节点」。mode=none 时显示空态图标 +「未启用 TLS 证书配置」。

dns_env 转换：逐行，找第一个 `=`（位置必须 >0），`key=trim(左)`，`value=trim(右)`，空 key 忽略 → 对象 `{KEY: VALUE}`。后端原样存 JSON；节点端在 `cert_mode != none` 时收到。

### 4.7 公共子块

#### 4.7.1 TLS settings（`tls_settings.*` 或 `tls.*`）
- `server_name`：文本，标签「服务器名称指示(SNI)」，placeholder 视类型「不使用请留空」或「当节点地址与证书不一致时用于证书验证」。
- `allow_insecure`：开关，标签「允许不安全?」（http/naive 为「允许不安全连接」）。

#### 4.7.2 uTLS（`utls`）
- 容器：带边框卡片，标题「uTLS」，说明「客户端伪装指纹，用于降低被识别风险」。
- `utls.enabled` 开关（默认 false）；打开且 fingerprint 为空时自动填 `chrome`。
- `utls.fingerprint`（enabled 时显示）：下拉，标签「客户端指纹 (uTLS)」，选项 `chrome/Chrome, firefox/Firefox, safari/Safari, ios/iOS, edge/Edge, random/Random`，默认 `chrome`。

#### 4.7.3 ECH（`{prefix}.ech`，prefix = `tls_settings` 或 `tls`）
- 容器卡片，标题「ECH」，说明「为支持的 TLS 客户端启用 Encrypted Client Hello。留空配置时会尝试通过 DNS 查询。」
- `ech.enabled` 开关（默认 false）。以下在 enabled 时显示：
- 按钮「自动生成 ECH 密钥对」：调用 `GET generateEchKey`（加载中按钮转圈并禁用），成功把 `data.key` 写入 `ech.key`、`data.config` 写入 `ech.config`；失败静默（全局拦截器 toast）。
- `ech.config`：多行（min-h 120），「ECH 配置 (PEM)」，placeholder「粘贴 PEM 格式的 ECH 配置，每行一段内容」，说明「留空时，sing-box 会尝试通过 DNS 加载 ECH 配置。」
- `ech.key`：多行（min-h 100），「ECH Key」，placeholder「当后端需要时粘贴 ECH key 内容」，说明「后端需要时可填写的 ECH key 内容。」
- `ech.query_server_name`：文本，「ECH 查询域名」，placeholder「可选，用于覆盖 HTTPS 记录查询域名」，说明「覆盖用于 ECH HTTPS 记录查询的域名，留空时默认使用 server_name。」
- 默认值：`{enabled:false, config:"", query_server_name:"", key:""}`。`key_path/config_path` 在模型里存在但 UI 与校验均无（恒为 null）。

#### 4.7.4 多路复用（`multiplex`）
- 卡片标题「多路复用 (Multiplex)」，说明「通过单条 TCP 连接传输多个流，降低握手延迟」；`enabled` 开关。以下在 enabled 时显示：
- `protocol`：下拉 `smux / yamux / h2mux`，标签「复用协议」；下方提示：h2mux 时「适合高延迟、大带宽且不需要 Brutal 的环境」，其它「通用模式，兼容性最好」。
- `max_connections`：数字，「最大连接数」，提示「最大建立的物理 TCP 数量」。
- `padding`：开关，「启用填充」，提示「填充数据包以对抗流量特征分析」。
- `brutal.enabled`：开关，「TCP Brutal (激进拥塞控制)」；开启后显示 `brutal.up_mbps`「上行带宽」、`brutal.down_mbps`「下行带宽」（数字，后缀 Mbps）+ 斜体提示「* TCP Brutal 是双边加速算法，建议带宽设为机器实际带宽的 80%-90%，开启后 BBR 将失效。」
- 前端默认：`{enabled:false, protocol:"smux", max_connections:4, padding:false, brutal:{enabled:false, up_mbps:100, down_mbps:100}}`（**与后端默认 protocol=yamux、max_connections=null 不同**；官方新建节点会把前端默认写入库）。数字输入用 `Number(value)`。
- 后端校验允许 `min_streams/max_streams` 但不落库，UI 不提供（locale 有 `min_streams` 文案未使用）。

#### 4.7.5 Reality（`reality_settings`，vless/trojan 在 `tls=2` 时）
| key | 控件 | 标签 / 占位 | 默认（前端） | 备注 |
|---|---|---|---|---|
| server_name | 文本 | 伪装站点(dest) / 例如：example.com | `""` | |
| server_port | 文本 | 端口(port) / 例如：443 | `443` | 后端存为字符串 |
| allow_insecure | 开关 | 允许不安全? | false | |
| private_key | 文本 + 右侧钥匙按钮（Tooltip「生成密钥对」） | 私钥(Private key) | `""` | 点击生成 X25519 密钥对：base64 后转 URL-safe（`+→-`，`/→_`，去 `=`），同时写 private_key 与 public_key；toast「密钥对生成成功」/「生成密钥对失败」 |
| public_key | 文本 | 公钥(Public key) | `""` | |
| short_id | 文本 + 刷新按钮（Tooltip「生成 Short ID」） | Short ID / 可留空，长度为2的倍数，最长16位；说明「客户端可用的 shortId 列表，可用于区分不同的客户端，使用0-f的十六进制字符」 | `""` | 生成随机十六进制串，长度随机取 2,4,…,16；toast「Short ID 生成成功」 |
| fingerprint | — | （vless schema 有默认 `chrome`，无控件；后端不落库） | | |

#### 4.7.6 传输层配置编辑器（`network_settings`）
- 在「传输协议」标签旁的链接按钮「编辑协议」(`network_settings.edit_protocol`) 打开小弹窗，标题「编辑协议配置」。
- 顶部按当前 `network` 显示模板按钮「使用{{template}}模板」：

| network | 模板（label → 内容） |
|---|---|
| tcp | `TCP` → `{"acceptProxyProtocol":false,"header":{"type":"none"}}`；`TCP + HTTP` → `{"acceptProxyProtocol":false,"header":{"type":"http","request":{"version":"1.1","method":"GET","path":["/"],"headers":{"Host":["www.example.com"]}},"response":{"version":"1.1","status":"200","reason":"OK"}}}` |
| grpc | `gRPC` → `{"serviceName":"GunService"}` |
| ws | `WebSocket` → `{"path":"/","headers":{"Host":"v2ray.com"}}` |
| h2 | `HTTP/2` → `{"path":"/","host":["www.google.com"]}` |
| httpupgrade | `HttpUpgrade` → `{"acceptProxyProtocol":false,"path":"/","host":"xray.com","headers":{"key":"value"}}` |
| xhttp | `XHTTP` → `{"host":"example.com","path":"/yourpath","mode":"auto","extra":{"headers":{},"xPaddingBytes":"100-1000","noGRPCHeader":false,"noSSEHeader":false,"scMaxEachPostBytes":1000000,"scMinPostsIntervalMs":30,"scMaxBufferedPosts":30,"xmux":{"maxConcurrency":"16-32","maxConnections":0,"cMaxReuseTimes":"64-128","cMaxLifetimeMs":0,"hMaxRequestTimes":"800-900","hKeepAlivePeriod":0},"downloadSettings":{"address":"","port":443,"network":"xhttp","security":"tls","tlsSettings":{},"xhttpSettings":{"path":"/yourpath"},"sockopt":{}}}}` |
| kcp | 无模板 |

- 文本域（等宽，min-h 200），placeholder「请输入JSON配置或选择上方模板」/（无模板时）「请输入JSON配置」；实时校验：非对象「配置必须是一个JSON对象」，非法「无效的JSON格式」，有错时确认按钮禁用。
- 「确定」：空文本 → `network_settings = null`；否则写入解析对象。**点击遮罩/ESC 关闭也会触发保存**；「取消」直接关闭不保存（官方行为）。打开时若已有值则以 `JSON.stringify(v,null,2)` 填充。

### 4.8 按类型的 `protocol_settings`

> 表中“前端默认”= 官方新建节点时写入的值；“后端”= `ServerSave` 规则 / 模型是否持久化。条件显示均指官方 UI。

#### 4.8.1 shadowsocks
| key | 控件 / 标签 | 前端默认 | 选项 / 条件 | 后端 |
|---|---|---|---|---|
| cipher | 可搜索组合框「加密算法」，占位「选择加密算法」，说明「选择预设加密方式或输入自定义加密方式」；搜索框占位「搜索或输入自定义加密方式...」，分组「预设加密方式」；输入非预设值即生效，并出现「使用 "xxx" (自定义)」项；无结果提示「未找到匹配的加密方式」「你可以直接输入自定义的加密方式，如：aes-256-cfb」 | `aes-128-gcm` | 预设：`aes-128-gcm, aes-192-gcm, aes-256-gcm, chacha20-ietf-poly1305, 2022-blake3-aes-128-gcm, 2022-blake3-aes-256-gcm, 2022-blake3-chacha20-poly1305` | required\|string；持久化 |
| plugin | 下拉「插件」，占位「选择插件」 | `""`（显示为 None） | `none`(None，提交为 `""`→null)、`obfs`(Simple Obfs)、`v2ray-plugin`(V2Ray Plugin)、`gost-plugin`(Gost Plugin)、`shadow-tls`(Shadow TLS)、`restls`(ResTLS)、`kcptun`(KCPTun)；选中后下方显示对应提示（obfs_hint/v2ray_hint/gost_hint/shadow_tls_hint/restls_hint/kcptun_hint 原文见 locale） | nullable\|string；持久化 |
| plugin_opts | 文本「插件选项」，说明「按照 key=value;key2=value2 格式输入插件选项」，占位「例如: mode=tls;host=bing.com」 | `""` | plugin 非空且非 none 时显示 | nullable\|string；持久化 |
| client_fingerprint | 下拉「客户端指纹」，占位「选择客户端指纹」，说明「客户端伪装指纹，用于降低被识别风险」 | `chrome` | plugin ∈ {shadow-tls, restls} 时显示；选项 chrome/firefox/safari/ios | **后端不校验也不落库**（丢失） |
| obfs / obfs_settings.path / obfs_settings.host | 官方 UI 无控件（locale 有「混淆」「路径」「Host」文案） | — | — | 后端校验+持久化；**官方编辑时会被 zod 剥离而清空**（§9） |

无 TLS 证书 Tab、无多路复用 Tab。

#### 4.8.2 vmess
| key | 控件 / 标签 | 前端默认 | 选项 / 条件 | 后端 |
|---|---|---|---|---|
| tls | 下拉「TLS」占位「请选择安全性」 | `0` | `0`=None，`1`=TLS（数字） | required\|integer |
| tls_settings.server_name | 文本「服务器名称指示(SNI)」/「不使用请留空」 | `""` | tls=1 | 持久化 |
| tls_settings.allow_insecure | 开关「允许不安全?」 | false | tls=1 | 持久化 |
| utls.* | §4.7.2 | `{enabled:false,fingerprint:"chrome"}` | tls=1 | 持久化 |
| tls_settings.ech.* | §4.7.3 | 见 §4.7.3 | tls=1 | 持久化（key_path/config_path 除外） |
| network | 下拉「传输协议」/「选择传输协议」 + 「编辑协议」链接 | `tcp` | `tcp`(TCP)、`ws`(Websocket)、`grpc`(gRPC)、`h2`(HTTP/2)、`httpupgrade`(HttpUpgrade)、`xhttp`(XHTTP) | required\|string |
| network_settings | §4.7.6 | `{}` | — | nullable\|array |
| multiplex | 高级设置 → 多路复用 | §4.7.4 | — | 持久化 |
| rules | 无控件 | — | — | 后端校验+持久化；官方编辑会剥离 |

#### 4.8.3 vless
| key | 控件 / 标签 | 前端默认 | 选项 / 条件 | 后端 |
|---|---|---|---|---|
| tls | 下拉「安全性」/「请选择安全性」 | `0` | `0`=无，`1`=TLS，`2`=Reality | required\|integer |
| tls_settings.server_name / allow_insecure | §4.7.1（占位「不使用请留空」） | `""`/false | tls=1 | 持久化 |
| utls | §4.7.2 | | tls=1 **或** tls=2 | 持久化 |
| tls_settings.ech | §4.7.3 | | tls=1（Reality 下不显示） | 持久化 |
| reality_settings.* | §4.7.5 | `{server_port:443, server_name:"", allow_insecure:false, public_key:"", private_key:"", short_id:"", fingerprint:"chrome"}` | tls=2 | 持久化（fingerprint 除外） |
| network | 下拉「传输协议」+「编辑协议」 | `tcp` | `tcp`(TCP)、`ws`(Websocket)、`grpc`(gRPC)、`h2`(HTTP/2)、**`kcp`(mKCP)**、`httpupgrade`(HttpUpgrade)、`xhttp`(XHTTP) | required\|string |
| network_settings | §4.7.6 | `{}` | | nullable\|array |
| flow | 下拉「流控」/「选择流控」 | `""`（显示 none） | `none`（提交 null）、`xtls-rprx-direct`、`xtls-rprx-splice`、`xtls-rprx-vision` | nullable\|string |
| encryption.enabled | 卡片开关「VLESS Encryption」/ 说明「启用 VLESS 加密」 | false | 总是显示 | nullable\|boolean |
| encryption.decryption | 文本，标签「decryption」，占位「./xray vlessenc 生成」 | `""` | encryption.enabled | 持久化（下发节点端） |
| encryption.encryption | 文本，标签「encryption」，占位「./xray vlessenc 生成」 | `""` | encryption.enabled；卡片底部斜体提示「* ./xray vlessenc 生成」 | 持久化（用于订阅） |
| multiplex | 高级设置 | §4.7.4 | | 持久化 |

#### 4.8.4 trojan
| key | 控件 / 标签 | 前端默认 | 选项 / 条件 | 后端 |
|---|---|---|---|---|
| tls | 下拉「安全性」 | `1` | **只有** `1`=TLS、`2`=Reality（无“无”选项） | nullable\|integer；模型默认 1 |
| tls_settings.server_name | 文本「服务器名称指示(SNI)」/「当节点地址于证书不一致时用于证书验证」 | `""` | tls=1 | 持久化（节点端用它作 server_name） |
| tls_settings.allow_insecure | 开关「允许不安全?」 | false | tls=1 | 持久化 |
| reality_settings.* | §4.7.5（无 fingerprint） | 同 vless（无 fingerprint） | tls=2 | 持久化 |
| utls | §4.7.2 | | **总是显示**（tls=1 或 2） | 持久化 |
| tls_settings.ech | §4.7.3 | | **总是显示**（含 Reality 时） | 持久化 |
| network | 下拉「传输协议」+「编辑协议」 | `tcp` | tcp、ws、grpc、h2、httpupgrade、xhttp（无 kcp） | required\|string |
| network_settings | §4.7.6 | `{}` | | nullable\|array |
| server_name（根）/ allow_insecure（根） | 无控件（历史字段，迁移 `normalize_trojan_tls_settings` 已并入 tls_settings） | `""` / false | | nullable；持久化 |
| multiplex | 高级设置 | | | 持久化 |

#### 4.8.5 hysteria（含 Hysteria2）
| key | 控件 / 标签 | 前端默认 | 选项 / 条件 | 后端 |
|---|---|---|---|---|
| version | 下拉「协议版本」 | `2` | `1`→「V1」，`2`→「V2」（数字） | required\|integer |
| alpn | 下拉「ALPN」 | `"h2"` | 仅 version=1 显示；选项 `hysteria, http/1.1, h2, h3` | nullable\|string 校验，但**模型不持久化**（丢失） |
| obfs.open | 开关「混淆」 | false | 总是 | 持久化 |
| obfs.type | 下拉「混淆实现」/「选择混淆实现」 | `salamander` | obfs.open 且 version=2；唯一选项 `salamander`(Salamander) | 持久化 |
| obfs.password | 文本「混淆密码」/「请输入混淆密码」+ 刷新按钮 | `""` | obfs.open；按钮生成 16 位 `[A-Za-z0-9]` 随机串，toast「混淆密码生成成功」 | 持久化 |
| tls.server_name | 文本「服务器名称指示(SNI)」/「当节点地址于证书不一致时用于证书验证」 | `""` | 总是 | 持久化 |
| tls.allow_insecure | 开关「允许不安全?」 | false | 总是 | 持久化 |
| tls.ech | §4.7.3 | | 总是 | 持久化 |
| bandwidth.up | 数字「上行宽带」，后缀「Mbps」，占位「请输入上行宽带」(version=2 时追加「，留空则使用BBR」) | `""` | 总是 | nullable\|integer；空→null |
| bandwidth.down | 同上「下行宽带」 | `""` | 总是 | 同上 |
| hop_interval | 数字「Hop 间隔 (秒)」，占位「例如: 30」，说明「Hop 间隔时间，单位为秒」 | 未设置 | 总是；输入为空 → undefined | integer\|nullable；持久化（订阅中用于端口跳跃，配合 `port` 区间） |
| port_range | 无控件（schema 中可选） | — | | **后端不持久化**；端口跳跃请把节点 `port` 写成 `"起-止"` |

#### 4.8.6 tuic
| key | 控件 / 标签 | 前端默认 | 选项 / 条件 | 后端 |
|---|---|---|---|---|
| version | 下拉「协议版本」/「选择TUIC版本」 | `5` | `5`→V5，`4`→V4 | nullable\|integer |
| congestion_control | 下拉「拥塞控制」/「选择拥塞控制算法」 | `bbr` | `bbr, cubic, new_reno`（显示为大写） | nullable\|string（模型默认 cubic） |
| tls.server_name / tls.allow_insecure | §4.7.1（占位「当节点地址与证书不一致时用于证书验证」） | `""`/false | 总是 | 持久化 |
| tls.ech | §4.7.3 | | 总是 | 持久化 |
| alpn | 多选「ALPN」/「选择ALPN协议」，无结果「未找到可用的ALPN协议」 | `["h3"]` | `h3`(HTTP/3)、`h2`(HTTP/2)、`http/1.1`(HTTP/1.1) | nullable\|array；持久化 |
| udp_relay_mode | 下拉「UDP中继模式」/「选择UDP中继模式」 | `native` | `native`(Native)、`quic`(QUIC) | nullable\|string；持久化 |

（locale 中 `tuic.password` 文案未使用。）

#### 4.8.7 socks
官方 UI **无任何协议字段**（子表单组件返回空）；protocol_settings 只提交 `{routing:{}}`。后端支持 `tls`（nullable\|integer，默认 0）与 `tls_settings.*`/ECH。无 TLS 证书 Tab。[建议] 新实现可补 TLS 下拉（0 不支持 / 1 支持）+ TLS settings + ECH（locale `dynamic_form.socks.*` 文案已就绪），但这是超出官方的功能，需标注。

#### 4.8.8 naive / http（结构相同，文案前缀分别为 `dynamic_form.naive.*` / `dynamic_form.http.*`）
| key | 控件 / 标签 | 前端默认 | 选项 / 条件 | 后端 |
|---|---|---|---|---|
| tls | 下拉「TLS」/「请选择安全性」 | `0` | `0`=「不支持」，`1`=「支持」 | required\|integer |
| tls_settings.server_name | 文本「服务器名称指示(SNI)」（naive 占位「不使用请留空」，http 占位「当节点地址与证书不一致时用于证书验证」） | `""` | tls=1 | 持久化 |
| tls_settings.allow_insecure | 开关（naive「允许不安全?」，http「允许不安全连接」） | false | tls=1 | 持久化 |
| tls_settings.ech | §4.7.3 | | tls=1 | 持久化 |

#### 4.8.9 anytls
| key | 控件 / 标签 | 前端默认 | 选项 / 条件 | 后端 |
|---|---|---|---|---|
| tls.server_name | 文本「服务器名称指示(SNI)」/「当节点地址与证书不一致时用于证书验证」 | `""` | 总是 | 持久化 |
| tls.allow_insecure | 开关「允许不安全连接」 | false | 总是 | 持久化 |
| tls.ech | §4.7.3 | | 总是 | 持久化 |
| padding_scheme | 多行文本「填充方案」，说明「用于混淆流量特征的填充方案，每行一条规则，支持通配符 *」，占位「选择填充方案」；标签右侧按钮「使用默认方案」 | `[]` | 文本按 `\n` 拆分并丢弃空白行 → 字符串数组；显示时数组 `join("\n")` | nullable\|array；持久化（`[]` 会存成空数组；只有缺失/null 才用模型默认） |

默认方案（按钮写入、亦为模型默认）：
```
stop=8
0=30-30
1=100-400
2=400-500,c,500-1000,c,500-1000,c,500-1000,c,500-1000
3=9-9,500-1000
4=500-1000
5=500-1000
6=500-1000
7=500-1000
```
（后端校验接受 `alpn` 字符串但模型不持久化；官方 UI 无此控件。）

#### 4.8.10 mieru
| key | 控件 / 标签 | 前端默认 | 选项 / 条件 | 后端 |
|---|---|---|---|---|
| transport | 下拉「传输协议」/「选择传输协议」 | `TCP` | `TCP`、`UDP` | required\|string\|in:TCP,UDP |
| traffic_pattern | 文本「流量 (Base64)」/「请输入 Base64 字符串用于微调网络行为」+ 右侧生成按钮 | `""` | 生成算法：`a=随机100..200`，`b=随机400..600`；`inner=[0x08,varint(a),0x10,varint(b)]`；`outer=[0x0A,varint(len(inner)),...inner]`；base64 编码；toast「流量模式已生成」 | `string`（**非 nullable**，空串被转 null 后校验失败，见 §9） |
| multiplex | 官方无入口 | — | — | 后端支持并持久化 |

---

## 5. 页面：服务器管理 `/server/machine`

### 5.1 页面结构
- 标题「服务器管理」(`machine.title`)，副标题「用于查看服务器健康、负载与承载节点，并从运维视角快捷发起节点操作。」
- 数据：`GET machine/fetch`（缓存键 `machineList`，staleTime 30s，每 60 秒刷新，挂载和窗口聚焦时总是重新拉取）。前端分页（默认每页 10，选项 10…500）。

### 5.2 状态计算（前端）
- `status(m)`：`!is_active` → `inactive`；`!last_seen_at` → `never`；`now - last_seen_at < 300` 秒 → `online`；否则 `offline`。
- 负载百分比：`cpu = load_status.cpu`；`mem = mem.total>0 ? used/total*100 : 0`；`disk` 同理；无 load_status 时全 0。
- 阈值：cpu warn 70 / danger 85；mem warn 75 / danger 90；disk warn 80 / danger 90。`高负载 = load_status 存在 且 (cpu>=85 或 mem>=90 或 disk>=90)`。
- 颜色：online 绿（emerald）、offline 红、inactive 灰（slate-400）、never 灰圆点/琥珀卡片。

### 5.3 概览条（表格上方 5 个统计卡）
「服务器总数」= 总数；「在线服务器」= online 数；「离线/失联」= offline + never 数（>0 时红色调）；「高负载」= 高负载数（>0 琥珀色）；「节点数」= Σ servers_count。

### 5.4 工具栏
- 「添加服务器」按钮（§5.6 表单，新建）。
- 搜索框「搜索服务器名称、备注或 SID...」：对 `name + notes + "sid:{id}" + id` 拼接串做小写子串匹配。
- 多选筛选「状态」：在线(online)/离线(offline)/已禁用(inactive)/从未上报(never)。
- 多选筛选「节点」：已承载节点(with_nodes: servers_count>0)/空闲服务器(idle_nodes: =0)/高负载(high_load)；任一匹配。
- 有筛选时「重置」。
- 右侧徽标：「在线: {online}/{total}」、「高负载: {n}」。
- 下方提示：「适合集中查看服务器在线情况、承载节点数量与资源压力。」

### 5.5 列
| 列 | 标题 | 内容 |
|---|---|---|
| name | 服务器名称 | 服务器图标；第一行：名称、状态圆点、`SID:{id}` 徽标、高负载时琥珀徽标「高负载」；第二行：状态徽标（在线绿 / 离线红 destructive / 已禁用 secondary / 从未上报 outline 灰）•「最后心跳: {relativeAgo(last_seen_at)}」•「节点数: {servers_count}」；第三行：notes（单行截断，有才显示） |
| status | 状态 | 状态徽标（同上） |
| node_state | （隐藏，仅筛选用） | — |
| load | 负载 | 无 load_status →「暂无负载数据」；否则 CPU 进度条、MEM 进度条（右侧百分比取整，颜色按阈值：danger 红、warn 琥珀、否则主色）、DISK `formatBytes(used) / formatBytes(total)` |
| relation | 节点数 | 大号数字 servers_count + 「已承载节点」/「暂无承载」；按钮「服务器详情」→ 打开详情抽屉 |
| last_seen | 最后心跳 | `relativeAgo(last_seen_at)`；第二行「负载上报: {relativeAgo(load_status.updated_at)}」或「暂无负载数据」 |
| actions | 操作 | 图标按钮：详情（Tooltip「服务器详情」）、编辑（「编辑服务器」，打开编辑表单）、删除（「删除」，红色）→ 确认框标题「确认删除服务器？」，内容「关联节点将自动解绑（不会被删除），此操作不可撤销。」→ `drop {id}` → toast「服务器删除成功」/ 失败「删除服务器失败」→ 刷新 |

移动端卡片：主字段 name，网格 load、relation、last_seen。

### 5.6 新建 / 编辑服务器表单（弹窗）
| key | 控件 | 标签 / 占位 | 默认 | 校验 |
|---|---|---|---|---|
| name | 文本 | 服务器名称 / 例如 HK-01 | `""` | 必填：「请输入服务器名称」（后端 max 255） |
| notes | 多行（3 行） | 备注 / 关于此服务器的可选备注 | `""` | 可选 |
| is_active | 开关（带边框行） | 启用服务器 / 「禁用后 xboard-node 将不再使用此服务器。」 | `true` | — |

- 标题：新建「新建服务器」+ 说明「当你希望一台服务器承载多个节点时，再创建服务器记录。」；编辑「编辑服务器」+「修改服务器名称、备注或启用状态。」
- 校验时机 onBlur；表单无效或提交中时提交按钮禁用（带转圈）。按钮：「取消」、新建「提交」/ 编辑「更新」。
- 提交 `POST machine/save`：编辑带 `id`。成功 toast「服务器创建成功」/「服务器更新成功」，刷新列表、关闭弹窗；失败 toast「保存服务器失败」。
- **新建成功后**弹出「服务器 Token」对话框（琥珀色头部）：说明「Token 已生成，后续可在服务器详情页中查看。」；Token 代码块 + 复制按钮（toast「Token 已复制到剪贴板」）；「安装 xboard-node」区块：深色代码块显示 `install_command` + 复制按钮（toast「安装命令已复制」）+ 提示「需要 root 或 sudo 权限，且目标服务器需为支持 systemd 的 Linux。」；底部按钮「提交」关闭。

### 5.7 服务器详情抽屉（右侧 Sheet，宽至 4xl）
标题：服务器图标 + 名称。内容自上而下：

1. **信息卡**：`SID:{id}` 徽标、状态徽标、一个按 CPU 档位着色的圆点（danger 红 / warn 灰 / 正常绿）+「CPU {cpu}%」；「最后心跳: …」•「节点数: …」；notes；右侧按钮「新增节点到此服务器」→ 关闭抽屉并跳转 `/server/manage?machine_id={id}&open_create=1`；「前往节点管理」→ `/server/manage?machine_id={id}`。
2. **两栏**：
   - **负载趋势**（图表卡）：标题「负载趋势」；右上角时间范围按钮 `1h / 6h / 12h / 24h`，默认 **6h**；对应请求 `history?machine_id&limit&range_hours`：1h→`limit=60,range_hours=1`；6h→`360,6`；12h→`720,12`；24h→`1440,24`。抽屉打开时自动刷新：范围 ≥12h 每 120 秒，否则每 30 秒。
     - 数据点：`time = format(recorded_at*1000, range<=6h ? "HH:mm" : "MM/dd HH:mm")`；`cpu = cpu.toFixed(1)`；`mem = mem_total>0 ? used/total*100 (1 位小数) : 0`；`disk` 同理；`netIn = net_in_speed`、`netOut = net_out_speed`（可为 null）。
     - 面积图（monotone）：左轴 0–100%（cpu 主色线宽 2、MEM `#f59e0b`、DISK `#ef4444` 半透明）；若任一点有网络数据，增加右轴（formatSpeed）显示 `↓ IN #10b981`、`↑ OUT #3b82f6`。图例可点击切换系列显隐（隐藏项置灰+删除线）；Tooltip 显示时间与各系列值（百分比或速率）。无数据「暂无历史负载数据」；加载中骨架。
   - **负载**（当前值卡）：CPU `{cpu.toFixed(1)}%`、内存 `used / total`、磁盘 `used / total` 三条进度（按阈值着色）；若 `load_status.net` 存在显示「网络速率 ↓{in} ↑{out}」；无数据「暂无负载数据」。
3. **服务器 Token 卡**：标题「服务器 Token」，说明「此 Token 用于 xboard-node 向面板认证，请妥善保管。」
   - 「查看 Token」→ `GET getToken?id=` → 显示 Token（代码块 + 复制按钮，复制成功图标变勾 2 秒，失败 toast「复制失败，请手动复制」）；按钮变为「隐藏 Token」。显示后 **180 秒自动隐藏**，标题右侧倒计时 `m:ss`，≤30 秒变红闪烁。获取失败 toast「获取令牌失败」。
   - 「重置 Token」（destructive 确认框：「确认重置 Token？」/「旧 Token 将立即失效，xboard-node 需要重新配置新 Token。」/ 按钮「重置 Token」）→ `POST resetToken {id}` → 直接显示新 Token、使安装命令缓存失效（重新拉取）、toast「Token 已重置」；失败「重置令牌失败」。
4. **安装 xboard-node 卡**：说明「在目标服务器上执行此命令，即可用 machine mode 安装 xboard-node 并接入当前服务器记录。」；抽屉打开时 `GET installCommand?id=`；代码块显示命令（加载中「正在生成命令...」）；悬停复制图标 + 底部「复制安装命令」按钮（复制后显示「已复制!」2 秒，失败 toast「复制失败」）；提示「需要 root 或 sudo 权限，且目标服务器需为支持 systemd 的 Linux。」
5. **关联节点卡**：标题「关联节点」；徽标「{n} 个节点」「{n} 个已激活」(enabled 计数)；按钮「关联已有节点」、「前往节点管理」。抽屉打开时 `GET machine/nodes?machine_id=`。
   - 表格列：名称（`#{id} {name}` 链接 → `/server/manage?machine_id={id}`）、类型（徽标）、地址（`host:port`）、已激活（开关 → `manage/update {id, type, enabled: !enabled}`，处理中禁用，失败 toast「切换节点状态失败」，成功后重新拉该机器节点）、操作（解绑图标，title「取消关联」→ `manage/update {id, type, machine_id: null, enabled: false}` → toast「已取消「{name}」的关联」，失败「取消关联失败」）。
   - 空态：图标 +「暂无绑定节点。」+ 按钮「新增节点到此服务器」（跳转同上带 open_create=1）。
6. **关联已有节点对话框**：标题「关联已有节点」，说明「选择要关联到「{name}」的节点」；打开时 `GET manage/getNodes`，只列 `machine_id` 为 null/0 的节点；搜索框「搜索节点名称、地址、类型...」（name/host/type 小写包含或 id 包含）；「全选（共 {count} 个）」；每行 `#id name`、`host:port`、类型徽标、复选框；空态「没有未绑定的节点」/ 搜索无果「没有匹配的节点」；底部「已选 {count} 个」、「取消」、「关联 {count} 个节点」（提交中「关联中...」）→ `manage/batchUpdate {ids, machine_id, enabled:true}` → toast「成功将 {count} 个节点关联到「{name}」」→ 刷新该机器节点与候选列表；失败「关联失败」。
   - 注意：官方关联/解绑后**不刷新机器列表的 servers_count**。[建议] 新实现一并刷新。

---

## 6. 页面：权限组管理 `/server/group`

### 6.1 列表
- 标题「权限组管理」，副标题「管理所有权限组，包括添加、删除、编辑等操作。」
- 数据：`GET group/fetch`（默认按 id 降序），前端分页（默认 10）。
- 工具栏：「添加权限组」按钮、搜索框「搜索权限组...」（name 子串）、「重置」。
- 列：「组ID」（outline 徽标，可排序）、「组名称」（截断）、「用户数量」（用户图标 + users_count，可排序）、「节点数量」（服务器图标 + server_count，可排序）、「操作」（编辑图标、删除图标）。
- 删除：destructive 确认框「确认删除」/「此操作将永久删除该权限组，删除后无法恢复。确定要继续吗？」/ 按钮「删除」→ `group/drop {id}` → 成功 toast（官方误用「更新成功」，[建议] 新实现用「删除成功」）→ 刷新；失败由拦截器 toast 后端原因（被节点/套餐/用户使用）。
- 移动端卡片：主 name，网格 users_count、server_count。

### 6.2 表单弹窗（新建/编辑，也被节点表单“添加权限组”复用）
- 标题「创建权限组」/「编辑权限组」；说明「创建新的权限组，可以为不同的用户分配不同的权限。」/「修改权限组信息，更新后会立即生效。」
- 字段 `name`：标签「组名称」，占位「请输入权限组名称」，说明「权限组名称用于标识不同的用户组，建议使用有意义的名称。」
- 前端校验（onChange，未通过时提交按钮禁用）：长度 ≥2「组名至少需要2个字符」；≤50「组名不能超过50个字符」；正则 `^[a-zA-Z0-9一-龥_-]+$`「组名只能包含字母、数字、中文、下划线和连字符」。（后端只校验非空。）
- 提交 `group/save {id?, name}`（仅这两个键）；成功 toast「创建成功」/「更新成功」，重置并关闭，回调刷新。按钮「取消」、「创建」/「更新」（提交中转圈）。

---

## 7. 页面：路由管理 `/server/route`

### 7.1 列表
- 标题「路由管理」，副标题「管理所有路由组，包括添加、删除、编辑等操作。」
- 数据：`GET route/fetch`（注意返回体是 `{data:[...]}`），页面挂载时加载；前端分页（默认 10）。
- 工具栏：「添加路由」、搜索框「搜索路由...」（remarks 子串）、「重置」。
- 列：
  - 「组ID」：outline 徽标，可排序。
  - 「备注」：remarks（截断）。
  - 「动作值」：第一行按 action：dns 且有值「DNS: {value}」；proxy 且有值「转发 ({value})」；block 红字「阻止访问」；其它「直连」。第二行灰字「匹配{count}条规则」（`match.length`）。
  - 「动作」：彩色徽标 + 图标：block 红、dns 蓝、direct 绿、proxy 紫；文字 `route.actions.{action}`。
  - 「操作」：编辑、删除（destructive 确认「确认删除」/「此操作将永久删除该路由组，删除后无法恢复。确定要继续吗？」/「删除」→ `route/drop {id}` → toast「删除成功」→ 刷新）。
- 移动端：主 remarks，网格 action、action_value。

### 7.2 表单（桌面弹窗、移动端抽屉）
| key | 控件 | 标签 / 占位 | 默认 | 校验 |
|---|---|---|---|---|
| remarks | 文本，必填星号 | 备注 / 请输入备注 | `""` | 非空「请输入有效的备注」 |
| match | 多行文本（等宽，min-h 120），必填星号 | 匹配规则 / `example.com\n*.example.com` | `[]` | 前端无；后端 required\|array |
| action | 下拉，必填星号 | 动作 / 请选择动作 | `block` | 选项见 §2.4 |
| action_value | 文本，必填星号 | action=dns：「DNS服务器」/「请输入DNS服务器」；action=proxy：「转发标签 (Outbound Tag)」/「请输入转发标签」 | `""` | 前端/后端都不强制（[建议] 新实现 dns/proxy 时前端必填） |

- 标题「创建路由」/「编辑路由」；底部「取消」「提交」。
- 有任何字段错误时表单顶部红框「表单校验失败，请检查输入」。
- 提交转换：`match` 若为字符串按 `\n` 拆分；**过滤空白行**；`action` 不是 dns/proxy 时 `action_value=""`。body `{id?, remarks, match, action, action_value}` → `route/save` → 成功关闭、刷新、toast「创建成功」/「更新成功」并重置；失败 toast「保存失败」（加拦截器 toast）。

---

## 8. 交互与状态汇总（关键文案速查）

| 场景 | 文案 |
|---|---|
| 复制成功（ID/地址） | 复制成功（`common:copy.success`） |
| 节点提交成功 | 提交成功 |
| 未选类型提交 | 请先选择协议类型 |
| 节点复制 / 删除 / 重置流量成功 | 复制成功 / 删除成功 / 流量重置成功 |
| 排序保存 | 排序保存成功 |
| 通用确认框默认 | 标题「确认操作」，内容「确定要执行此操作吗？」，按钮「取消」/「确认」 |
| 表格空 | 暂无数据 |

---

## 9. 差异与风险（实现时必须注意）

1. **`group_ids`/`route_ids` 必须是字符串数组**：用户可见节点查询 `whereJsonContains('group_ids', (string)$user->group_id)`、组节点计数、WS 推送都依赖字符串形式。新 UI 若写入数字，用户将看不到节点。
2. **删除权限组的节点占用检查可能失效**：`GroupController::drop` 用请求里的 `id` 原值做 `whereJsonContains`，官方发送数字 `5`，而库里是 `"5"`，MySQL `JSON_CONTAINS` 不匹配 → 被节点使用的组也能被删除（套餐/用户检查不受影响）。[建议] 新 UI 调用 `group/drop` 时把 `id` 以**字符串**发送（`ServerGroup::find("5")`、`Plan::where('group_id',"5")` 均正常），并在前端额外用 `server_count>0` 拦截提示。
3. **mieru `traffic_pattern` 为空必失败**：规则是 `string`（非 nullable），空串被中间件转成 null → 422「Traffic Pattern 必须是字符串」。官方 UI 必须先点生成或填值。新 UI：为空时不发送该键（后端默认 `''`），或前端强制必填。
4. **官方编辑会隐式丢字段**：zod 解析成功时剥离未定义键——shadowsocks 的 `obfs/obfs_settings`、vmess 的 `rules` 在官方后台编辑保存后会被清空。新 UI 应保留未知键（§4.4）。
5. **前端默认与后端默认不一致**：multiplex（前端 smux/4/100/100 vs 后端 yamux/null/null）、tuic congestion_control（前端 bbr vs 后端 cubic）、anytls padding_scheme（前端 [] vs 后端默认 9 行；传 `[]` 会存空数组）。新 UI 默认值以官方前端为准（保持与旧后台创建的数据一致），但须在“使用默认方案”等处提供后端默认。
6. **不落库的字段**：`excludes`、`ips`、`spectific_key`（后端拼写错误）、`listen_address`、`banned`（无列，被静默丢弃）；hysteria `alpn`、`port_range`；anytls `alpn`；shadowsocks `client_fingerprint`；vless reality `fingerprint`；multiplex `min_streams/max_streams`；ECH `key_path/config_path`（无校验规则）。新 UI 不应提供这些输入，或明确标注“不生效”。
7. **socks 官方 UI 无 TLS 配置**，但后端/节点端支持。补上属于超出官方的增强。
8. **`server_port` 无整数校验**：DB 是 int，填区间或非数字会触发 SQL 错误（500「保存失败/创建失败」）。官方“同步到服务端口”按钮会把 `port` 区间原样复制过去。新 UI 前端校验 `server_port` 为 1–65535 整数、`port` 为整数或 `a-b` 区间。
9. **`machine_id` 无存在性校验**：传入不存在的 id 触发外键错误 500。新 UI 只从机器列表选择。
10. **`batchUpdate`/`update` 的 `machine_id` 以“键是否存在”判定**：只想改 show/enabled 时**不要带 `machine_id` 键**，否则会把节点解绑。
11. **`batchDelete`、`batchResetTraffic`、`machine/drop` 解绑节点**均为查询构造器批量操作，不触发 `ServerObserver`：批量删除后机器端不会立即收到节点集变化（单个 drop 会）。属于后端问题，UI 层无法规避，可在批量删除确认文案中不作承诺。
12. **路由 `match` 的 `array_filter` 保留下标**：若提交数组含空字符串，会存成 JSON 对象（如 `{"0":"a","2":"b"}`），读取后 `match` 变成对象，官方列表计数为 0、编辑框为空。新 UI 提交前必须过滤空白行（官方已做），读取时兼容对象（`Object.values`）。
13. **路由 / 节点删除不做引用检查**：删除路由后节点 `route_ids` 残留无效 id；删除节点后其子节点 `parent_id` 悬空。[建议] 新 UI 删除父节点时提示其子节点数量（由 getNodes 计算）。
14. **`route/fetch`、`route/drop` 返回体不带 `status`**（`{data: ...}`）。新 API 封装不能以 `status==='success'` 作为成功判据，应以 HTTP 2xx 为准。
15. **`group/save` 传不存在的 id 会 500**（对 null 赋值）。
16. **按时段倍率不支持跨午夜**：`getCurrentRate` 用字符串比较 `start <= now <= end`，`22:00–02:00` 永远不匹配。新 UI 可提示用户拆成两段。多段重叠时取第一条命中。
17. **子节点倍率**：官方 UI 在有父节点时禁用倍率输入并提示“继承自父节点”。后端没有显式继承代码：计费在 `UserService::trafficFetch` 中使用“上报流量的那个节点”的 `getCurrentRate()`；子节点没有独立的节点进程，流量由父节点进程上报（在线/心跳缓存也取父节点），因此**实际计费按父节点倍率** [推断]。但子节点自己的 `rate` 仍会出现在用户订阅/节点列表的倍率显示中（`getAvailableServers` 用子节点自身 `getCurrentRate()`），两者可能不一致。默认保持官方行为（禁用输入 + 原值提交）。
18. **ECH 生成**不传 `public_name`，外层 SNI 恒为 `ech.example.com`。
19. **审计日志会记录节点密钥**：`log` 中间件只剔除顶层敏感键，`protocol_settings.reality_settings.private_key`、`tls_settings.ech.key` 等会进 `admin_audit_log`。属后端问题，记录在案。
20. **官方类型筛选 bug**：类型多选时用字符串包含比较，多选结果为空；且选项缺 AnyTLS。新 UI 修正。
21. **流量“禁用状态”**：文案说重置流量会“解除禁用状态”，实际含义是：`transfer_enable>0` 且 `u+d>=transfer_enable` 时节点不出现在用户订阅中；清零后恢复。列表官方用 `banned` 字段标红但该字段不存在（恒 false），只有使用率 >90% 才标红。
22. **`rate` 为 decimal**：getNodes 中通常为字符串（如 `"1.00"`），显示与回填按字符串处理即可。
23. **`show` 切换官方额外发送 `type`**：后端忽略，新 UI 可不发。
24. **危险操作清单**（必须二次确认）：节点删除/批量删除、批量/单个重置流量、机器删除（会解绑其全部节点）、重置机器 Token（旧 Token 立即失效，xboard-node 需重配）、权限组删除、路由删除；修改 `code`（节点端用 code 拉配置，改动后节点端需同步改配置）、修改 `type`/`server_port`/`group_ids`（会触发对在线节点的配置/用户全量推送）。[建议] 编辑已绑定节点的 `code` 时给出提示。

---

## 10. 新实现建议（Vue 3 + Naive UI）

- 路由：新 SPA 内沿用 `/server/machine`、`/server/manage`、`/server/group`、`/server/route` 与相同 query 参数，便于从旧后台迁移书签和互相跳转。
- 列表：全部用 `NDataTable` 前端分页/排序/筛选（`pagination` 默认 pageSize：节点 500、其它 10；可选 10/20/30/40/50/100/500），`row-key="id"`，勾选用 `type:'selection'`。节点轮询 30s、机器轮询 60s（页面隐藏时可暂停）。
- 拖拽排序：可用原生 HTML5 DnD 实现在 `NDataTable` 行上（`row-props` 设置 `draggable` 与事件），不必新增依赖；保存时发送全部节点顺序。
- 表单：`NForm` + `NFormItem`；多选 `NSelect multiple filterable`；标签 `NDynamicTags`；时间 `NTimePicker`（`format="HH:mm"`、`value-format="HH:mm"`）；开关 `NSwitch`；数字 `NInputNumber`（提交时注意 rate/倍率按数字或字符串均可）；JSON 编辑 `NInput type="textarea"` + 实时 `JSON.parse` 校验；确认用 `useDialog().warning/error` 或 `NPopconfirm`；提示 `useMessage()`；详情抽屉 `NDrawer`（placement right，宽约 900px）。
- 协议子表单：按类型拆分组件，统一 props `modelValue: ProtocolSettings`；默认值与选项表直接取本文件 §4.8；公共子块（TLS/uTLS/ECH/Multiplex/Reality/NetworkSettingsEditor/CertConfig）做成可复用组件，接收路径前缀。
- 加密工具：Reality X25519 密钥对需要 Curve25519 实现（官方内置 tweetnacl）。可选方案：浏览器 WebCrypto `X25519`（较新浏览器支持）或引入 `tweetnacl`——**新增依赖需主会话确认**。短 ID、混淆密码、mieru traffic_pattern 用 `crypto.getRandomValues` 即可。
- 图表：机器负载趋势需要面积图（双 Y 轴、图例切换）。若项目尚无图表库，需主会话确认是否引入（如 ECharts / vue-echarts）。
- 复制：`navigator.clipboard.writeText`，失败回退 `document.execCommand('copy')`。
- 类型定义（TypeScript）建议：`ServerNode`（§2.1.1 全字段）、`Machine`（§2.2 fetch 字段）、`MachineHistoryPoint`、`ServerGroup`、`ServerRoute`、`ProtocolSettingsMap[type]`（§4.8）、`CertConfig`（§4.6.1）。
