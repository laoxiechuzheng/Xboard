// Server machines (UI name: 服务器) — /server/machine/* plus the node toggles used by the detail drawer.
import { http } from '@/api/http'
import { fetchNodeOptions, type NodeBrief } from '@/api/common'

export interface UsagePair {
  total: number
  used: number
}

/** Reported by xboard-node (app/Http/Controllers/V2/Server/MachineController.php). Bytes / bytes per second. */
export interface MachineLoadStatus {
  cpu: number
  mem?: UsagePair | null
  swap?: UsagePair | null
  disk?: UsagePair | null
  updated_at?: number | null
  net?: { in_speed: number; out_speed: number } | null
}

export interface Machine {
  id: number
  name: string
  notes: string | null
  is_active: boolean
  last_seen_at: number | null
  load_status: MachineLoadStatus | null
  /** All nodes bound to the machine, enabled or not. */
  servers_count: number
  created_at: number
  updated_at: number
}

export interface MachineSaveBody {
  id?: number
  name: string
  notes: string | null
  is_active: boolean
}

/** `save` without id returns the generated credentials; with id it returns `true`. */
export interface MachineCreated {
  id: number
  token: string
  install_command: string
}

export interface MachineNode {
  id: number
  name: string
  type: string
  host: string
  port: string | number
  show: boolean | number
  enabled: boolean | number | null
  sort: number | null
}

export interface MachineHistoryPoint {
  cpu: number
  mem_total: number
  mem_used: number
  disk_total: number
  disk_used: number
  net_in_speed: number | null
  net_out_speed: number | null
  recorded_at: number
}

export function fetchMachines(opts: { silent?: boolean } = {}) {
  return http.get<Machine[]>('/server/machine/fetch', undefined, opts)
}

export function createMachine(body: Omit<MachineSaveBody, 'id'>) {
  return http.post<MachineCreated>('/server/machine/save', body)
}

export function updateMachine(body: MachineSaveBody & { id: number }) {
  return http.post<boolean>('/server/machine/save', body)
}

/** Detaches all bound nodes (machine_id -> null) before deleting; nodes themselves are kept. */
export function dropMachine(id: number) {
  return http.post<boolean>('/server/machine/drop', { id })
}

export function getMachineToken(id: number) {
  return http.get<{ token: string }>('/server/machine/getToken', { id })
}

/** The old token stops working immediately. */
export function resetMachineToken(id: number) {
  return http.post<{ token: string }>('/server/machine/resetToken', { id })
}

export function getMachineInstallCommand(id: number) {
  return http.get<{ command: string }>('/server/machine/installCommand', { id })
}

export function fetchMachineNodes(machineId: number) {
  return http.get<MachineNode[]>('/server/machine/nodes', { machine_id: machineId })
}

/** Ascending by recorded_at. limit 10..1440, range_hours 1..24. */
export function fetchMachineHistory(machineId: number, limit: number, rangeHours: number, opts: { silent?: boolean } = {}) {
  return http.get<MachineHistoryPoint[]>(
    '/server/machine/history',
    { machine_id: machineId, limit, range_hours: rangeHours },
    opts,
  )
}

// ---- node operations used from the machine detail drawer (server/manage/*) ----
// `update`/`batchUpdate` decide by key presence: never send `machine_id` unless (un)binding.

export function setMachineNodeEnabled(id: number, enabled: boolean) {
  return http.post<boolean>('/server/manage/update', { id, enabled })
}

/** Unbind and disable, like the official admin. */
export function unbindMachineNode(id: number) {
  return http.post<boolean>('/server/manage/update', { id, machine_id: null, enabled: false })
}

export function bindNodesToMachine(ids: number[], machineId: number) {
  return http.post<boolean>('/server/manage/batchUpdate', { ids, machine_id: machineId, enabled: true })
}

/** Nodes not bound to any machine (machine_id null/0). */
export async function fetchUnboundNodes(): Promise<NodeBrief[]> {
  const nodes = await fetchNodeOptions()
  return (nodes ?? []).filter((n) => !Number(n.machine_id))
}
