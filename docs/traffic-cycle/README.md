# 流量周期账本 · 运维说明

> 最近核实：2026-11-01。全部测试在 SQLite 和 MySQL 5.7.44（与生产相同的 `sql_mode`、`explicit_defaults_for_timestamp=1`、`+08:00` 时区）上通过；三站生产库的副本上演练过迁移、bootstrap（dry-run + apply）、JSONL 回填、定时滚动和全部活跃用户的时间线读取（§8）。
>
> **已上线**：2026-11-01 04:48–05:12 三站（yzy → mg → 98k）上线 `aeca294`，Web 与 ai-ticket-worker 同一镜像，TrafficReset 1.2.0 / AiTicketReply 1.7.20 同时上线，bootstrap 结果与演练一致，周期不变量全为 0。GitHub Actions 在 fork 上被暂停，这次的镜像是在主机上按 CI 步骤构建的 `xboard-local:aeca294`（见 §3 第 2 步）。各站的部署脚本、备份、报告和回滚步骤在站点 `backups/2026-11-01-traffic-cycle/`，过程记录在站点 `AGENTS.md`。
>
> 规则和接口约定见 [DESIGN.md](DESIGN.md)（改接口先改它）。本文件只讲上线、核对、日常运维、回滚和已知问题。

## 1. 它做什么

每个用户有一条“当前周期”（`v2_traffic_cycle` 里 `ended_at IS NULL` 的那行）：本周期额度、开始时间、计划结束时间、下周期额度。周期结束时间以订阅到期时间为锚、每个周期至少 15 天（DESIGN §3.2），算好后不再改口，所以：

- 月末购买不会再出现“一天后就重置”；
- 管理员给的“仅本周期”额度（特殊周期）续费时不会被套餐流量覆盖，下周期自动恢复；
- 换时（TrafficReset 插件）只把到期时间前移本周期没用完的时长，新周期额度恢复常备额度；
- 重置记录带原因（`metadata.reason`），清零 0 B 的情况不再写日志，旧的 0 B 行标为噪声。

`v2_user.next_reset_at` 继续存在，始终等于当前周期的结束时间（最终周期为 null），定时任务 `reset:traffic` 仍按它选人，所以旧主题和旧接口照常工作。

## 2. 组成

| 部分 | 位置 |
|---|---|
| 迁移 | `database/migrations/2026_11_01_000001_create_v2_traffic_cycle_table.php`（新表）、`2026_11_01_000002_add_expires_at_to_v2_order_table.php`（`v2_order.expires_at`，可空） |
| 模型 | `app/Models/TrafficCycle.php`；`app/Models/TrafficResetLog.php` 新增原因代码、旧行推断与噪声判断 |
| 服务 | `app/Services/TrafficCycleService.php`（插件只依赖 DESIGN §6 的方法） |
| 接入点 | `TrafficResetService`（定时滚动、清零带原因、`next_reset_at` 读周期）、`OrderService`（新购/续费/换套餐/一次性）、`UserObserver` / `PlanObserver`、后台 `user/update`、礼品卡重置、后台手动重置、`OrderHandleJob`（分配订单的付款期限） |
| 命令 | `traffic:cycle-bootstrap`（上线用，§3）；`reset:traffic --fix-null / --force` 有账本时改为同步周期 |
| 用户接口 | `GET /api/v1/user/trafficCycle/fetch` |
| 后台接口 | `GET user/trafficCycle/fetch`、`GET user/trafficCycle/preview`、`traffic-reset/logs` 新增 `hide_noise` / `reason` 和新字段、`user/update` 新增 `cycle_*` 参数、`order/assign` 新增 `expire_hours`（DESIGN §7.2） |
| 插件钩子 | `HookManager::filter('traffic_cycle.advance_policy', null, $user)`，TrafficReset 1.2.0 注册 |
| 设置 | `traffic_cycle_min_days`（最短周期天数，默认 15，没有后台界面） |
| 测试 | `phpunit.xml`、`tests/TestCase.php`、`tests/Unit/Services/TrafficCyclePlanEndTest.php`、`tests/Feature/TrafficCycle/*` |

账本没有单独开关：`v2_traffic_cycle` 表存在就启用（迁移跑完即生效）。

## 3. 上线步骤（每个站点）

以下 `php artisan …` 命令都在面板容器里以 www 用户执行：`docker exec -u www <面板容器> php artisan …`（工作目录 `/www`；用 root 执行可能留下 root 所有的日志文件，之后应用写不进去）。三站逐个做，先挑用户少的站。

1. **准备**
   - 按站点现有策略备份数据库；另存一份 `v2_user` 的周期相关列（`id, plan_id, transfer_enable, u, d, expired_at, next_reset_at, last_reset_at, reset_count`），回滚 `next_reset_at` 用。
   - TrafficReset 插件和镜像一起换（插件目录是挂载的，换文件后随容器重建生效）：1.2.0 在旧核心上走 1.1.0 原逻辑，在新核心上改为调用 `advance()`；新核心在迁移完成前它什么都不做。**不要让 1.1.x 插件和新核心同时运行**（见 §7）。
   - **插件文件只在面板容器和 worker 都停止时替换**（或同目录临时文件 + rename 原子替换）：`PluginManager::loadPlugin()` 发现已启用插件的 `Plugin.php` 不存在时会删除它的 `v2_plugins` 行（连同配置，AiTicketReply 的 Prompt 也在里面），而定时任务每 30 秒、Octane worker 每次重启都会加载插件。运行中只改了插件文件时，用 `php artisan octane:reload` 和 `php artisan horizon:terminate` 让常驻进程加载新代码（后者也会让 ai-ticket-worker 处理完当前任务后退出重启）。
   - AiTicketReply 的上下文在 `ai-ticket-worker` 容器里生成，worker 要和面板用同一个镜像，否则【流量周期】上下文为空。
2. **部署镜像**。正常用 CI（`docker-publish.yml`）发布的 digest。2026-11-01 GitHub 暂停了 fork 上的工作流（Actions 页面：“Workflows are not currently being run on this fork due to the scale of GitHub Actions usage”，需维护者在网页上重新启用），三站用的是主机上构建的 `xboard-local:aeca294`：以上一个 CI 镜像为底，只替换两个提交间变化的应用文件，再按 CI 的步骤离线执行 `composer install --no-dev`（不能用 `composer dump-autoload --no-dev`：`installed.json` 没有 `dev-package-names`，composer 会按依赖图把 laravel/reverb、react/* 当成开发依赖剔除）；只在 Dockerfile、`.docker/`、composer.json/lock 未变时可用。配方、文件清单和与 git 树逐字节比对的记录在各站 `backups/2026-11-01-traffic-cycle/image/`。镜像入口会执行 `xboard:update`，其中包含 `migrate --force`；设置了 `SKIP_APP_UPDATE=true` 的站点手动执行 `php artisan migrate --force`。确认：
   ```sh
   php artisan migrate:status | grep 2026_11_01
   ```
3. **立刻出 dry-run 报告**（只读，不写库）：
   ```sh
   php artisan traffic:cycle-bootstrap --fix-short --import-jsonl \
     --report=/www/storage/logs/traffic-cycle-bootstrap-dryrun.json
   ```
   部署后到 `--apply` 之间，被订单、管理员修改、礼品卡、到点重置、周期时间线接口碰到的用户会按需建立周期（规则见 §7），命令之后会跳过他们，`--fix-short` 也不再处理。所以这一步和下一步之间不要拖太久。
4. **审核报告**（`summary`、`users[]`、`jsonl`）：
   - `short_fixed` 表格：周期起点到原 `next_reset_at` 不足 15 天、将改为按到期时间锚定的用户。`起点依据 = admin_update` 的要逐条核对（来自后台 `user.update` 审计日志，只算改了到期/套餐/流量的那次）。
   - `notes`：`unscheduled_periodic`（按周期重置的套餐、原 `next_reset_at` 为空，保持不重置）、`reset_overdue`（原重置时间不晚于估计的周期起点，即已到点还没重置；未封禁的用户会在下一分钟被定时任务滚动）、`short_cycle`（没加 `--fix-short` 时仍短于 15 天）。
   - `final_cycles` / `next_reset_changed`：原 `next_reset_at` ≥ 到期时间的用户会被置为 null（到期即结束，不再重置）。
   - `jsonl.unmatched`：插件 JSONL 里没找到对应 0 B 日志行的换时事件，只报告不处理。
5. **执行**（报告留存，回滚要用其中的 `next_reset_before`）：
   ```sh
   php artisan traffic:cycle-bootstrap --apply --fix-short --import-jsonl \
     --report=/www/storage/logs/traffic-cycle-bootstrap-apply.json
   ```
   不想改任何已承诺的重置时间时去掉 `--fix-short`。命令有错误时退出码非 0，报告 `errors[]` 列出用户。
6. **确认幂等**：再跑一次 dry-run（带 `--import-jsonl`），应为“将建立周期 0 个”、“可回填 0 条”，上次回填的行计入“已导入过”。
7. **核对**（§4）。

## 4. 核对

MySQL：

```sql
-- 每个用户最多一个当前周期（应为空）
SELECT user_id, COUNT(*) AS n FROM v2_traffic_cycle WHERE ended_at IS NULL GROUP BY user_id HAVING n > 1;

-- next_reset_at 与当前周期一致（应为 0）
SELECT COUNT(*) FROM v2_user u
JOIN v2_traffic_cycle c ON c.user_id = u.id AND c.ended_at IS NULL
WHERE NOT (u.next_reset_at <=> CASE
  WHEN c.ends_at IS NULL OR (u.expired_at IS NOT NULL AND c.ends_at >= u.expired_at) THEN NULL
  ELSE c.ends_at END);

-- 有套餐且未过期、却没有当前周期的用户（--apply 后应为 0）
SELECT COUNT(*) FROM v2_user u
WHERE u.plan_id IS NOT NULL AND (u.expired_at IS NULL OR u.expired_at > UNIX_TIMESTAMP())
  AND NOT EXISTS (SELECT 1 FROM v2_traffic_cycle c WHERE c.user_id = u.id AND c.ended_at IS NULL);
```

第二条不为 0 时（例如有人用 SQL 直接改了到期时间或流量），`php artisan reset:traffic --force` 会对每个用户做一次 `reconcile`：额度、套餐、到期变化按 DESIGN §3.3 / §3.8 落到当前周期，再把 `next_reset_at` 同步为周期结束时间。没有变化的周期不动。

接口：

- 后台 `GET /api/v2/{secure_path}/user/trafficCycle/fetch?user_id=<id>`：看工单用户的当前周期、后续排期、历史周期和重置记录（含噪声行和 `metadata` 原文）。
- 后台 `GET /api/v2/{secure_path}/traffic-reset/logs?hide_noise=1`：噪声行（旧的 0 B 记录）应被过滤；`reason=` 可按原因筛选。
- 用户 `GET /api/v1/user/trafficCycle/fetch`：主题的“流量周期”页用；`user/getSubscribe` 的 `reset_day` 现在是距当前周期结束的天数（最终周期为 null，到点就是到期）。

## 5. 日常运维

- **到点滚动**：`reset:traffic` 每分钟（`app/Console/Kernel.php`）。定时任务停过时，补跑会从最近一个已过的边界开新周期（`start_reason = catch_up`），只清零一次。
- **改最短周期**：`php artisan tinker --execute="admin_setting(['traffic_cycle_min_days' => 15])"`。只影响之后计算的周期，已排定的结束时间不变。
- **管理员改用户**：官方后台不传新参数，等同 `cycle_mode=keep`、`cycle_quota_scope=standing`（改流量=改常备额度，到期变化按 DESIGN §3.3）。`user/update` 的 `cycle_*` 参数（Admin Next 用户编辑抽屉使用）可以设“仅本周期额度”“本周期重新开始”、指定本周期结束时间和周期备注，`user/trafficCycle/preview` 先算出效果不落库。参数不合法时 `user/update` 返回 422，什么都不改。注意：官方后台保存时会把打开表单时的 `u/d` 一起提交，期间用户又用了流量的话，现在会记一条 `admin_usage_edit` 日志（以前是静默覆盖）。
- **原因不明的旧用户**：报告里 `unscheduled_periodic` 的用户旧系统从没给他们排过重置，账本保持不重置。要给某个用户恢复按月重置，在后台对他“本周期重新开始”（`cycle_mode=restart`）。若决定整站都按套餐排期，在 `--apply` **之前**运行 `php artisan reset:traffic --fix-null`（为 `next_reset_at` 为空的用户按 `planEnd(now, 到期)` 建周期，等同旧版 `--fix-null`）。
- **分配订单**：`order/assign` 的 `expire_hours`（1–720，默认 72）写入 `v2_order.expires_at`；用户自己下的单仍是 2 小时。
- **工单排查**：重置记录 ID 可在后台 `traffic-reset/logs` 或用户的周期时间线里查，`reason` 的中文说明见 DESIGN §5。

## 6. 回滚

- **镜像回滚**到上一个 digest 即可。旧代码不读 `v2_traffic_cycle` 和 `v2_order.expires_at`，不需要回滚迁移（`migrate:rollback` 会删表和列，不建议）。
- 回滚后的影响：
  - `next_reset_at` 保持账本最后写入的值，旧代码在下一次重置时重新按“到期日号”计算（月末问题回来）。
  - `--fix-short` 改过的 `next_reset_at` 如需恢复，按 apply 报告 `users[]` 的 `user_id` / `next_reset_before` 写回（`short_fix` 非空、或 `next_reset_before ≠ next_reset_after` 的行）。
  - 还在待支付、创建超过 2 小时的后台分配订单会被旧版 `check:order` 在下一分钟取消。回滚前先处理这些订单：`SELECT id, user_id, created_at, expires_at FROM v2_order WHERE status = 0 AND expires_at IS NOT NULL;`
  - 回滚期间产生的重置日志没有 `metadata.reason`，重新上线后按 `trigger_source` 推断原因。
- **回滚后再升级回来**：旧代码运行期间周期表不会更新，留下的当前周期已经过时（结束时间可能已过），直接升级会被当成到期而补跑清零。重新上线前先备份并清空 `v2_traffic_cycle`，再按 §3 重新 bootstrap。

## 7. 已知问题与限制

- **按需建立的周期**：账本启用后，没有周期的用户在被订单、管理员修改、礼品卡、到点重置、时间线接口碰到时按需建立周期：`next_reset_at` < 到期时沿用它（与 bootstrap 相同），为空时按 `planEnd(now, 到期)` 排期（等同旧版观察者在改套餐/到期时的重算）。bootstrap 命令对后者按 DESIGN §10.2 视为最终周期并标 `unscheduled_periodic`。两者只在“周期性套餐、到期时间非空但 `next_reset_at` 为空”的用户上结果不同，2026-11-01 三站这类用户为 0（`next_reset_at` 为空的周期性套餐用户都是长期有效，两条规则都是不排期）。按需建立的周期不会再被 `--fix-short` 处理，上线时 migrate 后立刻 bootstrap。
- **旧版 TrafficReset 插件（1.1.x）+ 新核心**：插件自己把 `u/d` 清零、改到期时间，再调用 `performReset`。新核心在已用量为 0 时不写日志，所以这次清零在重置记录里完全看不到（只在插件 JSONL 里），周期也不会重开；到期被提前到当前周期结束之前时，本周期直接变成最终周期。所以插件要和核心一起换到 1.2.0。
- **插件扫描已用尽的用户**：TrafficReset 1.2.0 每分钟（插件的 `schedule()`，由面板容器的定时任务执行）调用 `exhaustedCandidates()` 换时。上线时三站这类用户为 0，不会出现一次性的大批换时。可在插件配置里关掉 `sweep_exhausted`（不配置时默认开）。
- **节点对已用尽用户的残余上报**：节点只给“已用 < 额度”的用户下发，但已建立的连接还会每分钟上报几十 KB（上线时 yzy 有 1 人）。每次上报都会触发插件判断；被核心以资格原因拒绝（如 `final_cycle`）后，插件按“套餐 | 额度 | 到期 | next_reset_at”记住状态，一小时内状态不变就不再判断、不写 JSONL（xboard-site-plugins `f363aa9`），续费、管理员修改、周期滚动会立即重新判断。
- **后台设置缓存固定用 redis store**（`App\Support\Setting`）：测试里改成 array store（`tests/TestCase.php`）；生产不受影响。
- **MySQL 差异**（测试已覆盖）：JSON 对象的键会被重新排序；`reason` 为 JSON null 时读回字符串 `"null"`（所以不写这个键）；`explicit_defaults_for_timestamp` 关闭的库上第一个 TIMESTAMP 列遇到更新会自动变成当前时间（JSONL 回填显式保留 `reset_time`）。生产库是 MySQL 5.7.44、`explicit_defaults_for_timestamp=1`、会话时区 `+08:00`（跟随主机）。
- **bootstrap 的耗时**：每个用户查一次订单、重置日志和后台审计日志（`request_data LIKE`，`action` 有索引）。用户多、审计日志大的站点 dry-run 可能要几分钟；审计日志只保留 3 个月（`reset:log`），足够覆盖一个周期。

## 8. 测试

- 单元 + 功能测试：`vendor/bin/phpunit`（需要 composer dev 依赖）。`phpunit.xml` 用 SQLite 内存库、array 缓存、sync 队列，`tests/TestCase.php` 强制这些设置，不会碰 `.env` 里的数据库或 redis。
- 2026-11-01 结果：82 个测试在 SQLite 和 MySQL 5.7.44 上都通过（含原有 31 个），其中账本相关 51 个：`planEnd` 单元测试、工单 #6982 场景、定时滚动与补跑、订单（新购/续费/换套餐/一次性/重置包、按站点时区加月份）、管理员修改与预览（含“重开 + 已用填 0”）、时间线与插件钩子、换时防护（过时触发、0 B 换时留痕、扫描名单）、bootstrap 命令（含 JSONL 导入、1.1.x 换时作为周期起点）。
- MySQL 上跑：把 `phpunit.xml` 的 `DB_CONNECTION/DB_DATABASE` 换成指向一个**一次性**库的 mysql 连接（`RefreshDatabase` 会清空它）。
- 生产库副本演练（2026-11-01，三站）：`mysqldump --single-transaction` 只读导出（不含统计、邮件、工单消息等大表的数据）直接导入一次性 MySQL，跑 migrate → bootstrap dry-run → `--apply --fix-short --import-jsonl` → `reset:traffic` → 全部活跃用户读一次时间线。结果：yzy 1391 / mg 2588 / 98k 3819 个活跃用户各建立一个周期，`v2_user` 只有 `next_reset_at` 变化（全部是最终周期置空），各项核对为 0，JSONL 换时事件 140 / 265 / 314 条全部回填且 `reset_time` 未变，时间线读取 0 错误，扫描名单为空。
- 一次性测试实例（长期运行的 Web 容器、种子数据、冒烟脚本）的说明在测试服务器的 `/www/wwwroot/xboard-cycle-test/README.txt`，不在仓库里。
