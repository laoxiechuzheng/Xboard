// Adapts PaymentService::form() descriptors to renderable fields (spec commerce §4.7).
import type { SelectOption } from 'naive-ui'
import type { PaymentFormSchema } from '@/api/payment'

export type ConfigFieldKind = 'input' | 'password' | 'textarea' | 'number' | 'percentage' | 'select' | 'switch' | 'json' | 'yaml'

export interface ConfigField {
  key: string
  kind: ConfigFieldKind
  /** Raw plugin type, kept for unusual types rendered as plain inputs. */
  rawType: string
  label: string
  description: string
  placeholder: string
  options: SelectOption[]
}

function kindOf(type: string): ConfigFieldKind {
  switch (type) {
    case 'password':
      return 'password'
    case 'text':
    case 'textarea':
      return 'textarea'
    case 'number':
    case 'integer':
      return 'number'
    case 'percentage':
      return 'percentage'
    case 'select':
      return 'select'
    case 'boolean':
    case 'switch':
      return 'switch'
    case 'json':
      return 'json'
    case 'yaml':
      return 'yaml'
    default:
      // `string` and anything unknown: official UI skips unknown types, we fall back to a text input.
      return 'input'
  }
}

/** Accepts `[{value,label}]`, `[value]` or `{value: label}`. */
export function normalizeOptions(raw: unknown): SelectOption[] {
  if (Array.isArray(raw)) {
    return raw.map((o) => {
      if (o && typeof o === 'object') {
        const obj = o as Record<string, unknown>
        const value = (obj.value ?? obj.key ?? obj.label) as string | number
        return { value, label: String(obj.label ?? obj.name ?? value) }
      }
      return { value: o as string | number, label: String(o) }
    })
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([value, label]) => ({ value, label: String(label) }))
  }
  return []
}

export function toConfigFields(schema: PaymentFormSchema): ConfigField[] {
  return Object.entries(schema).map(([key, f]) => {
    const label = f.label || f.description || key
    return {
      key,
      kind: kindOf(String(f.type ?? 'string')),
      rawType: String(f.type ?? 'string'),
      label,
      // Description doubles as label when label is empty; don't repeat it below.
      description: f.label ? f.description || '' : '',
      placeholder: f.placeholder || '',
      options: normalizeOptions(f.options),
    }
  })
}

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'on'
}

/** Initial config values, keeping each field's natural type. */
export function initialConfig(schema: PaymentFormSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, f] of Object.entries(schema)) {
    const kind = kindOf(String(f.type ?? 'string'))
    const v = f.value
    if (kind === 'switch') out[key] = toBool(v)
    else if (kind === 'number' || kind === 'percentage') {
      const n = v === '' || v === null || v === undefined ? null : Number(v)
      out[key] = n === null || Number.isNaN(n) ? null : n
    } else if (kind === 'json' || kind === 'yaml') {
      out[key] = typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v, null, 2)
    } else if (kind === 'select') out[key] = v === '' || v === undefined ? null : v
    else out[key] = v == null ? '' : typeof v === 'string' ? v : String(v)
  }
  return out
}

/** Client-side check for json fields; returns the first broken field label. */
export function invalidJsonField(fields: ConfigField[], config: Record<string, unknown>): string | null {
  for (const f of fields) {
    if (f.kind !== 'json') continue
    const v = config[f.key]
    if (typeof v !== 'string' || !v.trim()) continue
    try {
      JSON.parse(v)
    } catch {
      return f.label
    }
  }
  return null
}
