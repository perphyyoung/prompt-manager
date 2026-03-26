/**
 * 标签 IPC 服务类
 * 封装所有与标签相关的 IPC 调用，提供统一的错误处理和日志记录
 */
export class TagIpcService {
  // ========== 提示词标签组 ==========

  /**
   * 获取所有提示词标签组
   * @returns {Promise<Array>} 标签组数组
   */
  static async getPromptTagGroups() {
    try {
      const result = await window.electronAPI.getPromptTagGroups();
      return result;
    } catch (error) {
      console.error('[TagIpcService] 获取提示词标签组失败:', error);
      throw error;
    }
  }

  /**
   * 创建提示词标签组
   * @param {string} name - 组名称
   * @param {number} sortOrder - 排序序号
   * @returns {Promise<Object>} 创建的标签组
   */
  static async createPromptTagGroup(name, sortOrder) {
    try {
      const result = await window.electronAPI.createPromptTagGroup(name, sortOrder);
      return result;
    } catch (error) {
      console.error(`[TagIpcService] 创建提示词标签组失败：${name}`, error);
      throw error;
    }
  }

  /**
   * 更新提示词标签组属性
   * @param {string} id - 标签组 ID
   * @param {Object} updates - 要更新的属性
   * @returns {Promise<Object>} 更新后的标签组
   */
  static async updatePromptTagGroupAttrs(id, updates) {
    try {
      const result = await window.electronAPI.updatePromptTagGroupAttrs(id, updates);
      return result;
    } catch (error) {
      console.error(`[TagIpcService] 更新提示词标签组失败：${id}`, error);
      throw error;
    }
  }

  /**
   * 删除提示词标签组
   * @param {string} id - 标签组 ID
   * @returns {Promise<void>}
   */
  static async deletePromptTagGroup(id) {
    try {
      await window.electronAPI.deletePromptTagGroup(id);
    } catch (error) {
      console.error(`[TagIpcService] 删除提示词标签组失败：${id}`, error);
      throw error;
    }
  }

  /**
   * 分配提示词标签到所属组
   * @param {string} tagName - 标签名称
   * @param {number|null} groupId - 组 ID
   * @returns {Promise<void>}
   */
  static async assignPromptTagToBelongGroup(tagName, groupId) {
    try {
      await window.electronAPI.assignPromptTagToBelongGroup(tagName, groupId);
    } catch (error) {
      console.error(`[TagIpcService] 分配提示词标签到组失败：${tagName}`, error);
      throw error;
    }
  }

  // ========== 提示词标签 ==========

  /**
   * 获取所有提示词标签
   * @returns {Promise<string[]>} 标签数组
   */
  static async getPromptTags() {
    try {
      const result = await window.electronAPI.getPromptTags();
      return result;
    } catch (error) {
      console.error('[TagIpcService] 获取提示词标签失败:', error);
      throw error;
    }
  }

  /**
   * 添加提示词标签
   * @param {string} tag - 标签名称
   * @returns {Promise<Object>} 添加结果
   */
  static async addPromptTag(tag) {
    try {
      const result = await window.electronAPI.addPromptTag(tag);
      return result;
    } catch (error) {
      console.error(`[TagIpcService] 添加提示词标签失败：${tag}`, error);
      throw error;
    }
  }

  /**
   * 为提示词添加多个标签
   * @param {string} promptId - 提示词 ID
   * @param {Array} tagNames - 标签名称数组
   * @returns {Promise<void>}
   */
  static async addPromptTags(promptId, tagNames) {
    try {
      await window.electronAPI.addPromptTags(promptId, tagNames);
    } catch (error) {
      console.error(`[TagIpcService] 为提示词添加多个标签失败：${promptId}`, error);
      throw error;
    }
  }

  /**
   * 删除提示词标签
   * @param {string} tag - 标签名称
   * @returns {Promise<void>}
   */
  static async deletePromptTag(tag) {
    try {
      await window.electronAPI.deletePromptTag(tag);
    } catch (error) {
      console.error(`[TagIpcService] 删除提示词标签失败：${tag}`, error);
      throw error;
    }
  }

  /**
   * 重命名提示词标签
   * @param {string} oldTag - 原标签名
   * @param {string} newTag - 新标签名
   * @returns {Promise<void>}
   */
  static async renamePromptTag(oldTag, newTag) {
    try {
      await window.electronAPI.renamePromptTag(oldTag, newTag);
    } catch (error) {
      console.error(`[TagIpcService] 重命名提示词标签失败：${oldTag} -> ${newTag}`, error);
      throw error;
    }
  }

  // ========== 图像标签组 ==========

  /**
   * 获取所有图像标签组
   * @returns {Promise<Array>} 标签组数组
   */
  static async getImageTagGroups() {
    try {
      const result = await window.electronAPI.getImageTagGroups();
      return result;
    } catch (error) {
      console.error('[TagIpcService] 获取图像标签组失败:', error);
      throw error;
    }
  }

  /**
   * 创建图像标签组
   * @param {string} name - 组名称
   * @param {number} sortOrder - 排序序号
   * @returns {Promise<Object>} 创建的标签组
   */
  static async createImageTagGroup(name, sortOrder) {
    try {
      const result = await window.electronAPI.createImageTagGroup(name, sortOrder);
      return result;
    } catch (error) {
      console.error(`[TagIpcService] 创建图像标签组失败：${name}`, error);
      throw error;
    }
  }

  /**
   * 更新图像标签组属性
   * @param {string} id - 标签组 ID
   * @param {Object} updates - 要更新的属性
   * @returns {Promise<Object>} 更新后的标签组
   */
  static async updateImageTagGroupAttrs(id, updates) {
    try {
      const result = await window.electronAPI.updateImageTagGroupAttrs(id, updates);
      return result;
    } catch (error) {
      console.error(`[TagIpcService] 更新图像标签组失败：${id}`, error);
      throw error;
    }
  }

  /**
   * 删除图像标签组
   * @param {string} id - 标签组 ID
   * @returns {Promise<void>}
   */
  static async deleteImageTagGroup(id) {
    try {
      await window.electronAPI.deleteImageTagGroup(id);
    } catch (error) {
      console.error(`[TagIpcService] 删除图像标签组失败：${id}`, error);
      throw error;
    }
  }

  /**
   * 分配图像标签到所属组
   * @param {string} tagName - 标签名称
   * @param {number|null} groupId - 组 ID
   * @returns {Promise<void>}
   */
  static async assignImageTagToBelongGroup(tagName, groupId) {
    try {
      await window.electronAPI.assignImageTagToBelongGroup(tagName, groupId);
    } catch (error) {
      console.error(`[TagIpcService] 分配图像标签到组失败：${tagName}`, error);
      throw error;
    }
  }

  // ========== 图像标签 ==========

  /**
   * 获取所有图像标签
   * @returns {Promise<string[]>} 标签数组
   */
  static async getImageTags() {
    try {
      const result = await window.electronAPI.getImageTags();
      return result;
    } catch (error) {
      console.error('[TagIpcService] 获取图像标签失败:', error);
      throw error;
    }
  }

  /**
   * 添加图像标签
   * @param {string} tag - 标签名称
   * @returns {Promise<Object>} 添加结果
   */
  static async addImageTag(tag) {
    try {
      const result = await window.electronAPI.addImageTag(tag);
      return result;
    } catch (error) {
      console.error(`[TagIpcService] 添加图像标签失败：${tag}`, error);
      throw error;
    }
  }

  /**
   * 为图像添加多个标签
   * @param {string} imageId - 图像 ID
   * @param {Array} tagNames - 标签名称数组
   * @returns {Promise<void>}
   */
  static async addImageTags(imageId, tagNames) {
    try {
      await window.electronAPI.addImageTags(imageId, tagNames);
    } catch (error) {
      console.error(`[TagIpcService] 为图像添加多个标签失败：${imageId}`, error);
      throw error;
    }
  }

  /**
   * 删除图像标签
   * @param {string} tag - 标签名称
   * @returns {Promise<void>}
   */
  static async deleteImageTag(tag) {
    try {
      await window.electronAPI.deleteImageTag(tag);
    } catch (error) {
      console.error(`[TagIpcService] 删除图像标签失败：${tag}`, error);
      throw error;
    }
  }

  /**
   * 重命名图像标签
   * @param {string} oldTag - 原标签名
   * @param {string} newTag - 新标签名
   * @returns {Promise<void>}
   */
  static async renameImageTag(oldTag, newTag) {
    try {
      await window.electronAPI.renameImageTag(oldTag, newTag);
    } catch (error) {
      console.error(`[TagIpcService] 重命名图像标签失败：${oldTag} -> ${newTag}`, error);
      throw error;
    }
  }

  // ========== 通用标签 ==========

  /**
   * 获取所有标签（提示词 + 图像）
   * @returns {Promise<string[]>} 标签数组
   */
  static async getAllTags() {
    try {
      const result = await window.electronAPI.getAllTags();
      return result;
    } catch (error) {
      console.error('[TagIpcService] 获取所有标签失败:', error);
      throw error;
    }
  }
}
