<script setup lang="ts">
import { computed } from 'vue'
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  NLoadingBarProvider,
  darkTheme,
  zhCN,
  dateZhCN,
} from 'naive-ui'
import { appState } from '@/stores/app'
import { themeOverrides } from '@/theme'
import ThemeVarsBridge from '@/components/ThemeVarsBridge.vue'

const theme = computed(() => (appState.isDark ? darkTheme : null))
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN">
    <n-global-style />
    <theme-vars-bridge />
    <n-loading-bar-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <n-message-provider>
            <router-view />
          </n-message-provider>
        </n-notification-provider>
      </n-dialog-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>
