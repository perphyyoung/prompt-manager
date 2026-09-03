/**
 * 重构版应用主类
 * 作为协调器，整合各个面板管理器
 */

import { Constants } from "./constants.ts";
import { DialogService, DialogConfig } from "./services/index.ts";
import {
  PromptPanelManager,
  ImagePanelManager,
  PromptTagManager,
  ImageTagManager,
  TrashManager,
  ImageFullscreenManager,
  PromptDetailManager,
  ImageDetailManager,
  ToastManager,
  NavigationManager,
  SearchSortManager,
  ToolbarManager,
  ImportExportManager,
  SettingsManager,
  ImageSelectorManager,
  NewPromptManager,
  ImageUploadManager,
  StatisticsManager,
} from "./managers/index.ts";

import eventBus from "../utils/EventBus.ts";
import { HtmlUtils, cacheManager } from "../utils/index.ts";
import { tagService } from "./services/TagService.ts";
import { HoverTooltipManager, ShortcutManager } from "./renderer_utils/index.ts";
import { localStorageManager } from "./configs/LocalStorageConfig.ts";
import type { IPrompt, IImage } from "../types/entities.ts";
import type {
  IApp,
  IPanelManager,
  IToastManager,
  IImageFullscreenManager,
  INavigationManager,
  IToolbarManager,
  ISearchSortManager,
  IImportExportManager,
  ISettingsManager,
  IImageSelectorManager,
  INewPromptManager,
  IImageUploadManager,
  IHoverTooltipManager,
  IShortcutManager,
  IEventBus,
  ICacheManager,
} from "./app.types.ts";

// ==================== 主应用类 ====================

/**
 * 主应用类 - 协调器
 * 负责初始化和管理各个子模块，处理全局事件和状态
 */
class PromptManager implements IApp {
  // 缓存管理器
  cacheManager: ICacheManager;
  promptRefImagesCache: ReturnType<typeof cacheManager.createCache>;

  // 状态
  safeMode: string;

  // 标签排序状态
  promptTagSortBy: string;
  promptTagSortOrder: string;
  imageTagSortBy: string;
  imageTagSortOrder: string;
  imageSelectorSortBy: string;
  imageSelectorSortOrder: string;

  // 标签系统（在 initPanelManagers 中初始化）
  promptTagManager: PromptTagManager | null = null;
  imageTagManager: ImageTagManager | null = null;

  // 事件总线
  eventBus: IEventBus;

  // 面板管理器（在 initPanelManagers 中初始化）
  promptPanelManager: IPanelManager | null = null;
  imagePanelManager: IPanelManager | null = null;
  trashManager: TrashManager | null = null;
  shortcutManager: IShortcutManager | null = null;
  imageFullscreenManager: IImageFullscreenManager | null = null;
  promptDetailManager: PromptDetailManager | null = null;
  imageDetailManager: ImageDetailManager | null = null;
  toastManager: IToastManager | null = null;
  navigationManager: INavigationManager | null = null;
  searchSortManager: ISearchSortManager | null = null;
  toolbarManager: IToolbarManager | null = null;
  importExportManager: IImportExportManager | null = null;
  settingsManager: ISettingsManager | null = null;
  imageSelectorManager: IImageSelectorManager | null = null;
  newPromptManager: INewPromptManager | null = null;
  imageUploadManager: IImageUploadManager | null = null;

  // 当前面板状态
  currentPanel: string;

  // UI 组件
  promptHoverTooltip: IHoverTooltipManager | null = null;

  // 统计管理器（在 initPanelManagers 中初始化）
  statisticsManager: StatisticsManager | null = null;

  // 其他
  isFromDetailJump: boolean;
  private _saveLocks?: Set<string>;
  private confirmResolve?: ((value: boolean) => void) | null;

  constructor() {
    // 使用 CacheManager 管理缓存
    this.cacheManager = cacheManager;
    this.promptRefImagesCache = cacheManager.createCache("promptRefImages", 100);

    // 从 localStorage 加载 safeMode（在创建面板管理器之前）
    this.safeMode = localStorageManager.get<string>(Constants.LocalStorageKey.SAFE_MODE);

    // 标签管理排序状态
    this.promptTagSortBy = localStorageManager.get<string>(
      Constants.LocalStorageKey.PROMPT_TAG_SORT_BY,
    );
    this.promptTagSortOrder = localStorageManager.get<string>(
      Constants.LocalStorageKey.PROMPT_TAG_SORT_ORDER,
    );
    this.imageTagSortBy = localStorageManager.get<string>(
      Constants.LocalStorageKey.IMAGE_TAG_SORT_BY,
    );
    this.imageTagSortOrder = localStorageManager.get<string>(
      Constants.LocalStorageKey.IMAGE_TAG_SORT_ORDER,
    );

    // 图像选择器排序状态（独立设置）
    this.imageSelectorSortBy = localStorageManager.get<string>(
      Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_BY,
    );
    this.imageSelectorSortOrder = localStorageManager.get<string>(
      Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_ORDER,
    );

    // 事件总线（单例）
    this.eventBus = eventBus;

    // 当前面板状态 (由 NavigationManager 管理)
    this.currentPanel = "prompt"; // 默认打开提示词面板

    // 其他状态
    this.isFromDetailJump = false;

    // ========== 管理器初始化（延迟到 initPanelManagers） ==========
    // 所有管理器在 initPanelManagers() 中统一初始化，避免重复创建
  }

  /**
   * 初始化应用
   */
  async init() {
    try {
      // 恢复主题
      this.restoreTheme();

      // 初始化 hover tooltip
      this.initHoverTooltips();

      // 初始化对话框服务（只绑定一次事件）
      DialogService.init();

      // 初始化面板管理器（只加载数据，不渲染视图）
      await this.initPanelManagers();

      // 绑定全局事件
      this.bindGlobalEvents();

      // 恢复上次打开的面板（会触发当前面板的渲染）
      this.navigationManager?.restorePanelState();
    } catch (error) {
      window.electronAPI.logError("App", "Failed to initialize application:", error);
      this.showToast("应用初始化失败", "error");
    }
  }

  /**
   * 恢复主题
   */
  restoreTheme() {
    const savedTheme = localStorageManager.get<string>(Constants.LocalStorageKey.THEME);
    const html = document.documentElement;
    html.setAttribute("data-theme", savedTheme);

    // 更新主题按钮文本
    const themeToggle = document.getElementById(Constants.Ids.SETTINGS_THEME_TOGGLE);
    if (themeToggle) {
      themeToggle.innerHTML =
        savedTheme === "dark" ? "<span>☀️</span> 明亮" : "<span>🌙</span> 暗黑";
    }
  }

  /**
   * 初始化 Hover Tooltip
   */
  initHoverTooltips() {
    // 提示词预览 tooltip（左右布局，同时显示内容和图像）
    this.promptHoverTooltip = new HoverTooltipManager(
      Constants.Ids.PROMPT_PREVIEW_TOOLTIP,
      Constants.Ids.PROMPT_PREVIEW_CONTENT,
      Constants.Ids.PROMPT_PREVIEW_IMAGE,
    );
  }

  /**
   * 初始化面板管理器
   * 所有管理器的唯一初始化入口，避免重复创建
   */
  async initPanelManagers() {
    // ========== 1. 基础服务层 ==========

    // 初始化 Toast 管理器（最先初始化，以便其他模块使用）
    this.toastManager = new ToastManager({
      duration: 3000,
      containerId: Constants.Ids.TOAST_CONTAINER,
      messageId: Constants.Ids.TOAST_MESSAGE,
    });
    this.toastManager.init();

    // 初始化快捷键管理器
    this.shortcutManager = new ShortcutManager({ app: this as IApp });
    this.shortcutManager.bind();

    // ========== 2. 数据层 ==========

    // 初始化标签管理器（必须在面板管理器之前）
    this.promptTagManager = new PromptTagManager(this as IApp);
    this.imageTagManager = new ImageTagManager(this as IApp);

    // ========== 3. 面板层 ==========

    // 初始化提示词面板管理器
    this.promptPanelManager = new PromptPanelManager(app);

    // 初始化图像面板管理器
    this.imagePanelManager = new ImagePanelManager(app);

    // ========== 4. 功能管理器 ==========

    // 初始化回收站管理器
    this.trashManager = new TrashManager({
      app: this as IApp,
      eventBus: this.eventBus,
    });
    await this.trashManager.init();

    // 初始化图像全屏查看器管理器
    this.imageFullscreenManager = new ImageFullscreenManager({ app: this as IApp });
    this.imageFullscreenManager.init();

    // 初始化详情管理器
    this.promptDetailManager = new PromptDetailManager({
      app: this as IApp,
    });
    this.imageDetailManager = new ImageDetailManager({
      app: this as IApp,
    });

    // 初始化导航管理器
    this.navigationManager = new NavigationManager({
      app: this as IApp,
      storageKey: "currentPanel",
      defaultPanel: "prompt",
    });
    this.navigationManager.init?.();

    // 同步 currentPanel 引用
    this.syncCurrentPanel();

    // 初始化搜索排序管理器
    this.searchSortManager = new SearchSortManager({ app: this as IApp });
    this.searchSortManager.init();

    // 初始化工具栏管理器
    this.toolbarManager = new ToolbarManager({ app: this as IApp });
    this.toolbarManager.init();

    // 初始化导入导出管理器
    this.importExportManager = new ImportExportManager({ app: this as IApp });
    this.importExportManager.init();

    // 初始化设置管理器
    this.settingsManager = new SettingsManager({
      app: this as IApp,
      dataClearApi: window.electronAPI,
    });
    this.settingsManager.init?.();

    // 初始化图像选择器管理器
    this.imageSelectorManager = new ImageSelectorManager({ app: this as IApp });

    // 初始化新建提示词管理器
    this.newPromptManager = new NewPromptManager({ app: this as IApp });

    // 初始化图像上传管理器
    this.imageUploadManager = new ImageUploadManager({ app: this as IApp });

    // 初始化统计管理器
    this.statisticsManager = new StatisticsManager(this as IApp);

    // ========== 5. 并行初始化面板数据 ==========
    await Promise.all([this.promptPanelManager?.init?.(), this.imagePanelManager?.init?.()]);
  }

  /**
   * 同步 currentPanel 引用
   * 保持与 NavigationManager 的同步
   */
  syncCurrentPanel() {
    Object.defineProperty(this, "currentPanel", {
      get: () => this.navigationManager?.getCurrentPanel() || "prompt",
      set: (value) => {
        if (this.navigationManager) {
          this.navigationManager.switchTo(value);
        }
      },
    });
  }

  /**
   * 绑定全局事件
   */
  bindGlobalEvents(): void {
    // 各模块事件绑定：
    // - 侧边栏事件: NavigationManager.bindSidebarEvents
    // - 工具栏事件: ToolbarManager
    // - 搜索/排序/视图: SearchSortManager
    // - 标签筛选: PanelManager
    // - 对话框事件: ModalManager
    // - 设置事件: SettingsManager
    // - 标签管理器: TagRegistry.bindManagerEvents
    // - 详情模态框: DetailViewManager.bindCloseEvent
    // - 全屏查看器: ImageFullscreenManager

    // 文本全选全局事件
    this.bindTextSelectEvents();
  }

  /**
   * 绑定文本全选事件（Ctrl+A）
   * 使用事件委托处理所有文本编辑框和查看框
   */
  bindTextSelectEvents() {
    document.addEventListener("keydown", (e) => {
      // 检查是否按下了 Ctrl+A (或 Cmd+A on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        const target = e.target as HTMLElement;

        // 检查目标是否是文本输入框或文本查看框
        const isTextInput =
          target.tagName === "INPUT" &&
          ["text", "search", "url", "email", "password", "number"].includes(
            (target as HTMLInputElement).type,
          );
        const isTextArea = target.tagName === "TEXTAREA";
        const isContentEditable = target.isContentEditable;
        const isTextViewer = target.classList.contains("prompt-content");

        // 如果是文本编辑/查看框，执行全选
        if (isTextInput || isTextArea || isContentEditable || isTextViewer) {
          e.preventDefault(); // 阻止默认行为，使用自定义全选

          if (isContentEditable || isTextViewer) {
            // 对于 contenteditable 元素和文本查看框
            const range = document.createRange();
            range.selectNodeContents(target);
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              selection.addRange(range);
            }
          } else {
            // 对于普通输入框
            (target as HTMLInputElement).select();
          }
        }
      }
    });
  }

  /**
   * 切换安全模式（safe/nsfw）
   */
  async toggleSafeMode() {
    this.safeMode = this.safeMode === "safe" ? "nsfw" : "safe";

    // 重新渲染
    await this.promptPanelManager?.renderView();
    await this.promptPanelManager?.renderTagFilters();
    await this.imagePanelManager?.renderView();
    await this.imagePanelManager?.renderTagFilters();

    // 刷新统计
    await this.renderStatistics();

    this.showToast(`已切换到${this.safeMode === "safe" ? "安全" : "敏感"}模式`, "success");
  }

  /**
   * 刷新数据
   */
  async refreshData() {
    try {
      // 加载数据
      await this.promptPanelManager?.loadData?.();
      await this.imagePanelManager?.loadData?.();

      // 刷新提示词和图像主界面
      await this.promptPanelManager?.renderView();
      await this.imagePanelManager?.renderView();

      // 刷新标签筛选
      await this.promptPanelManager?.renderTagFilters();
      await this.imagePanelManager?.renderTagFilters();

      // 清除标签缓存，确保下次打开标签管理器时加载最新数据
      tagService.clearAllCaches("prompt");
      tagService.clearAllCaches("image");

      // 刷新统计
      await this.renderStatistics();

      this.showToast("数据已刷新", "success");
    } catch (error) {
      window.electronAPI.logError("App", "Failed to refresh data:", error);
      this.showToast("刷新失败", "error");
    }
  }

  /**
   * 重启应用
   * @param oldDataDir - 旧的数据库目录路径（可选）
   */
  async relaunchApp(oldDataDir?: string) {
    try {
      if (oldDataDir) {
        await window.electronAPI.relaunchApp(oldDataDir);
      } else {
        const confirmed = await DialogService.showConfirmDialogByConfig(DialogConfig.RELAUNCH_APP);
        if (!confirmed) return;
        await window.electronAPI.relaunchApp();
      }
    } catch (error) {
      window.electronAPI.logError("App", "Failed to relaunch app:", error);
      this.showToast("重启失败", "error");
    }
  }

  /**
   * 比较两个 ID 是否相等（统一转换为字符串比较）
   * @param id1 - 第一个 ID
   * @param id2 - 第二个 ID
   * @returns 是否相等
   */
  isSameId(id1: string | number, id2: string | number): boolean {
    return String(id1) === String(id2);
  }

  /**
   * 显示提示消息
   * @param message - 消息内容
   * @param type - 类型 (success, error, info, warning)
   */
  showToast(message: string, type = "info") {
    this.toastManager?.show(message, type);
  }

  /**
   * 打开编辑提示词模态框
   * @param prompt - 提示词对象
   * @param options - 选项
   */
  async openEditPromptModal(prompt: IPrompt, options = {}) {
    await this.promptDetailManager?.open(prompt, options);
  }

  /**
   * 生成唯一的时间戳标题
   * @returns 唯一的时间戳字符串
   */
  generateUniqueTimestamp() {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    const second = String(now.getSeconds()).padStart(2, "0");
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    return `${year}${month}${day}_${hour}${minute}${second}_${ms}`;
  }

  /**
   * 更新提示词编辑界面收藏按钮的 UI 状态
   * @param isFavorite - 是否收藏
   */
  updatePromptFavoriteBtnUI(isFavorite: boolean) {
    const btn = document.getElementById(Constants.Ids.PROMPT_DETAIL_FAVORITE_BTN);
    if (!btn) return;

    if (isFavorite) {
      btn.classList.add("active");
      btn.title = "取消收藏";
      btn.innerHTML = Constants.ICONS.favorite.filled;
    } else {
      btn.classList.remove("active");
      btn.title = "收藏";
      btn.innerHTML = Constants.ICONS.favorite.outline;
    }
  }

  /**
   * 打开图像详情模态框
   * @param image - 图像对象
   */
  async openImageDetailModal(image: IImage, options = {}) {
    await this.imageDetailManager?.open(image, options);
  }

  /**
   * 打开全屏图像查看器
   * @param images - 图像数组
   * @param index - 当前索引
   */
  async openFullscreen(
    images: Array<{ id?: string; relativePath?: string; fileName?: string }>,
    index: number,
  ) {
    this.imageFullscreenManager?.open(images, index);
  }

  /**
   * 更新图像详情界面收藏按钮的 UI 状态
   * @param isFavorite - 是否收藏
   */
  updateImageDetailFavoriteBtnUI(isFavorite: boolean) {
    const btn = document.getElementById(Constants.Ids.IMAGE_DETAIL_FAVORITE_BTN);
    if (!btn) return;

    if (isFavorite) {
      btn.classList.add("active");
      btn.title = "取消收藏";
      btn.innerHTML = Constants.ICONS.favorite.filled;
    } else {
      btn.classList.remove("active");
      btn.title = "收藏";
      btn.innerHTML = Constants.ICONS.favorite.outline;
    }
  }

  /**
   * 渲染图像详情信息
   * @param image - 图像对象
   */
  async renderImageDetailInfo(image: {
    id: string;
    updatedAt?: string;
    createdAt?: string;
    width?: number;
    height?: number;
    fileSize?: number;
    relativePath?: string;
    fileName?: string;
  }) {
    // 更新时间
    const updatedAtEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_UPDATED_AT);
    if (updatedAtEl) {
      updatedAtEl.textContent = image.updatedAt || "-";
    }

    // 上传时间
    const createdAtEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_CREATED_AT);
    if (createdAtEl) {
      createdAtEl.textContent = image.createdAt || "-";
    }

    // 图像尺寸
    const dimensionsEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_DIMENSIONS);
    if (dimensionsEl) {
      dimensionsEl.textContent =
        image.width && image.height ? `${image.width} × ${image.height}` : "-";
    }

    // 文件大小
    const fileSizeEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_FILE_SIZE);
    if (fileSizeEl) {
      fileSizeEl.textContent = image.fileSize ? HtmlUtils.formatFileSize(image.fileSize) : "-";
    }

    // 设置图像 - 异步获取完整路径
    // 使用 relativePath（原图路径），与重构前一致
    const imgEl = document.getElementById(
      Constants.Ids.IMAGE_DETAIL_IMG,
    ) as HTMLImageElement | null;
    const imagePath = image.relativePath;
    if (imgEl && imagePath) {
      try {
        const fullPath = await window.electronAPI.getImagePath(imagePath);
        imgEl.src = `file://${fullPath.replace(/"/g, "&quot;")}`;
        imgEl.alt = image.fileName || "图像";

        // 绑定双击事件 - 打开全屏查看器
        imgEl.ondblclick = () => {
          // 使用当前快照中的图像列表
          const itemsSnapshot = this.imageDetailManager?.getItemsSnapshot();
          if (itemsSnapshot && itemsSnapshot.length > 0) {
            // 找到当前图像在列表中的索引
            const currentIndex = itemsSnapshot.findIndex((i) =>
              this.isSameId((i as { id: string }).id, image.id),
            );
            this.imageFullscreenManager?.open(itemsSnapshot, currentIndex >= 0 ? currentIndex : 0);
          } else {
            // 如果没有快照，只显示当前图像
            const singleImage = [
              {
                id: image.id,
                relativePath: image.relativePath,
                fileName: image.fileName,
              },
            ];
            this.imageFullscreenManager?.open(singleImage, 0);
          }
        };
      } catch (error) {
        window.electronAPI.logError("App", "Failed to load image:", error);
        imgEl.alt = "加载图像失败";
      }
    }
  }

  /**
   * 根据 ID 查找图像
   * 优先从缓存获取，时间复杂度 O(1)；缓存未命中时从 allImages 查找
   * @param id - 图像 ID
   * @param allImages - 图像列表（可选，缓存未命中时使用）
   * @returns 图像对象
   */
  findImageById(id: string, allImages: Array<{ id: string }> | null = null) {
    const cached = cacheManager.getCachedImage(id);
    if (cached) return cached;
    if (allImages) {
      return allImages.find((img) => this.isSameId(img.id, id)) || null;
    }
    return null;
  }

  /**
   * 订阅事件
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  on(event: string, callback: (...args: unknown[]) => void) {
    this.eventBus.on(event, callback);
  }

  /**
   * 取消订阅事件
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  off(event: string, callback: (...args: unknown[]) => void) {
    this.eventBus.off(event, callback);
  }

  /**
   * 触发事件
   * @param event - 事件名称
   * @param data - 事件数据
   */
  emit(event: string, data?: unknown) {
    this.eventBus.emit(event, data);
  }

  /**
   * 自动调整 textarea 高度
   * @param element - HTML元素（通常是textarea）
   */
  autoResizeTextarea(element: HTMLElement | null) {
    if (!element) return;
    const textarea = element as HTMLTextAreaElement;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }

  /**
   * 根据 ID 查找提示词
   * 优先使用索引缓存，时间复杂度 O(1)
   * @param id - 提示词 ID
   * @returns 提示词对象
   */
  findPromptById(id: string) {
    return cacheManager.getCachedPrompt(id) || null;
  }

  /**
   * 打开统计模态框
   */
  async openStatisticsModal() {
    await this.statisticsManager?.openStatisticsModal();
  }

  /**
   * 关闭统计模态框
   */
  closeStatisticsModal() {
    this.statisticsManager?.closeStatisticsModal();
  }

  /**
   * 渲染统计数据
   */
  async renderStatistics() {
    await this.statisticsManager?.renderStatistics();
  }

  /**
   * 打开提示词标签管理器模态框
   */
  async openPromptTagManagerModal() {
    this.promptTagManager?.openManager();
    await this.promptTagManager?.renderTagList();
  }

  /**
   * 打开图像标签管理器模态框
   */
  async openImageTagManagerModal() {
    this.imageTagManager?.openManager();
    await this.imageTagManager?.renderTagList();
  }
}

// 初始化应用
const app = new PromptManager();
window.app = app;

// 暴露 DialogService 供 main 进程调用
window.dialogService = DialogService;

// 全局错误处理 - 未捕获的 Promise 错误
window.addEventListener("unhandledrejection", (event) => {
  const error = event.reason;
  const message = error?.message || error?.toString() || "Unknown unhandled rejection";
  window.electronAPI?.logError("Renderer", `Unhandled Promise Rejection: ${message}`, error);
});

// 全局错误处理 - 未捕获的同步错误
window.onerror = (message, source, lineno, colno, error) => {
  const errorMsg = error?.message || message;
  window.electronAPI?.logError("Renderer", `Uncaught Error: ${errorMsg}`, error);
  return false;
};

// DOM 加载完成后初始化
async function initApp() {
  await app.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initApp());
} else {
  initApp();
}

export default PromptManager;
