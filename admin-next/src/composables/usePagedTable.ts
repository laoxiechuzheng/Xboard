import { reactive, ref, shallowRef } from 'vue'
import type { PaginationProps } from 'naive-ui'

export interface PageQuery {
  current: number
  pageSize: number
}

export interface PageResult<T> {
  data: T[]
  total: number
}

/**
 * Server-side paginated table state for <n-data-table remote>.
 *
 *   const table = usePagedTable((q) => api.fetchUsers({ ...q, filter }))
 *   <n-data-table remote :data="table.data.value" :loading="table.loading.value"
 *     :pagination="table.pagination" :row-key="(r) => r.id" />
 */
export function usePagedTable<T>(
  fetcher: (q: PageQuery) => Promise<PageResult<T>>,
  options: { pageSize?: number; pageSizes?: number[]; immediate?: boolean } = {},
) {
  const data = shallowRef<T[]>([])
  const loading = ref(false)
  /** Last load error (null after a successful load). */
  const error = shallowRef<unknown>(null)
  let seq = 0

  const pagination = reactive<PaginationProps>({
    page: 1,
    pageSize: options.pageSize ?? 20,
    itemCount: 0,
    showSizePicker: true,
    pageSizes: options.pageSizes ?? [10, 20, 50, 100, 200],
    prefix: ({ itemCount }) => `共 ${itemCount ?? 0} 条`,
    onUpdatePage: (page: number) => {
      pagination.page = page
      void load()
    },
    onUpdatePageSize: (size: number) => {
      pagination.pageSize = size
      pagination.page = 1
      void load()
    },
  })

  async function load() {
    const mySeq = ++seq
    loading.value = true
    try {
      const res = await fetcher({ current: pagination.page ?? 1, pageSize: pagination.pageSize ?? 20 })
      if (mySeq !== seq) return
      data.value = res.data ?? []
      pagination.itemCount = Number(res.total ?? 0)
      error.value = null
    } catch (e) {
      if (mySeq !== seq) return
      // Keep "empty table" and the "共 N 条" prefix consistent.
      data.value = []
      pagination.itemCount = 0
      error.value = e
    } finally {
      if (mySeq === seq) loading.value = false
    }
  }

  /** Reload keeping the current page. */
  const reload = () => load()
  /** Reset to page 1 and load (use after filter changes). */
  const search = () => {
    pagination.page = 1
    return load()
  }

  if (options.immediate !== false) void load()

  return { data, loading, error, pagination, reload, search }
}
