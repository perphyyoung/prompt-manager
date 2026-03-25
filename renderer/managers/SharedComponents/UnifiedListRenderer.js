import { TagUI } from '../index.js';
import { HtmlUtils } from '../../../utils/index.js';
import { createListButtonHtml } from './ButtonFactory.js';

/**
 * 统一列表渲染器
 * 支持标准列表和紧凑视图
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

    if (config.dataType === 'prompt') {
      return isCompact
        ? this.renderPromptCompact(config, item, context)
        : this.renderPromptStandard(config, item, context);
    } else {
      return isCompact
        ? this.renderImageCompact(config, item, context)
        : this.renderImageStandard(config, item, context);
    }
  }

  /**
   * 提示词标准列表视图
   */
  static renderPromptStandard(config, item, context) {
    const { icons, isSelected, index } = context;
    const prompt = item;
    const tagsHtml = TagUI.generateTagsHtml(prompt.tags, 'tag-display', 'tag-display-empty');
    const favoriteIcon = prompt.isFavorite ? icons.favorite.filled : icons.favorite.outline;
    const hasImages = prompt.images && prompt.images.length > 0;
    const hasImagesClass = hasImages ? 'has-images' : '';
    const isFavoriteClass = prompt.isFavorite ? 'is-favorite' : '';
    const isSelectedClass = isSelected ? 'is-selected' : '';
    const firstImageId = hasImages ? (prompt.images[0].id || prompt.images[0]) : '';

    const checkboxHtml = `<input type="checkbox" class="prompt-list-checkbox" ${isSelected ? 'checked' : ''} data-id="${prompt.id}" data-index="${index}">`;
    const favoriteBtnHtml = createListButtonHtml('favorite', { id: prompt.id, isActive: prompt.isFavorite, icon: favoriteIcon });
    const deleteBtnHtml = createListButtonHtml('delete', { id: prompt.id, icon: icons.delete });
    const copyBtnHtml = createListButtonHtml('copy', { id: prompt.id, icon: icons.copy });
    const noteHtml = TagUI.generateNoteHtml(prompt.note, 'prompt-list-note');

    // 缩略图HTML - 使用data-src延迟加载
    const thumbnailHtml = hasImages
      ? `<img class="prompt-list-thumbnail" data-src="${firstImageId}" alt="" data-image-id="${firstImageId}">`
      : `<div class="prompt-list-thumbnail-placeholder"></div>`;

    return `
      <div class="prompt-list-item ${isFavoriteClass} ${isSelectedClass} ${hasImagesClass}"
           data-id="${prompt.id}"
           data-first-image="${firstImageId}"
           data-index="${index}"
           data-drop-target="prompt">
        ${checkboxHtml}
        ${thumbnailHtml}
        <div class="prompt-list-text-content">
          <div class="prompt-list-item-header">
            <div class="prompt-list-title">${HtmlUtils.escapeHtml(prompt.title || '无标题')}</div>
            <div class="prompt-list-tags">${tagsHtml}</div>
          </div>
          <div class="prompt-list-content">${HtmlUtils.escapeHtml(prompt.content)}</div>
          ${noteHtml}
        </div>
        <div class="prompt-list-actions">
          ${copyBtnHtml}
          ${favoriteBtnHtml}
          ${deleteBtnHtml}
        </div>
      </div>
    `;
  }

  /**
   * 提示词紧凑视图
   */
  static renderPromptCompact(config, item, context) {
    const { icons, isSelected, index } = context;
    const prompt = item;
    const tagsHtml = TagUI.generateTagsHtml(prompt.tags, 'tag-display', 'tag-display-empty');
    const favoriteIcon = prompt.isFavorite ? icons.favorite.filled : icons.favorite.outline;
    const hasImages = prompt.images && prompt.images.length > 0;
    const hasImagesClass = hasImages ? 'has-images' : '';
    const isFavoriteClass = prompt.isFavorite ? 'is-favorite' : '';
    const isSelectedClass = isSelected ? 'is-selected' : '';
    const firstImageId = hasImages ? (prompt.images[0].id || prompt.images[0]) : '';

    const checkboxHtml = `<input type="checkbox" class="prompt-list-checkbox" ${isSelected ? 'checked' : ''} data-id="${prompt.id}" data-index="${index}">`;
    const favoriteBtnHtml = createListButtonHtml('favorite', { id: prompt.id, isActive: prompt.isFavorite, icon: favoriteIcon });
    const deleteBtnHtml = createListButtonHtml('delete', { id: prompt.id, icon: icons.delete });

    // 缩略图HTML
    const thumbnailHtml = hasImages
      ? `<img class="prompt-list-thumbnail" data-src="${firstImageId}" alt="" data-image-id="${firstImageId}">`
      : `<div class="prompt-list-thumbnail-placeholder"></div>`;

    return `
      <div class="prompt-list-item is-compact ${isFavoriteClass} ${isSelectedClass} ${hasImagesClass}"
           data-id="${prompt.id}"
           data-first-image="${firstImageId}"
           data-index="${index}"
           data-drop-target="prompt">
        ${checkboxHtml}
        ${thumbnailHtml}
        <div class="prompt-list-text-content">
          <div class="prompt-list-item-header">
            <div class="prompt-list-title">${HtmlUtils.escapeHtml(prompt.title || '无标题')}</div>
            <div class="prompt-list-tags">${tagsHtml}</div>
          </div>
        </div>
        <div class="prompt-list-actions">
          ${favoriteBtnHtml}
          ${deleteBtnHtml}
        </div>
      </div>
    `;
  }

  /**
   * 图像标准列表视图
   */
  static renderImageStandard(config, item, context) {
    const { icons, isSelected, index } = context;
    const img = item;
    const tagsHtml = TagUI.generateTagsHtml(img.tags, 'tag-display', 'tag-display-empty');
    const favoriteIcon = img.isFavorite ? icons.favorite.filled : icons.favorite.outline;
    const isFavoriteClass = img.isFavorite ? 'is-favorite' : '';
    const isSelectedClass = isSelected ? 'is-selected' : '';
    const imagePath = img.thumbnailPath || img.relativePath || '';

    const checkboxHtml = `<input type="checkbox" class="image-list-checkbox" ${isSelected ? 'checked' : ''} data-id="${img.id}" data-index="${index}">`;
    const favoriteBtnHtml = createListButtonHtml('favorite', { id: img.id, isActive: img.isFavorite, icon: favoriteIcon });
    const deleteBtnHtml = createListButtonHtml('delete', { id: img.id, icon: icons.delete });

    const thumbnailPlaceholderHtml = `
      <div class="image-list-thumbnail-placeholder">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      </div>
    `;

    const metaHtml = `<div class="image-list-meta"><span>${img.width || '?'} x ${img.height || '?'}</span><span>${HtmlUtils.formatFileSize(img.fileSize)}</span></div>`;

    return `
      <div class="image-list-item ${isFavoriteClass} ${isSelectedClass}"
           data-id="${img.id}"
           data-index="${index}"
           data-image-path="${imagePath.replace(/"/g, '&quot;')}">
        ${checkboxHtml}
        <div class="image-list-thumbnail-wrapper">
          ${thumbnailPlaceholderHtml}
        </div>
        <div class="image-list-text-content">
          <div class="image-list-item-header">
            <div class="image-list-title">${HtmlUtils.escapeHtml(img.fileName || '无标题')}</div>
            <div class="image-list-tags">${tagsHtml}</div>
          </div>
          ${metaHtml}
        </div>
        <div class="image-list-actions">
          ${favoriteBtnHtml}
          ${deleteBtnHtml}
        </div>
      </div>
    `;
  }

  /**
   * 图像紧凑视图
   */
  static renderImageCompact(config, item, context) {
    const { icons, isSelected, index } = context;
    const img = item;
    const tagsHtml = TagUI.generateTagsHtml(img.tags, 'tag-display', 'tag-display-empty');
    const favoriteIcon = img.isFavorite ? icons.favorite.filled : icons.favorite.outline;
    const isFavoriteClass = img.isFavorite ? 'is-favorite' : '';
    const isSelectedClass = isSelected ? 'is-selected' : '';
    const imagePath = img.thumbnailPath || img.relativePath || '';

    const checkboxHtml = `<input type="checkbox" class="image-list-checkbox" ${isSelected ? 'checked' : ''} data-id="${img.id}" data-index="${index}">`;
    const favoriteBtnHtml = createListButtonHtml('favorite', { id: img.id, isActive: img.isFavorite, icon: favoriteIcon });
    const deleteBtnHtml = createListButtonHtml('delete', { id: img.id, icon: icons.delete });

    const thumbnailPlaceholderHtml = `
      <div class="image-list-thumbnail-placeholder">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      </div>
    `;

    return `
      <div class="image-list-item is-compact ${isFavoriteClass} ${isSelectedClass}"
           data-id="${img.id}"
           data-index="${index}"
           data-image-path="${imagePath.replace(/"/g, '&quot;')}">
        ${checkboxHtml}
        <div class="image-list-thumbnail-wrapper">
          ${thumbnailPlaceholderHtml}
        </div>
        <div class="image-list-text-content">
          <div class="image-list-item-header">
            <div class="image-list-title">${HtmlUtils.escapeHtml(img.fileName || '无标题')}</div>
            <div class="image-list-tags">${tagsHtml}</div>
          </div>
        </div>
        <div class="image-list-actions">
          ${favoriteBtnHtml}
          ${deleteBtnHtml}
        </div>
      </div>
    `;
  }
}
