// Theme `configs` (config.json) <-> DynamicForm adapters and theme upload checks. Spec platform §2.5, §2.7.
import type { DynamicField } from '@/components/dynamic-form'
import { ApiError } from '@/api/http'
import type { ThemeConfigField, ThemeConfigValues, ThemeInfo } from '@/api/theme'

const KNOWN = new Set(['input', 'textarea', 'select'])
const HTML_FIELD = /html|script|footer_code|custom_code/i

/** Declared fields with a usable `field_name`, in config.json order. */
export function themeFields(info: ThemeInfo | null | undefined): ThemeConfigField[] {
  const list = Array.isArray(info?.configs) ? info.configs : []
  return list.filter((f): f is ThemeConfigField => !!f && typeof f === 'object' && typeof f.field_name === 'string' && !!f.field_name)
}

export function themeConfigToFields(configs: ThemeConfigField[]): DynamicField[] {
  return configs.map((f): DynamicField => {
    const notes: string[] = []
    if (!KNOWN.has(f.field_type)) notes.push(`未知字段类型「${f.field_type || '空'}」，按文本输入`)
    if (HTML_FIELD.test(f.field_name)) notes.push('内容会原样插入前台页面，可执行脚本，请只填写可信代码')
    const base = {
      key: f.field_name,
      label: f.label || f.field_name,
      placeholder: f.placeholder || undefined,
      description: notes.length ? notes.join('；') : undefined,
    }
    if (f.field_type === 'textarea') return { ...base, type: 'textarea', rows: 6 }
    if (f.field_type === 'select') {
      const opts = f.select_options && typeof f.select_options === 'object' ? f.select_options : {}
      const options = Object.entries(opts).map(([value, label]) => ({ value, label: String(label ?? value) }))
      // DynamicForm's select is always clearable; tell what an empty choice falls back to (spec §2.5).
      const def = selectDefault(f)
      const defLabel = def ? options.find((o) => o.value === def)?.label || def : ''
      const placeholder = defLabel ? `${f.placeholder || '请选择'}（留空则使用默认：${defLabel}）` : base.placeholder
      return { ...base, placeholder, type: 'select', options }
    }
    return { ...base, type: 'input' }
  })
}

function selectDefault(f: ThemeConfigField): string {
  return f.default_value === null || f.default_value === undefined ? '' : String(f.default_value)
}

/**
 * Stored values for the declared fields only. Text fields: null / missing -> '' (official put null into
 * inputs). Select fields: null / missing / '' -> null so the select shows its placeholder instead of a
 * blank "selected" value ('' is never a valid option).
 */
export function themeValuesFrom(configs: ThemeConfigField[], stored: ThemeConfigValues): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  for (const f of configs) {
    const v = stored[f.field_name]
    const text = v === null || v === undefined ? '' : typeof v === 'string' ? v : String(v)
    out[f.field_name] = f.field_type === 'select' && text === '' ? null : text
  }
  return out
}

/**
 * Payload: declared keys only (the backend drops the rest anyway). A cleared select falls back to the
 * field's default_value (what the theme would use anyway); without one it is sent as ''.
 */
export function collectThemeValues(configs: ThemeConfigField[], values: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of configs) {
    const v = values[f.field_name]
    const text = v === null || v === undefined ? '' : String(v)
    out[f.field_name] = f.field_type === 'select' && text === '' ? selectDefault(f) : text
  }
  return out
}

export const THEME_MAX_BYTES = 10 * 1024 * 1024
const THEME_FILENAME = /^[a-zA-Z0-9\-_.]+\.zip$/

/** Same checks as ThemeController::upload, run before sending. Returns an error text or ''. */
export function checkThemePackage(file: File): string {
  if (!/\.zip$/i.test(file.name)) return '只支持上传 ZIP 格式的主题文件'
  if (file.size > THEME_MAX_BYTES) return '主题包大小不能超过10MB'
  if (!THEME_FILENAME.test(file.name)) return '主题包文件名只能包含字母、数字、下划线、中划线和点，且扩展名为小写 .zip'
  return ''
}

/**
 * ThemeService throws plain exceptions -> HTTP 500 with a generic message (spec §9.1 T8).
 * Show something actionable instead of "服务器错误".
 */
export function themeErrorText(e: unknown, fallback = '操作失败'): string {
  if (e instanceof ApiError) {
    if (e.status >= 500) return `${fallback}（HTTP ${e.status}），请查看服务器日志`
    return e.message || fallback
  }
  return (e as Error)?.message || fallback
}

/** Safe `url("...")` for an inline background-image. */
export function cssUrl(url: string): string {
  return `url("${url.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, '')}")`
}
