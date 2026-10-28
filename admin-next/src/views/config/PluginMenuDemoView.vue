<script setup lang="ts">
// Plugin menu demo (spec platform §5.1): edit a sample plugin's admin_menus in memory and preview the
// sidebar output built by the same function the real sidebar uses. No requests are made.
import { computed, h, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NCard, NEmpty, NIcon, NInput, NSelect, NTag, NTooltip, type SelectOption } from 'naive-ui'
import {
  AddOutline,
  ArrowBackOutline,
  ArrowDownOutline,
  ArrowUpOutline,
  BarChartOutline,
  CardOutline,
  CopyOutline,
  CubeOutline,
  DocumentTextOutline,
  PeopleOutline,
  RefreshOutline,
  SettingsOutline,
  ShieldOutline,
  SpeedometerOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import { buildPluginMenuGroups, normalizeMenuPath, type PluginAdminMenu, type PluginInfo } from '@/stores/plugins'
import { copyText } from '@/utils/clipboard'

interface DemoMenu {
  /** Local list key only (not part of admin_menus). */
  uid: number
  id: string
  title: string
  path: string
  icon: string
  label: string
  description: string
}

const router = useRouter()

const DEMO_PLUGIN = { code: 'traffic-analytics', name: '流量分析', version: '1.2.0', type: 'feature' }
let uidSeq = 0
const seedMenus = (): DemoMenu[] => [
  { uid: ++uidSeq, id: 'overview', title: '概览', path: 'overview', icon: 'dashboard', label: 'default', description: '插件首页' },
  { uid: ++uidSeq, id: 'reports', title: '报表', path: 'reports', icon: 'bar-chart-3', label: '', description: '流量报表中心' },
]

const ICONS: { value: string; label: string; icon: Component }[] = [
  { value: 'dashboard', label: '仪表盘 dashboard', icon: SpeedometerOutline },
  { value: 'bar-chart-3', label: '柱状图 bar-chart-3', icon: BarChartOutline },
  { value: 'credit-card', label: '银行卡 credit-card', icon: CardOutline },
  { value: 'file-text', label: '文档 file-text', icon: DocumentTextOutline },
  { value: 'package', label: '包裹 package', icon: CubeOutline },
  { value: 'settings', label: '设置 settings', icon: SettingsOutline },
  { value: 'shield', label: '盾牌 shield', icon: ShieldOutline },
  { value: 'users', label: '用户 users', icon: PeopleOutline },
]
const iconOptions: SelectOption[] = ICONS.map((i) => ({ value: i.value, label: i.label }))
function renderIconLabel(option: SelectOption) {
  const icon = ICONS.find((i) => i.value === option.value)?.icon
  return h('span', { class: 'icon-opt' }, [icon ? h(NIcon, { size: 16 }, { default: () => h(icon) }) : null, String(option.label)])
}

const menus = ref<DemoMenu[]>(seedMenus())

function addMenu() {
  menus.value.push({
    uid: ++uidSeq,
    id: `menu-${menus.value.length + 1}`,
    title: '',
    path: '',
    icon: 'settings',
    label: '',
    description: '',
  })
}
function removeMenu(i: number) {
  menus.value.splice(i, 1)
}
function move(i: number, d: -1 | 1) {
  const j = i + d
  if (j < 0 || j >= menus.value.length) return
  const list = [...menus.value]
  ;[list[i], list[j]] = [list[j], list[i]]
  menus.value = list
}
function reset() {
  menus.value = seedMenus()
}

function hrefOf(m: DemoMenu) {
  const p = normalizeMenuPath(m.path)
  return p ? `/plugins/${DEMO_PLUGIN.code}/${p}` : ''
}

/** Normalized paths declared more than once (they open the same page). */
const duplicatePaths = computed(() => {
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const m of menus.value) {
    const p = normalizeMenuPath(m.path)
    if (!p) continue
    if (seen.has(p)) dup.add(p)
    seen.add(p)
  }
  return dup
})

/** What config.json would declare (empty optional keys dropped). */
const declared = computed<PluginAdminMenu[]>(() =>
  menus.value.map((m) => {
    const out: PluginAdminMenu = { id: m.id, title: m.title, path: m.path, icon: m.icon }
    if (m.label) out.label = m.label
    if (m.description) out.description = m.description
    return out
  }),
)
const groups = computed(() => {
  const plugin: PluginInfo = { ...DEMO_PLUGIN, is_installed: true, is_enabled: true, admin_menus: declared.value }
  return buildPluginMenuGroups([plugin])
})
const json = computed(() => JSON.stringify({ admin_menus: declared.value }, null, 2))
</script>

<template>
  <page-container
    title="插件菜单演示"
    description="只有在 admin_menus 中声明的菜单才会渲染到侧边栏。在这里编辑菜单项，即可预览最终效果（仅在本页内存中生效，不会保存）。"
  >
    <template #extra>
      <n-button @click="router.push('/config/plugin')">
        <template #icon><n-icon><arrow-back-outline /></n-icon></template>
        插件管理
      </n-button>
      <n-button @click="reset">
        <template #icon><n-icon><refresh-outline /></n-icon></template>
        重置
      </n-button>
    </template>

    <div class="demo-grid">
      <n-card title="菜单项" size="small">
        <template #header-extra>
          <n-button size="small" type="primary" @click="addMenu">
            <template #icon><n-icon><add-outline /></n-icon></template>
            添加菜单
          </n-button>
        </template>

        <n-empty
          v-if="!menus.length"
          description="该插件当前没有声明任何管理菜单，因此不会出现在侧边栏中。"
          class="demo-empty"
        />
        <div v-else class="menu-list">
          <section v-for="(m, i) in menus" :key="m.uid" class="menu-item">
            <header class="mi-head">
              <div class="mi-title">
                <div class="mi-name">{{ m.title || `菜单 ${i + 1}` }}</div>
                <code v-if="hrefOf(m)" class="mi-href mono">{{ hrefOf(m) }}</code>
                <span v-else class="mi-href warn">路径为空，该菜单不会显示</span>
                <span v-if="duplicatePaths.has(normalizeMenuPath(m.path))" class="mi-href warn">
                  路径与其他菜单重复，它们会打开同一个页面
                </span>
              </div>
              <div class="mi-ops">
                <n-button size="tiny" quaternary circle aria-label="上移" :disabled="i === 0" @click="move(i, -1)">
                  <template #icon><n-icon><arrow-up-outline /></n-icon></template>
                </n-button>
                <n-button
                  size="tiny"
                  quaternary
                  circle
                  aria-label="下移"
                  :disabled="i === menus.length - 1"
                  @click="move(i, 1)"
                >
                  <template #icon><n-icon><arrow-down-outline /></n-icon></template>
                </n-button>
                <n-tooltip>
                  <template #trigger>
                    <n-button size="tiny" quaternary circle type="error" aria-label="删除菜单" @click="removeMenu(i)">
                      <template #icon><n-icon><trash-outline /></n-icon></template>
                    </n-button>
                  </template>
                  删除菜单
                </n-tooltip>
              </div>
            </header>
            <div class="mi-fields">
              <label class="mi-field">
                <span>标题</span>
                <n-input v-model:value="m.title" placeholder="报表" />
              </label>
              <label class="mi-field">
                <span>路径</span>
                <n-input v-model:value="m.path" placeholder="reports" class="mono" />
              </label>
              <label class="mi-field">
                <span>图标</span>
                <n-select v-model:value="m.icon" :options="iconOptions" :render-label="renderIconLabel" />
              </label>
              <label class="mi-field">
                <span>徽标</span>
                <n-input v-model:value="m.label" placeholder="beta" />
              </label>
              <label class="mi-field wide">
                <span>描述</span>
                <n-input v-model:value="m.description" placeholder="显示在插件页面标题下方" />
              </label>
            </div>
          </section>
        </div>
      </n-card>

      <div class="demo-side">
        <n-card title="侧边栏预览" size="small">
          <p class="side-desc">预览与真实侧边栏使用同一个菜单构建函数，所见即最终效果。</p>
          <n-empty v-if="!groups.length" description="该插件不会在侧边栏中渲染任何菜单项。" class="demo-empty" />
          <div v-for="g in groups" :key="g.key" class="sb-group">
            <div class="sb-group-head">
              <n-icon :size="18"><component :is="g.icon" /></n-icon>
              <span class="sb-group-title">{{ g.title }}</span>
              <n-tag size="tiny" :bordered="false" class="mono">{{ g.badge }}</n-tag>
            </div>
            <div v-for="it in g.items" :key="it.key" class="sb-item">
              <n-icon :size="16" class="sb-item-icon"><component :is="it.icon" /></n-icon>
              <span class="sb-item-title">{{ it.title || '（无标题）' }}</span>
              <n-tag v-if="it.label" size="tiny" :bordered="false">{{ it.label }}</n-tag>
              <code class="sb-item-href mono">{{ it.href }}</code>
            </div>
          </div>
        </n-card>

        <n-card title="config.json 声明" size="small">
          <template #header-extra>
            <n-button size="small" quaternary @click="copyText(json)">
              <template #icon><n-icon><copy-outline /></n-icon></template>
              复制
            </n-button>
          </template>
          <code-editor :value="json" language="json" readonly :rows="12" />
        </n-card>
      </div>
    </div>
  </page-container>
</template>

<style scoped>
.demo-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
}
@media (min-width: 1100px) {
  .demo-grid {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  }
}
.demo-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.demo-empty {
  padding: 28px 0;
}
.menu-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.menu-item {
  padding: 12px 14px 14px;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
}
.mi-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.mi-title {
  min-width: 0;
}
.mi-name {
  font-weight: 600;
  color: var(--text-strong);
}
.mi-href {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
}
.mi-href.warn {
  color: var(--warning-color);
}
.mi-ops {
  display: flex;
  gap: 2px;
  flex: none;
}
.mi-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}
.mi-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.mi-field.wide {
  grid-column: 1 / -1;
}
@media (max-width: 640px) {
  .mi-fields {
    grid-template-columns: 1fr;
  }
}
.side-desc {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--text-muted);
}
.sb-group {
  padding: 6px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}
.sb-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-weight: 500;
}
.sb-group-title {
  color: var(--text-strong);
}
.sb-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 8px 34px;
  border-radius: 6px;
  font-size: 14px;
}
.sb-item:hover {
  background: var(--hover-color);
}
.sb-item-icon {
  color: var(--text-muted);
}
.sb-item-title {
  white-space: nowrap;
}
.sb-item-href {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
:global(.icon-opt) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
