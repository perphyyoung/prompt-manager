import type { LRUCache } from '../utils/LRUCache.ts';
import type { ITagRegistry, ITagService, IPrompt, IImage } from '../types/entities.ts';
import type { DialogService } from './services/DialogService.ts';

// 重新导出类型
export type { ITagRegistry, ITagService, IPrompt, IImage };

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
  selectedIds: Set<string>;
  lastSelectedIndex: number;
  refreshAfterUpdate(): Promise<void>;
  updateToolbarUI(): void;
  exitBatchMode(): void;
}

/**
 * 输入框结果接口
 */
export interface IInputResult {
  value: string;
  confirmed: boolean;
}

/**
 * 模态框管理器接口
 */
export interface IModalManager {
  openTrashModal(type: string): void;
  closeTrashModal(type: string): void;
  openSettings(): void;
  closeSettings(): void;
  openPromptTagManager(): void;
  closePromptTagManager(): void;
  openImageTagManager(): void;
  closeImageTagManager(): void;
  showInput(title: string, label: string, defaultValue?: string, options?: unknown): Promise<string | IInputResult | null>;
  closeInput(): void;
  closeSelect(): void;
  init?(): void;
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
  on(event: string, callback: (data?: unknown) => void): void;
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
 * 图像右键菜单管理器接口
 */
export interface IImageContextMenuManager {
  show(options: { x: number; y: number; image: IImage }): void;
}

/**
 * 快捷键管理器接口
 */
export interface IShortcutManager {
  bind(): void;
}

/**
 * 标签组模态框管理器接口
 */
export interface ITagGroupModalManager {
  openEdit(type: string): void;
  init(): void;
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
  // 面板管理器
  promptPanelManager: IPanelManager;
  imagePanelManager: IPanelManager;

  // 其他管理器
  modalManager: IModalManager;
  cacheManager: ICacheManager;
  trashManager: unknown;
  toastManager: IToastManager;
  promptTagRegistry: ITagRegistry;
  imageTagRegistry: ITagRegistry;
  promptDetailManager: IDetailManager;
  imageDetailManager: IDetailManager;
  imageFullscreenManager: IImageFullscreenManager;
  navigationManager: INavigationManager;
  toolbarManager: IToolbarManager;
  searchSortManager: ISearchSortManager;
  importExportManager: IImportExportManager;
  settingsManager: ISettingsManager;
  imageSelectorManager: IImageSelectorManager;
  newPromptManager: INewPromptManager;
  imageUploadManager: IImageUploadManager;
  imageContextMenuManager?: IImageContextMenuManager;
  shortcutManager: IShortcutManager;
  tagGroupModalManager: ITagGroupModalManager;
  promptHoverTooltip: IHoverTooltipManager;

  // 状态
  currentPanel: string;
  isFromDetailJump: boolean;
  viewMode: string;
  searchQuery: string;
  selectedTags: Set<string>;
  imageSearchQuery: string;

  // 缓存
  promptCache: LRUCache;
  imageCache: LRUCache;
  currentImagesCache: LRUCache;

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
  showToast(message: string, type?: string): void;
  renderStatistics(): Promise<void>;
  refreshData(): Promise<void>;
  toggleViewMode(): Promise<void>;
  openSettingsModal(): Promise<void>;
  closeSettingsModal(): void;
  openStatisticsModal(): Promise<void>;
  closeStatisticsModal(): void;
  openEditPromptModal(prompt: IPrompt, options?: unknown): Promise<void>;
  openImageDetailModal(image: IImage, options?: unknown): Promise<void>;
  findPromptById(id: string): unknown | null;
  findImageById(id: string, allImages?: unknown[] | null): unknown | null;
  generateUniqueTimestamp(): string;
  addImageToCurrentPrompt(selectedImage: unknown): Promise<void>;
  renderImagePreviews(): Promise<void>;
  savePromptField(field: string, value: unknown): Promise<void>;
  updatePromptFavoriteBtnUI(isFavorite: boolean): void;
  updateImageDetailFavoriteBtnUI(isFavorite: boolean): void;
  renderImageDetailInfo(image: unknown): Promise<void>;
  autoResizeTextarea(element: HTMLElement | null): void;
  generateTagsHtml(tags: string[], className: string, emptyClassName: string): string;
  relaunchApp(oldDataDir?: string): Promise<void>;
  on(event: string, callback: (data?: unknown) => void): void;
  off(event: string, callback: (data?: unknown) => void): void;
  emit(event: string, data?: unknown): void;
  switchToPromptManager(): void;
  switchToImageManager(): void;
  closeImageTagManagerModal(): void;
  updatePromptViewButtons(mode: string): void;
  updateImageViewButtons(mode: string): void;
  togglePromptTagFilter(): Promise<void>;
  toggleImageTagFilter(): Promise<void>;
  closeConfirmModal(): void;
  showInputDialog(title: string, label: string, defaultValue?: string, options?: unknown): Promise<string | null>;
  closeInputModal(): void;
  closeSelectModal(): void;
  handlePromptItemSelection(promptId: string, index: number, e: MouseEvent): void;
  displayedImages?: unknown[];
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

export {};
