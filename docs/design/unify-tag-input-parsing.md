# 标签输入解析逻辑统一重构方案

## 重构原则

1. **单一入口**：所有标签输入解析必须通过 `TagService.parseTagInput()`
2. **禁止绕过**：业务代码禁止直接调用 `pyTagGroups`，必须通过 `TagService` 中间层
3. **统一方法**：3个入口使用同一个方法

## 当前问题分析

### 三处入口现状

| 入口 | 文件 | 当前实现 | 问题 |
|------|------|----------|------|
| 标签管理界面 | `TagManager.ts` | 调用 `tagService.createTags()`，传入原始字符串 | `createTags` 内部没有调用 `parseTagInput` |
| 详情界面 | `TagAutocomplete.ts` | 自己实现 `split(/[,，\s]+/)` | 重复实现，且绕过 TagService |
| 主界面批量添加 | `MultiSelectConfig.ts` | 直接 `import { parseTagInput } from '../../pyTagGroups'` | 绕过 TagService 中间层 |

### 核心问题

1. `TagService.createTags()` 接收字符串时，内部没有调用 `parseTagInput()`
2. `MultiSelectConfig.ts` 直接导入 `pyTagGroups` 的 `parseTagInput`，绕过中间层
3. `TagAutocomplete.ts` 自己实现解析逻辑

## 重构方案

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        业务层                                │
├─────────────────┬─────────────────┬─────────────────────────┤
│  TagManager.ts  │TagAutocomplete.ts│  MultiSelectConfig.ts  │
│  (标签管理界面)  │  (详情界面)      │   (主界面批量添加)      │
└────────┬────────┴────────┬────────┴───────────┬─────────────┘
         │                 │                    │
         └─────────────────┼────────────────────┘
                           ▼
              ┌──────────────────────┐
              │    TagService        │  ← 中间层，唯一入口
              │  - parseTagInput()   │
              │  - createTags()      │
              │  - linkTagsToItem()  │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │    pyTagGroups       │  ← 数据层
              │  - parseTagInput()   │
              │  - createTags()      │
              └──────────────────────┘
```

### 修改点 1：TagService 增强

修改 `TagService` 的 `createTags()`、`removeTags()` 和 `linkTagsToItem()` 方法，在接收字符串时自动解析：

```typescript
// src/renderer/services/TagService.ts

/**
 * 解析并标准化标签输入
 * @param tagNames - 标签输入（字符串或数组）
 * @returns 标准化后的标签名数组
 */
private parseAndNormalizeTagNames(tagNames: string | string[]): string[] {
  // 1. 如果是字符串，使用 parseTagInput 解析
  const names = typeof tagNames === 'string' 
    ? parseTagInput(tagNames)
    : tagNames;
  
  // 2. 标准化处理
  return names
    .map(n => n.trim())
    .filter(n => n.length > 0);
}

/**
 * 创建标签（支持字符串输入，自动解析）
 */
async createTags(options: CreateTagsOptions): Promise<TagOperationResult> {
  const { tagNames, type, defaultGroupId } = options;
  
  // 统一解析和标准化
  const names = this.parseAndNormalizeTagNames(tagNames);

  if (names.length === 0) {
    return { success: true, created: [], skipped: [], errors: [] };
  }

  const createOptions: TagCreateOptions = {};
  if (defaultGroupId !== undefined) {
    createOptions.defaultGroupId = defaultGroupId;
  }

  const result = await createTags(type, names, createOptions);

  if (result.created.length > 0 || result.errors.length > 0) {
    this.emitItemsChanged(type);
  }

  return result;
}

/**
 * 关联标签到项目（支持字符串输入，自动解析）
 */
async linkTagsToItem(options: LinkTagsOptions): Promise<LinkTagsResult> {
  const { tagNames, type, itemId, itemIds } = options;

  // 统一解析和标准化
  const names = this.parseAndNormalizeTagNames(tagNames);
  
  if (names.length === 0) {
    return {
      success: true,
      created: [],
      skipped: [],
      errors: [],
      linkedToItem: false,
      linkedItemCount: 0
    };
  }

  // 合并项目ID
  const targetIds: string[] = [];
  if (itemId) targetIds.push(itemId);
  if (itemIds) targetIds.push(...itemIds);
  const uniqueIds = [...new Set(targetIds)];

  const linkResult = await linkTags({
    tagNames: names,
    type,
    itemIds: uniqueIds.length > 0 ? uniqueIds : undefined
  });

  if (linkResult.success) {
    this.emitItemsChanged(type);
  }

  return {
    ...linkResult,
    linkedToItem: uniqueIds.length > 0,
    linkedItemCount: uniqueIds.length
  };
}

/**
 * 解析标签输入（对外暴露的统一入口）
 * @param input - 输入字符串
 * @returns 标签名数组
 */
parseTagInput(input: string): string[] {
  return parseTagInput(input);
}
```

### 修改点 2：MultiSelectConfig.ts

禁止直接调用 `pyTagGroups`，改为使用 `TagService.parseTagInput()`：

```typescript
// src/renderer/config/MultiSelectConfig.ts

// ❌ 删除这行
// import { parseTagInput } from '../../pyTagGroups/index.ts';

// ✅ 改为从 TagService 导入
import { TagService } from '../services/index.ts';

async function processBatchAddTags(
  ids: string[],
  tagInput: string,
  options: BatchAddTagsOptions
): Promise<void> {
  const { type } = options;

  // ✅ 使用 TagService 的 parseTagInput
  const tagService = TagService.getInstance();
  const tagNames = tagService.parseTagInput(tagInput);
  
  if (tagNames.length === 0) return;

  // 使用 TagService 统一处理创建和关联
  const result = await tagService.batchLinkTags({
    tagNames,
    type,
    itemIds: ids
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors.map((e: { error: string }) => e.error).join(', '));
  }
}
```

### 修改点 3：TagAutocomplete.ts

删除重复实现，使用 `TagService.parseTagInput()`：

```typescript
// src/renderer/services/TagAutocomplete.ts

// ❌ 删除重复的标签解析逻辑
// const tags = value
//   .split(/[,，\s]+/)
//   .map(t => t.trim())
//   .filter(t => t);

// ✅ 使用 TagService 的 parseTagInput
private async handleBatchAdd(): Promise<void> {
  if (!this.input) return;

  const value = this.input.value.trim();
  if (!value) return;

  // 使用 TagService 统一解析
  const tags = this.tagService.parseTagInput(value);

  if (tags.length === 0) return;

  const result = await this.onBatchAdd?.(tags);

  if (result !== false) {
    this.input.value = '';
    this.hideDropdown();
  }
}
```

### 修改点 4：TagManager.ts（可选优化）

当前 `TagManager` 调用 `tagService.createTags()` 时传入原始字符串，由于 `createTags` 已增强，无需修改即可支持。但为了代码清晰，可以显式调用 `parseTagInput`：

```typescript
// src/renderer/managers/TagManager.ts
// addTagInManagerWithDialog 方法（可选优化）

// 当前代码（无需修改，因为 createTags 已支持字符串解析）：
const creationResult = await this.tagService.createTags({
  tagNames: result.value,  // 传入原始字符串
  type: this.getDataType(),
  defaultGroupId: result.groupId ?? null
});
```

## 统一后的调用链

| 入口 | 修改后调用链 |
|------|-------------|
| 标签管理界面 | `TagManager.addTagInManagerWithDialog()` → `TagService.createTags()` → `parseTagInput()` |
| 详情界面 | `TagAutocomplete.handleBatchAdd()` → `TagService.parseTagInput()` → `TagService.linkTagsToItem()` |
| 主界面批量添加 | `MultiSelectConfig.processBatchAddTags()` → `TagService.parseTagInput()` → `TagService.batchLinkTags()` |

## 实施步骤

### 步骤 1：修改 TagService.ts

1. 添加 `parseAndNormalizeTagNames()` 私有方法
2. 修改 `createTags()` 使用新方法
3. 修改 `removeTags()` 使用新方法
4. 修改 `linkTagsToItem()` 使用新方法

### 步骤 2：修改 MultiSelectConfig.ts

1. 删除 `import { parseTagInput } from '../../pyTagGroups/index.ts'`
2. 在 `processBatchAddTags` 中使用 `TagService.parseTagInput()`

### 步骤 3：修改 TagAutocomplete.ts

1. 修改 `handleBatchAdd()` 使用 `this.tagService.parseTagInput(value)`

### 步骤 4：验证测试

```bash
# 运行单元测试
npm test -- tests/services/TagService.test.ts
npm test -- tests/pyTagGroups/utils.test.ts

# 运行 E2E 测试
npx playwright test e2e/13-tag-input-methods.spec.ts
npx playwright test e2e/15-tagservice-advanced.spec.ts
```

## 风险评估

| 风险点 | 等级 | 说明 |
|--------|------|------|
| TagService.createTags 行为变化 | 低 | 向后兼容，字符串和数组都支持 |
| TagService.linkTagsToItem 行为变化 | 低 | 向后兼容，字符串和数组都支持 |
| MultiSelectConfig 导入变化 | 低 | 功能不变，只是更换调用方式 |
| TagAutocomplete 解析逻辑变化 | 低 | 使用相同正则，行为一致 |

## 代码变更统计

| 文件 | 变更类型 | 变更内容 |
|------|----------|----------|
| `TagService.ts` | 修改 | 添加 `parseAndNormalizeTagNames`，修改 `createTags`、`removeTags` 和 `linkTagsToItem` |
| `MultiSelectConfig.ts` | 修改 | 删除 pyTagGroups 导入，使用 TagService.parseTagInput |
| `TagAutocomplete.ts` | 修改 | 使用 TagService.parseTagInput 替代手动 split |
| `TagManager.ts` | 无修改 | 无需修改，createTags 已支持字符串解析 |

## 最终架构

所有标签输入解析都通过 `TagService.parseTagInput()` 这一个入口，业务代码不再直接依赖 `pyTagGroups`。
