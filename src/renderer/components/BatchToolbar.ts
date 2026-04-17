/**
 * 批量操作工具栏组件
 * 统一处理批量工具栏的显示、隐藏和ESC关闭
 * 使用 HTML 中已存在的元素，不创建新元素
 */

import { contextStack, IContextStackEntry } from '../managers/ContextStackManager.ts';
import { ElementId } from '../../constants.ts';
import type { IClosableElement } from '../../types/entities.ts';

export interface IBatchToolbarButton {
  action: string;
  text: string;
  className?: string;
  title?: string;
}

export interface IBatchToolbarConfig {
  id: string;
  label: string;
  buttons: IBatchToolbarButton[];
}

export interface IBatchToolbarOptions {
  config: IBatchToolbarConfig;
  onAction: (action: string) => void;
  onClose?: () => void;
}

export class BatchToolbar {
  private config: IBatchToolbarConfig;
  private onAction: (action: string) => void;
  private onClose?: () => void;
  private element: IClosableElement | null = null;
  private isVisible: boolean = false;
  private isEventBound: boolean = false;

  constructor(options: IBatchToolbarOptions) {
    this.config = options.config;
    this.onAction = options.onAction;
    this.onClose = options.onClose;
  }

  /**
   * 显示工具栏
   * 使用 HTML 中已存在的元素，不存在则报错
   */
  show(count: number = 0): void {
    if (this.isVisible) {
      this.updateCount(count);
      return;
    }

    // 获取已存在的元素
    this.element = document.getElementById(this.config.id) as IClosableElement;

    if (!this.element) {
      throw new Error(`BatchToolbar element with id "${this.config.id}" not found in HTML`);
    }

    // 绑定按钮事件（只绑定一次）
    if (!this.isEventBound) {
      this.bindButtonEvents();
      this.isEventBound = true;
    }

    this.element.classList.add('visible');
    this.isVisible = true;

    // 附加 close 方法用于 ESC 处理
    this.element.close = () => this.hide();

    // 附加 ctrla 方法用于 Ctrl+A 处理
    (this.element as HTMLElement & { ctrla: () => boolean }).ctrla = () => {
      this.handleSelectAll();
      return true;
    };

    this.updateCount(count);

    // 压栈：进入批量模式上下文
    const stackEntry: IContextStackEntry = {
      id: this.config.id as ElementId,
      state: { isBatchToolbarVisible: true },
      close: () => { this.hide(); }
    };
    contextStack.push(stackEntry);
  }

  /**
   * 隐藏工具栏
   */
  hide(): void {
    if (!this.isVisible || !this.element) return;

    this.element.classList.remove('visible');
    this.isVisible = false;

    // 出栈：退出批量模式上下文
    contextStack.pop(this.config.id as ElementId);

    // 调用关闭回调
    this.onClose?.();
  }

  /**
   * 更新计数显示
   */
  updateCount(count: number): void {
    if (!this.element) return;

    // 支持两种计数元素选择器
    // 1. 主面板工具栏: .batch-toolbar-count
    // 2. 详情页工具栏: .batch-tag-count span
    const countSpan = this.element.querySelector('.batch-toolbar-count');
    if (countSpan) {
      countSpan.textContent = `已选择 ${count} 个${this.config.label}`;
    }

    const batchTagCountSpan = this.element.querySelector('.batch-tag-count span');
    if (batchTagCountSpan) {
      batchTagCountSpan.textContent = count.toString();
    }
  }

  /**
   * 检查工具栏是否可见
   */
  get visible(): boolean {
    return this.isVisible;
  }

  /**
   * 绑定按钮事件
   */
  private bindButtonEvents(): void {
    if (!this.element) return;

    // 使用事件委托绑定按钮点击
    this.element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('.batch-action-btn') as HTMLElement;
      if (button) {
        const action = button.dataset.action;
        if (action) {
          this.onAction(action);
        }
      }
    });
  }

  /**
   * 处理全选操作
   */
  private handleSelectAll(): void {
    this.onAction('SelectAll');
  }

  /**
   * 销毁工具栏
   */
  destroy(): void {
    this.hide();
    this.element = null;
    this.isEventBound = false;
  }
}
