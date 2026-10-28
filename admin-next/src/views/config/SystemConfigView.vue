<script setup lang="ts">
// System settings shell (spec core §6.1, settings §2): left sub-navigation (a select on
// narrow screens), the active tab from route param `tab`, unsaved-changes guard and Ctrl+S.
import { computed, onBeforeUnmount, onMounted, provide, shallowRef, watch } from 'vue'
import { RouterLink, onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { NIcon, NSelect, NTag, NTooltip, type SelectOption } from 'naive-ui'
import PageContainer from '@/components/PageContainer.vue'
import { appState } from '@/stores/app'
import { resolveSettingsTab, settingsTabPath, settingsTabs } from './system-config/tabs'
import { confirmAction, settingsTabKey, type SettingsTabApi } from './system-config/helpers'

const route = useRoute()
const router = useRouter()

const active = computed(() => resolveSettingsTab(route.params.tab))

watch(
  active,
  (tab) => {
    if (!tab) router.replace(settingsTabPath(''))
  },
  { immediate: true },
)

// The active tab registers its dirty check and save action here.
const tabApi = shallowRef<SettingsTabApi | null>(null)
provide(settingsTabKey, (api) => {
  tabApi.value = api
})

// The sub-navigation lists the 9 official pages (spec core §6.1). Legacy pages are reachable by
// URL only and appear in the navigation just while open, so the current page is still marked.
const mainTabs = computed(() => settingsTabs.filter((t) => !t.legacy))
const openLegacyTab = computed(() => (active.value?.legacy ? active.value : null))
const navOptions = computed<SelectOption[]>(() => {
  const opts: SelectOption[] = mainTabs.value.map((t) => ({ label: t.title, value: t.key }))
  const legacy = openLegacyTab.value
  if (legacy) opts.push({ label: `${legacy.title}（旧版）`, value: legacy.key })
  return opts
})

function go(key: string) {
  if (key !== active.value?.key) router.push(settingsTabPath(key))
}

async function confirmLeave(): Promise<boolean> {
  if (!tabApi.value?.isDirty()) return true
  return confirmAction({
    title: '未保存的修改',
    content: '当前设置页有未保存的修改，离开后这些修改将丢失。确定要离开吗？',
    positiveText: '丢弃修改并离开',
  })
}

// Query-only changes (sub-tabs) stay on the same tab and need no guard.
onBeforeRouteUpdate((to, from) => (to.path === from.path ? true : confirmLeave()))
onBeforeRouteLeave(() => confirmLeave())

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (tabApi.value?.isDirty()) {
    e.preventDefault()
    e.returnValue = ''
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 's') return
  const save = tabApi.value?.save
  if (!save) return
  e.preventDefault()
  // A dialog is open (e.g. the save confirmation): don't start another save behind it.
  if (document.querySelector('.n-modal-mask')) return
  void save()
}

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <page-container title="系统设置" description="管理系统核心配置，包括站点、安全、订阅、邀请佣金、节点、邮件和通知等设置">
    <div class="settings-layout" :class="{ mobile: appState.isMobile }">
      <n-select
        v-if="appState.isMobile"
        :value="active?.key ?? ''"
        :options="navOptions"
        aria-label="选择设置分类"
        @update:value="(v: string) => go(v)"
      />
      <nav v-else class="settings-nav" aria-label="设置分类">
        <n-tooltip v-for="t in mainTabs" :key="t.key" placement="right" :delay="500" style="max-width: 260px">
          <template #trigger>
            <router-link
              :to="settingsTabPath(t.key)"
              class="nav-item"
              :class="{ active: t.key === active?.key }"
              :aria-current="t.key === active?.key ? 'page' : undefined"
            >
              <n-icon :size="17" class="nav-icon"><component :is="t.icon" /></n-icon>
              <span class="nav-title">{{ t.title }}</span>
            </router-link>
          </template>
          {{ t.description }}
        </n-tooltip>
        <template v-if="openLegacyTab">
          <div class="nav-divider" />
          <n-tooltip placement="right" :delay="500" style="max-width: 260px">
            <template #trigger>
              <router-link :to="settingsTabPath(openLegacyTab.key)" class="nav-item active" aria-current="page">
                <n-icon :size="17" class="nav-icon"><component :is="openLegacyTab.icon" /></n-icon>
                <span class="nav-title">{{ openLegacyTab.title }}</span>
                <n-tag size="tiny" :bordered="false">旧版</n-tag>
              </router-link>
            </template>
            官方后台未在导航中列出的遗留页面，仅可通过地址访问：{{ openLegacyTab.description }}
          </n-tooltip>
        </template>
      </nav>

      <div class="settings-content">
        <component :is="active.component" v-if="active" />
      </div>
    </div>
  </page-container>
</template>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: 208px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  padding-bottom: 72px;
}
.settings-layout.mobile {
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.settings-nav {
  position: sticky;
  top: 72px; /* below the 56px sticky app header */
  max-height: calc(100vh - 88px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
/*
 * The layout's content wrappers use overflow: hidden, which makes them the (never scrolling)
 * scroll container of any sticky descendant. On this page clip instead, so the nav sticks to
 * the page scroll. Harmless once the layout itself switches to overflow: clip.
 */
:global(.n-layout-content:has(.settings-layout)),
:global(.n-layout-content:has(.settings-layout) > .n-layout-scroll-container) {
  overflow: clip;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--text-color);
  font-size: 14px;
  text-decoration: none;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.nav-item:hover {
  background: var(--hover-color);
  color: var(--text-strong);
}
.nav-item:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: -2px;
}
.nav-item.active {
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  color: var(--primary-color);
  font-weight: 600;
}
.nav-icon {
  flex: none;
}
.nav-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nav-divider {
  height: 1px;
  margin: 8px 6px;
  background: var(--divider-color);
}
.settings-content {
  min-width: 0;
}
@media (max-width: 1100px) {
  .settings-layout:not(.mobile) {
    grid-template-columns: 176px minmax(0, 1fr);
    gap: 16px;
  }
}
</style>
