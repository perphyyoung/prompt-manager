/**
 * TagRegistry 接口定义
 * 用于类型严格检查，确保所有 TagRegistry 实现类都有必需的方法
 */

export interface ITagRegistry {
  /** 渲染标签管理器 */
  render(searchTerm?: string): Promise<void>;

  /** 刷新标签数据 */
  refresh(): Promise<void>;

  /** 添加标签 */
  addTag(tag: string): Promise<void>;

  /** 删除标签 */
  deleteTag(tag: string): Promise<void>;

  /** 更新标签 */
  updateTag(oldTag: string, newTag: string): Promise<void>;

  /** 获取所有标签 */
  getTags(): Promise<string[]>;

  /** 绑定事件 */
  bindEvents(container: HTMLElement): void;

  /** 在管理器中添加标签 */
  addTagInManager(): void;

  /** 类型 */
  type: string;

  /** 排序字段 */
  sortBy: string;

  /** 排序顺序 */
  sortOrder: 'asc' | 'desc';
}
