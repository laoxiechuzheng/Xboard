// localStorage wrapper: can throw in private mode or with blocked site data.
const PREFIX = 'xboard_admin_next:'

export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(PREFIX + key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(PREFIX + key, value)
    } catch {
      /* ignore */
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(PREFIX + key)
    } catch {
      /* ignore */
    }
  },
}
