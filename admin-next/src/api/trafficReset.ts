// Traffic reset APIs (spec users.md §11–§12, traffic cycle fields: docs/traffic-cycle/DESIGN.md §7.2).
// All responses are raw JSON without a status envelope.
import { http, type Query } from '@/api/http'

export interface TrafficAmount {
  upload: number
  download: number
  total: number
  /** Backend formatted string, e.g. "56 GB" */
  formatted: string
}

/**
 * Fields added by the traffic cycle backend (TrafficResetLog::cycleFields(), DESIGN §7.2); absent on older panels
 * and on older rows of some endpoints, so every one is optional (see traffic-reset/normalize.ts).
 */
export interface ResetLogCycleFields {
  /** Reason code (DESIGN §5); inferred from trigger_source for old rows. */
  reason?: string | null
  /** Old row without metadata: the reason was inferred from trigger_source. */
  legacy?: boolean
  /** Old row that cleared 0 B: no information, hidden by default. */
  is_noise?: boolean
  cycle_id?: number | null
  order_id?: number | null
  admin_id?: number | null
  note?: string | null
  /** Bytes really cleared: metadata.cleared first (imported 换时 rows whose old_total is 0), else old − new. */
  cleared?: number | null
  cleared_upload?: number | null
  cleared_download?: number | null
  /** 换时: usage over the quota carried into the new cycle (= new_total of that row); 0 for every other row. */
  carried?: number | null
  quota_before?: number | null
  quota_after?: number | null
  expired_before?: number | null
  expired_after?: number | null
  /** 换时: how much earlier the subscription now expires. */
  shift_seconds?: number | null
}

export interface TrafficResetLog extends ResetLogCycleFields {
  id: number
  user_id: number
  /** 'N/A' when the user no longer exists */
  user_email: string
  reset_type: string
  reset_type_name: string
  /** ISO8601 UTC */
  reset_time: string
  old_traffic: TrafficAmount
  new_traffic: TrafficAmount
  trigger_source: string
  trigger_source_name: string
  metadata: Record<string, unknown> | null
  /** ISO8601 UTC */
  created_at: string
}

export interface TrafficResetLogQuery {
  page: number
  per_page: number
  user_id?: number | null
  user_email?: string | null
  reset_type?: string | null
  trigger_source?: string | null
  /** yyyy-MM-dd */
  start_date?: string | null
  /** yyyy-MM-dd (inclusive, backend appends 23:59:59) */
  end_date?: string | null
  /** 1 = drop noise rows (traffic cycle backend; older panels ignore it). */
  hide_noise?: 0 | 1 | null
  /** Reason code (DESIGN §5). */
  reason?: string | null
}

export interface TrafficResetLogResponse {
  data: TrafficResetLog[]
  pagination: { current_page: number; last_page: number; per_page: number; total: number }
}

/** GET /traffic-reset/logs. Empty filters are dropped (backend validates `in:` lists). */
export function fetchTrafficResetLogs(q: TrafficResetLogQuery, opts: { silent?: boolean } = {}) {
  const params: Query = {}
  for (const [k, v] of Object.entries(q)) {
    if (v !== null && v !== undefined && v !== '') params[k] = v
  }
  return http.get<TrafficResetLogResponse>('/traffic-reset/logs', params, opts)
}

/** Older backends send only the legacy columns (no new_traffic); the traffic cycle backend adds the cycle fields. */
export interface UserResetHistoryItem extends ResetLogCycleFields {
  id: number
  reset_type: string
  reset_type_name: string
  reset_time: string
  old_traffic: TrafficAmount
  new_traffic?: TrafficAmount
  trigger_source: string
  trigger_source_name: string
  metadata: Record<string, unknown> | null
}

export interface UserResetHistory {
  user: {
    id: number
    email: string
    reset_count: number | null
    last_reset_at: number | null
    next_reset_at: number | null
  }
  history: UserResetHistoryItem[]
}

/** GET /traffic-reset/user/{id}/history?limit= (1–50, default 10). */
export async function fetchUserResetHistory(userId: number, limit = 10) {
  const res = await http.get<{ data: UserResetHistory }>(`/traffic-reset/user/${userId}/history`, { limit })
  return res.data
}

export interface ResetUserResult {
  message: string
  data: { user_id: number; email: string; reset_time: string; next_reset_at: number | null }
}

/**
 * POST /traffic-reset/reset-user. 400 when the user is banned/expired/has no plan.
 * The traffic cycle backend stores `reason` as the log's note (reason code admin_reset); older backends drop it
 * (spec R-8).
 */
export function resetUserTraffic(userId: number, reason?: string) {
  const body: { user_id: number; reason?: string } = { user_id: userId }
  if (reason && reason.trim()) body.reason = reason.trim()
  return http.post<ResetUserResult>('/traffic-reset/reset-user', body)
}
