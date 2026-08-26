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

## 第二批（数据库性能）✅

- [x] 2.1 删除图像标签改集合级 SQL 单事务（deleteImageTag/deleteImageTags 级联删除关联+标签；handler 内 N+1 循环移除）
- [x] 2.2 updatePrompt 图像关联差集短路（集合与顺序均一致时跳过重写；顺序变化仍重建以支持"设为首张"）
- [x] 2.3 新增 getPromptsByIds 批量 IPC（保持传入顺序）；ImageDetailManager/PromptDetailManager replaceImage 缓存刷新改批量；NewPromptManager 改用 getImagesByIds
- [x] 2.4 索引调整：新增 idx_prompts_title_deleted、idx_prompt_image_relations_prompt_sort(prompt_id, sort_order)；DROP 3 个主键左前缀冗余索引
- [x] 2.5 标签序列化改用 U+001F 分隔符：9 处 GROUP_CONCAT(..., char(31)) + 4 处 split(TAG_SEPARATOR)（一次性脚本见 bak/tmp-tag-separator.mjs）
  - ⚠️ 热修：初版误写 `GROUP_CONCAT(DISTINCT x, char(31))`——SQLite 禁止 DISTINCT 聚合带第二参数，导致启动失败；已去除 DISTINCT（关系表复合主键保证无重名，DISTINCT 本就冗余）。详见 docs/易错点.md「SQLite」节
- [x] 2.6 事务补齐：日期迁移逐行 UPDATE 批内事务化；permanentDeletePrompt/emptyPromptTrash/permanentDeleteImage/emptyImageTrash 多步写事务化（物理文件删除移到事务提交后）；ensure-image-thumbnails 循环合并为单次 updateImagesBatch
- [x] 2.7 VirtualScrollBar：mousemove/mouseup 仅拖拽期间挂载；destroy 兜底复位 userSelect
- [x] 2.8 `pnpm check` 通过

## 第三批（架构去重）✅（3.2 类型化为部分完成）

- [x] 3.1 两面板滚动条/滚动事件/分页追赶机制上提 PanelManagerBase：
  initScrollBar/syncScrollBarLayout/getViewportRows/getPageSizeItems/handleScroll/
  bindScrollEvents/unbindScrollEvents/ensureWindowData + GRID_GAP/PAGE_SIZE 常量统一；
  差异经抽象钩子注入（容器 ID、数据量、加载能力、窗口刷新入口）
- [x] 3.2 详情管理器：新增 DetailTagController 工厂，initTagManager 的 ~120 行×2 同构标签增删逻辑收敛为一处；
  ⚠️ 部分完成：syncSafetyToRelated*/updateOpen*DetailUI 合并与 38 处 as unknown as 全面类型化未做，留待后续
- [x] 3.3 renderer 统一 logger：src/utils/Logger.ts（签名遵循 py-pm-log 规范 (component, message, data?)，
  转发主进程 electron-log 写 pm.log，无 electronAPI 环境回退 console）；替换 utils+renderer 共 21 处 console 直用；
  database.ts 12 处改用本文件已有的结构化 logger；豁免：preload 转发基础设施、MockDataClearApi（knip 判定未使用）、debounce JSDoc 示例
- [x] 3.4 依赖处置：删除 eslint/@typescript-eslint/*×2/vite(裸)/playwright(裸)；
  保留 eslint-plugin-no-unsanitized（oxlint jsPlugins 引用，提供 no-unsanitized/method XSS 防护规则）；
  oxfmt 移入 devDependencies；@img/sharp-win32-x64 为打包锁定用途保留
- [x] 3.5 `pnpm check` 通过；e2e 冒烟：13-tag-input-methods 10/10、5-main-panel-refactor 6/6

## 暂不执行

- better-sqlite3 迁移（用户已决策不做）
- database.ts / VirtualWindowRenderer 补单测（另行安排）
