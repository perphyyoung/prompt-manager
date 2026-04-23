/**
 * PyTagGroups 主库类
 * 标签组库的统一入口，提供便捷方法
 */

import * as operations from './operations.ts';
import * as validation from './validation.ts';
import * as utils from './utils.ts';
import type {
  TagName,
  TagGroup,
  TagGroupId,
  DataType,
  TagOperationResult,
  TagDeleteResult,
  TagCreateOptions,
  TagQueryOptions,
  Tag
} from './types.ts';
import {
  TagExistsError,
  InvalidTagNameError,
  TagNotFoundError
} from './types.ts';

/**
 * PyTagGroups 标签组库
 * 提供标签和标签组管理的统一入口
 */
export class PyTagGroups {
  private static instances = new Map<DataType, PyTagGroups>();

  private type: DataType;

  /**
   * 获取实例（单例模式）
   * @param type - 数据类型：'prompt' | 'image'
   * @returns PyTagGroups 实例
   */
  static getInstance(type: DataType): PyTagGroups {
    if (!this.instances.has(type)) {
      this.instances.set(type, new PyTagGroups(type));
    }
    return this.instances.get(type)!;
  }

  private constructor(type: DataType) {
    this.type = type;
  }

  // ========== 标签操作 ==========

  /**
   * 创建标签（支持批量）
   * @param input - 标签名称或标签数组
   * @param options - 创建选项
   * @returns 操作结果
   */
  async create(input: TagName | TagName[], options: TagCreateOptions = {}): Promise<TagOperationResult> {
    const tags = Array.isArray(input) ? input : [input];
    const reservedTags = validation.getReservedTags(this.type);
    const existingTags = await operations.getTags(this.type);

    const result: TagOperationResult = {
      success: true,
      created: [],
      skipped: [],
      errors: []
    };

    for (const tag of tags) {
      const trimmedTag = tag.trim();
      if (!trimmedTag) continue;

      // 验证
      const validationResult = validation.validateTagCreate(
        trimmedTag,
        existingTags,
        reservedTags
      );

      if (!validationResult.valid) {
        if (validationResult.code === 'EXISTS') {
          result.skipped.push(trimmedTag);
        } else {
          result.errors.push({
            tag: trimmedTag,
            error: validationResult.error!,
            code: validationResult.code!
          });
        }
        continue;
      }

      // 创建
      try {
        await operations.createTags(this.type, [trimmedTag], {
          defaultGroupId: options.defaultGroupId
        });
        result.created.push(trimmedTag);
        existingTags.push(trimmedTag);
      } catch (error) {
        result.errors.push({
          tag: trimmedTag,
          error: error instanceof Error ? error.message : '创建失败',
          code: 'INVALID'
        });
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * 获取所有标签名称
   * @param options - 查询选项
   * @returns 标签名称列表
   */
  async getAllTags(options?: TagQueryOptions): Promise<TagName[]> {
    const tags = await operations.getTags(this.type);
    return await this.sortTags(tags, options?.sortBy);
  }

  /**
   * 排序标签数组
   * @param tags - 标签数组
   * @param sortBy - 排序方式
   * @returns 排序后的标签数组
   */
  private async sortTags(
    tags: TagName[],
    sortBy?: TagQueryOptions['sortBy']
  ): Promise<TagName[]> {
    switch (sortBy) {
      case 'name':
        return [...tags].sort((a, b) => a.localeCompare(b));

      case 'count': {
        const counts = await this.getTagCounts();
        return utils.sortTagsByCount(tags, counts);
      }

      default:
        return tags;
    }
  }

  /**
   * 获取标签使用计数
   * 从数据库查询每个标签关联的项目数量
   */
  private async getTagCounts(): Promise<Record<TagName, number>> {
    const tags = await operations.getTags(this.type);
    const counts: Record<TagName, number> = {};

    for (const tag of tags) {
      const items = await operations.getItemsByTag(this.type, tag);
      counts[tag] = items.length;
    }

    return counts;
  }

  /**
   * 搜索标签（前缀匹配，用于自动完成）
   * @param prefix - 前缀
   * @param exclude - 要排除的标签
   * @returns 匹配的标签列表
   */
  async search(prefix: string, exclude?: TagName[]): Promise<TagName[]> {
    const allTags = await operations.getTags(this.type);
    const lowerPrefix = prefix.toLowerCase().trim();

    if (!lowerPrefix) return [];

    return allTags.filter(tag =>
      tag.toLowerCase().startsWith(lowerPrefix) &&
      tag.toLowerCase() !== lowerPrefix &&
      (!exclude || !exclude.includes(tag))
    );
  }

  /**
   * 重命名标签
   * @param oldName - 旧标签名
   * @param newName - 新标签名
   * @throws TagNotFoundError - 原标签不存在
   * @throws TagExistsError - 新标签已存在
   * @throws InvalidTagNameError - 标签名无效
   */
  async rename(oldName: TagName, newName: TagName): Promise<void> {
    const existingTags = await operations.getTags(this.type);

    const validationResult = validation.validateTagRename(oldName, newName, existingTags);
    if (!validationResult.valid) {
      // 根据错误码抛出自定义异常
      switch (validationResult.code) {
        case 'NOT_FOUND':
          throw new TagNotFoundError(oldName.trim());
        case 'EXISTS':
          throw new TagExistsError(newName.trim());
        case 'INVALID':
          throw new InvalidTagNameError(newName.trim(), validationResult.error || '标签名无效');
        default:
          throw new Error(validationResult.error);
      }
    }

    await operations.renameTag(this.type, oldName.trim(), newName.trim());
  }

  /**
   * 删除标签
   * @param input - 标签名称或标签数组
   * @returns 删除结果
   */
  async delete(input: TagName | TagName[]): Promise<TagDeleteResult> {
    const tags = Array.isArray(input) ? input : [input];
    return operations.deleteTags(this.type, tags);
  }

  /**
   * 检查标签是否存在
   * @param tag - 标签名称
   * @returns 是否存在
   */
  async exists(tag: TagName): Promise<boolean> {
    const allTags = await operations.getTags(this.type);
    return allTags.includes(tag.trim());
  }

  /**
   * 获取所有标签及其组信息
   * @returns 带组信息的标签对象数组
   */
  async getTagsWithGroups(): Promise<Tag[]> {
    const [tags, groups] = await Promise.all([
      operations.getTags(this.type),
      operations.getTagGroups(this.type)
    ]);

    return utils.toTagObjects(tags, groups);
  }

  // ========== 标签组操作 ==========

  /**
   * 创建标签组
   * @param name - 组名称
   * @param sortOrder - 排序顺序（可选）
   * @returns 创建的标签组
   */
  async createGroup(name: string, sortOrder?: number): Promise<TagGroup> {
    const validationResult = validation.validateGroupName(name);
    if (!validationResult.valid) {
      throw new Error(validationResult.error);
    }

    const groups = await operations.getTagGroups(this.type);
    const maxOrder = groups.length > 0
      ? Math.max(...groups.map(g => g.sortOrder))
      : 0;

    return operations.createTagGroup(this.type, name.trim(), sortOrder ?? maxOrder + 1);
  }

  /**
   * 获取所有标签组
   * @returns 标签组列表
   */
  async getGroups(): Promise<TagGroup[]> {
    return operations.getTagGroups(this.type);
  }

  /**
   * 更新标签组
   * @param id - 组ID
   * @param attrs - 更新属性
   */
  async updateGroup(id: TagGroupId, attrs: Partial<TagGroup>): Promise<void> {
    if (attrs.name) {
      const validationResult = validation.validateGroupName(attrs.name);
      if (!validationResult.valid) {
        throw new Error(validationResult.error);
      }
    }

    await operations.updateTagGroup(this.type, id, attrs);
  }

  /**
   * 删除标签组
   * @param id - 组ID
   */
  async deleteGroup(id: TagGroupId): Promise<void> {
    await operations.deleteTagGroup(this.type, id);
  }

  /**
   * 分配标签到组
   * @param tag - 标签名
   * @param groupId - 组ID（null表示移除分组）
   */
  async assignToGroup(tag: TagName, groupId: TagGroupId | null): Promise<void> {
    await operations.assignTagToGroup(this.type, tag.trim(), groupId);
  }

  /**
   * 获取组内标签
   * @param groupId - 组ID
   * @returns 标签列表
   */
  async getTagsByGroup(groupId: TagGroupId): Promise<TagName[]> {
    const groups = await operations.getTagGroups(this.type);
    const group = groups.find(g => g.id === groupId);
    return group?.tags || [];
  }

  // ========== 工具方法 ==========

  /**
   * 解析标签输入（支持批量）
   * @param input - 输入字符串
   * @returns 标签数组
   */
  parse(input: string): TagName[] {
    return utils.parseTagInput(input);
  }

/**
   * 计算标签差集
   * @param current - 当前标签数组
   * @param removed - 要移除的标签数组
   * @returns 移除后的标签数组
   */
  diff(current: TagName[], removed: TagName[]): TagName[] {
    return utils.diffTags(current, removed);
  }

  /**
   * 按组分组标签
   * @param tags - 标签数组
   * @returns 分组结果
   */
  async groupByGroup(tags: TagName[]): Promise<{ grouped: Record<TagGroupId, TagName[]>; ungrouped: TagName[] }> {
    const groups = await operations.getTagGroups(this.type);
    return utils.groupTagsByGroup(tags, groups);
  }
}
