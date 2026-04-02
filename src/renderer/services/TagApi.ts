/**
 * 标签 API 接口定义
 * 定义标签操作的契约，用于依赖注入
 */

// 标签组接口
export interface TagGroup {
  id: number;
  name: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

// 标签信息接口
export interface TagInfo {
  id?: number;
  name: string;
  count?: number;
  groupId?: number | null;
}

// 标签组更新属性
export interface TagGroupUpdates {
  name?: string;
  sortOrder?: number;
}

/**
 * 标签 API 抽象类
 * 定义标签操作的契约，用于依赖注入
 */
export abstract class TagApi {
  // ========== 标签组操作 ==========

  /**
   * 获取所有提示词标签组
   * @returns 标签组数组
   */
  abstract getPromptTagGroups(): Promise<TagGroup[]>;

  /**
   * 获取所有图像标签组
   * @returns 标签组数组
   */
  abstract getImageTagGroups(): Promise<TagGroup[]>;

  /**
   * 创建提示词标签组
   * @param name - 组名称
   * @param sortOrder - 排序序号
   * @returns 创建的标签组
   */
  abstract createPromptTagGroup(name: string, sortOrder: number): Promise<TagGroup>;

  /**
   * 创建图像标签组
   * @param name - 组名称
   * @param sortOrder - 排序序号
   * @returns 创建的标签组
   */
  abstract createImageTagGroup(name: string, sortOrder: number): Promise<TagGroup>;

  /**
   * 更新提示词标签组属性
   * @param id - 标签组 ID
   * @param updates - 要更新的属性
   */
  abstract updatePromptTagGroupAttrs(id: number, updates: TagGroupUpdates): Promise<void>;

  /**
   * 更新图像标签组属性
   * @param id - 标签组 ID
   * @param updates - 要更新的属性
   */
  abstract updateImageTagGroupAttrs(id: number, updates: TagGroupUpdates): Promise<void>;

  /**
   * 删除提示词标签组
   * @param id - 标签组 ID
   */
  abstract deletePromptTagGroup(id: number): Promise<void>;

  /**
   * 删除图像标签组
   * @param id - 标签组 ID
   */
  abstract deleteImageTagGroup(id: number): Promise<void>;

  /**
   * 分配提示词标签到所属组
   * @param tagName - 标签名称
   * @param groupId - 组 ID
   */
  abstract assignPromptTagToBelongGroup(tagName: string, groupId: number | null): Promise<void>;

  /**
   * 分配图像标签到所属组
   * @param tagName - 标签名称
   * @param groupId - 组 ID
   */
  abstract assignImageTagToBelongGroup(tagName: string, groupId: number | null): Promise<void>;

  // ========== 标签操作 ==========

  /**
   * 获取所有提示词标签
   * @returns 标签数组
   */
  abstract getPromptTags(): Promise<string[]>;

  /**
   * 获取所有图像标签
   * @returns 标签数组
   */
  abstract getImageTags(): Promise<string[]>;

  /**
   * 添加提示词标签
   * @param tag - 标签名称
   */
  abstract addPromptTag(tag: string): Promise<void>;

  /**
   * 添加图像标签
   * @param tag - 标签名称
   */
  abstract addImageTag(tag: string): Promise<void>;

  /**
   * 为提示词添加多个标签
   * @param promptId - 提示词 ID
   * @param tagNames - 标签名称数组
   */
  abstract addPromptTags(promptId: string, tagNames: string[]): Promise<void>;

  /**
   * 为图像添加多个标签
   * @param imageId - 图像 ID
   * @param tagNames - 标签名称数组
   */
  abstract addImageTags(imageId: string, tagNames: string[]): Promise<void>;

  /**
   * 删除提示词标签
   * @param tag - 标签名称
   */
  abstract deletePromptTag(tag: string): Promise<void>;

  /**
   * 删除图像标签
   * @param tag - 标签名称
   */
  abstract deleteImageTag(tag: string): Promise<void>;

  /**
   * 重命名提示词标签
   * @param oldTag - 原标签名
   * @param newTag - 新标签名
   */
  abstract renamePromptTag(oldTag: string, newTag: string): Promise<void>;

  /**
   * 重命名图像标签
   * @param oldTag - 原标签名
   * @param newTag - 新标签名
   */
  abstract renameImageTag(oldTag: string, newTag: string): Promise<void>;

  // ========== 通用标签操作 ==========

  /**
   * 获取所有标签（提示词 + 图像）
   * @returns 标签数组
   */
  abstract getAllTags(): Promise<string[]>;
}
