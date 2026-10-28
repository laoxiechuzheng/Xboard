<script setup lang="ts">
// 礼品卡管理 (spec commerce §6): templates / codes / usages / statistics tabs. The active tab is kept
// in `?tab=`; `?template_id=`, `?batch_id=` (codes) and `?user=` (usages, email or id) preset filters.
import { h, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NIcon, NTabPane, NTabs } from 'naive-ui'
import { AlbumsOutline, BarChartOutline, KeyOutline, ReceiptOutline } from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import { appState } from '@/stores/app'
import CodesTab from './gift-card/CodesTab.vue'
import GenerateCodesDialog from './gift-card/GenerateCodesDialog.vue'
import StatisticsTab from './gift-card/StatisticsTab.vue'
import TemplatesTab from './gift-card/TemplatesTab.vue'
import UsagesTab from './gift-card/UsagesTab.vue'
import type { TabIntent, TabKey } from './gift-card/helpers'

interface TabMeta {
  key: TabKey
  label: string
  title: string
  desc: string
  icon: typeof AlbumsOutline
}

const TABS: [TabMeta, TabMeta, TabMeta, TabMeta] = [
  { key: 'templates', label: '模板管理', title: '模板管理', desc: '管理礼品卡模板，包括创建、编辑和删除模板。', icon: AlbumsOutline },
  { key: 'codes', label: '兑换码管理', title: '兑换码管理', desc: '管理礼品卡兑换码，包括生成、查看和导出兑换码。', icon: KeyOutline },
  { key: 'usages', label: '使用记录', title: '使用记录', desc: '查看礼品卡的使用记录和详细信息。', icon: ReceiptOutline },
  { key: 'statistics', label: '统计数据', title: '统计数据', desc: '查看礼品卡的统计数据和使用情况分析。', icon: BarChartOutline },
]

const route = useRoute()
const router = useRouter()

function tabLabel(t: TabMeta) {
  return h('span', { class: 'tab-label' }, [
    appState.isMobile ? null : h(NIcon, { size: 16 }, { default: () => h(t.icon) }),
    t.label,
  ])
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const posInt = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : null)
const isTab = (v: unknown): v is TabKey => TABS.some((t) => t.key === v)

let seq = 0
const tab = ref<TabKey>(isTab(route.query.tab) ? route.query.tab : 'templates')
const codesIntent = ref<TabIntent | null>(null)
const usagesIntent = ref<TabIntent | null>(null)

// Deep-link filters from the URL (applied once on entry).
{
  const templateId = posInt(route.query.template_id)
  const batchId = str(route.query.batch_id)
  const user = str(route.query.user) ?? str(route.query.email) ?? str(route.query.user_id)
  if (tab.value === 'codes' && (templateId || batchId)) codesIntent.value = { template_id: templateId, batch_id: batchId, seq: ++seq }
  if (tab.value === 'usages' && (templateId || user)) usagesIntent.value = { template_id: templateId, user, seq: ++seq }
}

watch(tab, (v) => {
  // Keep only the tab in the URL; filters live in the tabs.
  if ((route.query.tab ?? 'templates') !== v) void router.replace({ query: v === 'templates' ? {} : { tab: v } })
})
// Navigating to the page again with another ?tab= (same component instance).
watch(
  () => route.query.tab,
  (v) => {
    if (route.path !== '/finance/gift-card') return
    const next = isTab(v) ? v : 'templates'
    if (next !== tab.value) tab.value = next
  },
)

const codesRef = ref<InstanceType<typeof CodesTab> | null>(null)
const statsRef = ref<InstanceType<typeof StatisticsTab> | null>(null)

// ---------- generate dialog (shared by the templates and codes tabs) ----------
const generateShow = ref(false)
const generateTemplateId = ref<number | null>(null)

function openGenerate(templateId: number | null) {
  generateTemplateId.value = templateId
  generateShow.value = true
}
function onGenerated() {
  void codesRef.value?.reload()
  void statsRef.value?.reload()
}

function viewCodes(templateId: number) {
  codesIntent.value = { template_id: templateId, seq: ++seq }
  tab.value = 'codes'
}
function viewBatch(batchId: string) {
  codesIntent.value = { batch_id: batchId, seq: ++seq }
  tab.value = 'codes'
}
function viewUsages(templateId: number) {
  usagesIntent.value = { template_id: templateId, seq: ++seq }
  tab.value = 'usages'
}
function onTemplatesChanged() {
  void statsRef.value?.reload()
}
</script>

<template>
  <page-container title="礼品卡管理" description="在这里可以管理礼品卡模板、兑换码和使用记录等功能。">
    <n-card :bordered="false" class="gc-card" content-style="padding: 12px 16px 16px">
      <n-tabs v-model:value="tab" type="segment" :size="appState.isMobile ? 'small' : 'medium'" class="gc-tabs">
        <!-- Explicit panes (not v-for) so the component refs stay single instances. -->
        <n-tab-pane name="templates" display-directive="show:lazy" :tab="() => tabLabel(TABS[0])">
          <header class="pane-head">
            <h2>{{ TABS[0].title }}</h2>
            <p>{{ TABS[0].desc }}</p>
          </header>
          <templates-tab
            @generate="openGenerate"
            @view-codes="viewCodes"
            @view-usages="viewUsages"
            @changed="onTemplatesChanged"
          />
        </n-tab-pane>
        <n-tab-pane name="codes" display-directive="show:lazy" :tab="() => tabLabel(TABS[1])">
          <header class="pane-head">
            <h2>{{ TABS[1].title }}</h2>
            <p>{{ TABS[1].desc }}</p>
          </header>
          <codes-tab ref="codesRef" :intent="codesIntent" @generate="openGenerate" />
        </n-tab-pane>
        <n-tab-pane name="usages" display-directive="show:lazy" :tab="() => tabLabel(TABS[2])">
          <header class="pane-head">
            <h2>{{ TABS[2].title }}</h2>
            <p>{{ TABS[2].desc }}</p>
          </header>
          <usages-tab :intent="usagesIntent" />
        </n-tab-pane>
        <n-tab-pane name="statistics" display-directive="show:lazy" :tab="() => tabLabel(TABS[3])">
          <header class="pane-head">
            <h2>{{ TABS[3].title }}</h2>
            <p>{{ TABS[3].desc }}</p>
          </header>
          <statistics-tab ref="statsRef" />
        </n-tab-pane>
      </n-tabs>
    </n-card>

    <generate-codes-dialog
      v-model:show="generateShow"
      :template-id="generateTemplateId"
      @generated="onGenerated"
      @view-batch="viewBatch"
    />
  </page-container>
</template>

<style scoped>
.gc-card {
  border-radius: 12px;
}
.gc-tabs :deep(.n-tabs-rail) {
  margin-bottom: 4px;
}
.gc-tabs :deep(.tab-label) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.pane-head {
  margin: 10px 0 14px;
}
.pane-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-strong);
}
.pane-head p {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
