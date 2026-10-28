// Permission groups (权限组) — /server/group/*.
import { http } from '@/api/http'

export interface ServerGroup {
  id: number
  name: string
  created_at: number
  updated_at: number
  /** v2_user.group_id count */
  users_count: number
  /** nodes whose group_ids contain String(id) */
  server_count: number
}

/** Sorted by id desc. */
export async function fetchGroups(opts: { silent?: boolean } = {}) {
  const list = await http.get<ServerGroup[]>('/server/group/fetch', undefined, opts)
  return list ?? []
}

/** Create when `id` is absent. Backend only checks that name is non-empty. */
export function saveGroup(body: { id?: number; name: string }) {
  return http.post<boolean>('/server/group/save', body)
}

/**
 * The backend checks node usage with whereJsonContains('group_ids', <raw id>) while node group_ids are
 * stored as strings, so the id must be sent as a string or the "used by nodes" guard is skipped on MySQL.
 */
export function dropGroup(id: number) {
  return http.post<boolean>('/server/group/drop', { id: String(id) })
}
