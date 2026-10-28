<script setup lang="ts">
// Secret field read with safe=1: the stored value stays hidden (empty input keeps it)
// until the admin asks to view it, which fetches it from the server on demand.
import { NButton, NIcon, NInput, NInputGroup, NTooltip } from 'naive-ui'
import { CopyOutline, EyeOutline } from '@vicons/ionicons5'
import { copyText } from '@/utils/clipboard'

withDefaults(
  defineProps<{
    value: string
    revealed: boolean
    revealing?: boolean
    placeholder?: string
  }>(),
  { revealing: false, placeholder: '' },
)
const emit = defineEmits<{ 'update:value': [string]; reveal: [] }>()
</script>

<template>
  <n-input-group class="secret-input">
    <n-input
      :value="value"
      :type="revealed ? 'text' : 'password'"
      show-password-on="click"
      :placeholder="revealed ? placeholder : '已隐藏（留空则保持原值不变）'"
      :input-props="{ autocomplete: 'new-password', spellcheck: false }"
      class="secret-field"
      @update:value="(v: string) => emit('update:value', v)"
    />
    <n-tooltip v-if="!revealed">
      <template #trigger>
        <n-button :loading="revealing" aria-label="查看已保存的值" @click="emit('reveal')">
          <template #icon><n-icon><eye-outline /></n-icon></template>
          查看
        </n-button>
      </template>
      从服务器读取当前已保存的值
    </n-tooltip>
    <n-tooltip v-if="value">
      <template #trigger>
        <n-button aria-label="复制" @click="copyText(value)">
          <template #icon><n-icon><copy-outline /></n-icon></template>
        </n-button>
      </template>
      复制
    </n-tooltip>
    <slot name="actions" />
  </n-input-group>
</template>

<style scoped>
.secret-input {
  width: 100%;
}
.secret-field {
  flex: 1;
  min-width: 0;
}
.secret-field :deep(input:not(:placeholder-shown)) {
  font-family: var(--font-mono);
}
</style>
