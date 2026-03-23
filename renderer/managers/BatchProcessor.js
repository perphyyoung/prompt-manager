import { DialogService, DialogConfig } from '../services/index.js';
import { cacheManager } from '../../utils/index.js';

/**
 * 批量操作处理器
 * 根据配置执行批量操作，实现配置驱动的批量操作逻辑
 */
export class BatchProcessor {
  /**
   * @param {Object} options - 配置选项
   * @param {Object} options.panelManager - 面板管理器引用
   * @param {Object} options.operationConfig - 操作配置（来自 BatchConfig.operations）
   * @param {Object} options.eventBus - 事件总线
   */
  constructor(options) {
    this.panelManager = options.panelManager;
    this.operationConfig = options.operationConfig || {};
    this.eventBus = options.eventBus;
  }

  /**
   * 获取选中的 IDs
   * @returns {Array}
   */
  getSelectedIds() {
    return Array.from(this.panelManager.selectedIds || []);
  }

  /**
   * 检查是否有选中项
   * @returns {boolean}
   */
  hasSelection() {
    return this.getSelectedIds().length > 0;
  }

  /**
   * 执行批量删除
   * @param {string} operationKey - 操作键（如 'delete'）
   */
  async executeDelete(operationKey = 'delete') {
    const config = this.operationConfig[operationKey];
    if (!config) {
      window.electronAPI?.logError('BatchProcessor', `未找到操作配置: ${operationKey}`);
      return;
    }

    const ids = this.getSelectedIds();
    if (ids.length === 0) return;

    // 确认对话框
    if (config.confirm) {
      const confirmed = await DialogService.showConfirmDialogByConfig({
        ...DialogConfig.BATCH_DELETE,
        data: { count: ids.length }
      });
      if (!confirmed) return;
    }

    try {
      // 执行删除
      for (const id of ids) {
        await window.electronAPI[config.api](id);
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
      this.panelManager.app.showToast(config.successMsg(ids.length), 'success');

      // 触发事件
      if (config.event && this.eventBus) {
        this.eventBus.emit(config.event, { ids });
      }

      // 重新加载数据
      if (config.reloadData) {
        await this.panelManager.loadData();
      }

      // 刷新视图
      this.panelManager.renderView();
      this.panelManager.toolbarController?.updateUI();
    } catch (error) {
      window.electronAPI?.logError('BatchProcessor', `${operationKey} failed:`, error);
      this.panelManager.app.showToast(config.errorMsg, 'error');
    }
  }

  /**
   * 执行批量添加标签
   * @param {string} operationKey - 操作键（如 'addTag'）
   */
  async executeAddTag(operationKey = 'addTag') {
    const config = this.operationConfig[operationKey];
    if (!config) {
      window.electronAPI?.logError('BatchProcessor', `未找到操作配置: ${operationKey}`);
      return;
    }

    const ids = this.getSelectedIds();
    if (ids.length === 0) return;

    // 输入对话框
    const tagInput = await this.panelManager.app.showInputDialog(
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
          await window.electronAPI[config.api](id, tags);
        }
      }

      // 显示成功消息
      this.panelManager.app.showToast(config.successMsg(ids.length), 'success');

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

      this.panelManager.toolbarController?.updateUI();
    } catch (error) {
      window.electronAPI?.logError('BatchProcessor', `${operationKey} failed:`, error);
      this.panelManager.app.showToast(config.errorMsg, 'error');
    }
  }

  /**
   * 执行批量收藏
   * @param {string} operationKey - 操作键（如 'favorite'）
   */
  async executeFavorite(operationKey = 'favorite') {
    const config = this.operationConfig[operationKey];
    if (!config) {
      window.electronAPI?.logError('BatchProcessor', `未找到操作配置: ${operationKey}`);
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
      this.panelManager.app.showToast(config.successMsg(ids.length), 'success');

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

      this.panelManager.toolbarController?.updateUI();
    } catch (error) {
      window.electronAPI?.logError('BatchProcessor', `${operationKey} failed:`, error);
      this.panelManager.app.showToast(config.errorMsg, 'error');
    }
  }

  /**
   * 执行反选
   */
  executeInvert() {
    const items = this.panelManager.getItems().filter(
      item => !item.isDeleted && (this.panelManager.viewMode !== 'safe' || item.isSafe !== 0)
    );
    const newSelection = new Set();
    items.forEach(item => {
      if (!this.panelManager.selectedIds.has(item.id)) {
        newSelection.add(item.id);
      }
    });
    this.panelManager.selectedIds = newSelection;
    this.panelManager.renderView();
    this.panelManager.toolbarController?.updateUI();
  }

  /**
   * 执行全选
   */
  executeSelectAll() {
    const items = this.panelManager.getItems().filter(
      item => !item.isDeleted && (this.panelManager.viewMode !== 'safe' || item.isSafe !== 0)
    );
    items.forEach(item => {
      this.panelManager.selectedIds.add(String(item.id));
    });
    this.panelManager.renderView();
    this.panelManager.toolbarController?.updateUI();
  }

  /**
   * 执行取消选择
   */
  executeCancel() {
    this.panelManager.toolbarController?.exitBatchMode();
  }
}

export default BatchProcessor;
