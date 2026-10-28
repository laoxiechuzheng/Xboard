<script setup lang="ts">
// Theme configuration (spec platform §2): theme cards, activation via config/save, per-theme settings,
// preview, upload and delete of user themes.
import { computed, onMounted, ref } from 'vue'
import { NAlert, NButton, NEmpty, NIcon, NResult, NSkeleton } from 'naive-ui'
import { CloudUploadOutline, RefreshOutline } from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import { activateTheme, deleteTheme, getThemes, themeImages, type ThemeInfo, type ThemeList } from '@/api/theme'
import { confirm, message } from '@/utils/discrete'
import ThemeCard from '@/views/config/theme/ThemeCard.vue'
import ThemeConfigDialog from '@/views/config/theme/ThemeConfigDialog.vue'
import ThemePreviewDialog from '@/views/config/theme/ThemePreviewDialog.vue'
import ThemeUploadDialog from '@/views/config/theme/ThemeUploadDialog.vue'
import { themeErrorText } from '@/views/config/theme/fields'

const data = ref<ThemeList | null>(null)
const loading = ref(false)
const loadError = ref('')
const processing = ref<{ key: string; kind: 'activate' | 'delete' } | null>(null)

const entries = computed(() => Object.entries(data.value?.themes ?? {}) as [string, ThemeInfo][])
const active = computed(() => data.value?.active || '')

let loadSeq = 0
async function load() {
  const mine = ++loadSeq
  loading.value = true
  try {
    const res = await getThemes({ silent: true })
    if (mine !== loadSeq) return
    data.value = res
    loadError.value = ''
  } catch (e) {
    if (mine !== loadSeq) return
    loadError.value = themeErrorText(e, '主题列表加载失败')
    // A failed refresh keeps the old cards; say so instead of silently showing stale state.
    if (data.value) message.error(`主题列表刷新失败：${loadError.value}`)
  } finally {
    if (mine === loadSeq) loading.value = false
  }
}
onMounted(load)

function busyFor(key: string) {
  return processing.value?.key === key ? processing.value.kind : null
}

async function onActivate(key: string, info: ThemeInfo) {
  if (processing.value || key === active.value) return
  const ok = await confirm({
    title: '切换主题',
    content: `切换后前台用户将立即看到新主题，确定切换到「${info.name || key}」吗？`,
    positiveText: '切换',
    type: 'info',
  })
  if (!ok) return
  processing.value = { key, kind: 'activate' }
  try {
    await activateTheme(key, { silent: true })
    message.success('主题切换成功')
  } catch (e) {
    message.error(themeErrorText(e, '主题切换失败'))
  } finally {
    processing.value = null
    void load()
  }
}

async function onDelete(key: string, info: ThemeInfo) {
  if (processing.value) return
  if (key === active.value) {
    message.error('不能删除当前使用的主题')
    return
  }
  const ok = await confirm({
    title: '删除主题',
    content: `确定要删除主题「${info.name || key}」吗？将同时删除该主题的文件和已保存的主题配置，删除后无法恢复。`,
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  processing.value = { key, kind: 'delete' }
  try {
    await deleteTheme(key, { silent: true })
    message.success('主题删除成功')
  } catch (e) {
    message.error(themeErrorText(e, '主题删除失败'))
  } finally {
    processing.value = null
    void load()
  }
}

// ---- dialogs
const configShow = ref(false)
const configKey = ref('')
const configInfo = ref<ThemeInfo | null>(null)
function openConfig(key: string, info: ThemeInfo) {
  configKey.value = key
  configInfo.value = info
  configShow.value = true
}

const previewShow = ref(false)
const previewName = ref('')
const previewImages = ref<string[]>([])
function openPreview(key: string, info: ThemeInfo) {
  previewName.value = info.name || key
  previewImages.value = themeImages(info)
  previewShow.value = true
}

const uploadShow = ref(false)
</script>

<template>
  <page-container
    title="主题配置"
    description="主题配置，包括主题色、背景等。如果你采用前后端分离的方式部署 Xboard，那么主题配置将不会生效。"
  >
    <template #extra>
      <n-button :loading="loading" @click="load">
        <template #icon><n-icon><refresh-outline /></n-icon></template>
        刷新
      </n-button>
      <n-button type="primary" @click="uploadShow = true">
        <template #icon><n-icon><cloud-upload-outline /></n-icon></template>
        上传主题
      </n-button>
    </template>

    <!-- Refresh failed after a successful load: the cards below are the last known state. -->
    <n-alert v-if="loadError && data" type="warning" title="主题列表刷新失败" class="theme-stale">
      <div class="theme-stale-text">{{ loadError }}。下方显示的可能不是最新状态（例如“使用中”的主题）。</div>
      <n-button size="small" secondary :loading="loading" @click="load">重试</n-button>
    </n-alert>

    <div v-if="loading && !data" class="theme-grid">
      <div v-for="i in 2" :key="i" class="theme-skeleton">
        <n-skeleton text :width="200" :height="20" />
        <n-skeleton text :width="300" />
        <n-skeleton text :width="180" />
        <div class="theme-skeleton-actions">
          <n-skeleton :width="100" :height="28" :sharp="false" />
          <n-skeleton :width="100" :height="28" :sharp="false" />
        </div>
      </div>
    </div>

    <n-result v-else-if="loadError && !data" status="error" title="主题列表加载失败" :description="loadError">
      <template #footer>
        <n-button type="primary" @click="load">重试</n-button>
      </template>
    </n-result>

    <n-empty v-else-if="!entries.length" description="暂无主题" class="theme-empty">
      <template #extra>
        <n-button size="small" @click="uploadShow = true">上传主题</n-button>
      </template>
    </n-empty>

    <div v-else class="theme-grid">
      <theme-card
        v-for="[key, info] in entries"
        :key="key"
        :theme-key="key"
        :info="info"
        :active="key === active"
        :processing="busyFor(key)"
        @activate="onActivate(key, info)"
        @delete="onDelete(key, info)"
        @configure="openConfig(key, info)"
        @preview="openPreview(key, info)"
      />
    </div>

    <theme-config-dialog v-model:show="configShow" :theme-key="configKey" :info="configInfo" />
    <theme-preview-dialog v-model:show="previewShow" :name="previewName" :images="previewImages" />
    <theme-upload-dialog v-model:show="uploadShow" @uploaded="load" />
  </page-container>
</template>

<style scoped>
.theme-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}
@media (min-width: 900px) {
  .theme-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1400px) {
  .theme-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.theme-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 196px;
  padding: 18px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
}
.theme-skeleton-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
}
.theme-empty {
  padding: 56px 0;
}
.theme-stale {
  margin-bottom: 16px;
}
.theme-stale-text {
  margin-bottom: 8px;
  word-break: break-word;
}
</style>
