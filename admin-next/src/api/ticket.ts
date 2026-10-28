// Ticket management APIs (spec content.md §2).
import { http, type Query } from '@/api/http'

/** 0 处理中（开启） 1 已关闭 */
export type TicketStatus = 0 | 1
/** 0 待回复（用户最后发言） 1 已回复（管理员最后发言） */
export type TicketReplyStatus = 0 | 1
/** 0 低 1 中 2 高 */
export type TicketLevel = 0 | 1 | 2

export interface TicketUserBrief {
  id: number
  email: string
  is_admin: boolean
  is_staff: boolean
}

/** `UserController::transformUserData`: v2_user columns (password hidden), money in 元. */
export interface TicketUser {
  id: number
  email: string
  balance: number
  commission_balance: number
  subscribe_url: string
  plan_id: number | null
  banned: boolean | number
  expired_at: number | null
  transfer_enable: number
  u: number
  d: number
  [key: string]: unknown
}

export interface TicketListItem {
  id: number
  user_id: number
  subject: string
  level: TicketLevel | number
  status: TicketStatus | number
  reply_status: TicketReplyStatus | number | null
  last_reply_user_id: number | null
  created_at: number
  updated_at: number
  /** Null only for orphaned rows (backend would 500 before that, spec R-T8). */
  user: TicketUser | null
  last_reply_user: TicketUserBrief | null
}

export interface TicketMessage {
  id: number
  user_id: number
  ticket_id: number
  /** Plain text from end users: always render escaped (spec R-X2). */
  message: string
  created_at: number
  updated_at: number
  is_from_user: boolean
  is_from_admin: boolean
  user: TicketUserBrief | null
}

export interface TicketDetail extends TicketListItem {
  messages: TicketMessage[]
}

/** Whitelisted filter columns (ids are used as raw column names, spec R-T6). */
export type TicketFilter =
  | { id: 'status' | 'level' | 'reply_status' | 'id' | 'user_id'; value: number[] }
  | { id: 'subject'; value: string }

export interface TicketSort {
  id: 'id' | 'level' | 'status' | 'reply_status' | 'updated_at' | 'created_at'
  desc: boolean
}

export interface TicketListParams {
  current: number
  pageSize: number
  filter?: TicketFilter[]
  sort?: TicketSort[]
  /** Exact user email; omitted when empty (an empty key would match nothing, spec R-T7). */
  email?: string
}

/**
 * GET /ticket/fetch (route is `any`) -> raw `{ data, total }`. GET keeps list/polling reads
 * out of the admin audit log; filters are serialized in PHP bracket style. Arrays -> whereIn,
 * strings -> LIKE %v%; the backend always appends `updated_at DESC`.
 */
export function fetchTickets(params: TicketListParams, opts: { silent?: boolean } = {}) {
  const query: Query = { current: params.current, pageSize: params.pageSize }
  if (params.filter?.length) query.filter = params.filter.map((f) => ({ id: f.id, value: f.value }))
  if (params.sort?.length) query.sort = params.sort.map((s) => ({ id: s.id, desc: s.desc ? 1 : 0 }))
  const email = params.email?.trim()
  if (email) query.email = email
  return http.get<{ data: TicketListItem[]; total: number }>('/ticket/fetch', query, opts)
}

/** GET /ticket/fetch?id= -> success envelope with messages; 400 "工单不存在". */
export function fetchTicketDetail(id: number, opts: { silent?: boolean } = {}) {
  return http.get<TicketDetail>('/ticket/fetch', { id }, opts)
}

/** Appends an admin message; keeps `status` (closed tickets stay closed). Emails the user (30 min throttle). */
export function replyTicket(id: number, message: string) {
  return http.post<boolean>('/ticket/reply', { id, message })
}

/** Closes the ticket; there is no reopen API. */
export function closeTicket(id: number) {
  return http.post<boolean>('/ticket/close', { id })
}
