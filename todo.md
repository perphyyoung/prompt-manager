# 提示词主页同步改造待办（虚拟滚动 + 自定义滚动条）✅ 已完成

> 目标：将图像主页已完成并验证的滚动体系原样移植到 `PromptPanelManager`。
> 复用组件（零改动）：`renderer_utils/VirtualScroller.ts`、`VirtualScrollBar.ts`；
> 共享 CSS：`.grid-view` overflow-anchor、`.virtual-item > .prompt-card` 均已就绪。

## A. 虚拟滚动接入 ✅

- [x] `pageSize` 500 → 100
- [x] renderContainer：display 覆盖为 block、创建 virtual-wrapper、setupVirtualScroller、setTotalCount
- [x] 定位辅助三件套：getPromptRowHeight / getPromptColumns / createPositionedCard
- [x] renderWindow / rebuildWindow / ensureWindowData 三件套移植
- [x] appendToContainer 退化为 refresh()；loadMore 尾部 ensureWindowData 追赶
- [x] handleScroll：refresh + ensureWindowData + 滚动条反向同步
- [x] setCardSize 重写（几何失效 + scrollBar.update）
- [x] 几何失效：列数变化强制全量重建
- [x] refreshIncremental 的 hasNewItem 改基于 loadedPromptIds
- [x] 数据源修正：prompts getter / getItems() 以 filteredPrompts 为权威，LRU 仅兜底

## B. 自定义滚动条 ✅

- [x] index.html：promptGrid 加 hide-native-scrollbar；新增 promptScrollBar 挂载点
- [x] constants.ts：PROMPT_SCROLL_BAR
- [x] initScrollBar / syncScrollBarLayout / getViewportRows / getPageSizeItems 移植
- [x] handleScroll 反向同步 thumb；ResizeObserver 对齐网格尺寸变化

## 验证

- [x] pnpm check 全绿
- [x] e2e 冒烟 42 用例通过：17 批量工具栏（图像+提示词）/ 7 多选 / 2 标签拖拽
- [ ] 手动：大数据量拖动 thumb 直达任意位置、末尾数据自动补齐、卡片尺寸滑杆缩放、搜索/筛选切换、详情往返刷新
