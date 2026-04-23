# PyTagGroups 标签组库设计方案

## 1. 项目概述

### 1.1 背景

当前项目的标签管理逻辑分散在多个文件中（TagService.ts、SimpleTagManager.ts、TagManager.ts、MultiSelectConfig.ts、PanelManagerBase.ts），存在职责混杂、接口不统一、重复逻辑等问题。

### 1.2 目标

设计并实现一个统一的标签组库 PyTagGroups，提供标签和标签组管理的统一入口，实现职责分离、接口统一、易于维护和扩展。

### 1.3 设计原则

- **单一职责**：数据层、业务层、验证层、工具层分离
- **接口统一**：统一使用数组输入，内部处理解析
- **可复用性**：不依赖特定 UI 框架，可独立使用
- **可测试性**：每层可独立单元测试

---

## 2. 目录结构

```
src/
└── pyTagGroups/                    # 目录名: camelCase
    ├── index.ts                    # 统一入口，导出所有公共 API
    ├── PyTagGroups.ts              # 主库类（与目录同名，PascalCase）
    ├── TopGroupManager.ts          # 首位组管理器
    ├── types.ts                    # 类型定义（含自定义异常类）
    ├── dataAccess.ts               # 数据访问层抽象（TagDataAccess 接口）
    ├── operations.ts               # 标签操作（增删改查，通过 dataAccess 访问数据）
    ├── validation.ts               # 验证逻辑（纯函数）
    └── utils.ts                    # 工具函数（纯函数）
```

---

## 3. 核心功能列表

### 3.1 标签核心功能（Tag Core）

| 功能分类 | 功能点 | 说明 |
|---------|-------|------|
| **查询** | 获取所有标签 | 从缓存或 API 获取完整标签列表 |
| | 前缀搜索 | 根据输入前缀返回匹配标签（用于自动完成） |
| | 存在性检查 | 检查标签是否存在于系统中 |
| **创建** | 单标签创建 | 创建单个标签 |
| | 批量创建 | 批量创建标签，支持解析逗号/空格分隔的输入 |
| | 智能创建 | 自动跳过已存在标签，创建新标签 |
| **更新** | 重命名 | 标签重命名，更新所有关联 |
| **删除** | 单标签删除 | 删除单个标签 |
| | 批量删除 | 批量删除标签 |
| **关联** | 分配到组 | 将标签分配到指定组 |
| | 从组移除 | 将标签从组中移除 |

### 3.2 标签组核心功能（Tag Group Core）

| 功能分类 | 功能点 | 说明 |
|---------|-------|------|
| **查询** | 获取所有组 | 获取完整标签组列表 |
| | 获取组详情 | 获取指定组的详细信息 |
| | 获取组内标签 | 获取指定组包含的所有标签 |
| **创建** | 创建组 | 创建新标签组 |
| **更新** | 更新组信息 | 更新组名称、排序等属性 |
| **删除** | 删除组 | 删除标签组（处理组内标签） |

### 3.3 验证功能（Validation）

| 验证项 | 说明 |
|-------|------|
| 保留标签检查 | 检查是否为系统保留标签（如"收藏"、"未分类"等） |
| 存在性检查 | 检查标签是否已存在 |
| 有效性检查 | 检查标签名称是否合法（非空、无特殊字符等） |
| 权限检查 | 检查是否有权限操作（预留） |

### 3.4 工具功能（Utils）

| 功能 | 说明 |
|-----|------|
| 解析标签输入 | 解析逗号/空格/中文逗号分隔的标签字符串 |
| 差集计算 | 计算两个标签数组的差集 |
| 标准化标签名 | 去除首尾空格，统一格式 |

---

## 4. 类型设计

### 4.1 基础类型

```typescript
// 标签名称
export type TagName = string;

// 标签组 ID
export type TagGroupId = number;

// 支持的数据类型
export type DataType = 'prompt' | 'image';

// 标签对象
export interface Tag {
  name: TagName;
  groupId: TagGroupId | null;
}

// 带组信息的标签
export interface TagWithGroup {
  name: TagName;
  groupId: TagGroupId | null;
  groupName: string;
}

// 标签组对象
export interface TagGroup {
  id: TagGroupId;
  name: string;
  sortOrder: number;
  tags?: TagName[];  // 可选，表示组内包含的标签列表
}
```

### 4.2 操作结果类型

```typescript
// 操作结果
export interface TagOperationResult {
  success: boolean;
  created: TagName[];      // 成功创建的标签
  skipped: TagName[];      // 已存在被跳过的标签
  errors: TagError[];      // 错误的标签
}

// 错误信息
export interface TagError {
  tag: TagName;
  error: string;
  code: ErrorCode;
}

// 错误代码
export type ErrorCode = 
  | 'RESERVED'    // 系统保留标签
  | 'EXISTS'      // 已存在
  | 'INVALID'     // 无效名称
  | 'PERMISSION'  // 权限不足
  | 'NOT_FOUND';  // 不存在

// ========== 异常类型 ==========

/** 标签操作基础异常 */
export class TagOperationError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly tag?: TagName
  ) {
    super(message);
    this.name = 'TagOperationError';
  }
}

/** 标签已存在异常 */
export class TagExistsError extends TagOperationError {
  constructor(tag: TagName) {
    super(`标签 "${tag}" 已存在`, 'EXISTS', tag);
    this.name = 'TagExistsError';
  }
}

/** 标签不存在异常 */
export class TagNotFoundError extends TagOperationError {
  constructor(tag: TagName) {
    super(`标签 "${tag}" 不存在`, 'NOT_FOUND', tag);
    this.name = 'TagNotFoundError';
  }
}

/** 无效标签名异常 */
export class InvalidTagNameError extends TagOperationError {
  constructor(tag: TagName, reason: string) {
    super(`无效的标签名 "${tag}": ${reason}`, 'INVALID', tag);
    this.name = 'InvalidTagNameError';
  }
}
```

### 4.3 选项类型

```typescript
// 创建选项
export interface TagCreateOptions {
  defaultGroupId?: TagGroupId | null;  // 默认分配到的组
}

// 查询选项
export interface TagQueryOptions {
  sortBy?: 'name' | 'count';
}
```

---

## 5. 模块设计

### 5.1 PyTagGroups（主库类）

**职责**：统一入口，协调各模块，提供便捷方法

**设计要点**：

- 单例模式，按 `DataType` 区分实例
- 组合 `operations`、`validation`、`utils` 模块
- 提供高层便捷方法

**核心方法**：

```typescript
export class PyTagGroups {
  // 获取实例
  static getInstance(type: DataType): PyTagGroups;

  // 便捷方法
  async create(input: TagName | TagName[], options?: TagCreateOptions): Promise<TagOperationResult>;

  // 获取所有标签名称
  async getAllTags(options?: TagQueryOptions): Promise<TagName[]>;

  async search(prefix: string, exclude?: TagName[]): Promise<TagName[]>;
  async rename(oldName: TagName, newName: TagName): Promise<void>;
  async delete(input: TagName | TagName[]): Promise<{ deleted: number; errors: TagError[] }>;
  async exists(tag: TagName): Promise<boolean>;

  // 获取所有标签及其组信息
  async getTagsWithGroups(): Promise<Tag[]>;

  // 组操作
  async createGroup(name: string, sortOrder?: number): Promise<TagGroup>;
  async getGroups(): Promise<TagGroup[]>;
  async updateGroup(id: TagGroupId, attrs: Partial<TagGroup>): Promise<void>;
  async deleteGroup(id: TagGroupId): Promise<void>;
  async assignToGroup(tag: TagName, groupId: TagGroupId | null): Promise<void>;

  // 获取指定组内的所有标签
  async getTagsByGroup(groupId: TagGroupId): Promise<TagName[]>;

  // 工具方法
  parse(input: string): TagName[];
  diff(current: TagName[], removed: TagName[]): TagName[];

  // 按组分组标签
  async groupByGroup(tags: TagName[]): Promise<{ grouped: Record<TagGroupId, TagName[]>; ungrouped: TagName[] }>;
}
```

### 5.2 dataAccess（数据访问层）

**职责**：抽象底层数据操作，隔离 electronAPI 依赖

**设计要点**：

- 定义 `TagDataAccess` 接口，规范所有数据操作
- 提供 `ElectronTagDataAccess` 实现，封装 electronAPI 调用
- 支持通过工厂函数 `createDataAccess` 创建实例
- 新增标签关联查询和清理方法（`getItemsByTag`、`removeTagFromItem`）

**核心接口**：

```typescript
export interface TagDataAccess {
  // 标签操作
  getTags(): Promise<TagName[]>;
  addTag(tag: TagName): Promise<void>;
  renameTag(oldName: TagName, newName: TagName): Promise<void>;
  deleteTag(tag: TagName): Promise<void>;

  // 标签组操作
  getTagGroups(): Promise<TagGroup[]>;
  createTagGroup(name: string, sortOrder: number): Promise<TagGroup>;
  updateTagGroup(id: TagGroupId, attrs: Partial<TagGroup>): Promise<void>;
  deleteTagGroup(id: TagGroupId): Promise<void>;

  // 关联操作
  assignTagToGroup(tag: TagName, groupId: TagGroupId | null): Promise<void>;
  getItemsByTag(tag: TagName): Promise<string[]>;
  removeTagFromItem(itemId: string, tag: TagName): Promise<void>;
}
```

### 5.3 operations（操作模块）

**职责**：封装所有标签和标签组的 CRUD 操作

**设计要点**：

- 通过 `dataAccess` 访问数据，不直接调用 electronAPI
- 处理缓存同步
- 返回标准化结果
- 删除标签时自动清理项目中的标签引用

**核心函数**：

```typescript
// 标签操作
export async function getTags(type: DataType): Promise<TagName[]>;
export async function createTags(type: DataType, tags: TagName[], options?: TagCreateOptions): Promise<TagOperationResult>;
export async function renameTag(type: DataType, oldName: TagName, newName: TagName): Promise<void>;
export async function deleteTags(type: DataType, tags: TagName[]): Promise<{ deleted: number; errors: TagError[] }>;
export async function assignTagToGroup(type: DataType, tag: TagName, groupId: TagGroupId | null): Promise<void>;

// 标签组操作
export async function getTagGroups(type: DataType): Promise<TagGroup[]>;
export async function createTagGroup(type: DataType, name: string, sortOrder: number): Promise<TagGroup>;
export async function updateTagGroup(type: DataType, id: TagGroupId, attrs: Partial<TagGroup>): Promise<void>;
export async function deleteTagGroup(type: DataType, id: TagGroupId): Promise<void>;
```

### 5.4 validation（验证模块）

**职责**：所有标签相关验证逻辑

**设计要点**：

- 纯函数，无副作用
- 返回标准化验证结果
- 支持自定义保留标签列表

**核心函数**：

```typescript
export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: ErrorCode;
}

// 验证标签是否可以创建
export function validateTagCreate(
  tag: TagName, 
  existingTags: TagName[], 
  reservedTags: TagName[],
): ValidationResult;

// 验证标签是否可以删除
export function validateTagDelete(
  tag: TagName, 
  existingTags: TagName[]
): ValidationResult;

// 验证标签组名称
export function validateGroupName(name: string): ValidationResult;

// 获取系统保留标签
export function getReservedTags(type: DataType): TagName[];
```

### 5.5 utils（工具模块）

**职责**：标签相关的纯工具函数

**设计要点**：

- 纯函数，无副作用
- 不依赖外部状态
- 可独立测试

**核心函数**：

```typescript
// 解析标签输入（支持批量）
export function parseTagInput(input: string): TagName[];

// 计算标签差集
export function diffTags(current: TagName[], removed: TagName[]): TagName[];

// 标准化标签名称
export function normalizeTag(tag: string): TagName;

// 检查标签是否在数组中
export function hasTag(tags: TagName[], tag: TagName): boolean;

// 按组分组标签
export function groupTagsByGroup(
  tags: TagName[], 
  groups: TagGroup[]
): { grouped: Record<TagGroupId, TagName[]>; ungrouped: TagName[] };

// 构建带组信息的标签列表
export function buildTagsWithGroupInfo(
  tags: TagName[], 
  groups: TagGroup[]
): Array<{ name: TagName; groupId: TagGroupId | null; groupName: string | null }>;

// 排序函数
export function sortTagsByCount(tags: TagName[], counts: Record<TagName, number>): TagName[];

// Tag 对象转换
export function toTagObjects(tagNames: TagName[], groups: TagGroup[]): Tag[];
export function fromTagObjects(tags: Tag[]): TagName[];
```

### 5.6 TopGroupManager（首位组管理器）

**职责**：统一管理首位组的识别、排序和标签收集

**设计要点**：

- 纯静态方法，无需实例化
- 按组优先级排序标签，首位组标签排在最前面
- 支持标签筛选器的头部标签收集（特殊标签 + 首位组标签 + 选中标签）

**核心方法**：

```typescript
export class TopGroupManager {
  // 按组优先级排序标签
  static sortTagsWithGroupPriority(
    tags: TagInfo[],
    tagCounts: Record<string, number>,
    config: TagSortConfig
  ): TagInfo[];

  // 从标签列表中构建组映射
  static buildGroupMap(
    tags: TagInfo[],
    tagCounts: Record<string, number>
  ): Map<number, TopGroupInfo>;

  // 获取排序后的非空组列表
  static getNonEmptyGroups(groupMap: Map<number, TopGroupInfo>): TopGroupInfo[];

  // 获取首位组（排序第一的非空组）
  static getTopGroup(groupMap: Map<number, TopGroupInfo>): TopGroupInfo | null;

  // 收集头部显示的标签（特殊标签 + 首位组标签 + 选中标签）
  static collectHeaderTags(
    specialTags: SpecialTagInfo[],
    sortedTags: TagInfo[],
    tagCounts: Record<string, number>,
    selectedTags: Set<string>,
    allSpecialTags: string[]
  ): HeaderTagItem[];
}
```

---

## 6. 实现思路

### 6.1 数据访问层设计

通过 `TagDataAccess` 接口抽象 electronAPI 调用，实现数据层与业务层分离：

```typescript
// 数据访问接口
export interface TagDataAccess {
  // 标签操作
  getTags(): Promise<TagName[]>;
  addTag(tag: TagName): Promise<void>;
  renameTag(oldName: TagName, newName: TagName): Promise<void>;
  deleteTag(tag: TagName): Promise<void>;

  // 标签组操作
  getTagGroups(): Promise<TagGroup[]>;
  createTagGroup(name: string, sortOrder: number): Promise<TagGroup>;
  updateTagGroup(id: TagGroupId, attrs: Partial<TagGroup>): Promise<void>;
  deleteTagGroup(id: TagGroupId): Promise<void>;

  // 关联操作
  assignTagToGroup(tag: TagName, groupId: TagGroupId | null): Promise<void>;
  getItemsByTag(tag: TagName): Promise<string[]>;
  removeTagFromItem(itemId: string, tag: TagName): Promise<void>;
}

// Electron 实现
export class ElectronTagDataAccess implements TagDataAccess {
  private type: DataType;
  constructor(type: DataType) { this.type = type; }
  // 根据 type 调用对应的 electronAPI 方法
}

// 工厂函数
export function createDataAccess(type: DataType): TagDataAccess {
  return new ElectronTagDataAccess(type);
}
```

### 6.2 缓存策略

- 使用现有的 `CacheManager`
- 缓存键：`${type}Tags`, `${type}TagGroups`
- 写操作后自动清除缓存
- 读操作优先从缓存获取

### 6.3 错误处理

- 所有错误封装为自定义异常类，继承自 `TagOperationError`
- 提供具体异常类型：`TagExistsError`、`TagNotFoundError`、`InvalidTagNameError`、`ReservedTagError`
- 批量操作部分失败时返回 `errors` 数组（如 `deleteTags`）
- 严重错误和验证失败抛出异常，由调用方处理
- 库内部不直接调用日志 API，日志由调用方处理

### 6.4 批量操作优化

- 批量创建时先验证所有标签，再执行创建
- 使用 `Set` 去重
- 并行执行独立的创建操作

### 6.5 重构改进（相比旧代码）

#### 1. 数据访问层抽象

- **旧代码**: 直接调用 `window.electronAPI`，难以测试和替换数据源
- **新代码**: 通过 `TagDataAccess` 接口抽象，提供 `ElectronTagDataAccess` 实现
- **收益**: 便于单元测试（可 mock）、未来可替换为其他数据源（如 REST API、本地存储）

#### 2. 查询功能增强

- **旧代码**: 只能获取标签名数组
- **新代码**: 提供 `getAllTags()` 获取标签名称列表，`getTagsWithGroups()` 获取带组信息的标签，支持按名称或计数排序
- **收益**: 减少调用方处理逻辑，提升性能（一次查询获取完整信息）

#### 3. 标签删除关联清理

- **旧代码**: 删除标签时只删除标签本身，项目中仍保留对该标签的引用
- **新代码**: 删除标签时自动清理所有项目（prompts/images）中的标签引用
- **收益**: 保持数据一致性，避免脏数据

#### 4. 错误处理规范化

- **旧代码**: 错误处理分散，使用字符串错误码
- **新代码**: 统一使用自定义异常类（`TagExistsError`、`InvalidTagNameError` 等）
- **收益**: 调用方可精确捕获特定错误，提供针对性用户提示

#### 5. 日志与错误分离

- **旧代码**: 库内部直接调用 `window.electronAPI.logInfo`，耦合度高
- **新代码**: 库只抛异常，日志由调用方处理
- **收益**: 符合库设计原则，调用方控制日志策略

---

## 7. 使用示例

### 7.1 基础使用

```typescript
import { PyTagGroups } from './pyTagGroups';

// 获取实例
const lib = PyTagGroups.getInstance('prompt');

// 创建标签
const result = await lib.create(['tag1', 'tag2', 'tag3']);
console.log(result.created);  // 成功创建的标签
console.log(result.skipped);  // 已存在的标签
console.log(result.errors);   // 错误的标签

// 获取所有标签
const allTags = await lib.getAllTags();

// 搜索标签（自动完成）
const suggestions = await lib.search('ta');  // ['tag1', 'tag2', ...]
```

### 7.2 标签组操作

```typescript
// 创建组
const group = await lib.createGroup('我的组', 1);

// 将标签分配到组
await lib.assignToGroup('tag1', group.id);

// 获取所有组
const groups = await lib.getGroups();
```

### 7.3 工具函数

```typescript
// 解析输入
const tags = lib.parse('tag1, tag2, tag3');  // ['tag1', 'tag2', 'tag3']

```

---

## 8. 迁移计划

### 阶段 1：创建新库

1. 创建 `src/pyTagGroups/` 目录
2. 实现 `types.ts`、`utils.ts`、`validation.ts`
3. 实现 `operations.ts`（调用现有 electronAPI）
4. 实现 `PyTagGroups.ts` 主类
5. 实现 `index.ts` 统一入口
6. 编写单元测试

### 阶段 2：并行验证

1. 新库与旧代码并存
2. 在测试页面验证新库功能
3. 对比新旧库行为一致性
4. 修复发现的问题

### 阶段 3：逐步迁移

1. 迁移 `SimpleTagManager` 使用新库
2. 迁移 `TagManager` 使用新库
3. 迁移 `MultiSelectConfig` 使用新库
4. 迁移 `PanelManagerBase` 使用新库
5. 迁移 `TagAutocomplete` 使用新库

### 阶段 4：清理旧代码

1. 删除 `TagService.ts` 中的重复逻辑
2. 删除 `SimpleTagManager` 中的重复逻辑
3. 更新所有调用方
4. 运行完整测试套件

---

## 9. 测试策略

### 9.1 单元测试

所有测试文件位于 `tests/pyTagGroups/` 目录：

#### utils.test.ts - 工具函数测试

- `parseTagInput` - 解析逗号/空格分隔的标签输入
- `diffTags` - 计算标签数组差集
- `normalizeTag` - 标准化标签名（trim）
- `hasTag` - 检查标签是否存在
- `groupTagsByGroup` - 按组分组标签
- `buildTagsWithGroupInfo` - 构建带组信息的标签列表
- `sortTagsByCount` - 按使用计数排序
- `toTagObjects` - 转换为 Tag 对象数组
- `fromTagObjects` - 从 Tag 对象提取名称
- `filterNewTags` - 筛选新标签
- `filterExistingTags` - 筛选已存在标签

#### validation.test.ts - 验证函数测试

- `validateTagCreate` - 验证标签创建（空标签、保留标签、已存在）
- `validateTagDelete` - 验证标签删除（空标签、不存在）
- `validateTagRename` - 验证标签重命名（空名称、相同名称、已存在）
- `validateGroupName` - 验证组名称（空名称）
- `getReservedTags` - 获取保留标签
- `getAllReservedTags` - 获取所有保留标签

#### dataAccess.test.ts - 数据访问层测试

- `ElectronTagDataAccess` - Electron 数据访问实现
  - `getTags` - 获取标签（prompt/image）
  - `addTag` - 添加标签
  - `renameTag` - 重命名标签
  - `deleteTag` - 删除标签
  - `getTagGroups` - 获取标签组
  - `createTagGroup` - 创建标签组
  - `updateTagGroup` - 更新标签组
  - `deleteTagGroup` - 删除标签组
  - `assignTagToGroup` - 分配标签到组
  - `getItemsByTag` - 获取使用标签的项目
  - `removeTagFromItem` - 从项目移除标签
- `createDataAccess` - 工厂函数

#### operations.test.ts - 操作函数测试

- `getTags` - 获取标签（带缓存）
- `createTags` - 创建标签（单/批量、跳过已存在、分配到组）
- `renameTag` - 重命名标签（含错误处理）
- `deleteTags` - 删除标签（关联清理、错误收集）
- `assignTagToGroup` - 分配标签到组
- `getTagGroups` - 获取标签组
- `createTagGroup` - 创建标签组
- `updateTagGroup` - 更新标签组
- `deleteTagGroup` - 删除标签组

#### PyTagGroups.test.ts - 主库类测试

- `getInstance` - 单例模式（相同类型返回相同实例）
- `getAll` - 获取所有标签（含组信息、排序）
- `create` - 创建标签（单/批量、字符串解析）
- `search` - 搜索标签（前缀匹配、排除）
- `rename` - 重命名标签
- `delete` - 删除标签（单/批量、验证）
- `exists` - 检查标签存在
- `createGroup` - 创建标签组（默认排序）
- `getGroups` - 获取所有组
- `updateGroup` - 更新标签组
- `deleteGroup` - 删除标签组
- `assignToGroup` - 分配标签到组
- `parse` - 解析标签输入
- `diff` - 计算标签差集

#### TopGroupManager.test.ts - 首位组管理器测试

- `sortTagsWithGroupPriority` - 按组优先级排序标签
- `buildGroupMap` - 构建组映射
- `getNonEmptyGroups` - 获取非空组列表
- `getTopGroup` - 获取首位组
- `collectHeaderTags` - 收集头部标签

### 9.2 运行测试

```bash
# 运行所有 PyTagGroups 测试
npm run test -- tests/pyTagGroups/

# 运行测试并显示覆盖率
npm run test -- tests/pyTagGroups/ --coverage
```

### 9.3 集成测试

- 与现有 electronAPI 集成测试
- 与 CacheManager 集成测试
- 与 UI 组件集成测试

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 功能不一致 | 高 | 详细对比测试，逐步迁移 |
| 性能下降 | 中 | 保持缓存策略，批量优化 |
| 引入新 Bug | 中 | 完整测试覆盖，灰度发布 |
| 迁移成本高 | 低 | 分阶段迁移，保留旧代码作为兼容层 |

---

## 11. 附录

### 11.1 命名规范参考

- 目录名：`pyTagGroups`（camelCase）
- 类名：`PyTagGroups`（PascalCase）
- 函数名：`createTags`, `parseInput`（camelCase）
- 类型名：`TagName`, `TagGroup`（PascalCase）
- 常量：`RESERVED_TAGS`（UPPER_SNAKE_CASE）

### 11.2 相关文件

- 现有：`src/renderer/managers/TagService.ts`
- 现有：`src/renderer/managers/SimpleTagManager.ts`
- 现有：`src/renderer/managers/TagManager.ts`
- 现有：`src/renderer/config/MultiSelectConfig.ts`
- 现有：`src/renderer/managers/PanelManagerBase.ts`
- 现有：`src/renderer/services/TagAutocomplete.ts`

---

**文档版本**：v1.0  
**创建日期**：2026-04-12
**状态**：完成
