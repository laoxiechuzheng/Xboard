<script setup lang="ts">
// IP + copy button (CopyText) + ip.sb lookup link (validated IPs only, not for private/reserved ones).
// When `filterable`, clicking the IP itself filters the list by that IP.
import { computed } from 'vue'
import { NIcon, NTooltip } from 'naive-ui'
import { OpenOutline } from '@vicons/ionicons5'
import CopyText from '@/components/CopyText.vue'
import { ipLookupUrl } from './meta'

const props = withDefaults(defineProps<{ ip: string; filterable?: boolean; lookup?: boolean }>(), {
  filterable: false,
  lookup: true,
})
const emit = defineEmits<{ filter: [string] }>()

const link = computed(() => (props.lookup ? ipLookupUrl(props.ip) : null))
</script>

<template>
  <span v-if="ip" class="ip-cell">
    <button v-if="filterable" type="button" class="ip-text clickable" :title="`只看 ${ip} 的记录`" @click.stop="emit('filter', ip)">
      {{ ip }}
    </button>
    <span v-else class="ip-text" :title="ip">{{ ip }}</span>
    <copy-text :text="ip" display="" class="ip-copy" />
    <n-tooltip v-if="link" :delay="300">
      <template #trigger>
        <a :href="link" target="_blank" rel="noopener noreferrer" class="ip-link" aria-label="在 ip.sb 查看 IP 信息" @click.stop>
          <n-icon :size="13"><open-outline /></n-icon>
        </a>
      </template>
      在 ip.sb 查看归属地
    </n-tooltip>
  </span>
  <span v-else class="muted">—</span>
</template>

<style scoped>
.ip-cell {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  max-width: 100%;
}
.ip-text {
  min-width: 0;
  margin-right: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-strong);
}
.clickable {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  text-align: left;
}
.clickable:hover {
  color: var(--primary-color);
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}
.ip-copy {
  flex: none;
}
.ip-link {
  display: inline-flex;
  align-items: center;
  flex: none;
  padding: 2px;
  color: var(--text-muted);
  opacity: 0.75;
  transition:
    color 0.15s,
    opacity 0.15s;
}
.ip-link:hover {
  color: var(--primary-color);
  opacity: 1;
}
</style>
