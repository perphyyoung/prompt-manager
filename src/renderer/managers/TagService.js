import { Constants } from '../../constants.js';
import { cacheManager } from '../../utils/CacheManager.js';
import { TagIpcService } from '../services/TagIpcService.js';
import { ElectronTagApi } from '../services/ElectronTagApi.js';

/**
 * 标签服务 - 数据层 + 验证层 + 工具层
 * 封装所有标签相关的 API 调用、验证逻辑和工具函数，使用 CacheManager 缓存
 * 使用单例模式，确保缓存有效
 * 支持依赖注入，便于测试和替换实现
 */
export class TagService {
  static instances = new Map();
  
  /**
   * 获取单例实例
   * @param {string} type - 'prompt' | 'image'
   * @param {TagApi} api - 注入的 API 实现（可选，默认为 ElectronTagApi）
   * @returns {TagService}
   */
  static getInstance(type, api = null) {
    if (!this.instances.has(type)) {
      // 如果没有传入 api，使用默认的 Electron 实现
      const defaultApi = api || new ElectronTagApi();
      this.instances.set(type, new TagService(type, defaultApi));
    }
    return this.instances.get(type);
  }

  /**
   * @param {string} type - 类型 ('prompt' | 'image')
   * @param {TagApi} api - API 实现
   */
  constructor(type, api) {
    this.type = type;
    this.isPrompt = type === 'prompt';
    this.api = api;  // 依赖注入的 API
    this.cacheKey = type === 'prompt' ? 'promptTags' : 'imageTags';
    this.cacheKeyGroups = type === 'prompt' ? 'promptTagGroups' : 'imageTagGroups';
  }

  // ========== 缓存辅助方法 ==========

  _getFromCache(key) {
    const cache = cacheManager.getCache(key);
    if (!cache) return null;
    return cache.get('data')?.data || null;
  }

  _setCache(key, data) {
    const cache = cacheManager.createCache(key, 10);
    cache.set('data', { data, time: Date.now() });
  }

  _clearCache(key) {
    cacheManager.deleteCache(key);
  }

  addTagsToCache(newTags) {
    if (!newTags || newTags.length === 0) return;
    const cached = this._getFromCache(this.cacheKey) || [];
    const merged = [...new Set([...cached, ...newTags])];
    this._setCache(this.cacheKey, merged);
  }

  removeTagsFromCache(removedTags) {
    if (!removedTags || removedTags.length === 0) return;
    const cached = this._getFromCache(this.cacheKey) || [];
    const filtered = cached.filter(tag => !removedTags.includes(tag));
    this._setCache(this.cacheKey, filtered);
  }

  // ========== 标签 API ==========

  async getTags() {
    const cached = this._getFromCache(this.cacheKey);
    if (cached) return cached;

    const data = await (this.isPrompt
      ? this.api.getPromptTags()
      : this.api.getImageTags());

    this._setCache(this.cacheKey, data);
    return data;
  }

  async getTagGroups() {
    const cached = this._getFromCache(this.cacheKeyGroups);
    if (cached) return cached;

    const data = await (this.isPrompt
      ? this.api.getPromptTagGroups()
      : this.api.getImageTagGroups());

    this._setCache(this.cacheKeyGroups, data);
    return data;
  }

  async addTag(tag) {
    const result = await (this.isPrompt
      ? this.api.addPromptTag(tag)
      : this.api.addImageTag(tag));
    this._clearCache(this.cacheKey);
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  async renameTag(oldTag, newTag) {
    const result = await (this.isPrompt
      ? this.api.renamePromptTag(oldTag, newTag)
      : this.api.renameImageTag(oldTag, newTag));
    this._clearCache(this.cacheKey);
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  async deleteTag(tag) {
    const result = await (this.isPrompt
      ? this.api.deletePromptTag(tag)
      : this.api.deleteImageTag(tag));
    this._clearCache(this.cacheKey);
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  async assignTagToGroup(tag, groupId) {
    const result = await (this.isPrompt
      ? this.api.assignPromptTagToBelongGroup(tag, groupId)
      : this.api.assignImageTagToBelongGroup(tag, groupId));
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  // ========== 标签组 API ==========

  async createGroup(name, sortOrder) {
    const result = await (this.isPrompt
      ? this.api.createPromptTagGroup(name, sortOrder)
      : this.api.createImageTagGroup(name, sortOrder));
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  async updateGroup(groupId, attrs) {
    const result = await (this.isPrompt
      ? this.api.updatePromptTagGroupAttrs(groupId, attrs)
      : this.api.updateImageTagGroupAttrs(groupId, attrs));
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  async deleteGroup(groupId) {
    const result = await (this.isPrompt
      ? this.api.deletePromptTagGroup(groupId)
      : this.api.deleteImageTagGroup(groupId));
    this._clearCache(this.cacheKeyGroups);
    return result;
  }

  // ========== 特殊标签配置 ==========

  getSpecialTags() {
    return this.isPrompt
      ? [...Constants.PROMPT_SPECIAL_TAGS]
      : [...Constants.IMAGE_SPECIAL_TAGS];
  }

  getSpecialTagChecks() {
    if (this.isPrompt) {
      return new Map([
        [Constants.FAVORITE_TAG, (p) => p.isFavorite],
        [Constants.MULTI_IMAGE_TAG, (p) => p.images && p.images.length >= 2],
        [Constants.NO_IMAGE_TAG, (p) => !p.images || p.images.length === 0],
        [Constants.NO_TAG_TAG, (p) => !p.tags || p.tags.length === 0],
        [Constants.SAFE_TAG, (p) => p.isSafe !== 0],
        [Constants.UNSAFE_TAG, (p) => p.isSafe === 0]
      ]);
    } else {
      return new Map([
        [Constants.FAVORITE_TAG, (img) => img.isFavorite],
        [Constants.UNREFERENCED_TAG, (img) => !img.promptRefs || img.promptRefs.length === 0],
        [Constants.MULTI_REF_TAG, (img) => img.promptRefs && img.promptRefs.length > 1],
        [Constants.NO_TAG_TAG, (img) => !img.tags || img.tags.length === 0],
        [Constants.SAFE_TAG, (img) => img.isSafe !== 0],
        [Constants.UNSAFE_TAG, (img) => img.isSafe === 0]
      ]);
    }
  }

  /**
   * 验证标签是否可以添加
   * @param {string[]} currentTags - 当前标签列表
   * @param {string} newTag - 新标签名称
   * @returns {{valid: boolean, error?: string, newTags?: string[]}}
   */
  async validateTagAddition(currentTags, newTag) {
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
   * @param {string[]} currentTags - 当前标签列表
   * @param {string} tagToRemove - 要删除的标签名称
   * @returns {{valid: boolean, error?: string, newTags?: string[]}}
   */
  async validateTagRemoval(currentTags, tagToRemove) {
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
   * @param {Array} tags - 标签数组
   * @param {Array} groups - 标签组（包含 tags 数组）
   * @returns {Object} { groupedTags, ungroupedTags }
   *   - groupedTags: { [groupId]: string[] }
   *   - ungroupedTags: string[]
   */
  groupTagsByGroup(tags, groups) {
    const groupedTags = {};
    const ungroupedTags = [];

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
   * @param {Array} tags - 标签数组
   * @param {Array} groups - 标签组（包含 tags 数组）
   * @returns {Array} 带组信息的标签列表
   *   - { name: string, groupId: string|null, groupName: string }
   */
  buildTagsWithGroup(tags, groups) {
    return tags.map(tag => {
      for (const group of groups) {
        if (group.tags && group.tags.includes(tag)) {
          return {
            name: tag,
            groupId: group.id,
            groupName: group.name
          };
        }
      }
      return {
        name: tag,
        groupId: null,
        groupName: '未分组'
      };
    });
  }
}

export default TagService;
