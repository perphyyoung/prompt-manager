# PRD: 批量工具栏系统

## 问题陈述

项目正在进行全量重构，批量工具栏相关功能在重构前后可能出现行为不一致。当前已有 6 个上下文实现，但缺乏完整的行为约束文档，导致重构时容易遗漏功能或改变用户可感知的行为。

## 解决方案

编写批量工具栏系统的 PRD，描述当前已实现的 6 个上下文的行为规范，作为重构约束基准。PRD 侧重用户可感知行为，不深入实现细节。

## 功能清单

### 功能-显示与隐藏

- 多选项目后自动显示批量工具栏，显示已选择的项目数量
- 显式退出批量模式：点击取消按钮或 ESC 键
- 进入批量模式后，选中数变为 0 时不自动退出批量模式

### 功能-选择操作

- 支持单选（点击复选框）：切换当前项的选中状态
- 支持多选（Ctrl+点击）：切换当前项的选择状态
- 支持范围选择（Shift+点击）：从上次选中位置到当前位置之间的所有项加入选中集
- 支持全选当前筛选后的所有可见项目
- 支持反选当前筛选后的所有可见项目
- Ctrl+A 在批量模式下全选

### 功能-筛选与状态

- 筛选条件（标签筛选/搜索）改变时退出批量模式
- 标签筛选区展开和收起状态下，点击标签都退出批量模式
- 视图模式切换（网格/列表/紧凑）保留选择状态

### 功能-批量操作

- 批量删除选中项目，需确认对话框，完成后显示 Toast 提示
- 批量为选中项目添加标签，通过英文逗号、中文逗号或空格分隔的输入对话框（输入为空时不执行操作）
- 批量收藏/取消收藏选中项目，完成后显示 Toast 提示

### 功能-上下文支持

- 主界面（提示词/图像网格视图）：支持批量管理项目(全选/反选/添加标签/收藏/删除)
- 详情界面（提示词/图像详情）：支持批量管理标签（全选/反选/删除）
- 标签管理界面（提示词/图像标签管理）：支持批量管理标签（全选/反选/移动到组/删除）

## 实现决策

### 6 个工具栏上下文

系统定义了 6 个 `ToolbarContext`，每个对应独立的工具栏实例：

| 上下文                | 数据类型   | 使用场景           | 按钮                  |
| ------------------ | ------ | -------------- | ------------------- |
| `promptMain`       | prompt | 提示词网格视图        | 全选、反选、添加标签、收藏、删除、取消 |
| `imageMain`        | image  | 图像网格视图         | 全选、反选、添加标签、收藏、删除、取消 |
| `promptDetail`     | prompt | 提示词详情 - 批量标签管理 | 全选、反选、删除、取消       |
| `imageDetail`      | image  | 图像详情 - 批量标签管理  | 全选、反选、删除、取消       |
| `promptTagManager` | prompt | 提示词标签管理界面      | 全选、反选、移动到组、删除、取消    |
| `imageTagManager`  | image  | 图像标签管理界面       | 全选、反选、移动到组、删除、取消    |

### 工具栏位置与样式

- **所有工具栏**：固定在页面底部悬浮，类名 `batch-toolbar`，内容容器 `batch-toolbar-content`，按钮容器 `batch-toolbar-actions`
- **计数显示格式**：`已选择 N 个{label}`（label 为"提示词"/"图像"/"标签"）

### 模块架构

#### BatchToolbarMiddle（核心中间层）

- 职责：工具栏状态管理 + DOM 操作 + 选择管理 + 业务逻辑路由
- 单例模式，通过 `states` Map 管理多个上下文的状态
- 每个上下文独立的状态：配置、动作处理器、选中 ID 集合、最后选中索引、业务配置

**核心 API**：

- `show(context, count, onClose)`：显示工具栏（`onClose` 为必需参数，用于 ESC/关闭时的清理）
- `hide(context)`：隐藏工具栏
- `toggle(context, count, onClose)`：切换工具栏显示状态（`onClose` 为必需参数）

#### BatchBusinessConfig（业务配置接口）

调用方（PanelManagerBase / DetailViewManager / TagManager）通过配置注入具体业务逻辑：

- `delete.batchApi`：批量删除 API，接收 `ids: string[]`，返回 `Promise<{ success: boolean; deleted: number }>`
- `delete.clearCache`：缓存清理（可选）
- `addTag.processItems`：批量处理函数，接收 `ids: string[]` 和 `tagNames: string[]`，返回 `Promise<void>`
- `favorite.batchApi`：批量收藏 API，接收 `ids: string[]` 和 `favorite: boolean`，返回 `Promise<{ success: boolean; updated?: number } | void>`

**注意**：不同上下文支持的操作不同。例如：

- 主界面（promptMain/imageMain）：支持删除、添加标签、收藏
- 详情界面（promptDetail/imageDetail）：仅支持删除标签（选中的是标签名称 tagNames 而非 ID）
- 标签管理界面（promptTagManager/imageTagManager）：仅支持删除标签、移动到组（选中的是标签名称 tagNames 而非 ID）

**标签管理界面特殊行为**：

- 移动到组时逐个处理，支持部分成功/失败统计
- 无可选组时提示"无可用组"

#### 统一删除流程方法

BatchToolbarMiddle 提供两个统一的删除流程方法：

**`executeDelete(context, options)`**

用于主界面的批量删除流程（提示词/图像）：

- 参数 `options.confirmConfig`：确认对话框配置（使用 `DialogConfig.BATCH_DELETE_PROMPTS` 或 `BATCH_DELETE_IMAGES`）
- 参数 `options.execute`：执行删除的异步函数，接收 `ids: string[]`，返回 `Promise<{ success: boolean; deleted: number }>`
- 参数 `options.onRefresh`：删除成功后的刷新回调
- 参数 `options.showToast`：Toast 提示回调
- 参数 `options.successMessage`：成功消息模板回调（可选），接收 `(deleted: number, total: number)`
- 流程：确认对话框 → 执行删除 → 清空选择 → 刷新 → Toast
- 错误处理：显示 Toast 错误提示，选中集不变，不触发刷新

**`executeDeleteTags(context, options)`**

用于详情界面和标签管理界面的标签删除流程：

- 参数 `options.getSelectedTags`：获取选中标签的回调，返回 `Set<string>`
- 参数 `options.confirmConfig`：确认对话框配置（使用 `DialogConfig.BATCH_DELETE_TAGS`）
- 参数 `options.execute`：执行删除的异步函数，接收 `tagNames: string[]`，返回 `Promise<{ success: boolean; deleted: number }>`
- 参数 `options.onRefresh`：删除成功后的刷新回调
- 参数 `options.showToast`：Toast 提示回调
- 参数 `options.successMessage`：成功消息模板回调（可选）
- 流程：获取选中标签 → 确认对话框 → 执行删除 → 清空选择 → 刷新 → Toast
- 错误处理：显示 Toast 错误提示，选中集不变，不触发刷新

#### 预设配置（presets.ts）

6 个上下文的按钮配置集中管理，包含按钮 action、文本、排序、样式类。

#### pyBatchToolbar 工具库

- `sortButtons`：按 `order` 字段排序按钮
- `mergeButtonConfigs`：合并基础配置与覆盖配置
- `filterVisibleButtons`：过滤 `visible !== false` 的按钮
- `generateToolbarId`：生成工具栏唯一 ID
- `isValidContext`：校验上下文是否有效

### ContextStackManager 集成

批量工具栏通过 `ContextStackManager` 管理模态上下文：

- 显示时压栈：`{ id, state: { isBatchToolbarVisible: true }, close: () => hide() }`
- 隐藏时出栈：`contextStack.pop(id)`
- 支持 ESC 键通过栈的 `close` 方法退出
- 支持 Ctrl+A 通过工具栏元素的 `ctrla` 方法全选

### 选择模式 UI 标记

- 批量模式激活时，网格/列表容器添加 `selection-mode` CSS 类
- 用于切换复选框显示、卡片样式等视觉变化
- 由 `updateSelectionModeClass()` 方法统一管理

## 行为约束矩阵

### 显示/隐藏

| 场景 | 触发条件 | 前置状态 | 预期行为 | 预期结果状态 |
|------|----------|----------|----------|-------------|
| 显示 | 选中数从 0 变为 >0 | 工具栏隐藏 | 添加 .visible 类，display: block，压栈到 ContextStackManager | 工具栏可见 |
| ESC 退出 | 按下 ESC 键 | 工具栏显示 | 通过 ContextStackManager.close() 隐藏 | 工具栏隐藏，选中数=0 |
| 取消按钮退出 | 点击取消按钮 | 至少选中 1 项 | 清空选中集，工具栏隐藏，移除 selection-mode | 选中数=0，工具栏隐藏 |

### 选择操作

| 场景 | 触发条件 | 前置状态 | 预期行为 | 预期结果状态 |
|------|----------|----------|----------|-------------|
| 复选框点击（选中） | 点击未选中项复选框 | 任意选择状态 | 将当前项加入选中集 | 选中数+1，lastSelectedIndex 更新 |
| 复选框点击（取消） | 点击已选中项复选框 | 至少选中 1 项 | 从选中集移除当前项 | 选中数-1，工具栏不隐藏 |
| Ctrl+点击（选中） | Ctrl+点击未选中项 | 任意选择状态 | 将当前项加入选中集 | 选中数+1，lastSelectedIndex 更新 |
| Ctrl+点击（取消） | Ctrl+点击已选中项 | 至少选中 1 项 | 从选中集移除当前项 | 选中数-1，lastSelectedIndex 更新 |
| 范围选择 | Shift+点击 | 至少已有 1 项选中（lastSelectedIndex 有值） | 将 lastSelectedIndex 到当前索引间所有可见项加入选中集 | 选中数更新为范围大小，lastSelectedIndex 更新 |
| 全选 | 点击全选按钮 | 筛选后有 N 项可见 | 所有可见项 ID 加入选中集 | 选中数=N，工具栏显示 |
| 反选 | 点击反选按钮 | 筛选后有 N 项可见，已选中 M 项 | 未选中的 N-M 项加入，已选中的 M 项移除 | 选中数=N-M，工具栏显示（如 N-M>0） |
| 清空选择 | 点击取消按钮/ESC | 至少选中 1 项 | 清空选中集 | 选中数=0，工具栏隐藏，selection-mode 移除 |

- 标签管理界面:
  - ❌ 不支持 Ctrl+点击和 Shift+点击; 主界面和详情界面完整支持
- lastSelectedIndex 规则：
  - 更新时机：单选、多选（Ctrl+点击）、范围选择后更新为当前项索引
  - 重置时机：清空选择、筛选/搜索改变时重置

### 筛选/视图变更

| 场景 | 触发条件 | 前置状态 | 预期行为 | 预期结果状态 |
|------|----------|----------|----------|-------------|
| 标签筛选改变（展开状态） | 展开状态下点击标签 | 任意选择状态 | 退出批量模式（清空选中集，隐藏工具栏，移除 selection-mode） | 选中数=0，工具栏隐藏，复选框移除 |
| 标签筛选改变（收起状态） | 收起状态下点击头部标签 | 任意选择状态 | 退出批量模式（清空选中集，隐藏工具栏，移除 selection-mode） | 选中数=0，工具栏隐藏，复选框移除 |
| 搜索改变 | 搜索输入变化（含防抖/清空按钮） | 任意选择状态 | 退出批量模式（清空选中集，隐藏工具栏，移除 selection-mode） | 选中数=0，工具栏隐藏，复选框移除 |
| 视图模式切换 | 网格↔列表↔紧凑切换 | 任意选择状态 | 保留选中集 | 选中数不变，工具栏状态不变 |

### 批量操作

| 场景 | 触发条件 | 前置状态 | 预期行为 | 预期结果状态 |
|------|----------|----------|----------|-------------|
| 批量删除 | 点击删除按钮 → 确认对话框点击确认 | 选中 N≥1 项 | 执行删除 → 清空选择 → 刷新数据 → Toast | 选中数=0，数据已删除，工具栏不隐藏 |
| 批量删除（取消） | 点击删除按钮 → 确认对话框点击取消 | 选中 N≥1 项 | 中止操作 | 选中集不变，工具栏显示 |
| 批量添加标签 | 点击添加标签按钮 → 输入标签 → 确认 | 选中 N≥1 项 | 执行添加标签 → 刷新数据 → Toast | 选中集不变，标签已添加 |
| 批量添加标签（空输入） | 输入框为空时确认 | 选中 N≥1 项 | 不执行操作 | 选中集不变 |
| 批量收藏 | 点击收藏按钮 | 选中 N≥1 项 | 执行收藏 → 刷新数据 → Toast | 选中集不变，收藏状态已切换 |
| 移动到组 | 点击移动到组按钮 → 选择目标组 → 确认 | 选中 N≥1 项（标签管理界面） | 逐个移动标签到目标组 → Toast（成功/失败统计） | 选中集不变，标签已移动 |
| 移动到组（无可选组） | 点击移动到组按钮但无可用组 | 选中 N≥1 项 | 提示无可用组 | 选中集不变 |

## 状态流转

### 工具栏状态

```
[隐藏] ──选中数>0──→ [显示]
[显示] ──ESC/取消──→ [隐藏]（清空选中集）
```

- 初始状态：隐藏
- 不可达状态：无

### 选择模式状态

```
[非选择模式] ──选中任意项──→ [选择模式]（容器添加 selection-mode 类）
[选择模式] ──清空所有选中──→ [非选择模式]（容器移除 selection-mode 类）
```

### 业务操作状态

```
[正常浏览] ──选中项并点击操作──→ [操作执行中]
[操作执行中] ──成功──→ [正常浏览]（刷新数据，删除操作清空选择）
[操作执行中] ──失败──→ [正常浏览]（Toast 错误，选中集不变）
[删除操作] ──确认对话框──→ [执行删除]
[确认对话框] ──取消──→ [正常浏览]（选中集不变）
```

## 超出范围

以下内容不在本 PRD 范围内：

- 工具栏 UI 样式/主题定制
- 工具栏按钮的拖拽排序
- 工具栏按钮的动态增删
- 跨页面/跨应用的批量操作
- 撤销/重做机制

## 约束检查清单

[x] 已完成

## 测试决策

### 好测试的标准

- 测试用户可感知的行为（显示/隐藏、选择、操作结果），不测试内部状态
- 测试应能捕捉重构导致的行为回退
- 每个上下文独立测试

### 需要测试的模块

| 模块                 | 测试内容                                                                           |
| ------------------ | ------------------------------------------------------------------------------ |
| BatchToolbarMiddle | init/show/hide/toggle 生命周期、选择操作（单选/多选/范围/全选/反选/清空）                             |
| presets            | 6 个上下文的按钮配置正确性（数量、顺序、action 标识）                                                |
| utils              | sortButtons 排序、mergeButtonConfigs 合并、filterVisibleButtons 过滤、isValidContext 校验 |
| 端到端                | 网格视图批量删除/添加标签/收藏流程、详情界面批量标签管理流程、标签管理界面批量移动/删除流程                                |

### 参考现有测试

- `tests/pyBatchToolbar/BatchToolbarMiddle.test.ts` — 单元测试
- `tests/pyBatchToolbar/presets.test.ts` — 预设配置测试
- `tests/pyBatchToolbar/utils.test.ts` — 工具函数测试
- `e2e/electron-test.ts` — E2E 测试（ElectronTestHelper 类）

## 进一步说明

- 本 PRD 描述的是当前已实现的行为，作为重构约束基准
- 如发现代码实现与文档不一致，提出讨论
- 后续添加列表视图/紧凑视图时，如无特殊需求，复用 `promptMain` / `imageMain` 上下文
- 重构时不得改变用户可感知的行为，除非经用户明确同意
