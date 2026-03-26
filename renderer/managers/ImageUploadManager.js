import { DelaySaveStrategy } from '../services/index.js';
import { ImagePreviewManager } from './ImagePreviewManager.js';

/**
 * 图像上传管理器
 * 使用延迟保存策略：选择 → 预览 → 确认保存
 * 职责：协调策略、预览管理和 UI 交互
 */
export class ImageUploadManager {
  /**
   * @param {Object} options - 配置选项
   * @param {Object} options.app - 应用实例
   */
  constructor(options = {}) {
    this.app = options.app;
    this.strategy = new DelaySaveStrategy(this.app);
    this.previewManager = new ImagePreviewManager({
      containerId: 'modalImagePreviewList',
      onRemove: (index) => this.handleRemoveImage(index)
    });
    // 绑定事件委托（只需执行一次）
    this.previewManager.bindEvents();

    // 防抖标志：防止重复打开文件对话框
    this.isOpeningDialog = false;
  }

  /**
   * 打开上传图像模态框
   */
  open() {
    const modal = document.getElementById('imageUploadModal');
    if (modal) {
      modal.classList.add('active');
    }
  }

  /**
   * 关闭上传图像模态框
   */
  async close() {
    const modal = document.getElementById('imageUploadModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  /**
   * 绑定图像上传事件
   */
  bindEvents() {
    this.bindModalUploadEvents();
    this.bindModalButtonEvents();
  }

  /**
   * 绑定模态框上传事件
   */
  bindModalUploadEvents() {
    const modalUploadArea = document.getElementById('modalImageUploadArea');
    if (!modalUploadArea) return;

    // 点击上传区域 - 选择多图
    modalUploadArea.addEventListener('click', async (e) => {
      if (e.target.closest('.remove-image')) return;
      await this.handleSelectImages();
    });

    // 禁止拖拽上传
    modalUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'none';
    });
    modalUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
    });
  }

  /**
   * 绑定模态框按钮事件
   */
  bindModalButtonEvents() {
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
  async handleSelectImages() {
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

      // 启用确定按钮
      const confirmBtn = document.getElementById('confirmImageUploadBtn');
      if (confirmBtn) {
        confirmBtn.disabled = false;
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
   * @param {number} index - 图像索引
   */
  handleRemoveImage(index) {
    const result = this.strategy.removeFile(index);
    if (result.success) {
      this.previewManager.render(result.filePaths);
    }
  }

  /**
   * 确认上传（延迟保存）
   */
  async handleConfirm() {
    // 显示进度提示
    const progressToast = this.app.showToast('正在保存图像...', 'info', 0);

    const result = await this.strategy.confirm('image-manager', (current, total) => {
      // 更新进度
      this.app.showToast(`正在保存图像... (${current}/${total})`, 'info', 0);
    });

    // 关闭进度提示
    if (progressToast) {
      progressToast.remove();
    }

    if (!result.success) {
      this.app.showToast(result.message, 'error');
      return;
    }

    // 获取提示词内容
    const promptContent = document.getElementById('uploadImagePrompt')?.value?.trim();

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
        window.electronAPI.logError('ImageUploadManager.js', 'Failed to create prompt:', error);
        this.app.showToast(`图像已保存，但提示词创建失败: ${error.message}`, 'warning');
      }
    } else {
      this.app.showToast(`成功保存 ${result.count} 张图像`, 'success');
    }

    // 清理
    this.previewManager.clear();
    this.strategy.clear();

    // 清空提示词内容
    const promptTextarea = document.getElementById('uploadImagePrompt');
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
   * @param {string} content - 提示词内容
   * @param {string[]} imageIds - 图像ID数组
   * @returns {Promise<void>}
   */
  async createPromptWithImages(content, imageIds) {
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
  async handleCancel() {
    this.previewManager.clear();
    this.strategy.clear();
    this.close();
  }
}
