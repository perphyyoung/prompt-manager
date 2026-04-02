import { HtmlUtils, cacheManager } from '../../utils/index.ts';
import { PanelManagerBase } from './PanelManagerBase.ts';
import { PanelRenderer, UnifiedCardRenderer, PromptMainConfig, UnifiedListRenderer, PromptListConfig } from './SharedComponents/index.ts';
import { Constants } from '../../constants.ts';
import { DialogService, DialogConfig } from '../services/index.ts';
import { BatchConfig } from '../config/index.ts';
import { IPrompt } from '../../types/entities.ts';
import type { LRUCache } from '../../utils/LRUCache.ts';

interface PromptPanelManagerOptions {
  app: {
    promptCache: LRUCache<IPrompt>;
    searchSortManager?: { getPromptSearchQuery: () => string };
    openEditPromptModal: (prompt: IPrompt, options: { filteredList: IPrompt[] }) => void;
    showToast: (message: string, type: string) => void;
    emit: (event: string, data?: unknown) => void;
    currentPanel: string;
    viewMode: string;
    trashManager?: { loadTrash: () => Promise<void> };
    renderStatistics?: () => Promise<void>;
    promptHoverTooltip?: {
      bind: (selector: string, options: {
        getContent: (element: Element) => string;
        getImageId: (element: Element) => string | null;
        delay: number;
      }) => void;
    };
    findImageById: (imageId: string, allImages?: Array<{ id: string }> | null) => { id: string } | null;
    handlePromptItemSelection: (promptId: string, index: number, event: MouseEvent) => void;
  };
  tagManager?: unknown;
  saveManager?: unknown;
  eventBus?: { emit: (event: string, data?: unknown) => void; on: (event: string, callback: () => void) => void };
  toolbarConfig?: {
    toolbarId: string;
    actionsId: string;
    countId: string;
    selectAllCheckboxId: string;
    label: string;
    buttons: Array<{ id: string; text: string; className: string; title?: string; action: string }>;
    onDelete?: () => void;
    onAddTag?: () => void;
    onSetSafe?: () => void;
    onSetUnsafe?: () => void;
    onCancel?: () => void;
  };
}

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
  private saveManager?: unknown;
  filteredPrompts: IPrompt[] = [];

  // 提示词特殊标签检查函数 Map
  static PROMPT_TAG_CHECKS = new Map<string, (p: IPrompt) => boolean>([
    [Constants.FAVORITE_TAG, (p) => !!p.isFavorite],
    [Constants.SAFE_TAG, (p) => p.isSafe !== 0],
    [Constants.UNSAFE_TAG, (p) => p.isSafe === 0],
    [Constants.MULTI_IMAGE_TAG, (p) => !!p.images && p.images.length >= 2],
    [Constants.NO_IMAGE_TAG, (p) => !p.images || p.images.length === 0],
    [Constants.NO_TAG_TAG, (p) => !p.tags || p.tags.length === 0]
  ]);

  constructor(options: PromptPanelManagerOptions) {
    super({
      app: options.app,
      tagManager: options.tagManager,
      eventBus: options.eventBus,
      storagePrefix: 'prompt',
      defaultCardSize: 260,
      toolbarConfig: options.toolbarConfig,
      operationConfig: BatchConfig.prompt.operations
    });
    this.saveManager = options.saveManager;
    this.filteredPrompts = [];
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
    return Array.from((this.app as PromptPanelManagerOptions['app']).promptCache.values());
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
    return (this.app as PromptPanelManagerOptions['app']).searchSortManager?.getPromptSearchQuery() || '';
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
  getItemType(): string {
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
    await this.loadData();
    this.isInitialized = true;
  }

  /**
   * 渲染容器（实现基类抽象方法）
   */
  async renderContainer(filtered: IPrompt[]): Promise<void> {
    this.filteredPrompts = filtered;

    const container = document.getElementById('promptGrid');
    const listContainer = document.getElementById('promptList');

    if (filtered.length === 0) {
      PanelRenderer.showEmptyState('promptGrid', 'promptEmptyState', '暂无提示词');
      if (listContainer) listContainer.style.display = 'none';
      return;
    }

    PanelRenderer.hideEmptyState('promptGrid', 'promptEmptyState');

    // 根据视图模式渲染
    if (this.viewModeType === 'grid') {
      container!.style.display = 'grid';
      if (listContainer) listContainer.style.display = 'none';

      // 渲染网格视图
      PanelRenderer.renderGrid(filtered, (prompt) => this.createCard(prompt as IPrompt), 'promptGrid');
      this.bindCardEvents(filtered);
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
  createCard(prompt: IPrompt): string {
    return UnifiedCardRenderer.render(PromptMainConfig, prompt, {
      icons: Constants.ICONS,
      sortBy: this.sortBy,
      app: this.app
    });
  }

  /**
   * 绑定提示词卡片事件（实现基类抽象方法）
   */
  bindCardEvents(filtered: IPrompt[]): void {
    const container = document.getElementById('promptGrid');
    if (!container) return;

    filtered.forEach(prompt => {
      const card = container.querySelector(`[data-id="${prompt.id}"]`);
      if (!card) return;

      // 点击卡片
      card.addEventListener('click', (e) => {
        if (!(e.target as Element).closest('.action-btn')) {
          (this.app as PromptPanelManagerOptions['app']).openEditPromptModal(prompt, { filteredList: filtered });
        }
      });

      // 复制按钮
      const copyBtn = card.querySelector('.copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await window.electronAPI.copyToClipboard(prompt.content);
            (this.app as PromptPanelManagerOptions['app']).showToast('已复制到剪贴板', 'success');
          } catch (error) {
            (this.app as PromptPanelManagerOptions['app']).showToast('复制失败', 'error');
          }
        });
      }

      // 删除按钮
      const deleteBtn = card.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const confirmed = await DialogService.showConfirmDialogByConfig(
            DialogConfig.DELETE_PROMPT,
            { name: prompt.title || '未命名' }
          );
          if (confirmed) {
            await this.deleteItem(String(prompt.id));
          }
        });
      }

      // 收藏按钮
      const favoriteBtn = card.querySelector('.favorite-btn');
      if (favoriteBtn) {
        favoriteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.toggleFavorite(String(prompt.id), !prompt.isFavorite);
        });
      }
    });
  }

  /**
   * 异步加载卡片背景图（实现基类抽象方法）
   */
  async loadCardBackgrounds(): Promise<void> {
    const container = document.getElementById('promptGrid');
    if (!container) return;

    const cards = container.querySelectorAll('.prompt-card');

    for (const card of cards) {
      const promptId = (card as HTMLElement).dataset.id;
      const prompt = this.prompts.find(p => String(p.id) === String(promptId));

      if (!prompt || !prompt.images || prompt.images.length === 0) continue;

      const firstImage = prompt.images[0] as ImageInfo;
      const imagePath = firstImage.thumbnailPath || firstImage.relativePath;

      if (!imagePath) continue;

      try {
        const fullPath = await window.electronAPI.getImagePath(imagePath);
        const bgElement = card.querySelector('.prompt-card-bg, .card__bg');
        if (bgElement) {
          (bgElement as HTMLElement).style.backgroundImage = `url('file://${fullPath.replace(/\\/g, '/')}')`;
        }
      } catch (error) {
        window.electronAPI.logError('PromptPanelManager.ts', 'Failed to load card background:', error);
      }
    }
  }

  /**
   * 渲染提示词列表视图（实现基类抽象方法）
   */
  async renderListView(filtered: IPrompt[]): Promise<void> {
    const listContainer = document.getElementById('promptList');
    if (!listContainer) return;

    const isCompact = this.viewModeType === 'list-compact';

    // 使用统一列表渲染器生成列表项 HTML
    const listItemsHtml = filtered.map((prompt, index) =>
      UnifiedListRenderer.render(PromptListConfig, prompt, {
        icons: Constants.ICONS,
        isCompact,
        isSelected: this.selectedIds.has(String(prompt.id)),
        index
      })
    );

    listContainer.innerHTML = listItemsHtml.join('');

    // 异步加载提示词列表缩略图
    await this.loadPromptListThumbnails(filtered);

    // 绑定事件
    this.bindPromptListItemEvents(listContainer, filtered);
    this.bindHoverPreview('.list-item--prompt');
    this.bindCardDropEvents(listContainer);
    this.toolbarController?.updateUI();
  }

  /**
   * 异步加载提示词列表缩略图
   */
  async loadPromptListThumbnails(filtered: IPrompt[]): Promise<void> {
    const listContainer = document.getElementById('promptList');
    if (!listContainer) return;

    const allImages = await window.electronAPI.getImages('updatedAt', 'desc');
    const items = listContainer.querySelectorAll('.list-item--prompt');

    for (const item of items) {
      const promptId = (item as HTMLElement).dataset.id;
      const prompt = filtered.find(p => String(p.id) === String(promptId));
      if (!prompt || !prompt.images || prompt.images.length === 0) continue;

      const firstImageId = typeof prompt.images[0] === 'object' ? (prompt.images[0] as ImageInfo).id : prompt.images[0];
      const img = (this.app as PromptPanelManagerOptions['app']).findImageById(String(firstImageId), allImages) as ImageInfo | undefined;
      if (!img) continue;

      const imagePath = img.thumbnailPath || img.relativePath;
      if (!imagePath) continue;

      try {
        const fullPath = await window.electronAPI.getImagePath(imagePath);
        const thumbnailEl = item.querySelector('.list-item__thumbnail') as HTMLImageElement | null;
        if (thumbnailEl) {
          thumbnailEl.src = `file://${fullPath.replace(/"/g, '&quot;')}`;
        }
      } catch (error) {
        window.electronAPI.logError('PromptPanelManager.ts', 'Failed to load prompt list thumbnail:', error);
      }
    }
  }

  /**
   * 绑定提示词列表项事件
   */
  bindPromptListItemEvents(listContainer: HTMLElement, filtered: IPrompt[]): void {
    listContainer.querySelectorAll('.list-item--prompt').forEach(item => {
      const promptId = (item as HTMLElement).dataset.id;
      const index = parseInt((item as HTMLElement).dataset.index || '0');
      const prompt = filtered.find(p => String(p.id) === String(promptId));
      if (!prompt) return;

      // 复选框
      const checkbox = item.querySelector('.list-item__checkbox') as HTMLInputElement | null;
      if (checkbox) {
        // 设置初始状态
        const idStr = String(promptId);
        checkbox.checked = this.selectedIds.has(idStr);

        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          const idStr = String(promptId);
          if ((e.target as HTMLInputElement).checked) {
            this.selectedIds.add(idStr);
          } else {
            this.selectedIds.delete(idStr);
          }
          this.lastSelectedIndex = index;
          this.renderView();
          this.toolbarController?.updateUI();
        });
      }

      // 点击整行
      item.addEventListener('click', (e: Event) => {
        if ((e.target as Element).closest('.list-item__checkbox') || (e.target as Element).closest('.list-item__actions')) {
          return;
        }

        const mouseEvent = e as MouseEvent;
        // Ctrl/Shift 点击：多选
        if (mouseEvent.ctrlKey || mouseEvent.metaKey || mouseEvent.shiftKey) {
          (this.app as PromptPanelManagerOptions['app']).handlePromptItemSelection(String(promptId), index, mouseEvent);
        } else {
          // 普通点击：打开编辑
          (this.app as PromptPanelManagerOptions['app']).openEditPromptModal(prompt, { filteredList: filtered });
        }
      });

      // 复制按钮
      const copyBtn = item.querySelector('.copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await window.electronAPI.copyToClipboard(prompt.content);
            (this.app as PromptPanelManagerOptions['app']).showToast('已复制到剪贴板', 'success');
          } catch (error) {
            (this.app as PromptPanelManagerOptions['app']).showToast('复制失败', 'error');
          }
        });
      }

      // 收藏按钮
      const favoriteBtn = item.querySelector('.favorite-btn');
      if (favoriteBtn) {
        favoriteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.toggleFavorite(String(prompt.id), !prompt.isFavorite);
        });
      }

      // 删除按钮
      const deleteBtn = item.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const confirmed = await DialogService.showConfirmDialogByConfig(
            DialogConfig.DELETE_PROMPT,
            { name: prompt.title || '未命名' }
          );
          if (confirmed) {
            await this.deleteItem(String(prompt.id));
          }
        });
      }
    });
  }

  /**
   * 绑定 hover 预览事件（实现基类抽象方法）
   */
  bindHoverPreview(selector: string): void {
    const tooltip = (this.app as PromptPanelManagerOptions['app']).promptHoverTooltip;
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
   * 绑定卡片拖拽事件（实现基类抽象方法）
   */
  bindCardDropEvents(container: HTMLElement): void {
    // 避免重复绑定
    if (container.dataset.dropEventsBound === 'true') {
      return;
    }
    container.dataset.dropEventsBound = 'true';

    // 实现拖拽接收逻辑
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      (e as DragEvent).dataTransfer!.dropEffect = 'copy';
    });

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      const dragSource = (e as DragEvent).dataTransfer!.getData('drag-source');
      const tagName = (e as DragEvent).dataTransfer!.getData('text/plain');

      if (dragSource === 'prompt-tag' && tagName) {
        // 处理标签拖拽到卡片
        const card = (e.target as Element).closest('.prompt-card, .list-item--prompt');
        if (card) {
          const promptId = (card as HTMLElement).dataset.id || (card as HTMLElement).dataset.promptId;
          if (promptId) {
            try {
              await this.handleTagDrop(
                promptId,
                tagName,
                (this.app as PromptPanelManagerOptions['app']).promptCache,
                window.electronAPI.updatePrompt
              );
              (this.app as PromptPanelManagerOptions['app']).showToast('标签已添加', 'success');
            } catch (error) {
              (this.app as PromptPanelManagerOptions['app']).showToast((error as Error).message, 'error');
            }
          }
        }
      }
    });
  }

  /**
   * 获取标签筛选容器 ID（实现基类抽象方法）
   */
  getTagFilterContainerId(): string {
    return 'promptTagFilterList';
  }

  /**
   * 获取特殊标签容器 ID（实现基类抽象方法）
   */
  getSpecialTagsContainerId(): string {
    return 'promptTagFilterSpecialTags';
  }

  /**
   * 获取筛选动作按钮 ID（实现基类抽象方法）
   */
  getFilterActionBtnId(): string {
    return 'promptTagFilterActionBtn';
  }

  /**
   * 获取标签筛选头部容器 ID（实现基类抽象方法）
   */
  getTagFilterHeaderContainerId(): string {
    return 'promptTagFilterHeaderTags';
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
    if ((this.app as PromptPanelManagerOptions['app']).viewMode === 'nsfw') {
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
      (this.app as PromptPanelManagerOptions['app']).emit('promptsChanged', { prompts: this.prompts });

      // 刷新回收站
      if ((this.app as PromptPanelManagerOptions['app']).trashManager) {
        await (this.app as PromptPanelManagerOptions['app']).trashManager!.loadTrash();
      }

      // 刷新统计界面
      if ((this.app as PromptPanelManagerOptions['app']).currentPanel === 'statistics') {
        await (this.app as PromptPanelManagerOptions['app']).renderStatistics?.();
      }

      (this.app as PromptPanelManagerOptions['app']).showToast('提示词已删除', 'success');
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'Failed to delete prompt:', error);
      (this.app as PromptPanelManagerOptions['app']).showToast('删除失败：' + (error as Error).message, 'error');
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

      (this.app as PromptPanelManagerOptions['app']).showToast(isFavorite ? '已收藏' : '已取消收藏', 'success');
      this.updateFavoriteUI(id, isFavorite);
      this.renderTagFilters();
    } catch (error) {
      window.electronAPI.logError('PromptPanelManager.ts', 'toggleFavorite error:', error);
      (this.app as PromptPanelManagerOptions['app']).showToast('操作失败：' + (error as Error).message, 'error');
    }
  }

  /**
   * 更新收藏按钮 UI（实现基类抽象方法）
   */
  updateFavoriteUI(id: string, isFavorite: boolean): void {
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
    const card = document.querySelector(`.prompt-card[data-id="${id}"]`);
    if (card) {
      const btn = card.querySelector('.favorite-btn');
      updateBtn(btn);
      card.classList.toggle('is-favorite', isFavorite);
    }

    // 更新列表视图
    const listItem = document.querySelector(`.list-item--prompt[data-id="${id}"]`);
    if (listItem) {
      const btn = listItem.querySelector('.favorite-btn');
      updateBtn(btn);
      listItem.classList.toggle('list-item--favorite', isFavorite);
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
          valueA = a.updatedAt || 0;
          valueB = b.updatedAt || 0;
          break;
        case 'createdAt':
          valueA = a.createdAt || 0;
          valueB = b.createdAt || 0;
          break;
        case 'title':
          valueA = (a.title || '').toLowerCase();
          valueB = (b.title || '').toLowerCase();
          break;
        default:
          valueA = a.updatedAt || 0;
          valueB = b.updatedAt || 0;
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
    if (!this.eventBus) return;
    this.eventBus.on('promptsChanged', () => {
      this.refreshAfterUpdate();
    });
  }

  /**
   * 设置卡片大小（重写基类方法）
   * @param size - 卡片宽度/高度（像素），保持1:1方形
   */
  setCardSize(size: number): void {
    super.setCardSize(size);
    const promptGrid = document.getElementById('promptGrid');
    if (promptGrid) {
      // 使用固定列宽，每列大小等于滑杆值
      promptGrid.style.gridTemplateColumns = `repeat(auto-fill, ${size}px)`;
      // 设置行高等于列宽，保持1:1方形
      promptGrid.style.gridAutoRows = `${size}px`;
    }
  }
}

export default PromptPanelManager;
