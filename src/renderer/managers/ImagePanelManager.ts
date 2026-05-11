import { cacheManager } from '../../utils/index.ts';
import { timeToTimestamp } from '../../utils/TimeUtils.ts';
import { PanelManagerBase, IPanelItem } from './PanelManagerBase.ts';
import type { IApp } from '../app.types.ts';
import { PanelRenderer, UnifiedCardRenderer, ImageMainConfig, UnifiedListRenderer, ImageListConfig } from './SharedComponents/index.ts';
import { Constants, Events } from '../../constants.ts';
import { DialogConfig } from '../services/index.ts';
import { batchToolbarMiddle } from '../../middle/index.ts';

import { IImage } from '../../types/entities.ts';
import { CardEventStrategy } from './Strategies/CardEventStrategy.ts';
import { ListEventStrategy } from './Strategies/ListEventStrategy.ts';
import { IEventStrategy, IEventStrategyItem } from './Strategies/IEventStrategy.ts';

interface PromptRef {
  promptId: string;
  promptContent?: string;
}

interface ImageWithPromptContent extends IImage {
  promptRefs?: PromptRef[];
}

/**
 * 图像面板管理器
 * 负责图像列表的渲染、筛选、标签管理等功能
 */
export class ImagePanelManager extends PanelManagerBase {
  private filteredImages: IImage[] = [];
  private isInitialized = false;

  // 图像特殊标签检查函数 Map
  static IMAGE_TAG_CHECKS = new Map<string, (img: IImage) => boolean>([
    [Constants.FAVORITE_TAG, (img) => !!img.isFavorite],
    [Constants.UNREFERENCED_TAG, (img) => !img.promptRefs || img.promptRefs.length === 0],
    [Constants.MULTI_REF_TAG, (img) => !!img.promptRefs && img.promptRefs.length > 1],
    [Constants.SAFE_TAG, (img) => img.isSafe !== 0],
    [Constants.UNSAFE_TAG, (img) => img.isSafe === 0],
    [Constants.NO_TAG_TAG, (img) => !img.tags || img.tags.length === 0]
  ]);

  constructor(app: IApp) {
    super({
      app: app,
      storagePrefix: 'image',
      defaultCardSize: 180
    });
    this.filteredImages = [];
    this.bindTagFilterActionEvent();
    this.bindTagFilterToggleEvents();
    this.bindTagManagerEvents();
    this.bindImageToolbarEvents();
  }

  /**
   * 绑定图像工具栏事件
   * @private
   */
  private bindImageToolbarEvents(): void {
    document.getElementById(Constants.Ids.IMAGE_ADD_BTN)?.addEventListener('click', () => this.app.imageUploadManager?.open());
  }

  /**
   * 绑定标签筛选动作按钮事件
   * @private
   */
  private bindTagFilterActionEvent(): void {
    document.getElementById(Constants.Ids.IMAGE_TAG_FILTER_ACTION_BTN)?.addEventListener('click', () => this.handleFilterAction());
  }

  /**
   * 获取标签筛选收起/展开按钮 ID（实现基类抽象方法）
   */
  getTagFilterToggleBtnId(): string {
    return Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN;
  }

  /**
   * 获取标签管理器按钮 ID（实现基类抽象方法）
   */
  getTagManagerBtnId(): string {
    return Constants.Ids.IMAGE_TAG_MANAGER_BTN;
  }

  /**
   * 打开标签管理器模态框（实现基类抽象方法）
   */
  protected async openTagManagerModal(): Promise<void> {
    await this.app.openImageTagManagerModal();
  }

  /**
   * 获取 UI 配置
   */
  protected getUIConfig() {
    return {
      cardSelector: '.image-card',
      listItemSelector: '.list-item--image',
      cardBgSelector: '.image-card-bg, .card__bg',
      gridContainerId: Constants.Ids.IMAGE_GRID,
      listContainerId: Constants.Ids.IMAGE_LIST,
      dragSource: 'image-tag',
      getCardDropSelector: () => '.image-card',

      getElementId: (element: HTMLElement): string | undefined => {
        return element.dataset.id || element.dataset.imageId || undefined;
      },

      getCopyContent: (item: IPanelItem) => {
        const img = item as IImage;
        const imgWithPrompt = img as ImageWithPromptContent;
        if (imgWithPrompt.promptRefs && imgWithPrompt.promptRefs.length > 0) {
          return {
            content: imgWithPrompt.promptRefs[0].promptContent || '',
            hasContent: !!imgWithPrompt.promptRefs[0].promptContent
          };
        }
        return { content: '', hasContent: false };
      },

      getDeleteConfirmConfig: () => ({
        config: DialogConfig.DELETE_IMAGE_TO_TRASH
      }),

      getCardImagePath: (item: IPanelItem): string | null => {
        const img = item as IImage;
        const thumbnailPath = typeof img.thumbnailPath === 'string' ? img.thumbnailPath : undefined;
        const relativePath = typeof img.relativePath === 'string' ? img.relativePath : undefined;
        return thumbnailPath || relativePath || null;
      }
    };
  }

  /**
   * 获取图像列表（从缓存读取）
   */
  get images(): IImage[] {
    return Array.from(this.app.cacheManager.getImageCache().values());
  }

  getItems(): IImage[] {
    return Array.from(this.app.cacheManager.getImageCache().values());
  }

  /**
   * 获取搜索查询（实现基类抽象方法）
   */
  getSearchQuery(): string {
    return this.app.searchSortManager?.getImageSearchQuery() || '';
  }

  /**
   * 检查图像是否匹配搜索查询（实现基类抽象方法）
   * 支持文件名、标签、备注搜索
   */
  matchesSearch(img: IImage, lowerQuery: string): boolean {
    if (!lowerQuery) return true;
    return (
      img.fileName?.toLowerCase().includes(lowerQuery) ||
      (img.tags && img.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) ||
      false
    );
  }

  /**
   * 获取特殊标签检查函数 Map（实现基类抽象方法）
   */
  getSpecialTagChecks(): Map<string, (item: Record<string, unknown>) => boolean> {
    return ImagePanelManager.IMAGE_TAG_CHECKS as Map<string, (item: Record<string, unknown>) => boolean>;
  }

  /**
   * 获取项目类型标识（实现基类抽象方法）
   */
  getItemType(): 'prompt' | 'image' {
    return 'image';
  }

  /**
   * 加载图像列表数据（实现基类抽象方法）
   */
  async loadData(): Promise<IImage[]> {
    try {
      const images = await window.electronAPI.getImages('updatedAt', 'desc');
      cacheManager.cacheImages(images);
      return images;
    } catch (error) {
      cacheManager.getImageCache().clear();
      throw error;
    }
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    await this.loadData();
    this.restoreTagFilterState();
    this.isInitialized = true;
  }

  /**
   * 渲染容器（实现基类抽象方法）
   */
  async renderContainer(filtered: IImage[]): Promise<void> {
    this.filteredImages = filtered;

    const container = document.getElementById(Constants.Ids.IMAGE_GRID);
    const listContainer = document.getElementById(Constants.Ids.IMAGE_LIST);
    const currentSearchQuery = this.getSearchQuery();

    if (filtered.length === 0) {
      if (currentSearchQuery) {
        PanelRenderer.showEmptyState(Constants.Ids.IMAGE_GRID, Constants.Ids.IMAGE_EMPTY_STATE, `未找到匹配"${currentSearchQuery}"的图像`, '搜索无结果');
      } else if (this.selectedTags.size > 0) {
        const selectedTagNames = Array.from(this.selectedTags).join(', ');
        PanelRenderer.showEmptyState(Constants.Ids.IMAGE_GRID, Constants.Ids.IMAGE_EMPTY_STATE, `没有符合标签"${selectedTagNames}"的图像`, '筛选无结果');
      } else {
        PanelRenderer.showEmptyState(Constants.Ids.IMAGE_GRID, Constants.Ids.IMAGE_EMPTY_STATE, '暂无图像');
      }
      if (listContainer) listContainer.style.display = 'none';
      return;
    }

    PanelRenderer.hideEmptyState(Constants.Ids.IMAGE_GRID, Constants.Ids.IMAGE_EMPTY_STATE);

    // 根据视图模式渲染
    if (this.viewModeType === 'grid') {
      container!.style.display = 'grid';
      if (listContainer) listContainer.style.display = 'none';

      // 渲染网格视图
      PanelRenderer.renderGrid(filtered, (img) => this.createCard(img as IImage), Constants.Ids.IMAGE_GRID);
      this.bindItemEvents(filtered);
      this.bindCardButtonEvents(filtered);
      this.loadCardBackgrounds();
      this.bindHoverPreview('.image-card');
      this.bindCardDropEvents(container!);
    } else {
      // 列表视图
      container!.style.display = 'none';
      if (listContainer) {
        listContainer.style.display = 'flex';
        await this.renderListView(filtered);
      }
    }
  }

  /**
   * 创建图像卡片 HTML（实现基类抽象方法）
   */
  createCard(img: IImage, index?: number): string {
    return UnifiedCardRenderer.render(ImageMainConfig, img, {
      icons: Constants.ICONS,
      sortBy: this.sortBy,
      app: this.app,
      selectedIds: batchToolbarMiddle.getSelectedIds(this.toolbarContext),
      index
    });
  }

  /**
   * 异步加载卡片背景图（实现基类抽象方法）
   */
  async loadCardBackgrounds(): Promise<void> {
    const container = document.getElementById(Constants.Ids.IMAGE_GRID);
    if (!container) return;

    const cards = container.querySelectorAll('.image-card');
    for (const card of cards) {
      const imageId = (card as HTMLElement).dataset.id;
      const img = this.images.find(i => String(i.id) === String(imageId));
      if (!img) continue;

      const imagePath = img.thumbnailPath || img.relativePath;
      if (!imagePath) continue;

      try {
        const fullPath = await window.electronAPI.getImagePath(imagePath as string);
        const bgElement = card.querySelector('.image-card-bg, .card__bg');
        if (bgElement) {
          (bgElement as HTMLElement).style.backgroundImage = `url('file://${fullPath.replace(/\\/g, '/')}')`;
        }
      } catch (error) {
        window.electronAPI.logError('ImagePanelManager.ts', 'Failed to load card background:', error);
      }
    }
  }

  /**
   * 渲染图像列表视图（实现基类抽象方法）
   */
  async renderListView(filtered: IImage[]): Promise<void> {
    const listContainer = document.getElementById(Constants.Ids.IMAGE_LIST);
    if (!listContainer) return;

    const isCompact = this.viewModeType === 'list-compact';

    // 使用统一列表渲染器生成列表项 HTML
    listContainer.innerHTML = filtered.map((img, index) =>
      UnifiedListRenderer.render(ImageListConfig, img, {
        icons: Constants.ICONS,
        isCompact,
        isSelected: batchToolbarMiddle.isSelected(this.toolbarContext, String(img.id)),
        index
      })
    ).join('');

    // 绑定事件（必须在加载缩略图之前，因为 bindItemEvents 会调用 unbindEvents 重置 DOM）
    this.bindItemEvents(filtered);
    this.bindListButtonEvents(filtered);
    this.bindHoverPreview('.list-item--image');
    this.bindCardDropEvents(listContainer);

    // 异步加载列表缩略图（必须在 bindItemEvents 之后，避免 unbindEvents 重置 DOM 导致缩略图丢失）
    await this.loadImageListThumbnails();
  }

  /**
   * 异步加载列表视图缩略图
   */
  async loadImageListThumbnails(): Promise<void> {
    const listContainer = document.getElementById(Constants.Ids.IMAGE_LIST);
    if (!listContainer) return;

    const items = listContainer.querySelectorAll('.list-item--image');
    for (const item of items) {
      const imagePath = (item as HTMLElement).dataset.imagePath;
      if (!imagePath) continue;

      try {
        const fullPath = await window.electronAPI.getImagePath(imagePath);
        const wrapper = item.querySelector('.list-item__thumbnail-wrapper');
        if (wrapper) {
          wrapper.innerHTML = `<img src="file://${fullPath.replace(/\\/g, '/').replace(/"/g, '&quot;')}" alt="" class="list-item__thumbnail">`;
        }
      } catch (error) {
        window.electronAPI.logError('ImagePanelManager.ts', 'Failed to load list thumbnail:', error);
      }
    }
  }

  /**
   * 绑定 hover 预览事件（实现基类抽象方法）
   */
  bindHoverPreview(selector: string): void {
    const tooltip = this.app.promptHoverTooltip;
    if (!tooltip) return;

    tooltip.bind(selector, {
      getContent: (element: Element) => {
        const imageId = (element as HTMLElement).dataset.id || (element as HTMLElement).dataset.imageId;
        const image = this.images.find(img => String(img.id) === String(imageId));
        const imageWithPrompt = image as ImageWithPromptContent | undefined;
        if (!imageWithPrompt || !imageWithPrompt.promptRefs || imageWithPrompt.promptRefs.length === 0) {
          return '';
        }
        return imageWithPrompt.promptRefs[0].promptContent || '';
      },
      getImageId: (element: Element) => {
        const imageId = (element as HTMLElement).dataset.id || (element as HTMLElement).dataset.imageId;
        return imageId || null;
      },
      delay: 500
    });
  }

  /**
   * 获取标签筛选容器 ID（实现基类抽象方法）
   */
  getTagFilterContainerId(): string {
    return Constants.Ids.IMAGE_TAG_FILTER_LIST;
  }

  /**
   * 获取特殊标签容器 ID（实现基类抽象方法）
   */
  getSpecialTagsContainerId(): string {
    return Constants.Ids.IMAGE_TAG_FILTER_SPECIAL_TAGS;
  }

  /**
   * 获取筛选动作按钮 ID（实现基类抽象方法）
   */
  getFilterActionBtnId(): string {
    return Constants.Ids.IMAGE_TAG_FILTER_ACTION_BTN;
  }

  /**
   * 获取标签筛选头部容器 ID（实现基类抽象方法）
   */
  getTagFilterHeaderContainerId(): string {
    return Constants.Ids.IMAGE_TAG_FILTER_HEADER_TAGS;
  }

  /**
   * 获取标签筛选排序选择器 ID（实现基类抽象方法）
   */
  getTagFilterSortSelectId(): string {
    return Constants.Ids.IMAGE_TAG_FILTER_SORT_SELECT;
  }

  /**
   * 获取标签筛选排序顺序按钮 ID（实现基类抽象方法）
   */
  getTagFilterOrderBtnId(): string {
    return Constants.Ids.IMAGE_TAG_FILTER_ORDER_BTN;
  }

  /**
   * 获取标签拖拽类型（实现基类抽象方法）
   */
  getTagDragType(): string {
    return 'image-tag';
  }

  /**
   * 获取所有标签（实现基类抽象方法）
   */
  async getAllTags(): Promise<string[]> {
    return window.electronAPI.getImageTags();
  }

  /**
   * 计算特殊标签计数（实现基类抽象方法）
   */
  calculateSpecialTagCounts(visibleItems: IImage[]): { tag: string; count: number }[] {
    const specialTags: { tag: string; count: number }[] = [];
    const favoriteCount = visibleItems.filter(img => img.isFavorite).length;
    const unreferencedCount = visibleItems.filter(img => !img.promptRefs || img.promptRefs.length === 0).length;
    const multiRefCount = visibleItems.filter(img => img.promptRefs && img.promptRefs.length > 1).length;
    const noTagCount = visibleItems.filter(img => !img.tags || img.tags.length === 0).length;

    if (favoriteCount > 0) {
      specialTags.push({ tag: Constants.FAVORITE_TAG, count: favoriteCount });
    }
    if (unreferencedCount > 0) {
      specialTags.push({ tag: Constants.UNREFERENCED_TAG, count: unreferencedCount });
    }
    if (multiRefCount > 0) {
      specialTags.push({ tag: Constants.MULTI_REF_TAG, count: multiRefCount });
    }
    if (noTagCount > 0) {
      specialTags.push({ tag: Constants.NO_TAG_TAG, count: noTagCount });
    }

    // NSFW 模式下显示安全评级标签
    if (this.app.viewMode === 'nsfw') {
      const safeCount = visibleItems.filter(img => img.isSafe !== 0).length;
      const unsafeCount = visibleItems.filter(img => img.isSafe === 0).length;
      if (safeCount > 0) {
        specialTags.push({ tag: Constants.SAFE_TAG, count: safeCount });
      }
      if (unsafeCount > 0) {
        specialTags.push({ tag: Constants.UNSAFE_TAG, count: unsafeCount });
      }
    }

    return specialTags;
  }

  /**
   * 删除图像（实现基类抽象方法）
   */
  async deleteItem(id: string): Promise<void> {
    try {
      await window.electronAPI.softDeleteImage(id);
      cacheManager.removeCachedItem(id, 'image');
      const image = this.images.find(img => String(img.id) === String(id));
      if (image) {
        image.isDeleted = true;
      }
      await this.renderView();
      this.app.eventBus.emit(Events.IMAGES_CHANGED, { images: this.images });

      // 通知提示词面板刷新（关联的提示词已移除该图像）
      this.app.eventBus.emit(Events.PROMPTS_CHANGED);

      // 刷新回收站
      if (this.app.trashManager) {
        await this.app.trashManager.loadTrash();
      }

      // 刷新统计界面
      if (this.app.currentPanel === 'statistics') {
        await this.app.renderStatistics?.();
      }

      this.app.showToast('图像已移至回收站', 'success');
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'Failed to delete image:', error);
      this.app.showToast('删除失败：' + (error as Error).message, 'error');
    }
  }

  /**
   * 切换收藏状态（实现基类抽象方法）
   */
  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    try {
      await window.electronAPI.updateImage(id, { isFavorite: isFavorite ? 1 : 0 });

      const img = this.images.find(i => String(i.id) === String(id));
      if (img) {
        img.isFavorite = isFavorite ? 1 : 0;
      }

      this.app.showToast(isFavorite ? '已收藏' : '已取消收藏', 'success');
      this.updateFavoriteUI(id, isFavorite);
      this.renderTagFilters();
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'toggleFavorite error:', error);
      this.app.showToast('操作失败：' + (error as Error).message, 'error');
    }
  }

  /**
   * 排序图像列表（实现基类抽象方法）
   */
  sortItems(items: IImage[], sortBy: string, sortOrder: string): IImage[] {
    const sorted = [...items];
    const order = sortOrder === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let valueA: string | number | undefined, valueB: string | number | undefined;

      switch (sortBy) {
        case 'updatedAt':
          valueA = timeToTimestamp(a.updatedAt);
          valueB = timeToTimestamp(b.updatedAt);
          break;
        case 'createdAt':
          valueA = timeToTimestamp(a.createdAt);
          valueB = timeToTimestamp(b.createdAt);
          break;
        case 'fileName':
          valueA = (a.fileName || '').toLowerCase();
          valueB = (b.fileName || '').toLowerCase();
          break;
        case 'width':
          valueA = a.width || 0;
          valueB = b.width || 0;
          break;
        case 'height':
          valueA = a.height || 0;
          valueB = b.height || 0;
          break;
        case 'fileSize':
          valueA = a.fileSize || 0;
          valueB = b.fileSize || 0;
          break;
        default:
          valueA = timeToTimestamp(a.updatedAt);
          valueB = timeToTimestamp(b.updatedAt);
      }

      if (valueA < valueB) return -1 * order;
      if (valueA > valueB) return 1 * order;
      return 0;
    });

    return sorted;
  }

  /**
   * 订阅事件（重写基类方法）
   */
  subscribeToEvents(): void {
    this.app.eventBus.on(Events.IMAGES_CHANGED, () => {
      this.refreshAfterUpdate();
    });
  }

  /**
   * 获取当前视图的事件策略
   */
  protected getEventStrategy(): IEventStrategy | null {
    if (this.viewModeType === 'grid') {
      return new ImageCardEventStrategy(this);
    } else if (this.viewModeType === 'list' || this.viewModeType === 'list-compact') {
      return new ImageListEventStrategy(this);
    }
    return null;
  }

  /**
   * 获取当前视图的容器元素
   */
  protected getCurrentContainer(): HTMLElement | null {
    if (this.viewModeType === 'grid') {
      return document.getElementById(Constants.Ids.IMAGE_GRID);
    } else {
      return document.getElementById(Constants.Ids.IMAGE_LIST);
    }
  }

  /**
   * 打开图像详情
   */
  openImageDetail(img: IImage): void {
    this.app.openImageDetailModal(img, { filteredList: this.filteredImages });
  }
}

/**
 * 图像卡片事件策略
 */
class ImageCardEventStrategy extends CardEventStrategy {
  constructor(private manager: ImagePanelManager) {
    super();
  }

  protected handleOpenDetail(item: IEventStrategyItem): void {
    this.manager.openImageDetail(item as IImage);
  }
}

/**
 * 图像列表事件策略
 */
class ImageListEventStrategy extends ListEventStrategy {
  constructor(private manager: ImagePanelManager) {
    super();
  }

  protected handleOpenDetail(item: IEventStrategyItem): void {
    this.manager.openImageDetail(item as IImage);
  }
}
