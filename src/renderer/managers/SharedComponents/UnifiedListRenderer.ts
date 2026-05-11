import { TagUI } from '../TagUI.ts';
import { HtmlUtils } from '../../../utils/index.ts';
import { createListButtonHtml, Icons } from './ButtonFactory.ts';
import { ListConfig, LayoutSection } from './ListConfig.ts';
import { IImage } from '../../../types/entities.ts';

export interface ListRenderContext {
  icons: Icons;
  isCompact: boolean;
  isSelected: boolean;
  index: number;
}

/**
 * 统一列表渲染器
 * 使用BEM命名规范，完全配置驱动
 */
export class UnifiedListRenderer {
  /**
   * 渲染列表项
   * @param config - 列表配置
   * @param item - 数据项
   * @param context - 上下文
   * @returns HTML字符串
   */
  static render(config: ListConfig, item: Record<string, unknown>, context: ListRenderContext): string {
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
  static getItemClasses(config: ListConfig, item: Record<string, unknown>, context: ListRenderContext, isCompact: boolean): string {
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
    if (config.itemType === 'prompt' && item.images && (item.images as unknown[]).length > 0) {
      classes.push(`${config.blockClass}--has-images`);
    }

    return classes.join(' ');
  }

  /**
   * 获取 data 属性
   */
  static getDataAttrs(config: ListConfig, item: Record<string, unknown>, context: ListRenderContext): string {
    const attrs = [`data-id="${item.id}"`, `data-index="${context.index}"`];

    if (config.itemType === 'prompt') {
      const itemWithImages = item as { images?: Array<{ id?: string } | string> };
      const firstImageId = itemWithImages.images?.[0]
        ? (typeof itemWithImages.images[0] === 'object' ? (itemWithImages.images[0] as { id?: string }).id : itemWithImages.images[0])
        : '';
      attrs.push(`data-first-image="${firstImageId}"`);
      attrs.push('data-drop-target="prompt"');
    } else if (config.itemType === 'image') {
      const imagePath = (item as IImage).thumbnailPath || (item as IImage).relativePath || '';
      attrs.push(`data-image-path="${imagePath.replace(/"/g, '&quot;')}"`);
    }

    return attrs.join(' ');
  }

  /**
   * 渲染组件
   */
  static renderComponent(section: LayoutSection, config: ListConfig, item: Record<string, unknown>, context: ListRenderContext): string {
    const { component } = section;
    const renderers: Record<string, () => string> = {
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
  static renderTextContent(config: ListConfig, item: Record<string, unknown>, context: ListRenderContext, section: LayoutSection): string {
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
  static renderCheckbox(config: ListConfig, item: Record<string, unknown>, context: ListRenderContext): string {
    const { isSelected, index } = context;
    const className = config.getElementClass('checkbox');
    const dataAttrs = config.getCheckboxDataAttrs(item, index);

    return `<input type="checkbox" class="${className}" ${isSelected ? 'checked' : ''} ${dataAttrs}>`;
  }

  /**
   * 渲染缩略图
   */
  static renderThumbnail(config: ListConfig, item: Record<string, unknown>, context: ListRenderContext, section: LayoutSection): string {
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
  static renderHeader(config: ListConfig, item: Record<string, unknown>, _context: ListRenderContext, _section: LayoutSection): string {
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
  static renderContent(config: ListConfig, item: Record<string, unknown>, _context: ListRenderContext, section: LayoutSection): string {
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
  static renderNote(config: ListConfig, item: Record<string, unknown>, _context: ListRenderContext, _section: LayoutSection): string {
    const className = config.getElementClass('note');
    const note = item.note as string | undefined;

    if (!note) return '';

    return TagUI.generateNoteHtml(note, className);
  }

  /**
   * 渲染元信息
   */
  static renderMeta(config: ListConfig, item: Record<string, unknown>, _context: ListRenderContext, section: LayoutSection): string {
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
  static renderActions(config: ListConfig, item: Record<string, unknown>, context: ListRenderContext): string {
    const { icons } = context;
    const className = config.getElementClass('actions');
    const buttons = config.getButtons();

    const buttonsHtml = buttons.map(btn => {
      const icon = this.getButtonIcon(btn.type, icons, item);
      const isActive = btn.type === 'favorite' && !!item.isFavorite;
      return createListButtonHtml(btn.type, {
        id: String(item.id ?? ''),
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
  static getButtonIcon(type: string, icons: Icons, item: Record<string, unknown>): string {
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
