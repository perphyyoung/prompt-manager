import { DialogService, DialogConfig } from '../services/index.js';
import { TagService } from './TagService.js';

/**
 * 简化版标签管理器（用于编辑界面）
 * 负责管理单个目标的标签，支持防抖保存和违规检查
 * 标签组信息从 TagService 获取
 */
export class SimpleTagManager {
  /**
   * @param {Object} options - 配置选项
   * @param {Function} options.onSave - 保存回调 (tags, options) => Promise<void>
   * @param {Function} options.onRender - 渲染回调 (tags) => void
   * @param {string} options.type - 'image' | 'prompt'，决定从哪个服务获取标签组
   * @param {number} options.saveDelay - 防抖延迟（毫秒），默认 800
   */
  constructor(options) {
    this.tags = [];
    this.onSave = options.onSave;
    this.onRender = options.onRender;
    this.type = options.type || 'image';
    this.saveDelay = options.saveDelay || 800;
    this.saveTimer = null;
    this.service = TagService.getInstance(this.type);
  }

  /**
   * 获取当前标签列表
   * @returns {string[]} - 标签列表副本
   */
  getTags() {
    return [...this.tags];
  }

  /**
   * 设置标签列表（初始化用）
   * @param {string[]} tags - 标签列表
   */
  setTags(tags) {
    this.tags = [...(tags || [])].filter(t => t && t.trim());
    this.onRender(this.tags);
  }

  /**
   * 添加单个标签
   * @param {string} tagName - 标签名称
   * @returns {Promise<Object>} - { success: boolean, hasViolation: boolean, violationGroup?: string }
   */
  async addTag(tagName) {
    const trimmedTag = tagName.trim();
    
    if (!trimmedTag) {
      throw new Error('标签名称不能为空');
    }
    
    if (this.tags.includes(trimmedTag)) {
      throw new Error('该标签已存在');
    }

    const result = await this.service.validateTagAddition(this.tags, trimmedTag);

    if (!result.valid) {
      throw new Error(result.error);
    }

    this.tags = result.newTags.filter(t => t && t.trim());
    this.onRender(this.tags);
    this.debounceSave({ 
      action: 'add', 
      hasViolation: result.hasViolation, 
      violationGroup: result.violationGroup 
    });

    return { 
      success: true, 
      hasViolation: result.hasViolation, 
      violationGroup: result.violationGroup 
    };
  }

  /**
   * 批量添加标签
   * @param {string[]} tagNames - 标签名称数组
   * @returns {Promise<{success: boolean, added: number, hasViolation: boolean, violationGroups: string[]}>}
   */
  async addTags(tagNames) {
    // 批量添加简化为逐个添加
    let hasViolation = false;
    const violationGroups = [];
    
    for (const tagName of tagNames) {
      try {
        const result = await this.addTag(tagName);
        if (result.hasViolation) {
          hasViolation = true;
          if (result.violationGroup && !violationGroups.includes(result.violationGroup)) {
            violationGroups.push(result.violationGroup);
          }
        }
      } catch (error) {
        // 跳过失败的标签，继续添加其他标签
        window.electronAPI.logError('SimpleTagManager.js', 'Failed to add tag:', error);
      }
    }

    return { 
      success: true, 
      added: tagNames.length, 
      hasViolation, 
      violationGroups 
    };
  }

  /**
   * 删除标签
   * @param {string} tagName - 标签名称
   * @returns {Promise<boolean>}
   */
  async removeTag(tagName) {
    const trimmedTag = tagName.trim();
    
    if (!trimmedTag) {
      throw new Error('标签名称不能为空');
    }
    
    if (!this.tags.includes(trimmedTag)) {
      throw new Error('标签不存在');
    }

    // 显示确认对话框
    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.DELETE_TAG,
      { name: trimmedTag }
    );
    
    if (!confirmed) return false;

    const result = await this.service.validateTagRemoval(this.tags, trimmedTag);

    if (!result.valid) {
      throw new Error(result.error);
    }

    this.tags = result.newTags.filter(t => t && t.trim());
    this.onRender(this.tags);
    this.debounceSave({ action: 'remove' });

    return true;
  }

  /**
   * 防抖保存
   * @param {Object} options - 保存选项
   */
  debounceSave(options = {}) {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    this.saveTimer = setTimeout(async () => {
      try {
        await this.onSave(this.tags, options);
      } catch (error) {
        window.electronAPI.logError('SimpleTagManager.js', 'Failed to save tags:', error);
      }
    }, this.saveDelay);
  }
}

export default SimpleTagManager;
