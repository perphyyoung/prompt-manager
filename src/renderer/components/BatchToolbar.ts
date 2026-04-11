/**
 * 批量操作工具栏组件
 * 统一处理批量工具栏的创建、显示、隐藏和ESC关闭
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

  constructor(options: IBatchToolbarOptions) {
    this.config = options.config;
    this.onAction = options.onAction;
    this.onClose = options.onClose;
  }

  /**
   * 显示工具栏
   */
  show(count: number = 0): void {
    if (this.isVisible) {
      // 已经显示，只更新计数
      this.updateCount(count);
      return;
    }

    if (!this.element) {
      this.element = this.createElement();
      document.body.appendChild(this.element);
    }

    // 强制重绘以确保动画生效
    void this.element.offsetHeight;

    this.element.classList.add('visible');
    this.isVisible = true;

    // 附加 close 方法用于 ESC 处理
    this.element.close = () => this.hide();

    // 附加 ctrla 方法用于 Ctrl+A 处理
    (this.element as HTMLElement & { ctrla: () => boolean }).ctrla = () => {
      this.handleSelectAll();
      // 返回 true 表示已处理
      return true;
    };

    // 更新计数显示
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
   * @param triggerCancel 是否触发取消回调，默认为 true。当因选择为空自动隐藏时应设为 false
   */
  hide(triggerCancel: boolean = true): void {
    if (!this.isVisible || !this.element) return;

    this.element.classList.remove('visible');
    this.isVisible = false;

    // 出栈：退出批量模式上下文
    contextStack.pop(this.config.id as ElementId);

    // 延迟移除 DOM 元素
    setTimeout(() => {
      if (!this.isVisible && this.element) {
        this.element.remove();
        this.element = null;
      }
    }, 300);

    // 调用关闭回调（仅在用户主动关闭时）
    if (triggerCancel) {
      this.onClose?.();
    }
  }

  /**
   * 更新计数显示
   */
  updateCount(count: number): void {
    if (!this.element) return;

    const countSpan = this.element.querySelector('.batch-toolbar-count');
    if (countSpan) {
      countSpan.textContent = `已选择 ${count} 个${this.config.label}`;
    }
  }

  /**
   * 检查工具栏是否可见
   */
  get visible(): boolean {
    return this.isVisible;
  }

  /**
   * 处理全选操作
   */
  private handleSelectAll(): void {
    // 触发 SelectAll 动作
    this.onAction('SelectAll');
  }

  /**
   * 销毁工具栏
   */
  destroy(): void {
    this.hide();
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }

  /**
   * 创建工具栏 DOM 元素
   */
  private createElement(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'batch-toolbar';
    toolbar.id = this.config.id;

    const buttonsHtml = this.config.buttons.map(btn => `
      <button
        type="button"
        class="batch-action-btn ${btn.className || ''}"
        data-action="${btn.action}"
        title="${btn.title || btn.text}"
      >
        ${btn.text}
      </button>
    `).join('');

    toolbar.innerHTML = `
      <div class="batch-toolbar-content">
        <span class="batch-toolbar-count">已选择 0 个${this.config.label}</span>
        <div class="batch-toolbar-actions">
          ${buttonsHtml}
        </div>
      </div>
    `;

    // 绑定按钮事件
    toolbar.querySelectorAll('.batch-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const action = target.dataset.action;
        if (action) {
          this.onAction(action);
        }
      });
    });

    return toolbar;
  }
}

export default BatchToolbar;
