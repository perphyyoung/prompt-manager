import {
  TagInfo,
  TagWithCount,
  TopGroupInfo,
  HeaderTagItem,
  SpecialTagInfo,
  TagSortConfig,
} from "./types";

/**
 * 首位组管理器
 * 统一管理首位组的识别、排序和标签收集
 */
export class TopGroupManager {
  /**
   * 按组优先级排序标签
   * 首位组的标签排在最前面，组内按指定规则排序
   */
  static sortTagsWithGroupPriority(
    tags: TagInfo[],
    tagCounts: Record<string, number>,
    config: TagSortConfig,
  ): TagInfo[] {
    const sorted = [...tags];
    const order = config.sortOrder === "asc" ? 1 : -1;

    sorted.sort((a, b) => {
      // 首先按组排序：有组的排在无组前面，组按 groupSortOrder 排序
      const groupOrderA = a.groupSortOrder ?? Infinity;
      const groupOrderB = b.groupSortOrder ?? Infinity;
      if (groupOrderA !== groupOrderB) {
        return groupOrderA - groupOrderB;
      }

      // 同一组内按当前排序规则排序
      const countA = tagCounts[a.name] || 0;
      const countB = tagCounts[b.name] || 0;
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();

      if (config.sortBy === "count") {
        if (countA !== countB) {
          return (countA - countB) * order;
        }
        return nameA.localeCompare(nameB);
      } else if (config.sortBy === "name") {
        return nameA.localeCompare(nameB) * order;
      }
      return 0;
    });

    return sorted;
  }

  /**
   * 构建组映射
   * @param allGroups 所有组（包括空组）
   * @param tags 标签列表
   * @param tagCounts 标签计数
   */
  static buildGroupMap(
    allGroups: Array<{ id: number; name: string; sortOrder?: number }>,
    tags: TagInfo[],
    tagCounts: Record<string, number>,
  ): Map<number, TopGroupInfo> {
    const groupMap = new Map<number, TopGroupInfo>();

    // 首先注册所有组（包括空组）
    allGroups.forEach((group) => {
      groupMap.set(group.id, {
        groupId: group.id,
        groupName: group.name,
        groupSortOrder: group.sortOrder ?? 0,
        tags: [],
      });
    });

    // 然后填充标签
    tags.forEach((tag) => {
      const count = tagCounts[tag.name] || 0;
      if (tag.groupId && groupMap.has(tag.groupId)) {
        groupMap.get(tag.groupId)!.tags.push({ ...tag, count });
      }
    });

    return groupMap;
  }

  /**
   * 获取排序后的组列表（包括空组）
   */
  static getSortedGroups(groupMap: Map<number, TopGroupInfo>): TopGroupInfo[] {
    return Array.from(groupMap.values()).sort((a, b) => a.groupSortOrder - b.groupSortOrder);
  }

  /**
   * 获取首位组
   */
  static getTopGroup(groupMap: Map<number, TopGroupInfo>): TopGroupInfo | null {
    return this.getSortedGroups(groupMap)[0] ?? null;
  }

  /**
   * 收集头部显示的标签
   * 包括特殊标签和首位组标签
   */
  static collectHeaderTags(
    specialTags: SpecialTagInfo[],
    allGroups: Array<{ id: number; name: string; sortOrder?: number }>,
    sortedTags: TagInfo[],
    tagCounts: Record<string, number>,
    selectedTags: Set<string>,
    allSpecialTags: string[],
  ): HeaderTagItem[] {
    const tagsToShow: HeaderTagItem[] = [];
    const selectedSet = selectedTags;

    // 添加特殊标签
    specialTags.forEach(({ tag, count }) => {
      const isActive = selectedSet.has(tag);
      tagsToShow.push({
        tag,
        count,
        className: isActive ? "active" : "",
        isSpecial: true,
        isTopGroup: false,
      });
    });

    // 构建组映射并获取首位组
    const groupMap = this.buildGroupMap(allGroups, sortedTags, tagCounts);
    const topGroup = this.getTopGroup(groupMap);
    const topGroupId = topGroup?.groupId ?? null;

    // 添加首位组标签（包括计数为0的标签）
    if (topGroup) {
      topGroup.tags.forEach((tagInfo: TagWithCount) => {
        if (!tagsToShow.some((t) => t.tag === tagInfo.name)) {
          const isActive = selectedSet.has(tagInfo.name);
          tagsToShow.push({
            tag: tagInfo.name,
            count: tagInfo.count,
            className: isActive ? "active" : "",
            isSpecial: false,
            isTopGroup: true,
          });
        }
      });
    }

    // 添加选中的普通标签
    const tagToGroupMap = new Map<string, { groupId: number; groupSortOrder: number }>();
    sortedTags.forEach((t) => {
      if (t.groupId && !tagToGroupMap.has(t.name)) {
        tagToGroupMap.set(t.name, {
          groupId: t.groupId,
          groupSortOrder: t.groupSortOrder || 0,
        });
      }
    });

    selectedSet.forEach((tag) => {
      if (!tagsToShow.some((t) => t.tag === tag) && !allSpecialTags.includes(tag)) {
        const count = tagCounts[tag] || 0;
        const groupInfo = tagToGroupMap.get(tag);
        const isInTopGroup = groupInfo?.groupId === topGroupId;

        tagsToShow.push({
          tag,
          count,
          className: "active",
          isSpecial: false,
          isTopGroup: isInTopGroup,
        });
      }
    });

    return tagsToShow;
  }
}
