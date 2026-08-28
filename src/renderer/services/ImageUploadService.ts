/**
 * 图像上传服务
 * 负责处理图像上传的核心逻辑
 * 遵循单一职责原则：只处理上传，不处理 UI 或通知
 */

// 导入类型以确保 window.electronAPI 被正确识别
import type { ImageUploadManagerDeps } from "../app.types.ts";

// 文件信息接口
interface FileInfo {
  path: string;
  name: string;
}

// 上传选项接口
interface UploadOptions {
  source?: string;
  onProgress?: (current: number, total: number) => void;
}

// 图像信息接口
interface ImageInfo {
  id: string;
  isDuplicate?: boolean;
  duplicateType?: "restored_from_trash" | "existing";
  [key: string]: unknown;
}


export class ImageUploadService {
  private app: ImageUploadManagerDeps;

  /**
   * @param app - 应用实例
   */
  constructor(app: ImageUploadManagerDeps) {
    this.app = app;
  }

  /**
   * 上传图像到数据目录
   * @param fileInfo - 文件信息
   * @param options - 选项
   * @returns 上传结果
   */
  async upload(fileInfo: FileInfo, options: UploadOptions = {}): Promise<ImageInfo> {
    const { path: filePath, name: fileName } = fileInfo;
    const { source = "unknown" } = options;

    if (!filePath) {
      throw new Error("File path is required");
    }

    const imageInfo = await window.electronAPI.saveImageFile(filePath, fileName);
    const fullImageInfo = await window.electronAPI.getImageById(imageInfo.id);

    if (!fullImageInfo) {
      throw new Error("Failed to get image info after upload");
    }

    // 注意：必须先展开 fullImageInfo，再设置 duplicateType，否则会被覆盖
    const result: ImageInfo = {
      ...fullImageInfo,
      id: fullImageInfo.id,
      isDuplicate: imageInfo.isDuplicate,
      source,
    };
    // 显式设置 duplicateType，确保不被覆盖
    if (imageInfo.duplicateType) {
      result.duplicateType = imageInfo.duplicateType;
    }
    return result;
  }

  /**
   * 批量上传图像
   * @param fileInfos - 文件信息数组
   * @param options - 选项
   * @returns 上传结果数组
   */
  async uploadBatch(fileInfos: FileInfo[], options: UploadOptions = {}): Promise<ImageInfo[]> {
    const { onProgress } = options;
    const results: ImageInfo[] = [];
    const total = fileInfos.length;

    // 小批量不触发进度回调，减少不必要的 UI 更新
    const shouldReportProgress = onProgress && total > 3;

    for (let i = 0; i < total; i++) {
      const result = await this.upload(fileInfos[i], options);
      results.push(result);

      if (shouldReportProgress) {
        onProgress(i + 1, total);
      }
    }

    return results;
  }

  /**
   * 删除图像
   * @param imageId - 图像 ID
   * @returns 是否删除成功
   */
  async delete(imageId: string): Promise<boolean> {
    return await window.electronAPI.permanentDeleteImage(imageId);
  }
}
