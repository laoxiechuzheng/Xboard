// User management APIs (spec users.md §2–§10).
import { http, type Query } from '@/api/http'

/** Row returned by user/fetch (`transformUserData`): money already in 元, traffic in bytes, times in unix seconds. */
export interface UserRow {
  id: number
  email: string
  invite_user_id: number | null
  telegram_id: number | null
  /** 元 (backend divides by 100). */
  balance: number
  /** 元 (backend divides by 100). */
  commission_balance: number
  /** 0 跟随系统 1 循环返利 2 首次返利 */
  commission_type: number
  commission_rate: number | null
  discount: number | null
  /** Last traffic report (seconds); 0 = never online. */
  t: number
  u: number
  d: number
  total_used: number
  transfer_enable: number
  banned: boolean | number
  is_admin: boolean | number
  is_staff: boolean | number
  last_login_at: number | null
  last_login_ip: number | string | null
  uuid: string
  token: string
  group_id: number | null
  plan_id: number | null
  speed_limit: number | null
  device_limit: number | null
  online_count: number | null
  /** Datetime string or unix seconds depending on the driver. */
  last_online_at: string | number | null
  remind_expire: boolean | number
  remind_traffic: boolean | number
  expired_at: number | null
  next_reset_at: number | null
  last_reset_at: number | null
  reset_count: number | null
  remarks: string | null
  created_at: number
  updated_at: number
  plan: { id: number; name: string } | null
  group: { id: number; name: string } | null
  invite_user: { id: number; email: string } | null
  subscribe_url: string
  // Present only when the phone_auth plugin injects them via `admin.user.transform`.
  phone?: string | null
  phone_national_number?: string | null
  phone_country_code?: string | null
  phone_default_country_code?: string | null
  phone_auth_enabled?: boolean
  phone_auth_countries?: { code: string; name: string; dial_code: string }[]
  identity?: string | null
  identity_type?: string | null
}

/** One user/fetch filter item. `value` is `op:val`, a plain string (LIKE), or an array (whereIn). */
export interface UserFilter {
  id: string
  value: string | (string | number)[]
  logic?: 'and' | 'or'
}

export interface UserSort {
  id: string
  desc: boolean
}

export interface UserFetchParams {
  current: number
  pageSize: number
  filter?: UserFilter[]
  sort?: UserSort[]
}

export interface Paginated<T> {
  total: number
  current_page: number
  per_page: number
  last_page: number
  data: T[]
}

/**
 * GET /user/fetch (route is `any`). GET keeps list queries out of the admin audit log
 * (spec R-17); nested filter/sort are serialized in PHP bracket style.
 */
export function fetchUsers(params: UserFetchParams) {
  const query: Query = { current: params.current, pageSize: params.pageSize }
  if (params.filter?.length) query.filter = params.filter.map((f) => ({ ...f }))
  if (params.sort?.length) query.sort = params.sort.map((s) => ({ id: s.id, desc: s.desc ? 1 : 0 }))
  return http.get<Paginated<UserRow>>('/user/fetch', query)
}

/** Single fresh row (same units as the list). getUserInfoById returns raw cents and 500s on unknown ids. */
export async function fetchUserRow(id: number): Promise<UserRow | null> {
  const res = await fetchUsers({ current: 1, pageSize: 1, filter: [{ id: 'id', value: `eq:${id}` }] })
  return res.data?.[0] ?? null
}

/** Backend `User::byEmail` semantics: emails are stored and matched as `strtolower(trim())`. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase()

/**
 * Exact email lookup (used to validate the inviter before saving). Normalized first because
 * `eq:` is case-sensitive on SQLite while `byEmail` is not.
 */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const value = `eq:${normalizeEmail(email)}`
  const res = await fetchUsers({ current: 1, pageSize: 1, filter: [{ id: 'email', value }] })
  return res.data?.[0] ?? null
}

/** Total users matching filters (pageSize 1). */
export async function countUsers(filter?: UserFilter[]): Promise<number> {
  const res = await fetchUsers({ current: 1, pageSize: 1, filter })
  return Number(res.total ?? 0)
}

/** POST /user/update payload: `id` plus changed fields. balance/commission_balance in 元, traffic in bytes. */
export interface UserUpdatePayload {
  id: number
  email?: string
  invite_user_email?: string | null
  password?: string | null
  balance?: number
  commission_balance?: number
  u?: number
  d?: number
  transfer_enable?: number
  expired_at?: number | null
  plan_id?: number | null
  banned?: boolean
  commission_type?: number
  commission_rate?: number | null
  discount?: number | null
  speed_limit?: number | null
  device_limit?: number | null
  is_admin?: boolean
  is_staff?: boolean
  remarks?: string | null
  country_code?: string | null
  phone?: string | null
}

export function updateUser(payload: UserUpdatePayload) {
  return http.post<boolean>('/user/update', payload)
}

export interface UserGeneratePayload {
  email_prefix: string | null
  email_suffix: string
  password: string | null
  expired_at: number | null
  plan_id: number | null
  generate_count: number | null
  download_csv: boolean
}

export interface GeneratedUser {
  email: string
  password: string
  /** 'Y-m-d H:i:s' or '长期有效' */
  expired_at: string
  uuid: string
  created_at: string
  subscribe_url: string
}

/**
 * POST /user/generate.
 * - single (prefix, no count): success envelope `data: true`
 * - batch JSON: raw `{ code: 0, message, data: GeneratedUser[] }`
 */
export function generateUsers(payload: UserGeneratePayload) {
  return http.post<boolean | { code: number; message: string; data: GeneratedUser[] }>('/user/generate', payload)
}

/** POST /user/generate with download_csv=true (batch only) -> CSV Blob. */
export function generateUsersCsv(payload: UserGeneratePayload) {
  return http.post<Blob>('/user/generate', { ...payload, download_csv: true }, { blob: true })
}

/** Scope payload shared by dumpCSV / sendMail / ban. Never send `sort` (spec R-3). */
export type BulkScopePayload =
  | { scope: 'selected'; user_ids: number[] }
  | { scope: 'filtered'; filter: UserFilter[] }
  | { scope: 'all' }

export function dumpUsersCsv(scope: BulkScopePayload) {
  return http.post<Blob>('/user/dumpCSV', scope, { blob: true })
}

export function sendUserMail(scope: BulkScopePayload, subject: string, content: string) {
  return http.post<boolean>('/user/sendMail', { ...scope, subject, content })
}

export function banUsers(scope: BulkScopePayload) {
  return http.post<boolean>('/user/ban', scope)
}

/** Regenerate token + uuid (old subscription links stop working immediately). */
export function resetUserSecret(id: number) {
  return http.post<boolean>('/user/resetSecret', { id })
}

/** Delete the user plus orders, invite codes, traffic stats and tickets. */
export function destroyUser(id: number) {
  return http.post<boolean>('/user/destroy', { id })
}

export interface StatUserRecord {
  id: number
  user_id: number
  /** decimal string, e.g. "1.00" */
  server_rate: string | number
  /** Billed bytes (already multiplied by server_rate). */
  u: number
  d: number
  record_type: 'd' | 'm' | string
  record_at: number
  created_at: number
  updated_at: number
}

/** GET /stat/getStatUser (route is `any`) -> raw `{ data, total }`. */
export function fetchUserTrafficStats(params: { user_id: number; page: number; pageSize: number }) {
  return http.get<{ data: StatUserRecord[]; total: number }>('/stat/getStatUser', params)
}

// ---------------------------------------------------------------- login / register log

/** login = 密码登录, register = 注册, mail_link = 邮件链接 / 快速登录链接. */
export type LoginLogType = 'login' | 'register' | 'mail_link'
/** pending = 解析中, resolved = 已解析, private = 内网/保留地址, failed = 解析失败. */
export type LoginGeoStatus = 'pending' | 'resolved' | 'private' | 'failed'
export type LoginDeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'

/** Geo lookup (ip.sb, ip-api.com fallback); only present when `geo_status === 'resolved'`. Names are English. */
export interface LoginLogLocation {
  country: string | null
  /** ISO 3166-1 alpha-2, localise with Intl.DisplayNames. */
  country_code: string | null
  region: string | null
  city: string | null
  isp: string | null
  asn: number | null
}

/** Parsed from the User-Agent on the backend. */
export interface LoginLogDevice {
  type: LoginDeviceType | string
  os: string | null
  browser: string | null
  model: string | null
}

export interface LoginLog {
  id: number
  user_id: number
  /** null when the user no longer exists. */
  email: string | null
  type: LoginLogType | string
  /** false = wrong-password attempt (type login). */
  success: boolean
  ip: string
  geo_status: LoginGeoStatus | string
  location: LoginLogLocation | null
  device: LoginLogDevice | null
  /** Requesting site (Origin / Referer host[:port]). */
  origin: string | null
  /** Raw User-Agent: render as text only (never v-html). */
  user_agent: string | null
  /** Always false in the admin API. */
  is_current: boolean
  /** unix seconds */
  created_at: number
}

export interface LoginLogQuery {
  current: number
  pageSize: number
  user_id?: number | null
  /** LIKE match on the user's email. */
  email?: string | null
  /** Prefix match. */
  ip?: string | null
  type?: LoginLogType | null
  success?: 0 | 1 | null
  /** unix seconds, inclusive */
  start_at?: number | null
  end_at?: number | null
}

/**
 * GET /user/loginLog/fetch (route is `any`; GET keeps browsing out of the admin audit log).
 * Paginated `{ total, current_page, per_page, last_page, data }`; empty filters are not sent.
 * Panels without the login-log backend answer 404.
 */
export function fetchLoginLogs(params: LoginLogQuery, opts: { silent?: boolean } = {}) {
  const query: Query = { current: params.current, pageSize: params.pageSize }
  const keys = ['user_id', 'email', 'ip', 'type', 'success', 'start_at', 'end_at'] as const
  for (const k of keys) {
    const v = params[k]
    if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) continue
    query[k] = typeof v === 'string' ? v.trim() : v
  }
  return http.get<Paginated<LoginLog>>('/user/loginLog/fetch', query, opts)
}
