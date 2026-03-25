# 接口契约文档 - 回收站

> 文档版本：1.0\
> 最后更新：2026-03-24

***

## 图像回收站-加载卡片

### 必需字段

| 字段            | 类型              | 说明            |
| --------------- | --------------- | ------------- |
| `id`            | `string`        | 图像唯一标识        |
| `type`          | `'trash-image'` | 数据类型标识（后端返回） |
| `thumbnailPath` | `string`        | 缩略图文件路径（相对路径） |
| `deletedAt`     | `string`        | 删除时间          |
| `tags`          | `string[]`      | 图像标签列表        |
| `promptRefs`    | `array`         | 关联提示词数组       |

> **类型说明**：
> - 加载卡片时：`type = 'trash-image'`（后端返回的数据类型）
> - 恢复操作时：内部使用 `'recycle-image'`（类型转换器期望的类型）

### 数据获取

```javascript
const items = await window.electronAPI.getImageTrash();
// 返回的数据结构
interface ImageTrashItem {
  id: string;                    // 图像唯一标识
  type: 'trash-image';           // 固定值
  thumbnailPath: string;         // 缩略图文件路径（相对路径）
  deletedAt: string;             // 删除时间
  tags: string[];                // 图像标签列表
  promptRefs: {                  // 关联提示词数组（可能为空）
    promptId: string;            // 提示词ID
    promptTitle: string;         // 提示词标题
    promptContent: string;       // 提示词内容
  }[];
}
```

> **注意**：`promptRefs` 数组可能为空（如果图像没有关联提示词）

### 字段转换示例

```javascript
async function transformToCardData(item) {
  // 取第一个关联提示词（如果有）
  const promptRef = item.promptRefs?.[0];
  return {
    // 必需字段：id
    id: item.id,
    // 必需字段：type
    type: item.type,
    // 必需字段：thumbnailPath → 转换为完整 URL
    thumbnailUrl: await window.electronAPI.getImagePath(item.thumbnailPath),
    // 必需字段：deletedAt → 转换为页脚文本
    footerText: `删除于 ${item.deletedAt}`,
    // 必需字段：content → 从 promptRefs 提取
    content: promptRef?.promptContent || 
             promptRef?.promptTitle || 
             '未关联提示词',
    // 必需字段：tags → 转换为 HTML
    tagsHtml: item.tags.map(tag => 
      `<span class="tag">${tag}</span>`
    ).join('')
  };
}
```

## 提示词回收站-加载卡片

### 必需字段

| 字段            | 类型               | 说明            |
| --------------- | ---------------- | ------------- |
| `id`            | `string`         | 提示词唯一标识       |
| `type`          | `'trash-prompt'` | 固定值           |
| `thumbnailPath` | `string \| null` | 第一个关联图像的缩略图路径 |
| `deletedAt`     | `string`         | 删除时间          |
| `content`       | `string`         | 提示词内容         |
| `tags`          | `string[]`       | 提示词标签列表       |

### 数据获取

```javascript
const items = await window.electronAPI.getPromptTrash();
// 返回的数据结构
interface PromptTrashItem {
  id: string;                    // 提示词唯一标识
  type: 'trash-prompt';          // 固定值
  content: string;               // 提示词内容
  deletedAt: string;             // 删除时间
  tags: string[];                // 提示词标签列表
  images: {                      // 关联图像数组（可能为空）
    id: string;                  // 图像ID
    thumbnailPath: string;       // 缩略图路径
    fileName?: string;           // 文件名
    relativePath?: string;       // 相对路径
  }[];
}
```

> **注意**：`images` 数组可能为空（如果提示词没有关联图像）

### 字段转换示例

```javascript
async function transformToCardData(item) {
  // 取第一个关联图像（如果有）
  const firstImage = item.images?.[0];
  return {
    // 必需字段：id
    id: item.id,
    // 必需字段：type
    type: item.type,
    // 必需字段：thumbnailPath → 从 images 提取并转换
    thumbnailUrl: firstImage 
      ? await window.electronAPI.getImagePath(firstImage.thumbnailPath)
      : null,
    // 必需字段：deletedAt → 转换为页脚文本
    footerText: `删除于 ${item.deletedAt}`,
    // 必需字段：content
    content: item.content,
    // 必需字段：tags → 转换为 HTML
    tagsHtml: item.tags.map(tag => 
      `<span class="tag">${tag}</span>`
    ).join('')
  };
}
```
