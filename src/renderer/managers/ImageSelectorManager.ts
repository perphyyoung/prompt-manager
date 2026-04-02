import { isSameId, HtmlUtils } from '../../utils/index.ts';
import { Constants } from '../../constants.ts';
import { IImage } from '../../types/entities.ts';

/**
 * App 类型定义
 */
interface IApp {
  viewMode: string;
}

/**
 * ImageSelectorManager 构造选项
 */
interface IImageSelectorManagerOptions {
  app: IApp;
}

/**
 * 打开选项
 */
interface IOpenOptions {
  onConfirm?: (image: IImage) => void | Promise<void>;
}

/**
 * 图像选择器管理器
 * 负责管理提示词编辑时的图像选择功能
 */
export class ImageSelectorManager {
  private app: IApp;

  // 选择状态
  private selectedImages: Array<{ id: string; path: string }>;
  private onConfirm: ((image: IImage) => void | Promise<void>) | null;

  // 排序状态（独立于主界面的排序设置）
  private sortBy: string;
  private sortOrder: string;

  constructor(options: IImageSelectorManagerOptions) {
    this.app = options.app;

    // 选择状态
    this.selectedImages = [];
    this.onConfirm = null;

    // 排序状态（独立于主界面的排序设置）
    this.sortBy = localStorage.getItem(Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_BY) || 'updatedAt';
    this.sortOrder = localStorage.getItem(Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_ORDER) || 'desc';
  }

  /**
   * 打开图像选择器
   * @param options - 选项
   */
  async open(options: IOpenOptions = {}): Promise<void> {
    const modal = document.getElementById('imageSelectorModal');
    if (modal) {
      modal.classList.add('active');
    }

    // 初始化选择状态
    this.selectedImages = [];
    this.onConfirm = options.onConfirm || null;
    const confirmBtn = document.getElementById('confirmImageSelectorBtn') as HTMLButtonElement | null;
    if (confirmBtn) {
      confirmBtn.disabled = true;
    }

    // 重置搜索和筛选状态
    const searchInput = document.getElementById('imageSelectorSearchInput') as HTMLInputElement | null;
    const tagFilter = document.getElementById('imageSelectorTagFilter') as HTMLSelectElement | null;
    if (searchInput) searchInput.value = '';
    if (tagFilter) tagFilter.value = '';

    // 加载图像列表
    await this.renderGrid();
    await this.renderTagFilters();

    // 绑定事件
    this.bindEvents();
  }

  /**
   * 关闭图像选择器
   */
  close(): void {
    const modal = document.getElementById('imageSelectorModal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.selectedImages = [];
    this.onConfirm = null;
  }

  /**
   * 渲染图像选择器网格
   */
  async renderGrid(): Promise<void> {
    const grid = document.getElementById('imageSelectorGrid');
    const emptyState = document.getElementById('imageSelectorEmpty');
    const searchInput = document.getElementById('imageSelectorSearchInput') as HTMLInputElement | null;
    const tagFilter = document.getElementById('imageSelectorTagFilter') as HTMLSelectElement | null;

    if (!grid || !emptyState) return;

    try {
      // 获取所有图像（使用选择图像界面独立的排序设置）
      let images: IImage[] = await window.electronAPI.getImages(this.sortBy, this.sortOrder);

      // 根据 viewMode 过滤（safe 模式只显示安全内容）
      if (this.app.viewMode === 'safe') {
        images = images.filter(img => img.isSafe !== 0);
      }

      // 应用搜索过滤
      const searchTerm = searchInput?.value?.trim().toLowerCase();
      if (searchTerm) {
        images = images.filter(img =>
          img.fileName?.toLowerCase().includes(searchTerm) ||
          img.note?.toLowerCase().includes(searchTerm)
        );
      }

      // 应用标签过滤
      const selectedTag = tagFilter?.value;
      if (selectedTag) {
        images = images.filter(img =>
          img.tags?.includes(selectedTag)
        );
      }

      if (images.length === 0) {
        grid.innerHTML = '';
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
      }

      grid.style.display = 'grid';
      emptyState.style.display = 'none';

      // 获取所有图像的完整路径
      const imageItems = await Promise.all(images.map(async (image) => {
        const imagePath = image.relativePath;
        const fullPath = imagePath ? await window.electronAPI.getImagePath(imagePath) : '';
        return { ...image, fullPath };
      }));

      grid.innerHTML = imageItems.map(image => `
        <div class="image-selector-item" data-image-id="${image.id}" data-image-path="${HtmlUtils.escapeHtml(image.relativePath || '')}">
          <img src="file://${HtmlUtils.escapeHtml(image.fullPath)}" alt="${HtmlUtils.escapeHtml(image.fileName)}" loading="lazy">
        </div>
      `).join('');

      // 绑定点击事件
      grid.querySelectorAll('.image-selector-item').forEach(item => {
        item.addEventListener('click', () => {
          // 单选模式
          grid.querySelectorAll('.image-selector-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');

          const imageId = (item as HTMLElement).dataset.imageId;
          const imagePath = (item as HTMLElement).dataset.imagePath;
          if (imageId && imagePath) {
            this.selectedImages = [{ id: imageId, path: imagePath }];
            const confirmBtn = document.getElementById('confirmImageSelectorBtn') as HTMLButtonElement | null;
            if (confirmBtn) {
              confirmBtn.disabled = false;
            }
          }
        });
      });
    } catch (error) {
      window.electronAPI.logError('ImageSelectorManager.ts', 'Failed to render image selector:', error);
      grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">加载失败</p>';
    }
  }

  /**
   * 渲染图像选择器标签筛选器
   */
  async renderTagFilters(): Promise<void> {
    const tagFilter = document.getElementById('imageSelectorTagFilter') as HTMLSelectElement | null;
    if (!tagFilter) return;

    try {
      const tags: string[] = await window.electronAPI.getImageTags();
      tagFilter.innerHTML = '<option value="">所有标签</option>' +
        tags.map(tag => `<option value="${HtmlUtils.escapeHtml(tag)}">${HtmlUtils.escapeHtml(tag)}</option>`).join('');
    } catch (error) {
      window.electronAPI.logError('ImageSelectorManager.ts', 'Failed to render image selector tag filters:', error);
    }
  }

  /**
   * 绑定图像选择器事件
   */
  bindEvents(): void {
    // 关闭按钮
    document.getElementById('closeImageSelectorModal')?.addEventListener('click', () => this.close());
    document.getElementById('cancelImageSelectorBtn')?.addEventListener('click', () => this.close());

    // 搜索输入
    const searchInput = document.getElementById('imageSelectorSearchInput') as HTMLInputElement | null;
    const clearImageSelectorSearchBtn = document.getElementById('clearImageSelectorSearchBtn');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.renderGrid();
        // 显示/隐藏清空按钮
        if (clearImageSelectorSearchBtn) {
          clearImageSelectorSearchBtn.style.display = searchInput.value ? 'flex' : 'none';
        }
      });
    }
    // 清空选择图像搜索按钮
    if (clearImageSelectorSearchBtn) {
      clearImageSelectorSearchBtn.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
        }
        this.renderGrid();
        clearImageSelectorSearchBtn.style.display = 'none';
        if (searchInput) {
          searchInput.focus();
        }
      });
    }

    // 标签筛选
    const tagFilter = document.getElementById('imageSelectorTagFilter');
    if (tagFilter) {
      tagFilter.addEventListener('change', () => {
        this.renderGrid();
      });
    }

    // 排序选择（使用独立的状态）
    const sortSelect = document.getElementById('imageSelectorSortSelect') as HTMLSelectElement | null;
    if (sortSelect) {
      sortSelect.value = `${this.sortBy}-${this.sortOrder}`;
      sortSelect.addEventListener('change', (e) => {
        const [sortBy, sortOrder] = (e.target as HTMLSelectElement).value.split('-');
        this.sortBy = sortBy;
        this.sortOrder = sortOrder;
        localStorage.setItem(Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_BY, sortBy);
        localStorage.setItem(Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_ORDER, sortOrder);
        this.renderGrid();
      });
    }

    // 排序逆序按钮（使用独立的状态）
    const sortReverseBtn = document.getElementById('imageSelectorSortReverseBtn');
    if (sortReverseBtn) {
      sortReverseBtn.addEventListener('click', () => {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        localStorage.setItem(Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_ORDER, this.sortOrder);
        if (sortSelect) {
          sortSelect.value = `${this.sortBy}-${this.sortOrder}`;
        }
        this.renderGrid();
      });
    }

    // 确认选择
    document.getElementById('confirmImageSelectorBtn')?.addEventListener('click', () => {
      this.confirmSelection();
    });

    // 点击外部关闭
    const modal = document.getElementById('imageSelectorModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (isSameId((e.target as HTMLElement).id, 'imageSelectorModal')) this.close();
      });
    }
  }

  /**
   * 确认图像选择
   */
  async confirmSelection(): Promise<void> {
    if (!this.selectedImages || this.selectedImages.length === 0) return;

    const selectedImage = this.selectedImages[0];

    // 获取完整图像信息
    try {
      const image = await window.electronAPI.getImageById(selectedImage.id);
      if (image && this.onConfirm) {
        await this.onConfirm(image);
      }
    } catch (error) {
      window.electronAPI.logError('ImageSelectorManager.ts', 'Failed to get image details:', error);
    }

    this.close();
  }
}
