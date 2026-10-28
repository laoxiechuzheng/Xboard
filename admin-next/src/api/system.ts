// System / Horizon / audit log endpoints (SystemController). Spec platform §6.
import { http } from '@/api/http'

interface Opts {
  silent?: boolean
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ---------------------------------------------------------------- status

export interface SystemStatus {
  /** Scheduler heartbeat within the last 120 seconds. */
  schedule: boolean
  /** A Horizon master exists and none is paused. */
  horizon: boolean
  /** Last scheduler heartbeat (unix seconds); the backend returns it as a string. */
  schedule_last_runtime: number | null
}

export async function getSystemStatus(opts: Opts = {}): Promise<SystemStatus> {
  const d = await http.get<Record<string, unknown>>('/system/getSystemStatus', undefined, opts)
  const last = d?.schedule_last_runtime
  return {
    schedule: !!d?.schedule,
    horizon: !!d?.horizon,
    schedule_last_runtime: last === null || last === undefined || last === '' ? null : num(last),
  }
}

// ---------------------------------------------------------------- queue stats

export interface QueueStats {
  status: boolean
  failedJobs: number
  recentJobs: number
  jobsPerMinute: number
  processes: number
  pausedMasters: number
  /** Trim windows in minutes (recent = 60, failed = 10080). */
  periods: { failedJobs: number; recentJobs: number }
  /** Horizon 5 returns a queue name or null (older builds may return an object). */
  queueWithMaxRuntime: string | null
  queueWithMaxThroughput: string | null
  /** `{ "redis:default": seconds }` — only the longest wait; `[]` when there is no queue. */
  wait: Record<string, number>
}

/** Queue name from `queueWithMax*`, tolerating the object shape the official UI expected. */
function queueName(v: unknown): string | null {
  if (typeof v === 'string') return v || null
  if (v && typeof v === 'object' && 'name' in v) {
    const n = (v as { name?: unknown }).name
    return typeof n === 'string' && n ? n : null
  }
  return null
}

export async function getQueueStats(opts: Opts = {}): Promise<QueueStats> {
  const d = await http.get<Record<string, any>>('/system/getQueueStats', undefined, opts)
  const wait: Record<string, number> = {}
  if (d?.wait && typeof d.wait === 'object' && !Array.isArray(d.wait)) {
    for (const [k, v] of Object.entries(d.wait)) wait[k] = num(v)
  }
  return {
    status: !!d?.status,
    failedJobs: num(d?.failedJobs),
    recentJobs: num(d?.recentJobs),
    jobsPerMinute: num(d?.jobsPerMinute),
    processes: num(d?.processes),
    pausedMasters: num(d?.pausedMasters),
    periods: { failedJobs: num(d?.periods?.failedJobs), recentJobs: num(d?.periods?.recentJobs) },
    queueWithMaxRuntime: queueName(d?.queueWithMaxRuntime),
    queueWithMaxThroughput: queueName(d?.queueWithMaxThroughput),
    wait,
  }
}

/** Longest current wait: `{ seconds, queue }` from the `wait` map (key "connection:queue"). */
export function longestWait(wait: Record<string, number>): { seconds: number; queue: string | null } {
  const entry = Object.entries(wait)[0]
  if (!entry) return { seconds: 0, queue: null }
  const [key, seconds] = entry
  return { seconds, queue: key.includes(':') ? key.slice(key.indexOf(':') + 1) : key }
}

/** Minutes → "45 分钟" / "1 小时" / "7 天". */
export function formatMinutes(min: number): string {
  if (!min || min <= 0) return '—'
  if (min < 60) return `${min} 分钟`
  if (min % 1440 === 0) return `${min / 1440} 天`
  const h = min / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} 小时`
}

// ---------------------------------------------------------------- workload

export interface QueueWorkloadItem {
  name: string
  length: number
  wait: number
  processes: number
  split_queues: { name: string; length: number; wait: number }[] | null
}

export async function getQueueWorkload(opts: Opts = {}): Promise<QueueWorkloadItem[]> {
  const d = await http.get<unknown>('/system/getQueueWorkload', undefined, opts)
  if (!Array.isArray(d)) return []
  return d.map((it: Record<string, any>) => ({
    name: String(it.name ?? ''),
    length: num(it.length),
    wait: num(it.wait),
    processes: num(it.processes),
    split_queues: Array.isArray(it.split_queues)
      ? it.split_queues.map((s: Record<string, unknown>) => ({
          name: String(s.name ?? ''),
          length: num(s.length),
          wait: num(s.wait),
        }))
      : null,
  }))
}

// ---------------------------------------------------------------- masters

export interface HorizonSupervisor {
  name: string
  master?: string
  pid?: string | number
  status?: string
  processes?: Record<string, number>
  options?: {
    queue?: string
    balance?: string
    connection?: string
    maxProcesses?: string | number
    minProcesses?: string | number
    timeout?: string | number
    maxTries?: string | number
    [k: string]: unknown
  }
}

export interface HorizonMaster {
  name: string
  environment?: string
  pid?: string | number
  status?: string
  supervisors: HorizonSupervisor[]
}

/**
 * GET system/getQueueMasters — Horizon's own MasterSupervisorController (no envelope).
 * Shape: `{ "<master>": { name, environment, pid, status, supervisors: [...] } }`, `[]` when empty.
 * Note: the controller carries Horizon's viewHorizon authorization, so production returns 403.
 */
export async function getQueueMasters(opts: Opts = {}): Promise<HorizonMaster[]> {
  const d = await http.get<unknown>('/system/getQueueMasters', undefined, opts)
  const list = Array.isArray(d) ? d : d && typeof d === 'object' ? Object.values(d) : []
  return list
    .filter((m): m is Record<string, any> => !!m && typeof m === 'object')
    .map((m) => ({
      name: String(m.name ?? ''),
      environment: m.environment,
      pid: m.pid,
      status: m.status,
      supervisors: (Array.isArray(m.supervisors) ? m.supervisors : Object.values(m.supervisors ?? {}))
        .map((s: unknown) => (typeof s === 'string' ? { name: s } : (s as HorizonSupervisor)))
        .filter((s: HorizonSupervisor) => !!s && typeof s.name === 'string'),
    }))
}

// ---------------------------------------------------------------- failed jobs

export interface FailedJob {
  id: string
  connection: string
  queue: string
  name: string
  status?: string
  /** JSON string. */
  payload: string
  exception: string
  context?: string | null
  /** Seconds with fraction as a string, e.g. "1730000000.1234". */
  failed_at: string | number
  [k: string]: unknown
}

export interface FailedJobPage {
  data: FailedJob[]
  total: number
  current: number
  page_size: number
}

/** Horizon's getFailed() only returns the newest 50 records, whatever `total` says. */
export const FAILED_JOBS_VISIBLE_LIMIT = 50

export async function getHorizonFailedJobs(
  params: { current: number; page_size: number },
  opts: Opts = {},
): Promise<FailedJobPage> {
  const res = await http.get<Partial<FailedJobPage>>(
    '/system/getHorizonFailedJobs',
    { current: params.current, page_size: Math.max(10, params.page_size) },
    opts,
  )
  return {
    data: Array.isArray(res?.data) ? res.data : [],
    total: num(res?.total),
    current: num(res?.current) || params.current,
    page_size: num(res?.page_size) || params.page_size,
  }
}

// ---------------------------------------------------------------- audit log

export interface AuditLog {
  id: number
  admin_id: number
  action: string
  method: string
  /** Full request URI including /api/v2/{secure_path}. */
  uri: string
  /** JSON string of the request body (top-level secrets removed by the backend). */
  request_data: string | null
  ip: string | null
  created_at: number
  updated_at: number
  admin: { id: number; email: string } | null
}

export interface AuditLogQuery {
  current: number
  page_size: number
  action?: string | null
  admin_id?: number | null
  keyword?: string | null
}

/**
 * GET system/getAuditLog (route is `any`; POST would log the query itself).
 * Empty filters are omitted. Response `{ data, total }`, ordered by id desc.
 */
export async function getAuditLog(q: AuditLogQuery): Promise<{ data: AuditLog[]; total: number }> {
  const params: Record<string, string | number> = { current: q.current, page_size: Math.max(10, q.page_size) }
  if (q.action) params.action = q.action
  if (q.admin_id) params.admin_id = q.admin_id
  const kw = q.keyword?.trim()
  if (kw) params.keyword = kw
  const res = await http.get<{ data?: AuditLog[]; total?: number }>('/system/getAuditLog', params)
  return { data: Array.isArray(res?.data) ? res.data : [], total: num(res?.total) }
}

/** Strip the `/api/v2/{secure_path}` prefix so the admin path is never shown in the UI. */
export function stripAdminPrefix(uri: string): string {
  return (uri || '').replace(/^\/?api\/v[12]\/[^/?#]+/, '') || '/'
}
