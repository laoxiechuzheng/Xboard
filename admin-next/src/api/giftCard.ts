// Gift card (礼品卡) admin API. Spec: docs/admin-next/spec/commerce.md §6.
// Units: rewards.balance in cents, rewards.transfer_enable in bytes, timestamps in unix seconds.
import { adminUrl, http, request, type Query } from '@/api/http'

export type GiftCardType = 1 | 2 | 3
/** 0 未使用 1 已使用 2 已过期 3 已禁用 (GiftCardCode::STATUS_*; the official locale has 2/3 swapped). */
export type GiftCodeStatus = 0 | 1 | 2 | 3

export const GIFT_CARD_TYPES: { value: GiftCardType; label: string; desc: string }[] = [
  { value: 1, label: '通用礼品卡', desc: '发放余额、流量、有效期、设备数等通用奖励' },
  { value: 2, label: '套餐礼品卡', desc: '为没有有效订阅的用户开通指定套餐' },
  { value: 3, label: '盲盒礼品卡', desc: '按权重从奖励池中随机抽取一项奖励' },
]

export function giftCardTypeLabel(type: number | null | undefined): string {
  return GIFT_CARD_TYPES.find((t) => t.value === Number(type))?.label ?? `未知类型 (${type ?? '-'})`
}

export const GIFT_CODE_STATUS: { value: GiftCodeStatus; label: string; tag: 'default' | 'success' | 'warning' | 'error' | 'info' }[] = [
  { value: 0, label: '未使用', tag: 'success' },
  { value: 1, label: '已使用', tag: 'info' },
  { value: 2, label: '已过期', tag: 'warning' },
  { value: 3, label: '已禁用', tag: 'error' },
]

export function giftCodeStatusMeta(status: number | null | undefined) {
  return GIFT_CODE_STATUS.find((s) => s.value === Number(status)) ?? { value: status as GiftCodeStatus, label: '未知状态', tag: 'default' as const }
}

export interface GiftRandomReward {
  weight: number
  /** cents */
  balance?: number
  /** bytes */
  transfer_enable?: number
  expire_days?: number
  device_limit?: number
}

export interface GiftCardRewards {
  /** cents */
  balance?: number
  /** bytes */
  transfer_enable?: number
  expire_days?: number
  device_limit?: number
  reset_package?: boolean
  plan_id?: number
  plan_validity_days?: number
  random_rewards?: GiftRandomReward[]
  /** Decimal ratio (0.2 = 20%). The backend reads it from `rewards`, not `limits`. */
  invite_reward_rate?: number
  [key: string]: unknown
}

export interface GiftCardConditions {
  new_user_only?: boolean
  new_user_max_days?: number
  paid_user_only?: boolean
  require_invite?: boolean
  allowed_plans?: number[]
  /** Stored but not enforced by the backend. */
  disallowed_plans?: number[]
  [key: string]: unknown
}

export interface GiftCardLimits {
  max_use_per_user?: number
  cooldown_hours?: number
  /** Legacy location written by the official UI; ignored by the backend. */
  invite_reward_rate?: number
  [key: string]: unknown
}

export interface GiftCardSpecialConfig {
  /** unix seconds */
  start_time?: number
  /** unix seconds */
  end_time?: number
  festival_bonus?: number
  [key: string]: unknown
}

/** JSON columns come back as `[]` when stored empty. */
type JsonObject<T> = T | unknown[] | null

export interface GiftCardTemplate {
  id: number
  name: string
  description: string | null
  type: number
  status: boolean
  conditions: JsonObject<GiftCardConditions>
  rewards: JsonObject<GiftCardRewards>
  limits: JsonObject<GiftCardLimits>
  special_config: JsonObject<GiftCardSpecialConfig>
  icon: string | null
  background_image: string | null
  theme_color: string | null
  sort: number
  admin_id: number
  created_at: number
  updated_at: number
}

/** Normalize a JSON column (`[]`/null → `{}`). */
export function asObject<T extends object>(v: JsonObject<T> | undefined): T {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : ({} as T)
}

export interface GiftCardCode {
  id: number
  template_id: number
  code: string
  batch_id: string | null
  status: number
  user_id: number | null
  used_at: number | null
  expires_at: number | null
  actual_rewards: JsonObject<GiftCardRewards>
  usage_count: number
  max_usage: number
  metadata: unknown
  created_at: number
  updated_at: number
  template: GiftCardTemplate | null
  /** Full user row (only password hidden): never render anything but id/email. */
  user: { id: number; email: string; [key: string]: unknown } | null
}

export interface GiftCardUsage {
  id: number
  code: string
  template_name: string
  user_email: string
  /** Masked "abc***@***" or null. */
  invite_user_email: string | null
  rewards_given: JsonObject<GiftCardRewards>
  invite_rewards: JsonObject<{ balance?: number; transfer_enable?: number }>
  multiplier_applied: number
  created_at: number
}

export interface GiftCardStatistics {
  total_stats: {
    templates_count: number
    active_templates_count: number
    codes_count: number
    used_codes_count: number
    usages_count: number
  }
  daily_usages: { date: string; count: number }[]
  type_stats: { template_name: string; type_name: string; count: number }[]
}

export interface Paginated<T> {
  total: number
  current_page: number
  per_page: number
  last_page: number
  data: T[]
}

/** Drop undefined / null / '' so the backend `has()` checks only see real filters. */
function compact(obj: Record<string, unknown>): Query {
  const out: Query = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v as Query[string]
  }
  return out
}

// ---------- templates ----------

export interface TemplateQuery {
  page: number
  per_page: number
  type?: number | null
  /** 1 enabled / 0 disabled */
  status?: 0 | 1 | null
}

/** POST /gift-card/templates → paginate (raw models, ordered by sort asc, created_at desc). */
export function fetchTemplates(q: TemplateQuery) {
  return http.post<Paginated<GiftCardTemplate>>('/gift-card/templates', compact({ ...q }))
}

export interface TemplatePayload {
  name: string
  description: string | null
  type: GiftCardType
  status: boolean
  sort: number
  conditions: GiftCardConditions
  rewards: GiftCardRewards
  limits: GiftCardLimits
  special_config: GiftCardSpecialConfig
  icon: string | null
  background_image: string | null
  theme_color: string | null
}

/** POST /gift-card/create-template → created template. */
export function createTemplate(payload: TemplatePayload) {
  return http.post<GiftCardTemplate>('/gift-card/create-template', payload)
}

/** POST /gift-card/update-template → updated template. Every field except id is optional. */
export function updateTemplate(payload: Partial<TemplatePayload> & { id: number }) {
  return http.post<GiftCardTemplate>('/gift-card/update-template', payload)
}

/** POST /gift-card/delete-template → true. Rejected (400) while the template still has codes. */
export function deleteTemplate(id: number) {
  return http.post<boolean>('/gift-card/delete-template', { id })
}

// ---------- codes ----------

export interface GeneratePayload {
  template_id: number
  count: number
  /** Uppercase letters / digits, ≤10; omitted → backend default "GC". */
  prefix?: string
  /** Omit for codes that never expire (sending null would expire them immediately). */
  expires_hours?: number
  max_usage: number
}

export interface GenerateResult {
  batch_id: string
  count: number
  message: string
}

/** POST /gift-card/generate-codes → { batch_id, count, message }. */
export function generateCodes(payload: GeneratePayload) {
  return http.post<GenerateResult>('/gift-card/generate-codes', payload)
}

/** POST /gift-card/generate-codes with download_csv → CSV stream (Blob). */
export function generateCodesCsv(payload: GeneratePayload) {
  return http.download('POST', '/gift-card/generate-codes', { ...payload, download_csv: true })
}

export interface CodeQuery {
  page: number
  per_page: number
  template_id?: number | null
  batch_id?: string | null
  status?: number | null
}

/**
 * POST /gift-card/codes → paginate (raw codes with `template` and `user`, newest first).
 * An unknown template_id fails with 422 `validation.exists` (untranslated), hence `silent`.
 */
export function fetchCodes(q: CodeQuery, opts: { silent?: boolean } = {}) {
  return http.post<Paginated<GiftCardCode>>('/gift-card/codes', compact({ ...q }), opts)
}

/** Every code matching the filters (pages of 500, the backend maximum), capped at `limit`. */
export async function fetchAllCodes(
  filters: Omit<CodeQuery, 'page' | 'per_page'>,
  limit = 20000,
): Promise<{ rows: GiftCardCode[]; total: number }> {
  const rows: GiftCardCode[] = []
  let total = 0
  for (let page = 1; rows.length < limit; page++) {
    const res = await fetchCodes({ ...filters, page, per_page: 500 })
    total = Number(res.total ?? 0)
    rows.push(...(res.data ?? []))
    if (!res.data?.length || page >= Number(res.last_page ?? 1)) break
  }
  return { rows: rows.slice(0, limit), total }
}

/** POST /gift-card/toggle-code. disable: any status → 3; enable: only 3 → 0. */
export function toggleCode(id: number, action: 'enable' | 'disable') {
  return http.post<{ message: string }>('/gift-card/toggle-code', { id, action })
}

export interface CodeUpdatePayload {
  id: number
  /** unix seconds; null = never expires */
  expires_at?: number | null
  max_usage?: number
  status?: GiftCodeStatus
}

/** POST /gift-card/update-code → updated code (without relations). */
export function updateCode(payload: CodeUpdatePayload) {
  return http.post<GiftCardCode>('/gift-card/update-code', payload)
}

/** POST /gift-card/delete-code. Rejected (400) for used codes or codes with usage records. */
export function deleteCode(id: number) {
  return http.post<{ message: string }>('/gift-card/delete-code', { id })
}

/**
 * GET /gift-card/export-codes?batch_id= → text/plain, one code per line. Silent: an unknown batch
 * fails with an untranslated "validation.exists", so the caller words the error itself.
 */
export function exportBatch(batchId: string) {
  return request<Blob>('GET', adminUrl('/gift-card/export-codes'), {
    params: { batch_id: batchId },
    blob: true,
    silent: true,
  })
}

// ---------- usages / statistics ----------

export interface UsageQuery {
  page: number
  per_page: number
  template_id?: number | null
  user_id?: number | null
}

/**
 * POST /gift-card/usages → paginate (already transformed rows). Unknown template_id / user_id
 * fail with 422 `validation.exists`.
 */
export function fetchUsages(q: UsageQuery, opts: { silent?: boolean } = {}) {
  return http.post<Paginated<GiftCardUsage>>('/gift-card/usages', compact({ ...q }), opts)
}

/** POST /gift-card/statistics. Dates (Y-m-d) only affect `daily_usages`; default last 30 days. */
export function fetchStatistics(range?: { start_date: string; end_date: string }) {
  return http.post<GiftCardStatistics>('/gift-card/statistics', range ?? {})
}

export interface UserBrief {
  id: number
  email: string
}

/**
 * Exact user lookup by id (all digits) or email via GET /user/fetch, because usages can only be
 * filtered by user_id. Resolves null when nothing matches.
 */
export async function findUser(keyword: string): Promise<UserBrief | null> {
  const k = keyword.trim()
  if (!k) return null
  const byId = /^\d+$/.test(k)
  const res = await http.get<Paginated<UserBrief>>('/user/fetch', {
    current: 1,
    pageSize: 1,
    filter: [{ id: byId ? 'id' : 'email', value: `eq:${k}` }],
  })
  const u = res.data?.[0]
  return u ? { id: u.id, email: u.email } : null
}
