// Theme endpoints (ThemeController) + activation via config/save. Spec platform §2.
import { http, type RequestOptions } from '@/api/http'

type Opts = Pick<RequestOptions, 'silent'>

/** One entry of `configs` in a theme's config.json. */
export interface ThemeConfigField {
  label?: string
  placeholder?: string
  field_name: string
  /** input | textarea | select; anything else is unknown to the admin. */
  field_type: string
  /** Object map: submitted value -> display text. */
  select_options?: Record<string, string>
  default_value?: string
}

/** config.json top-level keys passed through as-is, plus can_delete / is_system. */
export interface ThemeInfo {
  name: string
  description?: string
  version?: string
  /** Preview image URLs; the bundled Xboard theme ships `""`. */
  images?: string[] | string
  /** Card background in the admin (config.json key, not a theme setting). */
  background_url?: string
  configs?: ThemeConfigField[]
  can_delete: boolean
  is_system: boolean
  [key: string]: unknown
}

export interface ThemeList {
  themes: Record<string, ThemeInfo>
  /** admin_setting('frontend_theme', 'Xboard') */
  active: string
}

export type ThemeConfigValues = Record<string, unknown>

/** GET /theme/getThemes. The backend sends `themes: []` when no theme exists. */
export async function getThemes(opts: Opts = {}): Promise<ThemeList> {
  const d = await http.get<{ themes: Record<string, ThemeInfo> | unknown[]; active: string }>(
    '/theme/getThemes',
    undefined,
    opts,
  )
  const themes = d?.themes && !Array.isArray(d.themes) ? d.themes : {}
  return { themes, active: d?.active || 'Xboard' }
}

/** multipart `file`; resolves `true`. Business errors are 400 `{status:'fail', message}`. */
export function uploadTheme(file: File, opts: Opts = {}) {
  return http.upload<boolean>('/theme/upload', { file }, opts)
}

/** Removes storage/theme/{name}, public/theme/{name} and the saved `theme_{name}` setting. */
export function deleteTheme(name: string, opts: Opts = {}) {
  return http.post<boolean>('/theme/delete', { name }, opts)
}

/** POST (not GET). `null` when the theme no longer exists. */
export async function getThemeConfig(name: string, opts: Opts = {}): Promise<ThemeConfigValues> {
  const d = await http.post<ThemeConfigValues | null>('/theme/getThemeConfig', { name }, opts)
  return d && typeof d === 'object' && !Array.isArray(d) ? d : {}
}

/** Backend keeps only declared field_names and merges into the stored config; returns the merged config. */
export function saveThemeConfig(name: string, config: ThemeConfigValues, opts: Opts = {}) {
  return http.post<ThemeConfigValues>('/theme/saveThemeConfig', { name, config }, opts)
}

/** Switching uses config/save with only `frontend_theme` (ThemeController::switchTheme has no route). */
export function activateTheme(name: string, opts: Opts = {}) {
  return http.post<boolean>('/config/save', { frontend_theme: name }, opts)
}

/** `images` is only usable when it is a non-empty string array. */
export function themeImages(info: ThemeInfo): string[] {
  return Array.isArray(info.images) ? info.images.filter((x): x is string => typeof x === 'string' && !!x) : []
}
