/**
 * 提示词详情管理器
 * 负责管理提示词详情模态框
 */
import { DetailViewManager } from './DetailViewManager.ts';
import { validateTitle, cacheManager } from '../../utils/index.ts';
import { SaveManager, PromptSaveStrategy } from '../renderer_utils/index.ts';
import { Constants } from '../../constants.ts';
import { DirectSaveStrategy, TagAutocomplete } from '../services/index.ts';
import { SimpleTagManagerFactory } from './SimpleTagManagerFactory.ts';
import { EditableTagList, BatchTagManager } from '../components/index.ts';
import { IPrompt, IImage } from '../../types/entities.ts';
import type { LRUCache } from '../../utils/LRUCache.ts';

// 扩展 IPrompt 接口以包含更多字段
interface IPromptExtended extends IPrompt {
  contentTranslate?: string;
  note?: string;
}

// 图像选择结果
interface IImageSelectionResult {
  success: boolean;
  message?: string;
  images: IImage[];
}

// 图像操作结果
interface IImageOperationResult {
  success: boolean;
  images: IImage[];
}

// 选项接口
interface IOpenOptions {
  filteredList?: IPromptExtended[];
  returnToManager?: DetailViewManager | null;
  returnToItem?: unknown;
}

// 可刷新面板管理器接口
interface IRefreshablePanelManager {
  refreshAfterUpdate: () => Promise<void>;
}

// App 类型定义
interface IApp {
  isFromDetailJump: boolean;
  currentImagesCache: LRUCache<IImage>;
  promptPanelManager: IRefreshablePanelManager | null;
  eventBus?: {
    emit: (event: string) => void;
  } | null;
  showToast: (message: string, type?: string) => void;
  autoResizeTextarea: (element: HTMLElement) => void;
  renderImagePreviews?: () => Promise<void>;
  imageSelectorManager?: {
    open: (options: { onConfirm: (image: IImage) => void }) => void;
  } | null;
}

// PromptDetailManager 构造选项
interface IPromptDetailManagerOptions {
  app: IApp;
  tagRegistry: unknown;
}

export class PromptDetailManager extends DetailViewManager {
  private tagManager: unknown;
  private uploadStrategy: DirectSaveStrategy;
  private isOpeningDialog: boolean;
  private simpleTagManager: ReturnType<typeof SimpleTagManagerFactory.createForPrompt> | null = null;
  private editableTagList: EditableTagList | null = null;
  private batchTagManager: BatchTagManager | null = null;
  private tagAutocomplete: TagAutocomplete | null = null;
  private promptSaveManager: SaveManager | null = null;
  private favoriteBtnHandler: (() => void) | null = null;
  private returnToManager: DetailViewManager | null = null;
  private returnToItem: unknown = null;

  /**
   * @param options - 配置选项
   */
  constructor(options: IPromptDetailManagerOptions) {
    super({
      app: options.app as unknown as { constructor: { isSameId?: (id1: unknown, id2: unknown) => boolean }; [key: string]: unknown },
      modalId: 'promptDetailModal',
      closeBtnId: 'promptDetailCloseBtn'
    });

    this.tagManager = options.tagRegistry;

    // 图像上传策略（直接保存，适合频繁操作）
    this.uploadStrategy = new DirectSaveStrategy(this.app as unknown as Record<string, unknown>);

    // 防抖标志：防止重复打开文件对话框
    this.isOpeningDialog = false;
  }

  /**
   * 打开提示词详情模态框
   * @param prompt - 提示词对象
   * @param options - 选项
   */
  async open(prompt: IPromptExtended, options: IOpenOptions = {}): Promise<void> {
    const modal = document.getElementById(this.modalId);
    if (!modal) {
      window.electronAPI.logError('PromptDetailManager.ts', 'Prompt detail modal not found');
      return;
    }

    this.returnToManager = options.returnToManager || null;
    this.returnToItem = options.returnToItem;
    (this.app as unknown as IApp).isFromDetailJump = !!options.returnToManager;

    try {
      // 从缓存获取最新的提示词数据，确保 isSafe 是最新的
      const latestPrompt = cacheManager.getCachedPrompt(prompt.id) || prompt;

      this.currentItem = latestPrompt as unknown as { id: string | number; [key: string]: unknown };

      this.fillFormData(latestPrompt);

      this.setSafeState(latestPrompt.isSafe === 1);

      this.updateFavoriteBtnUI(!!latestPrompt.isFavorite);

      await this.loadImages(latestPrompt);

      this.initTagManager(latestPrompt);

      this.initSaveManager(latestPrompt);

      await this.initNavigatorForPrompt(latestPrompt, options);

      this.showModal();

      this.bindImageUploadEvents();

      this.autoResizeAllTextareas();
    } catch (error) {
      window.electronAPI.logError('PromptDetailManager.ts', 'Failed to open prompt detail modal:', error);
      (this.app as unknown as IApp).showToast('打开编辑界面失败', 'error');
    }
  }

  /**
   * 填充表单数据
   * @param prompt - 提示词对象
   * @private
   */
  private fillFormData(prompt: IPromptExtended): void {
    const idInput = document.getElementById('promptDetailId') as HTMLInputElement | null;
    const titleInput = document.getElementById('promptDetailTitle') as HTMLInputElement | null;
    const contentInput = document.getElementById('promptDetailContent') as HTMLTextAreaElement | null;
    const translateInput = document.getElementById('promptDetailTranslate') as HTMLTextAreaElement | null;
    const noteInput = document.getElementById('promptDetailNote') as HTMLTextAreaElement | null;

    if (idInput) idInput.value = prompt.id || '';
    if (titleInput) titleInput.value = prompt.title || '';
    if (contentInput) contentInput.value = prompt.content || '';
    if (translateInput) translateInput.value = prompt.contentTranslate || '';
    if (noteInput) noteInput.value = prompt.note || '';
  }

  /**
   * 设置安全状态
   * @param isSafe - 是否安全
   * @private
   */
  private setSafeState(isSafe: boolean): void {
    const safeToggle = document.getElementById('promptDetailSafeToggle') as HTMLInputElement | null;
    if (safeToggle) {
      safeToggle.checked = isSafe;
    }
  }

  /**
   * 更新收藏按钮 UI
   * @param isFavorite - 是否收藏
   */
  updateFavoriteBtnUI(isFavorite: boolean): void {
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
   * 加载图像
   * @param prompt - 提示词对象
   * @private
   */
  private async loadImages(prompt: IPromptExtended): Promise<void> {
    const app = this.app as unknown as IApp;
    // 清空 currentImages 缓存
    app.currentImagesCache.clear();
    if (prompt.images && Array.isArray(prompt.images)) {
      prompt.images.forEach(img => {
        if (img && img.id) {
          app.currentImagesCache.set(String(img.id), img as unknown as IImage);
        }
      });
    }

    // 调用 app 的方法渲染图像预览
    if (app.renderImagePreviews) {
      await app.renderImagePreviews();
    }
  }

  /**
   * 初始化标签管理器
   * @param prompt - 提示词对象
   * @private
   */
  private initTagManager(prompt: IPromptExtended): void {
    const app = this.app as unknown as IApp;

    // 清理旧的标签管理器
    if (this.simpleTagManager) {
      this.simpleTagManager = null;
    }

    // 清理旧的可编辑标签列表组件
    if (this.editableTagList) {
      this.editableTagList = null;
    }

    // 清理旧的批量标签管理器
    if (this.batchTagManager) {
      this.batchTagManager.destroy();
      this.batchTagManager = null;
    }

    // 使用工厂创建新的标签管理器
    this.simpleTagManager = SimpleTagManagerFactory.createForPrompt(
      prompt,
      app.promptPanelManager,
      (msg: string, type: string) => app.showToast(msg, type)
    );

    // 设置渲染回调
    this.simpleTagManager.onRender = () => {
      if (!this.editableTagList) {
        this.editableTagList = new EditableTagList({
          containerId: 'promptDetailTags',
          tagManager: this.simpleTagManager as { getTags: () => string[] },
          onRemove: async (tagName: string) => {
            await this.simpleTagManager?.removeTag(tagName);
          }
        });
      }
      this.editableTagList.renderWithInit();
    };

    // 设置初始标签
    this.simpleTagManager.setTags(prompt.tags || []);

    // 初始化批量标签管理器
    this.initBatchTagManager();

    // 绑定标签输入事件
    this.bindTagInputEvents();
  }

  /**
   * 初始化批量标签管理器
   * @private
   */
  private initBatchTagManager(): void {
    const app = this.app as unknown as IApp;

    this.batchTagManager = new BatchTagManager({
      containerId: 'promptDetailTags',
      batchBtnId: 'promptDetailBatchTagBtn',
      toolbarId: 'promptDetailBatchTagToolbar',
      countId: 'promptDetailBatchTagCount',
      deleteBtnId: 'promptDetailBatchTagDeleteBtn',
      cancelBtnId: 'promptDetailBatchTagCancelBtn',
      tagManager: this.simpleTagManager as { getTags: () => string[]; removeTags: (tags: string[]) => Promise<{ deleted: number }> },
      showToast: (msg: string, type: string) => app.showToast(msg, type),
      label: 'PromptDetailManager'
    });

    // 设置退出批量模式回调
    this.batchTagManager.setOnExitBatchMode(() => {
      this.editableTagList?.renderWithInit();
      // 显示输入区域
      const inputArea = document.getElementById('promptDetailTagInputArea');
      if (inputArea) inputArea.style.display = '';
    });

    this.batchTagManager.init();
  }

  /**
   * 绑定标签输入事件
   * @private
   */
  private bindTagInputEvents(): void {
    const app = this.app as unknown as IApp;

    // 清理旧的自动完成组件
    if (this.tagAutocomplete) {
      this.tagAutocomplete.destroy();
    }

    // 创建新的自动完成组件
    this.tagAutocomplete = new TagAutocomplete({
      inputId: 'promptDetailTagsInput',
      dropdownId: 'promptDetailTagAutocomplete',
      getTags: () => window.electronAPI.getAllTags(),
      onSelect: async (tagName: string) => {
        try {
          await this.simpleTagManager?.addTag(tagName);
          return true;
        } catch (error) {
          window.electronAPI.logError('PromptDetailManager.ts', 'Failed to add tag:', error);
          app.showToast(error instanceof Error ? error.message : '添加标签失败', 'error');
          return false;
        }
      },
      onBatchAdd: async (tagNames: string[]) => {
        try {
          if (tagNames.length === 1) {
            await this.simpleTagManager?.addTag(tagNames[0]);
          } else {
            await this.simpleTagManager?.addTags(tagNames);
          }
          return true;
        } catch (error) {
          window.electronAPI.logError('PromptDetailManager.ts', 'Failed to add tags:', error);
          app.showToast(error instanceof Error ? error.message : '添加标签失败', 'error');
          return false;
        }
      },
      containerSelector: '.prompt-tag-input-area'
    });

    this.tagAutocomplete.init();
  }

  /**
   * 初始化保存管理器
   * @param prompt - 提示词对象
   * @private
   */
  private initSaveManager(prompt: IPromptExtended): void {
    const app = this.app as unknown as IApp;

    // 清理旧的
    if (this.promptSaveManager) {
      this.promptSaveManager.destroy();
    }

    // 清理收藏按钮事件监听器
    if (this.favoriteBtnHandler) {
      const favoriteBtn = document.getElementById('promptDetailFavoriteBtn');
      if (favoriteBtn) {
        favoriteBtn.removeEventListener('click', this.favoriteBtnHandler);
      }
      this.favoriteBtnHandler = null;
    }

    // 创建保存策略
    const strategy = new PromptSaveStrategy(app as unknown as Record<string, unknown>);

    // 创建保存管理器
    this.promptSaveManager = new SaveManager({
      strategy,
      itemId: prompt.id,
      onAfterSave: async () => {
        // 通过事件通知刷新，避免直接调用导致的重复刷新
        app.eventBus?.emit('promptsChanged');
        app.eventBus?.emit('imagesChanged');
      }
    });

    // 注册所有字段
    this.registerFields(prompt);
  }

  /**
   * 注册所有字段到 SaveManager
   * @param prompt - 提示词对象
   * @private
   */
  private registerFields(prompt: IPromptExtended): void {
    const app = this.app as unknown as IApp;

    if (!this.promptSaveManager) return;

    // 1. 标题 - 防抖保存
    this.promptSaveManager.registerField('title', {
      saveMode: 'debounce',
      delay: 800,
      elementId: 'promptDetailTitle',
      statusId: 'promptDetailTitleStatus',
      validate: (value: unknown) => validateTitle(value as string)
    });

    // 2. 内容 - 防抖保存
    this.promptSaveManager.registerField('content', {
      saveMode: 'debounce',
      delay: 800,
      elementId: 'promptDetailContent',
      autoResize: true,
      statusId: 'promptDetailContentStatus'
    });

    // 3. 翻译 - 防抖保存
    this.promptSaveManager.registerField('contentTranslate', {
      saveMode: 'debounce',
      delay: 800,
      elementId: 'promptDetailTranslate',
      autoResize: true,
      statusId: 'promptDetailTranslateStatus'
    });

    // 4. 备注 - 防抖保存
    this.promptSaveManager.registerField('note', {
      saveMode: 'debounce',
      delay: 800,
      elementId: 'promptDetailNote',
      autoResize: true,
      statusId: 'promptDetailNoteStatus'
    });

    // 5. 安全状态 - 防抖保存
    this.promptSaveManager.registerField('isSafe', {
      saveMode: 'debounce',
      delay: 800,
      elementId: 'promptDetailSafeToggle',
      getValue: (element: HTMLElement) => (element as HTMLInputElement).checked ? 1 : 0,
      onChange: (value: unknown) => {
        app.showToast(value ? '已标记为安全' : '已标记为不安全', 'success');
      }
    });

    // 6. 收藏 - 防抖保存（通过按钮点击触发）
    this.promptSaveManager.registerField('isFavorite', {
      saveMode: 'debounce',
      delay: 800,
      onChange: (value: unknown) => {
        const boolValue = Boolean(value);
        // 更新 currentItem 的收藏状态
        if (this.currentItem) {
          (this.currentItem as unknown as IPromptExtended).isFavorite = boolValue ? 1 : 0;
        }
        this.updateFavoriteBtnUI(boolValue);
        app.showToast(boolValue ? '已收藏' : '已取消收藏', 'success');
      }
    });

    // 手动绑定收藏按钮点击事件
    const favoriteBtn = document.getElementById('promptDetailFavoriteBtn');
    if (favoriteBtn) {
      this.favoriteBtnHandler = async () => {
        const currentItem = this.currentItem as unknown as IPromptExtended;
        const newState = !currentItem?.isFavorite;
        await this.promptSaveManager?.triggerSave('isFavorite', newState, currentItem?.id);
      };
      favoriteBtn.addEventListener('click', this.favoriteBtnHandler);
    }
  }

  /**
   * 初始化提示词导航器
   * @param prompt - 提示词对象
   * @param options - 选项
   * @private
   */
  private async initNavigatorForPrompt(prompt: IPromptExtended, options: IOpenOptions = {}): Promise<void> {
    // 如果导航器已存在，先销毁旧的事件监听器
    if (this.navigator) {
      this.navigator.destroy();
    }

    // 记录当前提示词列表的快照
    const items = options.filteredList && options.filteredList.length > 0
      ? [...options.filteredList]
      : [];

    const onNavigate = async (targetPrompt: IPromptExtended) => {
      // 使用 targetPrompt，因为它来自快照，已经包含所需的图像信息
      // 但需要确保图像数据是最新的，从缓存中同步
      const latestPrompt = cacheManager.getCachedPrompt(targetPrompt.id);

      // 如果找到了最新的 prompt，使用它的 images 字段
      const nextPrompt = latestPrompt ? { ...targetPrompt, images: latestPrompt.images } : targetPrompt;

      // 强制重置 currentImages 缓存，确保导航时不会残留旧数据
      const app = this.app as unknown as IApp;
      app.currentImagesCache.clear();

      await this.updateView(nextPrompt);
    };

    this.initNavigator(
      prompt as unknown as { id: string | number; [key: string]: unknown },
      items as unknown as { id: string | number; [key: string]: unknown }[],
      {
        first: document.getElementById('promptDetailFirstNavBtn') || undefined,
        prev: document.getElementById('promptDetailPrevNavBtn') || undefined,
        next: document.getElementById('promptDetailNextNavBtn') || undefined,
        last: document.getElementById('promptDetailLastNavBtn') || undefined
      },
      onNavigate as unknown as (item: { id: string | number; [key: string]: unknown }) => void | Promise<void>
    );
  }

  /**
   * 获取导航按钮前缀
   * @returns 前缀
   */
  getNavButtonPrefix(): string {
    return 'promptDetail';
  }

  /**
   * 更新视图
   * @param prompt - 提示词对象
   */
  async updateView(prompt: IPromptExtended): Promise<void> {
    // 更新当前提示词
    this.currentItem = prompt as unknown as { id: string | number; [key: string]: unknown };

    // 填充表单数据
    this.fillFormData(prompt);

    // 设置安全状态
    this.setSafeState(prompt.isSafe === 1);

    // 更新收藏按钮
    this.updateFavoriteBtnUI(!!prompt.isFavorite);

    // 重新加载图像
    await this.loadImages(prompt);

    // 重新初始化标签管理器
    this.initTagManager(prompt);

    // 重新初始化保存管理器
    this.initSaveManager(prompt);

    // 自动调整文本框高度
    this.autoResizeAllTextareas();
  }

  /**
   * 自动调整所有文本框高度
   * @private
   */
  private autoResizeAllTextareas(): void {
    const app = this.app as unknown as IApp;
    ['promptDetailContent', 'promptDetailTranslate', 'promptDetailNote'].forEach(id => {
      const textarea = document.getElementById(id);
      if (textarea) {
        app.autoResizeTextarea(textarea);
      }
    });
  }

  /**
   * 绑定图像上传事件
   * @private
   */
  private bindImageUploadEvents(): void {
    const app = this.app as unknown as IApp;

    // 点击上传区域选择多图
    const uploadArea = document.getElementById('imageUploadArea');
    if (uploadArea) {
      uploadArea.addEventListener('click', async (e) => {
        if ((e.target as HTMLElement).closest('.remove-image')) return;
        await this.handleSelectImages();
      });

      // 禁止拖拽上传
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'none';
        }
      });
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
      });
    }

    document.getElementById('promptDetailSelectFromImageManagerBtn')?.addEventListener('click', () => {
      this.openImageSelectorForPrompt();
    });
  }

  /**
   * 处理选择多图并立即保存
   * @private
   */
  private async handleSelectImages(): Promise<void> {
    const app = this.app as unknown as IApp;

    // 防抖保护：防止重复打开文件对话框
    if (this.isOpeningDialog) {
      return;
    }

    this.isOpeningDialog = true;

    try {
      const filePaths = await window.electronAPI.openImageFiles();

      const result = await this.uploadStrategy.selectFiles(filePaths, 'prompt-detail') as IImageSelectionResult;
      if (!result.success) {
        if (result.message) {
          app.showToast(result.message, 'error');
        }
        return;
      }

      // 更新缓存并保存
      for (const image of result.images) {
        app.currentImagesCache.set(String(image.id), {
          id: image.id,
          fileName: image.fileName
        } as IImage);
      }

      // 更新全局图像缓存，确保 renderImagePreviews 能获取完整信息
      cacheManager.cacheImages(result.images);

      const promptIdInput = document.getElementById('promptDetailId') as HTMLInputElement | null;
      const promptId = promptIdInput?.value;
      if (promptId) {
        const updatedImages = Array.from(app.currentImagesCache.values());
        await this.savePromptField('images', updatedImages);
      }

      if (app.renderImagePreviews) {
        await app.renderImagePreviews();
      }
    } finally {
      // 延迟重置标志，确保对话框完全关闭
      setTimeout(() => {
        this.isOpeningDialog = false;
      }, 500);
    }
  }

  /**
   * 处理删除图像
   * @param index - 图像索引
   * @private
   */
  async handleRemoveImage(index: number): Promise<void> {
    const app = this.app as unknown as IApp;

    const result = await this.uploadStrategy.removeFile(index) as IImageOperationResult;
    if (result.success) {
      // 更新缓存
      app.currentImagesCache.clear();
      result.images.forEach(img => {
        app.currentImagesCache.set(String(img.id), img);
      });

      // 保存到数据库
      const promptIdInput = document.getElementById('promptDetailId') as HTMLInputElement | null;
      const promptId = promptIdInput?.value;
      if (promptId) {
        const updatedImages = Array.from(app.currentImagesCache.values());
        await this.savePromptField('images', updatedImages);
      }

      // 重新渲染
      if (app.renderImagePreviews) {
        await app.renderImagePreviews();
      }
    }
  }

  /**
   * 处理设为首张
   * @param index - 图像索引
   * @private
   */
  async handleSetFirst(index: number): Promise<void> {
    const app = this.app as unknown as IApp;

    const result = this.uploadStrategy.setFirst(index) as IImageOperationResult;
    if (result.success) {
      // 更新缓存
      app.currentImagesCache.clear();
      result.images.forEach(img => {
        app.currentImagesCache.set(String(img.id), img);
      });

      // 保存到数据库
      const promptIdInput = document.getElementById('promptDetailId') as HTMLInputElement | null;
      const promptId = promptIdInput?.value;
      if (promptId) {
        const updatedImages = Array.from(app.currentImagesCache.values());
        await this.savePromptField('images', updatedImages);
      }

      // 重新渲染
      if (app.renderImagePreviews) {
        await app.renderImagePreviews();
      }
    }
  }

  /**
   * 保存提示词字段
   * @param field - 字段名
   * @param value - 字段值
   * @private
   */
  private async savePromptField(field: string, value: unknown): Promise<void> {
    const app = this.app as unknown as IApp;

    const promptIdInput = document.getElementById('promptDetailId') as HTMLInputElement | null;
    const promptId = promptIdInput?.value;
    if (!promptId) return;

    try {
      const updates = { [field]: value };
      await window.electronAPI.updatePrompt(promptId, updates);

      app.eventBus?.emit('imagesChanged');
      app.eventBus?.emit('promptsChanged');
    } catch (error) {
      window.electronAPI.logError('PromptDetailManager', `Failed to save prompt field: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }

  /**
   * 打开图像选择器
   * @private
   */
  private async openImageSelectorForPrompt(): Promise<void> {
    const app = this.app as unknown as IApp;

    if (app.imageSelectorManager) {
      app.imageSelectorManager.open({
        onConfirm: (selectedImage: IImage) => {
          if (selectedImage && selectedImage.id) {
            if (!app.currentImagesCache.has(String(selectedImage.id))) {
              app.currentImagesCache.set(String(selectedImage.id), selectedImage);
            }

            app.renderImagePreviews?.();

            const promptIdInput = document.getElementById('promptDetailId') as HTMLInputElement | null;
            const promptId = promptIdInput?.value;
            if (promptId) {
              const updatedImages = Array.from(app.currentImagesCache.values());
              this.savePromptField('images', updatedImages);
            }
          }
        }
      });
    }
  }

  async close(): Promise<void> {
    const returnToManager = this.returnToManager;
    const returnToItem = this.returnToItem;
    const app = this.app as unknown as IApp;

    app.isFromDetailJump = false;

    // 清理图像缓存
    app.currentImagesCache.clear();

    await super.close();

    if (returnToManager && returnToItem) {
      // 如果返回管理器是 ImageDetailManager，调用 show() 显示已隐藏的模态框
      if ('hide' in returnToManager && 'show' in returnToManager) {
        (returnToManager as { show: () => void }).show();
      } else {
        await returnToManager.open(returnToItem as { id: string | number; [key: string]: unknown });
      }
    }
  }
}
