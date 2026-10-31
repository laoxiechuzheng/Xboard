// Dev-only in-memory mock of the panel API, for UI work on the traffic cycle pages without a backend.
// Enable with XBOARD_DEV_MOCK=1 in admin-next/.env.development.local (or the environment) and run `pnpm dev`;
// XBOARD_DEV_MOCK=legacy mimics a panel without the traffic cycle backend (404 + legacy log rows).
// vite.config.ts only adds this plugin for `vite dev`, so it never reaches the build. All data is fake.
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

type Json = Record<string, unknown>

const GB = 1024 ** 3
const DAY = 86400
const MIN_CYCLE = 15 * DAY

const nowTs = () => Math.floor(Date.now() / 1000)

/** Local midnight today + days, then h:m:s (the dev box and the panel both run Asia/Shanghai). */
function at(days: number, h = 0, m = 0, s = 0): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  d.setHours(h, m, s, 0)
  return Math.floor(d.getTime() / 1000)
}

/** ts ± months, day clamped to the month end, time of day kept (DESIGN §2 boundary). */
function addMonths(ts: number, months: number): number {
  const d = new Date(ts * 1000)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return Math.floor(d.getTime() / 1000)
}

/** DESIGN §3.2 planEnd for monthly plans. */
function planEnd(start: number, expiry: number | null): number | null {
  if (expiry === null) return null
  const candidates: number[] = []
  for (let k = 0; k < 240; k++) {
    const b = addMonths(expiry, -k)
    if (b <= start) break
    candidates.unshift(b)
  }
  let pick = expiry
  for (const b of candidates) {
    if (b - start >= MIN_CYCLE) {
      pick = b
      break
    }
  }
  return expiry - pick < MIN_CYCLE ? expiry : pick
}

function schedule(from: number, expiry: number | null, quota: number) {
  const out: Json[] = []
  let s = from
  while (expiry !== null && s < expiry && out.length < 12) {
    const e = planEnd(s, expiry) as number
    out.push({ index: out.length + 1, starts_at: s, ends_at: e, quota, is_final: e === expiry })
    s = e
  }
  return out
}

// ------------------------------------------------------------------ data

interface MockPlan {
  id: number
  name: string
  transfer_enable: number
  prices: Record<string, number>
  reset_traffic_method: number | null
}

const PLANS: MockPlan[] = [
  { id: 3, name: '98k Lite', transfer_enable: 128, prices: { monthly: 18, quarterly: 50 }, reset_traffic_method: 1 },
  { id: 7, name: '中型芒果', transfer_enable: 200, prices: { monthly: 45 }, reset_traffic_method: 1 },
  { id: 19, name: '天穹旗舰 · 三网巅峰入口', transfer_enable: 100, prices: { monthly: 99, quarterly: 279 }, reset_traffic_method: 1 },
  { id: 21, name: '普通 99 元档', transfer_enable: 1229, prices: { monthly: 99 }, reset_traffic_method: 1 },
  { id: 5, name: '不限时流量包', transfer_enable: 500, prices: { onetime: 60 }, reset_traffic_method: 2 },
]
const planById = (id: number | null | undefined) => PLANS.find((p) => p.id === Number(id)) ?? null

interface MockCycle {
  id: number
  seq: number
  kind: 'standard' | 'special'
  plan_id: number | null
  quota: number
  next_quota: number | null
  started_at: number
  ends_at: number | null
  ended_at: number | null
  start_reason: string
  end_reason: string | null
  order_id: number | null
  u_end?: number
  d_end?: number
  note: string | null
  events: Json[]
}

interface MockUser {
  id: number
  email: string
  plan_id: number | null
  transfer_enable: number
  u: number
  d: number
  expired_at: number | null
  next_reset_at: number | null
  last_reset_at: number | null
  reset_count: number
  created_at: number
  is_admin?: boolean
  cycles: MockCycle[]
}

// Ticket #6982-like story: 中型芒果 converted to a 40 GB special 天穹旗舰 cycle, then renewed one month.
// Started yesterday 23:03 with the "一个月" button (end of day one month later), then renewed one month.
const S3711 = at(0) - 3420
const E3711_OLD = addMonths(at(0, 23, 59, 59), 1)
const E3711 = addMonths(E3711_OLD, 1)

const USERS: MockUser[] = [
  {
    id: 3711,
    email: 'mango3711@example.com',
    plan_id: 19,
    transfer_enable: 40 * GB,
    u: 53241998,
    d: 400877322,
    expired_at: E3711,
    next_reset_at: E3711_OLD,
    last_reset_at: S3711,
    reset_count: 3,
    created_at: at(-80, 9, 12),
    cycles: [
      {
        id: 811,
        seq: 1,
        kind: 'standard',
        plan_id: 7,
        quota: 200 * GB,
        next_quota: null,
        started_at: at(-20, 10, 20),
        ends_at: at(10, 10, 20),
        ended_at: S3711,
        start_reason: 'bootstrap',
        end_reason: 'replaced',
        order_id: null,
        u_end: 5.1 * GB,
        d_end: 32.1 * GB,
        note: null,
        events: [],
      },
      {
        id: 812,
        seq: 2,
        kind: 'special',
        plan_id: 19,
        quota: 40 * GB,
        next_quota: 100 * GB,
        started_at: S3711,
        ends_at: E3711_OLD,
        ended_at: null,
        start_reason: 'admin',
        end_reason: null,
        order_id: null,
        note: '中型芒果剩余价值等值转换',
        events: [
          { at: S3711, type: 'plan_changed', by: 'admin', admin_id: 1, from: 7, to: 19 },
          { at: S3711, type: 'quota_changed', by: 'admin', admin_id: 1, before: 200 * GB, after: 40 * GB, scope: 'cycle' },
          { at: S3711 + 540, type: 'renewal', by: 'order', order_id: 18860, expired_before: E3711_OLD, expired_after: E3711 },
        ],
      },
    ],
  },
  // Same story before the admin's edit (edit drawer demo): 中型芒果 200 GB, about to be converted.
  {
    id: 3720,
    email: 'mango3720@example.com',
    plan_id: 7,
    transfer_enable: 200 * GB,
    u: 4.2 * GB,
    d: 33 * GB,
    expired_at: at(10, 10, 20),
    next_reset_at: null,
    last_reset_at: at(-20, 10, 20),
    reset_count: 2,
    created_at: at(-80, 9, 12),
    cycles: [
      {
        id: 820,
        seq: 1,
        kind: 'standard',
        plan_id: 7,
        quota: 200 * GB,
        next_quota: null,
        started_at: at(-20, 10, 20),
        ends_at: at(10, 10, 20),
        ended_at: null,
        start_reason: 'bootstrap',
        end_reason: null,
        order_id: null,
        note: null,
        events: [],
      },
    ],
  },
  {
    id: 1255,
    email: 'lite1255@example.com',
    plan_id: 3,
    transfer_enable: 128 * GB,
    u: 0.62 * GB,
    d: 1.29 * GB,
    expired_at: at(28, 23, 59, 59),
    next_reset_at: null,
    last_reset_at: at(-2, 23, 59, 59),
    reset_count: 2,
    created_at: at(-63, 21, 4),
    cycles: [
      {
        id: 905,
        seq: 1,
        kind: 'standard',
        plan_id: 3,
        quota: 128 * GB,
        next_quota: null,
        started_at: at(-2, 23, 59, 59),
        ends_at: at(28, 23, 59, 59),
        ended_at: null,
        start_reason: 'bootstrap',
        end_reason: null,
        order_id: null,
        note: null,
        events: [],
      },
    ],
  },
  {
    id: 2048,
    email: 'flagship2048@example.com',
    plan_id: 19,
    transfer_enable: 100 * GB,
    u: 2.4 * GB,
    d: 11.9 * GB,
    expired_at: at(78, 12, 0),
    next_reset_at: addMonths(at(78, 12, 0), -2),
    last_reset_at: at(-2, 14, 30),
    reset_count: 6,
    created_at: at(-200, 8, 0),
    cycles: [
      {
        id: 870,
        seq: 1,
        kind: 'standard',
        plan_id: 19,
        quota: 100 * GB,
        next_quota: null,
        started_at: at(-18, 12, 0),
        ends_at: at(13, 12, 0),
        ended_at: at(-2, 14, 30),
        start_reason: 'bootstrap',
        end_reason: 'advanced',
        order_id: null,
        u_end: 9.6 * GB,
        d_end: 90.4 * GB,
        note: null,
        events: [],
      },
      {
        id: 931,
        seq: 2,
        kind: 'standard',
        plan_id: 19,
        quota: 100 * GB,
        next_quota: null,
        started_at: at(-2, 14, 30),
        ends_at: addMonths(at(78, 12, 0), -2),
        ended_at: null,
        start_reason: 'advance',
        end_reason: null,
        order_id: null,
        note: null,
        events: [{ at: at(-2, 14, 30), type: 'usage_cleared', by: 'plugin', log_id: 31002, cleared: 100 * GB, reason: 'auto_advance' }],
      },
    ],
  },
  {
    id: 5120,
    email: 'forever5120@example.com',
    plan_id: 5,
    transfer_enable: 500 * GB,
    u: 12 * GB,
    d: 141 * GB,
    expired_at: null,
    next_reset_at: null,
    last_reset_at: null,
    reset_count: 0,
    created_at: at(-300, 10, 0),
    cycles: [
      {
        id: 700,
        seq: 1,
        kind: 'standard',
        plan_id: 5,
        quota: 500 * GB,
        next_quota: null,
        started_at: at(-120, 10, 0),
        ends_at: null,
        ended_at: null,
        start_reason: 'onetime',
        end_reason: null,
        order_id: 15002,
        note: null,
        events: [],
      },
    ],
  },
  {
    id: 6001,
    email: 'expired6001@example.com',
    plan_id: 3,
    transfer_enable: 128 * GB,
    u: 3 * GB,
    d: 40 * GB,
    expired_at: at(-1, 23, 59, 59),
    next_reset_at: null,
    last_reset_at: at(-31, 23, 59, 59),
    reset_count: 4,
    created_at: at(-150, 10, 0),
    cycles: [],
  },
  {
    id: 7002,
    email: 'noplan7002@example.com',
    plan_id: null,
    transfer_enable: 0,
    u: 0,
    d: 0,
    expired_at: null,
    next_reset_at: null,
    last_reset_at: null,
    reset_count: 0,
    created_at: at(-3, 18, 0),
    cycles: [],
  },
  {
    id: 1,
    email: 'admin@example.com',
    plan_id: null,
    transfer_enable: 0,
    u: 0,
    d: 0,
    expired_at: null,
    next_reset_at: null,
    last_reset_at: null,
    reset_count: 0,
    created_at: at(-400, 9, 0),
    is_admin: true,
    cycles: [],
  },
]
const userById = (id: number) => USERS.find((u) => u.id === id) ?? null

interface MockLog {
  id: number
  user_id: number
  at: number
  source: string
  reset_type: string
  up: number
  down: number
  /** null = legacy row without metadata */
  meta: Json | null
}

const LOGS: MockLog[] = [
  // 3711
  { id: 30533, user_id: 3711, at: S3711 + 540, source: 'order', reset_type: 'monthly', up: 0, down: 0, meta: null },
  {
    id: 30511,
    user_id: 3711,
    at: S3711,
    source: 'manual',
    reset_type: 'manual',
    up: 4.2 * GB,
    down: 33 * GB,
    meta: {
      reason: 'admin_restart',
      cycle_id: 812,
      prev_cycle_id: 811,
      admin_id: 1,
      quota_before: 200 * GB,
      quota_after: 40 * GB,
      expired_before: at(10, 10, 20),
      expired_after: E3711_OLD,
      note: '中型芒果剩余价值等值转换',
    },
  },
  { id: 29779, user_id: 3711, at: at(-20, 10, 20, 5), source: 'cron', reset_type: 'monthly', up: 3.1 * GB, down: 66.54 * GB, meta: null },
  { id: 28410, user_id: 3711, at: at(-50, 10, 20, 4), source: 'cron', reset_type: 'monthly', up: 10 * GB, down: 144.2 * GB, meta: null },
  { id: 27003, user_id: 3711, at: at(-80, 9, 12, 31), source: 'order', reset_type: 'monthly', up: 0, down: 0, meta: null },
  { id: 27002, user_id: 3711, at: at(-80, 9, 12, 30), source: 'order', reset_type: 'monthly', up: 0, down: 0, meta: null },
  // 2048: 换时 (plugin cleared first, so the old row says 0 B; the import backfilled metadata) + its noise twin
  {
    id: 31002,
    user_id: 2048,
    at: at(-2, 14, 30, 2),
    source: 'manual',
    reset_type: 'manual',
    up: 0,
    down: 0,
    meta: {
      reason: 'auto_advance',
      cleared: 100 * GB,
      cycle_id: 931,
      prev_cycle_id: 870,
      quota_before: 100 * GB,
      quota_after: 100 * GB,
      expired_before: at(78, 12, 0) + (at(13, 12, 0) - at(-2, 14, 30)),
      expired_after: at(78, 12, 0),
      shift_seconds: at(13, 12, 0) - at(-2, 14, 30),
      trigger: { source: 'traffic_report', server_id: 3 },
    },
  },
  { id: 31001, user_id: 2048, at: at(-2, 14, 30), source: 'manual', reset_type: 'manual', up: 0, down: 0, meta: null },
  {
    id: 29550,
    user_id: 2048,
    at: at(-18, 12, 0, 3),
    source: 'cron',
    reset_type: 'monthly',
    up: 8.8 * GB,
    down: 87.3 * GB,
    meta: { reason: 'cycle_rollover', cycle_id: 870, prev_cycle_id: 802 },
  },
  // 1255
  { id: 31120, user_id: 1255, at: at(-2, 23, 59, 59), source: 'cron', reset_type: 'monthly', up: 7.7 * GB, down: 112.6 * GB, meta: null },
  { id: 28801, user_id: 1255, at: at(-33, 23, 59, 59), source: 'cron', reset_type: 'monthly', up: 5.2 * GB, down: 92.6 * GB, meta: null },
  { id: 26002, user_id: 1255, at: at(-63, 21, 5, 1), source: 'order', reset_type: 'monthly', up: 0, down: 0, meta: null },
  { id: 26001, user_id: 1255, at: at(-63, 21, 5), source: 'order', reset_type: 'monthly', up: 0, down: 0, meta: null },
  // others: every reason once
  {
    id: 31210,
    user_id: 5120,
    at: at(-1, 16, 8),
    source: 'order',
    reset_type: 'purchase',
    up: 1.1 * GB,
    down: 18.4 * GB,
    meta: { reason: 'reset_package', order_id: 19002, cycle_id: 700 },
  },
  {
    id: 31188,
    user_id: 6001,
    at: at(-3, 11, 42),
    source: 'gift_card',
    reset_type: 'monthly',
    up: 0.4 * GB,
    down: 9.6 * GB,
    meta: { reason: 'gift_card_reset', cycle_id: 640 },
  },
  {
    id: 31150,
    user_id: 1255,
    at: at(-4, 20, 15),
    source: 'manual',
    reset_type: 'manual',
    up: 0,
    down: 6.5 * GB,
    meta: { reason: 'admin_usage_edit', admin_id: 1, cycle_id: 905, note: '节点故障补偿：扣回 6.5 GB' },
  },
  { id: 31090, user_id: 6001, at: at(-6, 9, 30), source: 'manual', reset_type: 'manual', up: 2 * GB, down: 21 * GB, meta: null },
  {
    id: 31010,
    user_id: 2048,
    at: at(-9, 13, 2),
    source: 'order',
    reset_type: 'monthly',
    up: 0.8 * GB,
    down: 3.7 * GB,
    meta: { reason: 'plan_change', order_id: 18750, quota_before: 128 * GB, quota_after: 100 * GB, cycle_id: 870 },
  },
  {
    id: 30980,
    user_id: 7002,
    at: at(-11, 18, 1),
    source: 'order',
    reset_type: 'monthly',
    up: 0.2 * GB,
    down: 1.3 * GB,
    meta: { reason: 'new_purchase', order_id: 18690, cycle_id: 851 },
  },
  {
    id: 30940,
    user_id: 6001,
    at: at(-14, 7, 45),
    source: 'order',
    reset_type: 'monthly',
    up: 0.5 * GB,
    down: 4.1 * GB,
    meta: { reason: 'renewal_reset', order_id: 18611, cycle_id: 640 },
  },
  { id: 30902, user_id: 5120, at: at(-16, 10, 0), source: 'order', reset_type: 'monthly', up: 0, down: 0, meta: null },
]
// Filler rollovers so paging and the 30-day stats have something to count.
for (let i = 0; i < 26; i++) {
  const legacy = i % 3 !== 0
  LOGS.push({
    id: 30000 + i * 17,
    user_id: [1255, 2048, 6001, 5120][i % 4],
    at: at(-1 - i, 23, 59, 59 - (i % 5)),
    source: i % 5 === 0 ? 'user_access' : 'cron',
    reset_type: 'monthly',
    up: (1 + (i % 7)) * GB,
    down: (20 + ((i * 13) % 90)) * GB,
    meta: legacy ? null : { reason: 'cycle_rollover', cycle_id: 600 + i },
  })
  if (i % 4 === 1) {
    LOGS.push({ id: 30001 + i * 17, user_id: 1255, at: at(-1 - i, 10, 0), source: 'order', reset_type: 'monthly', up: 0, down: 0, meta: null })
  }
}

const REASONS = new Set([
  'cycle_rollover', 'auto_advance', 'new_purchase', 'plan_change', 'onetime_purchase', 'renewal_reset', 'reset_package',
  'gift_card_reset', 'admin_reset', 'admin_restart', 'admin_usage_edit', 'order_reset',
])
function inferred(source: string) {
  if (source === 'order') return 'order_reset'
  if (source === 'manual' || source === 'api') return 'admin_reset'
  if (source === 'gift_card') return 'gift_card_reset'
  return 'cycle_rollover'
}
const metaReason = (l: MockLog) => (l.meta && REASONS.has(String(l.meta.reason)) ? String(l.meta.reason) : null)
const logReason = (l: MockLog) => metaReason(l) ?? inferred(l.source)
const logNoise = (l: MockLog) => l.up + l.down === 0 && !metaReason(l)
const num = (v: unknown) => (v === undefined || v === null ? null : Number(v))

const SOURCE_NAMES: Record<string, string> = { auto: '自动触发', manual: '手动触发', api: 'API调用', cron: '定时任务', user_access: '用户访问' }
const TYPE_NAMES: Record<string, string> = { monthly: '按月重置', manual: '手动重置', purchase: '购买重置包' }
const iso = (ts: number) => new Date(ts * 1000).toISOString()

function logRow(l: MockLog, legacy: boolean): Json {
  const u = userById(l.user_id)
  const total = Math.round(l.up + l.down)
  const row: Json = {
    id: l.id,
    user_id: l.user_id,
    user_email: u?.email ?? 'N/A',
    reset_type: l.reset_type,
    reset_type_name: TYPE_NAMES[l.reset_type] ?? l.reset_type,
    reset_time: iso(l.at),
    old_traffic: { upload: Math.round(l.up), download: Math.round(l.down), total, formatted: `${(total / GB).toFixed(2)} GB` },
    new_traffic: { upload: 0, download: 0, total: 0, formatted: '0 B' },
    trigger_source: l.source,
    trigger_source_name: SOURCE_NAMES[l.source] ?? l.source,
    metadata: l.meta,
    created_at: iso(l.at),
  }
  if (legacy) return row
  const m = l.meta ?? {}
  return {
    ...row,
    reason: logReason(l),
    is_noise: logNoise(l),
    cycle_id: num(m.cycle_id),
    order_id: num(m.order_id),
    admin_id: num(m.admin_id),
    note: (m.note as string) ?? null,
    cleared: num(m.cleared) ?? total,
    quota_before: num(m.quota_before),
    quota_after: num(m.quota_after),
    expired_before: num(m.expired_before),
    expired_after: num(m.expired_after),
    shift_seconds: num(m.shift_seconds),
  }
}

// ------------------------------------------------------------------ timeline / preview

function cycleJson(user: MockUser, c: MockCycle, current: boolean): Json {
  const used = current ? user.u + user.d : (c.u_end ?? 0) + (c.d_end ?? 0)
  return {
    id: c.id,
    seq: c.seq,
    kind: c.kind,
    plan_id: c.plan_id,
    plan_name: planById(c.plan_id)?.name ?? null,
    quota: c.quota,
    next_quota: c.next_quota,
    u: current ? user.u : (c.u_end ?? 0),
    d: current ? user.d : (c.d_end ?? 0),
    used,
    remaining: Math.max(0, c.quota - used),
    u_end: current ? null : (c.u_end ?? 0),
    d_end: current ? null : (c.d_end ?? 0),
    started_at: c.started_at,
    ends_at: c.ends_at,
    ended_at: c.ended_at,
    is_final: c.ends_at !== null && c.ends_at === user.expired_at,
    start_reason: c.start_reason,
    end_reason: c.end_reason,
    order_id: c.order_id,
    note: c.note,
    events: c.events,
  }
}

function resetMethod(plan: MockPlan | null) {
  return plan?.reset_traffic_method === 2 ? 'never' : 'monthly'
}

function advanceFor(user: MockUser, cur: MockCycle | null): Json {
  if (!cur) return { enabled: true, min_remaining_days: 30, eligible_if_exhausted: false, reason: 'no_cycle' }
  if (user.expired_at === null) return { enabled: true, min_remaining_days: 30, eligible_if_exhausted: false, reason: 'no_expiry' }
  if (cur.ends_at === null || cur.ends_at >= user.expired_at)
    return { enabled: true, min_remaining_days: 30, eligible_if_exhausted: false, reason: 'final_cycle' }
  const now = nowTs()
  if (user.expired_at - now < 30 * DAY)
    return { enabled: true, min_remaining_days: 30, eligible_if_exhausted: false, reason: 'remaining_too_short' }
  const shift = cur.ends_at - now
  return {
    enabled: true,
    min_remaining_days: 30,
    eligible_if_exhausted: true,
    reason: 'eligible',
    shift_seconds: shift,
    next_quota: cur.next_quota ?? cur.quota,
    expired_after: user.expired_at - shift,
  }
}

function timeline(user: MockUser, q: URLSearchParams): Json {
  const plan = planById(user.plan_id)
  const now = nowTs()
  const active = !!plan && (user.expired_at === null || user.expired_at > now)
  const cur = active ? (user.cycles.find((c) => c.ended_at === null) ?? null) : null
  const closed = user.cycles.filter((c) => c.ended_at !== null).sort((a, b) => b.seq - a.seq)
  const page = Math.max(1, Number(q.get('history_page') ?? 1))
  const size = Math.min(50, Math.max(1, Number(q.get('history_size') ?? 10)))
  const eventsSize = Math.min(50, Math.max(1, Number(q.get('events_size') ?? 20)))
  const logs = LOGS.filter((l) => l.user_id === user.id).sort((a, b) => b.at - a.at)
  return {
    now,
    user_id: user.id,
    plan: plan ? { id: plan.id, name: plan.name, quota: plan.transfer_enable * GB } : null,
    expired_at: user.expired_at,
    reset_method: resetMethod(plan),
    min_cycle_days: 15,
    current: cur ? cycleJson(user, cur, true) : null,
    upcoming:
      cur && cur.ends_at !== null && user.expired_at !== null && cur.ends_at < user.expired_at
        ? schedule(cur.ends_at, user.expired_at, cur.next_quota ?? cur.quota)
        : [],
    advance: user.id === 5120 ? { enabled: false, reason: 'disabled' } : advanceFor(user, cur),
    history: closed.slice((page - 1) * size, page * size).map((c) => cycleJson(user, c, false)),
    history_total: closed.length,
    events: logs.slice(0, eventsSize).map((l) => {
      const r = logRow(l, false)
      return {
        id: l.id,
        at: l.at,
        reason: r.reason,
        legacy: !metaReason(l),
        trigger_source: l.source,
        cleared: r.cleared,
        cleared_upload: l.meta?.cleared ? null : Math.round(l.up),
        cleared_download: l.meta?.cleared ? null : Math.round(l.down),
        quota_before: r.quota_before,
        quota_after: r.quota_after,
        expired_before: r.expired_before,
        expired_after: r.expired_after,
        shift_seconds: r.shift_seconds,
        cycle_id: r.cycle_id,
        order_id: r.order_id,
        note: r.note,
        is_noise: r.is_noise,
        admin_id: r.admin_id,
        metadata: l.meta,
      }
    }),
    events_total: logs.length,
    user: {
      id: user.id,
      email: user.email,
      transfer_enable: user.transfer_enable,
      u: user.u,
      d: user.d,
      expired_at: user.expired_at,
      next_reset_at: user.next_reset_at,
      last_reset_at: user.last_reset_at,
      reset_count: user.reset_count,
    },
  }
}

/**
 * DESIGN §3.6 in miniature, shaped like TrafficCycleService::previewAdminUpdate: effects / warnings are objects
 * with `type` plus details, and validation errors come back as `{type: 'invalid', message}` warnings.
 */
function preview(user: MockUser, q: URLSearchParams): Json {
  const now = nowTs()
  const has = (k: string) => q.has(k)
  const val = (k: string) => {
    const v = q.get(k)
    return v === null || v === '' ? null : Number(v)
  }
  const planId = has('plan_id') ? val('plan_id') : user.plan_id
  const plan = planById(planId)
  const expiry = has('expired_at') ? val('expired_at') : user.expired_at
  const quota = has('transfer_enable') ? (val('transfer_enable') ?? 0) : user.transfer_enable
  const u = has('u') ? (val('u') ?? 0) : user.u
  const d = has('d') ? (val('d') ?? 0) : user.d
  const mode = q.get('cycle_mode') === 'restart' ? 'restart' : 'keep'
  const scope = q.get('cycle_quota_scope') === 'cycle' ? 'cycle' : 'standing'
  const customEnds = val('cycle_ends_at')
  const active = !!plan && (expiry === null || expiry > now)
  const cur = user.cycles.find((c) => c.ended_at === null) ?? null
  const note = has('cycle_note') ? q.get('cycle_note') || null : (cur?.note ?? null)
  const effects: Json[] = []
  const warnings: Json[] = []
  const errors: string[] = []
  const quotaChanged = quota !== user.transfer_enable
  const planChanged = planId !== user.plan_id
  const usageEdited = u !== user.u || d !== user.d

  if (planChanged) effects.push({ type: 'plan_changed', from: user.plan_id, to: planId })
  if (expiry !== user.expired_at) effects.push({ type: 'expiry_changed', before: user.expired_at, after: expiry })
  if (!plan) warnings.push({ type: 'no_plan' })
  if (customEnds !== null && mode !== 'restart') errors.push('cycle_ends_at 只能在 cycle_mode=restart 时使用')

  const restart = active && (mode === 'restart' || !cur)
  let attrs: Json | null = null
  let kind = cur?.kind ?? 'standard'
  let next = cur?.next_quota ?? null
  if (restart) {
    effects.push({ type: 'cycle_restart' })
    kind = 'standard'
    next = quota
    if (quotaChanged && scope === 'cycle') {
      kind = 'special'
      next = plan ? plan.transfer_enable * GB : (cur?.next_quota ?? user.transfer_enable)
    } else if (!quotaChanged && cur?.kind === 'special') {
      kind = 'special'
      next = planChanged && plan ? plan.transfer_enable * GB : (cur.next_quota ?? cur.quota)
    }
    let ends = plan?.reset_traffic_method === 2 ? expiry : planEnd(now, expiry)
    if (customEnds !== null) {
      ends = customEnds
      if (customEnds <= now) {
        warnings.push({ type: 'ends_before_now', ends_at: customEnds })
        errors.push('cycle_ends_at 必须晚于当前时间')
      }
      if (expiry !== null && customEnds > expiry) {
        warnings.push({ type: 'ends_after_expiry', ends_at: customEnds, expired_at: expiry })
        errors.push('cycle_ends_at 不能晚于到期时间')
        ends = expiry
      }
    }
    if (cur && ends !== cur.ends_at) effects.push({ type: 'ends_changed', before: cur.ends_at, after: ends, why: 'restart' })
    attrs = { id: null, seq: cur ? cur.seq + 1 : null, started_at: now, ends_at: ends, start_reason: 'admin' }
  } else if (active && cur) {
    if (quotaChanged) {
      kind = scope === 'cycle' ? 'special' : 'standard'
      next = scope === 'cycle' ? (plan ? plan.transfer_enable * GB : (cur.next_quota ?? user.transfer_enable)) : quota
    } else if (planChanged && kind === 'special' && plan) {
      next = plan.transfer_enable * GB
    }
    let ends = cur.ends_at
    let why: string | null = null
    if (expiry !== user.expired_at) {
      if (expiry === null) ends = null
      else if (ends === null || expiry <= ends) [ends, why] = [expiry, 'expiry_shrunk']
      else if (expiry - ends < MIN_CYCLE) [ends, why] = [expiry, 'tail_merged']
    }
    if (ends !== cur.ends_at) effects.push({ type: 'ends_changed', before: cur.ends_at, after: ends, why })
    attrs = { id: cur.id, seq: cur.seq, started_at: cur.started_at, ends_at: ends, start_reason: cur.start_reason }
  }

  if (quotaChanged && attrs) {
    effects.push({
      type: kind === 'special' && scope === 'cycle' ? 'quota_cycle_only' : 'quota_standing',
      before: user.transfer_enable,
      after: quota,
      next_quota: next,
    })
  }
  // Usage after the save; like the backend (`$change['usage']`), `current` below reports it, so a restart shows 0.
  let upAfter = u
  let downAfter = d
  if (restart && mode === 'restart' && !usageEdited && user.u + user.d > 0) {
    effects.push({ type: 'usage_cleared', reason: 'admin_restart', cleared: user.u + user.d })
    upAfter = 0
    downAfter = 0
  } else if (usageEdited && u + d < user.u + user.d) {
    effects.push({ type: 'usage_cleared', reason: 'admin_usage_edit', cleared: user.u + user.d - u - d })
  }
  const used = upAfter + downAfter
  if (attrs) {
    if (quota < used) warnings.push({ type: 'quota_below_used', quota, used })
    const ends = attrs.ends_at as number | null
    const started = attrs.started_at as number
    if (ends !== null && ends !== expiry && ends - started < MIN_CYCLE)
      warnings.push({ type: 'short_cycle', seconds: ends - started, min_seconds: MIN_CYCLE })
  }

  const ends = (attrs?.ends_at ?? null) as number | null
  const current = attrs
    ? {
        ...attrs,
        kind,
        plan_id: planId,
        plan_name: plan?.name ?? null,
        quota,
        next_quota: next,
        u: upAfter,
        d: downAfter,
        used,
        remaining: Math.max(0, quota - used),
        u_end: null,
        d_end: null,
        ended_at: null,
        is_final: ends !== null && ends === expiry,
        end_reason: null,
        order_id: null,
        note,
        events: [],
      }
    : null
  return {
    current,
    upcoming: current && ends !== null && expiry !== null && ends < expiry ? schedule(ends, expiry, next ?? quota) : [],
    effects,
    warnings: [...warnings, ...errors.map((message) => ({ type: 'invalid', message }))],
  }
}

// ------------------------------------------------------------------ users / plans / orders

function userRow(u: MockUser): Json {
  const plan = planById(u.plan_id)
  return {
    id: u.id,
    email: u.email,
    invite_user_id: null,
    telegram_id: null,
    balance: 0,
    commission_balance: 0,
    commission_type: 0,
    commission_rate: null,
    discount: null,
    t: u.id === 3711 ? nowTs() - 30 : 0,
    u: Math.round(u.u),
    d: Math.round(u.d),
    total_used: Math.round(u.u + u.d),
    transfer_enable: Math.round(u.transfer_enable),
    banned: false,
    is_admin: !!u.is_admin,
    is_staff: false,
    last_login_at: null,
    last_login_ip: null,
    uuid: `00000000-0000-4000-8000-${String(u.id).padStart(12, '0')}`,
    token: `mocktoken${u.id}`,
    group_id: plan ? 1 : null,
    plan_id: u.plan_id,
    speed_limit: null,
    device_limit: plan ? 7 : null,
    online_count: u.id === 3711 ? 2 : 0,
    last_online_at: null,
    remind_expire: true,
    remind_traffic: true,
    expired_at: u.expired_at,
    next_reset_at: u.next_reset_at,
    last_reset_at: u.last_reset_at,
    reset_count: u.reset_count,
    remarks: null,
    created_at: u.created_at,
    updated_at: u.created_at,
    plan: plan ? { id: plan.id, name: plan.name } : null,
    group: plan ? { id: 1, name: '默认组' } : null,
    invite_user: null,
    subscribe_url: `https://sub.example.com/s/mocktoken${u.id}`,
  }
}

function planRow(p: MockPlan): Json {
  return {
    id: p.id,
    name: p.name,
    group_id: 1,
    group: { id: 1, name: '默认组' },
    transfer_enable: p.transfer_enable,
    speed_limit: null,
    device_limit: 7,
    capacity_limit: null,
    show: true,
    sell: true,
    renew: true,
    prices: p.prices,
    reset_traffic_method: p.reset_traffic_method,
    content: '',
    tags: [],
    sort: p.id,
    users_count: 0,
    active_users_count: 0,
    created_at: at(-400),
    updated_at: at(-10),
  }
}

interface MockOrder {
  id: number
  user_id: number
  plan_id: number
  type: number
  period: string
  trade_no: string
  total_amount: number
  status: number
  created_at: number
  paid_at: number | null
  expires_at: number | null
}

const ORDERS: MockOrder[] = [
  { id: 19120, user_id: 1255, plan_id: 19, type: 3, period: 'month_price', trade_no: 'a1f3c9d2e8b74c0f9e1d2c3b4a5f6e7d', total_amount: 8100, status: 0, created_at: at(0) - 1500, paid_at: null, expires_at: at(0) - 1500 + 72 * 3600 },
  { id: 19118, user_id: 6001, plan_id: 3, type: 2, period: 'month_price', trade_no: 'b2e4d6f8a0c24e6f8a0b2c4d6e8f0a1b', total_amount: 1800, status: 0, created_at: nowTs() - 1800, paid_at: null, expires_at: null },
  { id: 18860, user_id: 3711, plan_id: 19, type: 2, period: 'month_price', trade_no: 'c3d5e7f9b1d34f5a7b9c1d3e5f7a9b1c', total_amount: 9900, status: 3, created_at: S3711 + 400, paid_at: S3711 + 540, expires_at: null },
  { id: 18750, user_id: 2048, plan_id: 19, type: 3, period: 'quarter_price', trade_no: 'd4e6f8a0c2e44a6b8c0d2e4f6a8b0c2d', total_amount: 27900, status: 3, created_at: at(-9, 13, 0), paid_at: at(-9, 13, 2), expires_at: at(-9, 13, 0) + 48 * 3600 },
  { id: 18700, user_id: 7002, plan_id: 3, type: 1, period: 'month_price', trade_no: 'e5f7a9b1d3f54b7c9d1e3f5a7b9c1d3e', total_amount: 1800, status: 2, created_at: at(-12, 9, 0), paid_at: null, expires_at: null },
]

function orderRow(o: MockOrder): Json {
  const u = userById(o.user_id)
  const p = planById(o.plan_id)
  return {
    id: o.id,
    invite_user_id: null,
    user_id: o.user_id,
    plan_id: o.plan_id,
    coupon_id: null,
    payment_id: null,
    type: o.type,
    period: o.period,
    trade_no: o.trade_no,
    callback_no: o.paid_at ? 'manual_operation' : null,
    total_amount: o.total_amount,
    handling_amount: null,
    discount_amount: null,
    surplus_amount: null,
    surplus_credit: null,
    balance_amount: null,
    surplus_order_ids: null,
    status: o.status,
    commission_status: 0,
    commission_balance: 0,
    actual_commission_balance: null,
    paid_at: o.paid_at,
    expires_at: o.expires_at,
    created_at: o.created_at,
    updated_at: o.paid_at ?? o.created_at,
    plan: p ? { id: p.id, name: p.name } : null,
    user: u ? { id: u.id, email: u.email } : null,
    invite_user: null,
    payment: null,
  }
}

// ------------------------------------------------------------------ http plumbing

/** filter[0][id]=email&filter[0][value]=eq:x -> [{ id, value }] */
function bracketFilters(q: URLSearchParams): { id: string; value: string }[] {
  const out: Record<string, { id: string; value: string }> = {}
  for (const [k, v] of q) {
    const m = k.match(/^filter\[(\d+)\]\[(id|value)\]$/)
    if (!m) continue
    out[m[1]] ??= { id: '', value: '' }
    out[m[1]][m[2] as 'id' | 'value'] = v
  }
  return Object.values(out)
}

function readBody(req: IncomingMessage): Promise<Json> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c: Buffer) => (raw += c.toString('utf8')))
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Json) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}
const ok = (res: ServerResponse, data: unknown) => send(res, 200, { status: 'success', message: '操作成功', data, error: null })
const notFound = (res: ServerResponse) => send(res, 404, { message: 'mock: no handler' })

const lastWrites: Record<string, Json> = {}

function paginate<T>(rows: T[], page: number, size: number) {
  return { total: rows.length, current_page: page, per_page: size, last_page: Math.max(1, Math.ceil(rows.length / size)), data: rows.slice((page - 1) * size, page * size) }
}

function dateKey(ts: number) {
  const d = new Date(ts * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

async function handle(path: string, q: URLSearchParams, req: IncomingMessage, res: ServerResponse, legacy: boolean) {
  const body = req.method === 'POST' ? await readBody(req) : {}
  const history = path.match(/^\/traffic-reset\/user\/(\d+)\/history$/)
  if (history) {
    const user = userById(Number(history[1]))
    if (!user) return send(res, 404, { message: 'No query results for model [App\\Models\\User]' })
    const limit = Math.min(50, Number(q.get('limit') ?? 10))
    const rows = LOGS.filter((l) => l.user_id === user.id)
      .sort((a, b) => b.at - a.at)
      .slice(0, limit)
      .map((l) => {
        const { id, reset_type, reset_type_name, reset_time, old_traffic, trigger_source, trigger_source_name, metadata } = logRow(l, true)
        return { id, reset_type, reset_type_name, reset_time, old_traffic, trigger_source, trigger_source_name, metadata }
      })
    const { id, email, reset_count, last_reset_at, next_reset_at } = user
    return send(res, 200, { data: { user: { id, email, reset_count, last_reset_at, next_reset_at }, history: rows } })
  }
  switch (path) {
    case '/plugin/getPlugins':
      return ok(res, [])
    case '/plan/fetch':
      return ok(res, PLANS.map(planRow))
    case '/user/fetch': {
      let rows = USERS
      for (const f of bracketFilters(q)) {
        const v = f.value.replace(/^(eq|like):/, '')
        if (f.id === 'id') rows = rows.filter((u) => u.id === Number(v))
        if (f.id === 'email') rows = rows.filter((u) => (f.value.startsWith('eq:') ? u.email === v : u.email.includes(v)))
      }
      return send(res, 200, paginate(rows.map(userRow), Number(q.get('current') ?? 1), Number(q.get('pageSize') ?? 20)))
    }
    case '/user/update':
      lastWrites.update = body
      console.log('[dev-mock] user/update', JSON.stringify(body))
      return ok(res, true)
    case '/user/loginLog/fetch':
      return send(res, 200, paginate([], 1, 20))
    case '/user/trafficCycle/fetch':
    case '/user/trafficCycle/preview': {
      if (legacy) return notFound(res)
      const user = userById(Number(q.get('user_id') ?? q.get('id')))
      if (!user) return send(res, 400, { status: 'fail', message: '用户不存在', data: null, error: null })
      return ok(res, path.endsWith('fetch') ? timeline(user, q) : preview(user, q))
    }
    case '/traffic-reset/logs': {
      let rows = [...LOGS].sort((a, b) => b.at - a.at)
      const uid = q.get('user_id')
      const email = q.get('user_email')
      const reason = q.get('reason')
      const source = q.get('trigger_source')
      const start = q.get('start_date')
      const end = q.get('end_date')
      if (uid) rows = rows.filter((l) => l.user_id === Number(uid))
      if (email) rows = rows.filter((l) => userById(l.user_id)?.email.includes(email))
      if (source) rows = rows.filter((l) => l.source === source)
      if (start) rows = rows.filter((l) => dateKey(l.at) >= start)
      if (end) rows = rows.filter((l) => dateKey(l.at) <= end)
      if (!legacy && reason) rows = rows.filter((l) => logReason(l) === reason)
      if (!legacy && q.get('hide_noise') === '1') rows = rows.filter((l) => !logNoise(l))
      const page = Number(q.get('page') ?? 1)
      const size = Number(q.get('per_page') ?? 20)
      const p = paginate(rows.map((l) => logRow(l, legacy)), page, size)
      return send(res, 200, { data: p.data, pagination: { current_page: page, last_page: p.last_page, per_page: size, total: p.total } })
    }
    case '/order/fetch': {
      const page = Number(body.current ?? q.get('current') ?? 1)
      const size = Number(body.pageSize ?? q.get('pageSize') ?? 20)
      const rows = [...ORDERS].sort((a, b) => b.created_at - a.created_at).map((o) => {
        const r = orderRow(o)
        if (legacy) delete r.expires_at
        return r
      })
      return send(res, 200, paginate(rows, page, size))
    }
    case '/order/detail': {
      const o = ORDERS.find((x) => x.id === Number(body.id))
      if (!o) return send(res, 400, { status: 'fail', message: '订单不存在', data: null, error: null })
      return ok(res, { ...orderRow(o), commission_log: [] })
    }
    case '/order/assign': {
      lastWrites.assign = body
      console.log('[dev-mock] order/assign', JSON.stringify(body))
      const user = USERS.find((u) => u.email === String(body.email ?? '').trim().toLowerCase())
      if (!user) return send(res, 400, { status: 'fail', message: '该用户不存在', data: null, error: null })
      const tradeNo = `mock${Date.now().toString(16)}`
      const hours = Number(body.expire_hours ?? 72)
      ORDERS.unshift({
        id: ORDERS[0].id + 1,
        user_id: user.id,
        plan_id: Number(body.plan_id),
        type: 3,
        period: String(body.period),
        trade_no: tradeNo,
        total_amount: Number(body.total_amount ?? 0),
        status: 0,
        created_at: nowTs(),
        paid_at: null,
        expires_at: nowTs() + hours * 3600,
      })
      return ok(res, tradeNo)
    }
    default:
      return notFound(res)
  }
}

export function devMockApi(mode: string): Plugin {
  const legacy = mode === 'legacy'
  return {
    name: 'xboard-dev-mock',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://mock.local')
        const path = url.pathname
        if (path === '/__mock/last-writes') return send(res, 200, lastWrites)
        if (path === '/api/v2/passport/auth/login') return ok(res, { auth_data: 'Bearer dev-mock-token', is_admin: true })
        if (path === '/api/v2/user/info') return ok(res, { email: 'admin@example.com', avatar_url: '' })
        const m = path.match(/^\/api\/v2\/[^/]+(\/.*)$/)
        if (!m) return next()
        handle(m[1], url.searchParams, req, res, legacy).catch((e: unknown) => send(res, 500, { message: String(e) }))
      })
      server.config.logger.info(`  [dev-mock] panel API mocked (${legacy ? 'legacy panel' : 'traffic cycle backend'})`)
    },
  }
}
