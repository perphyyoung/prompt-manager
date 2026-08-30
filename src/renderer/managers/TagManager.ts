import { TagUI } from "./TagUI.ts";
import { ElementId, Constants } from "../constants.ts";
import { DialogService, DialogConfig } from "../services/index.ts";
import { contextStack, IContextStackEntry } from "./ContextStackManager.ts";
import { focusInput, ErrorHandler } from "../renderer_utils/index.ts";
import { immediateDebounce } from "../../utils/debounce.ts";
import {
  TagGroup,
  TagExistsError,
  InvalidTagNameError,
  TagOperationError,
  DataType,
} from "../../lib/tag-groups/index.ts";
import { groupTagsByGroup } from "../../lib/tag-groups/utils.ts";
import { TagService } from "../services/index.ts";
import type { TagManagerDeps } from "../app.types.ts";

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
  sortOrder: "asc" | "desc";
  protected tagService: TagService;
  protected app: TagManagerDeps;
  protected ui: TagUI;
  protected eventBus: any;
  protected selectedTagGroup: any;
  protected containerId: string;
  protected emptyStateId: string;
  protected searchInputId: string;
  protected elements: ITagManagerElements;
  protected groupEditActive: boolean = false;
  protected _eventsBound: boolean = false;
  protected _managerEventsBound: boolean = false;
  protected _groupEditEventsBound: boolean = false;
  protected _isOperationInProgress: boolean = false;
  protected lastSearchTerm: string = "";

  constructor(type: "prompt" | "image", app: TagManagerDeps) {
    this.type = type;
    this.app = app;
    this.tagService = TagService.getInstance();
    this.ui = new TagUI(type);
    // eventBus 通过 app 访问
    this.selectedTagGroup = null;

    // 排序状态
    this.sortBy = localStorage.getItem(`${type}TagSortBy`) || "count";
    this.sortOrder = (localStorage.getItem(`${type}TagSortOrder`) || "desc") as "asc" | "desc";

    // 获取元素配置（由子类提供）
    this.elements = this.getElementsConfig();
    this.containerId = this.elements.containerId;
    this.emptyStateId = this.elements.emptyStateId;
    this.searchInputId = this.elements.searchInputId;

    // 绑定标签管理器事件
    this.bindManagerEvents();

    // 绑定容器内事件（使用事件委托到 document）
    this.bindEvents();

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
    return this.type === "prompt" ? "提示词" : "图像";
  }

  /**
   * 获取数据类型（用于 TagService）
   */
  protected getDataType(): DataType {
    return this.type as DataType;
  }

  /**
   * 获取面板管理器（由子类实现）
   */
  protected abstract getPanelManager(): any;

  /**
   * 渲染标签列表
   * 核心渲染方法，根据搜索词过滤并渲染标签列表
   */
  async renderTagList(searchTerm: string = ""): Promise<void> {
    try {
      this.lastSearchTerm = searchTerm;

      const tags = await this.tagService.getTags(this.getDataType());
      const groups = await this.tagService.getTagGroups(this.getDataType());
      const container = document.getElementById(this.containerId);
      const emptyState = document.getElementById(this.emptyStateId);

      if (!container) {
        return;
      }

      const tagCounts = await this.calculateTagCounts();

      const filteredTags = searchTerm
        ? tags.filter((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
        : tags;

      // 当没有标签但有标签组时，仍然显示标签组
      if (filteredTags.length === 0 && groups.length === 0) {
        container.style.display = "none";
        if (emptyState) {
          emptyState.style.display = "flex";
          const emptyText = emptyState.querySelector("p");
          if (emptyText) {
            emptyText.textContent = searchTerm
              ? "没有找到匹配的标签"
              : `暂无${this.getTypeLabel()}标签`;
          }
        }
        return;
      }

      container.style.display = "grid";
      if (emptyState) emptyState.style.display = "none";

      const sortedTags = this.sortTags(filteredTags, tagCounts);
      const { grouped: groupedTags, ungrouped: ungroupedTags } = groupTagsByGroup(
        sortedTags,
        groups,
      );

      const html = this.ui.renderTagGroupCards(groups, groupedTags, ungroupedTags, tagCounts);
      container.innerHTML = html;

      // 绑定容器特定的拖拽和右键菜单事件
      this.bindContainerEvents(container);
    } catch (error) {
      ErrorHandler.handleError(
        { module: "TagManager.ts", operation: `render ${this.type} tag manager` },
        error,
        { userMessage: `加载${this.getTypeLabel()}标签失败` },
      );
    }
  }

  /**
   * 从搜索输入框渲染标签列表
   * 获取当前搜索框的值并渲染标签列表，保持搜索状态
   */
  async renderTagListFromSearchInput(): Promise<void> {
    const searchInput = document.getElementById(this.searchInputId) as HTMLInputElement | null;
    await this.renderTagList(searchInput ? searchInput.value : "");
  }

  /**
   * 删除标签
   */
  private _isDeletingTag: boolean = false;
  async deleteTag(tag: string): Promise<void> {
    if (this._isDeletingTag) return;
    this._isDeletingTag = true;

    try {
      const confirmed = await DialogService.showConfirmDialogByConfig(DialogConfig.DELETE_TAG, {
        name: tag,
      });
      if (!confirmed) return;

      const result = await this.tagService.removeTags({
        tagNames: [tag],
        type: this.getDataType(),
      });
      this.app.showToast(`${this.getTypeLabel()}标签已删除`);
      await this.refreshAfterTagChange();

      // 显示部分失败的警告
      if (result.errors.length > 0) {
        window.electronAPI.logError("TagManager.ts", "Some tags failed to delete:", result.errors);
        this.app.showToast(`${result.errors.length} 个标签删除失败`, "warning");
      }
    } catch (error) {
      ErrorHandler.handleError({ module: "TagManager.ts", operation: "delete tag" }, error, {
        userMessage: "删除失败",
      });
    } finally {
      this._isDeletingTag = false;
    }
  }

  /**
   * 更新标签
   */
  async updateTag(oldTag: string, newTag: string): Promise<void> {
    try {
      await this.tagService.renameTag({
        type: this.getDataType(),
        oldName: oldTag,
        newName: newTag,
      });
      this.app.showToast("标签已更新", "success");
      await this.refreshAfterTagChange();
    } catch (error) {
      window.electronAPI.logError("TagManager.ts", "Failed to update tag:", error);

      // 根据错误类型显示不同的提示
      if (error instanceof TagExistsError) {
        this.app.showToast(`标签 "${newTag}" 已存在，请选择其他名称`, "warning");
      } else if (error instanceof InvalidTagNameError) {
        this.app.showToast("标签名无效: " + (error as Error).message, "warning");
      } else if (error instanceof TagOperationError) {
        this.app.showToast("操作失败: " + (error as Error).message, "error");
      } else {
        this.app.showToast("更新标签失败: " + (error as Error).message, "error");
      }
    }
  }

  /**
   * 获取所有标签
   */
  async getTags(): Promise<string[]> {
    return await this.tagService.getTags(this.getDataType());
  }

  /**
   * 绑定事件（使用事件委托到 document）
   * 只在初始化时调用一次，不在 render 中重复绑定
   */
  bindEvents(): void {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // 使用事件委托处理所有点击事件
    document.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;

      // 检查点击是否在标签管理器容器内
      const container = document.getElementById(this.elements.containerId);
      if (!container?.contains(target)) return;

      // 处理编辑按钮点击
      const editBtn = target.closest(".tag-edit-btn");
      if (editBtn && !this._isOperationInProgress) {
        e.stopPropagation();
        this._isOperationInProgress = true;
        const tag = (editBtn as HTMLElement).dataset.tag;
        if (tag) await this.startRenameTag(tag);
        this._isOperationInProgress = false;
        return;
      }

      // 处理删除按钮点击
      const deleteBtn = target.closest(".tag-delete-btn");
      if (deleteBtn && !this._isOperationInProgress) {
        e.stopPropagation();
        const tag = (deleteBtn as HTMLElement).dataset.tag;
        if (tag) {
          this._isOperationInProgress = true;
          await this.deleteTag(tag);
          this._isOperationInProgress = false;
        }
        return;
      }

      // 处理标签组编辑按钮
      const groupEditBtn = target.closest(".tag-group-btn.edit");
      if (groupEditBtn && !this._isOperationInProgress) {
        e.stopPropagation();
        this._isOperationInProgress = true;
        const datasetId = (groupEditBtn as HTMLElement).dataset.id;
        const groupId = parseInt(datasetId || "0");
        this.openGroupEdit(groupId);
        this._isOperationInProgress = false;
        return;
      }

      // 处理标签组删除按钮
      const groupDeleteBtn = target.closest(".tag-group-btn.delete");
      if (groupDeleteBtn && !this._isOperationInProgress) {
        e.stopPropagation();
        this._isOperationInProgress = true;
        const groupId = parseInt((groupDeleteBtn as HTMLElement).dataset.id || "0");
        await this.deleteGroup(groupId);
        this._isOperationInProgress = false;
        return;
      }
    });
  }

  /**
   * 绑定拖拽和右键菜单事件（需要在 render 后调用）
   */
  bindContainerEvents(container: HTMLElement): void {
    this.bindDragEvents(container);
    this.bindGroupContextMenu(container);
  }

  /**
   * 在管理器中添加标签
   */
  async addTagInManager(): Promise<void> {
    await this.addTagInManagerWithDialog();
  }

  /**
   * 获取标签使用计数
   * 数据库全量统计(此前基于面板已加载条目,分页/搜索/安全模式导致计数偏小)
   */
  private async calculateTagCounts(): Promise<Record<string, number>> {
    return this.tagService.getTagCounts(this.getDataType());
  }

  /**
   * 排序标签
   */
  private sortTags(tags: string[], tagCounts: Record<string, number>): string[] {
    const order = this.sortOrder === "asc" ? 1 : -1;

    return [...tags].sort((a, b) => {
      if (this.sortBy === "count") {
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
    const groupCards = container.querySelectorAll(
      ".tag-group-card[data-group-id]:not(.ungrouped-card)",
    );

    groupCards.forEach((card) => {
      card.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const groupId = (card as HTMLElement).dataset.groupId;
        if (!groupId) return;

        this.showContextMenu(e, [
          {
            label: "固定到首位",
            action: () => this.pinTagGroupToTop(parseInt(groupId)),
          },
        ]);
      });
    });
  }

  /**
   * 显示右键菜单
   */
  private showContextMenu(event: Event, items: Array<{ label: string; action: () => void }>): void {
    const existingMenu = document.getElementById(Constants.Ids.DYNAMIC_CONTEXT_MENU);
    if (existingMenu) {
      existingMenu.remove();
    }

    const menu = document.createElement("div");
    menu.id = Constants.Ids.DYNAMIC_CONTEXT_MENU;
    menu.className = "context-menu";
    menu.innerHTML = items
      .map(
        (item, index) => `<div class="context-menu-item" data-index="${index}">${item.label}</div>`,
      )
      .join("");

    menu.style.position = "fixed";
    menu.style.left = (event as MouseEvent).clientX + "px";
    menu.style.top = (event as MouseEvent).clientY + "px";
    menu.style.zIndex = "10000";

    document.body.appendChild(menu);

    menu.querySelectorAll(".context-menu-item").forEach((menuItem, index) => {
      menuItem.addEventListener("click", () => {
        items[index].action();
        menu.remove();
      });
    });

    const closeMenu = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", closeMenu);
    }, 0);
  }

  /**
   * 绑定拖拽事件
   */
  private bindDragEvents(container: HTMLElement): void {
    const dragItems = container.querySelectorAll('.tag-manager-item[draggable="true"]');
    const dropTargets = container.querySelectorAll('.tag-group-card[data-drop-target="true"]');

    dragItems.forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        const mouseEvent = e as MouseEvent;
        if (mouseEvent.button !== 0) return;

        const target = e.target as HTMLElement;
        if (target.closest(".tag-edit-btn") || target.closest(".tag-delete-btn")) {
          return;
        }

        item.classList.add("dragging");
      });

      item.addEventListener("dragstart", (e) => {
        const tagName = (item as HTMLElement).dataset.tag || "";

        const dragEvent = e as DragEvent;
        dragEvent.dataTransfer?.setData("text/plain", tagName);
        if (dragEvent.dataTransfer) {
          dragEvent.dataTransfer.effectAllowed = "move";
        }
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        dropTargets.forEach((target) => target.classList.remove("drag-over"));
      });
    });

    dropTargets.forEach((target) => {
      target.addEventListener("dragover", (e) => {
        e.preventDefault();
        const dragEvent = e as DragEvent;
        if (dragEvent.dataTransfer) {
          dragEvent.dataTransfer.dropEffect = "move";
        }
        target.classList.add("drag-over");
      });

      target.addEventListener("dragleave", () => {
        target.classList.remove("drag-over");
      });

      target.addEventListener("drop", async (e) => {
        e.preventDefault();
        target.classList.remove("drag-over");
        const dragEvent = e as DragEvent;
        const tagName = dragEvent.dataTransfer?.getData("text/plain");
        const groupId = (target as HTMLElement).dataset.groupId
          ? parseInt((target as HTMLElement).dataset.groupId || "0")
          : null;

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
    if (!this._safeRenameTag) {
      this._safeRenameTag = immediateDebounce(async (tag: string) => {
        await this._doRenameTag(tag);
      }, 300);
    }
    this._safeRenameTag(oldTag);
  }

  private _safeRenameTag: ((tag: string) => void) | null = null;

  private async _doRenameTag(oldTag: string): Promise<void> {
    await this._doRenameTagWithValues(oldTag, oldTag, null);
  }

  private async _doRenameTagWithValues(
    oldTag: string,
    defaultTagValue: string,
    defaultGroupIdValue: number | null,
  ): Promise<void> {
    const groups = await this.tagService.getTagGroups(this.getDataType());
    const allTags = await this.tagService.getTags(this.getDataType());

    let currentGroupId: number | null = null;
    for (const group of groups) {
      if (group.tags && group.tags.includes(oldTag)) {
        currentGroupId = group.id;
        break;
      }
    }

    // 使用传入的默认值，如果没有则使用原始值
    const initialTagValue = defaultTagValue !== oldTag ? defaultTagValue : oldTag;
    const initialGroupId = defaultGroupIdValue !== null ? defaultGroupIdValue : currentGroupId;

    const result = await DialogService.showInputDialog({
      title: "重命名标签",
      placeholder: Constants.PLACEHOLDER_TAG_RENAME,
      defaultValue: initialTagValue,
      showGroupSelect: true,
      groups: groups,
      defaultGroupId: initialGroupId,
    });

    if (!result || !result.value || !result.value.trim()) return;

    const newTag = result.value.trim();
    // groupId: null 表示用户选择"未分组"，undefined 表示对话框未显示分组选择
    // 当对话框未显示分组选择时，默认为未分组（null），与拖拽到未分组卡片的行为一致
    const selectedGroupId = result.groupId ?? null;

    // 检查标签名是否改变
    const isTagNameChanged = newTag !== oldTag;
    // 检查标签组是否改变
    const isGroupChanged = selectedGroupId !== currentGroupId;

    // 如果标签名和标签组都没有改变，直接返回
    if (!isTagNameChanged && !isGroupChanged) return;

    // 如果标签名改变，检查是否已存在
    if (isTagNameChanged && allTags.includes(newTag)) {
      this.app.showToast("标签名已存在，请使用其他名称", "error");
      // 重新打开对话框，保留用户输入
      await this._doRenameTagWithValues(oldTag, newTag, selectedGroupId);
      return;
    }

    // 场景 A: 只改标签名
    if (isTagNameChanged && !isGroupChanged) {
      await this.renameTag(oldTag, newTag);
      return;
    }

    // 场景 B: 只改标签组（与拖拽逻辑一致）
    if (!isTagNameChanged && isGroupChanged) {
      await this.assignTagToGroup(oldTag, selectedGroupId);
      return;
    }

    // 场景 C: 同时改标签名和标签组
    if (isTagNameChanged && isGroupChanged) {
      await this.renameTag(oldTag, newTag);
      await this.assignTagToGroup(newTag, selectedGroupId);
    }
  }

  /**
   * 重命名标签
   */
  private async renameTag(oldTag: string, newTag: string): Promise<void> {
    try {
      await this.tagService.renameTag({
        type: this.getDataType(),
        oldName: oldTag,
        newName: newTag,
      });
      this.app.showToast("标签已重命名", "success");
      await this.refreshAfterTagChange();
    } catch (error) {
      window.electronAPI.logError("TagManager.ts", "Failed to rename tag:", error);

      // 根据错误类型显示不同的提示
      if (error instanceof TagExistsError) {
        this.app.showToast(`标签 "${newTag}" 已存在，请选择其他名称`, "warning");
      } else if (error instanceof InvalidTagNameError) {
        this.app.showToast("标签名无效: " + (error as Error).message, "warning");
      } else if (error instanceof TagOperationError) {
        this.app.showToast("操作失败: " + (error as Error).message, "error");
      } else {
        this.app.showToast("重命名标签失败: " + (error as Error).message, "error");
      }
    }
  }

  /**
   * 删除标签组
   */
  private async deleteGroup(groupId: number): Promise<void> {
    const confirmed = await DialogService.showConfirmDialogByConfig(DialogConfig.DELETE_TAG_GROUP);
    if (!confirmed) return;

    try {
      await this.tagService.deleteTagGroup({ type: this.getDataType(), id: groupId });
      this.app.showToast("标签组已删除");
      await this.renderTagListFromSearchInput();
    } catch (error) {
      ErrorHandler.handleError({ module: "TagManager.ts", operation: "delete tag group" }, error, {
        userMessage: "删除失败",
      });
    }
  }

  /**
   * 分配标签到组
   */
  private async assignTagToGroup(tagName: string, groupId: number | null): Promise<void> {
    try {
      await this.tagService.assignTagToGroup({ type: this.getDataType(), tagName, groupId });
      this.app.showToast("标签组已更新");
      await this.refreshAfterTagChange();
    } catch (error) {
      ErrorHandler.handleError(
        { module: "TagManager.ts", operation: "assign tag to group" },
        error,
        { userMessage: "更新失败" },
      );
    }
  }

  /**
   * 同步面板与标签变更
   * 当标签发生变更时，同步更新外部面板的数据和标签筛选器
   */
  private async syncPanelWithTagChanges(): Promise<void> {
    const panelManager = this.getPanelManager();
    if (panelManager) {
      await panelManager.loadData();
      await panelManager.renderTagFilters();
    }
  }

  /**
   * 标签变更后的统一刷新入口
   * 保持搜索状态并同步外部面板
   */
  private async refreshAfterTagChange(): Promise<void> {
    await this.renderTagListFromSearchInput();
    await this.syncPanelWithTagChanges();
  }

  /**
   * 将标签组固定到首位
   */
  private async pinTagGroupToTop(groupId: number): Promise<void> {
    try {
      const groups = await this.tagService.getTagGroups(this.getDataType());
      const sortedGroups = groups.sort(
        (a: TagGroup, b: TagGroup) => (a.sortOrder || 0) - (b.sortOrder || 0),
      );
      const firstSortOrder = sortedGroups[0]?.sortOrder || 0;
      const newSortOrder = firstSortOrder - 1;

      const group = groups.find((g: TagGroup) => String(g.id) === String(groupId));
      if (group) {
        await this.tagService.updateTagGroup({
          type: this.getDataType(),
          id: groupId,
          attrs: {
            name: group.name,
            sortOrder: newSortOrder,
          },
        });
        this.app.showToast("标签组已固定到首位", "success");
        await this.refreshAfterTagChange();
      }
    } catch (error) {
      ErrorHandler.handleError(
        { module: "TagManager.ts", operation: "pin tag group to top" },
        error,
        { userMessage: "固定失败" },
      );
    }
  }

  /**
   * 在标签管理界面新建标签
   */
  private async addTagInManagerWithDialog(
    defaultValue: string = "",
    defaultGroupId: number | null = null,
  ): Promise<void> {
    const groups = await this.tagService.getTagGroups(this.getDataType());

    const result = await DialogService.showInputDialog({
      title: `新建${this.getTypeLabel()}标签`,
      placeholder: Constants.PLACEHOLDER_TAG_INPUT,
      defaultValue: defaultValue,
      showGroupSelect: true,
      groups: groups,
      defaultGroupId: defaultGroupId,
    });
    if (!result?.value?.trim()) {
      return;
    }
    const creationResult = await this.tagService.createTag({
      tagName: result.value,
      type: this.getDataType(),
      defaultGroupId: result.groupId ?? null,
    });

    if (creationResult.created.length > 0) {
      this.app.showToast(`已创建标签 "${creationResult.created[0]}"`, "success");
    }

    if (creationResult.skipped.length > 0) {
      this.app.showToast(`标签 "${creationResult.skipped[0]}" 已存在`, "warning");
      // 已存在时重新打开对话框保留输入
      await this.addTagInManagerWithDialog(creationResult.skipped[0], result.groupId);
      return;
    }

    if (creationResult.errors.length > 0) {
      const error = creationResult.errors[0];
      this.app.showToast(error.error, "error");
      // 失败时重新打开对话框保留输入
      await this.addTagInManagerWithDialog(error.tag, result.groupId);
      return;
    }

    // 强制刷新标签列表（清除缓存后重新获取）
    await this.renderTagList();
    await this.syncPanelWithTagChanges();
  }

  /**
   * 选择标签组
   */
  selectTagGroup(group: any): void {
    this.selectedTagGroup = group;
    this.renderTagList();
  }

  /**
   * 获取选中的标签组
   */
  getSelectedTagGroup(): any {
    return this.selectedTagGroup;
  }

  // ========== 标签管理器模态框控制 ==========

  /**
   * 打开标签管理器模态框
   */
  openManager(): void {
    const modal = document.getElementById(this.elements.modalId);
    if (modal) {
      modal.classList.add("active");
      (modal as any).close = () => this.closeManager();

      // 清空搜索框并重置搜索状态
      const searchInput = document.getElementById(this.searchInputId) as HTMLInputElement | null;
      if (searchInput) {
        searchInput.value = "";
      }
      const clearBtn = document.getElementById(this.elements.clearSearchBtnId);
      if (clearBtn) {
        clearBtn.style.display = "none";
      }
      this.lastSearchTerm = "";

      // 渲染完整标签列表
      this.renderTagList("");

      // 压栈：进入标签管理器上下文（用于 ESC 关闭）
      const stackEntry: IContextStackEntry = {
        id: this.elements.modalId,
        state: { isBatchToolbarVisible: false },
        close: () => {},
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
      modal.classList.remove("active");
    }
    contextStack.pop(this.elements.modalId as ElementId);

    // 关闭管理器后刷新面板标签筛选器
    this.syncPanelWithTagChanges();
  }

  /**
   * 检查标签管理器模态框是否处于活动状态
   */
  isManagerActive(): boolean {
    const modal = document.getElementById(this.elements.modalId);
    return modal?.classList.contains("active") ?? false;
  }

  // ========== 标签组编辑模态框控制 ==========

  /**
   * 打开标签组编辑模态框
   */
  async openGroupEdit(groupId: number | null = null): Promise<void> {
    const modal = document.getElementById(this.elements.groupEditModalId);
    if (!modal) return;

    const nameInput = document.getElementById(
      this.elements.groupEditNameInputId,
    ) as HTMLInputElement | null;
    const sortOrderInput = document.getElementById(
      this.elements.groupEditSortOrderInputId,
    ) as HTMLInputElement | null;

    if (nameInput) {
      nameInput.value = "";
      focusInput(nameInput);
    }
    if (sortOrderInput) sortOrderInput.value = "0";

    if (groupId) {
      const groups = await this.tagService.getTagGroups(this.getDataType());
      const group = groups.find((g: TagGroup) => String(g.id) === String(groupId));
      if (group && nameInput && sortOrderInput) {
        nameInput.value = group.name || "";
        sortOrderInput.value = String(group.sortOrder || "0");
      }
    }

    (modal as any).dataset.groupId = groupId ? String(groupId) : "";
    modal.classList.add("active");
    this.groupEditActive = true;
  }

  /**
   * 关闭标签组编辑模态框
   */
  closeGroupEdit(): void {
    const modal = document.getElementById(this.elements.groupEditModalId);
    if (modal) {
      modal.classList.remove("active");
    }
    this.groupEditActive = false;
  }

  /**
   * 保存标签组
   */
  async saveGroupEdit(): Promise<void> {
    const modal = document.getElementById(this.elements.groupEditModalId);
    const nameInput = document.getElementById(
      this.elements.groupEditNameInputId,
    ) as HTMLInputElement | null;
    const sortOrderInput = document.getElementById(
      this.elements.groupEditSortOrderInputId,
    ) as HTMLInputElement | null;

    const groupIdStr = modal?.dataset.groupId;
    const name = nameInput?.value.trim() || "";
    const sortOrder = parseInt(sortOrderInput?.value || "0", 10);

    if (!name) {
      this.app.showToast("请输入标签组名称", "error");
      return;
    }

    // 前端检查：标签组名称是否已存在
    const groups = await this.tagService.getTagGroups(this.getDataType());
    const existingGroup = groups.find((g: TagGroup) => g.name === name);
    if (existingGroup) {
      // 如果是编辑模式，且找到的是当前正在编辑的组，则允许保存
      const isEditingCurrentGroup = groupIdStr && String(existingGroup.id) === groupIdStr;
      if (!isEditingCurrentGroup) {
        this.app.showToast("该标签组名称已存在，请使用其他名称", "error");
        // 不关闭对话框，让用户修改
        return;
      }
    }

    try {
      if (groupIdStr) {
        const groupId = parseInt(groupIdStr, 10);
        await this.tagService.updateTagGroup({
          type: this.getDataType(),
          id: groupId,
          attrs: { name, sortOrder },
        });
      } else {
        await this.tagService.createTagGroup({ type: this.getDataType(), name, sortOrder });
      }
      await this.renderTagListFromSearchInput();

      this.closeGroupEdit();
      this.app.showToast(groupIdStr ? "标签组已更新" : "标签组已创建", "success");
    } catch (error) {
      ErrorHandler.handleError({ module: "TagManager.ts", operation: "save tag group" }, error, {
        userMessage: "保存失败，请稍后重试",
      });
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
    if (this._groupEditEventsBound) return;
    this._groupEditEventsBound = true;

    document
      .getElementById(this.elements.groupEditCloseBtnId)
      ?.addEventListener("click", () => this.closeGroupEdit());
    document
      .getElementById(this.elements.groupEditCancelBtnId)
      ?.addEventListener("click", () => this.closeGroupEdit());
    document
      .getElementById(this.elements.groupEditSaveBtnId)
      ?.addEventListener("click", () => this.saveGroupEdit());
  }

  /**
   * 绑定标签管理器事件
   */
  private bindManagerEvents(): void {
    if (this._managerEventsBound) return;
    this._managerEventsBound = true;

    document
      .getElementById(this.elements.closeButtonId)
      ?.addEventListener("click", () => this.closeManager());
    document
      .getElementById(this.elements.addTagGroupBtnId)
      ?.addEventListener("click", () => this.openGroupEdit());
    document
      .getElementById(this.elements.addTagInManagerBtnId)
      ?.addEventListener("click", () => this.addTagInManager());

    const searchInput = document.getElementById(
      this.elements.searchInputId,
    ) as HTMLInputElement | null;
    const clearBtn = document.getElementById(this.elements.clearSearchBtnId);
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const target = e.target as HTMLInputElement;
        this.renderTagList(target.value);
        if (clearBtn) clearBtn.style.display = target.value ? "flex" : "none";
      });
    }
    if (clearBtn && searchInput) {
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        this.renderTagList("");
        clearBtn.style.display = "none";
        searchInput.focus();
      });
    }

    const sortSelect = document.getElementById(
      this.elements.sortSelectId,
    ) as HTMLSelectElement | null;
    const orderBtn = document.getElementById(this.elements.orderBtnId);
    if (sortSelect) {
      sortSelect.value = `${this.sortBy}-${this.sortOrder}`;
      sortSelect.addEventListener("change", (e) => {
        const target = e.target as HTMLSelectElement;
        const [sortBy, sortOrder] = target.value.split("-");
        this.sortBy = sortBy;
        this.sortOrder = sortOrder as "asc" | "desc";
        localStorage.setItem(`${this.type}TagSortBy`, sortBy);
        localStorage.setItem(`${this.type}TagSortOrder`, sortOrder);
        this.renderTagList(searchInput?.value || "");
      });
    }
    if (orderBtn && sortSelect) {
      orderBtn.addEventListener("click", () => {
        const newOrder = this.sortOrder === "asc" ? "desc" : "asc";
        this.sortOrder = newOrder;
        localStorage.setItem(`${this.type}TagSortOrder`, newOrder);
        sortSelect.value = `${this.sortBy}-${newOrder}`;
        this.renderTagList(searchInput?.value || "");
      });
    }
  }
}
