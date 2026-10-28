// Node page constants and small display helpers (types, colors, statuses, formatters).
import type { MachineBrief, NodeType, ServerNode } from '@/api/node'

/** Order of the official type dropdown. */
export const NODE_TYPES: NodeType[] = [
  'shadowsocks',
  'vmess',
  'trojan',
  'hysteria',
  'vless',
  'tuic',
  'socks',
  'naive',
  'http',
  'mieru',
  'anytls',
]

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  shadowsocks: 'Shadowsocks',
  vmess: 'VMess',
  trojan: 'Trojan',
  hysteria: 'Hysteria',
  vless: 'VLess',
  tuic: 'TUIC',
  socks: 'SOCKS',
  naive: 'Naive',
  http: 'HTTP',
  mieru: 'Mieru',
  anytls: 'AnyTLS',
}

const NODE_TYPE_COLORS: Record<NodeType, string> = {
  shadowsocks: '#489851',
  vmess: '#CB3180',
  trojan: '#EBB749',
  hysteria: '#5684e6',
  vless: '#1a1a1a',
  tuic: '#00C853',
  socks: '#2196F3',
  naive: '#9C27B0',
  http: '#FF5722',
  mieru: '#4CAF50',
  anytls: '#7E57C2',
}

/** Official type color; VLess is near-black, so it is lightened in dark mode to stay visible. */
export function typeColor(type: string, dark = false): string {
  if (type === 'vless' && dark) return '#c9ccd6'
  return NODE_TYPE_COLORS[type as NodeType] ?? '#888888'
}

export function typeLabel(type: string): string {
  return NODE_TYPE_LABELS[type as NodeType] ?? type
}

export const typeOptions = NODE_TYPES.map((t) => ({ label: NODE_TYPE_LABELS[t], value: t }))

/** Types whose advanced dialog has the TLS certificate tab (socks added: backend supports TLS). */
export const CERT_TYPES: NodeType[] = ['vmess', 'vless', 'trojan', 'hysteria', 'tuic', 'anytls', 'http', 'naive', 'socks']
export const MULTIPLEX_TYPES: NodeType[] = ['vmess', 'vless', 'trojan']

export const STANDALONE = '__standalone__'

// ---- status ----

export const NODE_STATUS: Record<0 | 1 | 2, { label: string; color: string; type: 'error' | 'warning' | 'success' }> = {
  0: { label: '未运行', color: 'var(--error-color)', type: 'error' },
  1: { label: '无人使用或异常', color: 'var(--warning-color)', type: 'warning' },
  2: { label: '运行正常', color: 'var(--success-color)', type: 'success' },
}

export type MachineStatus = 'online' | 'offline' | 'inactive' | 'never'

export function machineStatus(m: Pick<MachineBrief, 'is_active' | 'last_seen_at'>): MachineStatus {
  if (!m.is_active) return 'inactive'
  if (!m.last_seen_at) return 'never'
  return Math.floor(Date.now() / 1000) - m.last_seen_at < 300 ? 'online' : 'offline'
}

export const MACHINE_STATUS_META: Record<MachineStatus, { label: string; color: string; tag: 'success' | 'error' | 'default' }> = {
  online: { label: '服务器在线', color: 'var(--success-color)', tag: 'success' },
  offline: { label: '服务器离线', color: 'var(--error-color)', tag: 'error' },
  never: { label: '服务器离线', color: 'var(--error-color)', tag: 'error' },
  inactive: { label: '服务器未激活', color: 'var(--text-muted)', tag: 'default' },
}

// ---- formatting ----

export function formatUptime(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec < 0) return '-'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function formatSpeed(bytesPerSec: number | null | undefined): string {
  if (bytesPerSec === null || bytesPerSec === undefined || !Number.isFinite(bytesPerSec) || bytesPerSec < 0) return '-'
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
  if (bytesPerSec < 1024 ** 2) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  if (bytesPerSec < 1024 ** 3) return `${(bytesPerSec / 1024 ** 2).toFixed(1)} MB/s`
  return `${(bytesPerSec / 1024 ** 3).toFixed(2)} GB/s`
}

export function percent(used?: number, total?: number): number {
  return total && total > 0 ? Math.round(((used ?? 0) / total) * 100) : 0
}

export function levelColor(pct: number): string {
  if (pct >= 90) return 'var(--error-color)'
  if (pct >= 70) return 'var(--warning-color)'
  return 'var(--success-color)'
}

// ---- node helpers ----

export function nodeDisplayId(n: Pick<ServerNode, 'id' | 'code' | 'parent'>): string {
  const own = n.code || String(n.id)
  return n.parent ? `${own} → ${n.parent.code || n.parent.id}` : own
}

export function hasParent(n: Pick<ServerNode, 'parent_id'>): boolean {
  return !!n.parent_id && Number(n.parent_id) !== 0
}

export function portsDiffer(n: Pick<ServerNode, 'port' | 'server_port'>): boolean {
  return String(n.port ?? '') !== String(n.server_port ?? '')
}

export function trafficOf(n: Pick<ServerNode, 'u' | 'd' | 'transfer_enable'>) {
  const used = Number(n.u || 0) + Number(n.d || 0)
  const total = Number(n.transfer_enable || 0)
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  return { used, total, pct }
}

export function isShown(n: Pick<ServerNode, 'show'>): boolean {
  return n.show === true || n.show === 1
}
