import { DialogService, DialogConfig } from "../services/index.ts";
import type { IDialogContext, IClosableElement } from "../../types/entities.ts";
import {
  UnifiedCardRenderer,
  PromptTrashConfig,
  ImageTrashConfig,
} from "./SharedComponents/index.ts";
import { Constants, ElementId, Events } from "../../constants.ts";
import { PromptTrashHandler, ImageTrashHandler } from "./handlers/index.ts";
import { cacheManager } from "../../utils/index.ts";
import { contextStack, IContextStackEntry } from "./ContextStackManager.ts";
import type { TrashHandler, TrashItem } from "./handlers/TrashHandler.ts";
import type { IApp, IEventBus, IPanelManager } from "../app.types.ts";

/**
 * 回收站类型
 */
export type TrashType = typeof Constants.TrashType.PROMPT | typeof Constants.TrashType.IMAGE;

/**
 * 回收站模态框配置
 */
interface ITrashModalConfig {
  modalId: string;
  name: string;
  elementId: ElementId;
}

/**
 * TrashManager 配置选项
 */
interface TrashManagerOptions {
  app: IApp;
  eventBus: IEventBus;
}

/**
 * 回收站管理器
 * 使用模板方法模式管理已删除的提示词和图像，同时负责回收站模态框的显示/隐藏
 */
export class TrashManager {
  private readonly app: IApp;
  private trashItems: TrashItem[] = [];
  private currentHandler: TrashHandler | null = null;
  private activeModals: Set<TrashType> = new Set();
  private isInitialized = false;

  private static readonly MODAL_CONFIG: Record<TrashType, ITrashModalConfig> = {
    [Constants.TrashType.PROMPT]: {
      modalId: Constants.Ids.PROMPT_TRASH_MODAL,
      name: "promptTrashModal",
      elementId: Constants.Ids.PROMPT_TRASH_MODAL,
    },
    [Constants.TrashType.IMAGE]: {
      modalId: Constants.Ids.IMAGE_TRASH_MODAL,
      name: "imageTrashModal",
      elementId: Constants.Ids.IMAGE_TRASH_MODAL,
    },
  };

  readonly promptHandler: PromptTrashHandler;
  readonly imageHandler: ImageTrashHandler;

  /**
   * 构造函数
   * @param options - 配置选项
   */
  constructor(options: TrashManagerOptions) {
    this.app = options.app;
    // eventBus 通过 app 访问

    // 初始化处理器
    this.promptHandler = new PromptTrashHandler();
    this.imageHandler = new ImageTrashHandler();
  }

  /**
   * 初始化回收站
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    this.bindEvents();
    this.isInitialized = true;
  }

  /**
   * 加载回收站列表
   */
  async loadTrash(): Promise<void> {
    try {
      if (!this.currentHandler) return;

      const items = await this.currentHandler.loadItems();
      this.trashItems = items.map((item) => ({
        ...item,
        type: this.currentHandler!.type,
      }));

      await this.renderTrashList();
    } catch (error) {
      window.electronAPI.logError("TrashManager.js", "Failed to load trash:", error);
      this.app.showToast("加载回收站失败", "error");
    }
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    // 提示词回收站
    document.getElementById(Constants.Ids.PROMPT_TRASH_BTN)?.addEventListener("click", () => {
      this.open(this.promptHandler);
    });
    document
      .getElementById(Constants.Ids.CLOSE_PROMPT_TRASH_MODAL)
      ?.addEventListener("click", () => {
        this.close();
      });
    document
      .getElementById(Constants.Ids.RESTORE_ALL_PROMPT_TRASH_BTN)
      ?.addEventListener("click", () => {
        this.restoreAll();
      });
    document.getElementById(Constants.Ids.EMPTY_PROMPT_TRASH_BTN)?.addEventListener("click", () => {
      this.confirmClearTrash();
    });

    // 图像回收站
    document.getElementById(Constants.Ids.IMAGE_TRASH_BTN)?.addEventListener("click", () => {
      this.open(this.imageHandler);
    });
    document
      .getElementById(Constants.Ids.CLOSE_IMAGE_TRASH_MODAL)
      ?.addEventListener("click", () => {
        this.close();
      });
    document
      .getElementById(Constants.Ids.RESTORE_ALL_IMAGE_TRASH_BTN)
      ?.addEventListener("click", () => {
        this.restoreAll();
      });
    document.getElementById(Constants.Ids.EMPTY_IMAGE_TRASH_BTN)?.addEventListener("click", () => {
      this.confirmClearTrash();
    });
  }

  /**
   * 渲染回收站列表
   */
  private async renderTrashList(): Promise<void> {
    if (!this.currentHandler) return;

    const container = document.getElementById(this.currentHandler.containerId);
    if (!container) return;

    if (this.trashItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <p>回收站为空</p>
        </div>
      `;
      return;
    }

    const html = this.trashItems.map((item) => this.renderTrashItem(item)).join("");
    container.innerHTML = html;
    this.bindTrashItemEventsForContainer(container);
    this.loadCardBackgroundsForContainer(container);
  }

  /**
   * 渲染回收站项
   * @param item - 回收站项
   * @returns HTML 字符串
   */
  private renderTrashItem(item: TrashItem): string {
    const config = item.type === Constants.TrashType.IMAGE ? ImageTrashConfig : PromptTrashConfig;
    return UnifiedCardRenderer.render(config, item, {
      icons: Constants.ICONS,
      sortBy: "",
      app: this.app,
    });
  }

  /**
   * 绑定回收站项事件（针对指定容器）
   * @param container - 容器元素
   */
  private bindTrashItemEventsForContainer(container: HTMLElement): void {
    const items = container.querySelectorAll<HTMLElement>(".trash-card");

    items.forEach((item) => {
      // 恢复按钮
      const restoreBtn = item.querySelector('[data-action="restore"]');
      if (restoreBtn) {
        restoreBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const itemId = item.dataset.id;
          if (itemId) await this.restoreItem(itemId);
        });
      }

      // 删除按钮
      const deleteBtn = item.querySelector('[data-action="permanentDelete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const itemId = item.dataset.id;
          if (itemId) await this.permanentlyDeleteItem(itemId);
        });
      }
    });
  }

  /**
   * 异步加载卡片背景图（针对指定容器）
   * 优先从路径缓存读取，未命中时单次 IPC 批量兜底
   * @param container - 容器元素
   */
  private async loadCardBackgroundsForContainer(container: HTMLElement): Promise<void> {
    const cards = container.querySelectorAll<HTMLElement>(".trash-card");

    // 收集路径信息：优先读路径缓存
    const cardInfoList: Array<{ card: HTMLElement; fullPath: string }> = [];
    const uncachedPaths: string[] = [];
    const uncachedIds: string[] = [];

    for (const card of cards) {
      const itemId = card.dataset.id;
      const item = this.trashItems.find((i) => String(i.id) === String(itemId));
      if (!item) continue;

      const imagePath = this.currentHandler!.getThumbnailPath(item);
      if (!imagePath) continue;

      // 尝试从路径缓存读取
      if (itemId && cacheManager.getImagePath(itemId, "thumbnail")) {
        const fullPath = cacheManager.getImagePath(itemId, "thumbnail")!;
        cardInfoList.push({ card, fullPath });
        continue;
      }

      uncachedIds.push(itemId || "");
      uncachedPaths.push(imagePath);
      cardInfoList.push({ card, fullPath: "" });
    }

    if (cardInfoList.length === 0) return;

    // 单次 IPC 批量获取未命中的路径
    if (uncachedPaths.length > 0) {
      try {
        const fullPaths = await window.electronAPI.getImagesPaths(uncachedPaths);
        const entries: Array<{ imageId: string; fullPath: string }> = [];
        let uncachedIdx = 0;
        for (const info of cardInfoList) {
          if (!info.fullPath && uncachedIdx < uncachedPaths.length) {
            const fullPath = fullPaths[uncachedIdx];
            const imageId = uncachedIds[uncachedIdx];
            if (fullPath) {
              info.fullPath = fullPath;
              if (imageId) {
                entries.push({ imageId, fullPath });
              }
            }
            uncachedIdx++;
          }
        }
        if (entries.length > 0) {
          cacheManager.setImagePaths(entries, "thumbnail");
        }
      } catch (error) {
        window.electronAPI.logError(
          "TrashManager.js",
          "Failed to load trash card backgrounds (fallback):",
          error,
        );
      }
    }

    // 应用所有背景图
    for (const info of cardInfoList) {
      if (!info.fullPath) continue;
      const bgElement = info.card.querySelector<HTMLElement>(".trash-card-bg, .card__bg");
      if (bgElement) {
        bgElement.style.backgroundImage = `url('file://${info.fullPath.replace(/\\/g, "/")}')`;
      }
    }
  }

  /**
   * 刷新主界面面板
   * 恢复操作后需要刷新当前面板和关联面板
   */
  private refreshMainPanel(): void {
    if (!this.currentHandler) return;

    // 刷新当前面板
    const panelManager = this.currentHandler.getMainPanelManager(this.app);
    if (panelManager && this.isPanelManager(panelManager)) {
      panelManager.renderView();
      panelManager.renderTagFilters();
      this.app.eventBus.emit(this.currentHandler.eventName);
    }

    // 刷新关联面板（图像和提示词有关联关系）
    if (this.currentHandler.type === Constants.TrashType.IMAGE) {
      // 图像恢复后，提示词面板也需要刷新（可能有关联）
      const promptPanelManager = this.app.promptPanelManager;
      if (promptPanelManager && this.isPanelManager(promptPanelManager)) {
        promptPanelManager.renderView();
        promptPanelManager.renderTagFilters();
      }
      this.app.eventBus.emit(Events.PROMPTS_CHANGED);
    } else if (this.currentHandler.type === Constants.TrashType.PROMPT) {
      // 提示词恢复后，图像面板也需要刷新（可能有关联）
      const imagePanelManager = this.app.imagePanelManager;
      if (imagePanelManager && this.isPanelManager(imagePanelManager)) {
        imagePanelManager.renderView();
        imagePanelManager.renderTagFilters();
      }
      this.app.eventBus.emit(Events.IMAGES_CHANGED);
    }
  }

  /**
   * 类型守卫：检查是否为面板管理器
   */
  private isPanelManager(obj: unknown): obj is IPanelManager {
    return (
      obj !== null && typeof obj === "object" && "renderView" in obj && "renderTagFilters" in obj
    );
  }

  /**
   * 恢复单个项目
   * @param itemId - 项目 ID
   */
  async restoreItem(itemId: string): Promise<void> {
    if (!this.currentHandler) return;

    try {
      await this.currentHandler.restoreItem(itemId);
      this.updateCacheAfterOperation(itemId);
      this.app.showToast("已恢复", "success");
      await this.loadTrash();
      this.refreshMainPanel();

      if (this.app.currentPanel === "statistics") {
        await this.app.renderStatistics();
      }
    } catch (error) {
      window.electronAPI.logError("TrashManager.js", "Failed to restore item:", error);
      this.app.showToast("恢复失败", "error");
    }
  }

  /**
   * 批量恢复所有项目
   */
  async restoreAll(): Promise<void> {
    if (!this.currentHandler) return;

    try {
      if (this.trashItems.length === 0) {
        this.app.showToast("回收站已为空", "info");
        return;
      }

      await this.currentHandler.restoreAllItems();

      // 批量更新缓存
      const cacheManager = this.app?.cacheManager;
      if (cacheManager) {
        for (const item of this.trashItems) {
          cacheManager.updateCachedItem(
            item.id,
            this.currentHandler.type,
            this.currentHandler.getCacheUpdateData(),
          );
        }
      }

      this.app.showToast(`已恢复 ${this.trashItems.length} 个项目`, "success");
      await this.loadTrash();
      this.refreshMainPanel();

      if (this.app.currentPanel === "statistics") {
        await this.app.renderStatistics();
      }
    } catch (error) {
      window.electronAPI.logError("TrashManager.js", "Failed to restore all items:", error);
      this.app.showToast("恢复失败", "error");
    }
  }

  /**
   * 永久删除项目
   * @param itemId - 项目 ID
   */
  async permanentlyDeleteItem(itemId: string): Promise<void> {
    if (!this.currentHandler) return;

    const data: IDialogContext = { type: this.currentHandler.type };
    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.PERMANENT_DELETE,
      data,
    );

    if (!confirmed) return;

    try {
      await this.currentHandler.deleteItem(itemId);
      this.app.showToast("已永久删除", "success");
      await this.loadTrash();
      this.removeFromCache(itemId);
      this.refreshMainPanel();

      if (this.app.currentPanel === "statistics") {
        await this.app.renderStatistics();
      }
    } catch (error) {
      window.electronAPI.logError("TrashManager.js", "Failed to permanently delete item:", error);
      this.app.showToast("删除失败", "error");
    }
  }

  /**
   * 确认清空回收站
   */
  confirmClearTrash(): void {
    if (!this.currentHandler) return;

    const data: IDialogContext = { type: this.currentHandler.type };
    DialogService.showConfirmDialogByConfig(DialogConfig.EMPTY_TRASH, data).then((confirmed) => {
      if (confirmed) this.clearTrash();
    });
  }

  /**
   * 清空回收站
   */
  async clearTrash(): Promise<void> {
    if (!this.currentHandler) return;

    try {
      await this.currentHandler.clearAllItems();
      this.app.showToast("回收站已清空", "success");
      this.app.eventBus.emit(this.currentHandler.eventName);
      await this.loadTrash();
    } catch (error) {
      window.electronAPI.logError("TrashManager.js", "Failed to clear trash:", error);
      this.app.showToast("清空失败", "error");
    }
  }

  /**
   * 更新缓存中的项目状态
   * @param itemId - 项目 ID
   */
  private updateCacheAfterOperation(itemId: string): void {
    const cacheManager = this.app?.cacheManager;
    if (!cacheManager || !this.currentHandler) return;

    cacheManager.updateCachedItem(
      itemId,
      this.currentHandler.type,
      this.currentHandler.getCacheUpdateData(),
    );
  }

  /**
   * 从缓存中移除项目
   * @param itemId - 项目 ID
   */
  private removeFromCache(itemId: string): void {
    const cacheManager = this.app?.cacheManager;
    if (!cacheManager || !this.currentHandler) return;

    cacheManager.removeCachedItem(itemId, this.currentHandler.type);
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.trashItems = [];
    this.currentHandler = null;
  }

  /**
   * 关闭回收站模态框
   * @param type - 回收站类型
   */
  private closeModal(type: TrashType): void {
    const config = TrashManager.MODAL_CONFIG[type];
    if (!config) return;

    const modal = document.getElementById(config.modalId);
    if (modal) {
      modal.style.display = "none";
    }
    contextStack.pop(config.elementId);
    this.activeModals.delete(type);
  }

  /**
   * 打开回收站
   * @param handler - 回收站处理器
   */
  async open(handler: TrashHandler): Promise<void> {
    this.currentHandler = handler;
    await this.loadTrash();

    const type = handler.type as TrashType;
    const config = TrashManager.MODAL_CONFIG[type];
    const modal = document.getElementById(config.modalId);

    if (modal) {
      const stackEntry: IContextStackEntry = {
        id: config.elementId as ElementId,
        state: { isBatchToolbarVisible: false },
        close: () => {
          this.close();
        },
      };
      contextStack.push(stackEntry);
      modal.style.display = "flex";
      (modal as IClosableElement).close = () => this.close();
      this.activeModals.add(type);
    }
  }

  /**
   * 关闭回收站
   */
  close(): void {
    if (!this.currentHandler) return;
    const type = this.currentHandler.type as TrashType;
    this.closeModal(type);
  }

  /**
   * 检查指定类型的回收站模态框是否处于活动状态
   * @param type - 回收站类型，不传则检查是否有任何回收站模态框处于活动状态
   */
  isModalActive(type?: TrashType): boolean {
    if (type) {
      return this.activeModals.has(type);
    }
    return this.activeModals.size > 0;
  }
}
