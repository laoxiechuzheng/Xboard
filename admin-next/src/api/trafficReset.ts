// Traffic reset APIs (spec users.md §11–§12). All responses are raw JSON without a status envelope.
import { http, type Query } from '@/api/http'

export interface TrafficAmount {
  upload: number
  download: number
  total: number
  /** Backend formatted string, e.g. "56 GB" */
  formatted: string
}

export interface TrafficResetLog {
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
}

export interface TrafficResetLogResponse {
  data: TrafficResetLog[]
  pagination: { current_page: number; last_page: number; per_page: number; total: number }
}

/** GET /traffic-reset/logs. Empty filters are dropped (backend validates `in:` lists). */
export function fetchTrafficResetLogs(q: TrafficResetLogQuery) {
  const params: Query = {}
  for (const [k, v] of Object.entries(q)) {
    if (v !== null && v !== undefined && v !== '') params[k] = v
  }
  return http.get<TrafficResetLogResponse>('/traffic-reset/logs', params)
}

export interface TrafficResetStats {
  total_resets: number
  auto_resets: number
  manual_resets: number
  cron_resets: number
}

/** GET /traffic-reset/stats?days= (not used by the official admin). */
export async function fetchTrafficResetStats(days: number) {
  const res = await http.get<{ data: TrafficResetStats }>('/traffic-reset/stats', { days })
  return res.data
}

export interface UserResetHistoryItem {
  id: number
  reset_type: string
  reset_type_name: string
  reset_time: string
  old_traffic: TrafficAmount
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
 * Note: the backend currently drops `reason` (spec R-8), it is not stored in the log.
 */
export function resetUserTraffic(userId: number, reason?: string) {
  const body: { user_id: number; reason?: string } = { user_id: userId }
  if (reason && reason.trim()) body.reason = reason.trim()
  return http.post<ResetUserResult>('/traffic-reset/reset-user', body)
}

/** reset_type values accepted by the logs filter. */
export const RESET_TYPE_OPTIONS = [
  { label: '按月重置', value: 'monthly' },
  { label: '每月1号重置', value: 'first_day_month' },
  { label: '按年重置', value: 'yearly' },
  { label: '每年1月1日重置', value: 'first_day_year' },
  { label: '手动重置', value: 'manual' },
  { label: '购买重置包', value: 'purchase' },
]

/** trigger_source values accepted by the logs filter (order / gift_card exist in data but fail validation). */
export const TRIGGER_SOURCE_OPTIONS = [
  { label: '自动触发', value: 'auto' },
  { label: '手动触发', value: 'manual' },
  { label: 'API调用', value: 'api' },
  { label: '定时任务', value: 'cron' },
  { label: '用户访问', value: 'user_access' },
]

/** Names for sources the backend leaves untranslated. */
const EXTRA_SOURCE_NAMES: Record<string, string> = { order: '订单开通', gift_card: '礼品卡兑换' }

export function triggerSourceLabel(source: string, name?: string | null): string {
  if (name && name !== source) return name
  return EXTRA_SOURCE_NAMES[source] ?? TRIGGER_SOURCE_OPTIONS.find((o) => o.value === source)?.label ?? (name || source)
}

export function resetTypeLabel(type: string, name?: string | null): string {
  if (name && name !== type) return name
  return RESET_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? (name || type)
}
