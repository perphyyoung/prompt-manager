# 接口契约文档 - 标签及标签组

> 文档版本：5.0
> 最后更新：2026-03-25

***

## 核心架构

```
业务层 (TagRegistry, SimpleTagManager, PanelManagerBase)
    ↓ 使用单例
数据层 + 验证层 + 工具层 (TagService)
    ↓ 调用
预加载层 (electronAPI)
```

***

## 数据格式

### 标签组格式

```javascript
interface TagGroup {
  id: string;             // 组 ID
  name: string;           // 组名称
  tags: string[];         // 该组下的标签名称列表
  sortOrder: number;      // 排序顺序
}
```

**示例**:
```javascript
[
  { id: '1', name: '类型', tags: ['风景', '人物', '动物'], sortOrder: 1 },
  { id: '2', name: '评级', tags: ['安全', '一般', '敏感'], sortOrder: 2 }
]
```

***

## TagService - 统一数据入口

### 获取实例（单例模式）

```javascript
import { TagService } from './managers/TagService.js';

const tagService = TagService.getInstance('image');  // 'image' | 'prompt'
```

### 核心 API

| 方法 | 功能 | 参数 | 返回 |
|------|------|------|------|
| `getTags()` | 获取所有标签 | 无 | `Promise<string[]>` |
| `getTagGroups()` | 获取标签组（含标签列表） | 无 | `Promise<TagGroup[]>` |
| `addTag(tag)` | 添加标签 | `tag: string` | `Promise<Object>` |
| `renameTag(oldTag, newTag)` | 重命名标签 | `oldTag: string, newTag: string` | `Promise<Object>` |
| `deleteTag(tag)` | 删除标签 | `tag: string` | `Promise<Object>` |
| `validateTagAddition(currentTags, newTag)` | 验证标签添加 | `currentTags: string[], newTag: string` | `Promise<ValidateResult>` |
| `validateTagRemoval(currentTags, tagToRemove)` | 验证标签删除 | `currentTags: string[], tagToRemove: string` | `Promise<ValidateResult>` |
| `groupTagsByGroup(tags, groups)` | 标签分组 | `tags: string[], groups: TagGroup[]` | `{ groupedTags, ungroupedTags }` |
| `buildTagsWithGroup(tags, groups)` | 构建标签与组映射 | `tags: string[], groups: TagGroup[]` | `Array<TagWithGroup>` |

### 验证结果格式

```javascript
// validateTagAddition 返回
{
  valid: boolean;          // 是否验证通过
  error?: string;          // 错误信息
  newTags?: string[];      // 更新后的标签列表
}

// validateTagRemoval 返回
{
  valid: boolean;
  error?: string;
  newTags?: string[];
}
```

### 使用示例

```javascript
// 获取标签和标签组
const tags = await tagService.getTags();
const groups = await tagService.getTagGroups();

// 验证并添加标签
const result = await tagService.validateTagAddition(currentTags, newTag);
if (result.valid) {
  await tagService.addTag(newTag);
}

// 标签分组
const { groupedTags, ungroupedTags } = tagService.groupTagsByGroup(tags, groups);

// 构建带组信息的标签列表
const tagsWithGroup = tagService.buildTagsWithGroup(tags, groups);
// 返回格式：[{ name, groupId, groupName }, ...]
```

***

## 缓存机制

TagService 使用 CacheManager 自动缓存数据：

- **缓存键**: `promptTags`, `imageTags`, `promptTagGroups`, `imageTagGroups`
- **缓存有效期**: 30 秒
- **自动清除**: 添加、删除、修改标签后自动清除对应缓存

```javascript
// TagService 内部自动处理缓存，无需手动管理
const tags = await tagService.getTags();  // 优先从缓存读取
```

***

## 预加载层 API

| API | 功能 | 返回格式 |
|-----|------|----------|
| `getPromptTagGroups()` | 获取提示词标签组 | `[{id, name, sortOrder, tags: []}]` |
| `getImageTagGroups()` | 获取图像标签组 | `[{id, name, sortOrder, tags: []}]` |
| `getPromptTags()` | 获取所有提示词标签 | `string[]` |
| `getImageTags()` | 获取所有图像标签 | `string[]` |
| `addPromptTag(tag)` | 添加提示词标签 | `Object` |
| `addImageTag(tag)` | 添加图像标签 | `Object` |
| `createPromptTagGroup(name, sortOrder)` | 创建提示词标签组 | `TagGroup` |
| `createImageTagGroup(name, sortOrder)` | 创建图像标签组 | `TagGroup` |
| `updatePromptTagGroupAttrs(id, attrs)` | 更新提示词标签组属性 | `number` (影响行数) |
| `updateImageTagGroupAttrs(id, attrs)` | 更新图像标签组属性 | `number` |
| `deletePromptTagGroup(id)` | 删除提示词标签组 | `number` |
| `deleteImageTagGroup(id)` | 删除图像标签组 | `number` |

***

## 特殊标签常量

```javascript
import { Constants } from './constants.js';

// 图像特殊标签
Constants.IMAGE_SPECIAL_TAGS  
// ['收藏', '未引', '多引', '无标']

// 提示词特殊标签
Constants.PROMPT_SPECIAL_TAGS  
// ['收藏', '多图', '无图', '无标', '安全', '不安全']
```

***

## 业务层组件

### TagRegistry - 全局标签管理

```javascript
import { TagRegistry } from './managers/TagRegistry.js';

const registry = new TagRegistry('image', appContext);
await registry.render();  // 渲染标签注册表
```

### SimpleTagManager - 单项标签管理

```javascript
import { SimpleTagManager } from './managers/SimpleTagManager.js';

const manager = new SimpleTagManager({
  type: 'image',
  onSave: async (tags) => { /* 保存逻辑 */ },
  onRender: (tags) => { /* 渲染逻辑 */ }
});

await manager.addTag('新标签');
await manager.removeTag('旧标签');
```

***

## 变更记录

### v5.0 (2026-03-25)
- 删除标签组的 `type` 字段（不再区分单选/多选）
- 删除违单标签相关逻辑
- 简化验证逻辑，移除单选组冲突检查

### v4.0 (2026-03-25)
- 重构为 TagService 统一入口（单例模式）
- 合并 TagValidationService 和 tagUtils.js 到 TagService
- 简化文档，只保留核心功能说明

### v3.0 (2026-03-25)
- `getPromptTagGroups()` / `getImageTagGroups()` 返回带标签列表的数据
- 添加缓存机制

### v2.0 (2026-03-25)
- 添加 TagValidationService 使用说明

### v1.0
- 初始版本
