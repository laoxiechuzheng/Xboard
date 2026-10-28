<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NIcon,
  NButton,
  NDropdown,
  NDrawer,
  NDrawerContent,
  NTooltip,
  NAvatar,
  NTag,
  type MenuOption,
} from 'naive-ui'
import {
  MenuOutline,
  SunnyOutline,
  MoonOutline,
  ContrastOutline,
  LogOutOutline,
  SwapHorizontalOutline,
  ChevronBackOutline,
  ChevronForwardOutline,
  SearchOutline,
  SettingsOutline,
} from '@vicons/ionicons5'
import { menuGroups, activeMenuPath } from '@/router/menu'
import { appState, cycleThemeMode } from '@/stores/app'
import { authState, clearAuth } from '@/stores/auth'
import { pluginState, loadPlugins, buildPluginMenuGroups } from '@/stores/plugins'
import { settings } from '@/settings'
import { publicHttp } from '@/api/http'
import { confirm } from '@/utils/discrete'
import CommandPalette from '@/components/CommandPalette.vue'
import type { PaletteItem } from '@/components/command-palette'

const route = useRoute()
const router = useRouter()
const drawerOpen = ref(false)
const paletteOpen = ref(false)

const renderIcon = (icon: any) => () => h(NIcon, null, { default: () => h(icon) })
const renderLink = (path: string, title: string, badge?: string) => () =>
  h(RouterLink, { to: path }, {
    default: () =>
      badge
        ? [title, h(NTag, { size: 'tiny', bordered: false, style: 'margin-left:6px' }, { default: () => badge })]
        : title,
  })

const pluginGroups = computed(() => buildPluginMenuGroups(pluginState.list))

const menuOptions = computed<MenuOption[]>(() => [
  ...menuGroups.map((g) =>
    g.path
      ? { key: g.path, label: renderLink(g.path, g.title), icon: renderIcon(g.icon) }
      : {
          key: g.key,
          label: g.title,
          icon: renderIcon(g.icon),
          children: (g.children || []).map((c) => ({ key: c.path, label: renderLink(c.path, c.title) })),
        },
  ),
  ...pluginGroups.value.map((g) => ({
    key: g.key,
    label: () => [g.title, h(NTag, { size: 'tiny', bordered: false, style: 'margin-left:6px' }, { default: () => g.badge })],
    icon: renderIcon(g.icon),
    children: g.items.map((it) => ({ key: it.key, label: renderLink(it.href, it.title, it.label), icon: renderIcon(it.icon) })),
  })),
])

// `key` is the n-menu key; for built-in pages it equals the path.
const allLeaves = computed(() => {
  const out: { key: string; path: string; title: string; parent?: string }[] = []
  for (const g of menuGroups) {
    if (g.path) out.push({ key: g.path, path: g.path, title: g.title })
    for (const c of g.children || []) out.push({ key: c.path, path: c.path, title: c.title, parent: g.title })
  }
  for (const g of pluginGroups.value) {
    for (const it of g.items) out.push({ key: it.key, path: it.href, title: it.title, parent: g.title })
  }
  return out
})

const paletteItems = computed<PaletteItem[]>(() => allLeaves.value)
// Routes with meta.reuse keep the same view instance across param changes (settings tabs).
const viewKey = computed(() => (route.meta.reuse ? (route.matched[route.matched.length - 1]?.path ?? route.path) : route.path))
const activeLeaf = computed(() => {
  const path = activeMenuPath(route.path, allLeaves.value.map((l) => l.path))
  return path ? allLeaves.value.find((l) => l.path === path) : undefined
})
const activeKey = computed(() => activeLeaf.value?.key ?? route.path)
const expandedKeys = ref<string[]>(menuGroups.filter((g) => !g.path).map((g) => g.key))

watch(pluginGroups, (groups) => {
  for (const g of groups) if (!expandedKeys.value.includes(g.key)) expandedKeys.value.push(g.key)
})

const breadcrumb = computed(() => {
  const leaf = activeLeaf.value
  const title = (route.meta.title as string) || ''
  if (!leaf) return [title]
  const crumbs = leaf.parent ? [leaf.parent, leaf.title] : [leaf.title]
  if (title && title !== leaf.title && route.path !== leaf.path) crumbs.push(title)
  return crumbs
})

const themeIcon = computed(() =>
  appState.themeMode === 'light' ? SunnyOutline : appState.themeMode === 'dark' ? MoonOutline : ContrastOutline,
)
const themeLabel = computed(() =>
  appState.themeMode === 'light' ? '浅色模式' : appState.themeMode === 'dark' ? '深色模式' : '跟随系统',
)

const userOptions = computed(() => [
  {
    key: 'header',
    type: 'render',
    render: () =>
      h('div', { class: 'user-menu-head' }, [
        h('div', { class: 'user-menu-name' }, (authState.user?.email || '管理员').split('@')[0]),
        h('div', { class: 'user-menu-mail' }, authState.user?.email || ''),
      ]),
  },
  { type: 'divider', key: 'd0' },
  { key: 'settings', label: '系统配置', icon: renderIcon(SettingsOutline) },
  { key: 'legacy', label: '切换到旧版后台', icon: renderIcon(SwapHorizontalOutline) },
  { type: 'divider', key: 'd1' },
  { key: 'logout', label: '退出登录', icon: renderIcon(LogOutOutline) },
])

async function onUserSelect(key: string) {
  if (key === 'settings') {
    router.push('/config/system')
  } else if (key === 'legacy') {
    window.location.href = settings.legacyAdminUrl
  } else if (key === 'logout') {
    if (!(await confirm({ title: '退出登录', content: '确定要退出当前管理员账号吗？', type: 'info' }))) return
    clearAuth()
    router.replace('/login')
  }
}

function onGlobalKey(e: KeyboardEvent) {
  // Editors that handle Ctrl/⌘+K themselves call preventDefault().
  if (e.defaultPrevented) return
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteOpen.value = !paletteOpen.value
  }
}

watch(
  () => route.path,
  () => (drawerOpen.value = false),
)

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKey)
  void loadPlugins().catch(() => undefined)
  if (authState.user) return
  try {
    authState.user = await publicHttp.get('/api/v2/user/info', undefined, { silent: true })
  } catch {
    /* header falls back to a generic label */
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))

const avatarFailed = ref(false)
const userInitials = computed(() => (authState.user?.email || 'AD').slice(0, 2).toUpperCase())
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
</script>

<template>
  <n-layout has-sider class="admin-root">
    <n-layout-sider
      v-if="!appState.isMobile"
      bordered
      collapse-mode="width"
      :collapsed="appState.siderCollapsed"
      :collapsed-width="64"
      :width="236"
      :native-scrollbar="false"
      class="admin-sider"
    >
      <div class="brand" :class="{ collapsed: appState.siderCollapsed }">
        <img v-if="settings.logo" :src="settings.logo" class="brand-logo" alt="" />
        <div v-else class="brand-mark">{{ settings.title.slice(0, 1) }}</div>
        <span v-if="!appState.siderCollapsed" class="brand-title">{{ settings.title }}</span>
      </div>
      <n-menu
        v-model:expanded-keys="expandedKeys"
        :value="activeKey"
        :options="menuOptions"
        :collapsed="appState.siderCollapsed"
        :collapsed-width="64"
        :collapsed-icon-size="20"
        :indent="18"
      />
      <div v-if="!appState.siderCollapsed" class="sider-version"><span class="dot" />v{{ settings.version }}</div>
    </n-layout-sider>

    <n-drawer v-else v-model:show="drawerOpen" placement="left" :width="270">
      <n-drawer-content :body-content-style="{ padding: 0 }">
        <div class="brand">
          <img v-if="settings.logo" :src="settings.logo" class="brand-logo" alt="" />
          <div v-else class="brand-mark">{{ settings.title.slice(0, 1) }}</div>
          <span class="brand-title">{{ settings.title }}</span>
        </div>
        <n-menu v-model:expanded-keys="expandedKeys" :value="activeKey" :options="menuOptions" :indent="18" />
      </n-drawer-content>
    </n-drawer>

    <n-layout class="admin-main" :native-scrollbar="true">
      <n-layout-header bordered class="admin-header">
        <div class="header-left">
          <n-button v-if="appState.isMobile" quaternary circle aria-label="切换导航" @click="drawerOpen = true">
            <template #icon><n-icon><menu-outline /></n-icon></template>
          </n-button>
          <n-button
            v-else
            quaternary
            circle
            :aria-label="appState.siderCollapsed ? '展开侧栏' : '收起侧栏'"
            @click="appState.siderCollapsed = !appState.siderCollapsed"
          >
            <template #icon>
              <n-icon><chevron-forward-outline v-if="appState.siderCollapsed" /><chevron-back-outline v-else /></n-icon>
            </template>
          </n-button>
          <nav class="crumbs" aria-label="breadcrumb">
            <template v-for="(c, i) in breadcrumb" :key="i">
              <span v-if="i > 0" class="crumb-sep">/</span>
              <span :class="{ 'crumb-current': i === breadcrumb.length - 1 }">{{ c }}</span>
            </template>
          </nav>
        </div>
        <div class="header-right">
          <button v-if="!appState.isMobile" type="button" class="search-trigger" @click="paletteOpen = true">
            <n-icon><search-outline /></n-icon>
            <span>搜索菜单和功能...</span>
            <kbd>{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
          </button>
          <n-button v-else quaternary circle aria-label="搜索" @click="paletteOpen = true">
            <template #icon><n-icon><search-outline /></n-icon></template>
          </n-button>
          <n-tooltip>
            <template #trigger>
              <n-button quaternary circle :aria-label="themeLabel" @click="cycleThemeMode">
                <template #icon><n-icon><component :is="themeIcon" /></n-icon></template>
              </n-button>
            </template>
            {{ themeLabel }}（点击切换）
          </n-tooltip>
          <n-dropdown trigger="click" placement="bottom-end" :options="userOptions" @select="onUserSelect">
            <button class="user-chip" type="button">
              <n-avatar
                v-if="authState.user?.avatar_url && !avatarFailed"
                round
                :size="28"
                :src="authState.user.avatar_url"
                :img-props="{ referrerpolicy: 'no-referrer' }"
                @error="avatarFailed = true"
              />
              <n-avatar v-else round :size="28" class="user-avatar">{{ userInitials }}</n-avatar>
              <span v-if="!appState.isMobile" class="user-email">{{ authState.user?.email || '管理员' }}</span>
            </button>
          </n-dropdown>
        </div>
      </n-layout-header>
      <n-layout-content class="admin-content" content-class="admin-content-inner">
        <router-view v-slot="{ Component }">
          <component :is="Component" :key="viewKey" />
        </router-view>
      </n-layout-content>
    </n-layout>
    <command-palette v-model:show="paletteOpen" :items="paletteItems" />
  </n-layout>
</template>

<style scoped>
.admin-root {
  height: 100vh;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 18px;
  overflow: hidden;
  white-space: nowrap;
}
.brand.collapsed {
  justify-content: center;
  padding: 0;
}
.brand-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex: none;
}
.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex: none;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--primary-color), #8b5cf6);
}
.brand-title {
  font-size: 15px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sider-version {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 18px 16px;
  padding-top: 10px;
  border-top: 1px solid var(--divider-color);
  font-size: 12px;
  color: var(--text-muted);
}
.sider-version .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success-color);
}
.admin-main {
  height: 100vh;
}
.admin-header {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 12px;
  gap: 12px;
}
.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
  font-size: 14px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
}
.crumb-sep {
  opacity: 0.5;
}
.crumb-current {
  color: var(--text-strong);
  font-weight: 600;
}
.search-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 232px;
  height: 34px;
  padding: 0 8px 0 10px;
  margin-right: 4px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.search-trigger:hover {
  border-color: var(--primary-color-hover);
}
.search-trigger kbd {
  margin-left: auto;
  padding: 1px 6px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  font-family: var(--font-mono);
  font-size: 11px;
}
@media (max-width: 1100px) {
  .search-trigger {
    width: auto;
  }
  .search-trigger span,
  .search-trigger kbd {
    display: none;
  }
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px 0 4px;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.user-chip:hover {
  background: var(--hover-color);
}
.user-avatar {
  background: var(--primary-color);
  color: #fff;
  font-size: 12px;
}
.user-email {
  font-size: 13px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* overflow: clip (not hidden) so these wrappers are not scroll containers and
   position: sticky inside pages sticks to the real scroller. */
.admin-content,
.admin-content :deep(.admin-content-inner) {
  overflow: clip;
}
.admin-content :deep(.admin-content-inner) {
  padding: 20px 24px 32px;
  max-width: 1680px;
  margin: 0 auto;
}
@media (max-width: 767px) {
  .admin-content :deep(.admin-content-inner) {
    padding: 14px 12px 24px;
  }
}
:global(.user-menu-head) {
  padding: 8px 14px 6px;
  min-width: 200px;
}
:global(.user-menu-name) {
  font-weight: 600;
  font-size: 14px;
}
:global(.user-menu-mail) {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
