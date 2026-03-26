import { TagApi } from './TagApi.js';

/**
 * 模拟标签 API 实现
 * 用于单元测试，不依赖 Electron IPC
 */
export class MockTagApi extends TagApi {
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

  async getPromptTagGroups() {
    console.log('[MockTagApi] 获取提示词标签组');
    return [...this.promptTagGroups];
  }

  async getImageTagGroups() {
    console.log('[MockTagApi] 获取图像标签组');
    return [...this.imageTagGroups];
  }

  async createPromptTagGroup(name, sortOrder) {
    console.log(`[MockTagApi] 创建提示词标签组：${name}`);
    const newGroup = {
      id: `pg${Date.now()}`,
      name,
      tags: [],
      sortOrder
    };
    this.promptTagGroups.push(newGroup);
    return newGroup;
  }

  async createImageTagGroup(name, sortOrder) {
    console.log(`[MockTagApi] 创建图像标签组：${name}`);
    const newGroup = {
      id: `ig${Date.now()}`,
      name,
      tags: [],
      sortOrder
    };
    this.imageTagGroups.push(newGroup);
    return newGroup;
  }

  async updatePromptTagGroupAttrs(id, updates) {
    console.log(`[MockTagApi] 更新提示词标签组：${id}`);
    const group = this.promptTagGroups.find(g => g.id === id);
    if (!group) {
      throw new Error(`标签组不存在：${id}`);
    }
    Object.assign(group, updates);
    return { ...group };
  }

  async updateImageTagGroupAttrs(id, updates) {
    console.log(`[MockTagApi] 更新图像标签组：${id}`);
    const group = this.imageTagGroups.find(g => g.id === id);
    if (!group) {
      throw new Error(`标签组不存在：${id}`);
    }
    Object.assign(group, updates);
    return { ...group };
  }

  async deletePromptTagGroup(id) {
    console.log(`[MockTagApi] 删除提示词标签组：${id}`);
    const index = this.promptTagGroups.findIndex(g => g.id === id);
    if (index === -1) {
      throw new Error(`标签组不存在：${id}`);
    }
    this.promptTagGroups.splice(index, 1);
  }

  async deleteImageTagGroup(id) {
    console.log(`[MockTagApi] 删除图像标签组：${id}`);
    const index = this.imageTagGroups.findIndex(g => g.id === id);
    if (index === -1) {
      throw new Error(`标签组不存在：${id}`);
    }
    this.imageTagGroups.splice(index, 1);
  }

  async assignPromptTagToBelongGroup(tagName, groupId) {
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
      const group = this.promptTagGroups.find(g => g.id === groupId);
      if (!group) {
        throw new Error(`标签组不存在：${groupId}`);
      }
      if (!group.tags.includes(tagName)) {
        group.tags.push(tagName);
      }
    }
  }

  async assignImageTagToBelongGroup(tagName, groupId) {
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
      const group = this.imageTagGroups.find(g => g.id === groupId);
      if (!group) {
        throw new Error(`标签组不存在：${groupId}`);
      }
      if (!group.tags.includes(tagName)) {
        group.tags.push(tagName);
      }
    }
  }

  // ========== 标签操作 ==========

  async getPromptTags() {
    console.log('[MockTagApi] 获取提示词标签');
    return [...this.promptTags];
  }

  async getImageTags() {
    console.log('[MockTagApi] 获取图像标签');
    return [...this.imageTags];
  }

  async addPromptTag(tag) {
    console.log(`[MockTagApi] 添加提示词标签：${tag}`);
    if (this.promptTags.includes(tag)) {
      throw new Error(`标签已存在：${tag}`);
    }
    this.promptTags.push(tag);
    return { success: true, tag };
  }

  async addImageTag(tag) {
    console.log(`[MockTagApi] 添加图像标签：${tag}`);
    if (this.imageTags.includes(tag)) {
      throw new Error(`标签已存在：${tag}`);
    }
    this.imageTags.push(tag);
    return { success: true, tag };
  }

  async addPromptTags(promptId, tagNames) {
    console.log(`[MockTagApi] 为提示词添加多个标签：${promptId}`, tagNames);
    // 模拟实现，实际测试中可能不需要具体实现
    return { success: true, promptId, tagNames };
  }

  async addImageTags(imageId, tagNames) {
    console.log(`[MockTagApi] 为图像添加多个标签：${imageId}`, tagNames);
    // 模拟实现，实际测试中可能不需要具体实现
    return { success: true, imageId, tagNames };
  }

  async deletePromptTag(tag) {
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

  async deleteImageTag(tag) {
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

  async renamePromptTag(oldTag, newTag) {
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

  async renameImageTag(oldTag, newTag) {
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

  async getAllTags() {
    console.log('[MockTagApi] 获取所有标签');
    return [...this.promptTags, ...this.imageTags];
  }
}
