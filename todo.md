# 优化待办

> 来源：2026-08-26 三路审计（数据层 / 渲染层 / 工程质量），全部条目有 file:line 证据。
> 执行顺序：按批次；每批完成后运行 `pnpm check` 验证。
> 已决策：不迁移 better-sqlite3。

## 第一批（正确性 + 速赢）✅

- [x] 1.1 database.ts:1726 主进程误用 `window.electronAPI`（必抛 ReferenceError）：改用 `INSERT OR IGNORE` 消除异常路径，迁移+删旧标签包进事务
- [x] 1.2 统计改走 SQL 聚合：StatisticsManager 弃用 `getPrompts('') + getAllImagesForStats` 全量拉表，改用 `getStatistics(isSafeOnly)`（补 favorite/safe 维度）；删除 get-all-images-for-stats 链路
- [x] 1.3 clearAllData：`await closeDatabase()` 替换 sleep(500) 赌锁
- [x] 1.4 死代码清理（均已验证零调用）：
  - app.ts：loadPrompts()、loadData() 空转方法及调用点、searchQuery/selectedTags/imageSearchQuery/hoverTooltip 死字段
  - PanelManagerBase：loadCardBackgrounds、updateListDomIncrementally、getVisibleItemCount、renderView 前端过滤排序旧管线（含 matchesSearch/sortItems 抽象链）、updateToolbarUI 空实现
  - 两面板：renderWindow 存根、appendToContainer、appendHtmlToContainer/renderTagsHtml/getFilteredPrompts、matchesSearch/sortItems 实现
  - TrashManager：addItem/getCount/getItems
  - IPanelManager.updateToolbarUI 接口声明
- [x] 1.5 `pnpm check` 通过
  - 备注：getPrompts IPC 链路保留——e2e 测试与备份统计在用（审计误判为死代码），已在 JSDoc 标注"含已删除项"；searchPrompts 链路确认全仓零引用，已删除

## 第二批（数据库性能）

- [ ] 2.1 删除图像标签改集合级 SQL 单事务（替换 index.ts:1407/1431 全表加载+逐张 updateImage）
- [ ] 2.2 updatePrompt 图像关联差集短路（database.ts:1350 全删重插 → 增量）
- [ ] 2.3 循环单条 IPC 改批量：新增 getPromptsByIds；三处调用点改造（ImageDetailManager:261 / PromptDetailManager:941 / NewPromptManager:186 图像侧用 getImagesByIds）
- [ ] 2.4 索引调整：补 prompts(title, is_deleted)、prompt_image_relations(prompt_id, sort_order)；删 3 个主键左前缀冗余索引（database.ts:350/352/354）
- [ ] 2.5 标签序列化防逗号拆分：GROUP_CONCAT 结果解析改为安全分隔符或 JSON（database.ts:866/2019/3013 及对应写入侧）
- [ ] 2.6 事务补齐：启动迁移循环、permanentDeletePrompt/Image、emptyImageTrash 多步写；ensure-image-thumbnails 循环内 updateImagesBatch 合并为一次
- [ ] 2.7 VirtualScrollBar：mousemove/mouseup 改为 mousedown 时挂载；destroy 兜底复位 userSelect
- [ ] 2.8 `pnpm check`

## 第三批（架构去重）

- [ ] 3.1 两面板 ~15 组相同私有方法上提 PanelManagerBase 模板方法（splitSelectedTags/buildPaginatedOptions/loadMore/refreshIncremental/initScrollBar/handleScroll 等，容器 ID 与 fetch API 注入）
- [ ] 3.2 详情管理器公共化：initTagManager/syncSafetyToRelated*/updateOpen*DetailUI 抽公共基类注入 type；currentItem 用真实泛型接口替代 `as unknown as`（38 处集中地）
- [ ] 3.3 renderer 侧统一 logger 封装，替换 38 处 console 直用（preload 转发基础设施豁免）
- [ ] 3.4 依赖处置：eslint 三件套删除或接入 lint 流程；playwright/@vitest/ui/vite 用 knip 确认后清理；oxfmt 移 devDependencies
- [ ] 3.5 `pnpm check`

## 暂不执行

- better-sqlite3 迁移（用户已决策不做）
- database.ts / VirtualWindowRenderer 补单测（另行安排）
