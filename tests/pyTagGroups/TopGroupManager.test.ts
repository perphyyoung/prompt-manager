import { describe, it, expect } from "vitest";
import { TopGroupManager } from "../../src/pyTagGroups/TopGroupManager";
import { TagInfo, SpecialTagInfo } from "../../src/pyTagGroups/types";
import { TagUI } from "../../src/renderer/managers/TagUI";

describe("TopGroupManager", () => {
  describe("sortTagsWithGroupPriority", () => {
    it("应按 groupSortOrder 排序标签，首位组在前", () => {
      const tags: TagInfo[] = [
        { name: "tag1", groupId: null, groupName: "未分组", groupSortOrder: undefined },
        { name: "tag2", groupId: 2, groupName: "组2", groupSortOrder: 2 },
        { name: "tag3", groupId: 1, groupName: "组1", groupSortOrder: 1 },
      ];
      const tagCounts = { tag1: 1, tag2: 1, tag3: 1 };

      const result = TopGroupManager.sortTagsWithGroupPriority(tags, tagCounts, {
        sortBy: "name",
        sortOrder: "asc",
      });

      expect(result[0].name).toBe("tag3"); // groupSortOrder=1
      expect(result[1].name).toBe("tag2"); // groupSortOrder=2
      expect(result[2].name).toBe("tag1"); // 未分组
    });

    it("同一组内应按名称排序", () => {
      const tags: TagInfo[] = [
        { name: "b-tag", groupId: 1, groupName: "组1", groupSortOrder: 1 },
        { name: "a-tag", groupId: 1, groupName: "组1", groupSortOrder: 1 },
      ];
      const tagCounts = { "b-tag": 1, "a-tag": 1 };

      const result = TopGroupManager.sortTagsWithGroupPriority(tags, tagCounts, {
        sortBy: "name",
        sortOrder: "asc",
      });

      expect(result[0].name).toBe("a-tag");
      expect(result[1].name).toBe("b-tag");
    });

    it("同一组内应按计数排序", () => {
      const tags: TagInfo[] = [
        { name: "high", groupId: 1, groupName: "组1", groupSortOrder: 1 },
        { name: "low", groupId: 1, groupName: "组1", groupSortOrder: 1 },
      ];
      const tagCounts = { high: 10, low: 5 };

      const result = TopGroupManager.sortTagsWithGroupPriority(tags, tagCounts, {
        sortBy: "count",
        sortOrder: "asc",
      });

      expect(result[0].name).toBe("low");
      expect(result[1].name).toBe("high");
    });

    it("降序排序应正确工作", () => {
      const tags: TagInfo[] = [
        { name: "tag1", groupId: 1, groupName: "组1", groupSortOrder: 1 },
        { name: "tag2", groupId: 1, groupName: "组1", groupSortOrder: 1 },
      ];
      const tagCounts = { tag1: 1, tag2: 2 };

      const result = TopGroupManager.sortTagsWithGroupPriority(tags, tagCounts, {
        sortBy: "count",
        sortOrder: "desc",
      });

      expect(result[0].name).toBe("tag2");
      expect(result[1].name).toBe("tag1");
    });
  });

  describe("buildGroupMap", () => {
    it("应正确构建组映射", () => {
      const allGroups = [
        { id: 1, name: "组1", sortOrder: 1 },
        { id: 2, name: "组2", sortOrder: 2 },
      ];
      const tags: TagInfo[] = [
        { name: "tag1", groupId: 1, groupName: "组1", groupSortOrder: 1 },
        { name: "tag2", groupId: 1, groupName: "组1", groupSortOrder: 1 },
        { name: "tag3", groupId: 2, groupName: "组2", groupSortOrder: 2 },
      ];
      const tagCounts = { tag1: 5, tag2: 3, tag3: 2 };

      const result = TopGroupManager.buildGroupMap(allGroups, tags, tagCounts);

      expect(result.size).toBe(2);
      expect(result.get(1)?.tags.length).toBe(2);
      expect(result.get(2)?.tags.length).toBe(1);
      expect(result.get(1)?.groupName).toBe("组1");
    });

    it("应包含空组", () => {
      const allGroups = [
        { id: 1, name: "组1", sortOrder: 1 },
        { id: 2, name: "空组", sortOrder: 2 },
      ];
      const tags: TagInfo[] = [{ name: "tag1", groupId: 1, groupName: "组1", groupSortOrder: 1 }];
      const tagCounts = { tag1: 1 };

      const result = TopGroupManager.buildGroupMap(allGroups, tags, tagCounts);

      expect(result.size).toBe(2);
      expect(result.get(1)?.tags.length).toBe(1);
      expect(result.get(2)?.tags.length).toBe(0); // 空组
    });

    it("未分组的标签不应加入组映射", () => {
      const allGroups = [{ id: 1, name: "组1", sortOrder: 1 }];
      const tags: TagInfo[] = [
        { name: "tag1", groupId: null, groupName: "未分组" },
        { name: "tag2", groupId: 1, groupName: "组1", groupSortOrder: 1 },
      ];
      const tagCounts = { tag1: 1, tag2: 1 };

      const result = TopGroupManager.buildGroupMap(allGroups, tags, tagCounts);

      expect(result.size).toBe(1);
      expect(result.get(1)?.tags.length).toBe(1);
    });
  });

  describe("getTopGroup", () => {
    it("应返回第一个组（包括空组）", () => {
      const allGroups = [
        { id: 1, name: "组1", sortOrder: 1 },
        { id: 2, name: "组2", sortOrder: 2 },
      ];
      const tags: TagInfo[] = [
        { name: "tag1", groupId: 2, groupName: "组2", groupSortOrder: 2 },
        { name: "tag2", groupId: 1, groupName: "组1", groupSortOrder: 1 },
      ];
      const tagCounts = { tag1: 1, tag2: 1 };
      const groupMap = TopGroupManager.buildGroupMap(allGroups, tags, tagCounts);

      const result = TopGroupManager.getTopGroup(groupMap);

      expect(result?.groupId).toBe(1);
      expect(result?.groupName).toBe("组1");
    });

    it("空组也可以作为首位组", () => {
      const allGroups = [
        { id: 1, name: "空组", sortOrder: 1 },
        { id: 2, name: "组2", sortOrder: 2 },
      ];
      const tags: TagInfo[] = [{ name: "tag1", groupId: 2, groupName: "组2", groupSortOrder: 2 }];
      const tagCounts = { tag1: 1 };
      const groupMap = TopGroupManager.buildGroupMap(allGroups, tags, tagCounts);

      const result = TopGroupManager.getTopGroup(groupMap);

      expect(result?.groupId).toBe(1); // 空组是首位组
      expect(result?.groupName).toBe("空组");
    });

    it("空组映射应返回 null", () => {
      const groupMap = new Map();

      const result = TopGroupManager.getTopGroup(groupMap);

      expect(result).toBeNull();
    });
  });

  describe("collectHeaderTags", () => {
    it("应收集特殊标签", () => {
      const specialTags: SpecialTagInfo[] = [{ tag: "收藏", count: 5 }];
      const allGroups: Array<{ id: number; name: string; sortOrder?: number }> = [];
      const tags: TagInfo[] = [];
      const tagCounts = { 收藏: 5 };
      const selectedTags = new Set<string>();
      const allSpecialTags = ["收藏", "无图", "无标"];

      const result = TopGroupManager.collectHeaderTags(
        specialTags,
        allGroups,
        tags,
        tagCounts,
        selectedTags,
        allSpecialTags,
      );

      expect(result.length).toBe(1);
      expect(result[0].tag).toBe("收藏");
      expect(result[0].isSpecial).toBe(true);
    });

    it("应收集首位组标签", () => {
      const specialTags: SpecialTagInfo[] = [];
      const allGroups = [{ id: 1, name: "组1", sortOrder: 1 }];
      const tags: TagInfo[] = [{ name: "tag1", groupId: 1, groupName: "组1", groupSortOrder: 1 }];
      const tagCounts = { tag1: 3 };
      const selectedTags = new Set<string>();
      const allSpecialTags: string[] = [];

      const result = TopGroupManager.collectHeaderTags(
        specialTags,
        allGroups,
        tags,
        tagCounts,
        selectedTags,
        allSpecialTags,
      );

      expect(result.length).toBe(1);
      expect(result[0].tag).toBe("tag1");
      expect(result[0].isTopGroup).toBe(true);
    });

    it("计数为0的标签也应该被收集", () => {
      const specialTags: SpecialTagInfo[] = [];
      const allGroups = [{ id: 1, name: "组1", sortOrder: 1 }];
      const tags: TagInfo[] = [{ name: "tag1", groupId: 1, groupName: "组1", groupSortOrder: 1 }];
      const tagCounts = { tag1: 0 };
      const selectedTags = new Set<string>();
      const allSpecialTags: string[] = [];

      const result = TopGroupManager.collectHeaderTags(
        specialTags,
        allGroups,
        tags,
        tagCounts,
        selectedTags,
        allSpecialTags,
      );

      expect(result.length).toBe(1);
      expect(result[0].tag).toBe("tag1");
      expect(result[0].count).toBe(0);
      expect(result[0].isTopGroup).toBe(true);
    });

    it("选中的普通标签应被收集", () => {
      const specialTags: SpecialTagInfo[] = [];
      const allGroups = [{ id: 1, name: "组1", sortOrder: 1 }];
      const tags: TagInfo[] = [{ name: "tag1", groupId: 1, groupName: "组1", groupSortOrder: 1 }];
      const tagCounts = { tag1: 3 };
      const selectedTags = new Set<string>(["tag1"]);
      const allSpecialTags: string[] = [];

      const result = TopGroupManager.collectHeaderTags(
        specialTags,
        allGroups,
        tags,
        tagCounts,
        selectedTags,
        allSpecialTags,
      );

      expect(result.length).toBe(1);
      expect(result[0].className).toBe("active");
    });

    it("特殊标签不应被重复收集", () => {
      const specialTags: SpecialTagInfo[] = [{ tag: "收藏", count: 5 }];
      const allGroups = [{ id: 1, name: "组1", sortOrder: 1 }];
      const tags: TagInfo[] = [{ name: "收藏", groupId: 1, groupName: "组1", groupSortOrder: 1 }];
      const tagCounts = { 收藏: 5 };
      const selectedTags = new Set<string>(["收藏"]);
      const allSpecialTags = ["收藏"];

      const result = TopGroupManager.collectHeaderTags(
        specialTags,
        allGroups,
        tags,
        tagCounts,
        selectedTags,
        allSpecialTags,
      );

      const collectionTags = result.filter((r) => r.tag === "收藏");
      expect(collectionTags.length).toBe(1);
    });

    it("首位组标签应正确标记 isTopGroup", () => {
      const specialTags: SpecialTagInfo[] = [];
      const allGroups = [
        { id: 1, name: "组1", sortOrder: 1 },
        { id: 2, name: "组2", sortOrder: 2 },
      ];
      const tags: TagInfo[] = [
        { name: "topTag", groupId: 1, groupName: "组1", groupSortOrder: 1 },
        { name: "otherTag", groupId: 2, groupName: "组2", groupSortOrder: 2 },
      ];
      const tagCounts = { topTag: 3, otherTag: 2 };
      const selectedTags = new Set<string>(["otherTag"]);
      const allSpecialTags: string[] = [];

      const result = TopGroupManager.collectHeaderTags(
        specialTags,
        allGroups,
        tags,
        tagCounts,
        selectedTags,
        allSpecialTags,
      );

      const topTag = result.find((r) => r.tag === "topTag");
      const otherTag = result.find((r) => r.tag === "otherTag");

      expect(topTag?.isTopGroup).toBe(true);
      expect(otherTag?.isTopGroup).toBe(false);
    });

    it("首位组为空时应返回空", () => {
      const specialTags: SpecialTagInfo[] = [];
      const allGroups = [
        { id: 1, name: "空组", sortOrder: 1 },
        { id: 2, name: "组2", sortOrder: 2 },
      ];
      const tags: TagInfo[] = [{ name: "tag1", groupId: 2, groupName: "组2", groupSortOrder: 2 }];
      const tagCounts = { tag1: 3 };
      const selectedTags = new Set<string>();
      const allSpecialTags: string[] = [];

      const result = TopGroupManager.collectHeaderTags(
        specialTags,
        allGroups,
        tags,
        tagCounts,
        selectedTags,
        allSpecialTags,
      );

      // 首位组是空组，没有标签可收集
      expect(result.length).toBe(0);
    });
  });
});

describe("TagUI - renderExpandedFilter", () => {
  describe("首位组标签显示", () => {
    it("首位组所有标签都应显示，包括计数为0的", () => {
      const tags: TagInfo[] = [
        { name: "tag1", groupId: 1, groupName: "首位组", groupSortOrder: 1 },
        { name: "tag2", groupId: 1, groupName: "首位组", groupSortOrder: 1 },
        { name: "tag3", groupId: 2, groupName: "其他组", groupSortOrder: 2 },
      ];
      const counts = { tag1: 5, tag2: 0, tag3: 3 };
      const groups = [
        { id: 1, name: "首位组", sortOrder: 1 },
        { id: 2, name: "其他组", sortOrder: 2 },
      ];

      const html = TagUI.renderExpandedFilter(tags, counts, {
        specialTags: [],
        selectedTags: new Set(),
        groups: groups,
        isImage: false,
      });

      expect(html).toContain("tag1");
      expect(html).toContain("tag2");
      expect(html).toContain("tag3");
    });

    it("空组也可以作为首位组", () => {
      const tags: TagInfo[] = [{ name: "tag1", groupId: 2, groupName: "组2", groupSortOrder: 2 }];
      const counts = { tag1: 5 };
      const groups = [
        { id: 1, name: "空组", sortOrder: 1 },
        { id: 2, name: "组2", sortOrder: 2 },
      ];

      const html = TagUI.renderExpandedFilter(tags, counts, {
        specialTags: [],
        selectedTags: new Set(),
        groups: groups,
        isImage: false,
      });

      // 首位组是空组，只有组2的标签显示
      expect(html).toContain("组2");
      expect(html).toContain("tag1");
    });

    it("首位组计数为0的标签应显示计数0", () => {
      const tags: TagInfo[] = [
        { name: "emptyTag", groupId: 1, groupName: "首位组", groupSortOrder: 1 },
      ];
      const counts = { emptyTag: 0 };
      const groups = [{ id: 1, name: "首位组", sortOrder: 1 }];

      const html = TagUI.renderExpandedFilter(tags, counts, {
        specialTags: [],
        selectedTags: new Set(),
        groups: groups,
        isImage: false,
      });

      expect(html).toContain("emptyTag");
      expect(html).toContain(">0<");
    });

    it("非首位组计数为0的标签不应显示", () => {
      const tags: TagInfo[] = [
        { name: "topTag", groupId: 1, groupName: "首位组", groupSortOrder: 1 },
        { name: "emptyTag", groupId: 2, groupName: "其他组", groupSortOrder: 2 },
      ];
      const counts = { topTag: 5, emptyTag: 0 };
      const groups = [
        { id: 1, name: "首位组", sortOrder: 1 },
        { id: 2, name: "其他组", sortOrder: 2 },
      ];

      const html = TagUI.renderExpandedFilter(tags, counts, {
        specialTags: [],
        selectedTags: new Set(),
        groups: groups,
        isImage: false,
      });

      expect(html).toContain("topTag");
      expect(html).not.toContain("emptyTag");
    });

    it("首位组所有标签计数为0时仍应显示该组", () => {
      const tags: TagInfo[] = [
        { name: "tag1", groupId: 1, groupName: "首位组", groupSortOrder: 1 },
        { name: "tag2", groupId: 1, groupName: "首位组", groupSortOrder: 1 },
      ];
      const counts = { tag1: 0, tag2: 0 };
      const groups = [{ id: 1, name: "首位组", sortOrder: 1 }];

      const html = TagUI.renderExpandedFilter(tags, counts, {
        specialTags: [],
        selectedTags: new Set(),
        groups: groups,
        isImage: false,
      });

      expect(html).toContain("首位组");
      expect(html).toContain("tag1");
      expect(html).toContain("tag2");
    });

    it("首位组标签应支持选中状态", () => {
      const tags: TagInfo[] = [
        { name: "selectedTag", groupId: 1, groupName: "首位组", groupSortOrder: 1 },
      ];
      const counts = { selectedTag: 3 };
      const groups = [{ id: 1, name: "首位组", sortOrder: 1 }];

      const html = TagUI.renderExpandedFilter(tags, counts, {
        specialTags: [],
        selectedTags: new Set(["selectedTag"]),
        groups: groups,
        isImage: false,
      });

      expect(html).toContain("active");
      expect(html).toContain("selectedTag");
    });

    it("首位组标签应支持拖拽属性", () => {
      const tags: TagInfo[] = [
        { name: "dragTag", groupId: 1, groupName: "首位组", groupSortOrder: 1 },
      ];
      const counts = { dragTag: 3 };
      const groups = [{ id: 1, name: "首位组", sortOrder: 1 }];

      const html = TagUI.renderExpandedFilter(tags, counts, {
        specialTags: [],
        selectedTags: new Set(),
        groups: groups,
        isImage: true,
      });

      expect(html).toContain('draggable="true"');
      expect(html).toContain('data-drag-type="image-tag"');
    });
  });
});
