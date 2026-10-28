import { settings } from '@/settings'
import { message } from '@/utils/discrete'
import { authState, clearAuth } from '@/stores/auth'

/**
 * HTTP client for the Xboard API.
 *
 * Response envelopes produced by the backend:
 * - `$this->success($data)`  -> 200 `{ status: 'success', message, data, error }`
 * - `$this->fail([code,msg])` -> 4xx/5xx `{ status: 'fail', message, data, error }`
 * - `$this->paginate($page)` / raw `response()->json([...])` -> no `status` key
 * - validation errors -> 422 `{ message, errors: { field: [msg] } }`
 * - admin middleware -> 403 `{ message: 'Unauthorized' }`
 *
 * `request()` resolves to the *payload*: `body.data` for success envelopes,
 * otherwise the whole body (e.g. `{ data, total }` paginated lists).
 */

export class ApiError extends Error {
  status: number
  body: unknown
  errors?: Record<string, string[]>

  constructor(msg: string, status: number, body: unknown, errors?: Record<string, string[]>) {
    super(msg)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.errors = errors
  }
}

export type QueryValue = string | number | boolean | null | undefined | QueryValue[] | { [k: string]: QueryValue }
export type Query = Record<string, QueryValue>

export interface RequestOptions {
  params?: Query
  data?: unknown
  /** Do not toast errors automatically. */
  silent?: boolean
  /** Return the parsed body without unwrapping `data`. */
  raw?: boolean
  /** Expect a file download; resolves to a Blob. */
  blob?: boolean
  signal?: AbortSignal
}

/** Serialize nested params in PHP bracket style: filter[0][id]=a&filter[0][value]=b */
export function toQueryString(params: Query): string {
  const parts: string[] = []
  const add = (key: string, value: QueryValue) => {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) {
      value.forEach((v, i) => add(`${key}[${i}]`, v))
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => add(`${key}[${k}]`, v))
    } else {
      const v = typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
    }
  }
  Object.entries(params).forEach(([k, v]) => add(k, v))
  return parts.join('&')
}

export function adminUrl(path: string): string {
  return `/api/v2/${settings.securePath}${path.startsWith('/') ? path : '/' + path}`
}

let redirecting = false
function handleUnauthorized() {
  clearAuth()
  if (redirecting) return
  redirecting = true
  const current = window.location.hash.replace(/^#/, '') || '/'
  if (!current.startsWith('/login')) {
    window.location.hash = `#/login?redirect=${encodeURIComponent(current)}`
  }
  setTimeout(() => (redirecting = false), 1000)
}

function errorMessage(body: any, status: number): string {
  if (body && typeof body === 'object') {
    if (body.errors && typeof body.errors === 'object') {
      const first = Object.values(body.errors as Record<string, string[] | string>)[0]
      if (Array.isArray(first) && first.length) return String(first[0])
      if (typeof first === 'string') return first
    }
    if (body.message) return String(body.message)
    if (typeof body.error === 'string' && body.error) return body.error
  }
  if (status === 0) return '网络错误，请检查连接'
  if (status >= 500) return `服务器错误 (${status})`
  return `请求失败 (${status})`
}

export async function request<T = any>(method: string, url: string, opts: RequestOptions = {}): Promise<T> {
  const qs = opts.params ? toQueryString(opts.params) : ''
  const fullUrl = qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (authState.token) headers.Authorization = authState.token

  let body: BodyInit | undefined
  if (opts.data instanceof FormData) {
    body = opts.data
  } else if (opts.data !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.data)
  }

  let res: Response
  try {
    res = await fetch(fullUrl, { method, headers, body, signal: opts.signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    const err = new ApiError('网络错误，请检查连接', 0, null)
    if (!opts.silent) message.error(err.message)
    throw err
  }

  if (opts.blob && res.ok) {
    const type = res.headers.get('content-type') || ''
    if (!type.includes('application/json')) return (await res.blob()) as T
  }

  const text = await res.text()
  let parsed: any = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  // Only auth failures log out; business 403s (e.g. deleting a core plugin) just toast.
  const unauthorized =
    res.status === 401 ||
    (res.status === 403 && (parsed?.message === 'Unauthorized' || parsed?.message === '未登录或登陆已过期'))
  if (unauthorized) {
    handleUnauthorized()
    throw new ApiError('登录已失效，请重新登录', res.status, parsed)
  }

  if (!res.ok || (parsed && typeof parsed === 'object' && parsed.status === 'fail')) {
    const err = new ApiError(errorMessage(parsed, res.status), res.status, parsed, parsed?.errors)
    if (!opts.silent) message.error(err.message)
    throw err
  }

  if (opts.raw) return parsed as T
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'status' in parsed && 'data' in parsed) {
    return parsed.data as T
  }
  return parsed as T
}

/** Admin API (prefixed with /api/v2/{secure_path}). */
export const http = {
  get<T = any>(path: string, params?: Query, opts: Omit<RequestOptions, 'params'> = {}) {
    return request<T>('GET', adminUrl(path), { ...opts, params })
  },
  post<T = any>(path: string, data?: unknown, opts: Omit<RequestOptions, 'data'> = {}) {
    return request<T>('POST', adminUrl(path), { ...opts, data })
  },
  /** multipart upload; `fields` are appended as-is, File values as files. */
  upload<T = any>(path: string, fields: Record<string, string | Blob>, opts: Omit<RequestOptions, 'data'> = {}) {
    const fd = new FormData()
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v))
    return request<T>('POST', adminUrl(path), { ...opts, data: fd })
  },
  /** Download a file response as Blob (GET or POST). */
  download(method: 'GET' | 'POST', path: string, payload?: Query, opts?: Omit<RequestOptions, 'params' | 'data' | 'blob'>) {
    return method === 'GET'
      ? request<Blob>('GET', adminUrl(path), { ...opts, params: payload, blob: true })
      : request<Blob>('POST', adminUrl(path), { ...opts, data: payload, blob: true })
  },
}

/** Non-admin API under /api/v1 or /api/v2 (passport, user info). */
export const publicHttp = {
  get<T = any>(url: string, params?: Query, opts: Omit<RequestOptions, 'params'> = {}) {
    return request<T>('GET', url, { ...opts, params })
  },
  post<T = any>(url: string, data?: unknown, opts: Omit<RequestOptions, 'data'> = {}) {
    return request<T>('POST', url, { ...opts, data })
  },
}
