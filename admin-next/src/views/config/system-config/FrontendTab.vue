<script setup lang="ts">
// 个性化设置 (group `frontend`, spec settings.md §4.10): the official page is hidden and
// broken (switches send booleans, wrong colour value, always re-sends frontend_theme).
// Fixed here: light/dark selects, backend colour values, only modified keys, never
// frontend_theme (theme switching lives in 主题配置).
import { NAlert, NInput, NSelect } from 'naive-ui'
import ConfigPanel from './ConfigPanel.vue'
import SettingRow from './SettingRow.vue'
import SaveBar from './SaveBar.vue'
import { useConfigForm } from './useConfigForm'
import { isUrl, toStr, useSettingsTab } from './helpers'

type Tone = 'light' | 'dark'
type ThemeColor = 'default' | 'darkblue' | 'black' | 'green'

interface FrontendForm {
  frontend_theme_sidebar: Tone
  frontend_theme_header: Tone
  frontend_theme_color: ThemeColor
  frontend_background_url: string
}

const labels: Record<keyof FrontendForm, string> = {
  frontend_theme_sidebar: '边栏风格',
  frontend_theme_header: '头部风格',
  frontend_theme_color: '主题色',
  frontend_background_url: '背景',
}

const toneOptions = [
  { label: '亮色', value: 'light' },
  { label: '暗色', value: 'dark' },
]
const colorOptions = [
  { label: '默认', value: 'default' },
  { label: '暗蓝色', value: 'darkblue' },
  { label: '黑色', value: 'black' },
  { label: '奶绿色', value: 'green' },
]

const tone = (v: unknown, fallback: Tone): Tone => (v === 'light' || v === 'dark' ? v : fallback)

const ctl = useConfigForm<FrontendForm>({
  group: 'frontend',
  labels,
  toForm: (r) => {
    const color = toStr(r.frontend_theme_color)
    return {
      frontend_theme_sidebar: tone(r.frontend_theme_sidebar, 'light'),
      frontend_theme_header: tone(r.frontend_theme_header, 'dark'),
      frontend_theme_color: (['default', 'darkblue', 'black', 'green'].includes(color) ? color : 'default') as ThemeColor,
      frontend_background_url: toStr(r.frontend_background_url),
    }
  },
  validate: (f, dirty) => {
    const e: Record<string, string> = {}
    const url = f.frontend_background_url.trim()
    if (dirty('frontend_background_url') && url && !isUrl(url)) e.frontend_background_url = '格式不正确，必须携带 http(s)://'
    return e
  },
})
const { form, errors, loading, loadError, saving, dirtyCount, isDirty, load, save, discard } = ctl

useSettingsTab({ isDirty: () => dirtyCount.value > 0, save })
</script>

<template>
  <config-panel
    title="个性化设置"
    description="自定义系统界面外观，包括主题风格、布局、颜色方案、背景图等个性化选项。"
    :loading="loading"
    :error="loadError"
    :dirty-count="dirtyCount"
    @retry="load()"
  >
    <n-alert type="info" :show-icon="true" class="legacy-alert">
      这些设置只被旧版后台视图引用，对当前用户前台与后台均无可见效果；官方后台也未在导航中提供此页。前台主题请在「主题配置」中切换。
    </n-alert>
    <setting-row
      label="边栏风格"
      description="旧版后台侧边栏的配色风格。"
      :dirty="isDirty('frontend_theme_sidebar')"
      :error="errors.frontend_theme_sidebar"
    >
      <n-select v-model:value="form.frontend_theme_sidebar" :options="toneOptions" />
    </setting-row>
    <setting-row
      label="头部风格"
      description="旧版后台顶栏的配色风格。"
      :dirty="isDirty('frontend_theme_header')"
      :error="errors.frontend_theme_header"
    >
      <n-select v-model:value="form.frontend_theme_header" :options="toneOptions" />
    </setting-row>
    <setting-row
      label="主题色"
      description="旧版后台的主题色。"
      :dirty="isDirty('frontend_theme_color')"
      :error="errors.frontend_theme_color"
    >
      <n-select v-model:value="form.frontend_theme_color" :options="colorOptions" />
    </setting-row>
    <setting-row
      label="背景"
      description="旧版后台登录页的背景图，当前后台与前台均不会使用。留空表示不使用背景图。"
      :dirty="isDirty('frontend_background_url')"
      :error="errors.frontend_background_url"
    >
      <n-input v-model:value="form.frontend_background_url" placeholder="请输入图片地址" :input-props="{ inputmode: 'url' }" />
    </setting-row>
  </config-panel>
  <save-bar :count="dirtyCount" :saving="saving" @save="save" @discard="discard" />
</template>

<style scoped>
.legacy-alert {
  margin: 16px 0 4px;
}
</style>
