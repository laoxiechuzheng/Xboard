// Shared helpers for the dashboard and the system status page.
import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import { ApiError } from '@/api/http'
import { relativeTime } from '@/utils/format'

export interface AsyncState<T> {
  data: ShallowRef<T | null>
  loading: Ref<boolean>
  /** Last error message; cleared on the next success. Old data is kept on failure. */
  error: Ref<string>
  /** HTTP status of the last error (0 for network errors). */
  errorStatus: Ref<number | null>
  /** Date.now() of the last successful load; 0 until the first success. */
  lastSuccess: Ref<number>
  run: () => Promise<void>
}

export interface AsyncStateOptions<T> {
  /** Return true to keep the current data object when a reload returns equal data (avoids re-renders / chart redraws). */
  same?: (prev: T, next: T) => boolean
}

/** Structural equality for plain JSON responses. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Latest-wins async loader; errors are captured instead of thrown. */
export function useAsyncState<T>(fetcher: () => Promise<T>, options: AsyncStateOptions<T> = {}): AsyncState<T> {
  const data = shallowRef<T | null>(null)
  const loading = ref(false)
  const error = ref('')
  const errorStatus = ref<number | null>(null)
  const lastSuccess = ref(0)
  let seq = 0

  async function run() {
    const mine = ++seq
    loading.value = true
    try {
      const res = await fetcher()
      if (mine !== seq) return
      const prev = data.value
      if (prev === null || !options.same?.(prev, res)) data.value = res
      error.value = ''
      errorStatus.value = null
      lastSuccess.value = Date.now()
    } catch (e) {
      if (mine !== seq) return
      error.value = e instanceof Error && e.message ? e.message : '加载失败'
      errorStatus.value = e instanceof ApiError ? e.status : null
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  return { data, loading, error, errorStatus, lastSuccess, run }
}

/**
 * Run `fn` on mount and every `interval` ms while the page is visible;
 * catches up immediately when the tab becomes visible again after a missed tick.
 */
export function usePolling(fn: () => unknown, interval: number, immediate = true) {
  let timer: number | undefined
  let last = 0

  const exec = (): Promise<void> => {
    last = Date.now()
    return Promise.resolve(fn()).then(
      () => undefined,
      () => undefined,
    )
  }
  const tick = () => {
    if (document.visibilityState === 'hidden') return
    void exec()
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible' && Date.now() - last >= interval) void exec()
  }

  onMounted(() => {
    if (immediate) void exec()
    timer = window.setInterval(tick, interval)
    document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })

  /** Manual refresh that also resets the interval phase; resolves when done. */
  return (): Promise<void> => {
    window.clearInterval(timer)
    timer = window.setInterval(tick, interval)
    return exec()
  }
}

// ---------------------------------------------------------------- UTC+8 dates
// Server statistics use Asia/Shanghai day boundaries; compute them independent of the browser zone.

const DAY_MS = 86_400_000
const CN_OFFSET_MS = 8 * 3_600_000

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

/** Beijing calendar date "YYYY-MM-DD", shifted by `offsetDays`. */
export function cnDate(offsetDays = 0, now = Date.now()): string {
  return new Date(now + CN_OFFSET_MS + offsetDays * DAY_MS).toISOString().slice(0, 10)
}

/** Add days to a "YYYY-MM-DD" date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Unix seconds of Beijing midnight for "YYYY-MM-DD". */
export function cnMidnight(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return (Date.UTC(y, m - 1, d) - CN_OFFSET_MS) / 1000
}

/** Naive date picker value (local midnight ms) → "YYYY-MM-DD" as shown in the picker. */
export function pickerToDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "YYYY-MM-DD" → local midnight ms for the Naive date picker. */
export function dateToPicker(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** Default custom range: Beijing today − 7 days … today, as picker values. */
export function defaultPickerRange(): [number, number] {
  return [dateToPicker(cnDate(-7)), dateToPicker(cnDate(0))]
}

/** Disable dates after Beijing today in range pickers. */
export function isFutureDate(ms: number): boolean {
  return pickerToDate(ms) > cnDate(0)
}

/** relativeTime() that tolerates a server clock slightly ahead of the browser ("刚刚" instead of a date). */
export function sinceText(ts: number | null | undefined): string {
  if (!ts) return '-'
  const diff = Date.now() / 1000 - ts
  return diff < 0 && diff > -300 ? '刚刚' : relativeTime(ts)
}

/** Clock time "HH:mm:ss" for "updated at" hints. */
export function clockTime(d = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ---------------------------------------------------------------- colors

/** Apply alpha to a #rgb/#rrggbb/rgb()/rgba() color (canvas cannot use color-mix). */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim()
  let r: number, g: number, b: number
  if (c.startsWith('#')) {
    let hex = c.slice(1)
    if (hex.length === 3 || hex.length === 4) hex = hex.slice(0, 3).split('').map((x) => x + x).join('')
    if (hex.length < 6) return c
    r = parseInt(hex.slice(0, 2), 16)
    g = parseInt(hex.slice(2, 4), 16)
    b = parseInt(hex.slice(4, 6), 16)
  } else {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return c
    const parts = m[1].split(',').map((x) => parseFloat(x))
    ;[r, g, b] = parts
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
