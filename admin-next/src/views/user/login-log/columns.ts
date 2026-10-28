// Column set shared by the 登录记录 page and the per-user dialog.
import { h } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import type { LoginLog } from '@/api/user'
import LoginTimeCell from './LoginTimeCell.vue'
import LoginUserCell from './LoginUserCell.vue'
import LoginTypeTag from './LoginTypeTag.vue'
import LoginResultTag from './LoginResultTag.vue'
import LoginIpCell from './LoginIpCell.vue'
import LoginLocationCell from './LoginLocationCell.vue'
import LoginDeviceCell from './LoginDeviceCell.vue'
import LoginLogDetail from './LoginLogDetail.vue'

export interface LoginLogColumnOptions {
  /** Show the 用户 column (page only). */
  showUser?: boolean
  /** User id currently filtered on (highlights the email). */
  activeUserId?: number | null
  onFilterUser?: (row: LoginLog) => void
  /** When set, clicking an IP filters by it. */
  onFilterIp?: (ip: string) => void
}

// Widths are tuned so the page table fits a 1440px screen with the sidebar open (~1120px);
// 归属地 takes the remaining space on wider screens.
const W = { expand: 36, time: 100, user: 176, type: 96, result: 78, ip: 166, location: 200, device: 156, origin: 112 }

export function buildLoginLogColumns(opts: LoginLogColumnOptions = {}): DataTableColumns<LoginLog> {
  const cols: DataTableColumns<LoginLog> = [
    { type: 'expand', width: W.expand, renderExpand: (r) => h(LoginLogDetail, { log: r }) },
    { title: '时间', key: 'created_at', width: W.time, render: (r) => h(LoginTimeCell, { ts: r.created_at }) },
  ]
  if (opts.showUser) {
    cols.push({
      title: '用户',
      key: 'email',
      width: W.user,
      render: (r) =>
        h(LoginUserCell, {
          email: r.email,
          userId: r.user_id,
          active: opts.activeUserId === r.user_id,
          onFilter: () => opts.onFilterUser?.(r),
        }),
    })
  }
  cols.push(
    { title: '类型', key: 'type', width: W.type, render: (r) => h(LoginTypeTag, { type: r.type }) },
    { title: '结果', key: 'success', width: W.result, render: (r) => h(LoginResultTag, { success: !!r.success }) },
    {
      title: 'IP',
      key: 'ip',
      width: W.ip,
      render: (r) =>
        h(LoginIpCell, {
          ip: r.ip,
          filterable: !!opts.onFilterIp,
          lookup: r.geo_status !== 'private',
          onFilter: (ip: string) => opts.onFilterIp?.(ip),
        }),
    },
    {
      title: '归属地',
      key: 'location',
      minWidth: W.location,
      render: (r) => h(LoginLocationCell, { geoStatus: r.geo_status, location: r.location }),
    },
    { title: '设备', key: 'device', width: W.device, render: (r) => h(LoginDeviceCell, { device: r.device }) },
    {
      title: '来源',
      key: 'origin',
      width: W.origin,
      ellipsis: { tooltip: true },
      render: (r) => (r.origin ? h('span', { class: 'll-origin' }, r.origin) : h('span', { class: 'muted' }, '—')),
    },
  )
  return cols
}

/** Sum of the column widths (归属地 at its minimum) for :scroll-x. */
export function loginLogScrollX(showUser: boolean): number {
  return Object.values(W).reduce((a, b) => a + b, 0) - (showUser ? 0 : W.user)
}

/** Failed attempts get a faint error tint (see .ll-fail in the consumers' styles). */
export const loginLogRowClass = (r: LoginLog) => (r.success ? '' : 'll-fail')
