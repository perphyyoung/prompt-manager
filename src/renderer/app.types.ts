import type { LRUCache } from '../utils/LRUCache.ts';
import type { IPrompt, IImage } from '../types/entities.ts';
import type { DialogService } from './services/DialogService.ts';

// 重新导出类型
export type { IPrompt, IImage };

/**
 * 面板管理器接口
 * 被 PromptPanelManager 和 ImagePanelManager 实现
 */
export interface IPanelManager {
  renderView(): Promise<void>;
  renderTagFilters(): Promise<void>;
  loadData(): Promise<unknown[]>;
  init(): Promise<void>;
  ensureRendered(): Promise<void>;
  clearTagFilter(): void;
  refresh(): Promise<void>;
  sortBy: string;
  sortOrder: string;
  tagFilterSortBy: string;
  tagFilterSortOrder: string;
  cardSize: number;
  viewModeType: string;
  setViewMode(mode: string): void;
  setCardSize(size: number): void;
  handleFilterAction(): void;
  refreshAfterUpdate(): Promise<void>;
  exitBatchMode(): void;
  selectAllVisibleItems(): void;
  toggleTagFilterState(): Promise<void>;
}

/**
 * 输入框结果接口
 */
export interface IInputResult {
  value: string;
  confirmed: boolean;
}



/**
 * 缓存管理器接口
 */
export interface ICacheManager {
  updateCachedItem(itemId: string, type: string, data: unknown): void;
  removeCachedItem(itemId: string, type: string): void;
  getPromptCache(): LRUCache;
  getImageCache(): LRUCache;
  createCache(name: string, size: number): LRUCache;
  cachePrompts(prompts: unknown[]): void;
  getCachedPrompt(id: string): unknown | undefined;
  getCachedImage(id: string): unknown | undefined;
}

/**
 * 事件总线接口
 */
export interface IEventBus {
  on(event: string, callback: (data?: unknown) => void): () => void;
  off(event: string, callback: (data?: unknown) => void): void;
  emit(event: string, data?: unknown): void;
}

/**
 * Toast 管理器接口
 */
export interface IToastManager {
  show(message: string, type?: string, duration?: number | null): void;
  success(message: string, duration?: number): void;
  error(message: string, duration?: number): void;
  info(message: string, duration?: number): void;
  warning(message: string, duration?: number): void;
  hide(): void;
  queue(message: string, type?: string, duration?: number | null): void;
  clearQueue(): void;
  clear(): void;
  init(): void;
}

/**
 * 详情管理器接口
 */
export interface IDetailManager {
  open(item: unknown, options?: unknown): Promise<void>;
  close(): void;
  setSafeState(isSafe: boolean): void;
}

/**
 * 图像全屏管理器接口
 */
export interface IImageFullscreenManager {
  open(images: unknown[], index: number): void;
  init(): void;
}

/**
 * 导航管理器接口
 */
export interface INavigationManager {
  getCurrentPanel(): string;
  switchTo(panel: string): void;
  switchToPromptManager(): void;
  switchToImageManager(): void;
  restorePanelState(): void;
  init(): void;
}

/**
 * 工具栏管理器接口
 */
export interface IToolbarManager {
  init(): void;
}

/**
 * 搜索排序管理器接口
 */
export interface ISearchSortManager {
  init(): void;
  getPromptSearchQuery(): string;
  getImageSearchQuery(): string;
}

/**
 * 导入导出管理器接口
 */
export interface IImportExportManager {
  init(): void;
  exportOrphanFiles(): Promise<boolean>;
  exportFullBackup(): Promise<boolean>;
  importFullBackup(): Promise<boolean>;
}

/**
 * 设置管理器接口
 */
export interface ISettingsManager {
  init(): void;
  openModal(): Promise<void>;
  closeModal(): void;
}

/**
 * 图像选择器管理器接口
 */
export interface IImageSelectorManager {
  open(options?: { onConfirm?: (image: IImage) => void | Promise<void> }): Promise<void>;
}

/**
 * 新建提示词管理器接口
 */
export interface INewPromptManager {
  open(prefillImages?: unknown[], options?: unknown): Promise<void>;
}

/**
 * 图像上传管理器接口
 */
export interface IImageUploadManager {
  open(): void;
  bindEvents(): void;
}

/**
 * 快捷键管理器接口
 */
export interface IShortcutManager {
  bind(): void;
}

/**
 * Hover Tooltip 管理器接口
 */
export interface IHoverTooltipManager {
  bind(selector: string, options: {
    getContent: (element: Element) => string;
    getImageId: (element: Element) => string | null;
    delay: number;
  }): void;
}

/**
 * 应用主类接口 (PromptManager)
 */
export interface IApp {
  // 面板管理器（在 init 后可用）
  promptPanelManager: IPanelManager | null;
  imagePanelManager: IPanelManager | null;

  // 缓存
  cacheManager: ICacheManager;  
  promptRefImagesCache: LRUCache;

  // 其他管理器（在 init 后可用）
  trashManager: { loadTrash: () => Promise<void> } | null;
  toastManager: IToastManager | null;
  promptTagManager: any | null;
  imageTagManager: any | null;
  promptDetailManager: IDetailManager | null;
  imageDetailManager: IDetailManager | null;
  imageFullscreenManager: IImageFullscreenManager | null;
  navigationManager: INavigationManager | null;
  toolbarManager: IToolbarManager | null;
  searchSortManager: ISearchSortManager | null;
  importExportManager: IImportExportManager | null;
  settingsManager: ISettingsManager | null;
  imageSelectorManager: IImageSelectorManager | null;
  newPromptManager: INewPromptManager | null;
  imageUploadManager: IImageUploadManager | null;
  shortcutManager: IShortcutManager | null;
  promptHoverTooltip: IHoverTooltipManager | null;

  // 状态
  currentPanel: string;
  isFromDetailJump: boolean;
  viewMode: string;

  // 标签排序状态
  promptTagSortBy: string;
  promptTagSortOrder: string;
  imageTagSortBy: string;
  imageTagSortOrder: string;
  imageSelectorSortBy: string;
  imageSelectorSortOrder: string;

  // 事件总线
  eventBus: IEventBus;

  // 方法
  isSameId(id1: string | number, id2: string | number): boolean;
  showToast(message: string, type?: string): void;
  renderStatistics(): Promise<void>;
  refreshData(): Promise<void>;
  toggleViewMode(): Promise<void>;
  openStatisticsModal(): Promise<void>;
  closeStatisticsModal(): void;
  openEditPromptModal(prompt: IPrompt, options?: unknown): Promise<void>;
  openImageDetailModal(image: IImage, options?: unknown): Promise<void>;
  openFullscreen(images: Array<{ id?: string; relativePath?: string; fileName?: string }>, index: number): Promise<void>;
  findPromptById(id: string): unknown | null;
  findImageById(id: string, allImages?: Array<{ id: string }> | null): { id: string } | null;
  generateUniqueTimestamp(): string;
  savePromptField(field: string, value: unknown): Promise<void>;
  updatePromptFavoriteBtnUI(isFavorite: boolean): void;
  updateImageDetailFavoriteBtnUI(isFavorite: boolean): void;
  renderImageDetailInfo(image: unknown): Promise<void>;
  autoResizeTextarea(element: HTMLElement | null): void;
  relaunchApp(oldDataDir?: string): Promise<void>;
  on(event: string, callback: (data?: unknown) => void): void;
  off(event: string, callback: (data?: unknown) => void): void;
  emit(event: string, data?: unknown): void;
  openImageTagManagerModal: () => void;
  openPromptTagManagerModal: () => void;
}

/**
 * TrashManager 配置选项
 */
export interface ITrashManagerOptions {
  app: IApp;
  eventBus: IEventBus;
}

/**
 * 扩展 Window 接口
 * IElectronAPI 类型从 preload/index.ts 导入
 */
declare global {
  interface Window {
    app: IApp;
    dialogService: typeof DialogService;
  }
}
