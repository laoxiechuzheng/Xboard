// Payment (支付配置) admin API. Spec: docs/admin-next/spec/commerce.md §4.
import { http } from '@/api/http'

export interface Payment {
  id: number
  /** 8-char random id used in the notify URL. */
  uuid: string
  /** Payment method key registered by a plugin, e.g. `EPay`. */
  payment: string
  name: string
  icon: string | null
  notify_domain: string | null
  /** Cents. */
  handling_fee_fixed: number | null
  /** Percent 0-100, decimal string such as "1.50". */
  handling_fee_percent: string | number | null
  enable: boolean
  sort: number | null
  created_at: number
  updated_at: number
  /** Built by the backend: notify_domain (if set) + /api/v1/guest/payment/notify/{payment}/{uuid}. */
  notify_url: string
}

/** One field of a payment plugin form, normalized by PaymentService::form(). */
export interface PaymentFormField {
  type: string
  label: string
  placeholder: string
  description: string
  value: unknown
  /** `[{value,label}]`, `{value: label}` or `string[]` depending on the plugin. */
  options: unknown
  /** Only present with `safe: true`: the stored value was blanked. */
  sensitive?: boolean
}

export type PaymentFormSchema = Record<string, PaymentFormField>

export interface PaymentSaveBody {
  id?: number
  name: string
  icon: string | null
  notify_domain: string | null
  /** Cents (integer). */
  handling_fee_fixed: number | null
  handling_fee_percent: number | null
  payment: string
  config: Record<string, unknown>
}

export function notifyPath(payment: string, uuid: string) {
  return `/api/v1/guest/payment/notify/${payment}/${uuid}`
}

/**
 * GET /payment/fetch -> success envelope, sorted by `sort`.
 * The backend also returns every gateway's plaintext `config`; it is dropped here so
 * secrets never sit in list state (the edit dialog reloads config via getPaymentForm).
 */
export async function fetchPayments(): Promise<Payment[]> {
  const rows = await http.get<(Payment & { config?: unknown })[]>('/payment/fetch')
  return (rows ?? []).map(({ config: _config, ...rest }) => ({ ...rest, enable: !!rest.enable }))
}

/** GET /payment/getPaymentMethods -> method keys of enabled payment plugins. */
export async function fetchPaymentMethods(): Promise<string[]> {
  const res = await http.get<string[] | Record<string, string>>('/payment/getPaymentMethods')
  // array_unique() may leave gaps in the keys, which JSON-encodes as an object.
  return Array.isArray(res) ? res : Object.values(res ?? {})
}

/** POST /payment/getPaymentForm { payment, id?, safe? } -> field map (`[]` when the plugin has no fields). */
export async function fetchPaymentForm(
  payload: { payment: string; id?: number; safe?: boolean },
  opts: { silent?: boolean } = {},
): Promise<PaymentFormSchema> {
  const res = await http.post<PaymentFormSchema | unknown[]>('/payment/getPaymentForm', payload, opts)
  return res && !Array.isArray(res) && typeof res === 'object' ? (res as PaymentFormSchema) : {}
}

/** POST /payment/save -> true. New payments are created disabled. */
export function savePayment(body: PaymentSaveBody) {
  return http.post<boolean>('/payment/save', body)
}

/** POST /payment/show { id } -> toggles `enable`. */
export function togglePayment(id: number) {
  return http.post<boolean>('/payment/show', { id })
}

/** POST /payment/drop { id } -> deletes without checking order references. */
export function dropPayment(id: number) {
  return http.post<boolean>('/payment/drop', { id })
}

/**
 * POST /payment/sort { ids } -> sort = index + 1.
 * Only send ids known to exist: a missing id throws an Error inside the controller's DB transaction
 * that its `catch (\Exception)` does not handle, so the transaction is never rolled back.
 */
export function sortPayments(ids: number[]) {
  return http.post<boolean>('/payment/sort', { ids })
}

/** GET /config/fetch?key=site -> app_url is required before /payment/save succeeds. */
export async function fetchSiteAppUrl(): Promise<string | null> {
  const res = await http.get<{ site?: { app_url?: string | null } }>('/config/fetch', { key: 'site' }, { silent: true })
  return res?.site?.app_url ?? null
}
