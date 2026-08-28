/**
 * PyTagGroups 主库类
 * 标签组库的统一入口，提供便捷方法
 */

import * as operations from "./operations.ts";
import * as validation from "./validation.ts";
import type { TagName, TagGroup, TagGroupId, DataType } from "./types.ts";
import { TagExistsError, InvalidTagNameError, TagNotFoundError } from "./types.ts";

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
        case "NOT_FOUND":
          throw new TagNotFoundError(oldName.trim());
        case "EXISTS":
          throw new TagExistsError(newName.trim());
        case "INVALID":
          throw new InvalidTagNameError(newName.trim(), validationResult.error || "标签名无效");
        default:
          throw new Error(validationResult.error);
      }
    }

    await operations.renameTag(this.type, oldName.trim(), newName.trim());
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
    const maxOrder = groups.length > 0 ? Math.max(...groups.map((g) => g.sortOrder)) : 0;

    return operations.createTagGroup(this.type, name.trim(), sortOrder ?? maxOrder + 1);
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
}
