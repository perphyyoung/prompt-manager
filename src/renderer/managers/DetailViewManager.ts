import { Constants, ElementId } from "../../constants.ts";
import { ListNavigator } from "../../utils/index.ts";
import { EditableTagList } from "../components/index.ts";
import { contextStack, IContextStackEntry } from "./ContextStackManager.ts";
import type {
  IClosableElement,
  IDetailTagManager,
} from "../../types/entities.ts";
import type { IApp } from '../app.types.ts';
interface DetailViewManagerOptions {
  app: IApp;
  modalId: string;
  closeBtnId: string;
}

interface NavButtons {
  first?: HTMLElement;
  prev?: HTMLElement;
  next?: HTMLElement;
  last?: HTMLElement;
}

/** 详情项最小约束：子类以具体实体类型实例化（IImage / IPrompt） */
export interface DetailViewItem {
  id: string;
  [key: string]: unknown;
}

/**
 * 详情视图管理器基类
 * 提供详情模态框的通用功能；泛型参数为当前详情实体类型
 */
export abstract class DetailViewManager<TItem extends DetailViewItem = DetailViewItem> {
  protected app: IApp;
  protected modalId: string;
  protected closeBtnId: string;

  // 状态
  protected currentItem: TItem | null = null;
  protected itemsSnapshot: TItem[] = [];
  protected currentIndex = -1;

  // 导航器
  protected navigator: ListNavigator<TItem> | null = null;

  // 保存管理
  protected saveManager: unknown = null;
  protected changeTracker: {
    hasChanges: () => boolean;
    destroy: () => void;
  } | null = null;

  // 标签管理
  protected editableTagList: EditableTagList | null = null;
  protected detailTagManager: IDetailTagManager | null = null;

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

    // 标签管理
    this.editableTagList = null;
    this.detailTagManager = null;

    // 绑定关闭事件
    this.bindCloseEvent();

    // 为 DOM 元素附加 close 方法
    this.attachCloseMethod();
  }

  /**
   * 为 DOM 元素附加 close 方法
   */
  private attachCloseMethod(): void {
    const modal = document.getElementById(this.modalId) as IClosableElement;
    if (modal) {
      modal.close = () => this.close();
    }
  }

  /**
   * 为 DOM 元素附加 ctrla 方法
   * 始终返回 true 阻止默认行为（Ctrl+A 无效）
   */
  private attachCtrlAMethod(): void {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      (modal as any).ctrla = () => {
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
        window.electronAPI.logWarn(
          "DetailViewManager",
          `removing old event listener for ${this.closeBtnId}`,
        );
        closeBtn.removeEventListener("click", this.closeHandler);
      }
      // 创建新的处理函数并保存引用
      this.closeHandler = () => this.close();
      closeBtn.addEventListener("click", this.closeHandler);
    } else {
      window.electronAPI.logError(
        "DetailViewManager",
        `closeBtn not found: ${this.closeBtnId}`,
      );
    }
  }

  /**
   * 打开详情模态框
   * @param item - 数据项
   * @param options - 选项
   * @abstract
   */
  abstract open(item: TItem, options?: { filteredList?: TItem[] }): Promise<void>;

  /**
   * 显示详情模态框
   * @protected
   */
  showModal(): void {
    // 立即隐藏 hover tooltip（如果正在显示）
    this.hideHoverTooltip();

    const modal = document.getElementById(this.modalId) as IClosableElement;
    if (modal) {
      modal.classList.add("active");

      // 添加 close 方法供 ShortcutManager 调用
      modal.close = () => {
        this.close();
      };
    }

    // 附加 ctrla 方法
    this.attachCtrlAMethod();

    // 压栈：进入详情视图上下文
    const stackEntry: IContextStackEntry = {
      id: this.modalId as ElementId,
      state: {
        isBatchToolbarVisible: false,
      },
      close: () => {
        // 直接关闭模态框
        const modal = document.getElementById(this.modalId);
        if (modal) {
          modal.classList.remove("active");
        }
        // 清理
        this.cleanup();
        // 出栈
        contextStack.pop(this.modalId as ElementId);
      },
    };
    contextStack.push(stackEntry);
  }

  /**
   * 隐藏 hover tooltip
   * @private
   */
  private hideHoverTooltip(): void {
    // 隐藏图像提示词 tooltip
    const imageTooltip = document.getElementById(
      Constants.Ids.IMAGE_PROMPT_TOOLTIP,
    );
    if (imageTooltip?.classList.contains("show")) {
      imageTooltip.classList.remove("show");
    }

    // 隐藏提示词预览 tooltip
    const promptTooltip = document.getElementById(
      Constants.Ids.PROMPT_PREVIEW_TOOLTIP,
    );
    if (promptTooltip?.classList.contains("show")) {
      promptTooltip.classList.remove("show");
    }
  }

  /**
   * 关闭详情模态框
   */
  async close(): Promise<void> {
    // 防止重复执行
    if (this.isClosing) {
      window.electronAPI.logWarn(
        "DetailViewManager",
        `close skipped (already closing), modalId=${this.modalId}`,
      );
      return;
    }
    this.isClosing = true;

    try {
      // 保存所有变更
      if (this.saveManager && this.changeTracker?.hasChanges()) {
        await (this.saveManager as { saveAll: () => Promise<void> }).saveAll();
      }

      const modal = document.getElementById(this.modalId);
      if (modal) {
        modal.classList.remove("active");
      }

      // 清理（包括退出批量模式，这会先 pop 批量工具栏）
      this.cleanup();

      // 出栈：退出详情视图上下文
      contextStack.pop(this.modalId as ElementId);
    } finally {
      this.isClosing = false;
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
      case "first":
        newIndex = 0;
        break;
      case "prev":
        if (this.currentIndex > 0) {
          newIndex = this.currentIndex - 1;
        }
        break;
      case "next":
        if (this.currentIndex < this.itemsSnapshot.length - 1) {
          newIndex = this.currentIndex + 1;
        }
        break;
      case "last":
        newIndex = this.itemsSnapshot.length - 1;
        break;
    }

    if (
      newIndex !== this.currentIndex &&
      newIndex >= 0 &&
      newIndex < this.itemsSnapshot.length
    ) {
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
    // 清理标签管理资源
    this.editableTagList = null;
    this.detailTagManager = null;
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
  initNavigator(
    item: TItem,
    items: TItem[],
    navButtons: NavButtons,
    onNavigate: (item: TItem) => void | Promise<void>,
  ): void {
    // 记录快照
    this.itemsSnapshot = [...items];
    this.currentIndex = this.itemsSnapshot.findIndex((i) =>
      this.app.isSameId(i.id, item.id)
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
          if (!modal || !modal.classList.contains("active")) return false;
          // 如果全屏查看器打开，不响应（让全屏查看器优先处理）
          const fullscreenViewer = document.getElementById(
            Constants.Ids.IMAGE_FULLSCREEN_VIEWER,
          );
          if (fullscreenViewer && fullscreenViewer.classList.contains("active"))
            return false;
          // 如果正在编辑输入框，不响应导航键
          if (
            (e.target as HTMLElement).tagName === "INPUT" ||
            (e.target as HTMLElement).tagName === "TEXTAREA"
          )
            return false;
          return true;
        },
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
    ["first", "prev", "next", "last"].forEach((type) => {
      const btn = document.getElementById(
        `${prefix}${type.charAt(0).toUpperCase() + type.slice(1)}NavBtn`,
      );
      if (btn) {
        btn.innerHTML =
          Constants.ICONS.nav[type as "first" | "prev" | "next" | "last"];
      }
    });
  }

  /**
   * 获取导航按钮前缀
   * @returns 前缀
   * @abstract
   * @protected
   */
  abstract getNavButtonPrefix(): string;

  /**
   * 获取收藏按钮元素 ID（子类实现）
   * @returns 收藏按钮的元素 ID
   * @abstract
   * @protected
   */
  protected abstract getFavoriteBtnId(): string;

  /**
   * 获取安全状态切换元素 ID（子类实现）
   * @returns 安全状态切换的元素 ID
   * @abstract
   * @protected
   */
  protected abstract getSafeToggleId(): string;

  /**
   * 更新收藏按钮 UI（通用实现）
   * @param isFavorite - 是否收藏
   * @protected
   */
  protected updateFavoriteBtnUI(isFavorite: boolean): void {
    const btn = document.getElementById(this.getFavoriteBtnId());
    if (!btn) return;

    if (isFavorite) {
      btn.classList.add('active');
      btn.title = '取消收藏';
      btn.innerHTML = Constants.ICONS.favorite.filled;
    } else {
      btn.classList.remove('active');
      btn.title = '收藏';
      btn.innerHTML = Constants.ICONS.favorite.outline;
    }
  }

  /**
   * 设置安全状态 UI（通用实现）
   * @param isSafe - 是否安全
   */
  setSafeState(isSafe: boolean): void {
    const safeToggle = document.getElementById(this.getSafeToggleId()) as HTMLInputElement | null;
    if (safeToggle) {
      safeToggle.checked = isSafe;
    }
  }

  /**
   * 获取当前项目快照
   * @returns 项目快照数组
   */
  getItemsSnapshot(): TItem[] {
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
  abstract updateView(item: TItem): Promise<void>;

  // ==================== 标签管理通用方法 ====================

  /**
   * 初始化详情标签管理器
   * @param containerId - 标签容器元素 ID
   * @param detailTagManager - 详情界面标签管理器
   * @protected
   */
  protected initDetailTagManager(
    containerId: string,
    detailTagManager: IDetailTagManager,
  ): void {
    this.detailTagManager = detailTagManager;

    // 初始化标签渲染器
    this.initTagRenderer(containerId, detailTagManager);
  }

  /**
   * 初始化标签渲染器
   * @param containerId - 标签容器元素 ID
   * @param detailTagManager - 详情界面标签管理器
   * @protected
   */
  protected initTagRenderer(
    containerId: string,
    detailTagManager: IDetailTagManager,
  ): void {
    // 清理旧的标签列表组件和事件监听器
    if (this.editableTagList) {
      this.editableTagList.destroy();
      this.editableTagList = null;
    }

    // 设置渲染回调
    detailTagManager.onRender = () => {
      if (!this.editableTagList) {
        this.editableTagList = new EditableTagList({
          containerId,
          tagManager: detailTagManager as { getTags: () => string[] },
          onRemove: async (tagName: string) => {
            return await detailTagManager.removeTag(tagName);
          },
        });
        // 初始化事件委托
        this.editableTagList.init();
      }
      this.renderTagList();
    };
  }

  /**
   * 渲染标签列表
   */
  private renderTagList(): void {
    if (!this.editableTagList) return;
    this.editableTagList.render();
  }

}
