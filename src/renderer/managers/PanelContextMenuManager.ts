import { Constants } from '../../constants.ts';

/**
 * 面板右键菜单管理器
 * 负责处理提示词/图像主界面卡片、列表、紧凑视图的右键菜单
 */
export class PanelContextMenuManager {
  private menuElement: HTMLElement | null = null;

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
    this.menuElement.className = 'panel-context-menu';
    this.menuElement.style.display = 'none';
    this.menuElement.innerHTML = `
      <div class="panel-context-menu-item" data-item-id="openLocation">
        <span class="panel-context-menu-label">${Constants.CONTEXT_MENU_OPEN_LOCATION}</span>
      </div>
    `;
    document.body.appendChild(this.menuElement);

    this.menuElement.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.panel-context-menu-item') as HTMLElement | null;
      if (!item) return;

      const path = item.dataset.path;
      if (path) {
        window.electronAPI.openImageLocation(path).catch((error: unknown) => {
          window.electronAPI.logError('PanelContextMenuManager.ts', 'Failed to open image location', error);
        });
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
  show(options: {
    x: number;
    y: number;
    path: string | null;
  }): void {
    const { x, y, path } = options;

    if (!path) {
      return;
    }

    if (!this.menuElement) {
      this.createMenuElement();
    }

    if (this.menuElement) {
      const menuItem = this.menuElement.querySelector('[data-item-id="openLocation"]') as HTMLElement | null;
      if (menuItem) {
        menuItem.dataset.path = path;
      }

      this.menuElement.style.display = 'block';
      this.menuElement.style.left = `${x}px`;
      this.menuElement.style.top = `${y}px`;
      this.adjustPosition();
    }
  }

  /**
   * 隐藏右键菜单
   */
  hide(): void {
    if (this.menuElement) {
      this.menuElement.style.display = 'none';
    }
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
   * 销毁
   */
  destroy(): void {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
    }
  }
}
