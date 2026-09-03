/**
 * DetailDataService 单元测试
 *
 * 通过 fake 端口验证「纯数据」关注点：持久化、缓存失效、列表刷新事件，
 * 不依赖 DOM 与 Manager 本地状态。
 */

import { describe, it, expect, vi } from "vitest";
import { DetailDataService } from "../../src/renderer/services/DetailDataService.ts";
import { Events } from "../../src/renderer/constants.ts";
import type { DetailEventBusPort } from "../../src/renderer/services/DetailDataService.ts";
import type { IImage, PromptRefView } from "../../src/types/entities.ts";

function makeApi() {
  return {
    updatePrompt: vi.fn().mockResolvedValue(undefined),
    updateImage: vi.fn().mockResolvedValue(undefined),
    getPromptById: vi.fn().mockResolvedValue(null),
    getImageById: vi.fn().mockResolvedValue(null),
    logError: vi.fn(),
  };
}

function makeEventBus(): DetailEventBusPort {
  return { emit: vi.fn() };
}

describe("DetailDataService", () => {
  it("savePromptImages 调用 updatePrompt 并通知图像/提示词列表刷新", async () => {
    const api = makeApi();
    const eventBus = makeEventBus();
    const svc = new DetailDataService({ eventBus, api });
    const images = [{ id: "i1" } as IImage];
    await svc.savePromptImages("p1", images);
    expect(api.updatePrompt).toHaveBeenCalledWith("p1", { images });
    expect(eventBus.emit).toHaveBeenCalledWith(Events.IMAGES_CHANGED);
    expect(eventBus.emit).toHaveBeenCalledWith(Events.PROMPTS_CHANGED);
  });

  it("syncImagesSafety 逐个 updateImage 并返回成功 ID", async () => {
    const api = makeApi();
    const eventBus = makeEventBus();
    const svc = new DetailDataService({ eventBus, api });
    const synced = await svc.syncImagesSafety(["i1", "i2"], 1);
    expect(api.updateImage).toHaveBeenCalledTimes(2);
    expect(api.updateImage).toHaveBeenCalledWith("i1", { isSafe: 1 });
    expect(api.updateImage).toHaveBeenCalledWith("i2", { isSafe: 1 });
    expect(synced).toEqual(["i1", "i2"]);
    expect(eventBus.emit).toHaveBeenCalledWith(Events.IMAGES_CHANGED);
  });

  it("syncImagesSafety 单个失败不影响其余并记日志", async () => {
    const api = makeApi();
    api.updateImage.mockRejectedValueOnce(new Error("boom"));
    const eventBus = makeEventBus();
    const svc = new DetailDataService({ eventBus, api });
    const synced = await svc.syncImagesSafety(["i1", "i2"], 1);
    expect(synced).toEqual(["i2"]);
    expect(api.logError).toHaveBeenCalledTimes(1);
  });

  it("saveImagePrompts 仅传 id 并通知刷新", async () => {
    const api = makeApi();
    const eventBus = makeEventBus();
    const svc = new DetailDataService({ eventBus, api });
    const prompts = [{ promptId: "r1" }, { promptId: "r2" }] as PromptRefView[];
    await svc.saveImagePrompts("img1", prompts);
    expect(api.updateImage).toHaveBeenCalledWith("img1", {
      prompts: [{ id: "r1" }, { id: "r2" }],
    });
    expect(eventBus.emit).toHaveBeenCalledWith(Events.PROMPTS_CHANGED);
    expect(eventBus.emit).toHaveBeenCalledWith(Events.IMAGES_CHANGED);
  });

  it("syncPromptsSafety 逐个 updatePrompt 并返回成功 ID", async () => {
    const api = makeApi();
    const eventBus = makeEventBus();
    const svc = new DetailDataService({ eventBus, api });
    const synced = await svc.syncPromptsSafety(["p1", "p2"], 0);
    expect(api.updatePrompt).toHaveBeenCalledWith("p1", { isSafe: 0 });
    expect(api.updatePrompt).toHaveBeenCalledWith("p2", { isSafe: 0 });
    expect(synced).toEqual(["p1", "p2"]);
    expect(eventBus.emit).toHaveBeenCalledWith(Events.PROMPTS_CHANGED);
  });
});
