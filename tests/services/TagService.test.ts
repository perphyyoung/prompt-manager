/**
 * TagService 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TagService } from "../../src/renderer/services/TagService.ts";
import * as operations from "../../src/lib/tag-groups/operations.ts";

// Mock pyTagGroups 模块
vi.mock("../../src/lib/tag-groups/operations.ts", () => ({
  createTag: vi.fn().mockResolvedValue(undefined),
  deleteTags: vi.fn(),
  getTags: vi.fn().mockResolvedValue([]),
  getTagGroups: vi.fn(),
}));

// Mock electronAPI - 使用 any 类型避免与全局 IElectronAPI 冲突
const mockElectronAPI = () => ({
  updatePrompt: vi.fn().mockResolvedValue(undefined),
  updateImage: vi.fn().mockResolvedValue(undefined),
  addPromptTagsBatch: vi.fn().mockResolvedValue({ success: true, added: 1 }),
  addImageTagsBatch: vi.fn().mockResolvedValue({ success: true, added: 1 }),
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

  describe("createTag", () => {
    it("应该成功创建标签", async () => {
      vi.mocked(operations.getTags).mockResolvedValue(["other1", "other2"]);

      const eventBus = { emit: vi.fn() };
      tagService.setEventBus(eventBus);

      const result = await tagService.createTag({
        tagName: "tag1",
        type: "prompt",
      });

      expect(result.success).toBe(true);
      expect(result.created).toEqual(["tag1"]);
      expect(operations.createTag).toHaveBeenCalledWith("prompt", "tag1", {});
    });

    it("应该处理已存在的标签", async () => {
      vi.mocked(operations.getTags).mockResolvedValue(["tag1", "other1"]);

      const result = await tagService.createTag({
        tagName: "tag1",
        type: "image",
      });

      expect(result.skipped).toEqual(["tag1"]);
      expect(result.created).toEqual([]);
      expect(operations.createTag).not.toHaveBeenCalled();
    });

    it("应该拒绝保留标签", async () => {
      const result = await tagService.createTag({
        tagName: "收藏",
        type: "image",
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([
        {
          tag: "收藏",
          error: '"收藏" 是系统特殊标签，不能手动添加',
          code: "RESERVED",
        },
      ]);
      expect(operations.createTag).not.toHaveBeenCalled();
    });

    it("应该处理空标签名", async () => {
      const result = await tagService.createTag({
        tagName: "  ",
        type: "prompt",
      });

      expect(result.success).toBe(true);
      expect(result.created).toEqual([]);
      expect(operations.createTag).not.toHaveBeenCalled();
    });

    it("应该传递 defaultGroupId", async () => {
      vi.mocked(operations.getTags).mockResolvedValue([]);

      await tagService.createTag({
        tagName: "tag1",
        type: "prompt",
        defaultGroupId: 1,
      });

      expect(operations.createTag).toHaveBeenCalledWith("prompt", "tag1", {
        defaultGroupId: 1,
      });
    });
  });

  describe("linkTagsToItem", () => {
    it("应该成功关联标签到项目", async () => {
      vi.mocked(operations.getTags).mockResolvedValue([]);

      const eventBus = { emit: vi.fn() };
      tagService.setEventBus(eventBus);

      const result = await tagService.linkTagsToItem({
        tagName: "tag1",
        type: "prompt",
        itemId: "item-123",
      });

      expect(result.success).toBe(true);
      expect(result.linkedToItem).toBe(true);
      expect(result.linkedItemCount).toBe(1);
      expect(operations.createTag).toHaveBeenCalledWith("prompt", "tag1", {});
      expect(window.electronAPI.addPromptTagsBatch).toHaveBeenCalledWith(["item-123"], ["tag1"]);

      // 注意：updated_at 更新在 database.ts 的 addPromptTags/addImageTags 中处理
      // 不在 TagService 层处理
    });

    it("应该支持批量关联到多个项目", async () => {
      vi.mocked(operations.getTags).mockResolvedValue([]);

      await tagService.linkTagsToItem({
        tagName: "tag1",
        type: "image",
        itemIds: ["item-1", "item-2"],
      });

      expect(window.electronAPI.addImageTagsBatch).toHaveBeenCalledWith(
        ["item-1", "item-2"],
        ["tag1"],
      );

      // 注意：updated_at 更新在 database.ts 的 addPromptTags/addImageTags 中处理
    });

    it("应该处理空标签名", async () => {
      const result = await tagService.linkTagsToItem({
        tagName: "  ",
        type: "prompt",
        itemId: "item-123",
      });

      expect(result.success).toBe(true);
      expect(result.linkedToItem).toBe(false);
      expect(operations.createTag).not.toHaveBeenCalled();
      expect(window.electronAPI.addPromptTagsBatch).not.toHaveBeenCalled();
    });

    it("保留标签应该不创建也不关联", async () => {
      const result = await tagService.linkTagsToItem({
        tagName: "收藏",
        type: "prompt",
        itemId: "item-123",
      });

      expect(result.success).toBe(false);
      expect(result.linkedToItem).toBe(false);
      expect(operations.createTag).not.toHaveBeenCalled();
      expect(window.electronAPI.addPromptTagsBatch).not.toHaveBeenCalled();
    });

    it("应该处理无项目ID的情况", async () => {
      vi.mocked(operations.getTags).mockResolvedValue([]);

      const result = await tagService.linkTagsToItem({
        tagName: "tag1",
        type: "prompt",
      });

      expect(result.linkedToItem).toBe(false);
      expect(result.linkedItemCount).toBe(0);
      expect(window.electronAPI.addPromptTagsBatch).not.toHaveBeenCalled();
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

  describe("单例模式", () => {
    it("应该返回相同的实例", () => {
      const instance1 = TagService.getInstance();
      const instance2 = TagService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("依赖注入(端口)", () => {
    function createFakePorts() {
      const cacheStore = new Map<string, unknown>();
      const ports = {
        ipc: {
          countPromptTags: vi.fn().mockResolvedValue({}),
          countImageTags: vi.fn().mockResolvedValue({}),
          countPromptSpecialTags: vi.fn().mockResolvedValue({}),
          countImageSpecialTags: vi.fn().mockResolvedValue({}),
          addPromptTagsBatch: vi.fn().mockResolvedValue({ success: true, added: 1 }),
          addImageTagsBatch: vi.fn().mockResolvedValue({ success: true, added: 1 }),
          removeTagFromPrompt: vi.fn().mockResolvedValue(true),
          removeTagFromImage: vi.fn().mockResolvedValue(true),
          logError: vi.fn(),
        },
        cache: {
          get: <T>(key: string) => (cacheStore.get(key) as T | undefined) ?? null,
          set: vi.fn((key: string, data: unknown) => {
            cacheStore.set(key, data);
          }),
          clear: vi.fn((key: string) => {
            cacheStore.delete(key);
          }),
        },
      };
      return { ports, cacheStore };
    }

    it("unlinkTagFromItem 走注入的 ipc 端口并触发事件", async () => {
      const { ports } = createFakePorts();
      const eventBus = { emit: vi.fn() };
      const service = new TagService(ports);
      service.setEventBus(eventBus);

      const ok = await service.unlinkTagFromItem({ type: "prompt", itemId: "p1", tagName: "t" });

      expect(ok).toBe(true);
      expect(ports.ipc.removeTagFromPrompt).toHaveBeenCalledWith("p1", "t");
      expect(eventBus.emit).toHaveBeenCalled();
    });

    it("ipc 返回 false 时返回 false 且记录日志", async () => {
      const { ports } = createFakePorts();
      ports.ipc.removeTagFromPrompt.mockResolvedValue(false);
      const service = new TagService(ports);

      const ok = await service.unlinkTagFromItem({ type: "prompt", itemId: "p1", tagName: "t" });

      expect(ok).toBe(false);
      expect(ports.ipc.logError).toHaveBeenCalled();
    });

    it("linkTagsToItem 走注入的批量关联端口(itemIds 去重)", async () => {
      vi.mocked(operations.getTags).mockResolvedValue([]);
      const { ports } = createFakePorts();
      const service = new TagService(ports);

      await service.linkTagsToItem({
        tagName: "tag-x",
        type: "prompt",
        itemIds: ["p1", "p1", "p2"],
      });

      expect(ports.ipc.addPromptTagsBatch).toHaveBeenCalledWith(["p1", "p2"], ["tag-x"]);
    });

    it("缓存读写与失效走注入的 cache 端口", async () => {
      vi.mocked(operations.getTags).mockResolvedValue(["tag1"]);
      const { ports, cacheStore } = createFakePorts();
      const service = new TagService(ports);

      await service.getTags("prompt");
      expect(ports.cache.set).toHaveBeenCalledWith("promptTags", ["tag1"]);
      expect(cacheStore.get("promptTags")).toEqual(["tag1"]);

      await service.clearTagsCache("prompt");
      expect(ports.cache.clear).toHaveBeenCalledWith("promptTags");
    });
  });
});
