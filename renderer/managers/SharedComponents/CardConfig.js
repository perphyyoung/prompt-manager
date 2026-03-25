import { ButtonFactory } from './ButtonFactory.js';

/**
 * 卡片类型枚举
 */
export const CardType = {
  PROMPT_MAIN: 'prompt-main',
  IMAGE_MAIN: 'image-main',
  PROMPT_TRASH: 'prompt-trash',
  IMAGE_TRASH: 'image-trash'
};

/**
 * 统一卡片配置类
 * 4行布局：按钮(10%) | 内容(40%) | 标签(40%) | 信息(10%)
 */
export class CardConfig {
  constructor(options) {
    this.type = options.type;
    this.cssPrefix = options.cssPrefix || 'card';
    this.dataType = options.dataType;
    this.fields = {
      id: options.fields?.id || 'id',
      title: options.fields?.title || 'title',
      content: options.fields?.content || 'content',
      tags: options.fields?.tags || 'tags',
      isFavorite: options.fields?.isFavorite || 'isFavorite',
      updatedAt: options.fields?.updatedAt || 'updatedAt',
      createdAt: options.fields?.createdAt || 'createdAt',
      thumbnail: options.fields?.thumbnail || null,
      deletedAt: options.fields?.deletedAt || null,
      fileName: options.fields?.fileName || null,
      fileSize: options.fields?.fileSize || null,
      width: options.fields?.width || null,
      height: options.fields?.height || null,
      ...options.fields
    };
    this.buttons = {
      left: options.buttons?.left || [],
      right: options.buttons?.right || []
    };
  }

  getValue(item, fieldName) {
    const field = this.fields[fieldName];
    if (typeof field === 'function') {
      return field(item);
    }
    return item[field];
  }

  getContentText(item) {
    switch (this.dataType) {
      case 'prompt':
      case 'trash-prompt':
        return this.getValue(item, 'content');
      case 'image':
      case 'trash-image':
        const promptRef = item.promptRefs?.[0];
        if (promptRef) {
          return promptRef.promptContent || promptRef.promptTitle || '未关联提示词';
        }
        return '未关联提示词';
      default:
        return '';
    }
  }

  getFooterInfo(item, sortBy) {
    if (this.dataType.startsWith('trash')) {
      const deletedAt = this.getValue(item, 'deletedAt');
      // 如果 deletedAt 是字符串，直接展示；如果是时间戳，格式化展示
      const dateStr = typeof deletedAt === 'string'
        ? deletedAt
        : (deletedAt ? new Date(deletedAt).toLocaleDateString('zh-CN') : '-');
      return `删除于 ${dateStr}`;
    }

    switch (sortBy) {
      case 'updatedAt':
        const updatedAt = this.getValue(item, 'updatedAt');
        return `更新于 ${updatedAt ? new Date(updatedAt).toLocaleDateString('zh-CN') : '-'}`;
      case 'createdAt':
        const createdAt = this.getValue(item, 'createdAt');
        return `创建于 ${createdAt ? new Date(createdAt).toLocaleDateString('zh-CN') : '-'}`;
      case 'title':
        // 按标题排序时显示标题（仅提示词类型有标题）
        return this.getValue(item, 'title') || '无标题';
      case 'fileSize':
        const fileSize = this.getValue(item, 'fileSize');
        return fileSize ? this.formatFileSize(fileSize) : '';
      case 'width':
      case 'height':
        const width = this.getValue(item, 'width');
        const height = this.getValue(item, 'height');
        return `${width || '?'} x ${height || '?'}`;
      default:
        // 默认根据数据类型显示合适的信息
        if (this.dataType === 'prompt') {
          const defaultUpdatedAt = this.getValue(item, 'updatedAt');
          return `更新于 ${defaultUpdatedAt ? new Date(defaultUpdatedAt).toLocaleDateString('zh-CN') : '-'}`;
        }
        return this.getValue(item, 'fileName') || this.getValue(item, 'title') || '';
    }
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

export const PromptMainConfig = new CardConfig({
  type: CardType.PROMPT_MAIN,
  cssPrefix: 'prompt-card',
  dataType: 'prompt',
  fields: {
    id: 'id',
    title: 'title',
    content: 'content',
    tags: 'tags',
    isFavorite: 'isFavorite',
    updatedAt: 'updatedAt',
    createdAt: 'createdAt'
  },
  buttons: {
    left: [ButtonFactory.createFavoriteButton()],
    right: [
      ButtonFactory.createCopyButton(),
      ButtonFactory.createDeleteButton()
    ]
  }
});

export const ImageMainConfig = new CardConfig({
  type: CardType.IMAGE_MAIN,
  cssPrefix: 'image-card',
  dataType: 'image',
  fields: {
    id: 'id',
    tags: 'tags',
    isFavorite: 'isFavorite',
    updatedAt: 'updatedAt',
    createdAt: 'createdAt',
    fileName: 'fileName',
    fileSize: 'fileSize',
    width: 'width',
    height: 'height',
    thumbnail: 'thumbnailPath'
  },
  buttons: {
    left: [ButtonFactory.createFavoriteButton()],
    right: [ButtonFactory.createDeleteButton()]
  }
});

export const PromptTrashConfig = new CardConfig({
  type: CardType.PROMPT_TRASH,
  cssPrefix: 'trash-card',
  dataType: 'trash-prompt',
  fields: {
    id: 'id',
    content: 'content',
    tags: 'tags',
    deletedAt: 'deletedAt',
    thumbnail: (item) => item.images?.[0]?.thumbnailPath || null
  },
  buttons: {
    left: [ButtonFactory.createRestoreButton()],
    right: [ButtonFactory.createPermanentDeleteButton()]
  }
});

export const ImageTrashConfig = new CardConfig({
  type: CardType.IMAGE_TRASH,
  cssPrefix: 'trash-card',
  dataType: 'trash-image',
  fields: {
    id: 'id',
    tags: 'tags',
    deletedAt: 'deletedAt',
    thumbnail: 'thumbnailPath'
  },
  buttons: {
    left: [ButtonFactory.createRestoreButton()],
    right: [ButtonFactory.createPermanentDeleteButton()]
  }
});
