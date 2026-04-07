# E2E 测试清单

本文档说明每个测试文件的具体测试内容，方便代码修改后快速定位相关测试。

## 测试文件列表

| 文件 | 测试内容 |
|------|----------|
| [1-shortcut-esc.spec.ts](./1-shortcut-esc.spec.ts) | ESC 键快捷键功能 |
| [2-tag-drag-drop.spec.ts](./2-tag-drag-drop.spec.ts) | 标签拖拽功能 |
| [3-image-detail-database-fields.spec.ts](./3-image-detail-database-fields.spec.ts) | 图像详情界面数据库字段读取 |
| [4-prompt-detail-database-fields.spec.ts](./4-prompt-detail-database-fields.spec.ts) | 提示词详情界面数据库字段读取 |
| [5-main-panel-refactor.spec.ts](./5-main-panel-refactor.spec.ts) | 主界面重构功能 |
| [6-new-prompt-duplicate-prevention.spec.ts](./6-new-prompt-duplicate-prevention.spec.ts) | 新建提示词防重复提交 |
| [7-main-card-multi-select.spec.ts](./7-main-card-multi-select.spec.ts) | 主界面卡片视图多选功能 |
| [8-main-view-shift-select.spec.ts](./8-main-view-shift-select.spec.ts) | Shift 范围选择功能 |

---

## 详细说明

### 1-shortcut-esc.spec.ts

**测试内容**：ESC 键快捷键功能

**涉及组件/管理器**：
- `ShortcutManager` - 快捷键管理
- `ImageDetailManager` - 图像详情
- `PromptDetailManager` - 提示词详情
- `StatisticsManager` - 统计模态框
- `SettingsManager` - 设置模态框
- `ContextStackManager` - 上下文栈管理

**修改相关文件时需关注**：
- 修改 ESC 快捷键行为时
- 修改模态框关闭逻辑时
- 修改上下文栈管理时

---

### 2-tag-drag-drop.spec.ts

**测试内容**：标签拖拽功能

**涉及组件/管理器**：
- `TagManager` - 标签管理
- `ImageTagManager` - 图像标签管理
- `PromptTagManager` - 提示词标签管理
- `TagService` - 标签服务

**修改相关文件时需关注**：
- 修改标签拖拽逻辑时
- 修改标签添加到图像/提示词的流程时

---

### 3-image-detail-database-fields.spec.ts

**测试内容**：图像详情界面数据库字段读取

**涉及组件/管理器**：
- `ImageDetailManager` - 图像详情管理
- `ImagePanelManager` - 图像面板管理

**测试的数据库字段**：
- 图像基本信息：id, fileName, fileSize, width, height, createdAt, updatedAt, note, tags
- 关联提示词信息：promptRefs (包含 title, content, contentTranslate, note, tags)

**修改相关文件时需关注**：
- 修改图像详情界面显示时
- 修改图像数据库字段读取时

---

### 4-prompt-detail-database-fields.spec.ts

**测试内容**：提示词详情界面数据库字段读取

**涉及组件/管理器**：
- `PromptDetailManager` - 提示词详情管理
- `PromptPanelManager` - 提示词面板管理

**测试的数据库字段**：
- 提示词基本信息：id, title, content, contentTranslate, note, isSafe, isFavorite, tags
- 关联图像信息：images (通过 prompt_image_relations 关联)
- 时间戳：createdAt, updatedAt

**修改相关文件时需关注**：
- 修改提示词详情界面显示时
- 修改提示词数据库字段读取时

---

### 5-main-panel-refactor.spec.ts

**测试内容**：主界面重构功能

**涉及组件/管理器**：
- `ImagePanelManager` - 图像面板管理
- `PromptPanelManager` - 提示词面板管理
- `BatchToolbar` - 批量工具栏

**测试场景**：
1. 卡片收藏按钮功能（图像和提示词）
2. 卡片复制按钮功能（图像和提示词）
3. 列表视图按钮功能（图像和提示词）
4. 标签筛选区域收起/展开切换（图像和提示词）
5. 收藏状态在卡片和列表视图间同步（图像和提示词）

**修改相关文件时需关注**：
- 修改卡片收藏/复制功能时
- 修改视图切换逻辑时
- 修改标签筛选区域时

---

### 6-new-prompt-duplicate-prevention.spec.ts

**测试内容**：新建提示词防重复提交

**涉及组件/管理器**：
- `NewPromptManager` - 新建提示词管理
- `DuplicatePrevention` - 重复预防工具

**修改相关文件时需关注**：
- 修改新建提示词防重复逻辑时
- 修改快速点击处理逻辑时

---

### 7-main-card-multi-select.spec.ts

**测试内容**：主界面卡片视图多选功能

**涉及组件/管理器**：
- `ImagePanelManager` - 图像面板管理
- `PromptPanelManager` - 提示词面板管理
- `MultiSelectManager` - 多选管理
- `BatchToolbar` - 批量工具栏

**测试场景**：
1. 复选框选中/取消选中（图像和提示词）
2. 进入多选模式后复选框一直显示（图像和提示词）
3. 批量工具栏按钮功能（反选、添加标签、收藏、删除、取消选择）（图像和提示词）
4. Ctrl+A 全选（图像和提示词）
5. 批量收藏功能（图像和提示词）
6. 多选后切换视图保留选择状态（图像和提示词）

**修改相关文件时需关注**：
- 修改多选逻辑时
- 修改批量操作功能时
- 修改选择状态持久化时

---

### 8-main-view-shift-select.spec.ts

**测试内容**：Shift 范围选择功能

**涉及组件/管理器**：
- `ImagePanelManager` - 图像面板管理
- `PromptPanelManager` - 提示词面板管理
- `ListNavigator` - 列表导航

**测试场景**：
1. 图像列表视图 - Shift+ 点击范围选择
2. 提示词列表视图 - Shift+ 点击范围选择

**前置条件**：
- 数据库中至少有 5 张图像
- 数据库中至少有 5 个提示词

**修改相关文件时需关注**：
- 修改 Shift 多选逻辑时
- 修改列表视图范围选择时
