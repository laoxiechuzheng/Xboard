import { reactive } from 'vue'
import type { Component } from 'vue'
import {
  SpeedometerOutline,
  BarChartOutline,
  CardOutline,
  DocumentTextOutline,
  CubeOutline,
  SettingsOutline,
  ShieldOutline,
  PeopleOutline,
  ExtensionPuzzleOutline,
} from '@vicons/ionicons5'
import { http } from '@/api/http'

/**
 * Installed-plugin list shared by the sidebar (plugin menu groups, spec core §6.2.3 /
 * platform §4.1) and plugin pages. Plugins can only *declare* `admin_menus` / `admin_crud`
 * in config.json; the admin renders them with built-in components.
 */
export interface PluginAdminMenu {
  id: string
  path: string
  title: string
  label?: string
  icon?: string
  description?: string
}

export interface PluginInfo {
  code: string
  name: string
  version: string
  type?: string
  description?: string
  author?: string
  is_installed: boolean
  is_enabled: boolean
  admin_menus?: PluginAdminMenu[] | null
  admin_crud?: Record<string, any> | null
  [key: string]: any
}

export interface PluginMenuItem {
  key: string
  title: string
  label?: string
  href: string
  icon: Component
}

export interface PluginMenuGroup {
  key: string
  title: string
  badge: string
  icon: Component
  items: PluginMenuItem[]
}

const MENU_ICONS: Record<string, Component> = {
  dashboard: SpeedometerOutline,
  'bar-chart-3': BarChartOutline,
  'credit-card': CardOutline,
  'file-text': DocumentTextOutline,
  package: CubeOutline,
  settings: SettingsOutline,
  shield: ShieldOutline,
  users: PeopleOutline,
}

export function pluginGroupIcon(type?: string): Component {
  if (type === 'payment') return CardOutline
  if (type === 'feature') return ExtensionPuzzleOutline
  return SettingsOutline
}

export function normalizeMenuPath(path: string | null | undefined): string {
  return String(path ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
}

/** Build sidebar groups exactly like the official runtime (also used by the menu demo page). */
export function buildPluginMenuGroups(plugins: PluginInfo[]): PluginMenuGroup[] {
  const groups: PluginMenuGroup[] = []
  for (const p of plugins) {
    if (!p.is_installed || !p.is_enabled) continue
    const groupIcon = pluginGroupIcon(p.type)
    const items: PluginMenuItem[] = []
    for (const [index, m] of (p.admin_menus || []).entries()) {
      const path = normalizeMenuPath(m.path)
      if (!path) continue
      items.push({
        // Unique even when two menus declare the same path (official key format).
        key: `plugin-menu:${p.code}:${m.id}#${index}`,
        title: m.title,
        label: m.label,
        href: `/plugins/${p.code}/${path}`,
        icon: (m.icon && MENU_ICONS[m.icon]) || groupIcon,
      })
    }
    if (!items.length) continue
    groups.push({ key: `plugin-group:${p.code}`, title: p.name, badge: `v${p.version}`, icon: groupIcon, items })
  }
  return groups.sort((a, b) => a.title.localeCompare(b.title))
}

export const pluginState = reactive({
  list: [] as PluginInfo[],
  loaded: false,
  loading: false,
})

let pending: Promise<PluginInfo[]> | null = null

/** GET /plugin/getPlugins -> raw `{ data: [...] }`. Deduplicates concurrent calls. */
export function loadPlugins(force = false): Promise<PluginInfo[]> {
  if (pluginState.loaded && !force) return Promise.resolve(pluginState.list)
  if (pending && !force) return pending
  pluginState.loading = true
  pending = http
    .get<{ data: PluginInfo[] }>('/plugin/getPlugins', undefined, { silent: true })
    .then((res) => {
      pluginState.list = res?.data ?? []
      pluginState.loaded = true
      return pluginState.list
    })
    .finally(() => {
      pluginState.loading = false
      pending = null
    })
  return pending
}
