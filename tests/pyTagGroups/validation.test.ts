/**
 * PyTagGroups validation 模块单元测试
 */

import { describe, it, expect } from "vitest";
import {
  validateTagCreate,
  validateTagDelete,
  validateTagRename,
  validateGroupName,
} from "../../src/pyTagGroups/validation.ts";

describe("validation", () => {
  describe("validateTagCreate", () => {
    const existingTags = ["existing1", "existing2"];

    it("should validate valid tag", () => {
      const result = validateTagCreate("newtag", existingTags);
      expect(result.valid).toBe(true);
    });

    it("should reject empty tag", () => {
      const result = validateTagCreate("", existingTags);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID");
    });

    it("should reject whitespace only tag", () => {
      const result = validateTagCreate("   ", existingTags);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID");
    });

    it("should reject existing tag", () => {
      const result = validateTagCreate("existing1", existingTags);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("EXISTS");
    });

    it("should trim tag before validation", () => {
      const result = validateTagCreate("  existing1  ", existingTags);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("EXISTS");
    });
  });

  describe("validateTagDelete", () => {
    const existingTags = ["tag1", "tag2"];

    it("should validate existing tag", () => {
      const result = validateTagDelete("tag1", existingTags);
      expect(result.valid).toBe(true);
    });

    it("should reject empty tag", () => {
      const result = validateTagDelete("", existingTags);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID");
    });

    it("should reject non-existing tag", () => {
      const result = validateTagDelete("nonexistent", existingTags);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("NOT_FOUND");
    });

    it("should trim tag before validation", () => {
      const result = validateTagDelete("  tag1  ", existingTags);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateTagRename", () => {
    const existingTags = ["oldtag", "othertag"];

    it("should validate valid rename", () => {
      const result = validateTagRename("oldtag", "newtag", existingTags);
      expect(result.valid).toBe(true);
    });

    it("should reject empty old name", () => {
      const result = validateTagRename("", "newtag", existingTags);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID");
    });

    it("should reject empty new name", () => {
      const result = validateTagRename("oldtag", "", existingTags);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID");
    });

    it("should reject same name", () => {
      const result = validateTagRename("oldtag", "oldtag", existingTags);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID");
    });

    it("should reject non-existing old tag", () => {
      const result = validateTagRename("nonexistent", "newtag", existingTags);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("NOT_FOUND");
    });

    it("should reject existing new tag", () => {
      const result = validateTagRename("oldtag", "othertag", existingTags);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("EXISTS");
    });

    it("should trim names before validation", () => {
      const result = validateTagRename("  oldtag  ", "  newtag  ", existingTags);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateGroupName", () => {
    it("should validate valid name", () => {
      const result = validateGroupName("Group Name");
      expect(result.valid).toBe(true);
    });

    it("should reject empty name", () => {
      const result = validateGroupName("   ");
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID");
    });
  });
});
