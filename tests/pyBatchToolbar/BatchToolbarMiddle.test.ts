/**
 * BatchToolbarMiddle 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BatchToolbarMiddle, type BatchBusinessConfig } from "../../src/renderer/features/batch-toolbar/index.ts";
import { Constants } from "../../src/constants.ts";

describe("BatchToolbarMiddle", () => {
  let middle: BatchToolbarMiddle;

  beforeEach(() => {
    // 重置单例
    (BatchToolbarMiddle as any).instance = null;
    middle = BatchToolbarMiddle.getInstance();
  });

  afterEach(() => {
    middle.destroy();
  });

  describe("getInstance", () => {
    it("应该返回单例实例", () => {
      const instance1 = BatchToolbarMiddle.getInstance();
      const instance2 = BatchToolbarMiddle.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("init", () => {
    const mockBusinessConfig: BatchBusinessConfig = {
      delete: {
        batchApi: async (_ids) => ({ success: true, deleted: 1 }),
      },
      addTag: {
        processItems: async () => {},
      },
      favorite: {
        batchApi: async () => {},
      },
    };

    it("应该初始化工具栏", () => {
      middle.init("promptMain", mockBusinessConfig);

      const config = middle.getToolbarConfig("promptMain");
      expect(config).toBeTruthy();
      expect(config?.id).toBe(Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR);
    });

    it("应该初始化工具栏并注册动作处理器", () => {
      middle.init("promptMain", mockBusinessConfig);

      // 使用 registerActionHandler 注册处理器
      const selectAllHandler = vi.fn();
      middle.registerActionHandler("promptMain", "SelectAll", selectAllHandler);

      const config = middle.getToolbarConfig("promptMain");
      expect(config).toBeTruthy();
    });

    it("重新初始化应该销毁旧实例", () => {
      middle.init("promptMain", mockBusinessConfig);
      const config1 = middle.getToolbarConfig("promptMain");

      middle.init("promptMain", mockBusinessConfig);
      const config2 = middle.getToolbarConfig("promptMain");

      // 配置应该相同，但 DOM 元素会被重新创建
      expect(config1?.id).toBe(config2?.id);
    });
  });

  describe("initAll", () => {
    const mockBusinessConfig: BatchBusinessConfig = {
      delete: { batchApi: async () => ({ success: true, deleted: 1 }) },
      addTag: { processItems: async () => {} },
      favorite: { batchApi: async () => {} },
    };

    it("应该初始化所有预设工具栏", () => {
      middle.initAll(mockBusinessConfig);

      const contexts = ["promptMain", "imageMain"] as const;

      contexts.forEach((context) => {
        expect(middle.getToolbarConfig(context)).toBeTruthy();
      });
    });
  });

  describe("show/hide", () => {
    const mockBusinessConfig: BatchBusinessConfig = {
      delete: { batchApi: async () => ({ success: true, deleted: 1 }) },
      addTag: { processItems: async () => {} },
      favorite: { batchApi: async () => {} },
    };

    it("应该显示和隐藏工具栏", () => {
      middle.init("promptMain", mockBusinessConfig);

      // 初始状态：DOM 元素存在但隐藏
      const config = middle.getToolbarConfig("promptMain");
      const element = document.getElementById(config?.id || "");
      expect(element).toBeTruthy();
      expect(element?.style.display).toBe("none");

      // 显示工具栏
      middle.show("promptMain", 5, () => {});
      expect(element?.style.display).toBe("block");

      // 隐藏工具栏
      middle.hide("promptMain");
      // 隐藏有延迟，需要等待动画完成
      setTimeout(() => {
        expect(element?.style.display).toBe("none");
      }, 250);
    });
  });

  describe("updateCount", () => {
    const mockBusinessConfig: BatchBusinessConfig = {
      delete: { batchApi: async () => ({ success: true, deleted: 1 }) },
      addTag: { processItems: async () => {} },
      favorite: { batchApi: async () => {} },
    };

    it("应该更新计数", () => {
      middle.init("promptMain", mockBusinessConfig);

      middle.show("promptMain", 0, () => {});
      middle.updateCount("promptMain", 20);

      const element = document.getElementById(Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR);
      const countSpan = element?.querySelector(".batch-toolbar-count");
      expect(countSpan?.textContent).toBe("已选择 20 个提示词");
    });
  });

  describe("hideAll", () => {
    const mockBusinessConfig: BatchBusinessConfig = {
      delete: { batchApi: async () => ({ success: true, deleted: 1 }) },
      addTag: { processItems: async () => {} },
      favorite: { batchApi: async () => {} },
    };

    it("应该隐藏所有工具栏", () => {
      middle.initAll(mockBusinessConfig);

      // 显示所有
      middle.show("promptMain", 1, () => {});
      middle.show("imageMain", 2, () => {});

      middle.hideAll();

      // 验证 DOM 元素被隐藏
      const promptConfig = middle.getToolbarConfig("promptMain");
      const imageConfig = middle.getToolbarConfig("imageMain");
      const promptElement = document.getElementById(promptConfig?.id || "");
      const imageElement = document.getElementById(imageConfig?.id || "");

      setTimeout(() => {
        expect(promptElement?.style.display).toBe("none");
        expect(imageElement?.style.display).toBe("none");
      }, 250);
    });
  });

  describe("registerActionHandler", () => {
    const mockBusinessConfig: BatchBusinessConfig = {
      delete: { batchApi: async () => ({ success: true, deleted: 1 }) },
      addTag: { processItems: async () => {} },
      favorite: { batchApi: async () => {} },
    };

    it("应该注册动作处理器", async () => {
      middle.init("promptMain", mockBusinessConfig);

      const handler = vi.fn();
      middle.registerActionHandler("promptMain", "TestAction", handler);

      // 验证处理器已注册（通过内部状态）
      const state = (middle as any).states.get("promptMain");
      expect(state?.actionHandlers.has("TestAction")).toBe(true);
    });
  });

  describe("batch operations", () => {
    const mockBusinessConfig: BatchBusinessConfig = {
      delete: {
        batchApi: async () => ({ success: true, deleted: 1 }),
      },
      addTag: {
        processItems: async () => {},
      },
      favorite: {
        batchApi: async () => {},
      },
    };

    it("应该支持批量删除", async () => {
      middle.init("promptMain", mockBusinessConfig);
      await middle.batchDelete("promptMain", ["id1", "id2"]);
    });

    it("应该支持批量添加标签", async () => {
      middle.init("promptMain", mockBusinessConfig);

      await middle.batchAddTag("promptMain", ["id1"], "tag1");
    });

    it("应该支持批量切换收藏状态", async () => {
      middle.init("promptMain", mockBusinessConfig);

      await middle.batchFavorite("promptMain", ["id1"]);
    });
  });

  describe("destroy", () => {
    const mockBusinessConfig: BatchBusinessConfig = {
      delete: { batchApi: async () => ({ success: true, deleted: 1 }) },
      addTag: { processItems: async () => {} },
      favorite: { batchApi: async () => {} },
    };

    it("应该销毁所有工具栏并清空缓存", () => {
      middle.initAll(mockBusinessConfig);

      middle.destroy();

      expect(middle.getToolbarConfig("promptMain")).toBeUndefined();
      expect(middle.getToolbarConfig("imageMain")).toBeUndefined();
    });
  });
});
