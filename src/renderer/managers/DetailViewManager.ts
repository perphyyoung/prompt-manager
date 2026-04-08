import { Constants, ElementId, Events } from '../../constants.ts';
import { ListNavigator } from '../../utils/index.ts';
import { EditableTagList } from '../components/index.ts';
import { DialogService, DialogConfig } from '../services/index.ts';
import { contextStack } from './ContextStackManager.ts';
import { BatchToolbar, IBatchToolbarConfig } from '../components/BatchToolbar.ts';

interface DetailViewManagerOptions {
  app: {
    constructor: { isSameId?: (id1: unknown, id2: unknown) => boolean };
    showToast: (message: string, type?: string) => void;
    eventBus: {
      emit: (event: string, data?: unknown) => void;
    };
    [key: string]: unknown;
  };
  modalId: string;
  closeBtnId: string;
}

// 简单标签管理器接口
export interface ISimpleTagManager {
  getTags: () => string[];
  setTags: (tags: string[]) => void;
  removeTag: (tagName: string) => Promise<void> | Promise<boolean>;
  removeTags: (tagNames: string[]) => Promise<{ success: boolean; deleted: number }>;
  addTag?: (tagName: string) => Promise<{ success: boolean }>;
  addTags?: (tagNames: string[]) => Promise<{ success: boolean; added: number }>;
  onRender?: ((tags?: string[]) => void) | null;
}

// 批量标签管理配置
interface IBatchTagManagerConfig {
  toolbarId: string;
  containerId: string;
  inputAreaId: string;
  batchBtnId: string;
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

  // 批量标签管理
  protected editableTagList: EditableTagList | null = null;
  protected simpleTagManager: ISimpleTagManager | null = null;
  protected isBatchMode: boolean = false;
  protected batchTagConfig: IBatchTagManagerConfig | null = null;
  protected batchBtnHandler: (() => void) | null = null;
  protected batchToolbar: BatchToolbar | null = null;

  // 关闭事件处理函数引用（用于移除事件监听）
  private closeHandler: (() => void) | null = null;

  // 防止 close 重复执行
  private isClosing = false;

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

    // 批量标签管理
    this.editableTagList = null;
    this.simpleTagManager = null;
    this.isBatchMode = false;
    this.batchTagConfig = null;

    // 绑定关闭事件
    this.bindCloseEvent();

    // 为 DOM 元素附加 close 方法
    this.attachCloseMethod();
  }

  /**
   * 为 DOM 元素附加 close 方法
   */
  private attachCloseMethod(): void {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.close = () => this.close();
    }
  }

  /**
   * 为 DOM 元素附加 ctrla 方法
   * 非批量模式下阻止默认行为（Ctrl+A 无效）
   * 批量模式下全选标签
   */
  private attachCtrlAMethod(): void {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      (modal as any).ctrla = () => {
        if (this.isBatchMode) {
          // 批量模式下全选标签
          this.editableTagList?.selectAll();
        }
        // 始终返回 true 阻止默认行为（非批量模式下 Ctrl+A 无效）
        return true;
      };
    }
  }

  /**
   * 绑定关闭事件
   */
  bindCloseEvent(): void {
    const closeBtn = document.getElementById(this.closeBtnId);
    if (closeBtn) {
      // 先移除旧的事件监听器（如果存在）
      if (this.closeHandler) {
        window.electronAPI.logWarn('DetailViewManager', `removing old event listener for ${this.closeBtnId}`);
        closeBtn.removeEventListener('click', this.closeHandler);
      }
      // 创建新的处理函数并保存引用
      this.closeHandler = () => this.close();
      closeBtn.addEventListener('click', this.closeHandler);
    } else {
      window.electronAPI.logError('DetailViewManager', `closeBtn not found: ${this.closeBtnId}`);
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
    // 立即隐藏 hover tooltip（如果正在显示）
    this.hideHoverTooltip();

    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.classList.add('active');
    }

    // 附加 ctrla 方法
    this.attachCtrlAMethod();

    // 压栈：进入详情视图上下文
    contextStack.push(this.modalId as ElementId);

    // 发布视图变化事件，通知其他组件清理多选工具栏
    this.app.eventBus.emit(Events.VIEW_CHANGED, { view: 'detail', modalId: this.modalId });
  }

  /**
   * 隐藏 hover tooltip
   * @private
   */
  private hideHoverTooltip(): void {
    // 隐藏图像提示词 tooltip
    const imageTooltip = document.getElementById('imagePromptTooltip');
    if (imageTooltip?.classList.contains('show')) {
      imageTooltip.classList.remove('show');
    }

    // 隐藏提示词预览 tooltip
    const promptTooltip = document.getElementById('promptPreviewTooltip');
    if (promptTooltip?.classList.contains('show')) {
      promptTooltip.classList.remove('show');
    }
  }

  /**
   * 关闭详情模态框
   */
  async close(): Promise<void> {
    // 防止重复执行
    if (this.isClosing) {
      window.electronAPI.logDebug('DetailViewManager', `close skipped (already closing), modalId=${this.modalId}`);
      return;
    }
    this.isClosing = true;
    window.electronAPI.logDebug('DetailViewManager', `close called, modalId=${this.modalId}`);

    try {
      // 保存所有变更
      if (this.saveManager && this.changeTracker?.hasChanges()) {
        await (this.saveManager as { saveAll: () => Promise<void> }).saveAll();
      }

      const modal = document.getElementById(this.modalId);
      if (modal) {
        modal.classList.remove('active');
      }

      // 出栈：退出详情视图上下文
      contextStack.pop(this.modalId as ElementId);

      // 清理
      window.electronAPI.logDebug('DetailViewManager', 'close: calling cleanup');
      this.cleanup();
    } finally {
      this.isClosing = false;
      window.electronAPI.logDebug('DetailViewManager', 'close finished');
    }
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
    window.electronAPI.logDebug('DetailViewManager', `cleanup called, modalId=${this.modalId}`);
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
    // 清理批量标签管理资源（销毁工具栏）
    window.electronAPI.logDebug('DetailViewManager', 'cleanup: calling cleanupBatchTagManager');
    this.cleanupBatchTagManager();
    this.currentItem = null;
    window.electronAPI.logDebug('DetailViewManager', 'cleanup finished');
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
        navButtons,
        shouldHandleKeyboard: (e: KeyboardEvent) => {
          // 只在当前模态框打开时响应
          const modal = document.getElementById(this.modalId);
          if (!modal || !modal.classList.contains('active')) return false;
          // 如果全屏查看器打开，不响应（让全屏查看器优先处理）
          const fullscreenViewer = document.getElementById('imageFullscreenViewer');
          if (fullscreenViewer && fullscreenViewer.classList.contains('active')) return false;
          // 如果在批量标签模式，不响应（让 ShortcutManager 处理 Esc）
          if (this.isBatchMode) return false;
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

  // ==================== 批量标签管理通用方法 ====================

  /**
   * 初始化批量标签管理
   * @param config - 批量标签管理配置
   * @param tagManager - 简单标签管理器
   * @protected
   */
  protected initBatchTagManager(config: IBatchTagManagerConfig, tagManager: ISimpleTagManager): void {
    window.electronAPI.logDebug('DetailViewManager', `initBatchTagManager called, current isBatchMode=${this.isBatchMode}`);

    this.batchTagConfig = config;
    this.simpleTagManager = tagManager;

    // 清理旧的标签列表组件
    if (this.editableTagList) {
      this.editableTagList = null;
    }

    // 重置批量模式
    if (this.isBatchMode) {
      window.electronAPI.logDebug('DetailViewManager', 'initBatchTagManager: exiting batch mode');
      this.exitBatchMode();
    }

    // 初始化 BatchToolbar
    this.batchToolbar = new BatchToolbar({
      config: this.createBatchToolbarConfig(config),
      onAction: (action) => this.handleBatchToolbarAction(action),
      onClose: () => this.exitBatchMode()
    });

    window.electronAPI.logDebug('DetailViewManager', 'initBatchTagManager finished, batch mode reset');

    // 设置渲染回调
    tagManager.onRender = () => {
      if (!this.editableTagList) {
        this.editableTagList = new EditableTagList({
          containerId: config.containerId,
          tagManager: tagManager as { getTags: () => string[] },
          onRemove: async (tagName: string) => {
            await tagManager.removeTag(tagName);
          }
        });
        // 设置选择变更回调
        this.editableTagList.setOnSelectionChange((selectedTags) => {
          this.batchToolbar?.updateCount(selectedTags.size);
        });
      }
      this.editableTagList.renderWithInit();
    };

    // 绑定批量管理按钮事件
    this.bindBatchTagBtnEvent();
  }

  /**
   * 创建 BatchToolbar 配置
   */
  private createBatchToolbarConfig(config: IBatchTagManagerConfig): IBatchToolbarConfig {
    return {
      id: config.toolbarId,
      label: '标签',
      buttons: [
        { action: 'SelectAll', text: '全选', className: 'batch-action-select-all' },
        { action: 'Invert', text: '反选', className: 'batch-action-invert' },
        { action: 'Delete', text: '删除', className: 'batch-action-delete' },
        { action: 'Cancel', text: '完成', className: 'batch-action-cancel' }
      ]
    };
  }

  /**
   * 处理批量工具栏动作
   */
  private handleBatchToolbarAction(action: string): void {
    const app = this.app;

    switch (action) {
      case 'SelectAll':
        this.editableTagList?.selectAll();
        break;
      case 'Invert':
        this.editableTagList?.invertSelection();
        break;
      case 'Delete':
        void this.handleBatchDelete();
        break;
      case 'Cancel':
        this.exitBatchMode();
        break;
    }
  }

  /**
   * 处理批量删除标签
   */
  private async handleBatchDelete(): Promise<void> {
    const app = this.app;
    const selectedTags = this.editableTagList?.getSelectedTags();
    if (selectedTags && selectedTags.size > 0) {
      const confirmed = await DialogService.showConfirmDialogByConfig(
        DialogConfig.BATCH_DELETE_TAGS,
        { count: selectedTags.size }
      );
      if (confirmed) {
        const result = await this.simpleTagManager?.removeTags(Array.from(selectedTags));
        if (result?.success) {
          app.showToast(`已删除 ${result.deleted} 个标签`, 'success');
        }
        this.exitBatchMode();
      }
    } else {
      app.showToast('请先选择要删除的标签', 'warning');
    }
  }

  /**
   * 绑定批量管理标签按钮事件
   * @private
   */
  private bindBatchTagBtnEvent(): void {
    const config = this.batchTagConfig;
    if (!config) return;
    const batchBtn = document.getElementById(config.batchBtnId);
    if (!batchBtn) return;

    // 移除旧的事件监听器
    if (this.batchBtnHandler) {
      batchBtn.removeEventListener('click', this.batchBtnHandler);
    }

    // 创建并绑定新的事件监听器
    this.batchBtnHandler = () => this.toggleBatchMode();
    batchBtn.addEventListener('click', this.batchBtnHandler);
  }

  /**
   * 切换批量模式
   * @protected
   */
  protected toggleBatchMode(): void {
    window.electronAPI.logDebug('DetailViewManager', `toggleBatchMode start, isBatchMode=${this.isBatchMode}, has editableTagList=${!!this.editableTagList}, has batchTagConfig=${!!this.batchTagConfig}`);

    if (!this.editableTagList || !this.batchTagConfig) {
      window.electronAPI.logDebug('DetailViewManager', 'toggleBatchMode early return: missing editableTagList or batchTagConfig');
      return;
    }

    if (this.isBatchMode) {
      this.exitBatchMode();
    } else {
      this.enterBatchMode();
    }

    window.electronAPI.logDebug('DetailViewManager', `toggleBatchMode end, isBatchMode=${this.isBatchMode}`);
  }

  /**
   * 进入批量模式
   */
  private enterBatchMode(): void {
    window.electronAPI.logDebug('DetailViewManager', 'Entering batch mode');

    this.isBatchMode = true;
    this.editableTagList?.enterBatchMode();
    this.batchToolbar?.show(0);

    // 隐藏输入区域
    const config = this.batchTagConfig;
    if (config) {
      const inputArea = document.getElementById(config.inputAreaId);
      if (inputArea) inputArea.style.display = 'none';
    }
  }

  /**
   * 退出批量模式
   */
  private exitBatchMode(): void {
    window.electronAPI.logDebug('DetailViewManager', 'Exiting batch mode');

    this.isBatchMode = false;
    this.editableTagList?.exitBatchMode();
    this.batchToolbar?.hide();

    // 显示输入区域
    const config = this.batchTagConfig;
    if (config) {
      const inputArea = document.getElementById(config.inputAreaId);
      if (inputArea) inputArea.style.display = '';
    }
  }

  /**
   * 清理批量标签管理资源
   * @protected
   */
  protected cleanupBatchTagManager(): void {
    window.electronAPI.logDebug('DetailViewManager', `cleanupBatchTagManager called, isBatchMode=${this.isBatchMode}`);

    // 退出批量模式
    if (this.isBatchMode) {
      this.exitBatchMode();
    }

    // 移除批量按钮事件监听器
    if (this.batchBtnHandler && this.batchTagConfig) {
      const batchBtn = document.getElementById(this.batchTagConfig.batchBtnId);
      if (batchBtn) {
        batchBtn.removeEventListener('click', this.batchBtnHandler);
      }
    }

    // 销毁工具栏
    this.batchToolbar?.destroy();
    this.batchToolbar = null;

    this.batchBtnHandler = null;
    this.editableTagList = null;
    this.simpleTagManager = null;
    this.batchTagConfig = null;

    window.electronAPI.logDebug('DetailViewManager', 'cleanupBatchTagManager finished');
  }
}

export default DetailViewManager;
