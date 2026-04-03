import { DialogService, DialogConfig } from '../services/index.ts';
import { cacheManager, CacheManager } from '../../utils/index.ts';
import { LRUCache } from '../../utils/LRUCache.ts';
import { SelectionManager } from './SelectionManager.ts';

interface BatchToolbarButton {
  id: string;
  text: string;
  className: string;
  title?: string;
  action: string;
}

interface OperationConfig {
  delete?: {
    api: string;
    cacheDelete?: (cacheManager: CacheManager) => LRUCache<unknown>;
    event?: string;
    confirm?: boolean;
    clearSelection?: boolean;
    reloadData?: boolean;
    successMsg: (count: number) => string;
    errorMsg: string;
  };
  addTag?: {
    api: string;
    event?: string;
    needInput?: boolean;
    inputTitle: string;
    inputPlaceholder: string;
    processItems?: (ids: string[], tagInput: string, api: string) => Promise<void>;
    successMsg: (count: number) => string;
    errorMsg: string;
  };
  favorite?: {
    api: string;
    event?: string;
    processItems?: (ids: string[], input: null, api: string) => Promise<void>;
    successMsg: (count: number) => string;
    errorMsg: string;
  };
}

interface BatchOperationManagerOptions {
  toolbarId: string;
  actionsId: string;
  countId: string;
  selectAllCheckboxId: string;
  label?: string;
  buttons: BatchToolbarButton[];
  selectionManager: SelectionManager;
  panelManager: {
    app: unknown;
    getVisibleItems?: () => Array<{ isDeleted?: boolean; isSafe?: number; id: string }>;
    getVisibleItemCount?: () => number;
    viewMode?: string;
    loadData?: () => Promise<unknown>;
    renderView: () => void | Promise<void>;
    renderTagFilters?: () => void | Promise<void>;
    exitBatchMode?: () => void;
  };
  operationConfig?: OperationConfig;
  eventBus?: { emit: (event: string, data: unknown) => void };
}

/**
 * 批量操作管理器
 * 统一管理批量操作的 UI 和操作执行
 * 合并了原 BatchToolbarUI 和 BatchProcessor 的职责
 */
export class BatchOperationManager {
  private toolbarId: string;
  private actionsId: string;
  private countId: string;
  private selectAllCheckboxId: string;
  private label: string;
  private buttons: BatchToolbarButton[];
  private selectionManager: SelectionManager;
  private panelManager: BatchOperationManagerOptions['panelManager'];
  private operationConfig: OperationConfig;
  private eventBus?: BatchOperationManagerOptions['eventBus'];

  private toolbar: HTMLElement | null = null;
  private actionsContainer: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;
  private selectAllCheckbox: HTMLInputElement | null = null;
  private _isBatchModeActive: boolean = false;

  /**
   * 获取批量模式是否激活
   */
  get isBatchModeActive(): boolean {
    return this._isBatchModeActive;
  }

  constructor(options: BatchOperationManagerOptions) {
    this.toolbarId = options.toolbarId;
    this.actionsId = options.actionsId;
    this.countId = options.countId;
    this.selectAllCheckboxId = options.selectAllCheckboxId;
    this.label = options.label || '';
    this.buttons = options.buttons || [];
    this.selectionManager = options.selectionManager;
    this.panelManager = options.panelManager;
    this.operationConfig = options.operationConfig || {};
    this.eventBus = options.eventBus;
  }

  /**
   * 初始化
   */
  init(): void {
    this.toolbar = document.getElementById(this.toolbarId);
    this.actionsContainer = document.getElementById(this.actionsId);
    this.countEl = document.getElementById(this.countId);
    this.selectAllCheckbox = document.getElementById(this.selectAllCheckboxId) as HTMLInputElement | null;

    this.renderButtons();
    this.bindSelectAllEvent();
    this.updateUI();
  }

  // ==================== 批量模式控制 ====================

  /**
   * 进入批量模式
   */
  enterBatchMode(): void {
    this._isBatchModeActive = true;
    if (this.toolbar) {
      this.toolbar.style.display = 'flex';
    }
  }

  /**
   * 退出批量模式
   * 行业规范：退出模式 = 清空选择 + 隐藏UI
   */
  exitBatchMode(): void {
    this._isBatchModeActive = false;
    this.selectionManager.clear();
    this.panelManager.renderView();
    if (this.toolbar) {
      this.toolbar.style.display = 'none';
    }
  }

  /**
   * 如果需要，进入批量模式
   */
  enterBatchModeIfNeeded(): void {
    if (this.selectionManager.count > 0 && !this._isBatchModeActive) {
      this.enterBatchMode();
    }
  }

  /**
   * 如果选择为空，退出批量模式
   */
  exitBatchModeIfEmpty(): void {
    if (this.selectionManager.count === 0) {
      this.exitBatchMode();
    }
  }

  // ==================== UI 更新 ====================

  /**
   * 更新 UI 显示
   */
  updateUI(): void {
    if (!this.toolbar) return;

    const selectedCount = this.selectionManager.count;

    if (this._isBatchModeActive || selectedCount > 0) {
      this.toolbar.style.display = 'flex';
      if (this.countEl) {
        this.countEl.textContent = `已选择 ${selectedCount} 项`;
      }
    } else {
      this.toolbar.style.display = 'none';
    }

    this.updateSelectAllCheckbox();
  }

  /**
   * 更新全选复选框状态
   */
  updateSelectAllCheckbox(): void {
    if (!this.selectAllCheckbox || !this.panelManager) return;

    const visibleItems = this.panelManager.getVisibleItems?.() || [];
    const selectedCount = this.selectionManager.count;

    this.selectAllCheckbox.checked = selectedCount > 0 && selectedCount === visibleItems.length;
    this.selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < visibleItems.length;
  }

  /**
   * 绑定全选复选框事件
   */
  private bindSelectAllEvent(): void {
    if (!this.selectAllCheckbox) return;

    this.selectAllCheckbox.addEventListener('change', (e) => {
      if ((e.target as HTMLInputElement).checked) {
        this.enterBatchMode();
        this.batchSelectAll();
      } else {
        this.selectionManager.clear();
        this.panelManager.renderView();
        this.updateUI();
      }
    });
  }

  /**
   * 渲染按钮
   */
  private renderButtons(): void {
    if (!this.actionsContainer) return;

    this.actionsContainer.innerHTML = this.buttons.map(btn =>
      `<button type="button" class="${btn.className}" id="${btn.id}" title="${btn.title || btn.text}">${btn.text}</button>`
    ).join('');

    this.buttons.forEach(btn => {
      const element = document.getElementById(btn.id);
      if (element && btn.action) {
        element.addEventListener('click', async () => {
          const methodName = `batch${btn.action}` as keyof this;
          const handler = this[methodName] as (() => void | Promise<void>) | undefined;
          if (handler) {
            this.enterBatchMode();
            await handler.call(this);
          } else {
            window.electronAPI?.logError?.('BatchOperationManager', `方法不存在: batch${btn.action}`);
          }
        });
      }
    });
  }

  // ==================== 批量操作执行 ====================

  /**
   * 获取选中的 IDs
   */
  private getSelectedIds(): string[] {
    return Array.from(this.selectionManager.selectedIds);
  }

  /**
   * 批量删除
   */
  async batchDelete(): Promise<void> {
    const config = this.operationConfig.delete;
    if (!config) {
      window.electronAPI?.logError?.('BatchOperationManager', '未找到删除操作配置');
      return;
    }

    const ids = this.getSelectedIds();
    if (ids.length === 0) return;

    if (config.confirm) {
      const confirmed = await DialogService.showConfirmDialogByConfig(
        DialogConfig.BATCH_DELETE,
        { count: ids.length }
      );
      if (!confirmed) return;
    }

    try {
      for (const id of ids) {
        await (window.electronAPI as unknown as Record<string, (id: string) => Promise<unknown>>)[config.api](id);
      }

      if (config.cacheDelete) {
        const cache = config.cacheDelete(cacheManager);
        for (const id of ids) {
          cache.delete(String(id));
        }
      }

      if (config.clearSelection) {
        this.selectionManager.clear();
      }

      (this.panelManager.app as { showToast: (message: string, type: string) => void }).showToast(
        config.successMsg(ids.length), 'success'
      );

      if (config.event && this.eventBus) {
        this.eventBus.emit(config.event, { ids });
      }

      if (config.reloadData) {
        await this.panelManager.loadData?.();
      }

      this.panelManager.renderView();
      this.updateUI();
    } catch (error) {
      window.electronAPI?.logError?.('BatchOperationManager', '删除失败:', error);
      (this.panelManager.app as { showToast: (message: string, type: string) => void }).showToast(
        config.errorMsg, 'error'
      );
    }
  }

  /**
   * 批量添加标签
   */
  async batchAddTag(): Promise<void> {
    const config = this.operationConfig.addTag;
    if (!config) {
      window.electronAPI?.logError?.('BatchOperationManager', '未找到添加标签操作配置');
      return;
    }

    const ids = this.getSelectedIds();
    if (ids.length === 0) return;

    const tagInput = await (this.panelManager.app as {
      showInputDialog: (title: string, placeholder: string) => Promise<string | null>
    }).showInputDialog(config.inputTitle, config.inputPlaceholder);

    if (!tagInput || tagInput.trim() === '') return;

    try {
      if (config.processItems) {
        await config.processItems(ids, tagInput, config.api);
      } else {
        const tags = tagInput.split(',').map(t => t.trim()).filter(t => t);
        for (const id of ids) {
          await (window.electronAPI as unknown as Record<string, (id: string, tags: string[]) => Promise<unknown>>)[
            config.api
          ](id, tags);
        }
      }

      (this.panelManager.app as { showToast: (message: string, type: string) => void }).showToast(
        config.successMsg(ids.length), 'success'
      );

      if (config.event && this.eventBus) {
        this.eventBus.emit(config.event, { ids });
      }

      if (this.panelManager.loadData) {
        await this.panelManager.loadData();
      }

      await this.panelManager.renderView();

      if (this.panelManager.renderTagFilters) {
        await this.panelManager.renderTagFilters();
      }

      this.updateUI();
    } catch (error) {
      window.electronAPI?.logError?.('BatchOperationManager', '添加标签失败:', error);
      (this.panelManager.app as { showToast: (message: string, type: string) => void }).showToast(
        config.errorMsg, 'error'
      );
    }
  }

  /**
   * 批量收藏
   */
  async batchFavorite(): Promise<void> {
    const config = this.operationConfig.favorite;
    if (!config) {
      window.electronAPI?.logError?.('BatchOperationManager', '未找到收藏操作配置');
      return;
    }

    const ids = this.getSelectedIds();
    if (ids.length === 0) return;

    try {
      if (config.processItems) {
        await config.processItems(ids, null, config.api);
      }

      (this.panelManager.app as { showToast: (message: string, type: string) => void }).showToast(
        config.successMsg(ids.length), 'success'
      );

      if (config.event && this.eventBus) {
        this.eventBus.emit(config.event, { ids });
      }

      if (this.panelManager.loadData) {
        await this.panelManager.loadData();
      }

      await this.panelManager.renderView();

      if (this.panelManager.renderTagFilters) {
        await this.panelManager.renderTagFilters();
      }

      this.updateUI();
    } catch (error) {
      window.electronAPI?.logError?.('BatchOperationManager', '收藏失败:', error);
      (this.panelManager.app as { showToast: (message: string, type: string) => void }).showToast(
        config.errorMsg, 'error'
      );
    }
  }

  /**
   * 反选
   */
  batchInvert(): void {
    const items = this.panelManager.getVisibleItems?.() || [];
    const newSelection = new Set<string>();
    items.forEach(item => {
      if (!this.selectionManager.isSelected(String(item.id))) {
        newSelection.add(String(item.id));
      }
    });
    this.selectionManager.clear();
    newSelection.forEach(id => this.selectionManager.addSelection(id));
    this.panelManager.renderView();
    this.updateUI();
  }

  /**
   * 全选
   */
  batchSelectAll(): void {
    const items = this.panelManager.getVisibleItems?.() || [];
    items.forEach(item => {
      this.selectionManager.addSelection(String(item.id));
    });
    this.panelManager.renderView();
    this.updateUI();
  }

  /**
   * 取消选择
   */
  batchCancel(): void {
    this.exitBatchMode();
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.toolbar = null;
    this.actionsContainer = null;
    this.countEl = null;
    this.selectAllCheckbox = null;
  }
}

export default BatchOperationManager;
