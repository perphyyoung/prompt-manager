import { cacheManager, searchMatches, cyrb53 } from '../../utils/index.ts';
import { timeToTimestamp } from '../../utils/TimeUtils.ts';
import { PanelManagerBase, IPanelItem } from './PanelManagerBase.ts';
import { localStorageManager } from '../configs/LocalStorageConfig.ts';
import type { IApp } from '../app.types.ts';
import { PanelRenderer, UnifiedCardRenderer, ImageMainConfig } from './SharedComponents/index.ts';
import { Constants, Events } from '../../constants.ts';
import { DialogConfig } from '../services/index.ts';
import { batchToolbarMiddle } from '../../middle/index.ts';

import { IImage } from '../../types/entities.ts';
import { VirtualScrollBar, VirtualWindowRenderer, type VisibleRange } from '../renderer_utils/index.ts';
import { BaseEventStrategy, IEventStrategySelectors } from './Strategies/BaseEventStrategy.ts';
import { IEventStrategy, IEventStrategyItem } from './Strategies/IEventStrategy.ts';

/** .grid-view 的 gap 值（px），与 styles.css 保持一致 */
const GRID_GAP = 16;

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
  private readonly pageSize = 100;
  private currentOffset = 0;
  private hasMore = true;
  private totalCount = 0;
  private isLoading = false;
  private loadedImageIds = new Set<string>();
  private scrollHandler: (() => void) | null = null;

  // 虚拟滚动（窗口渲染机制统一由 VirtualWindowRenderer 实现）
  private windowRenderer: VirtualWindowRenderer<IImage> | null = null;
  private scrollBar: VirtualScrollBar | null = null;
  private scrollBarResizeObserver: ResizeObserver | null = null;

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
    // 图像主页仅保留网格视图
    this.viewModeType = 'grid';
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
   * 获取当前已加载的图像列表
   * filteredImages 为权威数据源（含已加载的全部分页）；
   * LRU 缓存容量有限会被淘汰，仅作初始兜底，
   * 避免滚动后缓存淘汰导致拖拽标签等按 id 查找失败
   */
  get images(): IImage[] {
    return this.filteredImages.length > 0
      ? this.filteredImages
      : Array.from(this.app.cacheManager.getImageCache().values());
  }

  getItems(): IImage[] {
    return this.images;
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
    // 预缓存路径（原图 + 缩略图）—— 主要预填充入口，兜底写入见 loadCardBackgroundsForItems
    await this.prefetchImagePaths(page.items);
    // 校验本页缩略图文件完整性，缺失的由主进程按需重建（懒自愈）
    await this.ensureThumbnailsForPage(page.items.map(img => String(img.id)));
    // 重建指纹基准（全量渲染后所有项视为"已同步"）
    this.itemFingerprints = new Map(
      page.items.map(img => [String(img.id), this.getItemFingerprint(img)])
    );
    // 失败时保留旧缓存：数据仍以数据库为准，清空只会导致后续全部重新 IPC
    return page.items;
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
        // 补录新加载项的指纹（DOM 渲染由虚拟窗口按需完成）
        for (const img of newItems) {
          this.itemFingerprints.set(String(img.id), this.getItemFingerprint(img));
        }
        // 强制刷新：进度条跳转后原始窗口区间不变，非强制刷新会因区间相同被跳过，
        // 导致已渲染钳制窗口之外的新加载卡片不显示
        this.windowRenderer?.refresh(true);
      }
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'Failed to load more images:', error);
      this.app.showToast?.('加载更多图像失败', 'error');
    } finally {
      this.isLoading = false;
    }

    // 窗口仍接近未加载边界时继续追赶（快速拖动滚动条场景）
    this.ensureWindowData();
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
   * 虚拟滚动：totalCount 已知时撑起完整滚动高度，DOM 只渲染可见窗口
   */
  async renderContainer(filtered: IImage[]): Promise<void> {
    this.filteredImages = filtered;

    const container = document.getElementById(Constants.Ids.IMAGE_GRID);
    const currentSearchQuery = this.getSearchQuery();

    if (filtered.length === 0) {
      this.destroyVirtualScroller();
      this.scrollBarResizeObserver?.disconnect();
      this.scrollBarResizeObserver = null;
      this.scrollBar?.destroy();
      this.scrollBar = null;
      if (currentSearchQuery) {
        PanelRenderer.showEmptyState(Constants.Ids.IMAGE_GRID, Constants.Ids.IMAGE_EMPTY_STATE, `未找到匹配"${currentSearchQuery}"的图像`, '搜索无结果');
      } else if (this.selectedTags.size > 0) {
        const selectedTagNames = Array.from(this.selectedTags).join(', ');
        PanelRenderer.showEmptyState(Constants.Ids.IMAGE_GRID, Constants.Ids.IMAGE_EMPTY_STATE, `没有符合标签"${selectedTagNames}"的图像`, '筛选无结果');
      } else {
        PanelRenderer.showEmptyState(Constants.Ids.IMAGE_GRID, Constants.Ids.IMAGE_EMPTY_STATE, '暂无图像');
      }
      return;
    }

    PanelRenderer.hideEmptyState(Constants.Ids.IMAGE_GRID, Constants.Ids.IMAGE_EMPTY_STATE);

    // 渲染网格视图（图像主页仅保留网格视图）
    // wrapper 模式下不再使用 CSS grid 排布（卡片由 absolute 定位），覆盖为块级滚动容器
    container!.style.display = 'block';
    container!.innerHTML = '';

    // lap 模式：固定高度 wrapper 撑起 scrollHeight，可见卡片 absolute 定位其上，
    // 内容替换不产生文档流位移，scrollHeight 恒定
    const wrapper = document.createElement('div');
    wrapper.className = 'virtual-wrapper';
    container!.appendChild(wrapper);
    this.setupVirtualScroller(container!, wrapper);
    this.bindCardDropEvents(container!);

    // totalCount 为数据库全量计数：wrapper 总高立即覆盖全部数据，
    // 初始窗口经 rAF 异步渲染
    this.windowRenderer?.setTotalCount(this.totalCount);
    this.initScrollBar();
  }

  /**
   * 初始化右侧自定义滚动条（替代原生滚动条与跳转按钮）
   */
  private initScrollBar(): void {
    const mount = document.getElementById(Constants.Ids.IMAGE_SCROLL_BAR);
    if (!mount) return;

    const grid = document.getElementById(Constants.Ids.IMAGE_GRID);
    this.scrollBar?.destroy();
    this.scrollBar = new VirtualScrollBar({
      mount,
      getTotal: () => this.totalCount,
      getPageSize: () => this.getGridColumns() * Math.max(1, Math.ceil(this.getViewportRows())),
      onSeek: (startIndex) => {
        const container = document.getElementById(Constants.Ids.IMAGE_GRID);
        if (!container) return;
        const maxOffset = Math.max(1, this.totalCount - this.getPageSizeItems());
        const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
        container.scrollTop = (startIndex / maxOffset) * maxScrollTop;
        // 瞬时赋值可能不触发 scroll 事件，主动同步窗口
        this.windowRenderer?.refresh();
      }
    });
    this.syncScrollBarLayout();

    // 网格尺寸变化（窗口缩放、标签筛选折叠）时重新对齐滚动条并刷新 thumb
    this.scrollBarResizeObserver?.disconnect();
    this.scrollBarResizeObserver = new ResizeObserver(() => {
      this.syncScrollBarLayout();
      this.scrollBar?.update();
    });
    if (grid) this.scrollBarResizeObserver.observe(grid);
  }

  /**
   * 将滚动条与图像网格容器的可视区域实时对齐（位置与高度），
   * 标签筛选折叠/窗口缩放引起的尺寸变化由 ResizeObserver 自动响应
   */
  private syncScrollBarLayout(): void {
    const grid = document.getElementById(Constants.Ids.IMAGE_GRID);
    const bar = document.getElementById(Constants.Ids.IMAGE_SCROLL_BAR);
    if (!grid || !bar) return;
    const rect = grid.getBoundingClientRect();
    bar.style.top = `${rect.top}px`;
    bar.style.height = `${rect.height}px`;
  }

  /** 一屏可视行数 */
  private getViewportRows(): number {
    const container = document.getElementById(Constants.Ids.IMAGE_GRID);
    if (!container) return 1;
    return Math.max(1, Math.ceil(container.clientHeight / this.getGridRowHeight()));
  }

  /** 一屏项数（列数 × 可视行数） */
  private getPageSizeItems(): number {
    return Math.max(1, this.getGridColumns() * this.getViewportRows());
  }

  /**
   * 追加渲染到容器
   * 虚拟滚动模式：数据已并入 filteredImages，仅刷新窗口使新数据按需渲染
   * @param _newItems - 新加载的图像列表（已并入全量数组，无需单独处理）
   */
  private async appendToContainer(_newItems: IImage[]): Promise<void> {
    this.windowRenderer?.refresh();
  }

  /**
   * 设置卡片尺寸（重写基类）
   * 卡片尺寸变化影响网格行高与列数，既有节点坐标全部过期，强制全量重建
   */
  setCardSize(size: number): void {
    super.setCardSize(size);
    this.windowRenderer?.requestFullRerender();
    this.scrollBar?.update();
  }

  /**
   * 网格行高 = 卡片尺寸 + 行间距（.grid-view gap: 16px）
   */
  private getGridRowHeight(): number {
    return this.cardSize + GRID_GAP;
  }

  /**
   * 每行列数：容器可用宽度内能放下多少个 (卡片 + 间距)
   */
  private getGridColumns(): number {
    const container = document.getElementById(Constants.Ids.IMAGE_GRID);
    if (!container) return 1;
    const usableWidth = container.clientWidth - 8; // padding-right: 8px
    return Math.max(1, Math.floor((usableWidth + GRID_GAP) / this.getGridRowHeight()));
  }

  /**
   * 渲染可见窗口内的卡片（VirtualScroller 回调）
   * 窗口计算、增量修补与越界钳制统一由 VirtualWindowRenderer 实现
   */
  private renderWindow(range: VisibleRange): void {
    this.windowRenderer?.render(range);
  }

  /**
   * 窗口落位后确保数据覆盖：窗口尾部接近已加载数据边界时触发分页追赶。
   * 在 renderWindow 尾部调用（而非仅在 scroll 事件中判断），
   * 保证使用的是真实落位后的新窗口，避免跳转到底部等场景下
   * 因旧窗口判断失误导致底部数据永不补齐
   */
  private ensureWindowData(): void {
    if (this.isLoading || !this.hasMore) return;
    const range = this.windowRenderer?.getVisibleRange();
    if (!range || range.end === 0) return;
    const loadedCount = this.filteredImages.length;
    if (range.end >= loadedCount - Math.floor(this.pageSize / 2)) {
      void this.loadMore();
    }
  }

  /** 创建虚拟窗口渲染器并挂载（面板差异经宿主回调注入） */
  private setupVirtualScroller(container: HTMLElement, wrapper: HTMLElement): void {
    this.destroyVirtualScroller();
    this.windowRenderer = new VirtualWindowRenderer<IImage>({
      getData: () => this.filteredImages,
      getColumns: () => this.getGridColumns(),
      getRowHeight: () => this.getGridRowHeight(),
      getCardSize: () => this.cardSize,
      renderCardHtml: (img, index) => this.createCard(img, index),
      onBindContainerEvents: (data) => this.bindItemEvents(data),
      onBindItemButtons: (items) => this.bindCardButtonEvents(items),
      onLoadItemImages: async (items) => { await this.loadCardBackgroundsForItems(items); },
      onBindHoverPreview: () => this.bindHoverPreview('.image-card'),
      onWindowSettled: () => this.ensureWindowData()
    });
    this.windowRenderer.attach(container, wrapper);
  }

  private destroyVirtualScroller(): void {
    this.windowRenderer?.destroy();
    this.windowRenderer = null;
  }

  /**
   * 校验本页缩略图文件完整性；缺失且原图存在时由主进程按需重建（懒自愈）。
   * 修复结果同步到路径缓存与 filtered 数据，并强制当前窗口重建以加载新背景。
   * 每页仅在分页加载时校验一次，正常情况为主进程 N 次 fs.access，开销可忽略。
   */
  private async ensureThumbnailsForPage(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
      const result = await window.electronAPI.ensureImageThumbnails(ids);
      if (result.fixed.length === 0) return;

      cacheManager.setImagePaths(
        result.fixed.map(f => ({ imageId: f.id, fullPath: f.fullPath })),
        'thumbnail'
      );
      const byId = new Map(result.fixed.map(f => [f.id, f.relativePath]));
      for (const img of this.filteredImages) {
        const rel = byId.get(String(img.id));
        if (rel) img.thumbnailPath = rel;
      }
      // 既有窗口节点的背景图指向已失效路径，强制全量重建以加载新背景
      this.windowRenderer?.requestFullRerender();
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'Failed to ensure thumbnails:', error);
    }
  }

  /**
   * 全选（重写基类）
   * 按当前筛选条件从数据库取全量 id，可选中尚未分页加载的图像；
   * 失败时降级为基类行为（仅选中已加载项）
   */
  async selectAllVisibleItems(): Promise<void> {
    try {
      const ids = await window.electronAPI.getImageIdsByFilter(this.buildCountOptions());
      batchToolbarMiddle.selectAll(this.toolbarContext, ids);
      this.updateSelectionUI();
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'Failed to select all images by filter:', error);
      super.selectAllVisibleItems();
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
   * 计算图像数据指纹（实现基类抽象方法）
   * 包含所有影响 UI 展示的字段，新增字段自动纳入
   * 不含 updatedAt（仅影响排序，不影响展示），避免每次刷新都触发重建
   */
  protected getItemFingerprint(img: IImage): string {
    const imgWithPrompt = img as ImageWithPromptContent;
    return cyrb53(
      JSON.stringify({
        fn: img.fileName,
        tg: img.tags,
        f: img.isFavorite,
        s: img.isSafe,
        n: (img as Record<string, unknown>).note,
        tp: img.thumbnailPath,
        rp: img.relativePath,
        pr: (imgWithPrompt.promptRefs || []).map(r => ({ id: r.promptId, c: r.promptContent }))
      })
    );
  }

  /**
   * 渲染单个图像的 HTML（实现基类抽象方法）
   * 按当前视图模式生成网格卡片或列表项，index 需与旧元素保持一致
   */
  protected renderSingleItemHtml(img: IImage, index: number, _isSelected: boolean): string {
    return this.createCard(img, index);
  }

  /**
   * 加载变化图像的缩略图/背景图（实现基类抽象方法）
   * 替换 DOM 后需重新加载图片，旧元素上的背景/缩略图随替换一并移除
   */
  protected async loadItemImagesForChanged(images: IImage[]): Promise<void> {
    await this.loadCardBackgroundsForItems(images);
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
  }

  /**
   * 解绑滚动加载事件
   */
  private unbindScrollEvents(): void {
    if (!this.scrollHandler) return;

    const gridContainer = document.getElementById(Constants.Ids.IMAGE_GRID);

    gridContainer?.removeEventListener('scroll', this.scrollHandler);
    this.scrollHandler = null;
  }

  /**
   * 处理滚动事件，判断是否需要加载更多
   */
  private handleScroll(): void {
    const container = document.getElementById(Constants.Ids.IMAGE_GRID);
    if (!container) return;

    // 刷新可见窗口（rAF 合帧）；窗口落位后的数据补齐由 ensureWindowData 兜底
    this.windowRenderer?.refresh();
    this.ensureWindowData();

    // 反向同步自定义滚动条 thumb
    if (this.scrollBar) {
      const maxScrollTop = Math.max(1, container.scrollHeight - container.clientHeight);
      const ratio = Math.min(1, Math.max(0, container.scrollTop / maxScrollTop));
      const maxOffset = Math.max(1, this.totalCount - this.getPageSizeItems());
      this.scrollBar.setStartIndex(Math.round(ratio * maxOffset));
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

      // 检测数据集中新增的项（如新建/上传的图像）：
      // 虚拟滚动下不可见项不在 DOM 中，改用已加载集合判断；
      // 存在新项时降级为全量渲染，确保新卡片正确显示
      const hasNewItem = result.items.some((item) => !this.loadedImageIds.has(String(item.id)));
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

      // 指纹 diff：自动识别变化项并重建 DOM
      await this.rebuildChangedItems(result.items);

      // 刷新标签计数
      await this.refreshTagCounts();
      await this.renderTagFilters();
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'Failed to refresh incremental:', error);
      this.app.showToast?.('刷新失败', 'error');
    }
  }

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
    return document.getElementById(Constants.Ids.IMAGE_GRID);
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
 * 图像主页仅保留网格视图
 */
class ImageEventStrategy extends BaseEventStrategy {
  constructor(
    private manager: ImagePanelManager,
    private viewMode: string,
  ) {
    super();
  }

  protected getSelectors(): IEventStrategySelectors {
    return {
      checkbox: '.card-checkbox',
      item: '.image-card',
      exclude: ['.action-btn', '.card-checkbox'],
    };
  }

  protected handleOpenDetail(item: IEventStrategyItem): void {
    this.manager.openImageDetail(item as IImage);
  }
}
