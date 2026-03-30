/**
 * 标签基础信息
 */
export interface TagInfo {
  name: string;
  groupId: number | null;
  groupName: string;
  groupType?: string;
  groupSortOrder?: number;
}

/**
 * 带计数的标签信息
 */
export interface TagWithCount extends TagInfo {
  count: number;
}

/**
 * 标签组信息（来自数据库）
 */
export interface TagGroupInfo {
  id: number;
  name: string;
  sortOrder: number;
  tags: string[];
}

/**
 * 首位组信息（内部使用）
 */
export interface TopGroupInfo {
  groupId: number;
  groupName: string;
  groupSortOrder: number;
  tags: TagWithCount[];
}

/**
 * 头部显示的标签项
 */
export interface HeaderTagItem {
  tag: string;
  count: number;
  className: string;
  isSpecial: boolean;
  isTopGroup: boolean;
}

/**
 * 特殊标签信息
 */
export interface SpecialTagInfo {
  tag: string;
  count: number;
}

/**
 * 排序配置
 */
export interface TagSortConfig {
  sortBy: 'name' | 'count';
  sortOrder: 'asc' | 'desc';
}
