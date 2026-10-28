// Data source abstraction for the admin_crud table: the plugin runtime talks to the plugin's own
// endpoints (spec platform §4.4.2); the CRUD demo page plugs in an in-memory source.
import { crudDelete, crudList, crudSave, type CrudListQuery, type CrudListResult, type PluginCrudSchema } from '@/api/plugin'
import { message } from '@/utils/discrete'

export interface CrudSource {
  list(q: CrudListQuery): Promise<CrudListResult>
  save(body: Record<string, unknown>, mode: 'create' | 'edit'): Promise<unknown>
  remove(body: Record<string, unknown>): Promise<unknown>
}

function missing(what: string): Promise<never> {
  const msg = `该页面的 Schema 未声明 ${what}`
  message.error(msg)
  return Promise.reject(new Error(msg))
}

/** Endpoints are relative to the admin prefix (/api/v2/{secure_path}), exactly like the official runtime. */
export function serverCrudSource(schema: PluginCrudSchema): CrudSource {
  const api = schema.api || {}
  return {
    // List errors are shown inline by the table instead of a toast.
    list: (q) => (api.list ? crudList(api.list, q, { silent: true }) : Promise.reject(new Error('该页面的 Schema 未声明 api.list'))),
    save: (body) => (api.save ? crudSave(api.save, body) : missing('api.save')),
    remove: (body) => (api.delete ? crudDelete(api.delete, body) : missing('api.delete')),
  }
}

// ---------------------------------------------------------------- in-memory source (demo page)

type Row = Record<string, unknown>

/** A request the server runtime would have sent for the same interaction. */
export interface CrudRequestLog {
  seq: number
  method: 'GET' | 'POST'
  path: string
  payload: Record<string, unknown>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(!!a) - Number(!!b)
  return String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN', { numeric: true })
}

/**
 * Client-side paging / search (searchable columns, case-insensitive) / sort over `rows`, with the
 * official demo's simulated latency (save 400 ms, delete 300 ms). New ids start at `firstId`.
 */
export function memoryCrudSource(
  schema: PluginCrudSchema,
  rows: Row[],
  opts: { firstId?: number; onRequest?: (log: CrudRequestLog) => void } = {},
): CrudSource {
  const idField = schema.id_field || 'id'
  const api = schema.api || {}
  const searchKeys = (schema.columns || []).filter((c) => c.searchable).map((c) => c.key)
  let nextId = opts.firstId ?? 100
  let seq = 0
  const log = (method: CrudRequestLog['method'], path: string | undefined, payload: Record<string, unknown>) =>
    opts.onRequest?.({ seq: ++seq, method, path: path || '(未声明)', payload: { ...payload } })

  return {
    async list(q) {
      log('GET', api.list, { ...q })
      let list = [...rows]
      const kw = (q.search || '').trim().toLowerCase()
      if (kw && searchKeys.length) {
        list = list.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(kw)))
      }
      if (q.sort_field) {
        const f = q.sort_field
        const dir = q.sort_order === 'desc' ? -1 : 1
        list.sort((a, b) => compare(a[f], b[f]) * dir)
      }
      const start = (q.current - 1) * q.pageSize
      return { data: list.slice(start, start + q.pageSize), total: list.length }
    },
    async save(body, mode) {
      log('POST', api.save, body)
      await sleep(400)
      if (mode === 'edit') {
        const i = rows.findIndex((r) => r[idField] === body[idField])
        if (i < 0) throw new Error('记录不存在')
        rows[i] = { ...rows[i], ...body }
      } else {
        rows.unshift({ ...body, [idField]: nextId++, created_at: Math.floor(Date.now() / 1000) })
      }
      return true
    },
    async remove(body) {
      log('POST', api.delete, body)
      await sleep(300)
      const i = rows.findIndex((r) => r[idField] === body[idField])
      if (i >= 0) rows.splice(i, 1)
      return true
    },
  }
}
