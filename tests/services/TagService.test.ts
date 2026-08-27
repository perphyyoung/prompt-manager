/**
 * TagService 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TagService } from "../../src/renderer/services/TagService.ts";
import * as operations from "../../src/pyTagGroups/operations.ts";
import * as itemTagService from "../../src/pyTagGroups/itemTagService.ts";

// Mock pyTagGroups 模块
vi.mock("../../src/pyTagGroups/operations.ts", () => ({
  createTags: vi.fn(),
  deleteTags: vi.fn(),
  getTags: vi.fn(),
  getTagGroups: vi.fn(),
}));

vi.mock("../../src/pyTagGroups/itemTagService.ts", () => ({
  linkTags: vi.fn(),
}));

// Mock electronAPI - 使用 any 类型避免与全局 IElectronAPI 冲突
const mockElectronAPI = () => ({
  updatePrompt: vi.fn().mockResolvedValue(undefined),
  updateImage: vi.fn().mockResolvedValue(undefined),
  logError: vi.fn(),
  logWarn: vi.fn(),
});

describe("TagService", () => {
  let tagService: TagService;

  beforeEach(() => {
    tagService = TagService.getInstance();

    // Mock window.electronAPI
    (global as any).window = {
      electronAPI: mockElectronAPI(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createTags", () => {
    it("应该成功创建标签", async () => {
      const mockResult = {
        success: true,
        created: ["tag1", "tag2"],
        skipped: [],
        errors: [],
      };
      vi.mocked(operations.createTags).mockResolvedValue(mockResult);

      const eventBus = { emit: vi.fn() };
      tagService.setEventBus(eventBus);

      const result = await tagService.createTags({
        tagNames: ["tag1", "tag2"],
        type: "prompt",
      });

      expect(result.success).toBe(true);
      expect(result.created).toEqual(["tag1", "tag2"]);
      expect(operations.createTags).toHaveBeenCalledWith("prompt", ["tag1", "tag2"], {});
    });

    it("应该处理已存在的标签", async () => {
      const mockResult = {
        success: true,
        created: ["tag1"],
        skipped: ["tag2"],
        errors: [],
      };
      vi.mocked(operations.createTags).mockResolvedValue(mockResult);

      const result = await tagService.createTags({
        tagNames: ["tag1", "tag2"],
        type: "image",
      });

      expect(result.skipped).toEqual(["tag2"]);
    });

    it("应该处理空标签列表", async () => {
      const result = await tagService.createTags({
        tagNames: [],
        type: "prompt",
      });

      expect(result.success).toBe(true);
      expect(result.created).toEqual([]);
      expect(operations.createTags).not.toHaveBeenCalled();
    });

    it("应该支持字符串输入", async () => {
      const mockResult = {
        success: true,
        created: ["tag1"],
        skipped: [],
        errors: [],
      };
      vi.mocked(operations.createTags).mockResolvedValue(mockResult);

      await tagService.createTags({
        tagNames: "tag1",
        type: "prompt",
      });

      expect(operations.createTags).toHaveBeenCalledWith("prompt", ["tag1"], {});
    });
  });

  describe("linkTagsToItem", () => {
    it("应该成功关联标签到项目", async () => {
      const mockResult = {
        success: true,
        created: ["tag1"],
        skipped: [],
        errors: [],
        linkedToItem: true,
        linkedItemCount: 1,
      };
      vi.mocked(itemTagService.linkTags).mockResolvedValue(mockResult);

      const eventBus = { emit: vi.fn() };
      tagService.setEventBus(eventBus);

      const result = await tagService.linkTagsToItem({
        tagNames: ["tag1"],
        type: "prompt",
        itemId: "item-123",
      });

      expect(result.success).toBe(true);
      expect(result.linkedToItem).toBe(true);
      expect(itemTagService.linkTags).toHaveBeenCalledWith({
        tagNames: ["tag1"],
        type: "prompt",
        itemIds: ["item-123"],
      });

      // 注意：updated_at 更新在 database.ts 的 addPromptTags/addImageTags 中处理
      // 不在 TagService 层处理
    });

    it("应该支持批量关联到多个项目", async () => {
      const mockResult = {
        success: true,
        created: ["tag1"],
        skipped: [],
        errors: [],
        linkedToItem: true,
        linkedItemCount: 2,
      };
      vi.mocked(itemTagService.linkTags).mockResolvedValue(mockResult);

      await tagService.linkTagsToItem({
        tagNames: ["tag1"],
        type: "image",
        itemIds: ["item-1", "item-2"],
      });

      expect(itemTagService.linkTags).toHaveBeenCalledWith({
        tagNames: ["tag1"],
        type: "image",
        itemIds: ["item-1", "item-2"],
      });

      // 注意：updated_at 更新在 database.ts 的 addPromptTags/addImageTags 中处理
    });

    it("应该处理空标签列表", async () => {
      const result = await tagService.linkTagsToItem({
        tagNames: [],
        type: "prompt",
        itemId: "item-123",
      });

      expect(result.success).toBe(true);
      expect(result.linkedToItem).toBe(false);
      expect(itemTagService.linkTags).not.toHaveBeenCalled();
    });

    it("应该处理无项目ID的情况", async () => {
      const mockResult = {
        success: true,
        created: ["tag1"],
        skipped: [],
        errors: [],
        linkedToItem: false,
        linkedItemCount: 0,
      };
      vi.mocked(itemTagService.linkTags).mockResolvedValue(mockResult);

      const result = await tagService.linkTagsToItem({
        tagNames: ["tag1"],
        type: "prompt",
      });

      expect(result.linkedToItem).toBe(false);
      expect(window.electronAPI.updatePrompt).not.toHaveBeenCalled();
    });
  });

  describe("removeTags", () => {
    it("应该成功删除标签", async () => {
      const mockResult = {
        deleted: 2,
        errors: [],
      };
      vi.mocked(operations.deleteTags).mockResolvedValue(mockResult);

      const result = await tagService.removeTags({
        tagNames: ["tag1", "tag2"],
        type: "prompt",
      });

      expect(result.deleted).toBe(2);
      expect(operations.deleteTags).toHaveBeenCalledWith("prompt", ["tag1", "tag2"]);
    });

    it("应该处理空标签列表", async () => {
      const result = await tagService.removeTags({
        tagNames: [],
        type: "image",
      });

      expect(result.deleted).toBe(0);
      expect(operations.deleteTags).not.toHaveBeenCalled();
    });
  });

  describe("parseTagInput", () => {
    it("应该解析逗号分隔的标签", () => {
      const result = tagService.parseTagInput("tag1,tag2,tag3");
      expect(result).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("应该解析空格分隔的标签", () => {
      const result = tagService.parseTagInput("tag1 tag2 tag3");
      expect(result).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("应该解析中文逗号分隔的标签", () => {
      const result = tagService.parseTagInput("tag1，tag2，tag3");
      expect(result).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("应该处理混合分隔符", () => {
      const result = tagService.parseTagInput("tag1,tag2 tag3，tag4");
      expect(result).toEqual(["tag1", "tag2", "tag3", "tag4"]);
    });

    it("应该过滤空字符串", () => {
      const result = tagService.parseTagInput("tag1,,tag2, ,tag3");
      expect(result).toEqual(["tag1", "tag2", "tag3"]);
    });
  });

  describe("单例模式", () => {
    it("应该返回相同的实例", () => {
      const instance1 = TagService.getInstance();
      const instance2 = TagService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
