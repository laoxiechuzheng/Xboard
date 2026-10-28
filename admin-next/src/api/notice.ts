// Notice management APIs (spec content.md §3).
import { http } from '@/api/http'

export interface Notice {
  id: number
  /** NULL until a sort is saved; NULL sorts first, so new notices appear on top. */
  sort: number | null
  title: string
  /** Markdown (HTML allowed) rendered by the user frontend. */
  content: string
  show: boolean
  img_url: string | null
  tags: string[] | null
  created_at: number
  updated_at: number
}

/**
 * POST /notice/save body. Never send `popup`: v2_notice has no such column (spec R-N1);
 * `id` null creates, otherwise updates.
 */
export interface NoticeSavePayload {
  id: number | null
  title: string
  content: string
  /** Empty string is converted to null by the backend middleware. */
  img_url: string | null
  tags: string[]
  show: boolean
}

interface ReqOpts {
  silent?: boolean
}

/** All notices ordered by `sort ASC, id DESC`. */
export function fetchNotices() {
  return http.get<Notice[]>('/notice/fetch')
}

/** Updating a deleted id answers a generic HTTP 500 (spec R-K4), so callers may pass `silent`. */
export function saveNotice(payload: NoticeSavePayload, opts: ReqOpts = {}) {
  return http.post<boolean>('/notice/save', payload, opts)
}

/** Toggles `show` server-side (no target value). */
export function toggleNoticeShow(id: number) {
  return http.post<boolean>('/notice/show', { id })
}

/** Hard delete. */
export function dropNotice(id: number) {
  return http.post<boolean>('/notice/drop', { id })
}

/** Writes `sort = index + 1` for every id; any unknown id rolls back the whole batch. */
export function sortNotices(ids: number[]) {
  return http.post<boolean>('/notice/sort', { ids })
}

/** Tag that makes the default user theme pop the notice up after login. */
export const POPUP_TAG = '弹窗'
