// Formatting helpers shared by all pages.
// Backend conventions: traffic in bytes, money in cents (分), timestamps in unix seconds.

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
export const GB = 1024 ** 3

export function formatBytes(bytes: number | string | null | undefined, digits = 2): string {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), BYTE_UNITS.length - 1)
  // Same as the official admin: drop trailing zeros (1.5 GB, not 1.50 GB).
  return `${parseFloat((n / 1024 ** i).toFixed(i === 0 ? 0 : digits))} ${BYTE_UNITS[i]}`
}

export function bytesToGB(bytes: number | string | null | undefined, digits = 2): number {
  const n = Number(bytes)
  if (!Number.isFinite(n)) return 0
  return Number((n / GB).toFixed(digits))
}

export function gbToBytes(gb: number | string | null | undefined): number {
  const n = Number(gb)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * GB)
}

/** cents -> yuan string with 2 decimals */
export function formatMoney(cents: number | string | null | undefined, withSymbol = true): string {
  const n = Number(cents)
  const v = Number.isFinite(n) ? (n / 100).toFixed(2) : '0.00'
  return withSymbol ? `¥${v}` : v
}

export function centsToYuan(cents: number | string | null | undefined): number | null {
  if (cents === null || cents === undefined || cents === '') return null
  const n = Number(cents)
  return Number.isFinite(n) ? Number((n / 100).toFixed(2)) : null
}

export function yuanToCents(yuan: number | string | null | undefined): number | null {
  if (yuan === null || yuan === undefined || yuan === '') return null
  const n = Number(yuan)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

/** unix seconds (or ms if > 1e12) -> 'YYYY-MM-DD HH:mm:ss' */
export function formatTime(ts: number | string | null | undefined, withSeconds = true): string {
  if (ts === null || ts === undefined || ts === '' || Number(ts) === 0) return '-'
  let n = Number(ts)
  if (!Number.isFinite(n)) {
    const d = new Date(String(ts))
    if (Number.isNaN(d.getTime())) return String(ts)
    n = d.getTime()
  } else if (n < 1e12) {
    n *= 1000
  }
  const d = new Date(n)
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}${withSeconds ? ':' + pad(d.getSeconds()) : ''}`
  return `${date} ${time}`
}

export function formatDate(ts: number | string | null | undefined): string {
  const s = formatTime(ts)
  return s === '-' ? s : s.slice(0, 10)
}

/** "3 分钟前" style relative time for unix seconds. */
export function relativeTime(ts: number | string | null | undefined): string {
  const n = Number(ts)
  if (!n) return '-'
  const diff = Math.floor(Date.now() / 1000) - (n > 1e12 ? Math.floor(n / 1000) : n)
  // Tolerate a server clock slightly ahead of the browser.
  if (diff < -300) return formatTime(n)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  return formatTime(n)
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/** ms timestamp (naive-ui pickers) <-> unix seconds */
export function msToSeconds(ms: number | null | undefined): number | null {
  return ms === null || ms === undefined ? null : Math.floor(ms / 1000)
}
export function secondsToMs(s: number | string | null | undefined): number | null {
  if (s === null || s === undefined || s === '' || Number(s) === 0) return null
  return Number(s) * 1000
}

export function formatNumber(n: number | string | null | undefined): string {
  const v = Number(n)
  return Number.isFinite(v) ? v.toLocaleString('zh-CN') : '0'
}
