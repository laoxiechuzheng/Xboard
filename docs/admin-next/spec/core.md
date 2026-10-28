# admin-next 规格：core（核心框架、登录、通用约定、布局与仪表盘）

- 适用：用 Vue 3 + TypeScript + Naive UI 重写的新后台，入口 `/{secure_path}/next`；旧后台 `/{secure_path}` 保留不动。
- 最近核实日期：2026-10-28（只读调研；未在运行中的实例上调用接口）。
- 证据来源：
  - 官方编译包 `public/assets/admin/assets/index-CEIYH7i8.js`（下称“bundle”），用 `bundle_grep.cjs` 按正则取上下文；
  - 中文语言包 `public/assets/admin/locales/zh-CN.js`；
  - 后端：`app/Http/Routes/V2/*.php`、`app/Http/Controllers/V2/Admin/*`、`app/Http/Controllers/V1/Passport/AuthController.php`、`app/Http/Controllers/V1/User/UserController.php`、`app/Http/Middleware/*`、`app/Helpers/ApiResponse.php`、`app/Exceptions/Handler.php`、`app/Services/*`、`routes/web.php`、`resources/views/admin.blade.php`、`config/*.php`。
- 标注约定：未加标注的都是从代码或 bundle 直接读到的**事实**；**【推断】** 表示根据框架或第三方库的公开实现推出、本地没法直接验证的内容（例如 `vendor/` 没装的 Horizon 内部返回值）；**【建议】** 是给新后台的实现建议，不是官方现状。

---

## 0. 目录

1. 入口、宿主页与 `window.settings`
2. HTTP 客户端约定（官方实现）
3. 后端响应格式大全（成功/失败/校验/分页/特殊）
4. 列表通用约定（filter / sort / 分页参数、DataTable UI 行为）
5. 登录、会话与鉴权
6. 后台布局（侧边栏、顶栏、命令面板、路由表、错误页、全局状态）
7. 仪表盘页
8. 接口明细（本域涉及的全部接口）
9. 格式化函数
10. 本地存储键
11. 本域 i18n 文案（中文）
12. 差异与风险
13. 新后台实现建议汇总

---

## 1. 入口、宿主页与 `window.settings`

### 1.1 `secure_path` 的取值

后端 Web 路由和 API 前缀都用同一个表达式：

```php
admin_setting('secure_path', admin_setting('frontend_admin_path', hash('crc32b', config('app.key'))))
```

- `ConfigSave` 对 `secure_path` 的校验是 `min:8|regex:/^[\w-]*$/`，提示文案分别是“后台路径长度最小为8位”“后台路径只能为字母或数字”。
- 路由在应用启动时注册（`RouteServiceProvider` 用 glob 加载 `app/Http/Routes/V2/*.php`），所以改完 `secure_path` 后，旧路径的 API 和页面会失效，新路径要等路由重新注册才生效（Octane 常驻进程下通常要重启或 reload）。这条与系统配置域有关，这里只列出影响。

### 1.2 现有 Web 入口（`routes/web.php`，全部保留）

| 路径 | 视图 | 注入变量 |
|---|---|---|
| `/{secure_path}` | `admin.blade.php`（官方后台） | `title`=`app_name`（默认 `XBoard`）、`version`、`logo`、`secure_path`，以及未在模板里使用的 `theme_sidebar`/`theme_header`/`theme_color`/`background_url` |
| `/{secure_path}/console` | `admin-console.blade.php`（旧原型） | `title`、`version`、`logo`、`secure_path` |
| `/{secure_path}/admin-v2` | `admin-v2.blade.php`（此前的独立后台，资源在 `public/assets/admin-v2/`） | `title`、`secure_path`，注入成 `window.xboardAdmin = {title, securePath}` |

`admin.blade.php` 注入的内容：

```html
<title>{{ $title }}</title>
<script>
  window.settings = {
    base_url: "/",
    title: "{{ $title }}",
    version: "{{ $version }}",
    logo: "{{ $logo }}",
    secure_path: "{{ $secure_path }}",
  };
</script>
<!-- 随后按 manifest.json 注入 css；按 glob(public/assets/admin/locales/*.js) 注入全部语言包脚本；最后是入口 module 脚本 -->
```

- `version` 来自 `UpdateService::getCurrentVersion()`，格式是 `YYYYMMDD-<7位commit>`（从缓存读，缓存由 `git log -1` 写入），例如 `20261004-77eaf4f`。
- 官方 bundle 实际读取的 `window.settings` 字段：

| 字段 | 用途 |
|---|---|
| `base_url` | 拼 API baseURL（`base_url` 末尾补 `/` 后再加 `api/v2`），缺省为 `/` |
| `secure_path` | 所有管理接口路径前缀 |
| `title` | 侧边栏顶部的站点名、登录页大标题 |
| `version` | 侧边栏底部显示为 `v{version}`，前面有绿色圆点 |
| `description` | 登录页标题下的副标题。**blade 并没有注入这个字段**，所以官方登录页副标题始终为空 |
| `logo` | **官方 bundle 没有用到**。侧边栏用的是写死的通用 SVG 图形 |

浏览器标签标题固定为 blade 里的 `<title>{{ $title }}</title>`，路由切换时不会改。

### 1.3 新后台入口【建议】

- 新增 Web 路由 `/{secure_path}/next` 和独立 blade（例如 `resources/views/admin-next.blade.php`），静态资源放在独立目录（例如 `public/assets/admin-next/`），**不要覆盖** `public/assets/admin/`、`admin-v2/`、`console/`。
- 注入与官方同名的 `window.settings`（`base_url`、`title`、`version`、`logo`、`secure_path`），并额外注入 `description`（`admin_setting('app_description')`）。
- 前端路由沿用 hash 模式（官方就是 `/{secure_path}#/...`）。这样服务端只需要一条精确路由；如果改用 history 模式，就得再加 `/{secure_path}/next/{any}`（`where('any', '.*')`）的兜底路由。
- 路由注册顺序：`/{secure_path}/next` 和 `/{secure_path}` 是不同的字面路径，彼此不冲突；API 位于 `/api/v2/...`，与页面路由也不冲突。

---

## 2. HTTP 客户端约定（官方实现）

官方用 axios，实例配置如下：

| 项 | 值 |
|---|---|
| baseURL | `(window.settings.base_url \|\| "/")` 去掉末尾斜杠后加 `/api/v2`，即 `/api/v2` |
| 管理接口路径 | `${secure_path}/xxx/yyy`（不带前导 `/`，由 axios 拼成 `/api/v2/{secure_path}/xxx/yyy`） |
| timeout | 30000 ms |
| 默认头 | `Content-Type: application/json`；上传用 `multipart/form-data`（FormData，字段名 `file`） |
| 鉴权头 | `Authorization: <token>`，这里的 token 是登录接口返回的 `auth_data` 原样字符串，**已经带 `Bearer ` 前缀**，例如 `Bearer 4f9c...`。前端不再拼接 |
| 语言头 | `Content-Language: <localStorage.i18nextLng \|\| "zh-CN">`。后端 `Language` 中间件据此执行 `App::setLocale()`，`__()` 文案会按 `resources/lang/{zh-CN,en-US,ru-RU,zh-TW}.json` 翻译 |
| 免鉴权白名单（不带 Authorization、不做登录检查） | `/passport/auth/login`、`/passport/auth/token2Login`、`/passport/auth/register`、`/guest/comm/config`、`/passport/comm/sendEmailVerify`、`/passport/auth/forget` |

请求拦截器：调用非白名单接口时，如果本地没有 token，就立即执行“登出跳转”（见 5.6），并以 `{code:-1, message:"未登录"}` reject。

响应拦截器：

- 2xx：resolve 为**响应体本身**（`response.data`），调用方再取 `.data` 拿业务数据。比如 `const {data} = await get(...)`，此时 `data` 是 body 里的 `data` 字段。
- 非 2xx：
  1. 如果 HTTP 状态是 401 或 403，执行“登出跳转”；
  2. 用 sonner 弹 `toast.error(body.message || 映射文案)`，映射为 `401→"登录已过期"`、`403→"没有权限"`、`404→"资源或接口不存在"`，其他取 `"未知异常"`；
  3. reject 的值是 `response.data`（响应体），没有响应体时是 `{data:null, code:-1, message:"未知错误"}`。
- 因此官方各页面的错误提示都来自这条全局 toast，页面内部一般不再单独提示。

【建议】新后台用同样的 axios 封装，但要修正 403 的处理（见 12.2-1）。

---

## 3. 后端响应格式大全

### 3.1 `success()` / `fail()`（`App\Helpers\ApiResponse`，被 `Controller` 和 `Exceptions\Handler` 引用）

```json
{ "status": "success", "message": "操作成功", "data": <任意>, "error": null }
{ "status": "fail",    "message": "<错误信息>", "data": null,  "error": <null|任意> }
```

- HTTP 状态码取 code 的前三位：`success()` 默认用 `ResponseEnum::HTTP_OK = [200001,'操作成功']`，所以是 200；`fail([400202,'用户不存在'])` 返回 400；`fail([422,'user_ids不能为空'])` 返回 422；`fail([500,'保存失败'])` 返回 500；`fail([429, ...])` 返回 429。
- 响应里没有 `code` 字段（源码中被注释掉了）。
- `ApiException($message, $code=400, $errors=null)` 由 `Handler::render` 转换成 `fail([$code,$message], null, $errors)`。例如 `User` 中间件抛出的 `ApiException('未登录或登陆已过期', 403)` 返回 HTTP 403：`{"status":"fail","message":"未登录或登陆已过期","data":null,"error":null}`。
- `ViewException` 会被转成 500：`{"status":"fail","message":"主题渲染失败。如更新主题，参数可能发生变化请重新配置主题后再试。",...}`。

### 3.2 直接 `return [...]` 或 `response()->json(...)` 的接口（没有 status/message）

不少管理接口不走 `success()`，前端必须按接口单独解析。本域涉及的有：

| 接口 | 响应体 |
|---|---|
| `GET stat/getStats` | `{ "data": {...} }` |
| `GET stat/getOverride` | `{ "data": {...} }` |
| `GET stat/getOrder` | `{ "code": 0, "message": "success", "data": { "list": [...], "summary": {...} } }` |
| `GET stat/getTrafficRank` | `{ "timestamp": "ISO8601", "data": [...] }` |
| `ANY stat/getStatUser` | `{ "data": [...], "total": n }` |
| `GET stat/getStatRecord` | `{ "data": ... }` |
| `GET system/getHorizonFailedJobs` | `{ "data": [...], "total": n, "current": n, "page_size": n }` |
| `ANY system/getAuditLog` | `{ "data": [...], "total": n }` |
| `GET plugin/getPlugins` | `{ "data": [...] }` |
| `GET /api/v2/passport/auth/token2Login?verify=` | 成功 `{ "data": {token, auth_data, is_admin} }`；失败 HTTP 400 `{ "message": "..." }` |

【建议】统一用一个 `unwrap(body) => body?.data` 取业务数据，分页接口按 4.3 的表单独适配。

### 3.3 分页 `paginate()`（`ApiResponse::paginate`）

```json
{ "total": 123, "current_page": 1, "per_page": 20, "last_page": 7, "data": [ ... ] }
```

字段都在顶层，**没有** `status`/`message`。

### 3.4 校验错误（HTTP 422）

`api` 中间件组里的 `ForceJson` 会把 `Accept` 强制设成 `application/json`，所以 `FormRequest` 和 `$request->validate()` 校验失败时，返回 Laravel 12 默认的 JSON：

```json
{ "message": "第一条错误信息（多条时会追加 \"(and N more errors)\" 一类的后缀）", "errors": { "email": ["邮箱格式不正确"], "password": ["..."] } }
```

- 校验 422 的结构是 `{message, errors}`，与 `fail([422,...])` 的 `{status:'fail', message, data, error}` 不同。两种情况前端都只需要读 `message`。如果要在表单上逐字段标红，可以读 `errors`。
- 各 FormRequest 多数带自定义中文 message；没有自定义的规则用 Laravel 默认文案（项目没有 `lang/*/validation.php`，因此是英文）。

### 3.5 其它错误

| 情况 | 响应 |
|---|---|
| `Admin` 中间件拒绝（未带 token、token 无效或过期、用户不是管理员） | HTTP **403**，`{"message":"Unauthorized"}`（注意不是 401） |
| `User` 中间件拒绝（`/api/v2/user/*`、`/api/v1/user/*`） | HTTP 403，`{"status":"fail","message":"未登录或登陆已过期","data":null,"error":null}` |
| 路由不存在 | HTTP 404，`{"message":"The route ... could not be found."}` |
| 方法不允许（例如对只接受 POST 的路由发 GET） | HTTP 405，`{"message":"..."}` |
| 未捕获异常 | HTTP 500。`APP_DEBUG=false` 时返回 `{"message":"遇到了些问题，我们正在进行处理"}`（随 Content-Language 翻译）；debug 模式额外带 `exception/file/line/trace` |
| 业务上返回 403 | 例：`POST plugin/delete` 删除核心插件时返回 `response()->json(['message'=>'该插件为系统核心插件，不允许删除'], 403)`（见 12.2-1） |

### 3.6 全局中间件对请求数据的影响

- `TrimStrings`：字符串两端空白会被裁掉。
- `ConvertEmptyStringsToNull`：**空字符串会变成 `null`**。表单提交 `""` 等于提交 `null`，对 `nullable` 字段等于“清空”。
- `ForceJson`、`Language`：分别见 3.4 和第 2 节。
- `log`（`RequestLog`）：管理路由上**每一个 POST 请求**（包括 `user/fetch`、`order/fetch`、`ticket/fetch`、`coupon/fetch` 这类用 POST 的查询）都会往 `v2_admin_audit_log` 写一条记录：`admin_id`、`action`（例如 `user.fetch`、`server_manage.sort`、`gift_card.create_template`）、`method`、`uri`、`request_data`（JSON，会去掉顶层的 `password`/`token`/`secret`/`key`/`api_key` 字段）、`ip`、`created_at`。GET 请求不记录。

### 3.7 数值类型提示

金额、流量这类 `SUM()` 聚合值，经 PDO 返回给 PHP 时可能是**字符串**（例如 `"12300"`）。前端展示前必须先 `Number()`。官方格式化函数内部会 `parseFloat` 或做隐式转换。

---

## 4. 列表通用约定

### 4.1 官方前端发出的列表请求

带筛选的列表页（用户、订单、优惠券、工单）用 TanStack Table 的状态直接组装请求体，以 **POST JSON** 发送：

```json
{
  "pageSize": 20,
  "current": 1,
  "filter": [ { "id": "email", "value": "abc" }, { "id": "status", "value": [0, 1] }, { "id": "commission_balance", "value": "gt:0" } ],
  "sort":   [ { "id": "created_at", "desc": true } ]
}
```

- `current` 从 1 开始，`pageSize` 默认 20（官方各页初始 `pageSize: 20`）。
- `filter` 是 TanStack 的 `ColumnFiltersState`，`sort` 是 `SortingState`。`desc` 是 JSON 布尔值。

### 4.2 后端对 filter / sort 的解析（各控制器不完全一样）

| 控制器 | `value` 是数组 | `value` 是 `"op:val"` 字符串 | 其它值 | 额外能力 |
|---|---|---|---|---|
| `UserController::fetch` | `whereIn(field)`（`group_ids` 映射到 `group_id`） | 操作符见下 | `like %v%` | `logic: "or"` 时用 `orWhere`，默认 and；`a.b` 形式的点号字段走关联查询（`whereHas(a)`，数组用 in，`op:val` 用操作符，其它用 like）；`subscription_status` 取 `active`（`expired_at` 为 null 或 >= now）或 `expired`；`total_used` 映射为 `(u + d)` |
| `OrderController::fetch` | `whereIn` | 操作符见下 | `like %v%` | 另有请求参数 `is_commission`（boolean），为真时只查“有邀请人、已完成、佣金 > 0”的订单 |
| `TicketController::fetch`、`CouponController::fetch` | `whereIn` | **不支持**（按 like 处理） | `like %v%` | 工单另外支持顶层参数 `status`、`reply_status[]`、`email` |

操作符（`QueryOperators`，订单控制器里有一份等价实现）：`eq`→`=`、`gt`→`>`、`gte`→`>=`、`lt`→`<`、`lte`→`<=`、`like`→`like %v%`、`notlike`→`not like %v%`、`null`→`whereNull`、`notnull`→`whereNotNull`，其它都当作 `like`。值是数字字符串时会转成 int 或 float。

sort：逐项执行 `orderBy(id, desc ? DESC : ASC)`，之后控制器再追加各自的默认排序（用户 `id desc`，订单 `created_at desc`，优惠券 `created_at desc`，工单 `updated_at desc`）。

注意：filter 和 sort 里的 `id` 会直接当列名使用。传入不存在的列会引发 SQL 错误（500），前端只能发送确实存在的列。

### 4.3 各列表接口的分页参数与响应（全站速查，细节见各域规格）

| 接口 | 方法（官方实际用的） | 页码参数 | 每页参数 | 后端默认每页 | 响应结构 |
|---|---|---|---|---|---|
| `user/fetch` | ANY（官方 POST） | `current` | `pageSize` | 10 | `paginate()` |
| `order/fetch` | ANY（POST） | `current` | `pageSize` | 10 | `paginate()` |
| `coupon/fetch` | ANY（POST） | `current` | `pageSize` | 10 | `paginate()` |
| `ticket/fetch`（不带 `id`） | ANY（POST） | `current` | `pageSize` | 10 | `{data,total}` |
| `gift-card/templates`、`codes`、`usages` | ANY | `page` | `per_page`（模板 1..1000，codes/usages 1..500） | 15 | `paginate()` |
| `stat/getStatUser` | ANY（POST） | `page`（Laravel 默认分页参数） | `pageSize` | 10 | `{data,total}` |
| `system/getAuditLog` | ANY | `current` | `page_size`（会被强制 ≥10） | 10 | `{data,total}` |
| `system/getHorizonFailedJobs` | GET | `current` | `page_size`（会被强制 ≥10） | 20 | `{data,total,current,page_size}` |
| `traffic-reset/logs` | GET | `page` | `per_page`（1..10000） | 20 | `{data, pagination:{current_page,last_page,per_page,total}}` |
| `plan/fetch`、`notice/fetch`、`knowledge/fetch`、`payment/fetch`、`server/manage/getNodes`、`server/group/fetch`、`server/route/fetch`、`server/machine/fetch` | GET | 不分页 | — | — | `success(全量数组)`（个别例外见各域） |

### 4.4 官方 DataTable 的通用 UI 行为（各列表页都会用到）

- 表头：可排序列点击表头切换升降序（未排序或 desc 时点一下变 asc，asc 时点一下变 desc），图标依次为 ArrowUpDown / ArrowUp / ArrowDown；表头可以带问号 tooltip。
- 操作列固定在右侧（`columnPinning.right = ["actions"]`），带吸附阴影分隔线。
- 加载时显示骨架行，行数为 `min(pageSize, 10)`；没有数据时显示“暂无数据”。
- 底部分页条：
  - 左侧文案“已选择 {selected} 项，共 {total} 项”（统计的是当前页的选择数和行数）；
  - “每页显示”下拉，选项 `10, 20, 30, 40, 50, 100, 500`；
  - “第 [输入框] 页，共 {N} 页”，输入框可以直接跳页，回车或失焦时提交，越界会被还原；
  - 首页（宽屏才显示）、上一页、下一页、末页按钮。
- 工具栏里有“显示列”按钮（`common.table.viewOptions.button`），用于切换列显隐。
- 窄屏（`max-width: 767px`）时表格切换成**卡片列表**：主字段做标题，次要字段左右对齐，网格字段两列排列，操作区在卡片底部。
- 支持行拖拽排序（`draggable` 加 onDragStart/onDrop 回调），在需要排序的页面里使用。
- 弹窗：官方有 ResponsiveAlertDialog，窄屏时自动变成底部抽屉（Drawer）。

【建议】Naive UI 对应关系：`n-data-table` 设 `remote` 加受控 `pagination`（`page-sizes: [10,20,30,40,50,100,500]`、`show-quick-jumper`），列显隐用自定义 Popover；窄屏卡片可以用 `n-list` 或 `n-card` 自行渲染。

---

## 5. 登录、会话与鉴权

### 5.1 登录页（官方路由 `#/sign-in`）

布局：

- 整页居中，背景色 `primary-foreground`；右上角是语言切换器（见 6.3.3）。
- 卡片外的大标题是 `window.settings.title`（h1），副标题是 `window.settings.description`（官方为空）。
- 卡片标题“登录”，描述“请输入您的邮箱和密码登录系统”。
- 表单出错时，顶部有一个 `root` 错误区（红字）。由于下面 5.2 中的 bug，这个区域实际上不会显示。

表单字段：

| key | 类型 | 中文标签 | 占位 | 必填 | 默认值 | 前端校验 | autocomplete |
|---|---|---|---|---|---|---|---|
| `email` | 文本 | 邮箱地址 | `name@example.com` | 是 | `""` | `min(1)`，提示“请输入邮箱地址”。**不校验邮箱格式**（语言包里有 `emailInvalid`“邮箱地址格式不正确”，但没有使用） | `email` |
| `password` | 密码，右侧有眼睛按钮切换明文 | 密码 | 请输入密码 | 是 | `""` | `min(1)`，提示“请输入密码”；`min(7)`，提示“密码长度至少为7个字符” | `current-password` |

其它元素：

- 链接按钮“忘记密码？”：点击后打开“重置密码”对话框（见 5.4）。
- 提交按钮“登录”：全宽、大号，提交期间禁用并显示转圈。
- 语言包里有 `rememberMe`“记住我”，但页面上**没有**这个控件。

### 5.2 提交流程（官方）

1. `POST /api/v2/passport/auth/login`，body `{email, password}`（JSON）。
2. 成功后取 `body.data.auth_data`（形如 `"Bearer xxxxx"`），写入 localStorage：键 `XBOARD_ACCESS_TOKEN`，值 `{"value":"Bearer xxx","time":<写入时ms>,"expire":<写入时ms + 259200000>}`，也就是**前端 3 天过期**。
3. 在 redux 中保存 token，再 `GET /api/v2/user/info` 拉取用户信息，最后跳转 `#/`（**不理会** URL 上的 `redirect` 参数）。
4. 失败时：全局拦截器弹出 toast，内容是后端的 `message`。页面本身的 catch 用 `"response" in err` 判断，但拦截器 reject 的是响应体而不是 axios error，所以判断永远为假，`root` 错误区不会显示（官方 bug）。
5. **官方不检查 `is_admin`**。非管理员也能登录成功并进入框架，随后仪表盘的第一个管理接口返回 403 `Unauthorized`，触发“登出跳转”回登录页，同时弹出“Unauthorized”。

【建议】新后台登录成功后检查 `data.is_admin`：为假时不保存 token，直接在表单上提示“该账号不是管理员”。前端密码最小长度改为 8，与后端一致；邮箱加格式校验；正确显示后端 `message`（以表单错误或 toast 形式）；登录后尊重 `redirect` 参数。

### 5.3 登录接口 `POST /api/v2/passport/auth/login`

- 路由：`PassportRoute`（V2）指向 `App\Http\Controllers\V1\Passport\AuthController@login`，不需要鉴权。
- 请求（`AuthLogin` FormRequest）：

| 字段 | 规则 | 失败文案 |
|---|---|---|
| `email` | `required\|email:strict` | `Email can not be empty` / `Email format is incorrect`（按 Content-Language 翻译） |
| `password` | `required\|min:8` | `Password can not be empty` / `Password must be greater than 8 digits` |

- 处理逻辑（`LoginService::login`）：
  1. 如果开启了 `password_limit_enable`（默认开），且该邮箱的错误次数缓存 ≥ `password_limit_count`（默认 5），返回 **429**：“密码错误次数过多，请 :minute 分钟后再试”，其中 minute 取 `password_limit_expire`，默认 60。
  2. 邮箱不存在，或密码不对（`Helper::multiPasswordVerify` 兼容多种历史算法），返回 **400**“邮箱或密码错误”；密码错误会让计数 +1，计数 TTL 为 `password_limit_expire` 分钟。
  3. 账户被封禁（`banned`），返回 400“该账户已被停止使用”。
  4. 更新 `last_login_at`，触发 hook `user.login.after`。
- 登录**不需要**人机验证（`CaptchaService` 只在注册和发验证码时使用）。
- 成功响应（`AuthService::generateAuthData`）：

```json
{ "status": "success", "message": "操作成功", "data": {
    "token": "<用户订阅 token（users.token），不是登录凭证>",
    "auth_data": "Bearer <sanctum 明文 token，已去掉 id| 前缀>",
    "is_admin": true
} , "error": null }
```

- 副作用：**每次登录都会新建一个 Sanctum personal access token**，名称为 20 位随机串，abilities 为 `["*"]`，服务端有效期 1 年（`config/sanctum.php` 的 `expiration` 为 null，以 token 自带的 `expires_at` 为准）。官方登出时不吊销 token（见 5.6）。

### 5.4 “忘记密码”对话框（官方）

- 标题“重置密码”，描述“在站点目录下执行以下命令找回密码”。
- 代码块里是 `php artisan reset:password 管理员邮箱`（取自语言包 `auth.signIn.resetPassword.command`），右上角有复制按钮（IconCopy），复制成功提示“复制成功”。
- 后台登录页**不调用** `/passport/auth/forget`。命令 `reset:password {email} {password?}` 不传密码时会随机生成一个 GUID 作为新密码并打印出来。

### 5.5 会话恢复与 `/user/info`

- 应用启动时，如果 localStorage 里有未过期的 token，就请求 `GET /api/v2/user/info`（路由 `V2/UserRoute`，中间件 `user`，控制器 `V1\User\UserController@info`）。
- 响应 `success(user)`，字段只有：`email`、`transfer_enable`、`last_login_at`、`created_at`、`banned`、`remind_expire`、`remind_traffic`、`expired_at`、`balance`、`commission_balance`、`plan_id`、`discount`、`commission_rate`、`telegram_id`、`uuid`，外加 `avatar_url = https://cdn.v2ex.com/gravatar/{md5(email)}?s=64&d=identicon`。**没有 `is_admin`，也没有 `id`**。
- 用途仅限于顶栏用户菜单（头像、用户名、邮箱）。返回 403 时触发登出跳转。
- 判断管理员身份的备选接口（官方没用）：`GET /api/v1/user/checkLogin`，返回 `success({is_login: bool, is_admin?: true})`，只在用户是管理员时才有 `is_admin` 键。
- 后台中**没有用到**的非 admin 接口：`GET /api/v2/user/resetSecurity`（**GET 请求却有副作用**：会重置当前登录账号的订阅 token，绝对不能误调）、`/passport/auth/register`、`/passport/auth/forget`、`/passport/auth/getQuickLoginUrl`、`/passport/auth/loginWithMailLink`、`/passport/comm/*`、`/guest/comm/config`。

### 5.6 路由守卫、401/403 与登出

- 路由守卫（官方 `Bf`）：所有业务路由都包在守卫里。没有 token 且当前路径不在公开列表 `["/sign-in","/sign-in-2","/sign-up","/forgot-password","/otp"]` 中时，跳到 `#/sign-in?redirect=<encodeURIComponent(pathname+search)>`。登录页本身不在守卫里，已登录时访问也会显示登录表单。
- “登出跳转”（官方 `wE`，由 401/403 或缺 token 触发）：删除 `XBOARD_ACCESS_TOKEN`，然后 `window.location.href = "/{第一段路径}#/sign-in" + (当前 pathname 不是 /404 或 /sign-in 时追加 "?redirect=" + window.location.pathname)`。这里拼的是 `location.pathname`（例如 `/abc12345`），不是 hash 路由，所以 redirect 实际上没有作用。
- 主动退出（用户菜单“退出登录”）：只在客户端清 token、重置 redux、跳到 `#/sign-in`，**不调用后端**，服务端 token 仍然在 1 年内有效。
- 【建议】
  - 新后台的“退出登录”可以调用 `POST /api/v1/user/removeActiveSession`，body `{session_id}`，吊销当前 token。但当前 token 的 id 拿不到：`GET /api/v1/user/getActiveSession` 能列出全部 token，却无法确定哪一个是当前的。所以第一版可以先保持“仅客户端退出”，这一点记录为已知风险。
  - 判断 401/403 时，只把 401、`message === "Unauthorized"` 的 403 和 `message === "未登录或登陆已过期"` 的 403 视为鉴权失效；其它 403 只弹 toast，不登出。

---

## 6. 后台布局

### 6.1 整体结构

- 左侧固定侧边栏：展开宽 256px（`w-64`），折叠宽 56px（`w-14`）；右侧是主内容区。
- 页面标准结构（除仪表盘外，所有业务页一致）：
  - Header（高度为 `--header-height`，`p-4 md:px-8`）：左侧是“搜索菜单和功能...”按钮（命令面板），右侧依次为主题切换、语言切换、用户菜单。
  - Body（`px-4 py-6 md:px-8`）：`h2` 页面标题（`text-2xl font-bold`）加一段灰色描述，下面是页面内容。
- 仪表盘的 Header 不同：左侧是 `h1`“仪表盘”，右侧依次为搜索按钮、主题切换、语言切换、用户菜单。
- 系统设置页的 Header：左侧搜索；右侧主题和语言、用户菜单。Body 内左侧有设置子导航，宽屏时竖排、占 1/5 宽；窄屏时变成下拉 Select。子导航（9 项）依次是：站点设置 `/config/system`、安全设置 `/config/system/safe`、订阅设置 `/config/system/subscribe`、邀请&佣金设置 `/config/system/invite`、节点配置 `/config/system/server`、邮件设置 `/config/system/email`、Telegram设置 `/config/system/telegram`、APP设置 `/config/system/app`、订阅模板 `/config/system/subscribe-template`。路由里还有 `/config/system/frontend`，但不在子导航中（孤立页面）。各子页内容属于 settings 域。

### 6.2 侧边栏

#### 6.2.1 顶部

- 一个通用 SVG 图标（两条斜线，展开时 32px，折叠时 24px），右侧是 `window.settings.title`（`font-medium`，折叠时隐藏）。
- 窄屏（<768px）时侧边栏变成固定在顶部的横条：右侧是汉堡按钮（展开时图标 IconMenu2，收起时 IconX，aria-label 为“切换导航”），点开后全屏下拉菜单，背景加 50% 黑色遮罩，并给 `body` 加 `overflow-hidden`。点击菜单项会自动收起。窄屏下主内容区 `padding-top: 64px`。

#### 6.2.2 菜单树（官方 `Vlt`，顺序即显示顺序）

| 一级（id） | 中文 | 图标（tabler/lucide） | 二级（id） | 中文 | 路由 | 图标 |
|---|---|---|---|---|---|---|
| `dashboard` | 仪表盘 | IconDashboard | — | — | `/` | — |
| `system-management` | 系统管理 | IconSettings | `system-config` | 系统配置 | `/config/system` | IconAdjustments |
| | | | `plugin-management` | 插件管理 | `/config/plugin` | lucide Package |
| | | | `theme-config` | 主题配置 | `/config/theme` | IconDeviceDesktop |
| | | | `notice-management` | 公告管理 | `/config/notice` | IconNews |
| | | | `payment-config` | 支付配置 | `/config/payment` | IconCreditCard |
| | | | `knowledge-management` | 知识库管理 | `/config/knowledge` | IconFileText |
| `node-management` | 节点管理 | IconServer | `machine-management` | 服务器管理 | `/server/machine` | IconServerCog |
| | | | `node-manage` | 节点管理 | `/server/manage` | IconServerBolt |
| | | | `permission-group-management` | 权限组管理 | `/server/group` | IconLock |
| | | | `route-management` | 路由管理 | `/server/route` | IconRoute |
| `subscription-management` | 订阅管理 | IconCash | `plan-management` | 套餐管理 | `/finance/plan` | IconBuildingStore |
| | | | `order-management` | 订单管理 | `/finance/order` | IconCreditCard |
| | | | `coupon-management` | 优惠券管理 | `/finance/coupon` | IconDiscountCheck |
| | | | `gift-card-management` | 礼品卡管理 | `/finance/gift-card` | IconGift |
| `user-management` | 用户管理 | IconUsers | `user-manage` | 用户管理 | `/user/manage` | IconUser |
| | | | `ticket-management` | 工单管理 | `/user/ticket` | IconTicket |
| （动态）插件菜单组 | 见 6.2.3 | | | | | |

- 中文取自 `nav.*`。“流量重置日志”页 `/user/traffic-reset-logs` 的路由存在，但**没有菜单项**，全站也没有跳转链接，只能直接输入 URL 访问。语言包里的 `nav.trafficResetLogs`、`nav.pluginApps`、`nav.pluginMenuDemo` 都没有使用；`/config/plugin/menu-demo`、`/config/plugin/crud-demo` 两个演示路由同样不在菜单里。
- 一级分组默认全部展开（`system-management`、`node-management`、`subscription-management`、`user-management` 均为 `"expanded"`）。用户的展开或收起会写入 localStorage 键 `sidebar-item-preferences`，值为 `{ [id]: "expanded" | "collapsed" }`。
- 激活规则（`checkActiveNav(href, activeMatch[])`）：`href` 为 `/` 时，pathname 必须严格等于 `/`；其它情况下，去掉首尾 `/` 后，pathname 等于 href，或以 `href + "/"` 开头，就算激活。子项激活时父组高亮（secondary 底色），激活项设置 `aria-current="page"`。
- 菜单项样式：一级高 48px，左右内边距 24px；二级缩进 32px，左侧有竖线，高 40px；分组右侧的 chevron 在展开时旋转 180°。
- 折叠态：只显示图标按钮（48×48），鼠标悬停时在右侧弹出 Tooltip 显示名称；有子项的一级菜单点击后在右侧弹出 DropdownMenu，列出子项（图标、名称、徽标）。
- 底部：上边框加 `px-4 py-2.5` 的小字区，内容是绿色圆点加 `v{window.settings.version}`；折叠时居中，桌面端折叠后文字透明。
- 折叠按钮：圆形描边按钮，悬浮在侧边栏右缘中部（`-right-5 top-1/2`），只在桌面端显示，图标 IconChevronsLeft，折叠时旋转 180°，aria-label 为“切换侧边栏”。折叠状态保存在 localStorage 键 `collapsed-sidebar`（JSON 布尔），窄屏时强制为 false。

#### 6.2.3 插件动态菜单

- 布局加载时调用 `GET /api/v2/{secure_path}/plugin/getPlugins`（不带 type），react-query key 为 `["pluginList"]`，`staleTime` 30s。
- 只处理 `is_installed && is_enabled` 的插件。插件 `config.json` 中的 `admin_menus` 数组每一项为 `{id, path, title, label?, icon?}`：
  - `path` 去掉首尾 `/` 后为空的项会被忽略；
  - 菜单 href 为 `/plugins/{code}/{path}`，`activeMatch` 为 `[href]`；
  - 标题直接用 `title` 原文（不走 i18n），徽标用 `label`；
  - 图标枚举（`icon` 值 → lucide 图标）：`dashboard`→LayoutDashboard、`bar-chart-3`→BarChart3、`credit-card`→CreditCard、`file-text`→FileText、`package`→Package、`settings`→Settings、`shield`→Shield、`users`→Users，其它值回退为分组图标。
- 每个插件对应一个一级分组：id 为 `plugin-group:{code}`，标题为插件 `name`，徽标为 `v{version}`；分组图标按插件 `type` 决定：`payment`→CreditCard，`theme`→LayoutDashboard，`feature`→Package，其它→Settings。没有有效菜单项的插件不生成分组。分组按插件名 `localeCompare` 排序，**追加在内置菜单之后**。
- 当前仓库里所有插件的 `config.json` 都没有声明 `admin_menus`，所以实际不会出现插件分组。对应页面路由是 `/plugins/:pluginCode/*`，内容属于 plugin 域。

### 6.3 顶栏组件

#### 6.3.1 搜索 / 命令面板

- 按钮：窄屏是 36×36 的图标按钮（lucide Search）；`xl` 及以上宽度变成 240px 宽的输入框样式按钮，显示“搜索菜单和功能...”，右侧显示 `⌘K` 键帽。
- 快捷键：`Ctrl+K` 或 `⌘K`（`metaKey || ctrlKey` 且 `key === "k"`）切换开合。
- 面板（cmdk）：输入框占位“搜索菜单和功能...”，分组标题“菜单导航”，没有结果时显示“未找到结果”。
- 候选项来自完整菜单树（包括插件菜单），扁平化后的规则：有 href 的一级项直接加入；子项加入时附带 `parentText`，即父级名称，右侧以小灰字显示。匹配文本为 `"父级名 子项名"`，模糊匹配。选中后关闭面板并跳转。

#### 6.3.2 主题切换

- 圆形 ghost 图标按钮：当前是 light 时显示月亮（IconMoon），点击切到 dark；当前是 dark 时显示太阳（IconSun），点击切到 light。官方**只在 light 和 dark 之间切换**，语言包里的 `common.theme.system`“跟随系统”没有用到。
- 存储：localStorage 键 `vite-ui-theme`（字符串 `light` 或 `dark`），默认 `light`。实现方式是给 `<html>` 加 `class="light"` 或 `class="dark"`；值为 `system` 时跟随系统偏好（官方 UI 不会写入这个值）。切换时同步修改 `<meta name="theme-color">`：dark 为 `#020817`，light 为 `#fff`（官方页面没有这个 meta，所以实际无效果）。

#### 6.3.3 语言切换

- ghost 小按钮，显示国旗 SVG 加短名（`EN` / `CN` / `RU`）。下拉宽 120px，每项是国旗加名称：`English`（`en-US`）、`中文`（`zh-CN`）、`Русский`（`ru-RU`），当前语言项加 accent 底色和加粗。识别不到当前语言时按中文显示。
- i18next 配置：`fallbackLng: "zh-CN"`；`supportedLngs: ["en-US","zh-CN","ru-RU"]`；语言检测顺序依次为 URL 查询参数 `lang`、localStorage `i18nextLng`、浏览器 navigator；切换结果缓存到 localStorage `i18nextLng`。语言包来自页面预先加载的 `window.XBOARD_TRANSLATIONS[lang]`（`/assets/admin/locales/*.js`）。
- 切换后，请求头 `Content-Language` 随之变化（见第 2 节）。

#### 6.3.4 用户菜单

- 触发按钮：32px 圆形头像。图片取 `/user/info` 的 `avatar_url`（gravatar）；加载失败时显示两个大写字母，取用户名的前两位。
- 用户名 = `email` 中 `@` 之前的部分；没有用户信息时显示“用户”。
- 下拉菜单宽 224px，右对齐：
  1. 标签区：用户名（加粗）和 email（小灰字；没有时显示 `user@example.com`）；
  2. 分隔线；
  3. “设置”：链接到 `#/config/system`，右侧有快捷键标注 `⌘S`（**仅为标注，没有绑定**）；
  4. 分隔线；
  5. “退出登录”：右侧标注 `⇧⌘Q`（**没有绑定**），点击后的行为见 5.6。

### 6.4 完整路由表（hash 路由，`/{secure_path}#<path>`）

| path | 页面 | 所属域 | 是否有菜单入口 |
|---|---|---|---|
| `/sign-in` | 登录 | core | — |
| `/` | 仪表盘 | core | 是 |
| `/config/system`（及子路由 `safe`、`subscribe`、`invite`、`frontend`、`server`、`email`、`telegram`、`APP`、`subscribe-template`） | 系统设置 | settings | 是（`frontend` 无） |
| `/config/payment` | 支付配置 | payment | 是 |
| `/config/plugin` | 插件管理 | plugin | 是 |
| `/config/plugin/menu-demo`、`/config/plugin/crud-demo` | 插件演示 | plugin | 否 |
| `/config/theme` | 主题配置 | theme | 是 |
| `/config/notice` | 公告管理 | notice | 是 |
| `/config/knowledge` | 知识库管理 | knowledge | 是 |
| `/plugins/:pluginCode/*` | 插件页面宿主 | plugin | 动态 |
| `/server/manage`、`/server/machine`、`/server/group`、`/server/route` | 节点相关 | server | 是 |
| `/finance/plan`、`/finance/order`、`/finance/coupon`、`/finance/gift-card` | 订阅与财务 | finance | 是 |
| `/user/manage`、`/user/ticket` | 用户、工单 | user/ticket | 是 |
| `/user/traffic-reset-logs` | 流量重置日志 | user | **否** |
| `/500`、`/404`、`/503`、`*` | 错误页 | core | — |

- 路由 `APP` 是大写，子导航链接写的是 `/config/system/app`。react-router 默认大小写不敏感，所以能匹配上。新后台统一用小写。
- 路由组件按需懒加载；每个一级路由组都带 errorElement，渲染为 500 页。
- 已知的跨页深链参数（新后台需要兼容）：
  - `#/finance/order?commission_status=0&status=3&commission_balance=gt:0`：订单页启动时读取 URL 参数 `user_id`（字符串）、`order_id`（字符串）、`commission_status`（数字）、`status`（数字）、`commission_balance`（字符串），转成 filter（仪表盘“待处理佣金”卡片使用）；
  - `#/user/manage?email=xxx`：用户页把它预置成 `email` 过滤条件；
  - `#/user/ticket`：工单页默认过滤 `status = "0"`。

### 6.5 错误页（官方英文，未国际化）

- 500（路由 errorElement）：大号“500”，下面是“Oops! Something went wrong :')”和“We apologize for the inconvenience.”，再下面是错误信息（取 `error.message`、`statusText` 或 “Unknown error occurred”），以及“Go Back”“Back to Home”两个按钮。
- 404：大号“404”，加“Oops! Page Not Found!”和说明文字，以及“Go Back”“Back to Home”两个按钮。
- 503：“Website is under maintenance!”，加一个“Learn more”按钮（无动作）。
- 【建议】新后台把这些文案中文化。

### 6.6 全局基础设施（官方）

- Toast：sonner，位置右上，`richColors`。
- react-query 默认配置：`staleTime 30s`、`retry 1`、`refetchOnWindowFocus false`。
- 复制工具：基于 clipboard.js 的隐藏按钮，返回成功或失败的 Promise；成功文案用“复制成功”，失败用“复制失败”。【建议】使用 `navigator.clipboard.writeText`，失败时降级到 textarea 加 `execCommand`。
- 时间显示：所有日期范围计算都以 **UTC+8 墙钟时间**为准（见 7.3、7.4），与后端 `config/app.php` 的 `timezone = Asia/Shanghai` 一致。

---

## 7. 仪表盘页（`#/`）

### 7.1 页面结构（自上而下，`grid gap-6`）

1. 统计卡片区（8 张卡）
2. 收入概览（面积图或柱状图）
3. 流量排行（节点、用户两张卡，`md` 以上并排）
4. 队列状态（两张卡，`md` 以上并排），附带失败任务列表弹窗和任务详情弹窗

仪表盘**没有**显示：系统状态（schedule/horizon，即 `getSystemStatus`）、队列负载（`getQueueWorkload`）、Master 列表（`getQueueMasters`）、审计日志（`getAuditLog`）、`getOverride`、`getRanking`、`getStatRecord`、`getServerLastRank`、`getServerYesterdayRank`。`getStats` 返回的 `onlineUsers`、`onlineDevices`、`onlineNodes`、`totalTraffic`、`lastMonthIncome`、`lastMonthIncomeGrowth`、`currentMonthCommissionPayout`、`lastMonthCommissionPayout`、`commissionGrowth` **返回了但官方没有展示**（语言包中的 `onlineUsers`、`realtimeUsers`、`todayPeak`、`activeUserTrend`、`vsLastWeek`、`totalOrders` 等键也没有使用）。“待处理工单”“待处理佣金”这两类提醒以统计卡片的形式出现（卡片 3、4）。

### 7.2 统计卡片区

- 数据：`GET /api/v2/{secure_path}/stat/getStats`（不带参数），取 `body.data`；react-query key 为 `["dashboardStats"]`，**每 5 分钟**（300000 ms）自动刷新。
- 加载中：显示 8 张骨架卡片。
- 栅格：窄屏 1 列，`md` 2 列，`lg` 4 列，`gap-4`。
- 卡片通用样式：标题（`text-sm font-medium`），右上角小图标；主数值为 `text-2xl font-bold`。卡片下方二选一：
  - 趋势行：`TrendingUp` 图标（升降都用这一个图标）加 `"+x%"` 或 `"-|x|%"` 加灰色对比文案。`value > 0` 时绿色（`emerald-500`）并带 `+`；**`value <= 0` 一律红色并带 `-`**，所以 0 会显示为红色的 `-0%`。
  - 描述行：灰色小字。
- 可点击的卡片：鼠标指针为手形，悬停时背景变 `muted/50`。高亮卡片的边框为 `primary/50`。

| # | 标题 | 主数值（字段 → 格式） | 图标（颜色） | 下方内容 | 点击 | 高亮 |
|---|---|---|---|---|---|---|
| 1 | 今日收入 | `todayIncome` → 金额（分转元，`¥x.xx`） | ArrowDownToLine（emerald） | 趋势 `dayIncomeGrowth`，“对比昨日” | — | — |
| 2 | 月收入 | `currentMonthIncome` → 金额 | BarChart3（blue） | 趋势 `monthIncomeGrowth`，“对比上月” | — | — |
| 3 | 待处理工单 | `ticketPendingTotal` → 整数 | MessagesSquare（>0 时 orange，否则 muted） | 描述：>0 时“有工单需要处理”，否则“无待处理工单” | 跳转 `#/user/ticket` | `>0` |
| 4 | 待处理佣金 | `commissionPendingTotal` → 整数 | Bell（>0 时 blue，否则 muted） | 描述：>0 时“有佣金需要确认”，否则“无待处理佣金” | 跳转 `#/finance/order?commission_status=0&status=3&commission_balance=gt%3A0` | `>0` |
| 5 | 月新增用户 | `currentMonthNewUsers` → 整数 | Users（blue） | 趋势 `userGrowth`，“对比上月” | — | — |
| 6 | 总用户 | `totalUsers` → 整数 | Users（muted） | 描述“活跃用户: {activeUsers}” | — | — |
| 7 | 月上传 | `monthTraffic.upload` → 流量（见 9.2） | Upload（emerald） | 描述“今日: {todayTraffic.upload 格式化}” | — | — |
| 8 | 月下载 | `monthTraffic.download` → 流量 | Download（blue） | 描述“今日: {todayTraffic.download 格式化}” | — | — |

各字段口径见 8.3。

### 7.3 收入概览卡片

- 卡头左侧：标题“收入概览”，副标题 `"{summary.start_date} 至 {summary.end_date}"`（取自后端返回值）。
- 卡头右侧：
  1. 范围 Select（宽 120px，占位“选择范围”）。选项：`7d` 最近7天、`30d` 最近30天（**默认**）、`90d` 最近90天、`180d` 最近180天、`365d` 最近一年、`custom` 自定义范围。
  2. 选中 `custom` 时，在 Select 旁边出现日期范围按钮：带日历图标，文本为 `yyyy-MM-dd - yyyy-MM-dd`，没有选择时显示“选择日期”。点击后弹出双月区间日历（`captionLayout: dropdown`，可以下拉选年月）。只有 `from` 和 `to` 都选了才生效。默认自定义范围是今天往前 7 天到今天。
  3. Tabs：“金额”（`amount`，**默认**）和“数量”（`count`）。
- 日期参数计算（UTC+8 墙钟时间）：
  - 预设：`end` 为今天，`start` 为今天减 N 天（N 取 7/30/90/180/365），两端都格式化成 `yyyy-MM-dd`。例如“最近7天”实际请求 8 个自然日（含今天）；但当天的 `v2_stat` 记录要到次日 00:10 由 `xboard:statistics` 生成，所以图上通常看不到今天。
  - 自定义：直接用所选的两个日期。
- 请求：`GET stat/getOrder?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`；react-query key 为 `["orderStat",{start_date,end_date}]`，**每 30 秒**刷新。官方不传 `type`。
- 汇总区（两列网格）：
  - 左列：“总收入”，`¥{summary.paid_total/100 保留两位}`；“共 {summary.paid_count} 笔交易”；“平均订单金额: ¥{summary.avg_paid_amount/100}”。
  - 右列：“总佣金”，`¥{summary.commission_total/100}`；“共 {summary.commission_count} 笔交易”；“佣金比例: {summary.commission_rate.toFixed(2)}%”。
- 图表（高 400px，宽 100%；数据为 `data.list`，已按日期**升序**排列）：
  - X 轴：`date`，格式 `MM-dd`；Y 轴：金额模式显示 `¥{v/100}`，数量模式显示“{v} 笔交易”；横向虚线网格，30% 透明度。
  - 金额模式：两条 monotone 面积线。`paid_total`，名称“订单金额”，主色，带渐变填充；`commission_total`，名称“佣金金额”，次色，带渐变。线宽 2。
  - 数量模式：两组柱。`paid_count`“订单数量”（主色）和 `commission_count`“佣金数量”（次色），顶部圆角 4，最大柱宽 40。
  - Tooltip：首行是日期；之后每个系列一行，前面是色点，后面是系列名和值。系列名包含“金额”时显示 `¥x.xx`，否则显示“{n} 笔交易”。
- 金额单位：`v2_stat.paid_total` 和 `commission_total` 都以**分**存储，展示时除以 100。

### 7.4 流量排行（两张卡：节点 / 用户，各自独立）

- 卡头：
  - 左侧是图标加标题：节点卡用 lucide Network，标题“节点流量排行”；用户卡用 Users，标题“用户流量排行”。
  - 右侧是范围 Select，加一个 Activity 图标作装饰。Select 宽 120px，占位“选择时间范围”。选项：`today` 今天（**默认**）、`last7days` 最近7天、`last30days` 最近30天、`custom` 自定义范围。选 `custom` 时出现日期范围按钮（未选时显示“选择日期范围”），点击弹出双月区间日历，默认范围是今天往前 7 天到今天。
- 时间区间（UTC+8 墙钟时间，换算成 Unix 秒）：
  - `today`：`[今天 00:00, 明天 00:00]`；
  - `last7days`：`[现在 - 7 天, 现在]`；
  - `last30days`：`[现在 - 30 天, 现在]`；
  - `custom`：`[from 当天 00:00, (to + 1 天) 00:00]`。
- 请求：`GET stat/getTrafficRank?type=node|user&start_time=<秒>&end_time=<秒>`（`Math.round(ms/1000)`）；query key 分别为 `["nodeTrafficRank", start, end]` 和 `["userTrafficRank", start, end]`，**每 30 秒**刷新。取 `body.data`（数组；兼容 `{data:[...]}` 形式）。
- 列表：放在滚动区里（高 400px，右侧留 16px），最多 10 项，项间距 12px。每项是 `muted/50` 底色的圆角块，悬停时加深：
  - 第一行：左边是 `name`（截断）；右边是变化率，`change >= 0` 时绿色加 ArrowUp，否则红色加 ArrowDown，数值显示 `|change|%`。
  - 第二行：进度条，宽度 = `value / 榜首 value × 100%`（榜首 value 为 0 时按 1 计）；右边显示流量，格式为 `(value/1024³).toFixed(2) + " GB"`，**固定以 GB 为单位**。
  - 悬停时在右侧弹出 Tooltip（两列网格）：当前流量 `{value GB}`、上期流量 `{previousValue GB}`、变化率（`>= 0` 时前面加 `+`，绿或红）`{change}%`。
- 空数据：官方在数组为空时一直显示“加载中...”（带脉冲动画），这是 bug。【建议】新后台把加载态和空态（“暂无数据”）分开显示。

### 7.5 队列状态

- 数据：`GET system/getQueueStats`，取 `body.data`；react-query key 为 `["queueStats", refreshNonce]`，**每 30 秒**刷新。首次加载时，整个区域只显示一个居中的转圈（LoaderCircle）。
- 卡片 A“队列状态”：
  - 标题前有 Timer 图标，描述“当前队列运行状态”。右上角是刷新图标按钮（RotateCw）：点击让 nonce +1 强制重新拉取，重新拉取期间按钮禁用、图标旋转。
  - 状态块（`muted/50` 底色）：
    - 第一行：左边是图标加“运行状态”，`status` 为真时图标是 CircleCheck（绿），否则是 CircleAlert（红）；右边是 Badge，为真时显示 secondary 样式的“正常”，否则显示 destructive 样式的“异常”。
    - 第二行：灰字“当前等待时间：{wait.default || 0} 秒”（见 12.1-6）。
  - 下方两格：
    - “近期任务数”，大数字 `recentJobs`，下面的进度条值为 `recentJobs / periods.recentJobs × 100`。悬停 Tooltip“统计时间范围：{periods.recentJobs} 小时”。
    - “每分钟处理量”，大数字 `jobsPerMinute`，进度条值为 `jobsPerMinute / queueWithMaxThroughput.throughput × 100`。悬停 Tooltip“最高吞吐量：{queueWithMaxThroughput.throughput \|\| 0}”。
- 卡片 B“作业详情”：
  - 标题前有 Cpu 图标，描述“队列处理详细信息”。
  - 两格：
    - “7日报错数量”：大号红字 `failedJobs`，可点击，悬停时加下划线，title 为“查看报错详情”；旁边有 Eye 图标。点击数字或图标都会打开失败任务弹窗。下面小字“保留 {periods.failedJobs} 小时”。
    - “最长运行队列”：大号 `{queueWithMaxRuntime.runtime || 0}s`，下面小字 `queueWithMaxRuntime.name || "N/A"`。
  - 底部一格：“活跃进程”，右侧显示 `processes / (processes + pausedMasters)`，下面是进度条 `processes / (processes + pausedMasters) × 100`。
- 失败任务弹窗（Dialog，`max-w-4xl`，最高 90vh，内容可滚动）：
  - 标题“失败任务详情”。
  - 数据：`GET system/getHorizonFailedJobs?current=<页>&page_size=10`，**仅在弹窗打开时请求**（`enabled: open`）。
  - 表格列：
    1. “时间”：`failed_at`。字符串先 `parseInt`；10 位数字按秒处理，否则按毫秒；然后用 `toLocaleString("zh-CN", {year:numeric, month/day/hour/minute/second: 2-digit})` 显示。
    2. “队列”：`queue`。
    3. “任务名称”：`name`，最多 150px 宽、截断，悬停 Tooltip 显示全文。
    4. “异常信息”：`exception` 的第一行，最多 200px 宽、截断，悬停 Tooltip 显示完整 exception（最大宽 300px，保留换行）。
    5. “操作”：宽 80px 的 ghost 小按钮（Eye 图标，aria-label“查看详情”），点击打开任务详情弹窗。
  - 分页为服务端分页，每页固定 10 条，使用通用分页条（每页条数下拉在这里不起作用）。
  - 空数据时显示“暂无失败任务”。
  - 底部按钮：“刷新”（RotateCw，重新拉取）和“关闭”。
- 任务详情弹窗（Dialog，`max-w-4xl`），标题“任务详细信息”：
  - 两列：“作业ID” `id`；“时间” `failed_at`（**原始值，不格式化**）。
  - 两列：“队列” `queue`；“连接类型” `connection`。
  - “任务名称” `name`。
  - “异常信息” `exception`：红底 `pre` 块，保留换行，最高 200px，可滚动。
  - “任务数据” `payload`：先尝试 `JSON.parse` 再以 2 空格缩进美化，失败时显示原文；`pre` 块，最高 200px，可滚动。
  - 底部按钮“关闭”。
- 语言包中 `dashboard.queue.status.pending/processing/completed/failed/cancelled`、`queue.actions.*`（重试、取消、删除）、`queue.empty`、`queue.loading`、`queue.error` 都没有使用。后端**没有**重试或删除失败任务的接口。

---

## 8. 接口明细（本域）

下文路径前缀：管理接口为 `/api/v2/{secure_path}`，经过 `api` 中间件组，再加 `admin` 和 `log`；其它接口前缀写全。

### 8.1 `POST /api/v2/passport/auth/login`

见 5.3。

### 8.2 `GET /api/v2/user/info`

见 5.5。中间件 `user`，没有登录时返回 403 `{"status":"fail","message":"未登录或登陆已过期",...}`。

### 8.3 `GET stat/getStats`（仪表盘统计卡片使用）

- 没有参数。响应 `{ "data": { ... } }`（没有 status 包装）。
- 时间边界以服务器时区（Asia/Shanghai）为准，即 PHP 的 `strtotime('today')`、`date('Y-m-01')`。
- “收入”统一指订单 `created_at` 落在区间内、`status NOT IN (0 待支付, 2 已取消)`（即包括 1 开通中、3 已完成、4 已折抵）的 `SUM(total_amount)`，单位是**分**。

| 字段 | 含义与口径 |
|---|---|
| `todayIncome` | 今日收入（分） |
| `dayIncomeGrowth` | `(今日 - 昨日) / 昨日 × 100`，保留 1 位小数；昨日为 0 时返回 0 |
| `currentMonthIncome` | 本月 1 日至今的收入（分） |
| `lastMonthIncome` | 上月整月收入（分） |
| `monthIncomeGrowth` | `(本月至今 - 上月整月) / 上月 × 100`，1 位小数。注意用的是不完整的本月和整月对比 |
| `lastMonthIncomeGrowth` | `(上月 - 上上月) / 上上月 × 100` |
| `currentMonthCommissionPayout` | 本月 `v2_commission_log.get_amount` 合计（分） |
| `lastMonthCommissionPayout` | 上月佣金发放合计（分） |
| `commissionGrowth` | `(上月 - 上上月) / 上上月 × 100`（**不是**本月与上月的对比） |
| `commissionPendingTotal` | 订单数：`commission_status = 0`、`invite_user_id` 不为空、`status = 3`、`commission_balance > 0` |
| `currentMonthNewUsers` | 本月注册的用户数 |
| `totalUsers` | 用户总数 |
| `activeUsers` | `expired_at >= now` 或 `expired_at IS NULL` 的用户数（`expired_at` 为 null 表示“长期有效”，没有套餐的用户也可能计入） |
| `userGrowth` | `(本月新增 - 上月新增) / 上月新增 × 100` |
| `onlineUsers` | `users.t >= now - 600` 的用户数 |
| `onlineDevices` | 上述用户的 `online_count` 合计 |
| `ticketPendingTotal` | `v2_ticket.status = 0`（开启中）的工单数，不区分回复状态 |
| `onlineNodes` | 所有节点里 `is_online` 为真的数量 |
| `todayTraffic` / `monthTraffic` / `totalTraffic` | `{upload, download, total}`，来自 `v2_stat_server` 的 `SUM(u)`、`SUM(d)`、`SUM(u+d)`（字节），分别是今日、本月、全部 |

数值可能以字符串形式返回（见 3.7）。

### 8.4 `GET stat/getOrder`（收入概览使用）

- 参数（校验）：`start_date` 为 `nullable|date_format:Y-m-d`；`end_date` 同上；`type` 为 `nullable|in:paid_total,paid_count,commission_total,commission_count`。
- 查询：`v2_stat` 中 `record_type = 'd'`，`record_at >= strtotime(start_date)` 且 `<= strtotime(end_date + " 23:59:59")`。
- 响应：

```json
{ "code": 0, "message": "success", "data": {
  "list": [ { "date": "2026-10-01", "paid_total": 12300, "paid_count": 3, "commission_total": 1200, "commission_count": 1,
              "avg_order_amount": 4100, "avg_commission_amount": 1200 } ],
  "summary": { "paid_total": 0, "paid_count": 0, "commission_total": 0, "commission_count": 0,
               "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD",
               "avg_paid_amount": 0, "avg_commission_amount": 0, "commission_rate": 0 } } }
```

- `list` 按日期升序，只包含有 `v2_stat` 记录的日期，**没有补零**。金额字段单位为分。`avg_*` 保留 2 位小数，单位同样是分。`commission_rate` 是百分比数值，保留 2 位小数。
- 传了 `type` 时，`list` 的元素变成 `{date, value, type}`，`type` 为中文标签：`paid_total`→收款金额、`paid_count`→收款笔数、`commission_total`→佣金金额(已发放)、`commission_count`→佣金笔数(已发放)。官方不使用这种形式。
- `summary.start_date` 和 `end_date`：没有传参时取数据里的最早和最晚日期；没有数据时会变成 `1970-01-01`。
- 口径差异：`v2_stat.paid_*` 由每天 00:10 运行的 `xboard:statistics` 按订单 `paid_at` 统计前一天的数据，而 `getStats` 的收入按 `created_at` 统计，两边数字可能不一致。

### 8.5 `GET stat/getTrafficRank`（流量排行使用）

- 参数：`type` 为 `required|in:node,user`；`start_time` 为 `nullable|integer|min:1000000000|max:9999999999`，默认 `strtotime('-7 days')`；`end_time` 同样的规则，默认 `time()`。
- 当前区间：`record_at` 介于 `[start_time, end_time]`（**两端都包含**）。
  - `node`：`v2_stat_server` 按 `server_id` 汇总 `SUM(u+d)`；
  - `user`：`v2_stat_user` 按 `user_id` 汇总。
  - 按值降序取前 **10**。
- 上一期：`[start - (end - start), start)`，只统计这 10 个 id。
- 响应：`{ "timestamp": "<当前时间 ISO8601>", "data": [ { "id": "12"（字符串）, "name": "<节点名或用户邮箱，找不到时为 'Node {id}' 或 'User {id}'>", "value": <字节>, "previousValue": <字节>, "change": <百分比，1 位小数；上期为 0 时为 0>, "timestamp": "<end_time 的 ISO8601>" } ] }`。
- `v2_stat_server` 和 `v2_stat_user` 目前只写入日粒度数据（`record_type = 'd'`，`record_at` 为当天 00:00），所以区间实际上是按天粒度生效的。

### 8.6 `GET system/getQueueStats`（队列状态使用）

响应 `success(data)`，`data` 结构如下：

| 字段 | 来源与说明 |
|---|---|
| `failedJobs` | Horizon `countRecentlyFailed()` |
| `jobsPerMinute` | Horizon `jobsProcessedPerMinute()` |
| `pausedMasters` | 处于 paused 状态的 master 数 |
| `periods.failedJobs` | `config('horizon.trim.recent_failed')`，本仓库值为 `10080`，单位是**分钟**（UI 标成“小时”，见 12.1-5） |
| `periods.recentJobs` | `config('horizon.trim.recent')`，值为 `60`，单位**分钟** |
| `processes` | 所有 supervisor 的进程总数 |
| `queueWithMaxRuntime` | Horizon `queueWithMaximumRuntime()`。【推断】Horizon 5.x 返回的是**队列名字符串或 null**，不是 `{name, runtime}` 对象 |
| `queueWithMaxThroughput` | 同上。【推断】返回字符串或 null |
| `recentJobs` | Horizon `countRecent()` |
| `status` | 布尔：有 master 且没有任何一个处于 paused 时为真 |
| `wait` | `collect(WaitTimeCalculator::calculate())->take(1)`。【推断】形如 `{"redis:default": 0}`，键名是 `连接:队列` |

本地没有安装 vendor，无法确认 Horizon 的返回值。Horizon 版本见 `composer.lock`：`laravel/horizon v5.33.1`。

### 8.7 `GET system/getHorizonFailedJobs`

- 参数：`current`（默认 1，最小 1）；`page_size`（默认 20，**会被强制 ≥10**）。
- 实现：`collect($jobRepository->getFailed())->sortByDesc('failed_at')->slice(offset, size)`；`total = countFailed()`。
- 响应：`{ "data": [ { "id", "connection", "queue", "name", "status", "payload"(JSON 字符串), "exception", "context", "failed_at", ... } ], "total": n, "current": n, "page_size": n }`。
- 【推断】Horizon 的 `getFailed()` 不传参时只返回最近的约 50 条，所以超过 50 条以后的页是空的，但 `total` 仍然是全部数量。

### 8.8 后端有、但官方仪表盘或任何页面都没有使用的接口（新后台可以考虑补充）

| 接口 | 参数 | 响应 | 说明 |
|---|---|---|---|
| `GET system/getSystemStatus` | — | `success({schedule: bool, horizon: bool, schedule_last_runtime: int\|null})` | `schedule`：最近一次调度心跳在 120 秒以内时为真；`horizon`：master 存在且没有暂停时为真。官方 API 层定义了，但没有调用 |
| `GET system/getQueueWorkload` | — | `success([...按 name 排序])`。【推断】元素形如 `{name, length, wait, processes, split_queues}` | 官方定义了，但没有调用 |
| `GET system/getQueueMasters` | — | Horizon `MasterSupervisorController@index` 的原始输出 | 官方定义了，但没有调用 |
| `ANY system/getAuditLog` | `current`、`page_size`（≥10）、`action`（精确匹配）、`admin_id`、`keyword`（对 `uri`、`request_data` 做 like） | `{data:[{id, admin_id, action, method, uri, request_data, ip, created_at, updated_at, admin:{id,email}}], total}`，按 id 降序 | 官方 bundle 里**完全没有**引用。如果用 POST 调用，这次调用本身也会写入审计日志，建议用 GET |
| `GET stat/getOverride` | — | `{data:{month_income, month_register_total, ticket_pending_total, commission_pending_total, day_income, last_month_income, commission_month_payout, commission_last_month_payout, online_nodes, online_devices, online_users, today_traffic{upload,download,total}, month_traffic{...}, total_traffic{...}}}` | 旧版概览，与 `getStats` 有重叠 |
| `GET stat/getServerLastRank` | — | `success([{server_name(父节点名优先), server_id, server_type, u, d, total}])`，按 total 降序 | 注释写的是“当日实时排行”，但实际调用 `getServerRank()` 时不带参数，区间是 `[0, 明天 23:59:59]`，即**全部时间** |
| `GET stat/getServerYesterdayRank` | — | 结构同上，区间为昨天 | |
| `GET stat/getStatRecord?type=` | `type` 取 `paid_total`、`commission_total`、`register_count` | `{data: [...] 或 null}` | `StatisticalService` 的 `startAt`/`endAt` 没有初始化，`where record_at >= NULL` 永远查不到数据，**实际不可用** |
| `GET stat/getRanking` | — | **500** | 路由存在，但 `StatController` **没有 `getRanking` 方法**（`StatisticalService::getRanking` 存在却没有接上），**不要调用** |
| `ANY stat/getStatUser` | `user_id`（必填，整数）、`pageSize`（默认 10）、`page` | `{data:[StatUser 行: id, user_id, server_rate, u, d, record_type, record_at, created_at, updated_at], total}`，按 `record_at` 降序 | 由用户管理的“流量记录”弹窗使用（官方发 POST `{user_id, pageSize, page}`），属于 user 域 |

### 8.9 `GET plugin/getPlugins`（布局中只用来生成插件菜单）

- 参数：可选 `type`（布局调用时不传）。
- 响应：`{ "data": [ { code, name, version, description, author, type, is_installed, is_enabled, is_protected, can_be_deleted, config, readme, need_upgrade, admin_menus, admin_crud } ] }`。布局只读取 `code`、`name`、`version`、`type`、`is_installed`、`is_enabled`、`admin_menus`。
- 其余内容见 plugin 域规格。

### 8.10 其它 passport 接口（后台登录页不用，供参考）

- `GET /api/v2/passport/auth/token2Login`：
  - 带 `token` 时，302 重定向到 `{app_url 或当前站点}/#/login?verify=...&redirect=...`（这是**用户前台**的路由）；
  - 带 `verify` 时，用 MailLink 临时码换取 `{data:{token, auth_data, is_admin}}`；
  - 失败返回 400 `{message}`。
- `POST /api/v2/passport/auth/getQuickLoginUrl`：用 body 的 `auth_data` 或 Authorization 头换取一个前台快捷登录 URL（`/#/login?verify=<code>&redirect=...`，临时码在缓存中保留 60 秒）。
- `POST /api/v2/passport/auth/forget`：参数 `email`、`email_code`、`password`，重置密码；同一邮箱 5 分钟内最多失败 3 次。
- 以上接口都**不适合**放进后台登录页。后台的“忘记密码”只展示命令行方法。

---

## 9. 格式化函数（官方实现，新后台需要逐项对齐）

### 9.1 金额 `formatMoney(cents, withSymbol = true)`（官方 `TS`）

- 值为 `null` 或 `undefined` 时返回 `¥0.00`；字符串先 `parseFloat`；结果是 NaN 时返回 `¥0.00`。
- 否则计算 `(n/100).toFixed(2)`，返回 `¥{结果}`（`withSymbol = false` 时不带 `¥`）。
- 收入概览里还有一个变体 `(v/100).toFixed(2)`，由调用方自己拼 `¥`。

### 9.2 流量 `formatBytes(bytes)`（官方 `RS`）

- 值为 `null`、`undefined` 或 `<= 0` 时返回 `"0 B"`。
- 单位依次为 `["B","KB","MB","GB","TB"]`，以 1024 为进制，指数 `floor(log1024(bytes))`，并限制在 0..4 之间。
- 输出 `parseFloat((bytes/1024^i).toFixed(2)) + " " + 单位`，例如 `1.5 GB`、`512 MB`（末尾的 0 会被去掉）。
- 流量排行使用固定 GB 单位：`(bytes/1024/1024/1024).toFixed(2) + " GB"`。

### 9.3 时间戳 `formatTime(ts, fmt = "yyyy-MM-dd HH:mm:ss")`（官方 `SS`）

- 值为 `null` 或 `undefined` 时返回 `""`；整数部分是 10 位的按秒处理（乘 1000），其余按毫秒处理。
- 用 date-fns 按本地时区格式化。日期版本的默认格式是 `yyyy-MM-dd`。

### 9.4 时长 `formatDuration(seconds)`（官方 `OS`）

- 值为假或负数时返回 `"-"`。
- 有天数时输出 `{d}d {h}h`；否则有小时时输出 `{h}h {m}m`；否则有分钟时输出 `{m}m {s}s`；否则输出 `{s}s`。

### 9.5 UTC+8 换算（官方 `ES` / `LS`）

- `toCN(date) = date + (480 + date.getTimezoneOffset()) 分钟`：把真实时刻转成“北京时间墙钟时间”，以本地 Date 对象表示。
- `fromCN(date)` 是它的逆运算。
- 用于让预设日期范围不受浏览器时区影响。【建议】新后台用 `date-fns-tz` 或手写同样的偏移；如果不想加依赖，可以手写这两个函数。

---

## 10. 本地存储键（与旧后台同源共存时要特别注意）

| 键 | 写入方 | 格式 | 说明 |
|---|---|---|---|
| `XBOARD_ACCESS_TOKEN` | 旧后台 | `{"value":"Bearer xxx","time":<ms>,"expire":<ms\|null>}` | 前缀 `Xboard_` 加 `access_token`，整体转大写。读取时会检查 `expire`，过期或解析失败就删除 |
| `vite-ui-theme` | 旧后台 | `light` \| `dark` \| `system` | 主题 |
| `i18nextLng` | 旧后台（i18next） | `zh-CN` \| `en-US` \| `ru-RU` | 语言 |
| `collapsed-sidebar` | 旧后台 | JSON 布尔 | 侧边栏折叠状态 |
| `sidebar-item-preferences` | 旧后台 | JSON 对象 `{id: "expanded"\|"collapsed"}` | 菜单展开状态 |
| `VUE_NAIVE_ACCESS_TOKEN` | 用户前台主题 Xboard | 同样的 `{value,time,expire}` 格式，前台 6 小时过期 | 不要动 |

- 旧后台的 `useLocalStorage` 读取时直接 `JSON.parse`，**没有** try/catch。如果新后台往 `collapsed-sidebar` 或 `sidebar-item-preferences` 写入非 JSON 或结构不同的值，**旧后台会直接崩溃**。
- 【建议】新后台的私有状态一律使用独立前缀（例如 `XBOARD_NEXT_*` 或 `admin-next:*`）。只有 token 可以考虑**刻意共享** `XBOARD_ACCESS_TOKEN`，并严格按上表格式写入，这样新旧后台之间切换无需重新登录。代价是在任意一边退出，另一边也会失效。如果不共享，就用独立键，两边各自登录。语言可以读取 `i18nextLng` 作为初始值，但不要写回去，或者只写入相同取值集合内的值。

---

## 11. 本域 i18n 文案（zh-CN，键名与官方一致，便于复用）

- `auth.signIn`：title“登录”；description“请输入您的邮箱和密码登录系统”；email“邮箱地址”；emailPlaceholder“name@example.com”；password“密码”；passwordPlaceholder“请输入密码”；forgotPassword“忘记密码？”；submit“登录”；rememberMe“记住我”（未用）。
  - `resetPassword`：title“重置密码”；description“在站点目录下执行以下命令找回密码”；command“php artisan reset:password 管理员邮箱”。
  - `validation`：emailRequired“请输入邮箱地址”；emailInvalid“邮箱地址格式不正确”；passwordRequired“请输入密码”；passwordLength“密码长度至少为7个字符”（新后台建议改为“密码长度至少为8个字符”）。
- `nav`：dashboard“仪表盘”；systemManagement“系统管理”；systemConfig“系统配置”；themeConfig“主题配置”；pluginManagement“插件管理”；pluginMenuDemo“插件菜单（演示）”；noticeManagement“公告管理”；paymentConfig“支付配置”；knowledgeManagement“知识库管理”；nodeManagement“节点管理”；machineManagement“服务器管理”；permissionGroupManagement“权限组管理”；routeManagement“路由管理”；subscriptionManagement“订阅管理”；planManagement“套餐管理”；orderManagement“订单管理”；couponManagement“优惠券管理”；giftCardManagement“礼品卡管理”；userManagement“用户管理”；ticketManagement“工单管理”；trafficResetLogs“流量重置日志”；pluginApps“插件应用”。语言包里另有一套 `sidebar.*` 键，内容相同但项目较少，没有被使用。
- `search`：placeholder“搜索菜单和功能...”；title“菜单导航”；noResults“未找到结果”；shortcut.label“搜索”；shortcut.key“⌘K”。
- `common`：
  - 基础：loading“加载中...”；error“错误”；success“成功”；save“保存”；cancel“取消”；confirm“确认”；close“关闭”；delete.success“删除成功”；delete.failed“删除失败”；edit“编辑”；view“查看”；toggleNavigation“切换导航”；toggleSidebar“切换侧边栏”；search“搜索...”。
  - 主题：theme.light“浅色”；theme.dark“深色”；theme.system“跟随系统”。
  - 用户菜单：user“用户”；defaultEmail“user@example.com”；settings“设置”；logout“退出登录”。
  - 复制：copy.success“复制成功”；copy.failed/error“复制失败”；copy.errorLog“复制到剪贴板时出错”。
  - 表单：submit“提交”；saving“保存中...”。
  - 表格：table.noData“暂无数据”；table.pagination.selected“已选择 {{selected}} 项，共 {{total}} 项”；itemsPerPage“每页显示”；page“第”；pageOf“页，共 {{total}} 页”；firstPage“跳转到第一页”；previousPage“上一页”；nextPage“下一页”；lastPage“跳转到最后一页”；table.viewOptions.button“显示列”；viewOptions.label“切换显示列”。
  - 其它：time.day“天”；time.hour“小时”；reset“重置”；export“导出”；currency.yuan“元”。
  - 请求错误：http.notLoggedIn“未登录”；unknownError“未知错误”；loginExpired“登录已过期”；noPermission“没有权限”；notFound“资源或接口不存在”；unknownException“未知异常”。
  - common.update.*（系统更新弹窗）：后端更新路由已被注释掉，官方没有使用。
- `dashboard`：
  - title“仪表盘”。
  - stats：todayIncome“今日收入”；monthlyIncome“月收入”；vsYesterday“对比昨日”；vsLastMonth“对比上月”；pendingTickets“待处理工单”；hasPendingTickets“有工单需要处理”；noPendingTickets“无待处理工单”；pendingCommission“待处理佣金”；hasPendingCommission“有佣金需要确认”；noPendingCommission“无待处理佣金”；monthlyNewUsers“月新增用户”；totalUsers“总用户”；activeUsers“活跃用户: {{count}}”；monthlyUpload“月上传”；monthlyDownload“月下载”；todayTraffic“今日: {{value}}”。未用：newUsers、totalScore、totalIncome、totalOrders、revenue、todayRegistered、monthlyRegistered、onlineUsers“在线用户”、activeUserTrend、realtimeUsers“实时用户”、todayPeak、vsLastWeek。
  - trafficRank：nodeTrafficRank“节点流量排行”；userTrafficRank“用户流量排行”；today“今天”；last7days“最近7天”；last30days“最近30天”；customRange“自定义范围”；selectTimeRange“选择时间范围”；selectDateRange“选择日期范围”；currentTraffic“当前流量”；previousTraffic“上期流量”；changeRate“变化率”；recordTime“记录时间”（未用）。
  - overview：title“收入概览”；to“至”；selectTimeRange“选择范围”；selectDate“选择日期”；last7Days、last30Days、last90Days、last180Days“最近N天”；lastYear“最近一年”；customRange“自定义范围”；amount“金额”；count“数量”；transactions“{{count}} 笔交易”；orderAmount“订单金额”；commissionAmount“佣金金额”；orderCount“订单数量”；commissionCount“佣金数量”；totalIncome“总收入”；totalCommission“总佣金”；totalTransactions“共 {{count}} 笔交易”；avgOrderAmount“平均订单金额:”；commissionRate“佣金比例:”。未用：thisMonth、lastMonth。
  - queue：title“队列状态”；jobDetails“作业详情”。
    - status：description“当前队列运行状态”；running“运行状态”；normal“正常”；abnormal“异常”；waitTime“当前等待时间：{{seconds}} 秒”。
    - details：description“队列处理详细信息”；recentJobs“近期任务数”；statisticsPeriod“统计时间范围：{{hours}} 小时”；jobsPerMinute“每分钟处理量”；maxThroughput“最高吞吐量：{{value}}”；failedJobs7Days“7日报错数量”；retentionPeriod“保留 {{hours}} 小时”；longestRunningQueue“最长运行队列”；activeProcesses“活跃进程”；failedJobsDetailTitle“失败任务详情”；viewFailedJobs“查看报错详情”；jobDetailTitle“任务详细信息”；time“时间”；queue“队列”；name“任务名称”；exception“异常信息”；noFailedJobs“暂无失败任务”；connection“连接类型”；payload“任务数据”；viewDetail“查看详情”；action“操作”；id“作业ID”。
  - common：refresh“刷新”；close“关闭”；pagination“第 {{current}}/{{total}} 页，共 {{count}} 条”。

---

## 12. 差异与风险

### 12.1 官方 UI 与后端不一致（新后台需要修正或刻意对齐）

1. **登录不检查 `is_admin`**：非管理员可以进入框架，之后被 403 踢回登录页（5.2）。
2. **登录错误不显示在表单上**：catch 的判断条件写错，只能靠全局 toast 提示（5.2）。
3. **前端密码最短 7 位，后端要求 8 位**：输入 7 位密码时前端放行，后端返回 422。
4. **登录页副标题读取 `window.settings.description`，但 blade 没有注入**（1.2）。
5. **队列时长单位标错**：`periods.recentJobs` 和 `periods.failedJobs` 的单位是分钟（60、10080），UI 却写“小时”，显示成“统计时间范围：60 小时”“保留 10080 小时”。【建议】按分钟显示，或换算成“1 小时”“7 天”。
6. **等待时间字段不匹配**：UI 读 `wait.default`，后端键名是 `redis:default`（【推断】），所以 UI 永远显示 0 秒。【建议】取 `Object.values(wait)[0] ?? 0`。
7. **最长运行队列和最高吞吐量的结构不匹配**：UI 读 `.runtime`、`.name`、`.throughput`，后端返回的是字符串或 null（【推断】），所以 UI 永远显示“0s”“N/A”“最高吞吐量：0”，“每分钟处理量”的进度条也没有意义。【建议】新后台改为显示队列名，并在实测接口后再决定展示什么。
8. **流量排行在空数据时一直显示“加载中...”**（7.4）。
9. **趋势为 0 时显示红色的“-0%”**（7.2）。【建议】0 显示为中性灰“0%”。
10. **“登出跳转”的 redirect 参数无效**，登录后也不读取 redirect（5.6）。
11. **失败任务分页**：`total` 是全部数量，但 Horizon `getFailed()` 只返回最近约 50 条（【推断】），后面的页是空的。
12. **failed_at 显示不一致**：失败任务表格里格式化了，详情弹窗里显示原始值。
13. **`traffic-reset/logs` 的 total 读错**：官方页面读 `body.total`，后端放在 `body.pagination.total`，导致官方分页总数为 0（user 域需要修正）。
14. **流量重置日志页没有菜单入口**；`/config/system/frontend` 子页面没有导航入口（6.2.2、6.1）。

### 12.2 鉴权与安全相关

1. **任何 403 都会触发登出**：官方拦截器只要遇到 403 就清 token 并跳转登录。后端有业务 403，例如 `plugin/delete` 删除核心插件，会导致管理员被意外登出。新后台必须区分（5.6【建议】）。
2. **退出登录不吊销 token**：Sanctum token 在服务端有效期 1 年，每登录一次就新增一个；前端的 3 天过期只是本地限制。token 一旦泄露，在 1 年内都有效。
3. **Admin 中间件统一返回 403**（不返回 401），无法区分“未登录”和“不是管理员”。
4. **`GET /api/v2/user/resetSecurity` 是有副作用的 GET 请求**，会重置当前账号的订阅 token。新后台不要调用，也不要做预取。
5. **所有 POST 都会写审计日志**：官方的 fetch 类查询（用户、订单、工单、优惠券）都走 POST，因此每翻一页都会产生一条审计记录，敏感字段只过滤顶层的 5 个键。【建议】新后台可以对 `any` 路由改用 GET 加 querystring（嵌套数组用 `filter[0][id]=..` 形式，axios 需要配置 qs 风格的 `paramsSerializer`），以减少日志噪音。但这会让新旧后台的审计记录形态不同，需要主会话决定。
6. **filter/sort 列名不做白名单检查**：错误的列名会导致 500，前端只能发送真实存在的列。

### 12.3 后端有、官方 UI 没有用的接口

`system/getSystemStatus`、`system/getQueueWorkload`、`system/getQueueMasters`、`system/getAuditLog`、`stat/getOverride`、`stat/getServerLastRank`、`stat/getServerYesterdayRank`、`stat/getStatRecord`（实际不可用）、`stat/getRanking`（**500，方法不存在**）、`/api/v1/user/checkLogin`。详见 8.8。

### 12.4 共存风险（新旧后台同源）

- 本地存储键冲突（第 10 节），特别是旧后台读取 `collapsed-sidebar` 和 `sidebar-item-preferences` 时不做容错。
- 新后台不要修改 `admin.blade.php`、`public/assets/admin/**`、`/{secure_path}` 路由，也不要动 `admin-v2`、`console` 相关文件。
- 改 `secure_path` 后，两个后台的路径和 API 前缀会同时变化，新后台 blade 注入的 `secure_path` 也跟着变；常驻进程需要重载路由。

---

## 13. 新后台实现建议汇总（本域，非强制）

1. **入口**：`/{secure_path}/next`，独立 blade，注入 `window.settings`（加上 `description`），资源放在 `public/assets/admin-next/`，使用 hash 路由；路由 path 与官方保持一致（`/config/system`、`/server/manage`、`/finance/order`、`/user/manage` 等），便于对照和深链。
2. **HTTP 层**：
   - axios 的 baseURL 和 `secure_path` 前缀与官方一致；`Authorization` 直接使用 `auth_data`；带上 `Content-Language`；timeout 30s。
   - 统一错误处理：读 `body.message`，422 时可以读 `errors` 做逐字段标红；只有 401、`Unauthorized` 和“未登录或登陆已过期”这两种 403 才登出。
   - 提供 `unwrapData`、`toPaginated`（兼容 4.3 表中的 5 种分页结构）等适配函数。
3. **登录**：表单做 email 格式校验、密码至少 8 位；成功后检查 `is_admin`；保存 token（共享或独立，见第 10 节）；拉取 `/api/v2/user/info`；跳转到 redirect 或 `/`；“忘记密码”只展示命令并提供复制按钮；右上角放语言切换。
4. **布局**：
   - Naive UI 的 `n-layout` 加 `n-layout-sider`（可折叠，宽 256 和 56）加 `n-menu`，按 6.2.2 的菜单树配置；插件菜单按 6.2.3 动态追加。
   - 顶栏包含命令面板（`n-modal` 加输入框，绑定 Ctrl/⌘+K）、主题切换（`n-config-provider` 的 `darkTheme`）、语言切换、用户菜单（`n-dropdown`）。
   - 窄屏时侧栏改为抽屉（`n-drawer`）。
   - 菜单展开状态和折叠状态存到独立前缀的键。
   - 可以考虑把“流量重置日志”放进“用户管理”分组，补上菜单入口。这超出了官方现状，需要主会话决定。
5. **仪表盘**：
   - 实现 7.2 至 7.5，刷新间隔分别为：统计卡 5 分钟；收入概览、流量排行、队列状态 30 秒（`useIntervalFn` 或 `@tanstack/vue-query` 的 `refetchInterval`）。
   - 图表需要一个图表库（例如 ECharts 或 vue-echarts）。**这属于新增外部依赖，需要主会话确认**。
   - 修正 12.1 中第 5 至 9、11、12 项的显示问题。
   - 可选补充（超出官方现状）：系统状态卡（`getSystemStatus`：调度器和 Horizon 是否在运行，最近一次调度时间）、在线用户/设备/节点卡（`getStats` 已经返回）、审计日志页（`getAuditLog`）。
6. **复用文案**：从 `public/assets/admin/locales/zh-CN.js` 中把第 11 节列出的键复制到新后台自己的 i18n 资源里。不建议运行时依赖旧后台的语言包文件，以免旧后台升级后键名变化。
