# 待办：缓存体系优化

> 背景：图像/提示词主页已完成虚拟滚动 + 自定义滚动条改造；
> 面板数据源已改为 filteredImages/filteredPrompts 权威，LRU 元数据缓存降级为纯加速层。

## 方案一：最小修正集 ✅ 已完成

- [x] C1 路径缓存拆分：`thumbnailPaths`(5000) / `originalPaths`(1000) 独立 LRU，
  键简化为纯 id，读取改 peek（不扰动淘汰顺序）；改动封闭在 CacheManager 内。
  注：originalPaths 仅覆盖 hover 高频访问；详情界面（图像详情/提示词关联图/全屏）
  为低频单次查询，直接 IPC 不经过缓存——已核实为合理设计并修正注释
- [x] C2 移除失败路径的全量 clear()：
  ImagePanelManager/PromptPanelManager 的 loadData（try/catch 一并移除）、
  app.loadPrompts catch、两面板 delete 配置的 clearCache、DetailViewManager 删除后 clear
- [x] C3 CacheManager 新增 cacheImagesAppend（追加式不清空）；
  PromptDetailManager 选择图像后改用之
- [x] C4 注释修正：prefetchImagePaths"唯一写入点"、createCache 容量幂等说明

## 方案二：结构性收敛【backlog，方案一稳定后再评估】

退役 images/prompts 元数据 LRU 的"可依赖数据源"心智：

- 面板权威 = filtered 数组（已达成）；详情/保存链路需要的最新对象
  改由事件携带或从 filtered 查找
- 收益：单一数据源，消除双写不一致的根本混乱；
  CacheManager 仅保留路径缓存与详情局部缓存
- 代价：触碰 PromptDetailManager / ImageDetailManager / SaveStrategy / app.ts
  约 20 个读写点（getCachedImage/getCachedPrompt/cachedImages 等），
  需回归详情页全部交互（图像选择器、关联图编辑、字段保存）
- 触发条件：方案一上线后详情链路再出现实际的一致性 bug，或需要内存画像优化时
