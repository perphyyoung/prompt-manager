import type { Page } from "@playwright/test";

/**
 * 测试数据工厂抽象基类
 * 封装通用逻辑：name 生成、batch 创建、标签创建
 */
export abstract class BaseTestDataFactory<T> {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 生成测试名称
   * 格式：e2e_{label}_{timestamp}_{random}
   */
  protected generateName(label: string): string {
    return `e2e_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * 批量创建内部实现
   */
  protected async _batchCreate(
    count: number,
    label: string,
    createFn: (label: string) => Promise<T>,
  ): Promise<T[]> {
    const items: T[] = [];
    for (let i = 0; i < count; i++) {
      const item = await createFn(`${label}_${i}`);
      items.push(item);
    }
    return items;
  }

  /**
   * 批量创建独立标签
   */
  protected async _createTags(
    count: number,
    label: string,
    addTagFn: (tagName: string) => Promise<void>,
  ): Promise<string[]> {
    const tags: string[] = [];
    for (let i = 0; i < count; i++) {
      const tagName = this.generateName(`${label}_${i}`);
      await addTagFn(tagName);
      tags.push(tagName);
    }
    return tags;
  }

  /**
   * 关联标签到实体（子类实现）
   */
  protected abstract _linkTagsToEntity(entityId: string, tagNames: string[]): Promise<void>;

  /**
   * 创建单个标签（子类实现）
   */
  abstract createTag(tagName: string): Promise<void>;

  /**
   * 获取现有标签组列表（子类实现）
   */
  protected abstract _getTagGroups(): Promise<
    Array<{ id: number; name: string; sortOrder: number }>
  >;

  /**
   * 调用创建标签组 API（子类实现）
   */
  protected abstract _createTagGroupApi(
    name: string,
    sortOrder: number,
  ): Promise<{ id: number; name: string; sortOrder: number } | null>;

  /**
   * 将标签分配到标签组（子类实现）
   */
  protected abstract _assignTagToGroup(tagName: string, groupId: number): Promise<void>;

  /**
   * 创建标签组
   * @param name - 组名称
   * @param isTop - 是否为首位组（true 时自动取现有最小 sortOrder - 1）
   */
  async createTagGroup(
    name: string,
    isTop?: boolean,
  ): Promise<{ id: number; name: string; sortOrder: number }> {
    let finalSortOrder = 0;

    if (isTop) {
      const groups = await this._getTagGroups();
      const minSortOrder = groups.length > 0 ? Math.min(...groups.map((g) => g.sortOrder)) : 0;
      finalSortOrder = minSortOrder - 1;
    }

    const group = await this._createTagGroupApi(name, finalSortOrder);

    if (!group || !group.id) {
      throw new Error(`Failed to create tag group: ${name}`);
    }

    return group;
  }

  /**
   * 创建标签组并在其中创建一个标签
   * @param groupName - 组名称
   * @param tagLabel - 标签后缀（将生成 e2e_{tagLabel}_{timestamp}_{random} 格式的名称）
   * @param isTop - 是否为首位组
   * @returns 创建的标签组信息和标签名
   */
  async createTagInGroup(
    groupName: string,
    tagLabel: string,
    isTop?: boolean,
  ): Promise<{ group: { id: number; name: string; sortOrder: number }; tagName: string }> {
    const tagName = this.generateName(tagLabel);
    await this.createTag(tagName);
    const group = await this.createTagGroup(groupName, isTop);
    await this._assignTagToGroup(tagName, group.id);
    return { group, tagName };
  }

  /**
   * 调用 Electron API
   */
  protected async callApi<R>(apiCall: (electronAPI: any) => Promise<R>): Promise<R> {
    return await this.page.evaluate(async (fn: any) => {
      return await fn(window.electronAPI);
    }, apiCall as any);
  }
}
