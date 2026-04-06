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
 * 用于编辑界面，支持删除按钮和批量选择模式
 */
export class EditableTagList {
  private containerId: string;
  private tagManager: TagManager;
  private onRemove?: (tagName: string) => Promise<void> | void;
  private filterTags: string[];
  private _initialized: boolean;
  private isBatchMode: boolean;
  private selectedTags: Set<string>;
  private onSelectionChange?: (selectedTags: Set<string>) => void;

  /**
   * @param options - 配置选项
   */
  constructor(options: EditableTagListOptions) {
    this.containerId = options.containerId;
    this.tagManager = options.tagManager;
    this.onRemove = options.onRemove;
    this.filterTags = options.filterTags || [];
    this._initialized = false;
    this.isBatchMode = false;
    this.selectedTags = new Set();
  }

  /**
   * 设置选择变更回调
   */
  setOnSelectionChange(callback: (selectedTags: Set<string>) => void): void {
    this.onSelectionChange = callback;
  }

  /**
   * 进入批量模式
   */
  enterBatchMode(): void {
    this.isBatchMode = true;
    this.selectedTags.clear();
    this.render();
  }

  /**
   * 退出批量模式
   */
  exitBatchMode(): void {
    this.isBatchMode = false;
    this.selectedTags.clear();
    this.render();
  }

  /**
   * 获取批量模式状态
   */
  getIsBatchMode(): boolean {
    return this.isBatchMode;
  }

  /**
   * 获取选中的标签
   */
  getSelectedTags(): Set<string> {
    return new Set(this.selectedTags);
  }

  /**
   * 全选所有标签
   */
  selectAll(): void {
    const tags = this.tagManager.getTags().filter(tag =>
      !this.filterTags.includes(tag) && !Constants.ALL_SPECIAL_TAGS.includes(tag)
    );
    tags.forEach(tag => this.selectedTags.add(tag));
    this.render();
    this.onSelectionChange?.(this.selectedTags);
  }

  /**
   * 反选标签
   */
  invertSelection(): void {
    const tags = this.tagManager.getTags().filter(tag =>
      !this.filterTags.includes(tag) && !Constants.ALL_SPECIAL_TAGS.includes(tag)
    );
    tags.forEach(tag => {
      if (this.selectedTags.has(tag)) {
        this.selectedTags.delete(tag);
      } else {
        this.selectedTags.add(tag);
      }
    });
    this.render();
    this.onSelectionChange?.(this.selectedTags);
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

      // 批量模式下处理复选框点击
      if (this.isBatchMode) {
        const tagElement = target.closest('.tag-batch-selectable') as HTMLElement | null;
        if (tagElement) {
          const tagName = tagElement.dataset.tag;
          if (tagName) {
            if (this.selectedTags.has(tagName)) {
              this.selectedTags.delete(tagName);
            } else {
              this.selectedTags.add(tagName);
            }
            this.render();
            this.onSelectionChange?.(this.selectedTags);
          }
          return;
        }
      }

      // 普通模式下处理删除按钮
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
        const isSelected = this.selectedTags.has(tag);

        if (this.isBatchMode) {
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
   * 初始化并渲染（首次调用时自动初始化）
   */
  renderWithInit(): void {
    this.init();
    this.render();
  }
}
