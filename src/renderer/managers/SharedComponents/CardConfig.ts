import { ButtonFactory, ButtonConfig } from './ButtonFactory.ts';
import { Constants } from '../../../constants.ts';

/**
 * 卡片类型枚举
 */
export const CardType = {
  PROMPT_MAIN: 'prompt-main',
  IMAGE_MAIN: 'image-main',
  PROMPT_TRASH: Constants.TrashType.PROMPT,
  IMAGE_TRASH: Constants.TrashType.IMAGE
} as const;

export type CardTypeValue = typeof CardType[keyof typeof CardType];

/**
 * 主卡片按钮配置
 */
const CARD_MAIN_BUTTONS = {
  left: [
    ButtonFactory.createCheckboxButton(),
    ButtonFactory.createFavoriteButton()
  ],
  right: [
    ButtonFactory.createCopyButton(),
    ButtonFactory.createDeleteButton()
  ]
};

export interface CardFields {
  id?: string;
  title?: string;
  content?: string;
  tags?: string;
  isFavorite?: string;
  updatedAt?: string;
  createdAt?: string;
  thumbnail?: string | ((item: Record<string, unknown>) => string | null) | null;
  deletedAt?: string | null;
  fileName?: string | null;
  fileSize?: string | null;
  width?: string | null;
  height?: string | null;
  [key: string]: unknown;
}

export interface CardButtons {
  left: ButtonConfig[];
  right: ButtonConfig[];
}

export interface CardConfigOptions {
  type: CardTypeValue;
  cssPrefix?: string;
  dataType: string;
  fields?: CardFields;
  buttons?: CardButtons;
}

interface PromptRef {
  promptContent?: string;
  promptTitle?: string;
}

/**
 * 统一卡片配置类
 * 4行布局：按钮(10%) | 内容(40%) | 标签(40%) | 信息(10%)
 */
export class CardConfig {
  type: CardTypeValue;
  cssPrefix: string;
  dataType: string;
  fields: CardFields;
  buttons: CardButtons;

  constructor(options: CardConfigOptions) {
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

  getValue(item: Record<string, unknown>, fieldName: keyof CardFields): unknown {
    const field = this.fields[fieldName];
    if (typeof field === 'function') {
      return field(item);
    }
    return item[field as string];
  }

  getContentText(item: Record<string, unknown>): string {
    switch (this.dataType) {
      case 'prompt':
      case Constants.TrashType.PROMPT:
        return String(this.getValue(item, 'content') || '');
      case 'image':
      case Constants.TrashType.IMAGE: {
        const itemWithRefs = item as { promptRefs?: PromptRef[] };
        const promptRef = itemWithRefs.promptRefs?.[0];
        if (promptRef) {
          return promptRef.promptContent || promptRef.promptTitle || '未关联提示词';
        }
        return '未关联提示词';
      }
      default:
        return '';
    }
  }

  getFooterInfo(item: Record<string, unknown>, sortBy: string): string {
    if (this.dataType.startsWith('trash')) {
      const deletedAt = this.getValue(item, 'deletedAt');
      // 如果 deletedAt 是字符串，直接展示；如果是时间戳，格式化展示
      const dateStr = typeof deletedAt === 'string'
        ? deletedAt
        : (deletedAt ? new Date(Number(deletedAt)).toLocaleDateString('zh-CN') : '-');
      return `删除于 ${dateStr}`;
    }

    switch (sortBy) {
      case 'updatedAt': {
        const updatedAt = this.getValue(item, 'updatedAt');
        return `更新于 ${updatedAt ? new Date(Number(updatedAt)).toLocaleDateString('zh-CN') : '-'}`;
      }
      case 'createdAt': {
        const createdAt = this.getValue(item, 'createdAt');
        return `创建于 ${createdAt ? new Date(Number(createdAt)).toLocaleDateString('zh-CN') : '-'}`;
      }
      case 'title':
        // 按标题排序时显示标题（仅提示词类型有标题）
        return String(this.getValue(item, 'title') || '无标题');
      case 'fileSize': {
        const fileSize = this.getValue(item, 'fileSize');
        return fileSize ? this.formatFileSize(Number(fileSize)) : '';
      }
      case 'width':
      case 'height': {
        const width = this.getValue(item, 'width');
        const height = this.getValue(item, 'height');
        return `${width || '?'} x ${height || '?'}`;
      }
      default:
        // 默认根据数据类型显示合适的信息
        if (this.dataType === 'prompt') {
          const defaultUpdatedAt = this.getValue(item, 'updatedAt');
          return `更新于 ${defaultUpdatedAt ? new Date(Number(defaultUpdatedAt)).toLocaleDateString('zh-CN') : '-'}`;
        }
        return String(this.getValue(item, 'fileName') || this.getValue(item, 'title') || '');
    }
  }

  formatFileSize(bytes: number): string {
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
  buttons: CARD_MAIN_BUTTONS
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
  buttons: CARD_MAIN_BUTTONS
});

export const PromptTrashConfig = new CardConfig({
  type: CardType.PROMPT_TRASH,
  cssPrefix: 'trash-card',
  dataType: Constants.TrashType.PROMPT,
  fields: {
    id: 'id',
    content: 'content',
    tags: 'tags',
    deletedAt: 'deletedAt',
    thumbnail: (item: Record<string, unknown>) => {
      const itemWithImages = item as { images?: Array<{ thumbnailPath?: string }> };
      return itemWithImages.images?.[0]?.thumbnailPath || null;
    }
  },
  buttons: {
    left: [ButtonFactory.createRestoreButton()],
    right: [ButtonFactory.createPermanentDeleteButton()]
  }
});

export const ImageTrashConfig = new CardConfig({
  type: CardType.IMAGE_TRASH,
  cssPrefix: 'trash-card',
  dataType: Constants.TrashType.IMAGE,
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
