/**
 * PyTagGroups operations 模块单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTags,
  createTag,
  renameTag,
  deleteTag,
  assignTagToGroup,
  getTagGroups,
  createTagGroup,
  updateTagGroup,
  deleteTagGroup,
} from "../../src/lib/tag-groups/operations.ts";
import { TagExistsError, InvalidTagNameError } from "../../src/lib/tag-groups/types.ts";

// Mock cacheManager
vi.mock("../../src/utils/CacheManager.ts", () => ({
  cacheManager: {
    getCache: vi.fn().mockReturnValue(null),
    createCache: vi.fn().mockReturnValue({
      set: vi.fn(),
      get: vi.fn().mockReturnValue(null),
      clear: vi.fn(),
    }),
  },
}));

describe("operations", () => {
  let mockElectronAPI: any;

  beforeEach(() => {
    mockElectronAPI = {
      getPromptTags: vi.fn().mockResolvedValue(["tag1", "tag2"]),
      getImageTags: vi.fn().mockResolvedValue(["img1", "img2"]),
      addPromptTag: vi.fn().mockResolvedValue(undefined),
      addImageTag: vi.fn().mockResolvedValue(undefined),
      renamePromptTag: vi.fn().mockResolvedValue(undefined),
      renameImageTag: vi.fn().mockResolvedValue(undefined),
      deletePromptTag: vi.fn().mockResolvedValue(undefined),
      deleteImageTag: vi.fn().mockResolvedValue(undefined),
      getPromptTagGroups: vi.fn().mockResolvedValue([{ id: 1, name: "Group 1", sortOrder: 1 }]),
      getImageTagGroups: vi
        .fn()
        .mockResolvedValue([{ id: 1, name: "Image Group 1", sortOrder: 1 }]),
      createPromptTagGroup: vi.fn().mockResolvedValue({ id: 2, name: "New Group", sortOrder: 2 }),
      createImageTagGroup: vi
        .fn()
        .mockResolvedValue({ id: 2, name: "New Image Group", sortOrder: 2 }),
      updatePromptTagGroupAttrs: vi.fn().mockResolvedValue(undefined),
      updateImageTagGroupAttrs: vi.fn().mockResolvedValue(undefined),
      deletePromptTagGroup: vi.fn().mockResolvedValue(undefined),
      deleteImageTagGroup: vi.fn().mockResolvedValue(undefined),
      assignPromptTagToBelongGroup: vi.fn().mockResolvedValue(undefined),
      assignImageTagToBelongGroup: vi.fn().mockResolvedValue(undefined),
      getPromptsByTag: vi.fn().mockResolvedValue([]),
      getImagesByTag: vi.fn().mockResolvedValue([]),
      removeTagFromPrompt: vi.fn().mockResolvedValue(true),
      removeTagFromImage: vi.fn().mockResolvedValue(true),
    };
    (global as any).window = { electronAPI: mockElectronAPI };
  });

  describe("getTags", () => {
    it("should get tags for prompt type", async () => {
      const tags = await getTags("prompt");
      expect(tags).toEqual(["tag1", "tag2"]);
      expect(mockElectronAPI.getPromptTags).toHaveBeenCalled();
    });

    it("should get tags for image type", async () => {
      const tags = await getTags("image");
      expect(tags).toEqual(["img1", "img2"]);
      expect(mockElectronAPI.getImageTags).toHaveBeenCalled();
    });
  });

  describe("createTag", () => {
    it("should create new tag", async () => {
      await createTag("prompt", "newtag1");
      expect(mockElectronAPI.addPromptTag).toHaveBeenCalledWith("newtag1");
    });

    it("should assign tag to group when defaultGroupId is provided", async () => {
      await createTag("prompt", "newtag2", { defaultGroupId: 1 });
      expect(mockElectronAPI.addPromptTag).toHaveBeenCalledWith("newtag2");
      expect(mockElectronAPI.assignPromptTagToBelongGroup).toHaveBeenCalledWith("newtag2", 1);
    });

    it("should not assign group when defaultGroupId is not provided", async () => {
      await createTag("image", "imgtag1");
      expect(mockElectronAPI.addImageTag).toHaveBeenCalledWith("imgtag1");
      expect(mockElectronAPI.assignImageTagToBelongGroup).not.toHaveBeenCalled();
    });
  });

  describe("renameTag", () => {
    it("should rename tag", async () => {
      await renameTag("prompt", "oldtag", "newtag");
      expect(mockElectronAPI.renamePromptTag).toHaveBeenCalledWith("oldtag", "newtag");
    });

    it("should throw InvalidTagNameError for empty new name", async () => {
      await expect(renameTag("prompt", "oldtag", "  ")).rejects.toThrow(InvalidTagNameError);
    });

    it("should throw TagExistsError when new name already exists", async () => {
      await expect(renameTag("prompt", "tag2", "tag1")).rejects.toThrow(TagExistsError);
    });
  });

  describe("deleteTag", () => {
    it("should delete tag and return result", async () => {
      const result = await deleteTag("prompt", "tag1");
      expect(result.deleted).toBe(1);
      expect(result.errors).toEqual([]);
    });

    it("should return deleted 0 for empty tag", async () => {
      const result = await deleteTag("prompt", "  ");
      expect(result.deleted).toBe(0);
      expect(mockElectronAPI.deletePromptTag).not.toHaveBeenCalled();
    });

    it("should remove tag from items before deleting", async () => {
      mockElectronAPI.getPromptsByTag.mockResolvedValue(["prompt1", "prompt2"]);
      await deleteTag("prompt", "tag1");

      expect(mockElectronAPI.getPromptsByTag).toHaveBeenCalledWith("tag1");
      expect(mockElectronAPI.removeTagFromPrompt).toHaveBeenCalledTimes(2);
      expect(mockElectronAPI.removeTagFromPrompt).toHaveBeenCalledWith("prompt1", "tag1");
      expect(mockElectronAPI.removeTagFromPrompt).toHaveBeenCalledWith("prompt2", "tag1");
    });

    it("should clear group assignment before deleting", async () => {
      await deleteTag("prompt", "tag1");
      expect(mockElectronAPI.assignPromptTagToBelongGroup).toHaveBeenCalledWith("tag1", null);
    });

    it("should collect errors for failed deletions", async () => {
      mockElectronAPI.deletePromptTag.mockRejectedValue(new Error("Database error"));
      const result = await deleteTag("prompt", "tag1");

      expect(result.deleted).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].tag).toBe("tag1");
      expect(result.errors[0].code).toBe("INVALID");
    });
  });

  describe("assignTagToGroup", () => {
    it("should assign tag to group", async () => {
      await assignTagToGroup("prompt", "tag1", 1);
      expect(mockElectronAPI.assignPromptTagToBelongGroup).toHaveBeenCalledWith("tag1", 1);
    });

    it("should remove tag from group when groupId is null", async () => {
      await assignTagToGroup("prompt", "tag1", null);
      expect(mockElectronAPI.assignPromptTagToBelongGroup).toHaveBeenCalledWith("tag1", null);
    });
  });

  describe("getTagGroups", () => {
    it("should get tag groups for prompt type", async () => {
      const groups = await getTagGroups("prompt");
      expect(groups).toEqual([{ id: 1, name: "Group 1", sortOrder: 1 }]);
      expect(mockElectronAPI.getPromptTagGroups).toHaveBeenCalled();
    });

    it("should get tag groups for image type", async () => {
      const groups = await getTagGroups("image");
      expect(groups).toEqual([{ id: 1, name: "Image Group 1", sortOrder: 1 }]);
      expect(mockElectronAPI.getImageTagGroups).toHaveBeenCalled();
    });
  });

  describe("createTagGroup", () => {
    it("should create tag group", async () => {
      const group = await createTagGroup("prompt", "New Group", 2);
      expect(group).toEqual({ id: 2, name: "New Group", sortOrder: 2 });
      expect(mockElectronAPI.createPromptTagGroup).toHaveBeenCalledWith("New Group", 2);
    });

    it("should throw error for empty name", async () => {
      await expect(createTagGroup("prompt", "  ", 1)).rejects.toThrow("标签组名称不能为空");
    });

    it("should trim group name", async () => {
      await createTagGroup("prompt", "  New Group  ", 2);
      expect(mockElectronAPI.createPromptTagGroup).toHaveBeenCalledWith("New Group", 2);
    });
  });

  describe("updateTagGroup", () => {
    it("should update tag group", async () => {
      await updateTagGroup("prompt", 1, { name: "Updated" });
      expect(mockElectronAPI.updatePromptTagGroupAttrs).toHaveBeenCalledWith(1, {
        name: "Updated",
      });
    });
  });

  describe("deleteTagGroup", () => {
    it("should delete tag group", async () => {
      await deleteTagGroup("prompt", 1);
      expect(mockElectronAPI.deletePromptTagGroup).toHaveBeenCalledWith(1);
    });
  });
});
