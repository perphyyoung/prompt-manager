import { TagApi, TagGroup, TagGroupUpdates, TagInfo } from './TagApi.ts';

// 模拟标签组接口
interface MockTagGroup {
  id: string;
  name: string;
  tags: string[];
  sortOrder: number;
}

/**
 * 模拟标签 API 实现
 * 用于单元测试，不依赖 Electron IPC
 */
export class MockTagApi extends TagApi {
  private promptTags: string[];
  private imageTags: string[];
  private promptTagGroups: MockTagGroup[];
  private imageTagGroups: MockTagGroup[];

  constructor() {
    super();
    // 模拟数据
    this.promptTags = ['提示词标签 1', '提示词标签 2', '提示词标签 3'];
    this.imageTags = ['图像标签 1', '图像标签 2'];
    this.promptTagGroups = [
      { id: 'pg1', name: '提示词组 1', tags: ['提示词标签 1'], sortOrder: 1 },
      { id: 'pg2', name: '提示词组 2', tags: ['提示词标签 2'], sortOrder: 2 }
    ];
    this.imageTagGroups = [
      { id: 'ig1', name: '图像组 1', tags: ['图像标签 1'], sortOrder: 1 }
    ];
  }

  // ========== 标签组操作 ==========

  async getPromptTagGroups(): Promise<TagGroup[]> {
    console.log('[MockTagApi] 获取提示词标签组');
    return this.promptTagGroups.map(g => ({
      id: parseInt(g.id.replace('pg', '')) || 0,
      name: g.name,
      sortOrder: g.sortOrder
    }));
  }

  async getImageTagGroups(): Promise<TagGroup[]> {
    console.log('[MockTagApi] 获取图像标签组');
    return this.imageTagGroups.map(g => ({
      id: parseInt(g.id.replace('ig', '')) || 0,
      name: g.name,
      sortOrder: g.sortOrder
    }));
  }

  async createPromptTagGroup(name: string, sortOrder: number): Promise<TagGroup> {
    console.log(`[MockTagApi] 创建提示词标签组：${name}`);
    const newGroup: MockTagGroup = {
      id: `pg${Date.now()}`,
      name,
      tags: [],
      sortOrder
    };
    this.promptTagGroups.push(newGroup);
    return {
      id: parseInt(newGroup.id.replace('pg', '')) || 0,
      name: newGroup.name,
      sortOrder: newGroup.sortOrder
    };
  }

  async createImageTagGroup(name: string, sortOrder: number): Promise<TagGroup> {
    console.log(`[MockTagApi] 创建图像标签组：${name}`);
    const newGroup: MockTagGroup = {
      id: `ig${Date.now()}`,
      name,
      tags: [],
      sortOrder
    };
    this.imageTagGroups.push(newGroup);
    return {
      id: parseInt(newGroup.id.replace('ig', '')) || 0,
      name: newGroup.name,
      sortOrder: newGroup.sortOrder
    };
  }

  async updatePromptTagGroupAttrs(id: number, updates: TagGroupUpdates): Promise<void> {
    console.log(`[MockTagApi] 更新提示词标签组：${id}`);
    const group = this.promptTagGroups.find(g => g.id === `pg${id}`);
    if (!group) {
      throw new Error(`标签组不存在：${id}`);
    }
    Object.assign(group, updates);
  }

  async updateImageTagGroupAttrs(id: number, updates: TagGroupUpdates): Promise<void> {
    console.log(`[MockTagApi] 更新图像标签组：${id}`);
    const group = this.imageTagGroups.find(g => g.id === `ig${id}`);
    if (!group) {
      throw new Error(`标签组不存在：${id}`);
    }
    Object.assign(group, updates);
  }

  async deletePromptTagGroup(id: number): Promise<void> {
    console.log(`[MockTagApi] 删除提示词标签组：${id}`);
    const index = this.promptTagGroups.findIndex(g => g.id === `pg${id}`);
    if (index === -1) {
      throw new Error(`标签组不存在：${id}`);
    }
    this.promptTagGroups.splice(index, 1);
  }

  async deleteImageTagGroup(id: number): Promise<void> {
    console.log(`[MockTagApi] 删除图像标签组：${id}`);
    const index = this.imageTagGroups.findIndex(g => g.id === `ig${id}`);
    if (index === -1) {
      throw new Error(`标签组不存在：${id}`);
    }
    this.imageTagGroups.splice(index, 1);
  }

  async assignPromptTagToBelongGroup(tagName: string, groupId: number | null): Promise<void> {
    console.log(`[MockTagApi] 分配提示词标签到组：${tagName} -> ${groupId}`);
    // 从所有组中移除该标签
    this.promptTagGroups.forEach(group => {
      const tagIndex = group.tags.indexOf(tagName);
      if (tagIndex !== -1) {
        group.tags.splice(tagIndex, 1);
      }
    });

    // 添加到新组
    if (groupId) {
      const group = this.promptTagGroups.find(g => g.id === `pg${groupId}`);
      if (!group) {
        throw new Error(`标签组不存在：${groupId}`);
      }
      if (!group.tags.includes(tagName)) {
        group.tags.push(tagName);
      }
    }
  }

  async assignImageTagToBelongGroup(tagName: string, groupId: number | null): Promise<void> {
    console.log(`[MockTagApi] 分配图像标签到组：${tagName} -> ${groupId}`);
    // 从所有组中移除该标签
    this.imageTagGroups.forEach(group => {
      const tagIndex = group.tags.indexOf(tagName);
      if (tagIndex !== -1) {
        group.tags.splice(tagIndex, 1);
      }
    });

    // 添加到新组
    if (groupId) {
      const group = this.imageTagGroups.find(g => g.id === `ig${groupId}`);
      if (!group) {
        throw new Error(`标签组不存在：${groupId}`);
      }
      if (!group.tags.includes(tagName)) {
        group.tags.push(tagName);
      }
    }
  }

  // ========== 标签操作 ==========

  async getPromptTags(): Promise<string[]> {
    console.log('[MockTagApi] 获取提示词标签');
    return [...this.promptTags];
  }

  async getImageTags(): Promise<string[]> {
    console.log('[MockTagApi] 获取图像标签');
    return [...this.imageTags];
  }

  async addPromptTag(tag: string): Promise<void> {
    console.log(`[MockTagApi] 添加提示词标签：${tag}`);
    if (this.promptTags.includes(tag)) {
      throw new Error(`标签已存在：${tag}`);
    }
    this.promptTags.push(tag);
  }

  async addImageTag(tag: string): Promise<void> {
    console.log(`[MockTagApi] 添加图像标签：${tag}`);
    if (this.imageTags.includes(tag)) {
      throw new Error(`标签已存在：${tag}`);
    }
    this.imageTags.push(tag);
  }

  async addPromptTags(promptId: string, tagNames: string[]): Promise<void> {
    console.log(`[MockTagApi] 为提示词添加多个标签：${promptId}`, tagNames);
  }

  async addImageTags(imageId: string, tagNames: string[]): Promise<void> {
    console.log(`[MockTagApi] 为图像添加多个标签：${imageId}`, tagNames);
  }

  async deletePromptTag(tag: string): Promise<void> {
    console.log(`[MockTagApi] 删除提示词标签：${tag}`);
    const index = this.promptTags.indexOf(tag);
    if (index === -1) {
      throw new Error(`标签不存在：${tag}`);
    }
    this.promptTags.splice(index, 1);
    // 同时从所有组中移除
    this.promptTagGroups.forEach(group => {
      const tagIndex = group.tags.indexOf(tag);
      if (tagIndex !== -1) {
        group.tags.splice(tagIndex, 1);
      }
    });
  }

  async deleteImageTag(tag: string): Promise<void> {
    console.log(`[MockTagApi] 删除图像标签：${tag}`);
    const index = this.imageTags.indexOf(tag);
    if (index === -1) {
      throw new Error(`标签不存在：${tag}`);
    }
    this.imageTags.splice(index, 1);
    // 同时从所有组中移除
    this.imageTagGroups.forEach(group => {
      const tagIndex = group.tags.indexOf(tag);
      if (tagIndex !== -1) {
        group.tags.splice(tagIndex, 1);
      }
    });
  }

  async renamePromptTag(oldTag: string, newTag: string): Promise<void> {
    console.log(`[MockTagApi] 重命名提示词标签：${oldTag} -> ${newTag}`);
    const index = this.promptTags.indexOf(oldTag);
    if (index === -1) {
      throw new Error(`标签不存在：${oldTag}`);
    }
    this.promptTags[index] = newTag;
    // 同时更新所有组中的标签
    this.promptTagGroups.forEach(group => {
      const tagIndex = group.tags.indexOf(oldTag);
      if (tagIndex !== -1) {
        group.tags[tagIndex] = newTag;
      }
    });
  }

  async renameImageTag(oldTag: string, newTag: string): Promise<void> {
    console.log(`[MockTagApi] 重命名图像标签：${oldTag} -> ${newTag}`);
    const index = this.imageTags.indexOf(oldTag);
    if (index === -1) {
      throw new Error(`标签不存在：${oldTag}`);
    }
    this.imageTags[index] = newTag;
    // 同时更新所有组中的标签
    this.imageTagGroups.forEach(group => {
      const tagIndex = group.tags.indexOf(oldTag);
      if (tagIndex !== -1) {
        group.tags[tagIndex] = newTag;
      }
    });
  }

  // ========== 通用标签操作 ==========

  async getAllTags(): Promise<string[]> {
    console.log('[MockTagApi] 获取所有标签');
    return [...this.promptTags, ...this.imageTags];
  }
}
