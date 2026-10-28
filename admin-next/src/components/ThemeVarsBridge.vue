<script setup lang="ts">
// Mirrors Naive UI theme tokens into global CSS variables so plain CSS can follow the theme.
import { watchEffect } from 'vue'
import { useThemeVars } from 'naive-ui'

const vars = useThemeVars()

watchEffect(() => {
  const v = vars.value
  const s = document.documentElement.style
  s.setProperty('--primary-color', v.primaryColor)
  s.setProperty('--primary-color-hover', v.primaryColorHover)
  s.setProperty('--success-color', v.successColor)
  s.setProperty('--warning-color', v.warningColor)
  s.setProperty('--error-color', v.errorColor)
  s.setProperty('--info-color', v.infoColor)
  s.setProperty('--text-strong', v.textColor1)
  s.setProperty('--text-color', v.textColor2)
  s.setProperty('--text-muted', v.textColor3)
  s.setProperty('--border-color', v.borderColor)
  s.setProperty('--divider-color', v.dividerColor)
  s.setProperty('--hover-color', v.hoverColor)
  s.setProperty('--card-color', v.cardColor)
  s.setProperty('--body-color', v.bodyColor)
  s.setProperty('--code-bg', v.codeColor)
  s.setProperty('--font-mono', v.fontFamilyMono)
})
</script>

<template>
  <span style="display: none" />
</template>
