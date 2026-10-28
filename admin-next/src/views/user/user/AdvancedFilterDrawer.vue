<script setup lang="ts">
// Advanced filter drawer (spec §2.6). Edits a draft copy; "应用筛选" emits complete conditions.
import { computed, ref, watch } from 'vue'
import {
  NDrawer,
  NDrawerContent,
  NButton,
  NIcon,
  NSelect,
  NInput,
  NInputNumber,
  NDatePicker,
  NSwitch,
  NEmpty,
} from 'naive-ui'
import { AddOutline, CloseOutline } from '@vicons/ionicons5'
import { appState } from '@/stores/app'
import {
  OPERATOR_LABELS,
  emptyValueFor,
  isConditionComplete,
  type FilterCondition,
  type FilterFieldDef,
  type FilterOperator,
} from './helpers'

const props = defineProps<{ show: boolean; conditions: FilterCondition[]; fields: FilterFieldDef[] }>()
const emit = defineEmits<{ 'update:show': [boolean]; apply: [FilterCondition[]] }>()

const draft = ref<FilterCondition[]>([])

watch(
  () => props.show,
  (v) => {
    if (v) draft.value = props.conditions.map((c) => ({ ...c }))
  },
)

const fieldOptions = computed(() => props.fields.map((f) => ({ label: f.label, value: f.key })))
const fieldOf = (key: string) => props.fields.find((f) => f.key === key)

function operatorOptions(key: string) {
  return (fieldOf(key)?.operators ?? []).map((op) => ({ label: OPERATOR_LABELS[op], value: op }))
}

function onFieldChange(c: FilterCondition, key: string) {
  const def = fieldOf(key)
  c.field = key
  c.operator = (def?.operators[0] ?? '') as FilterOperator | ''
  c.value = emptyValueFor(def?.type)
}

function add() {
  draft.value.push({ field: '', operator: '', value: null })
}

function remove(i: number) {
  draft.value.splice(i, 1)
}

function clearAll() {
  draft.value = []
}

const completeCount = computed(() => draft.value.filter(isConditionComplete).length)

function apply() {
  emit(
    'apply',
    draft.value.filter(isConditionComplete).map((c) => ({ ...c })),
  )
  emit('update:show', false)
}

const width = computed(() => (appState.isMobile ? '100%' : 540))
</script>

<template>
  <n-drawer :show="show" :width="width" placement="right" @update:show="(v: boolean) => emit('update:show', v)">
    <n-drawer-content closable :native-scrollbar="false">
      <template #header>
        <div>
          <div>高级筛选</div>
          <div class="head-desc">添加一个或多个筛选条件来精确查找用户（条件之间为“且”关系）</div>
        </div>
      </template>

      <div class="section-head">
        <span class="section-title">筛选条件</span>
        <n-button size="small" secondary @click="add">
          <template #icon><n-icon><add-outline /></n-icon></template>
          添加条件
        </n-button>
      </div>

      <n-empty v-if="!draft.length" description="暂无条件，点击“添加条件”开始筛选" class="empty" />

      <div v-for="(c, i) in draft" :key="i" class="cond">
        <div class="cond-head">
          <span class="cond-title">条件 {{ i + 1 }}</span>
          <n-button quaternary circle size="tiny" aria-label="删除条件" @click="remove(i)">
            <template #icon><n-icon><close-outline /></n-icon></template>
          </n-button>
        </div>
        <div class="cond-body">
          <n-select
            :value="c.field || null"
            :options="fieldOptions"
            placeholder="选择字段"
            filterable
            @update:value="(v: string) => onFieldChange(c, v)"
          />
          <n-select
            v-if="c.field"
            v-model:value="c.operator"
            :options="operatorOptions(c.field)"
            placeholder="选择操作符"
          />
          <template v-if="c.field && c.operator">
            <template v-for="def in [fieldOf(c.field)]" :key="c.field">
              <n-input
                v-if="def?.type === 'text'"
                :value="(c.value as string) ?? ''"
                placeholder="输入值"
                clearable
                @update:value="(v: string) => (c.value = v)"
              />
              <n-input-number
                v-else-if="def?.type === 'number'"
                :value="(c.value as number | null)"
                placeholder="输入数值"
                :precision="0"
                clearable
                class="full"
                @update:value="(v: number | null) => (c.value = v)"
              />
              <n-input-number
                v-else-if="def?.type === 'gb'"
                :value="(c.value as number | null)"
                placeholder="输入数值(GB)"
                :min="0"
                clearable
                class="full"
                @update:value="(v: number | null) => (c.value = v)"
              >
                <template #suffix>GB</template>
              </n-input-number>
              <n-select
                v-else-if="def?.type === 'select'"
                :value="(c.value as string | number | null)"
                :options="def.options ?? []"
                placeholder="请选择"
                filterable
                @update:value="(v: string | number) => (c.value = v)"
              />
              <n-date-picker
                v-else-if="def?.type === 'date'"
                :value="(c.value as number | null)"
                type="date"
                clearable
                class="full"
                placeholder="选择日期"
                @update:value="(v: number | null) => (c.value = v)"
              />
              <div v-else-if="def?.type === 'boolean'" class="bool">
                <n-switch :value="!!c.value" @update:value="(v: boolean) => (c.value = v)" />
                <span>{{ c.value ? '是' : '否' }}</span>
              </div>
            </template>
          </template>
          <div v-if="c.field === 'expired_at'" class="hint">按所选日期 00:00 比较；“长期有效”的用户不会被大于/小于条件匹配。</div>
        </div>
      </div>

      <template #footer>
        <div class="footer">
          <n-button quaternary :disabled="!draft.length" @click="clearAll">清空条件</n-button>
          <div class="grow" />
          <n-button @click="emit('update:show', false)">取消</n-button>
          <n-button type="primary" @click="apply">应用筛选{{ completeCount ? `（${completeCount}）` : '' }}</n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
.head-desc {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
}
.empty {
  padding: 32px 0;
}
.cond {
  margin-bottom: 12px;
  padding: 10px 12px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}
.cond-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.cond-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
.cond-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.full {
  width: 100%;
}
.bool {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.hint {
  font-size: 12px;
  color: var(--text-muted);
}
.footer {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.grow {
  flex: 1;
}
</style>
