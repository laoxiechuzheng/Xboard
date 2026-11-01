// Traffic cycle ledger (docs/traffic-cycle/DESIGN.md §7). Panels without the ledger backend answer 404.
import { ApiError, http, type Query } from '@/api/http'

export type CycleKind = 'standard' | 'special'
export type CycleMode = 'keep' | 'restart'
export type CycleQuotaScope = 'cycle' | 'standing'

/** Lifecycle event kept on a cycle (DESIGN §4.3); which fields exist depends on `type`. */
export interface CycleEvent {
  at: number
  type: string
  /** order / admin / gift_card / plugin / system */
  by?: string | null
  admin_id?: number | null
  order_id?: number | null
  expired_before?: number | null
  expired_after?: number | null
  before?: number | null
  after?: number | null
  scope?: string | null
  ends_before?: number | null
  ends_after?: number | null
  /** expiry_shrunk / tail_merged / method_changed / short_fix */
  why?: string | null
  log_id?: number | null
  cleared?: number | null
  reason?: string | null
  from?: number | string | null
  to?: number | string | null
  [key: string]: unknown
}

/** Traffic in bytes, times in unix seconds. */
export interface TrafficCycle {
  /** null for a cycle that only exists in a preview. */
  id: number | null
  seq: number | null
  kind: CycleKind | string
  plan_id: number | null
  plan_name: string | null
  quota: number
  /** Quota of the next cycle; null = same as `quota`. */
  next_quota: number | null
  u?: number | null
  d?: number | null
  used?: number | null
  remaining?: number | null
  /** Usage when a closed cycle ended. */
  u_end?: number | null
  d_end?: number | null
  started_at: number
  /** Planned end; null = not scheduled (long-term / never resets). */
  ends_at: number | null
  /** Actual end; null for the current cycle. */
  ended_at: number | null
  /** ends_at == expired_at: the subscription ends with this cycle, no further reset. */
  is_final: boolean
  start_reason: string
  end_reason: string | null
  order_id: number | null
  /** Admin note, visible to the user and the AI assistant. */
  note: string | null
  events?: CycleEvent[] | null
}

export interface UpcomingCycle {
  index: number
  starts_at: number
  ends_at: number | null
  quota: number
  is_final: boolean
}

/** Early rollover ("换时") rule for this user; `{ enabled: false, reason: 'disabled' }` without the plugin. */
export interface CycleAdvance {
  enabled: boolean
  /** eligible / no_cycle / no_expiry / final_cycle / remaining_too_short / disabled */
  reason: string
  min_remaining_days?: number | null
  eligible_if_exhausted?: boolean
  shift_seconds?: number | null
  next_quota?: number | null
  expired_after?: number | null
}

/** One reset log row as seen by the timeline. Admin timelines also carry noise rows, metadata and admin_id. */
export interface CycleResetEvent {
  id: number
  at: number
  reason: string
  /** Old row without metadata: the reason was inferred from trigger_source. */
  legacy?: boolean
  trigger_source: string
  cleared: number
  cleared_upload?: number | null
  cleared_download?: number | null
  /** 换时: usage over the quota carried into the new cycle; 0 / absent for every other row. */
  carried?: number | null
  quota_before?: number | null
  quota_after?: number | null
  expired_before?: number | null
  expired_after?: number | null
  shift_seconds?: number | null
  cycle_id?: number | null
  order_id?: number | null
  note?: string | null
  is_noise?: boolean
  admin_id?: number | null
  metadata?: Record<string, unknown> | null
}

export interface CycleTimeline {
  now: number
  user_id: number
  plan: { id: number; name: string; quota: number } | null
  /** null = 长期有效 */
  expired_at: number | null
  /** monthly / first_day_month / yearly / first_day_year / never */
  reset_method: string
  min_cycle_days: number
  /** null without a plan or after expiry. */
  current: TrafficCycle | null
  upcoming: UpcomingCycle[]
  advance: CycleAdvance
  /** Closed cycles, newest first. */
  history: TrafficCycle[]
  history_total: number
  /** Reset log rows, newest first. */
  events: CycleResetEvent[]
  events_total: number
  /** Admin only. */
  user?: {
    id: number
    email: string
    transfer_enable: number
    u: number
    d: number
    expired_at: number | null
    next_reset_at: number | null
    last_reset_at: number | null
    reset_count: number | null
  }
}

export interface CycleTimelineQuery {
  history_page?: number
  /** ≤ 50 */
  history_size?: number
  /** ≤ 50 */
  events_size?: number
}

/** GET /user/trafficCycle/fetch?user_id= (read-only, so GET keeps it out of the audit log). */
export function fetchUserTrafficCycle(userId: number, q: CycleTimelineQuery = {}, opts: { silent?: boolean } = {}) {
  return http.get<CycleTimeline>('/user/trafficCycle/fetch', { user_id: userId, ...q }, opts)
}

/** Optional user/update params (DESIGN §3.6). Leaving them all out keeps the old behaviour. */
export interface CycleUpdateParams {
  cycle_mode?: CycleMode
  /** Only meaningful when transfer_enable changes. */
  cycle_quota_scope?: CycleQuotaScope
  /** restart only; unix seconds, S < value ≤ expired_at. Omitted = planEnd(now, expired_at). */
  cycle_ends_at?: number
  /** ≤ 120 chars, shown to the user and the AI assistant. */
  cycle_note?: string
}

/** Pending user/update values (bytes / unix seconds); only changed fields are sent. */
export interface CyclePreviewQuery extends CycleUpdateParams {
  id: number
  plan_id?: number | null
  transfer_enable?: number
  /** null = 长期有效 */
  expired_at?: number | null
  u?: number
  d?: number
}

/** The user/update fields that affect the cycle; only changed keys are present. */
export type CycleUserChanges = Pick<CyclePreviewQuery, 'plan_id' | 'transfer_enable' | 'expired_at' | 'u' | 'd'>

/** Effect / warning code; tolerated as a bare string or an object carrying `type` / `code`. */
export type CycleNotice = string | { type?: string; code?: string; [key: string]: unknown }

export interface CyclePreview {
  current: TrafficCycle | null
  upcoming: UpcomingCycle[]
  effects: CycleNotice[]
  warnings: CycleNotice[]
}

export function noticeCode(n: CycleNotice): string {
  if (typeof n === 'string') return n
  return String(n?.type ?? n?.code ?? '')
}

/**
 * GET /user/trafficCycle/preview: computes the user/update result without saving (GET: no audit row).
 * null is sent as an empty string (`expired_at=` means 长期有效, `plan_id=` removes the plan).
 */
export function previewTrafficCycle(q: CyclePreviewQuery, opts: { signal?: AbortSignal } = {}) {
  const params: Query = {}
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue
    params[k] = v === null ? '' : (v as Query[string])
  }
  return http.get<CyclePreview>('/user/trafficCycle/preview', params, { silent: true, ...opts })
}

/** A 404 from the ledger endpoints means the panel backend predates the traffic cycle feature. */
export function isLedgerMissing(e: unknown): boolean {
  if (!(e instanceof ApiError) || e.status !== 404) return false
  const msg = (e.body as { message?: unknown } | null)?.message
  // A missing user (findOrFail) is a real 404 from an upgraded backend.
  return !(typeof msg === 'string' && msg.includes('No query results'))
}
