import { TagService } from './TagService.js';
import { TagUI } from './TagUI.js';
import { Constants } from '../../constants.js';
import { DialogService, DialogConfig } from '../services/index.js';
import { ITagRegistry } from './ITagRegistry.js';

/**
 * 标签注册表 - 业务逻辑层
 * 管理标签的注册、分组、排序、CRUD 操作
 */
export class TagRegistry implements ITagRegistry {
  type: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  private context: any;
  private service: any;
  private ui: any;
  private eventBus: any;
  private selectedTagGroup: any;
  private containerId: string;
  private emptyStateId: string;
  private searchInputId: string;
  private isBatchMode: boolean;
  private selectedTags: Set<string>;

  constructor(type: string, context: any) {
    this.type = type;
    this.context = context;
    this.service = TagService.getInstance(type);
    this.ui = new TagUI(type);
    this.eventBus = context.eventBus;
    this.selectedTagGroup = null;
    this.isBatchMode = false;
    this.selectedTags = new Set();

    // 排序状态
    this.sortBy = localStorage.getItem(`${type}TagSortBy`) || 'count';
    this.sortOrder = (localStorage.getItem(`${type}TagSortOrder`) || 'desc') as 'asc' | 'desc';

    // DOM 元素 ID
    this.containerId = type === 'prompt' ? 'promptTagGroupCards' : 'imageTagGroupCards';
    this.emptyStateId = type === 'prompt' ? 'promptTagManagerEmpty' : 'imageTagManagerEmpty';
    this.searchInputId = type === 'prompt' ? 'promptTagManagerSearchInput' : 'imageTagManagerSearchInput';
  }

  /**
   * 渲染标签管理器
   * @param searchTerm - 搜索词
   */
  async render(searchTerm: string = ''): Promise<void> {
    try {
      const tags = await this.service.getTags();
      const groups = await this.service.getTagGroups();
      const container = document.getElementById(this.containerId);
      const emptyState = document.getElementById(this.emptyStateId);

      if (!container) return;

      // 计算标签数量
      const { tagCounts, specialTags } = await this.calculateTagCounts(tags);

      // 根据搜索词过滤
      const filteredTags = (searchTerm
        ? tags.filter((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
        : tags).filter((tag: string) => !specialTags.includes(tag));

      if (filteredTags.length === 0 && specialTags.length === 0) {
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

      // 排序和分组
      const sortedTags = this.sortTags(filteredTags, tagCounts);
      const { groupedTags, ungroupedTags } = this.service.groupTagsByGroup(sortedTags, groups);

      // 渲染HTML
      const html = this.ui.generateRegistryHtml(groups, groupedTags, ungroupedTags, specialTags, tagCounts, searchTerm, this.isBatchMode, this.selectedTags);
      container.innerHTML = html;

      // 绑定事件
      this.bindEvents(container);

      // 批量模式下绑定复选框事件
      if (this.isBatchMode) {
        this.bindBatchEvents(container);
      }
    } catch (error) {
      window.electronAPI.logError('TagRegistry.ts', `Failed to render ${this.type} tag registry:`, error);
      this.context.showToast(`加载${this.getTypeLabel()}标签失败`, 'error');
    }
  }

  /**
   * 刷新标签数据
   * 重新加载并渲染标签列表
   */
  async refresh(): Promise<void> {
    // 清除缓存并重新渲染
    const searchInput = document.getElementById(this.searchInputId) as HTMLInputElement | null;
    await this.render(searchInput ? searchInput.value : '');
  }

  /**
   * 添加标签
   * @param tag - 标签名称
   */
  async addTag(tag: string): Promise<void> {
    try {
      await this.service.addTag(tag);
      this.context.showToast('标签已添加', 'success');
      await this.render();
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagRegistry.ts', 'Failed to add tag:', error);
      this.context.showToast('添加标签失败', 'error');
    }
  }

  /**
   * 删除标签
   * @param tag - 标签名称
   */
  async deleteTag(tag: string): Promise<void> {
    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.DELETE_TAG,
      { name: tag }
    );
    if (!confirmed) return;

    try {
      await this.service.deleteTag(tag);
      this.context.showToast(`${this.getTypeLabel()}标签已删除`);
      await this.render();
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagRegistry.ts', 'Failed to delete tag:', error);
      this.context.showToast('删除失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 更新标签
   * @param oldTag - 原标签名称
   * @param newTag - 新标签名称
   */
  async updateTag(oldTag: string, newTag: string): Promise<void> {
    try {
      await this.service.renameTag(oldTag, newTag);
      this.context.showToast('标签已更新', 'success');
      await this.render();
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagRegistry.ts', 'Failed to update tag:', error);
      this.context.showToast('更新标签失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 获取所有标签
   * @returns 标签数组
   */
  async getTags(): Promise<string[]> {
    return await this.service.getTags();
  }

  /**
   * 绑定事件
   * @param container - 容器元素
   */
  bindEvents(container: HTMLElement): void {
    // 编辑标签按钮
    container.querySelectorAll('.tag-badge-edit').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tag = (btn as HTMLElement).dataset.tag;
        if (tag) await this.startRenameTag(tag);
      });
    });

    // 删除标签按钮
    container.querySelectorAll('.tag-badge-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tag = (btn as HTMLElement).dataset.tag;
        if (tag) await this.deleteTag(tag);
      });
    });

    // 编辑标签组按钮
    container.querySelectorAll('.tag-group-btn.edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = parseInt((btn as HTMLElement).dataset.id || '0');
        this.context.tagGroupModalManager?.openEdit(this.type, groupId);
      });
    });

    // 删除标签组按钮
    container.querySelectorAll('.tag-group-btn.delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const groupId = parseInt((btn as HTMLElement).dataset.id || '0');
        await this.deleteGroup(groupId);
      });
    });

    // 绑定拖拽事件
    this.bindDragEvents(container);

    // 绑定标签组右键菜单事件
    this.bindGroupContextMenu(container);
  }

  /**
   * 绑定批量管理事件
   * @param container - 容器元素
   */
  private bindBatchEvents(container: HTMLElement): void {
    container.querySelectorAll('.tag-batch-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const tag = target.dataset.tag;
        if (tag) {
          this.toggleTagSelection(tag);
          // 更新复选框状态
          const item = target.closest('.tag-manager-item');
          if (item) {
            if (target.checked) {
              item.classList.add('tag-selected');
            } else {
              item.classList.remove('tag-selected');
            }
          }
        }
      });
    });
  }

  /**
   * 在管理器中添加标签
   */
  addTagInManager(): void {
    this.addTagInManagerWithDialog();
  }

  /**
   * 获取类型标签（用于显示）
   * @returns 类型标签
   */
  private getTypeLabel(): string {
    return this.type === 'prompt' ? '提示词' : '图像';
  }

  /**
   * 计算标签数量
   * @param tags - 标签数组
   * @returns 标签计数和特殊标签
   */
  private async calculateTagCounts(tags: string[]): Promise<{ tagCounts: Record<string, number>; specialTags: string[] }> {
    const tagCounts: Record<string, number> = {};
    const specialTagChecks = this.service.getSpecialTagChecks();
    const specialTags: string[] = [];

    // 获取可见项
    const panelManager = this.type === 'prompt'
      ? this.context.promptPanelManager
      : this.context.imagePanelManager;
    const visibleItems = panelManager ? panelManager.getItems() : [];

    // 计算普通标签数量
    tags.forEach((tag: string) => {
      if (!Constants.ALL_SPECIAL_TAGS.includes(tag)) {
        tagCounts[tag] = visibleItems.filter((item: any) => item.tags && item.tags.includes(tag)).length;
      }
    });

    // 计算特殊标签数量
    specialTagChecks.forEach((checkFn: (item: any) => boolean, tag: string) => {
      const count = visibleItems.filter(checkFn).length;
      if (count > 0 || tag === Constants.NO_TAG_TAG) {
        tagCounts[tag] = count;
        specialTags.push(tag);
      }
    });

    return { tagCounts, specialTags };
  }

  /**
   * 排序标签
   * @param tags - 标签数组
   * @param tagCounts - 标签计数
   * @returns 排序后的标签数组
   */
  private sortTags(tags: string[], tagCounts: Record<string, number>): string[] {
    const order = this.sortOrder === 'asc' ? 1 : -1;

    return [...tags].sort((a, b) => {
      const countA = tagCounts[a] || 0;
      const countB = tagCounts[b] || 0;
      const nameA = a.toLowerCase();
      const nameB = b.toLowerCase();

      if (this.sortBy === 'count') {
        if (countA !== countB) {
          return (countA - countB) * order;
        }
        return nameA.localeCompare(nameB);
      } else {
        return nameA.localeCompare(nameB) * order;
      }
    });
  }

  /**
   * 绑定标签组右键菜单事件
   * @param container - 容器元素
   */
  private bindGroupContextMenu(container: HTMLElement): void {
    // 获取所有标签组卡片（排除特殊标签卡片和未分组卡片）
    const groupCards = container.querySelectorAll('.tag-group-card[data-group-id]:not(.special-tag-card):not(.ungrouped-card)');

    groupCards.forEach(card => {
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const groupId = (card as HTMLElement).dataset.groupId;
        if (!groupId) return;

        // 显示右键菜单
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
   * @param event - 事件对象
   * @param items - 菜单项数组
   */
  private showContextMenu(event: Event, items: Array<{ label: string; action: () => void }>): void {
    // 移除已有的右键菜单
    const existingMenu = document.getElementById('dynamicContextMenu');
    if (existingMenu) {
      existingMenu.remove();
    }

    // 创建右键菜单
    const menu = document.createElement('div');
    menu.id = 'dynamicContextMenu';
    menu.className = 'context-menu';

    // 生成菜单项
    menu.innerHTML = items.map((item, index) =>
      `<div class="context-menu-item" data-index="${index}">${item.label}</div>`
    ).join('');

    // 设置菜单位置
    menu.style.position = 'fixed';
    menu.style.left = (event as MouseEvent).clientX + 'px';
    menu.style.top = (event as MouseEvent).clientY + 'px';
    menu.style.zIndex = '10000';

    document.body.appendChild(menu);

    // 绑定菜单项点击事件
    menu.querySelectorAll('.context-menu-item').forEach((menuItem, index) => {
      menuItem.addEventListener('click', () => {
        items[index].action();
        menu.remove();
      });
    });

    // 点击其他地方关闭菜单
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
   * @param container - 容器元素
   */
  private bindDragEvents(container: HTMLElement): void {
    const allTagItems = container.querySelectorAll('.tag-manager-item[draggable="true"]');
    const dropTargets = container.querySelectorAll('.tag-group-card[data-drop-target="true"]');

    allTagItems.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        const dragEvent = e as DragEvent;
        dragEvent.dataTransfer?.setData('text/plain', (item as HTMLElement).dataset.tag || '');
        dragEvent.dataTransfer && (dragEvent.dataTransfer.effectAllowed = 'move');
        item.classList.add('dragging');
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
   * @param oldTag - 旧标签名
   */
  private async startRenameTag(oldTag: string): Promise<void> {
    const groups = await this.service.getTagGroups();
    const allTags = await this.service.getTags();

    // 查找当前标签所在的组
    let currentGroupId: number | null = null;
    for (const group of groups) {
      if (group.tags && group.tags.includes(oldTag)) {
        currentGroupId = group.id;
        break;
      }
    }

    const result = await this.context.showInputDialog('重命名标签', '请输入新标签名:', oldTag, {
      showGroupSelect: true,
      groups: groups,
      defaultGroupId: currentGroupId
    });

    if (!result || !result.value || !result.value.trim()) return;

    const newTag = result.value.trim();
    const selectedGroupId = result.groupId;

    if (newTag === oldTag) return;

    // 检查新标签名是否已存在
    if (allTags.includes(newTag)) {
      // 查找标签当前所属的组
      let currentGroupName = '未分组';
      for (const group of groups) {
        if (group.tags && group.tags.includes(newTag)) {
          currentGroupName = group.name;
          break;
        }
      }

      // 查找目标组名
      let targetGroupName = '未分组';
      if (selectedGroupId) {
        const targetGroup = groups.find((g: any) => String(g.id) === String(selectedGroupId));
        if (targetGroup) {
          targetGroupName = targetGroup.name;
        }
      }

      const confirmed = await DialogService.showConfirmDialogByConfig(
        DialogConfig.TAG_EXISTS,
        { tagName: newTag, currentGroupName, newGroupName: targetGroupName }
      );

      if (!confirmed) return;

      // 删除旧标签，然后将已存在的标签移动到新组
      try {
        await this.service.deleteTag(oldTag);
        await this.service.assignTagToGroup(newTag, selectedGroupId || null);
        this.context.showToast('标签已移动到新组', 'success');
        await this.render();
        await this.refreshPanel();
      } catch (error) {
        window.electronAPI.logError('TagRegistry.ts', 'Failed to move tag to group:', error);
        this.context.showToast('移动标签失败: ' + (error as Error).message, 'error');
      }
      return;
    }

    // 新标签名不存在，正常重命名
    // 只有当用户选择了不同的组时才传递groupId，否则保持原组不变
    const groupIdToAssign = selectedGroupId !== currentGroupId ? selectedGroupId : undefined;
    await this.renameTag(oldTag, newTag, groupIdToAssign);
  }

  /**
   * 重命名标签
   * @param oldTag - 旧标签名
   * @param newTag - 新标签名
   * @param groupId - 目标组ID（可选）
   */
  private async renameTag(oldTag: string, newTag: string, groupId?: number | null): Promise<void> {
    try {
      await this.service.renameTag(oldTag, newTag);
      // 只有明确指定了组时才移动（groupId有值表示用户选择了特定组，null表示用户选择未分组）
      // 如果groupId为undefined，表示用户没有选择改变组，保持原组不变
      if (groupId !== undefined) {
        await this.service.assignTagToGroup(newTag, groupId);
      }
      this.context.showToast('标签已重命名', 'success');
      // 先刷新面板数据（更新提示词/图像中的标签），再渲染标签列表
      await this.refreshPanel();
      await this.render();
    } catch (error) {
      window.electronAPI.logError('TagRegistry.ts', 'Failed to rename tag:', error);
      this.context.showToast('重命名标签失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 删除标签组
   * @param groupId - 标签组ID
   */
  private async deleteGroup(groupId: number): Promise<void> {
    const confirmed = await DialogService.showConfirmDialogByConfig(DialogConfig.DELETE_TAG_GROUP);
    if (!confirmed) return;

    try {
      await this.service.deleteGroup(groupId);
      this.context.showToast('标签组已删除');
      const searchInput = document.getElementById(this.searchInputId) as HTMLInputElement | null;
      await this.render(searchInput ? searchInput.value : '');
    } catch (error) {
      window.electronAPI.logError('TagRegistry.ts', 'Failed to delete tag group:', error);
      this.context.showToast('删除失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 分配标签到组
   * @param tagName - 标签名称
   * @param groupId - 组ID
   */
  private async assignTagToGroup(tagName: string, groupId: number | null): Promise<void> {
    try {
      await this.service.assignTagToGroup(tagName, groupId);
      this.context.showToast('标签组已更新');
      const searchInput = document.getElementById(this.searchInputId) as HTMLInputElement | null;
      await this.render(searchInput ? searchInput.value : '');
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagRegistry.ts', 'Failed to assign tag to group:', error);
      this.context.showToast('更新失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 刷新面板
   */
  private async refreshPanel(): Promise<void> {
    if (this.type === 'prompt') {
      await this.context.promptPanelManager.loadData();
      this.context.promptPanelManager.renderTagFilters();
    } else {
      await this.context.imagePanelManager.loadData();
      this.context.imagePanelManager.renderTagFilters();
    }
  }

  /**
   * 将标签组固定到首位
   * @param groupId - 标签组ID
   */
  private async pinTagGroupToTop(groupId: number): Promise<void> {
    try {
      // 获取所有标签组
      const groups = await this.service.getTagGroups();

      // 按 sortOrder 排序，第一个即为当前首位
      const sortedGroups = groups.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
      const firstSortOrder = sortedGroups[0]?.sortOrder || 0;

      // 将目标组的 sortOrder 设为首位 - 1
      const newSortOrder = firstSortOrder - 1;

      // 更新标签组
      const group = groups.find((g: any) => String(g.id) === String(groupId));
      if (group) {
        await this.service.updateGroup(groupId, {
          name: group.name,
          sortOrder: newSortOrder
        });
        this.context.showToast('标签组已固定到首位', 'success');
        const searchInput = document.getElementById(this.searchInputId) as HTMLInputElement | null;
        await this.render(searchInput ? searchInput.value : '');
        await this.refreshPanel();
      }
    } catch (error) {
      window.electronAPI.logError('TagRegistry.ts', 'Failed to pin tag group to top:', error);
      this.context.showToast('固定失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 在标签管理界面新建标签
   * @param defaultValue - 默认输入值
   * @param defaultGroupId - 默认选中的组ID
   */
  private async addTagInManagerWithDialog(defaultValue: string = '', defaultGroupId: number | null = null): Promise<void> {
    const groups = await this.service.getTagGroups();
    const allTags = await this.service.getTags();

    const result = await this.context.showInputDialog(`新建${this.getTypeLabel()}标签`, '请输入标签名称', defaultValue, {
      showGroupSelect: true,
      groups: groups,
      defaultGroupId: defaultGroupId
    });
    if (!result || !result.value || !result.value.trim()) return;

    const trimmedTag = result.value.trim();

    // 检查是否为特殊标签
    if (Constants.ALL_SPECIAL_TAGS.includes(trimmedTag)) {
      this.context.showToast(`"${trimmedTag}" 是系统保留标签，不能使用`, 'error');
      await this.addTagInManagerWithDialog(trimmedTag, result.groupId);
      return;
    }

    // 检查标签是否已存在
    const existingTag = allTags.includes(trimmedTag);
    if (existingTag) {
      // 查找标签当前所属的组
      let currentGroupName = '未分组';
      for (const group of groups) {
        if (group.tags && group.tags.includes(trimmedTag)) {
          currentGroupName = group.name;
          break;
        }
      }
      const newGroupName = result.groupId
        ? groups.find((g: any) => String(g.id) === String(result.groupId))?.name || '未分组'
        : '未分组';

      const confirmed = await DialogService.showConfirmDialogByConfig(
        DialogConfig.TAG_EXISTS,
        { tagName: trimmedTag, currentGroupName, newGroupName }
      );

      if (!confirmed) {
        await this.addTagInManagerWithDialog(trimmedTag, result.groupId);
        return;
      }

      // 标签已存在，直接移动到目标组
      try {
        await this.service.assignTagToGroup(trimmedTag, result.groupId || null);
        this.context.showToast('标签已移动到新组', 'success');
        await this.render();
        await this.refreshPanel();
      } catch (error) {
        window.electronAPI.logError('TagRegistry.ts', 'Failed to move tag:', error);
        this.context.showToast('移动标签失败: ' + (error as Error).message, 'error');
      }
      return;
    }

    // 标签不存在，创建新标签
    try {
      await this.service.addTag(trimmedTag);
      await this.service.assignTagToGroup(trimmedTag, result.groupId || null);
      this.context.showToast('标签已创建', 'success');
      await this.render();
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagRegistry.ts', 'Failed to create tag:', error);
      this.context.showToast('创建标签失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 选择标签组
   * @param group - 标签组对象
   */
  selectTagGroup(group: any): void {
    this.selectedTagGroup = group;
    this.eventBus?.emit('tagGroupSelected', { group });
    this.render();
  }

  /**
   * 获取选中的标签组
   * @returns 选中的标签组
   */
  getSelectedTagGroup(): any {
    return this.selectedTagGroup;
  }

  // ========== 批量管理功能 ==========

  /**
   * 切换批量管理模式
   */
  toggleBatchMode(): void {
    this.isBatchMode = !this.isBatchMode;
    this.selectedTags.clear();
    this.render();
    this.updateBatchToolbar();
  }

  /**
   * 退出批量管理模式
   */
  exitBatchMode(): void {
    this.isBatchMode = false;
    this.selectedTags.clear();
    this.render();
    this.updateBatchToolbar();
  }

  /**
   * 更新批量管理工具栏
   */
  private updateBatchToolbar(): void {
    const toolbarId = this.type === 'prompt' ? 'promptTagManagerToolbar' : 'imageTagManagerToolbar';
    const toolbar = document.getElementById(toolbarId);
    if (!toolbar) return;

    // 查找或创建批量工具栏容器（放在工具栏下方）
    let batchContainer = toolbar.parentElement?.querySelector('.batch-toolbar-container') as HTMLElement | null;
    if (!batchContainer) {
      batchContainer = document.createElement('div');
      batchContainer.className = 'batch-toolbar-container';
      toolbar.parentElement?.insertBefore(batchContainer, toolbar.nextSibling);
    }

    const batchToolbar = batchContainer.querySelector('.batch-toolbar');
    if (this.isBatchMode) {
      if (!batchToolbar) {
        const batchDiv = document.createElement('div');
        batchDiv.className = 'batch-toolbar';
        batchDiv.innerHTML = `
          <span class="batch-count">已选择 ${this.selectedTags.size} 个标签</span>
          <button class="btn btn-sm btn-danger batch-delete-btn">删除</button>
          <button class="btn btn-sm btn-secondary batch-move-btn">移动到组</button>
          <button class="btn btn-sm btn-text batch-cancel-btn">取消</button>
        `;
        batchContainer.appendChild(batchDiv);

        // 绑定事件
        batchDiv.querySelector('.batch-delete-btn')?.addEventListener('click', () => this.batchDeleteTags());
        batchDiv.querySelector('.batch-move-btn')?.addEventListener('click', () => this.batchMoveToGroup());
        batchDiv.querySelector('.batch-cancel-btn')?.addEventListener('click', () => this.exitBatchMode());
      } else {
        const countSpan = batchToolbar.querySelector('.batch-count');
        if (countSpan) {
          countSpan.textContent = `已选择 ${this.selectedTags.size} 个标签`;
        }
      }
    } else {
      batchContainer.innerHTML = '';
    }
  }

  /**
   * 切换标签选中状态
   * @param tag - 标签名称
   */
  toggleTagSelection(tag: string): void {
    if (this.selectedTags.has(tag)) {
      this.selectedTags.delete(tag);
    } else {
      this.selectedTags.add(tag);
    }
    this.updateBatchToolbar();
  }

  /**
   * 批量删除标签
   */
  private async batchDeleteTags(): Promise<void> {
    if (this.selectedTags.size === 0) {
      this.context.showToast('请先选择要删除的标签', 'warning');
      return;
    }

    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.BATCH_DELETE_TAGS,
      { count: this.selectedTags.size }
    );

    if (!confirmed) return;

    try {
      let successCount = 0;
      for (const tag of this.selectedTags) {
        try {
          await this.service.deleteTag(tag);
          successCount++;
        } catch (error) {
          window.electronAPI.logError('TagRegistry.ts', `Failed to delete tag ${tag}:`, error);
        }
      }

      this.context.showToast(`已删除 ${successCount} 个标签`, 'success');
      this.exitBatchMode();
      await this.render();
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagRegistry.ts', 'Failed to batch delete tags:', error);
      this.context.showToast('批量删除失败', 'error');
    }
  }

  /**
   * 批量移动标签到组
   */
  private async batchMoveToGroup(): Promise<void> {
    if (this.selectedTags.size === 0) {
      this.context.showToast('请先选择要移动的标签', 'warning');
      return;
    }

    const groups = await this.service.getTagGroups();

    const result = await this.context.showInputDialog(
      '批量移动到组',
      `将 ${this.selectedTags.size} 个标签移动到:`,
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
      for (const tag of this.selectedTags) {
        try {
          await this.service.assignTagToGroup(tag, result.groupId || null);
          successCount++;
        } catch (error) {
          window.electronAPI.logError('TagRegistry.ts', `Failed to move tag ${tag}:`, error);
        }
      }

      this.context.showToast(`已移动 ${successCount} 个标签`, 'success');
      this.exitBatchMode();
      await this.render();
      await this.refreshPanel();
    } catch (error) {
      window.electronAPI.logError('TagRegistry.ts', 'Failed to batch move tags:', error);
      this.context.showToast('批量移动失败', 'error');
    }
  }
}

export default TagRegistry;
