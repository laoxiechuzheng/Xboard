# admin-next 规格：系统设置（settings）功能域

> 调研日期：2026-10-28。只读调研产物，后续实现者只依赖本文件与后端代码。
> 覆盖：系统配置全部 Tab（站点、安全、订阅、邀请&佣金、节点、邮件〔含邮件模板管理〕、Telegram、APP、订阅模板、隐藏的“个性化设置”）、`ConfigController` 全部接口、`MailTemplateController` 全部接口。
> 主题切换（`frontend_theme`）的页面属于“主题配置”功能域，本文件只说明它对 `config/save` 的副作用。

## 0. 依据与约定

| 来源 | 路径 |
|---|---|
| 路由 | `app/Http/Routes/V2/AdminRoute.php`（config 组、mail/template 组） |
| 控制器 | `app/Http/Controllers/V2/Admin/ConfigController.php`、`app/Http/Controllers/V2/Admin/MailTemplateController.php` |
| 校验 | `app/Http/Requests/Admin/ConfigSave.php`（`mail/template/save` 在控制器内 `validate`） |
| 存储 | `app/Support/Setting.php`、`app/Models/Setting.php`（表 `v2_settings`）、`app/Models/SubscribeTemplate.php`（表 `v2_subscribe_templates`）、`app/Models/MailTemplate.php`（表 `v2_mail_templates`） |
| 服务 | `app/Services/MailService.php`、`app/Services/TelegramService.php`、`app/Services/ThemeService.php` |
| 中间件 | `admin`（`app/Http/Middleware/Admin.php`）、`log`（`app/Http/Middleware/RequestLog.php`）、全局 `TrimStrings`、`ConvertEmptyStringsToNull` |
| 官方前端 | `public/assets/admin/assets/index-CEIYH7i8.js`：设置布局与各 Tab 约在字节偏移 5,749,000–5,828,000；订阅模板页约在 4,398,000–4,402,000；API 封装对象 `kT`（config）与 `ST`（mail/template）在 542,600 附近 |
| 文案 | `public/assets/admin/locales/zh-CN.js` 的 `settings.*`（第 911–1590 行）、`nav.*` |

本文中“官方 UI”指上述编译包的行为；“建议”是给新实现的设计意见，不是官方行为，需主会话决定是否采纳。凡标注“推断”的内容未经运行验证。

---

## 1. 通用约定

### 1.1 请求基础

- Base URL：`{base_url}/api/v2/{secure_path}`，其中 `secure_path` 取自页面注入的 `window.settings.secure_path`（`routes/web.php` 中 `/{secure_path}/next` 路由同样把 `secure_path` 传给 `admin-next` 视图，由视图负责注入页面）。
- 鉴权：`Authorization: <token>`（与旧后台同一 Sanctum token）。官方还发送 `Content-Language: zh-CN`。
- `admin` 中间件：未登录或非管理员 → HTTP 403 `{"message":"Unauthorized"}`。
- 请求体：JSON（`Content-Type: application/json`）。布尔值直接发 JSON `true/false` 即可被后端接受。

### 1.2 响应封装（3 种形态，前端都要处理）

1. 成功（`$this->success($data)`）：HTTP 200
   `{"status":"success","message":"操作成功","data":<data>,"error":null}`
2. 业务失败（`$this->fail([code, msg])`）：HTTP 状态码 = code 前三位
   `{"status":"fail","message":"<msg>","data":null,"error":null}`
   - `ApiException`（如 Telegram 调用失败）由 `Handler` 转成同一形态，默认 HTTP 400。
3. FormRequest / `$request->validate()` 校验失败：Laravel 默认 HTTP 422
   `{"message":"<第一条错误>[ (and N more errors)]","errors":{"<field>":["<msg>", ...]}}`
   - `ConfigSave::messages()` 中有自定义中文文案的字段返回中文；其余字段返回 Laravel 默认文案。项目 `config/app.php` 的 `locale`/`fallback_locale` 都是 `zh-CN` 且仓库无 `validation.php` 翻译文件，推断此时返回的是 `validation.integer` 这类原始 key（未实测）。新实现应根据 `errors` 的字段名映射为字段级中文错误，而不是直接展示 `message`。
4. 特例：`POST config/testSendMail` 直接 `response(['data' => $mailLog])`，HTTP 200，**没有** `status/message` 字段（见 3.6）。

官方 axios 拦截器：成功时返回 body；HTTP 错误时 toast `response.data.message`（无则按 401/403/404 显示通用文案），401/403 时登出。

### 1.3 配置存储语义（影响前端数据转换）

- `config/save` 对每个通过校验的 key 调用 `admin_setting([$k => $v])` → `Setting::save` → `v2_settings` 表 `updateOrCreate(name, value)`；数组值 `json_encode` 后存储；保存后清 Redis 缓存 `admin_settings`。
- 读取时 `Setting::load` 对**每个字符串值尝试 `json_decode`**，成功则替换为解码结果。后果：
  - 存储为 `"1"`/`"0"`/`"60"` 的值读出为 int；`"0.5"` 读出为 float；`"true"` 读出为 bool；`"null"` 读出为 null；JSON 数组读出为数组。
  - 纯数字字符串（如全数字的 `app_name`、`secure_path`、`email_password`）会以 **number** 形式返回。前端所有文本型字段必须 `String(v ?? '')` 规范化后再绑定，比较“是否修改”时也按字符串比较。
  - 超过 PHP_INT_MAX 的纯数字字符串会被读成 float 而失真（边缘情况，见 7.4）。
- `admin_setting($key, $default)` = 存储值 `?? $default`：**提交 `null`（或空字符串，会被 `ConvertEmptyStringsToNull` 转成 null）等于把该项恢复为代码默认值**（例如 `invite_commission` 清空后读出为 10）。数组提交 `[]` 不是 null，会被原样存为 `[]`，不会回落默认值。
- 布尔值落库为 `1`/`0`；fetch 时多数布尔项被 `(bool)` 强转，`force_https`、`stop_register` 被 `(int)` 强转（返回 0/1）。
- `TrimStrings` 会 trim 所有字符串字段（仅排除名为 `password`、`password_confirmation`、`encrypted_data`、`signature` 的字段），因此 `email_password` 前后空格也会被去掉，订阅模板 / 邮件模板的首尾空白会被去掉。
- `ConvertEmptyStringsToNull` 也作用于数组元素：`["a",""]` 会变成 `["a",null]`，提交数组前必须先过滤空串。
- `config/save` **支持部分提交**：所有规则都不是 `required`，`validated()` 只返回请求中出现且有规则的 key；不在 `ConfigSave::RULES` 里的 key 被静默丢弃（不报错）。
- 保存是逐 key 写库，**非事务**：中途抛异常（如 `frontend_theme` 切换失败）时，前面的 key 已写入。
- 特殊 key：
  - `subscribe_template_*` 6 个 key 不写 `v2_settings`，而是 `SubscribeTemplate::setContent(<name>, $v)` 写 `v2_subscribe_templates` 并清 Redis 缓存 `subscribe_template:<name>`。
  - `frontend_theme`：先调用 `ThemeService::switch($v)`（复制主题文件到 `public/theme/<theme>`、清理旧主题文件、写 `current_theme`），再写设置。主题不存在会抛异常 → HTTP 500。**只要请求里带了 `frontend_theme`（哪怕值未变）就会触发一次切换/复制。**

### 1.4 官方 UI 的保存模式

- 除“个性化设置（frontend）”外，所有 Tab 都是**自动保存**：react-hook-form `watch` 任一字段变化 → `lodash.debounce` 1000 ms（订阅模板 1500 ms）→ 若与上次保存快照 `isEqual` 不同则 `POST config/save`，**提交该 Tab 表单的全部字段（整组）**，包括表单里没有渲染但 fetch 返回过的 key（例如 `device_limit_mode`、`default_remind_expire`、`default_remind_traffic`、`recaptcha_enable`）。
- 成功 toast：`已自动保存`（`settings.common.autoSaved`）；保存中显示灰色小字 `保存中...`（部分 Tab 用了不存在的 i18n key，见 7.1）。
- 失败：由拦截器 toast 后端 `message`；快照不更新，下次变化会再整组重试。官方没有字段级错误展示（`FormMessage` 只显示 zod 的 onBlur 校验结果，而 zod 校验并不拦截自动保存）。
- 只有“个性化设置”页使用显式“保存设置”按钮 + `handleSubmit`。

### 1.5 新实现的总体建议（非官方行为，供主会话决策）

1. 读取使用 `GET config/fetch?key=<group>&safe=1`（本 fork 新增参数，见 3.1），敏感字段返回 `null`，避免把密钥常驻浏览器。需要查看/复制密钥时（例如通讯密钥要抄到节点端，官方 UI 是明文显示的）提供“显示”按钮，按需调用不带 `safe` 的 `config/fetch?key=<group>`，只取该字段展示。
2. 提交只发**已修改的字段**（dirty fields），尤其是敏感字段：`safe=1` 读回的是 null，若整组回写会把密钥清空（=恢复默认空值，节点/邮件/Telegram/验证码立即失效）。敏感字段输入框留空 = 保持原值，不提交。
3. 自动保存可保留（与官方一致），但以下字段必须改为“显式保存 + 二次确认”：`secure_path`、`subscribe_path`、`server_token`、`safe_mode_enable`、`force_https`、`stop_register`、订阅模板内容。理由见第 7.3 节。
4. 前端预校验与后端规则一致（第 6 节），校验不通过不发请求；后端 422 时把 `errors` 映射到字段下方。
5. 页面所有文本字段统一 `String()` 规范化；数字字段提交 number 或数字字符串均可（后端 `integer/numeric` 接受数字字符串）。

---

## 2. 页面结构与入口

### 2.1 菜单与路由（官方）

- 侧边栏：`系统管理`（`nav.systemManagement`）→ `系统配置`（`nav.systemConfig`），href `/config/system`。同组其他菜单（插件管理、主题配置、公告管理、支付配置、知识库管理）不属于本功能域。
- 路由（react-router，均挂在 `/config/system` 布局下）：

| 路由 | 页面 | 设置导航中显示 |
|---|---|---|
| `/config/system`（index） | 站点设置 | 是 |
| `/config/system/safe` | 安全设置 | 是 |
| `/config/system/subscribe` | 订阅设置 | 是 |
| `/config/system/invite` | 邀请&佣金设置 | 是 |
| `/config/system/server` | 节点配置 | 是 |
| `/config/system/email` | 邮件设置（内含“基本设置 / 模板管理”两个子 Tab） | 是 |
| `/config/system/telegram` | Telegram设置 | 是 |
| `/config/system/APP`（导航 href 写的是 `/config/system/app`，router 大小写不敏感） | APP设置 | 是 |
| `/config/system/subscribe-template` | 订阅模板 | 是 |
| `/config/system/frontend` | 个性化设置 | **否**（路由存在但导航未列出，页面基本不可用，见 4.10） |

建议新实现（`/{secure_path}/next` 下）沿用同样的子路由名：`/config/system`、`/config/system/{safe|subscribe|invite|server|email|telegram|app|subscribe-template}`；邮件模板子 Tab 可用 `?tab=templates` 记忆。是否实现隐藏的 frontend 页见 4.10。

### 2.2 布局

- 页面头部：标题 `系统设置`（`settings.title`），副标题 `管理系统核心配置，包括站点、安全、订阅、邀请佣金、节点、邮件和通知等设置`（`settings.description`），下有分隔线。
- 桌面端：左侧竖排导航（约 1/5 宽，sticky），右侧内容区（`<Outlet/>`）。当前路由项高亮（`bg-muted`）。
- 移动端：导航变为下拉选择框（官方 placeholder 误写为 `Theme`），选中即跳转。
- 导航项（顺序、文案 key、图标语义）：

| 顺序 | 文案 | href | 说明文字（description，官方未在导航显示，可做 tooltip） |
|---|---|---|---|
| 1 | 站点设置 | `/config/system` | 配置站点基本信息，包括站点名称、描述、货币单位等核心设置。 |
| 2 | 安全设置 | `/config/system/safe` | 配置系统安全相关选项，包括登录验证、密码策略、API访问等安全设置。 |
| 3 | 订阅设置 | `/config/system/subscribe` | 管理用户订阅相关配置，包括订阅链接格式、更新频率、流量统计等设置。 |
| 4 | 邀请&佣金设置 | `/config/system/invite` | 邀请注册、佣金相关设置。 |
| 5 | 节点配置 | `/config/system/server` | 配置节点通信和同步设置，包括通信密钥、轮询间隔、负载均衡等高级选项。 |
| 6 | 邮件设置 | `/config/system/email` | 配置系统邮件服务，用于发送验证码、密码重置、通知等邮件，支持多种SMTP服务商。 |
| 7 | Telegram设置 | `/config/system/telegram` | 配置Telegram机器人功能，实现用户通知、账户绑定、指令交互等自动化服务。 |
| 8 | APP设置 | `/config/system/app` | 管理移动应用程序相关配置，包括API接口、版本控制、推送通知等功能设置。 |
| 9 | 订阅模板 | `/config/system/subscribe-template` | 配置各个客户端的订阅模板 |

- 每个 Tab 页内容：`h3` 标题 + 灰色描述（同上表）+ 分隔线 + 表单。
- 表单行样式：文本类字段为“标签（text-base）/ 控件 / 说明文字 / 错误信息”纵向排列；开关类字段为“左侧标签+说明、右侧 Switch”。

---

## 3. 接口规格

所有路径相对 `/api/v2/{secure_path}`。

### 3.1 `GET config/fetch`

- 用途：读取配置分组。
- Query：
  - `key`（string，可选）：分组名，取值 `invite | site | subscribe | frontend | server | email | telegram | app | safe | subscribe_template`。为空或不是上述值时返回**全部分组**。官方每个 Tab 都带 `key`（`kT.getSettings(group)` → `config/fetch?key=<group>`）。
  - `safe`（boolean，可选，`$request->boolean`：`1/true/on/yes` 为真）：**本 fork 新增**，官方 UI 不使用。为真时把以下 key 的值置为 `null`：`server_token`、`email_password`、`telegram_bot_token`、`recaptcha_key`、`recaptcha_v3_secret_key`、`turnstile_secret_key`。可与 `key` 同时使用。
- 响应：`data = { "<group>": { <key>: <value>, ... } }`（带 key 时只有一个分组；不带时 10 个分组都在）。各分组字段、类型、默认值见第 4 节各小节的“fetch 返回”表。
- 副作用：无（GET 不写审计日志）。
- 错误：仅鉴权错误。

### 3.2 `POST config/save`

- 用途：保存任意配置项（可跨分组、可部分提交）。
- 请求体：扁平 JSON 对象 `{ "<config_key>": <value>, ... }`，**不按分组嵌套**。允许的 key 与规则见第 6 节全表。
- 数据格式：
  - 布尔：`true/false`（也接受 `0/1`、`"0"/"1"`）。注意 `force_https`、`stop_register`、`ticket_must_wait_reply`、`invite_*`、`commission_*` 等规则为空的 key 不做类型校验，发什么存什么。
  - 数组（`commission_withdraw_method`、`email_whitelist_suffix`）：JSON 数组；规则 `nullable|array`，发字符串会 422。
  - 订阅模板：原样字符串（Sing-box 为 JSON 文本，不要发对象）。
- 响应：成功 `data: true`。
- 失败：
  - 422 校验失败（Laravel 默认格式，见 1.2）。整次请求全部不保存。
  - 500：`frontend_theme` 指向不存在的主题等异常（此时之前遍历到的 key 已写入）。
- 副作用：写 `v2_settings` / `v2_subscribe_templates`；清配置缓存；可能触发主题切换；`log` 中间件把**整个请求体**写入 `admin_audit_logs`（只排除顶层名为 `password`、`token`、`secret`、`key`、`api_key` 的字段，因此 `email_password`、`server_token`、`telegram_bot_token`、各验证码密钥会以明文进入审计日志，见 7.4）。action 记为 `config.save`。
- 官方调用方：设置各 Tab（`kT.saveSettings`）、主题页切换主题（`kT.updateSystemConfig({frontend_theme})`，成功 toast `主题切换成功`）。

### 3.3 `GET config/getEmailTemplate`

- 用途：列出 `resources/views/mail/` 下的条目名（目录名），当前仓库返回 `["classic","default"]`。
- 参数：无。响应：`data: string[]`。
- 官方 UI：`kT.getEmailTemplate` 有定义但**没有任何页面调用**。`zh-CN` 里残留 `settings.email.email_template`（`邮件模板` / `自定义邮件模板方式请查看文档` / `选择邮件模板`）文案，但对应的 `email_template` 配置项不在 `ConfigSave` 规则里（提交会被丢弃），且 `MailService` 固定使用 `mail.default.*` 视图。结论：**无需实现“邮件模板主题选择”**；邮件内容定制由“模板管理”子 Tab 负责（3.7）。

### 3.4 `GET config/getThemeTemplate`

- 用途：列出 `public/theme/` 下的条目名（当前仓库只有 `.gitignore`，`glob('*')` 不含点文件，推断返回 `[]` 或运行时已复制的主题目录名）。
- 官方 UI：**未定义也未调用**。主题列表由主题功能域的 `theme/getThemes` 提供。新实现无需使用。

### 3.5 `POST config/setTelegramWebhook`

- 用途：向 Telegram 注册 Webhook 并注册 Bot 命令。
- 请求体：官方**不发送任何参数**（`kT.setTelegramWebhook()` → `RL(.../config/setTelegramWebhook)`，body 为空）。后端会读 `telegram_bot_token`，但 `TelegramService` 构造时 `admin_setting('telegram_bot_token', $token)` **以已保存的 token 优先**，请求参数仅在库中 token 为空时作为兜底；`access_token` 同样优先用已保存 token 计算。结论：**必须先把 token 保存成功，再调用本接口**。
- 处理流程：
  1. Webhook 基础地址 = `telegram_webhook_url`（trim、去尾 `/`）非空则用它，否则用 `app_url`（去尾 `/`），都为空 → `fail([422,'Telegram Webhook地址未配置'])`。
  2. 若基础地址已包含 `/api/v1/guest/telegram/webhook` 则直接使用，否则拼接该路径。
  3. 追加 `?access_token=md5(<bot token>)`。
  4. 依次调用 Telegram `getMe`、`setWebhook(url)`、`setMyCommands`（命令来自插件 hook `telegram.bot.commands`；注册失败只记日志不报错）。
- 成功响应：`data: { "success": true, "webhook_url": "<完整回调地址含 access_token>", "webhook_base_url": "<基础地址>" }`。
- 失败：
  - 422 `Telegram Webhook地址未配置`。
  - 400 `Telegram 服务错误: <原因>`（token 错误、网络不通、Telegram 返回 ok=false 等，均由 `TelegramService::request` 包装为 `ApiException`）。
- 耗时：HTTP 客户端 30 s 超时 + 重试 3 次（间隔 1 s），而官方 axios 超时 30 s，网络不通时前端可能先超时。建议新实现对此请求单独放宽超时（如 120 s）并显示加载态。
- 副作用：覆盖该 Bot 在 Telegram 侧的 Webhook 与命令列表；写审计日志（`config.setTelegramWebhook`）。
- 注意：返回的 `webhook_url` 含 `access_token`（由 bot token 派生，知道它即可伪造回调），官方在 toast 中明文展示，新实现展示时可考虑部分打码或仅在详情中展示。

### 3.6 `POST config/testSendMail`

- 用途：用当前已保存的 SMTP 配置给**当前管理员自己的邮箱**发一封测试邮件。
- 请求体：无（官方不发参数；后端也不读参数）。收件人 = `$request->user()->email`。
- 内部：`MailService::sendEmail(['email'=>管理员邮箱,'subject'=>'This is xboard test email','template_name'=>'notify','template_value'=>['name'=>app_name,'content'=>'This is xboard test email','url'=>app_url]])`，同步发送（不走队列）；若 `v2_mail_templates` 中有 `notify` 自定义模板则使用自定义模板；每次都写一条 `v2_mail_log`。
- 响应（HTTP 200，**无 status/message**）：
  ```json
  {
    "data": {
      "email": "admin@example.com",
      "subject": "This is xboard test email",
      "template_name": "mail.default.notify",   // 或 "db:notify"
      "error": null,                              // 失败时为异常信息字符串
      "config": {                                 // 即 config('mail') 全量
        "driver": "smtp", "host": "...", "port": 465,
        "from": {"address": "...", "name": "<app_name>"},
        "encryption": "ssl", "username": "...",
        "password": "<SMTP 明文密码>",            // 危险，见 7.4
        "sendmail": "/usr/sbin/sendmail -bs", "markdown": {...}, "log_channel": null
      }
    }
  }
  ```
- 发送失败**不会**返回非 200：判断成功与否必须看 `data.error` 是否为 null。
- SMTP 配置生效条件：只有 `email_host` 非空时才用后台配置覆盖 `config('mail')`；否则使用 `.env` 的 `MAIL_*`。
- 官方 UI 展示：见 4.6.3 测试结果弹窗。新实现**不得展示或记录 `config.password`**。

### 3.7 邮件模板接口（`MailTemplateController`）

模板元数据固定在 `MailTemplate::TEMPLATES`（顺序即列表顺序）：

| name | label | required_vars | optional_vars | 默认主题（getDefaultSubject，`{app}`=app_name 或 XBoard） | 测试主题（getTestSubject） |
|---|---|---|---|---|---|
| `verify` | 邮箱验证码 | `code` | `name`,`url` | `{app} - 邮箱验证码` | `{app} - 验证码测试` |
| `notify` | 站点通知 | `content` | `name`,`url` | `{app} - 站点通知` | `{app} - 通知测试` |
| `remindExpire` | 到期提醒 | — | `name`,`url` | `{app} - 服务即将到期` | `{app} - 到期提醒测试` |
| `remindTraffic` | 流量提醒 | — | `name`,`url` | `{app} - 流量使用提醒` | `{app} - 流量提醒测试` |
| `mailLogin` | 邮件登录 | `link` | `name`,`url` | `{app} - 邮件登录` | `{app} - 登录链接测试` |

#### 3.7.1 `GET mail/template/list`

- 参数：无。
- 响应 `data`：按上表顺序的数组，每项 `{ "name": string, "label": string, "customized": bool（库中有记录）, "subject": string|null（仅已自定义时有值）, "updated_at": int|null（Unix 秒，仅已自定义） }`。官方只用 `name/label/customized`。

#### 3.7.2 `GET mail/template/get?name=<name>`

- 参数：`name`（query，必填，官方直接拼接未编码）。
- 响应 `data`：`{ name, label, required_vars: string[], optional_vars: string[], customized: bool, subject: string, content: string }`。
  - 未自定义时 `subject` 为默认主题；`content` 读取 `resources/views/mail/default/<name>.blade.php` 并把 `{{$var}}`、`{!! nl2br($var) !!}`、`{!! $var !!}` 转成 `{{var}}`；文件不存在则用控制器内置 HTML（`hardcodedDefault`）。
- 错误：`name` 不在元数据中 → 404 `模板不存在`；**缺少 `name` 参数**会因 `getMeta(string $name)` 收到 null 抛 TypeError → 500（推断）。前端必须保证带 name。

#### 3.7.3 `POST mail/template/save`

- 请求体：`{ "name": string, "subject": string, "content": string }`。
- 校验：`name: required|string`；`subject: required|string|max:255`；`content: required|string`（失败为 Laravel 422 格式）。然后：
  - name 不存在 → 404 `模板不存在`；
  - `content` 必须**逐字**包含每个 required var 的 `{{var}}`（`strpos`，不允许 `{{ var }}` 带空格），缺失 → 422 `缺少必要占位符: {{code}}`（多个以 `; ` 连接）。
- 响应：`data: true`。
- 副作用：`updateOrCreate` 写 `v2_mail_templates`；清 `mail_template:<name>` 缓存（`MailService` 对模板查询缓存 3600 s）；写审计日志（含全文）。保存后系统所有该类邮件立即改用此模板（`MailService` 把 `subject`/`content` 中的 `{{var}}`、`{{ var }}`、`{{var|默认值}}` 替换为 HTML 转义后的变量值；`content` 变量不转义，通知正文为文本模式时会 `nl2br`）。

#### 3.7.4 `POST mail/template/reset`

- 请求体：`{ "name": string }`。
- 行为：删除该 name 的库记录（不存在也返回成功），清缓存 → 恢复使用 blade 默认模板。
- 响应：`data: true`。错误：未知 name → 404 `模板不存在`；缺 name → 500（推断，同上）。

#### 3.7.5 `POST mail/template/test`

- 请求体：`{ "name": string, "email"?: string }`。`email` 缺省时发给当前管理员邮箱。后端**不校验邮箱格式**。
- 行为：用**已保存**的模板（库中自定义优先，否则 blade 默认）+ 固定测试变量同步发送：
  - `verify`：`name`=app_name，`code`=`123456`，`url`=app_url
  - `notify`：`name`，`content`=`这是一封测试通知邮件。`，`url`
  - `remindExpire` / `remindTraffic`：`name`，`url`
  - `mailLogin`：`name`，`link`=`<app_url>/login?token=test-token`，`url`
  - （app_url 为空时用 `https://example.com`）
- 响应：成功 `data: true`；发送失败 → HTTP 500 `发送失败: <错误>`；未知 name → 404 `模板不存在`。

### 3.8 依赖的其他域接口

- `GET plan/fetch`：站点设置“注册试用”下拉的选项来源（官方 query key `["plans"]`），使用返回数组的 `id`、`name`。

---

## 4. 各 Tab 详细规格

字段表列说明：**默认值** = 后端 fetch 在未保存过时返回的值；**规则** = `ConfigSave` 规则（空 = 无校验）；**提交** = 官方提交时的值格式。所有中文文案取自 `zh-CN.js` 的 `settings` 命名空间。

### 4.1 站点设置（`/config/system`，group `site`）

- 读取：`config/fetch?key=site`（query key `["settings","site"]`）；同时读取 `plan/fetch`。
- 官方提交前转换：把所有 `null` 值转成 `""`（随后被后端转回 null）。
- 字段（按官方显示顺序）：

| # | key | 控件 | 标签 | placeholder | 说明文字 | 默认值 / fetch 类型 | 规则 | 显示条件 / 提交 |
|---|---|---|---|---|---|---|---|---|
| 1 | `app_name` | 输入框 | 站点名称 | 请输入站点名称 | 用于显示需要站点名称的地方。 | `"XBoard"` / string | 无 | 字符串 |
| 2 | `app_description` | 输入框 | 站点描述 | 请输入站点描述 | 用于显示需要站点描述的地方。 | `"XBoard is best!"` / string | 无 | 字符串 |
| 3 | `app_url` | 输入框 | 站点网址 | 请输入站点URL，末尾不要/ | 当前网站最新网址，将会在邮件等需要用于网址处体现。 | `null` / string\|null | `nullable\|url`，错误文案 `站点URL格式不正确，必须携带http(s)://` | 字符串；建议前端去尾 `/` 提示 |
| 4 | `force_https` | Switch | 强制HTTPS | — | 当站点没有使用HTTPS，CDN或反代开启强制HTTPS时需要开启。 | `0` / int(0/1) | 无 | 官方提交 `Number(checked)` 即 0/1 |
| 5 | `logo` | 输入框 | LOGO | 请输入LOGO URL，末尾不要/ | 用于显示需要LOGO的地方。 | `null` | `nullable\|url`，`LOGO URL格式不正确，必须携带https(s)://`（原文如此） | 字符串 |
| 6 | `subscribe_url` | 多行文本框 | 订阅URL | 用于订阅所使用，多个订阅地址用','隔开.留空则为站点URL。 | 用于订阅所使用，留空则为站点URL。 | `null` | `nullable`（`messages()` 里虽有 `subscribe_url.url` 文案，但规则没有 `url`） | 字符串。后端 `explode(',')` 后随机取一个且**不 trim**，逗号后不要加空格；支持 `[min-max]` 随机数与 `[uuid]` 占位 |
| 7 | `tos_url` | 输入框 | 用户条款(TOS)URL | 请输入用户条款URL，末尾不要/ | 用于跳转到用户条款(TOS) | `null` | `nullable\|url`，`服务条款URL格式不正确，必须携带http(s)://` | 字符串 |
| 8 | `stop_register` | Switch | 停止新用户注册 | — | 开启后任何人都将无法进行注册。 | `0` / int | 无 | 0/1 |
| 9 | `ticket_must_wait_reply` | Switch | 工单等待回复限制 | — | 开启后，用户在管理员回复前无法在同一工单内连续发送消息。 | `false` / bool | 无 | 官方提交 0/1 |
| 10 | `try_out_plan_id` | 下拉 | 注册试用 | 关闭 | 选择需要试用的订阅，如果没有选项请先前往订阅管理添加。 | `0` / int | `integer`（null 会 422） | 选项：`0`→`关闭`，其后为全部套餐 `id`→`name`；提交 `Number(value)` |
| 11 | `try_out_hour` | 输入框 | 注册试用时长 | 0 | 注册试用时长，单位为小时。 | `1` / int（fetch 做了 `(int)` 截断） | `numeric`（空值 null 会 422） | **仅当 `try_out_plan_id` 非 0 时显示**。官方提交字符串。后端实际按 `try_out_hour*3600` 秒计算，允许小数，但 fetch 显示被截断为整数（见 7.1） |
| 12 | `currency` | 输入框 | 货币单位 | CNY | 仅用于展示使用，更改后系统中所有的货币单位都将发生变更。 | `"CNY"` | 无 | 字符串 |
| 13 | `currency_symbol` | 输入框 | 货币符号 | ¥ | 仅用于展示使用，更改后系统中所有的货币单位都将发生变更。 | `"¥"` | 无 | 字符串 |

- fetch 还会返回这些字段以外的 key：无。
- 交互：任意字段变化 1 s 后整组保存；成功 toast `已自动保存`；保存中显示 `site.form.saving`（locale 中不存在，官方会显示 key 原文；新实现用 `保存中...`）。

### 4.2 安全设置（`/config/system/safe`，group `safe`）

- 读取：`config/fetch?key=safe`。官方加载后把所有 number 值转成字符串再放入表单；数据加载完成前不触发自动保存（`loaded` 标志）。
- 官方提交前转换：`email_whitelist_suffix = (value ?? []).filter(Boolean)`；其余原样（含未渲染的 `recaptcha_enable`）。
- 字段（按显示顺序）：

| # | key | 控件 | 标签 | placeholder | 说明文字 | 默认值 / 类型 | 规则 | 显示条件 / 提交 |
|---|---|---|---|---|---|---|---|---|
| 1 | `email_verify` | Switch | 邮箱验证 | — | 开启后将会强制要求用户进行邮箱验证。 | `false` | `bool`（=boolean） | 布尔 |
| 2 | `email_gmail_limit_enable` | Switch | 禁止使用Gmail多别名 | — | 开启后Gmail多别名将无法注册。 | `false` | `boolean` | 布尔 |
| 3 | `safe_mode_enable` | Switch | 安全模式 | — | 开启后除了站点URL以外的绑定本站点的域名访问都将会被403。 | `false` | `boolean` | 布尔。仅当 `app_url` 已配置时生效，且只拦截用户前台 `/` 路由（`routes/web.php`） |
| 4 | `secure_path` | 输入框 | 后台路径 | admin | 后台管理路径，修改后将会改变原有的admin路径 | `crc32b(app.key)`（8 位十六进制）/ string（纯数字时为 number） | `min:8\|regex:/^[\w-]*$/`；文案 `后台路径长度最小为8位`、`后台路径只能为字母或数字`（实际允许字母、数字、`_`、`-`）；**不可为空**（null 也会触发 min:8 失败） | 危险，见 7.3 |
| 5 | `email_whitelist_enable` | Switch | 邮箱后缀白名单 | — | 开启后在名单中的邮箱后缀才允许进行注册。 | `false` | `boolean` | 布尔 |
| 6 | `email_whitelist_suffix` | 多行文本框 | 邮箱后缀 | 输入邮箱后缀，每行一个 | 输入允许的邮箱后缀，每行一个 | `["gmail.com","qq.com","163.com","yahoo.com","sina.com","126.com","outlook.com","yeah.net","foxmail.com"]` / array（历史数据可能是逗号分隔字符串） | `nullable\|array` | **仅当 `email_whitelist_enable` 为真时显示**。显示 `array.join("\n")`；输入 `split("\n").filter(Boolean)`；提交数组。建议额外 trim 每行并去重；若 fetch 返回字符串则按 `,` 拆分（官方此时会因 `.join` 报错） |
| 7 | `captcha_enable` | Switch | 启用验证码 | — | 开启后用户注册时需要通过验证码验证。 | `false` | `boolean` | 布尔 |
| 8 | `captcha_type` | 下拉 | 验证码类型 | 选择要使用的验证码服务类型 | 选择要使用的验证码服务类型 | `"recaptcha"` | `in:recaptcha,turnstile,recaptcha-v3`，文案 `人机验证类型只能选择 recaptcha、turnstile 或 recaptcha-v3` | **仅 `captcha_enable` 为真时显示**。选项：`recaptcha`→`Google reCAPTCHA v2`，`recaptcha-v3`→`Google reCAPTCHA v3`，`turnstile`→`Cloudflare Turnstile`；值为空时显示为 `recaptcha` |
| 9 | `recaptcha_site_key` | 输入框 | reCAPTCHA站点密钥 | 输入reCAPTCHA站点密钥 | 输入您的reCAPTCHA站点密钥 | `""` | 无 | `captcha_enable && captcha_type==='recaptcha'` |
| 10 | `recaptcha_key` | 输入框 | reCAPTCHA密钥 | 输入reCAPTCHA密钥 | 输入您的reCAPTCHA密钥 | `""`（**敏感**，safe=1 时为 null） | 无 | 同上 |
| 11 | `recaptcha_v3_site_key` | 输入框 | reCAPTCHA v3站点密钥 | 输入reCAPTCHA v3站点密钥 | 输入您的reCAPTCHA v3站点密钥 | `""` | 无 | `captcha_enable && captcha_type==='recaptcha-v3'` |
| 12 | `recaptcha_v3_secret_key` | 输入框 | reCAPTCHA v3密钥 | 输入reCAPTCHA v3密钥 | 输入您的reCAPTCHA v3服务器密钥 | `""`（**敏感**） | 无 | 同上 |
| 13 | `recaptcha_v3_score_threshold` | 数字输入（step 0.1，min 0，max 1） | 分数阈值 | 0.5 | 设置验证分数阈值（0-1），分数越高表示越可能是真人操作 | `0.5` | `numeric\|min:0\|max:1`，文案 `reCAPTCHA v3 分数阈值必须为数字`/`不能小于0`/`不能大于1`；空值 null 会 422 | 同上（v3） |
| 14 | `turnstile_site_key` | 输入框 | Turnstile站点密钥 | 输入Turnstile站点密钥 | 输入您的Cloudflare Turnstile站点密钥 | `""` | 无 | `captcha_enable && captcha_type==='turnstile'` |
| 15 | `turnstile_secret_key` | 输入框 | Turnstile密钥 | 输入Turnstile密钥 | 输入您的Cloudflare Turnstile密钥 | `""`（**敏感**） | 无 | 同上 |
| 16 | `register_limit_by_ip_enable` | Switch | IP注册限制 | — | 开启后将限制同一IP的注册次数。 | `false` | `boolean` | 布尔 |
| 17 | `register_limit_count` | 输入框 | 注册次数 | 输入最大注册次数 | 同一IP允许的最大注册次数 | `3` | `integer`（null 会 422） | 仅 `register_limit_by_ip_enable` 为真时显示；官方提交字符串 |
| 18 | `register_limit_expire` | 输入框 | 限制时长 | 输入限制时长（分钟） | 注册限制的持续时间（分钟） | `60`（分钟，后端 ×60 秒） | `integer` | 同上 |
| 19 | `password_limit_enable` | Switch | 密码尝试限制 | — | 开启后将限制密码尝试次数。 | `true` | `boolean` | 布尔 |
| 20 | `password_limit_count` | 输入框 | 尝试次数 | 输入最大尝试次数 | 允许的最大密码尝试次数 | `5` | `integer` | 仅 `password_limit_enable` 为真时显示 |
| 21 | `password_limit_expire` | 输入框 | 锁定时长 | 输入锁定时长（分钟） | 账户锁定的持续时间（分钟） | `60`（分钟） | `integer` | 同上 |
| — | `recaptcha_enable` | 不渲染 | — | — | — | fetch 返回 `(bool)captcha_enable`（兼容字段） | `boolean` | 官方会随整组回传，后端另存为 `recaptcha_enable` 设置但**无消费方**。建议新实现不提交 |

- 官方 zod 默认值（无实际意义，仅首屏占位）：开关全 false、`captcha_type:"recaptcha"`、`recaptcha_v3_score_threshold:"0.5"`、数字类为空串。
- 敏感字段（`recaptcha_key`、`recaptcha_v3_secret_key`、`turnstile_secret_key`）建议使用密码框 + “显示”按钮 + 留空不提交。

### 4.3 订阅设置（`/config/system/subscribe`，group `subscribe`）

- 读取：`config/fetch?key=subscribe`。提交：整组原样。
- 字段（显示顺序）：

| # | key | 控件 | 标签 | 说明文字 | 默认值 / 类型 | 规则 | 选项 / 提交 |
|---|---|---|---|---|---|---|---|
| 1 | `plan_change_enable` | Switch | 允许用户更改订阅 | 开启后用户将会可以对订阅计划进行变更。 | `true` | 无 | 布尔 |
| 2 | `reset_traffic_method` | 下拉（placeholder `请选择重置方式`） | 月流量重置方式 | 全局流量重置方式，默认每月1号。可以在订阅管理为订阅单独设置。 | `0` / int | `in:0,1,2,3,4` | `0`→每月1号，`1`→按月重置，`2`→不重置，`3`→每年1月1号，`4`→按年重置（与 `Plan::RESET_TRAFFIC_*` 一致）；官方提交字符串 `"0"`…`"4"` |
| 3 | `surplus_enable` | Switch | 开启折抵方案 | 开启后用户更换订阅将会由系统对原有订阅进行折抵，方案参考文档。 | `true` | 无 | 布尔 |
| 4 | `new_order_event_id` | 下拉（placeholder `请选择`） | 当订阅新购时触发事件 | 新购订阅完成时将触发该任务。 | `0` / int | 无 | `0`→不执行任何动作，`1`→重置用户流量；官方提交字符串 |
| 5 | `renew_order_event_id` | 下拉 | 当订阅续费时触发事件 | 续费订阅完成时将触发该任务。 | `0` | 无 | 同上 |
| 6 | `change_order_event_id` | 下拉 | 当订阅变更时触发事件 | 变更订阅完成时将触发该任务。 | `0` | 无 | 同上 |
| 7 | `subscribe_path` | 输入框（placeholder `subscribe`） | 订阅路径 | 三行说明：`订阅路径，修改后将会改变原有的subscribe路径` / `当前订阅路径格式：{path}/xxxxxxxxxx`（`{path}` = 当前值或 `s`）/ `修改订阅路径后，可能需要重启服务才能生效。` | `"s"` | 无（建议前端限制 `^[\w-]+$`，不能为空） | 危险，见 7.3 |
| 8 | `show_info_to_server_enable` | Switch | 在订阅中展示订阅信息 | 开启后将会在用户订阅节点时输出订阅信息。 | `false` | 无 | 布尔 |
| 9 | `show_protocol_to_server_enable` | Switch | 在订阅中线路名称中显示协议名称 | 开启后订阅线路会附带协议名称（例如: [Hy2]香港） | `false` | 无 | 布尔 |
| — | `default_remind_expire` | **官方未渲染** | （无官方文案，建议：新用户默认开启到期提醒） | 新注册用户 `remind_expire` 的初始值（`UserService` 第 174 行） | `true` | `boolean` | 官方随整组回传原值。建议新实现补上开关 |
| — | `default_remind_traffic` | **官方未渲染** | （建议：新用户默认开启流量提醒） | 新注册用户 `remind_traffic` 的初始值 | `true` | `boolean` | 同上 |

### 4.4 邀请&佣金设置（`/config/system/invite`，group `invite`）

- 读取：`config/fetch?key=invite`；官方把 number 转成字符串放入表单；数据加载前不自动保存。提交：整组原样。
- 字段（显示顺序）：

| # | key | 控件 | 标签 | placeholder | 说明文字 | 默认值 / 类型 | 规则 | 显示条件 / 提交 |
|---|---|---|---|---|---|---|---|---|
| 1 | `invite_force` | Switch | 开启强制邀请 | — | 开启后只有被邀请的用户才可以进行注册。 | `false` | 无 | 布尔 |
| 2 | `invite_commission` | 输入框 | 邀请佣金百分比 | 请输入佣金百分比 | 默认全局的佣金分配比例，你可以在用户管理单独配置单个比例。 | `10`（%） | `integer\|nullable` | 官方提交字符串；清空 = 恢复默认 10 |
| 3 | `invite_gen_limit` | 输入框 | 用户可创建邀请码上限 | 请输入创建上限 | 用户可创建邀请码上限 | `5` | `integer\|nullable` | 同上；清空 = 恢复 5 |
| 4 | `invite_never_expire` | Switch | 邀请码永不失效 | — | 开启后邀请码被使用后将不会失效，否则使用过后即失效。 | `false` | 无 | 布尔 |
| 5 | `commission_first_time_enable` | Switch | 佣金仅首次发放 | — | 开启后被邀请人首次支付时才会产生佣金，可以在用户管理对用户进行单独配置。 | `true` | 无 | 布尔 |
| 6 | `commission_auto_check_enable` | Switch | 佣金自动确认 | — | 开启后佣金将会在订单完成3日后自动进行确认。 | `true` | 无 | 布尔 |
| 7 | `commission_withdraw_limit` | 输入框 | 提现单申请门槛(元) | 请输入提现门槛 | 小于门槛金额的提现单将不会被提交。 | `100`（单位**元**，后端与 `commission_balance/100` 比较；**不要做元转分**） | `nullable\|numeric` | 字符串/数字 |
| 8 | `commission_withdraw_method` | 输入框（单行） | 提现方式 | 请输入提现方式，多个用逗号分隔 | 可以支持的提现方式，多个用逗号分隔。 | `["支付宝","USDT","Paypal"]` / array | `nullable\|array` | 显示 `join(",")`；输入 `split(",").filter(Boolean)`（官方不 trim）；提交数组。建议 trim + 去空；空数组会导致用户无提现方式可选（见 7.3） |
| 9 | `withdraw_close_enable` | Switch | 关闭提现 | — | 关闭后将禁止用户申请提现，且邀请佣金将会直接进入用户余额。 | `false` | 无 | 布尔 |
| 10 | `commission_distribution_enable` | Switch | 三级分销 | — | 开启后将佣金将按照设置的3成比例进行分成，三成比例合计请不要大于100%。 | `false` | 无 | 布尔 |
| 11 | `commission_distribution_l1` | 数字输入 | 一级邀请人比例 | 请输入比例，如：50 | — | `null`（未设置）/ number\|null | `nullable\|numeric` | 仅 `commission_distribution_enable` 为真时显示；官方输入空时提交 `0`，否则 `Number(value)` |
| 12 | `commission_distribution_l2` | 数字输入 | 二级邀请人比例 | 请输入比例，如：50 | — | `null` | `nullable\|numeric` | 同上 |
| 13 | `commission_distribution_l3` | 数字输入 | 三级邀请人比例 | 请输入比例，如：50 | — | `null` | `nullable\|numeric` | 同上 |

- 建议新实现：l1+l2+l3 > 100 时前端警告（说明文字已要求“三成比例合计请不要大于100%”，后端不校验）。
- 保存中提示：`保存中...`（`invite.saving`）。

### 4.5 节点配置（`/config/system/server`，group `server`）

- 读取：`config/fetch?key=server`；官方同时读 `config/fetch?key=site` 想取 `site.site_url`（**该字段不存在**，恒为空，见 7.1）。提交：整组原样。
- 字段（显示顺序）：

| # | key | 控件 | 标签 | placeholder | 说明文字 | 默认值 / 类型 | 规则 | 显示条件 / 提交 |
|---|---|---|---|---|---|---|---|---|
| 1 | `server_token` | 输入框 + 右侧“生成”图标按钮（tooltip `点击生成随机通信密钥`） | 通讯密钥 | 请输入通讯密钥 | Xboard与节点通讯的密钥，以便数据不会被他人获取。 | `null` / string（**敏感**） | `nullable\|min:16`，文案 `通讯密钥长度必须大于16位` | 生成规则：长度 16–32 随机，字符集 `A-Za-z0-9`。危险，见 7.3；建议生成结果至少包含一个字母（见 7.4） |
| 2 | `server_pull_interval` | 数字输入 | 节点拉取动作轮询间隔 | 请输入拉取间隔 | 节点从面板获取数据的间隔频率。 | `60`（秒） | `integer`（null 会 422） | 官方输入空时设为 null |
| 3 | `server_push_interval` | 数字输入 | 节点推送动作轮询间隔 | 请输入推送间隔 | 节点推送数据到面板的间隔频率。 | `60`（秒） | `integer` | 同上 |
| 4 | `server_ws_enable` | Switch（带边框的卡片行） | 启用 WebSocket 通信 | — | 开启后节点将通过 WebSocket 与面板进行实时通信，延迟更低、推送更及时。 | `true` | `boolean` | 布尔 |
| 5 | `server_ws_url` | 输入框 | WebSocket 地址 | `留空则使用站点网址`（官方本想用 site_url 作为 placeholder） | 节点连接面板的 WebSocket 地址，留空则自动使用站点网址。 | `""` | `nullable\|url` | **仅 `server_ws_enable` 为真时显示**。后端握手时：非空则去尾 `/` 直接下发；为空则下发 `ws(s)://<请求 Host>/ws`（不是 app_url，见 7.1）。建议 placeholder 写 `ws(s)://<当前域名>/ws` |
| — | 信息条（蓝色） | — | — | — | `目前支持 WebSocket 通信的节点端：Xboard Node` | — | — | 始终显示 |
| — | `device_limit_mode` | **官方未渲染** | 设备限制模式（locale 有：`server.device_limit_mode.title`） | 请选择设备限制模式 | 宽松模式下，同一IP地址使用多个节点只统计为一个设备。 | `0` / int | `integer` | locale 选项：严格模式 / 宽松模式；推断 `0`=严格、`1`=宽松（与 `public/assets/admin-v2` 旧独立后台一致）。**当前仓库后端没有任何代码读取该设置**。官方随整组回传原值；建议新实现渲染但标注“当前后端未使用” |

- 保存中提示：`保存中...`（`server.saving`）。

### 4.6 邮件设置（`/config/system/email`）

页面头部：`邮件设置` / `配置系统邮件服务，用于发送验证码、密码重置、通知等邮件，支持多种SMTP服务商。`，下方两个子 Tab：`基本设置`（默认）、`模板管理`。

#### 4.6.1 基本设置（group `email`）

- 读取：`config/fetch?key=email`。提交：整组原样（自动保存）。
- 字段（显示顺序）：

| # | key | 控件 | 标签 | placeholder | 说明文字 | 默认值 / 类型 | 规则 | 提交 |
|---|---|---|---|---|---|---|---|---|
| 1 | `email_host` | 输入框 | SMTP主机 | 请输入 | SMTP服务器地址，例如：smtp.gmail.com | `null` | 无 | 字符串。为空时系统改用 `.env` 的 `MAIL_*` |
| 2 | `email_port` | 数字输入 | SMTP端口 | 请输入 | SMTP服务器端口，常用端口：25, 465, 587 | `null` / int | 无 | 空→null，否则 Number |
| 3 | `email_encryption` | 下拉（placeholder `请选择加密方式`） | 加密方式 | — | 邮件加密方式 | `null` | 无 | 选项：`none`→`无`（提交时转成 `""`）、`ssl`→`SSL/TLS`、`tls`→`STARTTLS`；值为空/null 时显示为 `none`。注意“无”会被存为 null，发信时回落到 `.env` 的 `MAIL_ENCRYPTION`（默认 `tls`），见 7.1 |
| 4 | `email_username` | 输入框（autocomplete off） | SMTP用户名 | 请输入 | SMTP认证用户名 | `null` | 无 | 字符串 |
| 5 | `email_password` | 密码输入框（autocomplete off） | SMTP密码 | 请输入 | SMTP认证密码或应用专用密码 | `null`（**敏感**） | 无 | 字符串（会被 trim） |
| 6 | `email_from_address` | 输入框 | 发件人地址 | 请输入 | 发件人邮箱地址 | `null` | 无（官方 zod 要求 email 格式但不拦截保存） | 字符串。建议前端校验邮箱格式 |
| 7 | `remind_mail_enable` | Switch | 邮件提醒 | — | 开启后用户订阅即将到期或流量不足时会收到邮件通知。 | `false` | 无 | 布尔 |
| 8 | 按钮 | — | `发送测试邮件`（发送中 `发送中...`，期间 disabled + loading） | — | — | — | — | 调用 `POST config/testSendMail`（无参数） |

- locale 中的 `email_from_name`（发件人名称）与 `email_template`（邮件模板）**没有对应可保存的配置**（发件人名称固定取 `app_name`），不要实现。
- 保存中提示：官方用了不存在的 key `saving`，新实现显示 `保存中...`。
- 建议：点击“发送测试邮件”前先确保未保存的修改已保存成功（测试使用库中配置）。

#### 4.6.2 测试邮件交互

- 点击按钮 → 清空上次结果 → 请求。成功返回后：
  - `data.error` 为空 → toast `测试邮件发送成功`；否则 toast `测试邮件发送失败`。
  - 打开结果弹窗（无论成功失败）。

#### 4.6.3 测试结果弹窗（Dialog，宽 425px）

- 标题行：成功显示绿色对勾图标 + `邮件发送成功`；失败显示红色图标 + `邮件发送失败`。
- 描述：成功 `测试邮件已成功发送，请检查收件箱`；失败 `发送测试邮件时遇到错误`。
- `发送详情`（两列网格，左列标签 100px）：
  - `收件地址` → `data.email`
  - `邮件主题` → `data.subject`
  - `模板名称` → `data.template_name`
- 失败时 `错误信息`（红色块，`break-all`）→ `data.error`。
- `配置信息`（滚动区，高 200px）：
  - `驱动` → `config.driver`
  - `服务器` → `config.host`
  - `端口` → `config.port`
  - `加密方式` → `config.encryption || "无"`
  - `发件人` → 有 `config.from.address` 时显示 `address` + （有 name 时）` (name)`；否则 `未设置`
  - `用户名` → `config.username || "未设置"`
  - **不显示 `config.password`**（新实现同样不能显示、不能写入日志/状态持久化）。
- 关闭：右上角关闭或点遮罩。

#### 4.6.4 模板管理子 Tab（邮件模板编辑器）

- 数据：
  - `GET mail/template/list`（query key `["mail-template","list"]`），加载中整块显示 `common.loading`（新实现用“加载中...”）。
  - `GET config/fetch?key=site` 取 `app_url` 用于预览样例。
  - 当前选中模板 `GET mail/template/get?name=<name>`（query key `["mail-template","detail",name]`），首次加载列表后默认选中第一个（`verify`）。
- 顶部：模板 Tabs，每个 Tab 文字 = `label`，若 `customized` 则追加灰色小徽标 `已自定义`。
- 草稿状态：每个模板维护 `{subject, content, dirty}`，首次拿到详情时初始化（同一会话只初始化一次，保存/恢复默认后重新初始化）。
- 切换 Tab：
  - 当前模板无未保存修改 → 直接切换（草稿保留）。
  - 有未保存修改 → 弹 AlertDialog：标题 `未保存的修改`，描述 `当前模板有未保存的修改，切换标签页将丢失这些修改。`，按钮 `取消`（留在当前）/ `丢弃修改`（丢弃当前模板草稿并切换）。
- 编辑区（选中模板）：
  1. 灰色提示框：`修改并保存后将覆盖系统默认模板。点击「恢复默认」可随时还原为当前主题的默认模板。`
  2. `邮件主题`：单行输入，placeholder `输入邮件主题，支持 {{name}} 等占位符`。
  3. `可用占位符` 表格，列：`变量` / `说明` / `示例值` / （操作）。行 = `required_vars` + `optional_vars`：
     - 变量列显示 `{{var}}`（等宽），必填变量追加红色徽标 `必填`。
     - 说明 / 示例值取前端内置映射：

       | var | 说明 | 示例值 |
       |---|---|---|
       | `name` | 站点名称 | `XBoard`（固定字面量） |
       | `url` | 站点网址 | `app_url`，为空时 `https://example.com` |
       | `code` | 验证码 | `123456` |
       | `content` | 通知正文 | `这是一封测试通知邮件。` |
       | `link` | 登录链接 | `<url>/login?token=test` |

       不在映射中的变量：说明显示变量名，示例显示 `-`。
     - 操作列：可点击徽标 `插入` → 在编辑器光标处插入 `{{var}}`（无编辑器实例时追加到内容末尾），并把草稿标记为 dirty。
  4. 左右两栏（大屏两列，小屏一列）：
     - 左：`模板内容 (HTML)`，Monaco 编辑器：高 450px、语言 `html`、关闭 minimap、字号 13、自动换行、不允许滚过末行、自适应布局、显示行号。
     - 右：`实时预览`，白底 iframe（高 450px，`sandbox="allow-same-origin"`，即禁止脚本），`srcdoc` = 用示例值替换 `subject` 与 `content` 中全部 `{{var}}` 后套壳：
       `<!DOCTYPE html><html><head><meta charset="utf-8"><title>{替换后主题}</title><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;}</style></head><body>{替换后内容}</body></html>`
       （预览只做字面 `{{var}}` 替换，不处理 `{{ var }}` 与 `{{var|默认}}` 写法，后端发送时会处理。）
  5. 操作栏：
     - `保存`（主按钮，未修改时 disabled，保存中 loading）→ `POST mail/template/save {name, subject, content}` → 成功：dirty 置 false、刷新 list 与 detail、toast `模板保存成功`；失败由拦截器 toast（如 `缺少必要占位符: {{code}}`）。
     - `发送测试`（描边按钮，**有未保存修改时 disabled**，title 提示 `请先保存修改后再发送测试`，发送中 loading）→ 打开测试弹窗。
     - `恢复默认`（红色按钮，**仅 `customized` 为真时显示**）→ 打开恢复确认弹窗。
     - 有未保存修改时显示琥珀色圆点 + `有未保存的修改`。
- 恢复默认确认（AlertDialog）：标题 `恢复默认模板`，描述 `确定要恢复此模板为默认内容吗？自定义的内容将被删除。`，按钮 `取消` / `确定恢复` → `POST mail/template/reset {name}` → 成功：清草稿、刷新 list/detail、toast `已恢复默认模板`，关闭弹窗。
- 发送测试弹窗（AlertDialog）：标题 `发送测试邮件`，描述 `输入收件邮箱，留空将发送到当前管理员邮箱`，输入框（type=email，placeholder `收件邮箱（留空使用当前账号）`），按钮 `取消` / `发送测试`（发送中显示 `发送中...` 且 disabled）→ `POST mail/template/test {name, email}`（输入为空时不带 email 字段）→ 成功 toast `测试邮件已发送` 并关闭；失败由拦截器 toast `发送失败: ...`，弹窗保持打开。官方不校验邮箱格式，建议新实现校验。
- 新实现编辑器选择：官方用 Monaco（`@monaco-editor/react`）。新项目若引入 Monaco / CodeMirror 属于新增外部依赖，需主会话确认；最低可用替代是等宽 `textarea`。

### 4.7 Telegram设置（`/config/system/telegram`，group `telegram`）

- 读取：`config/fetch?key=telegram`。提交：整组原样（自动保存）。
- 字段（显示顺序）：

| # | key | 控件 | 标签 | placeholder | 说明文字 | 默认值 / 类型 | 规则 | 显示条件 / 提交 |
|---|---|---|---|---|---|---|---|---|
| 1 | `telegram_bot_token` | 输入框 | 机器人令牌 | 0000000000:xxxxxxxxx_xxxxxxxxxxxxxxx | 请输入从Botfather获取的令牌。 | `null`（**敏感**） | 无 | 字符串 |
| 2 | `telegram_webhook_url` | 输入框 + 右侧按钮 `一键设置`（进行中 `设置中...`，loading+disabled） | Webhook Base URL | https://example.com | `这里只填写基础地址，系统会自动拼接 Telegram 的完整 Webhook 回调路径。留空时默认使用站点网址。` + 空格 + 目标提示；下方链接 `查看 Telegram Webhook 文档`（`https://core.telegram.org/bots/webhooks`，新窗口） | `null` | `nullable\|url`，`Telegram Webhook地址格式不正确，必须携带http(s)://` | **仅当 `telegram_bot_token` 非空时显示**。目标提示：输入值 trim 后非空 → `当前将使用自定义 Webhook Base URL：{url}`；否则 `当前将使用站点网址作为 Webhook Base URL。` |
| 3 | `telegram_bot_enable` | Switch | 启用Telegram绑定引导 | — | 开启后将在用户端显示Telegram绑定引导，帮助用户绑定Telegram账户以接收通知。 | `false` | 无 | 布尔 |
| 4 | `telegram_discuss_link` | 输入框 | 群组链接 | https://t.me/xxxxxx | 填写后将在用户端显示或在需要的地方使用。 | `null` | `nullable\|url`，`Telegram群组地址必须为URL格式，必须携带http(s)://` | 字符串 |

- `一键设置` → `POST config/setTelegramWebhook`（无参数）→ 成功 toast 标题 `Webhook 设置成功`，描述为两个块（持续 6 s）：
  - `Webhook 地址`：`data.webhook_url`（等宽、可换行）
  - `基础地址`：`data.webhook_base_url`
  失败由拦截器 toast（`Telegram Webhook地址未配置` 或 `Telegram 服务错误: ...`）。
- 建议新实现：
  - 使用 `safe=1` 读取时 token 为 null，无法据此判断是否已配置，`telegram_webhook_url` 行应始终显示（或在 token 字段显示“已设置/未设置”需后端支持，见 7.2）。
  - 点击 `一键设置` 前先把待保存的修改（尤其 token、webhook_url）同步保存成功，否则后端使用旧 token / 旧地址（官方有 1 s 防抖竞态）。
  - 建议在 webhook 结果中提供复制按钮。
- 保存中提示：`保存中...`。

### 4.8 APP设置（`/config/system/app`，group `app`）

- 读取：`config/fetch?key=app`。提交：整组原样（自动保存）；官方成功 toast 用了不存在的 key `app.save_success`（会显示 key 原文），新实现用 `已自动保存`/`保存成功`。
- 字段（显示顺序，全部为输入框，placeholder `请输入`，后端无校验，默认 `""`）：

| # | key | 标签 | 说明文字 |
|---|---|---|---|
| 1 | `windows_version` | Windows版本 | Windows客户端当前版本号 |
| 2 | `windows_download_url` | Windows下载地址 | Windows客户端下载链接 |
| 3 | `macos_version` | macOS版本 | macOS客户端当前版本号 |
| 4 | `macos_download_url` | macOS下载地址 | macOS客户端下载链接 |
| 5 | `android_version` | Android版本 | Android客户端当前版本号 |
| 6 | `android_download_url` | Android下载地址 | Android客户端下载链接 |

- 建议：下载地址前端做 URL 格式提示（后端不校验）。

### 4.9 订阅模板（`/config/system/subscribe-template`，group `subscribe_template`）

- 页面头部：`订阅模板` / `配置各个客户端的订阅模板`。
- 读取：`config/fetch?key=subscribe_template`（官方 query key `["settings","client"]`），加载中整块显示 loading。只接受字符串值，非字符串按空串处理。
- 子 Tabs（顺序、label、编辑器语言、表单 key、后端模板 name、标题 / 说明）：

| Tab | label | 编辑器语言 | 配置 key | 存储 name | 标题 | 说明 |
|---|---|---|---|---|---|---|
| 1（默认） | Sing-box | `json` | `subscribe_template_singbox` | `singbox` | Sing-box 订阅模板 | 配置 Sing-box 的订阅模板格式 |
| 2 | Clash | `yaml` | `subscribe_template_clash` | `clash` | Clash 订阅模板 | 配置 Clash 的订阅模板格式 |
| 3 | Clash Meta | `yaml` | `subscribe_template_clashmeta` | `clashmeta` | Clash Meta 订阅模板 | 配置 Clash Meta 的订阅模板格式 |
| 4 | Stash | `yaml` | `subscribe_template_stash` | `stash` | Stash 订阅模板 | 配置 Stash 的订阅模板格式 |
| 5 | Surge | `ini` | `subscribe_template_surge` | `surge` | Surge 配置模板 | 配置 Surge 订阅模板，支持 Surge 配置文件格式 |
| 6 | Surfboard | `ini` | `subscribe_template_surfboard` | `surfboard` | Surfboard 配置模版 | 配额 Surfboard 订阅模版（原文如此） |

- 每个 Tab：标题（text-base）+ Monaco 编辑器（高 500px，关闭 minimap，字号 14，自动换行，不滚过末行，自适应）+ 说明文字。
- 读取格式：`subscribe_template_singbox` 由后端格式化为带缩进的 JSON 文本（`JSON_PRETTY_PRINT|UNESCAPED_UNICODE|UNESCAPED_SLASHES`；非合法 JSON 时原样返回）；其余为库中原文。库中无记录时为 `""`。
- 保存：任一编辑器变化 → 防抖 1500 ms → **6 个模板整组**提交 `config/save`（值为字符串）。成功 toast `已自动保存`；失败 toast `common.saveFailed`（locale 缺失，会显示 key 原文）。保存中显示蓝色闪烁圆点 + `保存中...`。
- 后端：`SubscribeTemplate::setContent(name, content)`，清 Redis 缓存后立即对所有用户的订阅生效。**后端没有“为空时回落内置默认模板”的逻辑**（`Clash` 直接 `Yaml::parse`，`SingBox` 直接 `json_decode`），内置默认模板只在迁移 `2025_07_27_000001_create_v2_subscribe_templates_table.php` 时从 `resources/rules/*.yaml|json|conf` 导入一次，**没有“恢复默认”接口**。
- 模板内特殊占位：Surge / Surfboard 模板中的 `$subs_link` 会被替换为用户订阅链接（`app/Protocols/Surge.php` 等）；其余协议模板内的占位规则以各 `app/Protocols/*.php` 为准。
- 建议新实现：改为显式“保存当前模板”按钮，只提交当前 Tab 的一个 key；保存前做语法校验（Sing-box `JSON.parse`；Clash/Clash Meta/Stash 需 YAML 解析库，属新增依赖需确认；Surge/Surfboard 至少非空），拒绝保存空内容；离开有未保存修改的 Tab 时提示。理由见 7.3。

### 4.10 个性化设置（`/config/system/frontend`，group `frontend`，官方隐藏页）

- 官方导航未列出，仅能手输 URL 进入。页面标题与文案为硬编码中文：`个性化设置` / `自定义系统界面外观，包括主题风格、布局、颜色方案、背景图等个性化选项。`
- 读取：`config/fetch?key=frontend`（返回 `frontend_theme` 默认 `"Xboard"`、`frontend_theme_sidebar` 默认 `"light"`、`frontend_theme_header` 默认 `"dark"`、`frontend_theme_color` 默认 `"default"`、`frontend_background_url` 默认 `null`）。
- 官方字段（显式提交，按钮 `保存设置`，成功 toast `更新成功`）：

| key | 控件 | 标签 | 说明 | 后端规则 |
|---|---|---|---|---|
| `frontend_theme_sidebar` | Switch（checked = 值是否为真） | 边栏风格 | 边栏风格 | `nullable\|in:dark,light` |
| `frontend_theme_header` | Switch | 头部风格 | 边栏风格（原文如此） | `nullable\|in:dark,light` |
| `frontend_theme_color` | 原生 select | 主题色 | 主题色 | `nullable\|in:default,darkblue,black,green`；官方选项为 `default`→默认、`black`→黑色、`blackblue`→暗蓝色、`green`→奶绿色 |
| `frontend_background_url` | 输入框，placeholder `请输入图片地址` | 背景 | 将会在后台登录页面进行展示。 | `nullable\|url` |

- 该页实际不可用：Switch 会把值改成布尔导致 `in:dark,light` 校验失败；`blackblue` 不在后端允许列表；zod 要求背景为合法 URL，空串无法提交；整组提交还会带上 `frontend_theme` 触发一次主题复制。这些 key 目前**只被旧版后台视图变量引用**（`routes/web.php` 传给 `admin` 视图，但 `resources/views/admin.blade.php` 未使用），对当前系统无可见效果。
- 建议：新实现**不实现此页**（或仅只读展示），在差异文档中注明。若要实现，必须用 `light/dark` 下拉、颜色选项改为 `darkblue`、只提交修改字段且不带 `frontend_theme`。

### 4.11 主题切换对本域接口的使用（跨域说明）

- 主题配置页（`/config/theme`，另一功能域）通过 `POST config/save {"frontend_theme":"<主题名>"}` 切换前台主题，成功 toast `主题切换成功` 并刷新主题列表。
- 后端副作用见 1.3：`ThemeService::switch` 复制主题文件、清理旧主题公共目录、写 `current_theme`；主题不存在 → 500。
- 本域任何表单都**不要**提交 `frontend_theme`。

---

## 5. 加载、空状态与联动刷新汇总

| 场景 | 官方行为 | 新实现要求 |
|---|---|---|
| 各配置 Tab 首次加载 | 表单先显示 zod 默认值，数据到达后逐项 `setValue`；safe/invite 在数据到达前禁止自动保存 | 数据到达前显示骨架/禁用表单，**禁止任何保存**，避免默认值覆盖真实配置 |
| fetch 失败 | 拦截器 toast，表单保持默认值（存在自动保存把默认值写回的风险，site/subscribe/server/email/telegram/app 无加载闸门） | 显示错误态 + 重试按钮，不渲染可编辑表单 |
| 保存中 | 灰字 `保存中...` | 同；按钮 loading |
| 保存成功 | toast `已自动保存`，更新快照 | 同；更新本地“原始值”以便 dirty 计算 |
| 422 | toast 后端 message | 字段下方显示 `errors[field][0]`，并 toast 汇总 |
| 邮件模板保存/恢复 | 刷新 `mail/template/list` 与该模板 detail | 同（“已自定义”徽标随之变化） |
| 站点 `app_url` 变化 | 邮件模板预览样例 url 依赖 `config/fetch?key=site` 的缓存（query key `["settings","site"]`） | 保存 site 后使 site 查询失效 |
| 套餐增删 | 注册试用下拉依赖 `["plans"]` 查询 | 进入站点设置时重新拉取 `plan/fetch` |

---

## 6. `ConfigSave` 规则全文对照表

列：key / 规则 / 自定义错误文案 / fetch 分组 / 官方 UI 是否渲染 / 语义与后端消费方。

| key | 规则 | 自定义文案 | 分组 | 官方渲染 | 语义 / 备注 |
|---|---|---|---|---|---|
| `invite_force` | （无） | — | invite | 是 | 仅受邀可注册 |
| `invite_commission` | `integer\|nullable` | — | invite | 是 | 全局佣金比例 %，默认 10 |
| `invite_gen_limit` | `integer\|nullable` | — | invite | 是 | 用户未使用邀请码上限，默认 5 |
| `invite_never_expire` | （无） | — | invite | 是 | 邀请码使用后不失效 |
| `commission_first_time_enable` | （无） | — | invite | 是 | 默认 true |
| `commission_auto_check_enable` | （无） | — | invite | 是 | `CheckCommission` 命令消费，默认 true |
| `commission_withdraw_limit` | `nullable\|numeric` | — | invite | 是 | 单位元，默认 100 |
| `commission_withdraw_method` | `nullable\|array` | — | invite | 是 | 字符串数组 |
| `withdraw_close_enable` | （无） | — | invite | 是 | 关闭提现，佣金直接入余额 |
| `commission_distribution_enable` | （无） | — | invite | 是 | 三级分销开关 |
| `commission_distribution_l1` | `nullable\|numeric` | — | invite | 是（条件） | % |
| `commission_distribution_l2` | `nullable\|numeric` | — | invite | 是（条件） | % |
| `commission_distribution_l3` | `nullable\|numeric` | — | invite | 是（条件） | % |
| `logo` | `nullable\|url` | `LOGO URL格式不正确，必须携带https(s)://` | site | 是 | |
| `force_https` | （无） | — | site | 是 | `ApplyRuntimeSettings` 中间件消费 |
| `stop_register` | （无） | — | site | 是 | |
| `app_name` | （无） | — | site | 是 | 也用作邮件发件人名称 |
| `app_description` | （无） | — | site | 是 | |
| `app_url` | `nullable\|url` | `站点URL格式不正确，必须携带http(s)://` | site | 是 | 安全模式、Webhook、邮件链接依赖 |
| `subscribe_url` | `nullable` | （`subscribe_url.url` 文案存在但不会触发） | site | 是 | 逗号分隔多地址 |
| `try_out_enable` | （无） | — | — | 否 | **fetch 不返回、后端无消费方**，可忽略 |
| `try_out_plan_id` | `integer` | — | site | 是 | 0=关闭 |
| `try_out_hour` | `numeric` | — | site | 是（条件） | 小时 |
| `tos_url` | `nullable\|url` | `服务条款URL格式不正确，必须携带http(s)://` | site | 是 | |
| `currency` | （无） | — | site | 是 | |
| `currency_symbol` | （无） | — | site | 是 | |
| `ticket_must_wait_reply` | （无） | — | site | 是 | |
| `plan_change_enable` | （无） | — | subscribe | 是 | |
| `reset_traffic_method` | `in:0,1,2,3,4` | — | subscribe | 是 | 见 4.3 |
| `surplus_enable` | （无） | — | subscribe | 是 | |
| `new_order_event_id` | （无） | — | subscribe | 是 | 0/1 |
| `renew_order_event_id` | （无） | — | subscribe | 是 | 0/1 |
| `change_order_event_id` | （无） | — | subscribe | 是 | 0/1 |
| `show_info_to_server_enable` | （无） | — | subscribe | 是 | |
| `show_protocol_to_server_enable` | （无） | — | subscribe | 是 | |
| `subscribe_path` | （无） | — | subscribe | 是 | 路由前缀，见 7.3 |
| `server_token` | `nullable\|min:16` | `通讯密钥长度必须大于16位` | server | 是 | 节点鉴权（严格 `!==` 比较） |
| `server_pull_interval` | `integer` | — | server | 是 | 秒 |
| `server_push_interval` | `integer` | — | server | 是 | 秒 |
| `device_limit_mode` | `integer` | — | server | **否** | 后端无消费方 |
| `server_ws_enable` | `boolean` | — | server | 是 | 节点握手是否下发 ws |
| `server_ws_url` | `nullable\|url` | — | server | 是（条件） | |
| `frontend_theme` | （无） | — | frontend | 主题页 | 触发 `ThemeService::switch` |
| `frontend_theme_sidebar` | `nullable\|in:dark,light` | — | frontend | 隐藏页 | 遗留，无效果 |
| `frontend_theme_header` | `nullable\|in:dark,light` | — | frontend | 隐藏页 | 遗留，无效果 |
| `frontend_theme_color` | `nullable\|in:default,darkblue,black,green` | — | frontend | 隐藏页 | 遗留，无效果 |
| `frontend_background_url` | `nullable\|url` | — | frontend | 隐藏页 | 遗留，无效果 |
| `email_host` | （无） | — | email | 是 | 非空才覆盖 `.env` 邮件配置 |
| `email_port` | （无） | — | email | 是 | |
| `email_username` | （无） | — | email | 是 | |
| `email_password` | （无） | — | email | 是 | 敏感 |
| `email_encryption` | （无） | — | email | 是 | `ssl`/`tls`/null |
| `email_from_address` | （无） | — | email | 是 | |
| `remind_mail_enable` | （无） | — | email | 是 | |
| `telegram_bot_enable` | （无） | — | telegram | 是 | |
| `telegram_bot_token` | （无） | — | telegram | 是 | 敏感 |
| `telegram_webhook_url` | `nullable\|url` | `Telegram Webhook地址格式不正确，必须携带http(s)://` | telegram | 是（条件） | 基础地址 |
| `telegram_discuss_id` | （无） | — | — | 否 | fetch 不返回、无消费方 |
| `telegram_channel_id` | （无） | — | — | 否 | fetch 不返回、无消费方 |
| `telegram_discuss_link` | `nullable\|url` | `Telegram群组地址必须为URL格式，必须携带http(s)://` | telegram | 是 | |
| `windows_version` | （无） | — | app | 是 | |
| `windows_download_url` | （无） | — | app | 是 | |
| `macos_version` | （无） | — | app | 是 | |
| `macos_download_url` | （无） | — | app | 是 | |
| `android_version` | （无） | — | app | 是 | |
| `android_download_url` | （无） | — | app | 是 | |
| `email_whitelist_enable` | `boolean` | — | safe | 是 | |
| `email_whitelist_suffix` | `nullable\|array` | — | safe | 是（条件） | |
| `email_gmail_limit_enable` | `boolean` | — | safe | 是 | |
| `captcha_enable` | `boolean` | — | safe | 是 | |
| `captcha_type` | `in:recaptcha,turnstile,recaptcha-v3` | `人机验证类型只能选择 recaptcha、turnstile 或 recaptcha-v3` | safe | 是（条件） | |
| `recaptcha_enable` | `boolean` | — | safe | 否（随整组回传） | 兼容字段，读取值等于 `captcha_enable`，写入无消费方 |
| `recaptcha_key` | （无） | — | safe | 是（条件） | 敏感 |
| `recaptcha_site_key` | （无） | — | safe | 是（条件） | |
| `recaptcha_v3_secret_key` | （无） | — | safe | 是（条件） | 敏感 |
| `recaptcha_v3_site_key` | （无） | — | safe | 是（条件） | |
| `recaptcha_v3_score_threshold` | `numeric\|min:0\|max:1` | `reCAPTCHA v3 分数阈值必须为数字` / `不能小于0` / `不能大于1` | safe | 是（条件） | |
| `turnstile_secret_key` | （无） | — | safe | 是（条件） | 敏感 |
| `turnstile_site_key` | （无） | — | safe | 是（条件） | |
| `email_verify` | `bool` | — | safe | 是 | |
| `safe_mode_enable` | `boolean` | — | safe | 是 | |
| `register_limit_by_ip_enable` | `boolean` | — | safe | 是 | |
| `register_limit_count` | `integer` | — | safe | 是（条件） | |
| `register_limit_expire` | `integer` | — | safe | 是（条件） | 分钟 |
| `secure_path` | `min:8\|regex:/^[\w-]*$/` | `后台路径长度最小为8位` / `后台路径只能为字母或数字` | safe | 是 | 路由前缀，见 7.3 |
| `password_limit_enable` | `boolean` | — | safe | 是 | |
| `password_limit_count` | `integer` | — | safe | 是（条件） | |
| `password_limit_expire` | `integer` | — | safe | 是（条件） | 分钟 |
| `default_remind_expire` | `boolean` | — | subscribe | **否** | 新用户默认到期提醒 |
| `default_remind_traffic` | `boolean` | — | subscribe | **否** | 新用户默认流量提醒 |
| `subscribe_template_singbox` | `nullable` | — | subscribe_template | 是 | 写 `v2_subscribe_templates` |
| `subscribe_template_clash` | `nullable` | — | subscribe_template | 是 | 同上 |
| `subscribe_template_clashmeta` | `nullable` | — | subscribe_template | 是 | 同上 |
| `subscribe_template_stash` | `nullable` | — | subscribe_template | 是 | 同上 |
| `subscribe_template_surge` | `nullable` | — | subscribe_template | 是 | 同上 |
| `subscribe_template_surfboard` | `nullable` | — | subscribe_template | 是 | 同上 |

规则要点：
- 规则为空的 key 不校验类型；规则非 `nullable` 且非空的 key（`try_out_plan_id`、`try_out_hour`、`reset_traffic_method`、`server_pull_interval`、`server_push_interval`、`device_limit_mode`、所有 `boolean`、`captcha_type`、`recaptcha_v3_score_threshold`、`register_limit_*`、`password_limit_*`、`secure_path`）**提交空值（null/""）会 422**，前端要么不提交、要么必填校验。
- fetch 返回但不在规则中的 key：无（`recaptcha_enable` 在规则中）。

---

## 7. 差异与风险

### 7.1 官方 UI 与后端不一致 / 官方 UI 自身缺陷（新实现应修正）

1. 节点配置页读 `site.site_url`，但 site 分组字段名是 `app_url` → WebSocket 地址 placeholder 和“空值自动填充”从不生效。且后端 ws 地址为空时下发的是 `ws(s)://<请求 Host>/ws`，不是“站点网址”，说明文字不准确。新实现不要自动填充 http 地址到 ws 字段。
2. `device_limit_mode`、`default_remind_expire`、`default_remind_traffic` 后端支持保存，官方 UI 不渲染。
3. `email_encryption` 选“无”会存 null，`MailService` 用 `admin_setting('email_encryption', config('mail.encryption'))` 回落到 `.env` 的 `MAIL_ENCRYPTION`（默认 `tls`），“无加密”可能并不生效。新实现应在说明中提示，或经主会话同意后改后端。
4. `try_out_hour` 允许小数且后端按小数计算，但 fetch `(int)` 截断显示。
5. `subscribe_url.url` 错误文案存在但规则无 `url`；`secure_path.regex` 文案说“只能为字母或数字”，实际还允许 `_`、`-`；`logo.url` 文案写成 `https(s)://`。
6. 若历史数据中 `email_whitelist_suffix` 为逗号分隔字符串，官方页面 `.join` 会报错；后端 `Helper` 兼容字符串。
7. 个性化设置页（frontend）不可用（4.10）。
8. 若干 i18n key 缺失导致显示 key 原文：`site.form.saving`、`safe.form.saving`、邮件页 `saving`、`app.save_success`、订阅模板页 `common.saveFailed`、`common.loading`。
9. 官方自动保存绕过 zod 校验；URL 类字段输入到一半就会触发 422 toast，且该组其他修改一起被拒。
10. locale 中 `email_from_name`、`email_template`、`email_template.placeholder_hint`、`email_template.click_to_insert` 无对应功能。
11. Telegram 页依据 token 是否非空决定显示 webhook 行，若改用 `safe=1` 读取需调整（4.7）。

### 7.2 后端有、官方 UI 未使用的能力

- `GET config/fetch` 的 `safe` 参数（本 fork 新增）与不带 `key` 的全量读取。
- `GET config/getEmailTemplate`（官方定义未调用）、`GET config/getThemeTemplate`（官方未定义）。
- `POST config/save` 的部分提交能力（官方总是整组提交）。
- `ConfigSave` 中的 `try_out_enable`、`telegram_discuss_id`、`telegram_channel_id`（无消费方，不建议暴露）。
- `mail/template/list` 返回的 `subject`、`updated_at`（可在模板 Tab 显示“最后修改时间”）。
- 若新实现需要“密钥是否已设置”的状态（例如 `safe=1` 时显示“已设置”），后端目前不提供，需要新增字段（如 `*_set: bool`）——属于后端改动，需主会话确认。

### 7.3 危险操作与建议确认文案

| 操作 | 后果 | 建议 |
|---|---|---|
| 修改 `secure_path` | 后台与全部管理 API 前缀改变（`AdminRoute`、`/{secure_path}`、`/{secure_path}/next` 都在启动时读取）。php-fpm 下立即生效，当前页面后续请求全部 404；Octane/路由缓存下需重载后生效。官方自动保存可能把“输入到一半”的 8 位前缀保存进去。 | 显式保存 + 确认弹窗：“修改后台路径后，新地址为 `{origin}/{新路径}`，旧地址将失效（Octane 部署需重启后生效）。请先记录新地址。确定修改？”保存成功后提示复制新地址，并提示刷新/跳转 |
| 修改 `subscribe_path` | 所有用户订阅链接路径改变，旧链接失效（重启后），客户端需更新订阅 | 显式保存 + 确认：“修改后所有用户的订阅链接将变化，旧订阅地址将失效，可能需要重启服务生效。” 前端限制 `^[\w-]+$` 且非空 |
| 修改/清空 `server_token` | 所有节点立即鉴权失败直到节点端同步新密钥；清空（null）同样导致失败 | 显式保存 + 确认：“修改通讯密钥后，所有节点需同步更新密钥，否则将断开。”；禁止提交空值（除非用户明确要清空） |
| 开启 `safe_mode_enable` | 非 `app_url` 主机访问用户前台 `/` 返回 403 | 开启前校验 `app_url` 已配置且与当前访问域名一致，否则警告 |
| 开启 `force_https` | 反代/证书配置不当时可能导致重定向或资源加载问题 | 确认提示 |
| 开启 `stop_register` / `invite_force` / 邮箱白名单 / 验证码 | 影响新用户注册；白名单开启且列表为空 → 所有注册被拒；验证码开启但密钥缺失 → 注册失败 | 开启验证码时校验对应 site key / secret 已填；白名单为空时禁止开启或强提示 |
| `commission_withdraw_method` 置空 | 用户无可选提现方式 | 至少保留一项或提示 |
| `reset_traffic_method`、订单事件“重置用户流量” | 影响全体用户流量重置时机 | 修改时提示影响范围 |
| 编辑订阅模板 | 保存即对所有用户订阅生效；空内容或语法错误会使对应客户端订阅生成失败；无恢复默认接口 | 显式保存 + 语法校验 + 禁止保存空内容 + 保存前确认；建议提供“导出当前内容”以便回滚 |
| `一键设置` Telegram Webhook | 覆盖 Bot 在 Telegram 侧的 Webhook 与命令 | 按钮旁说明；执行前确保 token 已保存 |
| 邮件模板“恢复默认” | 删除自定义内容，不可撤销 | 使用官方确认文案 |
| 提交 `frontend_theme` | 触发主题文件复制/清理 | 本域表单永不提交该 key |

### 7.4 安全风险（现状，新实现需规避，后端修改需主会话确认）

1. 官方 UI 读取配置时不带 `safe`，所有密钥（`server_token`、`email_password`、`telegram_bot_token`、各验证码 secret）明文进入浏览器。新实现默认 `safe=1`。
2. `RequestLog` 审计日志只排除顶层名为 `password/token/secret/key/api_key` 的字段，`config/save` 中的 `email_password`、`server_token`、`telegram_bot_token`、`recaptcha_key`、`recaptcha_v3_secret_key`、`turnstile_secret_key` 会明文写入 `admin_audit_logs.request_data`。只提交修改字段可以减少暴露面，但无法根除（需后端改 `SENSITIVE_KEYS` 匹配规则）。
3. `config/testSendMail` 响应包含 `config('mail')` 全量，其中 `password` 为 SMTP 明文密码。新实现不得展示、缓存或上报该字段。（`MailService` 也把同一数组传给 `MailLog::create`，但 `v2_mail_log` 表没有 `config` 列，`MailLog` 为 `$guarded=['id']` 且项目未开启 `preventSilentlyDiscardingAttributes`，按 Laravel 的 guardable-column 检查该字段会被静默丢弃，不落库——推断，未实测。）
4. `setTelegramWebhook` 返回的 `webhook_url` 含 `access_token=md5(bot token)`。
5. `Setting::load` 会对字符串做 `json_decode`：纯数字（且超出整数范围）、`true`/`false`/`null` 形态的字符串会被改变类型或失真；`server_token` 若为纯数字，读取为 int，而节点中间件用 `!==` 与请求中的字符串比较 → 所有节点鉴权失败。新实现生成/校验 `server_token` 时应要求至少包含一个字母；`email_password` 等密钥若可能为纯数字，“只提交修改字段”可避免把失真的值回写。
6. 邮件模板内容为管理员可写 HTML，按原样发送给用户；预览 iframe 必须保持禁用脚本（不给 `allow-scripts`）。

---

## 8. 实现验收清单（建议）

- [ ] 9 个可见 Tab + 邮件模板子 Tab 全部可用；字段、顺序、条件显示与第 4 节一致；补上 `device_limit_mode`、`default_remind_expire`、`default_remind_traffic`。
- [ ] 读取使用 `config/fetch?key=<group>&safe=1`；敏感字段留空不提交，提供按需“显示/复制”（调用不带 safe 的 fetch）。
- [ ] 提交只含已修改字段；数组字段先过滤空串；数字字段空值不提交或前端必填。
- [ ] 422 时字段级错误展示；`fail` 形态与 `testSendMail` 特殊形态都正确处理。
- [ ] 危险项（7.3）有显式保存与确认；`secure_path` 保存成功后引导到新地址。
- [ ] 订阅模板：语法校验、禁止空内容、单模板保存、未保存离开提示。
- [ ] 邮件模板：Tab 切换未保存提示、占位符插入、实时预览（禁脚本）、保存/恢复默认/发送测试流程与文案一致；测试邮箱格式校验。
- [ ] 测试邮件结果弹窗不显示 `config.password`。
- [ ] Telegram `一键设置` 前确保 token / webhook_url 已保存；请求超时放宽。
- [ ] 不提交 `frontend_theme`、`recaptcha_enable`、`try_out_enable`、`telegram_discuss_id`、`telegram_channel_id`。
- [ ] 旧后台 `/{secure_path}` 不受影响（本域不需要任何后端改动即可完成上述功能；7.2/7.4 中的后端改进均为可选项，需另行确认）。
