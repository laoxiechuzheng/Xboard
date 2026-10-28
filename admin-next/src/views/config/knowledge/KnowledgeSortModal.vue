<script setup lang="ts">
// Reorder the knowledge base and persist with POST /knowledge/sort { ids }.
// The user frontend filters by language, sorts by `sort` and groups by category (groups in order of
// first appearance), so ordering categories + articles within each category is exactly what users
// see. Saving flattens that into one global order. A failed save keeps the dialog open (spec R-S3).
import { computed, reactive, ref, watch } from 'vue'
import { NButton, NModal, NSelect } from 'naive-ui'
import SortableList from '@/components/SortableList.vue'
import { sortKnowledge, type KnowledgeListItem } from '@/api/knowledge'
import { message } from '@/utils/discrete'

const props = defineProps<{ show: boolean; items: KnowledgeListItem[] }>()
const emit = defineEmits<{ 'update:show': [boolean]; saved: [] }>()

interface CategoryEntry {
  id: string
  count: number
}

const categories = ref<CategoryEntry[]>([])
const byCategory = reactive<Record<string, KnowledgeListItem[]>>({})
const active = ref<string | null>(null)
const saving = ref(false)

watch(
  () => props.show,
  (open) => {
    if (!open) return
    Object.keys(byCategory).forEach((k) => delete byCategory[k])
    const cats: CategoryEntry[] = []
    for (const it of props.items) {
      const c = it.category ?? ''
      if (!byCategory[c]) {
        byCategory[c] = []
        cats.push({ id: c, count: 0 })
      }
      byCategory[c].push(it)
    }
    cats.forEach((c) => (c.count = byCategory[c.id].length))
    categories.value = cats
    active.value = cats[0]?.id ?? null
  },
)

const categoryOptions = computed(() =>
  categories.value.map((c, i) => ({ label: `${i + 1}. ${c.id || '（未分类）'}（${c.count} 篇）`, value: c.id })),
)

const activeItems = computed({
  get: () => (active.value !== null ? (byCategory[active.value] ?? []) : []),
  set: (v: KnowledgeListItem[]) => {
    if (active.value !== null) byCategory[active.value] = v
  },
})

async function save() {
  const ids = categories.value.flatMap((c) => (byCategory[c.id] ?? []).map((it) => it.id))
  saving.value = true
  try {
    await sortKnowledge(ids)
    message.success('排序保存成功')
    emit('saved')
    emit('update:show', false)
  } catch {
    /* toasted; keep the dialog so the order is not lost */
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="编辑排序"
    :bordered="false"
    :mask-closable="!saving"
    :closable="!saving"
    :style="{ width: 'min(860px, calc(100vw - 24px))' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <p class="muted tip">
      用户端按界面语言筛选文章后，按下方分类顺序分组展示，组内按文章顺序排列（所有语言共用同一顺序）。新建文章在保存一次排序前会排在最前。
    </p>
    <div class="sort-grid">
      <section class="pane">
        <div class="pane-title">分类顺序</div>
        <sortable-list
          v-model:items="categories"
          :label="(c: CategoryEntry) => c.id || '（未分类）'"
          :sublabel="(c: CategoryEntry) => `${c.count} 篇文章`"
        />
      </section>
      <section class="pane">
        <div class="pane-title">分类内文章顺序</div>
        <n-select v-model:value="active" :options="categoryOptions" size="small" class="cat-select" placeholder="选择分类" />
        <sortable-list
          v-model:items="activeItems"
          :label="(k: KnowledgeListItem) => k.title"
          :sublabel="(k: KnowledgeListItem) => `ID ${k.id} · ${k.show ? '显示中' : '已隐藏'}`"
        />
      </section>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <n-button :disabled="saving" @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="saving" :disabled="!categories.length" @click="save">保存排序</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.tip {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.6;
}
.sort-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: 16px;
}
@media (max-width: 767px) {
  .sort-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.pane {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pane-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
