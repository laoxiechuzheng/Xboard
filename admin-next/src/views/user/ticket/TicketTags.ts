// Small render helpers for ticket badges (used by table cells and the detail view).
import { h } from 'vue'
import { NIcon, NTag } from 'naive-ui'
import type { TicketListItem } from '@/api/ticket'
import { SYNTH_STATUS, levelMeta, synthStatus } from './meta'

export function renderStatusTag(t: Pick<TicketListItem, 'status' | 'reply_status'>, size: 'tiny' | 'small' = 'small') {
  const s = SYNTH_STATUS[synthStatus(t)]
  return h(NTag, { size, type: s.type, bordered: false, round: true }, { default: () => s.label })
}

export function renderLevelTag(level: unknown, size: 'tiny' | 'small' = 'small') {
  const m = levelMeta(level)
  if (!m) return null
  return h(
    NTag,
    { size, type: m.type, bordered: false },
    {
      icon: () => h(NIcon, null, { default: () => h(m.icon) }),
      default: () => m.label,
    },
  )
}
