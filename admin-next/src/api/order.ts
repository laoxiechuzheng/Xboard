// Order (订单 / 佣金) admin API. Spec: docs/admin-next/spec/commerce.md §3.
import { http } from '@/api/http'
import type { LegacyPeriod } from '@/api/plan'

type TagType = 'default' | 'info' | 'success' | 'warning' | 'error'

export interface EnumOption {
  value: number
  label: string
  type: TagType
}

export const ORDER_STATUS: EnumOption[] = [
  { value: 0, label: '待支付', type: 'warning' },
  { value: 1, label: '开通中', type: 'info' },
  { value: 2, label: '已取消', type: 'error' },
  { value: 3, label: '已完成', type: 'success' },
  { value: 4, label: '已折抵', type: 'default' },
]

export const ORDER_TYPE: EnumOption[] = [
  { value: 1, label: '新购', type: 'success' },
  { value: 2, label: '续费', type: 'info' },
  { value: 3, label: '升级', type: 'warning' },
  { value: 4, label: '流量重置', type: 'default' },
]

/** DB comment: 0 待确认 1 发放中 2 有效 3 无效. Admin may only set 0/1/3. */
export const COMMISSION_STATUS: EnumOption[] = [
  { value: 0, label: '待确认', type: 'warning' },
  { value: 1, label: '发放中', type: 'info' },
  { value: 2, label: '有效', type: 'success' },
  { value: 3, label: '无效', type: 'error' },
]

export function findEnum(list: EnumOption[], v: number | string | null | undefined): EnumOption | undefined {
  if (v === null || v === undefined || v === '') return undefined
  return list.find((x) => x.value === Number(v))
}

export interface OrderBase {
  id: number
  invite_user_id: number | null
  user_id: number
  plan_id: number
  coupon_id: number | null
  payment_id: number | null
  type: number
  /** Legacy format (month_price ...) as returned by fetch/detail. */
  period: LegacyPeriod | string | null
  trade_no: string
  callback_no: string | null
  /** All amounts in cents. */
  total_amount: number
  handling_amount: number | null
  discount_amount: number | null
  surplus_amount: number | null
  /** Upgrade credit returned to balance (renamed from refund_amount in this fork). */
  surplus_credit: number | null
  balance_amount: number | null
  surplus_order_ids: number[] | null
  status: number
  commission_status: number | null
  commission_balance: number | null
  actual_commission_balance: number | null
  paid_at: number | null
  /**
   * Payment deadline of an admin-assigned order (order/assign `expire_hours`); null for orders users
   * placed themselves, which are cancelled 2 hours after creation. Absent on panels without the field.
   */
  expires_at?: number | null
  created_at: number
  updated_at: number
}

/** Pending orders without `expires_at` are cancelled this long after creation (OrderHandleJob). */
export const PENDING_ORDER_TTL = 7200

/** When a pending order is cancelled automatically (DESIGN §4.4: expires_at ?? created_at + 7200). */
export function paymentDeadline(o: Pick<OrderBase, 'expires_at' | 'created_at'>): number {
  const exp = Number(o.expires_at)
  return exp > 0 ? exp : Number(o.created_at) + PENDING_ORDER_TTL
}

/** expires_at is only written by order/assign. */
export function isAssignedOrder(o: Pick<OrderBase, 'expires_at'>): boolean {
  return Number(o.expires_at) > 0
}

export interface Order extends OrderBase {
  plan: { id: number; name: string } | null
  user: { id: number; email: string } | null
  invite_user: { id: number; email: string } | null
  payment: { id: number; name: string; payment: string; enable: boolean | number } | null
}

export interface CommissionLog {
  id: number
  invite_user_id: number
  user_id: number
  trade_no: string
  /** cents */
  order_amount: number
  /** cents */
  get_amount: number
  created_at: number
  updated_at: number
}

export interface OrderDetail extends Order {
  commission_log: CommissionLog[]
  /** Present only when surplus_order_ids is non-empty; period here is the raw (new) format. */
  surplus_orders?: OrderBase[]
}

/**
 * Column filter as understood by OrderController::buildFilterQuery:
 * array -> whereIn; "op:value" (eq/gt/gte/lt/lte/like/notlike) -> comparison; other -> like %v%.
 */
export interface OrderFilter {
  id: 'trade_no' | 'type' | 'period' | 'status' | 'commission_status' | 'commission_balance' | 'user_id' | 'id' | 'invite_user_id' | 'plan_id'
  value: string | (string | number)[]
}

export interface OrderSort {
  id: 'total_amount' | 'status' | 'commission_balance' | 'commission_status' | 'created_at'
  desc: boolean
}

export interface OrderFetchParams {
  current: number
  pageSize: number
  filter?: OrderFilter[]
  sort?: OrderSort[]
}

export interface OrderPage {
  total: number
  current_page: number
  per_page: number
  last_page: number
  data: Order[]
}

/** POST /order/fetch -> raw paginate body (no status envelope). */
export function fetchOrders(params: OrderFetchParams) {
  return http.post<OrderPage>('/order/fetch', params)
}

/** POST /order/detail { id } -> order with user/plan/payment/commission_log/invite_user. */
export function fetchOrderDetail(id: number) {
  return http.post<OrderDetail>('/order/detail', { id })
}

/** POST /order/paid { trade_no } -> true. Pending only; opens the subscription immediately. */
export function markOrderPaid(tradeNo: string) {
  return http.post<boolean>('/order/paid', { trade_no: tradeNo })
}

/** POST /order/cancel { trade_no } -> true. Pending only; refunds balance_amount to the user. */
export function cancelOrder(tradeNo: string) {
  return http.post<boolean>('/order/cancel', { trade_no: tradeNo })
}

/** POST /order/update { trade_no, commission_status } -> true. Backend accepts 0 / 1 / 3. */
export function updateCommissionStatus(tradeNo: string, commissionStatus: 0 | 1 | 3) {
  return http.post<boolean>('/order/update', { trade_no: tradeNo, commission_status: commissionStatus })
}

export interface OrderAssignPayload {
  email: string
  plan_id: number
  period: LegacyPeriod
  /** cents */
  total_amount: number
  /** Payment window in hours (1–720); the backend defaults to 72. */
  expire_hours?: number
}

/** POST /order/assign -> new trade_no. Creates a pending order; no price/balance checks. */
export function assignOrder(payload: OrderAssignPayload) {
  return http.post<string>('/order/assign', payload)
}
