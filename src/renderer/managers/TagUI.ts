import { Constants } from '../../constants.ts';
import { HtmlUtils } from '../../utils/index.ts';
import { TopGroupManager } from './TopGroupManager.ts';
import { ITagWithGroup, ITagGroup } from '../../types/entities.ts';

interface TagCountInfo {
  tag: string;
  count: number;
}

interface TagFilterOptions {
  specialTags: TagCountInfo[];
  selectedTags: Set<string> | string[];
  groups: ITagGroup[];
  isImage?: boolean;
}

interface FilterHeaderOptions {
  containerId: string;
  specialTags: TagCountInfo[];
  sortedTagsWithGroup: ITagWithGroup[];
  tagCounts?: Record<string, number>;
  selectedTags: Set<string> | string[];
  onTagClick?: (tag: string, isTopGroupTag: boolean, isSingleSelectGroup: boolean, event: MouseEvent) => void;
  topGroupInfo?: unknown;
  dragType?: string | null;
}

interface EditableTagsOptions {
  onRemove?: (tag: string) => void;
  readonly?: boolean;
}

/**
 * 标签 UI - 展示层
 * 负责标签相关的 HTML 生成和 UI 组件渲染
 */
export class TagUI {
  private type: string;
  private isPrompt: boolean;

  constructor(type: string) {
    this.type = type;
    this.isPrompt = type === 'prompt';
  }

  /**
   * 生成标签注册表 HTML
   */
  generateRegistryHtml(
    groups: ITagGroup[],
    groupedTags: Record<number, string[]>,
    ungroupedTags: string[],
    tagCounts: Record<string, number>,
    searchTerm: string,
    isBatchMode = false,
    selectedTags: Set<string> = new Set()
  ): string {
    let html = '';
    let globalIndex = 0;

    // 未分组标签卡片
    if (ungroupedTags.length > 0) {
      html += this.generateUngroupedTagCard(ungroupedTags, tagCounts, isBatchMode, selectedTags, globalIndex);
      globalIndex += ungroupedTags.length;
    }

    // 标签组卡片（按排序顺序）
    const sortedGroups = groups.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    sortedGroups.forEach((group, index) => {
      const tags = groupedTags[group.id] || [];
      // 搜索模式下只显示有标签的组，非搜索模式显示所有组
      if (tags.length > 0 || !searchTerm) {
        html += this.generateTagGroupCard(group, tags, tagCounts, index === 0, isBatchMode, selectedTags, globalIndex);
        globalIndex += tags.length;
      }
    });

    return html;
  }

  /**
   * 生成标签项 HTML - 极简卡片式设计
   */
  generateTagItemHtml(
    tag: string,
    count: number,
    groupId: number | null = null,
    isBatchMode = false,
    isSelected = false,
    index: number = 0
  ): string {
    const selectedClass = isSelected ? 'tag-selected' : '';
    const batchClass = isBatchMode ? 'batch-mode' : '';
    const escapedTag = HtmlUtils.escapeHtml(tag);

    const draggableAttr = isBatchMode ? '' : 'draggable="true"';

    const editBtn = isBatchMode ? '' : `<button class="tag-edit-btn" data-tag="${escapedTag}" title="编辑">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    </button>`;

    const deleteBtn = isBatchMode ? '' : `<button class="tag-delete-btn" data-tag="${escapedTag}" title="删除">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>`;

    const checkbox = isBatchMode
      ? `<div class="tag-checkbox-wrapper"><input type="checkbox" class="tag-batch-checkbox" data-tag="${escapedTag}" data-index="${index}" ${isSelected ? 'checked' : ''}></div>`
      : '';

    return `
      <div class="tag-manager-item ${batchClass} ${selectedClass}" data-id="${escapedTag}" data-tag="${escapedTag}" data-index="${index}" data-group-id="${groupId ?? ''}" ${draggableAttr}>
        ${checkbox}
        <div class="tag-manager-item-count">${count}</div>
        <div class="tag-manager-item-name" title="${escapedTag}">${escapedTag}</div>
        ${editBtn}
        ${deleteBtn}
      </div>
    `;
  }

  /**
   * 生成标签组卡片 HTML
   */
  private generateTagGroupCardHtml(
    groupId: number | null,
    groupName: string,
    tags: string[],
    tagCounts: Record<string, number>,
    isFirst = false,
    isBatchMode = false,
    selectedTags: Set<string> = new Set(),
    isUngrouped = false,
    sortOrder = 0,
    startIndex: number = 0
  ): string {
    const tagsHtml = tags.map((tag, index) =>
      this.generateTagItemHtml(tag, tagCounts[tag] ?? 0, groupId, isBatchMode, selectedTags.has(tag), startIndex + index)
    ).join('');

    if (isUngrouped) {
      return `
        <div class="tag-group-card ungrouped-card" data-group-id="" data-drop-target="true">
          <div class="tag-group-card-header">
            <span class="tag-group-card-name">${groupName}</span>
          </div>
          <div class="tag-group-card-content">
            ${tagsHtml || '<span class="tag-group-card-empty">暂无未分组标签</span>'}
          </div>
        </div>
      `;
    }

    const firstBadge = isFirst ? '<span class="tag-group-card-first">首位组</span>' : '';
    const sortBadge = `<span class="tag-group-card-sort">${sortOrder}</span>`;

    return `
      <div class="tag-group-card" data-group-id="${groupId}" data-drop-target="true">
        <div class="tag-group-card-header">
          <span class="tag-group-card-name">${HtmlUtils.escapeHtml(groupName)}</span>
          ${sortBadge}
          ${firstBadge}
          <div class="tag-group-card-actions">
            <button class="tag-group-btn edit" data-id="${groupId}" title="编辑">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="tag-group-btn delete" data-id="${groupId}" title="删除">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="tag-group-card-content">
          ${tagsHtml || '<span class="tag-group-card-empty">暂无标签</span>'}
        </div>
      </div>
    `;
  }

  /**
   * 生成未分组标签卡片 HTML
   */
  generateUngroupedTagCard(
    tags: string[],
    tagCounts: Record<string, number>,
    isBatchMode = false,
    selectedTags: Set<string> = new Set(),
    startIndex: number = 0
  ): string {
    return this.generateTagGroupCardHtml(null, '未分组', tags, tagCounts, false, isBatchMode, selectedTags, true, 0, startIndex);
  }

  /**
   * 生成标签组卡片 HTML
   */
  generateTagGroupCard(
    group: ITagGroup,
    tags: string[],
    tagCounts: Record<string, number>,
    isFirst = false,
    isBatchMode = false,
    selectedTags: Set<string> = new Set(),
    startIndex: number = 0
  ): string {
    return this.generateTagGroupCardHtml(group.id, group.name, tags, tagCounts, isFirst, isBatchMode, selectedTags, false, group.sortOrder ?? 0, startIndex);
  }

  /**
   * 生成标签筛选器 HTML
   */
  static generateTagFiltersHtml(
    tags: ITagWithGroup[],
    counts: Record<string, number>,
    options: TagFilterOptions
  ): string {
    const { specialTags, selectedTags, groups, isImage = false } = options;
    const selectedSet = selectedTags instanceof Set ? selectedTags : new Set(selectedTags);
    let html = '';

    // 渲染特殊标签（特殊标签不允许拖拽）
    if (specialTags && specialTags.length > 0) {
      html += specialTags.map(({ tag, count }) => {
        const isActive = selectedSet.has(tag);
        return `
          <button class="tag-filter-item ${isActive ? 'active' : ''}" data-tag="${HtmlUtils.escapeHtml(tag)}" data-is-special="true">
            <span class="tag-name">${HtmlUtils.escapeHtml(tag)}</span>
            <span class="tag-badge">${count}</span>
          </button>
        `;
      }).join('');
    }

    // 渲染普通标签（分组）
    const groupedTags: Record<string, { group: ITagGroup; tags: { tag: string; count: number }[] }> = {};
    const ungroupedTags: { tag: string; count: number }[] = [];

    // 初始化分组
    if (groups && groups.length > 0) {
      groups.forEach(group => {
        groupedTags[group.name] = { group, tags: [] };
      });
    }

    // 将标签分配到分组或未分组
    tags.forEach(({ name: tag }) => {
      if (Constants.ALL_SPECIAL_TAGS.includes(tag)) return;
      const tagInfo = tags.find(t => t.name === tag);
      if (tagInfo && tagInfo.groupName && groupedTags[tagInfo.groupName]) {
        groupedTags[tagInfo.groupName].tags.push({ tag, count: counts[tag] || 0 });
      } else {
        ungroupedTags.push({ tag, count: counts[tag] || 0 });
      }
    });

    // 渲染分组标签
    if (groups && groups.length > 0) {
      // 使用 TopGroupManager 识别首位组，确保与 collectHeaderTags 逻辑一致
      const groupMap = TopGroupManager.buildGroupMap(tags, counts);
      const topGroup = TopGroupManager.getTopGroup(groupMap);
      const topGroupId = topGroup?.groupId ?? null;

      // 按 sortOrder 排序组
      const sortedGroups = groups.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      sortedGroups.forEach(group => {
        const groupData = groupedTags[group.name];
        if (!groupData || groupData.tags.length === 0) return;

        // 首位组显示所有标签，其他组只显示计数>0的标签
        const isTopGroup = group.id === topGroupId;
        const visibleTags = isTopGroup
          ? groupData.tags
          : groupData.tags.filter(({ count }) => count > 0);
        if (visibleTags.length === 0) return;

        html += `<div class="tag-filter-group" data-group-id="${group.id}">`;
        html += `<div class="tag-filter-group-title">${HtmlUtils.escapeHtml(group.name)}</div>`;
        html += '<div class="tag-filter-group-content">';

        html += visibleTags.map(({ tag, count }) => {
          const isActive = selectedSet.has(tag);
          const dragType = isImage ? 'image-tag' : 'prompt-tag';
          return `
            <div class="tag-filter-item ${isActive ? 'active' : ''}" data-tag="${HtmlUtils.escapeHtml(tag)}" data-group-id="${group.id}" draggable="true" data-drag-type="${dragType}">
              <span class="tag-name">${HtmlUtils.escapeHtml(tag)}</span>
              <span class="tag-badge">${count}</span>
            </div>
          `;
        }).join('');

        html += '</div></div>';
      });
    }

    // 渲染未分组标签（无论是否有分组定义，都显示未分组标签）
    const visibleUngroupedTags = ungroupedTags.filter(({ count }) => count > 0);
    if (visibleUngroupedTags.length > 0) {
      html += '<div class="tag-filter-group">';
      html += '<div class="tag-filter-group-title">未分组</div>';
      html += '<div class="tag-filter-group-content">';
      html += visibleUngroupedTags.map(({ tag, count }) => {
        const isActive = selectedSet.has(tag);
        const dragType = isImage ? 'image-tag' : 'prompt-tag';
        return `
          <div class="tag-filter-item ${isActive ? 'active' : ''}" data-tag="${HtmlUtils.escapeHtml(tag)}" draggable="true" data-drag-type="${dragType}">
            <span class="tag-name">${HtmlUtils.escapeHtml(tag)}</span>
            <span class="tag-badge">${count}</span>
          </div>
        `;
      }).join('');
      html += '</div></div>';
    }

    return html;
  }

  /**
   * 渲染标签筛选头部
   */
  static renderFilterHeader(options: FilterHeaderOptions): boolean {
    const {
      containerId,
      specialTags,
      sortedTagsWithGroup,
      tagCounts = {},
      selectedTags,
      onTagClick,
      topGroupInfo = null,
      dragType = null
    } = options;

    const headerTagsEl = document.getElementById(containerId);
    if (!headerTagsEl) return false;

    const selectedSet = selectedTags instanceof Set ? selectedTags : new Set(selectedTags);

    // 使用 TopGroupManager 收集头部标签
    const tagsToShow = TopGroupManager.collectHeaderTags(
      specialTags,
      sortedTagsWithGroup,
      tagCounts,
      selectedSet,
      Constants.ALL_SPECIAL_TAGS
    );

    // 获取首位组信息用于返回
    const groupMap = TopGroupManager.buildGroupMap(sortedTagsWithGroup, tagCounts);
    const topGroup = TopGroupManager.getTopGroup(groupMap);

    const currentTopGroupInfo = topGroupInfo || topGroup;

    // 渲染 HTML
    if (tagsToShow.length === 0) {
      headerTagsEl.innerHTML = '<span class="tag-filter-empty">暂无标签</span>';
    } else {
      headerTagsEl.innerHTML = tagsToShow.map(({ tag, count, className, isSpecial, isTopGroup, isSingleSelect }) => {
        // 特殊标签不允许拖拽，普通标签允许拖拽
        const draggableAttr = (!isSpecial && dragType) ? 'draggable="true"' : '';
        const dragTypeAttr = (!isSpecial && dragType) ? `data-drag-type="${dragType}"` : '';

        return `
          <button class="tag-filter-item ${className || ''}" data-tag="${HtmlUtils.escapeHtml(tag)}" data-is-special="${isSpecial}" data-is-top-group="${isTopGroup || false}" data-is-single-select="${isSingleSelect || false}" ${draggableAttr} ${dragTypeAttr}>
            <span class="tag-name">${HtmlUtils.escapeHtml(tag)}</span>
            <span class="tag-badge">${count || 0}</span>
          </button>
        `;
      }).join('');
    }

    // 使用 WeakSet 来跟踪正在拖拽的元素
    const draggingItems = new WeakSet<HTMLElement>();

    // 绑定点击事件
    if (onTagClick) {
      headerTagsEl.querySelectorAll('.tag-filter-item').forEach(el => {
        el.addEventListener('click', (e) => {
          // 如果正在拖拽，不触发点击
          if (draggingItems.has(el as HTMLElement)) {
            draggingItems.delete(el as HTMLElement);
            return;
          }
          const tag = (el as HTMLElement).dataset.tag;
          const isTopGroupTag = (el as HTMLElement).dataset.isTopGroup === 'true';
          const isSingleSelectGroup = (el as HTMLElement).dataset.isSingleSelect === 'true';
          if (tag) {
            onTagClick(tag, isTopGroupTag, isSingleSelectGroup, e as MouseEvent);
          }
        });
      });
    }

    // 绑定拖拽事件（只绑定非特殊标签）
    if (dragType) {
      headerTagsEl.querySelectorAll('.tag-filter-item[draggable="true"]').forEach(el => {
        el.addEventListener('dragstart', (e) => {
          // 标记为正在拖拽
          draggingItems.add(el as HTMLElement);
          const tag = (el as HTMLElement).dataset.tag;
          if (tag) {
            (e as DragEvent).dataTransfer!.setData('text/plain', tag);
            (e as DragEvent).dataTransfer!.setData('drag-source', dragType);
          }
          (e as DragEvent).dataTransfer!.effectAllowed = 'copy';
          el.classList.add('dragging');
        });

        el.addEventListener('dragend', () => {
          el.classList.remove('dragging');
          // 注意：不在 dragend 中删除 draggingItems，因为 click 事件会在 dragend 之后触发
        });
      });
    }

    return true;
  }

  /**
   * 生成标签列表 HTML
   */
  static generateTagsHtml(tags: string[], tagClass: string, emptyClass: string): string {
    const normalTags = tags ? tags.filter(tag => !Constants.ALL_SPECIAL_TAGS.includes(tag)) : [];

    if (normalTags.length === 0) {
      return `<span class="${tagClass} ${emptyClass}">无标签</span>`;
    }

    return normalTags.map(tag => {
      return `<span class="${tagClass}">${HtmlUtils.escapeHtml(tag)}</span>`;
    }).join('');
  }

  /**
   * 生成可编辑标签列表 HTML
   */
  static generateEditableTagsHtml(tags: string[], options: EditableTagsOptions = {}): string {
    const { readonly = false } = options;
    const normalTags = tags ? tags.filter(tag => !Constants.ALL_SPECIAL_TAGS.includes(tag)) : [];

    if (normalTags.length === 0) {
      return '<span class="tag-empty">无标签</span>';
    }

    return normalTags.map(tag => {
      const removeBtn = readonly ? '' : `<button class="tag-remove" data-tag="${HtmlUtils.escapeAttr(tag)}" title="移除">×</button>`;
      return `<span class="tag-badge editable">${HtmlUtils.escapeHtml(tag)}${removeBtn}</span>`;
    }).join('');
  }

  /**
   * 生成备注 HTML
   */
  static generateNoteHtml(note: string, noteClass: string): string {
    if (!note || !note.trim()) return '';
    return `<div class="${noteClass}" title="${HtmlUtils.escapeAttr(note)}">${HtmlUtils.escapeHtml(note)}</div>`;
  }
}

export default TagUI;
