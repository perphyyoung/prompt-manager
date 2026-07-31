# 图像主目录分页改造计划

## 上下文

当前图像主目录最多显示 500 张图像。限制来自 `src/utils/CacheManager.ts:134` 中 `getImageCache()` 的 LRU 容量 500。

`ImagePanelManager.loadData()` 调用 `window.electronAPI.getImages('updatedAt', 'desc')` 获取全部图像，然后通过 `cacheManager.cacheImages(images)` 写入缓存。当图像超过 500 张时，LRU 淘汰旧项，导致超出部分不显示在主目录。

数据库层 `src/main/database.ts:1775` 的 `getImages()` 本身没有 `LIMIT`，限制 purely 在前端缓存/展示层。

## 目标

1. 图像主目录支持超过 500 张图像，通过数据库分页 + 滚动加载实现。
2. 搜索、标签筛选、排序全部下沉到数据库层，保证筛选结果全量准确。
3. 每页 100 条。
4. 标签计数精确显示（基于数据库统计）。
5. 全选只选当前已加载的可见项。
6. 同步改造 `HoverTooltipManager` 和 `PromptPanelManager` 的图像查询为按 ID 查询，避免 500 缓存限制。
7. `ImageSelectorManager` 保持现状，后续单独处理。

## 方案概述

保留现有 `getImages(sortBy, sortOrder)` 接口不变，供弹窗/选择器等场景继续使用。为主面板新增专用分页接口 `getImagesPaginated(options)`，将筛选、排序、分页逻辑下沉到 SQLite。

## 影响范围（基于 gitnexus impact 分析）

- `database.ts:getImages`：风险 LOW，仅 `main/index.ts` 直接调用。
- `CacheManager.cacheImages`：风险 HIGH，影响 8 处调用，涉及 `ImagePanelManager`、`NewPromptManager`、`PromptDetailManager`。
- 本次改造保留 `cacheImages` 原语义（批量缓存传入数组），其他调用点不会 break。

## 详细实施步骤

### 第一步：数据库层（src/main/database.ts）

新增类型与函数：

```typescript
interface GetImagesPaginatedOptions {
  sortBy?: string;       // 'createdAt' | 'updatedAt' | 'fileName' | 'width' | 'height' | 'fileSize'
  sortOrder?: 'asc' | 'desc';
  searchQuery?: string;  // 搜索文件名、备注、标签
  tagNames?: string[];   // 多标签同时符合
  isSafe?: boolean;      // true 时过滤 is_safe != 0
  limit: number;
  offset: number;
}

interface PaginatedImagesResult {
  items: Image[];
  totalCount: number;
}

async function getImagesPaginated(options: GetImagesPaginatedOptions): Promise<PaginatedImagesResult>
async function countImages(options: Omit<GetImagesPaginatedOptions, 'limit' | 'offset'>): Promise<number>
```

SQL 构建要点：

1. 基础查询复用 `getImagesCore` 模式：先执行基础 SQL，再批量获取 `promptRefs`。
2. WHERE 条件动态拼接：
   - 已删除：`i.is_deleted = 0`
   - Safe 模式：`i.is_safe != 0`
   - 搜索：`(i.file_name LIKE ? OR i.note LIKE ? OR EXISTS (SELECT 1 FROM image_tag_relations itr JOIN image_tags it ON itr.tag_id = it.id WHERE itr.image_id = i.id AND it.name LIKE ?))`
   - 标签筛选：每个标签用 `EXISTS` 子查询：`EXISTS (SELECT 1 FROM image_tag_relations itr JOIN image_tags it ON itr.tag_id = it.id WHERE itr.image_id = i.id AND it.name = ?)`
3. ORDER BY 使用现有字段映射。
4. LIMIT/OFFSET 参数化。
5. `countImages` 使用相同 WHERE 条件，仅 SELECT COUNT(DISTINCT i.id)。

### 第二步：IPC 层

1. `src/preload/index.ts`：
   - 类型定义添加：
     ```typescript
     getImagesPaginated: (options: GetImagesPaginatedOptions) => Promise<{ items: IImage[]; totalCount: number }>;
     ```
   - 实现：
     ```typescript
     getImagesPaginated: (options) => ipcRenderer.invoke('get-images-paginated', options),
     ```

2. `src/main/index.ts`：
   - 注册 handler：
     ```typescript
     ipcMain.handle('get-images-paginated', async (event, options) => {
       return await db.getImagesPaginated(options);
     });
     ```

### 第三步：图像主面板（src/renderer/managers/ImagePanelManager.ts）

新增状态：

```typescript
private pageSize = 100;
private currentOffset = 0;
private hasMore = true;
private totalCount = 0;
private isLoading = false;
private loadedImageIds = new Set<string>();
```

改造 `loadData()`：

1. 重置 `currentOffset = 0`, `hasMore = true`, `loadedImageIds.clear()`。
2. 调用 `getImagesPaginated` 加载第一页。
3. 调用 `cacheManager.cacheImages(page.items)` 缓存第一页（保留 cacheImages 语义，清空后写入当前页）。
4. 设置 `totalCount = page.totalCount`, `hasMore = items.length < totalCount`。
5. 返回 `page.items`。

新增 `loadMore()`：

1. 检查 `hasMore && !isLoading`。
2. `currentOffset += pageSize`。
3. 调用 `getImagesPaginated` 加载下一页。
4. 使用 `cacheImage`（非 cacheImages）追加缓存，避免清空已加载页。
5. 追加到 `filteredImages`，追加渲染而不是清空重绘。
6. 更新 `hasMore`。

重写 `renderView()`：

- 图像面板不再使用基类的前端过滤/排序逻辑。
- 直接从当前分页状态调用 `loadData()` 获取数据，然后调用 `renderContainer(filtered)`。
- 复用基类的 `applyCardSize`、`updateSelectionModeClass`、`updateItemSelectionState` 等通用后续步骤。
- 为避免代码重复，将基类 `renderView()` 中数据获取后的通用流程提取为 `protected async afterRenderContainer(filtered: IPanelItem[]): Promise<void>`。

改造 `renderContainer(filtered: IImage[])`：

- 区分首次渲染和追加渲染。
- 首次渲染：清空容器，渲染当前页（现有逻辑）。
- 追加渲染：在容器末尾追加新卡片/列表项，不破坏已有 DOM 和事件绑定。
- 如果视图模式切换，视为首次渲染，清空重绘已加载内容。

搜索/标签筛选/排序变化时：

- 重置分页状态。
- 调用 `loadData()` 重新查询数据库。
- `PanelManagerBase.renderView()` 中触发图像面板时，改为调用图像面板的自定义流程。

滚动加载绑定：

- 在 `bindScrollEvents()` 中监听 `#image-grid` / `#image-list` 的 `scroll` 事件。
- 防抖判断滚动到底部（距离底部 200px）。
- 触发 `loadMore()`。

全选行为：

- `selectAllVisibleItems()` 仅选择 `this.filteredImages` 中已加载的图像。
- 不主动加载全部未加载项。

### 第四步：基类适配（src/renderer/managers/PanelManagerBase.ts）

1. 提取 `renderView()` 中调用 `renderContainer` 之后的通用步骤为 `protected async afterRenderContainer(filtered: IPanelItem[]): Promise<void>`：
   - `bindContextMenuEvents()`
   - `applyCardSize()`
   - `updateSelectionModeClass()`
   - `updateItemSelectionState()`

2. `ImagePanelManager` 重写 `renderView()` 时调用此辅助方法，保持后续流程一致。

3. `PromptPanelManager` 继续使用基类默认 `renderView()`，不受影响。

### 第五步：标签计数精确统计

当前 `calculateTagCounts()` 和 `calculateSpecialTagCounts()` 基于 `getItems()` 计算，分页后不再准确。

改造方案：

1. 数据库层新增 `countImageTags(options)`：
   - 使用与 `getImagesPaginated` 相同的 WHERE 条件。
   - 返回 `Record<string, number>`，统计每个普通标签的出现次数。
   - SQL：JOIN image_tag_relations 和 image_tags，GROUP BY tag_name。

2. 数据库层新增 `countImageSpecialTags(options)`：
   - 分别统计收藏、无标签、多引用、无引用等特殊标签的数量。
   - 通过 COUNT(CASE WHEN ...) 在单次查询中完成。

3. `ImagePanelManager` 中重写 `calculateTagCounts()` 和 `calculateSpecialTagCounts()`：
   - 调用新的数据库 count 接口。
   - 使用当前搜索/标签/safe 模式条件（但不包括分页限制）。

4. `renderTagFilters()` 中调用计数方法时传入当前筛选条件。

### 第六步：关联调用点改造

#### HoverTooltipManager（src/renderer/renderer_utils/HoverTooltipManager.ts）

当前：通过 `getImages()` 全量查找单张图像路径。

改造：
1. 优先从 `cacheManager.getCachedImage(imageId)` 获取。
2. 未命中时调用 `window.electronAPI.getImageById(imageId)`。
3. 如果仍需要路径，使用 `getImagePath(relativePath)` / `getImagePath(thumbnailPath)`。
4. 缓存路径到 `cacheManager.setImagePath()`。

#### PromptPanelManager（src/renderer/managers/PromptPanelManager.ts）

当前：`loadPromptListThumbnails()` 调用 `getImages()` 全量获取，再按提示词引用的 imageId 查找。

改造：
1. 收集所有需要查找的 imageId（来自当前 `filtered` 提示词的 `prompt.images[0]`）。
2. 优先从 `cacheManager.getCachedImage(id)` 查找。
3. 未命中的 ID 批量调用 `window.electronAPI.getImagesByIds(missingIds)`。
4. 将结果缓存到 `cacheManager`。
5. 继续后续 `getImagesPaths()` 批量获取完整路径。

### 第七步：缓存策略

- `CacheManager.getImageCache()` 的 500 容量保留，含义变为"最近使用的图像元数据缓存"。
- 主面板分页加载的图像通过 `cacheImage` 单条追加到缓存。
- 其他需要按 ID 查询的场景优先走缓存，未命中再走 IPC。
- 图像路径缓存（`imagePaths`）保持现状。

### 第八步：类型定义

1. `src/types/entities.ts`：确认 `IImage` 接口已包含 `id`, `fileName`, `note`, `tags`, `isSafe`, `isDeleted` 等字段。
2. `src/preload/index.ts`：添加 `GetImagesPaginatedOptions` 类型（可在 database.ts 或新类型文件中定义后导入）。
3. `src/main/database.ts`：导出 `GetImagesPaginatedOptions` 和 `PaginatedImagesResult` 类型。

## 验证计划

1. 类型检查和 lint：
   ```powershell
   pnpm check
   ```

2. 手动验证场景：
   - 准备超过 500 张图像的测试数据。
   - 打开图像主目录，确认初始加载 100 张。
   - 滚动到底部，确认追加加载下一页。
   - 搜索关键词，确认返回结果全量准确（不受 500 限制）。
   - 选择多个标签，确认只显示同时包含这些标签的图像。
   - 切换排序方式，确认重新查询并正确排序。
   - 验证标签计数与当前筛选条件下的实际数量一致。
   - 验证全选只选中当前已加载项。
   - 验证提示词列表缩略图能正确加载引用图像（即使该图像不在主面板已加载页中）。
   - 验证图像 hover 提示能正确显示（即使图像不在主面板已加载页中）。

3. 运行相关 e2e 测试（最多 3 个相关测试文件）。

## 风险与回退

- `CacheManager.cacheImages` 是 HIGH 风险符号。本次不改其签名，仅减少 ImagePanelManager 单次传入数据量，风险可控。
- 如果分页后出现未预期的渲染或事件问题，可以通过把 `pageSize` 临时调大（如 10000）快速回退到接近全量的行为。
- 保留原 `getImages` 接口，弹窗和选择器不受影响。

## 不处理的范围

- `ImageSelectorManager` 保持现状，仍使用 `getImages()` 全量获取。后续如果图像选择器也需要支持大量图像，再单独改造。
- 不引入虚拟滚动，仅做数据库分页 + 滚动追加加载。
- 不改动提示词面板的分页逻辑。
