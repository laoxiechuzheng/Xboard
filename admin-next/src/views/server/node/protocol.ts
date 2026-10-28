// protocol_settings model per node type: form state, defaults, hydration and request whitelist.
// Defaults follow the official admin (so new nodes match nodes created there); the payload contains
// exactly the keys ServerSave validates, so backend-only fields (ss obfs, vmess rules...) survive edits.
import type { NodeType } from '@/api/node'

export interface EchState {
  enabled: boolean
  config: string
  query_server_name: string
  key: string
  [extra: string]: unknown
}

export interface TlsState {
  server_name: string
  allow_insecure: boolean
  ech: EchState
  [extra: string]: unknown
}

export interface UtlsState {
  enabled: boolean
  fingerprint: string
}

export interface MultiplexState {
  enabled: boolean
  protocol: string
  max_connections: number | null
  padding: boolean
  brutal: { enabled: boolean; up_mbps: number | null; down_mbps: number | null }
  [extra: string]: unknown
}

export interface RealityState {
  server_name: string
  server_port: string
  public_key: string
  private_key: string
  short_id: string
  allow_insecure: boolean
  [extra: string]: unknown
}

export type NetworkSettings = Record<string, unknown> | null

export interface NetworkState {
  network: string
  network_settings: NetworkSettings
}

export interface ShadowsocksState {
  cipher: string
  plugin: string
  plugin_opts: string
  /** Backend-only legacy fields, kept as-is (no UI). */
  obfs: string | null
  obfs_settings: Record<string, unknown> | null
}

export interface VmessState extends NetworkState {
  tls: number
  tls_settings: TlsState
  rules: unknown[] | null
  multiplex: MultiplexState
  utls: UtlsState
}

export interface TrojanState extends NetworkState {
  tls: number
  tls_settings: TlsState
  /** Legacy root fields (migrated into tls_settings); passed through untouched. */
  server_name: string | null
  allow_insecure: boolean
  reality_settings: RealityState
  multiplex: MultiplexState
  utls: UtlsState
}

export interface VlessState extends NetworkState {
  tls: number
  tls_settings: TlsState
  flow: string
  encryption: { enabled: boolean; encryption: string; decryption: string }
  reality_settings: RealityState
  multiplex: MultiplexState
  utls: UtlsState
}

export interface HysteriaState {
  version: number
  obfs: { open: boolean; type: string; password: string }
  tls: TlsState
  bandwidth: { up: number | null; down: number | null }
  hop_interval: number | null
}

export interface TuicState {
  version: number
  congestion_control: string
  alpn: string[]
  udp_relay_mode: string
  tls: TlsState
}

/** socks / naive / http */
export interface TlsSwitchState {
  tls: number
  tls_settings: TlsState
}

export interface AnytlsState {
  tls: TlsState
  padding_scheme: string[]
}

export interface MieruState {
  transport: string
  traffic_pattern: string
  /** Backend supports it but the official UI has no entry and the node never receives it; passed through. */
  multiplex: Record<string, unknown> | null
}

export interface ProtocolStateMap {
  shadowsocks: ShadowsocksState
  vmess: VmessState
  trojan: TrojanState
  hysteria: HysteriaState
  vless: VlessState
  tuic: TuicState
  socks: TlsSwitchState
  naive: TlsSwitchState
  http: TlsSwitchState
  mieru: MieruState
  anytls: AnytlsState
}

export type ProtocolState = ProtocolStateMap[NodeType]

// ---- defaults ----

export const ANYTLS_DEFAULT_PADDING = [
  'stop=8',
  '0=30-30',
  '1=100-400',
  '2=400-500,c,500-1000,c,500-1000,c,500-1000,c,500-1000',
  '3=9-9,500-1000',
  '4=500-1000',
  '5=500-1000',
  '6=500-1000',
  '7=500-1000',
]

const ech = (): EchState => ({ enabled: false, config: '', query_server_name: '', key: '' })
const tls = (): TlsState => ({ server_name: '', allow_insecure: false, ech: ech() })
const utls = (): UtlsState => ({ enabled: false, fingerprint: 'chrome' })
const multiplex = (): MultiplexState => ({
  enabled: false,
  protocol: 'smux',
  max_connections: 4,
  padding: false,
  brutal: { enabled: false, up_mbps: 100, down_mbps: 100 },
})
const reality = (): RealityState => ({
  server_name: '',
  server_port: '443',
  public_key: '',
  private_key: '',
  short_id: '',
  allow_insecure: false,
})

export function protocolDefaults<T extends NodeType>(type: T): ProtocolStateMap[T] {
  const map: { [K in NodeType]: () => ProtocolStateMap[K] } = {
    shadowsocks: () => ({ cipher: 'aes-128-gcm', plugin: '', plugin_opts: '', obfs: null, obfs_settings: null }),
    vmess: () => ({
      tls: 0,
      tls_settings: tls(),
      network: 'tcp',
      network_settings: null,
      rules: null,
      multiplex: multiplex(),
      utls: utls(),
    }),
    trojan: () => ({
      tls: 1,
      tls_settings: tls(),
      network: 'tcp',
      network_settings: null,
      server_name: null,
      allow_insecure: false,
      reality_settings: reality(),
      multiplex: multiplex(),
      utls: utls(),
    }),
    vless: () => ({
      tls: 0,
      tls_settings: tls(),
      network: 'tcp',
      network_settings: null,
      flow: '',
      encryption: { enabled: false, encryption: '', decryption: '' },
      reality_settings: reality(),
      multiplex: multiplex(),
      utls: utls(),
    }),
    hysteria: () => ({
      version: 2,
      obfs: { open: false, type: 'salamander', password: '' },
      tls: tls(),
      bandwidth: { up: null, down: null },
      hop_interval: null,
    }),
    tuic: () => ({ version: 5, congestion_control: 'bbr', alpn: ['h3'], udp_relay_mode: 'native', tls: tls() }),
    socks: () => ({ tls: 0, tls_settings: tls() }),
    naive: () => ({ tls: 0, tls_settings: tls() }),
    http: () => ({ tls: 0, tls_settings: tls() }),
    mieru: () => ({ transport: 'TCP', traffic_pattern: '', multiplex: null }),
    anytls: () => ({ tls: tls(), padding_scheme: [] }),
  }
  return map[type]() as ProtocolStateMap[T]
}

// ---- hydration (edit) ----

type Plain = Record<string, unknown>

function isPlain(v: unknown): v is Plain {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T)
}

/**
 * Deep-merge backend values over defaults. Backend `null` means "not set": strings/booleans/objects fall
 * back to the default, numbers keep `null` (empty input) so e.g. multiplex max_connections is not silently
 * changed. Keys unknown to the defaults are preserved.
 */
function mergeValue(def: unknown, raw: unknown): unknown {
  if (raw === undefined) return clone(def)
  if (raw === null) return typeof def === 'number' ? null : clone(def)
  if (isPlain(def)) {
    if (!isPlain(raw)) return clone(def)
    const out: Plain = { ...clone(raw) }
    for (const k of Object.keys(def)) out[k] = mergeValue(def[k], raw[k])
    return out
  }
  if (Array.isArray(def)) return Array.isArray(raw) ? clone(raw) : clone(def)
  if (typeof def === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : clone(def)
  }
  if (typeof def === 'string') return typeof raw === 'string' ? raw : String(raw)
  if (typeof def === 'boolean') return raw === true || raw === 1 || raw === '1'
  return clone(raw)
}

function normalizeNetworkSettings(v: unknown): NetworkSettings {
  if (isPlain(v) && Object.keys(v).length) return clone(v)
  return null
}

export function hydrateProtocol<T extends NodeType>(type: T, raw: unknown): ProtocolStateMap[T] {
  let source: unknown = raw
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source)
    } catch {
      source = null
    }
  }
  const def = protocolDefaults(type)
  if (!isPlain(source)) return def
  const merged = mergeValue(def, source) as Plain
  // Shapes that differ between backend and form.
  if ('network_settings' in def) merged.network_settings = normalizeNetworkSettings(source.network_settings)
  if (isPlain(merged.reality_settings)) {
    const port = (source.reality_settings as Plain | null)?.server_port
    if (port !== null && port !== undefined && port !== '') merged.reality_settings.server_port = String(port)
  }
  if (type === 'shadowsocks') {
    merged.obfs = source.obfs ?? null
    merged.obfs_settings = isPlain(source.obfs_settings) ? clone(source.obfs_settings) : null
  }
  if (type === 'vmess') merged.rules = Array.isArray(source.rules) ? clone(source.rules) : null
  if (type === 'trojan') merged.server_name = typeof source.server_name === 'string' ? source.server_name : null
  if (type === 'mieru') merged.multiplex = isPlain(source.multiplex) ? clone(source.multiplex) : null
  return merged as unknown as ProtocolStateMap[T]
}

// ---- payload (whitelist = ServerSave rules) ----

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v))
const nullableStr = (v: unknown) => str(v) || null
const intOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function echPayload(e: EchState) {
  return {
    enabled: !!e.enabled,
    config: nullableStr(e.config),
    query_server_name: nullableStr(e.query_server_name),
    key: nullableStr(e.key),
  }
}

function tlsPayload(t: TlsState) {
  return { server_name: nullableStr(t.server_name), allow_insecure: !!t.allow_insecure, ech: echPayload(t.ech) }
}

function multiplexPayload(m: MultiplexState) {
  return {
    enabled: !!m.enabled,
    protocol: m.protocol || 'smux',
    max_connections: intOrNull(m.max_connections),
    padding: !!m.padding,
    brutal: {
      enabled: !!m.brutal?.enabled,
      up_mbps: intOrNull(m.brutal?.up_mbps),
      down_mbps: intOrNull(m.brutal?.down_mbps),
    },
  }
}

function realityPayload(r: RealityState) {
  return {
    server_name: nullableStr(r.server_name),
    server_port: intOrNull(r.server_port),
    public_key: nullableStr(r.public_key),
    private_key: nullableStr(r.private_key),
    short_id: nullableStr(r.short_id),
    allow_insecure: !!r.allow_insecure,
  }
}

function networkPayload(s: NetworkState) {
  return { network: s.network, network_settings: normalizeNetworkSettings(s.network_settings) }
}

export function buildProtocolPayload(type: NodeType, state: ProtocolState): Record<string, unknown> {
  switch (type) {
    case 'shadowsocks': {
      const s = state as ShadowsocksState
      const plugin = s.plugin && s.plugin !== 'none' ? s.plugin : null
      return {
        cipher: str(s.cipher),
        plugin,
        plugin_opts: plugin ? nullableStr(s.plugin_opts) : null,
        obfs: s.obfs ?? null,
        obfs_settings: s.obfs_settings ?? null,
      }
    }
    case 'vmess': {
      const s = state as VmessState
      return {
        tls: Number(s.tls),
        tls_settings: tlsPayload(s.tls_settings),
        ...networkPayload(s),
        rules: s.rules ?? null,
        multiplex: multiplexPayload(s.multiplex),
        utls: { ...s.utls },
      }
    }
    case 'trojan': {
      const s = state as TrojanState
      return {
        tls: Number(s.tls),
        tls_settings: tlsPayload(s.tls_settings),
        ...networkPayload(s),
        server_name: s.server_name ?? null,
        allow_insecure: !!s.allow_insecure,
        reality_settings: realityPayload(s.reality_settings),
        multiplex: multiplexPayload(s.multiplex),
        utls: { ...s.utls },
      }
    }
    case 'vless': {
      const s = state as VlessState
      return {
        tls: Number(s.tls),
        tls_settings: tlsPayload(s.tls_settings),
        ...networkPayload(s),
        flow: s.flow && s.flow !== 'none' ? s.flow : null,
        encryption: {
          enabled: !!s.encryption.enabled,
          encryption: nullableStr(s.encryption.encryption),
          decryption: nullableStr(s.encryption.decryption),
        },
        reality_settings: realityPayload(s.reality_settings),
        multiplex: multiplexPayload(s.multiplex),
        utls: { ...s.utls },
      }
    }
    case 'hysteria': {
      const s = state as HysteriaState
      return {
        version: Number(s.version),
        obfs: { open: !!s.obfs.open, type: s.obfs.type || 'salamander', password: nullableStr(s.obfs.password) },
        tls: tlsPayload(s.tls),
        bandwidth: { up: intOrNull(s.bandwidth.up), down: intOrNull(s.bandwidth.down) },
        hop_interval: intOrNull(s.hop_interval),
      }
    }
    case 'tuic': {
      const s = state as TuicState
      return {
        version: Number(s.version),
        congestion_control: s.congestion_control,
        alpn: [...s.alpn],
        udp_relay_mode: s.udp_relay_mode,
        tls: tlsPayload(s.tls),
      }
    }
    case 'socks':
    case 'naive':
    case 'http': {
      const s = state as TlsSwitchState
      return { tls: Number(s.tls), tls_settings: tlsPayload(s.tls_settings) }
    }
    case 'anytls': {
      const s = state as AnytlsState
      return { tls: tlsPayload(s.tls), padding_scheme: s.padding_scheme.map((l) => l.trim()).filter(Boolean) }
    }
    case 'mieru': {
      const s = state as MieruState
      const out: Record<string, unknown> = { transport: s.transport }
      // `traffic_pattern` is `string` (not nullable): an empty value would become null and fail validation.
      if (str(s.traffic_pattern)) out.traffic_pattern = str(s.traffic_pattern)
      if (s.multiplex) out.multiplex = s.multiplex
      return out
    }
  }
}

/** Multiplex state of the current settings, if the type has one in the form. */
export function multiplexOf(type: NodeType | null, state: ProtocolState | null): MultiplexState | null {
  if (!type || !state || !['vmess', 'vless', 'trojan'].includes(type)) return null
  return (state as VmessState).multiplex ?? null
}

// ---- network templates ----

export interface NetworkTemplate {
  label: string
  value: Record<string, unknown>
}

export const NETWORK_TEMPLATES: Record<string, NetworkTemplate[]> = {
  tcp: [
    { label: 'TCP', value: { acceptProxyProtocol: false, header: { type: 'none' } } },
    {
      label: 'TCP + HTTP',
      value: {
        acceptProxyProtocol: false,
        header: {
          type: 'http',
          request: { version: '1.1', method: 'GET', path: ['/'], headers: { Host: ['www.example.com'] } },
          response: { version: '1.1', status: '200', reason: 'OK' },
        },
      },
    },
  ],
  grpc: [{ label: 'gRPC', value: { serviceName: 'GunService' } }],
  ws: [{ label: 'WebSocket', value: { path: '/', headers: { Host: 'v2ray.com' } } }],
  h2: [{ label: 'HTTP/2', value: { path: '/', host: ['www.google.com'] } }],
  httpupgrade: [
    { label: 'HttpUpgrade', value: { acceptProxyProtocol: false, path: '/', host: 'xray.com', headers: { key: 'value' } } },
  ],
  xhttp: [
    {
      label: 'XHTTP',
      value: {
        host: 'example.com',
        path: '/yourpath',
        mode: 'auto',
        extra: {
          headers: {},
          xPaddingBytes: '100-1000',
          noGRPCHeader: false,
          noSSEHeader: false,
          scMaxEachPostBytes: 1000000,
          scMinPostsIntervalMs: 30,
          scMaxBufferedPosts: 30,
          xmux: {
            maxConcurrency: '16-32',
            maxConnections: 0,
            cMaxReuseTimes: '64-128',
            cMaxLifetimeMs: 0,
            hMaxRequestTimes: '800-900',
            hKeepAlivePeriod: 0,
          },
          downloadSettings: {
            address: '',
            port: 443,
            network: 'xhttp',
            security: 'tls',
            tlsSettings: {},
            xhttpSettings: { path: '/yourpath' },
            sockopt: {},
          },
        },
      },
    },
  ],
}

const NET_BASE = [
  { label: 'TCP', value: 'tcp' },
  { label: 'Websocket', value: 'ws' },
  { label: 'gRPC', value: 'grpc' },
  { label: 'HTTP/2', value: 'h2' },
]
const NET_TAIL = [
  { label: 'HttpUpgrade', value: 'httpupgrade' },
  { label: 'XHTTP', value: 'xhttp' },
]
export const VMESS_NETWORKS = [...NET_BASE, ...NET_TAIL]
export const TROJAN_NETWORKS = [...NET_BASE, ...NET_TAIL]
export const VLESS_NETWORKS = [...NET_BASE, { label: 'mKCP', value: 'kcp' }, ...NET_TAIL]

export const UTLS_FINGERPRINTS = [
  { label: 'Chrome', value: 'chrome' },
  { label: 'Firefox', value: 'firefox' },
  { label: 'Safari', value: 'safari' },
  { label: 'iOS', value: 'ios' },
  { label: 'Edge', value: 'edge' },
  { label: 'Random', value: 'random' },
]
