// Cross-module lookups (selects, name maps). Module-specific CRUD lives in api/<module>.ts.
import { http } from '@/api/http'

export interface PlanBrief {
  id: number
  name: string
  group_id: number | null
  show: boolean | number
  sell: boolean | number
  renew: boolean | number
  prices: Record<string, number | null> | null
  [key: string]: unknown
}

export interface ServerGroupBrief {
  id: number
  name: string
  users_count?: number
  server_count?: number
}

export interface ServerRouteBrief {
  id: number
  remarks: string
  match: string[]
  action: 'block' | 'direct' | 'dns' | 'proxy'
  action_value: string | null
}

export interface NodeBrief {
  id: number
  type: string
  name: string
  code?: string | null
  host: string
  port: string | number
  parent_id: number | null
  group_ids: (number | string)[] | null
  show: boolean | number
  [key: string]: unknown
}

/** GET /plan/fetch -> success envelope, array sorted by `sort`. */
export function fetchPlanOptions() {
  return http.get<PlanBrief[]>('/plan/fetch')
}

/** GET /server/group/fetch -> success envelope, array. */
export function fetchServerGroups() {
  return http.get<ServerGroupBrief[]>('/server/group/fetch')
}

/** GET /server/route/fetch -> raw `{ data: [...] }` (no status envelope). */
export async function fetchServerRoutes() {
  const res = await http.get<{ data: ServerRouteBrief[] }>('/server/route/fetch')
  return res.data ?? []
}

/** GET /server/manage/getNodes -> success envelope, all nodes with `groups` and `parent`. */
export function fetchNodeOptions() {
  return http.get<NodeBrief[]>('/server/manage/getNodes')
}

export function toOptions<T extends { id: number }>(items: T[], label: (x: T) => string) {
  return items.map((x) => ({ label: label(x), value: x.id }))
}
