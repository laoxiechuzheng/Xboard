# admin-next 规格：platform（主题 / 插件 / 插件运行时页面 / 系统运维 / 系统更新）

> 本文件是新后台（`/{secure_path}/next`，Vue 3 + TS + Naive UI）中 platform 功能域的实现依据。官方后台（`/{secure_path}`，`public/assets/admin/`）保持不变，两者共用 `/api/v2/{secure_path}/*`。
> 标注约定：**【官方】** = 官方编译包里的实际行为；**【后端】** = 读 PHP 代码确认的行为；**【推断】** = 依据第三方库源码知识或间接证据推断，未在本机运行验证；**【新UI】** = 对新后台的要求或建议；**【超出官方】** = 官方后台没有的功能，是否做由主会话决定。

## 0. 资料来源与通用约定

### 0.1 资料来源（均已逐一阅读）

| 类别 | 位置 |
|---|---|
| 官方路由表 | `public/assets/admin/assets/index-CEIYH7i8.js` @4401134 起（`HQe` 路由数组，hash 路由） |
| 官方侧边栏 | 同文件 @5093700 起（`Vlt` 静态菜单、`Zlt` 插件菜单构建、`Ult` = `["pluginList"]` 查询） |
| 官方 API 封装 | 同文件 @539321（`BL/VL/WL/HL/zL` 主题接口）、@543167（`kT.getSystemStatus` 等 system 接口）、@543501（`ET` 插件接口与 `crudList/crudSave/crudDelete`） |
| 官方插件管理页 | `g1t`（@5966258）、插件卡片 `u1t`、骨架 `h1t`、配置表单 `bQt`（@5867370）、动态字段渲染器 `IYt` / 取值函数 `RYt`（@5828829 / @5832152） |
| 官方插件演示页 | 菜单演示 `f1t`（@5974633，演示数据 `p1t`）、CRUD 演示 `C1t`（@5986861，schema `b1t`、Schema 表格组件 `v1t`、种子数据 `y1t`） |
| 官方主题页 | `E1t`（@5990642）、主题设置弹窗 `k1t`、字段渲染 `S1t`、骨架 `N1t` |
| 官方插件运行时页 | `r4t`（@6066253）、服务端 CRUD 包装 `i4t` |
| 官方仪表盘队列卡 | `UGt`（@5738500，详见 `core.md` §7.5） |
| 官方确认弹窗 | `hQt`（@5859513） |
| 官方 axios | `TL`（@538130） |
| 中文语言包 | `public/assets/admin/locales/zh-CN.js`：`theme.*`（L3477-3518）、`plugin.*`（L3149-3240）、`dashboard.queue.*`（L3313-3372）、`nav.*`（L740-763）、`common.update.*`（L3101-3111） |
| 后端路由 | `app/Http/Routes/V2/AdminRoute.php`（system L240-249、update 注释 L251-257、theme L260-268、plugin L271-285） |
| 后端控制器 | `app/Http/Controllers/V2/Admin/{ThemeController,PluginController,SystemController,UpdateController,ConfigController}.php` |
| 后端服务 | `app/Services/ThemeService.php`、`app/Services/Plugin/{PluginManager,PluginConfigService,AbstractPlugin,HookManager}.php`、`app/Services/UpdateService.php` |
| 模型/迁移 | `app/Models/{Plugin,AdminAuditLog}.php`、`database/migrations/2025_01_18_140511_create_plugins_table.php`、`2025_07_26_000001_add_type_to_plugins_table.php`、`2026_03_11_000001_replace_v2_log_with_admin_audit_log.php` |
| 中间件 | `app/Http/Middleware/{Admin,RequestLog,InitializePlugins}.php`、`app/Http/Kernel.php` |
| 插件实体 | `plugins-core/{AlipayF2f,Btcpay,CoinPayments,Coinbase,Epay,Mgate,Telegram}/config.json`；`plugins/` 目录只有 `.gitignore` |
| 主题实体 | `theme/Xboard/config.json`、`theme/Xboard/dashboard.blade.php`；用户主题目录 `storage/theme/`（当前为空目录） |
| 其它 | `config/horizon.php`（trim 配置）、`app/Console/Kernel.php`（调度心跳、`horizon:snapshot`）、`app/Console/Commands/ResetLog.php`（审计日志保留期） |
| 新后台现状 | `admin-next/src/router/{index,menu}.ts` 已有 `config/theme`、`config/plugin`、`config/system-status`、`config/audit-log` 四个路由（视图文件目前是占位）；`components/DynamicForm.vue` + `dynamic-form.ts` 已有通用动态表单 |

相关域规格：`core.md`（布局、侧边栏插件菜单构建 §6.2.3、仪表盘队列卡 §7.5、HTTP 约定 §2/§3）、`settings.md`（`config/save` 与 `frontend_theme` 的副作用 §1.3/§4.11）、`commerce.md`（支付插件的“支付配置”页 §4，支付插件本身没有插件配置项）。

### 0.2 请求约定（本域）

- 所有接口前缀 `/api/v2/{secure_path}/`，中间件 `admin` + `log`（见 `core.md` §2、§3.6）。新后台用 `admin-next/src/api/http.ts` 的 `http.get/post/upload`，路径写相对路径（如 `http.get('/theme/getThemes')`）。
- 上传：`multipart/form-data`，**唯一字段名 `file`**（主题与插件相同）；新后台用 `http.upload('/theme/upload', { file })`。
- `log` 中间件：**每个 POST 请求**都写一条审计日志（含失败请求）。`theme/getThemeConfig` 是 POST，所以“打开主题设置弹窗”也会产生审计记录。

### 0.3 响应形态（本域出现 4 种，`http.ts` 返回值随之不同）

| 形态 | 出现的接口 | `http.ts` 的返回值 |
|---|---|---|
| A. `success($data)` → `{status:"success",message:"操作成功",data,error:null}` | theme 全部、`system/getSystemStatus`、`system/getQueueStats`、`system/getQueueWorkload` | 自动解包为 `data` |
| B. `response()->json(['data'=>...])`（无 status） | `plugin/types`、`plugin/getPlugins`、`plugin/config`(GET) | 整个 body，调用方取 `.data` |
| C. `response()->json(['message'=>...], 200/400/403)` | `plugin/install`、`uninstall`、`enable`、`disable`、`upgrade`、`upload`、`delete`、`config`(POST)，以及 `plugin/config`(GET) 的失败分支 | 成功时返回 `{message}`；400/403 抛 `ApiError(message)` 并自动 toast |
| D. 分页/原始对象（无 status） | `system/getHorizonFailedJobs` → `{data,total,current,page_size}`；`system/getAuditLog` → `{data,total}`；`system/getQueueMasters` → Horizon 原始对象 | 整个 body |

其它错误：
- 校验失败 422 `{message, errors}`（`ForceJson` 强制 JSON）。本项目没有 `lang/*/validation.php`，未自定义文案的规则是英文（例如主题 `delete` 缺 `name` → `"The name field is required."`）。
- `ThemeService` 抛的是普通 `\Exception`（不是 `ApiException`），由 Laravel 默认处理 → **HTTP 500**，非 debug 模式 message 为本地化的“遇到了些问题，我们正在进行处理”，看不到真实原因（见 9.1）。
- `ThemeController::upload` 把所有异常包装成 `ApiException`（默认 code 400）→ HTTP 400 `{status:"fail",message:"主题上传失败：<原因>",data:null,error:null}`。
- `plugin/delete` 删除核心插件 → **HTTP 403** `{message:"该插件为系统核心插件，不允许删除"}`。官方拦截器遇 403 就登出（`core.md` §12.2-1）；新后台 `http.ts` 只在 `message === 'Unauthorized'` 时登出，因此不会误登出。

### 0.4 全局中间件对本域数据的影响【后端】

- `TrimStrings`：所有字符串（含嵌套在 `config` 里的值、多行文本）首尾空白被裁掉。
- `ConvertEmptyStringsToNull`（递归作用于嵌套数组）：**空字符串变成 `null`**。影响：
  - 插件配置：某项提交 `""` → 存成 `null` → 下次 `plugin/config` 读取时 `null ?? default` → **显示回默认值**。插件运行时 `getConfig(key, $default)` 拿到 `null`（因为 DB 值是 null 而非缺失）。【新UI】在字段说明里提示“留空将恢复默认值”。
  - 主题配置：清空的字段存成 `null`，`getThemeConfig` 返回 `null`；主题视图里 `{{$theme_config['background_url']}}` 输出空串。【新UI】回填时把 `null` 显示为空串。

### 0.5 官方通用组件行为（新 UI 用 Naive UI 等价实现）

- 确认弹窗 `hQt`：AlertDialog，`sm:max-w-[425px]`；默认标题“确认操作”、描述“确定要执行此操作吗？”、取消“取消”、确认“确认”，`variant` 控制确认按钮样式（`destructive` 为红色）。点击确认后**立即关闭**并调用 `onConfirm`（不等待 Promise）。【新UI】用 `utils/discrete` 的 `confirm()` 或 `n-popconfirm`；危险操作确认按钮用 `type="error"`。
- toast：sonner；`gE.success/gE.error`。【新UI】用 `message.success/error`。
- Badge 变体与 Naive 的映射同 `content.md` §0.4：`default`→`type="primary"`、`secondary`→`type="default"`、`destructive`→`type="error"`、`outline`→`type="default"` + `bordered`。
- 上传拖拽区（主题、插件两处结构完全一致）：高 256px（`h-64`）、2px 虚线圆角边框、居中；拖拽进入/悬停时边框变主色半透明且底色加深；隐藏的 `<input type=file accept=".zip">`，点击区内链接按钮触发选择；只取第一个文件；上传中整块替换为转圈 + “上传中/正在上传”文案；结束后清空 input 的 value（允许再次选择同一文件）。【新UI】用 `n-upload` + `n-upload-dragger`（`:max=1`、`accept=".zip"`、`:custom-request` 或 `:default-upload="false"` 手动调用 `http.upload`）。

---

## 1. 菜单与路由

### 1.1 官方【官方】

hash 路由，`/{secure_path}#<path>`。本域涉及：

| 路由 | 组件 | 侧边栏 | 说明 |
|---|---|---|---|
| `/config/plugin` | `g1t` 插件管理 | 系统管理 → 插件管理（`nav.pluginManagement`，lucide Package 图标），位于“系统配置”之后、“主题配置”之前 | |
| `/config/theme` | `E1t` 主题配置 | 系统管理 → 主题配置（`nav.themeConfig`，IconDeviceDesktop），位于“插件管理”之后、“公告管理”之前 | |
| `/config/plugin/menu-demo` | `f1t` 插件菜单演示 | 无菜单；插件管理页工具栏按钮“Menu Demo”进入 | 纯前端演示，不调接口 |
| `/config/plugin/crud-demo` | `C1t` Schema CRUD 演示 | 无菜单；插件管理页工具栏按钮“CRUD Demo”进入 | 纯前端演示，不调接口 |
| `/plugins/:pluginCode/*` | `r4t` 插件运行时页面宿主 | 动态：已安装且启用、并在 `config.json` 声明了 `admin_menus` 的插件，每个插件生成一个一级分组（见 `core.md` §6.2.3 与本文 4.1） | `*` 为子路径 |

- 系统运维（system 接口）**没有独立页面**；官方只在仪表盘（`/`）底部用了 `getQueueStats` 和 `getHorizonFailedJobs`（`core.md` §7.5）。`getSystemStatus`、`getQueueWorkload`、`getQueueMasters` 在 API 层定义了但没有任何调用；`getAuditLog` 在 bundle 中完全不存在。
- 系统更新：bundle 中没有任何更新相关 UI；语言包 `common.update.*`（“系统更新/发现新版本/立即更新…”）未被引用；后端路由已注释（第 7 节）。
- 语言包 `nav.pluginApps`“插件应用”、`nav.pluginMenuDemo`“插件菜单（演示）”、`plugin.description`“管理和配置系统插件”均未被使用；`plugin.button.menuDemo`“菜单演示”被插件管理页工具栏按钮使用（3.1）。

### 1.2 新后台【新UI】

沿用 `admin-next/src/router/index.ts` 的现有路由，并补充：

| 新后台路由 | 视图 | 菜单 | 说明 |
|---|---|---|---|
| `config/theme` | `views/config/ThemeView.vue`（已存在占位） | 系统管理 → 主题配置（已存在） | 第 2 节 |
| `config/plugin` | `views/config/PluginView.vue`（已存在占位） | 系统管理 → 插件管理（已存在） | 第 3 节 |
| `config/plugin/menu-demo` | 新增 `views/config/PluginMenuDemoView.vue` | 无（插件管理页按钮进入） | 第 5 节；开发者演示，优先级低 |
| `config/plugin/crud-demo` | 新增 `views/config/PluginCrudDemoView.vue` | 无（插件管理页按钮进入） | 第 5 节；开发者演示，优先级低 |
| `plugins/:pluginCode/:subPath(.*)*` | 新增 `views/plugin/PluginRuntimeView.vue` | 动态插件分组（第 4.1 节） | 第 4 节；`subPath` 是数组参数，`join('/')` 后使用 |
| `config/system-status` | `views/config/SystemStatusView.vue`（已存在占位） | 系统管理 → 系统状态（已存在） | **【超出官方】** 第 6.3 节 |
| `config/audit-log` | `views/config/AuditLogView.vue`（已存在占位） | 系统管理 → 审计日志（已存在） | **【超出官方】** 第 6.4 节 |

- 注意：新后台的 catch-all `:pathMatch(.*)*` 必须排在 `plugins/...` 之后（现有写法是放在 children 末尾，满足要求）。
- 页面标题（`meta.title`）：主题配置 / 插件管理 / 插件菜单演示 / Schema CRUD 演示 / 插件页面（运行时页面可在加载后用插件名覆盖 `document.title`）/ 系统状态 / 审计日志。

---

## 2. 主题配置（`/config/theme`）

### 2.1 页面结构【官方】

```
Header（布局：搜索 | 主题切换 语言 用户菜单）
Body
├─ header（mb-8）
│   ├─ h1 “主题配置”（theme.title）
│   └─ 一行：左 灰字描述（theme.description）｜右 [上传主题] 描边小按钮（Upload 图标，theme.upload.button）
├─ section 主题卡片网格：md 1 列 / lg 2 列 / xl 3 列，gap 24px
│   └─ 每个主题一张卡片（2.3）
├─ Dialog 上传主题（2.7）
└─ Dialog 主题预览（2.6）
（每张卡片内含：删除确认弹窗 2.8、主题设置弹窗 2.5）
```

- 描述原文：“主题配置，包括主题色、字体大小等。如果你采用前后分离的方式部署V2board，那么主题配置将不会生效。”
- 加载中：网格内显示 2 个骨架卡片（标题条 200px、描述条 300px、右下两个 100px 按钮骨架）。
- 空列表：官方什么都不显示。【新UI】显示 `n-empty`“暂无主题”。

### 2.2 数据加载【官方】

- `GET theme/getThemes`，react-query key `["themeList"]`，无轮询；激活/删除/上传成功后 `refetch()`。
- 取 `body.data`（形态 A）：`{ themes, active }`。

### 2.3 主题卡片【官方】

遍历 `Object.entries(data.themes)`，`key` = 目录名（即主题标识，切换/删除/配置都用它），`info` = 该主题 `config.json` 内容 + 后端附加字段。

| 区域 | 内容 | 规则 |
|---|---|---|
| 卡片背景 | `info.background_url` | **读的是主题 `config.json` 顶层的 `background_url` 字段**（不是主题配置值）。有值时作为 `background-image`（cover/center），内容层叠一层由下往上 95%→60% 的背景色渐变 + 1px 模糊，悬停时渐变加深；无值时纯背景色。内置 Xboard 的 config.json 没有该字段 |
| 右上角删除 | 仅当 `info.can_delete` 为真 | ghost 图标按钮（Trash），见 2.8；处理中显示 loading 并禁用 |
| 标题 | `info.name` | CardTitle |
| 描述 | `info.description`；若 `info.version` 有值，下一行小灰字“版本: {version}”（`theme.card.version`） | CardDescription |
| 底部右对齐按钮组（间距 12px） | ① 预览（仅当 `info.images` 是非空数组）：描边 32×32 图标按钮（Eye 类图标），点开 2.6；② “主题设置”（描边按钮，`theme.card.configureTheme`），点开 2.5；③ 激活按钮（2.4） | |

【新UI】用 `n-card`（`hoverable`）+ `n-grid :cols="'1 l:2 xl:3'" responsive="screen"`；额外显示 `is_system` 为真时的“系统主题”小标签（官方没有，属于增强，可选）。

### 2.4 激活主题【官方】

- 按钮：`key === active` 时 `variant=secondary`、文案“当前主题”（`theme.card.currentTheme`）、禁用；否则 `variant=default`（主色实心）、文案“激活主题”（`theme.card.activateTheme`）。
- 点击（无二次确认）：设置处理中 key → `POST config/save`，body **只有** `{"frontend_theme": "<key>"}` → 成功 toast “主题切换成功”（硬编码中文）→ `refetch` 主题列表；失败只有拦截器 toast；最后清除处理中状态。处理中该卡片的激活按钮 loading + 禁用，删除按钮也禁用（共用同一个处理中 key）。
- **切换主题不使用 theme 模块接口**（`ThemeController::switchTheme` 存在但没有路由）。后端副作用见 2.11。
- 【新UI】同官方：只提交 `frontend_theme` 一个键；成功 `message.success('主题切换成功')`；建议加一次确认（“切换后前台用户将立即看到新主题，确定切换到 {name}？”）——属于增强，可选。

### 2.5 主题设置弹窗（`k1t`）

**外观**【官方】：Dialog，`sm:max-w-[425px]`，最高 90vh，内容可滚动。标题“配置{name}主题”（`theme.config.title`，`name` = `info.name`），描述“修改主题的样式、布局和其他显示选项。”（`theme.config.description`）。

**生命周期**【官方】：
1. 表单 `defaultValues` = `info.configs` 每项 `field_name → ""`（一次性计算）。
2. 打开时：显示居中转圈（高 160px）→ `POST theme/getThemeConfig {name: key}` → 对返回对象的**每个键**执行 `setValue(键, 值)`（包括 `configs` 里没有的键）→ 关闭转圈。失败只有拦截器 toast，表单保持空值。
3. 关闭时 `reset()` 回到全空。
4. 提交：保存按钮 loading → `POST theme/saveThemeConfig {name: key, config: <整个表单值对象>}` → 成功 toast “保存成功”（`theme.config.success`）并关闭；失败保持打开（拦截器 toast）。
5. 底部：“取消”（secondary，关闭）、“保存”（submit，loading）。没有任何前端校验。

**字段渲染规则**（按 `info.configs` 数组顺序，每项一个表单项：Label = `label`，下面是控件，再下面是错误信息位，**没有说明文字**）：

| `field_type` | 官方控件 | 选项/占位 | 【新UI】DynamicField 映射 |
|---|---|---|---|
| `input` | 单行输入框 | `placeholder` | `type:'input'` |
| `textarea` | 多行文本框 | `placeholder` | `type:'textarea'`，`rows: 6` |
| `select` | **原生 `<select>`**（outline 按钮样式、全宽） | `select_options` 是**对象**：键为提交值、值为显示文本，按 `Object.keys` 顺序生成 `<option>` | `type:'select'`，`options = Object.entries(select_options).map(([value,label]) => ({value,label}))`；建议 `clearable:false` |
| 其它值 | 不渲染控件（但仍渲染 Label 和表单项） | — | 渲染为 `input` 并在旁边提示“未知字段类型 {field_type}”（增强），或跳过 |

**内置 Xboard 主题的配置项**（`theme/Xboard/config.json`，作为验收样例）：

| field_name | 标签 | 类型 | 占位 | 选项（值→文本） | 默认值（`default_value`） | 前台用途（`dashboard.blade.php`） |
|---|---|---|---|---|---|---|
| `theme_color` | 主题色 | select | 请选择主题颜色 | `default`→默认(绿色)、`blue`→蓝色、`black`→黑色、`darkblue`→暗蓝色 | `default` | `window.settings.theme.color`（缺省 `default`） |
| `background_url` | 背景 | input | 请输入背景图片URL | — | 无（初始化为 `""`） | `window.settings.background_url` |
| `custom_html` | 自定义页脚HTML | textarea | 可以实现客服JS代码的加入等 | — | 无（初始化为 `""`） | `{!! $theme_config['custom_html'] !!}`，**原样输出到页面**（可执行任意 JS） |

**提交数据转换**：
- 【官方】提交整个表单对象，所有值都是字符串（select 值也是字符串）；空串经后端中间件变 `null`（0.4）。
- 【后端】`updateConfig` 只保留 `configs[].field_name` 中存在的键（`collect($config)->only($validFields)`），与当前配置 `array_merge` 后整体写入 `admin_setting("theme_{name}")`，返回合并后的完整配置。
- 【新UI】只提交 `configs` 中声明的键；回填时 `null` → `""`；`custom_html` 字段下方加提示“内容会原样插入前台页面，可执行脚本，请只填写可信代码”。
- 【新UI】若主题 `configs` 为空数组：官方仍可点“保存”，提交 `config: {}` 会被后端 `required` 校验拒绝（422）。新后台应在 `configs` 为空时显示“该主题没有可配置项”并隐藏保存按钮。

### 2.6 主题预览弹窗【官方】

- 触发：卡片“预览”按钮，传入 `{name: info.name, images: info.images}`，当前索引重置为 0。
- Dialog `max-w-4xl`。标题“{name} 主题预览”（`theme.preview.title`）；描述居中“{current} / {total}”（`theme.preview.imageCount`，current 从 1 开始）。
- 主图：16:9 容器、圆角描边、`object-contain`；`alt` = “{name} 预览图 {n}”。
- 图片数 > 1 时：左右两侧圆形半透明按钮（上一张/下一张，**循环**：第一张再往前到最后一张）；下方一排 64×64 缩略图（`object-cover`），当前项主色边框，点击跳转；`alt` = “缩略图 {n}”。
- 关闭时清空并把索引归零。
- 图片 URL 由主题作者写在 `config.json` 的 `images` 数组里，前端原样作为 `img src`。【新UI】用 `n-modal` + `n-carousel`（或 `n-image-group`）；对非数组/空数组不显示预览按钮。

### 2.7 上传主题弹窗【官方】

- Dialog `sm:max-w-md`，标题“上传主题”（`theme.upload.title`），描述“请上传一个有效的主题压缩包（.zip 格式）。主题包应包含完整的主题文件结构。”（`theme.upload.description`）。
- 拖拽区（0.5）：文案“将主题文件拖放到此处，或者”+ 链接按钮“点击选择”；小字“支持 .zip 格式的主题包”；上传中“正在上传...”。
- 前端校验：`file.name.endsWith(".zip")`（区分大小写），否则 toast “只支持上传 ZIP 格式的主题文件”（`theme.upload.error.format`），不发请求。
- 成功：toast “主题上传成功”（硬编码），关闭弹窗，`refetch` 列表。失败：只有拦截器 toast（弹窗保持打开）。
- 【新UI】在发请求前额外做后端同款校验，提前给出中文提示：
  1. 扩展名 `.zip`（不区分大小写也可，但后端 `mimes:zip` 看内容）；
  2. 大小 ≤ 10MB（`max:10240` KB）；
  3. **文件名**匹配 `^[a-zA-Z0-9\-\_\.]+\.zip$`（后端会拒绝含中文、空格、括号的文件名，提示“主题包文件名只能包含字母、数字、下划线、中划线和点”）。

### 2.8 删除主题【官方】

- 仅 `can_delete` 为真的卡片显示删除按钮（系统主题 `Xboard`/`v2board` 与当前主题永远为假）。
- 确认弹窗：标题“删除主题”、描述“确定要删除该主题吗？删除后无法恢复。”、确认“删除”（destructive）、取消“取消”。
- 确认后：若 `key === active` → toast error “不能删除当前使用的主题”（`theme.card.delete.error.active`），不发请求；否则 `POST theme/delete {name: key}` → 成功 toast “主题删除成功”（硬编码）→ `refetch`。
- 【新UI】同官方；确认文案补充“将同时删除该主题的已保存配置”（后端会清空 `theme_{name}` 设置）。

### 2.9 主题包格式（`config.json`）【后端】

主题目录必须同时包含 `config.json` 与 `dashboard.blade.php`，否则 `getThemes` 不列出。

| 键 | 类型 | 必填 | 用途 |
|---|---|---|---|
| `name` | string | 上传时必填 | 主题名，也是安装目录名（`storage/theme/{name}`）；不能是 `Xboard`、`v2board` |
| `description` | string | 否 | 卡片描述 |
| `version` | string | 否（缺省按 `0.0.0` 比较） | 上传覆盖时必须严格大于已安装版本（`version_compare`） |
| `images` | string[] | 否 | 预览图 URL；内置 Xboard 为 `""`（不显示预览） |
| `background_url` | string | 否 | 管理后台卡片背景 |
| `configs` | array | 否 | 配置项描述数组，每项：`label`、`placeholder`、`field_name`（必需，作为键）、`field_type`（`input`/`textarea`/`select`）、`select_options`（对象，值→文本）、`default_value`（缺省 `""`） |

### 2.10 接口明细

#### 2.10.1 `GET theme/getThemes`

- 参数：无。
- 响应（形态 A）`data`：
  ```json
  {
    "themes": {
      "Xboard": {
        "name": "Xboard", "description": "Xboard", "version": "1.0.0", "images": "",
        "configs": [ { "label": "主题色", "placeholder": "...", "field_name": "theme_color", "field_type": "select",
                       "select_options": {"default": "默认(绿色)", "...": "..."}, "default_value": "default" }, "..." ],
        "can_delete": false,
        "is_system": true
      }
    },
    "active": "Xboard"
  }
  ```
- `themes`：先系统目录 `theme/`（`is_system=true`、`can_delete=false`），再用户目录 `storage/theme/`（`is_system=false`、`can_delete = 目录名 !== admin_setting('current_theme')`）；同名时后者覆盖前者（`array_merge` 字符串键）。对象内容是 `config.json` 全部顶层键原样透传 + `can_delete` + `is_system`。
- **没有任何主题时返回 `[]`（JSON 数组而不是对象）**。【新UI】用 `Object.entries(themes ?? {})` 兼容。
- `active` = `admin_setting('frontend_theme', 'Xboard')`。注意 `can_delete` 依据的是另一个设置 `current_theme`（两者正常情况下一致，见 9.1）。

#### 2.10.2 `POST theme/upload`

- 请求：multipart，字段 `file`。
- 校验（422，自定义中文）：`required`→“请选择主题包文件”；`file`→“无效的文件类型”；`mimes:zip`→“主题包必须是zip格式”；`max:10240`→“主题包大小不能超过10MB”。另外 PHP `upload_max_filesize`/`post_max_size` 更小时会先被拒（413 或校验失败）。
- 业务错误（400 `{status:"fail",message}`）：
  - “上传目录无写入权限”（`storage/tmp` 不可写）；
  - “主题目录无写入权限”（检查的是 **`base_path('theme')`** 系统主题目录是否可写，见 9.1）；
  - “无效的文件类型，仅支持ZIP格式”（MIME 不是 `application/zip` / `application/x-zip-compressed`）；
  - “主题包文件名只能包含字母、数字、下划线、中划线和点”；
  - “主题上传失败：<原因>”，原因为英文：`Invalid theme package`、`Theme config file not found`、`Theme name not configured`、`Cannot upload theme with same name as system theme`、`Missing required theme file: dashboard.blade.php`、`Existing theme missing config file`、`Theme exists and not a newer version`。
- 成功：`data: true`。
- 副作用：解压到 `storage/tmp/<uniqid>`；找 zip 内**第一个**名为 `config.json` 的条目，以其所在目录为主题根；复制到 `storage/theme/{config.name}`；新主题 → 用 `default_value` 初始化 `theme_{name}` 设置；同名且版本更高 → 删除旧目录与 `public/theme/{name}`，复制新文件，**保留已有配置**（默认值与已有值合并，已有值优先）；最后删除临时目录。

#### 2.10.3 `POST theme/delete`

- 请求：`{ "name": "<主题目录名>" }`（`required`）。
- 成功：`data: true`。副作用：删除 `public/theme/{name}`、缓存 `theme_{name}_assets`、`storage/theme/{name}` 目录，并把 `theme_{name}` 设置写为 `null`。
- 失败（**500**，普通 Exception，生产环境看不到原因）：系统主题（`System theme cannot be deleted`）、当前主题（`Current theme cannot be deleted`，依据 `current_theme`）、目录不存在（`Theme not found`）。

#### 2.10.4 `POST theme/getThemeConfig`

- 注意是 **POST**。请求：`{ "name": "<主题目录名>" }`（`required`）。
- 响应 `data`：`{ "<field_name>": <值>, ... }`（`admin_setting("theme_{name}")`，JSON 解码后的对象）。首次读取时若设置不存在，按 `configs[].default_value`（缺省 `""`）初始化并写库后返回。
- 主题不存在或没有 config.json 时返回 `data: null`。【新UI】`null` 当作 `{}` 处理（官方 `Object.entries(null)` 会报错）。

#### 2.10.5 `POST theme/saveThemeConfig`

- 请求：`{ "name": "<主题目录名>", "config": { "<field_name>": "<值>", ... } }`，两者 `required`（`config` 为空对象会 422）。
- 响应 `data`：保存后的完整配置对象（同 2.10.4）。
- 失败（500）：主题不存在（`Theme not found`）、config.json 无效（`Invalid theme config file`）。

### 2.11 后端副作用：切换主题（经 `config/save`）【后端】

`ConfigController::save` 遇到 `frontend_theme` 键时先调用 `ThemeService::switch($v)`：
1. 主题目录不存在 → 抛异常 → **HTTP 500**（`frontend_theme` 不写入；同一请求里排在它前面的键已写入）。
2. 主题缺 `dashboard.blade.php` → 500。
3. 当前主题（`current_theme`）与目标不同 → 删除 `public/theme/{旧主题}` 与其缓存。
4. 复制主题目录到 `public/theme/{新主题}`，写 `current_theme = 新主题`。
5. 回到控制器写 `frontend_theme = 新主题`。

用户前台（`routes/web.php` 的 `/`）读取 `frontend_theme` 渲染 `theme::{name}.dashboard`，并传入 `theme_config = getConfig(name)`。若 `frontend_theme` 指向的主题已不存在，前台会自动回退到 `Xboard` 并改写设置。
`ConfigSave` 对 `frontend_theme` 的校验规则是空串（不校验）。只要请求带了 `frontend_theme`（即使值没变）就会重新复制一次文件（`settings.md` §1.3）。

### 2.12 主题域差异与风险（汇总见第 9 节）

- 上传主题 = 在服务器上安装任意 Blade 模板（可执行任意 PHP），与上传插件同级危险；`custom_html` 原样输出到前台。新后台应在上传弹窗里加醒目警告：“主题包包含可执行代码，仅上传可信来源的主题”。

---

## 3. 插件管理（`/config/plugin`）

### 3.1 页面结构【官方】

```
Header：左 Package 图标 + h1 “插件管理”（plugin.title）｜右 主题切换 用户菜单
Body
├─ 工具栏（md 以上一行两端对齐，窄屏纵向）
│   ├─ 左：搜索框（最大宽 sm，左侧放大镜图标，占位“搜索插件名称或描述...”）
│   └─ 右（gap 16px）：
│        ├─ 安装状态下拉（宽 140px，占位“安装状态”）：全部状态(all) / 已安装(installed) / 可安装(available)，默认 all
│        ├─ [CRUD Demo] 描边小按钮（Package 图标）→ 跳转 #/config/plugin/crud-demo
│        ├─ [菜单演示] 描边小按钮（Package 图标）→ 跳转 #/config/plugin/menu-demo
│        └─ [上传插件] 描边小按钮（Upload 图标）→ 打开上传弹窗
├─ Tabs（全宽）：触发器依次为 `plugin/types` 返回的类型（“功能”“支付方式”），最后是“所有插件”（plugin.tabs.all）
│   默认选中 **feature**（“功能”），不是“所有插件”
│   └─ 每个 TabContent（mt-6）：插件卡片纵向列表（单列，间距 16px）
├─ Dialog 插件配置（3.5）
├─ Dialog 上传插件（3.7）
└─ Dialog 插件文档（3.6）
```

- “CRUD Demo” 按钮文案 key `button.crudDemo` 不在语言包里，显示英文默认值 “CRUD Demo”；“菜单演示”来自 `plugin.button.menuDemo`。
- 页面描述 `plugin.description` 没有显示。
- 加载中（`pluginTypes` 或 `pluginList` 任一在加载）：**只有“所有插件”页签**显示 3 个骨架卡片；类型页签此时是空白（官方缺陷）。【新UI】所有页签都显示骨架（`n-skeleton`）。
- 空状态：官方无。【新UI】`n-empty`：有搜索/筛选条件时“没有匹配的插件”，否则“暂无插件”。
- 【新UI】页面用 `<page-container title="插件管理" description="管理和配置系统插件">`，工具栏放 `#extra` 或页内 `.toolbar`；演示按钮建议收进一个“开发者演示”下拉（`n-dropdown`），避免干扰（布局调整，功能不减）。

### 3.2 数据加载与过滤【官方】

- 类型：`GET plugin/types`，key `["pluginTypes"]`，取 `body.data`。
- 列表：`GET plugin/getPlugins`（**不带 type 参数**），key `["pluginList"]`（与侧边栏共用同一个查询，`staleTime` 30 秒），取 `body.data`。
- 过滤全部在前端，顺序：
  1. 搜索：`name`、`description`、`code` 任一 `toLowerCase().includes(关键词小写)`；
  2. 当前页签不是 `all` 时：`type === 页签值`；
  3. 安装状态：`installed` → `is_installed`；`available` → `!is_installed`。
- 无排序（保持后端顺序：先 `plugins-core/` 目录再 `plugins/` 目录，各自按 `File::directories` 的顺序，即目录名字典序【推断】）。
- 每次操作成功后：`refetch()` + `invalidateQueries(["pluginList"])`（侧边栏插件菜单随之更新）。
- 【新UI】建一个共享的插件列表 store（例如 `stores/plugins.ts`：`list`、`loading`、`load(force?)`，30 秒内复用缓存），插件管理页、插件运行时页、侧边栏共用；任何插件操作成功后 `load(true)`。

### 3.3 插件卡片（`u1t`）【官方】

卡片：`p-4`，悬停阴影。自上而下：

1. **第一行**（两端对齐）：
   - 左：插件名（`name`，单行截断，半粗）→ 类型徽标（`typeInfo.label`，描边、主色淡底，例如“功能”“支付方式”；类型不在 `plugin/types` 中时不显示）→ 状态徽标：
     - 已安装且启用：`default` 徽标“已启用”（`plugin.status.enabled`）；
     - 已安装未启用：`outline` 徽标“已禁用”（`plugin.status.disabled`）；
     - 未安装：灰色描边徽标“未安装”（`plugin.status.not_installed`）。
   - 右：`is_protected` 为真时显示琥珀色圆形小盾牌图标，悬停 Tooltip “受保护”（`plugin.status.protected`）；`readme` 非空时显示文档图标按钮（title “查看文档”，`plugin.button.readme`），点开 3.6。
2. **第二行**（12px 灰字，间距 12px）：Package 图标 + `<code>{code}</code>`、`v{version}`、`作者: {author}`（`plugin.author`）。
3. **描述**：`description`，最多 2 行省略。
4. **操作区**（右对齐，间距 8px，按钮高 28px 小号）：

| 条件 | 按钮（从左到右） |
|---|---|
| 已安装 | ① **升级**（仅 `need_upgrade`）：红底白字小按钮（刷新类图标），确认弹窗：标题“升级插件”、描述“确定要升级此插件吗？升级过程中插件将暂时不可用。”、确认“升级”（default 样式）、取消“取消”。② **配置**（仅 `config` 对象有键）：描边按钮（Settings 图标），**插件未启用或该卡片处理中时禁用**，点开 3.5。③ **启用/禁用**：启用中显示红色（destructive）“禁用”，否则主色“启用”（Power 图标），无确认。④ **卸载**：描边灰字、悬停变红（Trash 图标），**启用中或处理中时禁用**，确认弹窗：标题“卸载插件”、描述“确定要卸载此插件吗？卸载后插件数据将被清除。”、确认“卸载”（destructive）。 |
| 未安装 | ① **安装**：主色按钮，处理中按钮内显示小转圈（无确认）。② **删除**（仅 `can_be_deleted !== false`，即非核心插件）：ghost 32×28 图标按钮（Trash），确认弹窗：标题“删除插件”、描述“确定要删除此插件吗？此操作无法撤销。”、确认“删除”（destructive）。 |

- “处理中”：页面级 `processingCode`，与卡片 `code` 相等时该卡片所有按钮禁用。一次只追踪一个插件。

**操作流程**（全部相同模式）：设置 `processingCode` → 调接口 → 成功 toast → `refetch` + 失效 `["pluginList"]` → 失败 toast `err.message || 默认失败文案` → 清除 `processingCode`。

| 操作 | 接口 | 成功文案 | 失败兜底文案 |
|---|---|---|---|
| 安装 | `POST plugin/install {code}` | 插件安装成功 | 插件安装失败 |
| 升级 | `POST plugin/upgrade {code}` | 插件升级成功 | 插件升级失败 |
| 卸载 | `POST plugin/uninstall {code}` | 插件卸载成功 | 插件卸载失败 |
| 启用 | `POST plugin/enable {code}` | 插件启用成功 | 插件启用失败 |
| 禁用 | `POST plugin/disable {code}` | 插件禁用成功 | 插件禁用失败 |
| 删除 | `POST plugin/delete {code}` | 插件删除成功 | 插件删除失败 |
| 上传 | `POST plugin/upload`（multipart `file`） | 插件上传成功 | 插件上传失败 |

- 官方失败时会**弹两次** toast：拦截器一次（后端 message）+ 页面 catch 一次（同一 message）。【新UI】只弹一次（`http.ts` 自动 toast 即可，页面不再重复；或 `silent:true` 后页面自行提示）。
- 【新UI】额外的确认（增强，建议做）：
  - 禁用**支付类**插件前确认：“禁用后使用该支付方式的支付通道将不可用，包括未完成订单的支付回调，确定禁用？”（见 9.3）。
  - 安装前无需确认。
- 【新UI】卡片在窄屏下操作区换行（`n-space wrap`）。

### 3.4 插件状态机与按钮可用性总表

| 状态 | 安装 | 删除 | 升级 | 配置 | 启用 | 禁用 | 卸载 |
|---|---|---|---|---|---|---|---|
| 未安装、非核心 | ✓ | ✓ | — | — | — | — | — |
| 未安装、核心（`is_protected`） | ✓ | 隐藏 | — | — | — | — | — |
| 已安装、未启用 | — | — | 若 `need_upgrade` | 有配置项时显示但**禁用** | ✓ | — | ✓ |
| 已安装、已启用 | — | — | 若 `need_upgrade` | 有配置项时可用 | — | ✓ | 显示但**禁用**（须先禁用） |

### 3.5 插件配置弹窗（`bQt` + `IYt`）

**外观**【官方】：Dialog `sm:max-w-lg`。标题“{插件 name} 配置”（`plugin.config.title`），描述“修改插件配置”（`plugin.config.description`）。

**生命周期**【官方】：
1. 打开即 `GET plugin/config?code=<code>`，加载中显示 3 组骨架（短标签条 + 输入框/文本框骨架）。
2. 成功：保存 schema（`body.data`），用 `RYt` 生成初值 `{config: {key: value}}` 并 `reset`。
3. 失败：toast “加载插件配置失败”（`plugin.messages.configLoadError`），表单区为空（仍有底部按钮）。
4. 表单区：ScrollArea 最高 60vh，字段间距 24px，按 schema 对象键顺序渲染（`IYt`，规则见下表）。
5. 底部（上边框分隔）：“取消”（ghost 小按钮，关闭弹窗）、“保存”（`plugin.config.save`，submit；提交中显示小转圈 + “保存中...”，两个按钮都禁用）。
6. 提交：`POST plugin/config {code, config: <表单 config 对象>}` → 成功 toast “配置保存成功” → 关闭弹窗 → `refetch` + 失效 `["pluginList"]`；失败 toast “配置保存失败”（另有拦截器 toast）。
7. zod 只要求 `config` 是任意记录，**没有任何字段级校验**（包括 `required`）。

**`RYt` 初值规则**：对每个 `key → item`：取 `item.value`；若 `item.type` 是 `json` 或 `yaml`：`null/undefined → ""`，非字符串 → `JSON.stringify(value, null, 2)`（失败则 `String(value)`），字符串原样。

**`IYt` 字段渲染规则**（`label` 显示为 `item.label || item.description`；若同时有 `label` 和 `description`，`description` 作为说明文字显示在控件下方；`required` 为真时标签后加红色 `*`）：

| `type` | 官方控件 | 值处理 | 【新UI】DynamicField 映射 |
|---|---|---|---|
| `string` | 单行输入（等宽小字），占位 `placeholder` | 字符串 | `input` |
| `number` | `<input type=number>`，占位 `placeholder` | 每次输入 `Number(v)`（空输入得到 `0`） | `number`（`n-input-number`，空值提交 `null`，见 9.1） |
| `percentage` | 同 number，右侧显示 `%` 单位 | `Math.min(100, Math.max(0, Number(v)))` | `number`，`min:0,max:100`，后缀 `%` |
| `select` | 下拉（shadcn Select），占位 `placeholder` | `options` 必须是 `[{value,label}]` 数组，值为字符串 | `select`；`options` 兼容两种格式：数组 `[{value,label}]`，或对象 `{value: label}`（官方会崩溃，新UI转换） |
| `boolean` | 整行带边框的卡片：左侧标签 + 说明，右侧 Switch | 布尔 | `switch` |
| `text` | 多行文本框（最小高 80px），占位 `placeholder` | 字符串 | `textarea` |
| `json` | Monaco 编辑器（语言 json，高 150px、可纵向拖拽，关闭 minimap，自动换行，粘贴/输入时格式化） | **提交字符串**（编辑器原文） | `json`（`CodeEditor` language json）；**提交前 `JSON.parse` 校验**，失败时标红并阻止提交（官方不校验） |
| `yaml` | Monaco 编辑器（语言 yaml） | 提交字符串 | `code`（language 'text' 或扩展 yaml），提交字符串 |
| 其它 | **不渲染** | 原值随表单一起提交 | 不渲染，但保留原值随表单提交（与官方一致，避免丢配置） |

- 【后端】`plugin/config` GET 返回的每项**不包含 `required` 字段**（`PluginConfigService::getConfig` 只透传 `type/label/placeholder/description/value/options`），所以官方从不显示星号。
- 【后端】`updateConfig` 会**整体覆盖** DB 中的配置：只保留 schema 中存在的键，未提交的键从 DB 中消失（读取时回落到 `default`，但插件运行时拿不到 config.json 的默认值，只能拿到代码里的默认值）。【新UI】必须提交 schema 中的**全部键**。
- 【后端】`json` 类型以字符串存库；插件加载时 `castConfigValuesByType` 对 `type=json` 且为合法 JSON 字符串的值做 `json_decode`；非法 JSON 保持字符串（插件可能因此出错）。
- 【新UI】文本类字段说明里提示“留空保存后将恢复默认值”（0.4）。
- 【新UI】插件配置也可能包含密钥（例如 API Key），保存请求会被**原样写入审计日志**（`config` 是嵌套键，不在 `RequestLog` 的敏感键过滤范围内），见 9.4。建议对 `label`/键名含 `key|secret|token|password` 的 `string` 字段使用 `password` 类型显示（仅显示层，提交值不变）。

**内置 Telegram 插件配置（验收样例，`plugins-core/Telegram/config.json`）**：

| key | type | 标签 | 说明 | 默认值 |
|---|---|---|---|---|
| `enable_ticket_notify` | boolean | 开启工单通知 | 是否开启工单创建和回复的 Telegram 通知功能 | `true` |
| `enable_payment_notify` | boolean | 开启支付通知 | 是否开启支付成功的 Telegram 通知功能 | `true` |
| `start_welcome_title` | string | 欢迎标题 | /start 命令显示的欢迎标题 | `🎉 欢迎使用 XBoard Telegram Bot！` |
| `start_bot_description` | text | 机器人描述 | /start 命令显示的机器人功能介绍 | 多行文本（JSON 中写的是 `\\n`，即字面量反斜杠 n） |
| `start_bind_guide` | text | 绑定指导 | 未绑定用户显示的绑定指导文本 | 同上 |
| `start_unbind_guide` | text | 已绑定用户命令列表 | 已绑定用户显示的命令列表 | 同上 |
| `start_bind_commands` | text | 未绑定用户命令列表 | 未绑定用户显示的命令列表 | 同上 |
| `start_footer` | text | 底部提示 | /start 命令底部的提示信息 | `💡 提示：所有命令都需要在私聊中使用` |
| `help_text` | text | 帮助文本 | 未知命令时显示的帮助文本 | 同上 |

6 个支付插件（`alipay_f2f`、`btcpay`、`coin_payments`、`coinbase`、`epay`、`mgate`）的 `config.json` **没有 `config` 键**，因此卡片上不显示“配置”按钮；它们的商户参数在“支付配置”页按支付实例配置（`commerce.md` §4.7）。

### 3.6 插件文档弹窗【官方】

- Dialog `max-w-2xl`，标题“插件文档”（`plugin.readme.title`）。
- 内容：`readme` 用 markdown-it 渲染（`html:false`，即 Markdown 中的原始 HTML 被转义；`linkify:false`），容器 `markdown-body`，最高 60vh 滚动。
- 【新UI】用 `marked` 渲染时**必须禁止原始 HTML**（`marked` 默认会透传 HTML，插件 README 来自上传包，存在 XSS 风险）：自定义 renderer 的 `html()` 返回转义文本，或在渲染前转义 `<`、`>`。不新增 DOMPurify 等依赖（如需新增依赖须主会话确认）。

### 3.7 上传插件弹窗【官方】

- Dialog `sm:max-w-md`，标题“上传插件”（`plugin.upload.title`），描述“上传插件包 (.zip)”（`plugin.upload.description`）。
- 拖拽区（0.5）：“拖拽插件包到此处，或”+ 链接按钮“浏览”；小字“仅支持 .zip 格式文件”；上传中“上传中...”。
- 前端校验：`name.endsWith(".zip")`，否则 toast “仅支持 .zip 格式文件”（`plugin.upload.error.format`）。
- 成功：toast “插件上传成功”，关闭弹窗，`refetch` + 失效。失败：toast（双重，见 3.3）。
- 【新UI】增加大小校验（≤10MB）；弹窗内加醒目警告：“插件包含可在服务器上执行的 PHP 代码，仅上传可信来源的插件。上传同名插件的更高版本会自动升级已安装的插件。”

### 3.8 插件包格式（`config.json`）【后端】

**元数据**：

| 键 | 类型 | 安装/上传时校验（`validateConfig`） | 说明 |
|---|---|---|---|
| `name` | string | 必填非空 | 显示名 |
| `code` | string | 必填，`^[a-z0-9_]+$`（**不允许中划线**） | 唯一标识；目录名 = `Str::studly(code)`（如 `alipay_f2f` → `AlipayF2f`） |
| `version` | string | 必填，`^\d+\.\d+\.\d+$` | 用于 `need_upgrade` 与上传升级判断 |
| `description` | string | 必填非空 | |
| `author` | string | 必填非空 | |
| `type` | string | 可选，`feature` 或 `payment`（缺省 `feature`） | 前端侧边栏还识别 `theme`，但后端不允许 |
| `require` | object | 不校验（`checkDependencies` 恒为真） | 如 `{"xboard": ">=1.0.0"}` |
| `config` | object | 不校验 | 配置项 schema，见下 |
| `admin_menus` | array | 不校验，`getPlugins` 原样透传 | 侧边栏菜单声明（4.1） |
| `admin_crud` | object | 不校验，原样透传 | Schema CRUD 页声明（4.4） |

**`config` 每一项**：`{ type, default, label?, placeholder?, description?, options? }`。`type` 取值见 3.5 表（后端只特殊处理 `json`；开发文档列出 `string/number/boolean/json/yaml`，官方 UI 另外支持 `select/text/percentage`）。`type` 与 `default` 缺失会导致 `plugin/config` GET 报错（见 9.1）。

**目录结构**（插件可选能力）：`Plugin.php`（必需，类 `Plugin\{Studly}\Plugin` 继承 `AbstractPlugin`）、`routes/api.php` / `routes/web.php`（自带完整前缀，如 `api/v1/xxx`）、`Controllers/`、`Commands/`、`database/migrations/`（安装时 migrate、卸载时 rollback）、`resources/views/`（视图命名空间 `Studly`）、`resources/assets/`（安装时复制到 `public/plugins/{code}/`）、`README.md`/`readme.md`。

### 3.9 接口明细

#### 3.9.1 `GET plugin/types`

- 响应（形态 B）：
  ```json
  { "data": [
      { "value": "feature", "label": "功能", "description": "提供功能扩展的插件，如Telegram登录、邮件通知等", "icon": "🔧" },
      { "value": "payment", "label": "支付方式", "description": "提供支付接口的插件，如支付宝、微信支付等", "icon": "💳" } ] }
  ```
- 官方只用 `value`、`label`。固定数据，【新UI】可直接写死在前端常量中，也可照样请求。

#### 3.9.2 `GET plugin/getPlugins`

- 参数：`type`（可选，`feature`/`payment`；同时过滤 DB 与目录扫描）。官方不传。
- 响应（形态 B）：`{ "data": Plugin[] }`，每个元素：

| 字段 | 类型 | 来源与规则 |
|---|---|---|
| `code` | string | config.json `code` |
| `name` | string | config.json `name` |
| `version` | string | **本地文件**的版本（不是已安装版本） |
| `description` | string | config.json |
| `author` | string | config.json |
| `type` | string | config.json `type ?? 'feature'` |
| `is_installed` | bool | `v2_plugins` 存在该 `code` 的行 |
| `is_enabled` | bool | 已安装时取 DB `is_enabled`，否则 `false` |
| `is_protected` | bool | 插件目录位于 `plugins-core/`（核心插件） |
| `can_be_deleted` | bool | `!is_protected` |
| `config` | object \| `[]` | **已安装**：`PluginConfigService::getConfig` 的结构化结果 `{key: {type,label,placeholder,description,value,options}}`；**未安装**：config.json 原始 `config`（`{key: {type,default,label,...}}`，没有 `value`）；没有配置时是 `[]`（JSON 空数组） |
| `readme` | string | 插件目录下 `README.md` 或 `readme.md` 内容，没有则 `""` |
| `need_upgrade` | bool | 已安装且 `version_compare(本地版本, DB 版本, '>')` |
| `admin_menus` | array \| null | config.json 原样 |
| `admin_crud` | object \| null | config.json 原样 |

- 扫描顺序：`plugins-core/`，再 `plugins/`；同 `code` 只保留第一个（核心插件优先，用户目录的同名包被忽略）。没有 `config.json` 或缺 `code` 的目录被跳过；但缺 `name/version/description/author` 会触发 PHP “Undefined array key” 异常 → **整个接口 500**（见 9.1）。

#### 3.9.3 `POST plugin/install`

- 请求：`{ "code": "<code>" }`（`required|string`）。
- 成功：`{ "message": "插件安装成功" }`。失败：400 `{ "message": "插件安装失败：<原因>" }`，原因：`Plugin config file not found`、`Invalid plugin config`、`Plugin already installed`、迁移错误、插件 `install()` 抛出的错误。
- 副作用：运行插件 `database/migrations`（**在事务外**，失败不回滚）→ 事务内：写 `v2_plugins`（`is_enabled=false`、`config` = 各项 `default` 组成的 JSON、`installed_at=now`）→ 调用插件 `install()` → 发布 `resources/assets` 到 `public/plugins/{code}`。安装后**不会自动启用**。

#### 3.9.4 `POST plugin/uninstall`

- 请求：`{ "code" }`。
- 已启用 → 400 `{ "message": "请先禁用插件后再卸载" }`。
- 成功：`{ "message": "插件卸载成功" }`；失败 400 `"插件卸载失败：<原因>"`。
- 副作用：`disable()`（调用插件 `cleanup()`）→ **回滚插件迁移（删表，数据丢失）** → 删除 `v2_plugins` 行（配置丢失）。插件文件保留。

#### 3.9.5 `POST plugin/enable`

- 请求：`{ "code" }`。
- 成功：`{ "message": "插件启用成功" }`；失败 400 `"插件启用失败：<原因>"`（如 `Plugin not found: <code>`）。
- 副作用：加载插件类（`Plugin.php` 不存在时**会删除该插件的 DB 行**并失败）→ 注入配置 → 注册 ServiceProvider、路由、视图 → `is_enabled=true` → `boot()`。不检查是否已安装（未安装时 DB 更新 0 行，仍返回成功；官方 UI 不会出现这种调用）。

#### 3.9.6 `POST plugin/disable`

- 请求：`{ "code" }`。
- 成功：`{ "message": "插件禁用成功" }`。**没有 try/catch**：插件类找不到时抛异常 → HTTP 500（通用错误信息）。
- 副作用：`is_enabled=false` → 插件 `cleanup()`。

#### 3.9.7 `GET plugin/config`

- 参数：`code`（query，`required|string`）。官方：`GET plugin/config?code=telegram`。
- 成功（形态 B）：`{ "data": { "<key>": { "type", "label", "placeholder", "description", "value", "options" } } }`；`value = DB 值 ?? config.json default`；`label/placeholder/description` 缺省 `""`，`options` 缺省 `[]`。插件没有 `config` 时 `data` 为 `[]`。插件未安装也能读（返回默认值）。
- 失败：400 `{ "message": "获取配置失败：<原因>" }`。

#### 3.9.8 `POST plugin/config`

- 请求：`{ "code": "<code>", "config": { "<key>": <值>, ... } }`（`code` `required|string`；`config` `required|array`）。
- 成功：`{ "message": "配置更新成功" }`。失败：400 `"配置更新失败：插件配置结构不存在"`（插件 config.json 没有 `config`）等。
- 副作用：过滤掉 schema 外的键后**整体覆盖** `v2_plugins.config`。插件未安装时更新 0 行但仍返回成功。不会重启插件，下一次请求初始化插件时生效。

#### 3.9.9 `POST plugin/upgrade`

- 请求：`{ "code" }`。
- 成功：`{ "message": "插件升级成功" }`；失败 400 `"插件升级失败：<原因>"`：`Plugin not installed: <code>`、`Plugin config file not found`、`Invalid plugin config or missing version`、`Plugin is already up to date`。
- 副作用：`disable()` → 运行新迁移 → 插件 `update(old, new)` → DB `version` 更新 → `enable()`。中途失败时插件可能停留在**已禁用**状态（9.3）。

#### 3.9.10 `POST plugin/upload`

- 请求：multipart，字段 `file`。
- 校验（422）：“请选择插件包文件”/“无效的文件类型”/“插件包必须是zip格式”/“插件包大小不能超过10MB”。**不校验文件名**（与主题不同）。
- 成功：`{ "message": "插件上传成功" }`。失败：400 `"插件上传失败：<原因>"`：`无法打开插件包文件`、`插件包格式错误：缺少配置文件`、`插件配置文件格式错误`、`已安装插件缺少配置文件，无法判断是否可升级`、`插件缺少版本号，无法判断是否可升级`、`上传插件版本不高于已安装版本，无法升级`，以及自动升级时 3.9.9 的错误。
- 副作用：解压到 `storage/tmp/plugins/<uniqid>`；在 `*/config.json`（一级子目录）或根 `config.json` 中找配置（多个时取第一个）；校验元数据；目标 `plugins/{Studly(code)}` 已存在时**新版本必须更高**，然后删除旧目录；复制新文件；**若该 code 已安装 → 立即执行升级（3.9.9）**。上传的插件不会自动安装。
- 注意：上传与核心插件同 `code` 的包，会被复制到 `plugins/` 但被核心目录**遮蔽**（加载与列表都优先 `plugins-core/`），实际无效。

#### 3.9.11 `POST plugin/delete`

- 请求：`{ "code" }`。
- 核心插件 → **403** `{ "message": "该插件为系统核心插件，不允许删除" }`。
- 成功：`{ "message": "插件删除成功" }`；失败 400 `"插件删除失败：<原因>"`（如 `插件不存在`）。
- 副作用：若已安装 → 先执行 3.9.4 的卸载流程（**不检查是否启用**，直接禁用 + 回滚迁移 + 删 DB 行）→ 删除 `plugins/{Studly(code)}` 目录。官方 UI 只在未安装时提供删除。

### 3.10 插件生命周期与运行机制（理解用）【后端】

- 每个 HTTP 请求由全局中间件 `InitializePlugins` 调用 `initializeEnabledPlugins()`：读取所有 `is_enabled` 行 → 加载类 → 注入配置（json 类型解码）→ 注册 ServiceProvider / 路由 / 视图 / 命令 → `boot()`。`PluginManager` 在 Octane 下是 `scoped` 绑定并预热，`HookManager` 每个请求 flush。
- 调度：`Console\Kernel` 调用 `registerPluginSchedules`，启用插件可注册计划任务。
- `xboard:install` / `xboard:update` 会调用 `installDefaultPlugins()`：只对**尚未安装**的核心插件执行安装并启用；已安装的核心插件版本升高后不会自动升级，需在插件管理页点“升级”（`need_upgrade`）。
- 插件对后台数据的影响途径只有后端钩子（例如 `admin.user.fetch.query`、`admin.user.transform`、`admin.user.update.rules` 等 filter，`admin.user.update.before/after` 等 action），**不能向后台前端注入任何脚本或组件**（4.5）。

---

## 4. 插件运行时页面（`/plugins/:pluginCode/*`）

### 4.1 侧边栏插件菜单【官方】（与 `core.md` §6.2.3 一致，此处补充实现细节）

- 数据：共享的 `["pluginList"]`。只取 `is_installed && is_enabled` 的插件。
- 每个插件：遍历 `admin_menus`，`path` 规范化（`trim()` 后去掉首尾所有 `/`）为空的项丢弃；有效项生成：`id = plugin-menu:{code}:{menu.id}`、标题 = `menu.title` 原文、徽标 = `menu.label`、`href = /plugins/{code}/{path}`、图标按 `menu.icon` 映射（`dashboard`、`bar-chart-3`、`credit-card`、`file-text`、`package`、`settings`、`shield`、`users`，其它回退为分组图标）。
- 有效项数 > 0 才生成分组：`id = plugin-group:{code}`、标题 = 插件 `name`、徽标 = `v{version}`、分组图标按插件 `type`（`payment`→CreditCard、`theme`→LayoutDashboard、`feature`→Package、其它→Settings）。
- 所有插件分组按标题 `localeCompare` 升序，**追加在静态菜单之后**（“用户管理”分组下面）。
- 当前仓库所有插件都没有 `admin_menus`，所以实际不会出现插件分组。
- 【新UI】`AdminLayout` 从插件 store 计算插件分组，追加到 `menuGroups` 之后；图标映射到 ionicons（`dashboard`→`SpeedometerOutline`、`bar-chart-3`→`BarChartOutline`、`credit-card`→`CardOutline`、`file-text`→`DocumentTextOutline`、`package`→`CubeOutline`、`settings`→`SettingsOutline`、`shield`→`ShieldOutline`、`users`→`PeopleOutline`；分组图标 `payment`→`CardOutline`、`feature`→`ExtensionPuzzleOutline`（即已有的 `pluginAppsIcon`）、其它→`SettingsOutline`）。可选方案：把所有插件菜单收进一个“插件应用”（`nav.pluginApps`）分组——与官方结构不同，需主会话决定，默认按官方“每插件一组”。

### 4.2 路由解析规则（`r4t`）【官方】

输入：`pluginCode`；`subPath` = 通配部分去掉开头的 `/`（**不去末尾 `/`**）。在插件列表中找 `code === pluginCode` 的插件 `p`。

| 变量 | 计算 |
|---|---|
| `hasConfig` | `p.config` 存在且有键 |
| `tab` | `subPath === "settings" && hasConfig` ? `"settings"` : `"overview"` |
| `menu` | `admin_menus` 中规范化 `path` 等于规范化 `subPath` 的第一项（`subPath` 规范化为空时为 null） |
| `crud` | `subPath` 非空时 `p.admin_crud?.[subPath]`（**按原始 subPath 精确取键**，不做规范化）否则 null |
| `showTabs` | `!(menu \|\| crud \|\| (subPath && subPath !== "settings"))` |
| `notFoundPage` | `subPath` 非空 且 无 `menu` 且 无 `crud` 且 不是（`subPath === "settings"` 且 `hasConfig`） |
| 页面标题 | `crud.title \|\| menu.title \|\| p.name \|\| pluginCode \|\| "插件管理"` |
| 页面描述 | `crud.description \|\| menu.description \|\| p.description \|\| "Inspect plugin metadata, documentation, and configuration."` |

页头：`h2` 标题 + `v{version}` 描边徽标 + （`menu.label` 有值时）描边徽标；下面灰字描述。

### 4.3 渲染分支（按优先级）【官方】

| 条件 | 渲染 |
|---|---|
| 插件列表加载中 | 骨架：40×256、160×全宽、256×全宽 三块 |
| 找不到插件 | 卡片“Plugin not found” / “The requested plugin could not be found or is no longer available.” + 按钮“Back to plugin management”（→ `/config/plugin`） |
| 插件未启用（含未安装） | 卡片“Plugin is disabled” / “Enable this plugin from plugin management before opening its admin pages.” + 按钮“Back to plugin management” |
| 命中 `crud` | Schema CRUD 运行时（4.4），组件 key = `{code}:{subPath}` |
| 命中 `menu`（无 crud） | 卡片：标题 `menu.title`；说明 `menu.description \|\| "This page is contributed by the plugin. Custom rendering will be available in a future version."`；灰底信息框“Plugin: {name}”“Path: `/plugins/{code}/{path}`”；按钮“Back to overview”（→ `/plugins/{code}`） |
| `notFoundPage` | 卡片“Plugin page not found” / “This plugin page is not available in the current runtime fallback mode.” + “Back to overview” |
| `showTabs` | Tabs：“Overview”，有配置时再加 “Settings”；切换页签即导航（overview → `/plugins/{code}`，settings → `/plugins/{code}/settings`） |

**Overview 页签**：
1. 卡片“Plugin metadata”：两列网格——“作者: {author}”、“Code: `{code}`”、“Version: {version}”、“Status: 已启用/已禁用”。
2. （`admin_menus` 非空时）卡片“Declared plugin menus”：每项一个灰底框，第一行 `title` + `label` 徽标，第二行 `<code>/plugins/{code}/{path}</code>`。
3. 卡片“插件文档”（`plugin.readme.title`）：README 用 markdown-it（`html:false`）渲染，最高 70vh 滚动；无 README 显示“This plugin did not provide runtime documentation.”。

**Settings 页签**：卡片“配置”（`plugin.config.title`），内嵌 3.5 的配置表单；“取消”→ 导航回 overview；保存成功 → `refetch` 插件列表 + 失效 `["pluginList"]`（**不跳转**）。

【新UI】文案全部中文化：

| 官方英文 | 新后台中文 |
|---|---|
| Plugin not found / The requested plugin could not be found or is no longer available. | 插件不存在 / 请求的插件不存在或已被删除。 |
| Plugin is disabled / Enable this plugin from plugin management before opening its admin pages. | 插件未启用 / 请先在插件管理中启用该插件，再打开它的管理页面。 |
| Back to plugin management | 返回插件管理 |
| Back to overview | 返回概览 |
| This page is contributed by the plugin. Custom rendering will be available in a future version. | 该页面由插件声明，暂不支持自定义渲染。 |
| Plugin page not found / This plugin page is not available in the current runtime fallback mode. | 插件页面不存在 / 当前无法显示该插件页面。 |
| Overview / Settings | 概览 / 设置 |
| Plugin metadata | 插件信息 |
| Code / Version / Status | 标识 / 版本 / 状态 |
| Declared plugin menus | 已声明的菜单 |
| This plugin did not provide runtime documentation. | 该插件没有提供文档。 |
| Inspect plugin metadata, documentation, and configuration. | 查看插件信息、文档与配置。 |

### 4.4 Schema CRUD 运行时（`admin_crud`）

#### 4.4.1 Schema 格式【官方，依据 `v1t`/`i4t` 与演示 schema `b1t`】

`admin_crud` 是对象：键 = 子路径（与 `admin_menus[].path` 对应，例如 `"records"`），值 = schema：

| 字段 | 类型 | 说明 |
|---|---|---|
| `version` | number | 仅展示（演示页） |
| `title` | string | 页面标题 |
| `description` | string | 页面描述 |
| `id_field` | string | 主键字段名（编辑/删除时使用） |
| `api.list` | string | 列表接口，相对管理前缀，如 `/plugin/traffic-analytics/records/fetch` |
| `api.save` | string | 新建/编辑接口 |
| `api.delete` | string | 删除接口 |
| `columns[]` | array | 表格列：`key`（字段名）、`title`（表头）、`type`（`string`/`number`/`boolean`/`tag`/`datetime`）、`sortable`（bool）、`searchable`（bool）、`width`（px）、`options`（tag 用：`[{value,label,variant}]`，`variant` ∈ `default/secondary/destructive/outline`） |
| `form` | object | 表单字段，键 = 字段名，值 = 与插件配置相同的字段描述（3.5 表），**用 `value` 作为新建时默认值**，`required` 只显示星号 |
| `actions.create` / `actions.edit` / `actions.delete` | bool | 是否显示新建按钮 / 编辑按钮 / 删除按钮 |

#### 4.4.2 请求协议【官方】

| 动作 | 请求 | 期望响应 |
|---|---|---|
| 列表 | `GET /api/v2/{secure_path}{api.list}?current=<页码从1>&pageSize=<每页>`；有搜索词时加 `search=<词>`；有排序时加 `sort_field=<列key>&sort_order=asc\|desc`（只取第一个排序列） | `{ "data": [行...], "total": <总数> }`（形态 B/D；页面读 `body.data` 与 `body.total`） |
| 新建 | `POST {api.save}`，body = 表单字段对象 | 2xx 即成功 |
| 编辑 | `POST {api.save}`，body = `{ [id_field]: 原行主键, ...表单字段 }` | 2xx 即成功 |
| 删除 | `POST {api.delete}`，body = `{ [id_field]: 主键 }` | 2xx 即成功 |

- 注意分页参数名是驼峰 `pageSize`（与本项目其它接口的 `page_size`/`pageSize` 混用，以 schema 接口为准）。
- 查询 key：`["pluginCrud", code, api.list, {pageIndex,pageSize}, sorting, search]`；搜索框每次输入都触发请求（无防抖）；新建/编辑/删除成功后 `refetch`。
- 后端侧：这些接口必须由插件自己在 `routes/api.php` 注册（完整前缀需写成 `api/v2/{secure_path}/plugin/...` 并挂 `admin` 中间件，否则无鉴权）。**当前仓库没有任何插件提供这类接口**；演示用的 `/plugin/traffic-analytics/...` 在后端不存在（且 `traffic-analytics` 含中划线，不符合 code 规则）。

#### 4.4.3 表格与表单（`v1t`）【官方】

- 工具栏：有 `searchable` 列时左侧显示搜索框（占位 “Search...”，最大宽 sm）；`actions.create` 为真时右侧显示“Create”小按钮（Plus 图标）。
- 表格：通用 DataTable，默认每页 20，显示分页条；服务端模式（运行时页面）手动分页、手动排序；客户端模式（演示页）在前端分页/排序，搜索在前端对 `searchable` 列做不区分大小写的包含匹配。
- 单元格格式：
  - `datetime`：`null/undefined` → `-`；数字 `< 1e12` 当作秒（×1000），否则毫秒；非数字先 `Number()`，`NaN` 时原样字符串；`Intl.DateTimeFormat(默认语言,{year:numeric, month/day/hour/minute/second:2-digit})`。【新UI】用 `formatTime`（`yyyy-MM-dd HH:mm:ss`）。
  - `boolean`：真 → `default` 徽标“Yes”，假 → `outline` 徽标“No”。【新UI】“是/否”。
  - `tag`：在 `options` 中找 `value === String(值)`，用其 `variant`（默认 outline）与 `label`（没有时显示原值或 `-`）。
  - `number`：等宽数字，`String(值 ?? "-")`。
  - 其它：`String(值 ?? "-")`。
- 操作列（`actions.edit || actions.delete` 时追加，固定在右侧，宽 100）：编辑图标按钮（打开表单并回填）、删除图标按钮（红色，确认弹窗：“Delete record” / “Are you sure you want to delete this record? This action cannot be undone.” / “Delete” / “Cancel”；成功 toast “Deleted successfully”；失败只有拦截器 toast）。
- 表单弹窗：Dialog `sm:max-w-[520px]`；标题“Create”或“Edit”；描述“Fill in the fields below to create a new record.” / “Modify the fields below and save.”；字段用 3.5 的 `IYt` 渲染（滚动区最高 60vh）；底部 “Cancel” / “Save”（提交中 “Saving...”）。
  - 新建初值：`RYt(schema.form)`（即每项 `value`，json/yaml 字符串化）。
  - 编辑初值：每个 form 键取 `行[key] ?? form[key].value ?? ""`。
  - 成功 toast “Created successfully” / “Updated successfully” 并关闭；失败 toast “Save failed”（加拦截器 toast）。
  - 不做任何校验（`required` 不强制）。
- 【新UI】中文化（新建/编辑/删除/搜索.../是/否/创建成功/更新成功/删除成功/保存失败/确认删除该记录？此操作无法撤销。）；**强制 `required` 校验**；json 字段提交前校验；用 `usePagedTable` 风格的服务端分页（参数名按 4.4.2 发送）。

### 4.5 结论：插件能否向后台注入页面或菜单【后端 + 官方】

- **能声明，不能注入代码**：插件只能在 `config.json` 里**静态声明** `admin_menus`（侧边栏菜单项）和 `admin_crud`（由后台通用组件渲染的增删改查页面），`PluginController::index` 原样透传这两个字段。后台前端用自己的固定组件解释它们。
- 插件**不能**向后台 SPA 注入 JS/Vue/React 组件：`PluginManager` 只注册后端路由、视图（Blade 命名空间）、ServiceProvider、命令、计划任务，并把 `resources/assets` 复制到 `public/plugins/{code}`；后台前端没有加载这些资源的机制。
- 只声明 `admin_menus` 而没有对应 `admin_crud` 的菜单项，打开后只是一张“该页面由插件声明”的占位卡片。
- 插件自己的“设置页”就是 `/plugins/{code}/settings`（复用插件配置表单）。
- 插件的管理接口（CRUD 的 list/save/delete）要插件自己注册路由与鉴权。

---

## 5. 插件演示页（开发者演示，纯前端）

### 5.1 菜单演示（`/config/plugin/menu-demo`，`f1t`）【官方】

- 用途：让插件开发者预览 `admin_menus` 在侧边栏中的最终效果。**不调用任何接口**，状态只在页面内存中。
- 初始演示插件（`p1t`）：`code: traffic-analytics`、`name: Traffic Analytics`、`version: 1.2.0`、`type: feature`、已安装已启用、`admin_menus`：
  1. `{id:"overview", title:"Overview", path:"overview", icon:"dashboard", label:"default", description:"Plugin landing page"}`
  2. `{id:"reports", title:"Reports", path:"reports", icon:"bar-chart-3", description:"Traffic reporting center"}`
- 页头：“Plugin Menu CRUD Demo” / “Only menus declared in admin_menus are rendered into the sidebar. Edit them here to preview the final behavior.”
- 两栏（lg：1.2fr / 0.8fr）：
  - 左卡“Menu Items” + 右上“Add menu”按钮（新增项：`id = menu-{当前数量+1}`、`title/path/label/description` 为空、`icon = settings`）。每个菜单项一张虚线卡：标题（空时“Menu {n}”）、下方灰字显示计算出的 href、右上删除图标；内容两列：Title（占位 Reports）、Path（占位 reports）、Icon（下拉：Dashboard/Bar Chart/Credit Card/File Text/Package/Settings/Shield/Users，对应值 `dashboard/bar-chart-3/credit-card/file-text/package/settings/shield/users`）、Badge（占位 beta）。无菜单项时显示“This plugin currently declares no admin menus, so it will not appear in the sidebar at all.”
  - 右卡“Sidebar preview” / “This preview uses the same menu builder as the real runtime, so it mirrors final sidebar output.”：用与真实侧边栏相同的构建函数生成分组：分组图标 + 名称 + 版本徽标，下面每个子项一行（图标、标题、右侧 `<code>href</code>`）。无输出时“No sidebar entries will be rendered for this plugin.”
- 【新UI】中文化；菜单构建函数与 4.1 共用同一实现（保证预览即真实效果）。

### 5.2 Schema CRUD 演示（`/config/plugin/crud-demo`，`C1t`）【官方】

- 用途：演示 `admin_crud` schema 渲染效果。**不调用接口**：数据在内存中，保存延迟 400ms、删除延迟 300ms 模拟网络；新建记录 `id` 从 100 递增，`created_at` 为当前秒。
- 页头：“Schema CRUD Demo” / “A complete list + create / edit / delete page generated from a single JSON schema.”
- 两栏（xl：1fr / 380px）：左侧 4.4.3 的表格（客户端模式）；右侧卡片“Schema declaration” + `v1` 徽标 + `<pre>` 显示 schema JSON（最高 70vh 滚动）。
- 演示 schema（`b1t`，完整）：
  - `title: "Traffic Records"`，`description: "Demonstrates a full CRUD page driven entirely by a JSON schema."`，`id_field: "id"`，`api: {list: "/plugin/traffic-analytics/records/fetch", save: ".../save", delete: ".../delete"}`。
  - `columns`：`id`（ID，number，可排序，宽 80）、`domain`（Domain，string，可搜索）、`requests`（Requests，number，可排序）、`status`（Status，tag：`active`→Active/default、`inactive`→Inactive/secondary、`blocked`→Blocked/destructive）、`is_monitored`（Monitored，boolean）、`created_at`（Created，datetime，可排序）。
  - `form`：`domain`（string，Domain，占位 “e.g. example.com”，required）、`requests`（number，Requests，占位 “0”，value 0）、`status`（select，Status，value `active`，选项 Active/Inactive/Blocked）、`is_monitored`（boolean，“Enable monitoring”，说明 “When enabled, traffic will be tracked in real-time.”，value false）、`notes`（text，Notes，占位 “Optional notes about this record...”）。
  - `actions: {create: true, edit: true, delete: true}`。
- 种子数据：12 条，域名依次 `api/cdn/app/static/ws/auth/billing/docs/admin/metrics/gateway/webhook.example.com`，`id` 1-12，`requests` 随机 0-99999，`status` 按 active/inactive/blocked 轮换，`is_monitored = (n % 3 != 2)`，偶数下标 `notes = "Auto-generated seed record"`，`created_at` = 当前秒 − n 天。
- 【新UI】可直接复用 4.4 的组件以客户端模式渲染；中文化；属于开发者演示，可放在插件管理页“开发者演示”下拉里。

---

## 6. 系统运维（system 接口）

### 6.1 官方 UI 的使用情况【官方】

| 接口 | 官方是否调用 | 位置 |
|---|---|---|
| `GET system/getQueueStats` | 是 | 仪表盘“队列状态/作业详情”两张卡，每 30 秒刷新（`core.md` §7.5） |
| `GET system/getHorizonFailedJobs` | 是 | 仪表盘“失败任务详情”弹窗，`current` + `page_size=10`（`core.md` §7.5） |
| `GET system/getSystemStatus` | 否（只定义） | — |
| `GET system/getQueueWorkload` | 否（只定义） | — |
| `GET system/getQueueMasters` | 否（只定义） | — |
| `ANY system/getAuditLog` | 否（bundle 中不存在） | — |

仪表盘队列卡的 UI、文案与修正建议以 `core.md` §7.5 / §12.1-5,6,7,11,12 为准，本文不重复；新后台的“系统状态”页（6.3）复用同一套字段解释。

### 6.2 接口明细

#### 6.2.1 `GET system/getSystemStatus`

- 参数：无。响应（形态 A）`data`：

| 字段 | 类型 | 含义 |
|---|---|---|
| `schedule` | bool | 调度器是否在运行：缓存 `SCHEDULE_LAST_CHECK_AT` 在 120 秒以内为真（`Console\Kernel::schedule()` 每次 `schedule:run` 时写入 `time()`）；从未运行时为假 |
| `horizon` | bool | Horizon 是否在运行：存在 master supervisor 且没有任何一个处于 `paused` |
| `schedule_last_runtime` | int \| null | 最近一次调度心跳（Unix 秒） |

#### 6.2.2 `GET system/getQueueStats`

- 参数：无。响应（形态 A）`data`：

| 字段 | 类型 | 含义与注意 |
|---|---|---|
| `status` | bool | 同 `getSystemStatus.horizon` |
| `failedJobs` | int | 最近失败任务数（Horizon `countRecentlyFailed()`，窗口 = `periods.failedJobs` 分钟） |
| `recentJobs` | int | 最近任务数（`countRecent()`，窗口 = `periods.recentJobs` 分钟） |
| `jobsPerMinute` | number | 每分钟处理量（依赖 `horizon:snapshot`，本项目每 5 分钟调度一次） |
| `processes` | int | 所有 supervisor 进程数合计 |
| `pausedMasters` | int | 暂停的 master 数 |
| `periods.failedJobs` | int | `config('horizon.trim.recent_failed')` = **10080（分钟，= 7 天）** |
| `periods.recentJobs` | int | `config('horizon.trim.recent')` = **60（分钟）** |
| `queueWithMaxRuntime` | string \| null | 【推断】运行时间最长的**队列名**（Horizon 5 返回字符串，不是对象） |
| `queueWithMaxThroughput` | string \| null | 【推断】吞吐量最高的**队列名** |
| `wait` | object \| `[]` | 【推断】`{"redis:default": <秒>}`，键为“连接:队列”，只取等待最长的 1 个；没有队列时是 `[]` |

【新UI】显示规则：等待时间取 `Object.values(wait ?? {})[0] ?? 0`；时长按分钟换算（60 → “1 小时”，10080 → “7 天”）；`queueWithMax*` 按字符串显示队列名（null → “—”），不显示进度条。

#### 6.2.3 `GET system/getQueueWorkload`

- 参数：无。响应（形态 A）`data`：数组，按 `name` 升序。【推断】元素（Horizon 5 `RedisWorkloadRepository::get()`）：

| 字段 | 类型 | 含义 |
|---|---|---|
| `name` | string | 队列名（不含连接前缀；组合队列为逗号分隔） |
| `length` | int | 待处理任务数 |
| `wait` | int | 预计等待秒数 |
| `processes` | int | 分配给该队列的进程数 |
| `split_queues` | array \| null | 组合队列时，每个子队列 `{name, length, wait}` |

#### 6.2.4 `GET system/getQueueMasters`

- 直接路由到 `Laravel\Horizon\Http\Controllers\MasterSupervisorController@index`，**没有 success 包装**（形态 D，整个 body）。
- 【推断】响应是以 master 名为键的对象：`{ "<master名>": { "name", "environment", "pid", "status": "running"|"paused", "supervisors": [ { "name", "master", "pid", "status", "processes": {"redis:default": <进程数>}, "options": { "queue", "balance", "maxProcesses", "minProcesses", "timeout", "tries", ... } } ] } }`；没有 master 时为 `[]` 或 `{}`。【新UI】实现前需在测试实例上实测确认字段，代码里对缺失字段做容错。

#### 6.2.5 `GET system/getHorizonFailedJobs`

- 参数：`current`（默认 1，`max(1, …)`）、`page_size`（默认 20，**强制 ≥ 10**，无上限）。
- 响应（形态 D）：`{ "data": FailedJob[], "total": int, "current": int, "page_size": int }`。
- 实现：`collect(getFailed())->sortByDesc('failed_at')->slice(offset, size)`，`total = countFailed()`。【推断】`getFailed()` 不传参只返回最近 50 条，因此超过 50 条之后的页为空，但 `total` 是全部数量（`core.md` §12.1-11）。【新UI】分页器总数取 `min(total, 50)` 并在表格下方提示“仅显示最近 50 条失败任务”，或保留 `total` 但空页给出提示——推荐前者。
- 【推断】`FailedJob` 字段：`id`（UUID）、`connection`、`queue`、`name`（任务类名）、`status`（`failed`）、`payload`（JSON 字符串）、`exception`（含堆栈的字符串）、`context`（JSON 字符串或 null）、`failed_at`（带小数的秒级时间戳**字符串**，如 `"1730000000.1234"`）、`completed_at`、`retried_by`、`reserved_at`、`index`。
- 后端**没有**重试/删除失败任务的接口（语言包 `dashboard.queue.actions.retry/cancel/delete` 未使用）。

#### 6.2.6 `ANY system/getAuditLog`

- 方法：路由是 `any`。**建议 GET**（POST 会让这次查询本身也写一条审计日志，action 为 `system.getAuditLog`）。
- 参数：

| 参数 | 类型 | 规则 |
|---|---|---|
| `current` | int | 默认 1，`max(1, …)` |
| `page_size` | int | 默认 10，**强制 ≥ 10，无上限**（新UI 只提供 10/20/50/100） |
| `action` | string | 精确匹配（如 `user.update`） |
| `admin_id` | int | 精确匹配 |
| `keyword` | string | `uri LIKE %kw% OR request_data LIKE %kw%` |

- 排序：`id DESC`（固定）。
- 响应（形态 D）：`{ "data": AuditLog[], "total": int }`，`AuditLog`：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int | |
| `admin_id` | int | 操作管理员用户 ID |
| `action` | string | 由路径推导：去掉 `api/v2/{secure_path}/` 前缀，`-` 换成 `_`，最后一段为方法，其余段用 `_` 连接，形如 `server_manage.batchDelete`、`gift_card.create_template`、`traffic_reset.reset_user`（camelCase 保留，见 6.5） |
| `method` | string | 恒为 `POST`（只记录 POST） |
| `uri` | string | 完整请求 URI（含 `/api/v2/{secure_path}/` 与查询串） |
| `request_data` | string | 请求体 JSON 字符串（`JSON_UNESCAPED_UNICODE`），已去掉**顶层**键 `password`、`token`、`secret`、`key`、`api_key`；上传请求里的文件对象编码为 `{}` |
| `ip` | string \| null | 客户端 IP（受 `TrustProxies` 影响） |
| `created_at` | int | Unix 秒 |
| `updated_at` | int | Unix 秒 |
| `admin` | `{id, email}` \| null | 管理员已删除时为 null |

- 记录规则（`RequestLog`）：管理路由上所有 POST（**包括失败的请求**，例如 422/400/500 也会记录）；GET 不记录。
- 保留期：`reset:log` 每天清理 **3 个月前**的记录。

### 6.3 新后台“系统状态”页（`/config/system-status`）【超出官方】【新UI】

admin-next 已有该路由与菜单项。建议内容（全部只读，进入页面时加载，之后每 30 秒自动刷新；右上角“刷新”按钮；任一接口失败只影响对应卡片并显示“加载失败，点击重试”）：

1. **运行状态**（`getSystemStatus`）：两个状态块
   - “计划任务”：`schedule` 真 → 绿色“运行中”，假 → 红色“未运行”；下方“最近一次运行：{formatTime(schedule_last_runtime)}（{相对时间}）”，为 null 时“从未运行”。红色时提示“请检查 `php artisan schedule:run` 是否每分钟执行（cron/supervisor）”。
   - “队列服务（Horizon）”：`horizon` 真 → 绿色“运行中”，假 → 红色“未运行或已暂停”，提示“请检查 `php artisan horizon` 进程”。
2. **队列概览**（`getQueueStats`）：统计格——近期任务数（`recentJobs`，副标题“最近 {换算后的 periods.recentJobs}”）、每分钟处理量（`jobsPerMinute`）、失败任务数（`failedJobs`，红色，副标题“最近 {换算后的 periods.failedJobs}”，点击滚动到第 5 块）、活跃进程（`processes`，旁注暂停 master 数 `pausedMasters`）、当前最长等待（`Object.values(wait)[0] ?? 0` 秒）、吞吐量最高队列（`queueWithMaxThroughput` 或“—”）、运行最久队列（`queueWithMaxRuntime` 或“—”）。
3. **队列负载**（`getQueueWorkload`）：表格列——队列（`name`）、待处理（`length`）、预计等待（`wait` 秒，>60 标黄、>300 标红）、进程数（`processes`）；`split_queues` 非空时可展开子行。空数据“暂无队列”。前端分页不需要。
4. **Horizon 进程**（`getQueueMasters`）：每个 master 一个折叠面板，标题“{name}”+ 状态标签（`running`→成功色“运行中”，`paused`→警告色“已暂停”，其它→默认色原值）+ PID；内含 supervisor 表格：名称、状态、PID、进程数（`processes` 各值求和）、队列（`options.queue`）。字段缺失时显示“—”。空数据“未检测到 Horizon 主进程”。
5. **失败任务**（`getHorizonFailedJobs`）：表格列与详情弹窗同 `core.md` §7.5（时间、队列、任务名称、异常信息首行、查看详情），服务端分页（`current`、`page_size` 取 10/20/50），详情里 `failed_at` 也要格式化、`payload` 美化 JSON、`exception` 提供“复制”按钮（`CopyText`）。

### 6.4 新后台“审计日志”页（`/config/audit-log`）【超出官方】【新UI】

- 页头：标题“审计日志”，描述“记录管理员在后台执行的所有写操作（POST 请求），保留 3 个月。”
- 工具栏（`.toolbar`）：
  - “操作”下拉（`n-select`，`filterable`、`clearable`、`tag` 模式允许输入任意 action）：选项来自 6.5 表，显示“中文名（action）”，值为 action；对应参数 `action`。
  - “管理员 ID”数字输入（`clearable`）→ `admin_id`。
  - 关键词输入（占位“搜索请求路径或请求数据”，回车或 400ms 防抖触发）→ `keyword`。
  - “重置”按钮清空所有筛选并回到第 1 页；“刷新”按钮。
- 表格（服务端分页 `usePagedTable`：`GET system/getAuditLog`，`current`、`page_size`，页大小 10/20/50/100，默认 20；读 `body.data` / `body.total`）：

| 列 | 字段 | 显示 |
|---|---|---|
| ID | `id` | 等宽 |
| 时间 | `created_at` | `formatTime`（`yyyy-MM-dd HH:mm:ss`） |
| 管理员 | `admin.email` | 无 admin 时显示“#{admin_id}（已删除）”；点击可把 `admin_id` 填入筛选 |
| 操作 | `action` | 主文本为 6.5 的中文名（未知 action 显示原值），下方小号等宽灰字显示原 action；点击可填入筛选 |
| 请求路径 | `uri` | 去掉 `/api/v2/{secure_path}` 前缀后显示（不要在界面上暴露 secure_path），悬停显示完整值 |
| IP | `ip` | 等宽；null → “—” |
| 请求数据 | `request_data` | 单行截断（最多 60 字符）；“查看”按钮打开弹窗：美化 JSON（`JSON.parse` 失败则原文），带“复制”按钮 |

- 移动端：`scroll-x`。
- 空状态：“暂无审计记录”。
- 安全提示（页面顶部 `n-alert type="warning"`，可关闭）：“请求数据可能包含插件/支付配置中的密钥等敏感信息（只有顶层 password/token/secret/key/api_key 字段会被过滤），请勿外传截图。”

### 6.5 审计 action 枚举（由 `AdminRoute.php` 全部 POST/ANY 路由推导）

> 只有以 POST 调用时才会出现。`any` 路由（标 *）官方前端以 POST 调用的会出现（详见各域规格）。

| action | 中文名 | action | 中文名 |
|---|---|---|---|
| `config.save` | 保存系统配置（含切换主题） | `config.setTelegramWebhook` | 设置 Telegram Webhook |
| `config.testSendMail` | 发送测试邮件 | `mail_template.save` | 保存邮件模板 |
| `mail_template.reset` | 恢复默认邮件模板 | `mail_template.test` | 测试邮件模板 |
| `plan.save` | 保存套餐 | `plan.drop` | 删除套餐 |
| `plan.update` | 更新套餐状态 | `plan.sort` | 套餐排序 |
| `server_group.save` | 保存权限组 | `server_group.drop` | 删除权限组 |
| `server_route.save` | 保存路由 | `server_route.drop` | 删除路由 |
| `server_manage.update` | 更新节点状态 | `server_manage.save` | 保存节点 |
| `server_manage.drop` | 删除节点 | `server_manage.copy` | 复制节点 |
| `server_manage.sort` | 节点排序 | `server_manage.batchDelete` | 批量删除节点 |
| `server_manage.batchUpdate` | 批量更新节点 | `server_manage.resetTraffic` | 重置节点流量 |
| `server_manage.batchResetTraffic` | 批量重置节点流量 | `server_machine.save` | 保存服务器 |
| `server_machine.drop` | 删除服务器 | `server_machine.resetToken` | 重置服务器令牌 |
| `order.fetch`* | 查询订单 | `order.update` | 更新订单 |
| `order.assign` | 分配订单 | `order.paid` | 标记订单已支付 |
| `order.cancel` | 取消订单 | `order.detail` | 查看订单详情 |
| `user.fetch`* | 查询用户 | `user.update` | 更新用户 |
| `user.generate` | 生成用户 | `user.dumpCSV` | 导出用户 CSV |
| `user.sendMail` | 发送邮件 | `user.ban` | 批量封禁用户 |
| `user.resetSecret` | 重置用户密钥 | `user.setInviteUser` | 设置邀请人 |
| `user.destroy` | 删除用户 | `stat.getStatUser`* | 查询用户流量记录 |
| `notice.save` | 保存公告 | `notice.update` | 更新公告 |
| `notice.drop` | 删除公告 | `notice.show` | 切换公告显示 |
| `notice.sort` | 公告排序 | `ticket.fetch`* | 查询工单 |
| `ticket.reply` | 回复工单 | `ticket.close` | 关闭工单 |
| `coupon.fetch`* | 查询优惠券 | `coupon.generate` | 生成优惠券 |
| `coupon.drop` | 删除优惠券 | `coupon.show` | 切换优惠券显示 |
| `coupon.update` | 更新优惠券 | `gift_card.templates`* | 查询礼品卡模板 |
| `gift_card.create_template` | 创建礼品卡模板 | `gift_card.update_template` | 更新礼品卡模板 |
| `gift_card.delete_template` | 删除礼品卡模板 | `gift_card.generate_codes` | 生成兑换码 |
| `gift_card.codes`* | 查询兑换码 | `gift_card.toggle_code` | 切换兑换码状态 |
| `gift_card.update_code` | 更新兑换码 | `gift_card.delete_code` | 删除兑换码 |
| `gift_card.usages`* | 查询使用记录 | `gift_card.statistics`* | 查询礼品卡统计 |
| `knowledge.save` | 保存知识 | `knowledge.show` | 切换知识显示 |
| `knowledge.drop` | 删除知识 | `knowledge.sort` | 知识排序 |
| `payment.getPaymentForm` | 获取支付表单 | `payment.save` | 保存支付方式 |
| `payment.drop` | 删除支付方式 | `payment.show` | 切换支付方式显示 |
| `payment.sort` | 支付方式排序 | `system.getAuditLog`* | 查询审计日志 |
| `theme.upload` | 上传主题 | `theme.delete` | 删除主题 |
| `theme.getThemeConfig` | 读取主题配置 | `theme.saveThemeConfig` | 保存主题配置 |
| `plugin.upload` | 上传插件 | `plugin.delete` | 删除插件 |
| `plugin.install` | 安装插件 | `plugin.uninstall` | 卸载插件 |
| `plugin.enable` | 启用插件 | `plugin.disable` | 禁用插件 |
| `plugin.config` | 保存插件配置 | `plugin.upgrade` | 升级插件 |
| `traffic_reset.reset_user` | 重置用户流量 | | |

- 插件自己注册在管理前缀下的路由不会经过 `log` 中间件（除非插件自己挂上），通常不会出现在审计日志里。

---

## 7. 系统更新（`update/*`，已注释）

- 【后端】`AdminRoute.php` 中 `update/check`（GET → `UpdateController::checkUpdate`）与 `update/execute`（POST → `executeUpdate`）两条路由**已被注释**，接口不可用（请求会 404）。
- `UpdateService::checkForUpdates()` 会请求 GitHub API 比较 commit，返回 `{has_update, is_local_newer, latest_version, current_version, update_logs[{version,message,author,date,is_local}], download_url, published_at, author}`；`executeUpdate()` 会备份数据库、`git pull`、迁移、清缓存、写更新标记、重启 Octane，失败返回 `fail([500, message])`。
- 【官方】bundle 中没有更新 UI，语言包 `common.update.*` 未使用。
- 【新UI】**不实现**。若将来要做，需要先在后端恢复路由（超出本次授权），且这是高危的生产变更操作（代码拉取、数据库迁移、进程重启），必须主会话单独决定。本 fork 的发布流程以镜像为准，不适合在线 git 更新。

---

## 8. 其它页面归属核对（本域负责兜底）

官方路由表（1.1 与 `core.md` §6.4）中的全部页面均已被各域覆盖：

| 页面 | 归属 |
|---|---|
| `/sign-in`、布局（侧边栏、命令面板 ⌘K、主题/语言切换、用户菜单）、`/500` `/404` `/503`、仪表盘 `/` | `core.md` |
| `/config/system/*`（含隐藏的 `frontend`、`subscribe-template`） | `settings.md` |
| `/config/payment`、`/finance/*` | `commerce.md` |
| `/config/notice`、`/config/knowledge`、`/user/ticket` | `content.md` |
| `/server/*` | `nodes.md` |
| `/user/manage`、`/user/traffic-reset-logs` | `users.md` |
| `/config/plugin`、`/config/plugin/menu-demo`、`/config/plugin/crud-demo`、`/config/theme`、`/plugins/:pluginCode/*` | 本文 |

没有发现其它未归属的页面或功能。官方 bundle 中与本域相关但**未启用**的残留：`common.update.*`（系统更新文案）、`nav.pluginApps`、`nav.pluginMenuDemo`、`dashboard.queue.status.pending/processing/completed/failed/cancelled`、`dashboard.queue.actions.*`、`dashboard.queue.empty/loading/error`。

---

## 9. 差异与风险

### 9.1 官方 UI 与后端不一致 / 官方缺陷（新后台应修正，均不需改后端）

| # | 问题 | 新后台处理 |
|---|---|---|
| P1 | 插件操作失败时 toast 两次（拦截器 + 页面 catch） | 只提示一次 |
| P2 | 插件列表加载时只有“所有插件”页签显示骨架，默认的“功能”页签空白 | 所有页签显示骨架 |
| P3 | 插件/主题列表无空状态 | `n-empty` |
| P4 | 插件配置 `number` 字段清空后提交 `0`（`Number("")`） | 清空提交 `null`（后端存 null，读取回落默认值） |
| P5 | 插件配置 `json` 字段不校验 JSON 合法性 | 提交前校验 |
| P6 | 插件配置 `select` 的 `options` 若为对象映射会使官方页面崩溃 | 兼容数组与对象两种格式 |
| P7 | `required` 从不生效（后端 GET 不返回 `required`；CRUD 表单也不校验） | CRUD 表单强制校验；插件配置因后端不返回 `required`，保持不校验 |
| P8 | 插件运行时页面、CRUD、演示页文案全是英文 | 中文化 |
| P9 | README 渲染：官方 markdown-it `html:false` 安全；新后台用 `marked` 默认会透传 HTML | 禁止原始 HTML（3.6） |
| T1 | 主题上传/删除/激活的成功提示是硬编码中文，`theme.description` 提到“V2board” | 文案可保留；描述可改为“Xboard” |
| T2 | 主题 `getThemes` 无主题时返回 `[]`；`getThemeConfig` 可能返回 `null`（官方会报错） | 兼容 |
| T3 | 主题配置值为 `null` 时官方把 null 塞进受控输入框 | 回填时 `null → ""` |
| T4 | 主题 `configs` 为空时官方仍可保存并得到 422 | 显示“没有可配置项” |
| T5 | 主题文件名限制只在后端检查 | 前端预检（2.7） |
| T6 | `ThemeController::upload` 检查 `base_path('theme')`（系统主题目录）是否可写，而用户主题实际写到 `storage/theme`；容器中系统目录只读时会误报“主题目录无写入权限” | 前端如实展示后端错误；修复需改后端（超出本次范围，记录） |
| T7 | `can_delete`、删除校验依据 `current_theme`，`active` 依据 `frontend_theme`；两者正常同步，但手工改库或旧数据时可能不一致 | 删除前同时校验 `key !== active`（同官方） |
| T8 | 主题删除/配置失败是 500，生产环境看不到原因 | 统一提示“操作失败，请查看服务器日志”，附 HTTP 状态 |
| S1 | 队列卡时长单位、`wait.default`、`queueWithMax*` 结构、失败任务 50 条限制、`failed_at` 详情未格式化 | 见 `core.md` §12.1-5,6,7,11,12 与 6.2 |
| B1 | `plugin/getPlugins` 对缺 `name/version/description/author` 的插件目录直接抛异常，整个接口 500，插件页与侧边栏插件菜单都会失效 | 前端对该接口失败给出明确提示“插件列表加载失败（可能存在格式错误的插件包）”；侧边栏静默降级（不显示插件分组） |
| B2 | `plugin/config` GET 对缺 `type` 或缺 `default` 的配置项返回 400 | 显示后端错误，不渲染表单 |
| B3 | `plugin/disable` 没有异常处理，插件类缺失时 500 | 前端如实提示 |

### 9.2 后端有、官方 UI 未使用的能力

- `system/getSystemStatus`、`getQueueWorkload`、`getQueueMasters`、`getAuditLog` → 新后台 6.3 / 6.4 使用（【超出官方】）。
- `plugin/getPlugins?type=` 服务端类型过滤 → 不需要（前端过滤即可）。
- `plugin/types` 的 `description`、`icon` → 可作为页签 Tooltip（可选）。
- `ThemeController::switchTheme`（无路由，不可用）。
- `update/check`、`update/execute`（路由已注释，不可用，第 7 节）。

### 9.3 危险操作清单（新后台必须二次确认，确认文案写清后果）

| 操作 | 后果 | 建议确认文案 |
|---|---|---|
| 卸载插件 | 回滚插件数据库迁移（**删除插件数据表**）并删除插件配置 | “卸载将删除该插件的数据表和配置，且无法恢复。确定卸载 {name}？” |
| 删除插件 | 若已安装会先卸载（同上），再删除插件文件 | “将删除插件文件{若已安装:并清除其数据与配置}，无法撤销。确定删除 {name}？” |
| 升级插件 | 过程中插件被禁用；运行新迁移；失败可能停留在禁用状态 | 同官方文案 + “升级失败时请检查插件是否需要手动重新启用” |
| 禁用支付插件 | 该支付方式下单与**支付回调**全部失败（`PaymentService` 报 `payment method is unavailable`），可能造成已付款订单无法开通 | 见 3.3 |
| 禁用 Telegram 插件 | Bot 命令、工单/支付通知停止 | “禁用后 Telegram 通知与机器人命令将停止工作。” |
| 上传插件 / 上传主题 | 在服务器上安装可执行代码；同名更高版本会覆盖旧文件（插件已安装时自动升级） | 弹窗内常驻警告（2.7、3.7） |
| 删除主题 | 删除主题文件与其保存的配置 | 同官方 + “同时删除该主题的配置” |
| 切换主题 | 立即影响所有前台用户；会删除旧主题的公共目录并重新复制 | 可选确认（2.4） |
| 保存主题 `custom_html` | 原样输出到前台页面 | 字段提示（2.5） |

### 9.4 安全

1. **审计日志泄露敏感配置**：`RequestLog` 只过滤请求体**顶层**的 5 个键；`plugin/config`（`config.*`）、`payment/save`（`config.*`）、`config/save`（如 `telegram_bot_token`、`email_password` 等键名不完全等于过滤名）里的密钥会被明文写入 `v2_admin_audit_log.request_data`。新后台审计日志页需加警告（6.4）；改进过滤需改后端（超出本次范围，记录待办）。
2. **上传即代码执行**：插件包含 PHP、主题包含 Blade，均为管理员级远程代码执行能力，属设计如此；新后台在 UI 上明确提示即可。
3. **README / 主题描述渲染**：只按文本或安全 Markdown 渲染，禁止 `v-html` 原始 HTML（3.6）。
4. **plugin/delete 的 403**：官方会误登出；新后台 `http.ts` 已只在 `Unauthorized` 时登出，保持即可。
5. **审计日志 `uri` 含 secure_path**：界面显示时去掉前缀（6.4）。

---

## 10. 新后台实现要点

### 10.1 类型定义（建议放 `src/api/platform.ts`）

```ts
// ---- theme ----
export interface ThemeConfigField {
  label?: string
  placeholder?: string
  field_name: string
  field_type: 'input' | 'textarea' | 'select' | string
  select_options?: Record<string, string>
  default_value?: string
}
export interface ThemeInfo {
  name: string
  description?: string
  version?: string
  images?: string[] | string
  background_url?: string
  configs?: ThemeConfigField[]
  can_delete: boolean
  is_system: boolean
  [k: string]: unknown
}
export interface ThemeList { themes: Record<string, ThemeInfo> | []; active: string }

// ---- plugin ----
export type PluginType = 'feature' | 'payment' | string
export interface PluginTypeOption { value: PluginType; label: string; description: string; icon: string }
export interface PluginConfigItem {
  type: 'string' | 'number' | 'percentage' | 'select' | 'boolean' | 'text' | 'json' | 'yaml' | string
  label?: string
  placeholder?: string
  description?: string
  value?: unknown       // 已安装时存在
  default?: unknown     // 未安装时（原始 config.json）存在
  options?: { value: string; label: string }[] | Record<string, string>
  required?: boolean    // 仅 admin_crud.form 中可能出现
}
export interface PluginAdminMenu { id: string; title: string; path: string; icon?: string; label?: string; description?: string }
export interface PluginCrudColumn {
  key: string; title: string
  type?: 'string' | 'number' | 'boolean' | 'tag' | 'datetime'
  sortable?: boolean; searchable?: boolean; width?: number
  options?: { value: string; label: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' }[]
}
export interface PluginCrudSchema {
  version?: number; title?: string; description?: string; id_field: string
  api: { list: string; save: string; delete: string }
  columns: PluginCrudColumn[]
  form: Record<string, PluginConfigItem>
  actions: { create?: boolean; edit?: boolean; delete?: boolean }
}
export interface PluginInfo {
  code: string; name: string; version: string; description: string; author: string
  type: PluginType
  is_installed: boolean; is_enabled: boolean; is_protected: boolean; can_be_deleted: boolean
  config: Record<string, PluginConfigItem> | []
  readme: string
  need_upgrade: boolean
  admin_menus: PluginAdminMenu[] | null
  admin_crud: Record<string, PluginCrudSchema> | null
}

// ---- system ----
export interface SystemStatus { schedule: boolean; horizon: boolean; schedule_last_runtime: number | null }
export interface QueueStats {
  status: boolean; failedJobs: number; recentJobs: number; jobsPerMinute: number
  processes: number; pausedMasters: number
  periods: { failedJobs: number; recentJobs: number }   // 分钟
  queueWithMaxRuntime: string | null | Record<string, unknown>
  queueWithMaxThroughput: string | null | Record<string, unknown>
  wait: Record<string, number> | []
}
export interface QueueWorkloadItem { name: string; length: number; wait: number; processes: number; split_queues: { name: string; length: number; wait: number }[] | null }
export interface FailedJob {
  id: string; connection: string; queue: string; name: string; status?: string
  payload: string; exception: string; context?: string | null
  failed_at: string | number; [k: string]: unknown
}
export interface AuditLog {
  id: number; admin_id: number; action: string; method: string; uri: string
  request_data: string | null; ip: string | null; created_at: number; updated_at: number
  admin: { id: number; email: string } | null
}
```

### 10.2 接口函数清单（`src/api/platform.ts`）

| 函数 | 调用 | 返回 |
|---|---|---|
| `getThemes()` | `http.get('/theme/getThemes')` | `ThemeList` |
| `uploadTheme(file)` | `http.upload('/theme/upload', { file })` | `true` |
| `deleteTheme(name)` | `http.post('/theme/delete', { name })` | `true` |
| `getThemeConfig(name)` | `http.post('/theme/getThemeConfig', { name })` | `Record<string, any> \| null` |
| `saveThemeConfig(name, config)` | `http.post('/theme/saveThemeConfig', { name, config })` | `Record<string, any>` |
| `activateTheme(name)` | `http.post('/config/save', { frontend_theme: name })` | `true` |
| `getPluginTypes()` | `http.get('/plugin/types')` → `.data` | `PluginTypeOption[]` |
| `getPlugins()` | `http.get('/plugin/getPlugins')` → `.data` | `PluginInfo[]` |
| `installPlugin/uninstallPlugin/enablePlugin/disablePlugin/upgradePlugin/deletePlugin(code)` | `http.post('/plugin/<action>', { code })` | `{ message }` |
| `uploadPlugin(file)` | `http.upload('/plugin/upload', { file })` | `{ message }` |
| `getPluginConfig(code)` | `http.get('/plugin/config', { code })` → `.data` | `Record<string, PluginConfigItem> \| []` |
| `savePluginConfig(code, config)` | `http.post('/plugin/config', { code, config })` | `{ message }` |
| `crudList(path, params)` / `crudSave(path, body)` / `crudDelete(path, body)` | `http.get(path, params)` / `http.post(path, body)` | `{ data, total }` / 任意 |
| `getSystemStatus()` | `http.get('/system/getSystemStatus')` | `SystemStatus` |
| `getQueueStats()` | `http.get('/system/getQueueStats')` | `QueueStats` |
| `getQueueWorkload()` | `http.get('/system/getQueueWorkload')` | `QueueWorkloadItem[]` |
| `getQueueMasters()` | `http.get('/system/getQueueMasters')` | 原始对象 |
| `getHorizonFailedJobs({current, page_size})` | `http.get('/system/getHorizonFailedJobs', …)` | `{ data: FailedJob[], total, current, page_size }` |
| `getAuditLog({current, page_size, action?, admin_id?, keyword?})` | **GET** `http.get('/system/getAuditLog', …)`（空值不传） | `{ data: AuditLog[], total }` |

### 10.3 适配函数（建议）

- `pluginConfigToFields(schema): DynamicField[]`：按 3.5 表把 `PluginConfigItem` 映射成 `DynamicField`（`string→input`、`number/percentage→number`（percentage 加 min/max）、`select→select`（options 归一化）、`boolean→switch`、`text→textarea`、`json→json`、`yaml→code`；未知类型不生成字段但保留值）。`label = item.label || item.description || key`；`description = item.label ? item.description : undefined`。
- `pluginConfigToValues(schema)`：等价 `RYt`（json/yaml 字符串化）。
- `themeConfigToFields(configs)`：按 2.5 表映射；`label = field.label || field.field_name`。
- `buildPluginMenuGroups(plugins)`：等价 `Zlt`（4.1），菜单演示页与侧边栏共用。
- `normalizeMenuPath(p) = p.trim().replace(/^\/+/, '').replace(/\/+$/, '')`。
- `formatMinutes(min)`：`< 60` → “{n} 分钟”；整除 1440 → “{n} 天”；否则 “{n/60} 小时”。

### 10.4 验收清单

主题：
- [ ] 卡片网格响应式 1/2/3 列；显示名称、描述、版本；当前主题按钮为“当前主题”且禁用。
- [ ] 激活主题只提交 `{frontend_theme}`，成功提示并刷新列表。
- [ ] 主题设置弹窗：打开时加载配置并回填（null 显示为空），input/textarea/select 三种控件正确，`select_options` 对象转选项；保存只提交声明的键；成功关闭。
- [ ] Xboard 主题三个配置项（主题色、背景、自定义页脚HTML）可读写；`custom_html` 有安全提示。
- [ ] 预览弹窗：仅 `images` 为非空数组时可用，循环切换、缩略图跳转。
- [ ] 上传：拖拽与点击两种方式；前端预检扩展名、大小、文件名；上传中禁止重复提交；成功刷新列表。
- [ ] 删除：仅 `can_delete` 显示；当前主题禁止删除；确认后成功刷新。

插件：
- [ ] 页签：功能 / 支付方式 / 所有插件，默认“功能”；搜索（名称/描述/code）与安装状态筛选叠加生效；所有页签有骨架与空状态。
- [ ] 卡片信息与按钮显隐、禁用规则符合 3.3 / 3.4 总表。
- [ ] 安装、升级、启用、禁用、卸载、删除、上传成功后刷新列表和侧边栏插件菜单；失败只提示一次。
- [ ] 卸载、删除、升级、禁用支付插件均有后果明确的二次确认。
- [ ] 配置弹窗：Telegram 9 个字段正确渲染（2 个开关、1 个输入、6 个多行），保存提交全部键；json 字段非法时阻止提交。
- [ ] README 弹窗安全渲染 Markdown（不执行 HTML）。
- [ ] 侧边栏：启用且声明 `admin_menus` 的插件生成分组（可用一个临时测试插件或模拟数据验证）。
- [ ] `/plugins/:code`、`/plugins/:code/settings`、未知子路径、未启用插件、不存在插件五种情况显示正确。
- [ ] `admin_crud` 运行时：列表参数 `current/pageSize/search/sort_field/sort_order`，新建/编辑/删除请求体符合 4.4.2（可用模拟数据或演示页验证）。
- [ ] 菜单演示、CRUD 演示两个页面可从插件管理页进入且功能与官方一致（中文化）。

系统运维：
- [ ] 仪表盘队列卡修正项按 `core.md` 执行（单位换算、wait 取值、队列名显示、失败任务分页提示）。
- [ ] 系统状态页 5 个区块数据正确，30 秒自动刷新，单块失败不影响其它块。
- [ ] 审计日志页：GET 调用；筛选（action/admin_id/keyword）、分页、请求数据弹窗、复制；URI 不显示 secure_path；有敏感信息警告。
- [ ] 不实现系统更新功能。
