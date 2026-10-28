// Audit actions derived from every POST/ANY route in AdminRoute.php (spec platform §6.5).
// RequestLog: strip api/v2/{secure_path}/, "-" → "_", last segment = method, rest joined by "_".
import type { SelectGroupOption, SelectOption } from 'naive-ui'

const GROUPS: { resource: string; title: string; actions: Record<string, string> }[] = [
  {
    resource: 'config',
    title: '系统配置',
    actions: { save: '保存系统配置（含切换主题）', setTelegramWebhook: '设置 Telegram Webhook', testSendMail: '发送测试邮件' },
  },
  { resource: 'mail_template', title: '邮件模板', actions: { save: '保存邮件模板', reset: '恢复默认邮件模板', test: '测试邮件模板' } },
  { resource: 'plan', title: '套餐', actions: { save: '保存套餐', drop: '删除套餐', update: '更新套餐状态', sort: '套餐排序' } },
  { resource: 'server_group', title: '权限组', actions: { save: '保存权限组', drop: '删除权限组' } },
  { resource: 'server_route', title: '路由', actions: { save: '保存路由', drop: '删除路由' } },
  {
    resource: 'server_manage',
    title: '节点',
    actions: {
      update: '更新节点状态',
      save: '保存节点',
      drop: '删除节点',
      copy: '复制节点',
      sort: '节点排序',
      batchDelete: '批量删除节点',
      batchUpdate: '批量更新节点',
      resetTraffic: '重置节点流量',
      batchResetTraffic: '批量重置节点流量',
    },
  },
  { resource: 'server_machine', title: '服务器', actions: { save: '保存服务器', drop: '删除服务器', resetToken: '重置服务器令牌' } },
  {
    resource: 'order',
    title: '订单',
    actions: {
      fetch: '查询订单',
      update: '更新订单',
      assign: '分配订单',
      paid: '标记订单已支付',
      cancel: '取消订单',
      detail: '查看订单详情',
    },
  },
  {
    resource: 'user',
    title: '用户',
    actions: {
      fetch: '查询用户',
      update: '更新用户',
      generate: '生成用户',
      dumpCSV: '导出用户 CSV',
      sendMail: '发送邮件',
      ban: '批量封禁用户',
      resetSecret: '重置用户密钥',
      setInviteUser: '设置邀请人',
      destroy: '删除用户',
    },
  },
  { resource: 'stat', title: '统计', actions: { getStatUser: '查询用户流量记录' } },
  {
    resource: 'notice',
    title: '公告',
    actions: { save: '保存公告', update: '更新公告', drop: '删除公告', show: '切换公告显示', sort: '公告排序' },
  },
  { resource: 'ticket', title: '工单', actions: { fetch: '查询工单', reply: '回复工单', close: '关闭工单' } },
  {
    resource: 'coupon',
    title: '优惠券',
    actions: { fetch: '查询优惠券', generate: '生成优惠券', drop: '删除优惠券', show: '切换优惠券显示', update: '更新优惠券' },
  },
  {
    resource: 'gift_card',
    title: '礼品卡',
    actions: {
      templates: '查询礼品卡模板',
      create_template: '创建礼品卡模板',
      update_template: '更新礼品卡模板',
      delete_template: '删除礼品卡模板',
      generate_codes: '生成兑换码',
      codes: '查询兑换码',
      toggle_code: '切换兑换码状态',
      update_code: '更新兑换码',
      delete_code: '删除兑换码',
      usages: '查询使用记录',
      statistics: '查询礼品卡统计',
    },
  },
  {
    resource: 'knowledge',
    title: '知识库',
    actions: { save: '保存知识', show: '切换知识显示', drop: '删除知识', sort: '知识排序' },
  },
  {
    resource: 'payment',
    title: '支付方式',
    actions: {
      getPaymentForm: '获取支付表单',
      save: '保存支付方式',
      drop: '删除支付方式',
      show: '切换支付方式显示',
      sort: '支付方式排序',
    },
  },
  { resource: 'system', title: '系统', actions: { getAuditLog: '查询审计日志' } },
  {
    resource: 'theme',
    title: '主题',
    actions: { upload: '上传主题', delete: '删除主题', getThemeConfig: '读取主题配置', saveThemeConfig: '保存主题配置' },
  },
  {
    resource: 'plugin',
    title: '插件',
    actions: {
      upload: '上传插件',
      delete: '删除插件',
      install: '安装插件',
      uninstall: '卸载插件',
      enable: '启用插件',
      disable: '禁用插件',
      config: '保存插件配置',
      upgrade: '升级插件',
    },
  },
  { resource: 'traffic_reset', title: '流量重置', actions: { reset_user: '重置用户流量' } },
]

export const AUDIT_ACTION_LABELS: Record<string, string> = Object.fromEntries(
  GROUPS.flatMap((g) => Object.entries(g.actions).map(([m, label]) => [`${g.resource}.${m}`, label])),
)

/** Chinese label for an action; unknown actions return null. */
export function auditActionLabel(action: string): string | null {
  return AUDIT_ACTION_LABELS[action] ?? null
}

/** Grouped options for the action filter: "中文名（action）". */
export const AUDIT_ACTION_OPTIONS: SelectGroupOption[] = GROUPS.map((g) => ({
  type: 'group',
  key: g.resource,
  label: g.title,
  children: Object.entries(g.actions).map(
    ([m, label]): SelectOption => ({ label: `${label}（${g.resource}.${m}）`, value: `${g.resource}.${m}` }),
  ),
}))
