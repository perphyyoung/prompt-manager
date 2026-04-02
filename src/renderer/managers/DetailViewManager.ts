import { Constants } from '../../constants.ts';
import { ListNavigator } from '../../utils/index.ts';

interface DetailViewManagerOptions {
  app: {
    constructor: { isSameId?: (id1: unknown, id2: unknown) => boolean };
    [key: string]: unknown;
  };
  modalId: string;
  closeBtnId: string;
}

interface NavButtons {
  first?: HTMLElement;
  prev?: HTMLElement;
  next?: HTMLElement;
  last?: HTMLElement;
}

interface Item {
  id: string | number;
  [key: string]: unknown;
}

/**
 * 详情视图管理器基类
 * 提供详情模态框的通用功能
 */
export class DetailViewManager {
  protected app: DetailViewManagerOptions['app'];
  protected modalId: string;
  protected closeBtnId: string;

  // 状态
  protected currentItem: Item | null = null;
  protected itemsSnapshot: Item[] = [];
  protected currentIndex = -1;

  // 导航器
  protected navigator: ListNavigator<Item> | null = null;

  // 保存管理
  protected saveManager: unknown = null;
  protected changeTracker: { hasChanges: () => boolean; destroy: () => void } | null = null;

  constructor(options: DetailViewManagerOptions) {
    this.app = options.app;
    this.modalId = options.modalId;
    this.closeBtnId = options.closeBtnId;

    // 状态
    this.currentItem = null;
    this.itemsSnapshot = [];
    this.currentIndex = -1;

    // 导航器
    this.navigator = null;

    // 保存管理
    this.saveManager = null;
    this.changeTracker = null;

    // 绑定关闭事件
    this.bindCloseEvent();
  }

  /**
   * 绑定关闭事件
   */
  bindCloseEvent(): void {
    const closeBtn = document.getElementById(this.closeBtnId);
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
  }

  /**
   * 打开详情模态框
   * @param item - 数据项
   * @param options - 选项
   * @abstract
   */
  async open(item: Item, options: { filteredList?: Item[] } = {}): Promise<void> {
    throw new Error('open() method must be implemented by subclass');
  }

  /**
   * 显示详情模态框
   * @protected
   */
  showModal(): void {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  /**
   * 关闭详情模态框
   */
  async close(): Promise<void> {
    // 保存所有变更
    if (this.saveManager && this.changeTracker?.hasChanges()) {
      await (this.saveManager as { saveAll: () => Promise<void> }).saveAll();
    }

    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.classList.remove('active');
    }

    // 清理
    this.cleanup();
  }

  /**
   * 导航到指定位置
   * @param direction - 导航方向 ('first', 'prev', 'next', 'last')
   * @protected
   */
  async navigateTo(direction: string): Promise<void> {
    if (!this.itemsSnapshot || this.itemsSnapshot.length === 0) return;

    let newIndex = this.currentIndex;

    switch (direction) {
      case 'first':
        newIndex = 0;
        break;
      case 'prev':
        if (this.currentIndex > 0) {
          newIndex = this.currentIndex - 1;
        }
        break;
      case 'next':
        if (this.currentIndex < this.itemsSnapshot.length - 1) {
          newIndex = this.currentIndex + 1;
        }
        break;
      case 'last':
        newIndex = this.itemsSnapshot.length - 1;
        break;
    }

    if (newIndex !== this.currentIndex && newIndex >= 0 && newIndex < this.itemsSnapshot.length) {
      this.currentIndex = newIndex;
      const targetItem = this.itemsSnapshot[newIndex];

      // 保存当前变更
      if (this.saveManager && this.changeTracker?.hasChanges()) {
        await (this.saveManager as { saveAll: () => Promise<void> }).saveAll();
      }

      // 导航到目标项
      await this.updateView(targetItem);

      // 更新导航器状态
      if (this.navigator) {
        this.navigator.currentIndex = newIndex;
        this.navigator.updateNavButtons();
      }
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.saveManager) {
      (this.saveManager as { destroy: () => void }).destroy();
      this.saveManager = null;
    }
    if (this.changeTracker) {
      this.changeTracker.destroy();
      this.changeTracker = null;
    }
    if (this.navigator) {
      this.navigator.destroy();
      this.navigator = null;
    }
    this.currentItem = null;
  }

  /**
   * 初始化导航器
   * @param item - 当前项
   * @param items - 所有项列表
   * @param navButtons - 导航按钮配置
   * @param onNavigate - 导航回调
   * @protected
   */
  initNavigator(item: Item, items: Item[], navButtons: NavButtons, onNavigate: (item: Item) => void | Promise<void>): void {
    // 记录快照
    this.itemsSnapshot = [...items];
    this.currentIndex = this.itemsSnapshot.findIndex(i =>
      this.app.constructor.isSameId ? this.app.constructor.isSameId(i.id, item.id) : String(i.id) === String(item.id)
    );

    // 填充导航按钮 SVGs
    this.fillNavButtonSVGs();

    // 初始化导航器（包含按钮点击和键盘导航）
    if (ListNavigator) {
      this.navigator = new ListNavigator({
        items: this.itemsSnapshot,
        currentIndex: this.currentIndex,
        onSave: () => this.saveWithoutClosing(),
        onNavigate: async (_targetItem, currentIndex) => {
          this.currentIndex = currentIndex;
          await onNavigate(_targetItem);
        },
        onClose: () => this.close(),
        navButtons,
        shouldHandleKeyboard: (e: KeyboardEvent) => {
          // 只在当前模态框打开时响应
          const modal = document.getElementById(this.modalId);
          if (!modal || !modal.classList.contains('active')) return false;
          // 如果全屏查看器打开，不响应（让全屏查看器优先处理）
          const fullscreenViewer = document.getElementById('imageFullscreenViewer');
          if (fullscreenViewer && fullscreenViewer.classList.contains('active')) return false;
          // 如果正在编辑输入框，不响应导航键
          if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return false;
          return true;
        }
      });

      // 确保按钮状态正确更新（DOM 元素已存在）
      this.navigator.updateNavButtons();
    }
  }

  /**
   * 填充导航按钮 SVGs
   * @protected
   */
  fillNavButtonSVGs(): void {
    const prefix = this.getNavButtonPrefix();
    ['first', 'prev', 'next', 'last'].forEach(type => {
      const btn = document.getElementById(`${prefix}${type.charAt(0).toUpperCase() + type.slice(1)}NavBtn`);
      if (btn) {
        btn.innerHTML = Constants.ICONS.nav[type as 'first' | 'prev' | 'next' | 'last'];
      }
    });
  }

  /**
   * 获取导航按钮前缀
   * @returns 前缀
   * @abstract
   * @protected
   */
  getNavButtonPrefix(): string {
    throw new Error('getNavButtonPrefix() method must be implemented by subclass');
  }

  /**
   * 获取当前项目快照
   * @returns 项目快照数组
   */
  getItemsSnapshot(): Item[] {
    return this.itemsSnapshot;
  }

  /**
   * 保存但不关闭
   * @protected
   */
  async saveWithoutClosing(): Promise<void> {
    if (this.saveManager) {
      await (this.saveManager as { saveAll: () => Promise<void> }).saveAll();
    }
  }

  /**
   * 更新视图
   * @param item - 数据项
   * @abstract
   * @protected
   */
  async updateView(item: Item): Promise<void> {
    throw new Error('updateView() method must be implemented by subclass');
  }
}

export default DetailViewManager;
