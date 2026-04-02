import { DialogService, DialogConfig } from '../services/index.ts';
import { TagService } from './TagService.ts';

interface SimpleTagManagerOptions {
  onSave: (tags: string[], options: SaveOptions) => Promise<void>;
  onRender: (tags: string[]) => void;
  type?: 'image' | 'prompt';
  saveDelay?: number;
}

interface SaveOptions {
  action?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  newTags: string[];
}

interface AddTagResult {
  success: boolean;
}

interface AddTagsResult {
  success: boolean;
  added: number;
}

interface RemoveTagsResult {
  success: boolean;
  deleted: number;
}

/**
 * 简化版标签管理器（用于编辑界面）
 * 负责管理单个目标的标签，支持防抖保存和违规检查
 * 标签组信息从 TagService 获取
 */
export class SimpleTagManager {
  private tags: string[] = [];
  private onSave: (tags: string[], options: SaveOptions) => Promise<void>;
  onRender: (tags: string[]) => void;
  private type: 'image' | 'prompt';
  private saveDelay: number;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private service: TagService;

  constructor(options: SimpleTagManagerOptions) {
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
   * @returns 标签列表副本
   */
  getTags(): string[] {
    return [...this.tags];
  }

  /**
   * 设置标签列表（初始化用）
   * @param tags - 标签列表
   */
  setTags(tags: string[]): void {
    this.tags = [...(tags || [])].filter(t => t && t.trim());
    this.onRender(this.tags);
  }

  /**
   * 添加单个标签
   * @param tagName - 标签名称
   * @returns 添加结果
   */
  async addTag(tagName: string): Promise<AddTagResult> {
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

    this.tags = result.newTags?.filter(t => t && t.trim()) || [];
    this.onRender(this.tags);
    this.debounceSave({ action: 'add' });

    return { success: true };
  }

  /**
   * 批量添加标签
   * @param tagNames - 标签名称数组
   * @returns 批量添加结果
   */
  async addTags(tagNames: string[]): Promise<AddTagsResult> {
    // 批量添加简化为逐个添加
    for (const tagName of tagNames) {
      try {
        await this.addTag(tagName);
      } catch (error) {
        // 跳过失败的标签，继续添加其他标签
        window.electronAPI?.logError?.('SimpleTagManager.ts', 'Failed to add tag:', error);
      }
    }

    return { success: true, added: tagNames.length };
  }

  /**
   * 删除标签
   * @param tagName - 标签名称
   * @returns 是否删除成功
   */
  async removeTag(tagName: string): Promise<boolean> {
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

    this.tags = result.newTags?.filter(t => t && t.trim()) || [];
    this.onRender(this.tags);
    this.debounceSave({ action: 'remove' });

    return true;
  }

  /**
   * 批量删除标签（不弹出确认对话框）
   * @param tagNames - 标签名称数组
   * @returns 批量删除结果
   */
  async removeTags(tagNames: string[]): Promise<RemoveTagsResult> {
    let deleted = 0;
    let currentTags = [...this.tags];

    for (const tagName of tagNames) {
      const trimmedTag = tagName.trim();

      if (!trimmedTag || !currentTags.includes(trimmedTag)) {
        continue;
      }

      const result = await this.service.validateTagRemoval(currentTags, trimmedTag);

      if (!result.valid) {
        continue;
      }

      currentTags = result.newTags?.filter(t => t && t.trim()) || [];
      deleted++;
    }

    if (deleted > 0) {
      this.tags = currentTags;
      this.onRender(this.tags);
      this.debounceSave({ action: 'remove' });
    }

    return { success: true, deleted };
  }

  /**
   * 防抖保存
   * @param options - 保存选项
   */
  debounceSave(options: SaveOptions = {}): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(async () => {
      try {
        await this.onSave(this.tags, options);
      } catch (error) {
        window.electronAPI?.logError?.('SimpleTagManager.ts', 'Failed to save tags:', error);
      }
    }, this.saveDelay);
  }
}

export default SimpleTagManager;
