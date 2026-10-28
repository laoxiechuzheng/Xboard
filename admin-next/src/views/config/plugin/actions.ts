// Plugin lifecycle actions: success texts and the confirmations required by spec platform §3.3 / §9.3.
import type { PluginAction, PluginDetail } from '@/api/plugin'

export const ACTION_SUCCESS: Record<PluginAction, string> = {
  install: '插件安装成功',
  upgrade: '插件升级成功',
  uninstall: '插件卸载成功',
  enable: '插件启用成功',
  disable: '插件禁用成功',
  delete: '插件删除成功',
}

export interface ActionConfirm {
  title: string
  content: string
  positiveText: string
  type: 'warning' | 'error' | 'info'
}

/** Confirmation for an action, or null when it runs directly (install / enable / most disables). */
export function confirmFor(action: PluginAction, p: PluginDetail): ActionConfirm | null {
  const name = `「${p.name || p.code}」`
  switch (action) {
    case 'uninstall':
      return {
        title: '卸载插件',
        content: `卸载将回滚该插件的数据库迁移（删除插件数据表）并清除插件配置，且无法恢复。插件文件会保留。确定卸载${name}吗？`,
        positiveText: '卸载',
        type: 'error',
      }
    case 'delete':
      return {
        title: '删除插件',
        content: p.is_installed
          ? `将先卸载${name}（删除插件数据表和配置），再删除插件文件，此操作无法撤销。确定删除吗？`
          : `将删除${name}的插件文件，此操作无法撤销。确定删除吗？`,
        positiveText: '删除',
        type: 'error',
      }
    case 'upgrade':
      return {
        title: '升级插件',
        content: `确定要升级${name}吗？升级过程中插件将暂时不可用，并会运行新版本的数据库迁移。升级失败时请检查插件是否需要手动重新启用。`,
        positiveText: '升级',
        type: 'warning',
      }
    case 'disable':
      if (p.type === 'payment') {
        return {
          title: '禁用支付插件',
          content: `禁用后使用${name}的支付通道将不可用，包括未完成订单的支付回调（可能导致已付款订单无法开通）。确定禁用吗？`,
          positiveText: '禁用',
          type: 'error',
        }
      }
      if (p.code === 'telegram') {
        return {
          title: '禁用插件',
          content: '禁用后 Telegram 通知与机器人命令将停止工作。确定禁用吗？',
          positiveText: '禁用',
          type: 'warning',
        }
      }
      return null
    default:
      return null
  }
}
