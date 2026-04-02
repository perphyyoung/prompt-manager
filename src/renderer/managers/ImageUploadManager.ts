import { DelaySaveStrategy } from '../services/index.ts';
import { ImagePreviewManager } from './ImagePreviewManager.ts';

/**
 * App 类型定义
 */
interface IApp {
  showToast: (message: string, type?: string) => void;
  eventBus?: {
    emit: (event: string) => void;
  } | null;
}

/**
 * 图像选择结果
 */
interface IImageSelectionResult {
  success: boolean;
  message?: string;
  images: Array<{ id: string }>;
  count?: number;
}

/**
 * 图像操作结果
 */
interface IImageOperationResult {
  success: boolean;
  filePaths: string[];
}

/**
 * ImageUploadManager 构造选项
 */
interface IImageUploadManagerOptions {
  app: IApp;
}

/**
 * 图像上传管理器
 * 使用延迟保存策略：选择 → 预览 → 确认保存
 * 职责：协调策略、预览管理和 UI 交互
 */
export class ImageUploadManager {
  private app: IApp;
  private strategy: DelaySaveStrategy;
  private previewManager: ImagePreviewManager;

  // 防抖标志：防止重复打开文件对话框
  private isOpeningDialog: boolean;

  constructor(options: IImageUploadManagerOptions) {
    this.app = options.app;
    this.strategy = new DelaySaveStrategy(this.app as unknown as Record<string, unknown>);
    this.previewManager = new ImagePreviewManager({
      containerId: 'modalImagePreviewList',
      onRemove: (index: number) => this.handleRemoveImage(index)
    });
    // 绑定事件委托（只需执行一次）
    this.previewManager.bindEvents();

    // 防抖标志：防止重复打开文件对话框
    this.isOpeningDialog = false;
  }

  /**
   * 打开上传图像模态框
   */
  open(): void {
    const modal = document.getElementById('imageUploadModal');
    if (modal) {
      modal.classList.add('active');
    }
  }

  /**
   * 关闭上传图像模态框
   */
  async close(): Promise<void> {
    const modal = document.getElementById('imageUploadModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  /**
   * 绑定图像上传事件
   */
  bindEvents(): void {
    this.bindModalUploadEvents();
    this.bindModalButtonEvents();
  }

  /**
   * 绑定模态框上传事件
   */
  bindModalUploadEvents(): void {
    const modalUploadArea = document.getElementById('modalImageUploadArea');
    if (!modalUploadArea) return;

    // 点击上传区域 - 选择多图
    modalUploadArea.addEventListener('click', async (e) => {
      if ((e.target as HTMLElement).closest('.remove-image')) return;
      await this.handleSelectImages();
    });

    // 禁止拖拽上传
    modalUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'none';
      }
    });
    modalUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
    });
  }

  /**
   * 绑定模态框按钮事件
   */
  bindModalButtonEvents(): void {
    const cancelBtn = document.getElementById('cancelImageUploadBtn');
    const confirmBtn = document.getElementById('confirmImageUploadBtn');
    const closeBtn = document.getElementById('closeImageUploadModal');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.handleCancel());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.handleCancel());
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.handleConfirm());
    }
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
      // 打开安全文件对话框（支持多选）
      const filePaths = await window.electronAPI.openImageFiles();

      const result = await this.strategy.selectFiles(filePaths);
      if (!result.success) return;

      // 显示预览
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
  handleRemoveImage(index: number): void {
    const result = this.strategy.removeFile(index) as IImageOperationResult;
    if (result.success) {
      this.previewManager.render(result.filePaths);
    }
  }

  /**
   * 确认上传（延迟保存）
   */
  async handleConfirm(): Promise<void> {
    // 检查是否有已上传的图像
    const filePaths = this.strategy.getFilePaths();
    if (!filePaths || filePaths.length === 0) {
      this.app.showToast('必须上传图像才能保存', 'warning');
      return;
    }

    // 显示进度提示
    this.app.showToast('正在保存图像...', 'info');

    const result = await this.strategy.confirm('image-manager', (current: number, total: number) => {
      // 更新进度
      this.app.showToast(`正在保存图像... (${current}/${total})`, 'info');
    }) as IImageSelectionResult;

    if (!result.success) {
      this.app.showToast(result.message || '保存失败', 'error');
      return;
    }

    // 获取提示词内容
    const promptTextarea = document.getElementById('uploadImagePrompt') as HTMLTextAreaElement | null;
    const promptContent = promptTextarea?.value?.trim();

    // 标记是否需要刷新提示词列表
    let shouldRefreshPrompts = false;

    // 如果有提示词内容，创建提示词并关联图像
    if (promptContent) {
      try {
        const imageIds = result.images.map(img => img.id);
        await this.createPromptWithImages(promptContent, imageIds);
        this.app.showToast(`成功保存 ${result.count} 张图像并创建提示词`, 'success');
        shouldRefreshPrompts = true;
      } catch (error) {
        window.electronAPI.logError('ImageUploadManager.ts', 'Failed to create prompt:', error);
        this.app.showToast(`图像已保存，但提示词创建失败: ${error instanceof Error ? error.message : String(error)}`, 'warning');
      }
    } else {
      this.app.showToast(`成功保存 ${result.count} 张图像`, 'success');
    }

    // 清理
    this.previewManager.clear();
    this.strategy.clear();

    // 清空提示词内容
    if (promptTextarea) {
      promptTextarea.value = '';
    }

    // 按需刷新：始终刷新图像列表，有提示词时刷新提示词列表
    this.app.eventBus?.emit('imagesChanged');
    if (shouldRefreshPrompts) {
      this.app.eventBus?.emit('promptsChanged');
    }
    this.close();
  }

  /**
   * 创建提示词并关联图像
   * @param content - 提示词内容
   * @param imageIds - 图像ID数组
   * @returns Promise<void>
   */
  async createPromptWithImages(content: string, imageIds: string[]): Promise<void> {
    const prompt = {
      title: '',  // 留空，让 main.js 使用 ID 作为标题
      content,
      tags: [],
      images: imageIds.map(id => ({ id })),
      note: '',
      isSafe: 1
    };

    await window.electronAPI.addPrompt(prompt);
    // 注意：不在这里触发事件，由调用方统一处理刷新
  }

  /**
   * 取消上传
   */
  async handleCancel(): Promise<void> {
    this.previewManager.clear();
    this.strategy.clear();
    this.close();
  }
}
