/**
 * BatchToolbarMiddle - 批量工具栏中间层
 * 统一处理批量工具栏的业务逻辑、DOM操作和状态管理
 */

import {
  getPresetConfig,
  type BatchToolbarConfig,
  type ToolbarContext,
} from "../pyBatchToolbar/index.ts";
import { sortButtons } from "../pyBatchToolbar/utils.ts";
import {
  contextStack,
  IContextStackEntry,
} from "../renderer/managers/ContextStackManager.ts";
import { DialogService } from "../renderer/services/index.ts";
import { ElementId } from "../constants.ts";
import type { IDialogTemplate } from "../types/entities.ts";

/** 动作处理器 */
type ActionHandler = () => void | Promise<void>;

/** 工具栏状态 */
interface IToolbarState {
  config: BatchToolbarConfig;
  actionHandlers: Map<string, ActionHandler>;
  selectedIds: Set<string>;
  lastSelectedIndex: number | undefined;
  businessConfig: BatchBusinessConfig;
  visible: boolean;
  count: number;
  /** 选择状态变化时的回调 */
  onSelectionChange?: () => void;
  /** 隐藏工具栏的延时定时器 */
  hideTimer?: ReturnType<typeof setTimeout>;
}

/** 批量业务配置 */
export interface BatchBusinessConfig {
  delete: {
    batchApi: (ids: string[]) => Promise<{ success: boolean; deleted: number }>;
    clearCache?: () => void;
  };
  addTag: {
    processItems: (ids: string[], tagNames: string[]) => Promise<void>;
  };
  favorite: {
    batchApi: (ids: string[]) => Promise<{ success: boolean; updated?: number } | void>;
  };
}

/**
 * BatchToolbarMiddle 批量工具栏中间层
 * 合并了原 PyBatchToolbar 的功能，直接管理 DOM 和状态
 */
export class BatchToolbarMiddle {
  private static instance: BatchToolbarMiddle | null = null;

  private states = new Map<ToolbarContext, IToolbarState>();

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): BatchToolbarMiddle {
    if (!BatchToolbarMiddle.instance) {
      BatchToolbarMiddle.instance = new BatchToolbarMiddle();
    }
    return BatchToolbarMiddle.instance;
  }

  /**
   * 初始化指定上下文的工具栏
   * @param context - 工具栏上下文
   * @param businessConfig - 业务配置
   */
  init(context: ToolbarContext, businessConfig: BatchBusinessConfig): void {
    // 如果已存在，先销毁
    if (this.states.has(context)) {
      this.destroyContext(context);
    }

    const config = getPresetConfig(context);

    // 创建统一的状态对象
    this.states.set(context, {
      config,
      actionHandlers: new Map(),
      selectedIds: new Set(),
      lastSelectedIndex: undefined,
      businessConfig,
      visible: false,
      count: 0,
    });

    // 创建 DOM 元素
    this.createToolbarElement(context, config);

    // 绑定事件
    this.bindToolbarEvents(context, config.id);
  }

  /**
   * 初始化所有预设工具栏
   * @param businessConfig - 业务配置
   */
  initAll(businessConfig: BatchBusinessConfig): void {
    const contexts: ToolbarContext[] = [
      "promptMain",
      "imageMain",
      "promptDetail",
      "imageDetail",
      "promptTagManager",
      "imageTagManager",
    ];

    contexts.forEach((context) => this.init(context, businessConfig));
  }

  /**
   * 注册选择状态变化回调
   * @param context - 工具栏上下文
   * @param callback - 选择状态变化时的回调函数
   */
  registerSelectionChangeCallback(
    context: ToolbarContext,
    callback: () => void,
  ): void {
    const state = this.states.get(context);
    if (!state) return;

    state.onSelectionChange = callback;
  }

  /**
   * 显示工具栏
   * @param context - 工具栏上下文
   * @param count - 计数
   * @param onClose - 关闭时的回调函数（必需）
   */
  show(context: ToolbarContext, count: number, onClose: () => void): void {
    const state = this.states.get(context);
    if (!state) return;

    if (state.visible) {
      this.updateCount(context, count);
      return;
    }

    // 清除上一个 hide 残留的定时器，防止意外隐藏
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = undefined;
    }

    const toolbar = document.getElementById(state.config.id);
    if (!toolbar) return;

    // 显示工具栏
    toolbar.style.display = "block";
    void toolbar.offsetWidth; // 强制重排
    toolbar.classList.add("visible");

    this.updateToolbarCount(context, count);
    state.visible = true;
    state.count = count;

    // 关闭回调：调用 Manager 的 exitBatchMode 进行清理
    const closeCallback = () => {
      onClose?.();
    };

    // 附加 close/ctrla 方法用于 ESC/Ctrl+A 处理
    // closeCallback 会调用 Manager 的 exitBatchMode，其中已包含 hide 和 clearSelection
    (toolbar as any).close = closeCallback;
    (toolbar as any).ctrla = () => {
      if (state.actionHandlers.has("SelectAll")) {
        state.actionHandlers.get("SelectAll")!();
      }
      return true;
    };

    // 压栈：进入批量模式上下文
    const stackEntry: IContextStackEntry = {
      id: state.config.id as ElementId,
      state: { isBatchToolbarVisible: true },
      close: closeCallback,
    };
    contextStack.push(stackEntry);
  }

  /**
   * 隐藏工具栏
   * @param context - 工具栏上下文
   */
  hide(context: ToolbarContext): void {
    const state = this.states.get(context);
    if (!state || !state.visible) return;

    const toolbar = document.getElementById(state.config.id);
    if (toolbar) {
      toolbar.classList.remove("visible");
      state.hideTimer = setTimeout(() => {
        toolbar.style.display = "none";
        state.hideTimer = undefined;
      }, 200);
    }

    state.visible = false;

    // 出栈：退出批量模式上下文
    contextStack.pop(state.config.id as ElementId);

    // 清空选择集，退出批量模式
    this.clearSelection(context);
  }

  /**
   * 隐藏所有工具栏
   */
  hideAll(): void {
    this.states.forEach((_, context) => this.hide(context));
  }

  /**
   * 检查工具栏是否可见
   * @param context - 工具栏上下文
   * @returns 是否可见
   */
  isVisible(context: ToolbarContext): boolean {
    const state = this.states.get(context);
    return state?.visible ?? false;
  }

  /**
   * 更新计数
   * @param context - 工具栏上下文
   * @param count - 计数
   */
  updateCount(context: ToolbarContext, count: number): void {
    const state = this.states.get(context);
    if (!state) return;

    state.count = count;
    this.updateToolbarCount(context, count);
  }

  /**
   * 注册动作处理器
   * @param context - 工具栏上下文
   * @param action - 动作标识
   * @param handler - 处理器函数
   */
  registerActionHandler(
    context: ToolbarContext,
    action: string,
    handler: ActionHandler,
  ): void {
    const state = this.states.get(context);
    if (state) {
      state.actionHandlers.set(action, handler);
    }
  }

  /**
   * 批量删除
   * @param context - 工具栏上下文
   * @param ids - 项目 ID 数组
   */
  async batchDelete(context: ToolbarContext, ids: string[]): Promise<void> {
    const config = this.states.get(context)?.businessConfig.delete;
    if (!config) {
      throw new Error(`未配置 ${context} 的批量删除业务逻辑`);
    }

    await config.batchApi(ids);

    if (config.clearCache) {
      config.clearCache();
    }
  }

  /**
   * 统一批量删除流程：确认 → 执行 → 清空选择 → 刷新 → Toast
   * @param context - 工具栏上下文
   * @param options - 删除配置
   */
  async executeDelete(
    context: ToolbarContext,
    options: {
      /** 确认对话框配置 */
      confirmConfig: IDialogTemplate;
      /** 执行删除的异步函数 */
      execute: (
        ids: string[],
      ) => Promise<{ success: boolean; deleted: number }>;
      /** 删除成功后的刷新回调 */
      onRefresh: () => Promise<void>;
      /** Toast 回调 */
      showToast: (message: string, type: string) => void;
      /** 成功消息模板回调，接收删除数量和总数量 */
      successMessage?: (deleted: number, total: number) => string;
    },
  ): Promise<void> {
    const selectedIds = Array.from(this.getSelectedIds(context));
    if (selectedIds.length === 0) return;

    // 确认对话框
    const confirmed = await DialogService.showConfirmDialogByConfig(
      options.confirmConfig,
      { count: selectedIds.length },
    );
    if (!confirmed) return;

    try {
      const result = await options.execute(selectedIds);

      // 清空选择
      this.clearSelection(context);

      // 刷新
      await options.onRefresh();

      // Toast 提示
      const message = options.successMessage
        ? options.successMessage(result.deleted, selectedIds.length)
        : `${selectedIds.length} 个项目已删除`;
      options.showToast(message, "success");
    } catch (error) {
      window.electronAPI.logError(
        "BatchToolbarMiddle.ts",
        "Failed to batch delete",
        error,
      );
      options.showToast("批量删除失败", "error");
    }
  }

  /**
   * 统一批量删除标签流程（详情/标签管理界面）
   * @param context - 工具栏上下文
   * @param options - 删除配置
   */
  async executeDeleteTags(
    context: ToolbarContext,
    options: {
      /** 获取选中标签的回调 */
      getSelectedTags: () => Set<string>;
      /** 确认对话框配置 */
      confirmConfig: IDialogTemplate;
      /** 执行删除的异步函数 */
      execute: (
        tagNames: string[],
      ) => Promise<{ success: boolean; deleted: number }>;
      /** 删除成功后的刷新回调 */
      onRefresh: () => Promise<void>;
      /** Toast 回调 */
      showToast: (message: string, type: string) => void;
      /** 成功消息模板回调 */
      successMessage?: (deleted: number, total: number) => string;
    },
  ): Promise<void> {
    const selectedTags = options.getSelectedTags();
    if (selectedTags.size === 0) return;

    // 确认对话框
    const confirmed = await DialogService.showConfirmDialogByConfig(
      options.confirmConfig,
      { count: selectedTags.size },
    );
    if (!confirmed) return;

    try {
      const result = await options.execute(Array.from(selectedTags));

      // 清空选择
      this.clearSelection(context);

      // 刷新
      await options.onRefresh();

      // Toast 提示
      const message = options.successMessage
        ? options.successMessage(result.deleted, selectedTags.size)
        : `${selectedTags.size} 个标签已删除`;
      options.showToast(message, "success");
    } catch (error) {
      window.electronAPI.logError(
        "BatchToolbarMiddle.ts",
        "Failed to batch delete tags",
        error,
      );
      options.showToast("批量删除失败", "error");
    }
  }

  /**
   * 批量添加标签
   * @param context - 工具栏上下文
   * @param ids - 项目 ID 数组
   * @param tagNames - 标签名数组
   */
  async batchAddTag(
    context: ToolbarContext,
    ids: string[],
    tagNames: string[],
  ): Promise<void> {
    const config = this.states.get(context)?.businessConfig.addTag;
    if (!config) {
      throw new Error(`未配置 ${context} 的批量添加标签业务逻辑`);
    }

    await config.processItems(ids, tagNames);
  }

  /**
   * 批量切换收藏状态（已收藏→取消，未收藏→收藏）
   * @param context - 工具栏上下文
   * @param ids - 项目 ID 数组
   */
  async batchFavorite(
    context: ToolbarContext,
    ids: string[],
  ): Promise<void> {
    const config = this.states.get(context)?.businessConfig.favorite;
    if (!config) {
      throw new Error(`未配置 ${context} 的批量收藏业务逻辑`);
    }

    await config.batchApi(ids);
  }

  /**
   * 获取工具栏配置
   * @param context - 工具栏上下文
   */
  getToolbarConfig(context: ToolbarContext): BatchToolbarConfig | undefined {
    return this.states.get(context)?.config;
  }

  /**
   * 切换工具栏显示状态
   * @param context - 工具栏上下文
   * @param count - 计数（仅在显示时使用）
   * @param onClose - 关闭时的回调函数（必需）
   */
  toggle(
    context: ToolbarContext,
    count: number = 0,
    onClose: () => void,
  ): void {
    const state = this.states.get(context);
    if (!state) return;

    if (state.visible) {
      this.hide(context);
    } else {
      this.show(context, count, onClose);
    }
  }

  /**
   * 获取工具栏状态
   * @param context - 工具栏上下文
   */
  getState(
    context: ToolbarContext,
  ):
    | { isVisible: boolean; count: number; context: ToolbarContext }
    | undefined {
    const state = this.states.get(context);
    if (!state) return undefined;

    return {
      isVisible: state.visible,
      count: state.count,
      context,
    };
  }

  /**
   * 获取工具栏上下文（验证上下文是否有效）
   * @param context - 工具栏上下文
   */
  getContext(context: ToolbarContext): ToolbarContext | undefined {
    return this.states.has(context) ? context : undefined;
  }

  /**
   * 更新工具栏按钮
   * @param context - 工具栏上下文
   * @param buttons - 按钮配置数组
   */
  updateButtons(
    context: ToolbarContext,
    buttons: import("../pyBatchToolbar/types.ts").ToolbarButtonConfig[],
  ): void {
    const state = this.states.get(context);
    if (!state) return;

    state.config.buttons = sortButtons(buttons);

    // 重新渲染工具栏按钮
    const toolbar = document.getElementById(state.config.id);
    if (!toolbar) return;

    const actionsDiv = toolbar.querySelector(
      ".batch-toolbar-actions, .batch-tag-toolbar-actions",
    );
    if (!actionsDiv) return;

    // 清空现有按钮
    actionsDiv.innerHTML = "";

    // 创建新按钮
    const sortedButtons = sortButtons(buttons);
    sortedButtons.forEach((button) => {
      if (button.visible === false) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = button.className || "batch-action-btn";
      btn.dataset.action = button.action;
      btn.textContent = button.text;

      if (button.title) {
        btn.title = button.title;
      }

      actionsDiv.appendChild(btn);
    });
  }

  // ==================== 多选状态管理 ====================

  /**
   * 获取选中的 ID 集合
   * @param context - 工具栏上下文
   */
  getSelectedIds(context: ToolbarContext): Set<string> {
    return this.states.get(context)?.selectedIds || new Set();
  }

  /**
   * 获取选中数量
   * @param context - 工具栏上下文
   */
  getSelectionCount(context: ToolbarContext): number {
    return this.states.get(context)?.selectedIds.size || 0;
  }

  /**
   * 检查是否已选中
   * @param context - 工具栏上下文
   * @param id - 项目 ID
   */
  isSelected(context: ToolbarContext, id: string): boolean {
    return this.states.get(context)?.selectedIds.has(id) || false;
  }

  /**
   * 切换选择状态
   * @param context - 工具栏上下文
   * @param id - 项目 ID
   * @param index - 项目索引
   */
  toggleSelection(context: ToolbarContext, id: string, index: number): void {
    const state = this.states.get(context);
    if (!state) return;

    if (state.selectedIds.has(id)) {
      state.selectedIds.delete(id);
      if (state.lastSelectedIndex === index) {
        state.lastSelectedIndex = undefined;
      }
    } else {
      state.selectedIds.add(id);
      state.lastSelectedIndex = index;
    }
    this.syncToolbar(context);
  }

  /**
   * 范围选择
   * @param context - 工具栏上下文
   * @param items - 项目数组
   * @param currentIndex - 当前索引
   */
  rangeSelect<T extends { id: string | number }>(
    context: ToolbarContext,
    items: T[],
    currentIndex: number,
  ): void {
    const state = this.states.get(context);
    if (!state) return;

    if (state.lastSelectedIndex === undefined) {
      state.lastSelectedIndex = currentIndex;
      const item = items[currentIndex];
      if (item) {
        state.selectedIds.add(String(item.id));
      }
    } else {
      const start = Math.min(state.lastSelectedIndex, currentIndex);
      const end = Math.max(state.lastSelectedIndex, currentIndex);

      for (let i = start; i <= end; i++) {
        const item = items[i];
        if (item) {
          state.selectedIds.add(String(item.id));
        }
      }
    }

    this.syncToolbar(context);
  }

  /**
   * 单选
   * @param context - 工具栏上下文
   * @param id - 项目 ID
   * @param index - 项目索引
   */
  singleSelect(context: ToolbarContext, id: string, index: number): void {
    const state = this.states.get(context);
    if (!state) return;

    state.selectedIds.clear();
    state.selectedIds.add(id);
    state.lastSelectedIndex = index;
    this.syncToolbar(context);
  }

  /**
   * 全选
   * @param context - 工具栏上下文
   * @param ids - 项目 ID 数组
   */
  selectAll(context: ToolbarContext, ids: string[]): void {
    const state = this.states.get(context);
    if (!state) return;

    ids.forEach((id) => state.selectedIds.add(id));
    this.syncToolbar(context);
  }

  /**
   * 反选
   * @param context - 工具栏上下文
   * @param allIds - 所有项目 ID 数组
   */
  invertSelection(context: ToolbarContext, allIds: string[]): void {
    const state = this.states.get(context);
    if (!state) return;

    const newSelection = new Set<string>();
    allIds.forEach((id) => {
      if (!state.selectedIds.has(id)) {
        newSelection.add(id);
      }
    });
    state.selectedIds = newSelection;
    this.syncToolbar(context);
  }

  /**
   * 添加选择
   * @param context - 工具栏上下文
   * @param id - 项目 ID
   */
  addSelection(context: ToolbarContext, id: string): void {
    const state = this.states.get(context);
    if (!state) return;

    state.selectedIds.add(id);
    this.syncToolbar(context);
  }

  /**
   * 添加选择和索引
   * @param context - 工具栏上下文
   * @param id - 项目 ID
   * @param index - 项目索引
   */
  addSelectionWithIndex(
    context: ToolbarContext,
    id: string,
    index: number,
  ): void {
    const state = this.states.get(context);
    if (!state) return;

    state.selectedIds.add(id);
    state.lastSelectedIndex = index;
    this.syncToolbar(context);
  }

  /**
   * 移除选择
   * @param context - 工具栏上下文
   * @param id - 项目 ID
   */
  removeSelection(context: ToolbarContext, id: string): void {
    const state = this.states.get(context);
    if (!state) return;

    state.selectedIds.delete(id);
    this.syncToolbar(context);
  }

  /**
   * 清空选择
   * @param context - 工具栏上下文
   */
  clearSelection(context: ToolbarContext): void {
    const state = this.states.get(context);
    if (!state) return;

    state.selectedIds.clear();
    state.lastSelectedIndex = undefined;
    this.syncToolbar(context);
  }

  /**
   * 切换标签选择状态
   * @param context - 工具栏上下文
   * @param tagName - 标签名称
   */
  toggleTagSelection(context: ToolbarContext, tagName: string): void {
    const state = this.states.get(context);
    if (!state) {
      return;
    }

    if (state.selectedIds.has(tagName)) {
      state.selectedIds.delete(tagName);
    } else {
      state.selectedIds.add(tagName);
    }
    this.syncToolbar(context);
  }

  /**
   * 获取选中的标签
   * @param context - 工具栏上下文
   * @returns 选中的标签集合
   */
  getSelectedTags(context: ToolbarContext): Set<string> {
    return this.getSelectedIds(context);
  }

  /**
   * 全选标签
   * @param context - 工具栏上下文
   * @param tagNames - 标签名称数组
   */
  selectAllTags(context: ToolbarContext, tagNames: string[]): void {
    const state = this.states.get(context);
    if (!state) return;

    tagNames.forEach((tag) => state.selectedIds.add(tag));
    this.syncToolbar(context);
  }

  /**
   * 反选标签
   * @param context - 工具栏上下文
   * @param allTagNames - 所有标签名称数组
   */
  invertTagSelection(context: ToolbarContext, allTagNames: string[]): void {
    const state = this.states.get(context);
    if (!state) return;

    allTagNames.forEach((tag) => {
      if (state.selectedIds.has(tag)) {
        state.selectedIds.delete(tag);
      } else {
        state.selectedIds.add(tag);
      }
    });
    this.syncToolbar(context);
  }

  /**
   * 同步工具栏 UI
   * @param context - 工具栏上下文
   */
  private syncToolbar(context: ToolbarContext): void {
    const state = this.states.get(context);
    if (!state) return;

    const count = state.selectedIds.size;

    // 只更新计数，不自动显示工具栏
    // 工具栏的显示/隐藏由外部显式控制
    if (state.visible) {
      this.updateCount(context, count);
    }

    // 触发选择状态变化回调（外部负责更新 DOM）
    if (state.onSelectionChange) {
      state.onSelectionChange();
    }
  }

  /**
   * 销毁指定上下文的工具栏
   * @param context - 工具栏上下文
   */
  private destroyContext(context: ToolbarContext): void {
    const state = this.states.get(context);
    if (!state) return;

    this.hide(context);

    // 移除 DOM 元素
    const toolbar = document.getElementById(state.config.id);
    if (toolbar) {
      toolbar.remove();
    }

    this.states.delete(context);
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.states.forEach((_, context) => this.destroyContext(context));
    this.states.clear();
  }

  // ========== DOM 操作私有方法 ==========

  /**
   * 创建工具栏 HTML 元素
   * @param context - 工具栏上下文
   * @param config - 工具栏配置
   */
  private createToolbarElement(
    context: ToolbarContext,
    config: BatchToolbarConfig,
  ): HTMLElement {
    // 先检查是否已存在
    let toolbar = document.getElementById(config.id);
    if (toolbar) {
      return toolbar;
    }

    toolbar = document.createElement("div");
    toolbar.id = config.id;
    toolbar.className = "batch-toolbar";
    toolbar.style.display = "none";

    const content = document.createElement("div");
    content.className = "batch-toolbar-content";

    // 计数显示
    const countSpan = document.createElement("span");
    countSpan.className = "batch-toolbar-count";
    countSpan.textContent = `已选择 0 个${config.label}`;
    content.appendChild(countSpan);

    // 按钮容器
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "batch-toolbar-actions";

    // 创建按钮
    const sortedButtons = sortButtons(config.buttons);
    sortedButtons.forEach((button) => {
      if (button.visible === false) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = button.className || "batch-action-btn";
      btn.dataset.action = button.action;
      btn.textContent = button.text;

      if (button.title) {
        btn.title = button.title;
      }

      actionsDiv.appendChild(btn);
    });

    content.appendChild(actionsDiv);
    toolbar.appendChild(content);

    // 插入到容器
    const container = document.querySelector(
      config.containerSelector || "body",
    );
    if (container) {
      container.appendChild(toolbar);
    } else {
      document.body.appendChild(toolbar);
    }

    return toolbar;
  }

  /**
   * 绑定工具栏事件
   * @param context - 工具栏上下文
   * @param toolbarId - 工具栏 ID
   */
  private bindToolbarEvents(context: ToolbarContext, toolbarId: string): void {
    const toolbar = document.getElementById(toolbarId);
    if (!toolbar) return;

    toolbar.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest("[data-action]") as HTMLElement;

      if (button) {
        const action = button.dataset.action;
        if (action) {
          this.handleAction(context, action);
        }
      }
    });
  }

  /**
   * 更新工具栏计数显示
   * @param context - 工具栏上下文
   * @param count - 计数
   */
  private updateToolbarCount(context: ToolbarContext, count: number): void {
    const state = this.states.get(context);
    if (!state) return;

    const toolbar = document.getElementById(state.config.id);
    if (!toolbar) return;

    const countSpan = toolbar.querySelector(".batch-toolbar-count");
    if (countSpan) {
      countSpan.textContent = `已选择 ${count} 个${state.config.label}`;
    }
  }

  /**
   * 处理按钮动作
   * @param context - 工具栏上下文
   * @param action - 动作标识
   */
  private async handleAction(
    context: ToolbarContext,
    action: string,
  ): Promise<void> {
    const state = this.states.get(context);
    if (!state) return;

    // 先调用注册的动作处理程序（如果有）
    if (state.actionHandlers.has(action)) {
      const handler = state.actionHandlers.get(action)!;
      await handler();
    }

    // 特殊处理 Cancel 动作 - 隐藏工具栏
    if (action === "Cancel") {
      this.hide(context);
      return;
    }

    // 如果没有注册处理程序且不是 Cancel，记录错误
    if (!state.actionHandlers.has(action)) {
      window.electronAPI.logError(
        "BatchToolbarMiddle",
        `No handler registered for action "${action}" in context "${context}"`,
      );
    }
  }
}

// 导出单例实例
export const batchToolbarMiddle = BatchToolbarMiddle.getInstance();

// 重新导出类型
export type {
  ToolbarContext,
  BatchToolbarConfig,
} from "../pyBatchToolbar/index.ts";
