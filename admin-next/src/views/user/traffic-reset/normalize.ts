// One view model for reset log rows from traffic-reset/logs and from the cycle timeline. Works with the traffic
// cycle backend (reason / is_noise / cleared …) and with older panels, where the reason is inferred from
// trigger_source and a 0 B row without a reason is noise, exactly like the backend does (DESIGN §4.2).
import type { TrafficResetLog } from '@/api/trafficReset'
import type { CycleResetEvent } from '@/api/trafficCycle'
import { inferLegacyReason, isReasonCode } from '../traffic-cycle/meta'

export interface ResetLogView {
  id: number
  userId: number
  /** null when the user no longer exists. */
  email: string | null
  /** unix seconds */
  at: number
  reason: string
  /** Old row without metadata: the reason was inferred from the trigger source. */
  inferred: boolean
  noise: boolean
  cleared: number
  /** 换时: usage over the quota that was carried into the new cycle (bytes); 0 for every other row. */
  carried: number
  /** Only known when the upload / download parts add up to the cleared amount. */
  clearedUpload: number | null
  clearedDownload: number | null
  quotaBefore: number | null
  quotaAfter: number | null
  expiredBefore: number | null
  expiredAfter: number | null
  shift: number | null
  cycleId: number | null
  orderId: number | null
  adminId: number | null
  note: string | null
  source: string
  sourceName: string | null
  /** Legacy reset_type name (按月重置 …); kept for the details only. */
  typeName: string | null
  createdAt: number | null
  metadata: Record<string, unknown> | null
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toSeconds(v: unknown): number {
  if (typeof v === 'number') return v > 1e12 ? Math.floor(v / 1000) : v
  const t = Date.parse(String(v ?? ''))
  return Number.isNaN(t) ? 0 : Math.floor(t / 1000)
}

const metaOf = (m: unknown) => (m && typeof m === 'object' && !Array.isArray(m) ? (m as Record<string, unknown>) : null)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Rows from a backend that knows reasons carry `is_noise`; older panels only send the legacy columns. */
export function hasCycleFields(r: TrafficResetLog): boolean {
  return 'is_noise' in r || 'reason' in r
}

/** traffic-reset/logs rows, or traffic-reset/user/{id}/history items with the user id added. */
export type ResetLogInput = Omit<TrafficResetLog, 'user_email' | 'new_traffic' | 'created_at'> &
  Partial<Pick<TrafficResetLog, 'user_email' | 'new_traffic' | 'created_at'>>

/** Both parts known and adding up to the cleared amount, else null / null. */
function split(up: number | null, down: number | null, cleared: number): [number | null, number | null] {
  return up !== null && down !== null && up >= 0 && down >= 0 && up + down === cleared ? [up, down] : [null, null]
}

export function normalizeResetLog(r: ResetLogInput): ResetLogView {
  const m = metaOf(r.metadata)
  const metaReason = isReasonCode(m?.reason) ? (m!.reason as string) : null
  const reason = (isReasonCode(r.reason) ? r.reason : null) ?? metaReason ?? inferLegacyReason(r.trigger_source)
  const oldTotal = num(r.old_traffic?.total) ?? 0
  const newTotal = num(r.new_traffic?.total)
  // Same order as TrafficResetLog::cycleFields(): the backend's value, metadata.cleared (imported 换时 rows whose
  // old_total is 0), then old − new (修改已用 40 GB → 10 GB cleared 30 GB, 换时 keeps the carried part). Only a
  // response without new_traffic (older history endpoint) falls back to the whole old total.
  const cleared =
    num(r.cleared) ?? num(m?.cleared) ?? (newTotal !== null ? Math.max(0, oldTotal - newTotal) : oldTotal)
  const diff = (k: 'upload' | 'download') => {
    const o = num(r.old_traffic?.[k])
    if (o === null) return null
    if (!r.new_traffic) return cleared === oldTotal ? o : null
    const n = num(r.new_traffic[k])
    return n === null ? null : o - n
  }
  const own = split(num(r.cleared_upload), num(r.cleared_download), cleared)
  const [up, down] = own[0] !== null ? own : split(diff('upload'), diff('download'), cleared)
  // carried = new_total of a 换时 row (DESIGN contract); rows from a backend without the field derive it the same way.
  const carried =
    num(r.carried) ?? num(m?.carried) ?? (reason === 'auto_advance' && newTotal !== null ? Math.max(0, newTotal) : 0)
  return {
    id: r.id,
    userId: r.user_id,
    email: r.user_email && r.user_email !== 'N/A' ? r.user_email : null,
    at: toSeconds(r.reset_time),
    // Anything that is not a DESIGN §5 code (e.g. an admin's free text) falls back to the trigger source.
    reason,
    inferred: !metaReason,
    noise: typeof r.is_noise === 'boolean' ? r.is_noise : oldTotal === 0 && !metaReason,
    cleared,
    carried,
    clearedUpload: up,
    clearedDownload: down,
    quotaBefore: num(r.quota_before ?? m?.quota_before),
    quotaAfter: num(r.quota_after ?? m?.quota_after),
    expiredBefore: num(r.expired_before ?? m?.expired_before),
    expiredAfter: num(r.expired_after ?? m?.expired_after),
    shift: num(r.shift_seconds ?? m?.shift_seconds),
    cycleId: num(r.cycle_id ?? m?.cycle_id),
    orderId: num(r.order_id ?? m?.order_id),
    adminId: num(r.admin_id ?? m?.admin_id),
    // Old manual resets may carry the admin's free text in metadata.reason.
    note: str(r.note) ?? str(m?.note) ?? (metaReason ? null : str(m?.reason)),
    source: r.trigger_source,
    sourceName: r.trigger_source_name ?? null,
    typeName: r.reset_type_name || r.reset_type || null,
    createdAt: r.created_at ? toSeconds(r.created_at) : null,
    metadata: m,
  }
}

/** Timeline events (user/trafficCycle/fetch) already carry the resolved fields. */
export function normalizeCycleEvent(e: CycleResetEvent, userId: number): ResetLogView {
  const m = metaOf(e.metadata)
  const known = isReasonCode(e.reason)
  const cleared = num(e.cleared) ?? 0
  // Imported 换时 rows report metadata.cleared but a 0 / 0 split; only show a split that adds up.
  const [up, down] = split(num(e.cleared_upload), num(e.cleared_download), cleared)
  return {
    id: e.id,
    userId,
    email: null,
    at: toSeconds(e.at),
    reason: known ? e.reason : inferLegacyReason(e.trigger_source),
    inferred: !known || (e.legacy ?? !isReasonCode(m?.reason)),
    noise: !!e.is_noise,
    cleared,
    carried: Math.max(0, num(e.carried) ?? 0),
    clearedUpload: up,
    clearedDownload: down,
    quotaBefore: num(e.quota_before),
    quotaAfter: num(e.quota_after),
    expiredBefore: num(e.expired_before),
    expiredAfter: num(e.expired_after),
    shift: num(e.shift_seconds),
    cycleId: num(e.cycle_id),
    orderId: num(e.order_id),
    adminId: num(e.admin_id),
    note: str(e.note) ?? (known ? null : str(e.reason)) ?? (isReasonCode(m?.reason) ? null : str(m?.reason)),
    source: e.trigger_source,
    sourceName: null,
    typeName: null,
    createdAt: null,
    metadata: m,
  }
}
