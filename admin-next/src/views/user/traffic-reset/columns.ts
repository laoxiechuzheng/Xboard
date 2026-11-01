// Columns of the 流量周期与重置 table. The legacy 重置类型 / 记录时间 / raw metadata columns are gone: the reason
// says what happened, and everything else is in the expanded row.
import { h } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { formatBytes } from '@/utils/format'
import { carriedText } from '../traffic-cycle/meta'
import type { ResetLogView } from './normalize'
import ResetTimeCell from './ResetTimeCell.vue'
import ResetUserCell from './ResetUserCell.vue'
import ResetReasonCell from './ResetReasonCell.vue'
import ResetChangeCell from './ResetChangeCell.vue'
import ResetLinksCell from './ResetLinksCell.vue'
import ResetLogDetail from './ResetLogDetail.vue'

export interface ResetLogColumnOptions {
  onOpenUser: (log: ResetLogView) => void
  onOpenCycle: (log: ResetLogView) => void
}

// Tuned for a 1440px screen with the sidebar open (~1120px of table); 原因 and 关联 take any extra width.
const W = { expand: 36, time: 104, user: 172, reason: 230, cleared: 124, quota: 132, expiry: 150, links: 150 }

export function buildResetLogColumns(opts: ResetLogColumnOptions): DataTableColumns<ResetLogView> {
  return [
    { type: 'expand', width: W.expand, renderExpand: (r) => h(ResetLogDetail, { log: r }) },
    { title: '时间', key: 'at', width: W.time, render: (r) => h(ResetTimeCell, { ts: r.at, id: r.id }) },
    {
      title: '用户',
      key: 'email',
      width: W.user,
      render: (r) => h(ResetUserCell, { email: r.email, userId: r.userId, onOpen: () => opts.onOpenUser(r) }),
    },
    { title: '原因', key: 'reason', minWidth: W.reason, render: (r) => h(ResetReasonCell, { log: r }) },
    {
      title: '清零',
      key: 'cleared',
      width: W.cleared,
      align: 'right',
      render: (r) => {
        const amount = h('span', { class: ['rl-cleared', { zero: !r.cleared }] }, formatBytes(r.cleared))
        if (!(r.carried > 0)) return amount
        // 换时: the usage over the quota was not cleared but moved into the new cycle. The column is narrow, so the
        // cell shows a one-line "结转 X" and the tooltip carries the full sentence.
        return h('div', [amount, h('div', { class: 'rl-carried', title: carriedText(r.carried) }, `结转 ${formatBytes(r.carried)}`)])
      },
    },
    {
      title: '额度',
      key: 'quota',
      width: W.quota,
      // Keep the right-aligned 清零 numbers from running into this column.
      className: 'rl-gap',
      render: (r) => h(ResetChangeCell, { kind: 'quota', before: r.quotaBefore, after: r.quotaAfter }),
    },
    {
      title: '到期时间',
      key: 'expiry',
      width: W.expiry,
      render: (r) => h(ResetChangeCell, { kind: 'expiry', before: r.expiredBefore, after: r.expiredAfter, shift: r.shift }),
    },
    {
      title: '关联与备注',
      key: 'links',
      minWidth: W.links,
      render: (r) => h(ResetLinksCell, { log: r, cycleClickable: true, onOpenCycle: opts.onOpenCycle }),
    },
  ]
}

export const resetLogScrollX = Object.values(W).reduce((a, b) => a + b, 0)

/** Noise rows are faded (see .rl-noise in the page styles). */
export const resetLogRowClass = (r: ResetLogView) => (r.noise ? 'rl-noise' : '')
