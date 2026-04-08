import { TagService } from './TagService.ts';
import { TagUI } from './TagUI.ts';
import { Constants, ElementId } from '../../constants.ts';
import { DialogService, DialogConfig } from '../services/index.ts';
import { ITagService } from '../../types/entities.ts';
import { contextStack, IContextStackEntry } from './ContextStackManager.ts';
import { focusInput } from '../renderer_utils/index.ts';
import { MultiSelectManager } from './MultiSelectManager.ts';

/**
 * 标签管理器元素 ID 配置
 */
export interface ITagManagerElements {
  modalId: ElementId;
  closeButtonId: string;
  containerId: string;
  emptyStateId: string;
  searchInputId: string;
  clearSearchBtnId: string;
  sortSelectId: string;
  orderBtnId: string;
  addTagGroupBtnId: string;
  addTagInManagerBtnId: string;
  batchManageBtnId: string;
  batchToolbarId: ElementId;
  groupEditModalId: string;
  groupEditCloseBtnId: string;
  groupEditCancelBtnId: string;
  groupEditSaveBtnId: string;
  groupEditTypeInputId: string;
  groupEditIdInputId: string;
  groupEditNameInputId: string;
  groupEditSortOrderInputId: string;
}

/**
 * 标签管理器基类
 * 管理标签的注册、分组、排序、CRUD 操作
 */
export abstract class TagManager {
  type: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  service: ITagService;
  protected app: any;
  protected ui: TagUI;
  protected eventBus: any;
  protected selectedTagGroup: any;
  protected containerId: string;
  protected emptyStateId: string;
  protected searchInputId: string;
  protected elements: ITagManagerElements;
  protected groupEditActive: boolean = false;
  protected _eventsBound: boolean = false;
  protected multiSelectManager: MultiSelectManager;
  protected lastSearchTerm: string = '';
  protected isBatchModeActive: boolean = false;

  constructor(type: string, app: any) {
    this.type = type;
    this.app = app;
    this.service = TagService.getInstance(type);
    this.ui = new TagUI(type);
    // eventBus 通过 app 访问
    this.selectedTagGroup = null;

    // 排序状态
    this.sortBy = localStorage.getItem(`${type}TagSortBy`) || 'count';
    this.sortOrder = (localStorage.getItem(`${type}TagSortOrder`) || 'desc') as 'asc' | 'desc';

    // 获取元素配置（由子类提供）
    this.elements = this.getElementsConfig();
    this.containerId = this.elements.containerId;
    this.emptyStateId = this.elements.emptyStateId;
    this.searchInputId = this.elements.searchInputId;

    // 初始化 MultiSelectManager
    this.multiSelectManager = new MultiSelectManager({
      onChange: async () => {
        await this.render(this.lastSearchTerm);
        this.multiSelectManager.updateToolbarUI();
      },
      toolbarConfig: {
        label: '标签',
        buttons: [
          { id: 'selectAll', text: '全选', className: 'batch-action-select-all', action: 'SelectAll', title: '全选所有可见标签' },
          { id: 'invert', text: '反选', className: 'batch-action-invert', action: 'Invert', title: '反选所有可见标签' },
          { id: 'move', text: '移动到组', className: 'batch-action-move', action: 'Move', title: '移动选中的标签到指定组' },
          { id: 'delete', text: '删除', className: 'batch-action-delete', action: 'Delete', title: '删除选中的标签' },
          { id: 'cancel', text: '取消', className: 'batch-action-cancel', action: 'Cancel', title: '退出批量管理模式' }
        ]
      },
      handler: {
        onSelectAll: () => this.batchSelectAll(),
        onInvert: () => this.batchInvert(),
        onAddTag: () => {},
        onFavorite: () => {},
        onDelete: () => this.batchDeleteTags(),
        onCancel: () => this.exitBatchMode()
      }
    });

    // 绑定标签管理器事件
    this.bindManagerEvents();

    // 初始化标签组编辑模态框事件
    this.initGroupEditModals();
  }

  /**
   * 获取元素配置（由子类实现）
   */
  protected abstract getElementsConfig(): ITagManagerElements;

  /**
   * 获取类型标签（用于显示）
   */
  protected getTypeLabel(): string {
    return this.type === 'prompt' ? '提示词' : '图像';
  }

  /**
   * 获取面板管理器（由子类实现）
   */
  protected abstract getPanelManager(): any;

  /**
   * 销毁资源
   */
  destroy(): void {
    // 销毁 MultiSelectManager
    this.multiSelectManager.destroy();
  }

  /**
   * 渲染标签管理器
   */
  async render(searchTerm: string = ''): Promise<void> {
    const stack = new Error().stack || '';
    window.electronAPI.logDebug('TagManager', `${this.type} render called, searchTerm: ${searchTerm}, stack: ${stack.split('\n').slice(1, 4).join(' | ')}`);
    try {
      if (this.lastSearchTerm !== searchTerm) {
        this.multiSelectManager.clearImmediately();
        this.lastSearchTerm = searchTerm;
      }

      const tags = await this.service.getTags();
      const groups = await this.service.getTagGroups();
      const container = document.getElementById(this.containerId);
      const emptyState = document.getElementById(this.emptyStateId);

      if (!container) return;

      const tagCounts = this.calculateTagCounts(tags);

      const filteredTags = searchTerm
        ? tags.filter((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
        : tags;

      if (filteredTags.length === 0) {
        container.style.display = 'none';
        if (emptyState) {
          emptyState.style.display = 'flex';
          const emptyText = emptyState.querySelector('p');
          if (emptyText) {
            emptyText.textContent = searchTerm ? '没有找到匹配的标签' : `暂无${this.getTypeLabel()}标签`;
          }
        }
        return;
      }

      container.style.display = 'grid';
      if (emptyState) emptyState.style.display = 'none';

      const sortedTags = this.sortTags(filteredTags, tagCounts);
      const { groupedTags, ungroupedTags } = this.service.groupTagsByGroup(sortedTags, groups);

      const html = this.ui.generateRegistryHtml(groups, groupedTags, ungroupedTags, tagCounts, searchTerm, this.isBatchModeActive, this.multiSelectManager.selectedIds);
      container.innerHTML = html;

      this._eventsBound = false;
      this.bindEvents(container);

      // 更新选择模式类
      this.updateSelectionModeClass();
    } catch (error) {
      window.electronAPI.logError('TagManager.ts', `Failed to render ${this.type} tag manager:`, error);
      this.app.showToast(`加载${this.getTypeLabel()}标签失败`, 'error');
    }
  }

  /**
   * 刷新标签数据
   */
  async refresh(): Promise<void> {
    const searchInput = document.getElementById(this.searchInputId) as HTMLInputElement | null;
    await this.render(searchInput ? searchInput.value : '');
  }

  /**
   * 添加标签
   */
  async addTag(tag: string): Promise<void> {
    try {
      await this.service.addTag(tag);
      this.app.showToast('标签已添加', 'success');
      await this.render();
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagManager.ts', 'Failed to add tag:', error);
      this.app.showToast('添加标签失败', 'error');
    }
  }

  /**
   * 删除标签
   */
  async deleteTag(tag: string): Promise<void> {
    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.DELETE_TAG,
      { name: tag }
    );
    if (!confirmed) return;

    try {
      await this.service.deleteTag(tag);
      this.app.showToast(`${this.getTypeLabel()}标签已删除`);
      await this.render();
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagManager.ts', 'Failed to delete tag:', error);
      this.app.showToast('删除失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 更新标签
   */
  async updateTag(oldTag: string, newTag: string): Promise<void> {
    try {
      await this.service.renameTag(oldTag, newTag);
      this.app.showToast('标签已更新', 'success');
      await this.render();
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagManager.ts', 'Failed to update tag:', error);
      this.app.showToast('更新标签失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 获取所有标签
   */
  async getTags(): Promise<string[]> {
    return await this.service.getTags();
  }

  /**
   * 绑定事件（使用事件委托）
   */
  bindEvents(container: HTMLElement): void {
    window.electronAPI.logDebug('TagManager', 'bindEvents executing, _eventsBound=' + this._eventsBound + ', isBatchMode=' + this.isBatchModeActive);
    if (this._eventsBound) return;
    this._eventsBound = true;

    // 使用事件委托处理所有点击事件
    container.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      window.electronAPI.logDebug('TagManager', 'click event, target: ' + target.className + ', tagItem: ' + target.closest('.tag-manager-item')?.className);

      // 批量模式下的标签项选择（单击选择）
      if (this.isBatchModeActive) {
        const tagItem = target.closest('.tag-manager-item[data-tag]');
        if (tagItem) {
          const tag = (tagItem as HTMLElement).dataset.tag;
          if (!tag) return;
          const index = parseInt((tagItem as HTMLElement).dataset.index || '0', 10);
          this.multiSelectManager.singleSelect(tag, index);
        }
        return;
      }

      // 非批量模式下的编辑/删除按钮处理
      // 处理编辑按钮点击
      const editBtn = target.closest('.tag-edit-btn');
      if (editBtn) {
        e.stopPropagation();
        const tag = (editBtn as HTMLElement).dataset.tag;
        if (tag) await this.startRenameTag(tag);
        return;
      }

      // 处理删除按钮点击
      const deleteBtn = target.closest('.tag-delete-btn');
      if (deleteBtn) {
        e.stopPropagation();
        const tag = (deleteBtn as HTMLElement).dataset.tag;
        if (tag) await this.deleteTag(tag);
        return;
      }

      // 处理标签组编辑按钮
      const groupEditBtn = target.closest('.tag-group-btn.edit');
      if (groupEditBtn) {
        e.stopPropagation();
        const groupId = parseInt((groupEditBtn as HTMLElement).dataset.id || '0');
        this.openGroupEdit(groupId);
        return;
      }

      // 处理标签组删除按钮
      const groupDeleteBtn = target.closest('.tag-group-btn.delete');
      if (groupDeleteBtn) {
        e.stopPropagation();
        const groupId = parseInt((groupDeleteBtn as HTMLElement).dataset.id || '0');
        await this.deleteGroup(groupId);
        return;
      }
    });

    // 使用事件委托处理复选框变化（批量模式）
    container.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('tag-batch-checkbox')) {
        const checkbox = target as HTMLInputElement;
        const tag = checkbox.dataset.tag;
        const index = parseInt(checkbox.dataset.index || '0', 10);
        if (tag) {
          if (checkbox.checked) {
            this.multiSelectManager.addSelectionWithIndex(tag, index);
          } else {
            this.multiSelectManager.removeSelection(tag);
          }
        }
      }
    });

    if (!this.isBatchModeActive) {
      this.bindDragEvents(container);
      this.bindGroupContextMenu(container);
    }
  }

  /**
   * 在管理器中添加标签
   */
  async addTagInManager(): Promise<void> {
    await this.addTagInManagerWithDialog();
  }

  /**
   * 计算标签数量
   */
  private calculateTagCounts(tags: string[]): Record<string, number> {
    const panelManager = this.getPanelManager();
    const visibleItems = panelManager?.getItems() ?? [];

    return tags.reduce((counts, tag) => {
      counts[tag] = visibleItems.filter((item: any) => item.tags?.includes(tag)).length;
      return counts;
    }, {} as Record<string, number>);
  }

  /**
   * 排序标签
   */
  private sortTags(tags: string[], tagCounts: Record<string, number>): string[] {
    const order = this.sortOrder === 'asc' ? 1 : -1;

    return [...tags].sort((a, b) => {
      if (this.sortBy === 'count') {
        const countDiff = (tagCounts[a] ?? 0) - (tagCounts[b] ?? 0);
        if (countDiff !== 0) return countDiff * order;
      }
      return a.toLowerCase().localeCompare(b.toLowerCase()) * order;
    });
  }

  /**
   * 绑定标签组右键菜单事件
   */
  private bindGroupContextMenu(container: HTMLElement): void {
    const groupCards = container.querySelectorAll('.tag-group-card[data-group-id]:not(.ungrouped-card)');

    groupCards.forEach(card => {
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const groupId = (card as HTMLElement).dataset.groupId;
        if (!groupId) return;

        this.showContextMenu(e, [
          {
            label: '固定到首位',
            action: () => this.pinTagGroupToTop(parseInt(groupId))
          }
        ]);
      });
    });
  }

  /**
   * 显示右键菜单
   */
  private showContextMenu(event: Event, items: Array<{ label: string; action: () => void }>): void {
    const existingMenu = document.getElementById('dynamicContextMenu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.id = 'dynamicContextMenu';
    menu.className = 'context-menu';
    menu.innerHTML = items.map((item, index) =>
      `<div class="context-menu-item" data-index="${index}">${item.label}</div>`
    ).join('');

    menu.style.position = 'fixed';
    menu.style.left = (event as MouseEvent).clientX + 'px';
    menu.style.top = (event as MouseEvent).clientY + 'px';
    menu.style.zIndex = '10000';

    document.body.appendChild(menu);

    menu.querySelectorAll('.context-menu-item').forEach((menuItem, index) => {
      menuItem.addEventListener('click', () => {
        items[index].action();
        menu.remove();
      });
    });

    const closeMenu = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  /**
   * 绑定拖拽事件
   */
  private bindDragEvents(container: HTMLElement): void {
    window.electronAPI.logDebug('TagManager', 'bindDragEvents called, isBatchModeActive=' + this.isBatchModeActive);
    const dragItems = container.querySelectorAll('.tag-manager-item[draggable="true"]');
    window.electronAPI.logDebug('TagManager', `bindDragEvents: found ${dragItems.length} draggable items`);
    const dropTargets = container.querySelectorAll('.tag-group-card[data-drop-target="true"]');

    dragItems.forEach(item => {
      item.addEventListener('mousedown', (e) => {
        window.electronAPI.logDebug('TagManager', 'mousedown captured');
        const mouseEvent = e as MouseEvent;
        if (mouseEvent.button !== 0) return;
        
        const target = e.target as HTMLElement;
        window.electronAPI.logDebug('TagManager', 'mousedown target: ' + target.className);
        
        if (target.closest('.tag-edit-btn') || target.closest('.tag-delete-btn')) {
          window.electronAPI.logDebug('TagManager', 'blocked by edit/delete button');
          return;
        }
        
        item.classList.add('dragging');
        window.electronAPI.logDebug('TagManager', 'mousedown for drag done');
      });

      item.addEventListener('dragstart', (e) => {
        window.electronAPI.logDebug('TagManager', 'dragstart event fired');
        const tagName = (item as HTMLElement).dataset.tag || '';
        window.electronAPI.logDebug('TagManager', 'dragstart set data for: ' + tagName);
        
        const dragEvent = e as DragEvent;
        dragEvent.dataTransfer?.setData('text/plain', tagName);
        dragEvent.dataTransfer && (dragEvent.dataTransfer.effectAllowed = 'move');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        dropTargets.forEach(target => target.classList.remove('drag-over'));
      });
    });

    dropTargets.forEach(target => {
      target.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragEvent = e as DragEvent;
        dragEvent.dataTransfer && (dragEvent.dataTransfer.dropEffect = 'move');
        target.classList.add('drag-over');
      });

      target.addEventListener('dragleave', () => {
        target.classList.remove('drag-over');
      });

      target.addEventListener('drop', async (e) => {
        e.preventDefault();
        target.classList.remove('drag-over');
        const dragEvent = e as DragEvent;
        const tagName = dragEvent.dataTransfer?.getData('text/plain');
        const groupId = (target as HTMLElement).dataset.groupId ? parseInt((target as HTMLElement).dataset.groupId || '0') : null;

        if (tagName) {
          await this.assignTagToGroup(tagName, groupId);
        }
      });
    });
  }

  /**
   * 开始重命名标签
   */
  private async startRenameTag(oldTag: string): Promise<void> {
    const groups = await this.service.getTagGroups();
    const allTags = await this.service.getTags();

    let currentGroupId: number | null = null;
    for (const group of groups) {
      if (group.tags && group.tags.includes(oldTag)) {
        currentGroupId = group.id;
        break;
      }
    }

    const result = await this.app.showInputDialog('重命名标签', '请输入新标签名:', oldTag, {
      showGroupSelect: true,
      groups: groups,
      defaultGroupId: currentGroupId
    });

    if (!result || !result.value || !result.value.trim()) return;

    const newTag = result.value.trim();
    const selectedGroupId = result.groupId;

    if (newTag === oldTag) return;

    if (allTags.includes(newTag)) {
      this.app.showToast('标签名已存在，请使用其他名称', 'error');
      return;
    }

    const groupIdToAssign = selectedGroupId !== currentGroupId ? selectedGroupId : undefined;
    await this.renameTag(oldTag, newTag, groupIdToAssign);
  }

  /**
   * 重命名标签
   */
  private async renameTag(oldTag: string, newTag: string, groupId?: number | null): Promise<void> {
    try {
      await this.service.renameTag(oldTag, newTag);
      if (groupId !== undefined) {
        await this.service.assignTagToGroup(newTag, groupId);
      }
      this.app.showToast('标签已重命名', 'success');
      await this.refreshPanel();
      await this.render();
    } catch (error) {
      window.electronAPI.logError('TagManager.ts', 'Failed to rename tag:', error);
      this.app.showToast('重命名标签失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 删除标签组
   */
  private async deleteGroup(groupId: number): Promise<void> {
    const confirmed = await DialogService.showConfirmDialogByConfig(DialogConfig.DELETE_TAG_GROUP);
    if (!confirmed) return;

    try {
      await this.service.deleteGroup(groupId);
      this.app.showToast('标签组已删除');
      const searchInput = document.getElementById(this.searchInputId) as HTMLInputElement | null;
      await this.render(searchInput ? searchInput.value : '');
    } catch (error) {
      window.electronAPI.logError('TagManager.ts', 'Failed to delete tag group:', error);
      this.app.showToast('删除失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 分配标签到组
   */
  private async assignTagToGroup(tagName: string, groupId: number | null): Promise<void> {
    try {
      await this.service.assignTagToGroup(tagName, groupId);
      this.app.showToast('标签组已更新');
      const searchInput = document.getElementById(this.searchInputId) as HTMLInputElement | null;
      await this.render(searchInput ? searchInput.value : '');
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagManager.ts', 'Failed to assign tag to group:', error);
      this.app.showToast('更新失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 刷新面板
   */
  private async refreshPanel(): Promise<void> {
    const panelManager = this.getPanelManager();
    if (panelManager) {
      await panelManager.loadData();
      await panelManager.renderTagFilters();
    }
  }

  /**
   * 将标签组固定到首位
   */
  private async pinTagGroupToTop(groupId: number): Promise<void> {
    try {
      const groups = await this.service.getTagGroups();
      const sortedGroups = groups.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
      const firstSortOrder = sortedGroups[0]?.sortOrder || 0;
      const newSortOrder = firstSortOrder - 1;

      const group = groups.find((g: any) => String(g.id) === String(groupId));
      if (group) {
        await this.service.updateGroup(groupId, {
          name: group.name,
          sortOrder: newSortOrder
        });
        this.app.showToast('标签组已固定到首位', 'success');
        const searchInput = document.getElementById(this.searchInputId) as HTMLInputElement | null;
        await this.render(searchInput ? searchInput.value : '');
        await this.refreshPanel();
      }
    } catch (error) {
      window.electronAPI.logError('TagManager.ts', 'Failed to pin tag group to top:', error);
      this.app.showToast('固定失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 在标签管理界面新建标签
   */
  private async addTagInManagerWithDialog(defaultValue: string = '', defaultGroupId: number | null = null): Promise<void> {
    const groups = await this.service.getTagGroups();
    const allTags = await this.service.getTags();

    const result = await this.app.showInputDialog(`新建${this.getTypeLabel()}标签`, '请输入标签名称', defaultValue, {
      showGroupSelect: true,
      groups: groups,
      defaultGroupId: defaultGroupId
    });
    if (!result || !result.value || !result.value.trim()) return;

    const trimmedTag = result.value.trim();

    if (Constants.ALL_SPECIAL_TAGS.includes(trimmedTag)) {
      this.app.showToast(`"${trimmedTag}" 是系统保留标签，不能使用`, 'error');
      await this.addTagInManagerWithDialog(trimmedTag, result.groupId);
      return;
    }

    if (allTags.includes(trimmedTag)) {
      this.app.showToast('标签已存在', 'error');
      return;
    }

    try {
      await this.service.addTag(trimmedTag);
      await this.service.assignTagToGroup(trimmedTag, result.groupId || null);
      this.app.showToast('标签已创建', 'success');
      await this.render();
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagManager.ts', 'Failed to create tag:', error);
      this.app.showToast('创建标签失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 选择标签组
   */
  selectTagGroup(group: any): void {
    this.selectedTagGroup = group;
    this.render();
  }

  /**
   * 获取选中的标签组
   */
  getSelectedTagGroup(): any {
    return this.selectedTagGroup;
  }

  // ========== 批量管理功能 ==========

  /**
   * 切换批量管理模式
   */
  toggleBatchMode(): void {
    if (this.isBatchModeActive) {
      this.exitBatchMode();
    } else {
      this.isBatchModeActive = true;
      this.multiSelectManager.showToolbar();
      this.render(this.lastSearchTerm);
    }
  }

  /**
   * 退出批量管理模式
   */
  exitBatchMode(): void {
    this.isBatchModeActive = false;
    this.multiSelectManager.clear();
    this._eventsBound = false;
  }

  /**
   * 隐藏批量工具栏
   */
  hideBatchToolbar(): void {
    this.multiSelectManager.hideToolbar();
    if (this.isBatchModeActive) {
      this.isBatchModeActive = false;
    }
  }

  /**
   * 更新选择模式类
   */
  private updateSelectionModeClass(): void {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.toggle('selection-mode', this.isBatchModeActive);
    }
  }

  /**
   * 批量删除标签
   */
  private async batchDeleteTags(): Promise<void> {
    const selectedIds = Array.from(this.multiSelectManager.selectedIds);
    if (selectedIds.length === 0) {
      this.app.showToast('请先选择要删除的标签', 'warning');
      return;
    }

    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.BATCH_DELETE_TAGS,
      { count: selectedIds.length }
    );

    if (!confirmed) return;

    try {
      const result = await this.service.deleteTags(selectedIds);

      this.app.showToast(`已删除 ${result.deleted} 个标签`, 'success');
      this.exitBatchMode();
      await this.render();
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagManager.ts', 'Failed to batch delete tags:', error);
      this.app.showToast('批量删除失败', 'error');
    }
  }

  /**
   * 批量移动标签到组
   */
  private async batchMoveToGroup(): Promise<void> {
    const selectedIds = Array.from(this.multiSelectManager.selectedIds);
    if (selectedIds.length === 0) {
      this.app.showToast('请先选择要移动的标签', 'warning');
      return;
    }

    const groups = await this.service.getTagGroups();

    const result = await this.app.showInputDialog(
      '批量移动到组',
      `将 ${selectedIds.length} 个标签移动到:`,
      '',
      {
        showGroupSelect: true,
        groups: groups,
        defaultGroupId: null,
        allowEmpty: true
      }
    );

    if (!result || result.groupId === undefined) return;

    try {
      let successCount = 0;
      for (const tag of selectedIds) {
        try {
          await this.service.assignTagToGroup(tag, result.groupId || null);
          successCount++;
        } catch (error) {
          window.electronAPI.logError('TagManager.ts', `Failed to move tag ${tag}:`, error);
        }
      }

      this.app.showToast(`已移动 ${successCount} 个标签`, 'success');
      this.exitBatchMode();
      await this.render();
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagManager.ts', 'Failed to batch move tags:', error);
      this.app.showToast('批量移动失败', 'error');
    }
  }

  /**
   * 全选所有可见标签
   */
  private batchSelectAll(): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const tagItems = container.querySelectorAll('.tag-manager-item[data-tag]');
    const ids = Array.from(tagItems).map((item) => {
      return (item as HTMLElement).dataset.tag || '';
    }).filter(id => id);

    this.multiSelectManager.selectAll(ids);
  }

  /**
   * 反选所有可见标签
   */
  private batchInvert(): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const tagItems = container.querySelectorAll('.tag-manager-item[data-tag]');
    const allIds = Array.from(tagItems).map((item) => {
      return (item as HTMLElement).dataset.tag || '';
    }).filter(id => id);

    this.multiSelectManager.invertSelection(allIds);
  }

  // ========== 标签管理器模态框控制 ==========

  /**
   * 打开标签管理器模态框
   */
  openManager(): void {
    const modal = document.getElementById(this.elements.modalId);
    if (modal) {
      modal.classList.add('active');
      (modal as any).close = () => this.closeManager();
      (modal as any).ctrla = () => {
        if (!this.isBatchModeActive) {
          // 非批量模式：进入批量模式但不立即渲染，等全选后再渲染
          this.isBatchModeActive = true;
          this.multiSelectManager.showToolbar();
        }
        // 批量模式下执行全选
        this.batchSelectAll();
        return true;
      };

      // 压栈：进入标签管理器上下文，包含批量模式状态
      const stackEntry: IContextStackEntry = {
        id: this.elements.modalId,
        state: {
          isBatchToolbarVisible: this.isBatchModeActive
        },
        close: () => {
          // 如果被其他视图覆盖，隐藏批量工具栏
          if (this.isBatchModeActive) {
            window.electronAPI.logDebug('TagManager', `close on push: ${this.elements.modalId}`);
            this.hideBatchToolbar();
          }
        }
      };
      contextStack.push(stackEntry);
    }
  }

  /**
   * 关闭标签管理器模态框
   */
  closeManager(): void {
    const modal = document.getElementById(this.elements.modalId);
    if (modal) {
      modal.classList.remove('active');
    }
    contextStack.pop(this.elements.modalId as ElementId);

    this.exitBatchMode();
  }

  /**
   * 检查标签管理器模态框是否处于活动状态
   */
  isManagerActive(): boolean {
    const modal = document.getElementById(this.elements.modalId);
    return modal?.classList.contains('active') ?? false;
  }

  // ========== 标签组编辑模态框控制 ==========

  /**
   * 打开标签组编辑模态框
   */
  async openGroupEdit(groupId: number | null = null): Promise<void> {
    const modal = document.getElementById(this.elements.groupEditModalId);
    if (!modal) return;

    const nameInput = document.getElementById(this.elements.groupEditNameInputId) as HTMLInputElement | null;
    const sortOrderInput = document.getElementById(this.elements.groupEditSortOrderInputId) as HTMLInputElement | null;

    if (nameInput) {
      nameInput.value = '';
      focusInput(nameInput);
    }
    if (sortOrderInput) sortOrderInput.value = '0';

    if (groupId) {
      const groups = await this.service.getTagGroups();
      const group = groups.find((g: any) => String(g.id) === String(groupId));
      if (group && nameInput && sortOrderInput) {
        nameInput.value = group.name || '';
        sortOrderInput.value = String(group.sortOrder || '0');
      }
    }

    (modal as any).dataset.groupId = groupId ? String(groupId) : '';
    modal.classList.add('active');
    this.groupEditActive = true;
  }

  /**
   * 关闭标签组编辑模态框
   */
  closeGroupEdit(): void {
    const modal = document.getElementById(this.elements.groupEditModalId);
    if (modal) {
      modal.classList.remove('active');
    }
    this.groupEditActive = false;
  }

  /**
   * 保存标签组
   */
  async saveGroupEdit(): Promise<void> {
    const modal = document.getElementById(this.elements.groupEditModalId);
    const nameInput = document.getElementById(this.elements.groupEditNameInputId) as HTMLInputElement | null;
    const sortOrderInput = document.getElementById(this.elements.groupEditSortOrderInputId) as HTMLInputElement | null;

    const groupIdStr = modal?.dataset.groupId;
    const name = nameInput?.value.trim() || '';
    const sortOrder = parseInt(sortOrderInput?.value || '0', 10);

    if (!name) {
      this.app.showToast('请输入标签组名称', 'error');
      return;
    }

    try {
      if (groupIdStr) {
        const groupId = parseInt(groupIdStr, 10);
        await this.service.updateGroup(groupId, { name, sortOrder });
      } else {
        await this.service.createGroup(name, sortOrder);
      }
      await this.render();
      await this.refreshPanel();

      this.closeGroupEdit();
      this.app.showToast(groupIdStr ? '标签组已更新' : '标签组已创建', 'success');
    } catch (error: any) {
      window.electronAPI?.logError('TagManager.ts', 'Failed to save tag group:', error);
      if (error.message?.includes('DUPLICATE_NAME')) {
        this.closeGroupEdit();
        await DialogService.showConfirmDialogByConfig(
          { ...DialogConfig.TAG_GROUP_DUPLICATE_NAME, type: 'info' },
          { name }
        );
      } else {
        this.app.showToast('保存失败: ' + error.message, 'error');
      }
    }
  }

  /**
   * 检查标签组编辑模态框是否处于活动状态
   */
  checkGroupEditActive(): boolean {
    return this.groupEditActive;
  }

  /**
   * 初始化标签组编辑模态框事件
   */
  private initGroupEditModals(): void {
    document.getElementById(this.elements.groupEditCloseBtnId)?.addEventListener('click', () => this.closeGroupEdit());
    document.getElementById(this.elements.groupEditCancelBtnId)?.addEventListener('click', () => this.closeGroupEdit());
    document.getElementById(this.elements.groupEditSaveBtnId)?.addEventListener('click', () => this.saveGroupEdit());
  }

  /**
   * 绑定标签管理器事件
   */
  private bindManagerEvents(): void {
    document.getElementById(this.elements.closeButtonId)?.addEventListener('click', () => this.closeManager());
    document.getElementById(this.elements.addTagGroupBtnId)?.addEventListener('click', () => this.openGroupEdit());
    document.getElementById(this.elements.addTagInManagerBtnId)?.addEventListener('click', () => this.addTagInManager());
    document.getElementById(this.elements.batchManageBtnId)?.addEventListener('click', () => this.toggleBatchMode());

    const searchInput = document.getElementById(this.elements.searchInputId) as HTMLInputElement | null;
    const clearBtn = document.getElementById(this.elements.clearSearchBtnId);
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        this.render(target.value);
        if (clearBtn) clearBtn.style.display = target.value ? 'flex' : 'none';
      });
    }
    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.render('');
        clearBtn.style.display = 'none';
        searchInput.focus();
      });
    }

    const sortSelect = document.getElementById(this.elements.sortSelectId) as HTMLSelectElement | null;
    const orderBtn = document.getElementById(this.elements.orderBtnId);
    if (sortSelect) {
      sortSelect.value = `${this.sortBy}-${this.sortOrder}`;
      sortSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const [sortBy, sortOrder] = target.value.split('-');
        this.sortBy = sortBy;
        this.sortOrder = sortOrder as 'asc' | 'desc';
        localStorage.setItem(`${this.type}TagSortBy`, sortBy);
        localStorage.setItem(`${this.type}TagSortOrder`, sortOrder);
        this.render(searchInput?.value || '');
      });
    }
    if (orderBtn && sortSelect) {
      orderBtn.addEventListener('click', () => {
        const newOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        this.sortOrder = newOrder;
        localStorage.setItem(`${this.type}TagSortOrder`, newOrder);
        sortSelect.value = `${this.sortBy}-${newOrder}`;
        this.render(searchInput?.value || '');
      });
    }
  }

  // ========== 静态工具方法 ==========

  /**
   * 处理标签同步结果
   * 清除受影响的缓存并刷新
   */
  static async handleSyncResult(
    result: {
      promptToImage: {
        imported: number;
        skipped: number;
        tags: string[];
        tagGroups: Array<{ groupName: string; tags: string[] }>;
        ungroupedTags: string[];
      };
      imageToPrompt: {
        imported: number;
        skipped: number;
        tags: string[];
        tagGroups: Array<{ groupName: string; tags: string[] }>;
        ungroupedTags: string[];
      };
    },
    promptManager: TagManager | null,
    imageManager: TagManager | null
  ): Promise<void> {
    // 清除标签缓存并刷新
    if (result.promptToImage.tags && result.promptToImage.tags.length > 0) {
      imageManager?.service._clearCache(imageManager.service.cacheKey);
      imageManager?.service._clearCache(imageManager.service.cacheKeyGroups);
    }
    if (result.imageToPrompt.tags && result.imageToPrompt.tags.length > 0) {
      promptManager?.service._clearCache(promptManager.service.cacheKey);
      promptManager?.service._clearCache(promptManager.service.cacheKeyGroups);
    }
    await Promise.all([promptManager?.refresh(), imageManager?.refresh()]);
  }

  /**
   * 绑定同步标签按钮事件
   */
  static bindSyncButton(
    buttonId: string,
    promptManager: TagManager | null,
    imageManager: TagManager | null,
    app: { showToast: (message: string, type?: string) => void }
  ): void {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('click', async () => {
      try {
        const result = await window.electronAPI.syncTagsBidirectional();
        await TagManager.handleSyncResult(result, promptManager, imageManager);
        DialogService.showConfirmDialogByConfig(DialogConfig.SYNC_TAGS_BIDIRECTIONAL, result);
      } catch (error) {
        window.electronAPI.logError('TagManager.ts', 'Failed to sync tags bidirectional', error);
        app.showToast('同步标签失败: ' + (error as Error).message, 'error');
      }
    });
  }
}

export default TagManager;
