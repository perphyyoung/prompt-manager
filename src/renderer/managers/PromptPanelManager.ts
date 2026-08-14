import { cacheManager } from '../../utils/index.ts';
import { timeToTimestamp } from '../../utils/TimeUtils.ts';
import { PanelManagerBase, IPanelItem } from './PanelManagerBase.ts';
import { localStorageManager } from '../configs/LocalStorageConfig.ts';
import type { IApp } from '../app.types.ts';
import { PanelRenderer, UnifiedCardRenderer, PromptMainConfig, UnifiedListRenderer, PromptListConfig } from './SharedComponents/index.ts';
import { Constants, Events } from '../../constants.ts';
import { DialogConfig } from '../services/index.ts';
import { batchToolbarMiddle } from '../../middle/index.ts';

import { IPrompt } from '../../types/entities.ts';
import { BaseEventStrategy, IEventStrategySelectors } from './Strategies/BaseEventStrategy.ts';
import { IEventStrategy, IEventStrategyItem } from './Strategies/IEventStrategy.ts';
import { TagUI } from './TagUI.ts';

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
  private readonly pageSize = 500;
  private currentOffset = 0;
  private hasMore = true;
  private totalCount = 0;
  private isLoading = false;
  private loadedPromptIds = new Set<string>();
  private scrollHandler: (() => void) | null = null;

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
    this.viewModeType = localStorageManager.get<string>(this.storageKeys.viewMode);
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
   * 获取提示词列表（从缓存读取）
   */
  get prompts(): IPrompt[] {
    return Array.from(this.app.cacheManager.getPromptCache().values());
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
    try {
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
      return page.items;
    } catch (error) {
      cacheManager.getPromptCache().clear();
      throw error;
    }
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
        await this.appendToContainer(newItems);
        // 重新绑定事件，让闭包包含所有已加载提示词
        this.bindItemEvents(this.filteredPrompts);
      }
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to load more prompts:', error);
      this.app.showToast?.('加载更多提示词失败', 'error');
    } finally {
      this.isLoading = false;
    }
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
   * @param newItems - 新加载的提示词列表
   */
  private async appendToContainer(newItems: IPrompt[]): Promise<void> {
    const container = document.getElementById(Constants.Ids.PROMPT_GRID);
    const listContainer = document.getElementById(Constants.Ids.PROMPT_LIST);
    if (!container || !listContainer) return;

    if (this.viewModeType === 'grid') {
      const html = newItems.map((prompt, index) => this.createCard(prompt, this.filteredPrompts.length - newItems.length + index)).join('');
      this.appendHtmlToContainer(container, html);
      this.bindCardButtonEvents(newItems);
      await this.loadCardBackgroundsForItems(newItems);
      this.bindHoverPreview('.prompt-card');
    } else {
      const isCompact = this.viewModeType === 'list-compact';
      const html = newItems.map((prompt, index) =>
        UnifiedListRenderer.render(PromptListConfig, prompt, {
          icons: Constants.ICONS,
          isCompact,
          isSelected: batchToolbarMiddle.isSelected(this.toolbarContext, String(prompt.id)),
          index: this.filteredPrompts.length - newItems.length + index
        })
      ).join('');
      this.appendHtmlToContainer(listContainer, html);
      this.bindListButtonEvents(newItems);
      this.bindHoverPreview('.list-item--prompt');
      await this.loadPromptListThumbnails(newItems);
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
   */
  async renderContainer(filtered: IPrompt[]): Promise<void> {
    this.filteredPrompts = filtered;

    const container = document.getElementById(Constants.Ids.PROMPT_GRID);
    const listContainer = document.getElementById(Constants.Ids.PROMPT_LIST);
    const currentSearchQuery = this.getSearchQuery();

    if (filtered.length === 0) {
      if (currentSearchQuery) {
        PanelRenderer.showEmptyState(Constants.Ids.PROMPT_GRID, Constants.Ids.PROMPT_EMPTY_STATE, `未找到匹配"${currentSearchQuery}"的提示词`, '搜索无结果');
      } else if (this.selectedTags.size > 0) {
        const selectedTagNames = Array.from(this.selectedTags).join(', ');
        PanelRenderer.showEmptyState(Constants.Ids.PROMPT_GRID, Constants.Ids.PROMPT_EMPTY_STATE, `没有符合标签"${selectedTagNames}"的提示词`, '筛选无结果');
      } else {
        PanelRenderer.showEmptyState(Constants.Ids.PROMPT_GRID, Constants.Ids.PROMPT_EMPTY_STATE, '暂无提示词');
      }
      if (listContainer) listContainer.style.display = 'none';
      return;
    }

    PanelRenderer.hideEmptyState(Constants.Ids.PROMPT_GRID, Constants.Ids.PROMPT_EMPTY_STATE);

    // 根据视图模式渲染
    if (this.viewModeType === 'grid') {
      container!.style.display = 'grid';
      if (listContainer) listContainer.style.display = 'none';

      // 渲染网格视图
      PanelRenderer.renderGrid(filtered, (prompt) => this.createCard(prompt as IPrompt), Constants.Ids.PROMPT_GRID);
      this.bindItemEvents(filtered);
      this.bindCardButtonEvents(filtered);
      this.loadCardBackgrounds();
      this.bindHoverPreview('.prompt-card');
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
   * 渲染提示词列表视图（实现基类抽象方法）
   */
  async renderListView(filtered: IPrompt[]): Promise<void> {
    const listContainer = document.getElementById(Constants.Ids.PROMPT_LIST);
    if (!listContainer) return;

    const isCompact = this.viewModeType === 'list-compact';

    // 使用统一列表渲染器生成列表项 HTML
    const listItemsHtml = filtered.map((prompt, index) =>
      UnifiedListRenderer.render(PromptListConfig, prompt, {
        icons: Constants.ICONS,
        isCompact,
        isSelected: batchToolbarMiddle.isSelected(this.toolbarContext, String(prompt.id)),
        index
      })
    );

    listContainer.innerHTML = listItemsHtml.join('');

    // 异步加载提示词列表缩略图
    await this.loadPromptListThumbnails(filtered);

    // 绑定事件
    this.bindItemEvents(filtered);
    this.bindListButtonEvents(filtered);
    this.bindHoverPreview('.list-item--prompt');
    this.bindCardDropEvents(listContainer);
    // updateToolbarUI 由调用方（setViewMode/onChange）统一处理，避免重复调用
  }

  /**
   * 异步加载提示词列表缩略图
   * 优先从路径缓存读取，未命中时单次 IPC 批量兜底
   */
  async loadPromptListThumbnails(filtered: IPrompt[]): Promise<void> {
    const listContainer = document.getElementById(Constants.Ids.PROMPT_LIST);
    if (!listContainer) return;

    const items = listContainer.querySelectorAll('.list-item--prompt');

    // 第一步：补齐元数据缓存
    const imageIdToInfo = await this.collectFirstImageMetadata(items, filtered);

    // 第二步：构建缩略图目标（先读路径缓存）
    const { targets, uncachedIds, uncachedPaths } = this.buildThumbnailTargets(items, filtered, imageIdToInfo);
    if (targets.length === 0) return;

    // 第三步：未命中项 IPC 兜底
    await this.fetchMissingThumbnailPaths(targets, uncachedIds, uncachedPaths);

    // 第四步：应用所有缩略图
    this.applyThumbnailTargets(targets);
  }

  /**
   * 从列表项中提取每个 prompt 的第一张图 ID，并补齐元数据缓存
   */
  private async collectFirstImageMetadata(
    items: NodeListOf<Element>,
    filtered: IPrompt[]
  ): Promise<Map<string, ImageInfo>> {
    const imageIdToInfo = new Map<string, ImageInfo>();
    const missingImageIds: string[] = [];

    for (const item of items) {
      const resolved = this.resolveFirstImageFromItem(item, filtered);
      if (!resolved) continue;
      const { imageId, imageIdStr } = resolved;

      const cached = cacheManager.getCachedImage(imageIdStr);
      if (cached) {
        imageIdToInfo.set(imageIdStr, cached as ImageInfo);
      } else if (!imageIdToInfo.has(imageIdStr)) {
        imageIdToInfo.set(imageIdStr, { id: imageId });
        missingImageIds.push(imageIdStr);
      }
    }

    if (missingImageIds.length === 0) return imageIdToInfo;

    try {
      const fetchedImages = await window.electronAPI.getImagesByIds(missingImageIds);
      for (const img of fetchedImages) {
        if (img && img.id) {
          cacheManager.cacheImage(img);
          imageIdToInfo.set(String(img.id), img as ImageInfo);
        }
      }
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to fetch images by ids:', error);
    }

    return imageIdToInfo;
  }

  /**
   * 构建缩略图渲染目标：优先读路径缓存，未命中收集待 IPC 兜底
   */
  private buildThumbnailTargets(
    items: NodeListOf<Element>,
    filtered: IPrompt[],
    imageIdToInfo: Map<string, ImageInfo>
  ): {
    targets: Array<{ thumbnailEl: HTMLImageElement | null; fullPath: string }>;
    uncachedIds: string[];
    uncachedPaths: string[];
  } {
    const targets: Array<{ thumbnailEl: HTMLImageElement | null; fullPath: string }> = [];
    const uncachedIds: string[] = [];
    const uncachedPaths: string[] = [];

    for (const item of items) {
      const resolved = this.resolveFirstImageFromItem(item, filtered);
      if (!resolved) continue;
      const { imageIdStr } = resolved;

      const img = imageIdToInfo.get(imageIdStr);
      if (!img) continue;

      const imagePath = img.thumbnailPath || img.relativePath;
      if (!imagePath) continue;

      const thumbnailEl = item.querySelector('.list-item__thumbnail') as HTMLImageElement | null;
      const cachedPath = cacheManager.getImagePath(imageIdStr, 'thumbnail');
      if (cachedPath) {
        targets.push({ thumbnailEl, fullPath: cachedPath });
      } else {
        targets.push({ thumbnailEl, fullPath: '' });
        uncachedIds.push(imageIdStr);
        uncachedPaths.push(imagePath);
      }
    }

    return { targets, uncachedIds, uncachedPaths };
  }

  /**
   * 对未命中路径缓存的项，单次 IPC 批量获取并回写缓存
   */
  private async fetchMissingThumbnailPaths(
    targets: Array<{ thumbnailEl: HTMLImageElement | null; fullPath: string }>,
    uncachedIds: string[],
    uncachedPaths: string[]
  ): Promise<void> {
    if (uncachedPaths.length === 0) return;

    try {
      const fullPaths = await window.electronAPI.getImagesPaths(uncachedPaths);
      const entries: Array<{ imageId: string; fullPath: string }> = [];
      let uncachedIdx = 0;
      for (const target of targets) {
        if (!target.fullPath && uncachedIdx < uncachedPaths.length) {
          const fullPath = fullPaths[uncachedIdx];
          const imageId = uncachedIds[uncachedIdx];
          if (fullPath) {
            target.fullPath = fullPath;
            if (imageId) {
              entries.push({ imageId, fullPath });
            }
          }
          uncachedIdx++;
        }
      }
      if (entries.length > 0) {
        cacheManager.setImagePaths(entries, 'thumbnail');
      }
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to load prompt list thumbnails:', error);
    }
  }

  /**
   * 应用所有缩略图到 DOM
   */
  private applyThumbnailTargets(
    targets: Array<{ thumbnailEl: HTMLImageElement | null; fullPath: string }>
  ): void {
    for (const target of targets) {
      if (!target.thumbnailEl || !target.fullPath) continue;
      target.thumbnailEl.src = `file://${target.fullPath.replace(/"/g, '&quot;')}`;
    }
  }

  /**
   * 从列表项中解析对应的 prompt 第一张图 ID
   * 返回 null 表示该 item 无关联图
   */
  private resolveFirstImageFromItem(
    item: Element,
    filtered: IPrompt[]
  ): { imageId: string; imageIdStr: string } | null {
    const promptId = (item as HTMLElement).dataset.id;
    const prompt = filtered.find(p => String(p.id) === String(promptId));
    if (!prompt || !prompt.images || prompt.images.length === 0) return null;

    const firstImage = prompt.images[0];
    const imageId = typeof firstImage === 'object' ? (firstImage as ImageInfo).id : firstImage;
    if (!imageId) return null;

    return { imageId, imageIdStr: String(imageId) };
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
    const listContainer = document.getElementById(Constants.Ids.PROMPT_LIST);

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

    const gridContainer = document.getElementById(Constants.Ids.PROMPT_GRID);
    const listContainer = document.getElementById(Constants.Ids.PROMPT_LIST);

    gridContainer?.removeEventListener('scroll', this.scrollHandler);
    listContainer?.removeEventListener('scroll', this.scrollHandler);
    this.scrollHandler = null;
  }

  /**
   * 处理滚动事件，判断是否需要加载更多
   */
  private handleScroll(): void {
    const container = this.viewModeType === 'grid'
      ? document.getElementById(Constants.Ids.PROMPT_GRID)
      : document.getElementById(Constants.Ids.PROMPT_LIST);
    if (!container) return;

    const scrollBottom = container.scrollTop + container.clientHeight;
    const threshold = 200;
    if (scrollBottom >= container.scrollHeight - threshold) {
      this.loadMore();
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
   * 增量刷新：保持当前分页状态，重新获取已加载范围的数据
   * 用于从详情页返回等场景，避免重置分页状态导致已加载数据丢失
   * 只更新 DOM 中变化的数据（标签、备注等），不重新加载缩略图
   */
  private async refreshIncremental(): Promise<void> {
    try {
      // 保持 currentOffset 和 loadedPromptIds，重新获取当前已加载范围的数据
      const options = this.buildPaginatedOptions();
      options.limit = this.currentOffset + this.pageSize;
      options.offset = 0;

      const result = await window.electronAPI.getPromptsPaginated(options);

      // 检测 DOM 中不存在的新项（如新建的提示词）：
      // 增量更新只能修改/删除已有元素，无法创建新元素，
      // 存在新项时降级为全量渲染，确保新卡片正确显示
      const container = this.getCurrentContainer();
      const hasNewItem =
        container !== null && result.items.some((item) => !container.querySelector(`[data-id="${item.id}"]`));
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

      // 检测首图变化（如详情页"设为首张"）并同步刷新背景图/缩略图
      await this.refreshChangedFirstImages(result.items);

      // 增量更新 DOM：只更新变化的数据，不重新加载缩略图
      this.updateDomIncrementally(result.items);

      // 刷新标签计数
      await this.refreshTagCounts();
      await this.renderTagFilters();
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to refresh incremental:', error);
      this.app.showToast?.('刷新失败', 'error');
    }
  }

  /**
   * 检测提示词首图是否变化（如详情页"设为首张"），并同步刷新背景图/缩略图
   * 仅处理首图 ID 变化的项，其余项零开销
   * @param prompts - 更新后的提示词列表
   */
  private async refreshChangedFirstImages(prompts: IPrompt[]): Promise<void> {
    const container = this.getCurrentContainer();
    if (!container) return;

    // 对比 DOM 上记录的首图 ID（data-first-image）与新数据的首图 ID
    const changed: IPrompt[] = [];
    for (const prompt of prompts) {
      const el = container.querySelector(`[data-id="${prompt.id}"]`) as HTMLElement | null;
      if (!el) continue;

      const first = prompt.images?.[0] as ImageInfo | string | undefined;
      const newFirstId = first ? String(typeof first === 'object' ? first.id ?? '' : first) : '';
      const oldFirstId = el.dataset.firstImage || '';
      if (newFirstId !== oldFirstId) {
        // 同步更新属性，保证 hover 预览也指向新首图
        el.dataset.firstImage = newFirstId;
        changed.push(prompt);
      }
    }

    if (changed.length === 0) return;

    // 网格视图：更新卡片背景图；列表视图：更新缩略图
    if (this.viewModeType === 'grid') {
      await this.loadCardBackgroundsForItems(changed);
    } else {
      await this.loadPromptListThumbnails(changed);
    }
  }

  /**
   * 增量更新 DOM：只更新变化的数据（标签、备注等），不重新加载缩略图
   * @param items - 更新后的提示词列表
   */
  private updateDomIncrementally(items: IPrompt[]): void {
    if (this.viewModeType === 'grid') {
      this.updateGridDomIncrementally(items);
    } else {
      this.updateListDomIncrementally(items);
    }
  }

  /**
   * 增量更新网格视图 DOM
   * 更新收藏状态与标签区域
   */
  private updateGridDomIncrementally(items: IPrompt[]): void {
    const container = document.getElementById(Constants.Ids.PROMPT_GRID);
    if (!container) return;

    for (const prompt of items) {
      const card = container.querySelector(`[data-id="${prompt.id}"]`) as HTMLElement;
      if (!card) continue;

      // 更新卡片 is-favorite class
      card.classList.toggle('is-favorite', !!prompt.isFavorite);

      // 更新收藏按钮状态
      const favoriteBtn = card.querySelector('.favorite-btn');
      if (favoriteBtn) {
        const isActive = !!prompt.isFavorite;
        favoriteBtn.classList.toggle('active', isActive);
        favoriteBtn.innerHTML = isActive ? Constants.ICONS.favorite.filled : Constants.ICONS.favorite.outline;
      }

      // 更新标签区域（row3）
      const tagsContainer = card.querySelector('.prompt-card-row3');
      if (tagsContainer) {
        tagsContainer.innerHTML = TagUI.generateTagsHtml(
          prompt.tags || [],
          'tag-display',
          'tag-display-empty'
        );
      }
    }
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
    if (this.viewModeType === 'grid') {
      return document.getElementById(Constants.Ids.PROMPT_GRID);
    } else {
      return document.getElementById(Constants.Ids.PROMPT_LIST);
    }
  }

  /**
   * 获取滚动导航按钮 ID（实现基类抽象方法）
   */
  getScrollNavId(): string {
    return Constants.Ids.PROMPT_SCROLL_NAV;
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
 * 支持网格视图、列表视图和紧凑列表视图
 */
class PromptEventStrategy extends BaseEventStrategy {
  constructor(
    private manager: PromptPanelManager,
    private viewMode: string,
  ) {
    super();
  }

  protected getSelectors(): IEventStrategySelectors {
    if (this.viewMode === 'grid') {
      return {
        checkbox: '.card-checkbox',
        item: '.prompt-card',
        exclude: ['.action-btn', '.card-checkbox'],
      };
    } else {
      // list 和 list-compact 使用相同的选择器
      return {
        checkbox: '.list-item__checkbox',
        item: '.list-item--prompt',
        exclude: ['.list-item__checkbox', '.list-item__actions'],
      };
    }
  }

  protected handleOpenDetail(item: IEventStrategyItem): void {
    this.manager.openPromptDetail(item as IPrompt);
  }
}
