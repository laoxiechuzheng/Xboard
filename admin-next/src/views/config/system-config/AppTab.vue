<script setup lang="ts">
// APP设置 (group `app`, spec settings.md §4.8). Backend does not validate these;
// download URLs only get a non-blocking format hint.
import { NInput } from 'naive-ui'
import ConfigPanel from './ConfigPanel.vue'
import SettingRow from './SettingRow.vue'
import SettingSection from './SettingSection.vue'
import SaveBar from './SaveBar.vue'
import { useConfigForm } from './useConfigForm'
import { isUrl, toStr, useSettingsTab } from './helpers'

interface AppForm {
  windows_version: string
  windows_download_url: string
  macos_version: string
  macos_download_url: string
  android_version: string
  android_download_url: string
}

type Platform = 'windows' | 'macos' | 'android'

const platforms: Array<{ key: Platform; name: string }> = [
  { key: 'windows', name: 'Windows' },
  { key: 'macos', name: 'macOS' },
  { key: 'android', name: 'Android' },
]

const labels: Record<keyof AppForm, string> = {
  windows_version: 'Windows版本',
  windows_download_url: 'Windows下载地址',
  macos_version: 'macOS版本',
  macos_download_url: 'macOS下载地址',
  android_version: 'Android版本',
  android_download_url: 'Android下载地址',
}

const ctl = useConfigForm<AppForm>({
  group: 'app',
  labels,
  toForm: (r) => ({
    windows_version: toStr(r.windows_version),
    windows_download_url: toStr(r.windows_download_url),
    macos_version: toStr(r.macos_version),
    macos_download_url: toStr(r.macos_download_url),
    android_version: toStr(r.android_version),
    android_download_url: toStr(r.android_download_url),
  }),
})
const { form, errors, loading, loadError, saving, dirtyCount, isDirty, load, save, discard } = ctl

useSettingsTab({ isDirty: () => dirtyCount.value > 0, save })

const versionKey = (p: Platform) => `${p}_version` as const
const urlKey = (p: Platform) => `${p}_download_url` as const

function urlWarning(p: Platform): string {
  const v = form[urlKey(p)].trim()
  return v && !isUrl(v) ? '看起来不是完整的下载地址（需携带 http(s)://）' : ''
}
</script>

<template>
  <config-panel
    title="APP设置"
    description="管理移动应用程序相关配置，包括API接口、版本控制、推送通知等功能设置。"
    :loading="loading"
    :error="loadError"
    :dirty-count="dirtyCount"
    @retry="load()"
  >
    <setting-section v-for="p in platforms" :key="p.key" :title="p.name">
      <setting-row
        :label="`${p.name}版本`"
        :description="`${p.name}客户端当前版本号`"
        :dirty="isDirty(versionKey(p.key))"
        :error="errors[versionKey(p.key)]"
      >
        <n-input v-model:value="form[versionKey(p.key)]" placeholder="请输入" class="mono-field" />
      </setting-row>
      <setting-row
        :label="`${p.name}下载地址`"
        :description="`${p.name}客户端下载链接`"
        :dirty="isDirty(urlKey(p.key))"
        :error="errors[urlKey(p.key)]"
        :warning="urlWarning(p.key)"
      >
        <n-input v-model:value="form[urlKey(p.key)]" placeholder="请输入" :input-props="{ inputmode: 'url', spellcheck: false }" />
      </setting-row>
    </setting-section>
  </config-panel>
  <save-bar :count="dirtyCount" :saving="saving" @save="save" @discard="discard" />
</template>

<style scoped>
.mono-field :deep(input) {
  font-family: var(--font-mono);
}
</style>
