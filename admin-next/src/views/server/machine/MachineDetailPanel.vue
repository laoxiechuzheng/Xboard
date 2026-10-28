<script setup lang="ts">
// Detail content for one server (spec nodes §5.7). Mounted only while the drawer is open,
// so timers and token visibility reset whenever it closes.
import { computed, h, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NIcon,
  NPopconfirm,
  NTag,
  NTooltip,
  type DataTableColumns,
} from 'naive-ui'
import {
  AddOutline,
  ArrowForwardOutline,
  CreateOutline,
  EyeOffOutline,
  EyeOutline,
  KeyOutline,
  LinkOutline,
  RefreshOutline,
  ServerOutline,
  TerminalOutline,
  TimeOutline,
  UnlinkOutline,
} from '@vicons/ionicons5'
import {
  fetchMachineNodes,
  getMachineInstallCommand,
  getMachineToken,
  resetMachineToken,
  setMachineNodeEnabled,
  unbindMachineNode,
  type Machine,
  type MachineNode,
} from '@/api/machine'
import SwitchCell from '@/components/SwitchCell.vue'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'
import { formatTime } from '@/utils/format'
import BindNodesDialog from './BindNodesDialog.vue'
import CodeBlock from './CodeBlock.vue'
import LoadBars from './LoadBars.vue'
import MachineLoadChart from './MachineLoadChart.vue'
import {
  STATUS_META,
  isHighLoad,
  levelColor,
  loadLevel,
  machineStatus,
  nodeTypeLabel,
  nodeTypeTagColor,
  relativeAgo,
} from './machine-utils'

const props = defineProps<{ machine: Machine; now: number }>()
const emit = defineEmits<{
  (e: 'edit'): void
  /** Bound nodes changed: the list's servers_count needs a refresh. */
  (e: 'changed'): void
}>()

const router = useRouter()

const status = computed(() => machineStatus(props.machine, props.now))
const statusMeta = computed(() => STATUS_META[status.value])
const cpu = computed(() => Number(props.machine.load_status?.cpu ?? 0))
const highLoad = computed(() => isHighLoad(props.machine.load_status))

function goNodes(openCreate = false) {
  const query: Record<string, string> = { machine_id: String(props.machine.id) }
  if (openCreate) query.open_create = '1'
  void router.push({ path: '/server/manage', query })
}

// ---- token: revealed on demand, auto-hidden after 180s ----
const TOKEN_TTL = 180
const token = ref('')
const tokenLoading = ref(false)
const tokenResetting = ref(false)
const remain = ref(0)
let tokenTimer: ReturnType<typeof setInterval> | undefined

function revealToken(value: string) {
  token.value = value
  remain.value = TOKEN_TTL
  clearInterval(tokenTimer)
  tokenTimer = setInterval(() => {
    remain.value -= 1
    if (remain.value <= 0) hideToken()
  }, 1000)
}

function hideToken() {
  clearInterval(tokenTimer)
  token.value = ''
  remain.value = 0
}

async function toggleToken() {
  if (token.value) return hideToken()
  tokenLoading.value = true
  try {
    const res = await getMachineToken(props.machine.id)
    revealToken(res.token)
  } catch {
    /* toast handled by http client */
  } finally {
    tokenLoading.value = false
  }
}

async function resetToken() {
  const ok = await confirm({
    title: '确认重置 Token？',
    content: '旧 Token 将立即失效，已部署的 xboard-node 需要重新配置新 Token 后才能继续连接面板。',
    positiveText: '重置 Token',
    type: 'error',
  })
  if (!ok) return
  tokenResetting.value = true
  try {
    const res = await resetMachineToken(props.machine.id)
    revealToken(res.token)
    message.success('Token 已重置')
    void loadInstall()
  } catch {
    /* toast handled by http client */
  } finally {
    tokenResetting.value = false
  }
}

const countdown = computed(() => {
  const m = Math.floor(remain.value / 60)
  const s = remain.value % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
})

// ---- install command ----
const installCommand = ref('')
const installLoading = ref(false)
const installError = ref(false)

async function loadInstall() {
  installLoading.value = true
  try {
    const res = await getMachineInstallCommand(props.machine.id)
    installCommand.value = res.command
    installError.value = false
  } catch {
    installCommand.value = ''
    installError.value = true
  } finally {
    installLoading.value = false
  }
}

// ---- bound nodes ----
const nodes = ref<MachineNode[]>([])
const nodesLoading = ref(false)
const nodesError = ref(false)
const bindShow = ref(false)
const enabledCount = computed(() => nodes.value.filter((n) => !!n.enabled).length)

async function loadNodes() {
  nodesLoading.value = true
  try {
    nodes.value = (await fetchMachineNodes(props.machine.id)) ?? []
    nodesError.value = false
  } catch {
    // toast handled by http client; keep any previously loaded rows
    nodesError.value = true
  } finally {
    nodesLoading.value = false
  }
}

async function toggleEnabled(node: MachineNode, v: boolean) {
  await setMachineNodeEnabled(node.id, v)
  message.success(v ? `已启用「${node.name}」` : `已停用「${node.name}」`)
  void loadNodes()
}

async function unbind(node: MachineNode) {
  try {
    await unbindMachineNode(node.id)
    message.success(`已取消「${node.name}」的关联`)
    void loadNodes()
    emit('changed')
  } catch {
    /* toast handled by http client */
  }
}

function onBound() {
  void loadNodes()
  emit('changed')
}

const nodeColumns = computed<DataTableColumns<MachineNode>>(() => [
  {
    title: '名称',
    key: 'name',
    minWidth: 180,
    render: (row) =>
      h('div', { class: 'node-name' }, [
        h(
          RouterLink,
          { to: { path: '/server/manage', query: { machine_id: String(props.machine.id) } }, class: 'node-link' },
          { default: () => [h('span', { class: 'mono muted' }, `#${row.id}`), ` ${row.name}`] },
        ),
        !row.show ? h(NTag, { size: 'tiny', bordered: false }, { default: () => '隐藏' }) : null,
      ]),
  },
  {
    title: '类型',
    key: 'type',
    width: 120,
    render: (row) =>
      h(NTag, { size: 'small', round: true, color: nodeTypeTagColor(row.type, appState.isDark) }, { default: () => nodeTypeLabel(row.type) }),
  },
  {
    title: '地址',
    key: 'host',
    minWidth: 180,
    render: (row) => h('span', { class: 'mono addr' }, `${row.host}:${row.port}`),
  },
  {
    title: '已激活',
    key: 'enabled',
    width: 80,
    align: 'center',
    render: (row) => h(SwitchCell, { value: !!row.enabled, onChange: (v: boolean) => toggleEnabled(row, v) }),
  },
  {
    title: '操作',
    key: 'actions',
    width: 64,
    align: 'center',
    render: (row) =>
      h(
        NPopconfirm,
        { onPositiveClick: () => unbind(row), positiveText: '取消关联', negativeText: '取消' },
        {
          trigger: () =>
            h(
              NButton,
              { size: 'small', quaternary: true, circle: true, type: 'warning', title: '取消关联', 'aria-label': '取消关联' },
              { icon: () => h(NIcon, null, { default: () => h(UnlinkOutline) }) },
            ),
          default: () => `取消「${row.name}」与此服务器的关联？节点会被同时停用，但不会被删除。`,
        },
      ),
  },
])

onMounted(() => {
  void loadInstall()
  void loadNodes()
})
onBeforeUnmount(() => clearInterval(tokenTimer))
</script>

<template>
  <div class="detail">
    <!-- 1. info -->
    <n-card size="small" class="info-card">
      <div class="info-row">
        <div class="info-main">
          <div class="info-tags">
            <n-tag size="small" class="mono" :bordered="true">SID:{{ machine.id }}</n-tag>
            <n-tag size="small" :type="statusMeta.tagType" :bordered="false" round>
              <span class="dot" :style="{ background: statusMeta.dot }" />
              {{ statusMeta.label }}
            </n-tag>
            <span v-if="machine.load_status" class="cpu-chip">
              <span class="dot" :style="{ background: levelColor(loadLevel('cpu', cpu)) }" />
              CPU <b class="num">{{ cpu.toFixed(1) }}%</b>
            </span>
            <n-tag v-if="highLoad" size="small" type="warning" :bordered="false">高负载</n-tag>
          </div>
          <div class="info-meta">
            <n-tooltip :disabled="!machine.last_seen_at">
              <template #trigger>
                <span class="meta-item">
                  <n-icon><time-outline /></n-icon>
                  最后心跳: {{ relativeAgo(machine.last_seen_at, now) }}
                </span>
              </template>
              {{ formatTime(machine.last_seen_at) }}
            </n-tooltip>
            <span class="meta-sep">•</span>
            <span class="meta-item">
              <n-icon><server-outline /></n-icon>
              节点数: <b class="num">{{ machine.servers_count }}</b>
            </span>
            <span class="meta-sep">•</span>
            <span class="meta-item">创建于 {{ formatTime(machine.created_at, false) }}</span>
          </div>
          <div v-if="machine.notes" class="info-notes">{{ machine.notes }}</div>
        </div>
        <div class="info-actions">
          <n-button size="small" @click="emit('edit')">
            <template #icon><n-icon><create-outline /></n-icon></template>
            编辑
          </n-button>
          <n-button size="small" @click="goNodes(false)">
            前往节点管理
            <template #icon><n-icon><arrow-forward-outline /></n-icon></template>
          </n-button>
          <n-button size="small" type="primary" @click="goNodes(true)">
            <template #icon><n-icon><add-outline /></n-icon></template>
            新增节点到此服务器
          </n-button>
        </div>
      </div>
    </n-card>

    <!-- 2. trend + current load -->
    <div class="load-grid">
      <n-card size="small" title="负载趋势" class="trend-card">
        <machine-load-chart :machine-id="machine.id" />
      </n-card>
      <n-card size="small" title="负载" class="current-card">
        <template #header-extra>
          <span v-if="machine.load_status?.updated_at" class="muted small">
            上报于 {{ relativeAgo(machine.load_status.updated_at, now) }}
          </span>
        </template>
        <load-bars :load="machine.load_status" detailed />
      </n-card>
    </div>

    <!-- 3. token -->
    <n-card size="small">
      <template #header>
        <div class="card-title">
          <n-icon><key-outline /></n-icon>
          服务器 Token
        </div>
      </template>
      <template #header-extra>
        <span v-if="token" class="countdown" :class="{ urgent: remain <= 30 }">{{ countdown }} 后自动隐藏</span>
      </template>
      <p class="card-desc">此 Token 用于 xboard-node 向面板认证，请妥善保管。</p>
      <code-block v-if="token" :text="token" copied-message="Token 已复制到剪贴板" class="token-block" />
      <div class="btn-row">
        <n-button size="small" :loading="tokenLoading" @click="toggleToken">
          <template #icon>
            <n-icon><eye-off-outline v-if="token" /><eye-outline v-else /></n-icon>
          </template>
          {{ token ? '隐藏 Token' : '查看 Token' }}
        </n-button>
        <n-button size="small" type="error" secondary :loading="tokenResetting" @click="resetToken">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
          重置 Token
        </n-button>
      </div>
    </n-card>

    <!-- 4. install -->
    <n-card size="small">
      <template #header>
        <div class="card-title">
          <n-icon><terminal-outline /></n-icon>
          安装 xboard-node
        </div>
      </template>
      <p class="card-desc">在目标服务器上执行此命令，即可用 machine mode 安装 xboard-node 并接入当前服务器记录。</p>
      <div v-if="installError && !installLoading" class="load-failed">
        <span>安装命令加载失败</span>
        <n-button size="small" @click="loadInstall">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
          重试
        </n-button>
      </div>
      <code-block
        v-else
        :text="installCommand"
        :loading="installLoading"
        loading-text="正在生成命令..."
        command
        copied-message="安装命令已复制"
        copy-button="复制安装命令"
      />
      <p class="card-hint">需要 root 或 sudo 权限，且目标服务器需为支持 systemd 的 Linux。命令中包含 Token，请勿公开分享。</p>
    </n-card>

    <!-- 5. nodes -->
    <n-card size="small">
      <template #header>
        <div class="card-title">
          <n-icon><link-outline /></n-icon>
          关联节点
          <n-tag size="small" :bordered="false" round class="num">{{ nodes.length }} 个节点</n-tag>
          <n-tag size="small" type="success" :bordered="false" round class="num">{{ enabledCount }} 个已激活</n-tag>
        </div>
      </template>
      <template #header-extra>
        <div class="btn-row tight">
          <n-button size="small" quaternary circle :loading="nodesLoading" aria-label="刷新" title="刷新" @click="loadNodes">
            <template #icon><n-icon><refresh-outline /></n-icon></template>
          </n-button>
          <n-button size="small" @click="bindShow = true">
            <template #icon><n-icon><link-outline /></n-icon></template>
            关联已有节点
          </n-button>
        </div>
      </template>
      <div v-if="nodesError && !nodes.length && !nodesLoading" class="load-failed">
        <span>关联节点加载失败</span>
        <n-button size="small" @click="loadNodes">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
          重试
        </n-button>
      </div>
      <n-data-table
        v-else-if="nodes.length || nodesLoading"
        :columns="nodeColumns"
        :data="nodes"
        :loading="nodesLoading"
        :row-key="(r: MachineNode) => r.id"
        :scroll-x="620"
        :max-height="420"
        size="small"
        :bordered="false"
      />
      <n-empty v-else description="暂无绑定节点。" class="nodes-empty">
        <template #extra>
          <div class="btn-row center">
            <n-button size="small" @click="bindShow = true">关联已有节点</n-button>
            <n-button size="small" type="primary" @click="goNodes(true)">新增节点到此服务器</n-button>
          </div>
        </template>
      </n-empty>
    </n-card>

    <bind-nodes-dialog
      v-model:show="bindShow"
      :machine-id="machine.id"
      :machine-name="machine.name"
      @success="onBound"
    />
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.info-main {
  min-width: 0;
  flex: 1;
}
.info-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
}
.cpu-chip {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: var(--text-muted);
}
.cpu-chip b {
  margin-left: 4px;
  color: var(--text-strong);
}
.num {
  font-variant-numeric: tabular-nums;
}
.info-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-muted);
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.meta-item b {
  color: var(--text-strong);
}
.meta-sep {
  opacity: 0.5;
}
.info-notes {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-color);
  white-space: pre-wrap;
  word-break: break-word;
}
.info-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.load-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  gap: 16px;
}
@media (max-width: 900px) {
  .load-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.card-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 15px;
}
.card-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-muted);
}
.card-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}
.small {
  font-size: 12px;
}
.token-block {
  margin-bottom: 12px;
}
.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.btn-row.tight {
  gap: 4px;
  align-items: center;
}
.btn-row.center {
  justify-content: center;
}
.countdown {
  font-size: 12px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}
.countdown.urgent {
  color: var(--error-color);
  animation: blink 1s ease-in-out infinite;
}
@keyframes blink {
  50% {
    opacity: 0.35;
  }
}
.nodes-empty {
  padding: 20px 0;
}
.load-failed {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 72px;
  padding: 12px;
  border: 1px dashed color-mix(in srgb, var(--error-color) 45%, var(--border-color));
  border-radius: 8px;
  font-size: 13px;
  color: var(--error-color);
}
.detail :deep(.node-name) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.detail :deep(.node-link) {
  color: inherit;
  text-decoration: none;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail :deep(.node-link:hover) {
  color: var(--primary-color);
}
.detail :deep(.addr) {
  font-size: 12px;
}
</style>
