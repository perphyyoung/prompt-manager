import { DialogService, DialogConfig } from '../services/index.ts';
import { cacheManager, CacheManager } from '../../utils/index.ts';
import { LRUCache } from '../../utils/LRUCache.ts';

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

interface BatchProcessorOptions {
  panelManager: {
    selectedIds: Set<string>;
    app: unknown;
    getItems?: () => Array<{ isDeleted?: boolean; isSafe?: number; id: string }>;
    viewMode?: string;
    loadData?: () => Promise<unknown>;
    renderView: () => void | Promise<void>;
    renderTagFilters?: () => void | Promise<void>;
    updateToolbarUI?: () => void;
    exitBatchMode?: () => void;
  };
  operationConfig?: OperationConfig;
  eventBus?: { emit: (event: string, data: unknown) => void };
}

/**
 * 批量操作处理器
 * 根据配置执行批量操作，实现配置驱动的批量操作逻辑
 */
export class BatchProcessor {
  private panelManager: BatchProcessorOptions['panelManager'];
  private operationConfig: OperationConfig;
  private eventBus?: BatchProcessorOptions['eventBus'];

  constructor(options: BatchProcessorOptions) {
    this.panelManager = options.panelManager;
    this.operationConfig = options.operationConfig || {};
    this.eventBus = options.eventBus;
  }

  /**
   * 获取选中的 IDs
   */
  getSelectedIds(): string[] {
    return Array.from(this.panelManager.selectedIds || []);
  }

  /**
   * 检查是否有选中项
   */
  hasSelection(): boolean {
    return this.getSelectedIds().length > 0;
  }

  /**
   * 执行批量删除
   */
  async executeDelete(operationKey = 'delete'): Promise<void> {
    const config = this.operationConfig[operationKey as keyof OperationConfig] as OperationConfig['delete'];
    if (!config) {
      window.electronAPI?.logError?.('BatchProcessor', `未找到操作配置: ${operationKey}`);
      return;
    }

    const ids = this.getSelectedIds();
    if (ids.length === 0) return;

    // 确认对话框
    if (config.confirm) {
      const confirmed = await DialogService.showConfirmDialogByConfig(
        DialogConfig.BATCH_DELETE,
        { count: ids.length }
      );
      if (!confirmed) return;
    }

    try {
      // 执行删除
      for (const id of ids) {
        await (window.electronAPI as unknown as Record<string, (id: string) => Promise<unknown>>)[config.api](id);
      }

      // 清除缓存
      if (config.cacheDelete) {
        const cache = config.cacheDelete(cacheManager);
        for (const id of ids) {
          cache.delete(String(id));
        }
      }

      // 清空选择
      if (config.clearSelection) {
        this.panelManager.selectedIds.clear();
      }

      // 显示成功消息
      (this.panelManager.app as { showToast: (message: string, type: string) => void }).showToast(config.successMsg(ids.length), 'success');

      // 触发事件
      if (config.event && this.eventBus) {
        this.eventBus.emit(config.event, { ids });
      }

      // 重新加载数据
      if (config.reloadData) {
        await this.panelManager.loadData?.();
      }

      // 刷新视图
      this.panelManager.renderView();
      this.panelManager.updateToolbarUI?.();
    } catch (error) {
      window.electronAPI?.logError?.('BatchProcessor', `${operationKey} failed:`, error);
      (this.panelManager.app as { showToast: (message: string, type: string) => void }).showToast(config.errorMsg, 'error');
    }
  }

  /**
   * 执行批量添加标签
   */
  async executeAddTag(operationKey = 'addTag'): Promise<void> {
    const config = this.operationConfig[operationKey as keyof OperationConfig] as OperationConfig['addTag'];
    if (!config) {
      window.electronAPI?.logError?.('BatchProcessor', `未找到操作配置: ${operationKey}`);
      return;
    }

    const ids = this.getSelectedIds();
    if (ids.length === 0) return;

    // 输入对话框
    const tagInput = await (this.panelManager.app as { showInputDialog: (title: string, placeholder: string) => Promise<string | null> }).showInputDialog(
      config.inputTitle,
      config.inputPlaceholder
    );
    if (!tagInput || tagInput.trim() === '') return;

    try {
      // 执行添加标签
      if (config.processItems) {
        await config.processItems(ids, tagInput, config.api);
      } else {
        // 默认处理逻辑
        const tags = tagInput.split(',').map(t => t.trim()).filter(t => t);
        for (const id of ids) {
          await (window.electronAPI as unknown as Record<string, (id: string, tags: string[]) => Promise<unknown>>)[config.api](id, tags);
        }
      }

      // 显示成功消息
      (this.panelManager.app as { showToast: (message: string, type: string) => void }).showToast(config.successMsg(ids.length), 'success');

      // 触发事件
      if (config.event && this.eventBus) {
        this.eventBus.emit(config.event, { ids });
      }

      // 重新加载数据以确保缓存更新
      if (this.panelManager.loadData) {
        await this.panelManager.loadData();
      }

      // 刷新视图
      await this.panelManager.renderView();

      // 刷新标签筛选区
      if (this.panelManager.renderTagFilters) {
        await this.panelManager.renderTagFilters();
      }

      this.panelManager.updateToolbarUI?.();
    } catch (error) {
      window.electronAPI?.logError?.('BatchProcessor', `${operationKey} failed:`, error);
      (this.panelManager.app as { showToast: (message: string, type: string) => void }).showToast(config.errorMsg, 'error');
    }
  }

  /**
   * 执行批量收藏
   */
  async executeFavorite(operationKey = 'favorite'): Promise<void> {
    const config = this.operationConfig[operationKey as keyof OperationConfig] as OperationConfig['favorite'];
    if (!config) {
      window.electronAPI?.logError?.('BatchProcessor', `未找到操作配置: ${operationKey}`);
      return;
    }

    const ids = this.getSelectedIds();
    if (ids.length === 0) return;

    try {
      // 执行收藏操作
      if (config.processItems) {
        await config.processItems(ids, null, config.api);
      }

      // 显示成功消息
      (this.panelManager.app as { showToast: (message: string, type: string) => void }).showToast(config.successMsg(ids.length), 'success');

      // 触发事件
      if (config.event && this.eventBus) {
        this.eventBus.emit(config.event, { ids });
      }

      // 重新加载数据以确保缓存更新
      if (this.panelManager.loadData) {
        await this.panelManager.loadData();
      }

      // 刷新视图
      await this.panelManager.renderView();

      // 刷新标签筛选区
      if (this.panelManager.renderTagFilters) {
        await this.panelManager.renderTagFilters();
      }

      this.panelManager.updateToolbarUI?.();
    } catch (error) {
      window.electronAPI?.logError?.('BatchProcessor', `${operationKey} failed:`, error);
      (this.panelManager.app as { showToast: (message: string, type: string) => void }).showToast(config.errorMsg, 'error');
    }
  }

  /**
   * 执行反选
   */
  executeInvert(): void {
    const items = this.panelManager.getItems?.()?.filter(
      item => !item.isDeleted && (this.panelManager.viewMode !== 'safe' || item.isSafe !== 0)
    ) || [];
    const newSelection = new Set<string>();
    items.forEach(item => {
      if (!this.panelManager.selectedIds.has(item.id)) {
        newSelection.add(item.id);
      }
    });
    this.panelManager.selectedIds = newSelection;
    this.panelManager.renderView();
    this.panelManager.updateToolbarUI?.();
  }

  /**
   * 执行全选
   */
  executeSelectAll(): void {
    const items = this.panelManager.getItems?.()?.filter(
      item => !item.isDeleted && (this.panelManager.viewMode !== 'safe' || item.isSafe !== 0)
    ) || [];
    items.forEach(item => {
      this.panelManager.selectedIds.add(String(item.id));
    });
    this.panelManager.renderView();
    this.panelManager.updateToolbarUI?.();
  }

  /**
   * 执行取消选择
   */
  executeCancel(): void {
    this.panelManager.exitBatchMode?.();
  }
}

export default BatchProcessor;
