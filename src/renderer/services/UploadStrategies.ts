import { ImageUploadService } from "./ImageUploadService.ts";
import type { ImageUploadManagerDeps } from "../app.types.ts";

// 进度回调函数类型
type ProgressCallback = (current: number, total: number) => void;

// 文件信息接口
interface FileInfo {
  path: string;
  name: string;
}

// 图像信息接口（包含 duplicateType）
interface ImageInfo {
  id: string;
  isDuplicate?: boolean;
  duplicateType?: "restored_from_trash" | "existing";
  [key: string]: unknown;
}

// 上传结果接口
interface UploadResult {
  success: boolean;
  message?: string;
  filePaths?: string[];
  images?: ImageInfo[];
  count?: number;
}

// 应用接口（简化）

/**
 * 上传策略基类
 * 纯策略逻辑，不包含 UI 操作
 */
export abstract class UploadStrategy {
  protected app: ImageUploadManagerDeps;
  protected imageUploadService: ImageUploadService;

  constructor(app: ImageUploadManagerDeps) {
    this.app = app;
    this.imageUploadService = new ImageUploadService(app);
  }

  /**
   * 选择文件后的处理
   * @param filePaths - 文件路径数组
   * @returns 处理结果
   */
  abstract selectFiles(filePaths: string[]): Promise<UploadResult>;

  /**
   * 移除文件
   * @param index - 文件索引
   * @returns 处理结果
   */
  abstract removeFile(index: number): Promise<UploadResult> | UploadResult;

  /**
   * 获取当前文件列表
   * @returns 文件路径数组
   */
  abstract getFilePaths(): string[];

  /**
   * 清理状态
   */
  abstract clear(): void;
}

/**
 * 延迟保存策略
 * 选择文件后只记录路径，确认后才保存到数据目录
 */
export class DelaySaveStrategy extends UploadStrategy {
  private selectedFilePaths: string[];
  private savedImages: unknown[];

  constructor(app: ImageUploadManagerDeps) {
    super(app);
    this.selectedFilePaths = [];
    this.savedImages = [];
  }

  /**
   * 选择文件（仅记录路径，不保存）
   * @param filePaths - 文件路径数组
   * @returns 处理结果
   */
  async selectFiles(filePaths: string[]): Promise<UploadResult> {
    if (!filePaths || filePaths.length === 0) {
      return { success: false, message: "No files selected" };
    }

    this.selectedFilePaths = [...this.selectedFilePaths, ...filePaths];
    return {
      success: true,
      filePaths: [...this.selectedFilePaths],
      count: this.selectedFilePaths.length,
    };
  }

  /**
   * 确认保存（保存到数据目录）
   * @param source - 来源标识
   * @param onProgress - 进度回调 (current, total) => void
   * @returns 保存结果
   */
  async confirm(source = "upload", onProgress?: ProgressCallback): Promise<UploadResult> {
    if (this.selectedFilePaths.length === 0) {
      return { success: false, message: "No files to save" };
    }

    const fileInfos: FileInfo[] = this.selectedFilePaths.map((path) => ({
      path,
      name: path.split(/[\\/]/).pop() || "",
    }));

    try {
      const results = await this.imageUploadService.uploadBatch(fileInfos, {
        source,
        onProgress,
      });

      this.savedImages = results;

      // 不再这里显示 toast，由调用方（ImageUploadManager）统一处理
      return {
        success: true,
        images: results as ImageInfo[],
        count: results.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.app.showToast?.(`保存失败: ${message}`, "error");
      return { success: false, message };
    }
  }

  /**
   * 移除选择的文件
   * @param index - 文件索引
   * @returns 处理结果
   */
  removeFile(index: number): UploadResult {
    if (index >= 0 && index < this.selectedFilePaths.length) {
      this.selectedFilePaths.splice(index, 1);
      return { success: true, filePaths: [...this.selectedFilePaths] };
    }
    return { success: false, message: "Invalid index" };
  }

  /**
   * 获取当前选择的文件路径
   * @returns 文件路径数组
   */
  getFilePaths(): string[] {
    return [...this.selectedFilePaths];
  }

  /**
   * 获取已保存的图像
   * @returns 图像数组
   */
  getSavedImages(): unknown[] {
    return [...this.savedImages];
  }

  /**
   * 清理状态
   */
  clear(): void {
    this.selectedFilePaths = [];
    this.savedImages = [];
  }
}

/**
 * 直接保存策略
 * 选择文件后立即保存到数据目录
 */
export class DirectSaveStrategy extends UploadStrategy {
  private savedImages: unknown[];

  constructor(app: ImageUploadManagerDeps) {
    super(app);
    this.savedImages = [];
  }

  /**
   * 选择文件并立即保存
   * @param filePaths - 文件路径数组
   * @param source - 来源标识
   * @returns 处理结果
   */
  async selectFiles(filePaths: string[], source = "upload"): Promise<UploadResult> {
    if (!filePaths || filePaths.length === 0) {
      return { success: false, message: "No files selected" };
    }

    const fileInfos: FileInfo[] = filePaths.map((path) => ({
      path,
      name: path.split(/[\\/]/).pop() || "",
    }));

    try {
      const results = await this.imageUploadService.uploadBatch(fileInfos, { source });

      this.savedImages = [...this.savedImages, ...results];

      // 不再这里显示 toast，由调用方（ImageUploadManager）统一处理
      return {
        success: true,
        images: results as ImageInfo[],
        count: results.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.app.showToast?.(`保存失败: ${message}`, "error");
      return { success: false, message };
    }
  }

  /**
   * 移除已保存的图像
   * @param index - 图像索引
   * @returns 处理结果
   */
  async removeFile(index: number): Promise<UploadResult> {
    if (index >= 0 && index < this.savedImages.length) {
      const image = this.savedImages[index] as { id: string };
      try {
        await this.imageUploadService.delete(image.id);
        this.savedImages.splice(index, 1);
        return { success: true, images: [...this.savedImages] as ImageInfo[] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, message };
      }
    }
    return { success: false, message: "Invalid index" };
  }

  /**
   * 获取已保存的图像
   * @returns 图像数组
   */
  getSavedImages(): unknown[] {
    return [...this.savedImages];
  }

  /**
   * 设置已保存的图像（用于从缓存恢复）
   * @param images - 图像数组
   */
  setSavedImages(images: unknown[]): void {
    this.savedImages = [...images];
  }

  /**
   * 获取当前文件路径（直接保存策略返回空数组，因为文件已保存）
   * @returns 文件路径数组
   */
  getFilePaths(): string[] {
    return [];
  }

  /**
   * 清理状态
   */
  clear(): void {
    this.savedImages = [];
  }
}
