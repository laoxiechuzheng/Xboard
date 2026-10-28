// Plugin endpoints (PluginController) and the admin_crud request protocol. Spec platform §3, §4.4.
// The plugin list itself is loaded through the shared store (`@/stores/plugins`) so the sidebar stays in sync.
import { http, type Query, type RequestOptions } from '@/api/http'
import type { PluginInfo, PluginAdminMenu } from '@/stores/plugins'

type Opts = Pick<RequestOptions, 'silent'>

export type { PluginAdminMenu }

export type PluginType = 'feature' | 'payment' | string

export interface PluginTypeOption {
  value: PluginType
  label: string
  description?: string
  icon?: string
}

export interface PluginSelectOption {
  value: string
  label: string
}

/** A config.json `config` item (uninstalled), a `plugin/config` item (installed) or an admin_crud form field. */
export interface PluginConfigItem {
  type: 'string' | 'number' | 'percentage' | 'select' | 'boolean' | 'text' | 'json' | 'yaml' | string
  label?: string
  placeholder?: string
  description?: string
  /** Present for installed plugins (`DB value ?? default`) and admin_crud forms. */
  value?: unknown
  /** Present in the raw config.json (uninstalled plugins). */
  default?: unknown
  /** Array form is documented; the object map form is tolerated too. */
  options?: PluginSelectOption[] | Record<string, string>
  /** Only meaningful in admin_crud forms (plugin/config never returns it). */
  required?: boolean
}

export type PluginConfigSchema = Record<string, PluginConfigItem>

export type CrudTagVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export interface PluginCrudColumn {
  key: string
  title?: string
  type?: 'string' | 'number' | 'boolean' | 'tag' | 'datetime' | string
  sortable?: boolean
  searchable?: boolean
  width?: number
  options?: { value: string | number; label?: string; variant?: CrudTagVariant }[]
}

export interface PluginCrudSchema {
  version?: number
  title?: string
  description?: string
  id_field?: string
  api?: { list?: string; save?: string; delete?: string }
  columns?: PluginCrudColumn[]
  form?: PluginConfigSchema
  actions?: { create?: boolean; edit?: boolean; delete?: boolean }
}

/** `GET plugin/getPlugins` item with the fields the admin pages rely on. */
export interface PluginDetail extends PluginInfo {
  description: string
  author: string
  type: PluginType
  is_protected: boolean
  can_be_deleted: boolean
  /** Installed: structured items with `value`; not installed: raw config.json; none: `[]`. */
  config: PluginConfigSchema | unknown[] | null
  readme: string
  need_upgrade: boolean
  admin_menus: PluginAdminMenu[] | null
  admin_crud: Record<string, PluginCrudSchema> | null
}

/** Message-only responses (`response()->json(['message' => ...])`). */
export interface PluginMessage {
  message: string
}

/** Fixed list; also used as fallback when the request fails. */
export const DEFAULT_PLUGIN_TYPES: PluginTypeOption[] = [
  { value: 'feature', label: '功能', description: '提供功能扩展的插件，如Telegram登录、邮件通知等', icon: '🔧' },
  { value: 'payment', label: '支付方式', description: '提供支付接口的插件，如支付宝、微信支付等', icon: '💳' },
]

/** GET /plugin/types -> raw `{ data: [...] }`. */
export async function getPluginTypes(opts: Opts = {}): Promise<PluginTypeOption[]> {
  const res = await http.get<{ data: PluginTypeOption[] }>('/plugin/types', undefined, opts)
  return Array.isArray(res?.data) ? res.data : []
}

export type PluginAction = 'install' | 'uninstall' | 'enable' | 'disable' | 'upgrade' | 'delete'

/** POST /plugin/{action} `{ code }` -> `{ message }`; failures are 400/403 `{ message }` (500 for disable). */
export function pluginAction(action: PluginAction, code: string, opts: Opts = {}) {
  return http.post<PluginMessage>(`/plugin/${action}`, { code }, opts)
}

/** multipart `file`; a higher version of an installed plugin is upgraded right away. */
export function uploadPlugin(file: File, opts: Opts = {}) {
  return http.upload<PluginMessage>('/plugin/upload', { file }, opts)
}

/** GET /plugin/config?code= -> raw `{ data }`; `data` is `[]` when the plugin declares no config. */
export async function getPluginConfig(code: string, opts: Opts = {}): Promise<PluginConfigSchema> {
  const res = await http.get<{ data: PluginConfigSchema | unknown[] }>('/plugin/config', { code }, opts)
  return normalizeSchema(res?.data)
}

/** Overwrites the stored config with the submitted keys (unknown keys dropped) — always send every key. */
export function savePluginConfig(code: string, config: Record<string, unknown>, opts: Opts = {}) {
  return http.post<PluginMessage>('/plugin/config', { code, config }, opts)
}

/** `[]` / null / non-object -> `{}` */
export function normalizeSchema(v: unknown): PluginConfigSchema {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as PluginConfigSchema) : {}
}

// ---------------------------------------------------------------- admin_crud protocol

export interface CrudListQuery {
  current: number
  pageSize: number
  search?: string
  sort_field?: string
  sort_order?: 'asc' | 'desc'
}

export interface CrudListResult {
  data: Record<string, unknown>[]
  total: number
}

/** GET {api.list}?current&pageSize[&search][&sort_field&sort_order] -> `{ data, total }`. */
export async function crudList(path: string, query: CrudListQuery, opts: Opts = {}): Promise<CrudListResult> {
  const res = await http.get<unknown>(path, query as unknown as Query, opts)
  const body = (res && typeof res === 'object' ? res : {}) as { data?: unknown; total?: unknown }
  const rows = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : Array.isArray(res) ? (res as Record<string, unknown>[]) : []
  const total = Number(body.total)
  return { data: rows, total: Number.isFinite(total) ? total : rows.length }
}

/** POST {api.save}: create = form values; edit = `{ [id_field]: id, ...form values }`. */
export function crudSave(path: string, body: Record<string, unknown>, opts: Opts = {}) {
  return http.post<unknown>(path, body, opts)
}

/** POST {api.delete} `{ [id_field]: id }`. */
export function crudDelete(path: string, body: Record<string, unknown>, opts: Opts = {}) {
  return http.post<unknown>(path, body, opts)
}
