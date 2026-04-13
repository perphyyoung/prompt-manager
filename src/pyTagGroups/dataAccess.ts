/**
 * 数据访问层
 * 抽象底层数据操作，便于测试和替换实现
 */

import type { TagName, TagGroup, TagGroupId, DataType } from './types.ts';

/**
 * 数据访问接口
 */
export interface TagDataAccess {
  // 标签操作
  getTags(): Promise<TagName[]>;
  addTag(tag: TagName): Promise<void>;
  renameTag(oldName: TagName, newName: TagName): Promise<void>;
  deleteTag(tag: TagName): Promise<void>;

  // 标签组操作
  getTagGroups(): Promise<TagGroup[]>;
  createTagGroup(name: string, sortOrder: number): Promise<TagGroup>;
  updateTagGroup(id: TagGroupId, attrs: Partial<TagGroup>): Promise<void>;
  deleteTagGroup(id: TagGroupId): Promise<void>;

  // 关联操作
  assignTagToGroup(tag: TagName, groupId: TagGroupId | null): Promise<void>;

  // 标签关联查询
  getItemsByTag(tag: TagName): Promise<string[]>;
  removeTagFromItem(itemId: string, tag: TagName): Promise<void>;
}

/**
 * Electron 数据访问实现
 */
export class ElectronTagDataAccess implements TagDataAccess {
  private type: DataType;

  constructor(type: DataType) {
    this.type = type;
  }

  async getTags(): Promise<TagName[]> {
    return this.type === 'prompt'
      ? window.electronAPI.getPromptTags()
      : window.electronAPI.getImageTags();
  }

  async addTag(tag: TagName): Promise<void> {
    return this.type === 'prompt'
      ? window.electronAPI.addPromptTag(tag)
      : window.electronAPI.addImageTag(tag);
  }

  async renameTag(oldName: TagName, newName: TagName): Promise<void> {
    return this.type === 'prompt'
      ? window.electronAPI.renamePromptTag(oldName, newName)
      : window.electronAPI.renameImageTag(oldName, newName);
  }

  async deleteTag(tag: TagName): Promise<void> {
    return this.type === 'prompt'
      ? window.electronAPI.deletePromptTag(tag)
      : window.electronAPI.deleteImageTag(tag);
  }

  async getTagGroups(): Promise<TagGroup[]> {
    return this.type === 'prompt'
      ? window.electronAPI.getPromptTagGroups()
      : window.electronAPI.getImageTagGroups();
  }

  async createTagGroup(name: string, sortOrder: number): Promise<TagGroup> {
    return this.type === 'prompt'
      ? window.electronAPI.createPromptTagGroup(name, sortOrder)
      : window.electronAPI.createImageTagGroup(name, sortOrder);
  }

  async updateTagGroup(id: TagGroupId, attrs: Partial<TagGroup>): Promise<void> {
    return this.type === 'prompt'
      ? window.electronAPI.updatePromptTagGroupAttrs(id, attrs)
      : window.electronAPI.updateImageTagGroupAttrs(id, attrs);
  }

  async deleteTagGroup(id: TagGroupId): Promise<void> {
    return this.type === 'prompt'
      ? window.electronAPI.deletePromptTagGroup(id)
      : window.electronAPI.deleteImageTagGroup(id);
  }

  async assignTagToGroup(tag: TagName, groupId: TagGroupId | null): Promise<void> {
    return this.type === 'prompt'
      ? window.electronAPI.assignPromptTagToBelongGroup(tag, groupId)
      : window.electronAPI.assignImageTagToBelongGroup(tag, groupId);
  }

  async getItemsByTag(tag: TagName): Promise<string[]> {
    return this.type === 'prompt'
      ? window.electronAPI.getPromptsByTag(tag)
      : window.electronAPI.getImagesByTag(tag);
  }

  async removeTagFromItem(itemId: string, tag: TagName): Promise<void> {
    const result = this.type === 'prompt'
      ? await window.electronAPI.removeTagFromPrompt(itemId, tag)
      : await window.electronAPI.removeTagFromImage(itemId, tag);
    if (!result) {
      throw new Error(`Failed to remove tag "${tag}" from item "${itemId}"`);
    }
  }
}

/**
 * 创建数据访问实例的工厂函数
 * @param type - 数据类型
 * @returns 数据访问实例
 */
export function createDataAccess(type: DataType): TagDataAccess {
  return new ElectronTagDataAccess(type);
}
