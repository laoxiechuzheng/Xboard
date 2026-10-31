// Plain-language labels for the traffic cycle ledger and reset logs (docs/traffic-cycle/DESIGN.md §5, §4.3).
import type { Component } from 'vue'
import {
  BatteryChargingOutline,
  CartOutline,
  ConstructOutline,
  CreateOutline,
  CubeOutline,
  EyeOffOutline,
  GiftOutline,
  HelpCircleOutline,
  PlaySkipForwardOutline,
  ReceiptOutline,
  RefreshCircleOutline,
  RepeatOutline,
  SwapHorizontalOutline,
  SyncOutline,
} from '@vicons/ionicons5'
import { formatBytes, formatTime } from '@/utils/format'

export type Tone = 'primary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

export interface ReasonMeta {
  label: string
  /** One sentence for admins (same wording the AI context uses). */
  desc: string
  tone: Tone
  icon: Component
}

const LOG_REASONS: Record<string, ReasonMeta> = {
  cycle_rollover: { label: '周期到期', desc: '周期到期，已用流量清零并进入新周期', tone: 'info', icon: SyncOutline },
  auto_advance: {
    label: '提前换时',
    desc: '流量用尽，提前开启下一周期，到期时间相应前移',
    tone: 'primary',
    icon: PlaySkipForwardOutline,
  },
  new_purchase: { label: '新购套餐', desc: '新购套餐时清零', tone: 'success', icon: CartOutline },
  plan_change: { label: '更换套餐', desc: '更换套餐时清零', tone: 'success', icon: SwapHorizontalOutline },
  onetime_purchase: { label: '一次性流量', desc: '购买一次性流量时清零', tone: 'success', icon: CubeOutline },
  renewal_reset: { label: '续费清零', desc: '续费时按站点设置清零', tone: 'success', icon: RepeatOutline },
  reset_package: {
    label: '流量重置包',
    desc: '购买流量重置包，本周期已用流量清零',
    tone: 'success',
    icon: BatteryChargingOutline,
  },
  gift_card_reset: { label: '礼品卡', desc: '礼品卡重置流量', tone: 'success', icon: GiftOutline },
  admin_reset: { label: '管理员重置', desc: '管理员手动重置流量', tone: 'warning', icon: ConstructOutline },
  admin_restart: { label: '重设周期', desc: '管理员重设周期时清零', tone: 'warning', icon: RefreshCircleOutline },
  admin_usage_edit: { label: '修改已用', desc: '管理员修改了已用流量', tone: 'warning', icon: CreateOutline },
  order_reset: { label: '订单开通', desc: '订单开通时清零（新购或换套餐）', tone: 'success', icon: ReceiptOutline },
}

export const NOISE_META: ReasonMeta = {
  label: '冗余记录',
  desc: '系统冗余记录，没有实际清零（例如新购时连续重置两次、换时插件先清零再写日志）',
  tone: 'neutral',
  icon: EyeOffOutline,
}

export function isReasonCode(v: unknown): v is string {
  return typeof v === 'string' && v in LOG_REASONS
}

export function reasonMeta(reason: string | null | undefined): ReasonMeta {
  return (
    (reason && LOG_REASONS[reason]) || {
      label: reason || '未知原因',
      desc: reason ? `原因代码 ${reason}` : '没有记录原因',
      tone: 'neutral',
      icon: HelpCircleOutline,
    }
  )
}

/** Reason filter options, in the order admins look for them. */
export const REASON_OPTIONS = Object.entries(LOG_REASONS).map(([value, m]) => ({ label: m.label, value }))

/** Old rows have no reason: infer it from trigger_source like the backend does (DESIGN §4.2). */
export function inferLegacyReason(source: string | null | undefined): string {
  switch (source) {
    case 'cron':
    case 'auto':
    case 'user_access':
      return 'cycle_rollover'
    case 'order':
      return 'order_reset'
    case 'manual':
    case 'api':
      return 'admin_reset'
    case 'gift_card':
      return 'gift_card_reset'
    default:
      return ''
  }
}

const SOURCE_LABELS: Record<string, string> = {
  cron: '定时任务',
  auto: '自动触发',
  user_access: '用户访问时检查',
  manual: '管理员手动',
  api: 'API 调用',
  order: '订单',
  gift_card: '礼品卡',
  traffic_report: '流量上报（换时插件）',
  renewal_order: '续费订单（换时插件）',
  sweep: '定时检查已用尽用户（换时插件）',
  plugin: '插件',
}

export function sourceLabel(source: string | null | undefined, backendName?: string | null): string {
  if (!source) return '—'
  return SOURCE_LABELS[source] ?? (backendName && backendName !== source ? backendName : source)
}

/** trigger_source values the logs endpoint accepts as a filter. */
export const SOURCE_FILTER_OPTIONS = ['cron', 'auto', 'manual', 'order', 'gift_card', 'user_access', 'api'].map((value) => ({
  label: SOURCE_LABELS[value],
  value,
}))

// ------------------------------------------------------------------ cycles

const START_REASONS: Record<string, [string, string]> = {
  purchase: ['新购', '新购套餐，开启新周期'],
  upgrade: ['换套餐', '更换套餐，开启新周期'],
  onetime: ['一次性', '购买一次性流量（不按周期重置）'],
  rollover: ['自动滚动', '上一周期结束，自动进入新周期'],
  catch_up: ['补跑', '定时任务补跑，从最近的周期点开始'],
  advance: ['换时', '流量用尽，提前开启本周期（换时）'],
  admin: ['管理员调整', '管理员调整，周期重新开始'],
  bootstrap: ['初始建立', '启用周期记录时按当时数据建立（之前的周期见重置记录）'],
}

const END_REASONS: Record<string, [string, string]> = {
  rollover: ['到期滚动', '周期到期，自动进入下一周期'],
  advanced: ['提前结束', '流量用尽，提前结束并开启下一周期'],
  replaced: ['被替换', '被新购 / 换套餐 / 管理员重设替换'],
  expired: ['订阅到期', '订阅到期'],
}

export function startReasonLabel(code: string | null | undefined): string {
  return (code && START_REASONS[code]?.[0]) || code || '—'
}
export function startReasonDesc(code: string | null | undefined): string {
  return (code && START_REASONS[code]?.[1]) || (code ? `开始原因 ${code}` : '')
}
export function endReasonLabel(code: string | null | undefined): string {
  return (code && END_REASONS[code]?.[0]) || code || '—'
}
export function endReasonDesc(code: string | null | undefined): string {
  return (code && END_REASONS[code]?.[1]) || (code ? `结束原因 ${code}` : '')
}

export function kindMeta(kind: string | null | undefined): { label: string; tone: Tone; hint: string } {
  return kind === 'special'
    ? { label: '特殊周期', tone: 'warning', hint: '管理员只给本周期设的额度，本周期结束后恢复常备额度' }
    : { label: '标准周期', tone: 'success', hint: '额度 = 用户的常备额度（通常是套餐流量）' }
}

const RESET_METHODS: Record<string, string> = {
  monthly: '按月',
  first_day_month: '每月 1 号',
  yearly: '按年',
  first_day_year: '每年 1 月 1 日',
  never: '不重置',
}

export function resetMethodText(code: string | null | undefined): string {
  return (code && RESET_METHODS[code]) || code || '—'
}

/** Second line for the reset method: how cycle ends are placed (DESIGN §3.1). */
export function resetMethodHint(code: string | null | undefined, minDays: number): string {
  switch (code) {
    case 'monthly':
    case 'yearly':
      return `以到期时间为锚，每个周期至少 ${minDays} 天`
    case 'first_day_month':
      return '每月 1 号 0 点重置'
    case 'first_day_year':
      return '每年 1 月 1 日 0 点重置'
    case 'never':
      return '不排期，用完为止'
    default:
      return ''
  }
}

const ADVANCE_REASONS: Record<string, string> = {
  eligible: '可以换时',
  no_cycle: '当前没有进行中的周期',
  no_expiry: '订阅长期有效，不适用换时',
  final_cycle: '本周期就是最后一个周期，到期即结束',
  remaining_too_short: '剩余有效期不足',
  disabled: '换时未启用（插件未启用或该重置方式未开启）',
}

export function advanceReasonText(code: string | null | undefined): string {
  return (code && ADVANCE_REASONS[code]) || code || '—'
}

// ------------------------------------------------------------------ cycle events (DESIGN §4.3)

const EVENT_TYPES: Record<string, string> = {
  renewal: '续费',
  quota_changed: '额度调整',
  expiry_changed: '到期调整',
  schedule_changed: '排期调整',
  usage_cleared: '已用清零',
  plan_changed: '套餐变更',
  note_changed: '备注更新',
}

const SCHEDULE_WHY: Record<string, string> = {
  expiry_shrunk: '到期时间提前',
  tail_merged: '剩余不足最短周期，尾段并入',
  method_changed: '重置方式变更',
  short_fix: '修正过短的周期',
}

const EVENT_BY: Record<string, string> = {
  order: '订单',
  admin: '管理员',
  gift_card: '礼品卡',
  plugin: '插件',
  system: '系统',
}

export function eventTypeLabel(type: string): string {
  return EVENT_TYPES[type] ?? type
}

export function scheduleWhyText(why: unknown): string {
  return typeof why === 'string' && why ? (SCHEDULE_WHY[why] ?? why) : ''
}

export function eventByText(by: string | null | undefined, adminId?: number | null): string {
  if (!by) return ''
  const label = EVENT_BY[by] ?? by
  return by === 'admin' && adminId ? `${label} #${adminId}` : label
}

const fmtT = (ts: number | null | undefined) => (ts ? formatTime(ts) : '长期有效')
const fmtB = (b: number | null | undefined) => (b === null || b === undefined ? '—' : formatBytes(b))

/** Detail line for a cycle event; `planName` resolves plan ids in plan_changed. */
export function eventDetail(
  ev: { type: string; [key: string]: unknown },
  planName: (id: unknown) => string = (id) => (id === null || id === undefined ? '无套餐' : `套餐 #${id}`),
): string {
  const n = (k: string) => (ev[k] === null || ev[k] === undefined ? null : Number(ev[k]))
  switch (ev.type) {
    case 'renewal':
    case 'expiry_changed': {
      const before = ev.type === 'renewal' ? n('expired_before') : (n('before') ?? n('expired_before'))
      const after = ev.type === 'renewal' ? n('expired_after') : (n('after') ?? n('expired_after'))
      return `到期 ${fmtT(before)} → ${fmtT(after)}`
    }
    case 'quota_changed': {
      const scope = ev.scope === 'cycle' ? '（仅本周期）' : ev.scope === 'standing' ? '（长期）' : ''
      return `额度 ${fmtB(n('before'))} → ${fmtB(n('after'))}${scope}`
    }
    case 'schedule_changed': {
      const why = scheduleWhyText(ev.why)
      return `本周期结束 ${fmtT(n('ends_before'))} → ${fmtT(n('ends_after'))}${why ? `（${why}）` : ''}`
    }
    case 'usage_cleared': {
      const reason = typeof ev.reason === 'string' && ev.reason ? reasonMeta(ev.reason).label : ''
      const log = n('log_id') ? `记录 #${n('log_id')}` : ''
      return [`清零 ${fmtB(n('cleared'))}`, reason, log].filter(Boolean).join(' · ')
    }
    case 'plan_changed':
      return `${planName(ev.from)} → ${planName(ev.to)}`
    case 'note_changed':
      return typeof ev.after === 'string' && ev.after ? `备注改为“${ev.after}”` : '备注已更新'
    default:
      return ''
  }
}

// ------------------------------------------------------------------ preview effects / warnings (DESIGN §7.2)

export const EFFECT_LABELS: Record<string, string> = {
  cycle_restart: '本周期从现在重新开始',
  quota_cycle_only: '新额度只用于本周期',
  quota_standing: '新额度长期生效',
  ends_changed: '本周期结束时间改变',
  expiry_changed: '订阅到期时间改变',
  usage_cleared: '已用流量清零或减少',
  plan_changed: '套餐改变',
}

export const WARNING_LABELS: Record<string, string> = {
  ends_after_expiry: '结束时间晚于订阅到期时间',
  ends_before_now: '结束时间早于当前时间',
  short_cycle: '本周期短于最短周期',
  quota_below_used: '额度小于已用流量',
  no_plan: '用户没有套餐',
}

// ------------------------------------------------------------------ durations

const trim1 = (v: number) => String(parseFloat(v.toFixed(1)))

/** "11.5 天" / "5 小时" / "20 分钟" (absolute value). */
export function durationText(seconds: number | null | undefined): string {
  const s = Math.abs(Number(seconds) || 0)
  if (s >= 86400) return `${trim1(s / 86400)} 天`
  if (s >= 3600) return `${trim1(s / 3600)} 小时`
  return `${Math.max(1, Math.round(s / 60))} 分钟`
}

/** Used bytes of a cycle (closed cycles report u_end / d_end). */
export function cycleUsed(c: { used?: number | null; u?: number | null; d?: number | null; u_end?: number | null; d_end?: number | null }): number {
  if (c.used !== null && c.used !== undefined) return Number(c.used) || 0
  const u = c.u ?? c.u_end ?? 0
  const d = c.d ?? c.d_end ?? 0
  return (Number(u) || 0) + (Number(d) || 0)
}
