import { cacheManager } from "../../utils/index.ts";

interface SaveResult {
  success: boolean;
  error?: string;
}

/**
 * 保存策略接口
 */
export abstract class SaveStrategy {
  /**
   * 执行保存
   */
  abstract save(itemId: string, fieldName: string, value: unknown): Promise<SaveResult>;

  /**
   * 获取成功提示消息
   */
  abstract getSuccessMessage(fieldName: string, value: unknown): string;

  /**
   * 获取字段值
   */
  getFieldValue(element: HTMLElement): unknown {
    if (!element) return null;

    const tagName = element.tagName.toLowerCase();
    const inputElement = element as HTMLInputElement;
    const selectElement = element as HTMLSelectElement;

    if (tagName === "input" && inputElement.type === "checkbox") {
      return inputElement.checked;
    } else if (tagName === "select" && selectElement.multiple) {
      return Array.from(selectElement.selectedOptions).map((opt) => opt.value);
    } else {
      return (element as HTMLInputElement | HTMLTextAreaElement).value;
    }
  }
}

/**
 * 提示词保存策略
 */
export class PromptSaveStrategy extends SaveStrategy {
  private app: unknown;

  constructor(app: unknown) {
    super();
    this.app = app;
  }

  async save(itemId: string, fieldName: string, value: unknown): Promise<SaveResult> {
    const updateData: Record<string, unknown> = { [fieldName]: value };
    await window.electronAPI.updatePrompt(itemId, updateData);

    // Update cache
    const cachedPrompt = cacheManager.getCachedPrompt(itemId);
    if (cachedPrompt) {
      (cachedPrompt as Record<string, unknown>)[fieldName] = value;
    }

    return { success: true };
  }

  getSuccessMessage(fieldName: string, value: unknown): string {
    const messages: Record<string, string> = {
      isSafe: value ? "Marked as safe" : "Marked as unsafe",
      isFavorite: value ? "Added to favorites" : "Removed from favorites",
      title: "Title saved",
      content: "Content saved",
      contentTranslate: "Translation saved",
      note: "Note saved",
    };
    return messages[fieldName] || "Saved";
  }
}

/**
 * 图像保存策略
 */
export class ImageSaveStrategy extends SaveStrategy {
  private app: {
    currentImage?: { id: string | number; [key: string]: unknown };
  };

  constructor(app: { currentImage?: { id: string | number; [key: string]: unknown } }) {
    super();
    this.app = app;
  }

  async save(itemId: string, fieldName: string, value: unknown): Promise<SaveResult> {
    const updateData: Record<string, unknown> = { [fieldName]: value };
    await window.electronAPI.updateImage(itemId, updateData);

    const cachedImage = cacheManager.getCachedImage(itemId);
    if (cachedImage) {
      (cachedImage as Record<string, unknown>)[fieldName] = value;
    }

    // Update currentImage
    if (this.app.currentImage && String(this.app.currentImage.id) === String(itemId)) {
      this.app.currentImage[fieldName] = value;
    }

    return { success: true };
  }

  getSuccessMessage(fieldName: string, value: unknown): string {
    const messages: Record<string, string> = {
      isSafe: value ? "Marked as safe" : "Marked as unsafe",
      isFavorite: value ? "Added to favorites" : "Removed from favorites",
      fileName: "File name saved",
      note: "Note saved",
      tags: "Tags updated",
    };
    return messages[fieldName] || "Saved";
  }
}
