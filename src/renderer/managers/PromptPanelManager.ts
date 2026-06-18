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
  static PROMPT_TAG_CHECKS = new Map<string, (p: IPrompt) => boolean>([
    [Constants.FAVORITE_TAG, (p) => !!p.isFavorite],
    [Constants.SAFE_TAG, (p) => p.isSafe !== 0],
    [Constants.UNSAFE_TAG, (p) => p.isSafe === 0],
    [Constants.MULTI_IMAGE_TAG, (p) => !!p.images && p.images.length >= 2],
    [Constants.NO_IMAGE_TAG, (p) => !p.images || p.images.length === 0],
    [Constants.NO_TAG_TAG, (p) => !p.tags || p.tags.length === 0]
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
    return PromptPanelManager.PROMPT_TAG_CHECKS as Map<string, (item: Record<string, unknown>) => boolean>;
  }

  /**
   * 获取项目类型标识（实现基类抽象方法）
   */
  getItemType(): 'prompt' | 'image' {
    return 'prompt';
  }

  /**
   * 加载提示词数据（实现基类抽象方法）
   */
  async loadData(): Promise<IPrompt[]> {
    try {
      const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
      cacheManager.cachePrompts(prompts);
      return prompts;
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to load prompts:', error);
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
   */
  async loadPromptListThumbnails(filtered: IPrompt[]): Promise<void> {
    const listContainer = document.getElementById(Constants.Ids.PROMPT_LIST);
    if (!listContainer) return;

    const allImages = await window.electronAPI.getImages('updatedAt', 'desc');
    const items = listContainer.querySelectorAll('.list-item--prompt');

    // 收集所有列表项的路径信息，批量获取
    const itemInfoList: Array<{ thumbnailEl: HTMLImageElement | null }> = [];
    const relativePaths: string[] = [];

    for (const item of items) {
      const promptId = (item as HTMLElement).dataset.id;
      const prompt = filtered.find(p => String(p.id) === String(promptId));
      if (!prompt || !prompt.images || prompt.images.length === 0) continue;

      const firstImageId = typeof prompt.images[0] === 'object' ? (prompt.images[0] as ImageInfo).id : prompt.images[0];
      const img = this.app.findImageById(String(firstImageId), allImages) as ImageInfo | undefined;
      if (!img) continue;

      const imagePath = img.thumbnailPath || img.relativePath;
      if (!imagePath) continue;

      const thumbnailEl = item.querySelector('.list-item__thumbnail') as HTMLImageElement | null;
      itemInfoList.push({ thumbnailEl });
      relativePaths.push(imagePath);
    }

    if (relativePaths.length === 0) return;

    // 单次 IPC 批量获取所有路径
    try {
      const fullPaths = await window.electronAPI.getImagesPaths(relativePaths);
      itemInfoList.forEach((info, index) => {
        if (!info.thumbnailEl) return;
        const fullPath = fullPaths[index];
        info.thumbnailEl.src = `file://${fullPath.replace(/"/g, '&quot;')}`;
      });
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to load prompt list thumbnails:', error);
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

  /**
   * 计算特殊标签计数（实现基类抽象方法）
   */
  calculateSpecialTagCounts(visibleItems: IPrompt[]): { tag: string; count: number }[] {
    const specialTags: { tag: string; count: number }[] = [];
    const favoriteCount = visibleItems.filter(p => p.isFavorite).length;
    const multiImageCount = visibleItems.filter(p => p.images && p.images.length >= 2).length;
    const noImageCount = visibleItems.filter(p => !p.images || p.images.length === 0).length;
    const noTagCount = visibleItems.filter(p => !p.tags || p.tags.length === 0).length;

    if (favoriteCount > 0) {
      specialTags.push({ tag: Constants.FAVORITE_TAG, count: favoriteCount });
    }
    if (multiImageCount > 0) {
      specialTags.push({ tag: Constants.MULTI_IMAGE_TAG, count: multiImageCount });
    }
    if (noImageCount > 0) {
      specialTags.push({ tag: Constants.NO_IMAGE_TAG, count: noImageCount });
    }
    if (noTagCount > 0) {
      specialTags.push({ tag: Constants.NO_TAG_TAG, count: noTagCount });
    }

    // NSFW 模式下显示安全评级标签
    if (this.app.viewMode === 'nsfw') {
      const safeCount = visibleItems.filter(p => p.isSafe !== 0).length;
      const unsafeCount = visibleItems.filter(p => p.isSafe === 0).length;
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
      await this.renderView();
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
