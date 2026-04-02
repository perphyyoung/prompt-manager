import { TagApi, TagGroup, TagGroupUpdates, TagInfo } from './TagApi.ts';
import { TagIpcService } from './TagIpcService.ts';

/**
 * Electron IPC 实现的标签 API
 * 继承 TagApi 接口，使用 TagIpcService 进行 IPC 通信
 */
export class ElectronTagApi extends TagApi {
  // ========== 标签组操作 ==========

  /**
   * 获取所有提示词标签组
   * @returns 标签组数组
   */
  async getPromptTagGroups(): Promise<TagGroup[]> {
    return TagIpcService.getPromptTagGroups();
  }

  /**
   * 获取所有图像标签组
   * @returns 标签组数组
   */
  async getImageTagGroups(): Promise<TagGroup[]> {
    return TagIpcService.getImageTagGroups();
  }

  /**
   * 创建提示词标签组
   * @param name - 组名称
   * @param sortOrder - 排序序号
   * @returns 创建的标签组
   */
  async createPromptTagGroup(name: string, sortOrder: number): Promise<TagGroup> {
    return TagIpcService.createPromptTagGroup(name, sortOrder);
  }

  /**
   * 创建图像标签组
   * @param name - 组名称
   * @param sortOrder - 排序序号
   * @returns 创建的标签组
   */
  async createImageTagGroup(name: string, sortOrder: number): Promise<TagGroup> {
    return TagIpcService.createImageTagGroup(name, sortOrder);
  }

  /**
   * 更新提示词标签组属性
   * @param id - 标签组 ID
   * @param updates - 要更新的属性
   */
  async updatePromptTagGroupAttrs(id: number, updates: TagGroupUpdates): Promise<void> {
    await TagIpcService.updatePromptTagGroupAttrs(id, updates);
  }

  /**
   * 更新图像标签组属性
   * @param id - 标签组 ID
   * @param updates - 要更新的属性
   */
  async updateImageTagGroupAttrs(id: number, updates: TagGroupUpdates): Promise<void> {
    await TagIpcService.updateImageTagGroupAttrs(id, updates);
  }

  /**
   * 删除提示词标签组
   * @param id - 标签组 ID
   */
  async deletePromptTagGroup(id: number): Promise<void> {
    return TagIpcService.deletePromptTagGroup(id);
  }

  /**
   * 删除图像标签组
   * @param id - 标签组 ID
   */
  async deleteImageTagGroup(id: number): Promise<void> {
    return TagIpcService.deleteImageTagGroup(id);
  }

  /**
   * 分配提示词标签到所属组
   * @param tagName - 标签名称
   * @param groupId - 组 ID
   */
  async assignPromptTagToBelongGroup(tagName: string, groupId: number | null): Promise<void> {
    return TagIpcService.assignPromptTagToBelongGroup(tagName, groupId);
  }

  /**
   * 分配图像标签到所属组
   * @param tagName - 标签名称
   * @param groupId - 组 ID
   */
  async assignImageTagToBelongGroup(tagName: string, groupId: number | null): Promise<void> {
    return TagIpcService.assignImageTagToBelongGroup(tagName, groupId);
  }

  // ========== 标签操作 ==========

  /**
   * 获取所有提示词标签
   * @returns 标签数组
   */
  async getPromptTags(): Promise<string[]> {
    return TagIpcService.getPromptTags();
  }

  /**
   * 获取所有图像标签
   * @returns 标签数组
   */
  async getImageTags(): Promise<string[]> {
    return TagIpcService.getImageTags();
  }

  /**
   * 添加提示词标签
   * @param tag - 标签名称
   */
  async addPromptTag(tag: string): Promise<void> {
    await TagIpcService.addPromptTag(tag);
  }

  /**
   * 添加图像标签
   * @param tag - 标签名称
   */
  async addImageTag(tag: string): Promise<void> {
    await TagIpcService.addImageTag(tag);
  }

  /**
   * 为提示词添加多个标签
   * @param promptId - 提示词 ID
   * @param tagNames - 标签名称数组
   */
  async addPromptTags(promptId: string, tagNames: string[]): Promise<void> {
    return TagIpcService.addPromptTags(promptId, tagNames);
  }

  /**
   * 为图像添加多个标签
   * @param imageId - 图像 ID
   * @param tagNames - 标签名称数组
   */
  async addImageTags(imageId: string, tagNames: string[]): Promise<void> {
    return TagIpcService.addImageTags(imageId, tagNames);
  }

  /**
   * 删除提示词标签
   * @param tag - 标签名称
   */
  async deletePromptTag(tag: string): Promise<void> {
    return TagIpcService.deletePromptTag(tag);
  }

  /**
   * 删除图像标签
   * @param tag - 标签名称
   */
  async deleteImageTag(tag: string): Promise<void> {
    return TagIpcService.deleteImageTag(tag);
  }

  /**
   * 重命名提示词标签
   * @param oldTag - 原标签名
   * @param newTag - 新标签名
   */
  async renamePromptTag(oldTag: string, newTag: string): Promise<void> {
    return TagIpcService.renamePromptTag(oldTag, newTag);
  }

  /**
   * 重命名图像标签
   * @param oldTag - 原标签名
   * @param newTag - 新标签名
   */
  async renameImageTag(oldTag: string, newTag: string): Promise<void> {
    return TagIpcService.renameImageTag(oldTag, newTag);
  }

  // ========== 通用标签操作 ==========

  /**
   * 获取所有标签（提示词 + 图像）
   * @returns 标签数组
   */
  async getAllTags(): Promise<string[]> {
    return TagIpcService.getAllTags();
  }
}
