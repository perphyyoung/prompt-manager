import { cacheManager, cyrb53 } from '../../utils/index.ts';
import { timeToTimestamp } from '../../utils/TimeUtils.ts';
import { PanelManagerBase, IPanelItem } from './PanelManagerBase.ts';
import { localStorageManager } from '../configs/LocalStorageConfig.ts';
import type { IApp } from '../app.types.ts';
import { PanelRenderer, UnifiedCardRenderer, PromptMainConfig } from './SharedComponents/index.ts';
import { Constants, Events } from '../../constants.ts';
import { DialogConfig } from '../services/index.ts';
import { batchToolbarMiddle } from '../../middle/index.ts';

import { IPrompt } from '../../types/entities.ts';
import { VirtualScroller, VirtualScrollBar, type VisibleRange } from '../renderer_utils/index.ts';
import { BaseEventStrategy, IEventStrategySelectors } from './Strategies/BaseEventStrategy.ts';
import { IEventStrategy, IEventStrategyItem } from './Strategies/IEventStrategy.ts';

/** .grid-view 的 gap 值（px），与 styles.css 保持一致 */
const GRID_GAP = 16;

interface ImageInfo {
  id?: string;
  thumbnailPath?: string;
  relativePath?: string;
}

/**
 * 提示词面板管理器
 * 负责提示词列表的渲染、筛选、排序、标签管理等功能
 */
export class PromptPanelManager extends PanelManagerBase {
  filteredPrompts: IPrompt[] = [];
  private isInitialized = false;

  // 分页状态
  private readonly pageSize = 100;
  private currentOffset = 0;
  private hasMore = true;
  private totalCount = 0;
  private isLoading = false;
  private loadedPromptIds = new Set<string>();
  private scrollHandler: (() => void) | null = null;

  // 虚拟滚动
  private virtualScroller: VirtualScroller | null = null;
  private lastWindowRange: VisibleRange | null = null;
  private virtualWrapper: HTMLElement | null = null;
  private lastColumns = 0;
  private scrollBar: VirtualScrollBar | null = null;
  private scrollBarResizeObserver: ResizeObserver | null = null;

  // 面板类型
  protected readonly panelType = 'prompt' as const;

  // 存储键名
  protected get storageKeys() {
    return {
      viewMode: Constants.LocalStorageKey.PROMPT_VIEW_MODE,
      sortBy: Constants.LocalStorageKey.PROMPT_SORT_BY,
      sortOrder: Constants.LocalStorageKey.PROMPT_SORT_ORDER,
      cardSize: Constants.LocalStorageKey.PROMPT_CARD_SIZE,
      tagFilterSortBy: Constants.LocalStorageKey.PROMPT_TAG_FILTER_SORT_BY,
      tagFilterSortOrder: Constants.LocalStorageKey.PROMPT_TAG_FILTER_SORT_ORDER,
      tagFilterCollapsed: Constants.LocalStorageKey.PROMPT_TAG_FILTER_COLLAPSED
    };
  }

  // 提示词特殊标签检查函数 Map
  static PROMPT_SPECIAL_TAG_PREDICATES = new Map<string, (p: IPrompt) => boolean>([
    [Constants.FAVORITE_TAG, (p) => !!p.isFavorite],
    [Constants.SAFE_TAG, (p) => p.isSafe !== 0],
    [Constants.UNSAFE_TAG, (p) => p.isSafe === 0],
    [Constants.MULTI_IMAGE_TAG, (p) => !!p.images && p.images.length >= 2],
    [Constants.NO_IMAGE_TAG, (p) => !p.images || p.images.length === 0],
    [Constants.NO_TAG_TAG, (p) => !p.tags || p.tags.length === 0],
    [Constants.SINGLE_LANG_TAG, (p) => !p.contentTranslate || p.contentTranslate.trim() === '']
  ]);

  constructor(app: IApp) {
    super({
      app: app,
      defaultCardSize: 260
    });

    // 从 localStorage 加载设置（在 super 之后，init 之前）
    // 提示词主页仅保留网格视图
    this.viewModeType = 'grid';
    this.sortBy = localStorageManager.get<string>(this.storageKeys.sortBy);
    this.sortOrder = localStorageManager.get<string>(this.storageKeys.sortOrder);
    this.cardSize = localStorageManager.get<number>(this.storageKeys.cardSize);
    this.tagFilterSortBy = localStorageManager.get<string>(this.storageKeys.tagFilterSortBy);
    this.tagFilterSortOrder = localStorageManager.get<string>(this.storageKeys.tagFilterSortOrder);

    // 初始化基类（使用 panelType 和 storageKeys）
    this.initPanelManager();

    this.filteredPrompts = [];
    this.bindTagFilterActionEvent();
    this.bindTagFilterToggleEvents();
    this.bindTagManagerEvents();
    this.bindPromptToolbarEvents();
  }

  /**
   * 绑定提示词工具栏事件
   * @private
   */
  private bindPromptToolbarEvents(): void {
    document.getElementById(Constants.Ids.PROMPT_ADD_BTN)?.addEventListener('click', () => this.app.newPromptManager?.open());
  }

  /**
   * 绑定标签筛选动作按钮事件
   * @private
   */
  private bindTagFilterActionEvent(): void {
    document.getElementById(Constants.Ids.PROMPT_TAG_FILTER_ACTION_BTN)?.addEventListener('click', () => this.handleFilterAction());
  }

  /**
   * 获取 UI 配置
   */
  protected getUIConfig() {
    return {
      cardSelector: '.prompt-card',
      listItemSelector: '.list-item--prompt',
      cardBgSelector: '.prompt-card-bg, .card__bg',
      gridContainerId: Constants.Ids.PROMPT_GRID,
      listContainerId: Constants.Ids.PROMPT_LIST,
      dragSource: 'prompt-tag',
      getCardDropSelector: () => '.prompt-card, .list-item--prompt',

      getElementId: (element: HTMLElement): string | undefined => {
        return element.dataset.id || element.dataset.promptId || undefined;
      },

      getCopyContent: (item: IPanelItem) => {
        const prompt = item as IPrompt;
        return {
          content: prompt.content || '',
          hasContent: !!prompt.content
        };
      },

      getDeleteConfirmConfig: (item: IPanelItem) => {
        const prompt = item as IPrompt;
        return {
          config: DialogConfig.DELETE_PROMPT,
          name: prompt.title || '未命名'
        };
      },

      getCardImagePath: (item: IPanelItem) => {
        const prompt = item as IPrompt;
        if (!prompt.images || prompt.images.length === 0) return null;
        const firstImage = prompt.images[0] as ImageInfo;
        return firstImage.thumbnailPath || firstImage.relativePath || null;
      },

      getCardImageId: (item: IPanelItem) => {
        const prompt = item as IPrompt;
        if (!prompt.images || prompt.images.length === 0) return null;
        const firstImage = prompt.images[0] as ImageInfo;
        return firstImage.id ? String(firstImage.id) : null;
      },

      getOpenLocationPath: (item: IPanelItem) => {
        const prompt = item as IPrompt;
        if (!prompt.images || prompt.images.length === 0) return null;
        const firstImage = prompt.images[0] as ImageInfo;
        return firstImage.relativePath || null;
      },

      getListTitle: (item: IPanelItem): string => {
        const prompt = item as IPrompt;
        return prompt.title || '无标题';
      },

      getListContent: (item: IPanelItem): string => {
        const prompt = item as IPrompt;
        return prompt.content || '';
      }
    };
  }

  /**
   * 获取过滤后的提示词列表
   */
  getFilteredPrompts(): IPrompt[] {
    return this.filteredPrompts;
  }

  /**
   * 获取当前已加载的提示词列表
   * filteredPrompts 为权威数据源（含已加载的全部分页）；
   * LRU 缓存容量有限会被淘汰，仅作初始兜底，
   * 避免滚动后缓存淘汰导致拖拽标签等按 id 查找失败
   */
  get prompts(): IPrompt[] {
    return this.filteredPrompts.length > 0
      ? this.filteredPrompts
      : Array.from(this.app.cacheManager.getPromptCache().values());
  }

  /**
   * 获取项目列表（实现基类抽象方法）
   */
  getItems(): IPrompt[] {
    return this.prompts;
  }

  /**
   * 获取搜索查询（实现基类抽象方法）
   */
  getSearchQuery(): string {
    return this.app.searchSortManager?.getPromptSearchQuery() || '';
  }

  /**
   * 检查提示词是否匹配搜索查询（实现基类抽象方法）
   * 支持标题、内容、翻译、标签、备注搜索
   */
  matchesSearch(prompt: IPrompt, lowerQuery: string): boolean {
    if (!lowerQuery) return true;
    return !!(
      prompt.title?.toLowerCase().includes(lowerQuery) ||
      prompt.content?.toLowerCase().includes(lowerQuery) ||
      prompt.contentTranslate?.toLowerCase().includes(lowerQuery) ||
      (prompt.tags && prompt.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
    );
  }

  /**
   * 获取特殊标签检查函数 Map（实现基类抽象方法）
   */
  getSpecialTagChecks(): Map<string, (item: Record<string, unknown>) => boolean> {
    return PromptPanelManager.PROMPT_SPECIAL_TAG_PREDICATES as Map<string, (item: Record<string, unknown>) => boolean>;
  }

  /**
   * 获取项目类型标识（实现基类抽象方法）
   */
  getItemType(): 'prompt' | 'image' {
    return 'prompt';
  }

  /**
   * 加载提示词数据（实现基类抽象方法）
   * 数据库分页加载第一页
   */
  async loadData(): Promise<IPrompt[]> {
    this.currentOffset = 0;
    this.hasMore = true;
    this.loadedPromptIds.clear();
    const page = await this.fetchPage();
    // 增量缓存元数据（不调用 cachePrompts 避免清空改变 LRU 顺序）
    for (const prompt of page.items) {
      cacheManager.cachePrompt(prompt);
      this.loadedPromptIds.add(String(prompt.id));
    }
    this.totalCount = page.totalCount;
    this.hasMore = page.items.length < page.totalCount;
    // 预缓存提示词关联的第一张图的路径（缩略图用）
    await this.prefetchPromptImagePaths(page.items);
    // 重建指纹基准（全量渲染后所有项视为"已同步"）
    this.itemFingerprints = new Map(
      page.items.map(p => [String(p.id), this.getItemFingerprint(p)])
    );
    // 失败时保留旧缓存：数据仍以数据库为准，清空只会导致后续全部重新 IPC
    return page.items;
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
  private buildPaginatedOptions(): import('../../main/database-types.js').GetPromptsPaginatedOptions {
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
   * 分页获取提示词
   */
  private async fetchPage(): Promise<{ items: IPrompt[]; totalCount: number }> {
    const options = this.buildPaginatedOptions();
    return await window.electronAPI.getPromptsPaginated(options);
  }

  /**
   * 加载更多提示词
   */
  async loadMore(): Promise<void> {
    if (this.isLoading || !this.hasMore) {
      return;
    }

    this.isLoading = true;
    try {
      this.currentOffset += this.pageSize;
      const page = await this.fetchPage();

      const newItems = page.items.filter(prompt => !this.loadedPromptIds.has(String(prompt.id)));
      for (const prompt of newItems) {
        this.loadedPromptIds.add(String(prompt.id));
        cacheManager.cachePrompt(prompt);
      }
      // 预缓存新加载项的路径
      if (newItems.length > 0) {
        await this.prefetchPromptImagePaths(newItems);
      }

      this.filteredPrompts = [...this.filteredPrompts, ...newItems];
      this.filteredItems = this.filteredPrompts;
      this.hasMore = this.filteredPrompts.length < page.totalCount;

      if (newItems.length > 0) {
        // 补录新加载项的指纹（DOM 渲染由虚拟窗口按需完成）
        for (const prompt of newItems) {
          this.itemFingerprints.set(String(prompt.id), this.getItemFingerprint(prompt));
        }
        this.virtualScroller?.refresh();
      }
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to load more prompts:', error);
      this.app.showToast?.('加载更多提示词失败', 'error');
    } finally {
      this.isLoading = false;
    }

    // 窗口仍接近未加载数据边界时继续追赶（快速拖动滚动条场景）
    this.ensureWindowData();
  }

  /**
   * 预缓存提示词关联的第一张图（卡片背景）的缩略图路径
   * 仅加载缩略图（卡片背景用），不加载原图
   */
  private async prefetchPromptImagePaths(prompts: IPrompt[]): Promise<void> {
    if (prompts.length === 0) return;

    // 收集所有第一张图 ID，去重
    const firstImageIds = new Set<string>();
    for (const p of prompts) {
      if (p.images && p.images.length > 0) {
        const firstImage = p.images[0] as ImageInfo;
        if (firstImage.id) {
          firstImageIds.add(String(firstImage.id));
        }
      }
    }

    if (firstImageIds.size === 0) return;

    // 仅获取未在路径缓存中的图元数据
    const needFetchIds: string[] = [];
    const needFetchImages: Array<{ id: string; relativePath?: string; thumbnailPath?: string }> = [];
    for (const imageId of firstImageIds) {
      if (cacheManager.getImagePath(imageId, 'thumbnail')) continue;
      const cached = cacheManager.getImageCache().peek(imageId) as { id: string; relativePath?: string; thumbnailPath?: string } | undefined;
      if (cached) {
        needFetchImages.push(cached);
      } else {
        needFetchIds.push(imageId);
      }
    }

    let fetchedImages: Array<{ id: string; relativePath?: string; thumbnailPath?: string }> = [];
    if (needFetchIds.length > 0) {
      try {
        const imgs = await window.electronAPI.getImagesByIds(needFetchIds);
        for (const img of imgs) {
          if (img && img.id) {
            cacheManager.cacheImage(img);
            fetchedImages.push(img as { id: string; relativePath?: string; thumbnailPath?: string });
          }
        }
      } catch (error) {
        window.electronAPI.logError('PromptPanelManager.ts', 'Failed to fetch first images by ids:', error);
      }
    }

    // 统一预缓存缩略图路径
    const allImages = [...needFetchImages, ...fetchedImages];
    await cacheManager.prefetchImagePaths(allImages, window.electronAPI);
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
   * 提示词面板使用数据库分页查询，不走前端过滤排序
   */
  async renderView(): Promise<void> {
    try {
      const filtered = await this.loadData();
      this.filteredItems = filtered;
      this.filteredPrompts = filtered;

      await this.renderContainer(filtered);
      await this.afterRenderContainer(filtered);
      await this.refreshTagCounts();
      await this.renderTagFilters();
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to render prompt list:', error);
      this.app.showToast?.('加载提示词失败', 'error');
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
   * 追加渲染到容器
   * 虚拟滚动模式：数据已并入 filteredPrompts，仅刷新窗口使新数据按需渲染
   * @param _newItems - 新加载的提示词列表（已并入全量数组，无需单独处理）
   */
  private async appendToContainer(_newItems: IPrompt[]): Promise<void> {
    this.virtualScroller?.refresh();
  }

  /**
   * 网格行高 = 卡片尺寸 + 行间距（.grid-view gap: 16px）
   */
  private getPromptRowHeight(): number {
    return this.cardSize + GRID_GAP;
  }

  /**
   * 每行列数：容器可用宽度内能放下多少个 (卡片 + 间距)
   */
  private getPromptColumns(): number {
    const container = document.getElementById(Constants.Ids.PROMPT_GRID);
    if (!container) return 1;
    const usableWidth = container.clientWidth - 8; // padding-right: 8px
    return Math.max(1, Math.floor((usableWidth + GRID_GAP) / this.getPromptRowHeight()));
  }

  /**
   * 渲染可见窗口内的卡片（VirtualScroller 回调）
   * 与上次窗口有重叠且列数未变时走增量路径（head/tail 增删节点，复用已有卡片 DOM，
   * 背景图不重复加载）；窗口跳跃、首次渲染或几何变化时全量重建
   */
  private renderWindow(range: VisibleRange): void {
    const wrapper = this.virtualWrapper;
    if (!wrapper) return;

    // 几何失效：列数变化后既有节点的坐标全部过期，强制全量重建
    const columns = this.getPromptColumns();
    if (columns !== this.lastColumns) {
      this.lastWindowRange = null;
      this.lastColumns = columns;
    }

    const prev = this.lastWindowRange;
    // 有重叠即可增量修补（head/tail 增删），无重叠说明窗口跳跃过大，走全量重建
    const canPatch = prev !== null && range.start < prev.end && prev.start < range.end;

    if (!prev || !canPatch) {
      this.rebuildWindow(wrapper, range);
      return;
    }

    // ---- 增量路径：仅创建/移除进出视口的卡片 ----
    const added: IPrompt[] = [];
    const parseNodes = (prompt: IPrompt, index: number): Node[] => {
      added.push(prompt);
      const doc = new DOMParser().parseFromString(this.createPositionedCard(prompt, index), 'text/html');
      return Array.from(doc.body.childNodes);
    };

    if (range.start > prev.start) {
      for (let i = 0; i < range.start - prev.start; i++) {
        wrapper.firstElementChild?.remove();
      }
    } else if (range.start < prev.start) {
      const frag = document.createDocumentFragment();
      for (let i = range.start; i < prev.start; i++) {
        frag.append(...parseNodes(this.filteredPrompts[i], i));
      }
      wrapper.insertBefore(frag, wrapper.firstChild);
    }

    if (range.end > prev.end) {
      const frag = document.createDocumentFragment();
      for (let i = prev.end; i < range.end; i++) {
        frag.append(...parseNodes(this.filteredPrompts[i], i));
      }
      wrapper.append(frag);
    } else if (range.end < prev.end) {
      for (let i = 0; i < prev.end - range.end; i++) {
        wrapper.lastElementChild?.remove();
      }
    }

    this.bindItemEvents(this.filteredPrompts);
    if (added.length > 0) {
      this.bindCardButtonEvents(added);
      void this.loadCardBackgroundsForItems(added);
      this.bindHoverPreview('.prompt-card');
    }
    this.lastWindowRange = { start: range.start, end: range.end };
    this.ensureWindowData();
  }

  /**
   * 生成带 absolute 定位壳的卡片 HTML
   */
  private createPositionedCard(prompt: IPrompt, index: number): string {
    const columns = Math.max(1, this.getPromptColumns());
    const row = Math.floor(index / columns);
    const col = index % columns;
    const top = row * this.getPromptRowHeight();
    const left = col * this.getPromptRowHeight();
    return `<div class="virtual-item" style="top:${top}px;left:${left}px;width:${this.cardSize}px;height:${this.cardSize}px">${this.createCard(prompt, index)}</div>`;
  }

  /** 全量重建窗口内容 */
  private rebuildWindow(wrapper: HTMLElement, range: VisibleRange): void {
    const html = Array.from(
      { length: Math.max(0, range.end - range.start) },
      (_, i) => this.createPositionedCard(this.filteredPrompts[range.start + i], range.start + i)
    ).join('');

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    wrapper.replaceChildren(...Array.from(doc.body.childNodes));

    this.bindItemEvents(this.filteredPrompts);
    const windowItems = this.filteredPrompts.slice(range.start, range.end);
    if (windowItems.length > 0) {
      this.bindCardButtonEvents(windowItems);
      void this.loadCardBackgroundsForItems(windowItems);
    }
    this.bindHoverPreview('.prompt-card');
    this.lastWindowRange = { start: range.start, end: range.end };
    this.ensureWindowData();
  }

  /**
   * 窗口落位后确保数据覆盖：窗口尾部接近已加载数据边界时触发分页追赶。
   */
  private ensureWindowData(): void {
    if (this.isLoading || !this.hasMore) return;
    const range = this.virtualScroller?.getVisibleRange();
    if (!range || range.end === 0) return;
    const loadedCount = this.filteredPrompts.length;
    if (range.end >= loadedCount - Math.floor(this.pageSize / 2)) {
      void this.loadMore();
    }
  }

  /**
   * 初始化右侧自定义滚动条（替代原生滚动条与跳转按钮）
   */
  private initScrollBar(): void {
    const mount = document.getElementById(Constants.Ids.PROMPT_SCROLL_BAR);
    if (!mount) return;

    this.scrollBar?.destroy();
    this.scrollBar = new VirtualScrollBar({
      mount,
      getTotal: () => this.totalCount,
      getPageSize: () => this.getPromptColumns() * Math.max(1, Math.ceil(this.getViewportRows())),
      onSeek: (startIndex) => {
        const container = document.getElementById(Constants.Ids.PROMPT_GRID);
        if (!container) return;
        const maxOffset = Math.max(1, this.totalCount - this.getPageSizeItems());
        const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
        container.scrollTop = (startIndex / maxOffset) * maxScrollTop;
        // 瞬时赋值可能不触发 scroll 事件，主动同步窗口
        this.virtualScroller?.refresh();
      }
    });
    this.syncScrollBarLayout();

    // 网格尺寸变化（窗口缩放、标签筛选折叠）时重新对齐滚动条并刷新 thumb
    this.scrollBarResizeObserver?.disconnect();
    this.scrollBarResizeObserver = new ResizeObserver(() => {
      this.syncScrollBarLayout();
      this.scrollBar?.update();
    });
    const grid = document.getElementById(Constants.Ids.PROMPT_GRID);
    if (grid) this.scrollBarResizeObserver.observe(grid);
  }

  /**
   * 将滚动条与提示词网格容器的可视区域实时对齐（位置与高度）
   */
  private syncScrollBarLayout(): void {
    const grid = document.getElementById(Constants.Ids.PROMPT_GRID);
    const bar = document.getElementById(Constants.Ids.PROMPT_SCROLL_BAR);
    if (!grid || !bar) return;
    const rect = grid.getBoundingClientRect();
    bar.style.top = `${rect.top}px`;
    bar.style.height = `${rect.height}px`;
  }

  /** 一屏可视行数 */
  private getViewportRows(): number {
    const container = document.getElementById(Constants.Ids.PROMPT_GRID);
    if (!container) return 1;
    return Math.max(1, Math.ceil(container.clientHeight / this.getPromptRowHeight()));
  }

  /** 一屏项数（列数 × 可视行数） */
  private getPageSizeItems(): number {
    return Math.max(1, this.getPromptColumns() * this.getViewportRows());
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
   * 异步加载指定提示词卡片的背景图
   * 优先从路径缓存读取，未命中时单次 IPC 批量兜底并回写缓存
   * @param items - 需要加载背景图的提示词列表
   */
  private async loadCardBackgroundsForItems(items: IPrompt[]): Promise<void> {
    const container = document.getElementById(Constants.Ids.PROMPT_GRID);
    if (!container) return;

    const itemIds = new Set(items.map(p => String(p.id)));
    const cards = container.querySelectorAll('.prompt-card');
    const uncached: Array<{ imageId: string; relativePath: string; card: HTMLElement }> = [];

    for (const card of cards) {
      const promptId = (card as HTMLElement).dataset.id;
      if (!promptId || !itemIds.has(promptId)) continue;

      const prompt = items.find(p => String(p.id) === String(promptId));
      if (!prompt || !prompt.images || prompt.images.length === 0) continue;
      const firstImage = prompt.images[0] as ImageInfo;
      const imageId = firstImage.id ? String(firstImage.id) : null;
      const imagePath = firstImage.thumbnailPath || firstImage.relativePath;
      if (!imageId || !imagePath) continue;

      // 路径缓存的"纯读"：仅当缓存命中时直接使用
      const cachedPath = cacheManager.getImagePath(imageId, 'thumbnail');
      if (cachedPath) {
        const bgElement = card.querySelector('.prompt-card-bg, .card__bg');
        if (bgElement) {
          (bgElement as HTMLElement).style.backgroundImage = `url('file://${cachedPath.replace(/\\/g, '/')}')`;
        }
        continue;
      }

      // 缓存未命中 → 收集后单次 IPC 兜底
      uncached.push({ imageId, relativePath: imagePath, card: card as HTMLElement });
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
          const bgElement = u.card.querySelector('.prompt-card-bg, .card__bg');
          if (bgElement) {
            (bgElement as HTMLElement).style.backgroundImage = `url('file://${fullPath.replace(/\\/g, '/')}')`;
          }
        }
      });
      cacheManager.setImagePaths(entries, 'thumbnail');
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to load card backgrounds (fallback):', error);
    }
  }

  /**
   * 渲染容器（实现基类抽象方法）
   * 虚拟滚动：totalCount 已知时撑起完整滚动高度，DOM 只渲染可见窗口
   */
  async renderContainer(filtered: IPrompt[]): Promise<void> {
    this.filteredPrompts = filtered;

    const container = document.getElementById(Constants.Ids.PROMPT_GRID);
    const currentSearchQuery = this.getSearchQuery();

    if (filtered.length === 0) {
      this.destroyVirtualScroller();
      this.scrollBarResizeObserver?.disconnect();
      this.scrollBarResizeObserver = null;
      this.scrollBar?.destroy();
      this.scrollBar = null;
      if (currentSearchQuery) {
        PanelRenderer.showEmptyState(Constants.Ids.PROMPT_GRID, Constants.Ids.PROMPT_EMPTY_STATE, `未找到匹配"${currentSearchQuery}"的提示词`, '搜索无结果');
      } else if (this.selectedTags.size > 0) {
        const selectedTagNames = Array.from(this.selectedTags).join(', ');
        PanelRenderer.showEmptyState(Constants.Ids.PROMPT_GRID, Constants.Ids.PROMPT_EMPTY_STATE, `没有符合标签"${selectedTagNames}"的提示词`, '筛选无结果');
      } else {
        PanelRenderer.showEmptyState(Constants.Ids.PROMPT_GRID, Constants.Ids.PROMPT_EMPTY_STATE, '暂无提示词');
      }
      return;
    }

    PanelRenderer.hideEmptyState(Constants.Ids.PROMPT_GRID, Constants.Ids.PROMPT_EMPTY_STATE);

    // wrapper 模式下不再使用 CSS grid 排布（卡片由 absolute 定位），覆盖为块级滚动容器
    container!.style.display = 'block';
    container!.innerHTML = '';

    // lap 模式：固定高度 wrapper 撑起 scrollHeight，可见卡片 absolute 定位其上
    const wrapper = document.createElement('div');
    wrapper.className = 'virtual-wrapper';
    container!.appendChild(wrapper);
    this.setupVirtualScroller(container!, wrapper);
    this.bindCardDropEvents(container!);

    // totalCount 为数据库全量计数：wrapper 总高立即覆盖全部数据，
    // 初始窗口经 rAF 异步渲染
    this.virtualScroller!.setTotalCount(this.totalCount);
    this.initScrollBar();
  }

  private setupVirtualScroller(container: HTMLElement, wrapper: HTMLElement): void {
    this.destroyVirtualScroller();
    this.lastWindowRange = null;
    this.virtualWrapper = wrapper;
    this.lastColumns = this.getPromptColumns();
    this.virtualScroller = new VirtualScroller(
      {
        container,
        wrapper,
        getRowHeight: () => this.getPromptRowHeight(),
        getColumns: () => this.getPromptColumns()
      },
      (range) => this.renderWindow(range)
    );
    this.virtualScroller.observeResize();
  }

  private destroyVirtualScroller(): void {
    this.virtualScroller?.destroy();
    this.virtualScroller = null;
    this.virtualWrapper = null;
    this.lastWindowRange = null;
  }

  /**
   * 创建提示词卡片 HTML（实现基类抽象方法）
   */
  createCard(prompt: IPrompt, index?: number): string {
    return UnifiedCardRenderer.render(PromptMainConfig, prompt, {
      icons: Constants.ICONS,
      sortBy: this.sortBy,
      app: this.app,
      selectedIds: batchToolbarMiddle.getSelectedIds(this.toolbarContext),
      index
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
        const promptId = (element as HTMLElement).dataset.id || (element as HTMLElement).dataset.promptId;
        const prompt = this.prompts.find(p => String(p.id) === String(promptId));
        return prompt ? prompt.content : '';
      },
      getImageId: (element: Element) => {
        const firstImage = (element as HTMLElement).dataset.firstImage;
        return firstImage || null;
      },
      delay: 500
    });
  }

  /**
   * 绑定滚动加载事件
   */
  private bindScrollEvents(): void {
    this.unbindScrollEvents();

    const gridContainer = document.getElementById(Constants.Ids.PROMPT_GRID);

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

    const gridContainer = document.getElementById(Constants.Ids.PROMPT_GRID);

    gridContainer?.removeEventListener('scroll', this.scrollHandler);
    this.scrollHandler = null;
  }

  /**
   * 处理滚动事件，判断是否需要加载更多
   */
  private handleScroll(): void {
    const container = document.getElementById(Constants.Ids.PROMPT_GRID);
    if (!container) return;

    // 刷新可见窗口（rAF 合帧）；窗口落位后的数据补齐由 ensureWindowData 兜底
    this.virtualScroller?.refresh();
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
   * 获取标签筛选容器 ID（实现基类抽象方法）
   */
  getTagFilterContainerId(): string {
    return Constants.Ids.PROMPT_TAG_FILTER_LIST;
  }

  /**
   * 获取特殊标签容器 ID（实现基类抽象方法）
   */
  getSpecialTagsContainerId(): string {
    return Constants.Ids.PROMPT_TAG_FILTER_SPECIAL_TAGS;
  }

  /**
   * 获取筛选动作按钮 ID（实现基类抽象方法）
   */
  getFilterActionBtnId(): string {
    return Constants.Ids.PROMPT_TAG_FILTER_ACTION_BTN;
  }

  /**
   * 获取标签筛选收起/展开按钮 ID（实现基类抽象方法）
   */
  getTagFilterToggleBtnId(): string {
    return Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN;
  }

  /**
   * 获取标签管理器按钮 ID（实现基类抽象方法）
   */
  getTagManagerBtnId(): string {
    return Constants.Ids.PROMPT_TAG_MANAGER_BTN;
  }

  /**
   * 打开标签管理器模态框（实现基类抽象方法）
   */
  protected async openTagManagerModal(): Promise<void> {
    await this.app.openPromptTagManagerModal();
  }

  /**
   * 获取标签筛选头部容器 ID（实现基类抽象方法）
   */
  getTagFilterHeaderContainerId(): string {
    return Constants.Ids.PROMPT_TAG_FILTER_HEADER_TAGS;
  }

  /**
   * 获取标签筛选排序选择器 ID（实现基类抽象方法）
   */
  getTagFilterSortSelectId(): string {
    return Constants.Ids.PROMPT_TAG_FILTER_SORT_SELECT;
  }

  /**
   * 获取标签筛选排序顺序按钮 ID（实现基类抽象方法）
   */
  getTagFilterOrderBtnId(): string {
    return Constants.Ids.PROMPT_TAG_FILTER_ORDER_BTN;
  }

  /**
   * 获取反选按钮 ID（实现基类抽象方法）
   */
  getInvertedFilterBtnId(): string {
    return Constants.Ids.PROMPT_TAG_FILTER_INVERT_BTN;
  }

  /**
   * 获取标签拖拽类型（实现基类抽象方法）
   */
  getTagDragType(): string {
    return 'prompt-tag';
  }

  /**
   * 获取所有标签（实现基类抽象方法）
   */
  async getAllTags(): Promise<string[]> {
    return window.electronAPI.getPromptTags();
  }

  private lastTagCounts: Record<string, number> = {};

  private lastSpecialTagCounts: import('../../main/database-types.js').PromptSpecialTagCounts = {
    favorite: 0,
    safe: 0,
    unsafe: 0,
    multiImage: 0,
    noImage: 0,
    noTag: 0,
    singleLang: 0
  };

  /**
   * 计算标签计数（重写基类方法）
   * 基于数据库统计，不受分页影响
   */
  calculateTagCounts(_tags: string[]): Record<string, number> {
    return this.lastTagCounts;
  }

  /**
   * 异步刷新标签计数
   */
  private async refreshTagCounts(): Promise<void> {
    try {
      const options = this.buildCountOptions();
      const [tagCounts, specialTagCounts] = await Promise.all([
        window.electronAPI.countPromptTags(options),
        window.electronAPI.countPromptSpecialTags(options)
      ]);
      this.lastTagCounts = tagCounts;
      this.lastSpecialTagCounts = specialTagCounts;
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to refresh tag counts:', error);
    }
  }

  /**
   * 构建计数查询选项
   */
  private buildCountOptions(): import('../../main/database-types.js').CountPromptTagsOptions {
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
  calculateSpecialTagCounts(_visibleItems: IPrompt[]): { tag: string; count: number }[] {
    const specialTags: { tag: string; count: number }[] = [];
    const counts = this.lastSpecialTagCounts;

    if (counts.favorite > 0) {
      specialTags.push({ tag: Constants.FAVORITE_TAG, count: counts.favorite });
    }
    if (counts.multiImage > 0) {
      specialTags.push({ tag: Constants.MULTI_IMAGE_TAG, count: counts.multiImage });
    }
    if (counts.noImage > 0) {
      specialTags.push({ tag: Constants.NO_IMAGE_TAG, count: counts.noImage });
    }
    if (counts.noTag > 0) {
      specialTags.push({ tag: Constants.NO_TAG_TAG, count: counts.noTag });
    }
    if (counts.singleLang > 0) {
      specialTags.push({ tag: Constants.SINGLE_LANG_TAG, count: counts.singleLang });
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
   * 删除提示词（实现基类抽象方法）
   */
  async deleteItem(id: string): Promise<void> {
    try {
      await window.electronAPI.softDeletePrompt(id);
      cacheManager.removeCachedItem(id, 'prompt');
      const prompt = this.prompts.find(p => String(p.id) === String(id));
      if (prompt) {
        prompt.isDeleted = true;
      }
      // 增量刷新：保持分页位置，仅移除已删除项，避免重置到第一页
      await this.refreshIncremental();
      this.app.eventBus.emit(Events.PROMPTS_CHANGED, { prompts: this.prompts });

      // 通知图像面板刷新（关联的图像已移除该提示词）
      this.app.eventBus.emit(Events.IMAGES_CHANGED);

      // 刷新回收站
      if (this.app.trashManager) {
        await this.app.trashManager.loadTrash();
      }

      // 刷新统计界面
      if (this.app.currentPanel === 'statistics') {
        await this.app.renderStatistics?.();
      }

      this.app.showToast('提示词已删除', 'success');
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to delete prompt:', error);
      this.app.showToast('删除失败：' + (error as Error).message, 'error');
    }
  }

  /**
   * 切换收藏状态（实现基类抽象方法）
   */
  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    try {
      await window.electronAPI.updatePrompt(id, { isFavorite: isFavorite ? 1 : 0 });

      // 更新本地数据
      const prompt = this.prompts.find(p => String(p.id) === String(id));
      if (prompt) {
        prompt.isFavorite = isFavorite ? 1 : 0;
      }

      this.app.showToast(isFavorite ? '已收藏' : '已取消收藏', 'success');
      this.updateFavoriteUI(id, isFavorite);
      this.renderTagFilters();
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'toggleFavorite error:', error);
      this.app.showToast('操作失败：' + (error as Error).message, 'error');
    }
  }

  /**
   * 排序提示词列表（实现基类抽象方法）
   */
  sortItems(items: IPrompt[], sortBy: string, sortOrder: string): IPrompt[] {
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
        case 'title':
          valueA = (a.title || '').toLowerCase();
          valueB = (b.title || '').toLowerCase();
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
   * 计算提示词数据指纹（实现基类抽象方法）
   * 包含所有影响 UI 展示的字段，新增字段自动纳入
   */
  protected getItemFingerprint(prompt: IPrompt): string {
    return cyrb53(
      JSON.stringify({
        t: prompt.title,
        c: prompt.content,
        ct: (prompt as Record<string, unknown>).contentTranslate,
        tg: prompt.tags,
        f: prompt.isFavorite,
        s: prompt.isSafe,
        n: (prompt as Record<string, unknown>).note,
        im: (prompt.images || []).map((img: ImageInfo | string) =>
          typeof img === 'object' ? img.id ?? '' : img
        ),
      }),
    );
  }

  /**
   * 增量刷新：保持当前分页状态，重新获取已加载范围的数据
   * 使用指纹 diff 自动识别变化项，对变化项做单元素重建
   * 用于从详情页返回等场景，避免重置分页状态导致已加载数据丢失
   */
  private async refreshIncremental(): Promise<void> {
    try {
      // 保持 currentOffset 和 loadedPromptIds，重新获取当前已加载范围的数据
      const options = this.buildPaginatedOptions();
      options.limit = this.currentOffset + this.pageSize;
      options.offset = 0;

      const result = await window.electronAPI.getPromptsPaginated(options);

      // 检测数据集中新增的项（如新建的提示词）：
      // 虚拟滚动下不可见项不在 DOM 中，改用已加载集合判断；
      // 存在新项时降级为全量渲染，确保新卡片正确显示
      const hasNewItem = result.items.some((item) => !this.loadedPromptIds.has(String(item.id)));
      if (hasNewItem) {
        await this.renderView();
        return;
      }

      // 更新缓存和 filteredPrompts
      this.filteredPrompts = result.items;
      this.filteredItems = result.items;
      this.hasMore = result.items.length < result.totalCount;
      this.totalCount = result.totalCount;

      // 更新 loadedPromptIds
      this.loadedPromptIds.clear();
      for (const prompt of result.items) {
        this.loadedPromptIds.add(String(prompt.id));
        cacheManager.cachePrompt(prompt);
      }

      // 补充路径缓存（仅缺失的项）
      await this.prefetchPromptImagePaths(result.items);

      // 清理不再匹配筛选结果的 DOM 项（如"无标"筛选下添加标签）
      this.removeStaleDomItems(result.items);

      // 指纹 diff：自动识别变化项并重建 DOM
      await this.rebuildChangedItems(result.items);

      // 刷新标签计数
      await this.refreshTagCounts();
      await this.renderTagFilters();
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to refresh incremental:', error);
      this.app.showToast?.('刷新失败', 'error');
    }
  }

  /**
   * 渲染单个提示词的 HTML（实现基类抽象方法）
   * 按当前视图模式生成网格卡片或列表项，index 需与旧元素保持一致
   */
  protected renderSingleItemHtml(prompt: IPrompt, index: number, _isSelected: boolean): string {
    return this.createCard(prompt, index);
  }

  /**
   * 设置卡片尺寸（重写基类）
   * 卡片尺寸变化影响网格行高与列数，既有节点坐标全部过期，强制全量重建
   */
  setCardSize(size: number): void {
    super.setCardSize(size);
    this.lastWindowRange = null;
    this.virtualScroller?.refresh(true);
    this.scrollBar?.update();
  }

  /**
   * 加载变化提示词的缩略图/背景图（实现基类抽象方法）
   * 替换 DOM 后需重新加载图片，旧元素上的背景/缩略图随替换一并移除
   */
  protected async loadItemImagesForChanged(prompts: IPrompt[]): Promise<void> {
    await this.loadCardBackgroundsForItems(prompts);
  }

  /**
   * 订阅事件（重写基类方法）
   */
  subscribeToEvents(): void {
    this.app.eventBus.on(Events.PROMPTS_CHANGED, () => {
      this.refreshAfterUpdate();
    });
  }

  /**
   * 获取当前视图的事件策略
   */
  protected getEventStrategy(): IEventStrategy | null {
    return new PromptEventStrategy(this, this.viewModeType);
  }

  /**
   * 获取当前视图的容器元素
   */
  protected getCurrentContainer(): HTMLElement | null {
    return document.getElementById(Constants.Ids.PROMPT_GRID);
  }

  /**
   * 打开提示词编辑
   */
  openPromptDetail(prompt: IPrompt): void {
    this.app.openEditPromptModal(prompt, { filteredList: this.filteredPrompts });
  }
}

/**
 * 提示词统一事件策略
 * 提示词主页仅保留网格视图
 */
class PromptEventStrategy extends BaseEventStrategy {
  constructor(
    private manager: PromptPanelManager,
    private viewMode: string,
  ) {
    super();
  }

  protected getSelectors(): IEventStrategySelectors {
    return {
      checkbox: '.card-checkbox',
      item: '.prompt-card',
      exclude: ['.action-btn', '.card-checkbox'],
    };
  }

  protected handleOpenDetail(item: IEventStrategyItem): void {
    this.manager.openPromptDetail(item as IPrompt);
  }
}
