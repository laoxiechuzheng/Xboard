// Shared helpers for the system settings tabs: value normalizers, validators,
// risk confirmation and the tab <-> shell registration (dirty guard, Ctrl+S).
import { h, inject, onBeforeUnmount, type InjectionKey, type VNodeChild } from 'vue'
import { dialog } from '@/utils/discrete'

// ---- normalizers (fetch values may be number/bool/null for any key, spec §1.3) ----

export function toStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function toBool(v: unknown): boolean {
  if (typeof v === 'string') return v !== '' && v !== '0' && v.toLowerCase() !== 'false'
  return Boolean(v)
}

/** Array setting that may have been stored as a comma separated string. */
export function toStrList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => toStr(x).trim()).filter(Boolean)
  if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean)
  return []
}

/** Trim; empty string -> null (backend turns '' into null anyway). */
export function trimOrNull(v: unknown): string | null {
  const s = toStr(v).trim()
  return s === '' ? null : s
}

export function uniq(list: string[]): string[] {
  return Array.from(new Set(list))
}

// ---- validators ----

export function isUrl(v: string, protocols: string[] = ['http:', 'https:']): boolean {
  try {
    const u = new URL(v)
    return protocols.includes(u.protocol) && !!u.hostname
  } catch {
    return false
  }
}

export function isInteger(v: unknown): boolean {
  return typeof v === 'number' ? Number.isInteger(v) : /^-?\d+$/.test(toStr(v).trim())
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

const RULE_MESSAGES: Record<string, string> = {
  'validation.integer': '必须为整数',
  'validation.numeric': '必须为数字',
  'validation.url': '必须为完整的 URL（需携带 http(s)://）',
  'validation.boolean': '必须为开关值',
  'validation.in': '取值不在允许范围内',
  'validation.array': '必须为列表',
  'validation.required': '不能为空',
  'validation.string': '必须为文本',
  'validation.email': '邮箱格式不正确',
  'validation.regex': '格式不正确',
  'validation.min.string': '长度不足',
  'validation.max.string': '内容过长',
  'validation.min.numeric': '数值过小',
  'validation.max.numeric': '数值过大',
}

/** Backend returns untranslated keys like `validation.integer` (no lang files); map them to Chinese. */
export function translateValidation(msg: string): string {
  if (!msg.startsWith('validation.')) return msg
  return RULE_MESSAGES[msg] ?? '格式不正确'
}

// ---- confirmation dialogs ----

type DialogType = 'warning' | 'error' | 'info'

/**
 * Promise dialog that settles exactly once, also when closed with Esc: the shared `confirm`
 * in utils/discrete never resolves on Esc, which would leave a route guard pending.
 */
function openConfirm(opts: {
  type?: DialogType
  title: string
  content: string | (() => VNodeChild)
  positiveText: string
  style?: string
}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const done = (v: boolean) => {
      if (settled) return
      settled = true
      resolve(v)
    }
    const fn = opts.type === 'error' ? dialog.error : opts.type === 'info' ? dialog.info : dialog.warning
    fn({
      title: opts.title,
      content: opts.content,
      style: opts.style,
      positiveText: opts.positiveText,
      negativeText: '取消',
      onPositiveClick: () => done(true),
      onNegativeClick: () => done(false),
      onClose: () => done(false),
      onMaskClick: () => done(false),
      onEsc: () => done(false),
      onAfterLeave: () => done(false),
    })
  })
}

/** Simple confirm (same signature as utils/discrete `confirm`); resolves false on cancel, close or Esc. */
export function confirmAction(options: {
  title?: string
  content: string
  positiveText?: string
  type?: DialogType
}): Promise<boolean> {
  return openConfirm({
    type: options.type,
    title: options.title || '请确认',
    content: options.content,
    positiveText: options.positiveText || '确定',
  })
}

export interface Risk {
  title: string
  content: string
}

/** One dialog listing every risky change; resolves true when the admin confirms. */
export function confirmRisks(risks: Risk[], positiveText = '确认保存'): Promise<boolean> {
  if (!risks.length) return Promise.resolve(true)
  const single = risks.length === 1
  return openConfirm({
    title: single ? risks[0].title : `请确认以下 ${risks.length} 项高风险修改`,
    style: 'width: min(520px, calc(100vw - 32px))',
    content: () =>
      single
        ? h('div', { style: 'line-height:1.7;white-space:pre-line' }, risks[0].content)
        : h(
            'ol',
            { style: 'margin:4px 0 0;padding-left:20px;line-height:1.65' },
            risks.map((r) =>
              h('li', { style: 'margin-bottom:8px' }, [
                h('div', { style: 'font-weight:600' }, r.title),
                h('div', { style: 'color:var(--text-muted);white-space:pre-line' }, r.content),
              ]),
            ),
          ),
    positiveText,
  })
}

// ---- tab registration (shell owns the unsaved-changes guard and Ctrl+S) ----

export interface SettingsTabApi {
  isDirty: () => boolean
  save?: () => unknown
}

export const settingsTabKey: InjectionKey<(api: SettingsTabApi | null) => void> = Symbol('settingsTab')

export function useSettingsTab(api: SettingsTabApi) {
  const register = inject(settingsTabKey, null)
  register?.(api)
  onBeforeUnmount(() => register?.(null))
}

/** Random alphanumeric secret that always contains a letter and a digit (pure digits break server_token, spec §7.4). */
export function randomToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const limit = 256 - (256 % chars.length) // rejection sampling keeps the distribution uniform
  for (;;) {
    let s = ''
    while (s.length < length) {
      const bytes = new Uint8Array(length * 2)
      crypto.getRandomValues(bytes)
      for (const b of bytes) {
        if (b < limit && s.length < length) s += chars[b % chars.length]
      }
    }
    if (/[A-Za-z]/.test(s) && /\d/.test(s)) return s
  }
}
