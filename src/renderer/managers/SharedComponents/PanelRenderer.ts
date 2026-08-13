/**
 * 面板渲染器
 * 提供通用的面板渲染方法，支持网格、列表、紧凑三种视图模式
 */

export type RenderItemFn = (item: unknown, index: number) => string;

/**
 * 面板渲染器
 * 提供通用的面板渲染方法，支持网格、列表、紧凑三种视图模式
 */
export class PanelRenderer {
  /**
   * 渲染网格视图
   * @param items - 项目数组
   * @param renderItem - 渲染单个项目的函数
   * @param containerId - 容器元素 ID
   */
  static renderGrid(items: unknown[], renderItem: RenderItemFn, containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = items.map((item, index) => renderItem(item, index)).join('');
  }

  /**
   * 渲染列表视图
   * @param items - 项目数组
   * @param renderItem - 渲染单个项目的函数
   * @param containerId - 容器元素 ID
   */
  static renderList(items: unknown[], renderItem: RenderItemFn, containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = items.map((item, index) => renderItem(item, index)).join('');
  }

  /**
   * 渲染紧凑列表视图
   * @param items - 项目数组
   * @param renderItem - 渲染单个项目的函数
   * @param containerId - 容器元素 ID
   */
  static renderCompactList(items: unknown[], renderItem: RenderItemFn, containerId: string): void {
    return PanelRenderer.renderList(items, renderItem, containerId);
  }

  /**
   * 更新列表项的选中状态
   * @param container - 容器元素
   * @param selectedIds - 选中的 ID 集合
   */
  static updateSelectionState(container: HTMLElement | null, selectedIds: Set<string>): void {
    if (!container) return;

    const items = container.querySelectorAll('[data-id], [data-image-id], [data-prompt-id]');
    items.forEach(item => {
      const id = (item as HTMLElement).dataset.id || (item as HTMLElement).dataset.imageId || (item as HTMLElement).dataset.promptId;
      if (id) {
        const isSelected = selectedIds.has(id);
        item.classList.toggle('is-selected', isSelected);

        const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        if (checkbox) {
          checkbox.checked = isSelected;
        }
      }
    });
  }

  /**
   * 批量更新列表项的某个属性
   * @param container - 容器元素
   * @param selector - 选择器
   * @param attribute - 属性名
   * @param value - 属性值
   */
  static updateItemsAttribute(container: HTMLElement | null, selector: string, attribute: string, value: string): void {
    if (!container) return;

    const items = container.querySelectorAll(selector);
    items.forEach(item => {
      item.setAttribute(attribute, value);
    });
  }

  /**
   * 为列表项绑定点击事件
   * @param container - 容器元素
   * @param selector - 选择器
   * @param handler - 事件处理函数
   */
  static bindItemClickEvents(container: HTMLElement | null, selector: string, handler: (event: Event) => void): void {
    if (!container) return;

    container.querySelectorAll(selector).forEach(item => {
      item.addEventListener('click', handler);
    });
  }

  /**
   * 为列表项绑定悬停事件
   * @param container - 容器元素
   * @param selector - 选择器
   * @param enterHandler - mouseenter 处理函数
   * @param leaveHandler - mouseleave 处理函数
   */
  static bindItemHoverEvents(
    container: HTMLElement | null,
    selector: string,
    enterHandler?: (event: Event) => void,
    leaveHandler?: (event: Event) => void
  ): void {
    if (!container) return;

    container.querySelectorAll(selector).forEach(item => {
      if (enterHandler) {
        item.addEventListener('mouseenter', enterHandler);
      }
      if (leaveHandler) {
        item.addEventListener('mouseleave', leaveHandler);
      }
    });
  }

  /**
   * 异步加载背景图片
   * @param container - 容器元素
   * @param selector - 背景元素选择器
   * @param getPathFn - 获取图片路径的函数
   */
  static async loadBackgroundImages(
    container: HTMLElement | null,
    selector: string,
    getPathFn: (element: Element) => string | null
  ): Promise<void> {
    if (!container) return;

    const elements = container.querySelectorAll(selector);
    for (const el of elements) {
      const path = getPathFn(el);
      if (!path) continue;

      try {
        const fullPath = await window.electronAPI.getImagePath(path);
        (el as HTMLElement).style.backgroundImage = `url('file://${fullPath.replace(/\\/g, '/')}')`;
      } catch (error) {
        window.electronAPI?.logError?.('PanelRenderer.ts', 'Failed to load background image:', error);
      }
    }
  }

  /**
   * 清空列表并显示空状态
   * @param containerId - 容器元素 ID
   * @param emptyStateId - 空状态元素 ID
   * @param message - 空状态消息
   * @param title - 空状态标题（可选，不传则使用默认标题）
   */
  static showEmptyState(containerId: string, emptyStateId: string, message = '暂无数据', title?: string): void {
    const container = document.getElementById(containerId);
    const emptyState = document.getElementById(emptyStateId);

    if (container) container.innerHTML = '';
    if (emptyState) {
      emptyState.style.display = 'flex';
      const h3 = emptyState.querySelector('h3');
      const p = emptyState.querySelector('p');
      if (title && h3) h3.textContent = title;
      if (p) p.textContent = message;
    }
  }

  /**
   * 隐藏空状态并显示列表
   * @param containerId - 容器元素 ID
   * @param emptyStateId - 空状态元素 ID
   */
  static hideEmptyState(containerId: string, emptyStateId: string): void {
    const container = document.getElementById(containerId);
    const emptyState = document.getElementById(emptyStateId);

    if (container) container.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';
  }
}
