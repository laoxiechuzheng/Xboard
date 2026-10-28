// Display helpers for coupons (spec commerce §5.3) and the batch CSV (§5.7).
import type { Coupon } from '@/api/coupon'
import { formatMoney } from '@/utils/format'

const DAY = 86400000

export type ValidityState = 'expired' | 'pending' | 'active'

export interface Validity {
  state: ValidityState
  text: string
  tagType: 'error' | 'warning' | 'success'
}

/** Status of the validity window relative to now. */
export function couponValidity(c: Pick<Coupon, 'started_at' | 'ended_at'>, now = Date.now()): Validity {
  const start = Number(c.started_at) * 1000
  const end = Number(c.ended_at) * 1000
  if (now > end) {
    const days = Math.floor((now - end) / DAY)
    return { state: 'expired', text: days >= 1 ? `已过期 ${days} 天` : '已过期', tagType: 'error' }
  }
  if (now < start) {
    return { state: 'pending', text: `${Math.ceil((start - now) / DAY)} 天后开始`, tagType: 'warning' }
  }
  return { state: 'active', text: `剩余 ${Math.ceil((end - now) / DAY)} 天`, tagType: 'success' }
}

export function couponValueText(c: Pick<Coupon, 'type' | 'value'>): string {
  return Number(c.type) === 2 ? `${Number(c.value)}%` : formatMoney(c.value)
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

/** unix seconds -> 'MM/dd HH:mm' */
export function shortTime(ts: number): string {
  const d = new Date(Number(ts) * 1000)
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * The backend writes the batch CSV without quoting (a comma in the name shifts columns)
 * and without a BOM. Its last 8 columns are fixed, so split from the right.
 */
export const BATCH_CSV_HEADER = ['名称', '类型', '金额或比例', '开始时间', '结束时间', '可用次数', '可用于订阅', '券码', '生成时间']

/** Non-empty data lines of the backend CSV (header and BOM dropped). */
function batchCsvBody(text: string): string[] {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
  if (!lines.length) return []
  return lines[0].startsWith('名称,') ? lines.slice(1) : lines
}

export function parseBatchCsv(text: string): string[][] {
  return batchCsvBody(text)
    .map((line) => {
      const parts = line.split(',')
      if (parts.length < 9) return null
      const tail = parts.slice(parts.length - 8)
      return [parts.slice(0, parts.length - 8).join(','), ...tail]
    })
    .filter((r): r is string[] => !!r)
}

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** RFC 4180 CSV with a UTF-8 BOM so Excel opens Chinese text correctly. */
export function buildCsv(rows: string[][], header = BATCH_CSV_HEADER): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/**
 * File content for the batch CSV download: normalized when every data line parses,
 * otherwise the backend text as-is (plus BOM) so no code is ever lost to a format change.
 */
export function batchCsvFile(text: string): string {
  const rows = parseBatchCsv(text)
  if (rows.length && rows.length === batchCsvBody(text).length) return buildCsv(rows)
  return '﻿' + text.replace(/^﻿/, '')
}
