import { HtmlUtils } from '../../utils/index.ts';
import { cacheManager, CacheManager } from '../../utils/CacheManager.ts';
import { LRUCache } from '../../utils/LRUCache.ts';
import { TagUI } from './TagUI.ts';
import { TagService } from './TagService.ts';
import { TopGroupManager } from './TopGroupManager.ts';
import { ITagWithGroup, ITagGroup, IImage, IPrompt } from '../../types/entities.ts';
import { IEventStrategy, EventContext } from './Strategies/IEventStrategy.ts';
import { MultiSelectManager, IToolbarConfig, IBatchOperationHandler } from './MultiSelectManager.ts';
import { MultiSelectConfig, IBatchOperationConfig } from '../config/MultiSelectConfig.ts';
import { DialogService } from '../services/index.ts';
import type { IDialogTemplate } from '../../types/entities.ts';
import { Constants, Events } from '../../constants.ts';

// 卡片大小限制常量
const MIN_CARD_SIZE = 100;
const MAX_CARD_SIZE = 350;

import type { IEventBus } from '../app.types.ts';

/**
 * 面板管理器宿主接口
 * 包含所有面板管理器需要的 app 属性
 */
interface IPanelManagerHost {
  // 通用属性
  showToast: (message: string, type: string) => void;
  viewMode: string;
  currentPanel: string;
  eventBus: IEventBus;

  // 可选的模态框管理器
  openPromptTagManagerModal?: () => void;
  openImageTagManagerModal?: () => void;
  newPromptManager?: {
    open: () => Promise<void>;
  } | null;
  imageUploadManager?: {
    open: () => void;
  } | null;

  // 回收站和统计
  trashManager?: { loadTrash: () => Promise<void> } | null;
  renderStatistics?: () => Promise<void>;

  // 缓存
  imageCache?: LRUCache<IImage>;
  promptCache?: LRUCache<IPrompt>;

  // 搜索排序
  searchSortManager?: {
    getImageSearchQuery?: () => string;
    getPromptSearchQuery?: () => string;
  } | null;

  // 模态框打开方法
  openImageDetailModal?: (image: IImage, options: { filteredList: IImage[] }) => void;
  openEditPromptModal?: (prompt: IPrompt, options: { filteredList: IPrompt[] }) => void;

  // 工具提示
  promptHoverTooltip?: {
    bind: (selector: string, options: {
      getContent: (element: Element) => string;
      getImageId: (element: Element) => string | null;
      delay: number;
    }) => void;
  } | null;

  // 图像查找
  findImageById?: (imageId: string, allImages?: Array<{ id: string }> | null) => { id: string } | null;
}

// 面板管理器基类选项接口
interface PanelManagerBaseOptions {
  app: IPanelManagerHost;
  tagManager?: unknown;
  storagePrefix: string;
  defaultCardSize?: number;
  onSelectionChange?: () => void;
}

// 面板项目接口（基础）
export interface IPanelItem {
  id: string;
  isDeleted?: boolean;
  isSafe?: number;
  tags?: string[];
  isFavorite?: boolean | number;
  [key: string]: unknown;
}

// 特殊标签计数接口
interface SpecialTagCount {
  tag: string;
  count: number;
}

// 删除确认配置接口
interface IDeleteConfirmConfig {
  config: unknown;
  name?: string;
}

// 复制内容结果接口
interface ICopyContentResult {
  content: string;
  hasContent: boolean;
}

// UI 配置接口 - 用于抽取重复的 UI 更新逻辑
interface IUIConfig {
  // 选择器
  cardSelector: string;
  listItemSelector: string;
  cardBgSelector: string;

  // 容器 ID
  gridContainerId: string;
  listContainerId: string;

  // 拖拽相关
  dragSource: string;
  getCardDropSelector(): string;

  // 获取元素 ID（从 dataset 中提取）
  getElementId(element: HTMLElement): string | undefined;

  // 获取复制内容
  getCopyContent(item: IPanelItem): ICopyContentResult;

  // 获取删除确认配置
  getDeleteConfirmConfig(item: IPanelItem): IDeleteConfirmConfig;

  // 获取卡片背景图片路径
  getCardImagePath(item: IPanelItem): string | null;
}

/**
 * 面板管理器基类
 * 封装提示词面板和图像面板的通用逻辑
 * 使用模板方法模式，子类实现特定差异
 */
export abstract class PanelManagerBase {
  [key: string]: unknown;
  app: IPanelManagerHost;
  protected tagManager?: unknown;
  protected storagePrefix: string;
  protected defaultCardSize: number;
  protected onSelectionChange?: () => void;

  // 通用状态
  protected filteredItems: IPanelItem[] = [];
  protected selectedTags: Set<string> = new Set();
  protected _previousFilterState = {
    selectedTags: [] as string[],
    searchQuery: '',
    viewMode: undefined as string | undefined
  };

  // 视图设置
  viewModeType: string;
  sortBy: string;
  sortOrder: string;
  cardSize: number;
  tagFilterSortBy: string;
  tagFilterSortOrder: string;

  // 多选管理器（合并了 SelectionManager 和 BatchOperationManager）
  multiSelectManager: MultiSelectManager;

  // UI 配置（子类实现）
  protected abstract getUIConfig(): IUIConfig;
  protected abstract getUpdateAPI(): (id: string, data: unknown) => Promise<void>;
  protected abstract getTagFilterToggleBtnId(): string;
  protected abstract getTagManagerBtnId(): string;

  /**
   * 绑定标签管理器事件
   */
  protected bindTagManagerEvents(): void {
    document.getElementById(this.getTagManagerBtnId())?.addEventListener('click', async () => await this.openTagManagerModal());
  }

  /**
   * 打开标签管理器模态框（子类实现）
   */
  protected abstract openTagManagerModal(): Promise<void>;

  /**
   * 绑定标签筛选收起/展开按钮事件
   */
  protected bindTagFilterToggleEvents(): void {
    document.getElementById(this.getTagFilterToggleBtnId())?.addEventListener('click', () => this.toggleTagFilterState());
  }

  /**
   * @param options - 配置选项
   */
  constructor(options: PanelManagerBaseOptions) {
    if (!options.app) {
      throw new Error('PanelManagerBase requires app instance');
    }
    this.app = options.app;
    this.tagManager = options.tagManager;
    // eventBus 通过 app 访问
    this.storagePrefix = options.storagePrefix;
    this.defaultCardSize = options.defaultCardSize || 200;
    this.onSelectionChange = options.onSelectionChange;

    // 从 localStorage 加载视图模式和排序设置
    this.viewModeType = localStorage.getItem(`${this.storagePrefix}ViewMode`) || 'grid';
    this.sortBy = localStorage.getItem(`${this.storagePrefix}SortBy`) || 'updatedAt';
    this.sortOrder = localStorage.getItem(`${this.storagePrefix}SortOrder`) || 'desc';

    // 卡片大小设置
    this.cardSize = parseInt(localStorage.getItem(`${this.storagePrefix}CardSize`) || '') || this.defaultCardSize;

    // 标签筛选排序设置
    this.tagFilterSortBy = localStorage.getItem(`${this.storagePrefix}TagFilterSortBy`) || 'count';
    this.tagFilterSortOrder = localStorage.getItem(`${this.storagePrefix}TagFilterSortOrder`) || 'desc';

    // 获取配置
    const configKey = this.storagePrefix as 'image' | 'prompt';
    const multiSelectConfig = MultiSelectConfig[configKey];

    // 创建批量操作处理器 - 使用直接回调替代全局事件
    const batchHandler: IBatchOperationHandler = {
      onSelectAll: () => this.selectAllVisibleItems(),
      onInvert: () => this.handleBatchInvert(),
      onAddTag: () => this.handleBatchAddTag(),
      onMove: () => {},
      onFavorite: () => this.handleBatchFavorite(),
      onDelete: () => this.handleBatchDelete(),
      onCancel: () => this.handleBatchCancel()
    };

    // 初始化 MultiSelectManager
    this.multiSelectManager = new MultiSelectManager({
      onChange: async () => {
        await this.renderView();
        this.multiSelectManager.updateToolbarUI();
      },
      toolbarConfig: multiSelectConfig ? {
        id: this.storagePrefix === 'prompt' ? Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR : Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR,
        label: multiSelectConfig.label,
        buttons: multiSelectConfig.buttons
      } : undefined,
      handler: batchHandler
    });

    // 初始化工具栏
    this.multiSelectManager.initToolbar();

    // 绑定事件
    this.subscribeToEvents();
  }

  /**
   * 检查当前面板是否是活动面板（可见）
   * @returns 是否是活动面板
   */
  protected isActivePanel(): boolean {
    // 通过 app.currentPanel 判断当前活动面板
    const currentPanel = this.app.currentPanel;
    if (!currentPanel) return false;

    // 根据 storagePrefix 判断面板类型
    // prompt -> 'prompt', image -> 'image'
    return currentPanel === this.storagePrefix;
  }

  /**
   * 全选所有可见项目
   */
  selectAllVisibleItems(): void {
    const visibleItems = this.getVisibleItems();
    const ids = visibleItems.map((item: IPanelItem) => String(item.id));
    this.multiSelectManager.selectAll(ids);
  }

  /**
   * 获取项目列表（子类实现）
   * @abstract
   * @returns 项目列表
   */
  getItems(): IPanelItem[] {
    throw new Error('getItems() must be implemented by subclass');
  }

  /**
   * 获取可见项目列表（筛选后）
   * @returns 筛选后的可见项目列表
   */
  getVisibleItems(): IPanelItem[] {
    return this.filteredItems || [];
  }

  /**
   * 获取可见项目数量
   * @returns 可见项目数量
   */
  getVisibleItemCount(): number {
    return this.filteredItems?.length || 0;
  }

  /**
   * 获取搜索查询（子类实现）
   * @abstract
   * @returns 搜索查询字符串
   */
  getSearchQuery(): string {
    return ''; // 默认返回空字符串，表示不搜索
  }

  /**
   * 检查项目是否匹配搜索查询（子类实现）
   * @abstract
   * @param item - 项目对象
   * @param lowerQuery - 小写的搜索查询
   * @returns 是否匹配
   */
  matchesSearch(item: IPanelItem, lowerQuery: string): boolean {
    return true; // 默认全部匹配
  }

  /**
   * 获取特殊标签检查函数 Map（子类实现）
   * @abstract
   * @returns 特殊标签检查函数 Map
   */
  getSpecialTagChecks(): Map<string, (item: IPanelItem) => boolean> {
    throw new Error('getSpecialTagChecks() must be implemented by subclass');
  }

  /**
   * 获取项目类型标识（子类实现）
   * @abstract
   * @returns 项目类型
   */
  getItemType(): string {
    throw new Error('getItemType() must be implemented by subclass');
  }

  /**
   * 加载数据（抽象方法, 必须子类实现）
   * @abstract
   * @returns 项目列表
   */
  async loadData(): Promise<IPanelItem[]> {
    throw new Error('loadData() must be implemented by subclass');
  }

  /**
   * 创建卡片 HTML（子类实现）
   * @abstract
   * @param item - 项目对象
   * @returns HTML 字符串
   */
  createCard(item: IPanelItem): string {
    throw new Error('createCard() must be implemented by subclass');
  }

  /**
   * 绑定卡片事件（子类实现）
   * @abstract
   * @param filtered - 筛选后的项目列表
   */
  bindCardEvents(filtered: IPanelItem[]): void {
    throw new Error('bindCardEvents() must be implemented by subclass');
  }

  /**
   * 绑定卡片按钮事件（通用实现）
   * @param filtered - 筛选后的项目列表
   */
  bindCardButtonEvents(filtered: IPanelItem[]): void {
    const config = this.getUIConfig();
    const container = document.getElementById(config.gridContainerId);
    if (!container) return;

    filtered.forEach(item => {
      const card = container.querySelector(`[data-id="${item.id}"]`);
      if (!card) return;

      // 删除按钮
      const deleteBtn = card.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const { config: dialogConfig, name } = config.getDeleteConfirmConfig(item);
          const confirmed = await DialogService.showConfirmDialogByConfig(dialogConfig as IDialogTemplate, name ? { name } : undefined);
          if (confirmed) {
            await this.deleteItem(String(item.id));
          }
        });
      }

      // 收藏按钮
      const favoriteBtn = card.querySelector('.favorite-btn');
      if (favoriteBtn) {
        favoriteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.toggleFavorite(String(item.id), !item.isFavorite);
        });
      }

      // 复制按钮
      const copyBtn = card.querySelector('.copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const { content, hasContent } = config.getCopyContent(item);
          if (!hasContent) {
            this.app.showToast?.('没有可复制的内容', 'warning');
            return;
          }
          try {
            await window.electronAPI.copyToClipboard(content);
            this.app.showToast?.('已复制到剪贴板', 'success');
          } catch (error) {
            this.app.showToast?.('复制失败', 'error');
          }
        });
      }
    });
  }

  /**
   * 绑定列表按钮事件（通用实现）
   * @param filtered - 筛选后的项目列表
   */
  bindListButtonEvents(filtered: IPanelItem[]): void {
    const config = this.getUIConfig();
    const listContainer = document.getElementById(config.listContainerId);
    if (!listContainer) return;

    listContainer.querySelectorAll(config.listItemSelector).forEach(item => {
      const id = (item as HTMLElement).dataset.id;
      const itemData = filtered.find(i => String(i.id) === String(id));
      if (!itemData) return;

      // 收藏按钮
      const favoriteBtn = item.querySelector('.favorite-btn');
      if (favoriteBtn) {
        favoriteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.toggleFavorite(String(id), !itemData.isFavorite);
        });
      }

      // 删除按钮
      const deleteBtn = item.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const { config: dialogConfig, name } = config.getDeleteConfirmConfig(itemData);
          const confirmed = await DialogService.showConfirmDialogByConfig(dialogConfig as IDialogTemplate, name ? { name } : undefined);
          if (confirmed) {
            await this.deleteItem(String(id));
          }
        });
      }

      // 复制按钮
      const copyBtn = item.querySelector('.copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const { content, hasContent } = config.getCopyContent(itemData);
          if (!hasContent) {
            this.app.showToast?.('没有可复制的内容', 'warning');
            return;
          }
          try {
            await window.electronAPI.copyToClipboard(content);
            this.app.showToast?.('已复制到剪贴板', 'success');
          } catch (error) {
            this.app.showToast?.('复制失败', 'error');
          }
        });
      }
    });
  }

  /**
   * 异步加载卡片背景图（通用实现）
   */
  async loadCardBackgrounds(): Promise<void> {
    const config = this.getUIConfig();
    const container = document.getElementById(config.gridContainerId);
    if (!container) return;

    const cards = container.querySelectorAll(config.cardSelector);
    const items = this.getItems();

    for (const card of cards) {
      const id = (card as HTMLElement).dataset.id;
      const item = items.find(i => String(i.id) === String(id));
      if (!item) continue;

      const imagePath = config.getCardImagePath(item);
      if (!imagePath) continue;

      try {
        const fullPath = await window.electronAPI.getImagePath(imagePath);
        const bgElement = card.querySelector(config.cardBgSelector);
        if (bgElement) {
          (bgElement as HTMLElement).style.backgroundImage = `url('file://${fullPath.replace(/\\/g, '/')}')`;
        }
      } catch (error) {
        window.electronAPI.logError('PanelManagerBase.ts', 'Failed to load card background:', error);
      }
    }
  }

  /**
   * 绑定悬停预览（子类实现）
   * @abstract
   * @param selector - CSS 选择器
   */
  bindHoverPreview(selector: string): void {
    throw new Error('bindHoverPreview() must be implemented by subclass');
  }

  /**
   * 绑定卡片拖拽事件（通用实现）
   * @param container - 容器元素
   */
  bindCardDropEvents(container: HTMLElement): void {
    const config = this.getUIConfig();

    // 避免重复绑定
    if (container.dataset.dropEventsBound === 'true') {
      return;
    }
    container.dataset.dropEventsBound = 'true';

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      (e as DragEvent).dataTransfer!.dropEffect = 'copy';
    });

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      const dragSource = (e as DragEvent).dataTransfer!.getData('drag-source');
      const tagName = (e as DragEvent).dataTransfer!.getData('text/plain');

      if (dragSource === config.dragSource && tagName) {
        const card = (e.target as Element).closest(config.getCardDropSelector());
        if (card) {
          const id = config.getElementId(card as HTMLElement);
          if (id) {
            try {
              await this.handleTagDrop(id, tagName, this.getUpdateAPI());
              this.app.showToast?.('标签已添加', 'success');
            } catch (error) {
              this.app.showToast?.((error as Error).message, 'error');
            }
          }
        }
      }
    });
  }

  /**
   * 渲染列表视图（子类实现）
   * @abstract
   * @param filtered - 筛选后的项目列表
   */
  async renderListView(filtered: IPanelItem[]): Promise<void> {
    throw new Error('renderListView() must be implemented by subclass');
  }

  /**
   * 获取标签筛选容器 ID（子类实现）
   * @abstract
   * @returns 容器 ID
   */
  getTagFilterContainerId(): string {
    throw new Error('getTagFilterContainerId() must be implemented by subclass');
  }

  /**
   * 获取特殊标签容器 ID（子类实现）
   * @abstract
   * @returns 容器 ID
   */
  getSpecialTagsContainerId(): string {
    throw new Error('getSpecialTagsContainerId() must be implemented by subclass');
  }

  /**
   * 获取筛选动作按钮 ID（实现基类抽象方法）
   * @returns 按钮 ID
   */
  getFilterActionBtnId(): string {
    throw new Error('getFilterActionBtnId() must be implemented by subclass');
  }

  /**
   * 获取标签筛选头部容器 ID（子类实现）
   * @abstract
   * @returns 容器 ID
   */
  getTagFilterHeaderContainerId(): string {
    throw new Error('getTagFilterHeaderContainerId() must be implemented by subclass');
  }

  /**
   * 获取标签拖拽类型（子类实现）
   * @abstract
   * @returns 拖拽类型
   */
  getTagDragType(): string {
    throw new Error('getTagDragType() must be implemented by subclass');
  }

  /**
   * 获取所有标签（子类实现）
   * @abstract
   * @returns 标签列表
   */
  async getAllTags(): Promise<string[]> {
    throw new Error('getAllTags() must be implemented by subclass');
  }

  /**
   * 计算特殊标签计数（子类实现）
   * @abstract
   * @param visibleItems - 可见项目列表
   * @returns 特殊标签计数列表
   */
  calculateSpecialTagCounts(visibleItems: IPanelItem[]): SpecialTagCount[] {
    throw new Error('calculateSpecialTagCounts() must be implemented by subclass');
  }

  /**
   * 删除项目（子类实现）
   * @abstract
   * @param id - 项目 ID
   */
  async deleteItem(id: string): Promise<void> {
    throw new Error('deleteItem() must be implemented by subclass');
  }

  /**
   * 切换收藏状态（子类实现）
   * @abstract
   * @param id - 项目 ID
   * @param isFavorite - 是否收藏
   */
  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    throw new Error('toggleFavorite() must be implemented by subclass');
  }

  /**
   * 更新收藏按钮 UI（通用实现）
   * @param id - 项目 ID
   * @param isFavorite - 是否收藏
   */
  updateFavoriteUI(id: string, isFavorite: boolean): void {
    const config = this.getUIConfig();

    const updateBtn = (btn: Element | null) => {
      if (!btn) return;
      if (isFavorite) {
        btn.classList.add('active');
        (btn as HTMLElement).title = '取消收藏';
        btn.innerHTML = Constants.ICONS.favorite.filled;
      } else {
        btn.classList.remove('active');
        (btn as HTMLElement).title = '收藏';
        btn.innerHTML = Constants.ICONS.favorite.outline;
      }
    };

    // 更新卡片视图
    const card = document.querySelector(`${config.cardSelector}[data-id="${id}"]`);
    if (card) {
      const btn = card.querySelector('.favorite-btn');
      updateBtn(btn);
      card.classList.toggle('is-favorite', isFavorite);
    }

    // 更新列表视图
    const listItem = document.querySelector(`${config.listItemSelector}[data-id="${id}"]`);
    if (listItem) {
      const btn = listItem.querySelector('.favorite-btn');
      updateBtn(btn);
      listItem.classList.toggle('list-item--favorite', isFavorite);
    }
  }

  /**
   * 排序项目列表（子类实现）
   * @abstract
   * @param items - 项目列表
   * @param sortBy - 排序字段
   * @param sortOrder - 排序顺序
   * @returns 排序后的列表
   */
  sortItems(items: IPanelItem[], sortBy: string, sortOrder: string): IPanelItem[] {
    throw new Error('sortItems() must be implemented by subclass');
  }

  /**
   * 订阅事件（子类可选实现）
   */
  subscribeToEvents(): void {
    // 子类可选实现
  }

  /**
   * 初始化（只加载数据，不渲染视图）
   */
  async init(): Promise<void> {
    await this.loadData();
  }

  /**
   * 渲染视图和标签筛选器
   */
  async ensureRendered(): Promise<void> {
    await this.renderView();
    await this.renderTagFilters();
  }

  /**
   * 检查筛选条件是否改变
   * @returns 筛选条件是否改变
   */
  protected checkFilterChanged(): boolean {
    const currentTags = Array.from(this.selectedTags);
    const currentSearchQuery = this.getSearchQuery();
    const currentViewMode = this.app.viewMode;

    // 如果是第一次调用，初始化状态
    if (this._previousFilterState.selectedTags.length === 0 &&
        this._previousFilterState.searchQuery === '' &&
        this._previousFilterState.viewMode === undefined) {
      this._previousFilterState = {
        selectedTags: currentTags,
        searchQuery: currentSearchQuery,
        viewMode: currentViewMode
      };
      return false;
    }

    const tagsChanged = 
      currentTags.length !== this._previousFilterState.selectedTags.length ||
      !currentTags.every((tag, i) => tag === this._previousFilterState.selectedTags[i]);

    const changed =
      tagsChanged ||
      currentSearchQuery !== this._previousFilterState.searchQuery ||
      currentViewMode !== this._previousFilterState.viewMode;

    if (changed) {
      this._previousFilterState = {
        selectedTags: currentTags,
        searchQuery: currentSearchQuery,
        viewMode: currentViewMode
      };
    }

    return changed;
  }

  /**
   * 恢复标签筛选区展开/收起状态
   */
  restoreTagFilterState(): void {
    const collapsed = localStorage.getItem(this.getTagFilterStorageKey());
    if (collapsed === 'true') {
      const section = document.getElementById(this.getTagFilterSectionId());
      section?.classList.add('collapsed');
    }
  }

  /**
   * 切换标签筛选区展开/收起状态
   */
  async toggleTagFilterState(): Promise<void> {
    const section = document.getElementById(this.getTagFilterSectionId());
    if (section) {
      section.classList.toggle('collapsed');
      const collapsed = section.classList.contains('collapsed');
      localStorage.setItem(this.getTagFilterStorageKey(), String(collapsed));
    }
    await this.renderTagFilters();
  }

  /**
   * 获取标签筛选区 section ID
   */
  private getTagFilterSectionId(): string {
    return this.storagePrefix === 'prompt'
      ? Constants.LocalStorageKey.PROMPT_TAG_FILTER_SECTION
      : Constants.LocalStorageKey.IMAGE_TAG_FILTER_SECTION;
  }

  /**
   * 获取标签筛选区收起状态的 storage key
   */
  private getTagFilterStorageKey(): string {
    return this.storagePrefix === 'prompt'
      ? Constants.LocalStorageKey.PROMPT_TAG_FILTER_COLLAPSED
      : Constants.LocalStorageKey.IMAGE_TAG_FILTER_COLLAPSED;
  }

  /**
   * 渲染主列表（模板方法）
   */
  async renderView(): Promise<void> {
    try {
      const items = this.getItems();

      // 过滤项目
      let filtered = items;

      // 过滤已删除的项目
      filtered = filtered.filter((item: IPanelItem) => !item.isDeleted);

      // 根据 viewMode 过滤
      const currentViewMode = this.app.viewMode;
      if (currentViewMode === 'safe') {
        filtered = filtered.filter((item: IPanelItem) => item.isSafe !== 0);
      }

      // 标签筛选（多选时同时符合）
      if (this.selectedTags.size > 0) {
        const specialTagChecks = this.getSpecialTagChecks();
        filtered = filtered.filter((item: IPanelItem) => {
          return Array.from(this.selectedTags).every(tag => {
            const checkFn = specialTagChecks.get(tag);
            if (checkFn) {
              return checkFn(item);
            }
            // 普通标签
            if (!item.tags) {
              (window as { electronAPI?: { logError?: (context: string, message: string, data?: unknown) => void } }).electronAPI?.logError?.('PanelManagerBase.ts', `Item ${item.id} has no tags property`, item);
              return false;
            }
            return item.tags.includes(tag);
          });
        });
      }

      // 搜索过滤
      const currentSearchQuery = this.getSearchQuery();
      if (currentSearchQuery) {
        const lowerQuery = currentSearchQuery.toLowerCase();
        filtered = filtered.filter((item: IPanelItem) => this.matchesSearch(item, lowerQuery));
      }

      // 排序
      filtered = this.sortItems(filtered, this.sortBy, this.sortOrder);

      // 保存筛选后的列表
      this.filteredItems = filtered;

      // 检查筛选条件是否改变
      const filterChanged = this.checkFilterChanged();
      if (filterChanged) {
        this.multiSelectManager.clear();
        this.multiSelectManager.hideToolbar();
        // 筛选条件改变时才重置 lastSelectedIndex，因为索引对应关系已改变
        this.multiSelectManager.resetLastSelectedIndex();
      }

      // 子类实现具体的渲染逻辑
      await this.renderContainer(filtered);

      // 设置卡片大小 CSS 变量
      this.applyCardSize();

      // 更新选择模式类
      this.updateSelectionModeClass();
    } catch (error) {
      (window as { electronAPI?: { logError?: (context: string, message: string, data?: unknown) => void } }).electronAPI?.logError?.('PanelManagerBase.ts', `Failed to render ${this.getItemType()} list:`, error);
      this.app.showToast?.(`加载${this.getItemType()}失败`, 'error');
    }
  }

  /**
   * 渲染容器（子类实现具体的容器渲染）
   * @abstract
   * @param filtered - 筛选后的项目列表
   */
  async renderContainer(filtered: IPanelItem[]): Promise<void> {
    throw new Error('renderContainer() must be implemented by subclass');
  }

  /**
   * 渲染标签筛选器（模板方法）
   */
  async renderTagFilters(): Promise<void> {
    try {
      const container = document.getElementById(this.getTagFilterContainerId());
      const specialTagsContainer = document.getElementById(this.getSpecialTagsContainerId());
      const actionBtn = document.getElementById(this.getFilterActionBtnId());

      // 更新筛选动作按钮状态
      if (actionBtn) {
        const hasFilters = this.selectedTags.size > 0;
        actionBtn.textContent = hasFilters ? '清除筛选' : '标签筛选';
        actionBtn.classList.toggle('has-filters', hasFilters);
      }

      // 获取所有标签和标签组
      const tags = await this.getAllTags();
      const tagService = TagService.getInstance(this.getItemType());
      const groups = await tagService.getTagGroups();

      // 计算标签计数
      const tagCounts = this.calculateTagCounts(tags);

      // 获取可见项目
      const visibleItems = this.getItems().filter((item: IPanelItem) => !item.isDeleted && (this.app.viewMode !== 'safe' || item.isSafe !== 0));

      // 计算特殊标签计数
      const specialTags = this.calculateSpecialTagCounts(visibleItems);

      // 构建标签与组的映射
      const tagsWithGroup = tagService.buildTagsWithGroup(tags, groups);

      // 对标签进行排序
      const sortedTagsWithGroup = this.sortTagsForFilter(tagsWithGroup, tagCounts);

      // 渲染特殊标签
      if (specialTagsContainer) {
        await this.renderSpecialTags(specialTagsContainer, specialTags);
      }

      // 渲染普通标签
      await this.renderNormalTags(container, sortedTagsWithGroup, tagCounts, groups);

      // 更新头部标签
      await this.updateTagFilterHeader(specialTags, sortedTagsWithGroup, tagCounts);

      // 绑定事件
      this.bindTagFilterEvents();
    } catch (error) {
      (window as { electronAPI?: { logError?: (context: string, message: string, data?: unknown) => void } }).electronAPI?.logError?.('PanelManagerBase.ts', `Failed to render ${this.getItemType()} tag filters:`, error);
    }
  }

  /**
   * 计算标签计数
   * @param tags - 所有标签
   * @returns 标签计数对象
   */
  calculateTagCounts(tags: string[]): Record<string, number> {
    const visibleItems = this.getItems().filter((item: IPanelItem) => !item.isDeleted && (this.app.viewMode !== 'safe' || item.isSafe !== 0));

    const tagCounts: Record<string, number> = {};
    visibleItems.forEach((item: IPanelItem) => {
      if (item.tags && item.tags.length > 0) {
        item.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    return tagCounts;
  }

  /**
   * 渲染特殊标签
   * @param container - 容器元素
   * @param specialTags - 特殊标签列表
   */
  async renderSpecialTags(container: HTMLElement, specialTags: SpecialTagCount[]): Promise<void> {
    const specialTagsHtml = specialTags.map(({ tag, count }) => {
      const isActive = this.selectedTags.has(tag);
      return `
        <button class="tag-filter-item ${isActive ? 'active' : ''}" data-tag="${HtmlUtils.escapeHtml(tag)}" data-is-special="true">
          <span class="tag-name">${HtmlUtils.escapeHtml(tag)}</span>
          <span class="tag-badge">${count}</span>
        </button>
      `;
    }).join('');

    container.innerHTML = specialTagsHtml || '<span class="tag-filter-empty">暂无特殊标签</span>';
  }

  /**
   * 渲染普通标签
   * @param container - 容器元素
   * @param sortedTagsWithGroup - 排序后的标签列表
   * @param tagCounts - 标签计数
   * @param groups - 标签组
   */
  async renderNormalTags(container: HTMLElement | null, sortedTagsWithGroup: ITagWithGroup[], tagCounts: Record<string, number>, groups: ITagGroup[]): Promise<void> {
    const html = TagUI.generateTagFiltersHtml(sortedTagsWithGroup, tagCounts, {
      specialTags: [],
      selectedTags: this.selectedTags,
      groups: groups,
      isImage: this.getItemType() === 'image'
    });

    if (container) {
      container.innerHTML = html || '<span class="tag-filter-empty">暂无标签</span>';
    }
  }

  /**
   * 排序标签（用于标签筛选器）
   * @param tags - 标签数组
   * @param tagCounts - 标签计数对象
   * @returns 排序后的标签数组
   */
  sortTagsForFilter(tags: ITagWithGroup[], tagCounts: Record<string, number>): ITagWithGroup[] {
    return TopGroupManager.sortTagsWithGroupPriority(tags, tagCounts, {
      sortBy: this.tagFilterSortBy as 'name' | 'count',
      sortOrder: this.tagFilterSortOrder as 'asc' | 'desc'
    });
  }

  /**
   * 绑定标签筛选器事件
   */
  bindTagFilterEvents(): void {
    const container = document.getElementById(this.getTagFilterContainerId());
    const specialTagsContainer = document.getElementById(this.getSpecialTagsContainerId());
    if (!container && !specialTagsContainer) return;

    // 特殊标签点击
    if (specialTagsContainer) {
      specialTagsContainer.querySelectorAll('.tag-filter-item[data-is-special="true"]').forEach((item: Element) => {
        item.addEventListener('click', (e: Event) => {
          const tag = (item as HTMLElement).dataset.tag;
          if (!tag) return;
          if ((e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey) {
            // Ctrl/Cmd + 点击：多选模式
            if (this.selectedTags.has(tag)) {
              this.selectedTags.delete(tag);
            } else {
              this.selectedTags.add(tag);
            }
          } else {
            // 普通点击：纯单选模式
            if (this.selectedTags.has(tag)) {
              this.selectedTags.delete(tag);
            } else {
              this.selectedTags.clear();
              this.selectedTags.add(tag);
            }
          }
          this.renderView();
          this.renderTagFilters();
        });
      });
    }

    // 普通标签点击和拖拽
    if (container) {
      // 使用 WeakSet 来跟踪正在拖拽的元素
      const draggingItems = new WeakSet<HTMLElement>();

      // 先绑定点击事件
      container.querySelectorAll('.tag-filter-item:not([data-is-special="true"])').forEach((item: Element) => {
        item.addEventListener('click', async (e: Event) => {
          // 如果正在拖拽，不触发点击
          if (draggingItems.has(item as HTMLElement)) {
            draggingItems.delete(item as HTMLElement);
            return;
          }
          e.stopPropagation();
          const tag = (item as HTMLElement).dataset.tag;
          const groupId = (item as HTMLElement).closest('.tag-filter-group')?.getAttribute('data-group-id');

          // 获取标签所属的组信息
          const tagService = TagService.getInstance(this.getItemType());
          const groups = await tagService.getTagGroups();
          const group = groups.find((g: { id: number }) => String(g.id) === String(groupId));

          if ((e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey) {
            // Ctrl/Cmd + 点击：多选模式
            if (tag) {
              if (this.selectedTags.has(tag)) {
                this.selectedTags.delete(tag);
              } else {
                this.selectedTags.add(tag);
              }
            }
          } else {
            // 普通点击：纯单选模式
            if (tag) {
              if (this.selectedTags.has(tag)) {
                this.selectedTags.delete(tag);
              } else {
                this.selectedTags.clear();
                this.selectedTags.add(tag);
              }
            }
          }

          this.renderView();
          this.renderTagFilters();
        });
      });

      // 绑定标签拖拽事件
      const draggableItems = container.querySelectorAll('.tag-filter-item[draggable="true"]');
      draggableItems.forEach((item: Element) => {
        item.addEventListener('dragstart', (e: Event) => {
          // 标记为正在拖拽
          draggingItems.add(item as HTMLElement);
          const dragEvent = e as DragEvent;
          const tag = (item as HTMLElement).dataset.tag;
          if (tag) {
            dragEvent.dataTransfer?.setData('text/plain', tag);
            dragEvent.dataTransfer?.setData('drag-source', this.getTagDragType());
          }
          if (dragEvent.dataTransfer) {
            dragEvent.dataTransfer.effectAllowed = 'copy';
          }
          item.classList.add('dragging');
        });

        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
          // 注意：不在 dragend 中删除 draggingItems，因为 click 事件会在 dragend 之后触发
        });
      });
    }
  }

  /**
   * 更新标签筛选区域头部标签（收起时显示）
   * @param specialTags - 特殊标签列表
   * @param sortedTagsWithGroup - 排序后的标签列表
   * @param tagCounts - 标签计数对象
   */
  async updateTagFilterHeader(specialTags: SpecialTagCount[], sortedTagsWithGroup: ITagWithGroup[], tagCounts: Record<string, number>): Promise<void> {
    // 使用 CacheManager 缓存 tagsWithGroup 供 getTopGroupTags 使用
    const cacheKey = `${this.storagePrefix}TagsWithGroup`;
    cacheManager.createCache(cacheKey, 10).set('current', sortedTagsWithGroup);

    TagUI.renderFilterHeader({
      containerId: this.getTagFilterHeaderContainerId(),
      specialTags,
      sortedTagsWithGroup,
      tagCounts,
      selectedTags: this.selectedTags,
      dragType: this.getTagDragType(),
      onTagClick: (tag: string, isTopGroupTag: boolean, _isSingleSelectGroup: boolean, event: MouseEvent) => {
        const isCtrlPressed = event && (event.ctrlKey || event.metaKey);

        if (isCtrlPressed) {
          // Ctrl/Cmd+ 点击：多选模式
          if (this.selectedTags.has(tag)) {
            this.selectedTags.delete(tag);
          } else {
            this.selectedTags.add(tag);
          }
        } else {
          // 普通点击：单选模式
          if (this.selectedTags.has(tag)) {
            this.selectedTags.delete(tag);
          } else {
            // 先清除所有已选标签，再添加当前标签
            this.selectedTags.clear();
            this.selectedTags.add(tag);
          }
        }
        this.renderView();
        this.renderTagFilters();
      }
    });
  }

  /**
   * 获取首位组的标签列表
   * @returns 首位组的所有标签名称
   */
  getTopGroupTags(): string[] {
    // 使用 CacheManager 获取 tagsWithGroup 数据
    const cacheKey = `${this.storagePrefix}TagsWithGroup`;
    const tagsWithGroup = cacheManager.getCache(cacheKey)?.get('current') as ITagWithGroup[] || [];

    // 按组分组
    const groupMap = new Map<number, { groupId: number; groupSortOrder: number; tags: string[] }>();
    tagsWithGroup.forEach((t: ITagWithGroup) => {
      if (t.groupId) {
        if (!groupMap.has(t.groupId)) {
          groupMap.set(t.groupId, {
            groupId: t.groupId,
            groupSortOrder: t.groupSortOrder || 0,
            tags: []
          });
        }
        groupMap.get(t.groupId)?.tags.push(t.name);
      }
    });

    // 按 sortOrder 排序，取第一个组
    const sortedGroups = Array.from(groupMap.values())
      .sort((a, b) => a.groupSortOrder - b.groupSortOrder);

    return sortedGroups.length > 0 ? sortedGroups[0].tags : [];
  }

  /**
   * 清除标签筛选
   */
  clearTagFilter(): void {
    this.selectedTags.clear();
    this.renderView();
    this.renderTagFilters();
  }

  /**
   * 处理筛选动作按钮点击
   */
  handleFilterAction(): void {
    if (this.selectedTags.size > 0) {
      this.clearTagFilter();
    }
    // 如果没有筛选标签，按钮无操作（仅显示文字）
  }

  /**
   * 设置视图模式
   * @param mode - 视图模式
   * @param preserveSelection - 是否保留选择状态（默认 true）
   */
  setViewMode(mode: string, preserveSelection: boolean = true): void {
    // 切换视图模式时可选保留选择状态
    if (!preserveSelection) {
      this.multiSelectManager.clear();
    }

    this.viewModeType = mode;
    localStorage.setItem(`${this.storagePrefix}ViewMode`, mode);
    this.renderView();

    // 更新工具栏
    this.multiSelectManager.updateToolbarUI();
  }

  /**
   * 设置排序方式
   * @param sortBy - 排序字段
   * @param sortOrder - 排序顺序
   */
  setSort(sortBy: string, sortOrder: string): void {
    this.sortBy = sortBy;
    this.sortOrder = sortOrder;
    localStorage.setItem(`${this.storagePrefix}SortBy`, sortBy);
    localStorage.setItem(`${this.storagePrefix}SortOrder`, sortOrder);
    this.renderView();
  }

  /**
   * 设置卡片大小
   * @param size - 卡片大小
   */
  setCardSize(size: number): void {
    // 校验范围
    const clampedSize = Math.max(MIN_CARD_SIZE, Math.min(MAX_CARD_SIZE, size));
    this.cardSize = clampedSize;
    localStorage.setItem(`${this.storagePrefix}CardSize`, String(clampedSize));

    // 更新 CSS 变量
    this.applyCardSize();
  }

  /**
   * 应用卡片大小到 CSS 变量
   */
  private applyCardSize(): void {
    const config = this.getUIConfig();
    const container = document.getElementById(config.gridContainerId);
    if (container) {
      container.style.setProperty('--card-size', `${this.cardSize}px`);
    }
  }

  /**
   * 更新工具栏 UI
   */
  updateToolbarUI(): void {
    this.multiSelectManager.updateToolbarUI();
  }

  /**
   * 退出批量模式
   */
  exitBatchMode(): void {
    this.multiSelectManager.clear();
    this.multiSelectManager.hideToolbar();
  }

  /**
   * 数据更新后的统一刷新
   * 加载最新数据、重新渲染界面、更新标签筛选区
   */
  async refreshAfterUpdate(): Promise<void> {
    await this.loadData();
    await this.renderView();
    await this.renderTagFilters();
  }

  /**
   * 刷新面板
   * 重新加载数据并渲染视图
   */
  async refresh(): Promise<void> {
    await this.loadData();
    await this.renderView();
  }

  /**
   * 更新选择模式类
   * 根据是否有选中项在容器上添加/移除 selection-mode 类
   */
  protected updateSelectionModeClass(): void {
    const containerIds = ['imageGrid', 'promptGrid', 'imageList', 'promptList'];

    containerIds.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        container.classList.toggle('selection-mode', this.multiSelectManager.hasSelection);
      }
    });
  }

  /**
   * 获取当前视图的事件策略
   * 子类实现以提供对应视图的策略
   */
  protected abstract getEventStrategy(): IEventStrategy | null;

  /**
   * 获取当前视图的容器元素
   */
  protected abstract getCurrentContainer(): HTMLElement | null;

  /**
   * 模板方法：绑定项目事件
   * 使用策略模式处理不同视图的事件绑定
   */
  protected bindItemEvents(items: IPanelItem[]): void {
    const strategy = this.getEventStrategy();
    if (!strategy) return;

    const container = this.getCurrentContainer();
    if (!container) return;

    // 构建事件上下文
    const eventContext: EventContext = {
      multiSelectManager: this.multiSelectManager,
      renderView: () => this.renderView(),
      items: items
    };

    strategy.bindEvents(container, items, eventContext);
  }

  // ==================== 批量操作处理方法 ====================

  /**
   * 处理批量删除
   */
  protected async handleBatchDelete(): Promise<void> {
    const configKey = this.storagePrefix as 'image' | 'prompt';
    const config = MultiSelectConfig[configKey]?.operations.delete;
    if (!config) return;

    const selectedIds = Array.from(this.multiSelectManager.selectedIds);
    if (selectedIds.length === 0) return;

    // 确认对话框
    if (config.confirm) {
      const confirmed = await DialogService.showConfirmDialogByConfig(
        { title: '确认删除', message: `确定要删除选中的 ${selectedIds.length} 个项目吗？` }
      );
      if (!confirmed) return;
    }

    try {
      // 批量删除必须实现 batchApi
      if (!config.batchApi) {
        throw new Error(`批量删除配置错误: ${configKey} 未配置 batchApi`);
      }
      const batchApiFn = window.electronAPI[config.batchApi as keyof typeof window.electronAPI] as (ids: string[]) => Promise<{ success: boolean; deleted: number }>;
      await batchApiFn(selectedIds);

      // 清除缓存
      if (config.cacheDelete) {
        config.cacheDelete(cacheManager).clear();
      }

      // 清除选择
      if (config.clearSelection) {
        this.multiSelectManager.clear();
      }

      // 重新加载数据
      if (config.reloadData) {
        await this.refreshAfterUpdate();
      }

      // 发送事件
      if (config.event) {
        this.app.eventBus.emit(config.event, selectedIds);
      }

      // 通知对方面板刷新（关联关系已解除）
      if (configKey === 'image') {
        this.app.eventBus.emit(Events.PROMPTS_CHANGED);
      } else {
        this.app.eventBus.emit(Events.IMAGES_CHANGED);
      }

      this.app.showToast?.(
        config.successMsg(selectedIds.length),
        'success'
      );
    } catch (error) {
      this.app.showToast?.(
        config.errorMsg,
        'error'
      );
    }
  }

  /**
   * 处理批量添加标签
   */
  protected async handleBatchAddTag(): Promise<void> {
    const configKey = this.storagePrefix as 'image' | 'prompt';
    const config = MultiSelectConfig[configKey]?.operations.addTag;
    if (!config) return;

    const selectedIds = Array.from(this.multiSelectManager.selectedIds);
    if (selectedIds.length === 0) return;

    // 输入对话框
    const tagInputResult = await DialogService.showInputDialog({
      title: config.inputTitle,
      placeholder: config.inputPlaceholder
    });

    if (!tagInputResult) return;

    const tagInput = tagInputResult.value;

    try {
      if (config.processItems) {
        await config.processItems(selectedIds, tagInput);
      }

      // 清除选择
      this.multiSelectManager.clear();

      // 重新加载数据
      await this.refreshAfterUpdate();

      // 发送事件
      if (config.event) {
        this.app.eventBus.emit(config.event, { ids: selectedIds, tags: tagInput });
      }

      this.app.showToast?.(
        config.successMsg(selectedIds.length),
        'success'
      );
    } catch (error) {
      this.app.showToast?.(
        config.errorMsg,
        'error'
      );
    }
  }

  /**
   * 处理批量收藏
   */
  protected async handleBatchFavorite(): Promise<void> {
    const configKey = this.storagePrefix as 'image' | 'prompt';
    const config = MultiSelectConfig[configKey]?.operations.favorite;
    if (!config) return;

    const selectedIds = Array.from(this.multiSelectManager.selectedIds);
    if (selectedIds.length === 0) return;

    try {
      if (config.processItems) {
        await config.processItems(selectedIds, null, config.api);
      }

      // 清除选择
      this.multiSelectManager.clear();

      // 重新加载数据
      await this.refreshAfterUpdate();

      // 发送事件
      if (config.event) {
        this.app.eventBus.emit(config.event, selectedIds);
      }

      this.app.showToast?.(
        config.successMsg(selectedIds.length),
        'success'
      );
    } catch (error) {
      this.app.showToast?.(
        config.errorMsg,
        'error'
      );
    }
  }

  /**
   * 处理反选
   */
  protected handleBatchInvert(): void {
    const visibleItems = this.getVisibleItems();
    const allIds = visibleItems.map((item: IPanelItem) => String(item.id));
    this.multiSelectManager.invertSelection(allIds);
  }

  /**
   * 处理取消选择
   */
  protected handleBatchCancel(): void {
    this.multiSelectManager.clear();
  }

  // ==================== 标签拖拽操作 ====================

  /**
   * 处理标签拖拽到卡片
   * @param itemId - 项目 ID
   * @param tagName - 标签名称
   * @param updateApi - 更新 API 函数
   * @returns 是否成功
   */
  async handleTagDrop(itemId: string, tagName: string, updateApi: (id: string, data: { tags: string[] }) => Promise<void>): Promise<boolean> {
    // 从当前项目列表中查找
    const item = this.getItems().find((i: IPanelItem) => String(i.id) === String(itemId));
    if (!item) {
      throw new Error('项目不存在');
    }

    // 确定类型
    const type = this.storagePrefix === 'prompt' ? 'prompt' : 'image';
    const tagService = TagService.getInstance(type);

    // 验证并添加标签（自动从缓存获取标签组）
    const result = await tagService.validateTagAddition(item.tags || [], tagName);

    if (!result.valid) {
      throw new Error(result.error);
    }

    // 更新项目标签
    const newTags = result.newTags || [];
    await updateApi(item.id, { tags: newTags });
    item.tags = newTags;

    await this.refreshAfterUpdate();
    return true;
  }
}

export default PanelManagerBase;
