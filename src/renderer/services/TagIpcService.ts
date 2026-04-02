/**
 * 标签 IPC 服务类
 * 封装所有与标签相关的 IPC 调用，提供统一的错误处理和日志记录
 */

import { TagGroup, TagGroupUpdates, TagInfo } from './TagApi.ts';

export class TagIpcService {
  // ========== 提示词标签组 ==========

  /**
   * 获取所有提示词标签组
   * @returns 标签组数组
   */
  static async getPromptTagGroups(): Promise<TagGroup[]> {
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
   * @param name - 组名称
   * @param sortOrder - 排序序号
   * @returns 创建的标签组
   */
  static async createPromptTagGroup(name: string, sortOrder: number): Promise<TagGroup> {
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
   * @param id - 标签组 ID
   * @param updates - 要更新的属性
   * @returns 更新后的标签组
   */
  static async updatePromptTagGroupAttrs(id: number, updates: TagGroupUpdates): Promise<void> {
    try {
      await window.electronAPI.updatePromptTagGroupAttrs(id, updates);
    } catch (error) {
      console.error(`[TagIpcService] 更新提示词标签组失败：${id}`, error);
      throw error;
    }
  }

  /**
   * 删除提示词标签组
   * @param id - 标签组 ID
   */
  static async deletePromptTagGroup(id: number): Promise<void> {
    try {
      await window.electronAPI.deletePromptTagGroup(id);
    } catch (error) {
      console.error(`[TagIpcService] 删除提示词标签组失败：${id}`, error);
      throw error;
    }
  }

  /**
   * 分配提示词标签到所属组
   * @param tagName - 标签名称
   * @param groupId - 组 ID
   */
  static async assignPromptTagToBelongGroup(tagName: string, groupId: number | null): Promise<void> {
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
   * @returns 标签数组
   */
  static async getPromptTags(): Promise<string[]> {
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
   * @param tag - 标签名称
   * @returns 添加结果
   */
  static async addPromptTag(tag: string): Promise<void> {
    try {
      await window.electronAPI.addPromptTag(tag);
    } catch (error) {
      console.error(`[TagIpcService] 添加提示词标签失败：${tag}`, error);
      throw error;
    }
  }

  /**
   * 为提示词添加多个标签
   * @param promptId - 提示词 ID
   * @param tagNames - 标签名称数组
   */
  static async addPromptTags(promptId: string, tagNames: string[]): Promise<void> {
    try {
      await window.electronAPI.addPromptTags(promptId, tagNames);
    } catch (error) {
      console.error(`[TagIpcService] 为提示词添加多个标签失败：${promptId}`, error);
      throw error;
    }
  }

  /**
   * 删除提示词标签
   * @param tag - 标签名称
   */
  static async deletePromptTag(tag: string): Promise<void> {
    try {
      await window.electronAPI.deletePromptTag(tag);
    } catch (error) {
      console.error(`[TagIpcService] 删除提示词标签失败：${tag}`, error);
      throw error;
    }
  }

  /**
   * 重命名提示词标签
   * @param oldTag - 原标签名
   * @param newTag - 新标签名
   */
  static async renamePromptTag(oldTag: string, newTag: string): Promise<void> {
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
   * @returns 标签组数组
   */
  static async getImageTagGroups(): Promise<TagGroup[]> {
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
   * @param name - 组名称
   * @param sortOrder - 排序序号
   * @returns 创建的标签组
   */
  static async createImageTagGroup(name: string, sortOrder: number): Promise<TagGroup> {
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
   * @param id - 标签组 ID
   * @param updates - 要更新的属性
   * @returns 更新后的标签组
   */
  static async updateImageTagGroupAttrs(id: number, updates: TagGroupUpdates): Promise<void> {
    try {
      await window.electronAPI.updateImageTagGroupAttrs(id, updates);
    } catch (error) {
      console.error(`[TagIpcService] 更新图像标签组失败：${id}`, error);
      throw error;
    }
  }

  /**
   * 删除图像标签组
   * @param id - 标签组 ID
   */
  static async deleteImageTagGroup(id: number): Promise<void> {
    try {
      await window.electronAPI.deleteImageTagGroup(id);
    } catch (error) {
      console.error(`[TagIpcService] 删除图像标签组失败：${id}`, error);
      throw error;
    }
  }

  /**
   * 分配图像标签到所属组
   * @param tagName - 标签名称
   * @param groupId - 组 ID
   */
  static async assignImageTagToBelongGroup(tagName: string, groupId: number | null): Promise<void> {
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
   * @returns 标签数组
   */
  static async getImageTags(): Promise<string[]> {
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
   * @param tag - 标签名称
   * @returns 添加结果
   */
  static async addImageTag(tag: string): Promise<void> {
    try {
      await window.electronAPI.addImageTag(tag);
    } catch (error) {
      console.error(`[TagIpcService] 添加图像标签失败：${tag}`, error);
      throw error;
    }
  }

  /**
   * 为图像添加多个标签
   * @param imageId - 图像 ID
   * @param tagNames - 标签名称数组
   */
  static async addImageTags(imageId: string, tagNames: string[]): Promise<void> {
    try {
      await window.electronAPI.addImageTags(imageId, tagNames);
    } catch (error) {
      console.error(`[TagIpcService] 为图像添加多个标签失败：${imageId}`, error);
      throw error;
    }
  }

  /**
   * 删除图像标签
   * @param tag - 标签名称
   */
  static async deleteImageTag(tag: string): Promise<void> {
    try {
      await window.electronAPI.deleteImageTag(tag);
    } catch (error) {
      console.error(`[TagIpcService] 删除图像标签失败：${tag}`, error);
      throw error;
    }
  }

  /**
   * 重命名图像标签
   * @param oldTag - 原标签名
   * @param newTag - 新标签名
   */
  static async renameImageTag(oldTag: string, newTag: string): Promise<void> {
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
   * @returns 标签数组
   */
  static async getAllTags(): Promise<string[]> {
    try {
      const result = await window.electronAPI.getAllTags();
      return result;
    } catch (error) {
      console.error('[TagIpcService] 获取所有标签失败:', error);
      throw error;
    }
  }
}
