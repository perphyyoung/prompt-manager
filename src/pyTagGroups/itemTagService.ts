/**
 * 项目标签关联服务
 * 统一处理标签创建与项目关联的复合操作
 */

import type { DataType, TagOperationResult, TagCreateOptions } from "./types.ts";
import { createTags } from "./operations.ts";

/** 关联选项 */
export interface LinkTagsOptions {
  /** 标签名称或数组 */
  tagNames: string | string[];
  /** 数据类型 */
  type: DataType;
  /** 项目ID（可选，如果提供则关联到项目） */
  itemId?: string;
  /** 多个项目ID（批量关联，优先级高于 itemId） */
  itemIds?: string[];
  /** 创建标签选项 */
  createOptions?: TagCreateOptions;
}

/** 关联结果 */
export interface LinkTagsResult extends TagOperationResult {
  /** 是否已关联到项目 */
  linkedToItem: boolean;
  /** 关联的项目数量 */
  linkedItemCount: number;
}

/**
 * 添加标签并可选关联到项目
 * 核心函数：统一处理所有标签添加场景
 *
 * @param options - 关联选项
 * @returns 操作结果
 *
 * @example
 * // 仅创建标签
 * await linkTags({ tagNames: ['tag1'], type: 'image' });
 *
 * // 创建并关联到单个项目
 * await linkTags({ tagNames: ['tag1'], type: 'image', itemId: '123' });
 *
 * // 创建并关联到多个项目
 * await linkTags({ tagNames: ['tag1'], type: 'image', itemIds: ['1', '2', '3'] });
 */
export async function linkTags(options: LinkTagsOptions): Promise<LinkTagsResult> {
  const { tagNames, type, itemId, itemIds, createOptions } = options;

  // 1. 标准化标签名
  const names = normalizeTagNames(tagNames);
  if (names.length === 0) {
    return createEmptyResult();
  }

  // 2. 创建标签
  const createResult = await createTags(type, names, createOptions);

  // 3. 关联到项目（如果有）- 包括新创建的和已存在的标签
  const allTagsToLink = [...createResult.created, ...createResult.skipped];
  const linkResult = await linkToItems(type, allTagsToLink, itemId, itemIds);

  return {
    ...createResult,
    linkedToItem: linkResult.linked,
    linkedItemCount: linkResult.count,
  };
}

// ========== 辅助函数 ==========

/**
 * 标准化标签名数组
 */
function normalizeTagNames(tagNames: string | string[]): string[] {
  const names = Array.isArray(tagNames) ? tagNames : [tagNames];
  return names.map((n) => n.trim()).filter((n) => n.length > 0);
}

/**
 * 关联标签到项目
 */
async function linkToItems(
  type: DataType,
  tagNames: string[],
  itemId?: string,
  itemIds?: string[],
): Promise<{ linked: boolean; count: number }> {
  if (tagNames.length === 0) {
    return { linked: false, count: 0 };
  }

  // 合并项目ID
  const targetIds: string[] = [];
  if (itemId) targetIds.push(itemId);
  if (itemIds) targetIds.push(...itemIds);

  if (targetIds.length === 0) {
    return { linked: false, count: 0 };
  }

  // 去重
  const uniqueIds = [...new Set(targetIds)];

  // 集合级批量关联：单次 IPC + 主进程事务内集合 SQL，
  // 替代逐项目循环（万级全选场景下从 N 次 IPC 降为 1 次）
  if (type === "image") {
    await window.electronAPI.addImageTagsBatch(uniqueIds, tagNames);
  } else {
    await window.electronAPI.addPromptTagsBatch(uniqueIds, tagNames);
  }

  return { linked: true, count: uniqueIds.length };
}

/**
 * 创建空结果
 */
function createEmptyResult(): LinkTagsResult {
  return {
    success: true,
    created: [],
    skipped: [],
    errors: [],
    linkedToItem: false,
    linkedItemCount: 0,
  };
}
