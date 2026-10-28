// Route action metadata shared by the route list and form.
import type { Component } from 'vue'
import { BanOutline, GlobeOutline, NavigateOutline, ShuffleOutline } from '@vicons/ionicons5'
import type { RouteAction } from '@/api/serverRoute'

export interface RouteActionMeta {
  value: RouteAction
  /** Dropdown / badge label (route.actions.*). */
  label: string
  tagType: 'error' | 'info' | 'success' | 'primary'
  icon: Component
  /** dns / proxy need action_value. */
  needsValue: boolean
  valueLabel?: string
  valuePlaceholder?: string
}

export const ROUTE_ACTIONS: RouteActionMeta[] = [
  { value: 'block', label: '禁止访问', tagType: 'error', icon: BanOutline, needsValue: false },
  {
    value: 'dns',
    label: '指定DNS服务器进行解析',
    tagType: 'info',
    icon: GlobeOutline,
    needsValue: true,
    valueLabel: 'DNS服务器',
    valuePlaceholder: '请输入DNS服务器',
  },
  { value: 'direct', label: '直连', tagType: 'success', icon: NavigateOutline, needsValue: false },
  {
    value: 'proxy',
    label: '转发',
    tagType: 'primary',
    icon: ShuffleOutline,
    needsValue: true,
    valueLabel: '转发标签 (Outbound Tag)',
    valuePlaceholder: '请输入转发标签',
  },
]

export function routeActionMeta(action: string): RouteActionMeta {
  return ROUTE_ACTIONS.find((a) => a.value === action) ?? ROUTE_ACTIONS[2]
}
