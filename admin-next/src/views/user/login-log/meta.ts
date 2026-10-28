// Labels and formatting for login / register log rows (api/user.ts LoginLog).
import type { Component } from 'vue'
import {
  BugOutline,
  DesktopOutline,
  HelpCircleOutline,
  LogInOutline,
  MailOutline,
  PersonAddOutline,
  PhonePortraitOutline,
  TabletPortraitOutline,
} from '@vicons/ionicons5'
import type { LoginLogDevice, LoginLogLocation, LoginLogType } from '@/api/user'

export type Tone = 'primary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

export const LOGIN_TYPE_OPTIONS: { label: string; value: LoginLogType }[] = [
  { label: '登录', value: 'login' },
  { label: '注册', value: 'register' },
  { label: '链接登录', value: 'mail_link' },
]

export const LOGIN_RESULT_OPTIONS: { label: string; value: 0 | 1 }[] = [
  { label: '成功', value: 1 },
  { label: '失败', value: 0 },
]

const TYPE_META: Record<string, { label: string; icon: Component; tone: Tone; hint: string }> = {
  login: { label: '登录', icon: LogInOutline, tone: 'primary', hint: '邮箱 + 密码登录' },
  register: { label: '注册', icon: PersonAddOutline, tone: 'success', hint: '注册并自动登录' },
  mail_link: { label: '链接登录', icon: MailOutline, tone: 'info', hint: '邮件登录链接或快速登录链接' },
}

export function loginTypeMeta(type: string) {
  return TYPE_META[type] ?? { label: type || '未知', icon: HelpCircleOutline, tone: 'neutral' as Tone, hint: '' }
}

const DEVICE_META: Record<string, { label: string; icon: Component }> = {
  desktop: { label: '桌面端', icon: DesktopOutline },
  mobile: { label: '手机', icon: PhonePortraitOutline },
  tablet: { label: '平板', icon: TabletPortraitOutline },
  bot: { label: '爬虫 / 脚本', icon: BugOutline },
  unknown: { label: '未知设备', icon: HelpCircleOutline },
}

export function deviceMeta(device: LoginLogDevice | null | undefined) {
  return DEVICE_META[device?.type ?? 'unknown'] ?? DEVICE_META.unknown
}

/** "iOS 17.5 · Safari 17"; empty when nothing was recognised. */
export function deviceText(device: LoginLogDevice | null | undefined): string {
  return [device?.os, device?.browser].filter((v): v is string => !!v && !!v.trim()).join(' · ')
}

// ------------------------------------------------------------------ IP & location

// Contract regex: dotted IPv4 or an IPv6-looking hex/colon string. Anything else is shown as plain text.
const IP_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]{2,39})$/

export function isValidIp(ip: string | null | undefined): ip is string {
  return !!ip && IP_RE.test(ip) && (ip.includes('.') || ip.includes(':'))
}

/** ip.sb detail page; null for anything that is not a plain IP. */
export function ipLookupUrl(ip: string | null | undefined): string | null {
  return isValidIp(ip) ? `https://ip.sb/geoip/${ip}` : null
}

export function ipWhoisUrl(ip: string | null | undefined): string | null {
  return isValidIp(ip) ? `https://ip.sb/whois/${ip}` : null
}

export function asnUrl(asn: number | string | null | undefined): string | null {
  const n = Number(asn)
  return Number.isInteger(n) && n > 0 ? `https://ip.sb/whois/AS${n}` : null
}

let regionNames: Intl.DisplayNames | null | undefined

function displayRegion(code: string): string | null {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' })
    } catch {
      regionNames = null
    }
  }
  if (!regionNames) return null
  try {
    const name = regionNames.of(code)
    // "中国香港特别行政区" is too long for a table cell.
    return name && name !== code ? name.replace(/特别行政区$/, '') : null
  } catch {
    return null
  }
}

/** Two-letter upper-case country code, or ''. */
export function countryCode(loc: LoginLogLocation | null | undefined): string {
  const code = (loc?.country_code ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : ''
}

/** Localised country name (Intl.DisplayNames zh-CN), falling back to the lookup's English name. */
export function countryName(loc: LoginLogLocation | null | undefined): string {
  const code = countryCode(loc)
  return (code && displayRegion(code)) || loc?.country?.trim() || code
}

/** "Zhejiang · Hangzhou" — region and city, de-duplicated (Beijing / Beijing). */
export function placeText(loc: LoginLogLocation | null | undefined): string {
  const out: string[] = []
  for (const v of [loc?.region, loc?.city]) {
    const s = v?.trim()
    if (!s) continue
    if (out.some((o) => o.toLowerCase() === s.toLowerCase())) continue
    if (loc?.country && s.toLowerCase() === loc.country.trim().toLowerCase()) continue
    out.push(s)
  }
  return out.join(' · ')
}

/** One-line location summary used by the detail dialog and card subtitles. */
export function locationSummary(geoStatus: string, loc: LoginLogLocation | null | undefined): string {
  if (geoStatus === 'pending') return '归属地解析中'
  if (geoStatus === 'private') return '内网 / 保留地址'
  if (geoStatus === 'failed') return '归属地解析失败'
  return [countryName(loc), placeText(loc)].filter(Boolean).join(' · ') || '未知归属地'
}

/**
 * Date-picker guard: days after today are not selectable. Uses the browser's time zone like the page's
 * start_at / end_at conversion (dashboard's isFutureDate is Beijing-based to match its server-side stats).
 */
export function isFutureDay(ms: number): boolean {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return ms > end.getTime()
}

/** 'MM-DD HH:mm' for the compact second line; the year is shown only when it differs. */
export function shortTime(ts: number): string {
  const d = new Date(ts * 1000)
  if (Number.isNaN(d.getTime())) return '-'
  const p = (n: number) => String(n).padStart(2, '0')
  const md = `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}-${md}`
}
