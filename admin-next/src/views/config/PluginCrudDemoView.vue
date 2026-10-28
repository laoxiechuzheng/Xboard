<script setup lang="ts">
// Schema CRUD demo (spec platform §5.2): the admin_crud renderer used by plugin pages, driven by an
// in-memory source. Shows the schema and the requests the real runtime would send.
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NCard, NEmpty, NIcon, NTag } from 'naive-ui'
import { ArrowBackOutline, CopyOutline, RefreshOutline } from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import type { PluginCrudSchema } from '@/api/plugin'
import { copyText } from '@/utils/clipboard'
import SchemaCrudTable from '@/views/plugin/components/SchemaCrudTable.vue'
import { memoryCrudSource, type CrudRequestLog } from '@/views/plugin/crud'

const router = useRouter()

const schema: PluginCrudSchema = {
  version: 1,
  title: '流量记录',
  description: '演示一个完全由 JSON Schema 驱动的增删改查页面。',
  id_field: 'id',
  api: {
    list: '/plugin/traffic-analytics/records/fetch',
    save: '/plugin/traffic-analytics/records/save',
    delete: '/plugin/traffic-analytics/records/delete',
  },
  columns: [
    { key: 'id', title: 'ID', type: 'number', sortable: true, width: 80 },
    { key: 'domain', title: '域名', type: 'string', searchable: true },
    { key: 'requests', title: '请求数', type: 'number', sortable: true },
    {
      key: 'status',
      title: '状态',
      type: 'tag',
      options: [
        { value: 'active', label: '正常', variant: 'default' },
        { value: 'inactive', label: '停用', variant: 'secondary' },
        { value: 'blocked', label: '封禁', variant: 'destructive' },
      ],
    },
    { key: 'is_monitored', title: '监控', type: 'boolean' },
    { key: 'created_at', title: '创建时间', type: 'datetime', sortable: true },
  ],
  form: {
    domain: { type: 'string', label: '域名', placeholder: '例如 example.com', required: true },
    requests: { type: 'number', label: '请求数', placeholder: '0', value: 0 },
    status: {
      type: 'select',
      label: '状态',
      value: 'active',
      options: [
        { value: 'active', label: '正常' },
        { value: 'inactive', label: '停用' },
        { value: 'blocked', label: '封禁' },
      ],
    },
    is_monitored: { type: 'boolean', label: '开启监控', description: '开启后将实时统计该域名的流量。', value: false },
    notes: { type: 'text', label: '备注', placeholder: '关于该记录的可选备注...' },
  },
  actions: { create: true, edit: true, delete: true },
}

const DOMAINS = ['api', 'cdn', 'app', 'static', 'ws', 'auth', 'billing', 'docs', 'admin', 'metrics', 'gateway', 'webhook']
const STATUSES = ['active', 'inactive', 'blocked']

function seedRows(): Record<string, unknown>[] {
  const now = Math.floor(Date.now() / 1000)
  return DOMAINS.map((d, i) => ({
    id: i + 1,
    domain: `${d}.example.com`,
    requests: Math.floor(Math.random() * 100000),
    status: STATUSES[i % 3],
    is_monitored: i % 3 !== 2,
    notes: i % 2 === 0 ? '自动生成的种子记录' : null,
    created_at: now - (i + 1) * 86400,
  }))
}

const requests = ref<CrudRequestLog[]>([])
const tableKey = ref(0)

function createSource() {
  return memoryCrudSource(schema, seedRows(), {
    firstId: 100,
    onRequest: (log) => {
      requests.value = [log, ...requests.value].slice(0, 8)
    },
  })
}
const source = ref(createSource())

function reset() {
  requests.value = []
  source.value = createSource()
  tableKey.value++
}

const schemaJson = computed(() => JSON.stringify(schema, null, 2))
const fmt = (v: unknown) => JSON.stringify(v)
</script>

<template>
  <page-container title="Schema CRUD 演示" description="由一份 JSON Schema 生成的完整列表 + 新建 / 编辑 / 删除页面（数据只保存在本页内存中）。">
    <template #extra>
      <n-button @click="router.push('/config/plugin')">
        <template #icon><n-icon><arrow-back-outline /></n-icon></template>
        插件管理
      </n-button>
      <n-button @click="reset">
        <template #icon><n-icon><refresh-outline /></n-icon></template>
        重置数据
      </n-button>
    </template>

    <div class="demo-grid">
      <n-card size="small" class="demo-main">
        <template #header>
          <div class="main-head">
            <span>{{ schema.title }}</span>
            <span class="main-desc">{{ schema.description }}</span>
          </div>
        </template>
        <schema-crud-table :key="tableKey" :schema="schema" :source="source" />
      </n-card>

      <div class="demo-side">
        <n-card size="small">
          <template #header>
            <span class="side-title">Schema 声明 <n-tag size="tiny" round :bordered="false" class="mono">v{{ schema.version }}</n-tag></span>
          </template>
          <template #header-extra>
            <n-button size="small" quaternary @click="copyText(schemaJson)">
              <template #icon><n-icon><copy-outline /></n-icon></template>
              复制
            </n-button>
          </template>
          <p class="side-desc">插件在 config.json 的 <code class="mono">admin_crud.&lt;子路径&gt;</code> 中声明以下结构即可得到左侧页面。</p>
          <pre class="schema-pre mono">{{ schemaJson }}</pre>
        </n-card>

        <n-card title="请求记录" size="small">
          <p class="side-desc">真实插件页面会向插件自己注册的接口（相对管理前缀）发送以下请求；演示页只在内存中处理。</p>
          <n-empty v-if="!requests.length" description="暂无请求" size="small" />
          <ul v-else class="req-list">
            <li v-for="r in requests" :key="r.seq" class="req-item">
              <div class="req-line">
                <n-tag size="tiny" :type="r.method === 'GET' ? 'info' : 'warning'" :bordered="false" class="mono">
                  {{ r.method }}
                </n-tag>
                <code class="mono req-path">{{ r.path }}</code>
              </div>
              <code class="mono req-payload">{{ fmt(r.payload) }}</code>
            </li>
          </ul>
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
@media (min-width: 1280px) {
  .demo-grid {
    grid-template-columns: minmax(0, 1fr) 380px;
  }
}
.demo-main {
  min-width: 0;
}
.main-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.main-desc {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}
.demo-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.side-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.side-desc {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
}
.schema-pre {
  max-height: 70vh;
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  border-radius: 8px;
  background: var(--code-bg);
  font-size: 12px;
  line-height: 1.55;
}
.req-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.req-item {
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  min-width: 0;
}
.req-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.req-path {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.req-payload {
  display: block;
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--text-muted);
  word-break: break-all;
}
</style>
