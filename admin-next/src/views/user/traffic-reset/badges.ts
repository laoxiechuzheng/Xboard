// Badge colors/descriptions for the traffic reset log page (spec §12.2). Translucent fills work in both themes.

export interface TagColor {
  color: string
  textColor: string
  borderColor: string
}

function hue(hex: string): TagColor {
  return { color: `${hex}1f`, textColor: hex, borderColor: `${hex}59` }
}

const GRAY = hue('#8a8f98')

const SOURCE_COLORS: Record<string, TagColor> = {
  manual: hue('#f97316'),
  cron: hue('#6366f1'),
  auto: hue('#10b981'),
  user_access: hue('#0ea5e9'),
  order: hue('#d946ef'),
  gift_card: hue('#ec4899'),
  api: hue('#64748b'),
}

const SOURCE_DESC: Record<string, string> = {
  manual: '管理员手动执行的流量重置',
  cron: '系统定时任务自动执行',
  auto: '系统根据条件自动触发',
  user_access: '用户访问时检测到到达重置周期而触发',
  order: '用户购买套餐或流量重置包时触发',
  gift_card: '用户兑换礼品卡时触发',
  api: '通过 API 调用触发',
}

const TYPE_COLORS: Record<string, TagColor> = {
  manual: hue('#3b82f6'),
  monthly: hue('#22c55e'),
  yearly: hue('#a855f7'),
  first_day_month: hue('#f97316'),
  first_day_year: hue('#6366f1'),
  purchase: hue('#ec4899'),
}

export const sourceColor = (s: string) => SOURCE_COLORS[s] ?? GRAY
export const sourceDesc = (s: string) => SOURCE_DESC[s] ?? '其他方式触发'
export const typeColor = (t: string) => TYPE_COLORS[t] ?? GRAY
