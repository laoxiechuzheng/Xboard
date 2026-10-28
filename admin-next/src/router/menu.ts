import type { Component } from 'vue'
import {
  SpeedometerOutline,
  SettingsOutline,
  ServerOutline,
  CashOutline,
  PeopleOutline,
} from '@vicons/ionicons5'

/**
 * Sidebar menu, mirroring the official admin's navigation order (spec core §6.2.2).
 * Entries marked "extra" do not exist in the official menu. Plugin groups are
 * appended at runtime (stores/plugins.ts). Each leaf `path` must match a route.
 */
export interface MenuLeaf {
  path: string
  title: string
}
export interface MenuGroup {
  key: string
  title: string
  icon: Component
  /** Single-entry group rendered as a top-level item. */
  path?: string
  children?: MenuLeaf[]
}

export const menuGroups: MenuGroup[] = [
  { key: 'dashboard', title: '仪表盘', icon: SpeedometerOutline, path: '/dashboard' },
  {
    key: 'system-management',
    title: '系统管理',
    icon: SettingsOutline,
    children: [
      { path: '/config/system', title: '系统配置' },
      { path: '/config/plugin', title: '插件管理' },
      { path: '/config/theme', title: '主题配置' },
      { path: '/config/notice', title: '公告管理' },
      { path: '/config/payment', title: '支付配置' },
      { path: '/config/knowledge', title: '知识库管理' },
      { path: '/config/system-status', title: '系统状态' }, // extra
      { path: '/config/audit-log', title: '审计日志' }, // extra
    ],
  },
  {
    key: 'node-management',
    title: '节点管理',
    icon: ServerOutline,
    children: [
      { path: '/server/machine', title: '服务器管理' },
      { path: '/server/manage', title: '节点管理' },
      { path: '/server/group', title: '权限组管理' },
      { path: '/server/route', title: '路由管理' },
    ],
  },
  {
    key: 'subscription-management',
    title: '订阅管理',
    icon: CashOutline,
    children: [
      { path: '/finance/plan', title: '套餐管理' },
      { path: '/finance/order', title: '订单管理' },
      { path: '/finance/coupon', title: '优惠券管理' },
      { path: '/finance/gift-card', title: '礼品卡管理' },
    ],
  },
  {
    key: 'user-management',
    title: '用户管理',
    icon: PeopleOutline,
    children: [
      { path: '/user/manage', title: '用户管理' },
      { path: '/user/ticket', title: '工单管理' },
      { path: '/user/traffic-reset-logs', title: '流量重置日志' }, // extra: official has the page but no menu entry
    ],
  },
]

/** Menu entry that is active for a given route path (prefix match like the official checkActiveNav). */
export function activeMenuPath(routePath: string, paths: string[]): string | undefined {
  let best: string | undefined
  for (const p of paths) {
    if (routePath === p || routePath.startsWith(p + '/')) {
      if (!best || p.length > best.length) best = p
    }
  }
  return best
}
