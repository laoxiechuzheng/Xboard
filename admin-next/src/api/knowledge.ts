// Knowledge base APIs (spec content.md §4).
import { http } from '@/api/http'

/** List rows only carry these columns (no language/body), ordered by `sort ASC`. */
export interface KnowledgeListItem {
  id: number
  title: string
  category: string
  show: boolean
  updated_at: number
}

export interface Knowledge extends KnowledgeListItem {
  /** char(5) locale code such as zh-CN. */
  language: string
  /** Markdown/HTML; supports {{subscribeUrl}} placeholders and <!--access start--> blocks. */
  body: string
  sort: number | null
  created_at: number
}

export interface KnowledgeSavePayload {
  id: number | null
  language: string
  category: string
  title: string
  body: string
  show: boolean
}

interface ReqOpts {
  silent?: boolean
}

export function fetchKnowledgeList() {
  return http.get<KnowledgeListItem[]>('/knowledge/fetch')
}

/** Full record. Unknown ids answer HTTP 500 (spec R-K4), so callers pass `silent` and explain. */
export function fetchKnowledge(id: number, opts: ReqOpts = {}) {
  return http.get<Knowledge>('/knowledge/fetch', { id }, opts)
}

/** Distinct category names across all languages (including hidden articles). */
export function fetchKnowledgeCategories(opts: ReqOpts = {}) {
  return http.get<string[]>('/knowledge/getCategory', undefined, opts)
}

/** Updating a deleted id answers a generic HTTP 500 (spec R-K4), so callers may pass `silent`. */
export function saveKnowledge(payload: KnowledgeSavePayload, opts: ReqOpts = {}) {
  return http.post<boolean>('/knowledge/save', payload, opts)
}

/** Toggles `show` server-side (no target value). */
export function toggleKnowledgeShow(id: number) {
  return http.post<boolean>('/knowledge/show', { id })
}

/** Hard delete. */
export function dropKnowledge(id: number) {
  return http.post<boolean>('/knowledge/drop', { id })
}

/** Writes `sort = index + 1` without touching updated_at; the order is global (all languages). */
export function sortKnowledge(ids: number[]) {
  return http.post<boolean>('/knowledge/sort', { ids })
}

/** v2_knowledge.language is char(5): only these codes (spec §4.4). */
export const KNOWLEDGE_LANGUAGES: { value: string; label: string }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'vi-VN', label: 'Tiếng Việt' },
  { value: 'ru-RU', label: 'Русский' },
]
