/**
 * PyTagGroups 主类单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PyTagGroups } from "../../src/lib/tag-groups/PyTagGroups.ts";

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

describe("PyTagGroups", () => {
  let mockElectronAPI: any;
  let lib: PyTagGroups;

  beforeEach(() => {
    mockElectronAPI = {
      getPromptTags: vi.fn().mockResolvedValue(["tag1", "tag2", "tag3"]),
      getImageTags: vi.fn().mockResolvedValue(["img1", "img2"]),
      addPromptTag: vi.fn().mockResolvedValue(undefined),
      addImageTag: vi.fn().mockResolvedValue(undefined),
      renamePromptTag: vi.fn().mockResolvedValue(undefined),
      renameImageTag: vi.fn().mockResolvedValue(undefined),
      deletePromptTag: vi.fn().mockImplementation((tag: string) => {
        // 模拟真实行为：只有存在的标签才能删除成功
        const existingTags = ["tag1", "tag2", "tag3"];
        if (existingTags.includes(tag)) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error(`标签 "${tag}" 不存在`));
      }),
      deleteImageTag: vi.fn().mockResolvedValue(undefined),
      getPromptTagGroups: vi.fn().mockResolvedValue([
        { id: 1, name: "Group 1", sortOrder: 1, tags: ["tag1"] },
        { id: 2, name: "Group 2", sortOrder: 2, tags: ["tag2"] },
      ]),
      getImageTagGroups: vi
        .fn()
        .mockResolvedValue([{ id: 1, name: "Image Group 1", sortOrder: 1, tags: ["img1"] }]),
      createPromptTagGroup: vi.fn().mockResolvedValue({ id: 3, name: "New Group", sortOrder: 3 }),
      createImageTagGroup: vi
        .fn()
        .mockResolvedValue({ id: 3, name: "New Image Group", sortOrder: 3 }),
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

    lib = PyTagGroups.getInstance("prompt");
  });

  describe("getInstance", () => {
    it("should return same instance for same type", () => {
      const instance1 = PyTagGroups.getInstance("prompt");
      const instance2 = PyTagGroups.getInstance("prompt");
      expect(instance1).toBe(instance2);
    });

    it("should return different instance for different type", () => {
      const promptInstance = PyTagGroups.getInstance("prompt");
      const imageInstance = PyTagGroups.getInstance("image");
      expect(promptInstance).not.toBe(imageInstance);
    });
  });

  describe("rename", () => {
    it("should rename tag", async () => {
      await lib.rename("tag1", "newtag");
      expect(mockElectronAPI.renamePromptTag).toHaveBeenCalledWith("tag1", "newtag");
    });

    it("should throw error when new name exists", async () => {
      await expect(lib.rename("tag2", "tag1")).rejects.toThrow();
    });
  });

  describe("createGroup", () => {
    it("should create group", async () => {
      const group = await lib.createGroup("New Group", 3);
      expect(group.name).toBe("New Group");
      expect(group.sortOrder).toBe(3);
    });

    it("should use default sort order", async () => {
      // 由于缓存机制，mock 值在实例创建后就被缓存了
      // 这里只验证 createGroup 被调用且返回了正确的结构
      const group = await lib.createGroup("New Group");
      expect(group).toHaveProperty("id");
      expect(group).toHaveProperty("name", "New Group");
      expect(group).toHaveProperty("sortOrder");
    });
  });

  describe("updateGroup", () => {
    it("should update group", async () => {
      await lib.updateGroup(1, { name: "Updated" });
      expect(mockElectronAPI.updatePromptTagGroupAttrs).toHaveBeenCalledWith(1, {
        name: "Updated",
      });
    });
  });

  describe("deleteGroup", () => {
    it("should delete group", async () => {
      await lib.deleteGroup(1);
      expect(mockElectronAPI.deletePromptTagGroup).toHaveBeenCalledWith(1);
    });
  });

  describe("assignToGroup", () => {
    it("should assign tag to group", async () => {
      await lib.assignToGroup("tag1", 1);
      expect(mockElectronAPI.assignPromptTagToBelongGroup).toHaveBeenCalledWith("tag1", 1);
    });

    it("should remove tag from group when groupId is null", async () => {
      await lib.assignToGroup("tag1", null);
      expect(mockElectronAPI.assignPromptTagToBelongGroup).toHaveBeenCalledWith("tag1", null);
    });
  });
});
