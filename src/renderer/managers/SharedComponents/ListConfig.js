import { ButtonFactory } from './ButtonFactory.js';

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
 * 共用标准布局
 */
const STANDARD_LAYOUT = [
  { component: 'checkbox' },
  { component: 'thumbnail', placeholder: true },
  {
    component: 'text-content',
    children: [
      { component: 'header' },
      { component: 'content' },
      { component: 'note', condition: (item) => item.note }
    ]
  },
  { component: 'actions' }
];

/**
 * 共用紧凑布局
 */
const COMPACT_LAYOUT = [
  { component: 'checkbox' },
  { component: 'thumbnail', placeholder: true },
  {
    component: 'text-content',
    children: [{ component: 'header' }]
  },
  { component: 'actions' }
];

/**
 * 统一列表配置类
 * 使用BEM命名规范，完全配置驱动
 */
export class ListConfig {
  constructor(options) {
    this.type = options.type;
    this.dataType = options.dataType;
    this.itemType = options.itemType || 'item';

    // BEM基础类名
    this.blockClass = 'list-item';
    this.modifierClass = options.modifierClass || '';

    // 字段配置
    this.fields = {
      id: options.fields?.id || 'id',
      title: options.fields?.title || 'title',
      content: options.fields?.content || 'content',
      tags: options.fields?.tags || 'tags',
      isFavorite: options.fields?.isFavorite || 'isFavorite',
      thumbnail: options.fields?.thumbnail || null,
      note: options.fields?.note || null,
      ...options.fields
    };

    // 布局配置
    this.layout = {
      standard: options.layout?.standard || STANDARD_LAYOUT,
      compact: options.layout?.compact || COMPACT_LAYOUT
    };

    // 按钮配置
    this.buttons = options.buttons || LIST_MAIN_BUTTONS;

    // 缩略图渲染配置
    this.thumbnailConfig = {
      useWrapper: options.thumbnailConfig?.useWrapper ?? false,
      ...options.thumbnailConfig
    };

    this.supportSelection = options.supportSelection ?? true;
  }

  /**
   * 获取BEM类名
   * element: 元素名（可选）
   * modifier: 修饰符（可选）
   */
  getClassName(element, modifier) {
    let className = this.blockClass;

    if (this.modifierClass) {
      className += ` ${this.blockClass}--${this.modifierClass}`;
    }

    if (element) {
      className += ` ${this.blockClass}__${element}`;
    }

    if (modifier) {
      className += ` ${this.blockClass}__${element}--${modifier}`;
    }

    return className.trim();
  }

  /**
   * 获取元素基础类名（不含修饰符）
   */
  getElementClass(element) {
    return `${this.blockClass}__${element}`;
  }

  /**
   * 获取字段值
   */
  getValue(item, fieldName) {
    const field = this.fields[fieldName];
    if (typeof field === 'function') return field(item);
    return item[field];
  }

  /**
   * 获取标题
   */
  getTitle(item) {
    return this.getValue(item, 'title') || '无标题';
  }

  /**
   * 获取内容
   */
  getContent(item) {
    return this.getValue(item, 'content') || '';
  }

  /**
   * 获取缩略图
   */
  getThumbnail(item) {
    return this.getValue(item, 'thumbnail');
  }

  /**
   * 获取标签数组
   */
  getTags(item) {
    return item[this.fields.tags] || [];
  }

  /**
   * 获取复选框 data 属性
   */
  getCheckboxDataAttrs(item, index) {
    return `data-id="${item.id}" data-index="${index}"`;
  }

  /**
   * 获取布局配置
   */
  getLayout(isCompact) {
    return isCompact ? this.layout.compact : this.layout.standard;
  }

  /**
   * 获取按钮配置
   */
  getButtons() {
    return this.buttons;
  }
}

/**
 * 列表按钮配置
 */
const LIST_MAIN_BUTTONS = [
  ButtonFactory.createCopyButton(),
  ButtonFactory.createFavoriteButton(),
  ButtonFactory.createDeleteButton()
];

/**
 * 提示词列表配置
 */
export const PromptListConfig = new ListConfig({
  type: ListViewType.PROMPT_LIST,
  dataType: 'prompt',
  itemType: 'prompt',
  modifierClass: 'prompt',
  thumbnailConfig: { useWrapper: false },
  fields: {
    id: 'id',
    title: 'title',
    content: 'content',
    tags: 'tags',
    isFavorite: 'isFavorite',
    note: 'note',
    thumbnail: (prompt) => prompt.images?.[0]?.thumbnailPath || null
  },
  buttons: LIST_MAIN_BUTTONS
});

/**
 * 图像列表配置
 */
export const ImageListConfig = new ListConfig({
  type: ListViewType.IMAGE_LIST,
  dataType: 'image',
  itemType: 'image',
  modifierClass: 'image',
  thumbnailConfig: { useWrapper: true },
  fields: {
    id: 'id',
    title: (img) => img.fileName || '无标题',
    content: (img) => img.promptRefs?.[0]?.promptContent || '',
    tags: 'tags',
    isFavorite: 'isFavorite',
    thumbnail: 'thumbnailPath',
    note: 'note'
  },
  buttons: LIST_MAIN_BUTTONS
});
