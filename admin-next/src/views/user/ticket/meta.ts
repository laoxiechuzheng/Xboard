// Ticket enums, synthesized status and shared actions (spec content.md §2.2).
import { reactive, type Component } from 'vue'
import { ArrowDownOutline, ArrowUpOutline, RemoveOutline } from '@vicons/ionicons5'
import { closeTicket, type TicketListItem } from '@/api/ticket'
import { confirm, message } from '@/utils/discrete'

/** Reply drafts kept per ticket (spec R-T5) so switching tickets never sends text to the wrong one. */
export const replyDrafts = reactive<Record<number, string>>({})

export type TagType = 'default' | 'error' | 'warning' | 'success' | 'info' | 'primary'

export interface LevelMeta {
  value: 0 | 1 | 2
  label: string
  type: TagType
  icon: Component
}

export const LEVELS: LevelMeta[] = [
  { value: 0, label: '低优先', type: 'success', icon: ArrowDownOutline },
  { value: 1, label: '中优先', type: 'warning', icon: RemoveOutline },
  { value: 2, label: '高优先', type: 'error', icon: ArrowUpOutline },
]

/** Any value other than 0/1 is shown as high, like the official badge. */
export function levelMeta(level: unknown): LevelMeta | null {
  if (level === null || level === undefined || level === '') return null
  const n = Number(level)
  return LEVELS.find((l) => l.value === n) ?? LEVELS[2]
}

export type SynthStatus = 'closed' | 'replied' | 'pending'

export const SYNTH_STATUS: Record<SynthStatus, { label: string; type: TagType }> = {
  closed: { label: '已关闭', type: 'default' },
  replied: { label: '已回复', type: 'success' },
  pending: { label: '待回复', type: 'error' },
}

/** Official `m9t`: closed wins, then reply_status (null counts as 待回复). */
export function synthStatus(t: Pick<TicketListItem, 'status' | 'reply_status'>): SynthStatus {
  if (Number(t.status) === 1) return 'closed'
  return Number(t.reply_status ?? 0) === 1 ? 'replied' : 'pending'
}

export const isClosed = (t: Pick<TicketListItem, 'status'>) => Number(t.status) === 1

/** Confirm + POST ticket/close. Resolves true when the ticket was closed. */
export async function confirmCloseTicket(t: Pick<TicketListItem, 'id' | 'subject'>): Promise<boolean> {
  const ok = await confirm({
    title: '确认关闭工单',
    content: `确定要关闭工单 #${t.id}「${t.subject}」吗？关闭后会移入“已关闭”列表，用户将无法再回复（管理员仍可继续回复）；后台不支持重新打开。`,
    positiveText: '确认关闭',
    type: 'error',
  })
  if (!ok) return false
  try {
    await closeTicket(t.id)
    message.success('工单已关闭')
    return true
  } catch {
    return false
  }
}
