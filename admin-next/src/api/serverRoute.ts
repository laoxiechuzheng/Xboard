// Route rules (路由) — /server/route/*. fetch/drop return `{ data }` without a status envelope.
import { http } from '@/api/http'

export type RouteAction = 'block' | 'direct' | 'dns' | 'proxy'

export interface ServerRoute {
  id: number
  remarks: string
  match: string[]
  action: RouteAction
  action_value: string | null
  created_at: number
  updated_at: number
}

export interface RouteSaveBody {
  id?: number
  remarks: string
  match: string[]
  action: RouteAction
  action_value: string | null
}

type RawRoute = Omit<ServerRoute, 'match'> & { match: string[] | Record<string, string> | null }

/** `array_filter` on save keeps keys, so old rows may hold `match` as an object; normalize to string[]. */
function normalizeMatch(match: RawRoute['match']): string[] {
  if (!match) return []
  const list = Array.isArray(match) ? match : Object.values(match)
  return list.map((x) => String(x ?? '')).filter((x) => x.trim() !== '')
}

export async function fetchRoutes(opts: { silent?: boolean } = {}): Promise<ServerRoute[]> {
  const res = await http.get<{ data: RawRoute[] }>('/server/route/fetch', undefined, opts)
  return (res?.data ?? []).map((r) => ({ ...r, match: normalizeMatch(r.match) }))
}

export function saveRoute(body: RouteSaveBody) {
  return http.post<boolean>('/server/route/save', body)
}

/** Deleting does not touch nodes: their route_ids keep the stale id. */
export function dropRoute(id: number) {
  return http.post<{ data: boolean }>('/server/route/drop', { id })
}

export interface RouteNodeRef {
  id: number
  name: string
  type: string
  route_ids: (string | number)[] | null
}

/** Map route id -> nodes referencing it (from server/manage/getNodes; route_ids are strings). */
export async function fetchRouteUsage(opts: { silent?: boolean } = { silent: true }): Promise<Map<number, RouteNodeRef[]>> {
  const nodes = await http.get<RouteNodeRef[]>('/server/manage/getNodes', undefined, opts)
  const usage = new Map<number, RouteNodeRef[]>()
  for (const n of nodes ?? []) {
    for (const rid of n.route_ids ?? []) {
      const key = Number(rid)
      if (!Number.isFinite(key)) continue
      const arr = usage.get(key) ?? []
      arr.push(n)
      usage.set(key, arr)
    }
  }
  return usage
}
