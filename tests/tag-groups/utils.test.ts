/**
 * PyTagGroups utils 模块单元测试
 */

import { describe, it, expect } from "vitest";
import {
  diffTags,
  normalizeTag,
  hasTag,
  groupTagsByGroup,
  buildTagsWithGroupInfo,
  filterNewTags,
  filterExistingTags,
} from "../../src/lib/tag-groups/utils.ts";
import type { TagGroup } from "../../src/lib/tag-groups/types.ts";

describe("utils", () => {
  describe("diffTags", () => {
    it("should remove tags from array", () => {
      expect(diffTags(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
    });

    it("should handle non-existent tags", () => {
      expect(diffTags(["a", "b"], ["c"])).toEqual(["a", "b"]);
    });

    it("should handle empty arrays", () => {
      expect(diffTags([], ["a"])).toEqual([]);
      expect(diffTags(["a", "b"], [])).toEqual(["a", "b"]);
    });
  });

  describe("normalizeTag", () => {
    it("should trim whitespace", () => {
      expect(normalizeTag("  tag  ")).toBe("tag");
    });

    it("should return empty string for whitespace only", () => {
      expect(normalizeTag("   ")).toBe("");
    });
  });

  describe("hasTag", () => {
    it("should return true for existing tag", () => {
      expect(hasTag(["a", "b", "c"], "b")).toBe(true);
    });

    it("should return false for non-existing tag", () => {
      expect(hasTag(["a", "b", "c"], "d")).toBe(false);
    });

    it("should trim tag before checking", () => {
      expect(hasTag(["a", "b", "c"], "  b  ")).toBe(true);
    });
  });

  describe("groupTagsByGroup", () => {
    const groups: TagGroup[] = [
      { id: 1, name: "Group 1", sortOrder: 1, tags: ["a", "b"] },
      { id: 2, name: "Group 2", sortOrder: 2, tags: ["c"] },
    ];

    it("should group tags by group", () => {
      const result = groupTagsByGroup(["a", "b", "c"], groups);
      expect(result.grouped[1]).toEqual(["a", "b"]);
      expect(result.grouped[2]).toEqual(["c"]);
      expect(result.ungrouped).toEqual([]);
    });

    it("should identify ungrouped tags", () => {
      const result = groupTagsByGroup(["a", "d"], groups);
      expect(result.grouped[1]).toEqual(["a"]);
      expect(result.ungrouped).toEqual(["d"]);
    });

    it("should handle empty tags", () => {
      const result = groupTagsByGroup([], groups);
      expect(result.grouped[1]).toEqual([]);
      expect(result.ungrouped).toEqual([]);
    });

    it("should handle empty groups", () => {
      const result = groupTagsByGroup(["a", "b"], []);
      expect(result.ungrouped).toEqual(["a", "b"]);
    });

    it("should handle groups without tags property", () => {
      const groupsWithoutTags: TagGroup[] = [{ id: 1, name: "Group 1", sortOrder: 1 }];
      const result = groupTagsByGroup(["a"], groupsWithoutTags);
      expect(result.ungrouped).toEqual(["a"]);
    });
  });

  describe("buildTagsWithGroupInfo", () => {
    const groups: TagGroup[] = [
      { id: 1, name: "Group 1", sortOrder: 1, tags: ["a", "b"] },
      { id: 2, name: "Group 2", sortOrder: 2, tags: ["c"] },
    ];

    it("should build tags with group info", () => {
      const result = buildTagsWithGroupInfo(["a", "c"], groups);
      expect(result[0]).toEqual({ name: "a", groupId: 1, groupName: "Group 1", groupSortOrder: 1 });
      expect(result[1]).toEqual({ name: "c", groupId: 2, groupName: "Group 2", groupSortOrder: 2 });
    });

    it("should handle ungrouped tags", () => {
      const result = buildTagsWithGroupInfo(["d"], groups);
      expect(result[0]).toEqual({
        name: "d",
        groupId: null,
        groupName: "",
        groupSortOrder: Infinity,
      });
    });
  });

  describe("filterNewTags", () => {
    it("should return only new tags", () => {
      expect(filterNewTags(["a", "b", "c"], ["a", "b"])).toEqual(["c"]);
    });

    it("should return empty array if all exist", () => {
      expect(filterNewTags(["a", "b"], ["a", "b", "c"])).toEqual([]);
    });
  });

  describe("filterExistingTags", () => {
    it("should return only existing tags", () => {
      expect(filterExistingTags(["a", "b", "c"], ["a", "b"])).toEqual(["a", "b"]);
    });

    it("should return empty array if none exist", () => {
      expect(filterExistingTags(["a", "b"], ["c", "d"])).toEqual([]);
    });
  });
});
