// Plan (套餐) admin API. Spec: docs/admin-next/spec/commerce.md §2.
import { http } from '@/api/http'

/** New-format period keys used by plan.prices (and stored in v2_order.period). */
export type PlanPeriod =
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'yearly'
  | 'two_yearly'
  | 'three_yearly'
  | 'onetime'
  | 'reset_traffic'

/** Legacy period keys used by /order/fetch, /order/detail and /order/assign. */
export type LegacyPeriod =
  | 'month_price'
  | 'quarter_price'
  | 'half_year_price'
  | 'year_price'
  | 'two_year_price'
  | 'three_year_price'
  | 'onetime_price'
  | 'reset_price'

export interface PeriodMeta {
  key: PlanPeriod
  legacy: LegacyPeriod
  /** Label in the plan list / form. */
  label: string
  /** Label used for orders. */
  orderLabel: string
  /** Price unit suffix in the plan list ("" for onetime). */
  unit: string
  /** Months and discount used by the "基础价格" auto-fill. */
  months: number
  discount: number
}

export const PLAN_PERIODS: PeriodMeta[] = [
  { key: 'monthly', legacy: 'month_price', label: '月付', orderLabel: '月付', unit: '元/月', months: 1, discount: 1 },
  { key: 'quarterly', legacy: 'quarter_price', label: '季付', orderLabel: '季付', unit: '元/季', months: 3, discount: 0.95 },
  { key: 'half_yearly', legacy: 'half_year_price', label: '半年付', orderLabel: '半年付', unit: '元/半年', months: 6, discount: 0.9 },
  { key: 'yearly', legacy: 'year_price', label: '年付', orderLabel: '年付', unit: '元/年', months: 12, discount: 0.85 },
  { key: 'two_yearly', legacy: 'two_year_price', label: '两年付', orderLabel: '两年付', unit: '元/两年', months: 24, discount: 0.8 },
  { key: 'three_yearly', legacy: 'three_year_price', label: '三年付', orderLabel: '三年付', unit: '元/三年', months: 36, discount: 0.75 },
  { key: 'onetime', legacy: 'onetime_price', label: '流量包', orderLabel: '一次性', unit: '', months: 1, discount: 1 },
  { key: 'reset_traffic', legacy: 'reset_price', label: '重置包', orderLabel: '流量重置包', unit: '元/次', months: 1, discount: 1 },
]

export const PERIOD_BY_KEY = Object.fromEntries(PLAN_PERIODS.map((p) => [p.key, p])) as Record<PlanPeriod, PeriodMeta>
export const PERIOD_BY_LEGACY = Object.fromEntries(PLAN_PERIODS.map((p) => [p.legacy, p])) as Record<LegacyPeriod, PeriodMeta>

/**
 * reset_traffic_method: null = follow system setting.
 * `userText` is what PlanResource::getResetMethodText puts in {{reset_method}} (zh-CN);
 * null resolves to the system setting at render time.
 */
export const RESET_METHODS: { value: number | null; label: string; userText: string }[] = [
  { value: null, label: '跟随系统设置', userText: '按系统设置' },
  { value: 0, label: '每月 1 号', userText: '每月1号' },
  { value: 1, label: '每月购买日', userText: '按月' },
  { value: 2, label: '不重置', userText: '不重置' },
  { value: 3, label: '每年 1 月 1 日', userText: '每年1月1日' },
  { value: 4, label: '每年购买日', userText: '按年' },
]

/**
 * Placeholders the backend replaces in plan.content when users / guests fetch plans
 * (PlanResource::formatContent); the stored content keeps them verbatim.
 */
export const PLAN_CONTENT_TEMPLATE = [
  '## 套餐详情',
  '',
  '- 流量：{{transfer}} GB',
  '- 速度限制：{{speed}} Mbps',
  '- 同时在线设备：{{devices}} 台',
  '',
  '## 服务说明',
  '',
  '1. 流量{{reset_method}}重置',
  '2. 支持多平台使用',
  '3. 7×24小时技术支持',
  '',
].join('\n')

export function resetMethodLabel(v: number | null | undefined): string {
  return RESET_METHODS.find((m) => m.value === (v ?? null))?.label ?? String(v)
}

/** Prices as returned: yuan; values may be number, numeric string or null; `[]` when empty. */
export type PlanPrices = Partial<Record<PlanPeriod, number | string | null>>

export interface Plan {
  id: number
  name: string
  group_id: number | null
  group: { id: number; name: string } | null
  /** GB */
  transfer_enable: number
  /** Mbps */
  speed_limit: number | null
  device_limit: number | null
  /** null = unlimited, 0 = sold out */
  capacity_limit: number | null
  show: boolean
  sell: boolean | number
  renew: boolean
  prices: PlanPrices | unknown[] | null
  reset_traffic_method: number | null
  content: string | null
  tags: string[] | null
  sort: number | null
  users_count: number
  active_users_count: number
  created_at: number
  updated_at: number
}

/** Normalize `prices` (may be `[]` or contain strings) into numbers keyed by period. */
export function planPrices(plan: Pick<Plan, 'prices'>): Partial<Record<PlanPeriod, number>> {
  const out: Partial<Record<PlanPeriod, number>> = {}
  const raw = plan.prices
  if (!raw || Array.isArray(raw)) return out
  for (const p of PLAN_PERIODS) {
    const v = (raw as PlanPrices)[p.key]
    if (v === null || v === undefined || v === '') continue
    const n = Number(v)
    if (Number.isFinite(n)) out[p.key] = n
  }
  return out
}

export interface PlanSavePayload {
  id?: number
  name: string
  tags: string[]
  group_id: number | null
  transfer_enable: number
  speed_limit: number | null
  device_limit: number | null
  capacity_limit: number | null
  reset_traffic_method: number | null
  /** Only periods with a price > 0. Must be an object: `null` makes the backend 500. */
  prices: Partial<Record<PlanPeriod, number>>
  content: string
  force_update?: boolean
}

/** GET /plan/fetch -> all plans ordered by sort (no paging). */
export function fetchPlans() {
  return http.get<Plan[]>('/plan/fetch')
}

/** POST /plan/save -> true. Without id creates (show=0, sell=0, renew=1 by default). */
export function savePlan(payload: PlanSavePayload) {
  return http.post<boolean>('/plan/save', payload)
}

/** POST /plan/update -> true. Only show / sell / renew are writable here. */
export function updatePlan(payload: { id: number; show?: boolean; sell?: boolean; renew?: boolean }) {
  return http.post<boolean>('/plan/update', payload)
}

/** POST /plan/drop -> true. Rejected when orders or users reference the plan. */
export function dropPlan(id: number) {
  return http.post<boolean>('/plan/drop', { id })
}

/** POST /plan/sort -> true. `ids` must contain every plan in the new order. */
export function sortPlans(ids: number[]) {
  return http.post<boolean>('/plan/sort', { ids })
}

/** POST /server/group/save { name } -> true (used by the plan form "添加分组"). */
export function createServerGroup(name: string) {
  return http.post<boolean>('/server/group/save', { name })
}
