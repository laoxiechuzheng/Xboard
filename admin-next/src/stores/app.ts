import { reactive, watch } from 'vue'
import { storage } from '@/utils/storage'

export type ThemeMode = 'light' | 'dark' | 'auto'

const media = window.matchMedia('(prefers-color-scheme: dark)')

export const appState = reactive({
  themeMode: (storage.get('theme_mode') as ThemeMode) || 'auto',
  systemDark: media.matches,
  siderCollapsed: storage.get('sider_collapsed') === '1',
  isMobile: window.innerWidth < 768,
  get isDark(): boolean {
    return this.themeMode === 'dark' || (this.themeMode === 'auto' && this.systemDark)
  },
})

media.addEventListener('change', (e) => {
  appState.systemDark = e.matches
})

window.addEventListener('resize', () => {
  appState.isMobile = window.innerWidth < 768
})

watch(
  () => appState.themeMode,
  (v) => storage.set('theme_mode', v),
)
watch(
  () => appState.siderCollapsed,
  (v) => storage.set('sider_collapsed', v ? '1' : '0'),
)
watch(
  () => appState.isDark,
  (dark) => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  },
  { immediate: true },
)

export function cycleThemeMode() {
  const order: ThemeMode[] = ['light', 'dark', 'auto']
  appState.themeMode = order[(order.indexOf(appState.themeMode) + 1) % order.length]
}
