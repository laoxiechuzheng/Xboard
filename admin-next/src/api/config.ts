// System settings: config/* and mail/template/* (spec settings.md §3).
import { http, ApiError } from '@/api/http'

export type ConfigGroup =
  | 'site'
  | 'safe'
  | 'subscribe'
  | 'invite'
  | 'server'
  | 'email'
  | 'telegram'
  | 'app'
  | 'subscribe_template'
  | 'frontend'

/**
 * Raw values from config/fetch. Setting::load json-decodes every stored string,
 * so numeric-looking text may come back as a number and booleans as 0/1.
 */
export type ConfigValue = string | number | boolean | null | string[] | Record<string, unknown>
export type RawConfigGroup = Record<string, ConfigValue | undefined>

/** Keys redacted to null by `config/fetch?safe=1`. */
export const SENSITIVE_CONFIG_KEYS = [
  'server_token',
  'email_password',
  'telegram_bot_token',
  'recaptcha_key',
  'recaptcha_v3_secret_key',
  'turnstile_secret_key',
] as const

/**
 * GET config/fetch?key=<group>&safe=1 -> success `{ <group>: {...} }`.
 * `reveal` drops `safe` so secrets come back in plain text (use only on demand).
 */
export async function fetchConfigGroup(
  group: ConfigGroup,
  opts: { reveal?: boolean; silent?: boolean } = {},
): Promise<RawConfigGroup> {
  const res = await http.get<Record<string, RawConfigGroup>>(
    '/config/fetch',
    { key: group, safe: opts.reveal ? undefined : 1 },
    { silent: opts.silent },
  )
  const data = res?.[group]
  if (!data || typeof data !== 'object') throw new ApiError(`配置读取失败：响应缺少分组 ${group}`, 200, res)
  return data
}

/** Plain-text value of one secret (fetch without safe=1, keep only that key). */
export async function revealConfigSecret(group: ConfigGroup, key: string): Promise<string> {
  const data = await fetchConfigGroup(group, { reveal: true })
  const v = data[key]
  return v === null || v === undefined ? '' : String(v)
}

/**
 * POST config/save with a flat `{ key: value }` patch -> success `true`.
 * Silent: callers map 422 `errors` to fields and toast themselves.
 */
export function saveConfig(patch: Record<string, unknown>) {
  return http.post<boolean>('/config/save', patch, { silent: true })
}

export interface TestMailResult {
  email: string
  subject: string
  template_name: string
  /** null when the mail was sent. */
  error: string | null
  config: {
    driver: string
    host: string
    port: string
    encryption: string
    username: string
    fromAddress: string
    fromName: string
  }
}

function text(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

/**
 * POST config/testSendMail -> raw `{ data: mailLog }` (no status envelope, always 200).
 * `data.config` is the whole config('mail') including SMTP passwords: only whitelisted
 * display fields are copied out, the rest is dropped immediately.
 */
export async function sendTestMail(): Promise<TestMailResult> {
  const res = await http.post<{ data?: Record<string, unknown> }>('/config/testSendMail')
  const d = (res?.data ?? {}) as Record<string, unknown>
  const c = (d.config && typeof d.config === 'object' ? d.config : {}) as Record<string, unknown>
  const from = (c.from && typeof c.from === 'object' ? c.from : {}) as Record<string, unknown>
  return {
    email: text(d.email),
    subject: text(d.subject),
    template_name: text(d.template_name),
    error: d.error === null || d.error === undefined || d.error === '' ? null : String(d.error),
    config: {
      driver: text(c.driver ?? c.default),
      host: text(c.host),
      port: text(c.port),
      encryption: text(c.encryption),
      username: text(c.username),
      fromAddress: text(from.address),
      fromName: text(from.name),
    },
  }
}

export interface TelegramWebhookResult {
  success: boolean
  /** Full callback URL including access_token=md5(bot token). */
  webhook_url: string
  webhook_base_url: string | null
}

/** POST config/setTelegramWebhook (no body; backend uses the saved token / base URL). */
export function setTelegramWebhook() {
  return http.post<TelegramWebhookResult>('/config/setTelegramWebhook')
}

// ---- Mail templates (MailTemplateController) ----

export interface MailTemplateSummary {
  name: string
  label: string
  customized: boolean
  subject: string | null
  /** unix seconds, only when customized */
  updated_at: number | null
}

export interface MailTemplateDetail {
  name: string
  label: string
  required_vars: string[]
  optional_vars: string[]
  customized: boolean
  subject: string
  content: string
}

/** GET mail/template/list -> success array (fixed order of MailTemplate::TEMPLATES). */
export function listMailTemplates() {
  return http.get<MailTemplateSummary[]>('/mail/template/list')
}

/** GET mail/template/get?name= -> success detail (default blade content when not customized). */
export function getMailTemplate(name: string) {
  return http.get<MailTemplateDetail>('/mail/template/get', { name })
}

/** POST mail/template/save; content must contain every required `{{var}}` literally. */
export function saveMailTemplate(body: { name: string; subject: string; content: string }) {
  return http.post<boolean>('/mail/template/save', body)
}

/** POST mail/template/reset: delete the customized copy and fall back to the default. */
export function resetMailTemplate(name: string) {
  return http.post<boolean>('/mail/template/reset', { name })
}

/** POST mail/template/test; `email` omitted -> current admin's address. Failure is HTTP 500 `发送失败: ...`. */
export function testMailTemplate(name: string, email?: string) {
  return http.post<boolean>('/mail/template/test', email ? { name, email } : { name })
}
