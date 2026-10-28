<script setup lang="ts">
// Plugin management (spec platform §3): type tabs + search + install filter (all client-side),
// lifecycle actions, configuration, README and package upload. The list lives in the shared plugin
// store so the sidebar plugin menus refresh together with this page.
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NDropdown, NEmpty, NIcon, NInput, NResult, NSelect, NSkeleton, NTab, NTabs } from 'naive-ui'
import { ChevronDownOutline, CloudUploadOutline, FlaskOutline, RefreshOutline, SearchOutline } from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import {
  DEFAULT_PLUGIN_TYPES,
  getPluginTypes,
  pluginAction,
  type PluginAction,
  type PluginDetail,
  type PluginTypeOption,
} from '@/api/plugin'
import { loadPlugins, pluginState } from '@/stores/plugins'
import { confirm, message } from '@/utils/discrete'
import PluginCard from '@/views/config/plugin/PluginCard.vue'
import PluginConfigDialog from '@/views/config/plugin/PluginConfigDialog.vue'
import PluginReadmeDialog from '@/views/config/plugin/PluginReadmeDialog.vue'
import PluginUploadDialog from '@/views/config/plugin/PluginUploadDialog.vue'
import { ACTION_SUCCESS, confirmFor } from '@/views/config/plugin/actions'

type InstallFilter = 'all' | 'installed' | 'available'

const router = useRouter()

// ---- data
const types = ref<PluginTypeOption[]>(DEFAULT_PLUGIN_TYPES)
const typesLoading = ref(true)
const listError = ref('')

async function refresh() {
  // Retrying a failed first load: drop the error so the skeleton shows while the request runs.
  if (!pluginState.loaded) listError.value = ''
  try {
    await loadPlugins(true)
    listError.value = ''
  } catch (e) {
    const msg = (e as Error).message || '未知错误'
    if (pluginState.loaded) message.error(`插件列表刷新失败：${msg}`)
    else listError.value = msg
  }
}

onMounted(() => {
  void getPluginTypes({ silent: true })
    .then((list) => {
      if (list.length) types.value = list
    })
    .catch(() => undefined)
    .finally(() => (typesLoading.value = false))
  void refresh()
})

const plugins = computed(() => pluginState.list as PluginDetail[])
const initialLoading = computed(() => !pluginState.loaded && !listError.value)

// ---- filters (search -> type tab -> install state, like the official page)
const tab = ref<string>('feature')
const keyword = ref('')
const installFilter = ref<InstallFilter>('all')
const installOptions = [
  { label: '全部状态', value: 'all' },
  { label: '已安装', value: 'installed' },
  { label: '可安装', value: 'available' },
]

function matchBase(p: PluginDetail): boolean {
  const kw = keyword.value.trim().toLowerCase()
  if (kw && ![p.name, p.description, p.code].some((s) => String(s ?? '').toLowerCase().includes(kw))) return false
  if (installFilter.value === 'installed' && !p.is_installed) return false
  if (installFilter.value === 'available' && p.is_installed) return false
  return true
}

const baseMatched = computed(() => plugins.value.filter(matchBase))
const visible = computed(() =>
  tab.value === 'all' ? baseMatched.value : baseMatched.value.filter((p) => (p.type || 'feature') === tab.value),
)
function countFor(type: string) {
  return type === 'all' ? baseMatched.value.length : baseMatched.value.filter((p) => (p.type || 'feature') === type).length
}
const hasFilter = computed(() => !!keyword.value.trim() || installFilter.value !== 'all')
function clearFilters() {
  keyword.value = ''
  installFilter.value = 'all'
}
const typeLabel = (type?: string) => types.value.find((t) => t.value === type)?.label

// ---- actions
const processing = reactive<Record<string, PluginAction>>({})

async function onAction(p: PluginDetail, action: PluginAction) {
  if (processing[p.code]) return
  const c = confirmFor(action, p)
  if (c && !(await confirm(c))) return
  processing[p.code] = action
  try {
    const res = await pluginAction(action, p.code)
    message.success(res?.message || ACTION_SUCCESS[action])
  } catch {
    /* the http client already showed the backend message (shown once, unlike the official page) */
  } finally {
    // Refresh even after a failure: e.g. a failed upgrade can leave the plugin disabled.
    await refresh()
    delete processing[p.code]
  }
}

// ---- dialogs
const configTarget = ref<{ code: string; name: string } | null>(null)
const configShow = ref(false)
function openConfig(p: PluginDetail) {
  configTarget.value = { code: p.code, name: p.name }
  configShow.value = true
}

const readmeTarget = ref<{ name: string; readme: string } | null>(null)
const readmeShow = ref(false)
function openReadme(p: PluginDetail) {
  readmeTarget.value = { name: p.name, readme: p.readme || '' }
  readmeShow.value = true
}

const uploadShow = ref(false)

const demoOptions = [
  { label: 'Schema CRUD 演示', key: '/config/plugin/crud-demo' },
  { label: '插件菜单演示', key: '/config/plugin/menu-demo' },
]
</script>

<template>
  <page-container title="插件管理" description="管理和配置系统插件">
    <template #extra>
      <n-dropdown trigger="click" :options="demoOptions" @select="(k: string) => router.push(k)">
        <n-button>
          <template #icon><n-icon><flask-outline /></n-icon></template>
          开发者演示
          <n-icon class="dd-caret"><chevron-down-outline /></n-icon>
        </n-button>
      </n-dropdown>
      <n-button :loading="pluginState.loading" @click="refresh">
        <template #icon><n-icon><refresh-outline /></n-icon></template>
        刷新
      </n-button>
      <n-button type="primary" @click="uploadShow = true">
        <template #icon><n-icon><cloud-upload-outline /></n-icon></template>
        上传插件
      </n-button>
    </template>

    <div class="toolbar">
      <n-input v-model:value="keyword" clearable placeholder="搜索插件名称、描述或标识..." class="pl-search">
        <template #prefix><n-icon><search-outline /></n-icon></template>
      </n-input>
      <n-select v-model:value="installFilter" :options="installOptions" class="pl-status" />
    </div>

    <n-tabs v-model:value="tab" type="line" class="pl-tabs">
      <n-tab v-for="t in types" :key="t.value" :name="t.value">
        <span :title="t.description">{{ t.label }}</span>
        <span v-if="pluginState.loaded" class="pl-count mono">{{ countFor(t.value) }}</span>
      </n-tab>
      <n-tab name="all">
        所有插件
        <span v-if="pluginState.loaded" class="pl-count mono">{{ countFor('all') }}</span>
      </n-tab>
    </n-tabs>

    <div v-if="initialLoading || (typesLoading && !pluginState.loaded)" class="pl-grid">
      <div v-for="i in 3" :key="i" class="pl-skeleton">
        <div class="pl-skeleton-row">
          <n-skeleton text :width="140" :height="18" />
          <n-skeleton :width="48" :height="20" round />
          <n-skeleton :width="56" :height="20" round />
        </div>
        <n-skeleton text :width="240" />
        <n-skeleton text :repeat="2" />
        <div class="pl-skeleton-actions">
          <n-skeleton :width="64" :height="28" :sharp="false" />
          <n-skeleton :width="64" :height="28" :sharp="false" />
        </div>
      </div>
    </div>

    <n-result
      v-else-if="listError"
      status="error"
      title="插件列表加载失败"
      :description="`可能存在格式错误的插件包。${listError}`"
    >
      <template #footer>
        <n-button type="primary" :loading="pluginState.loading" @click="refresh">重试</n-button>
      </template>
    </n-result>

    <n-empty v-else-if="!visible.length" :description="hasFilter ? '没有匹配的插件' : '暂无插件'" class="pl-empty">
      <template v-if="hasFilter" #extra>
        <n-button size="small" @click="clearFilters">清除筛选</n-button>
      </template>
    </n-empty>

    <div v-else class="pl-grid">
      <plugin-card
        v-for="p in visible"
        :key="p.code"
        :plugin="p"
        :type-label="typeLabel(p.type)"
        :processing="processing[p.code] || null"
        @action="(a: PluginAction) => onAction(p, a)"
        @config="openConfig(p)"
        @readme="openReadme(p)"
      />
    </div>

    <plugin-config-dialog
      v-model:show="configShow"
      :code="configTarget?.code || ''"
      :name="configTarget?.name || ''"
    />
    <plugin-readme-dialog
      v-model:show="readmeShow"
      :name="readmeTarget?.name || ''"
      :readme="readmeTarget?.readme || ''"
    />
    <plugin-upload-dialog v-model:show="uploadShow" @uploaded="refresh" />
  </page-container>
</template>

<style scoped>
.dd-caret {
  margin-left: 4px;
  margin-right: -4px;
  font-size: 14px;
  opacity: 0.7;
}
.pl-search {
  width: 320px;
  max-width: 100%;
}
.pl-status {
  width: 140px;
}
.pl-tabs {
  margin-top: -4px;
}
.pl-count {
  display: inline-block;
  min-width: 20px;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  color: var(--text-muted);
  background: var(--hover-color);
}
.pl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
  gap: 16px;
}
.pl-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.pl-skeleton-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pl-skeleton-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.pl-empty {
  padding: 56px 0;
}
@media (max-width: 767px) {
  .pl-search,
  .pl-status {
    width: 100%;
  }
}
</style>
