// Display helpers for the system status page and Horizon failed jobs.
import { formatTime } from '@/utils/format'

/** failed_at is "seconds.fraction" as a string; 10-digit integer part = seconds, else ms. */
export function formatFailedAt(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = parseInt(String(v), 10)
  if (!Number.isFinite(n)) return String(v)
  return formatTime(String(n).length === 10 ? n : Math.floor(n / 1000))
}

/** First line of an exception string. */
export function firstLine(s: string | null | undefined): string {
  return (s || '').split(/\r?\n/, 1)[0] || '—'
}

/** Pretty-print a JSON string; fall back to the raw text. */
export function prettyJson(s: string | null | undefined): string {
  if (s === null || s === undefined) return ''
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return String(s)
  }
}

/** Seconds → "45 秒" / "3 分 5 秒" / "2 小时 10 分". */
export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s} 秒`
  if (s < 3600) return `${Math.floor(s / 60)} 分 ${s % 60} 秒`
  return `${Math.floor(s / 3600)} 小时 ${Math.floor((s % 3600) / 60)} 分`
}
