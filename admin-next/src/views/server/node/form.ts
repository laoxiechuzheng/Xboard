// Node form state <-> API mapping (kept framework-free so the request body can be tested directly).
import type { CertConfig, NodeSavePayload, NodeType, ServerNode } from '@/api/node'
import { buildProtocolPayload, hydrateProtocol, protocolDefaults, type ProtocolState } from './protocol'

const GB = 1024 ** 3

export interface RateRangeState {
  start: string
  end: string
  rate: number | null
}

export interface NodeFormState {
  type: NodeType | null
  name: string
  rate: number | null
  rate_time_enable: boolean
  rate_time_ranges: RateRangeState[]
  transfer_enable_gb: number | null
  code: string
  tags: string[]
  group_ids: string[]
  host: string
  port: string
  server_port: string
  protocol_settings: ProtocolState | null
  /** 0 = no parent */
  parent_id: number
  route_ids: string[]
  machine_id: number | null
  enabled: boolean | null
  custom_outbounds: unknown[]
  custom_routes: unknown[]
  cert_config: CertConfig | null
}

/** Values loaded for edit, used to avoid silent changes (rounded GB, code warning). */
export interface FormOriginal {
  id: number
  code: string
  transferBytes: number
  transferGb: number
  type: NodeType
  /** protocol_settings as returned by getNodes. */
  protocol: Record<string, unknown> | null
}

export function blankForm(): NodeFormState {
  return {
    type: null,
    name: '',
    rate: 1,
    rate_time_enable: false,
    rate_time_ranges: [],
    transfer_enable_gb: null,
    code: '',
    tags: [],
    group_ids: [],
    host: '',
    port: '',
    server_port: '',
    protocol_settings: null,
    parent_id: 0,
    route_ids: [],
    machine_id: null,
    enabled: null,
    custom_outbounds: [],
    custom_routes: [],
    cert_config: null,
  }
}

function toNumber(v: unknown, fallback: number | null = null): number | null {
  const n = Number(v)
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? fallback : n
}

const cloneJson = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export function formFromNode(n: ServerNode): { form: NodeFormState; original: FormOriginal } {
  const transfer = Number(n.transfer_enable || 0)
  const gb = transfer > 0 ? Number((transfer / GB).toFixed(2)) : 0
  const form: NodeFormState = {
    type: n.type,
    name: n.name ?? '',
    rate: toNumber(n.rate, 1),
    rate_time_enable: !!n.rate_time_enable,
    rate_time_ranges: (n.rate_time_ranges ?? []).map((r) => ({
      start: String(r.start ?? ''),
      end: String(r.end ?? ''),
      rate: toNumber(r.rate, 1),
    })),
    transfer_enable_gb: gb,
    code: n.code ?? '',
    tags: [...(n.tags ?? [])],
    group_ids: (n.group_ids ?? []).map(String),
    host: n.host ?? '',
    port: String(n.port ?? ''),
    server_port: String(n.server_port ?? ''),
    protocol_settings: hydrateProtocol(n.type, n.protocol_settings),
    parent_id: Number(n.parent_id || 0),
    route_ids: (n.route_ids ?? []).map(String),
    machine_id: n.machine_id ?? null,
    enabled: n.enabled ?? null,
    custom_outbounds: Array.isArray(n.custom_outbounds) ? cloneJson(n.custom_outbounds) : [],
    custom_routes: Array.isArray(n.custom_routes) ? cloneJson(n.custom_routes) : [],
    cert_config: n.cert_config && typeof n.cert_config === 'object' && !Array.isArray(n.cert_config) ? cloneJson(n.cert_config) : null,
  }
  return {
    form,
    original: {
      id: n.id,
      code: n.code ?? '',
      transferBytes: transfer,
      transferGb: gb,
      type: n.type,
      protocol: n.protocol_settings && typeof n.protocol_settings === 'object' ? cloneJson(n.protocol_settings) : null,
    },
  }
}

type Plain = Record<string, unknown>
const isPlain = (v: unknown): v is Plain => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Sub-objects that were `null` in the stored node (never configured) and are still untouched defaults are
 * sent back as `null`, so opening and saving a node does not materialize disabled multiplex/uTLS/Reality blocks.
 */
function restoreNulls(payload: Plain, orig: Plain, defaults: Plain) {
  for (const k of Object.keys(payload)) {
    const p = payload[k]
    const o = orig[k]
    const d = defaults[k]
    if (!isPlain(p) || !isPlain(d)) continue
    if (o === null && JSON.stringify(p) === JSON.stringify(d)) payload[k] = null
    else if (isPlain(o)) restoreNulls(p, o, d)
  }
}

/**
 * Request body for POST /server/manage/save. Normalizes per spec: string id arrays, numeric parent/rates,
 * whitelisted protocol_settings; `show:false` only on create (edit leaves the list toggle alone).
 */
export function buildSavePayload(form: NodeFormState, original: FormOriginal | null): NodeSavePayload {
  const type = form.type as NodeType
  const gb = Number(form.transfer_enable_gb || 0)
  let transfer = gb > 0 ? Math.round(gb * GB) : 0
  // Keep the exact byte value when the (rounded) GB field was not touched.
  if (original && form.transfer_enable_gb === original.transferGb) transfer = original.transferBytes
  const payload: NodeSavePayload = {
    type,
    name: form.name.trim(),
    code: form.code.trim() || null,
    rate: Number(form.rate),
    rate_time_enable: form.rate_time_enable,
    rate_time_ranges: form.rate_time_ranges.map((r) => ({ start: r.start, end: r.end, rate: Number(r.rate) })),
    transfer_enable: transfer,
    tags: form.tags.map((t) => t.trim()).filter(Boolean),
    group_ids: form.group_ids.map(String),
    route_ids: form.route_ids.map(String),
    host: form.host.trim(),
    port: form.port.trim(),
    server_port: Number(form.server_port.trim()),
    parent_id: form.parent_id || 0,
    machine_id: form.machine_id,
    enabled: form.machine_id ? (form.enabled ?? true) : form.enabled,
    custom_outbounds: form.custom_outbounds,
    custom_routes: form.custom_routes,
    protocol_settings: buildProtocolPayload(type, form.protocol_settings as ProtocolState),
  }
  if (original?.protocol && original.type === type) {
    restoreNulls(payload.protocol_settings, original.protocol, buildProtocolPayload(type, protocolDefaults(type)))
  }
  if (form.cert_config) payload.cert_config = form.cert_config
  if (original) payload.id = original.id
  else payload.show = false
  return payload
}
