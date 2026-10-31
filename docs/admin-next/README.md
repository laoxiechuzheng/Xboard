# Admin Next（开源管理后台）

官方 Xboard 管理后台（`public/assets/admin/`）是闭源编译产物，无法修改。Admin Next 是本 fork 自己维护的开源后台：源码在 `admin-next/`，功能以官方后台为最低标准，复用同一套后端接口，与官方后台**并存**。

| 项 | 官方后台（保留，不改动） | Admin Next |
|---|---|---|
| 访问地址 | `/{secure_path}` | `/{secure_path}/next` |
| 前端资源 | `public/assets/admin/`（闭源） | `public/assets/admin-next/`（由 `admin-next/` 构建） |
| 入口视图 | `resources/views/admin.blade.php` | `resources/views/admin-next.blade.php` |
| 后端接口 | `/api/v2/{secure_path}/*` | 同左；另用到本 fork 新增的只读接口 `user/loginLog/fetch`（登录记录）、`user/trafficCycle/fetch` 与 `user/trafficCycle/preview`（流量周期），见下文对应章节 |
| 登录态 | localStorage `XBOARD_ACCESS_TOKEN` | 同一 token（登录任一后台后可直接切换） |

两个后台互不依赖：新后台出问题时直接用旧地址即可；回滚新后台只需撤掉路由或回滚镜像，不影响数据。仓库里更早的 `/admin-v2`、`/console` 实验入口也原样保留（见 `docs/administration/remove-independent-admin-v2.md`）。

## 文档索引

- 开发约定、目录结构、新增页面步骤：[DEVELOPING.md](DEVELOPING.md)
- 官方后台功能逆向规格（逐页面、逐字段、逐接口，实现与验收的依据）：[spec/](spec/)
  - [core.md](spec/core.md) 登录、通用约定、布局、仪表盘、格式化
  - [settings.md](spec/settings.md) 系统设置、邮件模板、订阅模板
  - [nodes.md](spec/nodes.md) 节点、服务器（机器）、权限组、路由
  - [users.md](spec/users.md) 用户、流量记录、流量重置、登录记录（§17）、流量周期（§18）
  - [commerce.md](spec/commerce.md) 套餐、订单/佣金（含支付截止时间、分配订单支付有效期）、支付、优惠券、礼品卡
  - [content.md](spec/content.md) 工单、公告、知识库
  - [platform.md](spec/platform.md) 主题、插件、插件页面、系统状态、审计日志

## 功能范围

菜单与官方一致：仪表盘；系统管理（系统配置、插件管理、主题配置、公告管理、支付配置、知识库管理）；节点管理（服务器管理、节点管理、权限组管理、路由管理）；订阅管理（套餐、订单、优惠券、礼品卡）；用户管理（用户、工单）；插件通过 `config.json` 声明的 `admin_menus` / `admin_crud` 动态菜单与页面。

在官方基础上补充（不改后端）：系统状态页、审计日志页、流量重置日志菜单入口（现为“流量周期与重置”）、Ctrl/⌘+K 菜单搜索、深浅色/跟随系统主题，以及各规格“差异与风险”章节列出的官方前端缺陷修正。界面仅中文。

依赖本 fork 后端改动的补充：**登录记录**（用户管理 → 登录记录 `#/user/login-log`，用户行操作“登录记录”弹窗，用户详情的“最后登录IP”）；**流量周期**（用户管理 → 流量周期与重置、用户“流量周期”抽屉、编辑用户的“周期影响”预览、订单支付截止时间与分配订单的支付有效期）。见下文对应章节。

## 登录记录

- 后端（提交 `40bde40`）：用户每次密码登录、注册、邮件链接/快速登录链接登录都会写一行 `v2_user_login_log`（IP、UA 解析出的设备、来源站点），密码错误的尝试也记录；归属地由队列任务 `ResolveLoginLogLocationJob`（`default` 队列）异步解析，通常几秒内完成：先调用 `https://api.ip.sb/geoip/{ip}`，失败（超时、非 2xx、无 `country_code`）时回退到 `http://ip-api.com/json/{ip}`（`app/Services/LoginLogService.php::lookupIpApi`）。注意回退是**明文 HTTP**，用户 IP 会以明文发给第二家第三方服务；内网/保留地址不会外发。结果按 IP 缓存 7 天，两家都失败时缓存 1 分钟。日志保留 6 个月（每日 `reset:log` 清理），删除用户时一并删除。
- 管理接口：`GET /api/v2/{secure_path}/user/loginLog/fetch`（路由 `any`，新后台用 GET 以免写审计日志），参数与返回见 [spec/users.md §17](spec/users.md)。用户端接口 `GET /api/v1/user/loginLog/fetch` 供主题使用。
- 新后台：`#/user/login-log` 页面（今日成功/失败/注册与总数概览、邮箱/IP 前缀/类型/结果/日期筛选、展开查看完整 UA、移动端卡片），支持 `?user_id=`、`?email=`、`?ip=` 深链；用户列表行操作“登录记录”打开按用户过滤的弹窗；用户详情“最后登录IP”改为读取最近一次成功登录（`v2_user.last_login_ip` 上游从未写入，原来恒为 `-`）。
- 未升级后端的面板：接口 404，页面显示“当前面板还没有登录记录接口”的降级提示，用户详情回退显示 `-`，不弹错误。
- 数据库：新增迁移 `database/migrations/2026_10_29_000001_create_v2_user_login_log_table.php`（只新增表）。生产 `SKIP_APP_UPDATE=true` 时镜像启动不会自动迁移，升级后需执行 `docker compose exec xboard php artisan migrate --force`；回滚镜像不需要回滚迁移（旧代码不读该表）。

## 流量周期

后端契约见 [docs/traffic-cycle/DESIGN.md](../traffic-cycle/DESIGN.md)（周期规则、原因代码 §5、接口 §7）；新后台的页面与交互规格见 [spec/users.md §18](spec/users.md)、[spec/commerce.md §3](spec/commerce.md)。

- **流量周期与重置**（`#/user/traffic-reset-logs`，菜单“用户管理 → 流量周期与重置”，旧地址 `#/user/traffic-reset` 自动跳转）：每条重置记录说清原因（DESIGN §5 全部代码，旧记录按触发来源推断并标“旧记录”）、真实清零量、额度与到期时间的前后变化（换时显示到期前移多少）、关联的周期/订单/管理员和管理员备注；“清零 0 B”的冗余记录默认隐藏（`hide_noise=1`），打开开关后淡化显示并标“冗余记录”；按邮箱或 `#用户ID`、原因、触发来源、日期筛选；顶部近 30 天统计不含冗余记录；导出 CSV；手机上为卡片。
- **流量周期抽屉**：用户行操作“流量周期”、用户详情“流量信息 → 流量周期”、重置记录页点击用户或“周期 #id”都可打开。内容：当前周期（标准/特殊、额度与已用、开始与结束、下个周期额度、最终周期“本周期至到期，不再重置”、用户可见的备注）、后续排期、换时规则与当前能否换时、历史周期、带日志 ID 的重置记录（可展开原始 metadata）。
- **编辑用户的“周期影响”**：改了套餐、流量、到期时间或已用流量时出现，提供“从现在重新开始 / 保留当前周期”、“仅本周期 / 长期”、重新开始时的结束时间和周期备注，默认值按 DESIGN §3.6 智能选择，并实时预览（`GET user/trafficCycle/preview`，只计算不落库）；只有这一节出现时才在 `user/update` 里带 `cycle_*` 参数。
- **订单**：分配订单可选“支付有效期”24/48/72（默认）/168 小时（`order/assign` 的 `expire_hours`）；订单列表与详情给待支付订单显示支付截止时间（`expires_at ?? created_at + 7200`），`expires_at` 有值的订单带“后台分配”标签。
- **未升级的后端**：新接口 404 时，重置记录页显示“后端未升级”提示（原因按触发来源推断、冗余记录只能淡化、按原因筛选与统计不可用），抽屉显示“当前面板还没有流量周期接口”，编辑抽屉不发送周期参数，都不弹错误。后端已升级但还没执行迁移时（周期表不存在），有效用户在抽屉里没有当前周期，抽屉会提示可能未迁移。
- **部署**：前端随镜像发布，无需单独操作；后端新增 `v2_traffic_cycle` 表和 `v2_order.expires_at` 列，升级后按上文执行 `php artisan migrate --force`，周期账本的建立与回滚见 DESIGN §10。
- **本地开发**：没有可用后端时可以用开发 mock（`XBOARD_DEV_MOCK=1`，只在 `pnpm dev` 生效，不进构建产物），见 [DEVELOPING.md](DEVELOPING.md#用开发-mock-调界面)。
- **端到端核实（2026-11-01，一次性测试实例 xboard-cycle-test，生产构建 + 真实后端）**：编辑抽屉走 #6982 流程（换天穹旗舰、40 GB、“一个月”、已用 0、备注）→ 预览与保存后的时间线一致（40 GB 特殊周期至到期、下周期 100 GB），再在订单列表“标记为已支付”续费 → 特殊额度保留、到期顺延、排期 100 GB；另一用户上“保留 / 重新开始”×“仅本周期 / 长期”四种预览与其中两种保存（含手动结束时间）、单纯延长到期、只改已用、只改备注（不带 `cycle_*`）；重置记录页冗余开关、邮箱 / `#ID` / 原因 / 来源 / 日期筛选、统计卡、点击用户与“周期 #id”打开抽屉；分配订单 72 小时 → 列表截止时间与“后台分配”标签；带原因的手动重置在重置记录页显示为“管理员重置 + 备注”。每次写入后都用后台时间线接口核对了数据库结果；1440 与 390 宽度截图已人工检查。

## 构建与发布

1. `cd admin-next && pnpm install && pnpm build`（类型检查 + 输出到 `public/assets/admin-next/`）。
2. 源码与 `public/assets/admin-next/` 一起提交。Docker 镜像直接打包该目录，Dockerfile 不运行 Node；`.dockerignore` 排除了 `admin-next/` 源码。
3. GitHub Actions `Admin Next`（`.github/workflows/admin-next.yml`）在相关路径变动时做类型检查、构建，并校验提交的构建产物与源码一致。
4. 推送 `master` 后，`Docker Build and Publish` 产出新镜像；生产按固定 digest 升级（见下）。

## 生产部署与回滚（三站：98k / mg / yzy）

当前状态（2026-10-28 核实）：三站 Web 镜像均为 `ghcr.io/laoxiechuzheng/xboard@sha256:59aef588044c4e6ce4a6a265b70a7f51e8b8857ca5a88801c40af50c1bcdf287`（提交 `f9aed5e`），`/{secure_path}/next` 与官方后台均验收通过；各站记录见站点目录 `AGENTS.md` 的 2026-10-28 Admin Next 条目，备份在 `backups/2026-10-28-admin-next/`。

生产 Compose 只固定 Web 镜像 digest，`public/` 不挂载，所以新后台随镜像发布。按各站 `AGENTS.md` 的既有流程：

- 备份：`backups/<日期>-admin-next/` 保存 `compose.yaml.before`、`AGENTS.md.before` 和 `README.txt`（新旧镜像、提交、回滚命令）。
- 升级：只替换 `xboard` 服务的镜像 digest；`ai-ticket-worker` 的镜像不动，但它使用 web 容器内嵌 Redis 的 socket，所以要先 `docker stop -t 60 <站点>-ai-ticket-worker-1`，再 `docker compose up -d --no-deps --pull never xboard`，等 HTTP 200 且 `redis-cli -s /data/redis.sock ping` 返回 PONG 后再 `docker start` worker（否则 worker 会在 Redis 加载期间反复重启）。
- 验收：首页、公开配置接口、官方后台页、`/{secure_path}/next`、manifest 中全部静态资源、未登录访问管理接口返回 403，并经宿主机 Nginx 复核。
- 回滚：恢复 `compose.yaml.before`，按同样的“停 worker → 重建 xboard → 等就绪 → 启 worker”顺序执行。

Admin Next 首次上线（2026-10-28，提交 `f9aed5e`）无数据库迁移、无配置变更、无新增外部服务。之后的登录记录功能（提交 `40bde40` 起）新增数据表 `v2_user_login_log`（升级后手动 `php artisan migrate --force`）和出站访问 `https://api.ip.sb`（主）与 `http://ip-api.com`（回退，明文 HTTP；均由队列任务发起，需要 Horizon 消费 `default` 队列；防火墙只放行其一时，另一家失败即回退或记为“解析失败”），见上文“登录记录”。

## 与官方后台的有意差异

- 系统设置改为显式保存（悬浮保存条 + Ctrl/⌘+S，只提交改动字段，危险项二次确认），不做官方的 1 秒自动保存。
- 代码/模板编辑使用等宽文本框（未引入 Monaco）；订阅模板的 YAML 只做结构检查，不做完整语法校验（需要新增依赖，未引入）。
- 表格内拖拽排序统一改为“编辑排序”弹窗（拖拽 + 上下移，触屏可用），请求体与官方一致。
- 支付方式编辑沿用官方行为回填密钥（不启用 `safe:1`），原因见下方后端问题 3。

## 已知后端问题（审查中发现，仅记录，未改后端）

新后台已在前端规避或如实提示，修复需改后端：

1. `CouponController::update`：`catch` 中缺少 `DB::rollBack()`，id 不存在时事务泄漏到 Octane 常驻 worker。新后台改用 `coupon/show` 切换状态规避。
2. `PaymentController::sort`：`Payment::find()` 为 null 时抛 `Error`，`catch (\Exception)` 捕不到，同样泄漏事务。新后台保存前重新拉取列表校验 id。
3. `PaymentController::preserveEmptyPasswordConfig`：`ConvertEmptyStringsToNull` 把空串转为 null，留空的密钥字段会被清空；`catch (Exception)` 缺少命名空间。
4. `app/Http/Requests/Admin/PlanSave.php`：`prices=null` 时 `foreach` 报 500。新后台无价格时发送 `{}`。
5. `RequestLog` 敏感字段过滤不含 `email_password`、`server_token`、`telegram_bot_token`、插件 `config.*` 等，审计日志会记录明文；审计日志页已加提示。
6. `system/getQueueMasters` 直接走 Horizon 的 `viewHorizon` 授权，生产环境恒为 403；系统状态页的 Horizon 进程区块显示降级提示。
7. 礼品卡：`templates`/`codes` 接口忽略筛选排序、丢弃 `codes_count` 等统计字段；`calculateActualRewards` 对所有数值奖励乘节日倍率并取整；`disallowed_plans` 未实现。
8. `ThemeController::upload` 检查的是 `base_path('theme')` 是否可写，而用户主题实际写入 `storage/theme`。
