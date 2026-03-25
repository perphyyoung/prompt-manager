import { TagUI } from '../index.js';
import { HtmlUtils } from '../../../utils/index.js';
import { BUTTON_ICON_MAP } from './ButtonFactory.js';

/**
 * 统一卡片渲染器
 * 所有卡片使用4行布局：按钮(10%) | 内容(40%) | 标签(40%) | 信息(10%)
 */
export class UnifiedCardRenderer {
  /**
   * 渲染卡片
   * @param {CardConfig} config - 卡片配置
   * @param {Object} item - 数据项
   * @param {Object} context - 上下文
   * @returns {string} HTML字符串
   */
  static render(config, item, context) {
    const { icons, sortBy, app } = context;
    const prefix = config.cssPrefix;

    const footerInfo = config.getFooterInfo(item, sortBy);

    const data = {
      id: config.getValue(item, 'id'),
      content: config.getContentText(item) || '',
      tags: TagUI.generateTagsHtml(config.getValue(item, 'tags'), 'tag-display', 'tag-display-empty'),
      footerInfo: footerInfo,
      isFavorite: config.getValue(item, 'isFavorite'),
      thumbnail: config.getValue(item, 'thumbnail')
    };

    const leftButtonsHtml = this.generateButtons(config.buttons.left, data, icons);
    const rightButtonsHtml = this.generateButtons(config.buttons.right, data, icons);

    const className = data.isFavorite ? `${prefix} is-favorite` : prefix;
    // 回收站卡片不在这里设置背景图，由 loadCardBackgroundsForContainer 异步加载
    const bgStyle = ''

    // 获取第一个关联图像的 ID（用于 hover 预览）
    const firstImageId = item.images && item.images.length > 0
      ? (item.images[0].id || item.images[0])
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

  static generateButtons(buttonConfigs, data, icons) {
    return buttonConfigs.map(btn => {
      const isActive = btn.type === 'favorite' && data.isFavorite;
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

  static getIconSvg(type, icons, isActive) {
    const iconGetter = BUTTON_ICON_MAP[type];
    return iconGetter ? iconGetter(icons, isActive) : '';
  }
}
