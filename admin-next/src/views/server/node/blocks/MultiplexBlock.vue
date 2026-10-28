<script setup lang="ts">
// sing-box multiplex (vmess / vless / trojan).
import { NFormItemGi, NGrid, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import OptionCard from '../OptionCard.vue'
import type { MultiplexState } from '../protocol'

defineProps<{ mux: MultiplexState }>()

const protocolOptions = [
  { label: 'smux', value: 'smux' },
  { label: 'yamux', value: 'yamux' },
  { label: 'h2mux', value: 'h2mux' },
]
</script>

<template>
  <option-card title="多路复用 (Multiplex)" description="通过单条 TCP 连接传输多个流，降低握手延迟" :open="mux.enabled">
    <template #action>
      <n-switch v-model:value="mux.enabled" />
    </template>
    <n-grid cols="1 s:2" responsive="self" :x-gap="12">
      <n-form-item-gi label="复用协议">
        <n-select v-model:value="mux.protocol" :options="protocolOptions" />
        <template #feedback>
          <span class="muted">
            {{ mux.protocol === 'h2mux' ? '适合高延迟、大带宽且不需要 Brutal 的环境' : '通用模式，兼容性最好' }}
          </span>
        </template>
      </n-form-item-gi>
      <n-form-item-gi label="最大连接数">
        <n-input-number v-model:value="mux.max_connections" :min="0" :precision="0" clearable placeholder="4" style="width: 100%" />
        <template #feedback><span class="muted">最大建立的物理 TCP 数量</span></template>
      </n-form-item-gi>
      <n-form-item-gi :span="2" label="启用填充">
        <div class="inline-switch">
          <n-switch v-model:value="mux.padding" />
          <span class="muted">填充数据包以对抗流量特征分析</span>
        </div>
      </n-form-item-gi>
      <n-form-item-gi :span="2" label="TCP Brutal (激进拥塞控制)">
        <n-switch v-model:value="mux.brutal.enabled" />
      </n-form-item-gi>
      <template v-if="mux.brutal.enabled">
        <n-form-item-gi label="上行带宽">
          <n-input-number v-model:value="mux.brutal.up_mbps" :min="0" :precision="0" clearable style="width: 100%">
            <template #suffix>Mbps</template>
          </n-input-number>
        </n-form-item-gi>
        <n-form-item-gi label="下行带宽">
          <n-input-number v-model:value="mux.brutal.down_mbps" :min="0" :precision="0" clearable style="width: 100%">
            <template #suffix>Mbps</template>
          </n-input-number>
        </n-form-item-gi>
        <n-form-item-gi :span="2" :show-label="false" :show-feedback="false">
          <em class="muted brutal-tip">* TCP Brutal 是双边加速算法，建议带宽设为机器实际带宽的 80%-90%，开启后 BBR 将失效。</em>
        </n-form-item-gi>
      </template>
    </n-grid>
  </option-card>
</template>

<style scoped>
.inline-switch {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
}
.brutal-tip {
  font-size: 12px;
}
</style>
