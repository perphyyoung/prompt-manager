/**
 * 标签写操作用例服务
 * 收口"仓库写 + 主进程全标签缓存同步"的编排。
 * 不变量:任何标签写操作后,get-all-tags 的缓存与数据库一致。
 * (修复点:此前 delete/rename 不更新缓存,改名/删除后自动完成数据漂移到重启为止)
 * 一致性策略:写后全量重建(标签写低频,全量查询成本可忽略,且增量同步正是漂移根源)。
 */

export interface TagMutationTagsPort {
  addPromptTag: (name: string, groupId: number | null) => Promise<number | null>;
  addPromptTags: (promptId: string, tagNames: string[]) => Promise<void>;
  addPromptTagsBatch: (
    promptIds: string[],
    tagNames: string[],
  ) => Promise<{ success: boolean; added: number }>;
  deletePromptTag: (name: string) => Promise<void>;
  deletePromptTags: (names: string[]) => Promise<{ success: boolean; deleted: number }>;
  addImageTag: (name: string, groupId: number | null) => Promise<void>;
  addImageTags: (imageId: string, tagNames: string[]) => Promise<void>;
  addImageTagsBatch: (
    imageIds: string[],
    tagNames: string[],
  ) => Promise<{ success: boolean; added: number }>;
  deleteImageTag: (name: string) => Promise<void>;
  deleteImageTags: (names: string[]) => Promise<{ success: boolean; deleted: number }>;
  renameTag: (type: "prompt" | "image", oldTag: string, newTag: string) => Promise<string[]>;
  getPromptTags: () => Promise<string[]>;
  getImageTags: () => Promise<string[]>;
}

export interface TagMutationCachePort {
  /** 全量重建标签缓存(写操作后调用) */
  refreshAll: () => Promise<void>;
}

export class TagMutationService {
  constructor(private readonly deps: { tags: TagMutationTagsPort; cache: TagMutationCachePort }) {}

  // ========== prompt 侧 ==========

  async addPromptTag(tag: string): Promise<string[]> {
    await this.deps.tags.addPromptTag(tag, null);
    await this.deps.cache.refreshAll();
    return await this.deps.tags.getPromptTags();
  }

  async addPromptTags(promptId: string, tagNames: string[]): Promise<boolean> {
    await this.deps.tags.addPromptTags(promptId, tagNames);
    await this.deps.cache.refreshAll();
    return true;
  }

  async addPromptTagsBatch(promptIds: string[], tagNames: string[]) {
    const result = await this.deps.tags.addPromptTagsBatch(promptIds, tagNames);
    await this.deps.cache.refreshAll();
    return result;
  }

  async deletePromptTag(tag: string): Promise<string[]> {
    await this.deps.tags.deletePromptTag(tag);
    await this.deps.cache.refreshAll();
    return await this.deps.tags.getPromptTags();
  }

  async deletePromptTags(tags: string[]) {
    const result = await this.deps.tags.deletePromptTags(tags);
    await this.deps.cache.refreshAll();
    return { ...result, tags: await this.deps.tags.getPromptTags() };
  }

  async renamePromptTag(oldTag: string, newTag: string): Promise<string[]> {
    const result = await this.deps.tags.renameTag("prompt", oldTag, newTag);
    await this.deps.cache.refreshAll();
    return result;
  }

  // ========== image 侧 ==========

  async addImageTag(tag: string): Promise<string[]> {
    await this.deps.tags.addImageTag(tag, null);
    await this.deps.cache.refreshAll();
    return await this.deps.tags.getImageTags();
  }

  async addImageTags(imageId: string, tagNames: string[]): Promise<boolean> {
    await this.deps.tags.addImageTags(imageId, tagNames);
    await this.deps.cache.refreshAll();
    return true;
  }

  async addImageTagsBatch(imageIds: string[], tagNames: string[]) {
    const result = await this.deps.tags.addImageTagsBatch(imageIds, tagNames);
    await this.deps.cache.refreshAll();
    return result;
  }

  async deleteImageTag(tag: string): Promise<boolean> {
    await this.deps.tags.deleteImageTag(tag);
    await this.deps.cache.refreshAll();
    return true;
  }

  async deleteImageTags(tags: string[]) {
    const result = await this.deps.tags.deleteImageTags(tags);
    await this.deps.cache.refreshAll();
    return result;
  }

  async renameImageTag(oldTag: string, newTag: string): Promise<string[]> {
    const result = await this.deps.tags.renameTag("image", oldTag, newTag);
    await this.deps.cache.refreshAll();
    return result;
  }
}
