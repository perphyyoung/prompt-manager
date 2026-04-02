interface BatchToolbarButton {
  id: string;
  text: string;
  className: string;
  title?: string;
  action: string;
}

interface BatchToolbarUIOptions {
  toolbarId: string;
  actionsId: string;
  countId: string;
  selectAllCheckboxId: string;
  label?: string;
  getSelectedCount?: () => number;
  panelManager: {
    selectedIds: Set<string>;
    getItems?: () => Array<{ isDeleted?: boolean; isSafe?: number; id: string }>;
    viewMode?: string;
    renderView?: () => void | Promise<void>;
    batchSelectAll?: () => void;
    toolbarController?: BatchToolbarUI;
    [key: string]: unknown;
  };
  buttons: BatchToolbarButton[];
}

/**
 * 批量操作工具栏 UI 控制器
 * 职责：管理批量操作工具栏的显示/隐藏/更新，按钮渲染和事件绑定
 */
export class BatchToolbarUI {
  private toolbarId: string;
  private actionsId: string;
  private countId: string;
  private selectAllCheckboxId: string;
  private label: string;
  private getSelectedCount: () => number;
  private panelManager: BatchToolbarUIOptions['panelManager'];
  private buttons: BatchToolbarButton[];

  private toolbar: HTMLElement | null = null;
  private actionsContainer: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;
  private selectAllCheckbox: HTMLInputElement | null = null;
  private isBatchModeActive: boolean = false;

  constructor(options: BatchToolbarUIOptions) {
    this.toolbarId = options.toolbarId;
    this.actionsId = options.actionsId;
    this.countId = options.countId;
    this.selectAllCheckboxId = options.selectAllCheckboxId;
    this.label = options.label || '';
    this.getSelectedCount = options.getSelectedCount || (() => 0);
    this.panelManager = options.panelManager;
    this.buttons = options.buttons || [];
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

  /**
   * 绑定全选复选框事件
   */
  bindSelectAllEvent(): void {
    if (!this.selectAllCheckbox) return;

    this.selectAllCheckbox.addEventListener('change', (e) => {
      if ((e.target as HTMLInputElement).checked) {
        this.enterBatchMode();
        this.panelManager?.batchSelectAll?.();
      } else {
        // 取消勾选只清空选择，不退出批量模式
        this.panelManager?.selectedIds?.clear?.();
        this.panelManager?.renderView?.();
        this.updateUI();
      }
    });
  }

  /**
   * 进入批量模式
   */
  enterBatchMode(): void {
    this.isBatchModeActive = true;
    if (this.toolbar) {
      this.toolbar.style.display = 'flex';
    }
  }

  /**
   * 退出批量模式
   */
  exitBatchMode(): void {
    this.isBatchModeActive = false;
    this.panelManager?.selectedIds?.clear?.();
    this.panelManager?.renderView?.();
    if (this.toolbar) {
      this.toolbar.style.display = 'none';
    }
  }

  /**
   * 更新全选复选框状态
   */
  updateSelectAllCheckbox(): void {
    if (!this.selectAllCheckbox || !this.panelManager) return;

    const items = this.panelManager.getItems?.() || [];
    const visibleItems = items.filter(item => !item.isDeleted && (this.panelManager?.viewMode !== 'safe' || item.isSafe !== 0));
    const selectedCount = this.getSelectedCount();

    this.selectAllCheckbox.checked = selectedCount > 0 && selectedCount === visibleItems.length;
    this.selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < visibleItems.length;
  }

  /**
   * 渲染按钮
   */
  renderButtons(): void {
    if (!this.actionsContainer) return;

    this.actionsContainer.innerHTML = this.buttons.map(btn =>
      `<button type="button" class="${btn.className}" id="${btn.id}" title="${btn.title || btn.text}">${btn.text}</button>`
    ).join('');

    this.buttons.forEach(btn => {
      const element = document.getElementById(btn.id);
      if (element && btn.action) {
        element.addEventListener('click', async () => {
          const handler = this.panelManager[`batch${btn.action}`] as (() => void | Promise<void>) | undefined;
          if (handler) {
            // 点击任意批量操作按钮时进入批量模式
            this.enterBatchMode();
            await handler.call(this.panelManager);
          } else {
            window.electronAPI?.logError?.('BatchToolbar', `方法不存在: batch${btn.action}`);
          }
        });
      }
    });
  }

  /**
   * 更新 UI 显示
   */
  updateUI(): void {
    if (!this.toolbar) return;

    const count = this.getSelectedCount();

    // 只有在批量模式下或选择数大于0时才显示工具栏
    if (this.isBatchModeActive || count > 0) {
      this.toolbar.style.display = 'flex';
      if (this.countEl) {
        this.countEl.textContent = `已选择 ${count} 项`;
      }
    } else {
      this.toolbar.style.display = 'none';
    }

    this.updateSelectAllCheckbox();
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.toolbar = null;
    this.actionsContainer = null;
    this.countEl = null;
  }
}

export default BatchToolbarUI;
