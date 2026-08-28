/**
 * pyBatchToolbar presets 单元测试
 */

import { describe, it, expect } from "vitest";
import {
  PROMPT_MAIN_BATCH_TOOLBAR,
  IMAGE_MAIN_BATCH_TOOLBAR,
  PRESET_CONFIGS,
  getPresetConfig,
  getAllPresetConfigs,
} from "../../src/lib/batch-toolbar/presets.ts";
import { Constants } from "../../src/constants.ts";

describe("pyBatchToolbar presets", () => {
  describe("PROMPT_MAIN_BATCH_TOOLBAR", () => {
    it("应该有正确的 ID", () => {
      expect(PROMPT_MAIN_BATCH_TOOLBAR.id).toBe(Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR);
    });

    it("应该有正确的上下文", () => {
      expect(PROMPT_MAIN_BATCH_TOOLBAR.context).toBe("promptMain");
    });

    it("应该有正确的数据类型", () => {
      expect(PROMPT_MAIN_BATCH_TOOLBAR.dataType).toBe("prompt");
    });

    it("应该有正确的标签", () => {
      expect(PROMPT_MAIN_BATCH_TOOLBAR.label).toBe("提示词");
    });

    it("应该有 6 个按钮", () => {
      expect(PROMPT_MAIN_BATCH_TOOLBAR.buttons).toHaveLength(6);
    });

    it("按钮应该按 order 排序", () => {
      const buttons = PROMPT_MAIN_BATCH_TOOLBAR.buttons;
      for (let i = 1; i < buttons.length; i++) {
        expect(buttons[i].order!).toBeGreaterThanOrEqual(buttons[i - 1].order!);
      }
    });
  });

  describe("IMAGE_MAIN_BATCH_TOOLBAR", () => {
    it("应该有正确的 ID", () => {
      expect(IMAGE_MAIN_BATCH_TOOLBAR.id).toBe(Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR);
    });

    it("应该有正确的上下文", () => {
      expect(IMAGE_MAIN_BATCH_TOOLBAR.context).toBe("imageMain");
    });

    it("应该有正确的数据类型", () => {
      expect(IMAGE_MAIN_BATCH_TOOLBAR.dataType).toBe("image");
    });

    it("应该有正确的标签", () => {
      expect(IMAGE_MAIN_BATCH_TOOLBAR.label).toBe("图像");
    });

    it("应该有 6 个按钮", () => {
      expect(IMAGE_MAIN_BATCH_TOOLBAR.buttons).toHaveLength(6);
    });
  });

  describe("PRESET_CONFIGS", () => {
    it("应该包含所有 2 个上下文", () => {
      expect(Object.keys(PRESET_CONFIGS)).toHaveLength(2);
    });

    it("每个上下文都应该有有效的配置", () => {
      Object.entries(PRESET_CONFIGS).forEach(([context, config]) => {
        expect(config.context).toBe(context);
        expect(config.buttons).toBeInstanceOf(Array);
        expect(config.buttons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("getPresetConfig", () => {
    it("应该返回指定上下文的配置", () => {
      const config = getPresetConfig("promptMain");
      expect(config).toBe(PROMPT_MAIN_BATCH_TOOLBAR);
    });

    it("应该为所有上下文返回正确的配置", () => {
      const contexts: Array<keyof typeof PRESET_CONFIGS> = ["promptMain", "imageMain"];

      contexts.forEach((context) => {
        const config = getPresetConfig(context);
        expect(config).toBe(PRESET_CONFIGS[context]);
      });
    });
  });

  describe("getAllPresetConfigs", () => {
    it("应该返回所有预设配置的数组", () => {
      const configs = getAllPresetConfigs();
      expect(configs).toHaveLength(2);
    });

    it("返回的数组应该包含所有预设", () => {
      const configs = getAllPresetConfigs();
      expect(configs).toContain(PROMPT_MAIN_BATCH_TOOLBAR);
      expect(configs).toContain(IMAGE_MAIN_BATCH_TOOLBAR);
    });
  });
});
