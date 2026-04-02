import { DialogService, DialogConfig, DelaySaveStrategy } from '../services/index.ts';
import { ImagePreviewManager } from './ImagePreviewManager.ts';
import { cacheManager, DuplicatePreventionMixin } from '../../utils/index.ts';
import { IImage } from '../../types/entities.ts';

/**
 * App 类型定义
 */
interface IApp {
  showToast: (message: string, type?: string) => void;
  autoResizeTextarea: (element: HTMLElement) => void;
  eventBus?: {
    emit: (event: string) => void;
  } | null;
}

/**
 * 打开选项
 */
interface IOpenOptions {
  onClose?: (saved: boolean) => void | Promise<void>;
}

/**
 * 图像选择结果
 */
interface IImageSelectionResult {
  success: boolean;
  message?: string;
  images: IImage[];
}

/**
 * NewPromptManager 构造选项
 */
interface INewPromptManagerOptions {
  app: IApp;
}

/**
 * 新建提示词管理器
 * 使用延迟保存策略：选择 → 预览 → 确认保存
 * 职责：协调策略、预览管理和 UI 交互
 */
export class NewPromptManager extends DuplicatePreventionMixin(Object) {
  private app: IApp;
  private strategy: DelaySaveStrategy;
  private previewManager: ImagePreviewManager;

  // 状态
  private pendingTitle: string | null;
  private currentId: string | null;
  private prefillImages: IImage[];
  private onCloseCallback: ((saved: boolean) => void | Promise<void>) | null;

  // 防抖标志：防止重复打开文件对话框
  private isOpeningDialog: boolean;

  // 事件绑定标志
  private eventsBound: boolean;

  constructor(options: INewPromptManagerOptions) {
    super();
    this.app = options.app;
    this.strategy = new DelaySaveStrategy(this.app as unknown as Record<string, unknown>);
    this.previewManager = new ImagePreviewManager({
      containerId: 'newPromptImagePreviewList',
      onRemove: (index: number) => this.handleRemoveImage(index)
    });
    // 绑定事件委托（只需执行一次）
    this.previewManager.bindEvents();

    // 状态
    this.pendingTitle = null;
    this.currentId = null;
    this.prefillImages = [];
    this.onCloseCallback = null;

    // 防抖标志：防止重复打开文件对话框
    this.isOpeningDialog = false;

    // 事件绑定标志
    this.eventsBound = false;
  }

  /**
   * 打开新建提示词页面
   * @param prefillImages - 预填充的图像列表
   * @param options - 选项
   */
  async open(prefillImages: IImage[] = [], options: IOpenOptions = {}): Promise<void> {
    try {
      this.pendingTitle = null;
      this.currentId = null;
      this.prefillImages = prefillImages || [];
      this.onCloseCallback = options.onClose || null;
      this.strategy.clear(); // 清理之前的状态

      // 初始化表单
      const contentInput = document.getElementById('newPromptContent') as HTMLTextAreaElement | null;
      if (contentInput) {
        contentInput.value = '';
      }
      this.previewManager.clear();

      // 显示页面
      const page = document.getElementById('newPromptPage');
      if (page) {
        page.classList.add('active');
      }

      // 渲染预填充图像（如果有）
      if (this.prefillImages.length > 0) {
        await this.previewManager.renderSavedImages(this.prefillImages);
      }

      // 绑定事件
      if (!this.eventsBound) {
        this.bindEvents();
        this.eventsBound = true;
      }

      if (contentInput) {
        contentInput.focus();
      }

    } catch (error) {
      window.electronAPI.logError('NewPromptManager.ts', 'Failed to open new prompt page:', error);
      this.app.showToast('Failed to open new prompt page', 'error');
    }
  }

  /**
   * 关闭新建提示词页面
   * @param save - 是否保存
   */
  async close(save: boolean = true): Promise<void> {
    const modal = document.getElementById('newPromptPage');

    if (!save) {
      // 取消时清理（不显示提醒）
      this.previewManager.clear();
      this.strategy.clear();
    } else {
      // 使用防重复提交机制执行保存
      const result = await this.executeWithPrevention('close', async () => {
        // 完成时保存图像并创建提示词
        const contentInput = document.getElementById('newPromptContent') as HTMLTextAreaElement | null;
        const content = contentInput?.value.trim();
        if (!content) {
          this.app.showToast('提示词内容不能为空', 'error');
          return { success: false };
        }

        // 检查是否有新上传的图像需要保存
        const filePaths = this.strategy.getFilePaths();
        let newImages: IImage[] = [];
        if (filePaths.length > 0) {
          // 保存新上传的图像到数据目录
          const result = await this.strategy.confirm('new-prompt') as IImageSelectionResult;
          if (!result.success) {
            this.app.showToast(result.message || '保存图像失败', 'error');
            return { success: false };
          }
          newImages = result.images || [];
        }

        try {
          // 合并预填充图像和新保存图像
          const allImages = [...(this.prefillImages || []), ...newImages];
          await window.electronAPI.addPrompt({
            tags: [],
            content: content,
            images: allImages,
            isSafe: 1
          });

          this.app.showToast('Prompt created successfully');

          // 更新关联图像的缓存（因为数据库已更新 updated_at 和关联关系）
          for (const image of allImages) {
            const updatedImage = await window.electronAPI.getImageById(image.id);
            if (updatedImage) {
              cacheManager.cacheImages([updatedImage]);
            }
          }

          // 按需刷新：有图像时刷新图像列表，始终刷新提示词列表
          if (allImages.length > 0) {
            this.app.eventBus?.emit('imagesChanged');
          }
          this.app.eventBus?.emit('promptsChanged');
          return { success: true };
        } catch (error) {
          window.electronAPI.logError('NewPromptManager.ts', 'Failed to create prompt:', error);
          this.app.showToast('Failed to create prompt', 'error');
          return { success: false };
        }
      }, { errorMessage: '正在保存提示词中...' });

      // 如果防重复提交机制返回 undefined，说明操作正在进行中
      if (result === undefined) {
        return;
      }

      // 如果保存失败，不继续执行关闭逻辑
      if (!result?.success) {
        return;
      }
    }

    if (modal) {
      modal.classList.remove('active');
    }

    // 调用关闭回调（如果有）
    if (this.onCloseCallback) {
      await this.onCloseCallback(save);
      this.onCloseCallback = null;
    }

    this.resetState();

    // 注意：刷新通过事件触发，不需要直接调用
  }

  /**
   * 处理选择多图
   */
  async handleSelectImages(): Promise<void> {
    // 防抖保护：防止重复打开文件对话框
    if (this.isOpeningDialog) {
      return;
    }

    this.isOpeningDialog = true;

    try {
      const filePaths = await window.electronAPI.openImageFiles();

      const result = await this.strategy.selectFiles(filePaths);
      if (!result.success) return;

      // 更新预览
      this.previewManager.render(this.strategy.getFilePaths());
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
   */
  async handleRemoveImage(index: number): Promise<void> {
    // 检查是否是预填充图像（通过检查 previewManager 中对应索引的元素是否有 data-saved 属性）
    const container = this.previewManager.getContainer();
    const previewItem = container?.querySelector(`.image-preview-item[data-index="${index}"]`);
    const isSavedImage = previewItem?.hasAttribute('data-saved');

    if (isSavedImage) {
      // 预填充图像直接从列表移除，不需要确认，不删除数据库
      this.prefillImages.splice(index, 1);
      this.previewManager.renderSavedImages(this.prefillImages);
    } else {
      // 新上传的图像需要确认
      const confirmed = await DialogService.showConfirmDialogByConfig(DialogConfig.REMOVE_NEW_IMAGE);
      if (!confirmed) return;

      const result = this.strategy.removeFile(index);
      if (result.success && result.filePaths) {
        this.previewManager.render(result.filePaths);
      }
    }
  }

  /**
   * 绑定事件
   */
  bindEvents(): void {
    const cancelBtn = document.getElementById('newPromptCancelBtn');
    const doneBtn = document.getElementById('newPromptDoneBtn');
    const closeBtn = document.getElementById('closeNewPromptPage');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close(false));
    }
    if (doneBtn) {
      doneBtn.addEventListener('click', () => this.close(true));
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close(false));
    }

    const contentInput = document.getElementById('newPromptContent') as HTMLTextAreaElement | null;
    if (contentInput) {
      contentInput.addEventListener('input', () => {
        this.app.autoResizeTextarea(contentInput);
      });
    }

    // 图像上传区域点击
    const uploadArea = document.getElementById('newPromptImageUploadArea');
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
  }

  /**
   * 重置状态
   */
  resetState(): void {
    this.pendingTitle = null;
    this.currentId = null;
    this.prefillImages = [];
    this.onCloseCallback = null;
    this.strategy.clear();
    this.eventsBound = false;
    // 重置防重复提交状态
    this.resetPreventionState('close');
  }
}
