import { computed } from 'vue'
import { createDiscreteApi, darkTheme, type ConfigProviderProps } from 'naive-ui'
import { appState } from '@/stores/app'
import { themeOverrides } from '@/theme'

// Message / dialog / notification usable outside component setup (e.g. in the HTTP client).
const configProviderProps = computed<ConfigProviderProps>(() => ({
  theme: appState.isDark ? darkTheme : null,
  themeOverrides: themeOverrides.value,
}))

export const { message, dialog, notification, loadingBar } = createDiscreteApi(
  ['message', 'dialog', 'notification', 'loadingBar'],
  { configProviderProps },
)

/** Promise-based confirm dialog. Resolves true when the user confirms. */
export function confirm(options: {
  title?: string
  content: string
  positiveText?: string
  type?: 'warning' | 'error' | 'info'
}): Promise<boolean> {
  return new Promise((resolve) => {
    const fn = options.type === 'error' ? dialog.error : options.type === 'info' ? dialog.info : dialog.warning
    fn({
      title: options.title || '请确认',
      content: options.content,
      positiveText: options.positiveText || '确定',
      negativeText: '取消',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
      onMaskClick: () => resolve(false),
      // Esc only fires onEsc (not onClose); onAfterLeave covers any other dismissal.
      // Extra resolve() calls after the first are no-ops.
      onEsc: () => resolve(false),
      onAfterLeave: () => resolve(false),
    })
  })
}
