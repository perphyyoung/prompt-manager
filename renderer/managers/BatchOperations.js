import { DialogService, DialogConfig } from '../services/index.js';

/**
 * 批量操作类
 * 封装所有批量操作的通用逻辑
 */
export class BatchOperations {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {Object} options.panelManager - 面板管理器
   * @param {Object} options.eventBus - 事件总线
   */
  constructor(options) {
    this.panelManager = options.panelManager;
    this.eventBus = options.eventBus;
  }

  /**
   * 批量删除
   */
  async batchDelete() {
    const ids = Array.from(this.panelManager.selectedIds);
    if (ids.length === 0) return;

    const confirmed = await DialogService.showConfirmDialogByConfig({
      ...DialogConfig.BATCH_DELETE,
      data: { count: ids.length }
    });
    if (!confirmed) return;

    try {
      for (const id of ids) {
        await this.panelManager.softDeleteItem(id);
      }
      this.panelManager.selectedIds.clear();
      this.panelManager.renderView();
      this.panelManager.toolbarController?.updateUI();
    } catch (error) {
      this.panelManager.app.showToast('批量删除失败', 'error');
    }
  }

  /**
   * 批量添加标签
   */
  async batchAddTag() {
    const ids = Array.from(this.panelManager.selectedIds);
    if (ids.length === 0) return;

    const tag = await this.panelManager.app.showInputDialog('添加标签', '输入要添加的标签（多个标签用逗号分隔）');
    if (!tag || tag.trim() === '') return;

    try {
      for (const id of ids) {
        const item = this.panelManager.getItemById(id);
        if (item) {
          let currentTags = item.tags || [];
          for (const tagName of tag.split(',').map(t => t.trim()).filter(t => t)) {
            if (!currentTags.includes(tagName)) {
              currentTags.push(tagName);
            }
          }
          await this.panelManager.updateItem(id, { tags: currentTags });
        }
      }
      this.panelManager.app.showToast(`${ids.length} 个项目已添加标签`, 'success');
    } catch (error) {
      this.panelManager.app.showToast('批量添加标签失败', 'error');
    }
  }

  /**
   * 批量设置安全
   */
  async batchSetSafe() {
    const ids = Array.from(this.panelManager.selectedIds);
    if (ids.length === 0) return;

    try {
      for (const id of ids) {
        await this.panelManager.updateItem(id, { isSafe: 1 });
      }
      this.panelManager.selectedIds.clear();
      this.panelManager.renderView();
      this.panelManager.toolbarController?.updateUI();
      this.panelManager.app.showToast(`${ids.length} 个项目已设为安全`, 'success');
    } catch (error) {
      this.panelManager.app.showToast('批量设置安全状态失败', 'error');
    }
  }

  /**
   * 批量设置不安全
   */
  async batchSetUnsafe() {
    const ids = Array.from(this.panelManager.selectedIds);
    if (ids.length === 0) return;

    try {
      for (const id of ids) {
        await this.panelManager.updateItem(id, { isSafe: 0 });
      }
      this.panelManager.selectedIds.clear();
      this.panelManager.renderView();
      this.panelManager.toolbarController?.updateUI();
      this.panelManager.app.showToast(`${ids.length} 个项目已设为不安全`, 'success');
    } catch (error) {
      this.panelManager.app.showToast('批量设置安全状态失败', 'error');
    }
  }

  /**
   * 反选
   */
  batchInvert() {
    const items = this.panelManager.getItems().filter(item => !item.isDeleted && (this.panelManager.viewMode !== 'safe' || item.isSafe !== 0));
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
   * 取消选择
   */
  batchCancel() {
    this.panelManager.selectedIds.clear();
    this.panelManager.renderView();
    this.panelManager.toolbarController?.updateUI();
  }
}
