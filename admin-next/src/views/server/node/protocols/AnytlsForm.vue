<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NFormItem, NInput } from 'naive-ui'
import TlsFields from '../blocks/TlsFields.vue'
import EchBlock from '../blocks/EchBlock.vue'
import { ANYTLS_DEFAULT_PADDING, type AnytlsState } from '../protocol'

const props = defineProps<{ settings: AnytlsState }>()

// Blank lines are kept while typing and dropped when the request is built.
const paddingText = computed({
  get: () => props.settings.padding_scheme.join('\n'),
  set: (v: string) => {
    props.settings.padding_scheme = v.split('\n')
  },
})
const ruleCount = computed(() => props.settings.padding_scheme.filter((l) => l.trim()).length)

function useDefault() {
  props.settings.padding_scheme = [...ANYTLS_DEFAULT_PADDING]
}
</script>

<template>
  <tls-fields :tls="settings.tls" placeholder="当节点地址与证书不一致时用于证书验证" insecure-label="允许不安全连接" />
  <ech-block :ech="settings.tls.ech" />
  <n-form-item>
    <template #label>
      <span class="label-row">
        <span>填充方案</span>
        <span class="muted count">{{ ruleCount ? `已配置 ${ruleCount} 条规则` : '未配置' }}</span>
        <n-button text type="primary" size="tiny" @click="useDefault">使用默认方案</n-button>
      </span>
    </template>
    <n-input
      v-model:value="paddingText"
      type="textarea"
      class="mono-area"
      :autosize="{ minRows: 5, maxRows: 14 }"
      placeholder="每行一条规则，例如 stop=8"
    />
    <template #feedback>
      <span class="muted">用于混淆流量特征的填充方案，每行一条规则，支持通配符 *</span>
    </template>
  </n-form-item>
</template>

<style scoped>
.label-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.count {
  font-size: 12px;
  font-weight: normal;
}
.mono-area :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 12.5px;
}
</style>
