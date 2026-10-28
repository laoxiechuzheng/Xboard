// Adapters between plugin field descriptors (config.json `config`, plugin/config items, admin_crud `form`)
// and the shared DynamicForm. Spec platform §3.5 (IYt / RYt) and §10.3.
import type { SelectOption } from 'naive-ui'
import type { DynamicField } from '@/components/dynamic-form'
import type { PluginConfigItem, PluginConfigSchema } from '@/api/plugin'

const KNOWN_TYPES = new Set(['string', 'number', 'percentage', 'select', 'boolean', 'text', 'json', 'yaml'])
const TEXT_TYPES = new Set(['string', 'text', 'json', 'yaml'])
const SECRET_RE = /key|secret|token|password|passwd|pwd|密钥|密码|令牌/i

export function isKnownType(type: unknown): boolean {
  return typeof type === 'string' && KNOWN_TYPES.has(type)
}

/** `[{value,label}]` or `{ value: label }` -> Naive options (the official UI crashes on the object form). */
export function normalizeOptions(options: PluginConfigItem['options']): SelectOption[] {
  if (Array.isArray(options)) {
    return options
      .filter((o) => o && typeof o === 'object')
      .map((o) => ({ value: o.value as string, label: String(o.label ?? o.value) }))
  }
  if (options && typeof options === 'object') {
    return Object.entries(options).map(([value, label]) => ({ value, label: String(label ?? value) }))
  }
  return []
}

/** Display-only masking for credentials (submitted value is unchanged). */
export function isSecretField(key: string, item: PluginConfigItem): boolean {
  return item.type === 'string' && (SECRET_RE.test(key) || SECRET_RE.test(item.label || ''))
}

interface FieldOptions {
  /** plugin/config: blank text values are stored as null and read back as the default. */
  blankMeansDefault?: boolean
  /** admin_crud forms honour `required`; plugin/config never returns it. */
  withRequired?: boolean
}

/** Field list in schema key order; unknown types are skipped (their values are still submitted as-is). */
export function schemaToFields(schema: PluginConfigSchema, opts: FieldOptions = {}): DynamicField[] {
  const fields: DynamicField[] = []
  for (const [key, item] of Object.entries(schema)) {
    if (!item || typeof item !== 'object' || !isKnownType(item.type)) continue
    // Official: label = label || description; description shows under the control only when both exist.
    const label = item.label || item.description || key
    const notes: string[] = []
    if (item.label && item.description) notes.push(item.description)
    if (opts.blankMeansDefault && TEXT_TYPES.has(item.type)) notes.push('留空保存后将恢复默认值')
    const base = {
      key,
      label,
      placeholder: item.placeholder || undefined,
      required: opts.withRequired ? !!item.required : undefined,
      description: notes.length ? notes.join('；') : undefined,
    }
    switch (item.type) {
      case 'string':
        fields.push({ ...base, type: isSecretField(key, item) ? 'password' : 'input' })
        break
      case 'number':
        fields.push({ ...base, type: 'number' })
        break
      case 'percentage':
        fields.push({ ...base, label: `${label}（%）`, type: 'number', min: 0, max: 100 })
        break
      case 'select':
        fields.push({ ...base, type: 'select', options: normalizeOptions(item.options) })
        break
      case 'boolean':
        fields.push({ ...base, type: 'switch' })
        break
      case 'text':
        fields.push({ ...base, type: 'textarea', rows: 4 })
        break
      case 'json':
        fields.push({ ...base, type: 'json', rows: 8 })
        break
      case 'yaml':
        fields.push({ ...base, type: 'code', rows: 8 })
        break
    }
  }
  return fields
}

/** Code editors edit strings: null -> '', objects -> pretty JSON (RYt). */
export function toEditorText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

function initialValue(item: PluginConfigItem, raw: unknown): unknown {
  switch (item.type) {
    case 'json':
    case 'yaml':
      return toEditorText(raw)
    case 'boolean':
      return raw === true || raw === 1 || raw === '1' || raw === 'true'
    case 'number':
    case 'percentage': {
      if (raw === null || raw === undefined || raw === '') return null
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    }
    case 'string':
    case 'text':
      return raw === null || raw === undefined ? '' : typeof raw === 'string' ? raw : String(raw)
    default:
      return raw
  }
}

/** Initial form values: `value` (installed / crud form) or `default` (raw config.json). */
export function schemaToValues(schema: PluginConfigSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(schema)) {
    if (!item || typeof item !== 'object') continue
    out[key] = initialValue(item, item.value !== undefined ? item.value : item.default)
  }
  return out
}

/** Edit form for an existing CRUD row: `row[key] ?? form[key].value`. */
export function rowToValues(schema: PluginConfigSchema, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(schema)) {
    if (!item || typeof item !== 'object') continue
    const raw = row[key] !== undefined && row[key] !== null ? row[key] : item.value !== undefined ? item.value : item.default
    out[key] = initialValue(item, raw)
  }
  return out
}

/** Payload with every schema key (plugin/config overwrites the stored object). Unknown types keep their original value. */
export function collectValues(schema: PluginConfigSchema, values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(schema)) {
    if (!item || typeof item !== 'object') continue
    const v = values[key]
    switch (item.type) {
      case 'number':
      case 'percentage': {
        // Cleared number -> null (official sent Number('') === 0).
        if (v === null || v === undefined || v === '') {
          out[key] = null
          break
        }
        const n = Number(v)
        out[key] = Number.isFinite(n) ? (item.type === 'percentage' ? Math.min(100, Math.max(0, n)) : n) : null
        break
      }
      case 'boolean':
        out[key] = !!v && v !== '0'
        break
      case 'json':
      case 'yaml':
        out[key] = toEditorText(v)
        break
      default:
        out[key] = v === undefined ? null : v
    }
  }
  return out
}

/** Blocking problems before submit: invalid JSON (official never checked) and, for CRUD forms, required fields. */
export function validateValues(
  schema: PluginConfigSchema,
  values: Record<string, unknown>,
  opts: { withRequired?: boolean } = {},
): string[] {
  const errors: string[] = []
  for (const [key, item] of Object.entries(schema)) {
    if (!item || typeof item !== 'object' || !isKnownType(item.type)) continue
    const label = item.label || item.description || key
    const v = values[key]
    if (item.type === 'json') {
      const text = toEditorText(v).trim()
      if (text) {
        try {
          JSON.parse(text)
        } catch {
          errors.push(`「${label}」不是合法的 JSON`)
          continue
        }
      }
    }
    if (opts.withRequired && item.required && item.type !== 'boolean') {
      const empty = v === null || v === undefined || (typeof v === 'string' && !v.trim())
      if (empty) errors.push(`请填写「${label}」`)
    }
  }
  return errors
}

/** Keys whose type the admin cannot edit (kept and resubmitted unchanged). */
export function unknownKeys(schema: PluginConfigSchema): string[] {
  return Object.entries(schema)
    .filter(([, item]) => !item || typeof item !== 'object' || !isKnownType(item.type))
    .map(([k]) => k)
}
