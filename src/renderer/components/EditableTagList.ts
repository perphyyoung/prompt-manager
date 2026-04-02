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
  onRemove?: (tagName: string) => Promise<void> | void;
  filterTags?: string[];
}

/**
 * 可编辑标签列表组件
 * 用于编辑界面，支持删除按钮
 */
export class EditableTagList {
  private containerId: string;
  private tagManager: TagManager;
  private onRemove?: (tagName: string) => Promise<void> | void;
  private filterTags: string[];
  private _initialized: boolean;

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
   * 初始化事件委托（只调用一次）
   */
  init(): void {
    if (this._initialized) return;

    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.addEventListener('click', async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const removeBtn = target.closest('.tag-remove-btn');
      if (!removeBtn) return;

      e.stopPropagation();
      const tagElement = removeBtn.closest('.tag-removable') as HTMLElement | null;
      if (tagElement && this.onRemove) {
        const tagName = tagElement.dataset.tag;
        if (tagName) {
          await this.onRemove(tagName);
        }
      }
    });

    this._initialized = true;
  }

  /**
   * 渲染标签列表
   */
  render(): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const tags = this.tagManager.getTags().filter(tag =>
      !this.filterTags.includes(tag) && !Constants.ALL_SPECIAL_TAGS.includes(tag)
    );

    if (tags.length > 0) {
      container.innerHTML = tags.map(tag => {
        const escapedTag = HtmlUtils.escapeHtml(tag);
        return `<span class="tag-editable tag-removable" data-tag="${escapedTag}">
          ${escapedTag}
          <span class="tag-remove-btn" title="删除标签">×</span>
        </span>`;
      }).join('');
    } else {
      container.innerHTML = '<span class="no-tags">无标签</span>';
    }
  }

  /**
   * 初始化并渲染（首次调用时自动初始化）
   */
  renderWithInit(): void {
    this.init();
    this.render();
  }
}
