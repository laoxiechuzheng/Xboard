<script setup lang="ts">
// 订阅模板 (group `subscribe_template`, spec settings.md §4.9). Fixes over the official
// auto-save: explicit per-client save of one key, syntax checks, no empty content,
// confirmation, unsaved-change prompt and a download of the saved version for rollback.
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NIcon, NTab, NTabs, NTooltip } from 'naive-ui'
import { DownloadOutline } from '@vicons/ionicons5'
import { ApiError } from '@/api/http'
import { fetchConfigGroup, saveConfig } from '@/api/config'
import CodeEditor from '@/components/CodeEditor.vue'
import { message } from '@/utils/discrete'
import { saveFile } from '@/utils/clipboard'
import ConfigPanel from './ConfigPanel.vue'
import SaveBar from './SaveBar.vue'
import { confirmAction, confirmRisks, translateValidation, useSettingsTab } from './helpers'

type ClientName = 'singbox' | 'clash' | 'clashmeta' | 'stash' | 'surge' | 'surfboard'

interface ClientMeta {
  name: ClientName
  label: string
  key: string
  language: 'json' | 'yaml' | 'conf'
  ext: string
  title: string
  description: string
  placeholders: Array<{ token: string; desc: string }>
}

const SURGE_VARS = [
  { token: '$subs_link', desc: '用户订阅链接' },
  { token: '$subs_domain', desc: '订阅请求的域名' },
  { token: '$proxies', desc: '节点列表（[Proxy] 段）' },
  { token: '$proxy_group', desc: '全部节点名称，逗号分隔' },
  { token: '$subscribe_info', desc: '流量与到期信息面板' },
]
const CLASH_VARS = [{ token: '$app_name', desc: '站点名称' }]

const clients: ClientMeta[] = [
  {
    name: 'singbox',
    label: 'Sing-box',
    key: 'subscribe_template_singbox',
    language: 'json',
    ext: 'json',
    title: 'Sing-box 订阅模板',
    description: '配置 Sing-box 的订阅模板格式（JSON），节点会追加到 outbounds 中。',
    placeholders: [],
  },
  {
    name: 'clash',
    label: 'Clash',
    key: 'subscribe_template_clash',
    language: 'yaml',
    ext: 'yaml',
    title: 'Clash 订阅模板',
    description: '配置 Clash 的订阅模板格式（YAML），节点会追加到 proxies 与各 proxy-groups 中。',
    placeholders: CLASH_VARS,
  },
  {
    name: 'clashmeta',
    label: 'Clash Meta',
    key: 'subscribe_template_clashmeta',
    language: 'yaml',
    ext: 'yaml',
    title: 'Clash Meta 订阅模板',
    description: '配置 Clash Meta 的订阅模板格式（YAML）。',
    placeholders: CLASH_VARS,
  },
  {
    name: 'stash',
    label: 'Stash',
    key: 'subscribe_template_stash',
    language: 'yaml',
    ext: 'yaml',
    title: 'Stash 订阅模板',
    description: '配置 Stash 的订阅模板格式（YAML）。',
    placeholders: CLASH_VARS,
  },
  {
    name: 'surge',
    label: 'Surge',
    key: 'subscribe_template_surge',
    language: 'conf',
    ext: 'conf',
    title: 'Surge 配置模板',
    description: '配置 Surge 订阅模板，支持 Surge 配置文件格式。',
    placeholders: SURGE_VARS,
  },
  {
    name: 'surfboard',
    label: 'Surfboard',
    key: 'subscribe_template_surfboard',
    language: 'conf',
    ext: 'conf',
    title: 'Surfboard 配置模板',
    description: '配置 Surfboard 订阅模板，支持 Surfboard 配置文件格式。',
    placeholders: SURGE_VARS,
  },
]

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saved = reactive<Record<ClientName, string>>({
  singbox: '',
  clash: '',
  clashmeta: '',
  stash: '',
  surge: '',
  surfboard: '',
})
const initial = clients.find((c) => c.name === route.query.sub)?.name ?? 'singbox'
const active = ref<ClientName>(initial)
const draft = ref('')

const client = computed(() => clients.find((c) => c.name === active.value) ?? clients[0])
const dirty = computed(() => !loading.value && !loadError.value && draft.value !== saved[active.value])

function applyGroup(data: Record<string, unknown>) {
  for (const c of clients) {
    const v = data[c.key]
    saved[c.name] = typeof v === 'string' ? v : ''
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    applyGroup(await fetchConfigGroup('subscribe_template'))
    draft.value = saved[active.value]
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function selectClient(name: string) {
  const next = clients.find((c) => c.name === name)?.name
  if (!next || next === active.value) return
  if (dirty.value) {
    const ok = await confirmAction({
      title: '未保存的修改',
      content: `${client.value.label} 模板有未保存的修改，切换后这些修改将丢失。`,
      positiveText: '丢弃修改',
    })
    if (!ok) return
  }
  active.value = next
  draft.value = saved[next]
  void router.replace({ query: { ...route.query, sub: next } })
}

// ---- checks (no YAML parser is bundled: structural checks only) ----
// Mirrors what app/Protocols/{Clash,ClashMeta,Stash,SingBox}.php read without isset():
// anything missing there throws, and every subscription of that client returns 500.

interface CheckResult {
  errors: string[]
  warnings: string[]
}

const BREAKS = '，保存后该客户端的所有订阅都会生成失败'
const OTHERWISE = '，否则该客户端的所有订阅都会生成失败'
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function checkSingbox(content: string, errors: string[]) {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (e) {
    errors.push(`JSON 格式错误：${(e as Error).message}`)
    return
  }
  if (!isRecord(parsed)) {
    errors.push('模板必须是 JSON 对象')
    return
  }
  const outbounds = parsed.outbounds
  if (!Array.isArray(outbounds)) errors.push(`缺少 outbounds 数组（节点会追加到这里）${BREAKS}`)
  else {
    outbounds.forEach((o, i) => {
      if (!isRecord(o) || typeof o.type !== 'string') {
        errors.push(`outbounds 第 ${i + 1} 项必须是带 type 字段的对象${OTHERWISE}`)
        return
      }
      // Nodes are pushed into every selector / urltest group.
      if ((o.type === 'selector' || o.type === 'urltest') && !Array.isArray(o.outbounds)) {
        const tag = typeof o.tag === 'string' && o.tag ? o.tag : `第 ${i + 1} 项`
        errors.push(`出站「${tag}」（${o.type}）缺少 outbounds 数组（可写为 "outbounds": []）${BREAKS}`)
      }
    })
  }
  if (!isRecord(parsed.route) || !Array.isArray(parsed.route.rules))
    errors.push(`缺少 route.rules 数组（没有规则时写为 "route": { "rules": [] }）${BREAKS}`)
}

interface YamlTopKey {
  /** Value after `key:` on the same line, inline comment removed. */
  inline: string
  /** Indented (or column-0 `- `) lines that belong to the key. */
  body: string[]
}

/** Top-level keys of a YAML mapping, by line scanning. */
function yamlTopKeys(lines: string[]): Map<string, YamlTopKey> {
  const keys = new Map<string, YamlTopKey>()
  let cur: YamlTopKey | null = null
  for (const line of lines) {
    if (line === '---' || line === '...') continue
    const m = /^(?:"([^"]+)"|'([^']+)'|([^\s#'"\-?][^:#]*?))\s*:(?:\s+(.*))?$/.exec(line)
    if (m) {
      cur = { inline: (m[4] ?? '').replace(/(^|\s)#.*$/, '').trim(), body: [] }
      keys.set(m[1] ?? m[2] ?? m[3], cur)
    } else if (cur) cur.body.push(line)
  }
  return keys
}

const isSignificant = (l: string) => !/^\s*(#|$)/.test(l)
const isNullish = (v: string) => /^(~|null|Null|NULL)?$/.test(v)

/** Present with a non-null value: inline value, or at least one nested line. */
function yamlHasValue(k: YamlTopKey): boolean {
  return !isNullish(k.inline) || k.body.some(isSignificant)
}

/** Names of block-style proxy-groups entries without a `proxies` key (each group's proxies are read directly). */
function groupsWithoutProxies(body: string[]): string[] {
  const lines = body.filter(isSignificant)
  const first = lines.find((l) => /^\s*-(\s|$)/.test(l))
  if (!first) return []
  const indent = first.indexOf('-')
  const itemStart = new RegExp(`^ {${indent}}-(\\s|$)`)
  const items: string[][] = []
  for (const l of lines) {
    if (itemStart.test(l)) items.push([l])
    else items[items.length - 1]?.push(l)
  }
  const missing: string[] = []
  items.forEach((item, i) => {
    const text = item.join('\n')
    if (/<<\s*:|\*\w/.test(text)) return // merge keys / aliases may supply proxies: can't tell
    if (/(^\s*(-\s+)?|[{,]\s*)["']?proxies["']?\s*:/m.test(text)) return
    const name = /(?:^\s*(?:-\s+)?|[{,]\s*)["']?name["']?\s*:\s*["']?([^"',}\n]+)/m.exec(text)?.[1]?.trim()
    missing.push(`「${name || `第 ${i + 1} 个`}」`)
  })
  return missing
}

function checkClashYaml(content: string, errors: string[]) {
  const lines = content.split(/\r?\n/)
  const tabLine = lines.findIndex((l) => /^\s*\t/.test(l))
  if (tabLine >= 0) errors.push(`第 ${tabLine + 1} 行使用了 Tab 缩进，YAML 只允许空格缩进`)
  const keys = yamlTopKeys(lines)

  // proxies: may be empty (null is treated as []), but the key itself must exist.
  if (!keys.has('proxies')) errors.push(`缺少顶层 proxies 字段（节点会追加到这里，可写为 proxies: []）${BREAKS}`)

  const groups = keys.get('proxy-groups')
  if (!groups) errors.push(`缺少顶层 proxy-groups 字段${BREAKS}`)
  else if (!yamlHasValue(groups)) errors.push(`proxy-groups 不能为空值（没有分组时写为 proxy-groups: []）${OTHERWISE}`)
  else {
    const missing = groupsWithoutProxies(groups.body)
    if (missing.length) {
      const shown = missing.slice(0, 3).join('、') + (missing.length > 3 ? `等 ${missing.length} 个` : '')
      errors.push(`分组${shown}缺少 proxies 字段（可写为 proxies: []）${BREAKS}`)
    }
  }

  // rules: the subscription domain is prepended, so it must be a list.
  const rules = keys.get('rules')
  if (!rules) errors.push(`缺少顶层 rules 字段（没有规则时写为 rules: []）${BREAKS}`)
  else if (!yamlHasValue(rules)) errors.push(`rules 不能为空值（没有规则时写为 rules: []）${OTHERWISE}`)
}

function check(meta: ClientMeta, content: string): CheckResult {
  const errors: string[] = []
  const warnings: string[] = []
  if (!content.trim()) {
    errors.push('模板内容不能为空，空模板会导致该客户端订阅生成失败')
    return { errors, warnings }
  }
  if (meta.language === 'json') checkSingbox(content, errors)
  else if (meta.language === 'yaml') checkClashYaml(content, errors)
  else {
    if (!/^\s*\[Proxy\]\s*$/m.test(content)) warnings.push('未找到 [Proxy] 段')
    if (!content.includes('$proxies')) warnings.push('未包含 $proxies 占位符，订阅中将没有节点')
  }
  return { errors, warnings }
}

const result = computed(() => (loading.value ? { errors: [], warnings: [] } : check(client.value, draft.value)))

// ---- actions ----

// Held through check, confirmation and request so Ctrl+S during the dialog can't save twice.
let busy = false

async function save(): Promise<boolean> {
  if (busy || loading.value || loadError.value) return false
  busy = true
  try {
    return await runSave()
  } finally {
    busy = false
  }
}

async function runSave(): Promise<boolean> {
  if (!dirty.value) {
    message.info('没有需要保存的修改')
    return true
  }
  const meta = client.value
  const content = draft.value
  const { errors, warnings } = check(meta, content)
  if (errors.length) {
    message.error(errors[0])
    return false
  }
  const ok = await confirmRisks([
    {
      title: `保存 ${meta.label} 订阅模板`,
      content:
        `保存后立即对所有用户的 ${meta.label} 订阅生效，内容有误会导致该客户端订阅生成失败。系统没有“恢复默认”功能，建议先下载已保存版本作为备份。` +
        (warnings.length ? `\n\n注意：${warnings.join('；')}` : ''),
    },
  ])
  if (!ok) return false
  saving.value = true
  try {
    // Submit only this client's key, as a string.
    await saveConfig({ [meta.key]: content })
  } catch (e) {
    const msg =
      e instanceof ApiError && e.errors?.[meta.key]?.[0] ? translateValidation(e.errors[meta.key][0]) : (e as Error).message
    message.error(`保存失败：${msg}`)
    return false
  } finally {
    saving.value = false
  }
  message.success('保存成功')
  try {
    applyGroup(await fetchConfigGroup('subscribe_template', { silent: true }))
  } catch {
    saved[meta.name] = content.trim()
  }
  if (active.value === meta.name) draft.value = saved[meta.name]
  return true
}

function discard() {
  draft.value = saved[active.value]
}

function downloadSaved() {
  const meta = client.value
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
  saveFile(saved[meta.name], `subscribe-template-${meta.name}-${stamp}.${meta.ext}`)
}

useSettingsTab({ isDirty: () => dirty.value, save })
</script>

<template>
  <config-panel
    title="订阅模板"
    description="配置各个客户端的订阅模板"
    :loading="loading"
    :error="loadError"
    @retry="load"
  >
    <n-tabs :value="active" type="line" class="client-tabs" @update:value="selectClient">
      <n-tab v-for="c in clients" :key="c.name" :name="c.name">
        {{ c.label }}<span v-if="c.name === active && dirty" class="tab-dot" title="有未保存的修改" />
      </n-tab>
    </n-tabs>

    <div class="tpl-head">
      <div class="tpl-heading">
        <div class="tpl-title">{{ client.title }}</div>
        <div class="tpl-desc">{{ client.description }}</div>
      </div>
      <n-tooltip>
        <template #trigger>
          <n-button size="small" secondary :disabled="!saved[client.name]" @click="downloadSaved">
            <template #icon><n-icon><download-outline /></n-icon></template>
            下载已保存版本
          </n-button>
        </template>
        下载服务器上当前生效的模板内容，便于修改出错时回滚
      </n-tooltip>
    </div>

    <div v-if="client.placeholders.length" class="vars">
      <span class="vars-label">可用占位符</span>
      <span v-for="v in client.placeholders" :key="v.token" class="var-chip" :title="v.desc">
        <code class="mono">{{ v.token }}</code>
        <span class="muted">{{ v.desc }}</span>
      </span>
    </div>

    <code-editor v-model:value="draft" :language="client.language" :rows="26" :placeholder="`${client.label} 模板内容`" />

    <ul v-if="result.errors.length || result.warnings.length" class="issues">
      <li v-for="e in result.errors" :key="'e' + e" class="issue is-error">{{ e }}</li>
      <li v-for="w in result.warnings" :key="'w' + w" class="issue is-warning">{{ w }}</li>
    </ul>

    <div class="tpl-actions">
      <n-button type="primary" :disabled="!dirty" :loading="saving" @click="save">保存当前模板</n-button>
      <n-button v-if="dirty" quaternary :disabled="saving" @click="discard">还原修改</n-button>
      <span class="muted save-hint">只保存当前客户端的模板，保存后立即对所有用户生效。</span>
    </div>
  </config-panel>
  <save-bar :count="dirty ? 1 : 0" :saving="saving" save-text="保存当前模板" @save="save" @discard="discard" />
</template>

<style scoped>
.client-tabs {
  margin-top: 4px;
}
.tab-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 6px;
  border-radius: 50%;
  background: var(--warning-color);
  vertical-align: middle;
}
.tpl-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 16px 0 12px;
}
.tpl-heading {
  min-width: 0;
}
.tpl-title {
  font-size: 15px;
  font-weight: 650;
  color: var(--text-strong);
}
.tpl-desc {
  margin-top: 2px;
  font-size: 13px;
  color: var(--text-muted);
}
.vars {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-bottom: 12px;
  font-size: 12.5px;
}
.vars-label {
  font-weight: 600;
  color: var(--text-color);
}
.var-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}
.var-chip code {
  color: var(--primary-color);
}
.issues {
  margin: 10px 0 0;
  padding-left: 18px;
  font-size: 12.5px;
  line-height: 1.7;
}
.is-error {
  color: var(--error-color);
}
.is-warning {
  color: var(--warning-color);
}
.tpl-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin: 14px 0 8px;
}
.save-hint {
  font-size: 12.5px;
}
</style>
