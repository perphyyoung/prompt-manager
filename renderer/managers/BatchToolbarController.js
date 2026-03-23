/**
 * 批量操作工具栏控制器
 * 职责：管理批量操作工具栏的显示/隐藏/更新，按钮渲染和事件绑定
 */
export class BatchToolbarController {
  /**
   * @param {Object} options
   * @param {string} options.toolbarId - 工具栏 DOM ID
   * @param {string} options.actionsId - 操作按钮容器 DOM ID
   * @param {string} options.countId - 数量显示 DOM ID
   * @param {string} options.label - 标签（用于日志）
   * @param {Function} options.getSelectedCount - 获取选中数量的函数
   * @param {Object} options.panelManager - 面板管理器引用
   * @param {Array} options.buttons - 按钮配置 [{id, text, className, action}]
   */
  constructor(options) {
    this.toolbarId = options.toolbarId;
    this.actionsId = options.actionsId;
    this.countId = options.countId;
    this.label = options.label || '';
    this.getSelectedCount = options.getSelectedCount || (() => 0);
    this.panelManager = options.panelManager;
    this.buttons = options.buttons || [];

    this.toolbar = null;
    this.actionsContainer = null;
    this.countEl = null;
  }

  /**
   * 初始化
   */
  init() {
    this.toolbar = document.getElementById(this.toolbarId);
    this.actionsContainer = document.getElementById(this.actionsId);
    this.countEl = document.getElementById(this.countId);

    this.renderButtons();
    this.updateUI();
  }

  /**
   * 渲染按钮
   */
  renderButtons() {
    if (!this.actionsContainer) return;

    this.actionsContainer.innerHTML = this.buttons.map(btn =>
      `<button type="button" class="${btn.className}" id="${btn.id}" title="${btn.title || btn.text}">${btn.text}</button>`
    ).join('');

    this.buttons.forEach(btn => {
      const element = document.getElementById(btn.id);
      if (element && btn.action) {
        element.addEventListener('click', () => {
          const handler = this.panelManager[`batch${btn.action}`];
          if (handler) {
            handler.call(this.panelManager);
          } else {
            window.electronAPI?.logError('BatchToolbar', `方法不存在: batch${btn.action}`);
          }
        });
      }
    });
  }

  /**
   * 更新 UI 显示
   */
  updateUI() {
    if (!this.toolbar) return;

    const count = this.getSelectedCount();
    if (count === 0) {
      this.toolbar.style.display = 'none';
    } else {
      this.toolbar.style.display = 'flex';
      if (this.countEl) {
        this.countEl.textContent = `已选择 ${count} 项`;
      }
    }
  }

  /**
   * 销毁
   */
  destroy() {
    this.toolbar = null;
    this.actionsContainer = null;
    this.countEl = null;
  }
}

export default BatchToolbarController;
