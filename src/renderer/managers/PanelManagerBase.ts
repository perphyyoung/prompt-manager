import { HtmlUtils } from "../../utils/index.ts";
import { cacheManager } from "../../utils/CacheManager.ts";
import { TagUI } from "./TagUI.ts";
import { TopGroupManager } from "../../pyTagGroups/TopGroupManager.ts";
import { ITagWithGroup, ITagGroup } from "../../types/entities.ts";
import { IEventStrategy, EventContext } from "./Strategies/IEventStrategy.ts";
import { batchToolbarMiddle, type BatchBusinessConfig } from "../../middle/index.ts";
import { DialogService, DialogConfig } from "../services/index.ts";
import type { IDialogTemplate } from "../../types/entities.ts";
import { Constants, Events } from "../../constants.ts";
import { TagService } from "../services/index.ts";
import { buildTagsWithGroupInfo } from "../../pyTagGroups/utils.ts";
import { IApp } from "../app.types.ts";
import { localStorageManager } from "../configs/LocalStorageConfig.ts";
import { showContextMenu } from "../renderer_utils/ContextMenuUtils.ts";
import { VirtualScrollBar } from "../renderer_utils/VirtualScrollBar.ts";
import type { VisibleRange } from "../renderer_utils/VirtualScroller.ts";

/** 网格行间距（px），与 styles.css 的 .grid-view gap 保持一致 */
export const GRID_GAP = 16;

/** 分页大小：两个主面板一致 */
export const PANEL_PAGE_SIZE = 100;

// 面板管理器基类选项接口
interface PanelManagerBaseOptions {
  app: IApp;
  defaultCardSize?: number;
  onSelectionChange?: () => void;
}

// 面板项目接口（基础）
export interface IPanelItem {
  id: string;
  isDeleted?: boolean;
  isSafe?: number;
  tags?: string[];
  isFavorite?: boolean | number;
  [key: string]: unknown;
}

// 特殊标签计数接口
interface SpecialTagCount {
  tag: string;
  count: number;
}

// 删除确认配置接口
interface IDeleteConfirmConfig {
  config: unknown;
  name?: string;
}

// 复制内容结果接口
interface ICopyContentResult {
  content: string;
  hasContent: boolean;
}

// UI 配置接口 - 用于抽取重复的 UI 更新逻辑
interface IUIConfig {
  // 选择器
  cardSelector: string;
  cardBgSelector: string;

  // 容器 ID
  gridContainerId: string;

  // 拖拽相关
  dragSource: string;
  getCardDropSelector(): string;

  // 获取元素 ID（从 dataset 中提取）
  getElementId(element: HTMLElement): string | undefined;

  // 获取复制内容
  getCopyContent(item: IPanelItem): ICopyContentResult;

  // 获取删除确认配置
  getDeleteConfirmConfig(item: IPanelItem): IDeleteConfirmConfig;

  // 获取卡片背景图片路径
  getCardImagePath(item: IPanelItem): string | null;

  // 获取卡片背景图对应的 imageId（用于路径缓存命中）
  getCardImageId?(item: IPanelItem): string | null;

  // 获取本地保存位置路径（用于右键菜单）
  getOpenLocationPath(item: IPanelItem): string | null;

  // 卡片显示用的标题（原始值，基类负责转义）
  getListTitle(item: IPanelItem): string;

  // 卡片显示用的内容（原始值，基类负责转义）
  getListContent(item: IPanelItem): string;
}

/**
 * 面板管理器基类
 * 封装提示词面板和图像面板的通用逻辑
 * 使用模板方法模式，子类实现特定差异
 */
export abstract class PanelManagerBase {
  [key: string]: unknown;
  app: IApp;
  protected tagManager?: unknown;
  protected defaultCardSize: number;
  protected onSelectionChange?: () => void;

  // 通用状态
  protected filteredItems: IPanelItem[] = [];
  protected selectedTags: Set<string> = new Set();
  protected invertedFilter = false;

  // 数据指纹：记录当前已渲染项的指纹，用于增量刷新时识别变化项
  protected itemFingerprints = new Map<string, string>();

  // 视图设置（在子类构造函数中初始化）
  sortBy!: string;
  sortOrder!: string;
  cardSize!: number;
  tagFilterSortBy!: string;
  tagFilterSortOrder!: string;

  // 工具栏上下文（在 init 方法中设置）
  protected toolbarContext!: "promptMain" | "imageMain";

  // 面板类型（子类实现）
  protected abstract readonly panelType: "prompt" | "image";

  // UI 配置（子类实现）
  protected abstract getUIConfig(): IUIConfig;
  protected abstract getTagFilterToggleBtnId(): string;
  protected abstract getTagManagerBtnId(): string;

  // 存储键名（子类实现）
  protected abstract get storageKeys(): {
    sortBy: string;
    sortOrder: string;
    cardSize: string;
    tagFilterSortBy: string;
    tagFilterSortOrder: string;
    tagFilterCollapsed: string;
  };

  /**
   * 绑定标签管理器事件
   */
  protected bindTagManagerEvents(): void {
    document
      .getElementById(this.getTagManagerBtnId())
      ?.addEventListener("click", async () => await this.openTagManagerModal());
  }

  /**
   * 打开标签管理器模态框（子类实现）
   */
  protected abstract openTagManagerModal(): Promise<void>;

  /**
   * 绑定标签筛选收起/展开按钮事件
   */
  protected bindTagFilterToggleEvents(): void {
    document
      .getElementById(this.getTagFilterToggleBtnId())
      ?.addEventListener("click", () => this.toggleTagFilterState());
  }

  /**
   * @param options - 配置选项
   */
  constructor(options: PanelManagerBaseOptions) {
    if (!options.app) {
      throw new Error("PanelManagerBase requires app instance");
    }
    this.app = options.app;
    // eventBus 通过 app 访问
    this.defaultCardSize = options.defaultCardSize || 200;
    this.onSelectionChange = options.onSelectionChange;

    // 注意：storageKeys 是抽象 getter，panelType 是抽象属性
    // 需要在子类构造函数中调用 init() 方法完成初始化
  }

  /**
   * 初始化面板管理器
   * 在子类构造函数中调用，此时 panelType 和 storageKeys 已可用
   */
  protected initPanelManager(): void {
    // 设置工具栏上下文
    this.toolbarContext = this.panelType === "prompt" ? "promptMain" : "imageMain";

    // 业务配置
    const businessConfig: BatchBusinessConfig = {
      delete: {
        batchApi:
          this.panelType === "prompt"
            ? async (ids) => {
                const result = await window.electronAPI.softDeletePrompts(ids);
                return { success: result.success, deleted: result.deleted };
              }
            : async (ids) => {
                const result = await window.electronAPI.softDeleteImages(ids);
                return { success: result.success, deleted: result.deleted };
              },
        // 不再全量 clear 元数据缓存：软删除残留由 LRU 自然淘汰，
        // 面板刷新后以 filtered 数组为权威，残留条目无读取路径
      },
      addTag: {
        processItems: async (ids: string[], tagNames: string[]) => {
          const tagService = TagService.getInstance();
          const result = await tagService.batchLinkTags({
            tagNames,
            type: this.panelType,
            itemIds: ids,
          });
          if (result.errors.length > 0) {
            throw new Error(result.errors.map((e: { error: string }) => e.error).join(", "));
          }
        },
      },
      favorite: {
        batchApi:
          this.panelType === "prompt"
            ? (ids) => window.electronAPI.batchFavoritePrompts(ids).then(() => {})
            : (ids) => window.electronAPI.batchFavoriteImages(ids).then(() => {}),
      },
    };

    // 统一使用 presets.ts 中的配置
    batchToolbarMiddle.init(this.toolbarContext, businessConfig);

    // 注册选择状态变化回调
    batchToolbarMiddle.registerSelectionChangeCallback(this.toolbarContext, () => {
      this.updateSelectionModeClass();
      this.updateItemSelectionState();
      // 如果有选中项但工具栏未显示，显式进入批量模式
      if (
        batchToolbarMiddle.getSelectionCount(this.toolbarContext) > 0 &&
        !batchToolbarMiddle.isVisible(this.toolbarContext)
      ) {
        this.enterBatchMode();
      }
    });

    // 注册按钮处理器
    this.registerBatchToolbarHandlers();

    // 卡片尺寸启动收口：子类构造中直接读 localStorage，未经 clamp，
    // 越界持久值（旧版本遗留/手动修改）在此统一校正并写回
    this.setCardSize(this.cardSize);

    // 绑定事件
    this.subscribeToEvents();
  }

  /**
   * 注册批量工具栏按钮处理器
   */
  private registerBatchToolbarHandlers(): void {
    // 全选
    batchToolbarMiddle.registerActionHandler(this.toolbarContext, "SelectAll", () => {
      this.selectAllVisibleItems();
    });

    // 反选
    batchToolbarMiddle.registerActionHandler(this.toolbarContext, "Invert", () => {
      this.handleBatchInvert();
    });

    // 添加标签
    batchToolbarMiddle.registerActionHandler(this.toolbarContext, "AddTag", () => {
      this.handleBatchAddTag();
    });

    // 收藏
    batchToolbarMiddle.registerActionHandler(this.toolbarContext, "Favorite", () => {
      this.handleBatchFavorite();
    });

    // 删除
    batchToolbarMiddle.registerActionHandler(this.toolbarContext, "Delete", () => {
      this.handleBatchDelete();
    });

    // 取消
    batchToolbarMiddle.registerActionHandler(this.toolbarContext, "Cancel", () => {
      this.handleBatchCancel();
    });
  }

  /**
   * 检查当前面板是否是活动面板（可见）
   * @returns 是否是活动面板
   */
  protected isActivePanel(): boolean {
    // 通过 app.currentPanel 判断当前活动面板
    const currentPanel = this.app.currentPanel;
    if (!currentPanel) return false;

    // 根据 panelType 判断面板类型
    return currentPanel === this.panelType;
  }

  /**
   * 全选所有可见项目
   */
  selectAllVisibleItems(): void {
    const visibleItems = this.getVisibleItems();
    const ids = visibleItems.map((item: IPanelItem) => String(item.id));
    batchToolbarMiddle.selectAll(this.toolbarContext, ids);
    // 仅更新选中状态 UI，避免 renderView 触发 loadData 重置分页（只保留第一页）
    this.updateSelectionUI();
  }

  /**
   * 获取项目列表（子类实现）
   * @abstract
   * @returns 项目列表
   */
  abstract getItems(): IPanelItem[];

  /**
   * 获取可见项目列表（筛选后）
   * @returns 筛选后的可见项目列表
   */
  getVisibleItems(): IPanelItem[] {
    return this.filteredItems || [];
  }

  /**
   * 获取搜索查询（子类实现）
   * @abstract
   * @returns 搜索查询字符串
   */
  getSearchQuery(): string {
    return ""; // 默认返回空字符串，表示不搜索
  }

  /**
   * 获取特殊标签检查函数 Map（子类实现）
   * @abstract
   * @returns 特殊标签检查函数 Map
   */
  abstract getSpecialTagChecks(): Map<string, (item: IPanelItem) => boolean>;

  /**
   * 获取项目类型标识（子类实现）
   * @abstract
   * @returns 项目类型
   */
  abstract getItemType(): "prompt" | "image";

  /**
   * 加载数据（抽象方法, 必须子类实现）
   * @abstract
   * @returns 项目列表
   */
  abstract loadData(): Promise<IPanelItem[]>;

  /**
   * 创建卡片 HTML（子类实现）
   * @abstract
   * @param item - 项目对象
   * @returns HTML 字符串
   */
  abstract createCard(item: IPanelItem): string;

  /**
   * 计算项的数据指纹（子类实现，覆盖该面板影响 UI 展示的字段）
   * 用于增量刷新时识别数据变化项，新增字段自动纳入
   * @abstract
   * @param item - 项目对象
   * @returns 指纹字符串
   */
  protected abstract getItemFingerprint(item: IPanelItem): string;

  /**
   * 渲染单个项的 HTML（子类实现，生成网格卡片）
   * @abstract
   * @param item - 项目对象
   * @param index - 排序索引（需保持与旧元素一致）
   * @param isSelected - 是否处于选中状态
   * @returns HTML 字符串
   */
  protected abstract renderSingleItemHtml(
    item: IPanelItem,
    index: number,
    isSelected: boolean,
  ): string;

  /**
   * 加载变化项的缩略图/背景图（子类实现）
   * 替换 DOM 后需重新加载图片，旧元素上的背景/缩略图随替换一并移除
   * @abstract
   * @param items - 已重建的变化项
   */
  protected abstract loadItemImagesForChanged(items: IPanelItem[]): Promise<void>;

  /**
   * 指纹 diff：对数据变化的项执行单元素重建
   * 替换 DOM 后加载缩略图/背景图并重绑事件，其余项零开销
   * 事件委托（点击/多选/拖拽）自动生效，无需重绑
   * @param items - 更新后的项目列表
   */
  protected async rebuildChangedItems(items: IPanelItem[]): Promise<void> {
    const container = this.getCurrentContainer();
    if (!container) return;

    const changed: IPanelItem[] = [];

    for (const item of items) {
      const id = String(item.id);
      const newFingerprint = this.getItemFingerprint(item);
      const oldFingerprint = this.itemFingerprints.get(id);

      if (oldFingerprint === newFingerprint) continue;

      const oldEl = container.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
      if (!oldEl) continue;

      // 从旧元素获取索引，保证重建后 data-index 一致
      const index = parseInt(oldEl.dataset.index || "0", 10);
      const isSelected = batchToolbarMiddle.isSelected(this.toolbarContext, id);

      // 生成新 HTML 并替换
      const newHtml = this.renderSingleItemHtml(item, index, isSelected);
      const template = document.createElement("template");
      template.innerHTML = newHtml.trim();
      const newEl = template.content.firstChild as HTMLElement | null;
      if (!newEl) continue;

      oldEl.replaceWith(newEl);
      changed.push(item);
      this.itemFingerprints.set(id, newFingerprint);
    }

    if (changed.length === 0) return;

    // 加载缩略图/背景图（子类实现）
    await this.loadItemImagesForChanged(changed);

    // 重绑按钮事件与 hover 预览（逐元素绑定，重建后需重新绑定）
    const config = this.getUIConfig();
    this.bindCardButtonEvents(changed);
    this.bindHoverPreview(config.cardSelector);
  }

  /**
   * 绑定卡片按钮事件（通用实现）
   * @param filtered - 筛选后的项目列表
   */
  bindCardButtonEvents(filtered: IPanelItem[]): void {
    const config = this.getUIConfig();
    const container = document.getElementById(config.gridContainerId);
    if (!container) return;

    filtered.forEach((item) => {
      const card = container.querySelector(`[data-id="${item.id}"]`);
      if (!card) return;

      // 删除按钮
      const deleteBtn = card.querySelector(".delete-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const { config: dialogConfig, name } = config.getDeleteConfirmConfig(item);
          const confirmed = await DialogService.showConfirmDialogByConfig(
            dialogConfig as IDialogTemplate,
            name ? { name } : undefined,
          );
          if (confirmed) {
            await this.deleteItem(String(item.id));
          }
        });
      }

      // 收藏按钮
      const favoriteBtn = card.querySelector(".favorite-btn");
      if (favoriteBtn) {
        favoriteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await this.toggleFavorite(String(item.id), !item.isFavorite);
        });
      }

      // 复制按钮
      const copyBtn = card.querySelector(".copy-btn");
      if (copyBtn) {
        copyBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const { content, hasContent } = config.getCopyContent(item);
          if (!hasContent) {
            this.app.showToast?.("没有可复制的内容", "warning");
            return;
          }
          try {
            await window.electronAPI.copyToClipboard(content);
            this.app.showToast?.("已复制到剪贴板", "success");
          } catch (error) {
            window.electronAPI.logError(
              "PanelManagerBase.ts",
              "Failed to copy to clipboard",
              error,
            );
            this.app.showToast?.("复制失败", "error");
          }
        });
      }
    });
  }

  /**
   * 绑定右键菜单事件（事件委托）
   * 覆盖卡片视图
   * @private
   */
  protected bindContextMenuEvents(): void {
    const config = this.getUIConfig();
    const itemSelectors = [config.cardSelector].join(", ");

    const container = document.getElementById(config.gridContainerId);
    if (!container || container.dataset.contextMenuBound === "true") return;

    container.dataset.contextMenuBound = "true";
    container.addEventListener("contextmenu", (e) => {
      const itemEl = (e.target as HTMLElement).closest(itemSelectors) as HTMLElement | null;
      if (!itemEl) return;

      const id = config.getElementId(itemEl);
      if (!id) return;

      const item = this.filteredItems.find((i) => String(i.id) === id);
      if (!item) return;

      const path = config.getOpenLocationPath(item);
      if (!path) {
        this.app.showToast?.("没有可打开的本地保存位置", "warning");
        return;
      }

      e.preventDefault();
      showContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            id: "openLocation",
            label: Constants.CONTEXT_MENU_OPEN_LOCATION,
            onClick: () => {
              window.electronAPI.openImageLocation(path).catch((error: unknown) => {
                window.electronAPI.logError(
                  "PanelManagerBase.ts",
                  "Failed to open image location",
                  error,
                );
              });
            },
          },
        ],
      });
    });
  }

  /**
   * 绑定悬停预览（子类实现）
   * @abstract
   * @param selector - CSS 选择器
   */
  abstract bindHoverPreview(selector: string): void;

  /**
   * 绑定卡片拖拽事件（通用实现）
   * @param container - 容器元素
   */
  bindCardDropEvents(container: HTMLElement): void {
    const config = this.getUIConfig();

    // 避免重复绑定
    if (container.dataset.dropEventsBound === "true") {
      return;
    }
    container.dataset.dropEventsBound = "true";

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      (e as DragEvent).dataTransfer!.dropEffect = "copy";
    });

    container.addEventListener("drop", async (e) => {
      e.preventDefault();
      const dragSource = (e as DragEvent).dataTransfer!.getData("drag-source");
      const tagName = (e as DragEvent).dataTransfer!.getData("text/plain");

      if (dragSource === config.dragSource && tagName) {
        const card = (e.target as Element).closest(config.getCardDropSelector());
        if (card) {
          const id = config.getElementId(card as HTMLElement);
          if (id) {
            try {
              await this.handleTagDrop(id, tagName);
              this.app.showToast?.("标签已添加", "success");
            } catch (error) {
              this.app.showToast?.((error as Error).message, "error");
            }
          }
        }
      }
    });
  }

  /**
   * 获取标签筛选容器 ID（子类实现）
   * @abstract
   * @returns 容器 ID
   */
  abstract getTagFilterContainerId(): string;

  /**
   * 获取特殊标签容器 ID（子类实现）
   * @abstract
   * @returns 容器 ID
   */
  abstract getSpecialTagsContainerId(): string;

  /**
   * 获取筛选动作按钮 ID（实现基类抽象方法）
   * @returns 按钮 ID
   */
  abstract getFilterActionBtnId(): string;

  /**
   * 获取标签筛选头部容器 ID（子类实现）
   * @abstract
   * @returns 容器 ID
   */
  abstract getTagFilterHeaderContainerId(): string;

  /**
   * 获取标签筛选排序选择器 ID（子类实现）
   * @abstract
   * @returns 选择器 ID
   */
  abstract getTagFilterSortSelectId(): string;

  /**
   * 获取标签筛选排序顺序按钮 ID（子类实现）
   * @abstract
   * @returns 按钮 ID
   */
  abstract getTagFilterOrderBtnId(): string;

  /**
   * 获取标签拖拽类型（子类实现）
   * @abstract
   * @returns 拖拽类型
   */
  abstract getTagDragType(): string;

  /**
   * 获取所有标签（子类实现）
   * @abstract
   * @returns 标签列表
   */
  abstract getAllTags(): Promise<string[]>;

  /**
   * 计算特殊标签计数（子类实现）
   * @abstract
   * @param visibleItems - 可见项目列表
   * @returns 特殊标签计数列表
   */
  abstract calculateSpecialTagCounts(visibleItems: IPanelItem[]): SpecialTagCount[];

  /**
   * 删除项目（子类实现）
   * @abstract
   * @param id - 项目 ID
   */
  abstract deleteItem(id: string): Promise<void>;

  /**
   * 切换收藏状态（子类实现）
   * @abstract
   * @param id - 项目 ID
   * @param isFavorite - 是否收藏
   */
  abstract toggleFavorite(id: string, isFavorite: boolean): Promise<void>;

  /**
   * 更新收藏按钮 UI（通用实现）
   * @param id - 项目 ID
   * @param isFavorite - 是否收藏
   */
  updateFavoriteUI(id: string, isFavorite: boolean): void {
    const config = this.getUIConfig();

    const updateBtn = (btn: Element | null) => {
      if (!btn) return;
      if (isFavorite) {
        btn.classList.add("active");
        (btn as HTMLElement).title = "取消收藏";
        btn.innerHTML = Constants.ICONS.favorite.filled;
      } else {
        btn.classList.remove("active");
        (btn as HTMLElement).title = "收藏";
        btn.innerHTML = Constants.ICONS.favorite.outline;
      }
    };

    // 更新网格视图
    const card = document.querySelector(`${config.cardSelector}[data-id="${id}"]`);
    if (card) {
      const btn = card.querySelector(".favorite-btn");
      updateBtn(btn);
      card.classList.toggle("is-favorite", isFavorite);
    }
  }

  /**
   * 订阅事件（子类可选实现）
   */
  subscribeToEvents(): void {
    // 子类可选实现
  }

  /**
   * 初始化（只加载数据，不渲染视图）
   */
  async init(): Promise<void> {
    await this.loadData();
  }

  /**
   * 渲染视图和标签筛选器
   */
  async ensureRendered(): Promise<void> {
    await this.renderView();
    await this.renderTagFilters();
  }

  /**
   * 恢复标签筛选区展开/收起状态
   */
  restoreTagFilterState(): void {
    const collapsed = localStorageManager.get<boolean>(this.getTagFilterStorageKey());
    if (collapsed) {
      const section = document.getElementById(this.getTagFilterSectionId());
      section?.classList.add("collapsed");
    }
  }

  /**
   * 切换标签筛选区展开/收起状态
   */
  async toggleTagFilterState(): Promise<void> {
    const section = document.getElementById(this.getTagFilterSectionId());
    if (section) {
      section.classList.toggle("collapsed");
      const collapsed = section.classList.contains("collapsed");
      localStorageManager.set(this.getTagFilterStorageKey(), collapsed);
    }
    await this.renderTagFilters();
  }

  /**
   * 获取标签筛选区 section ID
   */
  private getTagFilterSectionId(): string {
    return this.panelType === "prompt"
      ? Constants.Ids.PROMPT_TAG_FILTER_SECTION
      : Constants.Ids.IMAGE_TAG_FILTER_SECTION;
  }

  /**
   * 获取标签筛选区收起状态的 storage key
   * 使用子类定义的 storageKeys
   */
  private getTagFilterStorageKey(): string {
    return this.storageKeys.tagFilterCollapsed;
  }

  // ==================== 滚动条 / 滚动事件 / 分页追赶（两主面板共通） ====================
  // 差异点经抽象钩子注入：容器 ID、数据量、加载能力与窗口刷新入口。

  protected scrollBar: VirtualScrollBar | null = null;
  protected scrollBarResizeObserver: ResizeObserver | null = null;
  private scrollHandler: (() => void) | null = null;

  /** 网格滚动容器 ID（钩子） */
  protected abstract getGridContainerId(): string;
  /** 自定义滚动条挂载点 ID（钩子） */
  protected abstract getScrollBarMountId(): string;
  /** 当前已加载数据量（钩子） */
  protected abstract getLoadedCount(): number;
  /** 数据库命中的总项数（钩子） */
  protected abstract getQueryTotalCount(): number;
  /** 是否允许继续分页追赶（钩子：!isLoading && hasMore） */
  protected abstract canLoadMore(): boolean;
  /** 触发下一页加载（钩子） */
  protected abstract requestMore(): void;
  /** 刷新虚拟窗口（钩子，转发 windowRenderer.refresh） */
  protected abstract refreshWindow(force?: boolean): void;
  /** 当前窗口原始区间（钩子，未钳制） */
  protected abstract getWindowVisibleRange(): VisibleRange | null;

  /** 行高 = 卡片尺寸 + 行间距 */
  protected getRowHeight(): number {
    return this.cardSize + GRID_GAP;
  }

  /** 每行列数：容器可用宽度内能放下多少个 (卡片 + 间距) */
  protected getWindowColumns(): number {
    const container = document.getElementById(this.getGridContainerId());
    if (!container) return 1;
    const usableWidth = container.clientWidth - 8; // padding-right: 8px
    return Math.max(1, Math.floor((usableWidth + GRID_GAP) / this.getRowHeight()));
  }

  /** 一屏可视行数 */
  private getViewportRows(): number {
    const container = document.getElementById(this.getGridContainerId());
    if (!container) return 1;
    return Math.max(1, Math.ceil(container.clientHeight / this.getRowHeight()));
  }

  /** 一屏项数（列数 × 可视行数） */
  private getPageSizeItems(): number {
    return Math.max(1, this.getWindowColumns() * this.getViewportRows());
  }

  /**
   * 初始化右侧自定义滚动条（替代原生滚动条与跳转按钮）
   */
  protected initScrollBar(): void {
    const mount = document.getElementById(this.getScrollBarMountId());
    if (!mount) return;

    this.scrollBar?.destroy();
    this.scrollBar = new VirtualScrollBar({
      mount,
      getTotal: () => this.getQueryTotalCount(),
      getPageSize: () => this.getWindowColumns() * Math.max(1, this.getViewportRows()),
      onSeek: (startIndex) => {
        const container = document.getElementById(this.getGridContainerId());
        if (!container) return;
        const maxOffset = Math.max(1, this.getQueryTotalCount() - this.getPageSizeItems());
        const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
        container.scrollTop = (startIndex / maxOffset) * maxScrollTop;
        // 瞬时赋值可能不触发 scroll 事件，主动同步窗口
        this.refreshWindow();
      },
    });
    this.syncScrollBarLayout();

    // 网格尺寸变化（窗口缩放、标签筛选折叠）时重新对齐滚动条并刷新 thumb
    this.scrollBarResizeObserver?.disconnect();
    this.scrollBarResizeObserver = new ResizeObserver(() => {
      this.syncScrollBarLayout();
      this.scrollBar?.update();
    });
    const grid = document.getElementById(this.getGridContainerId());
    if (grid) this.scrollBarResizeObserver.observe(grid);
  }

  /**
   * 将滚动条与网格容器的可视区域实时对齐（位置与高度）
   */
  private syncScrollBarLayout(): void {
    const grid = document.getElementById(this.getGridContainerId());
    const bar = document.getElementById(this.getScrollBarMountId());
    if (!grid || !bar) return;
    const rect = grid.getBoundingClientRect();
    bar.style.top = `${rect.top}px`;
    bar.style.height = `${rect.height}px`;
  }

  /** 处理滚动事件：刷新可见窗口 + 分页追赶兜底 + 反向同步 thumb */
  private handleScroll(): void {
    const container = document.getElementById(this.getGridContainerId());
    if (!container) return;

    // 刷新可见窗口（rAF 合帧）；窗口落位后的数据补齐由 ensureWindowData 兜底
    this.refreshWindow();
    this.ensureWindowData();

    // 反向同步自定义滚动条 thumb
    if (this.scrollBar) {
      const maxScrollTop = Math.max(1, container.scrollHeight - container.clientHeight);
      const ratio = Math.min(1, Math.max(0, container.scrollTop / maxScrollTop));
      const maxOffset = Math.max(1, this.getQueryTotalCount() - this.getPageSizeItems());
      this.scrollBar.setStartIndex(Math.round(ratio * maxOffset));
    }
  }

  /** 绑定滚动事件（rAF 合帧） */
  protected bindScrollEvents(): void {
    this.unbindScrollEvents();

    let ticking = false;
    this.scrollHandler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        this.handleScroll();
      });
    };

    document
      .getElementById(this.getGridContainerId())
      ?.addEventListener("scroll", this.scrollHandler);
  }

  /** 解绑滚动事件 */
  protected unbindScrollEvents(): void {
    if (!this.scrollHandler) return;
    document
      .getElementById(this.getGridContainerId())
      ?.removeEventListener("scroll", this.scrollHandler);
    this.scrollHandler = null;
  }

  /**
   * 窗口落位后确保数据覆盖：窗口尾部接近已加载数据边界时触发分页追赶。
   * 在窗口渲染尾部调用（而非仅 scroll 判断），保证使用真实落位后的新窗口，
   * 避免进度条跳底等场景下因旧窗口判断失误导致底部数据永不补齐。
   */
  protected ensureWindowData(): void {
    if (!this.canLoadMore()) return;
    const range = this.getWindowVisibleRange();
    if (!range || range.end === 0) return;
    if (range.end >= this.getLoadedCount() - Math.floor(PANEL_PAGE_SIZE / 2)) {
      this.requestMore();
    }
  }

  // ==================== 抽象渲染契约 ====================

  /**
   * 渲染主列表（子类完整实现：数据库分页查询 + 虚拟窗口渲染）
   * @abstract
   */
  abstract renderView(): Promise<void>;

  /**
   * 渲染容器后的通用后续处理
   * @param filtered - 筛选后的项目列表
   */
  protected async afterRenderContainer(_filtered: IPanelItem[]): Promise<void> {
    // 绑定右键菜单事件（事件委托，只绑定一次）
    this.bindContextMenuEvents();

    // 设置卡片大小 CSS 变量
    this.applyCardSize();

    // 更新选择模式类
    this.updateSelectionModeClass();

    // 更新卡片的选中状态（视图切换后需要重新应用）
    this.updateItemSelectionState();
  }

  /**
   * 渲染容器（子类实现具体的容器渲染）
   * @abstract
   * @param filtered - 筛选后的项目列表
   */
  abstract renderContainer(filtered: IPanelItem[]): Promise<void>;

  /**
   * 渲染标签筛选器（模板方法）
   */
  async renderTagFilters(): Promise<void> {
    try {
      const container = document.getElementById(this.getTagFilterContainerId());
      const specialTagsContainer = document.getElementById(this.getSpecialTagsContainerId());
      const actionBtn = document.getElementById(this.getFilterActionBtnId());

      // 更新筛选动作按钮状态
      if (actionBtn) {
        const hasFilters = this.selectedTags.size > 0;
        actionBtn.textContent = hasFilters ? "清除筛选" : "标签筛选";
        actionBtn.classList.toggle("has-filters", hasFilters);
      }

      // 更新反选按钮状态
      this.updateInvertedFilterUI();

      // 获取所有标签和标签组
      const tags = await this.getAllTags();
      const tagService = TagService.getInstance();
      const groups = await tagService.getTagGroups(this.getItemType());

      // 计算标签计数
      const tagCounts = this.calculateTagCounts(tags);

      // 获取可见项目
      const visibleItems = this.getItems().filter(
        (item: IPanelItem) =>
          !item.isDeleted && (this.app.safeMode !== "safe" || item.isSafe !== 0),
      );

      // 计算特殊标签计数
      const specialTags = this.calculateSpecialTagCounts(visibleItems);

      // 构建标签与组的映射
      const tagsWithGroup = buildTagsWithGroupInfo(tags, groups);

      // 对标签进行排序
      const sortedTagsWithGroup = this.sortTagsForFilter(tagsWithGroup, tagCounts);

      // 渲染特殊标签
      if (specialTagsContainer) {
        await this.renderSpecialTags(specialTagsContainer, specialTags);
      }

      // 渲染普通标签
      await this.renderNormalTags(container, sortedTagsWithGroup, tagCounts, groups);

      // 更新头部标签
      await this.updateTagFilterHeader(specialTags, groups, sortedTagsWithGroup, tagCounts);

      // 绑定事件
      this.bindTagFilterEvents();
    } catch (error) {
      (
        window as {
          electronAPI?: { logError?: (context: string, message: string, data?: unknown) => void };
        }
      ).electronAPI?.logError?.(
        "PanelManagerBase.ts",
        `Failed to render ${this.getItemType()} tag filters:`,
        error,
      );
    }
  }

  /**
   * 计算可见项目的标签计数（考虑 safeMode 和 isDeleted）
   * 用于特殊标签筛选器显示
   * @param _tags - 所有标签（为兼容接口保留，实际使用 visibleItems 计算）
   * @returns 标签计数对象
   */
  calculateTagCounts(_tags: string[]): Record<string, number> {
    const visibleItems = this.getItems().filter(
      (item: IPanelItem) => !item.isDeleted && (this.app.safeMode !== "safe" || item.isSafe !== 0),
    );
    return TagService.countTagsInItems(visibleItems);
  }

  /**
   * 渲染特殊标签
   * @param container - 容器元素
   * @param specialTags - 特殊标签列表
   */
  async renderSpecialTags(container: HTMLElement, specialTags: SpecialTagCount[]): Promise<void> {
    const specialTagsHtml = specialTags
      .map(({ tag, count }) => {
        const isActive = this.selectedTags.has(tag);
        return `
        <button class="tag-filter-item ${isActive ? "active" : ""}" data-tag="${HtmlUtils.escapeHtml(tag)}" data-is-special="true">
          <span class="tag-name">${HtmlUtils.escapeHtml(tag)}</span>
          <span class="tag-badge">${count}</span>
        </button>
      `;
      })
      .join("");

    container.innerHTML = specialTagsHtml || '<span class="tag-filter-empty">暂无特殊标签</span>';
  }

  /**
   * 渲染普通标签
   * @param container - 容器元素
   * @param sortedTagsWithGroup - 排序后的标签列表
   * @param tagCounts - 标签计数
   * @param groups - 标签组
   */
  async renderNormalTags(
    container: HTMLElement | null,
    sortedTagsWithGroup: ITagWithGroup[],
    tagCounts: Record<string, number>,
    groups: ITagGroup[],
  ): Promise<void> {
    const html = TagUI.renderExpandedFilter(sortedTagsWithGroup, tagCounts, {
      specialTags: [],
      selectedTags: this.selectedTags,
      groups: groups,
      isImage: this.getItemType() === "image",
    });

    if (container) {
      container.innerHTML = html || '<span class="tag-filter-empty">暂无标签</span>';
    }
  }

  /**
   * 排序标签（用于标签筛选器）
   * @param tags - 标签数组
   * @param tagCounts - 标签计数对象
   * @returns 排序后的标签数组
   */
  sortTagsForFilter(tags: ITagWithGroup[], tagCounts: Record<string, number>): ITagWithGroup[] {
    return TopGroupManager.sortTagsWithGroupPriority(tags, tagCounts, {
      sortBy: this.tagFilterSortBy as "name" | "count",
      sortOrder: this.tagFilterSortOrder as "asc" | "desc",
    });
  }

  /**
   * 绑定标签筛选器事件
   */
  bindTagFilterEvents(): void {
    const container = document.getElementById(this.getTagFilterContainerId());
    const specialTagsContainer = document.getElementById(this.getSpecialTagsContainerId());
    if (!container && !specialTagsContainer) return;

    // 特殊标签点击
    if (specialTagsContainer) {
      specialTagsContainer
        .querySelectorAll('.tag-filter-item[data-is-special="true"]')
        .forEach((item: Element) => {
          item.addEventListener("click", (e: Event) => {
            // 重新点击标签：退出反选模式，恢复一致
            this.exitInvertedFilter();
            const tag = (item as HTMLElement).dataset.tag ?? "";
            const isCtrlPressed = (e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey;
            this.handleTagToggle(tag, isCtrlPressed);
            this.afterTagFilterChange();
          });
        });
    }

    // 普通标签点击和拖拽
    if (container) {
      // 使用 WeakSet 来跟踪正在拖拽的元素
      const draggingItems = new WeakSet<HTMLElement>();

      // 先绑定点击事件
      container
        .querySelectorAll('.tag-filter-item:not([data-is-special="true"])')
        .forEach((item: Element) => {
          item.addEventListener("click", async (e: Event) => {
            // 如果正在拖拽，不触发点击
            if (draggingItems.has(item as HTMLElement)) {
              draggingItems.delete(item as HTMLElement);
              return;
            }
            e.stopPropagation();
            const tag = (item as HTMLElement).dataset.tag ?? "";

            // 重新点击标签：退出反选模式，恢复一致
            this.exitInvertedFilter();
            const isCtrlPressed = (e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey;
            this.handleTagToggle(tag, isCtrlPressed);
            this.afterTagFilterChange();
          });
        });

      // 绑定标签拖拽事件
      const draggableItems = container.querySelectorAll('.tag-filter-item[draggable="true"]');
      draggableItems.forEach((item: Element) => {
        item.addEventListener("dragstart", (e: Event) => {
          // 标记为正在拖拽
          draggingItems.add(item as HTMLElement);
          const dragEvent = e as DragEvent;
          const tag = (item as HTMLElement).dataset.tag;
          if (tag) {
            dragEvent.dataTransfer?.setData("text/plain", tag);
            dragEvent.dataTransfer?.setData("drag-source", this.getTagDragType());
          }
          if (dragEvent.dataTransfer) {
            dragEvent.dataTransfer.effectAllowed = "copy";
          }
          item.classList.add("dragging");
        });

        item.addEventListener("dragend", () => {
          item.classList.remove("dragging");
          // 注意：不在 dragend 中删除 draggingItems，因为 click 事件会在 dragend 之后触发
        });
      });
    }

    // 绑定标签筛选排序选择器事件（防止重复绑定）
    const sortSelect = document.getElementById(
      this.getTagFilterSortSelectId(),
    ) as HTMLSelectElement | null;
    if (sortSelect) {
      // 同步 localStorage 中保存的排序状态到 UI
      sortSelect.value = `${this.tagFilterSortBy}-${this.tagFilterSortOrder}`;
    }
    if (sortSelect && !sortSelect.hasAttribute("data-event-bound")) {
      sortSelect.setAttribute("data-event-bound", "true");
      sortSelect.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLSelectElement;
        const [sortBy, sortOrder] = target.value.split("-");
        this.tagFilterSortBy = sortBy;
        this.tagFilterSortOrder = sortOrder as "asc" | "desc";
        localStorageManager.set(this.storageKeys.tagFilterSortBy, sortBy);
        localStorageManager.set(this.storageKeys.tagFilterSortOrder, sortOrder);
        this.renderTagFilters();
      });
    }

    // 绑定标签筛选排序顺序按钮事件（防止重复绑定）
    const orderBtn = document.getElementById(this.getTagFilterOrderBtnId());
    if (orderBtn && !orderBtn.hasAttribute("data-event-bound")) {
      orderBtn.setAttribute("data-event-bound", "true");
      orderBtn.addEventListener("click", () => {
        const newOrder = this.tagFilterSortOrder === "asc" ? "desc" : "asc";
        this.tagFilterSortOrder = newOrder;
        localStorageManager.set(this.storageKeys.tagFilterSortOrder, newOrder);
        if (sortSelect) {
          sortSelect.value = `${this.tagFilterSortBy}-${newOrder}`;
        }
        this.renderTagFilters();
      });
    }

    // 绑定反选按钮事件
    const invertBtn = document.getElementById(this.getInvertedFilterBtnId());
    if (invertBtn && !invertBtn.hasAttribute("data-event-bound")) {
      invertBtn.setAttribute("data-event-bound", "true");
      invertBtn.addEventListener("click", () => this.toggleInvertedFilter());
    }
  }

  /**
   * 更新标签筛选区域头部标签（收起时显示）
   * @param specialTags - 特殊标签列表
   * @param groups - 标签组列表
   * @param sortedTagsWithGroup - 排序后的标签列表
   * @param tagCounts - 标签计数对象
   */
  async updateTagFilterHeader(
    specialTags: SpecialTagCount[],
    groups: ITagGroup[],
    sortedTagsWithGroup: ITagWithGroup[],
    tagCounts: Record<string, number>,
  ): Promise<void> {
    // 使用 CacheManager 缓存 tagsWithGroup 供 renderCollapsedFilter 使用
    const cacheKey = `${this.panelType}TagsWithGroup`;
    cacheManager.createCache(cacheKey, 10).set("current", sortedTagsWithGroup);

    TagUI.renderCollapsedFilter({
      containerId: this.getTagFilterHeaderContainerId(),
      specialTags,
      groups,
      sortedTagsWithGroup,
      tagCounts,
      selectedTags: this.selectedTags,
      dragType: this.getTagDragType(),
      onTagClick: (tag: string, event: MouseEvent) => {
        // 重新点击标签：退出反选模式，恢复一致
        this.exitInvertedFilter();
        const isCtrlPressed = event && (event.ctrlKey || event.metaKey);
        this.handleTagToggle(tag, isCtrlPressed);
        this.afterTagFilterChange();
      },
    });
  }

  /**
   * 清除标签筛选
   */
  clearTagFilter(): void {
    this.selectedTags.clear();
    this.invertedFilter = false;
    this.renderView();
    this.renderTagFilters();
  }

  /**
   * 处理标签选中/取消选中
   * @param tag - 标签名
   * @param isCtrlPressed - 是否按住 Ctrl/Cmd 键
   * @returns 是否发生了状态变化
   */
  private handleTagToggle(tag: string, isCtrlPressed: boolean): boolean {
    if (!tag) return false;
    const isSelected = this.selectedTags.has(tag);
    if (isCtrlPressed) {
      // Ctrl/Cmd+ 点击：多选模式
      if (isSelected) {
        this.selectedTags.delete(tag);
      } else {
        this.selectedTags.add(tag);
      }
    } else {
      // 普通点击：单选模式
      if (isSelected) {
        this.selectedTags.delete(tag);
      } else {
        // 先清除所有已选标签，再添加当前标签
        this.selectedTags.clear();
        this.selectedTags.add(tag);
      }
    }
    return this.selectedTags.has(tag) !== isSelected;
  }

  /**
   * 标签筛选改变后的统一处理
   */
  private afterTagFilterChange(): void {
    this.exitBatchMode();
    this.renderView();
    this.renderTagFilters();
  }

  /**
   * 切换反选筛选模式
   */
  toggleInvertedFilter(): void {
    if (this.selectedTags.size === 0) return;
    this.invertedFilter = !this.invertedFilter;
    this.renderView();
    this.updateInvertedFilterUI();
  }

  /**
   * 退出反选模式
   */
  exitInvertedFilter(): void {
    if (!this.invertedFilter) return;
    this.invertedFilter = false;
    this.renderView();
    this.updateInvertedFilterUI();
  }

  /**
   * 更新反选按钮 UI
   */
  updateInvertedFilterUI(): void {
    const invertBtn = document.getElementById(this.getInvertedFilterBtnId());
    if (invertBtn) {
      invertBtn.classList.toggle("active", this.invertedFilter);
      invertBtn.textContent = this.invertedFilter ? "正选" : "反选";
    }
  }

  /**
   * 获取反选按钮 ID（子类实现）
   */
  protected abstract getInvertedFilterBtnId(): string;

  /**
   * 处理筛选动作按钮点击
   */
  handleFilterAction(): void {
    if (this.selectedTags.size > 0) {
      this.clearTagFilter();
    }
    // 如果没有筛选标签，按钮无操作（仅显示文字）
  }

  /**
   * 设置排序方式
   * @param sortBy - 排序字段
   * @param sortOrder - 排序顺序
   */
  setSort(sortBy: string, sortOrder: string): void {
    this.sortBy = sortBy;
    this.sortOrder = sortOrder;
    localStorageManager.set(this.storageKeys.sortBy, sortBy);
    localStorageManager.set(this.storageKeys.sortOrder, sortOrder);
    this.renderView();
  }

  /**
   * 设置卡片大小
   * @param size - 卡片大小
   */
  setCardSize(size: number): void {
    // 校验范围
    const clampedSize = Math.max(Constants.CardSize.MIN, Math.min(Constants.CardSize.MAX, size));
    this.cardSize = clampedSize;
    localStorageManager.set(this.storageKeys.cardSize, clampedSize);

    // 更新 CSS 变量
    this.applyCardSize();
  }

  /**
   * 应用卡片大小到 CSS 变量
   */
  private applyCardSize(): void {
    const config = this.getUIConfig();
    const container = document.getElementById(config.gridContainerId);
    if (container) {
      container.style.setProperty("--card-size", `${this.cardSize}px`);
    }
  }

  /**
   * 进入批量模式
   */
  enterBatchMode(): void {
    batchToolbarMiddle.show(
      this.toolbarContext,
      batchToolbarMiddle.getSelectionCount(this.toolbarContext),
      () => this.exitBatchMode(),
    );
  }

  /**
   * 退出批量模式
   */
  exitBatchMode(): void {
    batchToolbarMiddle.hide(this.toolbarContext);
    batchToolbarMiddle.clearSelection(this.toolbarContext);
    this.updateSelectionModeClass();
    this.clearAllItemSelectionState();
  }

  /**
   * 清除所有卡片的选中状态
   * 在退出批量模式时调用，确保复选框和选中样式被清除
   */
  protected clearAllItemSelectionState(): void {
    // 根据当前面板类型获取选择器
    const isImagePanel = this.panelType === "image";
    const cardSelector = isImagePanel ? ".image-card" : ".prompt-card";

    // 清除网格视图中的卡片选中状态
    document.querySelectorAll(cardSelector).forEach((card) => {
      card.classList.remove("is-selected");
      const checkbox = card.querySelector(".card-checkbox") as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = false;
      }
    });
  }

  /**
   * 数据更新后的统一刷新
   * 加载最新数据、重新渲染界面、更新标签筛选区
   */
  async refreshAfterUpdate(): Promise<void> {
    await this.loadData();
    await this.renderView();
    await this.renderTagFilters();
  }

  /**
   * 刷新面板
   * 重新加载数据并渲染视图
   */
  async refresh(): Promise<void> {
    await this.loadData();
    await this.renderView();
  }

  /**
   * 更新选择模式类
   * 根据是否有选中项在容器上添加/移除 selection-mode 类
   */
  protected updateSelectionModeClass(): void {
    const containerIds = [Constants.Ids.IMAGE_GRID, Constants.Ids.PROMPT_GRID];

    containerIds.forEach((id) => {
      const container = document.getElementById(id);
      if (container) {
        container.classList.toggle(
          "selection-mode",
          batchToolbarMiddle.getSelectionCount(this.toolbarContext) > 0,
        );
      }
    });
  }

  /**
   * 更新卡片的选中状态
   * 在视图切换或重新渲染后调用，确保选中状态正确显示
   */
  protected updateItemSelectionState(): void {
    const selectedIds = batchToolbarMiddle.getSelectedIds(this.toolbarContext);

    // 根据当前面板类型获取选择器
    const isImagePanel = this.panelType === "image";
    const cardSelector = isImagePanel ? ".image-card" : ".prompt-card";

    // 更新网格视图中的卡片
    document.querySelectorAll(cardSelector).forEach((card) => {
      const id = card.getAttribute("data-id");
      if (id) {
        const isSelected = selectedIds.has(id);
        card.classList.toggle("is-selected", isSelected);
        const checkbox = card.querySelector(".card-checkbox") as HTMLInputElement;
        if (checkbox) {
          checkbox.checked = isSelected;
        }
      }
    });
  }

  /**
   * 更新选中状态的 UI（选择模式类 + 项目选中状态）
   * 在 Ctrl/Shift+click 多选后调用，避免重新加载数据
   */
  protected updateSelectionUI(): void {
    this.updateSelectionModeClass();
    this.updateItemSelectionState();
  }

  /**
   * 清理增量刷新后不再匹配当前结果集的 DOM 项
   * 用于数据变更导致项从筛选结果中消失的场景（如"无标"筛选下添加标签）
   * @param items - 更新后的结果集
   */
  protected removeStaleDomItems(items: IPanelItem[]): void {
    const config = this.getUIConfig();
    const itemIds = new Set(items.map((i) => String(i.id)));
    const selector = config.getCardDropSelector();

    const container = document.getElementById(config.gridContainerId);
    if (!container) return;
    container.querySelectorAll(selector).forEach((el) => {
      const elId = (el as HTMLElement).dataset.id;
      if (elId && !itemIds.has(String(elId))) {
        el.remove();
      }
    });
  }

  /**
   * 获取当前视图的事件策略
   * 子类实现以提供对应视图的策略
   */
  protected abstract getEventStrategy(): IEventStrategy | null;

  /**
   * 获取滚动导航按钮 ID（子类实现）
   */
  /**
   * 获取当前视图的容器元素
   */
  protected abstract getCurrentContainer(): HTMLElement | null;

  /**
   * 绑定项目事件（模板方法）
   * 使用策略模式处理不同视图的事件绑定
   * 先清理旧的事件监听器，再绑定新的
   */
  protected bindItemEvents(items: IPanelItem[]): void {
    const strategy = this.getEventStrategy();
    if (!strategy) return;

    const container = this.getCurrentContainer();
    if (!container) return;

    // 先清理旧的事件监听器，防止内存泄漏
    strategy.unbindEvents(container);

    // 构建事件上下文
    const eventContext: EventContext = {
      batchToolbarMiddle,
      toolbarContext: this.toolbarContext,
      renderView: () => this.renderView(),
      updateSelectionUI: () => this.updateSelectionUI(),
      items: items,
    };

    strategy.bindEvents(container, items, eventContext);
  }

  /**
   * 处理反选
   */
  protected handleBatchInvert(): void {
    const visibleItems = this.getVisibleItems();
    const allIds = visibleItems.map((item: IPanelItem) => String(item.id));
    batchToolbarMiddle.invertSelection(this.toolbarContext, allIds);
    // 仅更新选中状态 UI，避免 renderView 触发 loadData 重置分页
    this.updateSelectionUI();
  }

  /**
   * 处理批量删除
   */
  protected async handleBatchDelete(): Promise<void> {
    const isPrompt = this.panelType === "prompt";
    await batchToolbarMiddle.executeDelete(this.toolbarContext, {
      confirmConfig: isPrompt
        ? DialogConfig.BATCH_DELETE_PROMPTS
        : DialogConfig.BATCH_DELETE_IMAGES,
      execute: async (ids) => {
        const result = await (isPrompt
          ? window.electronAPI.softDeletePrompts(ids)
          : window.electronAPI.softDeleteImages(ids));
        return { success: result.success, deleted: result.deleted };
      },
      onRefresh: async () => {
        await this.refreshAfterUpdate();
        this.app.eventBus.emit(isPrompt ? Events.PROMPTS_CHANGED : Events.IMAGES_CHANGED);
        // 删除成功后退出批量模式
        this.exitBatchMode();
      },
      showToast: (msg, type) => {
        this.app.showToast?.(msg, type);
      },
      successMessage: (deleted) => {
        const msg = `${deleted} 个${isPrompt ? "提示词" : "图像"}已删除`;
        return msg;
      },
    });
  }

  protected async handleBatchAddTag(): Promise<void> {
    const selectedIds = Array.from(batchToolbarMiddle.getSelectedIds(this.toolbarContext));
    if (selectedIds.length === 0) return;

    const tagInputResult = await DialogService.showInputDialog({
      title: "批量添加标签",
      placeholder: "请输入标签名，多个标签用逗号分隔",
      autocomplete: this.panelType === "prompt" ? "prompt" : "image",
    });

    if (!tagInputResult) return;

    const tagService = TagService.getInstance();
    const tagNames = tagService.parseTagInput(tagInputResult.value);
    if (tagNames.length === 0) return;

    try {
      await batchToolbarMiddle.batchAddTag(this.toolbarContext, selectedIds, tagNames);
      await this.refreshAfterUpdate();
      this.app.showToast?.(`已为 ${selectedIds.length} 个项目添加标签`, "success");
      // 添加成功后退出批量模式
      this.exitBatchMode();
    } catch (error) {
      window.electronAPI.logError("PanelManagerBase.ts", "Failed to batch add tag", error);
      this.app.showToast?.("批量添加标签失败", "error");
    }
  }

  /**
   * 处理批量切换收藏状态（已收藏→取消，未收藏→收藏）
   */
  protected async handleBatchFavorite(): Promise<void> {
    const selectedIds = Array.from(batchToolbarMiddle.getSelectedIds(this.toolbarContext));
    if (selectedIds.length === 0) return;

    try {
      await batchToolbarMiddle.batchFavorite(this.toolbarContext, selectedIds);
      await this.refreshAfterUpdate();

      const isPrompt = this.panelType === "prompt";
      this.app.showToast?.(
        `已切换 ${selectedIds.length} 个${isPrompt ? "提示词" : "图像"}的收藏状态`,
        "success",
      );
      // 切换成功后退出批量模式
      this.exitBatchMode();
    } catch (error) {
      window.electronAPI.logError("PanelManagerBase.ts", "Failed to batch toggle favorite", error);
      this.app.showToast?.("切换收藏状态失败", "error");
    }
  }

  /**
   * 处理取消选择
   */
  protected handleBatchCancel(): void {
    // 退出批量模式即可，无需重新加载数据
    this.exitBatchMode();
  }

  // ==================== 标签拖拽操作 ====================

  /**
   * 处理标签拖拽到卡片
   * @param itemId - 项目 ID
   * @param tagName - 标签名称
   * @returns 是否成功
   */
  async handleTagDrop(itemId: string, tagName: string): Promise<boolean> {
    // 从当前项目列表中查找
    const item = this.getItems().find((i: IPanelItem) => String(i.id) === String(itemId));
    if (!item) {
      throw new Error("项目不存在");
    }

    // 检查标签是否已存在
    const currentTags = item.tags || [];
    if (currentTags.includes(tagName)) {
      throw new Error("该标签已存在");
    }

    // 确定类型
    const type = this.panelType;

    // 使用 TagService 统一处理创建和关联
    const tagService = TagService.getInstance();
    const result = await tagService.linkTagsToItem({
      tagNames: [tagName],
      type: type as "prompt" | "image",
      itemId: item.id,
    });

    if (result.errors.length > 0) {
      throw new Error(result.errors[0].error);
    }

    // 更新本地状态
    item.tags = [...currentTags, tagName];
    await this.refreshAfterUpdate();
    return true;
  }
}
