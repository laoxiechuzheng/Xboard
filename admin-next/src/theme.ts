import { computed } from 'vue'
import type { GlobalThemeOverrides } from 'naive-ui'
import { appState } from '@/stores/app'

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
const fontFamilyMono = 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace'

export const themeOverrides = computed<GlobalThemeOverrides>(() => {
  const dark = appState.isDark
  return {
    common: {
      fontFamily,
      fontFamilyMono,
      primaryColor: dark ? '#7b8cff' : '#4f5fe8',
      primaryColorHover: dark ? '#96a3ff' : '#6573f0',
      primaryColorPressed: dark ? '#6474ea' : '#3f4dcf',
      primaryColorSuppl: dark ? '#7b8cff' : '#4f5fe8',
      borderRadius: '8px',
      borderRadiusSmall: '6px',
      bodyColor: dark ? '#101014' : '#f5f6f8',
      cardColor: dark ? '#18181c' : '#ffffff',
      modalColor: dark ? '#1c1c21' : '#ffffff',
      popoverColor: dark ? '#202026' : '#ffffff',
    },
    Card: {
      borderRadius: '12px',
    },
    DataTable: {
      thFontWeight: '600',
    },
    Layout: {
      siderColor: dark ? '#141418' : '#ffffff',
      headerColor: dark ? '#141418' : '#ffffff',
    },
  }
})
