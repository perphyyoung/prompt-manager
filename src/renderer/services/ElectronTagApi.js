import { TagApi } from './TagApi.js';
import { TagIpcService } from './TagIpcService.js';

/**
 * Electron IPC 实现的标签 API
 * 继承 TagApi 接口，使用 TagIpcService 进行 IPC 通信
 */
export class ElectronTagApi extends TagApi {
  // ========== 标签组操作 ==========

  /**
   * 获取所有提示词标签组
   * @returns {Promise<Array>} 标签组数组
   */
  async getPromptTagGroups() {
    return TagIpcService.getPromptTagGroups();
  }

  /**
   * 获取所有图像标签组
   * @returns {Promise<Array>} 标签组数组
   */
  async getImageTagGroups() {
    return TagIpcService.getImageTagGroups();
  }

  /**
   * 创建提示词标签组
   * @param {string} name - 组名称
   * @param {number} sortOrder - 排序序号
   * @returns {Promise<Object>} 创建的标签组
   */
  async createPromptTagGroup(name, sortOrder) {
    return TagIpcService.createPromptTagGroup(name, sortOrder);
  }

  /**
   * 创建图像标签组
   * @param {string} name - 组名称
   * @param {number} sortOrder - 排序序号
   * @returns {Promise<Object>} 创建的标签组
   */
  async createImageTagGroup(name, sortOrder) {
    return TagIpcService.createImageTagGroup(name, sortOrder);
  }

  /**
   * 更新提示词标签组属性
   * @param {string} id - 标签组 ID
   * @param {Object} updates - 要更新的属性
   * @returns {Promise<Object>} 更新后的标签组
   */
  async updatePromptTagGroupAttrs(id, updates) {
    return TagIpcService.updatePromptTagGroupAttrs(id, updates);
  }

  /**
   * 更新图像标签组属性
   * @param {string} id - 标签组 ID
   * @param {Object} updates - 要更新的属性
   * @returns {Promise<Object>} 更新后的标签组
   */
  async updateImageTagGroupAttrs(id, updates) {
    return TagIpcService.updateImageTagGroupAttrs(id, updates);
  }

  /**
   * 删除提示词标签组
   * @param {string} id - 标签组 ID
   * @returns {Promise<void>}
   */
  async deletePromptTagGroup(id) {
    return TagIpcService.deletePromptTagGroup(id);
  }

  /**
   * 删除图像标签组
   * @param {string} id - 标签组 ID
   * @returns {Promise<void>}
   */
  async deleteImageTagGroup(id) {
    return TagIpcService.deleteImageTagGroup(id);
  }

  /**
   * 分配提示词标签到所属组
   * @param {string} tagName - 标签名称
   * @param {number|null} groupId - 组 ID
   * @returns {Promise<void>}
   */
  async assignPromptTagToBelongGroup(tagName, groupId) {
    return TagIpcService.assignPromptTagToBelongGroup(tagName, groupId);
  }

  /**
   * 分配图像标签到所属组
   * @param {string} tagName - 标签名称
   * @param {number|null} groupId - 组 ID
   * @returns {Promise<void>}
   */
  async assignImageTagToBelongGroup(tagName, groupId) {
    return TagIpcService.assignImageTagToBelongGroup(tagName, groupId);
  }

  // ========== 标签操作 ==========

  /**
   * 获取所有提示词标签
   * @returns {Promise<string[]>} 标签数组
   */
  async getPromptTags() {
    return TagIpcService.getPromptTags();
  }

  /**
   * 获取所有图像标签
   * @returns {Promise<string[]>} 标签数组
   */
  async getImageTags() {
    return TagIpcService.getImageTags();
  }

  /**
   * 添加提示词标签
   * @param {string} tag - 标签名称
   * @returns {Promise<Object>} 添加结果
   */
  async addPromptTag(tag) {
    return TagIpcService.addPromptTag(tag);
  }

  /**
   * 添加图像标签
   * @param {string} tag - 标签名称
   * @returns {Promise<Object>} 添加结果
   */
  async addImageTag(tag) {
    return TagIpcService.addImageTag(tag);
  }

  /**
   * 为提示词添加多个标签
   * @param {string} promptId - 提示词 ID
   * @param {Array} tagNames - 标签名称数组
   * @returns {Promise<void>}
   */
  async addPromptTags(promptId, tagNames) {
    return TagIpcService.addPromptTags(promptId, tagNames);
  }

  /**
   * 为图像添加多个标签
   * @param {string} imageId - 图像 ID
   * @param {Array} tagNames - 标签名称数组
   * @returns {Promise<void>}
   */
  async addImageTags(imageId, tagNames) {
    return TagIpcService.addImageTags(imageId, tagNames);
  }

  /**
   * 删除提示词标签
   * @param {string} tag - 标签名称
   * @returns {Promise<void>}
   */
  async deletePromptTag(tag) {
    return TagIpcService.deletePromptTag(tag);
  }

  /**
   * 删除图像标签
   * @param {string} tag - 标签名称
   * @returns {Promise<void>}
   */
  async deleteImageTag(tag) {
    return TagIpcService.deleteImageTag(tag);
  }

  /**
   * 重命名提示词标签
   * @param {string} oldTag - 原标签名
   * @param {string} newTag - 新标签名
   * @returns {Promise<void>}
   */
  async renamePromptTag(oldTag, newTag) {
    return TagIpcService.renamePromptTag(oldTag, newTag);
  }

  /**
   * 重命名图像标签
   * @param {string} oldTag - 原标签名
   * @param {string} newTag - 新标签名
   * @returns {Promise<void>}
   */
  async renameImageTag(oldTag, newTag) {
    return TagIpcService.renameImageTag(oldTag, newTag);
  }

  // ========== 通用标签操作 ==========

  /**
   * 获取所有标签（提示词 + 图像）
   * @returns {Promise<string[]>} 标签数组
   */
  async getAllTags() {
    return TagIpcService.getAllTags();
  }
}
