/**
 * PyTagGroups 类型定义
 * 标签组库的核心类型
 */

// ========== 基础类型 ==========

/** 标签名称 */
export type TagName = string;

/** 标签组 ID */
export type TagGroupId = number;

/** 支持的数据类型 */
export type DataType = 'prompt' | 'image';

/** 标签对象 */
export interface Tag {
  name: TagName;
  groupId: TagGroupId | null;
}

/** 带组信息的标签 */
export interface TagWithGroup {
  name: TagName;
  groupId: TagGroupId | null;
  groupName: string;
}

/** 标签组对象 */
export interface TagGroup {
  id: TagGroupId;
  name: string;
  sortOrder: number;
  tags?: TagName[];
}

// ========== 错误类型 ==========

/** 错误代码 */
export type ErrorCode =
  | 'RESERVED' // 系统保留标签
  | 'EXISTS' // 已存在
  | 'INVALID' // 无效名称
  | 'PERMISSION' // 权限不足
  | 'NOT_FOUND'; // 不存在

/** 错误信息 */
export interface TagError {
  tag: TagName;
  error: string;
  code: ErrorCode;
}

// ========== 操作结果类型 ==========

/** 标签操作结果 */
export interface TagOperationResult {
  success: boolean;
  created: TagName[]; // 成功创建的标签
  skipped: TagName[]; // 已存在被跳过的标签
  errors: TagError[]; // 错误的标签
}

/** 删除操作结果 */
export interface TagDeleteResult {
  deleted: number;
  errors: TagError[];
}

// ========== 选项类型 ==========

/** 创建标签选项 */
export interface TagCreateOptions {
  /** 默认分配到的组 */
  defaultGroupId?: TagGroupId | null;
}

/** 查询标签选项 */
export interface TagQueryOptions {
  /** 排序方式 */
  sortBy?: 'name' | 'count';
}

// ========== 验证结果类型 ==========

/** 验证结果 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: ErrorCode;
}

// ========== 异常类型 ==========

/** 标签操作基础异常 */
export class TagOperationError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly tag?: TagName
  ) {
    super(message);
    this.name = 'TagOperationError';
  }
}

/** 标签已存在异常 */
export class TagExistsError extends TagOperationError {
  constructor(tag: TagName) {
    super(`标签 "${tag}" 已存在`, 'EXISTS', tag);
    this.name = 'TagExistsError';
  }
}

/** 标签不存在异常 */
export class TagNotFoundError extends TagOperationError {
  constructor(tag: TagName) {
    super(`标签 "${tag}" 不存在`, 'NOT_FOUND', tag);
    this.name = 'TagNotFoundError';
  }
}

/** 无效标签名异常 */
export class InvalidTagNameError extends TagOperationError {
  constructor(tag: TagName, reason: string) {
    super(`无效的标签名 "${tag}": ${reason}`, 'INVALID', tag);
    this.name = 'InvalidTagNameError';
  }
}

/** 保留标签异常 */
export class ReservedTagError extends TagOperationError {
  constructor(tag: TagName) {
    super(`标签 "${tag}" 是系统保留标签，无法修改`, 'RESERVED', tag);
    this.name = 'ReservedTagError';
  }
}

/** 标签组不存在异常 */
export class TagGroupNotFoundError extends TagOperationError {
  constructor(groupId: TagGroupId) {
    super(`标签组 ID ${groupId} 不存在`, 'NOT_FOUND');
    this.name = 'TagGroupNotFoundError';
  }
}

// ========== TopGroupManager 类型 ==========

/** 标签信息 */
export interface TagInfo {
  name: string;
  groupId: number | null;
  groupName: string;
  groupSortOrder?: number;
}

/** 带计数的标签 */
export interface TagWithCount extends TagInfo {
  count: number;
}

/** 首位组信息 */
export interface TopGroupInfo {
  groupId: number;
  groupName: string;
  groupSortOrder: number;
  tags: TagWithCount[];
}

/** 头部标签项 */
export interface HeaderTagItem {
  tag: string;
  count: number;
  className: string;
  isSpecial: boolean;
  isTopGroup: boolean;
}

/** 特殊标签信息 */
export interface SpecialTagInfo {
  tag: string;
  count: number;
}

/** 标签排序配置 */
export interface TagSortConfig {
  sortBy: 'name' | 'count';
  sortOrder: 'asc' | 'desc';
}
