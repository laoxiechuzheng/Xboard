<script setup lang="ts">
// Plugin runtime host `/plugins/:pluginCode/:subPath*` (spec platform §4.2–4.4).
// Plugins can only declare admin_menus / admin_crud; this page renders them with built-in components.
import { computed, onMounted, ref, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NIcon,
  NResult,
  NSkeleton,
  NTabPane,
  NTabs,
  NTag,
} from 'naive-ui'
import { ArrowBackOutline, CubeOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import { loadPlugins, normalizeMenuPath, pluginState } from '@/stores/plugins'
import type { PluginCrudSchema, PluginDetail } from '@/api/plugin'
import { DEFAULT_PLUGIN_TYPES } from '@/api/plugin'
import { settings } from '@/settings'
import { appState } from '@/stores/app'
import PluginConfigForm from '@/views/plugin/components/PluginConfigForm.vue'
import PluginReadme from '@/views/plugin/components/PluginReadme.vue'
import SchemaCrudTable from '@/views/plugin/components/SchemaCrudTable.vue'
import { serverCrudSource } from '@/views/plugin/crud'

const route = useRoute()
const router = useRouter()

const code = computed(() => String(route.params.pluginCode || ''))
/** Wildcard part without the leading slash (trailing slash kept, as in the official runtime). */
const subPath = computed(() => {
  const p = route.params.subPath
  const s = Array.isArray(p) ? p.join('/') : String(p ?? '')
  return s.replace(/^\/+/, '')
})
const normSub = computed(() => normalizeMenuPath(subPath.value))

const loadError = ref('')
const initialLoading = computed(() => !pluginState.loaded && !loadError.value)

async function load(force: boolean) {
  loadError.value = ''
  try {
    await loadPlugins(force)
  } catch (e) {
    if (!pluginState.loaded) loadError.value = (e as Error).message || '未知错误'
  }
}

onMounted(() => {
  // Show the cached list immediately and refresh it in the background.
  void load(pluginState.loaded)
})

const plugin = computed(() => pluginState.list.find((p) => p.code === code.value) as PluginDetail | undefined)
const enabled = computed(() => !!plugin.value?.is_installed && !!plugin.value?.is_enabled)
const hasConfig = computed(() => {
  const c = plugin.value?.config
  return !!c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length > 0
})
const menus = computed(() => {
  const m = plugin.value?.admin_menus
  return Array.isArray(m) ? m : []
})
const menu = computed(() =>
  normSub.value ? (menus.value.find((m) => normalizeMenuPath(m.path) === normSub.value) ?? null) : null,
)
const crud = computed<PluginCrudSchema | null>(() => {
  const all = plugin.value?.admin_crud
  if (!subPath.value || !all || typeof all !== 'object' || Array.isArray(all)) return null
  const s = all[subPath.value] ?? all[normSub.value]
  return s && typeof s === 'object' ? s : null
})
const isSettings = computed(() => normSub.value === 'settings' && hasConfig.value)
const notFoundPage = computed(() => !!normSub.value && !menu.value && !crud.value && !isSettings.value)
const tab = computed(() => (isSettings.value ? 'settings' : 'overview'))
const crudSource = computed(() => (crud.value ? serverCrudSource(crud.value) : null))

const title = computed(
  () => crud.value?.title || menu.value?.title || plugin.value?.name || code.value || '插件管理',
)
const description = computed(
  () => crud.value?.description || menu.value?.description || plugin.value?.description || '查看插件信息、文档与配置。',
)
const typeLabel = computed(() => {
  const t = plugin.value?.type
  return DEFAULT_PLUGIN_TYPES.find((x) => x.value === t)?.label || t || '-'
})

watchEffect(() => {
  if (plugin.value) document.title = `${title.value} · ${settings.title}`
})

const base = computed(() => `/plugins/${code.value}`)
function onTab(name: string) {
  router.push(name === 'settings' ? `${base.value}/settings` : base.value)
}
</script>

<template>
  <page-container :title="title" :description="description">
    <template #extra>
      <n-tag v-if="plugin" size="small" round class="mono">v{{ plugin.version }}</n-tag>
      <n-tag v-if="menu?.label" size="small" round type="primary" :bordered="false">{{ menu.label }}</n-tag>
      <n-button size="small" @click="router.push('/config/plugin')">
        <template #icon><n-icon><arrow-back-outline /></n-icon></template>
        插件管理
      </n-button>
    </template>

    <!-- Loading -->
    <div v-if="initialLoading" class="rt-skeleton">
      <n-skeleton :height="40" :width="256" :sharp="false" />
      <n-skeleton :height="160" :sharp="false" />
      <n-skeleton :height="256" :sharp="false" />
    </div>

    <n-card v-else-if="loadError">
      <n-result status="error" title="插件列表加载失败" :description="`可能存在格式错误的插件包：${loadError}`">
        <template #footer>
          <n-button type="primary" @click="load(true)">重试</n-button>
        </template>
      </n-result>
    </n-card>

    <n-card v-else-if="!plugin">
      <n-result status="404" title="插件不存在" description="请求的插件不存在或已被删除。">
        <template #footer>
          <n-button type="primary" @click="router.push('/config/plugin')">返回插件管理</n-button>
        </template>
      </n-result>
    </n-card>

    <n-card v-else-if="!enabled">
      <n-result status="warning" title="插件未启用" description="请先在插件管理中启用该插件，再打开它的管理页面。">
        <template #footer>
          <n-button type="primary" @click="router.push('/config/plugin')">返回插件管理</n-button>
        </template>
      </n-result>
    </n-card>

    <!-- admin_crud page -->
    <n-card v-else-if="crud && crudSource" :key="`${code}:${subPath}`" :bordered="true" class="rt-crud">
      <schema-crud-table :schema="crud" :source="crudSource" />
    </n-card>

    <!-- Menu declared without a CRUD schema -->
    <n-card v-else-if="menu" :title="menu.title">
      <p class="rt-text">{{ menu.description || '该页面由插件声明，暂不支持自定义渲染。' }}</p>
      <div class="rt-info">
        <div><span class="muted">插件：</span>{{ plugin.name }}</div>
        <div>
          <span class="muted">路径：</span><code class="mono">/plugins/{{ plugin.code }}/{{ normalizeMenuPath(menu.path) }}</code>
        </div>
      </div>
      <n-button @click="router.push(base)">
        <template #icon><n-icon><arrow-back-outline /></n-icon></template>
        返回概览
      </n-button>
    </n-card>

    <n-card v-else-if="notFoundPage">
      <n-result status="404" title="插件页面不存在" description="当前无法显示该插件页面。">
        <template #footer>
          <n-button type="primary" @click="router.push(base)">返回概览</n-button>
        </template>
      </n-result>
    </n-card>

    <!-- Overview / Settings -->
    <template v-else>
      <n-tabs type="line" :value="tab" animated @update:value="onTab">
        <n-tab-pane name="overview" tab="概览">
          <div class="rt-stack">
            <n-card title="插件信息" size="small">
              <n-descriptions :column="appState.isMobile ? 1 : 2" label-placement="left" size="small" class="rt-desc">
                <n-descriptions-item label="作者">{{ plugin.author || '-' }}</n-descriptions-item>
                <n-descriptions-item label="标识"><code class="mono">{{ plugin.code }}</code></n-descriptions-item>
                <n-descriptions-item label="版本"><span class="mono">{{ plugin.version }}</span></n-descriptions-item>
                <n-descriptions-item label="状态">
                  <n-tag size="small" :type="plugin.is_enabled ? 'success' : 'default'" :bordered="false">
                    {{ plugin.is_enabled ? '已启用' : '已禁用' }}
                  </n-tag>
                </n-descriptions-item>
                <n-descriptions-item label="类型">{{ typeLabel }}</n-descriptions-item>
                <n-descriptions-item label="核心插件">{{ plugin.is_protected ? '是' : '否' }}</n-descriptions-item>
              </n-descriptions>
            </n-card>

            <n-card v-if="menus.length" title="已声明的菜单" size="small">
              <div class="rt-menus">
                <component
                  :is="normalizeMenuPath(m.path) ? RouterLink : 'div'"
                  v-for="m in menus"
                  :key="m.id || m.path"
                  :to="normalizeMenuPath(m.path) ? `${base}/${normalizeMenuPath(m.path)}` : undefined"
                  class="rt-menu"
                  :class="{ disabled: !normalizeMenuPath(m.path) }"
                >
                  <div class="rt-menu-main">
                    <div class="rt-menu-title">
                      <n-icon :size="16"><cube-outline /></n-icon>
                      <span>{{ m.title || m.id }}</span>
                      <n-tag v-if="m.label" size="tiny" :bordered="false">{{ m.label }}</n-tag>
                    </div>
                    <code v-if="normalizeMenuPath(m.path)" class="mono rt-menu-path">{{ base }}/{{ normalizeMenuPath(m.path) }}</code>
                    <span v-else class="rt-menu-path muted">路径为空，不会出现在侧边栏</span>
                  </div>
                  <n-icon v-if="normalizeMenuPath(m.path)" class="muted"><chevron-forward-outline /></n-icon>
                </component>
              </div>
            </n-card>

            <n-card title="插件文档" size="small">
              <plugin-readme :source="plugin.readme" max-height="70vh" />
            </n-card>
          </div>
        </n-tab-pane>
        <n-tab-pane v-if="hasConfig" name="settings" tab="设置">
          <n-card title="配置" size="small">
            <plugin-config-form :code="plugin.code" reload-on-saved @cancel="router.push(base)" />
          </n-card>
        </n-tab-pane>
      </n-tabs>
    </template>
  </page-container>
</template>

<style scoped>
.rt-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rt-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rt-text {
  margin: 0 0 14px;
  color: var(--text-color);
}
.rt-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--hover-color);
  font-size: 13px;
  word-break: break-all;
}
.rt-menus {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rt-menu {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}
a.rt-menu:hover {
  border-color: var(--primary-color-hover);
  background: var(--hover-color);
}
.rt-menu.disabled {
  opacity: 0.7;
}
.rt-menu-main {
  flex: 1;
  min-width: 0;
}
.rt-menu-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.rt-menu-path {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
}
</style>
