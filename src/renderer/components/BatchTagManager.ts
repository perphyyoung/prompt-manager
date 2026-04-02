import { HtmlUtils } from '../../utils/index.ts';
import { Constants } from '../../constants.ts';
import { DialogService, DialogConfig } from '../services/index.ts';

// 标签管理器接口（简化）
interface TagManager {
  getTags: () => string[];
  removeTags: (tags: string[]) => Promise<{ deleted: number }>;
}

// 事件处理器接口
interface EventHandlers {
  batch: () => void;
  delete: () => void;
  cancel: () => void;
}

// 批量标签管理器选项接口
interface BatchTagManagerOptions {
  containerId: string;
  batchBtnId: string;
  toolbarId: string;
  countId: string;
  deleteBtnId: string;
  cancelBtnId: string;
  tagManager: TagManager;
  showToast?: (message: string, type: string) => void;
  label?: string;
}

/**
 * 批量标签管理组件
 * 用于详情界面，支持批量删除标签
 */
export class BatchTagManager {
  private containerId: string;
  private batchBtnId: string;
  private toolbarId: string;
  private countId: string;
  private deleteBtnId: string;
  private cancelBtnId: string;
  private tagManager: TagManager;
  private showToast?: (message: string, type: string) => void;
  private label: string;

  private isBatchMode: boolean;
  private selectedTags: Set<string>;
  private _initialized: boolean;
  private _eventHandlers?: EventHandlers;
  private onExitBatchMode?: () => void;

  /**
   * @param options - 配置选项
   */
  constructor(options: BatchTagManagerOptions) {
    this.containerId = options.containerId;
    this.batchBtnId = options.batchBtnId;
    this.toolbarId = options.toolbarId;
    this.countId = options.countId;
    this.deleteBtnId = options.deleteBtnId;
    this.cancelBtnId = options.cancelBtnId;
    this.tagManager = options.tagManager;
    this.showToast = options.showToast;
    this.label = options.label || 'BatchTagManager';

    this.isBatchMode = false;
    this.selectedTags = new Set();
    this._initialized = false;
  }

  /**
   * 初始化
   */
  init(): void {
    if (this._initialized) return;

    this.bindEvents();
    this.bindContainerEvents();
    this._initialized = true;
  }

  /**
   * 绑定事件
   * @private
   */
  private bindEvents(): void {
    const batchBtn = document.getElementById(this.batchBtnId);
    const deleteBtn = document.getElementById(this.deleteBtnId);
    const cancelBtn = document.getElementById(this.cancelBtnId);

    // 保存事件处理函数引用，以便后续移除
    this._eventHandlers = {
      batch: () => this.enterBatchMode(),
      delete: () => this.handleDelete(),
      cancel: () => this.exitBatchMode()
    };

    batchBtn?.addEventListener('click', this._eventHandlers.batch);
    deleteBtn?.addEventListener('click', this._eventHandlers.delete);
    cancelBtn?.addEventListener('click', this._eventHandlers.cancel);
  }

  /**
   * 绑定容器事件委托（只绑定一次）
   * @private
   */
  private bindContainerEvents(): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.addEventListener('click', (e: MouseEvent) => {
      // 只在批量模式下处理
      if (!this.isBatchMode) return;

      const target = e.target as HTMLElement;
      const tagEl = target.closest('.tag-batch-mode') as HTMLElement | null;
      if (!tagEl) return;

      const checkbox = tagEl.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      const tagName = tagEl.dataset.tag;

      // 如果点击的是 checkbox，让 change 事件处理
      if (e.target === checkbox) return;

      // 切换 checkbox 状态
      if (checkbox && tagName) {
        checkbox.checked = !checkbox.checked;
        this.toggleTagSelection(tagEl, tagName, checkbox.checked);
      }
    });

    container.addEventListener('change', (e: Event) => {
      // 只在批量模式下处理
      if (!this.isBatchMode) return;

      const target = e.target as HTMLElement;
      if (target.matches('input[type="checkbox"]')) {
        const tagEl = target.closest('.tag-batch-mode') as HTMLElement | null;
        if (tagEl) {
          const tagName = tagEl.dataset.tag;
          const checkbox = e.target as HTMLInputElement;
          if (tagName) {
            this.toggleTagSelection(tagEl, tagName, checkbox.checked);
          }
        }
      }
    });
  }

  /**
   * 进入批量模式
   * @private
   */
  private enterBatchMode(): void {
    if (!this.tagManager) return;

    const tags = this.tagManager.getTags();
    if (tags.length <= 1) {
      this.showToast?.('无需进入批量管理', 'info');
      return;
    }

    this.isBatchMode = true;
    this.selectedTags.clear();

    const batchBtn = document.getElementById(this.batchBtnId);
    const toolbar = document.getElementById(this.toolbarId);

    if (batchBtn) batchBtn.style.display = 'none';
    if (toolbar) toolbar.style.display = 'flex';

    this.renderBatchList();
    this.updateCount();
  }

  /**
   * 退出批量模式
   * @private
   */
  private exitBatchMode(): void {
    this.isBatchMode = false;
    this.selectedTags.clear();

    const batchBtn = document.getElementById(this.batchBtnId);
    const toolbar = document.getElementById(this.toolbarId);

    if (batchBtn) batchBtn.style.display = '';
    if (toolbar) toolbar.style.display = 'none';

    // 触发退出批量模式回调，让外部重新渲染
    this.onExitBatchMode?.();
  }

  /**
   * 渲染批量模式标签列表
   * @private
   */
  private renderBatchList(): void {
    const container = document.getElementById(this.containerId);
    if (!container || !this.tagManager) return;

    const tags = this.tagManager.getTags().filter(tag =>
      !Constants.ALL_SPECIAL_TAGS.includes(tag)
    );

    if (tags.length === 0) {
      container.innerHTML = '<span class="no-tags">无标签</span>';
      return;
    }

    container.innerHTML = tags.map(tag => {
      const isSelected = this.selectedTags.has(tag);
      const escapedTag = HtmlUtils.escapeHtml(tag);
      return `
        <span class="tag-batch-mode ${isSelected ? 'selected' : ''}" data-tag="${escapedTag}">
          <span>${escapedTag}</span>
          <input type="checkbox" ${isSelected ? 'checked' : ''} title="选择">
        </span>
      `;
    }).join('');
  }

  /**
   * 切换标签选中状态
   * @private
   */
  private toggleTagSelection(tagEl: HTMLElement, tagName: string, isSelected: boolean): void {
    if (isSelected) {
      this.selectedTags.add(tagName);
      tagEl.classList.add('selected');
    } else {
      this.selectedTags.delete(tagName);
      tagEl.classList.remove('selected');
    }
    this.updateCount();
  }

  /**
   * 更新选择计数
   * @private
   */
  private updateCount(): void {
    const countEl = document.getElementById(this.countId);
    if (countEl) {
      countEl.textContent = String(this.selectedTags.size);
    }
  }

  /**
   * 处理批量删除
   * @private
   */
  private async handleDelete(): Promise<void> {
    if (this.selectedTags.size === 0) {
      this.showToast?.('请先选择要删除的标签', 'warning');
      return;
    }

    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.BATCH_DELETE_TAGS,
      { count: this.selectedTags.size }
    );

    if (!confirmed) return;

    try {
      const tagsToDelete = Array.from(this.selectedTags);

      // 使用批量删除方法（不弹出确认对话框）
      const result = await this.tagManager.removeTags(tagsToDelete);

      this.showToast?.(`成功删除 ${result.deleted} 个标签`, 'success');
      this.exitBatchMode();
    } catch (error) {
      window.electronAPI?.logError?.(`${this.label}.ts`, 'Failed to batch delete tags:', error);
      this.showToast?.('批量删除标签失败', 'error');
    }
  }

  /**
   * 设置退出批量模式回调
   * @param callback - 回调函数
   */
  setOnExitBatchMode(callback: () => void): void {
    this.onExitBatchMode = callback;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.exitBatchMode();

    // 移除事件监听器
    const batchBtn = document.getElementById(this.batchBtnId);
    const deleteBtn = document.getElementById(this.deleteBtnId);
    const cancelBtn = document.getElementById(this.cancelBtnId);

    if (this._eventHandlers) {
      batchBtn?.removeEventListener('click', this._eventHandlers.batch);
      deleteBtn?.removeEventListener('click', this._eventHandlers.delete);
      cancelBtn?.removeEventListener('click', this._eventHandlers.cancel);
    }

    this._initialized = false;
    this._eventHandlers = undefined;
  }
}
