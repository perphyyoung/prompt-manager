/**
 * pyBatchToolbar utils 单元测试
 */

import { describe, it, expect } from "vitest";
import {
  sortButtons,
  mergeButtonConfigs,
  filterVisibleButtons,
  generateToolbarId,
  isValidContext,
} from "../../src/pyBatchToolbar/utils.ts";
import type { ToolbarButtonConfig } from "../../src/pyBatchToolbar/types.ts";

describe("pyBatchToolbar utils", () => {
  describe("sortButtons", () => {
    it("应该按 order 排序按钮", () => {
      const buttons: ToolbarButtonConfig[] = [
        { action: "C", text: "C", order: 3 },
        { action: "A", text: "A", order: 1 },
        { action: "B", text: "B", order: 2 },
      ];

      const sorted = sortButtons(buttons);

      expect(sorted[0].action).toBe("A");
      expect(sorted[1].action).toBe("B");
      expect(sorted[2].action).toBe("C");
    });

    it("应该处理没有 order 的按钮", () => {
      const buttons: ToolbarButtonConfig[] = [
        { action: "A", text: "A" }, // 无 order，默认为 0
        { action: "B", text: "B", order: 1 },
        { action: "C", text: "C" }, // 无 order，默认为 0
      ];

      const sorted = sortButtons(buttons);

      // 没有 order 的应该排在前面 (order=0)
      expect(sorted[0].action).toBe("A");
      expect(sorted[1].action).toBe("C");
      expect(sorted[2].action).toBe("B");
    });

    it("不应该修改原数组", () => {
      const buttons: ToolbarButtonConfig[] = [
        { action: "B", text: "B", order: 2 },
        { action: "A", text: "A", order: 1 },
      ];

      const originalOrder = buttons.map((b) => b.action);
      sortButtons(buttons);

      expect(buttons.map((b) => b.action)).toEqual(originalOrder);
    });

    it("空数组应该返回空数组", () => {
      expect(sortButtons([])).toEqual([]);
    });

    it("单个按钮应该返回相同的数组", () => {
      const buttons: ToolbarButtonConfig[] = [{ action: "A", text: "A", order: 1 }];

      const sorted = sortButtons(buttons);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].action).toBe("A");
    });
  });

  describe("mergeButtonConfigs", () => {
    it("应该合并相同 action 的按钮", () => {
      const base: ToolbarButtonConfig[] = [
        { action: "A", text: "Original A", order: 1 },
        { action: "B", text: "Original B", order: 2 },
      ];

      const overrides: Partial<ToolbarButtonConfig>[] = [{ action: "A", text: "Updated A" }];

      const merged = mergeButtonConfigs(base, overrides);

      const buttonA = merged.find((b) => b.action === "A");
      expect(buttonA?.text).toBe("Updated A");
      expect(buttonA?.order).toBe(1);

      const buttonB = merged.find((b) => b.action === "B");
      expect(buttonB?.text).toBe("Original B");
    });

    it("应该添加新的按钮", () => {
      const base: ToolbarButtonConfig[] = [{ action: "A", text: "A", order: 1 }];

      const overrides: Partial<ToolbarButtonConfig>[] = [{ action: "B", text: "New B", order: 2 }];

      const merged = mergeButtonConfigs(base, overrides);

      expect(merged).toHaveLength(2);
      expect(merged.find((b) => b.action === "B")?.text).toBe("New B");
    });

    it("应该排序合并后的按钮", () => {
      const base: ToolbarButtonConfig[] = [{ action: "C", text: "C", order: 3 }];

      const overrides: Partial<ToolbarButtonConfig>[] = [
        { action: "A", text: "A", order: 1 },
        { action: "B", text: "B", order: 2 },
      ];

      const merged = mergeButtonConfigs(base, overrides);

      expect(merged[0].action).toBe("A");
      expect(merged[1].action).toBe("B");
      expect(merged[2].action).toBe("C");
    });

    it("空覆盖应该返回原数组的副本", () => {
      const base: ToolbarButtonConfig[] = [{ action: "A", text: "A", order: 1 }];

      const merged = mergeButtonConfigs(base, []);

      expect(merged).toEqual(base);
      expect(merged).not.toBe(base); // 应该是新数组
    });

    it("空基础数组应该返回覆盖数组", () => {
      const base: ToolbarButtonConfig[] = [];

      const overrides: Partial<ToolbarButtonConfig>[] = [{ action: "A", text: "A", order: 1 }];

      const merged = mergeButtonConfigs(base, overrides);

      expect(merged).toHaveLength(1);
      expect(merged[0].action).toBe("A");
    });
  });

  describe("filterVisibleButtons", () => {
    it("应该过滤掉 visible=false 的按钮", () => {
      const buttons: ToolbarButtonConfig[] = [
        { action: "A", text: "A", visible: true },
        { action: "B", text: "B", visible: false },
        { action: "C", text: "C" }, // 默认可见
      ];

      const filtered = filterVisibleButtons(buttons);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((b) => b.action)).toEqual(["A", "C"]);
    });

    it("应该保留所有可见按钮", () => {
      const buttons: ToolbarButtonConfig[] = [
        { action: "A", text: "A", visible: true },
        { action: "B", text: "B", visible: true },
      ];

      const filtered = filterVisibleButtons(buttons);

      expect(filtered).toHaveLength(2);
    });

    it("应该处理没有 visible 属性的按钮", () => {
      const buttons: ToolbarButtonConfig[] = [
        { action: "A", text: "A" },
        { action: "B", text: "B" },
      ];

      const filtered = filterVisibleButtons(buttons);

      expect(filtered).toHaveLength(2);
    });

    it("空数组应该返回空数组", () => {
      expect(filterVisibleButtons([])).toEqual([]);
    });

    it("所有按钮都不可见应该返回空数组", () => {
      const buttons: ToolbarButtonConfig[] = [
        { action: "A", text: "A", visible: false },
        { action: "B", text: "B", visible: false },
      ];

      const filtered = filterVisibleButtons(buttons);
      expect(filtered).toHaveLength(0);
    });
  });

  describe("generateToolbarId", () => {
    it("应该生成正确的工具栏 ID", () => {
      expect(generateToolbarId("promptMain")).toBe("promptMainBatchToolbar");
      expect(generateToolbarId("imageMain")).toBe("imageMainBatchToolbar");
      expect(generateToolbarId("test")).toBe("testBatchToolbar");
    });

    it("应该为空字符串生成有效的 ID", () => {
      expect(generateToolbarId("")).toBe("BatchToolbar");
    });
  });

  describe("isValidContext", () => {
    it("应该验证有效的上下文", () => {
      expect(isValidContext("promptMain")).toBe(true);
      expect(isValidContext("imageMain")).toBe(true);
    });

    it("应该拒绝无效的上下文", () => {
      expect(isValidContext("invalid")).toBe(false);
      expect(isValidContext("")).toBe(false);
      expect(isValidContext("prompt")).toBe(false);
      expect(isValidContext("image")).toBe(false);
    });

    it("应该区分大小写", () => {
      expect(isValidContext("PromptMain")).toBe(false);
      expect(isValidContext("PROMPTMAIN")).toBe(false);
    });
  });
});
