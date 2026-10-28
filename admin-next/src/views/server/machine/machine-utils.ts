// Machine status / load helpers (spec nodes §5.2) and node type badges used by the machine pages.
import type { Machine, MachineLoadStatus, UsagePair } from '@/api/machine'

export type MachineStatus = 'online' | 'offline' | 'inactive' | 'never'

/** Heartbeat younger than 5 minutes counts as online. */
export const ONLINE_WINDOW = 300

export function machineStatus(m: Pick<Machine, 'is_active' | 'last_seen_at'>, now: number): MachineStatus {
  if (!m.is_active) return 'inactive'
  if (!m.last_seen_at) return 'never'
  return now - m.last_seen_at < ONLINE_WINDOW ? 'online' : 'offline'
}

export const STATUS_META: Record<
  MachineStatus,
  { label: string; tagType: 'success' | 'error' | 'default' | 'warning'; dot: string }
> = {
  online: { label: '在线', tagType: 'success', dot: 'var(--success-color)' },
  offline: { label: '离线', tagType: 'error', dot: 'var(--error-color)' },
  inactive: { label: '已禁用', tagType: 'default', dot: 'var(--text-muted)' },
  never: { label: '从未上报', tagType: 'warning', dot: 'var(--text-muted)' },
}

export function usagePercent(p: UsagePair | null | undefined): number {
  if (!p || !p.total || p.total <= 0) return 0
  return Math.min(100, Math.max(0, (p.used / p.total) * 100))
}

export interface LoadPercents {
  cpu: number
  mem: number
  disk: number
}

export function loadPercents(ls: MachineLoadStatus | null | undefined): LoadPercents {
  if (!ls) return { cpu: 0, mem: 0, disk: 0 }
  return {
    cpu: Math.min(100, Math.max(0, Number(ls.cpu) || 0)),
    mem: usagePercent(ls.mem),
    disk: usagePercent(ls.disk),
  }
}

export type LoadMetric = keyof LoadPercents
export type LoadLevel = 'ok' | 'warn' | 'danger'

const THRESHOLDS: Record<LoadMetric, { warn: number; danger: number }> = {
  cpu: { warn: 70, danger: 85 },
  mem: { warn: 75, danger: 90 },
  disk: { warn: 80, danger: 90 },
}

export function loadLevel(metric: LoadMetric, value: number): LoadLevel {
  const t = THRESHOLDS[metric]
  if (value >= t.danger) return 'danger'
  if (value >= t.warn) return 'warn'
  return 'ok'
}

/** NProgress status for a load level. */
export function levelStatus(level: LoadLevel): 'default' | 'warning' | 'error' {
  return level === 'danger' ? 'error' : level === 'warn' ? 'warning' : 'default'
}

export function levelColor(level: LoadLevel): string {
  return level === 'danger' ? 'var(--error-color)' : level === 'warn' ? 'var(--warning-color)' : 'var(--success-color)'
}

/** High load = has data and any metric at its danger threshold. */
export function isHighLoad(ls: MachineLoadStatus | null | undefined): boolean {
  if (!ls) return false
  const p = loadPercents(ls)
  return p.cpu >= THRESHOLDS.cpu.danger || p.mem >= THRESHOLDS.mem.danger || p.disk >= THRESHOLDS.disk.danger
}

/** bytes/s -> "1.2 MB/s" */
export function formatSpeed(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(Number(v)) || Number(v) < 0) return '-'
  const n = Number(v)
  if (n < 1024) return `${n.toFixed(0)} B/s`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB/s`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB/s`
  return `${(n / 1024 ** 3).toFixed(2)} GB/s`
}

/** Compact relative time: "12 秒前" / "3 分钟前" / "2 小时前" / "5 天前". */
export function relativeAgo(ts: number | null | undefined, now: number): string {
  if (!ts) return '-'
  const d = Math.max(0, now - Number(ts))
  if (d < 60) return `${d} 秒前`
  if (d < 3600) return `${Math.floor(d / 60)} 分钟前`
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前`
  return `${Math.floor(d / 86400)} 天前`
}

// ---- node type badges (spec nodes §0.3) ----

const NODE_TYPES: Record<string, { label: string; color: string }> = {
  shadowsocks: { label: 'Shadowsocks', color: '#489851' },
  vmess: { label: 'VMess', color: '#CB3180' },
  trojan: { label: 'Trojan', color: '#EBB749' },
  hysteria: { label: 'Hysteria', color: '#5684e6' },
  vless: { label: 'VLess', color: '#1a1a1a' },
  tuic: { label: 'TUIC', color: '#00C853' },
  socks: { label: 'SOCKS', color: '#2196F3' },
  naive: { label: 'Naive', color: '#9C27B0' },
  http: { label: 'HTTP', color: '#FF5722' },
  mieru: { label: 'Mieru', color: '#4CAF50' },
  anytls: { label: 'AnyTLS', color: '#7E57C2' },
}

export function nodeTypeLabel(type: string): string {
  return NODE_TYPES[type]?.label ?? type
}

/** VLess is near-black officially; lighten it in dark mode so the badge stays visible. */
export function nodeTypeColor(type: string, dark: boolean): string {
  if (type === 'vless' && dark) return '#d4d4d8'
  return NODE_TYPES[type]?.color ?? '#94a3b8'
}

/** NTag `color` prop for an outlined type badge. */
export function nodeTypeTagColor(type: string, dark: boolean) {
  const c = nodeTypeColor(type, dark)
  return { color: 'transparent', textColor: c, borderColor: c }
}
