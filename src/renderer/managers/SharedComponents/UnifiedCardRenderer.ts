import { TagUI } from '../TagUI.ts';
import { HtmlUtils } from '../../../utils/index.ts';
import { BUTTON_ICON_MAP, Icons } from './ButtonFactory.ts';
import { CardConfig } from './CardConfig.ts';

export interface CardRenderContext {
  icons: Icons;
  sortBy: string;
  app: unknown;
}

interface CardData {
  id: unknown;
  content: string;
  tags: string;
  footerInfo: string;
  isFavorite: unknown;
  thumbnail: unknown;
}

/**
 * 统一卡片渲染器
 * 所有卡片使用4行布局：按钮(10%) | 内容(40%) | 标签(40%) | 信息(10%)
 */
export class UnifiedCardRenderer {
  /**
   * 渲染卡片
   * @param config - 卡片配置
   * @param item - 数据项
   * @param context - 上下文
   * @returns HTML字符串
   */
  static render(config: CardConfig, item: Record<string, unknown>, context: CardRenderContext): string {
    const { icons, sortBy } = context;
    const prefix = config.cssPrefix;

    const footerInfo = config.getFooterInfo(item, sortBy);

    const data: CardData = {
      id: config.getValue(item, 'id'),
      content: config.getContentText(item) || '',
      tags: TagUI.generateTagsHtml(config.getValue(item, 'tags') as string[], 'tag-display', 'tag-display-empty'),
      footerInfo: footerInfo,
      isFavorite: config.getValue(item, 'isFavorite'),
      thumbnail: config.getValue(item, 'thumbnail')
    };

    const leftButtonsHtml = this.generateButtons(config.buttons.left, data, icons);
    const rightButtonsHtml = this.generateButtons(config.buttons.right, data, icons);

    const className = data.isFavorite ? `${prefix} is-favorite` : prefix;
    // 回收站卡片不在这里设置背景图，由 loadCardBackgroundsForContainer 异步加载
    const bgStyle = '';

    // 获取第一个关联图像的 ID（用于 hover 预览）
    const itemWithImages = item as { images?: Array<{ id?: string } | string> };
    const firstImageId = itemWithImages.images && itemWithImages.images.length > 0
      ? (typeof itemWithImages.images[0] === 'object' ? (itemWithImages.images[0] as { id?: string }).id : itemWithImages.images[0])
      : '';
    const firstImageAttr = firstImageId ? ` data-first-image="${firstImageId}"` : '';

    return `
      <div class="${className}" data-id="${data.id}" data-type="${config.dataType}"${firstImageAttr}>
        <div class="${prefix}-bg card__bg" ${bgStyle}></div>
        <div class="${prefix}-overlay card__overlay">
          <div class="${prefix}-row1 card-row">
            <div class="card-actions-left">${leftButtonsHtml}</div>
            <div class="card-actions-right">${rightButtonsHtml}</div>
          </div>
          <div class="${prefix}-row2 card-row">${HtmlUtils.escapeHtml(data.content)}</div>
          <div class="${prefix}-row3 card-row">${data.tags}</div>
          <div class="${prefix}-row4 card-row">
            <div class="card-footer-info">${data.footerInfo}</div>
          </div>
        </div>
      </div>
    `;
  }

  static generateButtons(buttonConfigs: Array<{ type: string; action: string; title: string; className?: string }>, data: CardData, icons: Icons): string {
    return buttonConfigs.map(btn => {
      const isActive = btn.type === 'favorite' && !!data.isFavorite;
      const iconSvg = this.getIconSvg(btn.type, icons, isActive);

      const classes = ['card-btn', `${btn.type}-btn`];
      if (btn.className) classes.push(btn.className);
      if (isActive) classes.push('active');

      return `
        <button class="${classes.join(' ')}"
                data-action="${btn.action}"
                data-id="${data.id}"
                title="${btn.title}">
          ${iconSvg}
        </button>
      `;
    }).join('');
  }

  static getIconSvg(type: string, icons: Icons, isActive?: boolean): string {
    const iconGetter = BUTTON_ICON_MAP[type];
    return iconGetter ? iconGetter(icons, isActive) : '';
  }
}

export default UnifiedCardRenderer;
