// Form state for one config/fetch group: load with safe=1, track dirty keys,
// validate, confirm risky changes and submit only the modified keys (spec §1.5).
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api/http'
import { fetchConfigGroup, revealConfigSecret, saveConfig, type ConfigGroup, type RawConfigGroup } from '@/api/config'
import { message } from '@/utils/discrete'
import { toStr, translateValidation, trimOrNull } from './helpers'

export type FieldErrors = Record<string, string>

export interface SaveContext<F> {
  form: F
  baseline: F
  keys: Array<keyof F & string>
  payload: Record<string, unknown>
  has: (key: keyof F & string) => boolean
}

export interface ConfigFormOptions<F extends object> {
  group: ConfigGroup
  /** Field labels used in error toasts. */
  labels: Partial<Record<keyof F & string, string>>
  /** Fetched group -> editable model. */
  toForm: (raw: RawConfigGroup) => F
  /** Model value -> request value; default trims strings and sends '' as null. Also drives dirty checks. */
  toPayload?: { [K in keyof F]?: (value: F[K]) => unknown }
  /** Redacted by safe=1: empty input keeps the stored value until revealed. */
  secretKeys?: Array<keyof F & string>
  /** Field errors that block saving. */
  validate?: (form: F, isDirty: (key: keyof F & string) => boolean) => FieldErrors
  /** Confirm risky changes; return false to abort. */
  beforeSave?: (ctx: SaveContext<F>) => boolean | Promise<boolean>
  /** Return false to skip reloading the group (e.g. the admin path just changed). */
  afterSave?: (ctx: SaveContext<F>) => boolean | void | Promise<boolean | void>
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export function useConfigForm<F extends object>(opts: ConfigFormOptions<F>) {
  type K = keyof F & string

  const form = reactive({} as F) as F
  const baseline = shallowRef<F | null>(null)
  const loading = ref(true)
  const loadError = ref('')
  const saving = ref(false)
  const errors = reactive<FieldErrors>({})
  const revealed = reactive<Record<string, boolean>>({})
  const revealing = reactive<Record<string, boolean>>({})

  const isSecret = (key: K) => !!opts.secretKeys?.includes(key)

  function payloadOf(key: K, source: F): unknown {
    const fn = opts.toPayload?.[key] as ((v: unknown) => unknown) | undefined
    const v = source[key]
    if (fn) return fn(v)
    return typeof v === 'string' ? trimOrNull(v) : v
  }

  function isDirty(key: K): boolean {
    const base = baseline.value
    if (!base) return false
    if (isSecret(key) && !revealed[key]) return toStr(form[key]).trim() !== ''
    return JSON.stringify(payloadOf(key, form)) !== JSON.stringify(payloadOf(key, base))
  }

  const keys = computed(() => (baseline.value ? (Object.keys(baseline.value) as K[]) : []))
  const dirtyKeys = computed(() => keys.value.filter((k) => isDirty(k)))
  const dirtyCount = computed(() => dirtyKeys.value.length)

  // Editing a field clears its error.
  let snapshot: Record<string, string> = {}
  watch(
    () => keys.value.map((k) => JSON.stringify(form[k] ?? null)),
    (vals) => {
      keys.value.forEach((k, i) => {
        if (snapshot[k] !== vals[i]) {
          if (snapshot[k] !== undefined) delete errors[k]
          snapshot[k] = vals[i]
        }
      })
    },
  )

  function clearErrors() {
    for (const k of Object.keys(errors)) delete errors[k]
  }

  function label(key: string) {
    return (opts.labels as Record<string, string | undefined>)[key] ?? key
  }

  /** silent: background refresh (after save) without the loading/error states. */
  async function load(silent = false): Promise<boolean> {
    if (!silent) {
      loading.value = true
      loadError.value = ''
    }
    try {
      const raw = await fetchConfigGroup(opts.group, { silent })
      const next = opts.toForm(raw)
      snapshot = {}
      baseline.value = clone(next)
      Object.assign(form, clone(next))
      for (const k of Object.keys(revealed)) delete revealed[k]
      clearErrors()
      return true
    } catch (e) {
      if (!silent) loadError.value = e instanceof Error ? e.message : '加载失败'
      return false
    } finally {
      if (!silent) loading.value = false
    }
  }

  function discard() {
    if (!baseline.value) return
    Object.assign(form, clone(baseline.value))
    clearErrors()
  }

  /** Put fields back to their saved values and drop their errors. */
  function restore(list: K[]) {
    const base = baseline.value
    if (!base) return
    for (const k of list) {
      const v = base[k]
      ;(form as Record<string, unknown>)[k] = v === undefined ? v : clone(v)
      delete errors[k]
    }
  }

  /**
   * Rows rendered only while `shown()` is true go back to their saved values once hidden,
   * so a hidden row is never submitted or blocks saving with an error nobody can see.
   */
  function restoreWhenHidden(shown: () => boolean, list: K[]) {
    watch(shown, (visible) => {
      if (!visible) restore(list)
    })
  }

  /** Load a secret's stored value on demand (config/fetch without safe). */
  async function reveal(key: K) {
    if (revealing[key] || !baseline.value) return
    revealing[key] = true
    try {
      const value = await revealConfigSecret(opts.group, key)
      const typed = toStr(form[key])
      baseline.value = { ...baseline.value, [key]: value }
      revealed[key] = true
      if (typed.trim() === '') (form as Record<string, unknown>)[key] = value
    } catch {
      /* toast already shown by the http client */
    } finally {
      revealing[key] = false
    }
  }

  function handleSaveError(e: unknown) {
    if (e instanceof ApiError && e.errors && Object.keys(e.errors).length) {
      const fields = Object.keys(e.errors)
      for (const f of fields) errors[f] = translateValidation(String(e.errors[f]?.[0] ?? '格式不正确'))
      const more = fields.length > 1 ? `（另有 ${fields.length - 1} 项）` : ''
      message.error(`保存失败：${label(fields[0])}${errors[fields[0]]}${more}`)
      return
    }
    message.error(`保存失败：${e instanceof Error ? e.message : '未知错误'}`)
  }

  // Held from validation through confirmation, request and reload: Ctrl+S while the
  // confirmation dialog is open must not start a second save.
  let busy = false

  async function save(): Promise<boolean> {
    if (busy || !baseline.value) return false
    busy = true
    try {
      return await runSave()
    } finally {
      busy = false
    }
  }

  async function runSave(): Promise<boolean> {
    const base = baseline.value
    if (!base) return false
    const toSave = dirtyKeys.value.slice()
    if (!toSave.length) {
      message.info('没有需要保存的修改')
      return true
    }
    clearErrors()
    const found = opts.validate?.(form, isDirty) ?? {}
    const bad = Object.keys(found)
    if (bad.length) {
      Object.assign(errors, found)
      const more = bad.length > 1 ? `（另有 ${bad.length - 1} 项）` : ''
      message.error(`请先修正：${label(bad[0])} ${found[bad[0]]}${more}`)
      return false
    }

    const payload: Record<string, unknown> = {}
    for (const k of toSave) payload[k] = payloadOf(k, form)
    const ctx: SaveContext<F> = { form, baseline: base, keys: toSave, payload, has: (k) => toSave.includes(k) }
    if (opts.beforeSave && !(await opts.beforeSave(ctx))) return false

    saving.value = true
    try {
      await saveConfig(payload)
    } catch (e) {
      handleSaveError(e)
      return false
    } finally {
      saving.value = false
    }
    message.success('保存成功')

    // Treat what we sent as the new baseline (used when not reloading or the refresh fails).
    const markSaved = () => {
      baseline.value = { ...base, ...clone(Object.fromEntries(toSave.map((k) => [k, form[k]]))) } as F
      for (const k of toSave) if (isSecret(k)) revealed[k] = true
    }
    const reload = opts.afterSave ? await opts.afterSave(ctx) : undefined
    if (reload === false || !(await load(true))) markSaved()
    return true
  }

  void load()

  return {
    form,
    baseline,
    loading,
    loadError,
    saving,
    errors,
    revealed,
    revealing,
    dirtyKeys,
    dirtyCount,
    isDirty,
    load,
    save,
    discard,
    restore,
    restoreWhenHidden,
    reveal,
  }
}

export type ConfigFormController<F extends object> = ReturnType<typeof useConfigForm<F>>
