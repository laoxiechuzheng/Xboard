<script setup lang="ts">
// Attach existing unbound nodes to a machine: batchUpdate {ids, machine_id, enabled: true} (spec nodes §5.7.6).
import { computed, ref, watch } from 'vue'
import { NModal, NButton, NCheckbox, NEmpty, NIcon, NInput, NSpin, NTag } from 'naive-ui'
import { SearchOutline } from '@vicons/ionicons5'
import type { NodeBrief } from '@/api/common'
import { bindNodesToMachine, fetchUnboundNodes } from '@/api/machine'
import { appState } from '@/stores/app'
import { message } from '@/utils/discrete'
import { nodeTypeLabel, nodeTypeTagColor } from './machine-utils'

const props = defineProps<{
  show: boolean
  machineId: number
  machineName: string
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'success', count: number): void
}>()

const nodes = ref<NodeBrief[]>([])
const loading = ref(false)
const submitting = ref(false)
const keyword = ref('')
const selected = ref<Set<number>>(new Set())

async function load() {
  loading.value = true
  try {
    nodes.value = await fetchUnboundNodes()
  } catch {
    nodes.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  (open) => {
    if (!open) return
    keyword.value = ''
    selected.value = new Set()
    void load()
  },
  { immediate: true },
)

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return nodes.value
  return nodes.value.filter(
    (n) =>
      n.name.toLowerCase().includes(k) ||
      String(n.host ?? '').toLowerCase().includes(k) ||
      n.type.toLowerCase().includes(k) ||
      nodeTypeLabel(n.type).toLowerCase().includes(k) ||
      String(n.id).includes(k),
  )
})

const allChecked = computed(() => filtered.value.length > 0 && filtered.value.every((n) => selected.value.has(n.id)))
const someChecked = computed(() => !allChecked.value && filtered.value.some((n) => selected.value.has(n.id)))

function toggleAll(v: boolean) {
  const next = new Set(selected.value)
  for (const n of filtered.value) {
    if (v) next.add(n.id)
    else next.delete(n.id)
  }
  selected.value = next
}

function toggle(id: number) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

async function submit() {
  const ids = [...selected.value]
  if (!ids.length) return
  submitting.value = true
  try {
    await bindNodesToMachine(ids, props.machineId)
    message.success(`成功将 ${ids.length} 个节点关联到「${props.machineName}」`)
    emit('success', ids.length)
    emit('update:show', false)
  } catch {
    /* toast handled by http client */
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="关联已有节点"
    :style="{ width: 'min(640px, calc(100vw - 32px))' }"
    :mask-closable="!submitting"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="emit('update:show', $event)"
  >
    <p class="dialog-desc">选择要关联到「{{ machineName }}」的节点。关联后节点会被设为启用，由该服务器上的 xboard-node 托管。</p>
    <div class="bind-toolbar">
      <n-input v-model:value="keyword" placeholder="搜索节点名称、地址、类型..." clearable size="small">
        <template #prefix><n-icon><search-outline /></n-icon></template>
      </n-input>
      <n-checkbox
        :checked="allChecked"
        :indeterminate="someChecked"
        :disabled="!filtered.length"
        class="nowrap"
        @update:checked="toggleAll"
      >
        全选（共 {{ filtered.length }} 个）
      </n-checkbox>
    </div>
    <n-spin :show="loading">
      <div class="bind-list">
        <n-empty
          v-if="!loading && !filtered.length"
          :description="nodes.length ? '没有匹配的节点' : '没有未绑定的节点'"
          class="bind-empty"
        />
        <div
          v-for="n in filtered"
          :key="n.id"
          class="bind-item"
          :class="{ active: selected.has(n.id) }"
          role="checkbox"
          :aria-checked="selected.has(n.id)"
          tabindex="0"
          @click="toggle(n.id)"
          @keydown.space.prevent="toggle(n.id)"
        >
          <n-checkbox :checked="selected.has(n.id)" @click.stop @update:checked="toggle(n.id)" />
          <div class="bind-main">
            <div class="bind-name"><span class="mono muted">#{{ n.id }}</span> {{ n.name }}</div>
            <div class="bind-addr mono muted">{{ n.host }}:{{ n.port }}</div>
          </div>
          <n-tag size="small" :color="nodeTypeTagColor(n.type, appState.isDark)" round>{{ nodeTypeLabel(n.type) }}</n-tag>
        </div>
      </div>
    </n-spin>
    <template #footer>
      <div class="dialog-footer">
        <span class="muted selected-hint">已选 {{ selected.size }} 个</span>
        <span class="grow" />
        <n-button :disabled="submitting" @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :disabled="!selected.size" :loading="submitting" @click="submit">
          {{ submitting ? '关联中...' : `关联 ${selected.size} 个节点` }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.dialog-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-muted);
}
.bind-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.bind-list {
  max-height: min(420px, 50vh);
  min-height: 120px;
  overflow: auto;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}
.bind-empty {
  padding: 32px 0;
}
.bind-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--divider-color);
  outline: none;
}
.bind-item:last-child {
  border-bottom: 0;
}
.bind-item:hover,
.bind-item:focus-visible {
  background: var(--hover-color);
}
.bind-item.active {
  background: color-mix(in srgb, var(--primary-color) 8%, transparent);
}
.bind-main {
  flex: 1;
  min-width: 0;
}
.bind-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bind-addr {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dialog-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dialog-footer .grow {
  flex: 1;
}
.selected-hint {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 520px) {
  .bind-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
