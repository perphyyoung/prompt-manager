import { cacheManager } from '../../utils/index.ts';
import { PanelManagerBase } from './PanelManagerBase.ts';
import { PanelRenderer, UnifiedCardRenderer, ImageMainConfig, UnifiedListRenderer, ImageListConfig } from './SharedComponents/index.ts';
import { Constants } from '../../constants.ts';
import { DialogService, DialogConfig } from '../services/index.ts';
import { BatchConfig } from '../config/index.ts';
import { IImage } from '../../types/entities.ts';
import type { LRUCache } from '../../utils/LRUCache.ts';
import { CardEventStrategy } from './Strategies/CardEventStrategy.ts';
import { ListEventStrategy } from './Strategies/ListEventStrategy.ts';
import { IEventStrategy, EventContext, ItemType } from './Strategies/IEventStrategy.ts';

interface ImagePanelManagerOptions {
  app: {
    imageCache: LRUCache<IImage>;
    searchSortManager?: { getImageSearchQuery: () => string };
    openImageDetailModal: (image: IImage, options: { filteredList: IImage[] }) => void;
    showToast: (message: string, type: string) => void;
    emit: (event: string, data?: unknown) => void;
    currentPanel: string;
    viewMode: string;
    trashManager?: { loadTrash: () => Promise<void> };
    renderStatistics?: () => Promise<void>;
    promptHoverTooltip?: {
      bind: (selector: string, options: {
        getContent: (element: Element) => string;
        getImageId: (element: Element) => string | null;
        delay: number;
      }) => void;
    };
  };
  tagManager?: unknown;
  eventBus?: { emit: (event: string, data?: unknown) => void; on: (event: string, callback: () => void) => void };
  toolbarConfig?: {
    toolbarId: string;
    actionsId: string;
    countId: string;
    selectAllCheckboxId: string;
    label: string;
    buttons: Array<{ id: string; text: string; className: string; title?: string; action: string }>;
    onDelete?: () => void;
    onAddTag?: () => void;
    onSetSafe?: () => void;
    onSetUnsafe?: () => void;
    onCancel?: () => void;
  };
}

interface PromptRef {
  promptId: string;
  promptContent?: string;
}

interface ImageWithPromptContent extends IImage {
  promptRefs?: PromptRef[];
}

/**
 * 图像面板管理器
 * 负责图像列表的渲染、筛选、标签管理等功能
 */
export class ImagePanelManager extends PanelManagerBase {
  private filteredImages: IImage[] = [];

  // 图像特殊标签检查函数 Map
  static IMAGE_TAG_CHECKS = new Map<string, (img: IImage) => boolean>([
    [Constants.FAVORITE_TAG, (img) => !!img.isFavorite],
    [Constants.UNREFERENCED_TAG, (img) => !img.promptRefs || img.promptRefs.length === 0],
    [Constants.MULTI_REF_TAG, (img) => !!img.promptRefs && img.promptRefs.length > 1],
    [Constants.SAFE_TAG, (img) => img.isSafe !== 0],
    [Constants.UNSAFE_TAG, (img) => img.isSafe === 0],
    [Constants.NO_TAG_TAG, (img) => !img.tags || img.tags.length === 0]
  ]);

  constructor(options: ImagePanelManagerOptions) {
    super({
      app: options.app,
      tagManager: options.tagManager,
      eventBus: options.eventBus,
      storagePrefix: 'image',
      defaultCardSize: 180,
      toolbarConfig: options.toolbarConfig,
      operationConfig: BatchConfig.image.operations
    });
    this.filteredImages = [];
  }

  /**
   * 获取图像列表（从缓存读取）
   */
  get images(): IImage[] {
    return Array.from((this.app as ImagePanelManagerOptions['app']).imageCache.values());
  }

  getItems(): IImage[] {
    return Array.from((this.app as ImagePanelManagerOptions['app']).imageCache.values());
  }

  /**
   * 获取搜索查询（实现基类抽象方法）
   */
  getSearchQuery(): string {
    return (this.app as ImagePanelManagerOptions['app']).searchSortManager?.getImageSearchQuery() || '';
  }

  /**
   * 检查图像是否匹配搜索查询（实现基类抽象方法）
   * 支持文件名、标签、备注搜索
   */
  matchesSearch(img: IImage, lowerQuery: string): boolean {
    if (!lowerQuery) return true;
    return (
      img.fileName?.toLowerCase().includes(lowerQuery) ||
      (img.tags && img.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) ||
      false
    );
  }

  /**
   * 获取特殊标签检查函数 Map（实现基类抽象方法）
   */
  getSpecialTagChecks(): Map<string, (item: Record<string, unknown>) => boolean> {
    return ImagePanelManager.IMAGE_TAG_CHECKS as Map<string, (item: Record<string, unknown>) => boolean>;
  }

  /**
   * 获取项目类型标识（实现基类抽象方法）
   */
  getItemType(): string {
    return 'image';
  }

  /**
   * 加载图像列表数据（实现基类抽象方法）
   */
  async loadData(): Promise<IImage[]> {
    try {
      const images = await window.electronAPI.getImages('updatedAt', 'desc');
      cacheManager.cacheImages(images);
      return images;
    } catch (error) {
      cacheManager.getImageCache().clear();
      throw error;
    }
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    await this.loadData();
  }

  /**
   * 渲染容器（实现基类抽象方法）
   */
  async renderContainer(filtered: IImage[]): Promise<void> {
    this.filteredImages = filtered;

    const container = document.getElementById('imageGrid');
    const listContainer = document.getElementById('imageList');

    if (filtered.length === 0) {
      PanelRenderer.showEmptyState('imageGrid', 'imageEmptyState', '暂无图像');
      if (listContainer) listContainer.style.display = 'none';
      return;
    }

    PanelRenderer.hideEmptyState('imageGrid', 'imageEmptyState');

    // 根据视图模式渲染
    if (this.viewModeType === 'grid') {
      container!.style.display = 'grid';
      if (listContainer) listContainer.style.display = 'none';

      // 渲染网格视图
      PanelRenderer.renderGrid(filtered, (img) => this.createCard(img as IImage), 'imageGrid');
      this.bindItemEvents(filtered);
      this.bindCardButtonEvents(filtered);
      this.loadCardBackgrounds();
      this.bindHoverPreview('.image-card');
      this.bindCardDropEvents(container!);
    } else {
      // 列表视图
      container!.style.display = 'none';
      if (listContainer) {
        listContainer.style.display = 'flex';
        await this.renderListView(filtered);
      }
    }
  }

  /**
   * 创建图像卡片 HTML（实现基类抽象方法）
   */
  createCard(img: IImage, index?: number): string {
    return UnifiedCardRenderer.render(ImageMainConfig, img, {
      icons: Constants.ICONS,
      sortBy: this.sortBy,
      app: this.app,
      selectedIds: this.selectionManager.selectedIds,
      index
    });
  }

  /**
   * 绑定卡片按钮事件（删除、收藏、复制）
   */
  bindCardButtonEvents(filtered: IImage[]): void {
    const container = document.getElementById('imageGrid');
    if (!container) return;

    filtered.forEach(img => {
      const card = container.querySelector(`[data-id="${img.id}"]`);
      if (!card) return;

      // 删除按钮
      const deleteBtn = card.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const confirmed = await DialogService.showConfirmDialogByConfig(DialogConfig.DELETE_IMAGE_TO_TRASH);
          if (confirmed) {
            await this.deleteItem(String(img.id));
          }
        });
      }

      // 收藏按钮
      const favoriteBtn = card.querySelector('.favorite-btn');
      if (favoriteBtn) {
        favoriteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.toggleFavorite(String(img.id), !img.isFavorite);
        });
      }

      // 复制按钮
      const copyBtn = card.querySelector('.copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const imgWithPrompt = img as ImageWithPromptContent;
          if (imgWithPrompt.promptRefs && imgWithPrompt.promptRefs.length > 0) {
            const promptContent = imgWithPrompt.promptRefs[0].promptContent;
            if (promptContent) {
              try {
                await window.electronAPI.copyToClipboard(promptContent);
                (this.app as ImagePanelManagerOptions['app']).showToast('已复制到剪贴板', 'success');
              } catch (error) {
                (this.app as ImagePanelManagerOptions['app']).showToast('复制失败', 'error');
              }
            } else {
              (this.app as ImagePanelManagerOptions['app']).showToast('没有可复制的提示词内容', 'warning');
            }
          } else {
            (this.app as ImagePanelManagerOptions['app']).showToast('没有关联的提示词', 'warning');
          }
        });
      }
    });
  }

  /**
   * 异步加载卡片背景图（实现基类抽象方法）
   */
  async loadCardBackgrounds(): Promise<void> {
    const container = document.getElementById('imageGrid');
    if (!container) return;

    const cards = container.querySelectorAll('.image-card');
    for (const card of cards) {
      const imageId = (card as HTMLElement).dataset.id;
      const img = this.images.find(i => String(i.id) === String(imageId));
      if (!img) continue;

      const imagePath = img.thumbnailPath || img.relativePath;
      if (!imagePath) continue;

      try {
        const fullPath = await window.electronAPI.getImagePath(imagePath as string);
        const bgElement = card.querySelector('.image-card-bg, .card__bg');
        if (bgElement) {
          (bgElement as HTMLElement).style.backgroundImage = `url('file://${fullPath.replace(/\\/g, '/')}')`;
        }
      } catch (error) {
        window.electronAPI.logError('ImagePanelManager.ts', 'Failed to load card background:', error);
      }
    }
  }

  /**
   * 渲染图像列表视图（实现基类抽象方法）
   */
  async renderListView(filtered: IImage[]): Promise<void> {
    const listContainer = document.getElementById('imageList');
    if (!listContainer) return;

    const isCompact = this.viewModeType === 'list-compact';

    // 使用统一列表渲染器生成列表项 HTML
    listContainer.innerHTML = filtered.map((img, index) =>
      UnifiedListRenderer.render(ImageListConfig, img, {
        icons: Constants.ICONS,
        isCompact,
        isSelected: this.selectionManager.isSelected(String(img.id)),
        index
      })
    ).join('');

    // 异步加载列表缩略图
    this.loadImageListThumbnails();

    // 绑定事件
    this.bindItemEvents(filtered);
    this.bindListButtonEvents(filtered);
    this.bindHoverPreview('.list-item--image');
    this.bindCardDropEvents(listContainer);
  }

  /**
   * 异步加载列表视图缩略图
   */
  async loadImageListThumbnails(): Promise<void> {
    const listContainer = document.getElementById('imageList');
    if (!listContainer) return;

    const items = listContainer.querySelectorAll('.list-item--image');
    for (const item of items) {
      const imagePath = (item as HTMLElement).dataset.imagePath;
      if (!imagePath) continue;

      try {
        const fullPath = await window.electronAPI.getImagePath(imagePath);
        const wrapper = item.querySelector('.list-item__thumbnail-wrapper');
        if (wrapper) {
          wrapper.innerHTML = `<img src="file://${fullPath.replace(/\\/g, '/').replace(/"/g, '&quot;')}" alt="" class="list-item__thumbnail">`;
        }
      } catch (error) {
        window.electronAPI.logError('ImagePanelManager.ts', 'Failed to load list thumbnail:', error);
      }
    }
  }

  /**
   * 绑定列表按钮事件（删除、收藏、复制）
   */
  bindListButtonEvents(filtered: IImage[]): void {
    const listContainer = document.getElementById('imageList');
    if (!listContainer) return;

    // 收藏按钮事件
    listContainer.querySelectorAll('.favorite-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        const img = filtered.find(i => String(i.id) === String(id));
        if (img) {
          await this.toggleFavorite(String(id), !img.isFavorite);
        }
      });
    });

    // 删除按钮事件
    listContainer.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        const confirmed = await DialogService.showConfirmDialogByConfig(DialogConfig.DELETE_IMAGE_TO_TRASH);
        if (confirmed) {
          await this.deleteItem(String(id));
        }
      });
    });

    // 复制按钮事件
    listContainer.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        const img = filtered.find(i => String(i.id) === String(id));
        const imgWithPrompt = img as ImageWithPromptContent | undefined;
        if (imgWithPrompt && imgWithPrompt.promptRefs && imgWithPrompt.promptRefs.length > 0) {
          const promptContent = imgWithPrompt.promptRefs[0].promptContent;
          if (promptContent) {
            try {
              await window.electronAPI.copyToClipboard(promptContent);
              (this.app as ImagePanelManagerOptions['app']).showToast('已复制到剪贴板', 'success');
            } catch (error) {
              (this.app as ImagePanelManagerOptions['app']).showToast('复制失败', 'error');
            }
          } else {
            (this.app as ImagePanelManagerOptions['app']).showToast('没有可复制的提示词内容', 'warning');
          }
        } else {
          (this.app as ImagePanelManagerOptions['app']).showToast('没有关联的提示词', 'warning');
        }
      });
    });
  }

  /**
   * 绑定 hover 预览事件（实现基类抽象方法）
   */
  bindHoverPreview(selector: string): void {
    const tooltip = (this.app as ImagePanelManagerOptions['app']).promptHoverTooltip;
    if (!tooltip) return;

    tooltip.bind(selector, {
      getContent: (element: Element) => {
        const imageId = (element as HTMLElement).dataset.id || (element as HTMLElement).dataset.imageId;
        const image = this.images.find(img => String(img.id) === String(imageId));
        const imageWithPrompt = image as ImageWithPromptContent | undefined;
        if (!imageWithPrompt || !imageWithPrompt.promptRefs || imageWithPrompt.promptRefs.length === 0) {
          return '';
        }
        return imageWithPrompt.promptRefs[0].promptContent || '';
      },
      getImageId: (element: Element) => {
        const imageId = (element as HTMLElement).dataset.id || (element as HTMLElement).dataset.imageId;
        return imageId || null;
      },
      delay: 500
    });
  }

  /**
   * 绑定卡片拖拽事件（实现基类抽象方法）
   */
  bindCardDropEvents(container: HTMLElement): void {
    // 避免重复绑定
    if (container.dataset.dropEventsBound === 'true') {
      return;
    }
    container.dataset.dropEventsBound = 'true';

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      (e as DragEvent).dataTransfer!.dropEffect = 'copy';
    });

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      const dragSource = (e as DragEvent).dataTransfer!.getData('drag-source');
      const tagName = (e as DragEvent).dataTransfer!.getData('text/plain');

      if (dragSource === 'image-tag' && tagName) {
        const card = (e.target as Element).closest('.image-card');
        if (card) {
          const imageId = (card as HTMLElement).dataset.id || (card as HTMLElement).dataset.imageId;
          if (imageId) {
            try {
              await this.handleTagDrop(
                imageId,
                tagName,
                (this.app as ImagePanelManagerOptions['app']).imageCache,
                window.electronAPI.updateImage
              );
              (this.app as ImagePanelManagerOptions['app']).showToast('标签已添加', 'success');
            } catch (error) {
              (this.app as ImagePanelManagerOptions['app']).showToast((error as Error).message, 'error');
            }
          }
        }
      }
    });
  }

  /**
   * 获取标签筛选容器 ID（实现基类抽象方法）
   */
  getTagFilterContainerId(): string {
    return 'imageTagFilterList';
  }

  /**
   * 获取特殊标签容器 ID（实现基类抽象方法）
   */
  getSpecialTagsContainerId(): string {
    return 'imageTagFilterSpecialTags';
  }

  /**
   * 获取筛选动作按钮 ID（实现基类抽象方法）
   */
  getFilterActionBtnId(): string {
    return 'imageTagFilterActionBtn';
  }

  /**
   * 获取标签筛选头部容器 ID（实现基类抽象方法）
   */
  getTagFilterHeaderContainerId(): string {
    return 'imageTagFilterHeaderTags';
  }

  /**
   * 获取标签拖拽类型（实现基类抽象方法）
   */
  getTagDragType(): string {
    return 'image-tag';
  }

  /**
   * 获取所有标签（实现基类抽象方法）
   */
  async getAllTags(): Promise<string[]> {
    return window.electronAPI.getImageTags();
  }

  /**
   * 计算特殊标签计数（实现基类抽象方法）
   */
  calculateSpecialTagCounts(visibleItems: IImage[]): { tag: string; count: number }[] {
    const specialTags: { tag: string; count: number }[] = [];
    const favoriteCount = visibleItems.filter(img => img.isFavorite).length;
    const unreferencedCount = visibleItems.filter(img => !img.promptRefs || img.promptRefs.length === 0).length;
    const multiRefCount = visibleItems.filter(img => img.promptRefs && img.promptRefs.length > 1).length;
    const noTagCount = visibleItems.filter(img => !img.tags || img.tags.length === 0).length;

    if (favoriteCount > 0) {
      specialTags.push({ tag: Constants.FAVORITE_TAG, count: favoriteCount });
    }
    if (unreferencedCount > 0) {
      specialTags.push({ tag: Constants.UNREFERENCED_TAG, count: unreferencedCount });
    }
    if (multiRefCount > 0) {
      specialTags.push({ tag: Constants.MULTI_REF_TAG, count: multiRefCount });
    }
    if (noTagCount > 0) {
      specialTags.push({ tag: Constants.NO_TAG_TAG, count: noTagCount });
    }

    // NSFW 模式下显示安全评级标签
    if ((this.app as ImagePanelManagerOptions['app']).viewMode === 'nsfw') {
      const safeCount = visibleItems.filter(img => img.isSafe !== 0).length;
      const unsafeCount = visibleItems.filter(img => img.isSafe === 0).length;
      if (safeCount > 0) {
        specialTags.push({ tag: Constants.SAFE_TAG, count: safeCount });
      }
      if (unsafeCount > 0) {
        specialTags.push({ tag: Constants.UNSAFE_TAG, count: unsafeCount });
      }
    }

    return specialTags;
  }

  /**
   * 删除图像（实现基类抽象方法）
   */
  async deleteItem(id: string): Promise<void> {
    try {
      await window.electronAPI.softDeleteImage(id);
      cacheManager.removeCachedItem(id, 'image');
      const image = this.images.find(img => String(img.id) === String(id));
      if (image) {
        image.isDeleted = true;
      }
      await this.renderView();
      (this.app as ImagePanelManagerOptions['app']).emit('imagesChanged', { images: this.images });

      // 刷新回收站
      if ((this.app as ImagePanelManagerOptions['app']).trashManager) {
        await (this.app as ImagePanelManagerOptions['app']).trashManager!.loadTrash();
      }

      // 刷新统计界面
      if ((this.app as ImagePanelManagerOptions['app']).currentPanel === 'statistics') {
        await (this.app as ImagePanelManagerOptions['app']).renderStatistics?.();
      }

      (this.app as ImagePanelManagerOptions['app']).showToast('图像已移至回收站', 'success');
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'Failed to delete image:', error);
      (this.app as ImagePanelManagerOptions['app']).showToast('删除失败：' + (error as Error).message, 'error');
    }
  }

  /**
   * 切换收藏状态（实现基类抽象方法）
   */
  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    try {
      await window.electronAPI.updateImage(id, { isFavorite: isFavorite ? 1 : 0 });

      const img = this.images.find(i => String(i.id) === String(id));
      if (img) {
        img.isFavorite = isFavorite ? 1 : 0;
      }

      (this.app as ImagePanelManagerOptions['app']).showToast(isFavorite ? '已收藏' : '已取消收藏', 'success');
      this.updateFavoriteUI(id, isFavorite);
      this.renderTagFilters();
    } catch (error) {
      window.electronAPI.logError('ImagePanelManager.ts', 'toggleFavorite error:', error);
      (this.app as ImagePanelManagerOptions['app']).showToast('操作失败：' + (error as Error).message, 'error');
    }
  }

  /**
   * 更新收藏按钮 UI（实现基类抽象方法）
   */
  updateFavoriteUI(id: string, isFavorite: boolean): void {
    const updateBtn = (btn: Element | null) => {
      if (!btn) return;
      if (isFavorite) {
        btn.classList.add('active');
        (btn as HTMLElement).title = '取消收藏';
        btn.innerHTML = Constants.ICONS.favorite.filled;
      } else {
        btn.classList.remove('active');
        (btn as HTMLElement).title = '收藏';
        btn.innerHTML = Constants.ICONS.favorite.outline;
      }
    };

    const card = document.querySelector(`.image-card[data-id="${id}"]`);
    if (card) {
      const btn = card.querySelector('.favorite-btn');
      updateBtn(btn);
      card.classList.toggle('is-favorite', isFavorite);
    }

    // 更新列表视图
    const listItem = document.querySelector(`.list-item--image[data-id="${id}"]`);
    if (listItem) {
      const btn = listItem.querySelector('.favorite-btn');
      updateBtn(btn);
      listItem.classList.toggle('list-item--favorite', isFavorite);
    }
  }

  /**
   * 排序图像列表（实现基类抽象方法）
   */
  sortItems(items: IImage[], sortBy: string, sortOrder: string): IImage[] {
    const sorted = [...items];
    const order = sortOrder === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let valueA: string | number | undefined, valueB: string | number | undefined;

      switch (sortBy) {
        case 'updatedAt':
          valueA = a.updatedAt || 0;
          valueB = b.updatedAt || 0;
          break;
        case 'createdAt':
          valueA = a.createdAt || 0;
          valueB = b.createdAt || 0;
          break;
        case 'fileName':
          valueA = (a.fileName || '').toLowerCase();
          valueB = (b.fileName || '').toLowerCase();
          break;
        case 'width':
          valueA = a.width || 0;
          valueB = b.width || 0;
          break;
        case 'height':
          valueA = a.height || 0;
          valueB = b.height || 0;
          break;
        case 'fileSize':
          valueA = a.size || 0;
          valueB = b.size || 0;
          break;
        default:
          valueA = a.updatedAt || 0;
          valueB = b.updatedAt || 0;
      }

      if (valueA < valueB) return -1 * order;
      if (valueA > valueB) return 1 * order;
      return 0;
    });

    return sorted;
  }

  /**
   * 订阅事件（重写基类方法）
   */
  subscribeToEvents(): void {
    if (!this.eventBus) return;
    this.eventBus.on('imagesChanged', () => {
      this.refreshAfterUpdate();
    });
  }

  /**
   * 设置卡片大小（重写基类方法）
   * @param size - 卡片宽度/高度（像素），保持1:1方形
   */
  setCardSize(size: number): void {
    super.setCardSize(size);
    const imageGrid = document.getElementById('imageGrid');
    if (imageGrid) {
      // 使用固定列宽，每列大小等于滑杆值
      imageGrid.style.gridTemplateColumns = `repeat(auto-fill, ${size}px)`;
      // 设置行高等于列宽，保持1:1方形
      imageGrid.style.gridAutoRows = `${size}px`;
    }
  }

  /**
   * 获取当前视图的事件策略
   */
  protected getEventStrategy(): IEventStrategy | null {
    if (this.viewModeType === 'grid') {
      return new ImageCardEventStrategy(this);
    } else if (this.viewModeType === 'list' || this.viewModeType === 'list-compact') {
      return new ImageListEventStrategy(this);
    }
    return null;
  }

  /**
   * 获取当前视图的容器元素
   */
  protected getCurrentContainer(): HTMLElement | null {
    if (this.viewModeType === 'grid') {
      return document.getElementById('imageGrid');
    } else {
      return document.getElementById('imageList');
    }
  }

  /**
   * 打开图像详情
   */
  openImageDetail(img: IImage): void {
    (this.app as ImagePanelManagerOptions['app']).openImageDetailModal(img, { filteredList: this.getItems() as IImage[] });
  }
}

/**
 * 图像卡片事件策略
 */
class ImageCardEventStrategy extends CardEventStrategy {
  constructor(private manager: ImagePanelManager) {
    super();
  }

  protected handleOpenDetail(item: ItemType): void {
    this.manager.openImageDetail(item as IImage);
  }
}

/**
 * 图像列表事件策略
 */
class ImageListEventStrategy extends ListEventStrategy {
  constructor(private manager: ImagePanelManager) {
    super();
  }

  protected handleOpenDetail(item: ItemType): void {
    this.manager.openImageDetail(item as IImage);
  }
}

export default ImagePanelManager;
