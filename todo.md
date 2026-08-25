# 图像/提示词主页加载优化待办

> 参考：D:\code\git\lap 加载思路。
> 已完成：视图收敛网格、pageSize=100、虚拟滚动接入（padding 占位版）、全选走数据库 id、增量窗口渲染、LRU 数据源修复。

## 当前待办：滚动体系重构为 lap 模式

### Phase A：网格切换为"wrapper + absolute 定位"虚拟化（根治滚动异常）

背景：当前 padding 占位 + 文档流卡片模型与 Chromium scroll anchoring 天然冲突，
导致跳转不准/滚动条表现异常。lap 的 VirtualScroll 用固定高度 wrapper + absolute 子项，
scrollHeight 恒定，无此问题。

- [ ] styles.css：`.grid-view` 加 `overflow-anchor: none`；图像主页容器隐藏原生滚动条
- [ ] renderContainer：容器内创建 `virtual-wrapper`（height = totalRows × rowHeight），padding 机制废弃
- [ ] VirtualScroller.setTotalCount 同步设置 wrapper 高度
- [ ] rebuildWindow / 增量 patch：卡片外包 `.virtual-item{position:absolute}` 壳，top/left 由索引与列数计算
- [ ] 几何失效规则：列数/卡尺变化（resize、slider）时 lastWindowRange = null 强制全量重建

### Phase B：自定义滚动条组件替代原生滚动条与跳转按钮（仅图像主页）

参考 lap ScrollBar.vue（total/pageSize/modelValue 三输入，双向比例同步）：

- [ ] 新建 renderer_utils/VirtualScrollBar.ts：track/thumb + 上/下翻页图标；拖动 thumb → index = round(ratio × (total − pageSize)) → 映射容器 scrollTop
- [ ] 容器 scroll → 反向同公式更新 thumb（双通道同步）
- [ ] pageSize 动态 = columns × 可视行数
- [ ] index.html：imageScrollNav 容器改造为滚动条挂载点
- [ ] markers/时间线预览不做（可选后期）

### 验证

- [ ] pnpm check 全绿
- [ ] e2e 冒烟：5-main-panel-refactor / 17-main-grid-batch-toolbar
- [ ] 手动：大数据量拖动 thumb 直达任意位置、末尾数据自动补齐、slider/resize 后布局正确

## 其他遗留

- [ ] 提示词主页是否同步虚拟滚动 + 自定义滚动条（待图像主页稳定后决策）
- [ ] 批量操作万级选中时逐 id IPC 循环较慢，可下沉为按条件集合的 SQL 操作（优化项）
