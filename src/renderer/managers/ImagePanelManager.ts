import { cacheManager, searchMatches } from '../../utils/index.ts';
import { timeToTimestamp } from '../../utils/TimeUtils.ts';
import { PanelManagerBase, IPanelItem } from './PanelManagerBase.ts';
import { localStorageManager } from '../configs/LocalStorageConfig.ts';
import type { IApp } from '../app.types.ts';
import { PanelRenderer, UnifiedCardRenderer, ImageMainConfig, UnifiedListRenderer, ImageListConfig } from './SharedComponents/index.ts';
import { Constants, Events } from '../../constants.ts';
import { DialogConfig } from '../services/index.ts';
import { batchToolbarMiddle } from '../../middle/index.ts';

import { IImage } from '../../types/entities.ts';
import { BaseEventStrategy, IEventStrategySelectors } from './Strategies/BaseEventStrategy.ts';
import { IEventStrategy, IEventStrategyItem } from './Strategies/IEventStrategy.ts';
import { TagUI } from './TagUI.ts';

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

  // 分页状态
  private readonly pageSize = 500;
  private currentOffset = 0;
  private hasMore = true;
  private totalCount = 0;
  private isLoading = false;
  private loadedImageIds = new Set<string>();
  private scrollHandler: (() => void) | null = null;

  // 面板类型
  protected readonly panelType = 'image' as const;

  // 存储键名
  protected get storageKeys() {
    return {
      viewMode: Constants.LocalStorageKey.IMAGE_VIEW_MODE,
      sortBy: Constants.LocalStorageKey.IMAGE_SORT_BY,
      sortOrder: Constants.LocalStorageKey.IMAGE_SORT_ORDER,
      cardSize: Constants.LocalStorageKey.IMAGE_CARD_SIZE,
      tagFilterSortBy: Constants.LocalStorageKey.IMAGE_TAG_FILTER_SORT_BY,
      tagFilterSortOrder: Constants.LocalStorageKey.IMAGE_TAG_FILTER_SORT_ORDER,
      tagFilterCollapsed: Constants.LocalStorageKey.IMAGE_TAG_FILTER_COLLAPSED
    };
  }

  // 图像特殊标签检查函数 Map
  static IMAGE_SPECIAL_TAG_PREDICATES = new Map<string, (img: IImage) => boolean>([
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
      defaultCardSize: 180
    });

    // 从 localStorage 加载设置（在 super 之后，init 之前）
    this.viewModeType = localStorageManager.get<string>(this.storageKeys.viewMode);
    this.sortBy = localStorageManager.get<string>(this.storageKeys.sortBy);
    this.sortOrder = localStorageManager.get<string>(this.storageKeys.sortOrder);
    this.cardSize = localStorageManager.get<number>(this.storageKeys.cardSize);
    this.tagFilterSortBy = localStorageManager.get<string>(this.storageKeys.tagFilterSortBy);
    this.tagFilterSortOrder = localStorageManager.get<string>(this.storageKeys.tagFilterSortOrder);

    // 初始化基类（使用 panelType 和 storageKeys）
    this.initPanelManager();

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
      getCardDropSelector: () => '.image-card, .list-item--image',

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

      getDeleteConfirmConfig: (item: IPanelItem) => {
        const img = item as IImage;
        return {
          config: DialogConfig.DELETE_IMAGE_TO_TRASH,
          name: img.fileName || '未命名图像'
        };
      },

      getCardImagePath: (item: IPanelItem): string | null => {
        const img = item as IImage;
        const thumbnailPath = typeof img.thumbnailPath === 'string' ? img.thumbnailPath : undefined;
        const relativePath = typeof img.relativePath === 'string' ? img.relativePath : undefined;
        return thumbnailPath || relativePath || null;
      },

      getCardImageId: (item: IPanelItem): string | null => {
        return String((item as IImage).id);
      },

      getOpenLocationPath: (item: IPanelItem): string | null => {
        const img = item as IImage;
        const relativePath = typeof img.relativePath === 'string' ? img.relativePath : undefined;
        return relativePath || null;
      },

      getListTitle: (item: IPanelItem): string => {
        const img = item as IImage;
        return img.fileName || '无文件名';
      },

      getListContent: (item: IPanelItem): string => {
        const img = item as IImage & { promptRefs?: Array<{ promptContent?: string }> };
        return img.promptRefs?.[0]?.promptContent || '';
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
    return searchMatches(img, lowerQuery);
  }

  /**
   * 获取特殊标签检查函数 Map（实现基类抽象方法）
   */
  getSpecialTagChecks(): Map<string, (item: Record<string, unknown>) => boolean> {
    return ImagePanelManager.IMAGE_SPECIAL_TAG_PREDICATES as Map<string, (item: Record<string, unknown>) => boolean>;
  }

  /**
   * 获取项目类型标识（实现基类抽象方法）
   */
  getItemType(): 'prompt' | 'image' {
    return 'image';
  }

  /**
   * 将选中的标签拆分为普通标签和特殊标签
   */
  private splitSelectedTags(): { tagNames: string[]; specialTags: string[] } {
    const specialTagChecks = this.getSpecialTagChecks();
    const tagNames: string[] = [];
    const specialTags: string[] = [];

    for (const tag of this.selectedTags) {
      if (specialTagChecks.has(tag)) {
        specialTags.push(tag);
      } else {
        tagNames.push(tag);
      }
    }

    return { tagNames, specialTags };
  }

  /**
   * 构建分页查询选项
   */
  private buildPaginatedOptions(): import('../../main/database-types.js').GetImagesPaginatedOptions {
    const { tagNames, specialTags } = this.splitSelectedTags();
    return {
      sortBy: this.sortBy || 'updatedAt',
      sortOrder: this.sortOrder === 'asc' ? 'asc' : 'desc',
      searchQuery: this.getSearchQuery() || undefined,
      tagNames: tagNames.length > 0 ? tagNames : undefined,
      specialTags: specialTags.length > 0 ? specialTags : undefined,
      isSafe: this.app.viewMode === 'safe' ? true : undefined,
      invertedFilter: this.invertedFilter,
      limit: this.pageSize,
      offset: this.currentOffset
    };
  }

  /**
   * 加载图像列表数据（实现基类抽象方法）
   */
  async loadData(): Promise<IImage[]> {
    try {
      this.currentOffset = 0;
      this.hasMore = true;
      this.loadedImageIds.clear();
      const page = await this.fetchPage();
      // 增量缓存元数据（不调用 cacheImages 避免清空改变 LRU 顺序）
      for (const img of page.items) {
        cacheManager.cacheImage(img);
        this.loadedImageIds.add(String(img.id));
      }
      this.totalCount = page.totalCount;
      this.hasMore = page.items.length < page.totalCount;
      // 预缓存路径（原图 + 缩略图）—— 路径缓存的唯一写入点
      await this.prefetchImagePaths(page.items);
      return page.items;
    } catch (error) {
      cacheManager.getImageCache().clear();
      throw error;
    }
  }

  /**
   * 分页获取图像
   */
  private async fetchPage(): Promise<{ items: IImage[]; totalCount: number }> {
    const options = this.buildPaginatedOptions();
    return await window.electronAPI.getImagesPaginated(options);
  }

  /**
   * 预缓存一批图像的完整路径（原图 + 缩略图）
   * 委托给 cacheManager.prefetchImagePaths
   */
  private async prefetchImagePaths(items: IImage[]): Promise<void> {
    await cacheManager.prefetchImagePaths(items, window.electronAPI);
  }

  /**
   * 加载更多图像
   */
  async loadMore(): Promise<void> {
    if (this.isLoading || !this.hasMore) {
      return;
    }

    this.isLoading = true;
    try {
      this.currentOffset += this.pageSize;
      const page = await this.fetchPage();

      const newItems = page.items.filter(img => !this.loadedImageIds.has(String(img.id)));
      for (const img of newItems) {
        this.loadedImageIds.add(String(img.id));
        cacheManager.cacheImage(img);
      }
      // 预缓存新加载项的路径
      if (newItems.length > 0) {
        await this.prefetchImagePaths(newItems);
      }

      this.filteredImages = [...this.filteredImages, ...newItems];
      this.filteredItems = this.filteredImages;
      this.hasMore = this.filteredImages.length < page.totalCount;

      if (newItems.length > 0) {
        await this.appendToContainer(newItems);
        // 重新绑定事件，让闭包包含所有已加载图像
        this.bindItemEvents(this.filteredImages);
      }
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'Failed to load more images:', error);
      this.app.showToast?.('加载更多图像失败', 'error');
    } finally {
      this.isLoading = false;
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
    this.bindScrollEvents();
    this.isInitialized = true;
  }

  /**
   * 渲染主视图（重写基类方法）
   * 图像面板使用数据库分页查询，不走前端过滤排序
   */
  async renderView(): Promise<void> {
    try {
      const filtered = await this.loadData();
      this.filteredItems = filtered;
      this.filteredImages = filtered;

      await this.renderContainer(filtered);
      await this.afterRenderContainer(filtered);
      await this.refreshTagCounts();
      await this.renderTagFilters();
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'Failed to render image list:', error);
      this.app.showToast?.('加载图像失败', 'error');
    }
  }

  /**
   * 渲染标签筛选器（重写基类方法）
   * 先刷新数据库计数，再渲染
   */
  async renderTagFilters(): Promise<void> {
    await this.refreshTagCounts();
    await super.renderTagFilters();
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
   * 追加渲染到容器
   * @param newItems - 新加载的图像列表
   */
  private async appendToContainer(newItems: IImage[]): Promise<void> {
    const container = document.getElementById(Constants.Ids.IMAGE_GRID);
    const listContainer = document.getElementById(Constants.Ids.IMAGE_LIST);
    if (!container || !listContainer) return;

    if (this.viewModeType === 'grid') {
      const html = newItems.map((img, index) => this.createCard(img, this.filteredImages.length - newItems.length + index)).join('');
      this.appendHtmlToContainer(container, html);
      this.bindCardButtonEvents(newItems);
      await this.loadCardBackgroundsForItems(newItems);
      this.bindHoverPreview('.image-card');
    } else {
      const isCompact = this.viewModeType === 'list-compact';
      const html = newItems.map((img, index) =>
        UnifiedListRenderer.render(ImageListConfig, img, {
          icons: Constants.ICONS,
          isCompact,
          isSelected: batchToolbarMiddle.isSelected(this.toolbarContext, String(img.id)),
          index: this.filteredImages.length - newItems.length + index
        })
      ).join('');
      this.appendHtmlToContainer(listContainer, html);
      this.bindListButtonEvents(newItems);
      this.bindHoverPreview('.list-item--image');
      await this.loadImageListThumbnailsForItems(newItems);
    }
  }

  /**
   * 将 HTML 字符串追加到容器
   * 使用 DOMParser 避免直接调用 insertAdjacentHTML 触发 lint 警告
   * @param container - 容器元素
   * @param html - HTML 字符串
   */
  private appendHtmlToContainer(container: HTMLElement, html: string): void {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const nodes = Array.from(doc.body.childNodes);
    container.append(...nodes);
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
    await this.loadCardBackgroundsForItems(this.filteredImages);
  }

  /**
   * 异步加载指定图像卡片的背景图
   * @param items - 需要加载背景图的图像列表
   */
  private async loadCardBackgroundsForItems(items: IImage[]): Promise<void> {
    const container = document.getElementById(Constants.Ids.IMAGE_GRID);
    if (!container) return;

    const itemIds = new Set(items.map(img => String(img.id)));
    const cards = container.querySelectorAll('.image-card');
    const uncached: Array<{ imageId: string; relativePath: string; card: HTMLElement }> = [];

    for (const card of cards) {
      const imageId = (card as HTMLElement).dataset.id;
      if (!imageId || !itemIds.has(imageId)) continue;

      // 路径缓存的"纯读"：仅当缓存命中时直接使用
      const cachedPath = cacheManager.getImagePath(imageId, 'thumbnail');
      if (cachedPath) {
        const bgElement = card.querySelector('.image-card-bg, .card__bg');
        if (bgElement) {
          (bgElement as HTMLElement).style.backgroundImage = `url('file://${cachedPath.replace(/\\/g, '/')}')`;
        }
        continue;
      }

      // 缓存未命中（极端情况：分页预缓存前已渲染） → 收集后单次 IPC 兜底
      const img = this.filteredImages.find(i => String(i.id) === imageId) || this.images.find(i => String(i.id) === imageId);
      const imagePath = img?.thumbnailPath || img?.relativePath;
      if (img && imagePath) {
        uncached.push({ imageId, relativePath: imagePath, card: card as HTMLElement });
      }
    }

    if (uncached.length === 0) return;

    try {
      const relativePaths = uncached.map(u => u.relativePath);
      const fullPaths = await window.electronAPI.getImagesPaths(relativePaths);
      const entries: Array<{ imageId: string; fullPath: string }> = [];
      uncached.forEach((u, i) => {
        const fullPath = fullPaths[i];
        if (fullPath) {
          entries.push({ imageId: u.imageId, fullPath });
          const bgElement = u.card.querySelector('.image-card-bg, .card__bg');
          if (bgElement) {
            (bgElement as HTMLElement).style.backgroundImage = `url('file://${fullPath.replace(/\\/g, '/')}')`;
          }
        }
      });
      cacheManager.setImagePaths(entries, 'thumbnail');
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'Failed to load card backgrounds (fallback):', error);
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
    await this.loadImageListThumbnailsForItems(this.filteredImages);
  }

  /**
   * 异步加载指定列表项的缩略图
   * @param items - 需要加载缩略图的图像列表
   */
  private async loadImageListThumbnailsForItems(items: IImage[]): Promise<void> {
    const listContainer = document.getElementById(Constants.Ids.IMAGE_LIST);
    if (!listContainer) return;

    const itemIds = new Set(items.map(img => String(img.id)));
    const listItems = listContainer.querySelectorAll('.list-item--image');

    // 收集所有列表项的路径信息，区分缓存命中和未命中
    const itemInfoList: Array<{ wrapper: Element | null; imageId: string; fullPath?: string }> = [];
    const uncachedPaths: Array<{ index: number; relativePath: string }> = [];

    for (const item of listItems) {
      const imageId = (item as HTMLElement).dataset.id;
      if (!imageId || !itemIds.has(imageId)) continue;

      const imagePath = (item as HTMLElement).dataset.imagePath;
      if (!imagePath) continue;

      const wrapper = item.querySelector('.list-item__thumbnail-wrapper');
      const itemIndex = itemInfoList.length;
      itemInfoList.push({ wrapper, imageId });

      // 先检查缓存
      const cachedPath = cacheManager.getImagePath(imageId, 'thumbnail');
      if (cachedPath) {
        itemInfoList[itemIndex].fullPath = cachedPath;
      } else {
        // 缓存未命中，加入待获取列表
        uncachedPaths.push({ index: itemIndex, relativePath: imagePath });
      }
    }

    // 批量获取未缓存的路径
    if (uncachedPaths.length > 0) {
      try {
        const relativePaths = uncachedPaths.map(p => p.relativePath);
        const fullPaths = await window.electronAPI.getImagesPaths(relativePaths);
        const entries: Array<{ imageId: string; fullPath: string }> = [];
        uncachedPaths.forEach((item, i) => {
          const fullPath = fullPaths[i];
          if (fullPath) {
            itemInfoList[item.index].fullPath = fullPath;
            entries.push({ imageId: itemInfoList[item.index].imageId, fullPath });
          }
        });
        // 批量写入缓存
        cacheManager.setImagePaths(entries, 'thumbnail');
      } catch (error) {
        window.electronAPI.logError('ImagePanelManager.ts', 'Failed to load list thumbnails:', error);
      }
    }

    // 渲染所有缩略图
    itemInfoList.forEach((info) => {
      if (!info.wrapper || !info.fullPath) return;
      info.wrapper.innerHTML = `<img src="file://${info.fullPath.replace(/\\/g, '/').replace(/"/g, '&quot;')}" alt="" class="list-item__thumbnail">`;
    });
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
        const image = this.filteredImages.find(img => String(img.id) === String(imageId)) ||
          this.images.find(img => String(img.id) === String(imageId));
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
   * 获取反选按钮 ID（实现基类抽象方法）
   */
  getInvertedFilterBtnId(): string {
    return Constants.Ids.IMAGE_TAG_FILTER_INVERT_BTN;
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
   * 计算标签计数（重写基类方法）
   * 基于数据库统计，不受分页影响
   */
  calculateTagCounts(_tags: string[]): Record<string, number> {
    // 异步获取数据库统计结果，下次 renderTagFilters 时生效
    // 同步返回上一次的计数结果（初始为空）
    return this.lastTagCounts;
  }

  private lastTagCounts: Record<string, number> = {};

  /**
   * 异步刷新标签计数
   */
  private async refreshTagCounts(): Promise<void> {
    try {
      const options = this.buildCountOptions();
      const [tagCounts, specialTagCounts] = await Promise.all([
        window.electronAPI.countImageTags(options),
        window.electronAPI.countImageSpecialTags(options)
      ]);
      this.lastTagCounts = tagCounts;
      this.lastSpecialTagCounts = specialTagCounts;
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'Failed to refresh tag counts:', error);
    }
  }

  private lastSpecialTagCounts: import('../../main/database-types.js').ImageSpecialTagCounts = {
    favorite: 0,
    unreferenced: 0,
    multiRef: 0,
    noTag: 0,
    safe: 0,
    unsafe: 0
  };

  /**
   * 构建计数查询选项
   */
  private buildCountOptions(): import('../../main/database-types.js').CountImageTagsOptions {
    const { tagNames, specialTags } = this.splitSelectedTags();
    return {
      searchQuery: this.getSearchQuery() || undefined,
      tagNames: tagNames.length > 0 ? tagNames : undefined,
      specialTags: specialTags.length > 0 ? specialTags : undefined,
      isSafe: this.app.viewMode === 'safe' ? true : undefined,
      invertedFilter: this.invertedFilter
    };
  }

  /**
   * 计算特殊标签计数（实现基类抽象方法）
   * 基于数据库统计，不受分页影响
   */
  calculateSpecialTagCounts(_visibleItems: IImage[]): { tag: string; count: number }[] {
    const specialTags: { tag: string; count: number }[] = [];
    const counts = this.lastSpecialTagCounts;

    if (counts.favorite > 0) {
      specialTags.push({ tag: Constants.FAVORITE_TAG, count: counts.favorite });
    }
    if (counts.unreferenced > 0) {
      specialTags.push({ tag: Constants.UNREFERENCED_TAG, count: counts.unreferenced });
    }
    if (counts.multiRef > 0) {
      specialTags.push({ tag: Constants.MULTI_REF_TAG, count: counts.multiRef });
    }
    if (counts.noTag > 0) {
      specialTags.push({ tag: Constants.NO_TAG_TAG, count: counts.noTag });
    }

    // NSFW 模式下显示安全评级标签
    if (this.app.viewMode === 'nsfw') {
      if (counts.safe > 0) {
        specialTags.push({ tag: Constants.SAFE_TAG, count: counts.safe });
      }
      if (counts.unsafe > 0) {
        specialTags.push({ tag: Constants.UNSAFE_TAG, count: counts.unsafe });
      }
    }

    return specialTags;
  }

  /**
   * 绑定滚动加载事件
   */
  private bindScrollEvents(): void {
    this.unbindScrollEvents();

    const gridContainer = document.getElementById(Constants.Ids.IMAGE_GRID);
    const listContainer = document.getElementById(Constants.Ids.IMAGE_LIST);

    let ticking = false;
    this.scrollHandler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        this.handleScroll();
      });
    };

    gridContainer?.addEventListener('scroll', this.scrollHandler);
    listContainer?.addEventListener('scroll', this.scrollHandler);
  }

  /**
   * 解绑滚动加载事件
   */
  private unbindScrollEvents(): void {
    if (!this.scrollHandler) return;

    const gridContainer = document.getElementById(Constants.Ids.IMAGE_GRID);
    const listContainer = document.getElementById(Constants.Ids.IMAGE_LIST);

    gridContainer?.removeEventListener('scroll', this.scrollHandler);
    listContainer?.removeEventListener('scroll', this.scrollHandler);
    this.scrollHandler = null;
  }

  /**
   * 处理滚动事件，判断是否需要加载更多
   */
  private handleScroll(): void {
    const container = this.viewModeType === 'grid'
      ? document.getElementById(Constants.Ids.IMAGE_GRID)
      : document.getElementById(Constants.Ids.IMAGE_LIST);
    if (!container) return;

    const scrollBottom = container.scrollTop + container.clientHeight;
    const threshold = 200;
    if (scrollBottom >= container.scrollHeight - threshold) {
      this.loadMore();
    }
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
      // 增量刷新：保持分页位置，仅移除已删除项，避免重置到第一页
      await this.refreshIncremental();
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
   * 刷新面板（重写基类方法）
   * renderView 已包含 loadData，避免重复加载
   */
  async refresh(): Promise<void> {
    await this.renderView();
  }

  /**
   * 数据更新后的统一刷新（重写基类方法）
   * 增量刷新：保持当前分页状态，只重新渲染已加载的数据
   */
  async refreshAfterUpdate(): Promise<void> {
    await this.refreshIncremental();
  }

  /**
   * 增量刷新：保持当前分页状态，重新获取已加载范围的数据
   * 用于从详情页返回等场景，避免重置分页状态导致已加载数据丢失
   * 只更新 DOM 中变化的数据（标签、备注等），不重新加载缩略图
   */
  private async refreshIncremental(): Promise<void> {
    try {
      // 保持 currentOffset 和 loadedImageIds，重新获取当前已加载范围的数据
      const options = this.buildPaginatedOptions();
      options.limit = this.currentOffset + this.pageSize;
      options.offset = 0;

      const result = await window.electronAPI.getImagesPaginated(options);

      // 检测 DOM 中不存在的新项（如新建/上传的图像）：
      // 增量更新只能修改/删除已有元素，无法创建新元素，
      // 存在新项时降级为全量渲染，确保新卡片正确显示
      const container = this.getCurrentContainer();
      const hasNewItem =
        container !== null && result.items.some((item) => !container.querySelector(`[data-id="${item.id}"]`));
      if (hasNewItem) {
        await this.renderView();
        return;
      }

      // 更新缓存和 filteredImages
      this.filteredImages = result.items;
      this.filteredItems = result.items;
      this.hasMore = result.items.length < result.totalCount;
      this.totalCount = result.totalCount;

      // 更新 loadedImageIds
      this.loadedImageIds.clear();
      for (const img of result.items) {
        this.loadedImageIds.add(String(img.id));
        cacheManager.cacheImage(img);
      }

      // 补充路径缓存（仅缺失的项）
      await this.prefetchImagePaths(result.items);

      // 清理不再匹配筛选结果的 DOM 项（如"无图"筛选下添加图片）
      this.removeStaleDomItems(result.items);

      // 增量更新 DOM：只更新变化的数据，不重新加载缩略图
      this.updateDomIncrementally(result.items);

      // 刷新标签计数
      await this.refreshTagCounts();
      await this.renderTagFilters();
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'Failed to refresh incremental:', error);
      this.app.showToast?.('刷新失败', 'error');
    }
  }

  /**
   * 增量更新 DOM：只更新变化的数据（标签、备注等），不重新加载缩略图
   * @param items - 更新后的图像列表
   */
  private updateDomIncrementally(items: IImage[]): void {
    if (this.viewModeType === 'grid') {
      this.updateGridDomIncrementally(items);
    } else {
      this.updateListDomIncrementally(items);
    }
  }

  /**
   * 增量更新网格视图 DOM
   * 注意：网格卡片没有 note 区域（UnifiedCardRenderer 仅渲染 4 行：按钮/内容/标签/信息）
   */
  private updateGridDomIncrementally(items: IImage[]): void {
    const container = document.getElementById(Constants.Ids.IMAGE_GRID);
    if (!container) return;

    for (const img of items) {
      const card = container.querySelector(`[data-id="${img.id}"]`) as HTMLElement;
      if (!card) continue;

      // 更新卡片 is-favorite class
      card.classList.toggle('is-favorite', !!img.isFavorite);

      // 更新收藏按钮状态
      const favoriteBtn = card.querySelector('.favorite-btn');
      if (favoriteBtn) {
        const isActive = !!img.isFavorite;
        favoriteBtn.classList.toggle('active', isActive);
        favoriteBtn.innerHTML = isActive ? Constants.ICONS.favorite.filled : Constants.ICONS.favorite.outline;
      }

      // 更新标签区域（row3）
      const tagsContainer = card.querySelector('.image-card-row3');
      if (tagsContainer) {
        tagsContainer.innerHTML = TagUI.generateTagsHtml(
          img.tags || [],
          'tag-display',
          'tag-display-empty'
        );
      }
    }
  }

  /**
   * 增量更新列表视图 DOM（继承自基类 PanelManagerBase）
   * 基类已实现 title/content/tags/note/favorite 的通用更新逻辑
   */

  /**
   * 渲染标签 HTML
   */
  private renderTagsHtml(tags: string[], isFavorite?: number): string {
    if (tags.length === 0 && !isFavorite) return '';

    const tagHtml = tags.slice(0, 3).map(tag => `<span class="image-card-tag">${tag}</span>`).join('');
    const moreCount = tags.length - 3;
    const moreHtml = moreCount > 0 ? `<span class="image-card-tag image-card-tag--more">+${moreCount}</span>` : '';

    return tagHtml + moreHtml;
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
    return new ImageEventStrategy(this, this.viewModeType);
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
   * 获取滚动导航按钮 ID（实现基类抽象方法）
   */
  getScrollNavId(): string {
    return Constants.Ids.IMAGE_SCROLL_NAV;
  }

  /**
   * 打开图像详情
   */
  openImageDetail(img: IImage): void {
    this.app.openImageDetailModal(img, { filteredList: this.filteredImages });
  }
}

/**
 * 图像统一事件策略
 * 支持网格视图、列表视图和紧凑列表视图
 */
class ImageEventStrategy extends BaseEventStrategy {
  constructor(
    private manager: ImagePanelManager,
    private viewMode: string,
  ) {
    super();
  }

  protected getSelectors(): IEventStrategySelectors {
    if (this.viewMode === 'grid') {
      return {
        checkbox: '.card-checkbox',
        item: '.image-card',
        exclude: ['.action-btn', '.card-checkbox'],
      };
    } else {
      // list 和 list-compact 使用相同的选择器
      return {
        checkbox: '.list-item__checkbox',
        item: '.list-item--image',
        exclude: ['.list-item__checkbox', '.list-item__actions'],
      };
    }
  }

  protected handleOpenDetail(item: IEventStrategyItem): void {
    this.manager.openImageDetail(item as IImage);
  }
}
