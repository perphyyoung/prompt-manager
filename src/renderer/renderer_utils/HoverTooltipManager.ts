import { isSameId, cacheManager } from '../../utils/index.ts';

interface HoverTooltipOptions {
  getContent?: (element: Element) => string | null;
  getImageId?: (element: Element) => string | null;
  delay?: number;
}

interface ImagePathInfo {
  thumbnailPath: string | null;
  originalPath: string | null;
}

/**
 * Hover Tooltip 管理器
 * 通用 hover 预览组件，支持渐进式图像加载
 */
export class HoverTooltipManager {
  private tooltip: HTMLElement | null;
  private contentEl: HTMLElement | null;
  private imageEl: HTMLImageElement | null;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private currentElement: Element | null = null;

  constructor(tooltipId: string, contentId: string, imageId: string) {
    this.tooltip = document.getElementById(tooltipId);
    this.contentEl = document.getElementById(contentId);
    this.imageEl = document.getElementById(imageId) as HTMLImageElement | null;

    if (!this.tooltip || !this.contentEl || !this.imageEl) {
      console.error('HoverTooltipManager: Required elements not found');
    }
  }

  /**
   * 加载图像路径（带缓存）
   * 使用全局 CacheManager 替代局部 Map
   */
  async loadImagePaths(imageId: string): Promise<ImagePathInfo> {
    // 优先从全局缓存获取
    let thumbnailPath = cacheManager.getImagePath(imageId, 'thumbnail');
    let originalPath = cacheManager.getImagePath(imageId, 'original');

    // 如果缓存中没有，异步获取并缓存
    if (!thumbnailPath && !originalPath) {
      const allImages = await window.electronAPI.getImages('updatedAt', 'desc');
      const img = allImages.find((i: { id: string }) => isSameId(i.id, imageId));
      if (img) {
        const imgWithPaths = img as { thumbnailPath?: string; relativePath?: string };
        if (imgWithPaths.thumbnailPath) {
          thumbnailPath = await window.electronAPI.getImagePath(imgWithPaths.thumbnailPath);
          cacheManager.setImagePath(imageId, 'thumbnail', thumbnailPath);
        }
        if (imgWithPaths.relativePath) {
          originalPath = await window.electronAPI.getImagePath(imgWithPaths.relativePath);
          cacheManager.setImagePath(imageId, 'original', originalPath);
        }
      }
    }

    return { thumbnailPath: thumbnailPath || null, originalPath: originalPath || null };
  }

  /**
   * 绑定 hover 事件
   */
  bind(selector: string, options: HoverTooltipOptions): void {
    if (!this.tooltip || !this.contentEl || !this.imageEl) return;

    const { getContent, getImageId, delay = 500 } = options;

    document.querySelectorAll(selector).forEach(element => {
      element.addEventListener('mouseenter', async (e) => {
        const content = getContent ? getContent(element) : '';
        if (content === null) return;

        this.currentElement = element;
        if (this.hoverTimer) {
          clearTimeout(this.hoverTimer);
        }

        // 显示内容
        this.contentEl!.textContent = content || '';
        this.tooltip!.classList.remove('no-image');

        // 设置初始位置
        const mouseEvent = e as MouseEvent;
        let left = mouseEvent.clientX + 16;
        let top = mouseEvent.clientY + 16;
        this.tooltip!.style.left = left + 'px';
        this.tooltip!.style.top = top + 'px';

        const imageId = getImageId ? getImageId(element) : null;
        if (!imageId) {
          this.tooltip!.classList.add('no-image');
          this.imageEl!.src = '';
          this.tooltip!.classList.add('show');
          return;
        }

        // 延迟加载原图
        this.hoverTimer = setTimeout(async () => {
          if (this.currentElement !== element) return;

          const { originalPath } = await this.loadImagePaths(imageId);

          if (this.currentElement !== element) return;

          if (originalPath) {
            this.imageEl!.src = `file://${originalPath}`;
          }
        }, delay);

        this.tooltip!.classList.add('show');
      });

      element.addEventListener('mousemove', (e) => {
        if (this.tooltip!.classList.contains('show')) {
          const mouseEvent = e as MouseEvent;
          let left = mouseEvent.clientX + 16;
          let top = mouseEvent.clientY + 16;

          const tooltipRect = this.tooltip!.getBoundingClientRect();
          if (left + tooltipRect.width > window.innerWidth - 16) {
            left = mouseEvent.clientX - tooltipRect.width - 16;
          }
          if (top + tooltipRect.height > window.innerHeight - 16) {
            top = mouseEvent.clientY - tooltipRect.height - 16;
          }

          this.tooltip!.style.left = left + 'px';
          this.tooltip!.style.top = top + 'px';
        }
      });

      element.addEventListener('mouseleave', () => {
        if (this.hoverTimer) {
          clearTimeout(this.hoverTimer);
        }
        this.tooltip!.classList.remove('show');
        this.imageEl!.src = '';
        this.currentElement = null;
      });
    });
  }
}
