/**
 * 提示词详情管理器
 * 负责管理提示词详情模态框
 */
import { DetailViewManager } from './DetailViewManager.ts';
import type { IDetailTagManager } from '../../types/entities.ts';
import { validateTitle, cacheManager } from '../../utils/index.ts';
import { SaveManager, PromptSaveStrategy, ErrorHandler } from '../renderer_utils/index.ts';
import { Constants, Events } from '../../constants.ts';
import { DirectSaveStrategy, TagAutocomplete, DialogService, DialogConfig } from '../services/index.ts';
import { ImageContextMenuManager } from './ImageContextMenuManager.ts';
import { IPrompt, IImage } from '../../types/entities.ts';
import { TagExistsError, InvalidTagNameError, TagOperationError } from '../../pyTagGroups/index.ts';
import { TagService } from '../services/index.ts';
import type { IApp } from '../app.types.ts';

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

// 选项接口
interface IOpenOptions {
  filteredList?: IPromptExtended[];
  returnToManager?: DetailViewManager | null;
  returnToItem?: unknown;
}

// PromptDetailManager 构造选项
interface IPromptDetailManagerOptions {
  app: IApp;
}

export class PromptDetailManager extends DetailViewManager {
  private uploadStrategy: DirectSaveStrategy;
  private isOpeningDialog: boolean;
  private tagAutocomplete: TagAutocomplete | null = null;
  private promptSaveManager: SaveManager | null = null;
  private favoriteBtnHandler: (() => void) | null = null;
  private returnToManager: DetailViewManager | null = null;
  private returnToItem: unknown = null;
  private imageContextMenuManager: ImageContextMenuManager | null = null;
  private currentTags: string[] = [];
  protected app: IApp;

  /**
   * @param options - 配置选项
   */
  constructor(options: IPromptDetailManagerOptions) {
    super({
      app: options.app,
      modalId: Constants.Ids.PROMPT_DETAIL_MODAL,
      closeBtnId: Constants.Ids.PROMPT_DETAIL_CLOSE_BTN
    });

    this.app = options.app;
    // 图像上传策略（直接保存，适合频繁操作）
    this.uploadStrategy = new DirectSaveStrategy(this.app);
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
    this.app.isFromDetailJump = !!options.returnToManager;

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

      // 设置图像右键菜单回调
      this.initImageContextMenu();

      this.autoResizeAllTextareas();
    } catch (error) {
      ErrorHandler.handleError(
        { module: 'PromptDetailManager.ts', operation: 'open prompt detail modal' },
        error,
        { userMessage: '打开编辑界面失败' }
      );
    }
  }

  /**
   * 填充表单数据
   * @param prompt - 提示词对象
   * @private
   */
  private fillFormData(prompt: IPromptExtended): void {
    const idInput = document.getElementById(Constants.Ids.PROMPT_DETAIL_ID) as HTMLInputElement | null;
    const titleInput = document.getElementById(Constants.Ids.PROMPT_DETAIL_TITLE) as HTMLInputElement | null;
    const contentInput = document.getElementById(Constants.Ids.PROMPT_DETAIL_CONTENT) as HTMLTextAreaElement | null;
    const translateInput = document.getElementById(Constants.Ids.PROMPT_DETAIL_TRANSLATE) as HTMLTextAreaElement | null;
    const noteInput = document.getElementById(Constants.Ids.PROMPT_DETAIL_NOTE) as HTMLTextAreaElement | null;

    if (idInput) idInput.value = prompt.id || '';
    if (titleInput) titleInput.value = prompt.title || '';
    if (contentInput) contentInput.value = prompt.content || '';
    if (translateInput) translateInput.value = prompt.contentTranslate || '';
    if (noteInput) noteInput.value = prompt.note || '';
  }

  /**
   * 获取导航按钮前缀
   * @returns 前缀
   */
  getNavButtonPrefix(): string {
    return 'promptDetail';
  }

  /**
   * 获取收藏按钮元素 ID
   * @returns 收藏按钮的元素 ID
   */
  protected getFavoriteBtnId(): string {
    return Constants.Ids.PROMPT_DETAIL_FAVORITE_BTN;
  }

  /**
   * 获取安全状态切换元素 ID
   * @returns 安全状态切换的元素 ID
   */
  protected getSafeToggleId(): string {
    return Constants.Ids.PROMPT_DETAIL_SAFE_TOGGLE;
  }

  /**
   * 加载图像
   * @param prompt - 提示词对象
   * @private
   */
  private async loadImages(prompt: IPromptExtended): Promise<void> {
    // 清空 currentImages 缓存
    this.app.currentImagesCache.clear();

    // 同步图像到 uploadStrategy
    const images: unknown[] = [];
    if (prompt.images && Array.isArray(prompt.images)) {
      prompt.images.forEach(img => {
        if (img && img.id) {
          this.app.currentImagesCache.set(String(img.id), img as unknown as IImage);
          images.push(img);
        }
      });
    }

    // 同步到 uploadStrategy，使删除功能正常工作
    this.uploadStrategy.setSavedImages(images);

    // 渲染图像预览
    await this.renderImagePreviews();
  }

  /**
   * 初始化标签管理器
   * @param prompt - 提示词对象
   * @private
   */
  private initTagManager(prompt: IPromptExtended): void {
    this.currentTags = [...(prompt.tags || [])];

    const detailTagManager: IDetailTagManager = {
      getTags: () => this.currentTags,
      setTags: (tags: string[]) => {
        this.currentTags = tags;
      },
      removeTag: async (tagName: string) => {
        try {
          // 显示确认对话框
          const confirmed = await DialogService.showConfirmDialogByConfig(
            DialogConfig.DELETE_TAG,
            { name: tagName }
          );
          if (!confirmed) return false;

          const tagService = TagService.getInstance();
          const currentItem = this.currentItem as unknown as IPromptExtended;
          // 使用 unlinkTagFromItem 解除标签与项目的关联（会更新 updated_at）
          const success = await tagService.unlinkTagFromItem({
            type: 'prompt',
            itemId: currentItem?.id,
            tagName
          });
          if (success) {
            this.currentTags = this.currentTags.filter(t => t !== tagName);
            this.app.eventBus.emit(Events.PROMPTS_CHANGED);
            // 触发重新渲染标签列表
            detailTagManager.onRender?.();
          }
          return success;
        } catch (error) {
          ErrorHandler.handleError(
            { module: 'PromptDetailManager.ts', operation: 'delete tag' },
            error,
            { userMessage: '删除标签失败', logError: false }
          );
          return false;
        }
      },
      removeTags: async (tagNames: string[]) => {
        try {
          const tagService = TagService.getInstance();
          const result = await tagService.removeTags({ tagNames, type: 'prompt' });
          if (result.errors.length === 0) {
            for (const tagName of tagNames) {
              this.currentTags = this.currentTags.filter(t => t !== tagName);
            }
            this.app.eventBus.emit(Events.PROMPTS_CHANGED);
          }
          return { success: result.errors.length === 0, deleted: result.deleted };
        } catch (error) {
          ErrorHandler.handleError(
            { module: 'PromptDetailManager.ts', operation: 'delete tags' },
            error,
            { userMessage: '删除标签失败', logError: false }
          );
          return { success: false, deleted: 0 };
        }
      },
      addTags: async (tagNames: string[]) => {
        try {
          const currentItem = this.currentItem as unknown as IPromptExtended;
          const tagService = TagService.getInstance();
          const result = await tagService.linkTagsToItem({
            tagNames,
            type: 'prompt',
            itemId: currentItem?.id
          });

          if (result.success) {
            // 添加新创建的标签和已存在的标签（skipped）到本地状态
            const allTagsToAdd = [...result.created, ...result.skipped];
            for (const tagName of allTagsToAdd) {
              if (!this.currentTags.includes(tagName)) {
                this.currentTags.push(tagName);
              }
            }
            // 触发重新渲染
            detailTagManager.onRender?.();
            this.app.eventBus.emit(Events.PROMPTS_CHANGED);
          }
          return { success: result.success, added: result.created?.length || 0 };
        } catch (error) {
          // 根据错误类型显示不同的提示
          if (error instanceof TagExistsError) {
            this.app.showToast('标签已存在', 'warning');
          } else if (error instanceof InvalidTagNameError) {
            this.app.showToast('标签名无效: ' + (error as Error).message, 'warning');
          } else if (error instanceof TagOperationError) {
            this.app.showToast('操作失败: ' + (error as Error).message, 'error');
          } else {
            this.app.showToast(`添加标签失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
          }
          return { success: false, added: 0 };
        }
      },
      onRender: undefined
    };

    // 使用基类的标签管理功能
    this.initDetailTagManager(
      {
        toolbarId: Constants.Ids.PROMPT_DETAIL_BATCH_TAG_TOOLBAR,
        containerId: Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER,
        inputAreaId: Constants.Ids.PROMPT_DETAIL_TAG_INPUT_AREA,
        batchBtnId: Constants.Ids.PROMPT_DETAIL_BATCH_TAG_BTN,
        context: 'promptDetail'
      },
      detailTagManager
    );

    // 触发渲染
    detailTagManager.onRender?.();

    // 绑定标签输入事件
    this.bindTagInputEvents();
  }

  /**
   * 绑定标签输入事件
   * @private
   */
  private bindTagInputEvents(): void {
    // 清理旧的自动完成组件
    if (this.tagAutocomplete) {
      this.tagAutocomplete.destroy();
    }

    // 创建新的自动完成组件
    this.tagAutocomplete = new TagAutocomplete({
      inputId: Constants.Ids.PROMPT_DETAIL_TAGS_INPUT,
      dropdownId: Constants.Ids.PROMPT_DETAIL_TAG_AUTOCOMPLETE,
      onSelect: async (tagName: string) => {
        try {
          const currentItem = this.currentItem as unknown as IPromptExtended;
          const tagService = TagService.getInstance();
          const result = await tagService.linkTagsToItem({
            tagNames: [tagName],
            type: 'prompt',
            itemId: currentItem?.id
          });

          if (result.success) {
            // 添加新创建的标签和已存在的标签（skipped）到本地状态
            const allTagsToAdd = [...result.created, ...result.skipped];
            for (const tag of allTagsToAdd) {
              if (!this.currentTags.includes(tag)) {
                this.currentTags.push(tag);
              }
            }
            // 触发重新渲染
            this.detailTagManager?.onRender?.();
            this.app.eventBus.emit(Events.PROMPTS_CHANGED);
          }
          return result.success;
        } catch (error) {
          window.electronAPI.logError('PromptDetailManager.ts', 'Failed to add tag:', error);

          // 根据错误类型显示不同的提示
          if (error instanceof TagExistsError) {
            this.app.showToast('标签已存在', 'warning');
          } else if (error instanceof InvalidTagNameError) {
            this.app.showToast('标签名无效: ' + (error as Error).message, 'warning');
          } else if (error instanceof TagOperationError) {
            this.app.showToast('操作失败: ' + (error as Error).message, 'error');
          } else {
            this.app.showToast(error instanceof Error ? error.message : '添加标签失败', 'error');
          }
          return false;
        }
      },
      onBatchAdd: async (tagNames: string[]) => {
        try {
          const currentItem = this.currentItem as unknown as IPromptExtended;
          const tagService = TagService.getInstance();
          const result = await tagService.linkTagsToItem({
            tagNames,
            type: 'prompt',
            itemId: currentItem?.id
          });

          if (result.success) {
            // 添加新创建的标签和已存在的标签（skipped）到本地状态
            const allTagsToAdd = [...result.created, ...result.skipped];
            for (const tag of allTagsToAdd) {
              if (!this.currentTags.includes(tag)) {
                this.currentTags.push(tag);
              }
            }
            // 触发重新渲染
            this.detailTagManager?.onRender?.();
            this.app.eventBus.emit(Events.PROMPTS_CHANGED);
          }
          return result.success;
        } catch (error) {
          window.electronAPI.logError('PromptDetailManager.ts', 'Failed to add tags:', error);

          // 根据错误类型显示不同的提示
          if (error instanceof TagExistsError) {
            this.app.showToast('标签已存在', 'warning');
          } else if (error instanceof InvalidTagNameError) {
            this.app.showToast('标签名无效: ' + (error as Error).message, 'warning');
          } else if (error instanceof TagOperationError) {
            this.app.showToast('操作失败: ' + (error as Error).message, 'error');
          } else {
            this.app.showToast(error instanceof Error ? error.message : '添加标签失败', 'error');
          }
          return false;
        }
      },
      containerSelector: '.prompt-tag-input-area',
      type: 'prompt'
    });

    this.tagAutocomplete.init();
  }

  /**
   * 初始化保存管理器
   * @param prompt - 提示词对象
   * @private
   */
  private initSaveManager(prompt: IPromptExtended): void {
    // 清理旧的
    if (this.promptSaveManager) {
      this.promptSaveManager.destroy();
    }

    // 清理收藏按钮事件监听器
    if (this.favoriteBtnHandler) {
      const favoriteBtn = document.getElementById(Constants.Ids.PROMPT_DETAIL_FAVORITE_BTN);
      if (favoriteBtn) {
        favoriteBtn.removeEventListener('click', this.favoriteBtnHandler);
      }
      this.favoriteBtnHandler = null;
    }

    // 创建保存策略
    const strategy = new PromptSaveStrategy(this.app);

    // 创建保存管理器
    this.promptSaveManager = new SaveManager({
      strategy,
      itemId: prompt.id,
      onAfterSave: async () => {
        // 通过事件通知刷新，避免直接调用导致的重复刷新
        this.app.eventBus.emit(Events.PROMPTS_CHANGED);
        this.app.eventBus.emit(Events.IMAGES_CHANGED);
      }
    });

    // 注册所有字段
    this.registerFields();
  }

  /**
   * 注册所有字段到 SaveManager
   * @private
   */
  private registerFields(): void {
    if (!this.promptSaveManager) return;

    // 1. 标题 - 防抖保存
    this.promptSaveManager.registerField('title', {
      saveMode: 'debounce',
      delay: 800,
      elementId: Constants.Ids.PROMPT_DETAIL_TITLE,
      statusId: Constants.Ids.PROMPT_DETAIL_TITLE_STATUS,
      validate: (value: unknown) => validateTitle(value as string)
    });

    // 2. 内容 - 防抖保存
    this.promptSaveManager.registerField('content', {
      saveMode: 'debounce',
      delay: 800,
      elementId: Constants.Ids.PROMPT_DETAIL_CONTENT,
      autoResize: true,
      statusId: Constants.Ids.PROMPT_DETAIL_CONTENT_STATUS
    });

    // 3. 翻译 - 防抖保存
    this.promptSaveManager.registerField('contentTranslate', {
      saveMode: 'debounce',
      delay: 800,
      elementId: Constants.Ids.PROMPT_DETAIL_TRANSLATE,
      autoResize: true,
      statusId: Constants.Ids.PROMPT_DETAIL_TRANSLATE_STATUS
    });

    // 4. 备注 - 防抖保存
    this.promptSaveManager.registerField('note', {
      saveMode: 'debounce',
      delay: 800,
      elementId: Constants.Ids.PROMPT_DETAIL_NOTE,
      autoResize: true,
      statusId: Constants.Ids.PROMPT_DETAIL_NOTE_STATUS
    });

    // 5. 安全状态 - 防抖保存
    this.promptSaveManager.registerField('isSafe', {
      saveMode: 'debounce',
      delay: 800,
      elementId: Constants.Ids.PROMPT_DETAIL_SAFE_TOGGLE,
      getValue: (element: HTMLElement) => (element as HTMLInputElement).checked ? 1 : 0,
      onChange: (value: unknown) => {
        this.app.showToast(value ? '已标记为安全' : '已标记为不安全', 'success');
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
        this.app.showToast(boolValue ? '已收藏' : '已取消收藏', 'success');
      }
    });

    // 手动绑定收藏按钮点击事件
    const favoriteBtn = document.getElementById(Constants.Ids.PROMPT_DETAIL_FAVORITE_BTN);
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
      this.app.currentImagesCache.clear();

      await this.updateView(nextPrompt);
    };

    this.initNavigator(
      prompt as unknown as { id: string | number; [key: string]: unknown },
      items as unknown as { id: string | number; [key: string]: unknown }[],
      {
        first: document.getElementById(Constants.Ids.PROMPT_DETAIL_FIRST_NAV_BTN) || undefined,
        prev: document.getElementById(Constants.Ids.PROMPT_DETAIL_PREV_NAV_BTN) || undefined,
        next: document.getElementById(Constants.Ids.PROMPT_DETAIL_NEXT_NAV_BTN) || undefined,
        last: document.getElementById(Constants.Ids.PROMPT_DETAIL_LAST_NAV_BTN) || undefined
      },
      onNavigate as unknown as (item: { id: string | number; [key: string]: unknown }) => void | Promise<void>
    );
  }

  /**
   * 更新视图
   * @param prompt - 提示词对象
   */
  async updateView(prompt: IPromptExtended): Promise<void> {
    // 更新当前提示词
    this.currentItem = prompt as unknown as { id: string | number; [key: string]: unknown };

    // 更新当前标签
    this.currentTags = [...(prompt.tags || [])];

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
    [Constants.Ids.PROMPT_DETAIL_CONTENT, Constants.Ids.PROMPT_DETAIL_TRANSLATE, Constants.Ids.PROMPT_DETAIL_NOTE].forEach(id => {
      const textarea = document.getElementById(id);
      if (textarea) {
        this.app.autoResizeTextarea(textarea);
      }
    });
  }

  /**
   * 绑定图像上传事件
   * @private
   */
  private bindImageUploadEvents(): void {
    // 点击上传区域选择多图
    const uploadArea = document.getElementById(Constants.Ids.IMAGE_UPLOAD_AREA);
    if (uploadArea) {
      uploadArea.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.remove-image')) return;
        if (target.closest('.view-image')) return;
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

    document.getElementById(Constants.Ids.PROMPT_DETAIL_SELECT_FROM_IMAGE_MANAGER_BTN)?.addEventListener('click', () => {
      this.openImageSelectorForPrompt();
    });
  }

  /**
   * 初始化图像右键菜单
   * @private
   */
  private initImageContextMenu(): void {
    // 如果已存在右键菜单管理器，先销毁旧的以避免重复创建DOM元素
    if (this.imageContextMenuManager) {
      this.imageContextMenuManager.destroy();
      this.imageContextMenuManager = null;
    }

    // 创建右键菜单管理器
    this.imageContextMenuManager = new ImageContextMenuManager({
      onSetAsFirst: async (image: IImage) => {
        // 获取当前图像在列表中的索引
        const images = Array.from(this.app.currentImagesCache.values());
        const index = images.findIndex(img => String(img.id) === String(image.id));
        if (index <= 0) return; // 已经是首图或找不到

        // 调用 handleSetFirst 实现设为首张
        await this.handleSetFirst(index);
      }
    });

    // 初始化菜单
    this.imageContextMenuManager.init();

    // 绑定到图像预览容器（事件委托）
    const imagePreviewContainer = document.getElementById(Constants.Ids.IMAGE_PREVIEW_LIST);
    if (imagePreviewContainer) {
      imagePreviewContainer.addEventListener('contextmenu', (e) => {
        const target = e.target as HTMLElement;
        const previewItem = target.closest('.image-preview-item') as HTMLElement | null;
        if (!previewItem) return;

        // 获取图像ID
        const imageId = previewItem.dataset.imageId;
        if (!imageId) return;

        // 获取图像数据
        const images = Array.from(this.app.currentImagesCache.values());
        const image = images.find(img => String(img.id) === String(imageId));
        if (!image) return;

        // 获取索引，如果是第一张图则不显示菜单
        const index = images.findIndex(img => String(img.id) === String(imageId));
        if (index === 0) return;

        // 显示右键菜单
        e.preventDefault();
        this.imageContextMenuManager?.show({
          x: e.clientX,
          y: e.clientY,
          image
        });
      });
    }
  }

  /**
   * 处理选择多图并立即保存
   * @private
   */
  private async handleSelectImages(): Promise<void> {
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
          this.app.showToast(result.message, 'error');
        }
        return;
      }

      // 更新缓存并保存（使用完整图像数据，包含 relativePath）
      for (const image of result.images) {
        this.app.currentImagesCache.set(String(image.id), image as unknown as IImage);
      }

      // 更新全局图像缓存，确保 renderImagePreviews 能获取完整信息
      cacheManager.cacheImages(result.images);

      const promptIdInput = document.getElementById(Constants.Ids.PROMPT_DETAIL_ID) as HTMLInputElement | null;
      const promptId = promptIdInput?.value;
      if (promptId) {
        const updatedImages = Array.from(this.app.currentImagesCache.values());
        await this.savePromptField('images', updatedImages);
      }

      await this.renderImagePreviews();
    } finally {
      // 延迟重置标志，确保对话框完全关闭
      setTimeout(() => {
        this.isOpeningDialog = false;
      }, 500);
    }
  }

  /**
   * 处理删除图像
   * 注意：这里只是从提示词中移除图像关联，不会彻底删除图像
   * 图像仍然保留在图像管理中，可以通过"从图像管理选择"重新添加
   * @param index - 图像索引
   * @private
   */
  async handleRemoveImage(index: number): Promise<void> {
    // 从缓存中获取当前所有图像
    const currentImages = Array.from(this.app.currentImagesCache.values());

    if (index < 0 || index >= currentImages.length) {
      window.electronAPI.logError('PromptDetailManager', `Invalid index: ${index}, current images count: ${currentImages.length}`);
      return;
    }

    // 获取要移除的图像信息
    const removedImage = currentImages[index];
    const imageName = removedImage?.fileName || removedImage?.id || '未知图像';

    // 显示确认对话框
    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.DELETE_IMAGE,
      { name: imageName }
    );

    if (!confirmed) {
      return;
    }

    // 从数组中移除指定索引的图像
    currentImages.splice(index, 1);

    // 更新缓存
    this.app.currentImagesCache.clear();
    currentImages.forEach(img => {
      this.app.currentImagesCache.set(String(img.id), img);
    });

    // 同步到 uploadStrategy
    this.uploadStrategy.setSavedImages(currentImages);

    // 保存到数据库
    const promptIdInput = document.getElementById(Constants.Ids.PROMPT_DETAIL_ID) as HTMLInputElement | null;
    const promptId = promptIdInput?.value;

    if (promptId) {
      await this.savePromptField('images', currentImages);
    }

    // 重新渲染
    await this.renderImagePreviews();
  }

  /**
   * 处理设为首张
   * @param index - 图像索引
   * @private
   */
  async handleSetFirst(index: number): Promise<void> {
    // 从缓存获取当前图像列表
    const images = Array.from(this.app.currentImagesCache.values());

    // 验证索引有效性
    if (index <= 0 || index >= images.length) {
      return;
    }

    // 重排图像顺序：将指定索引的图像移到首位
    const item = images.splice(index, 1)[0];
    images.unshift(item);

    // 更新缓存
    this.app.currentImagesCache.clear();
    images.forEach(img => {
      this.app.currentImagesCache.set(String(img.id), img);
    });

    // 保存到数据库
    const promptIdInput = document.getElementById(Constants.Ids.PROMPT_DETAIL_ID) as HTMLInputElement | null;
    const promptId = promptIdInput?.value;
    if (promptId) {
      await this.savePromptField('images', images);
    }

    // 重新渲染
    await this.renderImagePreviews();
  }

  /**
   * 渲染图像预览
   */
  async renderImagePreviews(): Promise<void> {
    const container = document.getElementById(Constants.Ids.IMAGE_PREVIEW_LIST);
    if (!container) return;

    // 从 CacheManager 获取当前图像列表
    const cachedImages = Array.from(this.app.currentImagesCache.values());
    const validImages = cachedImages.filter((img: { id?: string }) => img.id);

    // 提取有效图像 ID
    const validImageIds = validImages.map((img: { id: string }) => img.id);

    // 检查缓存是否已填充：尝试获取第一个图像
    const imageCacheReady = validImageIds.length > 0 && cacheManager.getCachedImage(validImageIds[0]);

    // 获取图像完整信息：缓存已填充则直接使用，否则按 ID 批量获取
    const allImages = imageCacheReady
      ? null
      : await window.electronAPI.getImagesByIds(validImageIds);

    // 记录警告日志：发现无效图像
    if (cachedImages.length !== validImages.length) {
      const invalidCount = cachedImages.length - validImages.length;
      const promptId = (document.getElementById(Constants.Ids.PROMPT_DETAIL_ID) as HTMLInputElement | null)?.value || 'unknown';
      const invalidImages = cachedImages.filter((img: { id?: string }) => !img.id);

      window.electronAPI.logWarn('PromptDetailManager', `Found ${invalidCount} images without ID in prompt ${promptId}`, {
        totalImages: cachedImages.length,
        validImages: validImages.length,
        invalidImages: invalidCount,
        invalidImageDetails: invalidImages.map((img: unknown, idx: number) => ({
          index: idx,
          data: img
        }))
      });
    }

    // 获取所有图像的完整路径并渲染
    const previews = await Promise.all(
      validImages.map(async (imgRef: { id: string }, index: number) => {
        const img = cacheManager.getCachedImage(imgRef.id) || (allImages?.find((i: { id?: string }) => i.id === imgRef.id) as { relativePath?: string; thumbnailPath?: string; tags?: string[]; fileName?: string; id: string } | null);
        if (!img) return '';
        const imgPath = (img.relativePath || img.thumbnailPath) as string | undefined;
        if (!imgPath) return '';
        const imagePath = await window.electronAPI.getImagePath(imgPath);
        const isFromDetailJump = this.app.isFromDetailJump;

        // 生成标签 HTML（使用展示标签样式）
        const tagsHtml = this.generateTagsHtml(img.tags, 'tag-display', 'tag-display-empty');

        return `
          <div class="image-preview-item" data-index="${index}" data-image-id="${img.id}">
            <img src="file://${imagePath}" alt="${img.fileName}">
            <div class="image-preview-tags">
              ${tagsHtml}
            </div>
            <button type="button" class="view-image ${isFromDetailJump ? 'disabled-secondary' : ''}" data-index="${index}" data-image-id="${img.id}" title="${isFromDetailJump ? '已从详情界面跳转，禁止再次跳转' : '查看'}" ${isFromDetailJump ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button type="button" class="remove-image" data-index="${index}" title="删除">×</button>
          </div>
        `;
      })
    );

    container.innerHTML = previews.filter(p => p).join('');

    // 绑定删除事件
    const removeButtons = container.querySelectorAll('.remove-image');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const index = parseInt((btn as HTMLElement).dataset.index || '0');
        await this.handleRemoveImage(index);
      });
    });

    // 绑定查看事件
    const viewButtons = container.querySelectorAll('.view-image');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.app.isFromDetailJump) {
          return;
        }
        const imageId = (btn as HTMLElement).dataset.imageId;
        if (!imageId) {
          return;
        }
        const image = cacheManager.getCachedImage(imageId);
        if (image) {
          this.app.isFromDetailJump = true;
          this.app.openImageDetailModal?.(image);
        }
      });
    });

    // 绑定双击事件（全屏查看）
    container.querySelectorAll('.image-preview-item img').forEach(img => {
      img.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const item = img.closest('.image-preview-item');
        const index = parseInt((item as HTMLElement).dataset.index || '0');
        const images = Array.from(this.app.currentImagesCache.values());
        this.app.openFullscreen?.(images, index);
      });
    });
  }

  /**
   * 生成标签 HTML
   * @param tags - 标签列表
   * @param className - 标签样式类名
   * @param emptyClassName - 空标签样式类名
   * @returns HTML 字符串
   */
  private generateTagsHtml(tags: string[] | undefined, className: string, emptyClassName: string): string {
    if (!tags || tags.length === 0) {
      return `<span class="${emptyClassName}">无标签</span>`;
    }
    return tags.map(tag => `<span class="${className}">${tag}</span>`).join('');
  }

  /**
   * 保存提示词字段
   * @param field - 字段名
   * @param value - 字段值
   * @private
   */
  private async savePromptField(field: string, value: unknown): Promise<void> {
    const promptIdInput = document.getElementById(Constants.Ids.PROMPT_DETAIL_ID) as HTMLInputElement | null;
    const promptId = promptIdInput?.value;
    if (!promptId) return;

    try {
      const updates = { [field]: value };
      await window.electronAPI.updatePrompt(promptId, updates);

      this.app.eventBus.emit(Events.IMAGES_CHANGED);
      this.app.eventBus.emit(Events.PROMPTS_CHANGED);
    } catch (error) {
      ErrorHandler.handleError(
        { module: 'PromptDetailManager', operation: 'save prompt field' },
        error,
        { showToast: false }
      );
    }
  }

  /**
   * 打开图像选择器
   * @private
   */
  private async openImageSelectorForPrompt(): Promise<void> {
    if (this.app.imageSelectorManager) {
      this.app.imageSelectorManager.open({
        onConfirm: (selectedImage: IImage) => {
          if (selectedImage && selectedImage.id) {
            if (!this.app.currentImagesCache.has(String(selectedImage.id))) {
              this.app.currentImagesCache.set(String(selectedImage.id), selectedImage);
            }

            this.renderImagePreviews();

            const promptIdInput = document.getElementById(Constants.Ids.PROMPT_DETAIL_ID) as HTMLInputElement | null;
            const promptId = promptIdInput?.value;
            if (promptId) {
              const updatedImages = Array.from(this.app.currentImagesCache.values());
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

    // 销毁 TagAutocomplete，防止事件监听器残留
    if (this.tagAutocomplete) {
      this.tagAutocomplete.destroy();
      this.tagAutocomplete = null;
    }

    this.app.isFromDetailJump = false;

    // 清理图像缓存
    this.app.currentImagesCache.clear();

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
