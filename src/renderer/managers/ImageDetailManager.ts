/**
 * 图像详情管理器
 * 负责管理图像详情模态框
 */
import { DetailViewManager } from './DetailViewManager.ts';
import type { IDetailTagManager } from '../../types/entities.ts';
import { HtmlUtils, validateFileName, isSameId, cacheManager } from '../../utils/index.ts';
import { SaveManager, ImageSaveStrategy } from '../renderer_utils/index.ts';
import { Constants, Events } from '../../constants.ts';
import { TagAutocomplete, DialogService, DialogConfig, TagService } from '../services/index.ts';
import { IImage, IPrompt } from '../../types/entities.ts';
import type { LRUCache } from '../../utils/LRUCache.ts';

// 扩展 IImage 接口
interface IImageExtended extends IImage {
  promptRefs?: Array<{
    promptId: string;
    promptTitle?: string;
    promptContent?: string;
    promptContentTranslate?: string;
    promptNote?: string;
  }>;
  [key: string]: unknown;
}

// 选项接口
interface IOpenOptions {
  filteredList?: { id: string; fileName: string; relativePath: string; [key: string]: unknown }[];
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
  viewMode: string;
  promptCache: LRUCache<IPrompt>;
  imageCache: LRUCache<IImage>;
  promptPanelManager: IRefreshablePanelManager | null;
  imagePanelManager: IRefreshablePanelManager | null;
  eventBus: {
    emit: (event: string) => void;
  };
  showToast: (message: string, type?: string) => void;
  autoResizeTextarea: (element: HTMLElement) => void;
  promptDetailManager?: {
    open: (prompt: IPrompt, options: { returnToManager: DetailViewManager; returnToItem: unknown }) => Promise<void>;
  } | null;
  imageFullscreenManager?: {
    open: (images: IImage[], index: number) => void;
  } | null;
  newPromptManager?: {
    open: (images: IImage[], options: { onClose: (saved: boolean) => Promise<void> }) => Promise<void>;
  } | null;
}

// ImageDetailManager 构造选项
interface IImageDetailManagerOptions {
  app: IApp;
  tagRegistry: unknown;
}

export class ImageDetailManager extends DetailViewManager {
  private tagManager: unknown;
  private tagAutocomplete: TagAutocomplete | null = null;
  private imageSaveManager: SaveManager | null = null;
  private favoriteBtnHandler: (() => void) | null = null;
  private returnToManager: DetailViewManager | null = null;
  private returnToItem: unknown = null;
  private returnToOptions: IOpenOptions = {};
  private currentDetailPromptId: string | null = null;
  private currentDetailPromptRefs: IPrompt[] = [];
  private currentTags: string[] = [];

  constructor(options: IImageDetailManagerOptions) {
    super({
      app: options.app as unknown as { constructor: { isSameId?: (id1: unknown, id2: unknown) => boolean }; showToast: (message: string, type?: string) => void; eventBus: { emit: (event: string, data?: unknown) => void }; [key: string]: unknown },
      modalId: 'imageDetailModal',
      closeBtnId: 'imageDetailCloseBtn'
    });

    this.tagManager = options.tagRegistry;
  }

  /**
   * 打开图像详情模态框
   * @param item - 图像对象
   * @param options - 选项
   */
  async open(item: { id: string; fileName: string; relativePath: string; [key: string]: unknown }, options: IOpenOptions = {}): Promise<void> {
    const image = item as IImageExtended;
    const modal = document.getElementById(this.modalId);
    if (!modal) {
      window.electronAPI.logError('ImageDetailManager.ts', 'Image detail modal not found');
      return;
    }

    const app = this.app as unknown as IApp;
    this.returnToManager = options.returnToManager || null;
    this.returnToItem = options.returnToItem;
    this.returnToOptions = options;
    app.isFromDetailJump = !!options.returnToManager || app.isFromDetailJump;

    try {
      // 从缓存获取最新的图像数据，确保 isSafe 是最新的
      const latestImage = cacheManager.getCachedImage(image.id) || image;

      this.currentItem = latestImage as unknown as { id: string | number; [key: string]: unknown };

      this.fillFormData(latestImage);

      this.setSafeState(latestImage.isSafe === 1);

      // 更新收藏按钮
      this.updateFavoriteBtnUI(!!latestImage.isFavorite);

      // 渲染图像信息
      await this.renderImageInfo(latestImage);

      // 初始化标签管理器
      this.initTagManager(latestImage);

      // 渲染关联提示词信息
      await this.renderPromptInfo(latestImage);

      // 初始化保存管理器
      this.initSaveManager(latestImage);

      // 初始化导航器
      await this.initNavigatorForImage(latestImage, options);

      // 显示模态框
      this.showModal();

      // 自动调整文本框高度
      const noteInput = document.getElementById('imageDetailNote');
      if (noteInput) {
        app.autoResizeTextarea(noteInput);
      }
    } catch (error) {
      window.electronAPI.logError('ImageDetailManager.ts', 'Failed to open image detail modal:', error);
      (this.app as unknown as IApp).showToast('打开图像详情失败', 'error');
    }
  }

  /**
   * 填充表单数据
   * @param image - 图像对象
   * @private
   */
  private fillFormData(image: IImageExtended): void {
    const fileNameInput = document.getElementById('imageDetailFileName') as HTMLInputElement | null;
    if (fileNameInput) {
      fileNameInput.value = image.fileName || '';
    }

    const noteInput = document.getElementById('imageDetailNote') as HTMLTextAreaElement | null;
    if (noteInput) {
      noteInput.value = image.note || '';
    }
  }

  /**
   * 设置安全状态
   * @param isSafe - 是否安全
   * @private
   */
  private setSafeState(isSafe: boolean): void {
    const safeToggle = document.getElementById('imageDetailSafeToggle') as HTMLInputElement | null;
    if (safeToggle) {
      safeToggle.checked = isSafe;
    }
  }

  /**
   * 更新收藏按钮 UI
   * @param isFavorite - 是否收藏
   */
  updateFavoriteBtnUI(isFavorite: boolean): void {
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
   * 渲染图像信息
   * @param image - 图像对象
   * @private
   */
  private async renderImageInfo(image: IImageExtended): Promise<void> {
    const app = this.app as unknown as IApp;

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
    const imgEl = document.getElementById('imageDetailImg') as HTMLImageElement | null;
    if (imgEl && image.relativePath) {
      try {
        const fullPath = await window.electronAPI.getImagePath(image.relativePath);
        imgEl.src = `file://${fullPath.replace(/"/g, '&quot;')}`;
        imgEl.alt = image.fileName || '图像';

        // 绑定双击打开全屏查看器
        if (app.imageFullscreenManager) {
          imgEl.ondblclick = () => {
            if (this.itemsSnapshot && this.itemsSnapshot.length > 0) {
              const currentIndex = this.itemsSnapshot.findIndex(i => isSameId(i.id, image.id));
              app.imageFullscreenManager?.open(this.itemsSnapshot as unknown as IImage[], currentIndex >= 0 ? currentIndex : 0);
            } else {
              app.imageFullscreenManager?.open([image], 0);
            }
          };
        }
      } catch (error) {
        window.electronAPI.logError('ImageDetailManager.ts', 'Failed to load image:', error);
        imgEl.alt = '加载图像失败';
      }
    }
  }

  /**
   * 初始化标签管理器
   * @param image - 图像对象
   * @private
   */
  private initTagManager(image: IImageExtended): void {
    const app = this.app as unknown as IApp;
    this.currentTags = [...(image.tags || [])];

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
          // 使用 unlinkTagFromItem 解除标签与项目的关联（会更新 updated_at）
          const currentImage = this.currentItem as IImageExtended;
          const success = await tagService.unlinkTagFromItem({
            type: 'image',
            itemId: currentImage?.id,
            tagName
          });
          if (success) {
            this.currentTags = this.currentTags.filter(t => t !== tagName);
            app.eventBus.emit(Events.IMAGES_CHANGED);
          }
          return success;
        } catch (error) {
          app.showToast(`删除标签失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
          return false;
        }
      },
      removeTags: async (tagNames: string[]) => {
        try {
          const tagService = TagService.getInstance();
          const result = await tagService.removeTags({ tagNames, type: 'image' });
          if (result.errors.length === 0) {
            for (const tagName of tagNames) {
              this.currentTags = this.currentTags.filter(t => t !== tagName);
            }
            app.eventBus.emit(Events.IMAGES_CHANGED);
          }
          return { success: result.errors.length === 0, deleted: result.deleted };
        } catch (error) {
          app.showToast(`删除标签失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
          return { success: false, deleted: 0 };
        }
      },
      addTags: async (tagNames: string[]) => {
        try {
          const currentItem = this.currentItem as unknown as IImageExtended;
          const tagService = TagService.getInstance();
          const result = await tagService.linkTagsToItem({
            tagNames,
            type: 'image',
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
            app.eventBus.emit(Events.IMAGES_CHANGED);
          }
          return { success: result.success, added: result.created?.length || 0 };
        } catch (error) {
          app.showToast(`添加标签失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
          return { success: false, added: 0 };
        }
      },
      onRender: undefined
    };

    // 使用基类的标签管理功能
    this.initDetailTagManager(
      {
        toolbarId: 'imageDetailBatchToolbar',
        containerId: Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER,
        inputAreaId: 'imageDetailTagInputArea',
        batchBtnId: 'imageDetailBatchTagBtn'
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
    const app = this.app as unknown as IApp;

    // 清理旧的自动完成组件
    if (this.tagAutocomplete) {
      this.tagAutocomplete.destroy();
    }

    // 创建新的自动完成组件
    this.tagAutocomplete = new TagAutocomplete({
      inputId: Constants.Ids.IMAGE_DETAIL_TAG_INPUT,
      dropdownId: Constants.Ids.IMAGE_DETAIL_TAG_AUTOCOMPLETE,
      onSelect: async (tagName: string) => {
        try {
          const currentItem = this.currentItem as unknown as IImageExtended;
          const tagService = TagService.getInstance();
          const result = await tagService.linkTagsToItem({
            tagNames: [tagName],
            type: 'image',
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
            app.eventBus.emit(Events.IMAGES_CHANGED);
          }
          return result.success;
        } catch (error) {
          window.electronAPI.logError('ImageDetailManager.ts', 'Failed to add tag:', error);
          app.showToast(error instanceof Error ? error.message : '添加标签失败', 'error');
          return false;
        }
      },
      onBatchAdd: async (tagNames: string[]) => {
        try {
          const currentItem = this.currentItem as unknown as IImageExtended;
          const tagService = TagService.getInstance();
          const result = await tagService.linkTagsToItem({
            tagNames,
            type: 'image',
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
            app.eventBus.emit(Events.IMAGES_CHANGED);
          }
          return result.success;
        } catch (error) {
          window.electronAPI.logError('ImageDetailManager.ts', 'Failed to add tags:', error);
          app.showToast(error instanceof Error ? error.message : '添加标签失败', 'error');
          return false;
        }
      },
      containerSelector: '.image-tag-input-area',
      type: 'image'
    });

    this.tagAutocomplete.init();
  }

  /**
   * 渲染关联提示词信息
   * @param image - 图像对象
   * @private
   */
  private async renderPromptInfo(image: IImageExtended): Promise<void> {
    const app = this.app as unknown as IApp;

    const promptTitleContainer = document.getElementById('imageDetailPromptTitle');
    const promptContentEl = document.getElementById('imageDetailPromptContent');
    const promptTranslateEl = document.getElementById('imageDetailPromptTranslate');
    const promptNoteEl = document.getElementById('imageDetailPromptNote');
    const tagsContainer = document.getElementById('imageDetailTags');
    const editPromptBtn = document.getElementById('editPromptFromImageBtn') as HTMLButtonElement | null;
    const editPromptBtnText = document.getElementById('editPromptBtnText');

    // 收集所有引用的提示词信息
    let allPromptRefs: IPrompt[] = [];

    if (image.promptRefs && image.promptRefs.length > 0) {
      allPromptRefs = image.promptRefs.map(ref => {
        // 优先从缓存查找
        const cachedPrompt = cacheManager.getCachedPrompt(ref.promptId);
        if (cachedPrompt) {
          return cachedPrompt;
        }
        // 如果缓存中没有，使用数据库返回的数据并添加到缓存
        if (ref.promptContent) {
          const prompt: IPrompt = {
            id: ref.promptId,
            title: ref.promptTitle || '',
            content: ref.promptContent,
            contentTranslate: ref.promptContentTranslate,
            note: ref.promptNote,
            tags: []
          };
          cacheManager.cachePrompt(prompt);
          return prompt;
        }
        return null;
      }).filter((p): p is IPrompt => p !== null);
    }

    if (allPromptRefs.length > 0) {
      // 多引用情况：显示所有提示词标题列表
      if (allPromptRefs.length > 1) {
        if (promptTitleContainer) {
          promptTitleContainer.innerHTML = allPromptRefs.map((p, index) =>
            `<div class="prompt-ref-item" data-prompt-id="${p.id}">
              <span class="prompt-ref-number">${index + 1}.</span>
              <span class="prompt-ref-title">${HtmlUtils.escapeHtml(p.title || '未命名')}</span>
              <span class="prompt-ref-unlink" title="解除关联">×</span>
            </div>`
          ).join('');
        }

        // 绑定点击事件 - 点击标题切换显示
        promptTitleContainer?.querySelectorAll('.prompt-ref-item').forEach(item => {
          const titleEl = item.querySelector('.prompt-ref-title');
          if (titleEl) {
            titleEl.addEventListener('click', () => {
              const promptId = (item as HTMLElement).dataset.promptId;
              if (!promptId) return;
              const selectedPrompt = allPromptRefs.find(p => isSameId(p.id, promptId));
              if (selectedPrompt) {
                this.showPromptDetail(selectedPrompt);
              }
            });
          }
        });

        // 绑定解除关联事件
        promptTitleContainer?.querySelectorAll('.prompt-ref-unlink').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const item = (btn as HTMLElement).closest('.prompt-ref-item');
            const promptId = (item as HTMLElement | null)?.dataset.promptId;
            if (!promptId) return;
            const promptRef = allPromptRefs.find(p => isSameId(p.id, promptId));
            if (promptRef) {
              await this.unlinkFromPrompt(image.id, promptId, promptRef.title);
            }
          });
        });
      } else {
        // 单引用情况：显示标题和解除关联按钮
        const p = allPromptRefs[0];
        if (promptTitleContainer) {
          promptTitleContainer.innerHTML =
            `<div class="prompt-ref-item single-ref" data-prompt-id="${p.id}">
              <span class="prompt-ref-title">${HtmlUtils.escapeHtml(p.title || '未命名')}</span>
              <span class="prompt-ref-unlink" title="解除关联">×</span>
            </div>`;
        }

        // 绑定解除关联事件
        const unlinkBtn = promptTitleContainer?.querySelector('.prompt-ref-unlink');
        if (unlinkBtn) {
          unlinkBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.unlinkFromPrompt(image.id, p.id, p.title);
          });
        }
      }

      // 显示第一个提示词的详细内容
      const firstPrompt = allPromptRefs[0];
      if (promptContentEl) promptContentEl.textContent = firstPrompt.content || '-';
      if (promptTranslateEl) promptTranslateEl.textContent = firstPrompt.contentTranslate || '-';
      if (promptNoteEl) promptNoteEl.textContent = firstPrompt.note || '-';

      // 设置标签
      if (tagsContainer) {
        if (firstPrompt.tags && firstPrompt.tags.length > 0) {
          tagsContainer.innerHTML = firstPrompt.tags.map(tag =>
            `<span class="tag-editable">${HtmlUtils.escapeHtml(tag)}</span>`
          ).join('');
        } else {
          tagsContainer.innerHTML = '<span style="color: var(--text-secondary);">无标签</span>';
        }
      }

      const isFromDetailJump = app.isFromDetailJump;
      if (editPromptBtn) {
        editPromptBtn.style.display = 'flex';
        if (isFromDetailJump) {
          editPromptBtn.disabled = true;
          editPromptBtn.classList.add('disabled-secondary');
          editPromptBtn.title = '已从详情界面跳转，禁止再次跳转';
        } else {
          editPromptBtn.disabled = false;
          editPromptBtn.classList.remove('disabled-secondary');
          editPromptBtn.title = '';
          editPromptBtn.onclick = () => {
            if (!this.currentDetailPromptId) return;
            const currentPrompt = allPromptRefs.find(p => isSameId(p.id, this.currentDetailPromptId as string));
            if (currentPrompt) {
              this.openPromptDetail(currentPrompt);
            }
          };
        }
      }
      if (editPromptBtnText) editPromptBtnText.textContent = allPromptRefs.length > 1 ? '编辑提示词 (1)' : '编辑提示词';
      this.currentDetailPromptId = firstPrompt.id;
      this.currentDetailPromptRefs = allPromptRefs;
    } else {
      // 没有关联提示词
      if (promptTitleContainer) promptTitleContainer.textContent = '-';
      if (promptContentEl) promptContentEl.textContent = '-';
      if (promptTranslateEl) promptTranslateEl.textContent = '-';
      if (promptNoteEl) promptNoteEl.textContent = '-';
      if (tagsContainer) tagsContainer.innerHTML = '<span style="color: var(--text-secondary);">无标签</span>';

      const isFromDetailJump = app.isFromDetailJump;
      if (editPromptBtn) {
        editPromptBtn.style.display = 'flex';
        if (isFromDetailJump) {
          editPromptBtn.disabled = true;
          editPromptBtn.classList.add('disabled-secondary');
          editPromptBtn.title = '已从详情界面跳转，禁止再次跳转';
          editPromptBtn.onclick = null;
        } else {
          editPromptBtn.disabled = false;
          editPromptBtn.classList.remove('disabled-secondary');
          editPromptBtn.title = '';
          editPromptBtn.onclick = () => this.createPromptForImage(image);
        }
      }
      if (editPromptBtnText) editPromptBtnText.textContent = '添加提示词';
      this.currentDetailPromptId = null;
      this.currentDetailPromptRefs = [];
    }
  }

  /**
   * 显示提示词详情
   * @param promptInfo - 提示词信息对象
   * @private
   */
  private showPromptDetail(promptInfo: IPrompt): void {
    if (!promptInfo) return;

    // 更新当前选中的提示词ID
    this.currentDetailPromptId = promptInfo.id;

    // 更新提示词标题区域的选中状态
    const promptTitleContainer = document.getElementById('imageDetailPromptTitle');
    if (promptTitleContainer) {
      promptTitleContainer.querySelectorAll('.prompt-ref-item').forEach(item => {
        const itemPromptId = (item as HTMLElement).dataset.promptId;
        if (itemPromptId && isSameId(itemPromptId, promptInfo.id)) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }

    // 更新提示词内容
    const promptContentEl = document.getElementById('imageDetailPromptContent');
    const promptTranslateEl = document.getElementById('imageDetailPromptTranslate');
    const promptNoteEl = document.getElementById('imageDetailPromptNote');
    const tagsContainer = document.getElementById('imageDetailTags');

    if (promptContentEl) promptContentEl.textContent = promptInfo.content || '-';
    if (promptTranslateEl) promptTranslateEl.textContent = promptInfo.contentTranslate || '-';
    if (promptNoteEl) promptNoteEl.textContent = promptInfo.note || '-';

    // 更新标签
    if (tagsContainer) {
      if (promptInfo.tags && promptInfo.tags.length > 0) {
        tagsContainer.innerHTML = promptInfo.tags.map(tag =>
          `<span class="tag-editable">${HtmlUtils.escapeHtml(tag)}</span>`
        ).join('');
      } else {
        tagsContainer.innerHTML = '<span style="color: var(--text-secondary);">无标签</span>';
      }
    }

    // 更新编辑按钮文本
    const editPromptBtnText = document.getElementById('editPromptBtnText');
    const allRefs = this.currentDetailPromptRefs || [];
    const currentIndex = allRefs.findIndex(p => isSameId(p.id, promptInfo.id));
    if (editPromptBtnText && currentIndex >= 0) {
      editPromptBtnText.textContent = `编辑提示词 (${currentIndex + 1})`;
    }
  }

  /**
   * 解除图像与提示词的关联
   * @param imageId - 图像ID
   * @param promptId - 提示词ID
   * @param promptTitle - 提示词标题（用于确认消息）
   * @private
   */
  private async unlinkFromPrompt(imageId: string, promptId: string, promptTitle: string): Promise<void> {
    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.UNLINK_FROM_PROMPT,
      { promptTitle }
    );

    if (!confirmed) return;

    const app = this.app as unknown as IApp;

    try {
      const currentItem = this.currentItem as unknown as IImageExtended;
      const currentPrompts = currentItem?.promptRefs || [];
      const newPrompts = currentPrompts.filter(p => !isSameId(p.promptId, promptId));
      // 转换为数据库需要的格式（只保留 id）
      const promptsForUpdate = newPrompts.map(p => ({ id: p.promptId }));
      await window.electronAPI.updateImage(imageId, { prompts: promptsForUpdate });

      if (this.currentItem) {
        (this.currentItem as unknown as IImageExtended).promptRefs = newPrompts;
        const cachedImage = cacheManager.getCachedImage(imageId);
        if (cachedImage) {
          (cachedImage as unknown as IImageExtended).promptRefs = newPrompts;
        }
        await this.renderPromptInfo(this.currentItem as unknown as IImageExtended);
      }

      // 通过事件通知刷新，避免直接调用导致的重复刷新
      app.eventBus.emit(Events.PROMPTS_CHANGED);
      app.eventBus.emit(Events.IMAGES_CHANGED);
      app.showToast('关联已解除', 'success');
    } catch (error) {
      window.electronAPI.logError('ImageDetailManager.ts', 'Failed to unlink image from prompt:', error);
      app.showToast('解除关联失败', 'error');
    }
  }

  /**
   * 初始化保存管理器
   * @param image - 图像对象
   * @private
   */
  private initSaveManager(image: IImageExtended): void {
    const app = this.app as unknown as IApp;

    // 清理旧的
    if (this.imageSaveManager) {
      this.imageSaveManager.destroy();
    }

    // 清理收藏按钮事件监听器
    if (this.favoriteBtnHandler) {
      const favoriteBtn = document.getElementById('imageDetailFavoriteBtn');
      if (favoriteBtn) {
        favoriteBtn.removeEventListener('click', this.favoriteBtnHandler);
      }
      this.favoriteBtnHandler = null;
    }

    // 创建保存策略
    const strategy = new ImageSaveStrategy(app as unknown as Record<string, unknown>);

    // 创建保存管理器
    this.imageSaveManager = new SaveManager({
      strategy,
      itemId: image.id,
      onAfterSave: async () => {
        // 通过事件通知刷新，避免直接调用导致的重复刷新
        app.eventBus.emit(Events.IMAGES_CHANGED);
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
    const app = this.app as unknown as IApp;

    if (!this.imageSaveManager) return;

    // 1. 文件名 - 防抖保存
    this.imageSaveManager.registerField('fileName', {
      saveMode: 'debounce',
      delay: 800,
      elementId: 'imageDetailFileName',
      statusId: 'imageDetailFileNameStatus',
      validate: (value: unknown) => validateFileName(value as string)
    });

    // 2. 备注 - 防抖保存
    this.imageSaveManager.registerField('note', {
      saveMode: 'debounce',
      delay: 800,
      elementId: 'imageDetailNote',
      autoResize: true,
      statusId: 'imageDetailNoteStatus'
    });

    // 3. 安全状态 - 防抖保存
    this.imageSaveManager.registerField('isSafe', {
      saveMode: 'debounce',
      delay: 800,
      elementId: 'imageDetailSafeToggle',
      getValue: (element: HTMLElement) => (element as HTMLInputElement).checked ? 1 : 0,
      onChange: (value: unknown) => {
        app.showToast(value ? '已标记为安全' : '已标记为不安全', 'success');
      }
    });

    // 4. 收藏 - 防抖保存（通过按钮点击触发）
    this.imageSaveManager.registerField('isFavorite', {
      saveMode: 'debounce',
      delay: 800,
      onChange: (value: unknown) => {
        const boolValue = Boolean(value);
        // 更新 currentItem 的收藏状态
        if (this.currentItem) {
          (this.currentItem as unknown as IImageExtended).isFavorite = boolValue ? 1 : 0;
        }
        this.updateFavoriteBtnUI(boolValue);
        app.showToast(boolValue ? '已收藏' : '已取消收藏', 'success');
      }
    });

    // 手动绑定收藏按钮点击事件
    const favoriteBtn = document.getElementById('imageDetailFavoriteBtn');
    if (favoriteBtn) {
      this.favoriteBtnHandler = async () => {
        const currentItem = this.currentItem as unknown as IImageExtended;
        const newState = !currentItem?.isFavorite;
        await this.imageSaveManager?.triggerSave('isFavorite', newState, currentItem?.id);
      };
      favoriteBtn.addEventListener('click', this.favoriteBtnHandler);
    }
  }

  /**
   * 初始化图像导航器
   * @param image - 图像对象
   * @param options - 选项
   * @private
   */
  private async initNavigatorForImage(image: IImageExtended, options: IOpenOptions = {}): Promise<void> {
    // 记录当前图像列表的快照
    const items = options.filteredList && options.filteredList.length > 0
      ? [...options.filteredList]
      : [];

    const onNavigate = async (targetImage: { id: string | number; [key: string]: unknown }) => {
      // 直接使用 targetImage，不要重新查找，避免数据不一致
      await this.updateView(targetImage);
    };

    this.initNavigator(
      image as unknown as { id: string | number; [key: string]: unknown },
      items as unknown as { id: string | number; [key: string]: unknown }[],
      {
        first: document.getElementById('imageDetailFirstNavBtn') ?? undefined,
        prev: document.getElementById('imageDetailPrevNavBtn') ?? undefined,
        next: document.getElementById('imageDetailNextNavBtn') ?? undefined,
        last: document.getElementById('imageDetailLastNavBtn') ?? undefined
      },
      onNavigate
    );
  }

  /**
   * 获取导航按钮前缀
   * @returns 前缀
   */
  getNavButtonPrefix(): string {
    return 'imageDetail';
  }

  /**
   * 更新视图
   * @param item - 数据项
   */
  async updateView(item: { id: string | number; [key: string]: unknown }): Promise<void> {
    const image = item as unknown as IImageExtended;
    const app = this.app as unknown as IApp;

    // 更新当前图像
    this.currentItem = item;

    // 更新当前标签
    this.currentTags = [...(image.tags || [])];

    // 重置 isFromDetailJump，因为导航到新图像后不再是"从详情跳转"状态
    app.isFromDetailJump = false;

    // 填充表单数据
    this.fillFormData(image);

    // 设置安全状态
    this.setSafeState(image.isSafe === 1);

    // 更新收藏按钮
    this.updateFavoriteBtnUI(!!image.isFavorite);

    // 渲染图像信息（包括图像显示）
    await this.renderImageInfo(image);

    // 重新初始化保存管理器
    this.initSaveManager(image);

    // 重新初始化标签管理器
    this.initTagManager(image);

    // 渲染关联提示词信息
    await this.renderPromptInfo(image);

    // 自动调整文本框高度
    const noteInput = document.getElementById('imageDetailNote');
    if (noteInput) {
      app.autoResizeTextarea(noteInput);
    }
  }

  /**
   * 为图像创建新提示词
   * @param image - 图像对象
   * @private
   */
  private async createPromptForImage(image: IImageExtended): Promise<void> {
    const app = this.app as unknown as IApp;

    try {
      // 保存当前图像和返回信息，以便新建提示词页面关闭后返回
      const currentImage = image;
      const returnToManager = this.returnToManager;
      const returnToItem = this.returnToItem;

      // 打开新建提示词页面，预填充当前图像，并传递返回回调
      await app.newPromptManager?.open([image], {
        onClose: async (saved: boolean) => {
          if (saved) {
            // 如果保存了提示词，从缓存获取最新的图像信息（NewPromptManager 已更新缓存）
            const cachedImage = cacheManager.getCachedImage(currentImage.id);
            if (cachedImage) {
              // 更新当前图像的提示词关联信息
              (currentImage as unknown as IImageExtended).promptRefs = (cachedImage as unknown as IImageExtended).promptRefs || [];
              // 刷新图像详情中的提示词关联信息
              await this.renderPromptInfo(currentImage);
            }
          }
          // 重新打开图像详情界面
          await this.open(currentImage as unknown as { id: string; fileName: string; relativePath: string; [key: string]: unknown }, {
            returnToManager: returnToManager,
            returnToItem: returnToItem
          });
        }
      });

      // 关闭图像详情模态框（不清空 returnToManager/returnToItem，因为上面已经保存了）
      this.returnToManager = null;
      this.returnToItem = null;
      await super.close();
    } catch (error) {
      window.electronAPI.logError('ImageDetailManager.ts', 'Failed to create prompt for image:', error);
      app.showToast('打开新建提示词页面失败', 'error');
    }
  }

  /**
   * 打开提示词详情页面
   * @param prompt - 提示词对象
   * @private
   */
  private async openPromptDetail(prompt: IPrompt): Promise<void> {
    const app = this.app as unknown as IApp;

    try {
      await app.promptDetailManager?.open(prompt, {
        returnToManager: this,
        returnToItem: this.currentItem
      });
      // 隐藏图像详情（不关闭，保留状态），而不是关闭
      this.hide();
    } catch (error) {
      window.electronAPI.logError('ImageDetailManager.ts', 'Failed to open prompt detail:', error);
      app.showToast('打开提示词详情失败', 'error');
    }
  }

  /**
   * 隐藏模态框（不清理资源，用于跳转到提示词详情）
   */
  hide(): void {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.classList.remove('active');
    }
    // 临时重置 isFromDetailJump，允许提示词详情中的二级跳转
    const app = this.app as unknown as IApp;
    app.isFromDetailJump = false;
  }

  /**
   * 显示模态框（用于从提示词详情返回）
   */
  show(): void {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.classList.add('active');
    }
    // 恢复禁止二级跳转状态
    const app = this.app as unknown as IApp;
    app.isFromDetailJump = true;
  }

  /**
   * 切换批量模式（覆盖基类方法，添加调试日志）
   * @protected
   */
  protected toggleBatchMode(): void {
    super.toggleBatchMode();
  }

  async close(): Promise<void> {
    const returnToManager = this.returnToManager;
    const returnToItem = this.returnToItem;
    const returnToOptions = this.returnToOptions;

    const app = this.app as unknown as IApp;
    app.isFromDetailJump = false;

    await super.close();

    if (returnToManager && returnToItem) {
      // 使用保存的选项恢复状态，包括 filteredList
      await returnToManager.open(returnToItem as { id: string | number; [key: string]: unknown }, returnToOptions);
    }
  }
}
