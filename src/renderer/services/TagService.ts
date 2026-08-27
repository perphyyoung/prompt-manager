/**
 * TagService - 标签业务服务层
 * 统一处理标签相关的业务逻辑，包括数据操作、缓存同步、副作用处理
 */

import {
  DataType,
  TagName,
  TagOperationResult,
  TagDeleteResult,
  TagCreateOptions,
  createTags,
  deleteTags,
  getTags,
  getTagGroups,
  linkTags,
  parseTagInput,
  TagGroup,
  PyTagGroups,
} from "../../pyTagGroups/index.ts";
import { createDataAccess } from "../../pyTagGroups/dataAccess.ts";
import { Events } from "../../constants.ts";

// ========== 选项类型 ==========

export interface CreateTagsOptions {
  tagNames: string | string[];
  type: DataType;
  defaultGroupId?: number | null;
}

export interface LinkTagsOptions {
  tagNames: string | string[];
  type: DataType;
  itemId?: string;
  itemIds?: string[];
}

export interface RemoveTagsOptions {
  tagNames: string | string[];
  type: DataType;
}

export interface UnlinkTagOptions {
  type: DataType;
  itemId: string;
  tagName: string;
}

export interface LinkTagsResult extends TagOperationResult {
  linkedToItem: boolean;
  linkedItemCount: number;
}

export interface RenameTagOptions {
  type: DataType;
  oldName: string;
  newName: string;
}

export interface CreateTagGroupOptions {
  type: DataType;
  name: string;
  sortOrder?: number;
}

export interface UpdateTagGroupOptions {
  type: DataType;
  id: number;
  attrs: Partial<TagGroup>;
}

export interface DeleteTagGroupOptions {
  type: DataType;
  id: number;
}

export interface AssignTagToGroupOptions {
  type: DataType;
  tagName: string;
  groupId: number | null;
}

// ========== TagService 类 ==========

export class TagService {
  private static instance: TagService | null = null;
  private eventBus: { emit: (event: string) => void } | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): TagService {
    if (!TagService.instance) {
      TagService.instance = new TagService();
    }
    return TagService.instance;
  }

  /**
   * 设置事件总线
   */
  setEventBus(eventBus: { emit: (event: string) => void }): void {
    this.eventBus = eventBus;
  }

  /**
   * 创建标签
   * @param options - 创建选项
   * @returns 操作结果
   */
  async createTags(options: CreateTagsOptions): Promise<TagOperationResult> {
    const { tagNames, type, defaultGroupId } = options;
    const names = this.parseAndNormalizeTagNames(tagNames);

    if (names.length === 0) {
      return {
        success: true,
        created: [],
        skipped: [],
        errors: [],
      };
    }

    const createOptions: TagCreateOptions = {};
    if (defaultGroupId !== undefined) {
      createOptions.defaultGroupId = defaultGroupId;
    }

    const result = await createTags(type, names, createOptions);

    // 触发事件通知
    if (result.created.length > 0 || result.errors.length > 0) {
      this.emitItemsChanged(type);
    }

    return result;
  }

  /**
   * 删除标签
   * @param options - 删除选项
   * @returns 删除结果
   */
  async removeTags(options: RemoveTagsOptions): Promise<TagDeleteResult> {
    const { tagNames, type } = options;
    const names = this.parseAndNormalizeTagNames(tagNames);

    if (names.length === 0) {
      return { deleted: 0, errors: [] };
    }

    const result = await deleteTags(type, names);

    // 触发事件通知
    if (result.deleted > 0) {
      this.emitItemsChanged(type);
    }

    return result;
  }

  /**
   * 关联标签到项目
   * @param options - 关联选项
   * @returns 操作结果
   */
  async linkTagsToItem(options: LinkTagsOptions): Promise<LinkTagsResult> {
    const { tagNames, type, itemId, itemIds } = options;

    // 1. 解析并标准化标签名
    const names = this.parseAndNormalizeTagNames(tagNames);
    if (names.length === 0) {
      return {
        success: true,
        created: [],
        skipped: [],
        errors: [],
        linkedToItem: false,
        linkedItemCount: 0,
      };
    }

    // 2. 合并项目ID
    const targetIds: string[] = [];
    if (itemId) targetIds.push(itemId);
    if (itemIds) targetIds.push(...itemIds);
    const uniqueIds = [...new Set(targetIds)];

    // 3. 调用 linkTags 创建标签并关联（内部已处理 updated_at）
    const linkResult = await linkTags({
      tagNames: names,
      type,
      itemIds: uniqueIds.length > 0 ? uniqueIds : undefined,
    });

    // 4. 触发事件和缓存更新
    if (linkResult.success) {
      this.emitItemsChanged(type);
    }

    return {
      ...linkResult,
      linkedToItem: uniqueIds.length > 0,
      linkedItemCount: uniqueIds.length,
    };
  }

  /**
   * 批量关联标签（多选用）
   * @param options - 关联选项
   * @returns 操作结果
   */
  async batchLinkTags(options: LinkTagsOptions): Promise<LinkTagsResult> {
    // 批量关联与单个关联逻辑相同
    return this.linkTagsToItem(options);
  }

  /**
   * 从项目移除标签
   * @param options - 移除选项
   * @returns 是否成功
   */
  async unlinkTagFromItem(options: UnlinkTagOptions): Promise<boolean> {
    const { type, itemId, tagName } = options;

    try {
      // 使用 dataAccess 解除标签关联（不是删除标签）
      // 注意：removeTagFromItem 内部会更新 updated_at
      const dataAccess = createDataAccess(type);
      await dataAccess.removeTagFromItem(itemId, tagName);

      // 触发事件
      this.emitItemsChanged(type);

      return true;
    } catch (error) {
      window.electronAPI.logError("TagService", "Failed to unlink tag from item:", error);
      return false;
    }
  }

  /**
   * 获取所有标签
   * @param type - 数据类型
   * @returns 标签列表
   */
  async getTags(type: DataType): Promise<TagName[]> {
    return getTags(type);
  }

  /**
   * 获取所有标签组
   * @param type - 数据类型
   * @returns 标签组列表
   */
  async getTagGroups(type: DataType): Promise<TagGroup[]> {
    return getTagGroups(type);
  }

  /**
   * 解析标签输入（支持多种分隔符）
   * @param input - 输入字符串
   * @returns 标签名数组
   */
  parseTagInput(input: string): string[] {
    return parseTagInput(input);
  }

  /**
   * 重命名标签
   * @param options - 重命名选项
   */
  async renameTag(options: RenameTagOptions): Promise<void> {
    const { type, oldName, newName } = options;
    const pyTagGroups = PyTagGroups.getInstance(type);
    await pyTagGroups.rename(oldName, newName);
  }

  /**
   * 检查标签是否存在
   * @param type - 数据类型
   * @param tagName - 标签名称
   * @returns 是否存在
   */
  async tagExists(type: DataType, tagName: string): Promise<boolean> {
    const pyTagGroups = PyTagGroups.getInstance(type);
    return pyTagGroups.exists(tagName);
  }

  // ========== 标签组操作 ==========

  /**
   * 创建标签组
   * @param options - 创建选项
   * @returns 创建的标签组
   */
  async createTagGroup(options: CreateTagGroupOptions): Promise<TagGroup> {
    const { type, name, sortOrder } = options;
    const pyTagGroups = PyTagGroups.getInstance(type);
    return pyTagGroups.createGroup(name, sortOrder);
  }

  /**
   * 更新标签组
   * @param options - 更新选项
   */
  async updateTagGroup(options: UpdateTagGroupOptions): Promise<void> {
    const { type, id, attrs } = options;
    const pyTagGroups = PyTagGroups.getInstance(type);
    await pyTagGroups.updateGroup(id, attrs);
  }

  /**
   * 删除标签组
   * @param options - 删除选项
   */
  async deleteTagGroup(options: DeleteTagGroupOptions): Promise<void> {
    const { type, id } = options;
    const pyTagGroups = PyTagGroups.getInstance(type);
    await pyTagGroups.deleteGroup(id);
  }

  /**
   * 分配标签到组
   * @param options - 分配选项
   */
  async assignTagToGroup(options: AssignTagToGroupOptions): Promise<void> {
    const { type, tagName, groupId } = options;
    const pyTagGroups = PyTagGroups.getInstance(type);
    await pyTagGroups.assignToGroup(tagName, groupId);
  }

  /**
   * 获取组内标签
   * @param type - 数据类型
   * @param groupId - 组ID
   * @returns 标签列表
   */
  async getTagsByGroup(type: DataType, groupId: number): Promise<TagName[]> {
    const pyTagGroups = PyTagGroups.getInstance(type);
    return pyTagGroups.getTagsByGroup(groupId);
  }

  /**
   * 搜索标签（前缀匹配，用于自动完成）
   * @param type - 数据类型
   * @param prefix - 搜索前缀
   * @param exclude - 要排除的标签
   * @returns 匹配的标签列表
   */
  async searchTags(type: DataType, prefix: string, exclude?: TagName[]): Promise<TagName[]> {
    const pyTagGroups = PyTagGroups.getInstance(type);
    return pyTagGroups.search(prefix, exclude);
  }

  // ========== 静态工具方法 ==========

  /**
   * 计算项目中标签的出现次数
   * @param items - 项目列表（包含 tags 属性）
   * @returns 标签计数映射
   */
  static countTagsInItems(items: Array<{ tags?: string[] }>): Record<string, number> {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      item.tags?.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return counts;
  }

  /**
   * 计算标签在项目中的使用次数
   * @param tags - 标签列表
   * @param items - 项目列表
   * @returns 标签使用次数映射
   */
  static countTagUsage(tags: string[], items: Array<{ tags?: string[] }>): Record<string, number> {
    return tags.reduce(
      (counts, tag) => {
        counts[tag] = items.filter((item) => item.tags?.includes(tag)).length;
        return counts;
      },
      {} as Record<string, number>,
    );
  }

  // ========== 私有方法 ==========

  /**
   * 解析并标准化标签输入
   * 支持字符串（自动解析）或数组输入
   * @param tagNames - 标签输入（字符串或数组）
   * @returns 标准化后的标签名数组
   */
  private parseAndNormalizeTagNames(tagNames: string | string[]): string[] {
    // 1. 如果是字符串，使用 parseTagInput 解析
    const names = typeof tagNames === "string" ? parseTagInput(tagNames) : tagNames;

    // 2. 标准化处理
    return names.map((n) => n.trim()).filter((n) => n.length > 0);
  }

  /**
   * 触发项目变更事件
   */
  private emitItemsChanged(type: DataType): void {
    if (!this.eventBus) return;

    if (type === "prompt") {
      this.eventBus.emit(Events.PROMPTS_CHANGED);
    } else {
      this.eventBus.emit(Events.IMAGES_CHANGED);
    }
  }
}

// 导出单例实例
export const tagService = TagService.getInstance();
