import { IImage } from '../../types/entities.ts';
import { Constants } from '../../constants.ts';

/**
 * 显示选项
 */
interface IShowOptions {
  x: number;
  y: number;
  image: IImage;
  showSetAsFirst?: boolean;
}

/**
 * ImageContextMenuManager 构造选项
 */
interface IImageContextMenuManagerOptions {
  onSetAsFirst?: (image: IImage) => void | Promise<void>;
  onOpenLocation?: (image: IImage) => void | Promise<void>;
}

/**
 * 图像右键菜单管理器
 * 负责处理图像相关的右键菜单功能
 */
export class ImageContextMenuManager {
  private currentImage: IImage | null = null;
  private menuElement: HTMLElement | null = null;
  private onSetAsFirst: ((image: IImage) => void | Promise<void>) | null = null;
  private onOpenLocation: ((image: IImage) => void | Promise<void>) | null = null;

  constructor(options: IImageContextMenuManagerOptions = {}) {
    this.onSetAsFirst = options.onSetAsFirst || null;
    this.onOpenLocation = options.onOpenLocation || null;
  }

  /**
   * 初始化
   */
  init(): void {
    this.createMenuElement();
    this.bindGlobalEvents();
  }

  /**
   * 创建菜单元素
   * @private
   */
  private createMenuElement(): void {
    if (this.menuElement) {
      this.menuElement.remove();
    }

    this.menuElement = document.createElement('div');
    this.menuElement.className = 'context-menu';
    this.menuElement.style.display = 'none';
    this.menuElement.innerHTML = `
      <div class="context-menu-item" data-item-id="setAsFirst">
        <span class="context-menu-label">${Constants.CONTEXT_MENU_SET_AS_FIRST}</span>
      </div>
      <div class="context-menu-item" data-item-id="openLocation">
        <span class="context-menu-label">${Constants.CONTEXT_MENU_OPEN_LOCATION}</span>
      </div>
    `;
    document.body.appendChild(this.menuElement);

    // 绑定点击事件（事件委托）
    this.menuElement.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.context-menu-item') as HTMLElement | null;
      if (!item || !this.currentImage) return;

      const itemId = item.dataset.itemId;
      if (itemId === 'setAsFirst' && this.onSetAsFirst) {
        this.onSetAsFirst(this.currentImage);
      } else if (itemId === 'openLocation' && this.onOpenLocation) {
        this.onOpenLocation(this.currentImage);
      }
      this.hide();
    });
  }

  /**
   * 绑定全局事件
   * @private
   */
  private bindGlobalEvents(): void {
    document.addEventListener('click', (e) => {
      if (this.menuElement && !this.menuElement.contains(e.target as Node)) {
        this.hide();
      }
    });

    window.addEventListener('resize', () => {
      this.hide();
    });

    window.addEventListener('scroll', () => {
      this.hide();
    }, true);
  }

  /**
   * 显示右键菜单
   * @param options - 显示选项
   */
  show(options: IShowOptions): void {
    const { x, y, image, showSetAsFirst = true } = options;

    this.currentImage = image;

    if (!this.menuElement) {
      this.createMenuElement();
    }

    if (this.menuElement) {
      // 控制菜单项可见性
      const setAsFirstItem = this.menuElement.querySelector('[data-item-id="setAsFirst"]') as HTMLElement | null;
      if (setAsFirstItem) {
        setAsFirstItem.style.display = showSetAsFirst && this.onSetAsFirst ? '' : 'none';
      }

      const openLocationItem = this.menuElement.querySelector('[data-item-id="openLocation"]') as HTMLElement | null;
      if (openLocationItem) {
        openLocationItem.style.display = this.onOpenLocation ? '' : 'none';
      }

      this.menuElement.style.display = 'block';
      this.menuElement.style.left = `${x}px`;
      this.menuElement.style.top = `${y}px`;
    }

    this.adjustPosition();
  }

  /**
   * 隐藏右键菜单
   */
  hide(): void {
    if (this.menuElement) {
      this.menuElement.style.display = 'none';
    }
    this.currentImage = null;
  }

  /**
   * 调整菜单位置，确保不超出视口
   * @private
   */
  private adjustPosition(): void {
    if (!this.menuElement) return;

    const rect = this.menuElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = parseInt(this.menuElement.style.left || '0', 10);
    let top = parseInt(this.menuElement.style.top || '0', 10);

    if (left + rect.width > viewportWidth) {
      left = viewportWidth - rect.width - 10;
    }

    if (top + rect.height > viewportHeight) {
      top = viewportHeight - rect.height - 10;
    }

    left = Math.max(10, left);
    top = Math.max(10, top);

    this.menuElement.style.left = `${left}px`;
    this.menuElement.style.top = `${top}px`;
  }

  /**
   * 更新回调函数
   * @param callbacks - 回调函数对象
   */
  setCallbacks(callbacks: Partial<IImageContextMenuManagerOptions>): void {
    if (callbacks.onSetAsFirst) this.onSetAsFirst = callbacks.onSetAsFirst;
    if (callbacks.onOpenLocation) this.onOpenLocation = callbacks.onOpenLocation;
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
    }
    this.currentImage = null;
  }
}
