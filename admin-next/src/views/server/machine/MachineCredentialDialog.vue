<script setup lang="ts">
// Shown right after a server is created: its token and the one-line xboard-node install command.
import { NModal, NButton, NIcon, NAlert } from 'naive-ui'
import { KeyOutline, TerminalOutline } from '@vicons/ionicons5'
import CodeBlock from './CodeBlock.vue'

defineProps<{
  show: boolean
  name: string
  token: string
  command: string
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'open-detail'): void
}>()
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :style="{ width: 'min(640px, calc(100vw - 32px))' }"
    :segmented="{ content: true, footer: 'soft' }"
    :mask-closable="false"
    @update:show="emit('update:show', $event)"
  >
    <template #header>
      <div class="cred-header">
        <span class="cred-icon"><n-icon :size="18"><key-outline /></n-icon></span>
        <div>
          <div class="cred-title">服务器 Token</div>
          <div class="cred-sub">「{{ name }}」已创建</div>
        </div>
      </div>
    </template>
    <n-alert type="warning" :show-icon="true" :bordered="false" class="cred-alert">
      Token 已生成，后续可在服务器详情页中查看。请妥善保管，不要泄露给他人。
    </n-alert>

    <section class="cred-section">
      <div class="section-title">
        <n-icon><key-outline /></n-icon>
        Token
      </div>
      <code-block :text="token" copied-message="Token 已复制到剪贴板" />
    </section>

    <section class="cred-section">
      <div class="section-title">
        <n-icon><terminal-outline /></n-icon>
        安装 xboard-node
      </div>
      <code-block :text="command" command copied-message="安装命令已复制" copy-button="复制安装命令" />
      <div class="hint">需要 root 或 sudo 权限，且目标服务器需为支持 systemd 的 Linux。</div>
    </section>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="emit('open-detail')">查看服务器详情</n-button>
        <n-button type="primary" @click="emit('update:show', false)">完成</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.cred-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cred-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: var(--warning-color);
  background: color-mix(in srgb, var(--warning-color) 16%, transparent);
}
.cred-title {
  font-size: 16px;
  font-weight: 650;
}
.cred-sub {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 400;
}
.cred-alert {
  margin-bottom: 16px;
}
.cred-section + .cred-section {
  margin-top: 18px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 13px;
}
.hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
