/**
 * 标签 API 接口定义
 * 定义标签操作的契约，用于依赖注入
 */
export class TagApi {
  // ========== 标签组操作 ==========

  /**
   * 获取所有提示词标签组
   * @returns {Promise<Array>} 标签组数组
   */
  async getPromptTagGroups() {
    throw new Error('未实现：getPromptTagGroups');
  }

  /**
   * 获取所有图像标签组
   * @returns {Promise<Array>} 标签组数组
   */
  async getImageTagGroups() {
    throw new Error('未实现：getImageTagGroups');
  }

  /**
   * 创建提示词标签组
   * @param {string} name - 组名称
   * @param {number} sortOrder - 排序序号
   * @returns {Promise<Object>} 创建的标签组
   */
  async createPromptTagGroup(name, sortOrder) {
    throw new Error('未实现：createPromptTagGroup');
  }

  /**
   * 创建图像标签组
   * @param {string} name - 组名称
   * @param {number} sortOrder - 排序序号
   * @returns {Promise<Object>} 创建的标签组
   */
  async createImageTagGroup(name, sortOrder) {
    throw new Error('未实现：createImageTagGroup');
  }

  /**
   * 更新提示词标签组属性
   * @param {string} id - 标签组 ID
   * @param {Object} updates - 要更新的属性
   * @returns {Promise<Object>} 更新后的标签组
   */
  async updatePromptTagGroupAttrs(id, updates) {
    throw new Error('未实现：updatePromptTagGroupAttrs');
  }

  /**
   * 更新图像标签组属性
   * @param {string} id - 标签组 ID
   * @param {Object} updates - 要更新的属性
   * @returns {Promise<Object>} 更新后的标签组
   */
  async updateImageTagGroupAttrs(id, updates) {
    throw new Error('未实现：updateImageTagGroupAttrs');
  }

  /**
   * 删除提示词标签组
   * @param {string} id - 标签组 ID
   * @returns {Promise<void>}
   */
  async deletePromptTagGroup(id) {
    throw new Error('未实现：deletePromptTagGroup');
  }

  /**
   * 删除图像标签组
   * @param {string} id - 标签组 ID
   * @returns {Promise<void>}
   */
  async deleteImageTagGroup(id) {
    throw new Error('未实现：deleteImageTagGroup');
  }

  /**
   * 分配提示词标签到所属组
   * @param {string} tagName - 标签名称
   * @param {number|null} groupId - 组 ID
   * @returns {Promise<void>}
   */
  async assignPromptTagToBelongGroup(tagName, groupId) {
    throw new Error('未实现：assignPromptTagToBelongGroup');
  }

  /**
   * 分配图像标签到所属组
   * @param {string} tagName - 标签名称
   * @param {number|null} groupId - 组 ID
   * @returns {Promise<void>}
   */
  async assignImageTagToBelongGroup(tagName, groupId) {
    throw new Error('未实现：assignImageTagToBelongGroup');
  }

  // ========== 标签操作 ==========

  /**
   * 获取所有提示词标签
   * @returns {Promise<string[]>} 标签数组
   */
  async getPromptTags() {
    throw new Error('未实现：getPromptTags');
  }

  /**
   * 获取所有图像标签
   * @returns {Promise<string[]>} 标签数组
   */
  async getImageTags() {
    throw new Error('未实现：getImageTags');
  }

  /**
   * 添加提示词标签
   * @param {string} tag - 标签名称
   * @returns {Promise<Object>} 添加结果
   */
  async addPromptTag(tag) {
    throw new Error('未实现：addPromptTag');
  }

  /**
   * 添加图像标签
   * @param {string} tag - 标签名称
   * @returns {Promise<Object>} 添加结果
   */
  async addImageTag(tag) {
    throw new Error('未实现：addImageTag');
  }

  /**
   * 为提示词添加多个标签
   * @param {string} promptId - 提示词 ID
   * @param {Array} tagNames - 标签名称数组
   * @returns {Promise<void>}
   */
  async addPromptTags(promptId, tagNames) {
    throw new Error('未实现：addPromptTags');
  }

  /**
   * 为图像添加多个标签
   * @param {string} imageId - 图像 ID
   * @param {Array} tagNames - 标签名称数组
   * @returns {Promise<void>}
   */
  async addImageTags(imageId, tagNames) {
    throw new Error('未实现：addImageTags');
  }

  /**
   * 删除提示词标签
   * @param {string} tag - 标签名称
   * @returns {Promise<void>}
   */
  async deletePromptTag(tag) {
    throw new Error('未实现：deletePromptTag');
  }

  /**
   * 删除图像标签
   * @param {string} tag - 标签名称
   * @returns {Promise<void>}
   */
  async deleteImageTag(tag) {
    throw new Error('未实现：deleteImageTag');
  }

  /**
   * 重命名提示词标签
   * @param {string} oldTag - 原标签名
   * @param {string} newTag - 新标签名
   * @returns {Promise<void>}
   */
  async renamePromptTag(oldTag, newTag) {
    throw new Error('未实现：renamePromptTag');
  }

  /**
   * 重命名图像标签
   * @param {string} oldTag - 原标签名
   * @param {string} newTag - 新标签名
   * @returns {Promise<void>}
   */
  async renameImageTag(oldTag, newTag) {
    throw new Error('未实现：renameImageTag');
  }

  // ========== 通用标签操作 ==========

  /**
   * 获取所有标签（提示词 + 图像）
   * @returns {Promise<string[]>} 标签数组
   */
  async getAllTags() {
    throw new Error('未实现：getAllTags');
  }
}
