import { HtmlUtils } from '../../utils/index.ts';
import { Constants } from '../../constants.ts';

// 标签管理器接口（简化）
interface TagManager {
  getTags: () => string[];
}

// 可编辑标签列表选项接口
interface EditableTagListOptions {
  containerId: string;
  tagManager: TagManager;
  onRemove?: (tagName: string) => Promise<boolean> | boolean;
  filterTags?: string[];
}

/**
 * 可编辑标签列表组件 - 纯渲染组件
 * 只负责标签列表的展示和删除按钮交互
 * 批量选择状态由 BatchToolbarMiddle 管理
 */
export class EditableTagList {
  private containerId: string;
  private tagManager: TagManager;
  private onRemove?: (tagName: string) => Promise<boolean> | boolean;
  private filterTags: string[];
  private _initialized: boolean;
  private _clickHandler?: (e: MouseEvent) => void;

  // 静态变量：全局点击防抖
  private static _lastClickTime: number = 0;
  private static _lastClickedTag: string = '';

  /**
   * @param options - 配置选项
   */
  constructor(options: EditableTagListOptions) {
    this.containerId = options.containerId;
    this.tagManager = options.tagManager;
    this.onRemove = options.onRemove;
    this.filterTags = options.filterTags || [];
    this._initialized = false;
  }

  /**
   * 渲染标签列表
   * @param selectedTags - 当前选中的标签（由 BatchToolbarMiddle 提供）
   * @param isBatchMode - 是否批量模式（由 BatchToolbarMiddle 提供）
   */
  render(selectedTags: Set<string> = new Set(), isBatchMode: boolean = false): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const tags = this.tagManager.getTags().filter(tag =>
      !this.filterTags.includes(tag) && !Constants.ALL_SPECIAL_TAGS.includes(tag)
    );

    if (tags.length > 0) {
      container.innerHTML = tags.map(tag => {
        const escapedTag = HtmlUtils.escapeHtml(tag);
        const isSelected = selectedTags.has(tag);

        if (isBatchMode) {
          // 批量模式：显示复选框样式
          return `<span class="tag-editable tag-batch-selectable ${isSelected ? 'tag-selected' : ''}" data-tag="${escapedTag}">
            <span class="tag-checkbox">${isSelected ? '✓' : ''}</span>
            ${escapedTag}
          </span>`;
        } else {
          // 普通模式：显示删除按钮
          return `<span class="tag-editable tag-removable" data-tag="${escapedTag}">
            ${escapedTag}
            <span class="tag-remove-btn" title="删除标签">×</span>
          </span>`;
        }
      }).join('');
    } else {
      container.innerHTML = '<span class="no-tags">无标签</span>';
    }
  }

  /**
   * 初始化事件委托
   * @param onTagClick - 标签点击回调（批量模式下使用）
   */
  init(onTagClick?: (tagName: string) => void): void {
    if (this._initialized) return;

    const container = document.getElementById(this.containerId);
    if (!container) return;

    // 先移除容器上可能存在的旧事件监听器
    // 通过克隆节点来移除所有事件监听器
    const newContainer = container.cloneNode(true) as HTMLElement;
    container.parentNode?.replaceChild(newContainer, container);

    this._clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 批量模式下处理标签点击
      const tagElement = target.closest('.tag-batch-selectable') as HTMLElement | null;
      if (tagElement && onTagClick) {
        const tagName = tagElement.dataset.tag;
        if (tagName) {
          // 全局防抖：防止同一标签在短时间内被重复点击
          const now = Date.now();
          if (tagName === EditableTagList._lastClickedTag && now - EditableTagList._lastClickTime < 200) {
            return;
          }
          EditableTagList._lastClickTime = now;
          EditableTagList._lastClickedTag = tagName;
          onTagClick(tagName);
        }
        return;
      }

      // 普通模式下处理删除按钮
      const removeBtn = target.closest('.tag-remove-btn');
      if (!removeBtn) return;

      e.stopPropagation();
      const removableElement = removeBtn.closest('.tag-removable') as HTMLElement | null;
      if (removableElement && this.onRemove) {
        const tagName = removableElement.dataset.tag;
        if (tagName) {
          this.onRemove(tagName);
        }
      }
    };

    // 使用新的容器元素绑定事件
    const newContainerForEvent = document.getElementById(this.containerId);
    if (newContainerForEvent) {
      newContainerForEvent.addEventListener('click', this._clickHandler);
    }
    this._initialized = true;
  }

  /**
   * 更新单个标签的选中状态（不重新渲染整个列表）
   * @param tagName - 标签名称
   * @param isSelected - 是否选中
   */
  public updateTagSelection(tagName: string, isSelected: boolean): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    
    const tagElement = container.querySelector(`.tag-editable[data-tag="${tagName}"]`);
    if (tagElement) {
      if (isSelected) {
        tagElement.classList.add('tag-selected');
        const checkbox = tagElement.querySelector('.tag-checkbox');
        if (checkbox) {
          checkbox.textContent = '✓';
        }
      } else {
        tagElement.classList.remove('tag-selected');
        const checkbox = tagElement.querySelector('.tag-checkbox');
        if (checkbox) {
          checkbox.textContent = '';
        }
      }
    }
  }

  /**
   * 销毁事件监听器
   */
  destroy(): void {
    if (!this._initialized || !this._clickHandler) return;

    const container = document.getElementById(this.containerId);
    if (container && this._clickHandler) {
      container.removeEventListener('click', this._clickHandler);
    }

    this._clickHandler = undefined;
    this._initialized = false;
  }
}
