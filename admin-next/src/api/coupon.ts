// Coupon (优惠券) admin API. Spec: docs/admin-next/spec/commerce.md §5.
import { http } from '@/api/http'

/** 1 = fixed amount (value in cents), 2 = percentage (value is an integer percent). */
export type CouponType = 1 | 2

export const COUPON_TYPES: { value: CouponType; label: string }[] = [
  { value: 1, label: '按金额优惠' },
  { value: 2, label: '按比例优惠' },
]

/** New-format period keys accepted in `limit_period` (labels follow the official coupon wording). */
export const COUPON_PERIODS: { value: string; label: string }[] = [
  { value: 'monthly', label: '月付' },
  { value: 'quarterly', label: '季付' },
  { value: 'half_yearly', label: '半年付' },
  { value: 'yearly', label: '年付' },
  { value: 'two_yearly', label: '两年付' },
  { value: 'three_yearly', label: '三年付' },
  { value: 'onetime', label: '一次性' },
  { value: 'reset_traffic', label: '重置流量' },
]
export const COUPON_PERIOD_LABEL: Record<string, string> = Object.fromEntries(COUPON_PERIODS.map((p) => [p.value, p.label]))

export interface Coupon {
  id: number
  code: string
  name: string
  type: CouponType
  /** type 1: cents; type 2: percent. */
  value: number
  show: boolean
  /** Remaining total uses (decremented on each use); null = unlimited. */
  limit_use: number | null
  limit_use_with_user: number | null
  /** May hold numeric strings in legacy rows. */
  limit_plan_ids: (number | string)[] | null
  limit_period: string[] | null
  started_at: number
  ended_at: number
  created_at: number
  updated_at: number
}

export interface CouponFilter {
  id: string
  /** Array -> whereIn; scalar -> LIKE %value%. */
  value: string | number | (string | number)[]
}

export interface CouponQuery {
  current: number
  pageSize: number
  filter?: CouponFilter[]
  sort?: { id: string; desc: boolean }[]
}

export interface CouponPage {
  total: number
  current_page: number
  per_page: number
  last_page: number
  data: Coupon[]
}

/** Body of POST /coupon/generate (create single, edit with `id`, or batch with `generate_count`). */
export interface CouponSaveBody {
  id?: number
  generate_count?: number
  name: string
  code?: string | null
  type: CouponType
  value: number
  started_at: number
  ended_at: number
  limit_use: number | null
  limit_use_with_user: number | null
  limit_plan_ids: number[] | null
  limit_period: string[] | null
}

/** POST /coupon/fetch -> raw paginate body (no status envelope). */
export function fetchCoupons(q: CouponQuery) {
  return http.post<CouponPage>('/coupon/fetch', q)
}

/**
 * POST /coupon/generate.
 * - single / edit: success envelope -> `true`
 * - batch (`generate_count`): plain CSV text (HTTP 200). A failed batch insert yields an empty body (null).
 */
export function generateCoupons(body: CouponSaveBody) {
  return http.post<boolean | string | null>('/coupon/generate', body)
}

/** POST /coupon/fetch filtered by exact id (array filter -> whereIn). */
export async function fetchCouponById(id: number): Promise<Coupon | null> {
  const res = await fetchCoupons({ current: 1, pageSize: 1, filter: [{ id: 'id', value: [id] }] })
  return res.data?.[0] ?? null
}

/** POST /coupon/show { id } -> flips `show`, `true`; 400202 when the coupon is gone. */
export function toggleCouponShow(id: number) {
  return http.post<boolean>('/coupon/show', { id })
}

export class CouponMissingError extends Error {
  constructor() {
    super('优惠券不存在，可能已被删除')
    this.name = 'CouponMissingError'
  }
}

/**
 * Set `show` to an explicit value.
 * Deliberately not POST /coupon/update (what the official UI uses): for a missing id it throws
 * inside DB::beginTransaction() and never rolls back, leaking an open transaction in the Octane
 * worker so every later write on that worker stays uncommitted. /coupon/show has no transaction,
 * so read the current state first and flip only when needed.
 */
export async function setCouponShow(id: number, show: boolean): Promise<void> {
  const current = await fetchCouponById(id)
  if (!current) throw new CouponMissingError()
  if (!!current.show === show) return
  await toggleCouponShow(id)
}

/** POST /coupon/drop { id } -> true. */
export function dropCoupon(id: number) {
  return http.post<boolean>('/coupon/drop', { id })
}

/**
 * Coupons whose code collides with `code` the way checkout looks it up (`where code = ?`), newest first.
 * An array filter becomes whereIn, so the comparison follows the DB collation exactly
 * (case-insensitive on MySQL's default collation, case-sensitive on SQLite).
 * A scalar filter would be LIKE %code%: for short codes it can match many rows and push the exact one off the page.
 */
export async function findCouponsByCode(code: string): Promise<Coupon[]> {
  const res = await fetchCoupons({
    current: 1,
    pageSize: 50,
    filter: [{ id: 'code', value: [code] }],
    sort: [{ id: 'id', desc: true }],
  })
  return res.data ?? []
}

const CODE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** Same alphabet and length as the backend's Helper::randomChar(8). */
export function randomCouponCode(len = 8): string {
  const buf = new Uint32Array(len)
  crypto.getRandomValues(buf)
  return Array.from(buf, (n) => CODE_CHARS[n % CODE_CHARS.length]).join('')
}
