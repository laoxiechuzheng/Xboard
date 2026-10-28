// Node (v2_server) management API: /server/manage/* plus the lookups the node page needs.
import { http } from '@/api/http'

export type NodeType =
  | 'shadowsocks'
  | 'vmess'
  | 'trojan'
  | 'hysteria'
  | 'vless'
  | 'tuic'
  | 'socks'
  | 'naive'
  | 'http'
  | 'mieru'
  | 'anytls'

export interface RateTimeRange {
  start: string
  end: string
  rate: number | string
}

export interface UsagePair {
  total?: number
  used?: number
}

/** Reported by the node process (cache SERVER_{TYPE}_LOAD_STATUS). */
export interface NodeLoadStatus {
  cpu?: number
  mem?: UsagePair
  swap?: UsagePair
  disk?: UsagePair
  updated_at?: number
  kernel_status?: boolean
}

/** Reported by the node process (cache SERVER_{TYPE}_METRICS); shape is decided by the node side. */
export interface NodeMetrics {
  uptime?: number
  goroutines?: number
  active_connections?: number
  total_connections?: number
  total_users?: number
  active_users?: number
  inbound_speed?: number
  outbound_speed?: number
  cpu_per_core?: number[]
  load?: { load1?: number; load5?: number; load15?: number }
  speed_limiter?: { has_limits?: boolean; limited_users?: number }
  gc?: { last_pause_ms?: number }
  api?: { success?: number; failure?: number }
  ws?: { enabled?: boolean; connected?: boolean }
  limits?: { device_limit_events?: number }
  updated_at?: number
  kernel_status?: boolean
}

export type CertMode = 'none' | 'http' | 'dns' | 'self' | 'content'

export interface CertConfig {
  cert_mode?: CertMode | string
  domain?: string
  email?: string
  http_port?: number | null
  dns_provider?: string
  dns_env?: Record<string, string>
  cert_content?: string
  key_content?: string
  [key: string]: unknown
}

export interface ServerNode {
  id: number
  type: NodeType
  code: string | null
  parent_id: number | null
  machine_id: number | null
  group_ids: (string | number)[] | null
  route_ids: (string | number)[] | null
  name: string
  rate: number | string
  rate_time_enable: boolean
  rate_time_ranges: RateTimeRange[] | null
  transfer_enable: number | null
  u: number
  d: number
  tags: string[] | null
  host: string
  port: string | number
  server_port: number | string
  protocol_settings: Record<string, unknown> | null
  custom_outbounds: unknown[] | null
  custom_routes: unknown[] | null
  cert_config: CertConfig | null
  show: boolean | number
  enabled: boolean | null
  sort: number | null
  created_at: number
  updated_at: number
  // computed by getNodes
  last_check_at: number | null
  last_push_at: number | null
  online: number
  is_online: 0 | 1
  available_status: 0 | 1 | 2
  cache_key: string
  load_status: NodeLoadStatus | null
  metrics: NodeMetrics | null
  online_conn: number
  groups: { id: number; name: string }[]
  parent: Omit<ServerNode, 'groups' | 'parent'> | null
}

export interface MachineLoadStatus {
  cpu?: number
  mem?: UsagePair
  swap?: UsagePair
  disk?: UsagePair
  updated_at?: number
  net?: { in_speed?: number; out_speed?: number }
}

export interface MachineBrief {
  id: number
  name: string
  notes: string | null
  is_active: boolean
  last_seen_at: number | null
  load_status: MachineLoadStatus | null
  servers_count: number
  created_at: number
  updated_at: number
}

/** Body of POST /server/manage/save (only keys the backend validates). */
export interface NodeSavePayload {
  id?: number
  type: NodeType
  name: string
  code: string | null
  show?: boolean
  rate: number
  rate_time_enable: boolean
  rate_time_ranges: { start: string; end: string; rate: number }[]
  transfer_enable: number
  tags: string[]
  group_ids: string[]
  route_ids: string[]
  host: string
  port: string
  server_port: number
  parent_id: number
  machine_id: number | null
  enabled: boolean | null
  custom_outbounds: unknown[]
  custom_routes: unknown[]
  cert_config?: CertConfig | null
  protocol_settings: Record<string, unknown>
}

export interface NodeQuickUpdate {
  id: number
  show?: 0 | 1
  /** Present key = update; null/0 unbinds. Omit the key to leave it unchanged. */
  machine_id?: number | null
  enabled?: boolean
}

export interface NodeBatchUpdate {
  ids: number[]
  show?: 0 | 1
  enabled?: boolean
  machine_id?: number | null
}

const silentOpt = (silent?: boolean) => (silent ? { silent: true } : {})

/** GET /server/manage/getNodes -> success envelope, all nodes ordered by sort. */
export function fetchNodes(silent = false) {
  return http.get<ServerNode[]>('/server/manage/getNodes', undefined, silentOpt(silent))
}

export function saveNode(payload: NodeSavePayload) {
  return http.post<boolean>('/server/manage/save', payload)
}

export function updateNode(payload: NodeQuickUpdate) {
  return http.post<boolean>('/server/manage/update', payload)
}

export function dropNode(id: number) {
  return http.post<boolean>('/server/manage/drop', { id })
}

export function copyNode(id: number) {
  return http.post<boolean>('/server/manage/copy', { id })
}

/** Body is a bare array of every node in the new order (order starts at 1). */
export function sortNodes(items: { id: number; order: number }[]) {
  return http.post<boolean>('/server/manage/sort', items)
}

export function batchDeleteNodes(ids: number[]) {
  return http.post<boolean>('/server/manage/batchDelete', { ids })
}

export function batchUpdateNodes(payload: NodeBatchUpdate) {
  return http.post<boolean>('/server/manage/batchUpdate', payload)
}

export function resetNodeTraffic(id: number) {
  return http.post<boolean>('/server/manage/resetTraffic', { id })
}

export function batchResetNodeTraffic(ids: number[]) {
  return http.post<boolean>('/server/manage/batchResetTraffic', { ids })
}

/** GET /server/manage/generateEchKey -> { key, config } PEM strings. */
export function generateEchKey(publicName?: string) {
  return http.get<{ key: string; config: string }>(
    '/server/manage/generateEchKey',
    publicName ? { public_name: publicName } : undefined,
  )
}

/** GET /server/machine/fetch -> success envelope, machines ordered by id. */
export function fetchMachines(silent = false) {
  return http.get<MachineBrief[]>('/server/machine/fetch', undefined, silentOpt(silent))
}

/** POST /server/group/save (create only, used by the node form's quick "add group"). */
export function createServerGroup(name: string) {
  return http.post<boolean>('/server/group/save', { name })
}
