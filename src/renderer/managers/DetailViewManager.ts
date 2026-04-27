import { Constants, ElementId } from "../../constants.ts";
import { ListNavigator } from "../../utils/index.ts";
import { EditableTagList } from "../components/index.ts";
import { DialogConfig } from "../services/index.ts";
import { contextStack, IContextStackEntry } from "./ContextStackManager.ts";
import {
  batchToolbarMiddle,
  type ToolbarContext,
  type BatchBusinessConfig,
} from "../../middle/index.ts";
import type {
  IClosableElement,
  IDetailTagManager,
  IBatchTagManagerConfig,
} from "../../types/entities.ts";
import type { IApp } from '../app.types.ts';
import { cacheManager } from "../../utils/CacheManager.ts";
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

interface Item {
  id: string | number;
  [key: string]: unknown;
}

/**
 * 详情视图管理器基类
 * 提供详情模态框的通用功能
 */
export abstract class DetailViewManager {
  protected app: IApp;
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
  protected changeTracker: {
    hasChanges: () => boolean;
    destroy: () => void;
  } | null = null;

  // 批量标签管理
  protected editableTagList: EditableTagList | null = null;
  protected detailTagManager: IDetailTagManager | null = null;
  protected isBatchMode: boolean = false;
  protected batchTagConfig: IBatchTagManagerConfig | null = null;
  protected batchBtnHandler: (() => void) | null = null;
  protected toolbarContext: ToolbarContext | null = null;

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
    this.detailTagManager = null;
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
    const modal = document.getElementById(this.modalId) as IClosableElement;
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
        if (this.isBatchMode && this.toolbarContext) {
          // 批量模式下全选标签
          const allTags = this.detailTagManager?.getTags() || [];
          const filteredTags = allTags.filter(
            (tag) => !Constants.ALL_SPECIAL_TAGS.includes(tag),
          );
          batchToolbarMiddle.selectAllTags(this.toolbarContext, filteredTags);
          this.renderTagList();
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
  abstract open(item: Item, options?: { filteredList?: Item[] }): Promise<void>;

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
        isBatchToolbarVisible: this.isBatchMode,
      },
      close: () => {
        // 直接关闭模态框
        const modal = document.getElementById(this.modalId);
        if (modal) {
          modal.classList.remove("active");
        }
        // 清理（包括退出批量模式，这会先 pop 批量工具栏）
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
    // 清理批量标签管理资源（销毁工具栏）
    this.cleanupBatchTagManager();
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
    item: Item,
    items: Item[],
    navButtons: NavButtons,
    onNavigate: (item: Item) => void | Promise<void>,
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
          // 如果在批量标签模式，不响应（让 ShortcutManager 处理 Esc）
          if (this.isBatchMode) return false;
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
   * @protected
   */
  protected setSafeState(isSafe: boolean): void {
    const safeToggle = document.getElementById(this.getSafeToggleId()) as HTMLInputElement | null;
    if (safeToggle) {
      safeToggle.checked = isSafe;
    }
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
  abstract updateView(item: Item): Promise<void>;

  // ==================== 标签管理通用方法 ====================

  /**
   * 初始化详情标签管理器（总的初始化方法）
   * @param config - 批量标签管理配置
   * @param detailTagManager - 详情界面标签管理器
   * @protected
   */
  protected initDetailTagManager(
    config: IBatchTagManagerConfig,
    detailTagManager: IDetailTagManager,
  ): void {
    this.batchTagConfig = config;
    this.detailTagManager = detailTagManager;

    // 初始化标签渲染器
    this.initTagRenderer(config, detailTagManager);

    // 初始化批量标签管理
    this.initBatchTagManager(config);
  }

  /**
   * 初始化标签渲染器
   * @param config - 批量标签管理配置
   * @param detailTagManager - 详情界面标签管理器
   * @protected
   */
  protected initTagRenderer(
    config: IBatchTagManagerConfig,
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
          containerId: config.containerId,
          tagManager: detailTagManager as { getTags: () => string[] },
          onRemove: async (tagName: string) => {
            return await detailTagManager.removeTag(tagName);
          },
        });
        // 初始化事件委托，设置标签点击回调
        this.editableTagList.init((tagName: string) => {
          if (this.toolbarContext && this.isBatchMode) {
            batchToolbarMiddle.toggleTagSelection(this.toolbarContext, tagName);
            // 更新工具栏计数
            this.updateToolbarCount();
            // 只更新单个标签的选中状态，不重新渲染整个列表
            const isSelected = batchToolbarMiddle
              .getSelectedTags(this.toolbarContext)
              .has(tagName);
            this.editableTagList?.updateTagSelection(tagName, isSelected);
          }
        });
      }
      this.renderTagList();
    };
  }

  /**
   * 初始化批量标签管理
   * @param config - 批量标签管理配置
   * @param detailTagManager - 详情界面标签管理器
   * @protected
   */
  protected initBatchTagManager(config: IBatchTagManagerConfig): void {
    // 重置批量模式
    if (this.isBatchMode) {
      this.exitBatchMode();
    }

    // 初始化 BatchToolbarMiddle
    this.toolbarContext = config.context as ToolbarContext;

    // 业务配置 (详情页面只需要删除功能)
    const businessConfig: BatchBusinessConfig = {
      delete: {
        batchApi: async (ids) => {
          const result = await window.electronAPI.softDeletePrompts(ids);
          return { success: result.success, deleted: result.deleted };
        },
        clearCache: () => {
          cacheManager.getPromptCache().clear();
        },
      },
      addTag: {
        processItems: async () => {
          // 详情页面不支持批量添加标签
          throw new Error("详情页面不支持批量添加标签");
        },
      },
      favorite: {
        batchApi: async () => {
          // 详情页面不支持批量收藏
          throw new Error("详情页面不支持批量收藏");
        },
      },
    };

    batchToolbarMiddle.init(this.toolbarContext, businessConfig);
    batchToolbarMiddle.registerActionHandler(
      this.toolbarContext,
      "SelectAll",
      () => {
        if (this.toolbarContext) {
          const allTags = this.detailTagManager?.getTags() || [];
          const filteredTags = allTags.filter(
            (tag) => !Constants.ALL_SPECIAL_TAGS.includes(tag),
          );
          batchToolbarMiddle.selectAllTags(this.toolbarContext, filteredTags);
          this.renderTagList();
        }
      },
    );
    batchToolbarMiddle.registerActionHandler(
      this.toolbarContext,
      "Invert",
      () => {
        if (this.toolbarContext) {
          const allTags = this.detailTagManager?.getTags() || [];
          const filteredTags = allTags.filter(
            (tag) => !Constants.ALL_SPECIAL_TAGS.includes(tag),
          );
          batchToolbarMiddle.invertTagSelection(
            this.toolbarContext,
            filteredTags,
          );
          this.renderTagList();
        }
      },
    );
    batchToolbarMiddle.registerActionHandler(
      this.toolbarContext,
      "Delete",
      () => this.handleBatchDelete(),
    );
    batchToolbarMiddle.registerActionHandler(
      this.toolbarContext,
      "Cancel",
      () => this.exitBatchMode(),
    );

    // 绑定批量管理按钮事件
    this.bindBatchTagBtnEvent();
  }

  /**
   * 处理批量删除标签
   */
  private async handleBatchDelete(): Promise<void> {
    if (!this.toolbarContext) return;
    const context = this.toolbarContext; // 保存上下文引用
    await batchToolbarMiddle.executeDeleteTags(context, {
      getSelectedTags: () => batchToolbarMiddle.getSelectedTags(context),
      confirmConfig: DialogConfig.BATCH_DELETE_TAGS,
      execute: async (tagNames) => {
        const result = await this.detailTagManager?.removeTags(tagNames);
        return {
          success: result?.success || false,
          deleted: result?.deleted || 0,
        };
      },
      onRefresh: async () => {
        // 退出批量模式（会隐藏工具栏并清空选择）
        this.exitBatchMode();
        // 重新渲染标签
        this.detailTagManager?.onRender?.();
      },
      showToast: (msg, type) => this.app.showToast(msg, type),
      successMessage: (deleted) => `已删除 ${deleted} 个标签`,
    });
  }

  /**
   * 渲染标签列表
   */
  private renderTagList(): void {
    if (!this.editableTagList) return;

    const selectedTags = this.toolbarContext
      ? batchToolbarMiddle.getSelectedTags(this.toolbarContext)
      : new Set<string>();

    this.editableTagList.render(selectedTags, this.isBatchMode);
  }

  /**
   * 更新工具栏计数显示
   */
  private updateToolbarCount(): void {
    if (!this.toolbarContext) return;
    const toolbarConfig = batchToolbarMiddle.getToolbarConfig(
      this.toolbarContext,
    );
    if (!toolbarConfig) return;

    const toolbar = document.getElementById(toolbarConfig.id);
    if (!toolbar) return;

    const count = batchToolbarMiddle.getSelectedTags(this.toolbarContext).size;
    const countSpan = toolbar.querySelector(".batch-toolbar-count");
    if (countSpan) {
      countSpan.textContent = `已选择 ${count} 个标签`;
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
      batchBtn.removeEventListener("click", this.batchBtnHandler);
    }

    // 创建并绑定新的事件监听器
    this.batchBtnHandler = () => this.toggleBatchMode();
    batchBtn.addEventListener("click", this.batchBtnHandler);
  }

  /**
   * 切换批量模式
   * @protected
   */
  protected toggleBatchMode(): void {
    if (!this.editableTagList || !this.batchTagConfig) {
      return;
    }

    if (this.isBatchMode) {
      this.exitBatchMode();
    } else {
      this.enterBatchMode();
    }
  }

  /**
   * 进入批量模式
   */
  private enterBatchMode(): void {
    this.isBatchMode = true;

    // 清空之前的选择
    if (this.toolbarContext) {
      batchToolbarMiddle.clearSelection(this.toolbarContext);
    }

    // 重新渲染标签列表（显示复选框）
    this.renderTagList();

    if (this.toolbarContext) {
      // 获取工具栏配置并检查状态

      batchToolbarMiddle.show(this.toolbarContext, 0, () => {
        this.exitBatchMode();
      });
    }

    // 隐藏输入区域
    const config = this.batchTagConfig;
    if (config) {
      const inputArea = document.getElementById(config.inputAreaId);
      if (inputArea) inputArea.style.display = "none";
    }
  }

  /**
   * 退出批量模式
   */
  private exitBatchMode(): void {
    this.isBatchMode = false;

    // 清空选择并隐藏工具栏（不等待动画）
    if (this.toolbarContext) {
      batchToolbarMiddle.clearSelection(this.toolbarContext);
      batchToolbarMiddle.hide(this.toolbarContext);
    }

    // 重新渲染标签列表（显示删除按钮）
    this.renderTagList();

    // 显示输入区域
    const config = this.batchTagConfig;
    if (config) {
      const inputArea = document.getElementById(config.inputAreaId);
      if (inputArea) inputArea.style.display = "";
    }
  }

  /**
   * 清理批量标签管理资源
   * @protected
   */
  protected cleanupBatchTagManager(): void {
    // 退出批量模式
    if (this.isBatchMode) {
      this.exitBatchMode();
    }

    // 移除批量按钮事件监听器
    if (this.batchBtnHandler && this.batchTagConfig) {
      const batchBtn = document.getElementById(this.batchTagConfig.batchBtnId);
      if (batchBtn) {
        batchBtn.removeEventListener("click", this.batchBtnHandler);
      }
    }

    // 隐藏工具栏（不等待动画完成）
    if (this.toolbarContext) {
      batchToolbarMiddle.hide(this.toolbarContext);
    }

    this.batchBtnHandler = null;
    this.editableTagList = null;
    this.detailTagManager = null;
    this.batchTagConfig = null;
    this.toolbarContext = null;
  }
}
