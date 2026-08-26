import { cacheManager } from '../../utils/index.ts';
import { logger } from '../../utils/Logger.ts';
import { IApp } from '../app.types.ts';

interface HoverTooltipOptions {
  getContent?: (element: Element) => string | null;
  getImageId?: (element: Element) => string | null;
  delay?: number;
}

interface ImagePathInfo {
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
  private app: IApp;
  /** 已绑定 hover 的元素（bind 幂等，避免重复叠加监听器） */
  private boundElements = new WeakSet<Element>();

  constructor(app: IApp, tooltipId: string, contentId: string, imageId: string) {
    this.app = app;
    this.tooltip = document.getElementById(tooltipId);
    this.contentEl = document.getElementById(contentId);
    this.imageEl = document.getElementById(imageId) as HTMLImageElement | null;

    if (!this.tooltip || !this.contentEl || !this.imageEl) {
      logger.error('HoverTooltipManager', 'Required elements not found');
    }
  }

  /**
   * 加载图像路径（带缓存）
   * 路径缓存由 ImagePanelManager 在 loadData/loadMore 时统一预填充
   * 此方法仅读缓存；缓存缺失时通过 cachedIImage 或单 IPC 兜底，不再触发数据库查询
   */
  async loadImagePaths(imageId: string): Promise<ImagePathInfo> {
    // 优先从缓存读取
    let originalPath = cacheManager.getImagePath(imageId, 'original');

    if (!originalPath) {
      // 兜底 1：尝试从元数据缓存拿 relativePath
      const cachedImg = cacheManager.getImageCache().peek(imageId) as { relativePath?: string } | undefined;
      if (cachedImg?.relativePath) {
        originalPath = await window.electronAPI.getImagePath(cachedImg.relativePath);
        if (originalPath) {
          cacheManager.setImagePath(imageId, 'original', originalPath);
        }
      } else {
        // 兜底 2：单次按 ID 查元数据（仅在路径缓存完全缺失时使用）
        const img = await window.electronAPI.getImageById(imageId);
        if (img && img.relativePath) {
          originalPath = await window.electronAPI.getImagePath(img.relativePath);
          if (originalPath) {
            cacheManager.setImagePath(imageId, 'original', originalPath);
          }
        }
      }
    }

    return { originalPath: originalPath || null };
  }

  /**
   * 绑定 hover 事件
   */
  bind(selector: string, options: HoverTooltipOptions): void {
    if (!this.tooltip || !this.contentEl || !this.imageEl) return;

    const { getContent, getImageId, delay = 500 } = options;

    document.querySelectorAll(selector).forEach(element => {
      if (this.boundElements.has(element)) return;
      this.boundElements.add(element);
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
