import type { Page } from "@playwright/test";
import type {
  ITestDataFactory,
  IPromptDataFactory,
  IImageDataFactory,
} from "./interfaces.ts";
import { PromptApiFactory } from "./prompt-factory.ts";
import { ImageApiFactory } from "./image-factory.ts";

/**
 * API 测试数据工厂
 * 实现抽象工厂接口，通过 electronAPI 创建测试数据
 */
export class ApiTestFactory implements ITestDataFactory {
  private page: Page;
  private promptFactory: IPromptDataFactory | null = null;
  private imageFactory: IImageDataFactory | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 创建提示词数据工厂
   */
  createPromptFactory(): IPromptDataFactory {
    if (!this.promptFactory) {
      this.promptFactory = new PromptApiFactory(this.page);
    }
    return this.promptFactory;
  }

  /**
   * 创建图像数据工厂
   */
  createImageFactory(): IImageDataFactory {
    if (!this.imageFactory) {
      this.imageFactory = new ImageApiFactory(this.page);
    }
    return this.imageFactory;
  }
}
