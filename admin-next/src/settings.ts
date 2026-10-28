// Runtime settings injected by resources/views/admin-next.blade.php.
// In `vite dev` there is no blade shell, so fall back to VITE_SECURE_PATH
// (dev only: it must never be baked into the committed build).
const injected = window.settings
const devSecurePath = import.meta.env.DEV ? import.meta.env.VITE_SECURE_PATH : undefined

export const settings = {
  title: injected?.title || 'Xboard',
  version: injected?.version || 'dev',
  logo: injected?.logo || '',
  securePath: injected?.secure_path || devSecurePath || '',
  get legacyAdminUrl(): string {
    return injected?.legacy_admin_url || `/${this.securePath}`
  },
}
