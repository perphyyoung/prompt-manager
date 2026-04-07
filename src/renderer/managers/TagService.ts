import { Constants } from '../../constants.ts';
import { cacheManager } from '../../utils/CacheManager.ts';
import { ElectronTagApi } from '../services/ElectronTagApi.ts';
import { TagInfo, TagGroupInfo } from '../types/TagTypes.ts';

/**
 * TagApi 接口定义
 */
interface TagApi {
  getPromptTags(): Promise<string[]>;
  getImageTags(): Promise<string[]>;
  getPromptTagGroups(): Promise<TagGroupInfo[]>;
  getImageTagGroups(): Promise<TagGroupInfo[]>;
  addPromptTag(tag: string): Promise<any>;
  addImageTag(tag: string): Promise<any>;
  renamePromptTag(oldTag: string, newTag: string): Promise<any>;
  renameImageTag(oldTag: string, newTag: string): Promise<any>;
  deletePromptTag(tag: string): Promise<any>;
  deleteImageTag(tag: string): Promise<any>;
  assignPromptTagToBelongGroup(tag: string, groupId: number | null): Promise<any>;
  assignImageTagToBelongGroup(tag: string, groupId: number | null): Promise<any>;
  createPromptTagGroup(name: string, sortOrder: number): Promise<any>;
  createImageTagGroup(name: string, sortOrder: number): Promise<any>;
  updatePromptTagGroupAttrs(id: number, attrs: Record<string, any>): Promise<any>;
  updateImageTagGroupAttrs(id: number, attrs: Record<string, any>): Promise<any>;
  deletePromptTagGroup(id: number): Promise<any>;
  deleteImageTagGroup(id: number): Promise<any>;
}

/**
 * 标签验证结果
 */
interface TagValidationResult {
  valid: boolean;
  error?: string;
  newTags?: string[];
}

/**
 * 标签分组结果
 */
interface GroupedTagsResult {
  groupedTags: Record<number, string[]>;
  ungroupedTags: string[];
}

/**
 * 标签服务 - 数据层 + 验证层 + 工具层
 * 封装所有标签相关的 API 调用、验证逻辑和工具函数，使用 CacheManager 缓存
 * 使用单例模式，确保缓存有效
 * 支持依赖注入，便于测试和替换实现
 */
export class TagService {
  private static instances = new Map<string, TagService>();

  private type: string;
  private isPrompt: boolean;
  private api: TagApi;
  cacheKey: string;
  cacheKeyGroups: string;

  /**
   * 获取单例实例
   * @param type - 'prompt' | 'image'
   * @param api - 注入的 API 实现（可选，默认为 ElectronTagApi）
   * @returns TagService 实例
   */
  static getInstance(type: string, api: TagApi | null = null): TagService {
    if (!this.instances.has(type)) {
      // 如果没有传入 api，使用默认的 Electron 实现
      const defaultApi = (api || new ElectronTagApi()) as TagApi;
      this.instances.set(type, new TagService(type, defaultApi));
    }
    return this.instances.get(type)!;
  }

  /**
   * @param type - 类型 ('prompt' | 'image')
   * @param api - API 实现
   */
  constructor(type: string, api: TagApi) {
    this.type = type;
    this.isPrompt = type === 'prompt';
    this.api = api;  // 依赖注入的 API
    this.cacheKey = type === 'prompt' ? 'promptTags' : 'imageTags';
    this.cacheKeyGroups = type === 'prompt' ? 'promptTagGroups' : 'imageTagGroups';
  }

  // ========== 缓存辅助方法 ==========

  private _getFromCache(key: string): any | null {
    const cache = cacheManager.getCache(key);
    if (!cache) return null;
    return cache.get('data')?.data || null;
  }

  private _setCache(key: string, data: any): void {
    const cache = cacheManager.createCache(key, 10);
    cache.set('data', { data, time: Date.now() });
  }

  _clearCache(key: string): void {
    cacheManager.deleteCache(key);
  }

  addTagsToCache(newTags: string[]): void {
    if (!newTags || newTags.length === 0) return;
    const cached = this._getFromCache(this.cacheKey) || [];
    const merged = [...new Set([...cached, ...newTags])];
    this._setCache(this.cacheKey, merged);
  }

  removeTagsFromCache(removedTags: string[]): void {
    if (!removedTags || removedTags.length === 0) return;
    const cached = this._getFromCache(this.cacheKey) || [];
    const filtered = cached.filter((tag: string) => !removedTags.includes(tag));
    this._setCache(this.cacheKey, filtered);
  }

  // ========== 标签 API ==========

  async getTags(): Promise<string[]> {
    const cached = this._getFromCache(this.cacheKey);
    if (cached) return cached;

    const data = await (this.isPrompt
      ? this.api.getPromptTags()
      : this.api.getImageTags());

    this._setCache(this.cacheKey, data);
    return data;
  }

  async getTagGroups(): Promise<TagGroupInfo[]> {
    const cached = this._getFromCache(this.cacheKeyGroups);
    if (cached) return cached;

    const data = await (this.isPrompt
      ? this.api.getPromptTagGroups()
      : this.api.getImageTagGroups());

    this._setCache(this.cacheKeyGroups, data);
    return data;
  }

  async addTag(tag: string): Promise<any> {
    const result = await (this.isPrompt
      ? this.api.addPromptTag(tag)
      : this.api.addImageTag(tag));
    this._clearCache(this.cacheKey);
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  async renameTag(oldTag: string, newTag: string): Promise<any> {
    const result = await (this.isPrompt
      ? this.api.renamePromptTag(oldTag, newTag)
      : this.api.renameImageTag(oldTag, newTag));
    this._clearCache(this.cacheKey);
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  async deleteTag(tag: string): Promise<any> {
    const result = await (this.isPrompt
      ? this.api.deletePromptTag(tag)
      : this.api.deleteImageTag(tag));
    this._clearCache(this.cacheKey);
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  async deleteTags(tags: string[]): Promise<{ success: boolean; deleted: number }> {
    const result = await (this.isPrompt
      ? window.electronAPI.deletePromptTags(tags)
      : window.electronAPI.deleteImageTags(tags));
    this._clearCache(this.cacheKey);
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  async assignTagToGroup(tag: string, groupId: number | null): Promise<any> {
    const result = await (this.isPrompt
      ? this.api.assignPromptTagToBelongGroup(tag, groupId)
      : this.api.assignImageTagToBelongGroup(tag, groupId));
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  // ========== 标签组 API ==========

  async createGroup(name: string, sortOrder: number): Promise<any> {
    const result = await (this.isPrompt
      ? this.api.createPromptTagGroup(name, sortOrder)
      : this.api.createImageTagGroup(name, sortOrder));
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  async updateGroup(groupId: number, attrs: Record<string, any>): Promise<any> {
    const result = await (this.isPrompt
      ? this.api.updatePromptTagGroupAttrs(groupId, attrs)
      : this.api.updateImageTagGroupAttrs(groupId, attrs));
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  async deleteGroup(groupId: number): Promise<any> {
    const result = await (this.isPrompt
      ? this.api.deletePromptTagGroup(groupId)
      : this.api.deleteImageTagGroup(groupId));
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  // ========== 特殊标签配置 ==========

  getSpecialTags(): string[] {
    return this.isPrompt
      ? [...Constants.PROMPT_SPECIAL_TAGS]
      : [...Constants.IMAGE_SPECIAL_TAGS];
  }

  getSpecialTagChecks(): Map<string, (item: any) => boolean> {
    if (this.isPrompt) {
      return new Map([
        [Constants.FAVORITE_TAG, (p: any) => p.isFavorite],
        [Constants.MULTI_IMAGE_TAG, (p: any) => p.images && p.images.length >= 2],
        [Constants.NO_IMAGE_TAG, (p: any) => !p.images || p.images.length === 0],
        [Constants.NO_TAG_TAG, (p: any) => !p.tags || p.tags.length === 0],
        [Constants.SAFE_TAG, (p: any) => p.isSafe !== 0],
        [Constants.UNSAFE_TAG, (p: any) => p.isSafe === 0]
      ]);
    } else {
      return new Map([
        [Constants.FAVORITE_TAG, (img: any) => img.isFavorite],
        [Constants.UNREFERENCED_TAG, (img: any) => !img.promptRefs || img.promptRefs.length === 0],
        [Constants.MULTI_REF_TAG, (img: any) => img.promptRefs && img.promptRefs.length > 1],
        [Constants.NO_TAG_TAG, (img: any) => !img.tags || img.tags.length === 0],
        [Constants.SAFE_TAG, (img: any) => img.isSafe !== 0],
        [Constants.UNSAFE_TAG, (img: any) => img.isSafe === 0]
      ]);
    }
  }

  /**
   * 验证标签是否可以添加
   * @param currentTags - 当前标签列表
   * @param newTag - 新标签名称
   * @returns 验证结果
   */
  async validateTagAddition(currentTags: string[], newTag: string): Promise<TagValidationResult> {
    const trimmedTag = newTag.trim();

    if (!trimmedTag) {
      return { valid: false, error: '标签名称不能为空' };
    }

    if (currentTags.includes(trimmedTag)) {
      return { valid: false, error: '该标签已存在' };
    }

    // 检查是否为特殊标签（禁止手动添加）
    const allSpecialTags = [...Constants.PROMPT_SPECIAL_TAGS, ...Constants.IMAGE_SPECIAL_TAGS];
    if (allSpecialTags.includes(trimmedTag)) {
      return { valid: false, error: `"${trimmedTag}" 是特殊标签，不能手动添加` };
    }

    const newTags = [...currentTags, trimmedTag];

    return {
      valid: true,
      newTags
    };
  }

  /**
   * 验证标签是否可以删除
   * @param currentTags - 当前标签列表
   * @param tagToRemove - 要删除的标签名称
   * @returns 验证结果
   */
  async validateTagRemoval(currentTags: string[], tagToRemove: string): Promise<TagValidationResult> {
    const trimmedTag = tagToRemove.trim();

    if (!trimmedTag) {
      return { valid: false, error: '标签名称不能为空' };
    }

    const newTags = currentTags.filter(t => t !== trimmedTag);

    return {
      valid: true,
      newTags
    };
  }

  // ========== 工具函数（原 tagUtils.js） ==========

  /**
   * 将标签按组分组
   * @param tags - 标签数组
   * @param groups - 标签组（包含 tags 数组）
   * @returns 分组结果
   *   - groupedTags: { [groupId]: string[] }
   *   - ungroupedTags: string[]
   */
  groupTagsByGroup(tags: string[], groups: TagGroupInfo[]): GroupedTagsResult {
    const groupedTags: Record<number, string[]> = {};
    const ungroupedTags: string[] = [];

    // 初始化分组
    groups.forEach(group => {
      groupedTags[group.id] = [];
    });

    // 将标签分配到组
    tags.forEach(tag => {
      let isGrouped = false;
      for (const group of groups) {
        if (group.tags && group.tags.includes(tag)) {
          groupedTags[group.id].push(tag);
          isGrouped = true;
          break;
        }
      }
      if (!isGrouped) {
        ungroupedTags.push(tag);
      }
    });

    return { groupedTags, ungroupedTags };
  }

  /**
   * 构建标签与组的映射
   * @param tags - 标签数组
   * @param groups - 标签组（包含 tags 数组）
   * @returns 带组信息的标签列表
   */
  buildTagsWithGroup(tags: string[], groups: TagGroupInfo[]): TagInfo[] {
    // Special Case Object: 未分组标签的默认结构
    const UNGROUPED_TAG: Omit<TagInfo, 'name'> = {
      groupId: null,
      groupName: '未分组',
      groupSortOrder: Infinity
    };

    return tags.map(tag => {
      for (const group of groups) {
        if (group.tags && group.tags.includes(tag)) {
          return {
            name: tag,
            groupId: group.id,
            groupName: group.name,
            groupSortOrder: group.sortOrder ?? Infinity
          };
        }
      }
      // 返回未分组标签的 Special Case Object
      return {
        name: tag,
        ...UNGROUPED_TAG
      };
    });
  }
}

export default TagService;
