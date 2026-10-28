import { reactive } from 'vue'
import { storage } from '@/utils/storage'

export interface AdminUserInfo {
  email: string
  avatar_url?: string
  [key: string]: unknown
}

// The official admin (same origin, /{secure_path}) stores its token under this key as
// {"value":"Bearer ...","time":<ms>,"expire":<ms>}. Sharing it lets admins switch between
// the two consoles without logging in again (spec core §5.2 / §10).
const LEGACY_TOKEN_KEY = 'XBOARD_ACCESS_TOKEN'
const LEGACY_TTL_MS = 3 * 24 * 3600 * 1000

function readLegacyToken(): string {
  try {
    const raw = window.localStorage.getItem(LEGACY_TOKEN_KEY)
    if (!raw) return ''
    const v = JSON.parse(raw) as { value?: string; expire?: number }
    if (!v?.value || (v.expire && v.expire < Date.now())) return ''
    return v.value
  } catch {
    return ''
  }
}

function writeLegacyToken(token: string) {
  try {
    const now = Date.now()
    window.localStorage.setItem(LEGACY_TOKEN_KEY, JSON.stringify({ value: token, time: now, expire: now + LEGACY_TTL_MS }))
  } catch {
    /* ignore */
  }
}

function removeLegacyToken() {
  try {
    window.localStorage.removeItem(LEGACY_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export const authState = reactive({
  /** Full Authorization header value, e.g. "Bearer abc..." (backend `auth_data`). */
  token: storage.get('auth_data') || readLegacyToken(),
  user: null as AdminUserInfo | null,
})

export function setAuth(token: string) {
  authState.token = token
  storage.set('auth_data', token)
  writeLegacyToken(token)
}

export function clearAuth() {
  authState.token = ''
  authState.user = null
  storage.remove('auth_data')
  removeLegacyToken()
}

export function isLoggedIn(): boolean {
  return !!authState.token
}
