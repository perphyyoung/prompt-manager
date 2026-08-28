/**
 * TagService - 标签业务服务层
 * 统一处理标签相关的业务逻辑，包括数据操作、缓存同步、副作用处理
 */

import {
  DataType,
  TagName,
  TagError,
  TagOperationResult,
  TagDeleteResult,
  TagCreateOptions,
  createTag as createTagOperation,
  deleteTags,
  getTags as getTagsOperation,
  getTagGroups as getTagGroupsOperation,
  parseTagInput,
  TagGroup,
  PyTagGroups,
} from "../../lib/tag-groups/index.ts";
import { cacheManager } from "../../utils/CacheManager.ts";
import { Constants, Events } from "../constants.ts";

// ========== 选项类型 ==========

export interface CreateTagOptions {
  tagName: string;
  type: DataType;
  defaultGroupId?: number | null;
}

export interface LinkTagsOptions {
  /** 标签名 */
  tagName: string;
  type: DataType;
  itemId?: string;
  /** 多个项目ID（批量关联） */
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

  // ========== 缓存层 ==========

  private getTagsCacheKey(type: DataType): string {
    return `${type}Tags`;
  }

  private getTagGroupsCacheKey(type: DataType): string {
    return `${type}TagGroups`;
  }

  private getFromCache<T>(key: string): T | null {
    const cache = cacheManager.getCache(key);
    return cache?.get("data")?.data ?? null;
  }

  private setCache<T>(key: string, data: T): void {
    cacheManager.createCache(key, 10).set("data", { data, time: Date.now() });
  }

  /**
   * 获取标签列表（带缓存）
   */
  private async getTagsCached(type: DataType): Promise<TagName[]> {
    const cacheKey = this.getTagsCacheKey(type);
    const cached = this.getFromCache<TagName[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await getTagsOperation(type);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * 获取标签组列表（带缓存）
   */
  private async getTagGroupsCached(type: DataType): Promise<TagGroup[]> {
    const cacheKey = this.getTagGroupsCacheKey(type);
    const cached = this.getFromCache<TagGroup[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await getTagGroupsOperation(type);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * 清除标签缓存（标签列表变更时调用）
   */
  clearTagsCache(type: DataType): void {
    const tagsCache = cacheManager.getCache(this.getTagsCacheKey(type));
    tagsCache?.clear();
  }

  /**
   * 清除标签组缓存（标签组变更时调用）
   */
  clearTagGroupsCache(type: DataType): void {
    const groupsCache = cacheManager.getCache(this.getTagGroupsCacheKey(type));
    groupsCache?.clear();
  }

  /**
   * 清除指定类型的所有标签相关缓存
   */
  clearAllCaches(type: DataType): void {
    this.clearTagsCache(type);
    this.clearTagGroupsCache(type);
  }

  /**
   * 设置事件总线
   */
  setEventBus(eventBus: { emit: (event: string) => void }): void {
    this.eventBus = eventBus;
  }

  /**
   * 创建标签（业务校验 + 数据操作）
   * @param options - 创建选项
   * @returns 操作结果
   */
  async createTag(options: CreateTagOptions): Promise<TagOperationResult> {
    const { tagName, type, defaultGroupId } = options;

    // 1. 标准化标签名
    const name = tagName.trim();
    if (!name) {
      return { success: true, created: [], skipped: [], errors: [] };
    }

    // 2. 业务校验①：特殊标签不能手动创建（图像和提示词共用）
    if (Constants.ALL_SPECIAL_TAGS.includes(name)) {
      return {
        success: false,
        created: [],
        skipped: [],
        errors: [
          {
            tag: name,
            error: `"${name}" 是系统特殊标签，不能手动添加`,
            code: "RESERVED",
          },
        ],
      };
    }

    // 3. 业务校验②：已存在则跳过
    const existingTags = await this.getTagsCached(type);
    if (existingTags.includes(name)) {
      return { success: true, created: [], skipped: [name], errors: [] };
    }

    // 4. 执行创建
    const createOptions: TagCreateOptions = {};
    if (defaultGroupId !== undefined) {
      createOptions.defaultGroupId = defaultGroupId;
    }
    await createTagOperation(type, name, createOptions);

    // 5. 清除缓存 + 触发事件通知
    this.clearAllCaches(type);
    this.emitItemsChanged(type);

    return { success: true, created: [name], skipped: [], errors: [] };
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
      this.clearAllCaches(type);
      this.emitItemsChanged(type);
    }

    return result;
  }

  /**
   * 关联标签到项目（单标签，可关联单个或多个项目）
   * 创建标签（已存在则跳过）并批量关联到项目
   * @param options - 关联选项
   * @returns 操作结果
   */
  async linkTagsToItem(options: LinkTagsOptions): Promise<LinkTagsResult> {
    const { tagName, type, itemId, itemIds } = options;

    // 1. 合并去重项目ID，标签名有效时才需要关联
    const targetIds: string[] = [];
    if (itemId) targetIds.push(itemId);
    if (itemIds) targetIds.push(...itemIds);
    const uniqueIds = [...new Set(targetIds)];
    const name = tagName.trim();
    const linked = uniqueIds.length > 0 && !!name;

    // 2. 创建标签（业务校验、已存在跳过均在 createTag 内）
    const createResult = await this.createTag({ tagName, type });

    // 3. 校验失败（保留标签等）不关联
    if (createResult.errors.length > 0) {
      return { ...createResult, linkedToItem: false, linkedItemCount: 0 };
    }

    // 4. 关联到项目（集合级批量 IPC：主进程事务内集合 SQL）
    if (linked) {
      if (type === "image") {
        await window.electronAPI.addImageTagsBatch(uniqueIds, [name]);
      } else {
        await window.electronAPI.addPromptTagsBatch(uniqueIds, [name]);
      }
    }

    // 5. 触发事件和缓存更新
    if (createResult.success) {
      this.emitItemsChanged(type);
    }

    return {
      ...createResult,
      linkedToItem: linked,
      linkedItemCount: uniqueIds.length,
    };
  }

  /**
   * 将操作结果中的错误以 toast 形式提示用户
   * 特殊标签（保留标签）用 warning，其余用 error
   * @param errors - 操作结果中的错误列表
   * @param showToast - toast 回调
   */
  reportTagErrors(errors: TagError[], showToast: (msg: string, type?: string) => void): void {
    for (const err of errors) {
      if (err.code === "RESERVED") {
        showToast(`"${err.tag}" 是系统特殊标签，不能手动添加`, "warning");
      } else {
        showToast(err.error, "error");
      }
    }
  }

  /**
   * 从项目移除标签
   * @param options - 移除选项
   * @returns 是否成功
   */
  async unlinkTagFromItem(options: UnlinkTagOptions): Promise<boolean> {
    const { type, itemId, tagName } = options;

    try {
      // 直接调用 IPC 解除标签关联（不是删除标签）
      // 注意：IPC 内部会更新 updated_at
      const result =
        type === "prompt"
          ? await window.electronAPI.removeTagFromPrompt(itemId, tagName)
          : await window.electronAPI.removeTagFromImage(itemId, tagName);
      if (!result) {
        throw new Error(`Failed to remove tag "${tagName}" from item "${itemId}"`);
      }

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
    return this.getTagsCached(type);
  }

  /**
   * 获取所有标签组
   * @param type - 数据类型
   * @returns 标签组列表
   */
  async getTagGroups(type: DataType): Promise<TagGroup[]> {
    return this.getTagGroupsCached(type);
  }

  /**
   * 重命名标签
   * @param options - 重命名选项
   */
  async renameTag(options: RenameTagOptions): Promise<void> {
    const { type, oldName, newName } = options;
    const pyTagGroups = PyTagGroups.getInstance(type);
    await pyTagGroups.rename(oldName, newName);
    this.clearAllCaches(type);
  }

  /**
   * 检查标签是否存在
   * @param type - 数据类型
   * @param tagName - 标签名称
   * @returns 是否存在
   */
  async tagExists(type: DataType, tagName: string): Promise<boolean> {
    const tags = await this.getTagsCached(type);
    return tags.includes(tagName.trim());
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
    const group = await pyTagGroups.createGroup(name, sortOrder);
    this.clearTagGroupsCache(type);
    return group;
  }

  /**
   * 更新标签组
   * @param options - 更新选项
   */
  async updateTagGroup(options: UpdateTagGroupOptions): Promise<void> {
    const { type, id, attrs } = options;
    const pyTagGroups = PyTagGroups.getInstance(type);
    await pyTagGroups.updateGroup(id, attrs);
    this.clearTagGroupsCache(type);
  }

  /**
   * 删除标签组
   * @param options - 删除选项
   */
  async deleteTagGroup(options: DeleteTagGroupOptions): Promise<void> {
    const { type, id } = options;
    const pyTagGroups = PyTagGroups.getInstance(type);
    await pyTagGroups.deleteGroup(id);
    this.clearTagGroupsCache(type);
  }

  /**
   * 分配标签到组
   * @param options - 分配选项
   */
  async assignTagToGroup(options: AssignTagToGroupOptions): Promise<void> {
    const { type, tagName, groupId } = options;
    const pyTagGroups = PyTagGroups.getInstance(type);
    await pyTagGroups.assignToGroup(tagName, groupId);
    this.clearTagGroupsCache(type);
  }

  /**
   * 获取组内标签
   * @param type - 数据类型
   * @param groupId - 组ID
   * @returns 标签列表
   */
  async getTagsByGroup(type: DataType, groupId: number): Promise<TagName[]> {
    const groups = await this.getTagGroupsCached(type);
    return groups.find((g) => g.id === groupId)?.tags || [];
  }

  /**
   * 搜索标签（前缀匹配，用于自动完成）
   * @param type - 数据类型
   * @param prefix - 搜索前缀
   * @param exclude - 要排除的标签
   * @returns 匹配的标签列表
   */
  async searchTags(type: DataType, prefix: string, exclude?: TagName[]): Promise<TagName[]> {
    const allTags = await this.getTagsCached(type);
    const lowerPrefix = prefix.toLowerCase().trim();

    if (!lowerPrefix) return [];

    return allTags.filter(
      (tag) => tag.toLowerCase().startsWith(lowerPrefix) && (!exclude || !exclude.includes(tag)),
    );
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
