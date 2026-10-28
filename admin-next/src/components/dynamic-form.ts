import type { SelectOption } from 'naive-ui'

export type DynamicFieldType =
  | 'input'
  | 'password'
  | 'textarea'
  | 'number'
  | 'switch'
  | 'select'
  | 'multi-select'
  | 'tags'
  | 'json'
  | 'code'
  | 'markdown'

export interface DynamicField {
  key: string
  label?: string
  type: DynamicFieldType
  description?: string
  placeholder?: string
  required?: boolean
  options?: SelectOption[]
  min?: number
  max?: number
  rows?: number
  /** For switch: emit 1/0 instead of true/false. */
  switchAsNumber?: boolean
  /** For select: allow clearing (default true). */
  clearable?: boolean
  /** For code: syntax hint passed to CodeEditor (default 'text'). */
  language?: 'yaml' | 'text' | 'html' | 'conf'
  default?: unknown
}

/** Build initial values from field defaults, overlaid with existing values. */
export function initDynamicValues(fields: DynamicField[], current: Record<string, any> = {}): Record<string, any> {
  const out: Record<string, any> = {}
  for (const f of fields) {
    out[f.key] = current[f.key] !== undefined ? current[f.key] : (f.default ?? (f.type === 'switch' ? false : null))
  }
  return { ...current, ...out }
}
