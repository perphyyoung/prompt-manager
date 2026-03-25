/**
 * 列表视图类型枚举
 */
export const ListViewType = {
  PROMPT_LIST: 'prompt-list',
  PROMPT_COMPACT: 'prompt-compact',
  IMAGE_LIST: 'image-list',
  IMAGE_COMPACT: 'image-compact'
};

/**
 * 统一列表配置类
 */
export class ListConfig {
  constructor(options) {
    this.type = options.type;
    this.cssPrefix = options.cssPrefix || 'list-item';
    this.dataType = options.dataType;

    this.fields = {
      id: options.fields?.id || 'id',
      title: options.fields?.title || 'title',
      content: options.fields?.content || 'content',
      tags: options.fields?.tags || 'tags',
      isFavorite: options.fields?.isFavorite || 'isFavorite',
      thumbnail: options.fields?.thumbnail || null,
      ...options.fields
    };

    this.layout = {
      standard: options.layout?.standard || ['thumbnail', 'header', 'content', 'actions'],
      compact: options.layout?.compact || ['thumbnail', 'header', 'actions']
    };

    this.buttons = options.buttons || {
      standard: { left: [], right: [] },
      compact: { left: [], right: [] }
    };

    this.supportSelection = options.supportSelection ?? true;
  }

  getValue(item, fieldName) {
    const field = this.fields[fieldName];
    if (typeof field === 'function') return field(item);
    return item[field];
  }

  getTitle(item) {
    return this.getValue(item, 'title') || '无标题';
  }

  getContent(item) {
    if (this.dataType === 'prompt') {
      return this.getValue(item, 'content');
    }
    const promptRef = item.promptRefs?.[0];
    return promptRef?.promptContent || promptRef?.promptTitle || '未关联提示词';
  }

  getThumbnail(item) {
    return this.getValue(item, 'thumbnail');
  }
}

/**
 * 提示词列表配置
 */
export const PromptListConfig = new ListConfig({
  type: ListViewType.PROMPT_LIST,
  cssPrefix: 'prompt-list-item',
  dataType: 'prompt',
  fields: {
    id: 'id',
    title: 'title',
    content: 'content',
    tags: 'tags',
    isFavorite: 'isFavorite',
    thumbnail: (prompt) => prompt.images?.[0]?.thumbnailPath || null
  },
  layout: {
    standard: ['checkbox', 'thumbnail', 'header', 'content', 'note', 'actions'],
    compact: ['checkbox', 'thumbnail', 'header', 'actions']
  },
  buttons: {
    standard: {
      right: [
        { type: 'copy', action: 'copy', title: '复制' },
        { type: 'favorite', action: 'toggleFavorite', title: '收藏' },
        { type: 'delete', action: 'delete', title: '删除' }
      ]
    },
    compact: {
      right: [
        { type: 'favorite', action: 'toggleFavorite', title: '收藏' },
        { type: 'delete', action: 'delete', title: '删除' }
      ]
    }
  }
});

/**
 * 图像列表配置
 */
export const ImageListConfig = new ListConfig({
  type: ListViewType.IMAGE_LIST,
  cssPrefix: 'image-list-item',
  dataType: 'image',
  fields: {
    id: 'id',
    title: (img) => img.fileName || '无标题',
    tags: 'tags',
    isFavorite: 'isFavorite',
    thumbnail: 'thumbnailPath',
    width: 'width',
    height: 'height'
  },
  layout: {
    standard: ['checkbox', 'thumbnail', 'header', 'content', 'meta', 'actions'],
    compact: ['checkbox', 'thumbnail', 'header', 'actions']
  },
  buttons: {
    standard: {
      right: [
        { type: 'favorite', action: 'toggleFavorite', title: '收藏' },
        { type: 'delete', action: 'delete', title: '删除' }
      ]
    },
    compact: {
      right: [
        { type: 'favorite', action: 'toggleFavorite', title: '收藏' },
        { type: 'delete', action: 'delete', title: '删除' }
      ]
    }
  }
});
