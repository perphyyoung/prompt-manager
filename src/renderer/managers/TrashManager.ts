import { DialogService, DialogConfig, DialogConfigData } from '../services/index.ts';
import { UnifiedCardRenderer, PromptTrashConfig, ImageTrashConfig } from './SharedComponents/index.ts';
import { Constants, ElementId } from '../../constants.ts';
import { PromptTrashHandler, ImageTrashHandler } from './handlers/index.ts';
import { localTime } from '../../utils/index.ts';
import { contextStack } from './ContextStackManager.ts';
import type { TrashHandler, TrashItem } from './handlers/TrashHandler.ts';
import type { IApp, IEventBus, IPanelManager } from '../app.types.ts';

/**
 * 回收站类型
 */
export type TrashType = typeof Constants.TrashType.PROMPT | typeof Constants.TrashType.IMAGE;

/**
 * 回收站模态框配置
 */
interface ITrashModalConfig {
  modalId: string;
  name: string;
  elementId: ElementId;
}

/**
 * TrashManager 配置选项
 */
interface TrashManagerOptions {
  app: IApp;
  eventBus: IEventBus;
}

/**
 * 回收站管理器
 * 使用模板方法模式管理已删除的提示词和图像，同时负责回收站模态框的显示/隐藏
 */
export class TrashManager {
  private readonly app: IApp;
  private readonly eventBus: IEventBus;
  private trashItems: TrashItem[] = [];
  private currentHandler: TrashHandler | null = null;
  private activeModals: Set<TrashType> = new Set();
  private isInitialized = false;

  private static readonly MODAL_CONFIG: Record<TrashType, ITrashModalConfig> = {
    [Constants.TrashType.PROMPT]: {
      modalId: 'promptTrashModal',
      name: 'promptTrashModal',
      elementId: Constants.Ids.PROMPT_TRASH_MODAL
    },
    [Constants.TrashType.IMAGE]: {
      modalId: 'imageTrashModal',
      name: 'imageTrashModal',
      elementId: Constants.Ids.IMAGE_TRASH_MODAL
    }
  };

  readonly promptHandler: PromptTrashHandler;
  readonly imageHandler: ImageTrashHandler;

  /**
   * 构造函数
   * @param options - 配置选项
   */
  constructor(options: TrashManagerOptions) {
    this.app = options.app;
    this.eventBus = options.eventBus;

    // 初始化处理器
    this.promptHandler = new PromptTrashHandler();
    this.imageHandler = new ImageTrashHandler();
  }

  /**
   * 初始化回收站
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    this.bindEvents();
    this.isInitialized = true;
  }

  /**
   * 加载回收站列表
   */
  async loadTrash(): Promise<void> {
    try {
      if (!this.currentHandler) return;

      const items = await this.currentHandler.loadItems();
      this.trashItems = items.map(item => ({
        ...item,
        type: this.currentHandler!.type
      }));

      await this.renderTrashList();
      this.eventBus.emit('trashLoaded', { items: this.trashItems });
    } catch (error) {
      window.electronAPI.logError('TrashManager.js', 'Failed to load trash:', error);
      this.app.showToast('加载回收站失败', 'error');
    }
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    // 提示词回收站
    document.getElementById('promptTrashBtn')?.addEventListener('click', () => {
      this.open(this.promptHandler);
    });
    document.getElementById('closePromptTrashModal')?.addEventListener('click', () => {
      this.close();
    });
    document.getElementById('restoreAllPromptTrashBtn')?.addEventListener('click', () => {
      this.restoreAll();
    });
    document.getElementById('emptyPromptTrashBtn')?.addEventListener('click', () => {
      this.confirmClearTrash();
    });

    // 图像回收站
    document.getElementById('imageTrashBtn')?.addEventListener('click', () => {
      this.open(this.imageHandler);
    });
    document.getElementById('closeImageTrashModal')?.addEventListener('click', () => {
      this.close();
    });
    document.getElementById('restoreAllImageTrashBtn')?.addEventListener('click', () => {
      this.restoreAll();
    });
    document.getElementById('emptyImageTrashBtn')?.addEventListener('click', () => {
      this.confirmClearTrash();
    });
  }

  /**
   * 渲染回收站列表
   */
  private async renderTrashList(): Promise<void> {
    if (!this.currentHandler) return;

    const container = document.getElementById(this.currentHandler.containerId);
    if (!container) return;

    if (this.trashItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <p>回收站为空</p>
        </div>
      `;
      return;
    }

    const html = this.trashItems.map(item => this.renderTrashItem(item)).join('');
    container.innerHTML = html;
    this.bindTrashItemEventsForContainer(container);
    this.loadCardBackgroundsForContainer(container);
  }

  /**
   * 渲染回收站项
   * @param item - 回收站项
   * @returns HTML 字符串
   */
  private renderTrashItem(item: TrashItem): string {
    const config = item.type === Constants.TrashType.IMAGE ? ImageTrashConfig : PromptTrashConfig;
    return UnifiedCardRenderer.render(config, item, {
      icons: Constants.ICONS,
      sortBy: '',
      app: this.app
    });
  }

  /**
   * 绑定回收站项事件（针对指定容器）
   * @param container - 容器元素
   */
  private bindTrashItemEventsForContainer(container: HTMLElement): void {
    const items = container.querySelectorAll<HTMLElement>('.trash-card');

    items.forEach(item => {
      // 恢复按钮
      const restoreBtn = item.querySelector('[data-action="restore"]');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const itemId = item.dataset.id;
          if (itemId) await this.restoreItem(itemId);
        });
      }

      // 删除按钮
      const deleteBtn = item.querySelector('[data-action="permanentDelete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const itemId = item.dataset.id;
          if (itemId) await this.permanentlyDeleteItem(itemId);
        });
      }
    });
  }

  /**
   * 异步加载卡片背景图（针对指定容器）
   * @param container - 容器元素
   */
  private async loadCardBackgroundsForContainer(container: HTMLElement): Promise<void> {
    const cards = container.querySelectorAll<HTMLElement>('.trash-card');

    for (const card of cards) {
      const itemId = card.dataset.id;
      const item = this.trashItems.find(i => String(i.id) === String(itemId));
      if (!item) continue;

      const imagePath = this.currentHandler!.getThumbnailPath(item);
      if (!imagePath) continue;

      try {
        const fullPath = await window.electronAPI.getImagePath(imagePath);
        const bgElement = card.querySelector<HTMLElement>('.trash-card-bg, .card__bg');
        if (bgElement) {
          bgElement.style.backgroundImage = `url('file://${fullPath.replace(/\\/g, '/')}')`;
        }
      } catch (error) {
        window.electronAPI.logError('TrashManager.js', 'Failed to load trash card background:', error);
      }
    }
  }

  /**
   * 刷新主界面面板
   */
  private refreshMainPanel(): void {
    if (!this.currentHandler) return;

    const panelManager = this.currentHandler.getMainPanelManager(this.app);
    if (panelManager && this.isPanelManager(panelManager)) {
      panelManager.renderView();
      panelManager.renderTagFilters();
      this.app.eventBus?.emit(this.currentHandler.eventName);
    }
  }

  /**
   * 类型守卫：检查是否为面板管理器
   */
  private isPanelManager(obj: unknown): obj is IPanelManager {
    return obj !== null &&
      typeof obj === 'object' &&
      'renderView' in obj &&
      'renderTagFilters' in obj;
  }

  /**
   * 恢复单个项目
   * @param itemId - 项目 ID
   */
  async restoreItem(itemId: string): Promise<void> {
    if (!this.currentHandler) return;

    try {
      await this.currentHandler.restoreItem(itemId);
      this.updateCacheAfterOperation(itemId);
      this.app.showToast('已恢复', 'success');
      await this.loadTrash();
      this.refreshMainPanel();

      if (this.app.currentPanel === 'statistics') {
        await this.app.renderStatistics();
      }

      this.eventBus.emit('itemRestored', { id: itemId, type: this.currentHandler.type });
    } catch (error) {
      window.electronAPI.logError('TrashManager.js', 'Failed to restore item:', error);
      this.app.showToast('恢复失败', 'error');
    }
  }

  /**
   * 批量恢复所有项目
   */
  async restoreAll(): Promise<void> {
    if (!this.currentHandler) return;

    try {
      if (this.trashItems.length === 0) {
        this.app.showToast('回收站已为空', 'info');
        return;
      }

      await this.currentHandler.restoreAllItems();

      // 批量更新缓存
      const cacheManager = this.app?.cacheManager;
      if (cacheManager) {
        for (const item of this.trashItems) {
          cacheManager.updateCachedItem(item.id, this.currentHandler.type,
            this.currentHandler.getCacheUpdateData());
        }
      }

      this.app.showToast(`已恢复 ${this.trashItems.length} 个项目`, 'success');
      await this.loadTrash();
      this.refreshMainPanel();

      if (this.app.currentPanel === 'statistics') {
        await this.app.renderStatistics();
      }
    } catch (error) {
      window.electronAPI.logError('TrashManager.js', 'Failed to restore all items:', error);
      this.app.showToast('恢复失败', 'error');
    }
  }

  /**
   * 永久删除项目
   * @param itemId - 项目 ID
   */
  async permanentlyDeleteItem(itemId: string): Promise<void> {
    if (!this.currentHandler) return;

    const data: DialogConfigData = { type: this.currentHandler.type };
    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.PERMANENT_DELETE,
      data
    );

    if (!confirmed) return;

    try {
      await this.currentHandler.deleteItem(itemId);
      this.app.showToast('已永久删除', 'success');
      await this.loadTrash();
      this.removeFromCache(itemId);
      this.refreshMainPanel();

      if (this.app.currentPanel === 'statistics') {
        await this.app.renderStatistics();
      }
    } catch (error) {
      window.electronAPI.logError('TrashManager.js', 'Failed to permanently delete item:', error);
      this.app.showToast('删除失败', 'error');
    }
  }

  /**
   * 确认清空回收站
   */
  confirmClearTrash(): void {
    if (!this.currentHandler) return;

    const data: DialogConfigData = { type: this.currentHandler.type };
    DialogService.showConfirmDialogByConfig(
      DialogConfig.EMPTY_TRASH,
      data
    ).then(confirmed => {
      if (confirmed) this.clearTrash();
    });
  }

  /**
   * 清空回收站
   */
  async clearTrash(): Promise<void> {
    if (!this.currentHandler) return;

    try {
      await this.currentHandler.clearAllItems();
      this.app.showToast('回收站已清空', 'success');
      this.app.eventBus?.emit(this.currentHandler.eventName);
      await this.loadTrash();
    } catch (error) {
      window.electronAPI.logError('TrashManager.js', 'Failed to clear trash:', error);
      this.app.showToast('清空失败', 'error');
    }
  }

  /**
   * 更新缓存中的项目状态
   * @param itemId - 项目 ID
   */
  private updateCacheAfterOperation(itemId: string): void {
    const cacheManager = this.app?.cacheManager;
    if (!cacheManager || !this.currentHandler) return;

    cacheManager.updateCachedItem(itemId, this.currentHandler.type,
      this.currentHandler.getCacheUpdateData());
  }

  /**
   * 从缓存中移除项目
   * @param itemId - 项目 ID
   */
  private removeFromCache(itemId: string): void {
    const cacheManager = this.app?.cacheManager;
    if (!cacheManager || !this.currentHandler) return;

    cacheManager.removeCachedItem(itemId, this.currentHandler.type);
  }

  /**
   * 添加到回收站（内部使用）
   * @param item - 项目信息
   */
  async addItem(item: Partial<TrashItem>): Promise<void> {
    if (!this.currentHandler) return;
    const newItem: TrashItem = {
      id: item.id || '',
      type: this.currentHandler.type,
      deletedAt: localTime(),
      ...item
    };
    this.trashItems.unshift(newItem);
    await this.renderTrashList();
  }

  /**
   * 获取回收站项目数量
   * @returns 项目数量
   */
  getCount(): number {
    return this.trashItems.length;
  }

  /**
   * 获取回收站项目
   * @returns 项目列表
   */
  getItems(): TrashItem[] {
    return this.trashItems;
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.trashItems = [];
    this.currentHandler = null;
  }

  /**
   * 打开回收站模态框
   * @param type - 回收站类型
   */
  private openModal(type: TrashType): void {
    const config = TrashManager.MODAL_CONFIG[type];
    if (!config) return;

    const modal = document.getElementById(config.modalId);
    if (modal) {
      contextStack.push(config.elementId);
      modal.style.display = 'flex';
      // 添加 close 方法供 ShortcutManager 调用
      (modal as HTMLElement & { close: () => void }).close = () => this.close();
      this.activeModals.add(type);
    }
  }

  /**
   * 关闭回收站模态框
   * @param type - 回收站类型
   */
  private closeModal(type: TrashType): void {
    const config = TrashManager.MODAL_CONFIG[type];
    if (!config) return;

    const modal = document.getElementById(config.modalId);
    if (modal) {
      modal.style.display = 'none';
    }
    contextStack.pop(config.elementId);
    this.activeModals.delete(type);
  }

  /**
   * 打开回收站
   * @param handler - 回收站处理器
   */
  async open(handler: TrashHandler): Promise<void> {
    this.currentHandler = handler;
    await this.loadTrash();
    // 压栈：进入回收站视图上下文
    const type = handler.type as TrashType;
    contextStack.push(TrashManager.MODAL_CONFIG[type].elementId);
    this.openModal(type);
  }

  /**
   * 关闭回收站
   */
  close(): void {
    if (!this.currentHandler) return;
    const type = this.currentHandler.type as TrashType;
    this.closeModal(type);
  }

  /**
   * 检查指定类型的回收站模态框是否处于活动状态
   * @param type - 回收站类型，不传则检查是否有任何回收站模态框处于活动状态
   */
  isModalActive(type?: TrashType): boolean {
    if (type) {
      return this.activeModals.has(type);
    }
    return this.activeModals.size > 0;
  }

  /**
   * 关闭所有回收站模态框
   */
  closeAllModals(): void {
    this.activeModals.forEach(type => this.closeModal(type));
  }
}

export default TrashManager;
