/**
 * 图像文件基础设施
 * 图像存储目录、MD5 计算、缩略图生成、图像文件入库等文件系统操作。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import path from "path";
import { promises as fs } from "fs";
import sharp from "sharp";
import crypto from "crypto";
import * as db from "../database.js";
import { generateImageId } from "../../utils/idGenerator.js";
import { getFormattedYearMonth } from "../../utils/index.js";
import { logInfo, logError, logWarn } from "../mainLogger.js";
import { getCurrentDataDir } from "../runtime.js";

/**
 * 获取图像存储目录路径
 * @returns {string} images 目录路径
 */
export function getImagesDir() {
  return path.join(getCurrentDataDir(), "images");
}

/**
 * 获取缩略图存储目录路径
 * @returns {string} thumbnails 目录路径
 */
export function getThumbnailsDir() {
  return path.join(getCurrentDataDir(), "thumbnails");
}

/**
 * 确保图像目录存在
 * @param {string} subDir - 子目录（如年月：202603）
 * @returns {string} 图像目录路径
 */
export async function ensureImagesDir(subDir = "") {
  const imagesDir = subDir ? path.join(getImagesDir(), subDir) : getImagesDir();
  try {
    await fs.access(imagesDir);
  } catch {
    await fs.mkdir(imagesDir, { recursive: true });
  }
  return imagesDir;
}

/**
 * 确保缩略图目录存在
 * @param {string} subDir - 子目录（如年月：202603）
 * @returns {string} 缩略图目录路径
 */
export async function ensureThumbnailsDir(subDir = "") {
  const thumbnailsDir = subDir ? path.join(getThumbnailsDir(), subDir) : getThumbnailsDir();
  try {
    await fs.access(thumbnailsDir);
  } catch {
    await fs.mkdir(thumbnailsDir, { recursive: true });
  }
  return thumbnailsDir;
}

/**
 * 计算文件的 MD5 哈希值
 * @param {string} filePath - 文件路径
 * @returns {string} MD5 哈希值
 */
export async function calculateFileMD5(filePath: string): Promise<string | null> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash("md5").update(fileBuffer).digest("hex");
  } catch (error) {
    logError("Main", "Failed to calculate MD5:", error);
    return null;
  }
}

/**
 * 生成图像缩略图
 * @param {string} imagePath - 原图像路径
 * @param {string} storedName - 存储的文件名
 * @param {string} subDir - 子目录（如年月：202603）
 * @returns {Object|null} 缩略图信息对象
 */
export async function generateThumbnail(
  imagePath: string,
  storedName: string,
  subDir = "",
): Promise<{ thumbnailName: string; thumbnailPath: string; relativePath: string } | null> {
  try {
    const thumbnailsDir = await ensureThumbnailsDir(subDir);
    const ext = path.extname(storedName) || ".png";
    const thumbnailName = `thumb_${path.basename(storedName, ext)}.jpg`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailName);

    // 检查缩略图是否已存在
    try {
      await fs.access(thumbnailPath);
      return {
        thumbnailName,
        thumbnailPath,
        relativePath: subDir
          ? "thumbnails/" + subDir + "/" + thumbnailName
          : "thumbnails/" + thumbnailName,
      };
    } catch {
      // 缩略图不存在，需要生成
    }

    // 使用 sharp 生成缩略图
    await sharp(imagePath)
      .resize(200, 200, { fit: "cover", position: "center" })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    return {
      thumbnailName,
      thumbnailPath,
      relativePath: subDir
        ? "thumbnails/" + subDir + "/" + thumbnailName
        : "thumbnails/" + thumbnailName,
    };
  } catch (error) {
    logError("Main", "Failed to generate thumbnail:", error);
    return null;
  }
}

/**
 * 重新生成所有图像的缩略图
 * 用于导入备份后恢复缩略图
 * @param {Function} onProgress - 进度回调函数 (current, total, fileName) => void
 * @param {number} concurrency - 并发数，默认 5
 */
export async function regenerateAllThumbnails(
  onProgress: ((current: number, total: number, fileName: string) => void) | null = null,
  concurrency = 5,
) {
  try {
    // 获取所有图像
    const images = await db.getAllImages();
    const total = images.length;

    if (total === 0) {
      logInfo("Main", "No images to regenerate thumbnails");
      return { success: true, regenerated: 0, total: 0 };
    }

    logInfo(
      "Main",
      `Starting to regenerate thumbnails for ${total} images with concurrency ${concurrency}`,
    );

    let completed = 0;
    let regenerated = 0;
    let failed = 0;
    const updates: Array<{ id: string; thumbnailPath: string }> = [];

    // 处理单个图像的缩略图生成
    async function processImage(image: {
      id: string;
      relativePath: string;
      storedName: string;
      fileName: string;
    }): Promise<{
      success: boolean;
      image: { id: string; relativePath: string; storedName: string; fileName: string };
    }> {
      try {
        // 构建原图路径
        const imagePath = path.join(getCurrentDataDir(), image.relativePath);

        // 检查原图是否存在
        try {
          await fs.access(imagePath);
        } catch {
          logWarn("Main", `Image file not found: ${imagePath}`);
          return { success: false, image };
        }

        // 从 relativePath 提取年月子目录
        const pathParts = image.relativePath.split("/");
        const subDir = pathParts.length >= 2 ? pathParts[1] : "";

        // 重新生成缩略图
        const thumbnailInfo = await generateThumbnail(imagePath, image.storedName, subDir);

        if (thumbnailInfo) {
          // 收集更新数据，稍后批量更新
          updates.push({
            id: image.id,
            thumbnailPath: thumbnailInfo.relativePath,
          });
          return { success: true, image };
        } else {
          return { success: false, image };
        }
      } catch (error) {
        logError("Main", `Failed to regenerate thumbnail for image ${image.id}:`, error);
        return { success: false, image };
      }
    }

    // 分批处理，控制并发数
    for (let i = 0; i < images.length; i += concurrency) {
      const batch = images.slice(i, i + concurrency);
      const results = await Promise.all(batch.map((img) => processImage(img)));

      // 统计结果
      for (const result of results) {
        completed++;
        if (result.success) {
          regenerated++;
        } else {
          failed++;
        }

        // 报告进度
        if (onProgress) {
          onProgress(completed, total, result.image.fileName);
        }
      }
    }

    // 批量更新数据库
    if (updates.length > 0) {
      logInfo("Main", `Batch updating ${updates.length} thumbnail records`);
      await db.updateImagesBatch(updates);
    }

    logInfo("Main", `Thumbnail regeneration complete: ${regenerated} succeeded, ${failed} failed`);
    return { success: true, regenerated, failed, total };
  } catch (error) {
    logError("Main", "Failed to regenerate all thumbnails:", error);
    throw error;
  }
}

/**
 * 保存图像文件到数据目录
 * 通过 MD5 检测避免重复存储相同图像
 * 图像信息单独存储到 images.json
 * @param {string} sourcePath - 源文件路径
 * @param {string} fileName - 原始文件名
 * @returns {Object} 保存后的图像信息
 */
export async function saveImageFile(
  sourcePath: string,
  fileName: string,
): Promise<{
  id: string;
  fileName: string;
  isDuplicate: boolean;
  duplicateType?: "restored_from_trash" | "existing";
}> {
  // 计算源文件 MD5
  const sourceMD5 = await calculateFileMD5(sourcePath);
  if (!sourceMD5) {
    throw new Error("Failed to calculate MD5");
  }

  // 检查是否已存在相同 MD5 的图像（包括回收站中的）
  const existingImage = await db.getImageByMD5IncludeTrash(sourceMD5);
  if (existingImage) {
    // 如果图像在回收站中，自动恢复
    if (existingImage.isDeleted) {
      await db.restoreImage(existingImage.id);
      logInfo("Main", `Image was in trash, auto-restored: ${fileName}`);
      const result: {
        id: string;
        fileName: string;
        isDuplicate: boolean;
        duplicateType: "restored_from_trash";
      } = {
        id: existingImage.id,
        fileName: fileName,
        isDuplicate: true,
        duplicateType: "restored_from_trash",
      };
      return result;
    }

    logWarn("Found duplicate image by MD5, reusing:", fileName);
    const result: {
      id: string;
      fileName: string;
      isDuplicate: boolean;
      duplicateType: "existing";
    } = {
      id: existingImage.id,
      fileName: fileName,
      isDuplicate: true,
      duplicateType: "existing",
    };
    return result;
  }

  // 生成图像 ID
  const imageId = generateImageId();
  // 生成年月子目录（格式：202603）
  const yearMonth = getFormattedYearMonth();
  const imagesDir = await ensureImagesDir(yearMonth);

  const ext = path.extname(fileName) || ".png";
  const uniqueName = imageId + ext;
  const targetPath = path.join(imagesDir, uniqueName);

  await fs.copyFile(sourcePath, targetPath);

  // 获取图像尺寸和文件大小
  let width = null;
  let height = null;
  let fileSize = 0;
  try {
    const metadata = await sharp(targetPath).metadata();
    width = metadata.width;
    height = metadata.height;
    const stats = await fs.stat(targetPath);
    fileSize = stats.size;
  } catch (error) {
    logError("Main", "Failed to get image info:", error);
  }

  // 生成缩略图（传入年月子目录）
  const thumbnailInfo = await generateThumbnail(targetPath, uniqueName, yearMonth);

  // 构建图像信息对象
  const imageInfo = {
    id: imageId,
    fileName: fileName,
    storedName: uniqueName,
    relativePath: "images/" + yearMonth + "/" + uniqueName,
    thumbnailPath: thumbnailInfo ? thumbnailInfo.relativePath : null,
    md5: sourceMD5,
    width: width,
    height: height,
    fileSize: fileSize,
  };

  // 保存到数据库
  await db.addImage(imageInfo);

  // 返回简化版信息（只包含 ID 和文件名）
  return {
    id: imageId,
    fileName: fileName,
    isDuplicate: false,
  };
}
