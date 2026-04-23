/**
 * PyTagGroups 工具函数
 * 标签相关的纯工具函数，无副作用
 */

import type { TagName, TagGroup, TagGroupId, Tag } from './types.ts';

/**
 * 解析标签输入（支持批量）
 * 支持逗号、中文逗号、空格分隔
 * @param input - 输入字符串
 * @returns 标签数组
 */
export function parseTagInput(input: string): TagName[] {
  return input
    .replace(/^[，,]+|[，,]+$/g, '')
    .split(/[,，\s]+/)
    .map(t => t.trim())
    .filter(t => t);
}

/**
 * 计算标签差集
 * @param current - 当前标签数组
 * @param removed - 要移除的标签数组
 * @returns 移除后的标签数组
 */
export function diffTags(current: TagName[], removed: TagName[]): TagName[] {
  return current.filter(t => !removed.includes(t));
}

/**
 * 标准化标签名称
 * 去除首尾空格
 * @param tag - 标签字符串
 * @returns 标准化后的标签名称
 */
export function normalizeTag(tag: string): TagName {
  return tag.trim();
}

/**
 * 检查标签是否在数组中
 * @param tags - 标签数组
 * @param tag - 要检查的标签
 * @returns 是否存在
 */
export function hasTag(tags: TagName[], tag: TagName): boolean {
  return tags.includes(tag.trim());
}

/**
 * 按组分组标签
 * @param tags - 标签数组
 * @param groups - 标签组数组
 * @returns 分组结果
 */
export function groupTagsByGroup(
  tags: TagName[],
  groups: TagGroup[]
): { grouped: Record<TagGroupId, TagName[]>; ungrouped: TagName[] } {
  const grouped: Record<TagGroupId, TagName[]> = {};
  const ungrouped: TagName[] = [];

  // 初始化分组
  groups.forEach(group => {
    grouped[group.id] = [];
  });

  // 将标签分配到组
  tags.forEach(tag => {
    let isGrouped = false;
    for (const group of groups) {
      if (group.tags && group.tags.includes(tag)) {
        grouped[group.id].push(tag);
        isGrouped = true;
        break;
      }
    }
    if (!isGrouped) {
      ungrouped.push(tag);
    }
  });

  return { grouped, ungrouped };
}

/**
 * 构建带组信息的标签列表
 * @param tags - 标签数组
 * @param groups - 标签组数组
 * @returns 带组信息的标签列表
 */
export function buildTagsWithGroupInfo(
  tags: TagName[],
  groups: TagGroup[]
): Array<{ name: TagName; groupId: TagGroupId | null; groupName: string; groupSortOrder: number }> {
  const result = tags.map(tag => {
    for (const group of groups) {
      if (group.tags && group.tags.includes(tag)) {
        return {
          name: tag,
          groupId: group.id,
          groupName: group.name,
          groupSortOrder: group.sortOrder || 0
        };
      }
    }
    return {
      name: tag,
      groupId: null,
      groupName: '',
      groupSortOrder: Infinity
    };
  });

  return result;
}

/**
 * 过滤已存在的标签
 * @param tags - 要检查的标签
 * @param existing - 已存在的标签
 * @returns 不存在的标签（新标签）
 */
export function filterNewTags(tags: TagName[], existing: TagName[]): TagName[] {
  return tags.filter(tag => !existing.includes(tag));
}

/**
 * 按标签使用计数排序
 * @param tags - 标签数组
 * @param counts - 标签计数映射
 * @returns 排序后的标签数组
 */
export function sortTagsByCount(
  tags: TagName[],
  counts: Record<TagName, number>
): TagName[] {
  return [...tags].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
}

/**
 * 过滤已存在的标签（返回存在的）
 * @param tags - 要检查的标签
 * @param existing - 已存在的标签
 * @returns 已存在的标签
 */
export function filterExistingTags(tags: TagName[], existing: TagName[]): TagName[] {
  return tags.filter(tag => existing.includes(tag));
}

/**
 * 将标签名数组转换为 Tag 对象数组
 * @param tagNames - 标签名数组
 * @param groups - 标签组数组
 * @returns Tag 对象数组
 */
export function toTagObjects(
  tagNames: TagName[],
  groups: TagGroup[]
): Tag[] {
  const tagGroupMap = new Map<TagName, TagGroupId | null>();

  // 构建标签到组的映射
  for (const group of groups) {
    if (group.tags) {
      for (const tag of group.tags) {
        tagGroupMap.set(tag, group.id);
      }
    }
  }

  // 转换为 Tag 对象
  return tagNames.map(name => ({
    name,
    groupId: tagGroupMap.get(name) || null
  }));
}

/**
 * 从 Tag 对象数组提取标签名数组
 * @param tags - Tag 对象数组
 * @returns 标签名数组
 */
export function fromTagObjects(tags: Tag[]): TagName[] {
  return tags.map(t => t.name);
}
