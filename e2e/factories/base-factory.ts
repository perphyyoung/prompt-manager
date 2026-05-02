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
   * 调用 Electron API
   */
  protected async callApi<R>(apiCall: (electronAPI: any) => Promise<R>): Promise<R> {
    return await this.page.evaluate(async (fn: any) => {
      return await fn(window.electronAPI);
    }, apiCall as any);
  }
}
