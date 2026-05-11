import { HtmlUtils } from '../../utils/index.ts';
import { cacheManager } from '../../utils/CacheManager.ts';
import { TagUI } from './TagUI.ts';
import { TopGroupManager } from '../../pyTagGroups/TopGroupManager.ts';
import { ITagWithGroup, ITagGroup } from '../../types/entities.ts';
import { IEventStrategy, EventContext } from './Strategies/IEventStrategy.ts';
import { batchToolbarMiddle, type BatchBusinessConfig } from '../../middle/index.ts';
import { DialogService, DialogConfig } from '../services/index.ts';
import type { IDialogTemplate } from '../../types/entities.ts';
import { Constants, Events } from '../../constants.ts';
import { TagService } from '../services/index.ts';
import { buildTagsWithGroupInfo } from '../../pyTagGroups/utils.ts';
import { IApp } from '../app.types.ts';
import { localStorageManager } from '../configs/LocalStorageConfig.ts';

// 卡片大小限制常量
const MIN_CARD_SIZE = 100;
const MAX_CARD_SIZE = 350;

// 面板管理器基类选项接口
interface PanelManagerBaseOptions {
  app: IApp;
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
  app: IApp;
  protected tagManager?: unknown;
  protected defaultCardSize: number;
  protected onSelectionChange?: () => void;

  // 通用状态
  protected filteredItems: IPanelItem[] = [];
  protected selectedTags: Set<string> = new Set();

  // 视图设置（在子类构造函数中初始化）
  viewModeType!: string;
  sortBy!: string;
  sortOrder!: string;
  cardSize!: number;
  tagFilterSortBy!: string;
  tagFilterSortOrder!: string;

  // 工具栏上下文（在 init 方法中设置）
  protected toolbarContext!: 'promptMain' | 'imageMain';

  // 面板类型（子类实现）
  protected abstract readonly panelType: 'prompt' | 'image';

  // UI 配置（子类实现）
  protected abstract getUIConfig(): IUIConfig;
  protected abstract getTagFilterToggleBtnId(): string;
  protected abstract getTagManagerBtnId(): string;

  // 存储键名（子类实现）
  protected abstract get storageKeys(): {
    viewMode: string;
    sortBy: string;
    sortOrder: string;
    cardSize: string;
    tagFilterSortBy: string;
    tagFilterSortOrder: string;
    tagFilterCollapsed: string;
  };

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
    // eventBus 通过 app 访问
    this.defaultCardSize = options.defaultCardSize || 200;
    this.onSelectionChange = options.onSelectionChange;

    // 注意：storageKeys 是抽象 getter，panelType 是抽象属性
    // 需要在子类构造函数中调用 init() 方法完成初始化
  }

  /**
   * 初始化面板管理器
   * 在子类构造函数中调用，此时 panelType 和 storageKeys 已可用
   */
  protected initPanelManager(): void {
    // 设置工具栏上下文
    this.toolbarContext = this.panelType === 'prompt' ? 'promptMain' : 'imageMain';

    // 业务配置
    const businessConfig: BatchBusinessConfig = {
      delete: {
        batchApi: this.panelType === 'prompt'
          ? async (ids) => {
              const result = await window.electronAPI.softDeletePrompts(ids);
              return { success: result.success, deleted: result.deleted };
            }
          : async (ids) => {
              const result = await window.electronAPI.softDeleteImages(ids);
              return { success: result.success, deleted: result.deleted };
            },
        clearCache: () => {
          const cache = this.panelType === 'prompt'
            ? cacheManager.getPromptCache()
            : cacheManager.getImageCache();
          cache.clear();
        }
      },
      addTag: {
        processItems: async (ids: string[], tagNames: string[]) => {
          const tagService = TagService.getInstance();
          const result = await tagService.batchLinkTags({
            tagNames,
            type: this.panelType,
            itemIds: ids
          });
          if (result.errors.length > 0) {
            throw new Error(result.errors.map((e: { error: string }) => e.error).join(', '));
          }
        }
      },
      favorite: {
        batchApi: this.panelType === 'prompt'
          ? (ids) => window.electronAPI.batchFavoritePrompts(ids).then(() => {})
          : (ids) => window.electronAPI.batchFavoriteImages(ids).then(() => {})
      }
    };

    // 统一使用 presets.ts 中的配置
    batchToolbarMiddle.init(this.toolbarContext, businessConfig);

    // 注册选择状态变化回调
    batchToolbarMiddle.registerSelectionChangeCallback(this.toolbarContext, () => {
      this.updateSelectionModeClass();
      this.updateItemSelectionState();
      // 如果有选中项但工具栏未显示，显式进入批量模式
      if (batchToolbarMiddle.getSelectionCount(this.toolbarContext) > 0 && !batchToolbarMiddle.isVisible(this.toolbarContext)) {
        this.enterBatchMode();
      }
    });

    // 注册按钮处理器
    this.registerBatchToolbarHandlers();

    // 绑定事件
    this.subscribeToEvents();
  }

  /**
   * 注册批量工具栏按钮处理器
   */
  private registerBatchToolbarHandlers(): void {
    // 全选
    batchToolbarMiddle.registerActionHandler(this.toolbarContext, 'SelectAll', () => {
      this.selectAllVisibleItems();
    });

    // 反选
    batchToolbarMiddle.registerActionHandler(this.toolbarContext, 'Invert', () => {
      this.handleBatchInvert();
    });

    // 添加标签
    batchToolbarMiddle.registerActionHandler(this.toolbarContext, 'AddTag', () => {
      this.handleBatchAddTag();
    });

    // 收藏
    batchToolbarMiddle.registerActionHandler(this.toolbarContext, 'Favorite', () => {
      this.handleBatchFavorite();
    });

    // 删除
    batchToolbarMiddle.registerActionHandler(this.toolbarContext, 'Delete', () => {
      this.handleBatchDelete();
    });

    // 取消
    batchToolbarMiddle.registerActionHandler(this.toolbarContext, 'Cancel', () => {
      this.handleBatchCancel();
    });
  }

  /**
   * 检查当前面板是否是活动面板（可见）
   * @returns 是否是活动面板
   */
  protected isActivePanel(): boolean {
    // 通过 app.currentPanel 判断当前活动面板
    const currentPanel = this.app.currentPanel;
    if (!currentPanel) return false;

    // 根据 panelType 判断面板类型
    return currentPanel === this.panelType;
  }

  /**
   * 全选所有可见项目
   */
  selectAllVisibleItems(): void {
    const visibleItems = this.getVisibleItems();
    const ids = visibleItems.map((item: IPanelItem) => String(item.id));
    batchToolbarMiddle.selectAll(this.toolbarContext, ids);
    // 重新渲染视图以更新选中状态
    this.renderView();
  }

  /**
   * 获取项目列表（子类实现）
   * @abstract
   * @returns 项目列表
   */
  abstract getItems(): IPanelItem[];

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
  abstract matchesSearch(item: IPanelItem, lowerQuery: string): boolean;

  /**
   * 获取特殊标签检查函数 Map（子类实现）
   * @abstract
   * @returns 特殊标签检查函数 Map
   */
  abstract getSpecialTagChecks(): Map<string, (item: IPanelItem) => boolean>;

  /**
   * 获取项目类型标识（子类实现）
   * @abstract
   * @returns 项目类型
   */
  abstract getItemType(): 'prompt' | 'image';

  /**
   * 加载数据（抽象方法, 必须子类实现）
   * @abstract
   * @returns 项目列表
   */
  abstract loadData(): Promise<IPanelItem[]>;

  /**
   * 创建卡片 HTML（子类实现）
   * @abstract
   * @param item - 项目对象
   * @returns HTML 字符串
   */
  abstract createCard(item: IPanelItem): string;

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
            window.electronAPI.logError('PanelManagerBase.ts', 'Failed to copy to clipboard', error);
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
            window.electronAPI.logError('PanelManagerBase.ts', 'Failed to copy to clipboard', error);
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
  abstract bindHoverPreview(selector: string): void;

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
              await this.handleTagDrop(id, tagName);
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
  abstract renderListView(filtered: IPanelItem[]): Promise<void>;

  /**
   * 获取标签筛选容器 ID（子类实现）
   * @abstract
   * @returns 容器 ID
   */
  abstract getTagFilterContainerId(): string;

  /**
   * 获取特殊标签容器 ID（子类实现）
   * @abstract
   * @returns 容器 ID
   */
  abstract getSpecialTagsContainerId(): string;

  /**
   * 获取筛选动作按钮 ID（实现基类抽象方法）
   * @returns 按钮 ID
   */
  abstract getFilterActionBtnId(): string;

  /**
   * 获取标签筛选头部容器 ID（子类实现）
   * @abstract
   * @returns 容器 ID
   */
  abstract getTagFilterHeaderContainerId(): string;

  /**
   * 获取标签筛选排序选择器 ID（子类实现）
   * @abstract
   * @returns 选择器 ID
   */
  abstract getTagFilterSortSelectId(): string;

  /**
   * 获取标签筛选排序顺序按钮 ID（子类实现）
   * @abstract
   * @returns 按钮 ID
   */
  abstract getTagFilterOrderBtnId(): string;

  /**
   * 获取标签拖拽类型（子类实现）
   * @abstract
   * @returns 拖拽类型
   */
  abstract getTagDragType(): string;

  /**
   * 获取所有标签（子类实现）
   * @abstract
   * @returns 标签列表
   */
  abstract getAllTags(): Promise<string[]>;

  /**
   * 计算特殊标签计数（子类实现）
   * @abstract
   * @param visibleItems - 可见项目列表
   * @returns 特殊标签计数列表
   */
  abstract calculateSpecialTagCounts(visibleItems: IPanelItem[]): SpecialTagCount[];

  /**
   * 删除项目（子类实现）
   * @abstract
   * @param id - 项目 ID
   */
  abstract deleteItem(id: string): Promise<void>;

  /**
   * 切换收藏状态（子类实现）
   * @abstract
   * @param id - 项目 ID
   * @param isFavorite - 是否收藏
   */
  abstract toggleFavorite(id: string, isFavorite: boolean): Promise<void>;

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
  abstract sortItems(items: IPanelItem[], sortBy: string, sortOrder: string): IPanelItem[];

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
   * 恢复标签筛选区展开/收起状态
   */
  restoreTagFilterState(): void {
    const collapsed = localStorageManager.get<boolean>(this.getTagFilterStorageKey());
    if (collapsed) {
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
      localStorageManager.set(this.getTagFilterStorageKey(), collapsed);
    }
    await this.renderTagFilters();
  }

  /**
   * 获取标签筛选区 section ID
   */
  private getTagFilterSectionId(): string {
    return this.panelType === 'prompt'
      ? Constants.Ids.PROMPT_TAG_FILTER_SECTION
      : Constants.Ids.IMAGE_TAG_FILTER_SECTION;
  }

  /**
   * 获取标签筛选区收起状态的 storage key
   * 使用子类定义的 storageKeys
   */
  private getTagFilterStorageKey(): string {
    return this.storageKeys.tagFilterCollapsed;
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

      // 子类实现具体的渲染逻辑
      await this.renderContainer(filtered);

      // 设置卡片大小 CSS 变量
      this.applyCardSize();

      // 更新选择模式类
      this.updateSelectionModeClass();

      // 更新卡片/列表项的选中状态（视图切换后需要重新应用）
      this.updateItemSelectionState();
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
  abstract renderContainer(filtered: IPanelItem[]): Promise<void>;

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
      const tagService = TagService.getInstance();
      const groups = await tagService.getTagGroups(this.getItemType());



      // 计算标签计数
      const tagCounts = this.calculateTagCounts(tags);

      // 获取可见项目
      const visibleItems = this.getItems().filter((item: IPanelItem) => !item.isDeleted && (this.app.viewMode !== 'safe' || item.isSafe !== 0));

      // 计算特殊标签计数
      const specialTags = this.calculateSpecialTagCounts(visibleItems);

      // 构建标签与组的映射
      const tagsWithGroup = buildTagsWithGroupInfo(tags, groups);

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
   * 计算可见项目的标签计数（考虑 viewMode 和 isDeleted）
   * 用于特殊标签筛选器显示
   * @param _tags - 所有标签（为兼容接口保留，实际使用 visibleItems 计算）
   * @returns 标签计数对象
   */
  calculateTagCounts(_tags: string[]): Record<string, number> {
    const visibleItems = this.getItems().filter(
      (item: IPanelItem) => !item.isDeleted && (this.app.viewMode !== 'safe' || item.isSafe !== 0)
    );
    return TagService.countTagsInItems(visibleItems);
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
          // 标签筛选改变时退出批量模式
          this.exitBatchMode();
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

          // 标签筛选改变时退出批量模式
          this.exitBatchMode();
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

    // 绑定标签筛选排序选择器事件（防止重复绑定）
    const sortSelect = document.getElementById(this.getTagFilterSortSelectId()) as HTMLSelectElement | null;
    if (sortSelect && !sortSelect.hasAttribute('data-event-bound')) {
      sortSelect.setAttribute('data-event-bound', 'true');
      sortSelect.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLSelectElement;
        const [sortBy, sortOrder] = target.value.split('-');
        this.tagFilterSortBy = sortBy;
        this.tagFilterSortOrder = sortOrder as 'asc' | 'desc';
        localStorageManager.set(this.storageKeys.tagFilterSortBy, sortBy);
        localStorageManager.set(this.storageKeys.tagFilterSortOrder, sortOrder);
        this.renderTagFilters();
      });
    }

    // 绑定标签筛选排序顺序按钮事件（防止重复绑定）
    const orderBtn = document.getElementById(this.getTagFilterOrderBtnId());
    if (orderBtn && !orderBtn.hasAttribute('data-event-bound')) {
      orderBtn.setAttribute('data-event-bound', 'true');
      orderBtn.addEventListener('click', () => {
        const newOrder = this.tagFilterSortOrder === 'asc' ? 'desc' : 'asc';
        this.tagFilterSortOrder = newOrder;
        localStorageManager.set(this.storageKeys.tagFilterSortOrder, newOrder);
        if (sortSelect) {
          sortSelect.value = `${this.tagFilterSortBy}-${newOrder}`;
        }
        this.renderTagFilters();
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
    const cacheKey = `${this.panelType}TagsWithGroup`;
    cacheManager.createCache(cacheKey, 10).set('current', sortedTagsWithGroup);

    TagUI.renderFilterHeader({
      containerId: this.getTagFilterHeaderContainerId(),
      specialTags,
      sortedTagsWithGroup,
      tagCounts,
      selectedTags: this.selectedTags,
      dragType: this.getTagDragType(),
      onTagClick: (tag: string, isTopGroupTag: boolean, event: MouseEvent) => {
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
        // 标签筛选改变时退出批量模式
        this.exitBatchMode();
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
    const cacheKey = `${this.panelType}TagsWithGroup`;
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
   */
  setViewMode(mode: string): void {
    this.viewModeType = mode;
    localStorageManager.set(this.storageKeys.viewMode, mode);
    this.renderView();
  }

  /**
   * 设置排序方式
   * @param sortBy - 排序字段
   * @param sortOrder - 排序顺序
   */
  setSort(sortBy: string, sortOrder: string): void {
    this.sortBy = sortBy;
    this.sortOrder = sortOrder;
    localStorageManager.set(this.storageKeys.sortBy, sortBy);
    localStorageManager.set(this.storageKeys.sortOrder, sortOrder);
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
    localStorageManager.set(this.storageKeys.cardSize, clampedSize);

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
    // 由 BatchToolbarMiddle 自动同步
  }

  /**
   * 进入批量模式
   */
  enterBatchMode(): void {
    batchToolbarMiddle.show(
      this.toolbarContext,
      batchToolbarMiddle.getSelectionCount(this.toolbarContext),
      () => this.exitBatchMode()
    );
  }

  /**
   * 退出批量模式
   */
  exitBatchMode(): void {
    batchToolbarMiddle.hide(this.toolbarContext);
    batchToolbarMiddle.clearSelection(this.toolbarContext);
    this.updateSelectionModeClass();
    this.clearAllItemSelectionState();
  }

  /**
   * 清除所有卡片/列表项的选中状态
   * 在退出批量模式时调用，确保复选框和选中样式被清除
   */
  protected clearAllItemSelectionState(): void {
    // 根据当前面板类型获取选择器
    const isImagePanel = this.panelType === 'image';
    const cardSelector = isImagePanel ? '.image-card' : '.prompt-card';
    const listItemSelector = isImagePanel ? '.list-item--image' : '.list-item--prompt';
    const compactItemSelector = isImagePanel ? '.list-item--image.list-item--compact' : '.list-item--prompt.list-item--compact';

    // 清除网格视图中的卡片选中状态
    document.querySelectorAll(cardSelector).forEach((card) => {
      card.classList.remove('is-selected');
      const checkbox = card.querySelector('.card-checkbox') as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = false;
      }
    });

    // 清除列表视图中的项选中状态
    document.querySelectorAll(listItemSelector).forEach((item) => {
      item.classList.remove('is-selected');
      const checkbox = item.querySelector('.list-item__checkbox') as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = false;
      }
    });

    // 清除紧凑视图中的项选中状态
    document.querySelectorAll(compactItemSelector).forEach((item) => {
      item.classList.remove('is-selected');
    });
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
    const containerIds = [Constants.Ids.IMAGE_GRID, Constants.Ids.PROMPT_GRID, Constants.Ids.IMAGE_LIST, Constants.Ids.PROMPT_LIST];

    containerIds.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        container.classList.toggle('selection-mode', batchToolbarMiddle.getSelectionCount(this.toolbarContext) > 0);
      }
    });
  }

  /**
   * 更新卡片/列表项的选中状态
   * 在视图切换或重新渲染后调用，确保选中状态正确显示
   */
  protected updateItemSelectionState(): void {
    const selectedIds = batchToolbarMiddle.getSelectedIds(this.toolbarContext);
    if (selectedIds.size === 0) return;

    // 根据当前面板类型获取选择器
    const isImagePanel = this.panelType === 'image';
    const cardSelector = isImagePanel ? '.image-card' : '.prompt-card';
    const listItemSelector = isImagePanel ? '.list-item--image' : '.list-item--prompt';
    const compactItemSelector = isImagePanel ? '.list-item--image.list-item--compact' : '.list-item--prompt.list-item--compact';

    // 更新网格视图中的卡片
    document.querySelectorAll(cardSelector).forEach((card) => {
      const id = card.getAttribute('data-id');
      if (id && selectedIds.has(id)) {
        card.classList.add('is-selected');
      }
    });

    // 更新列表视图中的项
    document.querySelectorAll(listItemSelector).forEach((item) => {
      const id = item.getAttribute('data-id');
      if (id && selectedIds.has(id)) {
        item.classList.add('is-selected');
        // 更新复选框的 checked 状态
        const checkbox = item.querySelector('.list-item__checkbox') as HTMLInputElement;
        if (checkbox) {
          checkbox.checked = true;
        }
      }
    });

    // 更新紧凑视图中的项
    document.querySelectorAll(compactItemSelector).forEach((item) => {
      const id = item.getAttribute('data-id');
      if (id && selectedIds.has(id)) {
        item.classList.add('is-selected');
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
   * 先清理旧的事件监听器，再绑定新的
   */
  protected bindItemEvents(items: IPanelItem[]): void {
    const strategy = this.getEventStrategy();
    if (!strategy) return;

    const container = this.getCurrentContainer();
    if (!container) return;

    // 先清理旧的事件监听器，防止内存泄漏
    strategy.unbindEvents(container);

    // 构建事件上下文
    const eventContext: EventContext = {
      batchToolbarMiddle,
      toolbarContext: this.toolbarContext,
      renderView: () => this.renderView(),
      items: items
    };

    strategy.bindEvents(container, items, eventContext);
  }


  /**
   * 处理反选
   */
  protected handleBatchInvert(): void {
    const visibleItems = this.getVisibleItems();
    const allIds = visibleItems.map((item: IPanelItem) => String(item.id));
    batchToolbarMiddle.invertSelection(this.toolbarContext, allIds);
    // 重新渲染视图以更新选中状态
    this.renderView();
  }

  /**
   * 处理批量删除
   */
  protected async handleBatchDelete(): Promise<void> {
    const isPrompt = this.panelType === 'prompt';
    await batchToolbarMiddle.executeDelete(this.toolbarContext, {
      confirmConfig: isPrompt ? DialogConfig.BATCH_DELETE_PROMPTS : DialogConfig.BATCH_DELETE_IMAGES,
      execute: async (ids) => {
        const result = await (isPrompt
          ? window.electronAPI.softDeletePrompts(ids)
          : window.electronAPI.softDeleteImages(ids));
        return { success: result.success, deleted: result.deleted };
      },
      onRefresh: async () => {
        await this.refreshAfterUpdate();
        this.app.eventBus.emit(isPrompt ? Events.PROMPTS_CHANGED : Events.IMAGES_CHANGED);
      },
      showToast: (msg, type) => {
        this.app.showToast?.(msg, type);
      },
      successMessage: (deleted) => {
        const msg = `${deleted} 个${isPrompt ? '提示词' : '图像'}已删除`;
        return msg;
      },
    });
  }

  /**
   * 处理批量添加标签
   */
  protected async handleBatchAddTag(): Promise<void> {
    const selectedIds = Array.from(batchToolbarMiddle.getSelectedIds(this.toolbarContext));
    if (selectedIds.length === 0) return;

    const tagInputResult = await DialogService.showInputDialog({
      title: '批量添加标签',
      placeholder: '请输入标签名，多个标签用逗号分隔'
    });

    if (!tagInputResult) return;

    const tagNames = tagInputResult.value.split(',').map((t: string) => t.trim()).filter((t: string) => t);
    if (tagNames.length === 0) return;

    try {
      await batchToolbarMiddle.batchAddTag(this.toolbarContext, selectedIds, tagNames);
      // 添加标签后不清空选择状态，保持批量模式
      await this.refreshAfterUpdate();
      this.app.showToast?.(`已为 ${selectedIds.length} 个项目添加标签`, 'success');
    } catch (error) {
      window.electronAPI.logError('PanelManagerBase.ts', 'Failed to batch add tag', error);
      this.app.showToast?.('批量添加标签失败', 'error');
    }
  }

  /**
   * 处理批量收藏
   */
  protected async handleBatchFavorite(): Promise<void> {
    const selectedIds = Array.from(batchToolbarMiddle.getSelectedIds(this.toolbarContext));
    if (selectedIds.length === 0) return;

    try {
      await batchToolbarMiddle.batchFavorite(this.toolbarContext, selectedIds, true);
      // 收藏后不清空选择状态，保持批量模式
      await this.refreshAfterUpdate();

      const isPrompt = this.panelType === 'prompt';
      this.app.showToast?.(`已收藏 ${selectedIds.length} 个${isPrompt ? '提示词' : '图像'}`, 'success');
    } catch (error) {
      window.electronAPI.logError('PanelManagerBase.ts', 'Failed to batch fav', error);
      this.app.showToast?.('批量收藏失败', 'error');
    }
  }

  /**
   * 处理取消选择
   */
  protected handleBatchCancel(): void {
    batchToolbarMiddle.clearSelection(this.toolbarContext);
    // 重新渲染视图以清除选中状态
    this.renderView();
  }

  // ==================== 标签拖拽操作 ====================

  /**
   * 处理标签拖拽到卡片
   * @param itemId - 项目 ID
   * @param tagName - 标签名称
   * @returns 是否成功
   */
  async handleTagDrop(itemId: string, tagName: string): Promise<boolean> {
    // 从当前项目列表中查找
    const item = this.getItems().find((i: IPanelItem) => String(i.id) === String(itemId));
    if (!item) {
      throw new Error('项目不存在');
    }

    // 检查标签是否已存在
    const currentTags = item.tags || [];
    if (currentTags.includes(tagName)) {
      throw new Error('该标签已存在');
    }

    // 确定类型
    const type = this.panelType;

    // 使用 TagService 统一处理创建和关联
    const tagService = TagService.getInstance();
    const result = await tagService.linkTagsToItem({
      tagNames: [tagName],
      type: type as 'prompt' | 'image',
      itemId: item.id
    });

    if (result.errors.length > 0) {
      throw new Error(result.errors[0].error);
    }

    // 更新本地状态
    item.tags = [...currentTags, tagName];
    await this.refreshAfterUpdate();
    return true;
  }
}
