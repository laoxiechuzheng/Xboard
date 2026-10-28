// Shared helpers for the gift card page: reward summaries, template option cache, small formatters.
import { reactive, ref, watch, type Ref } from 'vue'
import { ApiError } from '@/api/http'
import {
  exportBatch,
  fetchTemplates,
  giftCodeStatusMeta,
  type GiftCardCode,
  type GiftCardRewards,
  type GiftCardTemplate,
} from '@/api/giftCard'
import { formatBytes, formatMoney, nowSeconds } from '@/utils/format'
import { saveFile } from '@/utils/clipboard'
import { message } from '@/utils/discrete'

export type TabKey = 'templates' | 'codes' | 'usages' | 'statistics'

/** Filters another tab can ask the codes / usages tab to apply. */
export interface TabIntent {
  template_id?: number | null
  batch_id?: string | null
  /** Usages tab: exact user id or email. */
  user?: string | null
  /** Changes on every request so repeated intents are observed. */
  seq: number
}

// ---------- column visibility ("显示列") ----------

export interface ColumnOption {
  key: string
  label: string
  /** Always visible. */
  fixed?: boolean
}

/** Hidden column keys remembered per browser (falls back to memory when storage is blocked). */
export function useHiddenColumns(storageKey: string): Ref<string[]> {
  const key = `admin-next:gift-card:${storageKey}:hidden-columns`
  let initial: string[] = []
  try {
    const raw = localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) initial = parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    /* storage unavailable */
  }
  const hidden = ref<string[]>(initial)
  watch(hidden, (v) => {
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* storage unavailable */
    }
  })
  return hidden
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Human readable reward items. Shows every known key that is present (including leftovers from
 * another card type, which the backend would still grant).
 */
export function rewardItems(rewards: GiftCardRewards | null | undefined, planName?: (id: number) => string): string[] {
  if (!rewards) return []
  const out: string[] = []
  if (num(rewards.balance) > 0) out.push(`余额 ${formatMoney(rewards.balance as number)}`)
  if (num(rewards.transfer_enable) > 0) out.push(`流量 ${formatBytes(rewards.transfer_enable as number)}`)
  if (num(rewards.expire_days) > 0) out.push(`有效期 +${num(rewards.expire_days)} 天`)
  if (num(rewards.device_limit) > 0) out.push(`设备数 +${num(rewards.device_limit)}`)
  if (rewards.reset_package) out.push('重置当月流量')
  if (rewards.plan_id !== undefined && rewards.plan_id !== null) {
    const id = num(rewards.plan_id)
    out.push(`套餐 ${planName ? planName(id) : `#${id}`}`)
  }
  if (num(rewards.plan_validity_days) > 0) out.push(`套餐有效期 ${num(rewards.plan_validity_days)} 天`)
  if (Array.isArray(rewards.random_rewards) && rewards.random_rewards.length) {
    out.push(`盲盒奖池 ${rewards.random_rewards.length} 项`)
  }
  if (num(rewards.invite_reward_rate) > 0) out.push(`邀请人返 ${formatRate(rewards.invite_reward_rate as number)}`)
  return out
}

/** Summary of one random-reward pool item (without weight). */
export function randomItemText(item: Record<string, unknown>): string {
  const parts = rewardItems(item as GiftCardRewards)
  return parts.length ? parts.join('、') : '空奖励（未中奖）'
}

export function formatRate(rate: number): string {
  return `${Number((rate * 100).toFixed(2))}%`
}

export function formatMultiplier(v: number | null | undefined): string {
  const n = Number(v)
  return Number.isFinite(n) ? `×${Number(n.toFixed(2))}` : '×1'
}

// ---------- code status ----------

export interface CodeStatusView {
  /** Short label for the list tag. */
  label: string
  /** Self-explaining label for exports (includes the stored status when it differs). */
  fullLabel: string
  tag: 'default' | 'success' | 'warning' | 'error' | 'info'
  hint?: string
}

/**
 * Display status of a code. The backend never writes status 2 by itself (markAsExpired /
 * cleanupExpired have no callers), so codes past `expires_at` keep their stored status 0 / 1;
 * they are shown as expired here, in the list and in the CSV export alike.
 */
export function codeStatusView(row: Pick<GiftCardCode, 'status' | 'expires_at' | 'usage_count' | 'max_usage'>): CodeStatusView {
  const meta = giftCodeStatusMeta(row.status)
  const expired = !!row.expires_at && row.expires_at < nowSeconds()
  if (row.status === 0 && expired) {
    return {
      label: '已过期',
      fullLabel: '已过期（未使用）',
      tag: 'warning',
      hint: '已超过过期时间，无法再兑换（数据库状态仍为“未使用”，按状态筛选时归在“未使用”中）',
    }
  }
  if (row.status === 1 && row.usage_count < row.max_usage) {
    return expired
      ? { label: '已使用', fullLabel: '已使用（已过期）', tag: 'info', hint: `已兑换 ${row.usage_count}/${row.max_usage} 次，已过期，无法继续兑换` }
      : { label: '已使用', fullLabel: '已使用（可继续兑换）', tag: 'info', hint: `已兑换 ${row.usage_count}/${row.max_usage} 次，仍可继续兑换` }
  }
  return { label: meta.label, fullLabel: meta.label, tag: meta.tag }
}

// ---------- silent requests ----------

/** Toast an error from a `silent` request the way the http client would (auth failures already redirect). */
export function toastApiError(e: unknown) {
  if (!(e instanceof ApiError)) return
  const body = e.body && typeof e.body === 'object' ? (e.body as Record<string, unknown>) : null
  const authFailure = e.status === 401 || (e.status === 403 && (body?.message === 'Unauthorized' || body?.message === '未登录或登陆已过期'))
  if (!authFailure) message.error(e.message)
}

/** A 422 whose `errors` include `field` (e.g. a template_id that no longer exists). */
export function isFieldError(e: unknown, field: string): boolean {
  return e instanceof ApiError && e.status === 422 && !!e.errors?.[field]
}

// ---------- template option cache (selects in the codes / usages tabs and the generate dialog) ----------

export const templateOptions = reactive({
  list: [] as GiftCardTemplate[],
  loaded: false,
  loading: false,
})

let pending: Promise<void> | null = null

export function loadTemplateOptions(force = false): Promise<void> {
  if (pending) return pending
  if (templateOptions.loaded && !force) return Promise.resolve()
  templateOptions.loading = true
  pending = fetchTemplates({ page: 1, per_page: 1000 })
    .then((res) => {
      templateOptions.list = res.data ?? []
      templateOptions.loaded = true
    })
    .catch(() => {
      /* toast handled by http client */
    })
    .finally(() => {
      templateOptions.loading = false
      pending = null
    })
  return pending
}

/** Refresh the cache only if something already uses it. */
export function invalidateTemplateOptions() {
  if (templateOptions.loaded) void loadTemplateOptions(true)
}

export function templateSelectOptions(opts: { disableInactive?: boolean } = {}) {
  return templateOptions.list.map((t) => ({
    label: `${t.name}${t.status ? '' : '（已禁用）'}`,
    value: t.id,
    disabled: opts.disableInactive ? !t.status : false,
    type: t.type,
  }))
}

/** Download one batch as TXT (one code per line). Resolves false on failure (toasted here). */
export async function downloadBatch(batchId: string): Promise<boolean> {
  try {
    const blob = await exportBatch(batchId)
    saveFile(blob, `gift_cards_${batchId}.txt`, 'text/plain;charset=utf-8')
    message.success('兑换码已导出')
    return true
  } catch (e) {
    if (e instanceof ApiError && e.status === 422) message.error(`批次号「${batchId}」不存在或该批次已没有兑换码`)
    else if (e instanceof ApiError) message.error(e.message || '导出失败')
    else message.error('导出失败')
    return false
  }
}

/** One CSV cell, quoted when needed. */
export function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Local date as Y-m-d. */
export function ymd(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Timestamp suffix for downloaded file names: 20261028_153012. */
export function fileStamp(d = new Date()): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${ymd(d).replace(/-/g, '')}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
