import { isSameId } from '../../utils/index.ts';
import { IImage } from '../../types/entities.ts';

/**
 * 上下文菜单配置
 */
interface IContextMenuConfig {
  items: Array<{
    id: string;
    label: string;
    icon?: string;
    shortcut?: string;
    disabled?: boolean;
    separator?: boolean;
    action?: (image: IImage) => void | Promise<void>;
  }>;
}

/**
 * 显示选项
 */
interface IShowOptions {
  x: number;
  y: number;
  image: IImage;
}

/**
 * ImageContextMenuManager 构造选项
 */
interface IImageContextMenuManagerOptions {
  onCopyImage?: (image: IImage) => void | Promise<void>;
  onCopyImagePath?: (image: IImage) => void | Promise<void>;
  onCopyImageName?: (image: IImage) => void | Promise<void>;
  onCopyImagePrompt?: (image: IImage) => void | Promise<void>;
  onOpenImageLocation?: (image: IImage) => void | Promise<void>;
  onDeleteImage?: (image: IImage) => void | Promise<void>;
  onSetAsFirst?: (image: IImage) => void | Promise<void>;
  onViewFullScreen?: (image: IImage) => void | Promise<void>;
  onViewInExplorer?: (image: IImage) => void | Promise<void>;
  onSetAsWallpaper?: (image: IImage) => void | Promise<void>;
  onShowImageInfo?: (image: IImage) => void | Promise<void>;
  onEditImage?: (image: IImage) => void | Promise<void>;
}

/**
 * 图像右键菜单管理器
 * 负责处理图像相关的右键菜单功能
 */
export class ImageContextMenuManager {
  private currentImage: IImage | null;
  private menuElement: HTMLElement | null;
  private config: IContextMenuConfig;

  // 回调函数
  private onCopyImage: ((image: IImage) => void | Promise<void>) | null;
  private onCopyImagePath: ((image: IImage) => void | Promise<void>) | null;
  private onCopyImageName: ((image: IImage) => void | Promise<void>) | null;
  private onCopyImagePrompt: ((image: IImage) => void | Promise<void>) | null;
  private onOpenImageLocation: ((image: IImage) => void | Promise<void>) | null;
  private onDeleteImage: ((image: IImage) => void | Promise<void>) | null;
  private onSetAsFirst: ((image: IImage) => void | Promise<void>) | null;
  private onViewFullScreen: ((image: IImage) => void | Promise<void>) | null;
  private onViewInExplorer: ((image: IImage) => void | Promise<void>) | null;
  private onSetAsWallpaper: ((image: IImage) => void | Promise<void>) | null;
  private onShowImageInfo: ((image: IImage) => void | Promise<void>) | null;
  private onEditImage: ((image: IImage) => void | Promise<void>) | null;

  constructor(options: IImageContextMenuManagerOptions = {}) {
    this.currentImage = null;
    this.menuElement = null;

    // 回调函数
    this.onCopyImage = options.onCopyImage || null;
    this.onCopyImagePath = options.onCopyImagePath || null;
    this.onCopyImageName = options.onCopyImageName || null;
    this.onCopyImagePrompt = options.onCopyImagePrompt || null;
    this.onOpenImageLocation = options.onOpenImageLocation || null;
    this.onDeleteImage = options.onDeleteImage || null;
    this.onSetAsFirst = options.onSetAsFirst || null;
    this.onViewFullScreen = options.onViewFullScreen || null;
    this.onViewInExplorer = options.onViewInExplorer || null;
    this.onSetAsWallpaper = options.onSetAsWallpaper || null;
    this.onShowImageInfo = options.onShowImageInfo || null;
    this.onEditImage = options.onEditImage || null;

    // 默认菜单配置
    this.config = {
      items: [
        {
          id: 'copy',
          label: '复制图像',
          icon: '📋',
          shortcut: 'Ctrl+C',
          action: (image: IImage) => this.onCopyImage?.(image)
        },
        {
          id: 'copyPath',
          label: '复制路径',
          icon: '📁',
          shortcut: 'Ctrl+Shift+C',
          action: (image: IImage) => this.onCopyImagePath?.(image)
        },
        {
          id: 'copyName',
          label: '复制文件名',
          icon: '📝',
          action: (image: IImage) => this.onCopyImageName?.(image)
        },
        {
          id: 'copyPrompt',
          label: '复制提示词',
          icon: '💬',
          action: (image: IImage) => this.onCopyImagePrompt?.(image)
        },
        { id: 'separator1', label: '', separator: true },
        {
          id: 'openLocation',
          label: '打开所在位置',
          icon: '📂',
          action: (image: IImage) => this.onOpenImageLocation?.(image)
        },
        {
          id: 'viewFullScreen',
          label: '全屏查看',
          icon: '🔍',
          shortcut: 'F11',
          action: (image: IImage) => this.onViewFullScreen?.(image)
        },
        { id: 'separator2', label: '', separator: true },
        {
          id: 'setAsFirst',
          label: '设为首张',
          icon: '⭐',
          action: (image: IImage) => this.onSetAsFirst?.(image)
        },
        {
          id: 'delete',
          label: '删除图像',
          icon: '🗑️',
          shortcut: 'Delete',
          action: (image: IImage) => this.onDeleteImage?.(image)
        }
      ]
    };
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
    // 移除已存在的菜单
    if (this.menuElement) {
      this.menuElement.remove();
    }

    // 创建新的菜单元素
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'context-menu';
    this.menuElement.style.display = 'none';
    document.body.appendChild(this.menuElement);
  }

  /**
   * 绑定全局事件
   * @private
   */
  private bindGlobalEvents(): void {
    // 点击其他地方关闭菜单
    document.addEventListener('click', (e) => {
      if (this.menuElement && !this.menuElement.contains(e.target as Node)) {
        this.hide();
      }
    });

    // 按 Escape 关闭菜单
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    });

    // 窗口大小改变时关闭菜单
    window.addEventListener('resize', () => {
      this.hide();
    });

    // 滚动时关闭菜单
    window.addEventListener('scroll', () => {
      this.hide();
    }, true);
  }

  /**
   * 显示右键菜单
   * @param options - 显示选项
   */
  show(options: IShowOptions): void {
    const { x, y, image } = options;

    this.currentImage = image;

    if (!this.menuElement) {
      this.createMenuElement();
    }

    // 渲染菜单内容
    this.renderMenu();

    // 设置位置
    if (this.menuElement) {
      this.menuElement.style.display = 'block';
      this.menuElement.style.left = `${x}px`;
      this.menuElement.style.top = `${y}px`;
    }

    // 确保菜单不超出视口
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
   * 渲染菜单
   * @private
   */
  private renderMenu(): void {
    if (!this.menuElement) return;

    this.menuElement.innerHTML = this.config.items.map(item => {
      if (item.separator) {
        return '<div class="context-menu-separator"></div>';
      }

      const disabledClass = item.disabled ? 'disabled' : '';
      const iconHtml = item.icon ? `<span class="context-menu-icon">${item.icon}</span>` : '';
      const shortcutHtml = item.shortcut ? `<span class="context-menu-shortcut">${item.shortcut}</span>` : '';

      return `
        <div class="context-menu-item ${disabledClass}" data-item-id="${item.id}">
          ${iconHtml}
          <span class="context-menu-label">${item.label}</span>
          ${shortcutHtml}
        </div>
      `;
    }).join('');

    // 绑定菜单项点击事件
    this.menuElement.querySelectorAll('.context-menu-item:not(.disabled)').forEach(item => {
      item.addEventListener('click', () => {
        const itemId = (item as HTMLElement).dataset.itemId;
        this.handleMenuItemClick(itemId || '');
      });
    });
  }

  /**
   * 处理菜单项点击
   * @param itemId - 菜单项ID
   * @private
   */
  private handleMenuItemClick(itemId: string): void {
    if (!this.currentImage) return;

    const menuItem = this.config.items.find(item => isSameId(item.id, itemId));
    if (menuItem && menuItem.action) {
      menuItem.action(this.currentImage);
    }

    this.hide();
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

    // 水平方向调整
    if (left + rect.width > viewportWidth) {
      left = viewportWidth - rect.width - 10;
    }

    // 垂直方向调整
    if (top + rect.height > viewportHeight) {
      top = viewportHeight - rect.height - 10;
    }

    // 确保不超出左边界和顶部
    left = Math.max(10, left);
    top = Math.max(10, top);

    this.menuElement.style.left = `${left}px`;
    this.menuElement.style.top = `${top}px`;
  }

  /**
   * 设置菜单配置
   * @param config - 菜单配置
   */
  setConfig(config: Partial<IContextMenuConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 添加菜单项
   * @param item - 菜单项
   * @param index - 插入位置（可选，默认添加到末尾）
   */
  addMenuItem(item: IContextMenuConfig['items'][0], index?: number): void {
    if (typeof index === 'number') {
      this.config.items.splice(index, 0, item);
    } else {
      this.config.items.push(item);
    }
  }

  /**
   * 移除菜单项
   * @param itemId - 菜单项ID
   */
  removeMenuItem(itemId: string): void {
    this.config.items = this.config.items.filter(item => !isSameId(item.id, itemId));
  }

  /**
   * 启用/禁用菜单项
   * @param itemId - 菜单项ID
   * @param disabled - 是否禁用
   */
  setMenuItemDisabled(itemId: string, disabled: boolean): void {
    const item = this.config.items.find(i => isSameId(i.id, itemId));
    if (item) {
      item.disabled = disabled;
    }
  }

  /**
   * 更新回调函数
   * @param callbacks - 回调函数对象
   */
  setCallbacks(callbacks: Partial<IImageContextMenuManagerOptions>): void {
    if (callbacks.onCopyImage) this.onCopyImage = callbacks.onCopyImage;
    if (callbacks.onCopyImagePath) this.onCopyImagePath = callbacks.onCopyImagePath;
    if (callbacks.onCopyImageName) this.onCopyImageName = callbacks.onCopyImageName;
    if (callbacks.onCopyImagePrompt) this.onCopyImagePrompt = callbacks.onCopyImagePrompt;
    if (callbacks.onOpenImageLocation) this.onOpenImageLocation = callbacks.onOpenImageLocation;
    if (callbacks.onDeleteImage) this.onDeleteImage = callbacks.onDeleteImage;
    if (callbacks.onSetAsFirst) this.onSetAsFirst = callbacks.onSetAsFirst;
    if (callbacks.onViewFullScreen) this.onViewFullScreen = callbacks.onViewFullScreen;
    if (callbacks.onViewInExplorer) this.onViewInExplorer = callbacks.onViewInExplorer;
    if (callbacks.onSetAsWallpaper) this.onSetAsWallpaper = callbacks.onSetAsWallpaper;
    if (callbacks.onShowImageInfo) this.onShowImageInfo = callbacks.onShowImageInfo;
    if (callbacks.onEditImage) this.onEditImage = callbacks.onEditImage;
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
