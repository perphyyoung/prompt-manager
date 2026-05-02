import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiTestFactory } from "../e2e/factories/api-factory.ts";
import { PromptApiFactory } from "../e2e/factories/prompt-factory.ts";
import { ImageApiFactory } from "../e2e/factories/image-factory.ts";
import { BaseTestDataFactory } from "../e2e/factories/base-factory.ts";
import { ElectronTestHelper } from "../e2e/electron-test.ts";
import type { IPrompt, IImage } from "../src/types/entities.ts";

vi.mock("../e2e/factories/image-utils.ts", () => ({
  generateTempImage: vi.fn(() => Promise.resolve("/tmp/test.png")),
}));

/**
 * 模拟 window.electronAPI
 */
const mockApi: Record<string, ReturnType<typeof vi.fn>> = {};

function setupMockApi(methods: Record<string, ReturnType<typeof vi.fn>>) {
  Object.keys(methods).forEach((key) => {
    mockApi[key] = methods[key];
  });
}

beforeEach(() => {
  Object.defineProperty(global, "window", {
    value: {
      electronAPI: mockApi,
      setTimeout: (fn: TimerHandler, delay?: number): number => global.setTimeout(fn, delay),
      clearTimeout: (id: number | undefined): void => global.clearTimeout(id),
    },
    writable: true,
    configurable: true,
  });

  Object.keys(mockApi).forEach((key) => {
    (mockApi[key] as ReturnType<typeof vi.fn>).mockReset();
  });
});

/**
 * 创建 Mock Page 对象
 * page.evaluate 接收两个参数: (fn, arg)
 * fn 是函数, arg 是传递给 fn 的参数
 * 在单元测试中，我们直接将 fn 作为普通函数调用，传入 arg
 */
function createMockPage() {
  return {
    evaluate: vi.fn(async (fnOrStr: unknown, arg?: unknown) => {
      if (typeof fnOrStr === "function") {
        return await (fnOrStr as Function)(arg);
      }
      return undefined;
    }),
  };
}

describe("BaseTestDataFactory", () => {
  class TestFactory extends BaseTestDataFactory<{ id: string; name: string }> {
    async create(): Promise<{ id: string; name: string }> {
      return { id: "1", name: "test" };
    }

    async createTag(): Promise<void> {}

    protected async _linkTagsToEntity(): Promise<void> {}
    protected async _getTagGroups(): Promise<Array<{ id: number; name: string; sortOrder: number }>> {
      return [];
    }
    protected async _createTagGroupApi(): Promise<{ id: number; name: string; sortOrder: number } | null> {
      return null;
    }
    protected async _assignTagToGroup(): Promise<void> {}
  }

  it("generateName 应生成正确格式的名称", () => {
    const page = createMockPage();
    const factory = new TestFactory(page as any);

    const name = (factory as any).generateName("test");

    expect(name).toMatch(/^e2e_test_\d+_[a-z0-9]{5}$/);
  });

  it("_batchCreate 应调用 createFn 指定次数", async () => {
    const page = createMockPage();
    const factory = new TestFactory(page as any);
    const createFn = vi.fn((label: string) => Promise.resolve({ id: label, name: label }));

    const result = await (factory as any)._batchCreate(3, "test", createFn);

    expect(createFn).toHaveBeenCalledTimes(3);
    expect(createFn).toHaveBeenCalledWith("test_0");
    expect(createFn).toHaveBeenCalledWith("test_1");
    expect(createFn).toHaveBeenCalledWith("test_2");
    expect(result).toHaveLength(3);
  });
});

describe("PromptApiFactory", () => {
  it("create 应调用 addPrompt API 并返回结果", async () => {
    const promptResult = { id: "123", title: "test", content: "content", isDeleted: false, tags: [], images: [] } as IPrompt;
    const addPrompt = vi.fn(() => Promise.resolve(promptResult));
    setupMockApi({ addPrompt });

    const page = createMockPage();
    const factory = new PromptApiFactory(page as any);
    const result = await factory.create({ label: "test" });

    expect(addPrompt).toHaveBeenCalledTimes(1);
    expect(result).toEqual(promptResult);
  });

  it("create 使用自定义 title 时应直接使用该 title", async () => {
    let capturedData: any;
    const promptResult = { id: "123", title: "my_title", content: "content", isDeleted: false, tags: [], images: [] } as IPrompt;
    const addPrompt = vi.fn((data: any) => {
      capturedData = data;
      return Promise.resolve(promptResult);
    });
    setupMockApi({ addPrompt });

    const page = createMockPage();
    const factory = new PromptApiFactory(page as any);
    await factory.create({ label: "test", title: "my_title" });

    expect(capturedData.title).toBe("my_title");
  });

  it("create 失败时应抛出异常", async () => {
    const addPrompt = vi.fn(() => Promise.resolve(null));
    setupMockApi({ addPrompt });

    const page = createMockPage();
    const factory = new PromptApiFactory(page as any);

    await expect(factory.create({ label: "test" })).rejects.toThrow(
      "Failed to create prompt with label: test",
    );
  });

  it("createBatch 应创建指定数量的提示词", async () => {
    let counter = 0;
    const addPrompt = vi.fn(() => {
      counter++;
      return Promise.resolve({
        id: `prompt_${counter}`,
        title: "test",
        content: "content",
        isDeleted: false,
        tags: [],
        images: [],
      } as IPrompt);
    });
    setupMockApi({ addPrompt });

    const page = createMockPage();
    const factory = new PromptApiFactory(page as any);
    const result = await factory.createBatch(3, "batch");

    expect(result).toHaveLength(3);
    expect(addPrompt).toHaveBeenCalledTimes(3);
  });

  it("createWithImages 应设置 images 字段", async () => {
    let capturedData: any;
    const promptResult: IPrompt = {
      id: "123",
      title: "test",
      content: "content",
      isDeleted: false,
      tags: [],
      images: [],
      isSafe: 1,
      isFavorite: 0,
      contentTranslate: "",
      note: "",
      createdAt: "",
      updatedAt: "",
    };
    const addPrompt = vi.fn((data: any) => {
      capturedData = data;
      return Promise.resolve({ ...promptResult, ...data });
    });
    setupMockApi({ addPrompt });

    const page = createMockPage();
    const factory = new PromptApiFactory(page as any);
    await factory.createWithImages(
      { label: "test" },
      ["img1", "img2"],
    );

    expect(capturedData.images).toEqual([{ id: "img1" }, { id: "img2" }]);
  });

  it("createWithTags 应调用 addPromptTags", async () => {
    const promptResult = { id: "123", title: "test", content: "content", isDeleted: false, tags: [], images: [] } as IPrompt;
    const addPrompt = vi.fn(() => Promise.resolve(promptResult));
    const addPromptTags = vi.fn(() => Promise.resolve(undefined));
    setupMockApi({ addPrompt, addPromptTags });

    const page = createMockPage();
    const factory = new PromptApiFactory(page as any);
    const result = await factory.createWithTags({ label: "test" }, ["tag1", "tag2"]);

    expect(result.id).toBe("123");
    expect(addPromptTags).toHaveBeenCalledTimes(1);
    expect(addPromptTags).toHaveBeenCalledWith("123", ["tag1", "tag2"]);
  });

  it("createTagGroup 应调用 createPromptTagGroup API 并返回结果", async () => {
    const groupResult = { id: 1, name: "test_group", sortOrder: 0 };
    const createPromptTagGroup = vi.fn(() => Promise.resolve(groupResult));
    setupMockApi({ createPromptTagGroup });

    const page = createMockPage();
    const factory = new PromptApiFactory(page as any);
    const result = await factory.createTagGroup("test_group");

    expect(createPromptTagGroup).toHaveBeenCalledTimes(1);
    expect(createPromptTagGroup).toHaveBeenCalledWith("test_group", 0);
    expect(result).toEqual(groupResult);
  });

  it("createTagGroup isTop=true 时应查询现有组并取最小 sortOrder - 1", async () => {
    const getPromptTagGroups = vi.fn(() => Promise.resolve([
      { id: 1, name: "group1", sortOrder: 2 },
      { id: 2, name: "group2", sortOrder: 5 },
    ]));
    const groupResult = { id: 3, name: "top_group", sortOrder: 1 };
    const createPromptTagGroup = vi.fn((name: string, sortOrder: number) => {
      expect(sortOrder).toBe(1); // min(2, 5) - 1 = 1
      return Promise.resolve({ ...groupResult, sortOrder });
    });
    setupMockApi({ getPromptTagGroups, createPromptTagGroup });

    const page = createMockPage();
    const factory = new PromptApiFactory(page as any);
    const result = await factory.createTagGroup("top_group", true);

    expect(getPromptTagGroups).toHaveBeenCalledTimes(1);
    expect(result.sortOrder).toBe(1);
  });

  it("createTagGroup isTop=true 且无现有组时应使用 sortOrder -1", async () => {
    const getPromptTagGroups = vi.fn(() => Promise.resolve([]));
    const groupResult = { id: 1, name: "first_group", sortOrder: -1 };
    const createPromptTagGroup = vi.fn((name: string, sortOrder: number) => {
      expect(sortOrder).toBe(-1); // 0 - 1 = -1
      return Promise.resolve({ ...groupResult, sortOrder });
    });
    setupMockApi({ getPromptTagGroups, createPromptTagGroup });

    const page = createMockPage();
    const factory = new PromptApiFactory(page as any);
    await factory.createTagGroup("first_group", true);
  });

  it("createTagGroup 失败时应抛出异常", async () => {
    const createPromptTagGroup = vi.fn(() => Promise.resolve(null));
    setupMockApi({ createPromptTagGroup });

    const page = createMockPage();
    const factory = new PromptApiFactory(page as any);

    await expect(factory.createTagGroup("fail_group")).rejects.toThrow(
      "Failed to create tag group: fail_group",
    );
  });

  it("createTagInGroup 应创建标签组并在其中创建标签", async () => {
    let addedTag: string | undefined;
    const addPromptTag = vi.fn((tag: string) => {
      addedTag = tag;
      return Promise.resolve(undefined);
    });
    const groupResult = { id: 1, name: "test_group", sortOrder: 0 };
    const createPromptTagGroup = vi.fn(() => Promise.resolve(groupResult));
    const assignPromptTagToBelongGroup = vi.fn(() => Promise.resolve(undefined));
    setupMockApi({ addPromptTag, createPromptTagGroup, assignPromptTagToBelongGroup });

    vi.spyOn(global.Date, "now").mockReturnValue(1718307600000);

    const page = createMockPage();
    const factory = new PromptApiFactory(page as any);
    const result = await factory.createTagInGroup("test_group", "my_tag");

    expect(result.startsWith("e2e_my_tag_")).toBe(true);
    expect(addPromptTag).toHaveBeenCalledTimes(1);
    expect(createPromptTagGroup).toHaveBeenCalledWith("test_group", 0);
    expect(assignPromptTagToBelongGroup).toHaveBeenCalledWith(addedTag, 1);
  });

  it("createTagInGroup isTop=true 时应创建首位组", async () => {
    const getPromptTagGroups = vi.fn(() => Promise.resolve([
      { id: 1, name: "group1", sortOrder: 2 },
    ]));
    const addPromptTag = vi.fn(() => Promise.resolve(undefined));
    const groupResult = { id: 2, name: "top_group", sortOrder: 1 };
    const createPromptTagGroup = vi.fn((name: string, sortOrder: number) => {
      expect(sortOrder).toBe(1); // min(2) - 1 = 1
      return Promise.resolve({ ...groupResult, sortOrder });
    });
    const assignPromptTagToBelongGroup = vi.fn(() => Promise.resolve(undefined));
    setupMockApi({ getPromptTagGroups, addPromptTag, createPromptTagGroup, assignPromptTagToBelongGroup });

    vi.spyOn(global.Date, "now").mockReturnValue(1718307600000);

    const page = createMockPage();
    const factory = new PromptApiFactory(page as any);
    const result = await factory.createTagInGroup("top_group", "my_tag", true);

    expect(result.startsWith("e2e_my_tag_")).toBe(true);
  });
});

describe("ImageApiFactory", () => {
  it("create 应调用 saveImageFile API", async () => {
    const saveImageFile = vi.fn(() => Promise.resolve({ id: "456" }));
    const getImageById = vi.fn(() => Promise.resolve({ id: "456", fileName: "test.png" } as IImage));
    setupMockApi({ saveImageFile, getImageById });

    const page = createMockPage();

    const factory = new ImageApiFactory(page as any);
    const result = await factory.create({ label: "test" });

    expect(saveImageFile).toHaveBeenCalledTimes(1);
    expect(getImageById).toHaveBeenCalledWith("456");
    expect(result).toEqual({ id: "456", fileName: "test.png" });
  });

  it("create 失败时应抛出异常", async () => {
    const saveImageFile = vi.fn(() => Promise.resolve(null));
    setupMockApi({ saveImageFile });

    const page = createMockPage();

    const factory = new ImageApiFactory(page as any);

    await expect(factory.create({ label: "test" })).rejects.toThrow(
      "Failed to create image with label: test",
    );
  });

  it("createBatch 应创建指定数量的图像", async () => {
    let counter = 0;
    const saveImageFile = vi.fn(() => Promise.resolve({ id: `img_${++counter}` }));
    const getImageById = vi.fn((id: string) => Promise.resolve({ id } as IImage));
    setupMockApi({ saveImageFile, getImageById });

    const page = createMockPage();

    const factory = new ImageApiFactory(page as any);
    const result = await factory.createBatch(2, "batch");

    expect(result).toHaveLength(2);
    expect(saveImageFile).toHaveBeenCalledTimes(2);
  });

  it("createWithTags 应调用 addImageTags", async () => {
    const saveImageFile = vi.fn(() => Promise.resolve({ id: "456" }));
    const getImageById = vi.fn(() => Promise.resolve({ id: "456", fileName: "test.png" } as IImage));
    const addImageTags = vi.fn(() => Promise.resolve(undefined));
    setupMockApi({ saveImageFile, getImageById, addImageTags });

    const page = createMockPage();

    const factory = new ImageApiFactory(page as any);
    await factory.createWithTags({ label: "test" }, ["tag1", "tag2"]);

    expect(addImageTags).toHaveBeenCalledTimes(1);
    expect(addImageTags).toHaveBeenCalledWith("456", ["tag1", "tag2"]);
  });

  it("createWithPromptCount 应创建图像并关联指定数量的提示词", async () => {
    const saveImageFile = vi.fn(() => Promise.resolve({ id: "img1" }));
    const getImageById = vi.fn(() => Promise.resolve({ id: "img1" } as IImage));
    const addPrompt = vi.fn((data: any) => Promise.resolve({ id: "prompt1", ...data, isDeleted: false } as IPrompt));
    setupMockApi({ saveImageFile, getImageById, addPrompt });

    const page = createMockPage();

    const factory = new ImageApiFactory(page as any);
    const result = await factory.createWithPromptCount("test", 2, "prompt");

    expect(result.image).toEqual({ id: "img1" });
    expect(result.prompts).toHaveLength(2);
    expect(addPrompt).toHaveBeenCalledTimes(2);
    const promptCallArg = addPrompt.mock.calls[0][0];
    expect(promptCallArg.images).toEqual([{ id: "img1" }]);
  });

  it("createWithPromptCount 为 0 时应只创建图像", async () => {
    const saveImageFile = vi.fn(() => Promise.resolve({ id: "img1" }));
    const getImageById = vi.fn(() => Promise.resolve({ id: "img1" } as IImage));
    const addPrompt = vi.fn(() => Promise.resolve({ id: "prompt1" } as IPrompt));
    setupMockApi({ saveImageFile, getImageById, addPrompt });

    const page = createMockPage();

    const factory = new ImageApiFactory(page as any);
    const result = await factory.createWithPromptCount("test", 0);

    expect(result.image).toEqual({ id: "img1" });
    expect(result.prompts).toHaveLength(0);
    expect(addPrompt).not.toHaveBeenCalled();
  });

  it("createTagGroup 应调用 createImageTagGroup API 并返回结果", async () => {
    const groupResult = { id: 1, name: "test_group", sortOrder: 0 };
    const createImageTagGroup = vi.fn(() => Promise.resolve(groupResult));
    setupMockApi({ createImageTagGroup });

    const page = createMockPage();

    const factory = new ImageApiFactory(page as any);
    const result = await factory.createTagGroup("test_group");

    expect(createImageTagGroup).toHaveBeenCalledTimes(1);
    expect(createImageTagGroup).toHaveBeenCalledWith("test_group", 0);
    expect(result).toEqual(groupResult);
  });

  it("createTagGroup isTop=true 时应查询现有组并取最小 sortOrder - 1", async () => {
    const getImageTagGroups = vi.fn(() => Promise.resolve([
      { id: 1, name: "group1", sortOrder: 3 },
      { id: 2, name: "group2", sortOrder: 7 },
    ]));
    const groupResult = { id: 3, name: "top_group", sortOrder: 2 };
    const createImageTagGroup = vi.fn((name: string, sortOrder: number) => {
      expect(sortOrder).toBe(2); // min(3, 7) - 1 = 2
      return Promise.resolve({ ...groupResult, sortOrder });
    });
    setupMockApi({ getImageTagGroups, createImageTagGroup });

    const page = createMockPage();

    const factory = new ImageApiFactory(page as any);
    const result = await factory.createTagGroup("top_group", true);

    expect(getImageTagGroups).toHaveBeenCalledTimes(1);
    expect(result.sortOrder).toBe(2);
  });

  it("createTagGroup isTop=true 且无现有组时应使用 sortOrder -1", async () => {
    const getImageTagGroups = vi.fn(() => Promise.resolve([]));
    const groupResult = { id: 1, name: "first_group", sortOrder: -1 };
    const createImageTagGroup = vi.fn((name: string, sortOrder: number) => {
      expect(sortOrder).toBe(-1); // 0 - 1 = -1
      return Promise.resolve({ ...groupResult, sortOrder });
    });
    setupMockApi({ getImageTagGroups, createImageTagGroup });

    const page = createMockPage();

    const factory = new ImageApiFactory(page as any);
    await factory.createTagGroup("first_group", true);
  });

  it("createTagGroup 失败时应抛出异常", async () => {
    const createImageTagGroup = vi.fn(() => Promise.resolve(null));
    setupMockApi({ createImageTagGroup });

    const page = createMockPage();

    const factory = new ImageApiFactory(page as any);

    await expect(factory.createTagGroup("fail_group")).rejects.toThrow(
      "Failed to create tag group: fail_group",
    );
  });

  it("createTagInGroup 应创建标签组并在其中创建标签", async () => {
    let addedTag: string | undefined;
    const addImageTag = vi.fn((tag: string) => {
      addedTag = tag;
      return Promise.resolve(undefined);
    });
    const groupResult = { id: 1, name: "test_group", sortOrder: 0 };
    const createImageTagGroup = vi.fn(() => Promise.resolve(groupResult));
    const assignImageTagToBelongGroup = vi.fn(() => Promise.resolve(undefined));
    setupMockApi({ addImageTag, createImageTagGroup, assignImageTagToBelongGroup });

    vi.spyOn(global.Date, "now").mockReturnValue(1718307600000);

    const page = createMockPage();

    const factory = new ImageApiFactory(page as any);
    const result = await factory.createTagInGroup("test_group", "my_tag");

    expect(result.startsWith("e2e_my_tag_")).toBe(true);
    expect(addImageTag).toHaveBeenCalledTimes(1);
    expect(createImageTagGroup).toHaveBeenCalledWith("test_group", 0);
    expect(assignImageTagToBelongGroup).toHaveBeenCalledWith(addedTag, 1);
  });

  it("createTagInGroup isTop=true 时应创建首位组", async () => {
    const getImageTagGroups = vi.fn(() => Promise.resolve([
      { id: 1, name: "group1", sortOrder: 2 },
    ]));
    const addImageTag = vi.fn(() => Promise.resolve(undefined));
    const groupResult = { id: 2, name: "top_group", sortOrder: 1 };
    const createImageTagGroup = vi.fn((name: string, sortOrder: number) => {
      expect(sortOrder).toBe(1); // min(2) - 1 = 1
      return Promise.resolve({ ...groupResult, sortOrder });
    });
    const assignImageTagToBelongGroup = vi.fn(() => Promise.resolve(undefined));
    setupMockApi({ getImageTagGroups, addImageTag, createImageTagGroup, assignImageTagToBelongGroup });

    vi.spyOn(global.Date, "now").mockReturnValue(1718307600000);

    const page = createMockPage();

    const factory = new ImageApiFactory(page as any);
    const result = await factory.createTagInGroup("top_group", "my_tag", true);

    expect(result.startsWith("e2e_my_tag_")).toBe(true);
  });
});

describe("ApiTestFactory", () => {
  it("createPromptFactory 应返回 PromptApiFactory 实例", () => {
    const page = createMockPage();
    const factory = new ApiTestFactory(page as any);

    const promptFactory = factory.createPromptFactory();

    expect(promptFactory).toBeInstanceOf(PromptApiFactory);
  });

  it("createImageFactory 应返回 ImageApiFactory 实例", () => {
    const page = createMockPage();
    const factory = new ApiTestFactory(page as any);

    const imageFactory = factory.createImageFactory();

    expect(imageFactory).toBeInstanceOf(ImageApiFactory);
  });

  it("多次调用 createPromptFactory 应返回同一实例", () => {
    const page = createMockPage();
    const factory = new ApiTestFactory(page as any);

    const factory1 = factory.createPromptFactory();
    const factory2 = factory.createPromptFactory();

    expect(factory1).toBe(factory2);
  });

  it("多次调用 createImageFactory 应返回同一实例", () => {
    const page = createMockPage();
    const factory = new ApiTestFactory(page as any);

    const factory1 = factory.createImageFactory();
    const factory2 = factory.createImageFactory();

    expect(factory1).toBe(factory2);
  });
});

describe("ElectronTestHelper.getApiFactory", () => {
  it("未启动时应抛出异常", () => {
    const helper = new ElectronTestHelper();

    expect(() => helper.getApiFactory()).toThrow(
      "Electron app not launched, call launch() first",
    );
  });

  it("已启动后应返回 ApiTestFactory 实例", () => {
    const helper = new ElectronTestHelper();
    helper.page = { evaluate: vi.fn() } as any;

    const factory = helper.getApiFactory();

    expect(factory).toBeInstanceOf(ApiTestFactory);
  });

  it("多次调用应返回同一实例", () => {
    const helper = new ElectronTestHelper();
    helper.page = { evaluate: vi.fn() } as any;

    const factory1 = helper.getApiFactory();
    const factory2 = helper.getApiFactory();

    expect(factory1).toBe(factory2);
  });
});
