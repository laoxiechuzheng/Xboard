# Admin Next 开发约定

新版后台源码位于仓库根 `admin-next/`，构建产物提交在 `public/assets/admin-next/`，由 `resources/views/admin-next.blade.php` 通过 Vite manifest 加载，访问路径 `/{secure_path}/next`。官方后台 `/{secure_path}`（`public/assets/admin/`）保持不变，两者共用同一套后端接口 `/api/v2/{secure_path}/*`。

## 技术栈

- Vue 3（`<script setup lang="ts">`）+ TypeScript + Vite
- Naive UI 组件库（中文 locale），图标 `@vicons/ionicons5`
- vue-router（hash 模式，路由形如 `/{secure_path}/next#/server/manage`）
- ECharts（`src/components/EChart.vue` 已按需引入 line/bar/pie）
- marked（Markdown 预览）
- 不引入其它状态库：全局状态用 `src/stores/*.ts` 里的 `reactive` 单例

## 目录

```
admin-next/src/
  api/http.ts            HTTP 客户端（鉴权头、错误提示、401/403 跳登录、PHP 风格 query 序列化）
  api/<module>.ts        各模块接口函数与类型（每个模块一个文件）
  components/            通用组件：PageContainer、CodeEditor、MarkdownEditor、EChart、DynamicForm、CopyText
  composables/           usePagedTable（服务端分页表格）
  layouts/AdminLayout.vue 侧边栏 + 顶栏布局
  router/index.ts        路由表；router/menu.ts 侧边栏菜单（与官方 nav 结构一致）
  stores/                app（主题/侧栏）、auth（token）
  utils/                 format（流量/金额/时间）、clipboard（复制/保存文件）、discrete（全局 message/dialog/confirm）
  views/<group>/         页面；页面私有子组件放 views/<group>/components/
```

## 后端约定（以代码为准）

- 管理接口前缀 `/api/v2/{secure_path}`，用 `http.get/post`（`src/api/http.ts`）调用，路径写相对路径如 `http.get('/plan/fetch')`。
- 鉴权：登录 `POST /api/v2/passport/auth/login` 返回 `auth_data`（已含 `Bearer ` 前缀），原样放进 `Authorization` 头。非管理员或 token 失效时 admin 中间件返回 403 `{"message":"Unauthorized"}`，客户端会自动清 token 跳登录。
- 响应：`$this->success($data)` → `{status:'success', data}`，客户端自动解包返回 `data`；`$this->fail()` → 非 2xx 或 `status:'fail'`，客户端抛 `ApiError` 并自动 toast（传 `{ silent: true }` 可关闭）；分页或直接 `response()->json([...])` 的接口没有 `status` 字段，客户端返回整个 body（例如 `{ data, total }`），调用方自己取 `.data`。
- 单位：流量字节（显示用 `formatBytes`，表单里一般按 GB 输入）、金额分（`formatMoney`/`yuanToCents`/`centsToYuan`）、时间 Unix 秒（`formatTime`；Naive 日期选择器用毫秒，`secondsToMs`/`msToSeconds` 转换）。
- 复杂 query（如 `filter[0][id]=email&filter[0][value]=x`）直接把对象/数组传给 `http.get` 的 params，客户端按 PHP 方括号格式序列化。

## 页面约定

- 页面根组件用 `<page-container title description>`，操作按钮放 `#extra` 插槽。
- 列表用 `<n-data-table>`：服务端分页用 `usePagedTable`；前端分页的小列表直接 `:pagination="{ pageSize: 20 }"`。
- 表单用 `<n-modal preset="card">` 或 `<n-drawer>`（字段多时用抽屉），保存成功后 `message.success` 并刷新列表。
- 危险操作（删除、批量、重置）用 `confirm()`（`utils/discrete`）或 `<n-popconfirm>`，文案写清后果。
- 所有可见文案用中文；标识符英文。
- 颜色只用 Naive 主题色和 `global.css` 里的 CSS 变量（`--text-muted` 等），保证深色模式可用；不要硬编码浅色背景。
- 移动端：表格设置 `:scroll-x`，工具栏用 `.toolbar`（自动换行）。

## 本地开发

```bash
cd admin-next
pnpm install
pnpm dev        # http://localhost:5180，/api 代理到 XBOARD_DEV_BACKEND（admin-next/.env.development.local）
pnpm typecheck
pnpm build      # 类型检查 + 输出到 public/assets/admin-next/
```

`admin-next/.env.development.local`（已 gitignore，只在 `pnpm dev` 时加载；不要用 `.env.local`，它在 build 时也会加载，会把测试值打进提交的产物）示例：

```
VITE_SECURE_PATH=<测试实例的 secure_path>
XBOARD_DEV_BACKEND=http://127.0.0.1:17999
```

改完源码后必须 `pnpm build` 并把 `public/assets/admin-next/` 的变化一起提交——生产镜像直接打包该目录，不在 Docker 构建中跑 Node。

## 新增一个页面

1. `src/api/<module>.ts` 写接口函数和类型。
2. `src/views/<group>/<Name>View.vue` 写页面。
3. `src/router/index.ts` 加路由，`src/router/menu.ts` 加菜单项。
4. `pnpm build`，提交源码和构建产物。
