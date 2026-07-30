# 移除独立后台（admin-v2）

独立后台使用单独入口 `/<secure_path>/admin-v2`，不替换原有管理员入口，也不修改主题目录。

## 已建立的安全锚点

- `local-customizations-only`：提交 `bab8864`。仅包含从本地归档迁入的公开自定义文件，以及消除 `cedar2025/Xboard` 上游构建/管理端子模块依赖的改动。
- `before-admin-v2-removal`：独立后台早期版本的额外安全锚点。
- `admin-v2-complete`：当前完整独立后台版本的锚点。

两个标签均已推送到 `laoxiechuzheng/Xboard`，不要删除。

## 从公开 master 安全移除后台

若已核对 `local-customizations-only..HEAD` 中全部都是独立后台提交，才可在干净工作树执行：

```powershell
git fetch origin --tags
git switch master
git pull --ff-only origin master
git status --short
git revert --no-edit local-customizations-only..HEAD
git push origin master
```

这会新增一组可审计的回退提交，不会重写已公开的 Git 历史，也不会使用强推。回退后仍保留：

- 你的本地自定义文件迁入；
- 自有仓库构建对 Xboard 上游仓库的脱离；
- 原始官方后台和原始主题。

不会保留：

- `/admin-v2` 独立后台及其路由、资源文件和为其补充的最小后端关联加载；
- 旧的 `/console` 预览原型。

## 回退前检查

不要在存在未提交修改时回退。先查看范围：

```powershell
git diff --name-status local-customizations-only..HEAD
git log --oneline local-customizations-only..HEAD
```

若 Git 报告冲突，停止并逐个解决；不要用 `reset --hard` 或强推来跳过冲突。

如果未来在独立后台提交之后又合入了其他功能，不要对整个范围执行回退。先使用上述 `git log` 核对，并只针对明确属于独立后台的提交逐个逆序 `git revert`。
