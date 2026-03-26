import { TagUI } from '../index.js';
import { HtmlUtils } from '../../../utils/index.js';
import { createListButtonHtml } from './ButtonFactory.js';

/**
 * 统一列表渲染器
 * 使用BEM命名规范，完全配置驱动
 */
export class UnifiedListRenderer {
  /**
   * 渲染列表项
   * @param {ListConfig} config - 列表配置
   * @param {Object} item - 数据项
   * @param {Object} context - 上下文
   * @returns {string} HTML字符串
   */
  static render(config, item, context) {
    const { isCompact } = context;
    const layout = config.getLayout(isCompact);

    // 获取项目 CSS 类
    const itemClasses = this.getItemClasses(config, item, context, isCompact);

    // 获取 data 属性
    const dataAttrs = this.getDataAttrs(config, item, context);

    // 渲染各个组件
    const components = layout.map(section => {
      // 检查条件
      if (section.condition && !section.condition(item)) {
        return '';
      }
      return this.renderComponent(section, config, item, context);
    });

    return `
      <div class="${itemClasses}" ${dataAttrs}>
        ${components.join('')}
      </div>
    `;
  }

  /**
   * 获取列表项 CSS 类
   */
  static getItemClasses(config, item, context, isCompact) {
    const classes = [config.getClassName()];

    if (isCompact) {
      classes.push(`${config.blockClass}--compact`);
    }

    if (item.isFavorite) {
      classes.push(`${config.blockClass}--favorite`);
    }

    if (context.isSelected) {
      classes.push(`${config.blockClass}--selected`);
    }

    // 提示词特有：是否有图像
    if (config.itemType === 'prompt' && item.images && item.images.length > 0) {
      classes.push(`${config.blockClass}--has-images`);
    }

    return classes.join(' ');
  }

  /**
   * 获取 data 属性
   */
  static getDataAttrs(config, item, context) {
    const attrs = [`data-id="${item.id}"`, `data-index="${context.index}"`];

    if (config.itemType === 'prompt') {
      const firstImageId = item.images?.[0]?.id || item.images?.[0] || '';
      attrs.push(`data-first-image="${firstImageId}"`);
      attrs.push('data-drop-target="prompt"');
    } else if (config.itemType === 'image') {
      const imagePath = item.thumbnailPath || item.relativePath || '';
      attrs.push(`data-image-path="${imagePath.replace(/"/g, '&quot;')}"`);
    }

    return attrs.join(' ');
  }

  /**
   * 渲染组件
   */
  static renderComponent(section, config, item, context) {
    const { component } = section;
    const renderers = {
      checkbox: () => this.renderCheckbox(config, item, context),
      thumbnail: () => this.renderThumbnail(config, item, context, section),
      'text-content': () => this.renderTextContent(config, item, context, section),
      header: () => this.renderHeader(config, item, context, section),
      content: () => this.renderContent(config, item, context, section),
      note: () => this.renderNote(config, item, context, section),
      meta: () => this.renderMeta(config, item, context, section),
      actions: () => this.renderActions(config, item, context)
    };

    const renderer = renderers[component];
    return renderer ? renderer() : '';
  }

  /**
   * 渲染文本内容容器
   */
  static renderTextContent(config, item, context, section) {
    const className = config.getElementClass('text-content');
    const children = section.children || [];

    const childrenHtml = children.map(child => {
      // 检查条件
      if (child.condition && !child.condition(item)) {
        return '';
      }
      return this.renderComponent(child, config, item, context);
    }).join('');

    return `<div class="${className}">${childrenHtml}</div>`;
  }

  /**
   * 渲染复选框
   */
  static renderCheckbox(config, item, context) {
    const { isSelected, index } = context;
    const className = config.getElementClass('checkbox');
    const dataAttrs = config.getCheckboxDataAttrs(item, index);

    return `<input type="checkbox" class="${className}" ${isSelected ? 'checked' : ''} ${dataAttrs}>`;
  }

  /**
   * 渲染缩略图
   */
  static renderThumbnail(config, item, context, section) {
    const thumbnailPath = config.getThumbnail(item);
    const { useWrapper } = config.thumbnailConfig;

    // 使用 wrapper 模式（图像列表）
    if (useWrapper) {
      const wrapperClass = config.getElementClass('thumbnail-wrapper');
      const placeholderClass = config.getElementClass('thumbnail-placeholder');
      return `
        <div class="${wrapperClass}">
          <div class="${placeholderClass}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
        </div>
      `;
    }

    // 直接渲染模式（提示词列表）
    const thumbnailClass = config.getElementClass('thumbnail');
    const placeholderClass = config.getElementClass('thumbnail-placeholder');

    if (thumbnailPath) {
      // 生成空的 img 标签，JS 代码会查找并设置 src
      return `<img class="${thumbnailClass}" data-src="${thumbnailPath}" alt="">`;
    }

    if (section.placeholder) {
      return `<div class="${placeholderClass}"></div>`;
    }

    return '';
  }

  /**
   * 渲染头部（标题 + 标签）
   */
  static renderHeader(config, item, context, section) {
    const headerClass = config.getElementClass('header');
    const titleClass = config.getElementClass('title');
    const tagsClass = config.getElementClass('tags');

    const title = config.getTitle(item);
    const tags = config.getTags(item);
    const tagsHtml = TagUI.generateTagsHtml(tags, 'tag-display', 'tag-display-empty');

    return `
      <div class="${headerClass}">
        <div class="${titleClass}">${HtmlUtils.escapeHtml(title)}</div>
        <div class="${tagsClass}">${tagsHtml}</div>
      </div>
    `;
  }

  /**
   * 渲染内容
   */
  static renderContent(config, item, context, section) {
    const className = config.getElementClass('content');

    // 使用自定义渲染函数
    if (section.render) {
      const content = section.render(item);
      if (!content) return '';
      return `<div class="${className}">${content}</div>`;
    }

    const content = config.getContent(item);
    if (!content) return '';

    return `<div class="${className}">${HtmlUtils.escapeHtml(content)}</div>`;
  }

  /**
   * 渲染备注
   */
  static renderNote(config, item, context, section) {
    const className = config.getElementClass('note');
    const note = item.note;

    if (!note) return '';

    return TagUI.generateNoteHtml(note, className);
  }

  /**
   * 渲染元信息
   */
  static renderMeta(config, item, context, section) {
    const className = config.getElementClass('meta');

    // 使用自定义渲染函数
    if (section.render) {
      return `<div class="${className}">${section.render(item)}</div>`;
    }

    return '';
  }

  /**
   * 渲染操作按钮
   */
  static renderActions(config, item, context) {
    const { icons } = context;
    const className = config.getElementClass('actions');
    const buttons = config.getButtons();

    const buttonsHtml = buttons.map(btn => {
      const icon = this.getButtonIcon(btn.type, icons, item);
      const isActive = btn.type === 'favorite' && item.isFavorite;
      return createListButtonHtml(btn.type, {
        id: item.id,
        isActive,
        icon,
        title: btn.title
      });
    }).join('');

    return `<div class="${className}">${buttonsHtml}</div>`;
  }

  /**
   * 获取按钮图标
   */
  static getButtonIcon(type, icons, item) {
    switch (type) {
      case 'favorite':
        return item.isFavorite ? icons.favorite.filled : icons.favorite.outline;
      case 'delete':
        return icons.delete;
      case 'copy':
        return icons.copy;
      default:
        return '';
    }
  }
}
