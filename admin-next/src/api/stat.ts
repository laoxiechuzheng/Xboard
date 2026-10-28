// Dashboard statistics (StatController). Money in cents, traffic in bytes.
// getStats / getOrder / getTrafficRank have no `status` envelope, so http returns the whole body.
import { http } from '@/api/http'

interface Opts {
  silent?: boolean
}

export interface TrafficTriple {
  upload: number
  download: number
  total: number
}

/** GET stat/getStats → body.data. Numbers may arrive as strings (SUM()), normalized here. */
export interface DashboardStats {
  todayIncome: number
  dayIncomeGrowth: number
  currentMonthIncome: number
  lastMonthIncome: number
  monthIncomeGrowth: number
  lastMonthIncomeGrowth: number
  currentMonthCommissionPayout: number
  lastMonthCommissionPayout: number
  /** Last month vs the month before (not current vs last). */
  commissionGrowth: number
  commissionPendingTotal: number
  currentMonthNewUsers: number
  totalUsers: number
  activeUsers: number
  userGrowth: number
  onlineUsers: number
  onlineDevices: number
  ticketPendingTotal: number
  onlineNodes: number
  todayTraffic: TrafficTriple
  monthTraffic: TrafficTriple
  totalTraffic: TrafficTriple
}

export interface OrderStatItem {
  date: string
  paid_total: number
  paid_count: number
  commission_total: number
  commission_count: number
  avg_order_amount: number
  avg_commission_amount: number
}

export interface OrderStatSummary {
  paid_total: number
  paid_count: number
  commission_total: number
  commission_count: number
  start_date: string
  end_date: string
  avg_paid_amount: number
  avg_commission_amount: number
  /** Percentage value, 2 decimals. */
  commission_rate: number
}

export interface OrderStat {
  list: OrderStatItem[]
  summary: OrderStatSummary
}

export type TrafficRankType = 'node' | 'user'

export interface TrafficRankItem {
  id: string
  /** Node name or user email; "Node {id}" / "User {id}" when missing. */
  name: string
  value: number
  previousValue: number
  /** Percent, 1 decimal; 0 when the previous period has no data. */
  change: number
  timestamp: string
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const triple = (v: unknown): TrafficTriple => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return { upload: num(o.upload), download: num(o.download), total: num(o.total) }
}

export async function getStats(opts: Opts = {}): Promise<DashboardStats> {
  const res = await http.get<{ data: Record<string, unknown> }>('/stat/getStats', undefined, opts)
  const d = res?.data ?? {}
  const out = {} as Record<string, unknown>
  for (const [k, v] of Object.entries(d)) {
    out[k] = v && typeof v === 'object' ? triple(v) : num(v)
  }
  for (const k of ['todayTraffic', 'monthTraffic', 'totalTraffic']) out[k] = triple(d[k])
  return out as unknown as DashboardStats
}

/** GET stat/getOrder?start_date&end_date (Y-m-d). List is ascending by date and not zero-filled. */
export async function getOrderStat(
  params: { start_date: string; end_date: string },
  opts: Opts = {},
): Promise<OrderStat> {
  const res = await http.get<{ data: OrderStat }>('/stat/getOrder', params, opts)
  const data = res?.data
  const s = (data?.summary ?? {}) as Partial<OrderStatSummary>
  return {
    list: (data?.list ?? []).map((it) => ({
      date: String(it.date),
      paid_total: num(it.paid_total),
      paid_count: num(it.paid_count),
      commission_total: num(it.commission_total),
      commission_count: num(it.commission_count),
      avg_order_amount: num(it.avg_order_amount),
      avg_commission_amount: num(it.avg_commission_amount),
    })),
    summary: {
      paid_total: num(s.paid_total),
      paid_count: num(s.paid_count),
      commission_total: num(s.commission_total),
      commission_count: num(s.commission_count),
      start_date: s.start_date ?? params.start_date,
      end_date: s.end_date ?? params.end_date,
      avg_paid_amount: num(s.avg_paid_amount),
      avg_commission_amount: num(s.avg_commission_amount),
      commission_rate: num(s.commission_rate),
    },
  }
}

/** GET stat/getTrafficRank — top 10 by traffic within [start_time, end_time] (unix seconds, inclusive). */
export async function getTrafficRank(
  params: { type: TrafficRankType; start_time: number; end_time: number },
  opts: Opts = {},
): Promise<TrafficRankItem[]> {
  const res = await http.get<{ data: unknown }>('/stat/getTrafficRank', params, opts)
  // Tolerate both `{data:[...]}` and `{data:{data:[...]}}`.
  let list: unknown = res?.data
  if (list && !Array.isArray(list) && typeof list === 'object') list = (list as { data?: unknown }).data
  if (!Array.isArray(list)) return []
  return list.map((it: Record<string, unknown>) => ({
    id: String(it.id ?? ''),
    name: String(it.name ?? ''),
    value: num(it.value),
    previousValue: num(it.previousValue),
    change: num(it.change),
    timestamp: String(it.timestamp ?? ''),
  }))
}
