/**
 * 重构版应用主类
 * 作为协调器，整合各个面板管理器
 */

import { Constants, Events } from '../constants.ts';
import { DialogService, DialogConfig } from './services/index.ts';
import {
  PromptPanelManager, ImagePanelManager,
  PromptTagManager, ImageTagManager, TagManager, TrashManager, ImageFullscreenManager,
  PromptDetailManager, ImageDetailManager,
  ToastManager, NavigationManager,
  SearchSortManager, ToolbarManager,
  ImportExportManager, SettingsManager,
  ImageSelectorManager, NewPromptManager,
  ImageUploadManager,
  StatisticsManager
} from './managers/index.ts';

import eventBus from '../utils/EventBus.ts';
import { HtmlUtils, isSameId, cacheManager } from '../utils/index.ts';
import { HoverTooltipManager, ShortcutManager, SaveManager, PromptSaveStrategy } from './renderer_utils/index.ts';
import type { ITagRegistry, IPrompt, IImage } from '../types/entities.ts';
import type {
  IApp,
  IPanelManager,
  IToastManager,
  IDetailManager,
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
  ICacheManager
} from './app.types.ts';

// ==================== 主应用类 ====================

/**
 * 主应用类 - 协调器
 * 负责初始化和管理各个子模块，处理全局事件和状态
 */
class PromptManager implements IApp {
  // 缓存管理器
  cacheManager: ICacheManager;

  // 缓存
  promptCache: ReturnType<typeof cacheManager.getPromptCache>;
  imageCache: ReturnType<typeof cacheManager.getImageCache>;
  currentImagesCache: ReturnType<typeof cacheManager.createCache>;

  // 状态
  viewMode: string;
  searchQuery: string;
  selectedTags: Set<string>;
  imageSearchQuery: string;

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
  hoverTooltip: unknown | null = null;
  promptHoverTooltip: IHoverTooltipManager | null = null;

  // 统计管理器（在 initPanelManagers 中初始化）
  statisticsManager: StatisticsManager | null = null;

  // 其他
  isFromDetailJump: boolean;
  private _saveLocks?: Set<string>;
  private confirmResolve?: ((value: boolean) => void) | null;

  constructor() {
    // ========== 基本状态初始化 ==========

    // 缓存管理器
    this.cacheManager = cacheManager;

    // 使用 CacheManager 管理缓存
    this.promptCache = cacheManager.getPromptCache();
    this.imageCache = cacheManager.getImageCache();
    this.currentImagesCache = cacheManager.createCache('currentImages', 100);

    // 从 localStorage 加载 viewMode（在创建面板管理器之前）
    this.viewMode = localStorage.getItem(Constants.LocalStorageKey.VIEW_MODE) || 'safe';
    this.searchQuery = '';
    this.selectedTags = new Set();
    this.imageSearchQuery = '';

    // 标签管理排序状态
    this.promptTagSortBy = localStorage.getItem(Constants.LocalStorageKey.PROMPT_TAG_SORT_BY) || 'count';
    this.promptTagSortOrder = localStorage.getItem(Constants.LocalStorageKey.PROMPT_TAG_SORT_ORDER) || 'desc';
    this.imageTagSortBy = localStorage.getItem(Constants.LocalStorageKey.IMAGE_TAG_SORT_BY) || 'count';
    this.imageTagSortOrder = localStorage.getItem(Constants.LocalStorageKey.IMAGE_TAG_SORT_ORDER) || 'desc';

    // 图像选择器排序状态（独立设置）
    this.imageSelectorSortBy = localStorage.getItem(Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_BY) || 'updatedAt';
    this.imageSelectorSortOrder = localStorage.getItem(Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_ORDER) || 'desc';

    // 事件总线（单例）
    this.eventBus = eventBus;

    // 当前面板状态 (由 NavigationManager 管理)
    this.currentPanel = 'prompt'; // 默认打开提示词面板

    // UI 组件
    this.hoverTooltip = null;

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

    // 加载数据（初始化，不刷新）
    await this.loadData(false);

    // 恢复上次打开的面板（会触发当前面板的渲染）
    this.navigationManager?.restorePanelState();
  } catch (error) {
    window.electronAPI.logError('App', 'Failed to initialize application:', error);
    this.showToast('应用初始化失败', 'error');
  }
}

  /**
   * 恢复主题
   */
  restoreTheme() {
    const savedTheme = localStorage.getItem(Constants.LocalStorageKey.THEME) || 'dark';
    const html = document.documentElement;
    html.setAttribute('data-theme', savedTheme);

    // 更新主题按钮文本
    const themeToggle = document.getElementById('settingsThemeToggle');
    if (themeToggle) {
      themeToggle.innerHTML = savedTheme === 'dark'
        ? '<span>☀️</span> 明亮'
        : '<span>🌙</span> 暗黑';
    }
  }

  /**
   * 初始化 Hover Tooltip
   */
  initHoverTooltips() {
    // 提示词预览 tooltip（左右布局，同时显示内容和图像）
    this.promptHoverTooltip = new HoverTooltipManager('promptPreviewTooltip', 'promptPreviewContent', 'promptPreviewImage');
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
      containerId: 'toastContainer',
      messageId: 'toastMessage'
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
    this.promptPanelManager = new PromptPanelManager({
      app: this as IApp,
      tagManager: this.promptTagManager,
      saveManager: new SaveManager({
        strategy: new PromptSaveStrategy(this as IApp),
        itemId: '',
        onAfterSave: () => {
          this.showToast('保存成功', 'success');
        }
      })
    });

    // 初始化图像面板管理器
    this.imagePanelManager = new ImagePanelManager({
      app: this as IApp,
      tagManager: this.imageTagManager
    });

    // ========== 4. 功能管理器 ==========

    // 初始化回收站管理器
    this.trashManager = new TrashManager({
      app: this as IApp,
      eventBus: this.eventBus
    });
    await this.trashManager.init();

    // 初始化图像全屏查看器管理器
    this.imageFullscreenManager = new ImageFullscreenManager({ app: this as IApp });
    this.imageFullscreenManager.init();

    // 初始化详情管理器
    this.promptDetailManager = new PromptDetailManager({
      app: this as IApp,
      tagRegistry: this.promptTagManager
    });
    this.imageDetailManager = new ImageDetailManager({
      app: this as IApp,
      tagRegistry: this.imageTagManager
    });

    // 初始化导航管理器
    this.navigationManager = new NavigationManager({
      app: this as IApp,
      storageKey: 'currentPanel',
      defaultPanel: 'prompt'
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
      dataClearApi: window.electronAPI
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
    await Promise.all([
      this.promptPanelManager?.init?.(),
      this.imagePanelManager?.init?.()
    ]);
  }

  /**
   * 同步 currentPanel 引用
   * 保持与 NavigationManager 的同步
   */
  syncCurrentPanel() {
    Object.defineProperty(this, 'currentPanel', {
      get: () => this.navigationManager?.getCurrentPanel() || 'prompt',
      set: (value) => {
        if (this.navigationManager) {
          this.navigationManager.switchTo(value);
        }
      }
    });
  }

  /**
   * 加载数据
   * @param refresh - 是否强制刷新面板
   */
  async loadData(refresh = false) {
    // 数据已由面板管理器加载到 CacheManager
    // 但某些操作（如上传图像）可能需要刷新面板
    if (refresh) {
      if (this.promptPanelManager) {
        await this.promptPanelManager.loadData?.();
        await this.promptPanelManager.renderView();
      }
      if (this.imagePanelManager) {
        await this.imagePanelManager.loadData?.();
        await this.imagePanelManager.renderView();
      }
    }
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

    // 同步标签按钮（需要同时访问两个注册表）
    this.bindSyncTagButtons();

    // 文本全选全局事件
    this.bindTextSelectEvents();
  }

  /**
   * 绑定文本全选事件（Ctrl+A）
   * 使用事件委托处理所有文本编辑框和查看框
   */
  bindTextSelectEvents() {
    document.addEventListener('keydown', (e) => {
      // 检查是否按下了 Ctrl+A (或 Cmd+A on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const target = e.target as HTMLElement;

        // 检查目标是否是文本输入框或文本查看框
        const isTextInput = target.tagName === 'INPUT' &&
          ['text', 'search', 'url', 'email', 'password', 'number'].includes((target as HTMLInputElement).type);
        const isTextArea = target.tagName === 'TEXTAREA';
        const isContentEditable = target.isContentEditable;
        const isTextViewer = target.classList.contains('prompt-content');

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
   * 绑定同步标签按钮事件（需要同时访问两个注册表）
   */
  bindSyncTagButtons() {
    // 同步标签按钮（双向同步）- 提示词面板
    TagManager.bindSyncButton(
      'syncPromptTagsBtn',
      this.promptTagManager,
      this.imageTagManager,
      this
    );

    // 同步标签按钮（双向同步）- 图像面板
    TagManager.bindSyncButton(
      'syncImageTagsBtn',
      this.promptTagManager,
      this.imageTagManager,
      this
    );
  }

  /**
   * 切换视图模式（safe/nsfw）
   */
  async toggleViewMode() {
    this.viewMode = this.viewMode === 'safe' ? 'nsfw' : 'safe';

    // 重新渲染
    await this.promptPanelManager?.renderView();
    await this.promptPanelManager?.renderTagFilters();
    await this.imagePanelManager?.renderView();
    await this.imagePanelManager?.renderTagFilters();

    // 刷新统计
    await this.renderStatistics();

    this.showToast(`已切换到${this.viewMode === 'safe' ? '安全' : 'NSFW'}模式`, 'success');
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

      // 刷新统计
      await this.renderStatistics();

      this.showToast('数据已刷新', 'success');
    } catch (error) {
      window.electronAPI.logError('App', 'Failed to refresh data:', error);
      this.showToast('刷新失败', 'error');
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
      window.electronAPI.logError('App', 'Failed to relaunch app:', error);
      this.showToast('重启失败', 'error');
    }
  }

  /**
   * 显示提示消息
   * @param message - 消息内容
   * @param type - 类型 (success, error, info, warning)
   */
  showToast(message: string, type = 'info') {
    this.toastManager?.show(message, type);
  }

  /**
   * 打开编辑提示词模态框
   * @param prompt - 提示词对象
   * @param options - 选项
   */
  async openEditPromptModal(prompt: IPrompt, options = {}) {
    await this.promptDetailManager?.open(prompt as { id: string; title: string; content: string; [key: string]: unknown }, options);
  }

  /**
   * 生成唯一的时间戳标题
   * @returns 唯一的时间戳字符串
   */
  generateUniqueTimestamp() {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${year}${month}${day}_${hour}${minute}${second}_${ms}`;
  }

  /**
   * 加载提示词列表
   */
  async loadPrompts() {
    try {
      const prompts = await window.electronAPI.getPrompts(this.promptTagSortBy, this.promptTagSortOrder);
      cacheManager.cachePrompts(prompts);
      // 同步到面板管理器
      if (this.promptPanelManager) {
        await this.promptPanelManager.renderView();
        await this.promptPanelManager.renderTagFilters();
      }
    } catch (error) {
      window.electronAPI.logError('App', 'Failed to load prompts:', error);
      cacheManager.getPromptCache().clear();
      if (this.promptPanelManager) {
        await this.promptPanelManager.renderView();
        await this.promptPanelManager.renderTagFilters();
      }
    }
  }

  /**
   * 更新提示词编辑界面收藏按钮的 UI 状态
   * @param isFavorite - 是否收藏
   */
  updatePromptFavoriteBtnUI(isFavorite: boolean) {
    const btn = document.getElementById('promptDetailFavoriteBtn');
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
   * 打开图像详情模态框
   * @param image - 图像对象
   */
  async openImageDetailModal(image: IImage, options = {}) {
    await this.imageDetailManager?.open(image as { id: string; fileName: string; relativePath: string; [key: string]: unknown }, options);
  }

  /**
   * 更新图像详情界面收藏按钮的 UI 状态
   * @param isFavorite - 是否收藏
   */
  updateImageDetailFavoriteBtnUI(isFavorite: boolean) {
    const btn = document.getElementById('imageDetailFavoriteBtn');
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
   * 渲染图像详情信息
   * @param image - 图像对象
   */
  async renderImageDetailInfo(image: { id: string; updatedAt?: string; createdAt?: string; width?: number; height?: number; fileSize?: number; relativePath?: string; fileName?: string }) {
    // 更新时间
    const updatedAtEl = document.getElementById('imageDetailUpdatedAt');
    if (updatedAtEl) {
      updatedAtEl.textContent = image.updatedAt || '-';
    }

    // 上传时间
    const createdAtEl = document.getElementById('imageDetailCreatedAt');
    if (createdAtEl) {
      createdAtEl.textContent = image.createdAt || '-';
    }

    // 图像尺寸
    const dimensionsEl = document.getElementById('imageDetailDimensions');
    if (dimensionsEl) {
      dimensionsEl.textContent = image.width && image.height ? `${image.width} × ${image.height}` : '-';
    }

    // 文件大小
    const fileSizeEl = document.getElementById('imageDetailFileSize');
    if (fileSizeEl) {
      fileSizeEl.textContent = image.fileSize ? HtmlUtils.formatFileSize(image.fileSize) : '-';
    }

    // 设置图像 - 异步获取完整路径
    // 使用 relativePath（原图路径），与重构前一致
    const imgEl = document.getElementById('imageDetailImg') as HTMLImageElement | null;
    const imagePath = image.relativePath;
    if (imgEl && imagePath) {
      try {
        const fullPath = await window.electronAPI.getImagePath(imagePath);
        imgEl.src = `file://${fullPath.replace(/"/g, '&quot;')}`;
        imgEl.alt = image.fileName || '图像';

        // 绑定双击事件 - 打开全屏查看器
        imgEl.ondblclick = () => {
          // 使用当前快照中的图像列表
          const itemsSnapshot = this.imageDetailManager?.getItemsSnapshot();
          if (itemsSnapshot && itemsSnapshot.length > 0) {
            // 找到当前图像在列表中的索引
            const currentIndex = itemsSnapshot.findIndex(i => isSameId((i as { id: string }).id, image.id));
            this.imageFullscreenManager?.open(itemsSnapshot, currentIndex >= 0 ? currentIndex : 0);
          } else {
            // 如果没有快照，只显示当前图像
            const singleImage = [{
              id: image.id,
              relativePath: image.relativePath,
              fileName: image.fileName
            }];
            this.imageFullscreenManager?.open(singleImage, 0);
          }
        };
      } catch (error) {
        window.electronAPI.logError('App', 'Failed to load image:', error);
        imgEl.alt = '加载图像失败';
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
      return allImages.find(img => isSameId(img.id, id)) || null;
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
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
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
   * 添加图像到当前提示词
   * @param selectedImage - 选择的图像
   */
  async addImageToCurrentPrompt(selectedImage: { id: string; path: string }) {
    // 检查是否已存在
    const existing = this.currentImagesCache.get(String(selectedImage.id));
    if (!existing) {
      this.currentImagesCache.set(String(selectedImage.id), {
        id: selectedImage.id,
        path: selectedImage.path,
        isExisting: true
      });

      // 触发图像预览重新渲染事件
      document.dispatchEvent(new CustomEvent('renderImagePreviews'));

      this.showToast('Image added');

      // 立即保存到数据库
      const promptIdEl = document.getElementById('promptDetailId') as HTMLInputElement | null;
      const promptId = promptIdEl?.value;
      if (promptId) {
        const updatedImages = Array.from(this.currentImagesCache.values());
        await this.savePromptField('images', updatedImages);
      }
    } else {
      this.showToast('Image already exists', 'info');
    }
  }

  /**
   * 保存提示词字段
   * @param field - 字段名
   * @param value - 字段值
   */
  async savePromptField(field: string, value: unknown) {
    const promptIdEl = document.getElementById('promptDetailId') as HTMLInputElement | null;
    const promptId = promptIdEl ? promptIdEl.value : null;

    if (!promptId) {
      window.electronAPI.logError('App', '[savePromptField] Prompt ID not found');
      return;
    }

    const lockKey = `savePromptField_${promptId}_${field}`;
    if (this._saveLocks?.has(lockKey)) {
      return;
    }
    if (!this._saveLocks) this._saveLocks = new Set();
    this._saveLocks.add(lockKey);

    try {
      const updateData: Record<string, unknown> = {};
      if (field === 'images') {
        updateData[field] = value ? (value as Array<Record<string, unknown>>).map(img => ({ ...img })) : [];
      } else {
        updateData[field] = value;
      }

      await window.electronAPI.updatePrompt(promptId, updateData);

      const cachedPrompt = cacheManager.getCachedPrompt(promptId);
      if (cachedPrompt) {
        Object.assign(cachedPrompt, updateData);
      }

      if (field === 'images' && value) {
        (value as Array<{ id?: string }>).forEach(img => {
          if (img.id) {
            const cachedImage = cacheManager.getCachedImage(img.id);
            if (cachedImage) {
              (cachedImage as { promptRefs?: unknown[] }).promptRefs = (cachedPrompt as { images?: Array<{ id: string }> })?.images?.filter(
                i => i.id === (cachedImage as { id: string }).id
              ) || [];
            }
          }
        });
      }

      // 通过事件通知刷新，避免直接调用导致的重复刷新
      this.eventBus.emit(Events.PROMPTS_CHANGED);
      this.eventBus.emit(Events.IMAGES_CHANGED);
    } finally {
      this._saveLocks?.delete(lockKey);
    }
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

  /**
   * 更新提示词视图按钮状态
   * @param mode - 视图模式 (grid, list, list-compact)
   */
  updatePromptViewButtons(mode: string) {
    const gridBtn = document.getElementById('promptGridViewBtn');
    const listBtn = document.getElementById('promptListViewBtn');
    const compactBtn = document.getElementById('promptCompactViewBtn');
    const promptGrid = document.getElementById('promptGrid');
    const promptList = document.getElementById('promptList');
    const cardSizeSlider = document.getElementById('promptCardSizeSlider');
    const cardSizeSliderContainer = cardSizeSlider?.closest('.thumbnail-size-slider') as HTMLElement | null;

    // 更新按钮状态
    if (gridBtn) gridBtn.classList.toggle('active', mode === 'grid');
    if (listBtn) listBtn.classList.toggle('active', mode === 'list');
    if (compactBtn) compactBtn.classList.toggle('active', mode === 'list-compact');

    // 更新容器显示状态
    if (mode === 'grid') {
      if (promptGrid) promptGrid.style.display = 'grid';
      if (promptList) promptList.style.display = 'none';
      // 显示卡片尺寸滑杆
      if (cardSizeSliderContainer) {
        cardSizeSliderContainer.style.display = 'flex';
      }
    } else {
      if (promptGrid) promptGrid.style.display = 'none';
      if (promptList) promptList.style.display = 'flex';
      // 隐藏卡片尺寸滑杆（列表视图不需要）
      if (cardSizeSliderContainer) {
        cardSizeSliderContainer.style.display = 'none';
      }
    }
  }

  /**
   * 更新图像视图按钮状态
   * @param mode - 视图模式 (grid, list, list-compact)
   */
  updateImageViewButtons(mode: string) {
    const gridBtn = document.getElementById('imageGridViewBtn');
    const listBtn = document.getElementById('imageListViewBtn');
    const compactBtn = document.getElementById('imageCompactViewBtn');
    const imageGrid = document.getElementById('imageGrid');
    const imageList = document.getElementById('imageList');
    const imageCardSizeSlider = document.getElementById('imageCardSizeSlider');
    const imageCardSizeSliderContainer = imageCardSizeSlider?.closest('.thumbnail-size-slider') as HTMLElement | null;

    // 更新按钮状态
    if (gridBtn) gridBtn.classList.toggle('active', mode === 'grid');
    if (listBtn) listBtn.classList.toggle('active', mode === 'list');
    if (compactBtn) compactBtn.classList.toggle('active', mode === 'list-compact');

    // 更新容器显示状态
    if (mode === 'grid') {
      if (imageGrid) imageGrid.style.display = 'grid';
      if (imageList) imageList.style.display = 'none';
      // 显示缩略图尺寸滑杆
      if (imageCardSizeSliderContainer) {
        imageCardSizeSliderContainer.style.display = 'flex';
      }
    } else {
      if (imageGrid) imageGrid.style.display = 'none';
      if (imageList) imageList.style.display = 'flex';
      // 隐藏缩略图尺寸滑杆（列表视图不需要）
      if (imageCardSizeSliderContainer) {
        imageCardSizeSliderContainer.style.display = 'none';
      }
    }
  }
}

// 初始化应用
const app = new PromptManager();
window.app = app;

// 暴露 DialogService 供 main 进程调用
window.dialogService = DialogService;

// 全局错误处理 - 未捕获的 Promise 错误
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const message = error?.message || error?.toString() || 'Unknown unhandled rejection';
  window.electronAPI?.logError('Renderer', `Unhandled Promise Rejection: ${message}`, error);
});

// 全局错误处理 - 未捕获的同步错误
window.onerror = (message, source, lineno, colno, error) => {
  const errorMsg = error?.message || message;
  window.electronAPI?.logError('Renderer', `Uncaught Error: ${errorMsg}`, error);
  return false;
};

// DOM 加载完成后初始化
async function initApp() {
  await app.init();
  const oldDataDir = await window.electronAPI.getOldDataDir();
  if (oldDataDir) {
    DialogService.showConfirmDialogByConfig(
      DialogConfig.DATA_RESET,
      { oldDataDir }
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initApp());
} else {
  initApp();
}

export default PromptManager;
