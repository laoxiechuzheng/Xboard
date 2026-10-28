// Display helpers and filter definitions for the user module (spec users.md §2–§6).
import { GB, formatTime, formatDate } from '@/utils/format'
import type { UserFilter, UserRow } from '@/api/user'

export const truthy = (v: unknown) => v === true || v === 1 || v === '1'

/** Seconds since epoch; "online" means reported within the last 120s (official rule). */
export function isOnline(row: Pick<UserRow, 't'>): boolean {
  const t = Number(row.t) || 0
  return t > 0 && Date.now() / 1000 - t < 120
}

/** Multi-line online tooltip: 当前在线 / 从未在线 / 最后在线时间 + 离线时长. */
export function onlineLines(row: Pick<UserRow, 't'>): string[] {
  const t = Number(row.t) || 0
  if (isOnline(row)) return ['当前在线']
  if (!t) return ['从未在线']
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - t))
  let dur: string
  if (diff >= 86400) dur = `${Math.floor(diff / 86400)}天`
  else if (diff >= 3600) dur = `${Math.floor(diff / 3600)}小时`
  else if (diff >= 60) dur = `${Math.floor(diff / 60)}分钟`
  else dur = `${diff}秒`
  return [`最后在线时间: ${formatTime(t)}`, `离线时长: ${dur}`]
}

/** Main identity text (phone plugin may provide identity/phone). */
export function identityOf(row: UserRow): string {
  return row.identity || row.phone || row.email
}

export function showsEmailSubline(row: UserRow): boolean {
  const id = identityOf(row)
  return row.identity_type === 'phone' || (!!row.phone && id === row.phone)
}

export type ExpireState = 'forever' | 'expired' | 'active'

export interface ExpireInfo {
  state: ExpireState
  /** Short label for the tag */
  label: string
  /** Tooltip lines */
  lines: string[]
}

/** expired_at: null = 长期有效; legacy 0 is treated as expired like the backend does (spec R-18). */
export function expireInfo(row: Pick<UserRow, 'expired_at' | 'next_reset_at'>): ExpireInfo {
  const exp = row.expired_at
  const lines: string[] = []
  if (exp === null || exp === undefined) {
    lines.push('长期有效')
    if (row.next_reset_at) lines.push(`下次重置时间: ${formatTime(row.next_reset_at)}`)
    return { state: 'forever', label: '长期有效', lines }
  }
  const n = Number(exp)
  const diffMs = n * 1000 - Date.now()
  const days = Math.abs(Math.ceil(diffMs / 86400000))
  const expired = n * 1000 < Date.now()
  if (n === 0) {
    lines.push('到期时间为 0（历史数据），系统按已过期处理')
    return { state: 'expired', label: '已过期', lines }
  }
  lines.push(`到期时间: ${formatTime(n)}`)
  lines.push(expired ? `已过期 ${days} 天` : `剩余 ${days} 天`)
  if (row.next_reset_at) lines.push(`下次重置时间: ${formatTime(row.next_reset_at)}`)
  return { state: expired ? 'expired' : 'active', label: formatDate(n), lines }
}

/** Used percentage; null when transfer_enable is 0 (official showed "Infinity%"). */
export function usedPercent(row: Pick<UserRow, 'total_used' | 'transfer_enable'>): number | null {
  const total = Number(row.transfer_enable) || 0
  const used = Number(row.total_used) || 0
  if (total <= 0) return used > 0 ? null : 0
  return (used / total) * 100
}

export function money(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return `¥${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`
}

export const COMMISSION_TYPE_OPTIONS = [
  { label: '跟随系统设置', value: 0 },
  { label: '循环返利', value: 1 },
  { label: '首次返利', value: 2 },
]

export function commissionTypeLabel(v: number | null | undefined): string {
  return COMMISSION_TYPE_OPTIONS.find((o) => o.value === Number(v ?? 0))?.label ?? String(v)
}

/** last_login_ip is an integer column; render IPv4 integers as dotted quads. */
export function formatIp(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v)
  if (Number.isInteger(n) && n > 0 && n <= 0xffffffff) {
    return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
  }
  return String(v)
}

/** Datetime string or unix seconds -> local 'YYYY-MM-DD HH:mm:ss'. */
export function formatAnyTime(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-'
  return formatTime(v)
}

// ---------------------------------------------------------------- advanced filter

export type FilterFieldType = 'text' | 'number' | 'gb' | 'select' | 'date' | 'boolean'
export type FilterOperator = 'contains' | 'eq' | 'gt' | 'lt'

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: '包含',
  eq: '等于',
  gt: '大于',
  lt: '小于',
}

export interface FilterFieldDef {
  key: string
  label: string
  type: FilterFieldType
  operators: FilterOperator[]
  options?: { label: string; value: string | number }[]
  /** Send the raw value without `op:` (subscription_status). */
  raw?: boolean
}

export interface FilterCondition {
  field: string
  operator: FilterOperator | ''
  value: string | number | boolean | null
}

/** Field list in the official order (+ phone when the phone_auth plugin is enabled, + subscription_status extra). */
export function buildFilterFields(planOptions: { label: string; value: number }[], withPhone: boolean): FilterFieldDef[] {
  const fields: FilterFieldDef[] = [{ key: 'email', label: '邮箱', type: 'text', operators: ['contains', 'eq'] }]
  if (withPhone) fields.push({ key: 'phone', label: '手机号', type: 'text', operators: ['contains', 'eq'] })
  fields.push(
    { key: 'id', label: '用户ID', type: 'number', operators: ['eq', 'gt', 'lt'] },
    { key: 'plan_id', label: '订阅', type: 'select', operators: ['eq'], options: planOptions },
    { key: 'transfer_enable', label: '流量', type: 'gb', operators: ['gt', 'lt', 'eq'] },
    { key: 'total_used', label: '已用流量', type: 'gb', operators: ['gt', 'lt', 'eq'] },
    { key: 'online_count', label: '在线设备', type: 'number', operators: ['eq', 'gt', 'lt'] },
    { key: 'expired_at', label: '到期时间', type: 'date', operators: ['lt', 'gt', 'eq'] },
    { key: 'uuid', label: 'UUID', type: 'text', operators: ['eq'] },
    { key: 'token', label: 'Token', type: 'text', operators: ['eq'] },
    {
      key: 'banned',
      label: '账号状态',
      type: 'select',
      operators: ['eq'],
      options: [
        { label: '正常', value: '0' },
        { label: '封禁', value: '1' },
      ],
    },
    { key: 'remarks', label: '备注', type: 'text', operators: ['contains', 'eq'] },
    { key: 'invite_user.email', label: '邀请人邮箱', type: 'text', operators: ['contains', 'eq'] },
    { key: 'invite_user_id', label: '邀请人ID', type: 'number', operators: ['eq'] },
    { key: 'is_admin', label: '管理员', type: 'boolean', operators: ['eq'] },
    { key: 'is_staff', label: '员工', type: 'boolean', operators: ['eq'] },
    {
      key: 'subscription_status',
      label: '订阅状态',
      type: 'select',
      operators: ['eq'],
      raw: true,
      options: [
        { label: '有效（含长期有效）', value: 'active' },
        { label: '已过期', value: 'expired' },
      ],
    },
  )
  return fields
}

export function emptyValueFor(type: FilterFieldType | undefined): FilterCondition['value'] {
  return type === 'boolean' ? false : null
}

export function isConditionComplete(c: FilterCondition): boolean {
  if (!c.field || !c.operator) return false
  if (c.value === null || c.value === undefined) return false
  if (typeof c.value === 'string' && c.value.trim() === '') return false
  return true
}

/** Local-midnight seconds of a date-picker value (ms). */
function dayStartSeconds(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

/**
 * "contains" filter value. A plain value is LIKE %v%; values containing ':' would be parsed as
 * `op:val` by the backend, so they are sent as an explicit `like:` operator instead.
 */
export function containsValue(v: string): string {
  return v.includes(':') ? `like:${v}` : v
}

/** Condition -> user/fetch filter item (official conversion rules, §2.6). */
export function conditionToFilter(c: FilterCondition, def: FilterFieldDef | undefined): UserFilter {
  const type = def?.type ?? 'text'
  let v: string
  if (type === 'date') v = String(dayStartSeconds(Number(c.value)))
  else if (type === 'boolean') v = c.value ? '1' : '0'
  else if (type === 'gb') v = String(Math.round(Number(c.value) * GB))
  else v = typeof c.value === 'string' ? c.value.trim() : String(c.value)
  if (def?.raw) return { id: c.field, value: v }
  if (c.operator === 'contains') return { id: c.field, value: containsValue(v) }
  return { id: c.field, value: `${c.operator}:${v}` }
}

/** Human readable chip text for an applied condition. */
export function conditionLabel(c: FilterCondition, def: FilterFieldDef | undefined): string {
  const label = def?.label ?? c.field
  const op = c.operator ? OPERATOR_LABELS[c.operator] : ''
  let v: string
  switch (def?.type) {
    case 'date':
      v = formatDate(Number(c.value) / 1000)
      break
    case 'boolean':
      v = c.value ? '是' : '否'
      break
    case 'gb':
      v = `${c.value} GB`
      break
    case 'select':
      v = def.options?.find((o) => String(o.value) === String(c.value))?.label ?? String(c.value)
      break
    default:
      v = String(c.value)
  }
  return def?.raw ? `${label}：${v}` : `${label} ${op} ${v}`
}
