# Admin Next（开源管理后台）

官方 Xboard 管理后台（`public/assets/admin/`）是闭源编译产物，无法修改。Admin Next 是本 fork 自己维护的开源后台：源码在 `admin-next/`，功能以官方后台为最低标准，复用同一套后端接口，与官方后台**并存**。

| 项 | 官方后台（保留，不改动） | Admin Next |
|---|---|---|
| 访问地址 | `/{secure_path}` | `/{secure_path}/next` |
| 前端资源 | `public/assets/admin/`（闭源） | `public/assets/admin-next/`（由 `admin-next/` 构建） |
| 入口视图 | `resources/views/admin.blade.php` | `resources/views/admin-next.blade.php` |
| 后端接口 | `/api/v2/{secure_path}/*` | 同左（不新增、不修改后端接口） |
| 登录态 | localStorage `XBOARD_ACCESS_TOKEN` | 同一 token（登录任一后台后可直接切换） |

两个后台互不依赖：新后台出问题时直接用旧地址即可；回滚新后台只需撤掉路由或回滚镜像，不影响数据。仓库里更早的 `/admin-v2`、`/console` 实验入口也原样保留（见 `docs/administration/remove-independent-admin-v2.md`）。

## 文档索引

- 开发约定、目录结构、新增页面步骤：[DEVELOPING.md](DEVELOPING.md)
- 官方后台功能逆向规格（逐页面、逐字段、逐接口，实现与验收的依据）：[spec/](spec/)
  - [core.md](spec/core.md) 登录、通用约定、布局、仪表盘、格式化
  - [settings.md](spec/settings.md) 系统设置、邮件模板、订阅模板
  - [nodes.md](spec/nodes.md) 节点、服务器（机器）、权限组、路由
  - [users.md](spec/users.md) 用户、流量记录、流量重置
  - [commerce.md](spec/commerce.md) 套餐、订单/佣金、支付、优惠券、礼品卡
  - [content.md](spec/content.md) 工单、公告、知识库
  - [platform.md](spec/platform.md) 主题、插件、插件页面、系统状态、审计日志

## 功能范围

菜单与官方一致：仪表盘；系统管理（系统配置、插件管理、主题配置、公告管理、支付配置、知识库管理）；节点管理（服务器管理、节点管理、权限组管理、路由管理）；订阅管理（套餐、订单、优惠券、礼品卡）；用户管理（用户、工单）；插件通过 `config.json` 声明的 `admin_menus` / `admin_crud` 动态菜单与页面。

在官方基础上补充（不改后端）：系统状态页、审计日志页、流量重置日志菜单入口、Ctrl/⌘+K 菜单搜索、深浅色/跟随系统主题，以及各规格“差异与风险”章节列出的官方前端缺陷修正。界面仅中文。

## 构建与发布

1. `cd admin-next && pnpm install && pnpm build`（类型检查 + 输出到 `public/assets/admin-next/`）。
2. 源码与 `public/assets/admin-next/` 一起提交。Docker 镜像直接打包该目录，Dockerfile 不运行 Node；`.dockerignore` 排除了 `admin-next/` 源码。
3. GitHub Actions `Admin Next`（`.github/workflows/admin-next.yml`）在相关路径变动时做类型检查、构建，并校验提交的构建产物与源码一致。
4. 推送 `master` 后，`Docker Build and Publish` 产出新镜像；生产按固定 digest 升级（见下）。

## 生产部署与回滚（三站：98k / mg / yzy）

生产 Compose 只固定 Web 镜像 digest，`public/` 不挂载，所以新后台随镜像发布。按各站 `AGENTS.md` 的既有流程：

- 备份：`backups/<日期>-admin-next/` 保存 `compose.yaml.before`、`AGENTS.md.before` 和 `README.txt`（新旧镜像、提交、回滚命令）。
- 升级：只替换 `xboard` 服务的镜像 digest，执行 `docker compose up -d --no-deps xboard`；`ai-ticket-worker` 不动。
- 验收：首页、公开配置接口、官方后台页、`/{secure_path}/next`、manifest 中全部静态资源、未登录访问管理接口返回 403，并经宿主机 Nginx 复核。
- 回滚：`cp -p backups/<日期>-admin-next/compose.yaml.before compose.yaml && docker compose up -d --no-deps xboard`。

本变更无数据库迁移、无配置变更、无新增外部服务。
