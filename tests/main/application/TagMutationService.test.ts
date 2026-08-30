import { describe, it, expect } from "vitest";
import {
  TagMutationService,
  type TagMutationTagsPort,
} from "../../../src/main/application/TagMutationService.js";

function createDeps() {
  const calls: string[] = [];

  const tags: TagMutationTagsPort = {
    addPromptTag: async (name) => {
      calls.push(`addPromptTag:${name}`);
      return 1;
    },
    addPromptTags: async (promptId, tagNames) => {
      calls.push(`addPromptTags:${promptId}:${tagNames.join(",")}`);
    },
    addPromptTagsBatch: async (promptIds, tagNames) => {
      calls.push(`addPromptTagsBatch:${promptIds.length}:${tagNames.join(",")}`);
      return { success: true, added: tagNames.length };
    },
    deletePromptTag: async (name) => {
      calls.push(`deletePromptTag:${name}`);
    },
    deletePromptTags: async (names) => {
      calls.push(`deletePromptTags:${names.join(",")}`);
      return { success: true, deleted: names.length };
    },
    addImageTag: async (name) => {
      calls.push(`addImageTag:${name}`);
    },
    addImageTags: async (imageId, tagNames) => {
      calls.push(`addImageTags:${imageId}:${tagNames.join(",")}`);
    },
    addImageTagsBatch: async (imageIds, tagNames) => {
      calls.push(`addImageTagsBatch:${imageIds.length}:${tagNames.join(",")}`);
      return { success: true, added: tagNames.length };
    },
    deleteImageTag: async (name) => {
      calls.push(`deleteImageTag:${name}`);
    },
    deleteImageTags: async (names) => {
      calls.push(`deleteImageTags:${names.join(",")}`);
      return { success: true, deleted: names.length };
    },
    renameTag: async (type, oldTag, newTag) => {
      calls.push(`renameTag:${type}:${oldTag}->${newTag}`);
      return ["remaining"];
    },
    getPromptTags: async () => {
      calls.push("getPromptTags");
      return ["prompt-tag"];
    },
    getImageTags: async () => {
      calls.push("getImageTags");
      return ["image-tag"];
    },
  };

  const cache = {
    refreshAll: async () => {
      calls.push("refreshAll");
    },
  };

  return { deps: { tags, cache }, calls };
}

describe("TagMutationService", () => {
  it("addPromptTag:先写库再重建缓存,返回最新标签列表", async () => {
    const { deps, calls } = createDeps();
    const result = await new TagMutationService(deps).addPromptTag("new-tag");

    expect(result).toEqual(["prompt-tag"]);
    expect(calls.indexOf("addPromptTag:new-tag")).toBeLessThan(calls.indexOf("refreshAll"));
    expect(calls.indexOf("refreshAll")).toBeLessThan(calls.indexOf("getPromptTags"));
  });

  it("renamePromptTag:改名后必须重建缓存(旧名移除/新名生效的回归测试)", async () => {
    const { deps, calls } = createDeps();
    const result = await new TagMutationService(deps).renamePromptTag("old", "new");

    expect(result).toEqual(["remaining"]);
    expect(calls).toContain("renameTag:prompt:old->new");
    expect(calls).toContain("refreshAll");
    expect(calls.indexOf("renameTag:prompt:old->new")).toBeLessThan(calls.indexOf("refreshAll"));
  });

  it("deletePromptTags:批量删除后重建缓存并返回剩余标签", async () => {
    const { deps, calls } = createDeps();
    const result = await new TagMutationService(deps).deletePromptTags(["a", "b"]);

    expect(result).toEqual({ success: true, deleted: 2, tags: ["prompt-tag"] });
    expect(calls).toContain("refreshAll");
  });

  it("deletePromptTag:删除后重建缓存", async () => {
    const { deps, calls } = createDeps();
    const result = await new TagMutationService(deps).deletePromptTag("a");

    expect(result).toEqual(["prompt-tag"]);
    expect(calls.indexOf("deletePromptTag:a")).toBeLessThan(calls.indexOf("refreshAll"));
  });

  it("image 侧与 prompt 侧对称:批量加标签与删除都触发缓存重建", async () => {
    const { deps, calls } = createDeps();
    const service = new TagMutationService(deps);

    await service.addImageTagsBatch(["i1", "i2"], ["t1"]);
    await service.addImageTags("i1", ["t2"]);
    await service.deleteImageTag("t1");
    await service.deleteImageTags(["t2"]);
    await service.addImageTag("t3");

    expect(calls.filter((c) => c === "refreshAll").length).toBe(5);
    expect(
      calls.filter((c) => c.startsWith("addImageTag") || c.startsWith("deleteImageTag")).length,
    ).toBe(5);
  });

  it("addPromptTagsBatch:批量集合操作后重建缓存", async () => {
    const { deps, calls } = createDeps();
    const result = await new TagMutationService(deps).addPromptTagsBatch(["p1", "p2"], ["t"]);

    expect(result).toEqual({ success: true, added: 1 });
    expect(calls.indexOf("addPromptTagsBatch:2:t")).toBeLessThan(calls.indexOf("refreshAll"));
  });
});
