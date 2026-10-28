<script setup lang="ts">
// "部署方式" cell: standalone, or bound machine with its status (and whether the machine runs this node).
import { computed } from 'vue'
import { NIcon, NTag } from 'naive-ui'
import { CubeOutline } from '@vicons/ionicons5'
import type { MachineBrief, ServerNode } from '@/api/node'
import { MACHINE_STATUS_META, machineStatus } from '../meta'

const props = defineProps<{ node: ServerNode; machine: MachineBrief | null }>()

const meta = computed(() => (props.machine ? MACHINE_STATUS_META[machineStatus(props.machine)] : null))
</script>

<template>
  <span v-if="!node.machine_id" class="deploy muted">
    <n-icon :size="15"><cube-outline /></n-icon>
    独立部署
  </span>
  <span v-else class="deploy">
    <i class="dot" :style="{ background: meta?.color ?? 'var(--text-muted)' }" />
    <span class="name" :title="machine?.name">{{ machine?.name ?? `服务器 #${node.machine_id}` }}</span>
    <n-tag v-if="meta" size="tiny" :type="meta.tag" :bordered="false">{{ meta.label }}</n-tag>
    <n-tag v-if="node.enabled === false" size="tiny" :bordered="false">节点停用</n-tag>
  </span>
</template>

<style scoped>
.deploy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  flex-wrap: wrap;
  font-size: 13px;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}
.name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
