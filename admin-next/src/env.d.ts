/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, any>
  export default component
}

interface XboardAdminSettings {
  base_url?: string
  title?: string
  version?: string
  logo?: string | null
  secure_path: string
  legacy_admin_url?: string
}

interface Window {
  settings?: XboardAdminSettings
}

interface ImportMetaEnv {
  readonly VITE_SECURE_PATH?: string
}
