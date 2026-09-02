/**
 * PyTagGroups 工具函数
 * 标签相关的纯工具函数，无副作用
 */

import type { TagName, TagGroup, TagGroupId } from "./types.ts";

/**
 * 计算标签差集
 * @param current - 当前标签数组
 * @param removed - 要移除的标签数组
 * @returns 移除后的标签数组
 */
export function diffTags(current: TagName[], removed: TagName[]): TagName[] {
  return current.filter((t) => !removed.includes(t));
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
  groups: TagGroup[],
): { grouped: Record<TagGroupId, TagName[]>; ungrouped: TagName[] } {
  const grouped: Record<TagGroupId, TagName[]> = {};
  const ungrouped: TagName[] = [];

  // 初始化分组
  groups.forEach((group) => {
    grouped[group.id] = [];
  });

  // 将标签分配到组
  tags.forEach((tag) => {
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
  groups: TagGroup[],
): Array<{ name: TagName; groupId: TagGroupId | null; groupName: string; groupSortOrder: number }> {
  const result = tags.map((tag) => {
    for (const group of groups) {
      if (group.tags && group.tags.includes(tag)) {
        return {
          name: tag,
          groupId: group.id,
          groupName: group.name,
          groupSortOrder: group.sortOrder || 0,
        };
      }
    }
    return {
      name: tag,
      groupId: null,
      groupName: "",
      groupSortOrder: Infinity,
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
  return tags.filter((tag) => !existing.includes(tag));
}

/**
 * 过滤已存在的标签（返回存在的）
 * @param tags - 要检查的标签
 * @param existing - 已存在的标签
 * @returns 已存在的标签
 */
export function filterExistingTags(tags: TagName[], existing: TagName[]): TagName[] {
  return tags.filter((tag) => existing.includes(tag));
}
