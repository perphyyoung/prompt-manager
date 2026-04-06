/**
 * 列表导航器
 * 用于在编辑界面中导航列表项（上一个/下一个）
 */

// 导航按钮配置接口
interface NavButtons {
  first?: HTMLElement;
  prev?: HTMLElement;
  next?: HTMLElement;
  last?: HTMLElement;
}

// 列表导航器选项接口
interface ListNavigatorOptions<T> {
  items: T[];
  currentIndex: number;
  onSave?: () => Promise<void> | void;
  onNavigate: (item: T, index: number) => Promise<void> | void;
  onClose?: () => void;
  navButtons?: NavButtons;
  targetElement?: HTMLElement | Document;
  shouldHandleKeyboard?: (e: KeyboardEvent) => boolean;
}

export class ListNavigator<T = unknown> {
  private items: T[];
  private _currentIndex: number;
  private onSave?: () => Promise<void> | void;
  private onNavigate: (item: T, index: number) => Promise<void> | void;
  private onClose?: () => void;
  private navButtons?: NavButtons;
  private targetElement: HTMLElement | Document;
  private shouldHandleKeyboard?: (e: KeyboardEvent) => boolean;
  private eventHandlers: {
    first?: () => void;
    prev?: () => void;
    next?: () => void;
    last?: () => void;
  } = {};
  private keydownHandler: ((e: Event) => void) | null = null;

  /**
   * 获取当前索引
   */
  get currentIndex(): number {
    return this._currentIndex;
  }

  /**
   * 设置当前索引
   */
  set currentIndex(value: number) {
    this._currentIndex = value;
  }

  /**
   * 构造函数
   * @param options - 配置选项
   */
  constructor(options: ListNavigatorOptions<T>) {
    this.items = options.items || [];
    this._currentIndex = options.currentIndex || 0;
    this.onSave = options.onSave;
    this.onNavigate = options.onNavigate;
    this.onClose = options.onClose;
    this.navButtons = options.navButtons;
    this.targetElement = options.targetElement || document;
    this.shouldHandleKeyboard = options.shouldHandleKeyboard;

    // 绑定导航按钮事件
    this.bindNavButtons();

    // 绑定键盘事件
    this.bindKeyboardEvents();

    // 更新按钮状态
    this.updateNavButtons();
  }

  /**
   * 绑定导航按钮事件
   */
  private bindNavButtons(): void {
    if (!this.navButtons) return;

    const { first, prev, next, last } = this.navButtons;

    // 创建事件处理函数并保存引用
    this.eventHandlers.first = () => this.navigateTo('first');
    this.eventHandlers.prev = () => this.navigateTo('prev');
    this.eventHandlers.next = () => this.navigateTo('next');
    this.eventHandlers.last = () => this.navigateTo('last');

    if (first) {
      first.addEventListener('click', this.eventHandlers.first);
    }
    if (prev) {
      prev.addEventListener('click', this.eventHandlers.prev);
    }
    if (next) {
      next.addEventListener('click', this.eventHandlers.next);
    }
    if (last) {
      last.addEventListener('click', this.eventHandlers.last);
    }
  }

  /**
   * 绑定键盘事件
   */
  private bindKeyboardEvents(): void {
    this.keydownHandler = (e: Event) => this.handleKeydown(e as KeyboardEvent);
    this.targetElement.addEventListener('keydown', this.keydownHandler as EventListener);
  }

  /**
   * 处理键盘事件
   * @param e - 键盘事件
   */
  private handleKeydown(e: KeyboardEvent): void {
    // 使用自定义判断函数或默认判断
    if (this.shouldHandleKeyboard) {
      if (!this.shouldHandleKeyboard(e)) return;
    } else {
      // 默认：如果正在编辑输入框，不响应导航键
      if (e.target instanceof HTMLElement &&
          (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    }

    switch (e.key) {
      case 'Home':
        e.preventDefault();
        this.navigateTo('first');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.navigateTo('prev');
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.navigateTo('next');
        break;
      case 'End':
        e.preventDefault();
        this.navigateTo('last');
        break;
    }
  }

  /**
   * 销毁导航器，移除所有事件监听器
   */
  destroy(): void {
    // 移除按钮事件
    if (this.navButtons) {
      const { first, prev, next, last } = this.navButtons;

      if (first && this.eventHandlers.first) {
        first.removeEventListener('click', this.eventHandlers.first);
      }
      if (prev && this.eventHandlers.prev) {
        prev.removeEventListener('click', this.eventHandlers.prev);
      }
      if (next && this.eventHandlers.next) {
        next.removeEventListener('click', this.eventHandlers.next);
      }
      if (last && this.eventHandlers.last) {
        last.removeEventListener('click', this.eventHandlers.last);
      }
    }

    // 移除键盘事件
    if (this.keydownHandler) {
      this.targetElement.removeEventListener('keydown', this.keydownHandler as EventListener);
      this.keydownHandler = null;
    }

    // 清空引用
    this.eventHandlers = {};
  }

  /**
   * 导航到指定位置
   * @param direction - 方向 (first, prev, next, last)
   */
  async navigateTo(direction: 'first' | 'prev' | 'next' | 'last'): Promise<void> {
    // 先保存当前数据（如果有 onSave）
    if (this.onSave) {
      await this.onSave();
    }

    let newIndex = this.currentIndex;

    switch (direction) {
      case 'first':
        newIndex = 0;
        break;
      case 'prev':
        newIndex = Math.max(0, this.currentIndex - 1);
        break;
      case 'next':
        newIndex = Math.min(this.items.length - 1, this.currentIndex + 1);
        break;
      case 'last':
        newIndex = this.items.length - 1;
        break;
    }

    // 如果索引没有变化，不执行导航
    if (newIndex === this.currentIndex) {
      return;
    }

    // 更新索引
    this.currentIndex = newIndex;

    // 执行导航回调
    if (this.onNavigate) {
      const targetItem = this.items[this.currentIndex];
      await this.onNavigate(targetItem, this.currentIndex);
    }

    // 更新按钮状态
    this.updateNavButtons();
  }

  /**
   * 更新导航按钮状态
   */
  updateNavButtons(): void {
    if (!this.navButtons) return;

    const { first, prev, next, last } = this.navButtons;
    const isFirst = this.currentIndex === 0;
    const isLast = this.currentIndex === this.items.length - 1;
    const isEmpty = this.items.length === 0;

    // 更新按钮禁用状态和样式
    if (first) {
      (first as HTMLButtonElement).disabled = isFirst || isEmpty;
      first.classList.toggle('is-disabled', isFirst || isEmpty);
    }
    if (prev) {
      (prev as HTMLButtonElement).disabled = isFirst || isEmpty;
      prev.classList.toggle('is-disabled', isFirst || isEmpty);
    }
    if (next) {
      (next as HTMLButtonElement).disabled = isLast || isEmpty;
      next.classList.toggle('is-disabled', isLast || isEmpty);
    }
    if (last) {
      (last as HTMLButtonElement).disabled = isLast || isEmpty;
      last.classList.toggle('is-disabled', isLast || isEmpty);
    }
  }
}

export default ListNavigator;
