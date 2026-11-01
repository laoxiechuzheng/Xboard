# 流量周期账本（Traffic Cycle）设计与接口约定

> 状态：2026-11-01 已上线三站。同日 10:57–11:02 又上线（master `7ad21e3`）：§3.3 不重置套餐随到期延长、§3.7 换时结算（`carried`）与 `traffic.process.after`、扫描分页、§4.3 事件裁剪保留到期事件、§7.2 用户重置历史带账本字段。本文件是后端、Admin Next、LiquidNext、ez 主题、TrafficReset 插件、AiTicketReply 插件共同的接口约定。改接口先改本文件。

## 1. 要解决的问题

1. **月末溢出导致“一天就重置”**：Xboard 的“按月重置”把**到期日的日号**当作每月重置日。10-31 买一个月，到期 = 12-01（PHP/JS 加一个月会溢出），重置日 = 1 号，于是 11-01 就重置一次，用户一个月拿到两份流量。2026-10-31 实测三站有 68 个用户处在这种状态（已用临时脚本顺延，见 §10.1）。管理员在后台点“一个月”设到期也一样。
2. **管理员设置的“特殊周期”留不住**：芒果云工单 #6982，管理员把用户转成天穹旗舰 40GB、到期 12-01。系统按到期日号排出 11-01 的重置。用户随后续费一个月，续费又把流量直接改成套餐标准 100GB（覆盖了 40GB），到期顺延到 2027-01-01，并且 11-01、12-01 还会各重置一次。
3. **换时（流量用尽提前开启下一周期）不够聪明**：TrafficReset 插件按日号推算，有时区和 31 号溢出问题（例：98k 用户 1255 换时后到期变成 03-03，3 天后又重置）。开启的新周期沿用当前额度（40GB 特殊额度会延续下去），而不是恢复套餐标准。
4. **记录没有意义、查不到**：`v2_traffic_reset_logs` 约一半是“清除 0 B”的冗余行（新购时连续重置两次、换时插件先清零再写日志）。“订单开通 / 按月重置”说不清发生了什么。用户端看不到周期，AI 客服也无法解读日志 ID。
5. **后台分配的订单 2 小时就被取消**：管理员在工单里分配订单、改价后，用户往往不能及时付款。

## 2. 术语

| 术语 | 含义 |
|---|---|
| 周期（cycle） | 一段有固定流量额度的时间。周期结束时清零已用流量，进入下一周期（订阅还没到期时）。 |
| 标准周期 `standard` | 额度 = 用户的常备额度（通常就是套餐流量；也可能是管理员设的长期定制额度）。 |
| 特殊周期 `special` | 管理员只给**本周期**设的额度。本周期结束后，下一周期自动恢复常备额度（通常是套餐标准）。 |
| 常备额度 `next_quota` | 下一周期起使用的额度。 |
| 最终周期 | 周期结束时间 = 订阅到期时间。到点就是到期，不会重置。 |
| 换时（advance） | 流量提前用尽、订阅还有足够剩余时，立即结束本周期并开启下一周期，到期时间前移“本周期未用完的时长”。 |
| 边界（boundary） | 按月重置时，以到期时间为锚，往前每隔一个月的时刻：`E`、`E-1月`、`E-2月`……（日号超过当月天数时取月末，时分秒同到期时间）。 |

## 3. 规则

记号：`S` = 周期开始，`E` = 订阅到期（`v2_user.expired_at`，null 表示长期），`M` = 最短周期天数（`admin_setting('traffic_cycle_min_days', 15)`，单位秒时 ×86400）。

### 3.1 重置方式

有效方式 = 套餐 `reset_traffic_method`，为 null 时取 `admin_setting('reset_traffic_method', 1)`。三站实际只用 `1`（按月）和 `2`（不重置）。

| 方式 | 值 | 周期结束时间 `planEnd(S, E)` |
|---|---|---|
| 按月（到期日锚定） | 1 `RESET_TRAFFIC_MONTHLY` | 见 3.2 |
| 每月 1 号 | 0 | S 之后第一个“每月 1 号 00:00”，再与 E 取小；不套用最短周期 |
| 按年（到期日锚定） | 4 | 同 3.2，把“月”换成“年” |
| 每年 1 月 1 日 | 3 | S 之后第一个 1 月 1 日 00:00，再与 E 取小 |
| 不重置 | 2 | 不排期：`ends_at = E`（可为 null），视为最终周期 |
| E 为 null（长期/一次性） | — | 不排期：`ends_at = null`，最终周期 |

### 3.2 按月周期的结束时间（核心）

```
planEnd(S, E):
  候选 = { B_k = E - k个月（日号钳到月末，保留 E 的时分秒） | k ≥ 0 且 B_k > S }，从早到晚
  取第一个满足 B - S ≥ M 的 B；没有则取 E
  若 E - B < M（剩下的零头不足 M），取 E      // 尾段并入，不单独成周期
  返回 B
```

- 每个周期至少 M（15 天），最长不超过约 1 个月 + M。周期始终对齐到期时间，所以续费不会让重置日漂移。
- 例：10-31 05:42 新购一个月，E = 12-01 05:42。候选 11-01（只差 1 天，跳过）、12-01，结果 `[10-31, 12-01]`，一个周期，不会在 11-01 重置。
- 例：01-31 买季付，E = 05-01，周期 `[01-31, 03-01] [03-01, 04-01] [04-01, 05-01]`。

### 3.3 什么时候计算 `ends_at`

只在以下时刻计算，**到点滚动时不再改口**（已经告诉用户的重置时间一定兑现）：

1. 新周期开始时：`ends_at = planEnd(S, E)`。
2. 到期时间变化时（续费、管理员改、礼品卡加天数），对**当前**周期重新评估：
   - 新 E ≤ 当前 `ends_at`：`ends_at = E`（变成最终周期）。
   - 否则保持原 `ends_at` 不动（延长到期不会缩短当前周期）；但若 `E - ends_at < M`，`ends_at = E`（零头并入）。
   - 改为长期（新 E 为 null）：当前 `ends_at` 不动（已承诺的重置照常兑现），之后的周期不再排期。
   - **不按周期重置的方式**（`2` 不重置，含套餐为 null 且站点默认为 `2`）且当前周期是最终周期（`ends_at` 为 null 或 ≥ 原 E）：`ends_at` 跟着新 E 走（新 E 为 null 时也为 null），周期保持最终周期。否则延长到期会让原到期点变成一次重置、在那里清零已用流量。到期提前（或从长期改成有日期）时照常记 `schedule_changed`（`why = expiry_shrunk`）；延长或改为长期时不另记事件，到期变化本身已记在 `renewal` / `expiry_changed` 事件里。续费、礼品卡、管理员修改都走这条规则；按周期重置的方式仍按上面三条。不是最终周期的（旧数据 bootstrap 时沿用了 `next_reset_at`）按上面三条，已承诺的重置照常兑现。
3. 套餐重置方式变化（PlanObserver）：按新方式从 S 重新 `planEnd`。

`v2_user.next_reset_at` 始终 = 当前周期 `ends_at`（非最终周期时），最终周期为 null。定时任务 `reset:traffic` 继续按 `next_reset_at <= now` 选人。

只读路径（订阅信息里的 `reset_day`、`TrafficResetService::calculateNextResetTime`）不建周期、不写库：有当前周期时取其 `ends_at`（最终周期为 null）；没有当前周期的用户沿用已存的 `next_reset_at`（≥ E 时为 null），周期由下一次写路径或时间线接口建立。

### 3.4 周期滚动（定时任务到点）

`rollover(user)`，在锁住用户行的事务内：

1. 关闭当前周期：`ended_at = ends_at`，`end_reason = rollover`，记录结束时的 `u/d`。
2. 开新周期：`S = 旧 ends_at`，`quota = 旧 next_quota ?? 旧 quota`，`kind = standard`，`start_reason = rollover`，`ends_at = planEnd(S, E)`。若新 `ends_at` 仍 ≤ now（定时任务停过），跳到 ≤ now 的最后一个边界再开（`start_reason = catch_up`），不生成空周期。
3. 更新用户：`u = d = 0`，`transfer_enable = 新 quota`，`last_reset_at = now`，`reset_count + 1`，`next_reset_at` 按 3.3。
4. 写一条重置日志（`reason = cycle_rollover`，清零量 > 0 时才写，见 §4.2）。
5. `HookManager::call('traffic.reset.after', $user)`。

用户更新走 Eloquent（触发观察者，节点同步任务照常下发）。

### 3.5 订单

| 订单 | 处理 |
|---|---|
| 新购（type 1） | 关闭当前周期（`replaced`），开新标准周期 `start_reason = purchase`，额度 = 套餐流量，清零（Xboard 原有逻辑）。 |
| 续费（type 2，同套餐未过期） | **当前周期不重开**。当前为特殊周期：`transfer_enable` 不覆盖，只把 `next_quota` 设为套餐流量；当前为标准周期：照 Xboard 改成套餐流量（`quota = next_quota = 套餐流量`）。到期时间变化按 3.3 重新评估，周期记一条 `renewal` 事件。`renew_order_event_id = 1` 时的清零是本周期内清零（`reason = renewal_reset`）。 |
| 换套餐（type 3） | Xboard 先把到期设为现在再加周期。关闭当前周期（`replaced`），开新标准周期 `start_reason = upgrade`，额度 = 新套餐流量。是否清零仍由 `change_order_event_id` 决定（`reason = plan_change`）。 |
| 一次性（onetime） | 关闭当前周期（`replaced`），开新周期 `start_reason = onetime`，`ends_at = null`。 |
| 流量重置包（reset_price） | 本周期内清零，周期不变（`reason = reset_package`）。 |
| 新购时 `new_order_event_id = 1` 的二次重置 | 已用量为 0，不写日志（消除“0 B”冗余行）。 |

### 3.6 管理员修改用户（`POST user/update`）

新增可选参数（都不传 = 旧行为，官方后台不受影响）：

| 参数 | 取值 | 默认 | 含义 |
|---|---|---|---|
| `cycle_mode` | `keep` / `restart` | `keep` | `restart`：本周期从现在重新开始（关闭旧周期 `end_reason = replaced`，`start_reason = admin`） |
| `cycle_quota_scope` | `cycle` / `standing` | `standing` | 改了流量时：`cycle` = 仅本周期（特殊周期，下周期恢复常备额度）；`standing` = 长期（Xboard 原语义） |
| `cycle_ends_at` | unix 秒 / 空 | 自动 | 只在 `restart` 时可用：本周期结束时间（S < 值 ≤ E），不传按 `planEnd(now, E)` |
| `cycle_note` | ≤120 字 | 空 | 写到周期 `note`，用户端和 AI 都能看到，例如“中型芒果剩余价值等值转换” |

处理顺序（与用户字段更新同一事务）：

1. `restart`：关闭旧周期，开新周期（`S = now`，`quota = 新 transfer_enable`，`ends_at = cycle_ends_at ?? planEnd(now, E)`）。
2. `keep`：当前周期 `quota = 新 transfer_enable`；到期变化按 3.3；套餐变化记 `plan_changed` 事件。
3. 额度范围：`cycle` → `kind = special`，`next_quota` = 套餐流量（无套餐时取修改前的常备额度）；`standing` → `kind = standard`，`next_quota = quota`。没改流量时保持原 `kind/next_quota`（`restart` 时：原为特殊周期则新周期仍为特殊周期并沿用 `next_quota`）。
4. 已用流量被改小：写 `admin_usage_edit` 日志，清零量 = 修改前 − 修改后。`restart` 同时把已用填成 0（工单 #6982 的操作）与不填已用等价，记 `admin_restart` 并计一次重置；填成非 0 的值才算 `admin_usage_edit`。

`GET user/trafficCycle/preview`（参数同上，加 `id`、`plan_id`、`transfer_enable`、`expired_at`、`u`、`d`；`expired_at` 传空字符串或 `null` 表示长期）只计算不落库，返回改后的当前周期和后续排期，供 Admin Next 预览。用 GET 是为了不写审计日志。

### 3.7 换时（提前开启下一周期）

核心只提供能力，触发策略留在 TrafficReset 插件（开关、最低剩余天数、是否用尽）。

```
advanceEligibility(user, minRemainingDays):
  需要：有当前周期、E 非空、当前不是最终周期（ends_at < E）、E - now ≥ minRemainingDays 天
  shift = ends_at - now          // 本周期没用完的时长，作废
  E' = E - shift                 // 到期时间前移
  新周期：S = now，quota = next_quota ?? quota，ends_at = planEnd(now, E')
```

`advance(user, trigger)` 按上式执行：关闭当前周期 `end_reason = advanced`，开新周期 `start_reason = advance`，`transfer_enable = 新 quota`，`expired_at = E'`，写 `auto_advance` 日志（带 `shift_seconds`、到期前后、额度前后）。

- **结算（不多扣也不少扣）**：在锁住用户行后读 `U = u`、`D = d`、`Q = transfer_enable`，超出量 `carried = max(0, U + D − Q)`，按上行/下行比例拆成整数（两部分之和正好等于 `carried`，各自不超过 `U` / `D`）。
  - 旧周期 `u_end / d_end = U / D − 带入部分`：用尽时正好等于 `Q`。
  - 新周期从带入的用量开始：`u / d = 带入部分`（不是 0）。
  - 重置日志：`old_upload / old_download = U / D`（真实已用量），`new_upload / new_download = 带入部分`，`metadata.carried = carried`；清零量 `cleared = old_total − new_total`（用尽时 = `Q`）。
  - 返回值另带 `cleared`、`carried`。
  - `carried ≥ 新 quota` 时换时后仍是用尽状态。`advance()` 不在内部循环，下一次记账触发或每分钟扫描会再换一次，那是用户的真实用量，照常进行（不限制每天的换时次数，不设冷却）。
- **换时一定写日志**：即使清零量为 0（额度为 0 时；到期时间变了，必须可追溯），是 §4.2“清零量为 0 不写日志”的唯一例外。
- **锁内复核是否用尽**：总是在锁住用户行后检查 `U + D + pending_bytes ≥ Q`（`trigger.pending_bytes` 不传按 0），不满足返回 `not_exhausted`，什么都不改。防止并发或过时的触发把刚开启的新周期作废、到期再前移一整个周期。`pending_bytes` 只为兼容 TrafficReset 1.2.0（它在上报记账**之前**换时、传本次上报量；跨过额度的那次上报换时时 `U + D < Q`，`carried = 0`，本次上报随后整笔记到新周期，与 1.2.0 原行为相同）。1.2.1 在记账之后触发，固定传 0。核心里没有其他调用方，没有“未用尽也换时”的选项。
- **锁内拒绝封禁用户**：锁住用户行后先看 `banned`，已封禁返回 `banned`，什么都不改（上报入队后才被封禁的用户不前移到期；定时滚动和扫描名单同样跳过封禁用户）。解封后照常判断。
- **触发**（插件）：
  - 节点上报**记账之后**：`TrafficFetchJob` 按“上报量 × 节点倍率”加到 `u / d` 后调用 `traffic.process.after`（§6），TrafficReset 1.2.1 对本批里已用尽的用户换时。不在 `traffic.process.before` 里换时，否则本次上报里旧额度内的部分会在新周期再算一次。
  - 续费订单开通后（`auto_reset_on_renewal`）。
  - **每分钟扫描**已经用尽的用户（`sweep_exhausted`，默认开）。节点只给 `u + d < transfer_enable` 的用户下发，用户一旦用尽就再也没有上报，续费、管理员延长到期、插件后来才开启、`carried` 超过新额度、面板还没有 `traffic.process.after` 钩子等情况只能靠扫描。扫描名单由核心给出：`exhaustedCandidates(minRemainingDays, limit, now, afterId)` = 已用尽、未封禁、额度 > 0、`E ≥ now + minRemainingDays 天`、当前周期未到点且不是最终周期，按用户 ID 升序，`afterId` 给出时只取 `id > afterId`。插件每次最多处理 100 人，把最后一个 ID 记在缓存里，下次接着扫；不足一页就从头开始，排在前面一直换不成的用户不会挡住后面的人。只有换时失败（`failed` / 异常）的用户一小时内不再扫；资格不符（`skipped`）的由插件按资格状态节流（套餐、额度、到期、下次重置、封禁、`min_remaining_days` 任一变化立即重新判断），`not_exhausted` 不节流。
- **节点同步**：`check:traffic-exceeded` 先读出超额用户再推送 `remove`；读之后才恢复额度的用户（换时、续费、管理员修改）的 `add` 可能被这条 `remove` 盖掉。推送之后它按当前状态重读这批用户，已不再超额的再派一次 `NodeUserSyncJob`（按当时状态推 `add` / `remove`），这次同步排在 `remove` 之后；重读之后才提交的修改由它自己提交后的同步覆盖。
- **插件状态**：后台启用 / 停用插件或保存插件配置时，核心发出 `queue:restart` 信号（`PluginManager::restartQueueWorkers()`），常驻队列 worker（Horizon、AI 工单 worker）处理完当前任务后重启，按新的插件状态注册钩子。TrafficReset 的监听器、扫描和 `traffic_cycle.advance_policy` 在常驻进程里每次都先按 `v2_plugins` 读当前开关和配置。

例（工单 #6982 的理想结果）：特殊周期 `[10-31 23:03, 12-01 23:59:59]` 40GB，续费后 E = 01-01 23:59:59。11-20 12:00 用尽 → shift 11.5 天 → E' = 12-21 12:00，新周期 `[11-20 12:00, 12-21 12:00]`，额度恢复 100GB。

例（结算）：额度 100 GB 已用 99 GB，一次上报记账 3 GB 后为 102 GB → 旧周期按 100 GB 结束，新周期从 2 GB 开始；日志 `old_total = 102 GB`、`new_total = 2 GB`、`cleared = 100 GB`、`carried = 2 GB`。

### 3.8 其他路径

礼品卡（加流量、加天数、开套餐）、试用、后台批量生成、套餐强制更新等直接改 `v2_user` 的路径，由 `UserObserver` 兜底调用 `reconcile(user)`：没有周期就建一个（`bootstrap`）；`quota` 跟随 `transfer_enable`（标准周期同时改 `next_quota`）；套餐变化记事件；到期变化按 3.3。`reconcile` 幂等，观察者只在 `plan_id / expired_at / transfer_enable` 变化时调用。读取时（时间线接口）也会做一次轻量 `reconcile`，修正绕过模型事件的批量更新。

按需建立周期（`reconcile` 时没有当前周期）：`next_reset_at` < E 时沿用它作为 `ends_at`（与 §10.2 相同，起点取 `last_reset_at` / `created_at`）；为空或 ≥ E 时 `S = now`、`ends_at = planEnd(now, E)`（新用户、到期后重新开通都走这里，等同旧版观察者的重算）。存量用户在 bootstrap 命令执行前被碰到时也走这条路，因此“周期性套餐但 `next_reset_at` 为空”的用户会被排期，而 bootstrap 命令按 §10.2 把这类用户视为最终周期。

## 4. 数据

### 4.1 新表 `v2_traffic_cycle`

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | bigint unsigned PK | |
| `user_id` | int unsigned，索引 | |
| `seq` | int unsigned | 该用户第几个周期（从启用账本算起，1 开始），`unique(user_id, seq)` |
| `plan_id` | int unsigned null | 周期所属套餐 |
| `kind` | varchar(16) | `standard` / `special` |
| `quota` | bigint unsigned | 本周期额度（字节） |
| `next_quota` | bigint unsigned null | 下一周期额度；null = 同 `quota` |
| `started_at` | int unsigned | |
| `ends_at` | bigint unsigned null | 计划结束；null = 不排期（由 `v2_user.expired_at` bigint 推出，管理员可能填很远的到期） |
| `ended_at` | int unsigned null | 实际结束；null = 当前周期（每个用户最多一条） |
| `start_reason` | varchar(32) | §5 |
| `end_reason` | varchar(32) null | §5 |
| `order_id` | int unsigned null | 开启本周期的订单 |
| `u_end`, `d_end` | bigint unsigned null | 结束时已用上行/下行 |
| `expired_at_start` | bigint unsigned null | 周期开始时的订阅到期时间 |
| `note` | varchar(255) null | 管理员备注（用户可见） |
| `events` | json null | 生命周期事件，最多保留 50 条（§4.3） |
| `created_at`, `updated_at` | int unsigned | unix 秒 |

索引：`(user_id, ended_at)`、`unique(user_id, seq)`。所有写操作在 `lockForUpdate` 锁住 `v2_user` 行的事务里进行。

### 4.2 `v2_traffic_reset_logs`（不改表结构）

- 新行的 `metadata`：

```json
{"reason":"auto_advance","cycle_id":12,"prev_cycle_id":11,"order_id":null,"admin_id":null,
 "quota_before":42949672960,"quota_after":107374182400,"expired_before":1798819199,"expired_after":1797825600,
 "shift_seconds":994799,"note":null,"carried":2147483648,"trigger":{"source":"traffic_report","server_id":3}}
```

- `carried` 只有换时行有（§3.7，超出旧额度、计入新周期的用量，等于该行 `new_total`），其他行没有这个键。

- **清零量为 0 不写日志**（同时也不 `reset_count + 1`）。周期的开始/结束都在周期表里，不需要 0 B 行来证明。例外：换时（`auto_advance`）总是写，见 §3.7。
- `reason` 为空时 `metadata` 里不写这个键：MySQL 把 JSON null 读成字符串 `"null"`，SQL 里会被当成“有原因”，与 PHP 判断不一致。
- 新行的 `trigger_source`：周期滚动沿用调用方（`cron` / `auto` / `user_access`），换时 `auto`，管理员操作 `manual`，订单 `order`，礼品卡 `gift_card`。`admin_usage_edit` 行的 `reset_type = manual`、`new_total` 为修改后的已用量。
- 旧行（`metadata` 为空）展示时按 `trigger_source` 推断：`cron/auto/user_access → cycle_rollover`，`order → order_reset`，`manual/api → admin_reset`，`gift_card → gift_card_reset`。`old_total = 0` 且无 `reason` 的旧行是**噪声**（`is_noise = true`），Admin Next 默认隐藏，用户端和 AI 不展示。
- 启用账本时导入 TrafficReset 插件的 JSONL 审计日志（`storage/logs/traffic_reset/*.jsonl`）：同用户、时间相差 ≤ 5 秒、`trigger_source = manual`、`old_total = 0` 的旧行，补写 `metadata.reason = auto_advance` 及真实清零量（`metadata.cleared`）、到期前后。只写 `metadata`，不改原列；`reset_time` 显式赋回原值（`explicit_defaults_for_timestamp` 关闭的 MySQL 上，表里第一个 TIMESTAMP 列遇到任何更新都会变成当前时间）。

### 4.3 周期事件（`events` 数组元素）

```json
{"at":1793461130,"type":"renewal","by":"order","order_id":18860,"expired_before":1796140799,"expired_after":1798819199}
```

`type`：`renewal` 续费；`quota_changed`（`before/after/scope`）；`expiry_changed`（`before/after`）；`schedule_changed`（`ends_before/ends_after/why`，why ∈ `expiry_shrunk`/`tail_merged`/`method_changed`/`short_fix`）；`usage_cleared`（`log_id/cleared/reason`）；`plan_changed`（`from/to`）；`note_changed`。`by`：`order` / `admin`（带 `admin_id`）/ `gift_card` / `plugin` / `system`。

账本记得的到期时间取最新一条带到期值的事件（`renewal.expired_after` 或 `expiry_changed.after`，null = 长期），没有时取周期的 `expired_at_start`。超过 50 条时先删最旧的其他事件，最新那条带到期值的事件始终保留；否则账本会回落到周期开始时的到期，把订阅误判为已变更或已到期。

### 4.4 `v2_order.expires_at`（新增列，int unsigned null）

待支付订单的截止时间。`OrderHandleJob`：`status = 待支付` 且 `now ≥ (expires_at ?? created_at + 7200)` 时取消。后台分配订单（`order/assign`）新增可选参数 `expire_hours`（1–720，默认 72），写 `expires_at = now + expire_hours×3600`。用户自己下的单 `expires_at` 为空，仍是 2 小时。前端显示截止时间统一用 `expires_at ?? created_at + 7200`。

## 5. 原因代码

| 代码 | 用在 | 中文说明（后台 / AI 用；主题按此翻译） |
|---|---|---|
| `purchase` | start | 新购套餐，开启新周期 |
| `upgrade` | start | 更换套餐，开启新周期 |
| `onetime` | start | 购买一次性流量（不按周期重置） |
| `rollover` | start / end | 上一周期结束，自动进入新周期 |
| `catch_up` | start | 定时任务补跑，从最近的周期点开始 |
| `advance` | start | 流量用尽，提前开启本周期（换时） |
| `advanced` | end | 流量用尽，提前结束并开启下一周期 |
| `admin` | start | 管理员调整，周期重新开始 |
| `bootstrap` | start | 启用周期记录时按当时数据建立（之前的周期见重置记录） |
| `replaced` | end | 被新购 / 换套餐 / 管理员重设替换 |
| `expired` | end | 订阅到期 |
| `cycle_rollover` | log | 周期到期，已用流量清零并进入新周期 |
| `auto_advance` | log | 流量用尽，提前开启下一周期，到期时间相应前移 |
| `new_purchase` | log | 新购套餐时清零 |
| `plan_change` | log | 更换套餐时清零 |
| `onetime_purchase` | log | 购买一次性流量时清零 |
| `renewal_reset` | log | 续费时按站点设置清零 |
| `reset_package` | log | 购买流量重置包，本周期已用流量清零 |
| `gift_card_reset` | log | 礼品卡重置流量 |
| `admin_reset` | log | 管理员手动重置流量 |
| `admin_restart` | log | 管理员重设周期时清零 |
| `admin_usage_edit` | log | 管理员修改了已用流量 |
| `order_reset` | log（旧记录推断） | 订单开通时清零（新购或换套餐） |

换时资格 `advance.reason`：`eligible` / `no_cycle` / `no_expiry` / `final_cycle`（本周期就是最后一个周期）/ `remaining_too_short`（剩余有效期不足）/ `disabled`（插件未启用、该重置方式未开启，或额度为 0）。`advance()` 另可能返回 `not_exhausted`（§3.7 锁内复核时并未用尽）或 `banned`（§3.7 用户已封禁）。

重置日志 `metadata.trigger.source`（插件写入）：`traffic_report` 节点上报、`renewal_order` 续费订单、`sweep` 定时扫描已用尽的用户；JSONL 审计日志的 `trigger.source` 相同。

## 6. 服务接口（PHP，`App\Services\TrafficCycleService`）

插件只依赖下列公开方法（签名稳定）：

```php
public function current(User $user, ?int $now = null): ?TrafficCycle            // 不存在时 bootstrap，含轻量 reconcile
public function timeline(User $user, array $opts = [], ?int $now = null): array  // §7.1 结构；opts: history_limit, history_offset, events_limit, admin(bool)
public function advanceEligibility(User $user, int $minRemainingDays, ?int $now = null): array
    // ['eligible'=>bool,'reason'=>code,'shift_seconds'=>int,'next_quota'=>int,'expired_after'=>?int,'cycle_ends_at'=>?int]
public function advance(User $user, array $trigger, int $minRemainingDays = 30, ?int $now = null): array
    // ['ok'=>bool,'reason'=>code,'before'=>snapshot,'after'=>snapshot,'shift_seconds'=>int,
    //  'closed_cycle_id'=>?int,'new_cycle_id'=>?int,'reset_log_id'=>?int,'cleared'=>int,'carried'=>int]
    // snapshot = id,email,plan_id,plan_name,u,d,used_traffic,transfer_enable,expired_at,next_reset_at,last_reset_at,reset_count
    // before / after 是锁住用户行后读到 / 写入的值（被拒时 after = before）；trigger.pending_bytes 可选（§3.7）
public function rollover(User $user, ?int $now = null): bool
public function reconcile(User $user, ?int $now = null): void
public static function planEnd(int $start, ?int $expiredAt, int $method, int $minSeconds, string $tz): ?int   // 纯函数
public function enabled(): bool                                                    // 账本表已建好（新镜像上线、迁移未跑时为 false）
public function exhaustedCandidates(int $minRemainingDays, int $limit = 200, ?int $now = null, ?int $afterId = null): Collection   // §3.7 扫描名单，afterId = 按用户 ID 分页
```

换时策略钩子：核心调用 `HookManager::filter('traffic_cycle.advance_policy', null, $user)`。TrafficReset 插件启用时返回 `['enabled'=>bool,'min_remaining_days'=>int]`（按该用户的重置方式和插件开关算），为 null 时视为未启用。时间线里的 `advance` 段据此生成。

上报记账钩子：`TrafficFetchJob` 把一批上报（`$data = [user_id => [上行, 下行]]`，未乘倍率）按 `× $server['rate']` 加到 `u / d` 之后，调用 `HookManager::call('traffic.process.after', [$server, $protocol, $data])`（`$server` 是数组，同 `traffic.process.before`）。监听器收到这个三元数组。监听器抛出的异常只记日志（`traffic.process.after hook failed`），已记的流量不受影响，任务也不会失败（`tries = 1`，重跑会重复记账）。没有这个钩子的旧面板上，TrafficReset 1.2.1 由每分钟扫描换时（最多晚一分钟）；旧面板的 `advance()` 换时直接清零，超出部分不带入新周期。这个钩子跑在常驻的 Horizon 队列 worker 里，worker 只在启动时按 `v2_plugins` 加载一次插件（后台停用插件或改配置不会让它重新加载），所以队列里触发的监听器（`traffic.process.after`、`order.open.after`）要先按 `v2_plugins` 重新读本插件的 `is_enabled` 和 `config`：已停用或已卸载时不处理，否则用数据库里的当前配置。定时任务同理（Octane 的 tick 在常驻进程里调用 `schedule:run`）。TrafficReset 1.2.1 在这两个监听器和每分钟扫描里这样做（只在本批有已用尽的用户、续费订单或每次扫描时多一次查询）。

## 7. HTTP 接口

### 7.1 用户端 `GET /api/v1/user/trafficCycle/fetch`

参数：`history_page`（默认 1）、`history_size`（默认 10，≤50）、`events_size`（默认 20，≤50）。返回 `{"status":"success","data": Timeline}`：

```jsonc
{
  "now": 1793462400,
  "user_id": 3711,
  "plan": {"id": 19, "name": "天穹旗舰 · 三网巅峰入口", "quota": 107374182400},   // 无套餐为 null
  "expired_at": 1798819199,                 // null = 长期有效；没有套餐的用户也是 null（库里默认值 0 不是日期）
  "reset_method": "monthly",                // monthly | first_day_month | yearly | first_day_year | never
  "min_cycle_days": 15,
  "current": {                              // 无套餐或已过期为 null
    "id": 812, "seq": 1, "kind": "special", "plan_id": 19, "plan_name": "天穹旗舰 · 三网巅峰入口",
    "quota": 42949672960, "next_quota": 107374182400,
    "u": 53241998, "d": 400877322, "used": 454119320, "remaining": 42495553640,
    "started_at": 1793458980, "ends_at": 1796140799, "ended_at": null,
    "is_final": false,                      // ends_at == expired_at（到点就是到期，不重置）
    "start_reason": "admin", "end_reason": null, "order_id": null,
    "note": "中型芒果剩余价值等值转换",
    "events": [{"at": 1793461925, "type": "renewal", "by": "order", "order_id": 18860, "expired_before": 1796140799, "expired_after": 1798819199}]
  },
  "upcoming": [                             // 当前周期之后到到期为止的排期，最多 12 个
    {"index": 1, "starts_at": 1796140799, "ends_at": 1798819199, "quota": 107374182400, "is_final": true}
  ],
  "advance": {                              // 插件未启用时 {"enabled": false, "reason": "disabled"}
    "enabled": true, "min_remaining_days": 30, "eligible_if_exhausted": true, "reason": "eligible",
    "shift_seconds": 2678399, "next_quota": 107374182400, "expired_after": 1796140800
  },
  "history": [ /* 已结束的周期，结构同 current，最新在前 */ ],
  "history_total": 0,
  "events": [                               // 有意义的重置记录（不含噪声），最新在前
    {"id": 29779, "at": 1792770783, "reason": "cycle_rollover", "legacy": true,
     "trigger_source": "cron", "cleared": 74777028792, "cleared_upload": 0, "cleared_download": 0, "carried": 0,
     "quota_before": null, "quota_after": null, "expired_before": null, "expired_after": null,
     "shift_seconds": null, "cycle_id": null, "order_id": null, "note": null}
  ],
  "events_total": 5
}
```

- 周期对象另带 `u_end` / `d_end`（已结束周期结束时的已用量，当前周期为 null）。换时结束的周期用尽时正好等于额度（§3.7）。
- `events[].carried`：换时带入新周期的用量（= 该行 `new_total`），其他行和旧行为 0。界面在换时行 `carried > 0` 时于清零量旁注明“超出额度的 X 计入新周期”。
- 用户端 `events[].note` 只给出 `admin_restart` / `admin_usage_edit` 行携带的周期备注；管理员手动重置（`admin_reset`）填写的原因只在后台时间线可见。
- 用户端周期对象的 `events` 不含 `admin_id`（哪位管理员操作的属于内部信息），后台时间线保留。

### 7.2 后台

| 接口 | 说明 |
|---|---|
| `GET /api/v2/{secure}/user/trafficCycle/fetch?user_id=` | 同 7.1，`opts.admin = true`：`events` 含噪声行（`is_noise` 标记）、`metadata` 原文、`admin_id`；额外返回 `user`（id、email、transfer_enable、u、d、expired_at、next_reset_at、last_reset_at、reset_count）。 |
| `GET /api/v2/{secure}/user/trafficCycle/preview` | §3.6。返回 `{"data":{"current":Cycle,"upcoming":[...],"effects":[...],"warnings":[...]}}`。`effects`：`cycle_restart`、`quota_cycle_only`、`quota_standing`、`ends_changed`、`expiry_changed`、`usage_cleared`、`plan_changed`。`warnings`：`ends_after_expiry`、`ends_before_now`、`short_cycle`（< M）、`quota_below_used`、`no_plan`。 |
| `POST /api/v2/{secure}/user/update` | 新增 §3.6 四个可选参数。 |
| `GET /api/v2/{secure}/traffic-reset/logs` | 原参数不变；新增 `hide_noise`（0/1，默认 0）、`reason`。每行新增 `reason`、`is_noise`、`cycle_id`、`order_id`、`admin_id`、`note`、`cleared`（真实清零量，优先 `metadata.cleared`）、`carried`（换时带入新周期的用量，其他行 0）、`quota_before/after`、`expired_before/after`、`shift_seconds`。 |
| `GET /api/v2/{secure}/traffic-reset/user/{id}/history` | 原字段不变，每行另带与 `traffic-reset/logs` 相同的账本字段（Admin Next 的“流量重置”对话框用）。 |
| `POST /api/v2/{secure}/order/assign` | 新增可选 `expire_hours`（1–720，默认 72）。订单列表/详情返回 `expires_at`。 |

- `effects` / `warnings` 的元素是对象 `{"type": 代码, ...}`，附带相关数值，例如 `{"type":"ends_changed","before":…,"after":…,"why":"restart"}`、`{"type":"quota_below_used","quota":…,"used":…}`、`{"type":"short_cycle","seconds":…,"min_seconds":…}`。参数本身不合法（`keep` 时传 `cycle_ends_at`、`cycle_ends_at ≤ now` 或 `> E`）时 `warnings` 另含 `{"type":"invalid","message":"…"}`；`user/update` 对同样的参数返回 422 和该中文提示，什么都不改。
- `user/trafficCycle/fetch` 用户不存在时返回 400（`400202`）。

## 8. 各端要做的事

- **后端**：迁移、模型 `TrafficCycle`、`TrafficCycleService`、改 `TrafficResetService`（`checkAndReset` 走 `rollover`、`performReset` 支持 `context` 且 0 不记、`calculateNextResetTime` 读周期）、`OrderService`、`UserObserver`/`PlanObserver`、`UserService::getResetDay`、礼品卡与后台重置带原因、`ResetTraffic` 命令的 `--fix-null/--force` 改用周期、新命令 `traffic:cycle-bootstrap`（§10.2）、订单截止时间、接口与测试。
- **TrafficReset 插件 1.2.0**：有 `TrafficCycleService` 时，策略判断后调用 `advance()`，JSONL 审计日志沿用原格式并加 `cycle` 字段（`closed_cycle_id/new_cycle_id/quota_before/quota_after/shift_seconds/reset_log_id`）；新增配置 `min_remaining_days`（默认 30）；注册 `traffic_cycle.advance_policy`。没有核心服务时退回原逻辑。
- **TrafficReset 插件 1.2.1**（配合 §3.7 结算）：有核心服务时 `traffic.process.before` 不再换时，改为监听 `traffic.process.after`（记账之后，按数据库里的已用量判断），`pending_bytes` 固定为 0；扫描按用户 ID 分页、只对失败的用户节流；JSONL 的 `before/after` 取核心锁内快照（`group_id`、`banned` 仍取插件读数），`cycle` 加 `cleared`、`carried`。
- **AiTicketReply 1.7.21**：重置记录行在 `carried > 0` 时注明超出额度的部分计入新周期；JSONL 行带“结算”（旧周期清零量、带入新周期的用量）。
- **AiTicketReply**：新增【流量周期】上下文（当前周期、后续排期、换时规则与资格、最近周期、最近重置记录及日志 ID 的中文解读），开关 `enable_traffic_cycle_context`（默认开，不写库）。
- **Admin Next**：重做“流量重置记录”页（默认隐藏噪声、原因说人话、到期/额度变化、按用户看周期时间线）；用户编辑抽屉加“周期影响”预览和选项；用户操作加“流量周期”；分配订单加“支付有效期”；订单显示截止时间。
- **LiquidNext / ez**：新增“流量周期”页（当前周期、后续排期、换时规则、历史周期、重置记录），仪表盘流量卡显示周期信息与入口；订单显示支付截止时间。接口 404 时显示“暂未开放”，不报错。

## 9. AI 上下文格式（AiTicketReply）

```
【流量周期】
数据来源：面板流量周期账本与重置记录，按 user_id 精确匹配，可信度高于用户口述。
当前周期：特殊周期，2026-10-31 23:03 → 2026-12-01 23:59:59，额度 40 GB，已用 0.42 GB，剩余 39.58 GB。来源：管理员调整（备注：中型芒果剩余价值等值转换）。下个周期起额度 100 GB（套餐标准）。
后续排期：2026-12-01 23:59:59 → 2027-01-01 23:59:59（到期），100 GB。
换时规则：流量用尽且剩余有效期 ≥ 30 天时，系统立即开启下一周期，到期时间前移本周期未用完的时长。当前若用尽：可换时，到期将前移 30.9 天至 2026-12-02 02:19:26。
（例中 now = 11-01 02:19:26：shift = 12-01 23:59:59 − now，E' = 01-01 23:59:59 − shift = now + 31 天，见 §3.7。）
最近周期：……（最多 6 条，含结束原因）
最近重置记录（日志 ID）：
- #29779 2026-10-23 23:53 周期到期自动清零 69.64 GB
- #30511 …（噪声行注明“系统冗余记录，无实际清零”）
解读规则：……（告诉模型：特殊周期结束后恢复套餐标准；续费不覆盖特殊周期额度；到期时间=最后一个周期结束，不会再重置；不要承诺规则外的重置）
```

## 10. 上线

后端运维步骤（部署顺序、核对、回滚、已知问题）见 [README.md](README.md)。

### 10.1 临时修正（已执行，2026-10-31 23:46）

三站“一天后重置”的用户（含工单 #6982 的用户 3711）的 `next_reset_at` 已顺延到下一个边界（多数等于到期时间），分四次：10-31 23:46 共 68 人（mg 26 / 98k 19 / yzy 23）、11-01 00:00 yzy 1 人、11-01 03:50 共 10 人（11-01 凌晨新购的人，见下）、11-01 03:59 共 6 人（周期起点改为也认 TrafficReset 1.1.x 的换时后发现的）。旧值备份在各站 `backups/2026-10-31-traffic-cycle/interim-next-reset-fix*.plan.json`。

两个仍在产生“一天后重置”的旧代码问题，新版本都已修：

- `OrderService::getTime` 用 Carbon 3 的 `createFromTimestamp($ts)`（默认 UTC）加月份：北京时间 0–8 点下单按 UTC 的前一天算，10-31/11-01 凌晨买一个月得到 12-02 到期、11-02 就重置。改为按站点时区加月份。
- TrafficReset 1.1.x 换时用 UTC 的“今天几号”设到期日并允许月份溢出：月末换时把到期设到下月 1–2 号，旧排期第二天又重置。1.2.0 改由核心换时。
- bootstrap 的周期起点也认 1.1.x 的换时（`trigger_source = manual` 且 `old_total = 0` 的行，报告里 `start_source = plugin_advance`）。

### 10.2 `php artisan traffic:cycle-bootstrap`

- `--dry-run`（默认）：只出报告。`--apply`：执行。`--report=<path>`：写 JSON 报告。
- 对所有有套餐且未过期（或长期）的用户建立当前周期：`ends_at` 沿用现有 `next_reset_at`（承诺过的重置时间不变）；最终周期（`next_reset_at` 为空、≥ E 或等于 E）置 `next_reset_at = null`。
- `--fix-short`：周期起点（最近一次新购/换套餐订单、定时重置、TrafficReset 1.1.x 换时、管理员改动中最晚的）到 `next_reset_at` 不足 M 时，改为 `planEnd(S, E)`，报告逐条列出。
  - “管理员改动”只算改了 `expired_at` / `plan_id` / `transfer_enable` 的 `user.update` 审计记录（与该用户上一条 `user.update` 记录比较，没有上一条时算）。只改备注、设备数等的编辑不移动周期起点，否则会误删用户一次即将到来的重置。
  - 不加 `--fix-short` 时报告的 `notes` 里用 `short_cycle` 标出仍短于 M 的周期；`unscheduled_periodic` 标出按周期重置的套餐但原 `next_reset_at` 为空的用户（按本节规则保持不重置，供人工核对）。
- `--import-jsonl`：按 §4.2 回填历史换时记录；`--jsonl-dir=` 可指定目录（默认 `storage/logs/traffic_reset`）。
- 幂等：已有当前周期的用户跳过；已回填过的日志行报告为 `already_imported`。

### 10.3 回滚

周期表只增不改用户数据以外的东西；回滚镜像后旧代码不读周期表。`bootstrap` 改动的 `next_reset_at` 在报告里有前后值，可按报告写回。
