/**
 * 多选管理器
 * 管理多选状态和批量操作工具栏 UI
 * 简化版本：使用直接回调替代全局事件，底部悬浮工具栏
 */

import { BatchToolbar, IBatchToolbarConfig } from '../components/BatchToolbar.ts';
import { rafDebounce } from '../../utils/debounce.ts';

export interface IToolbarButton {
  id: string;
  text: string;
  className: string;
  title?: string;
  action: string;
  icon?: string;
}

export interface IToolbarConfig {
  id: string;
  label: string;
  buttons: IToolbarButton[];
}

export interface IMultiSelectState {
  selectedIds: Set<string>;
  lastSelectedIndex: number | undefined;
}

/**
 * 批量操作处理器接口
 */
export interface IBatchOperationHandler {
  onSelectAll: () => void;
  onInvert: () => void;
  onAddTag: () => void;
  onMove: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export interface IMultiSelectManagerOptions {
  onChange: () => void | Promise<void>;
  toolbarConfig?: IToolbarConfig;
  handler?: IBatchOperationHandler;
}

export class MultiSelectManager {
  private state: IMultiSelectState;
  private onChange: () => void | Promise<void>;
  private handler?: IBatchOperationHandler;

  private toolbar: BatchToolbar | null = null;

  constructor(options: IMultiSelectManagerOptions) {
    this.state = {
      selectedIds: new Set(),
      lastSelectedIndex: undefined
    };
    this.onChange = options.onChange;
    this.handler = options.handler;

    // 初始化工具栏
    if (options.toolbarConfig) {
      this.toolbar = new BatchToolbar({
        config: this.toBatchToolbarConfig(options.toolbarConfig),
        onAction: (action) => this.handleToolbarAction(action),
        onClose: () => this.handler?.onCancel()
      });
    }

  }

  /**
   * 将 IToolbarConfig 转换为 IBatchToolbarConfig
   */
  private toBatchToolbarConfig(config: IToolbarConfig): IBatchToolbarConfig {
    return {
      id: config.id,
      label: config.label,
      buttons: config.buttons.map(btn => ({
        action: btn.action,
        text: btn.text,
        className: btn.className,
        title: btn.title
      }))
    };
  }

  /**
   * 处理工具栏按钮动作
   */
  private handleToolbarAction(action: string): void {
    switch (action) {
      case 'SelectAll':
        this.handler?.onSelectAll();
        break;
      case 'Invert':
        this.handler?.onInvert();
        break;
      case 'AddTag':
        this.handler?.onAddTag();
        break;
      case 'Move':
        this.handler?.onMove();
        break;
      case 'Favorite':
        this.handler?.onFavorite();
        break;
      case 'Delete':
        this.handler?.onDelete();
        break;
      case 'Cancel':
        this.handler?.onCancel();
        break;
    }
  }

  // ==================== 状态获取 ====================

  get selectedIds(): Set<string> {
    return this.state.selectedIds;
  }

  get lastSelectedIndex(): number | undefined {
    return this.state.lastSelectedIndex;
  }

  get count(): number {
    return this.state.selectedIds.size;
  }

  get hasSelection(): boolean {
    return this.state.selectedIds.size > 0;
  }

  isSelected(id: string): boolean {
    return this.state.selectedIds.has(id);
  }

  // ==================== 选择操作 ====================

  toggleSelection(id: string, index: number): void {
    if (this.state.selectedIds.has(id)) {
      this.state.selectedIds.delete(id);
      if (this.state.lastSelectedIndex === index) {
        this.state.lastSelectedIndex = undefined;
      }
    } else {
      this.state.selectedIds.add(id);
      this.state.lastSelectedIndex = index;
    }
    this.onChange();
  }

  rangeSelect<T extends { id: string | number }>(items: T[], currentIndex: number): void {
    if (this.state.lastSelectedIndex === undefined) {
      this.state.lastSelectedIndex = currentIndex;
      const item = items[currentIndex];
      if (item) {
        this.state.selectedIds.add(String(item.id));
      }
    } else {
      const start = Math.min(this.state.lastSelectedIndex, currentIndex);
      const end = Math.max(this.state.lastSelectedIndex, currentIndex);

      for (let i = start; i <= end; i++) {
        const item = items[i];
        if (item) {
          this.state.selectedIds.add(String(item.id));
        }
      }
    }
    this.onChange();
  }

  singleSelect(id: string, index: number): void {
    this.state.selectedIds.clear();
    this.state.selectedIds.add(id);
    this.state.lastSelectedIndex = index;
    this.onChange();
  }

  selectAll(ids: string[]): void {
    ids.forEach(id => this.state.selectedIds.add(id));
    this.onChange();
  }

  invertSelection(allIds: string[]): void {
    const newSelection = new Set<string>();
    allIds.forEach(id => {
      if (!this.state.selectedIds.has(id)) {
        newSelection.add(id);
      }
    });
    this.state.selectedIds = newSelection;
    this.onChange();
  }

  addSelection(id: string): void {
    this.state.selectedIds.add(id);
    this.onChange();
  }

  addSelectionWithIndex(id: string, index: number): void {
    this.state.selectedIds.add(id);
    this.state.lastSelectedIndex = index;
    this.onChange();
  }

  removeSelection(id: string): void {
    this.state.selectedIds.delete(id);
    this.onChange();
  }

  clear(): void {
    this.state.selectedIds.clear();
    this.state.lastSelectedIndex = undefined;
    this.onChange();
  }

  clearImmediately(): void {
    this.state.selectedIds.clear();
    this.state.lastSelectedIndex = undefined;
  }

  resetLastSelectedIndex(): void {
    this.state.lastSelectedIndex = undefined;
  }

  // ==================== 工具栏 UI - 底部悬浮设计 ====================

  initToolbar(): void {
    // 工具栏由 BatchToolbar 管理，不需要初始化
    this.hideToolbar();
  }

  /**
   * 显示底部悬浮工具栏
   */
  showToolbar(): void {
    this.toolbar?.show(this.count);
  }

  /**
   * 隐藏底部悬浮工具栏
   */
  hideToolbar(): void {
    this.toolbar?.hide();
  }

  /**
   * 实际执行工具栏 UI 更新（私有方法）
   */
  private _doUpdateToolbarUI(): void {
    if (this.hasSelection) {
      if (this.toolbar?.visible) {
        // 工具栏已显示，只更新计数
        this.toolbar?.updateCount(this.count);
      } else {
        // 工具栏未显示，显示并设置计数
        this.toolbar?.show(this.count);
      }
    } else {
      // 选择为空时自动隐藏
      this.toolbar?.hide();
    }
  }

  /**
   * 更新工具栏 UI（防抖版本）
   * 使用 requestAnimationFrame 确保在下一帧渲染前执行，避免频繁更新
   */
  updateToolbarUI = rafDebounce(() => {
    this._doUpdateToolbarUI();
  });

  // ==================== 清理 ====================

  destroy(): void {
    this.clear();
    this.toolbar?.destroy();
    this.toolbar = null;
  }
}
