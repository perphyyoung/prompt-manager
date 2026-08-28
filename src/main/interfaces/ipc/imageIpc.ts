/**
 * 图像域 IPC 路由
 * 图像查询、更新、收藏、文件保存/替换、路径解析、缩略图维护。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import path from "path";
import { promises as fs } from "fs";
import { dialog, shell } from "electron";
import * as db from "../../database.js";
import { logError, logWarn } from "../../mainLogger.js";
import { getCurrentDataDir } from "../../runtime.js";
import {
  generateThumbnail,
  regenerateAllThumbnails,
  saveImageFile,
} from "../../infrastructure/imageFiles.js";
import { handleTyped } from "./handleTyped.js";
import { IPC_EVENTS } from "../../../shared/ipc-contract.js";
import type { UpdateImageParams } from "../../../shared/domain/database-types.js";

export function registerImageIpc() {
  // 保存图像文件
  handleTyped("saveImageFile", async (event, sourcePath, fileName) => {
    return await saveImageFile(sourcePath, fileName);
  });

  // 替换图像：选择新图像文件，软删除旧图并迁移关联关系
  handleTyped("replaceImage", async (event, oldImageId: string) => {
    try {
      // 测试 mock 优先
      const mockPath = (global as any).__testMockedReplaceImageFilePath as string | undefined;
      let sourcePath: string;
      if (mockPath) {
        delete (global as any).__testMockedReplaceImageFilePath;
        sourcePath = mockPath;
      } else {
        const result = await dialog.showOpenDialog({
          title: "选择替换图像",
          filters: [
            { name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp"] },
            { name: "All Files", extensions: ["*"] },
          ],
          properties: ["openFile"],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, canceled: true };
        }
        sourcePath = result.filePaths[0];
      }

      const fileName = path.basename(sourcePath);

      // 保存新图像
      const saveResult = await saveImageFile(sourcePath, fileName);

      // 如果选择的是完全相同的文件（MD5 一致且未删除），无需替换
      if (
        saveResult.isDuplicate &&
        saveResult.duplicateType === "existing" &&
        saveResult.id === oldImageId
      ) {
        return { success: false, reason: "same_image" };
      }

      // 迁移关联关系：旧图入回收站，关联迁移到新图
      await db.replaceImage(oldImageId, saveResult.id);

      // 返回新图像完整信息及关联提示词ID列表（用于前端刷新缓存）
      const newImage = await db.getImageById(saveResult.id);
      const relatedPromptIds = (newImage?.promptRefs || []).map((ref) => String(ref.promptId));
      return { success: true, image: newImage, relatedPromptIds };
    } catch (error) {
      logError("Main", "Replace image error:", error);
      throw error;
    }
  });

  // 打开图像文件对话框（支持多选）
  handleTyped("openImageFiles", async () => {
    // 测试 mock 优先（支持单路径或多路径）
    const mockPath = (global as any).__testMockedImageFilePath as string | undefined;
    const mockPaths = (global as any).__testMockedImageFilePaths as string[] | undefined;

    if (mockPaths && mockPaths.length > 0) {
      delete (global as any).__testMockedImageFilePaths; // 一次性使用
      return mockPaths;
    }

    if (mockPath) {
      delete (global as any).__testMockedImageFilePath; // 一次性使用
      return [mockPath];
    }

    const result = await dialog.showOpenDialog({
      title: "选择图像",
      filters: [
        { name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile", "multiSelections"],
    });

    if (result.canceled) {
      return [];
    }

    // 路径安全验证：只允许本地文件路径（以盘符开头）
    const validatedPaths = (result.filePaths || []).filter((filePath) => {
      // Windows: 检查是否为本地盘符路径（如 D:\, C:\）
      const isLocalPath = /^[a-zA-Z]:[\\/]/.test(filePath);
      if (!isLocalPath) {
        logWarn("Main", "Path validation failed (not a local path):", filePath);
      }
      return isLocalPath;
    });

    return validatedPaths;
  });

  // 获取所有图像信息
  handleTyped("getImages", async (event, sortBy, sortOrder) => {
    try {
      return await db.getImages(sortBy, sortOrder);
    } catch (error) {
      logError("Main", "Get images error:", error);
      throw error;
    }
  });

  // 校验并按需重建缩略图（懒自愈）：缩略图文件缺失且原图存在时按需生成并更新 DB
  handleTyped("ensureImageThumbnails", async (event, ids: string[]) => {
    try {
      const fixed: Array<{ id: string; relativePath: string; fullPath: string }> = [];
      const missing: string[] = [];
      // 收集修复项，循环结束后单次批量写库（原先每张图单独一个事务）
      const pendingUpdates: Array<{ id: string; thumbnailPath: string }> = [];
      const dataDir = getCurrentDataDir();

      for (const id of ids || []) {
        const image = await db.getImageById(id);
        if (!image) {
          missing.push(id);
          continue;
        }

        // 缩略图存在则跳过（generateThumbnail 本身幂等，这里省去无谓的生成调用）
        const thumbRelative = image.thumbnailPath || "";
        if (thumbRelative) {
          try {
            await fs.access(path.join(dataDir, thumbRelative));
            continue;
          } catch {
            // 缩略图缺失，继续重建流程
          }
        }

        // 原图也缺失则标记为不可恢复
        const sourceAbs = path.join(dataDir, image.relativePath);
        try {
          await fs.access(sourceAbs);
        } catch {
          missing.push(id);
          continue;
        }

        const parts = image.relativePath.split("/");
        const subDir = parts.length >= 2 ? parts[1] : "";
        const info = await generateThumbnail(sourceAbs, image.storedName, subDir);
        if (!info) {
          missing.push(id);
          continue;
        }
        pendingUpdates.push({ id, thumbnailPath: info.relativePath });
        fixed.push({ id, relativePath: info.relativePath, fullPath: info.thumbnailPath });
      }

      if (pendingUpdates.length > 0) {
        await db.updateImagesBatch(pendingUpdates);
      }

      return { fixed, missing };
    } catch (error) {
      logError("Main", "Ensure image thumbnails error:", error);
      throw error;
    }
  });

  // 全量重建缩略图（设置页手动触发），进度经 sender 推送
  handleTyped("rebuildThumbnails", async (event) => {
    try {
      return await regenerateAllThumbnails((current, total, fileName) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC_EVENTS.rebuildThumbnailsProgress, { current, total, fileName });
        }
      });
    } catch (error) {
      logError("Main", "Rebuild thumbnails error:", error);
      throw error;
    }
  });

  // 分页获取图像信息
  handleTyped("getImagesPaginated", async (event, options) => {
    try {
      return await db.getImagesPaginated(options);
    } catch (error) {
      logError("Main", "Get images paginated error:", error);
      throw error;
    }
  });

  // 获取满足筛选条件的全部图像 id（用于"全选"批量操作）
  handleTyped("getImageIdsByFilter", async (event, options) => {
    try {
      return await db.getImageIdsByFilter(options);
    } catch (error) {
      logError("Main", "Get image ids by filter error:", error);
      throw error;
    }
  });

  // 统计图像标签数量
  handleTyped("countImageTags", async (event, options) => {
    try {
      return await db.countImageTags(options);
    } catch (error) {
      logError("Main", "Count image tags error:", error);
      throw error;
    }
  });

  // 统计图像特殊标签数量
  handleTyped("countImageSpecialTags", async (event, options) => {
    try {
      return await db.countImageSpecialTags(options);
    } catch (error) {
      logError("Main", "Count image special tags error:", error);
      throw error;
    }
  });

  // 根据 ID 批量获取图像信息
  handleTyped("getImagesByIds", async (event, ids) => {
    try {
      return await db.getImagesByIds(ids);
    } catch (error) {
      logError("Main", "Get images by ids error:", error);
      throw error;
    }
  });

  // 根据 ID 获取图像信息
  handleTyped("getImageById", async (event, imageId) => {
    try {
      return await db.getImageById(imageId);
    } catch (error) {
      logError("Main", "Get image by id error:", error);
      throw error;
    }
  });

  // 更新图像
  handleTyped("updateImage", async (event, id, updates) => {
    try {
      await db.updateImage(id, updates as unknown as UpdateImageParams);
    } catch (error) {
      logError("Main", "Update image error:", error);
      throw error;
    }
  });

  // 批量切换图像收藏状态
  handleTyped("batchFavoriteImages", async (event, ids) => {
    try {
      return await db.batchFavoriteImages(ids);
    } catch (error) {
      logError("Main", "Batch favorite images error:", error);
      throw error;
    }
  });

  // 获取图像完整路径
  handleTyped("getImagePath", async (event, relativePath) => {
    if (!relativePath || typeof relativePath !== "string") {
      throw new Error("Invalid relativePath: " + relativePath);
    }
    return path.join(getCurrentDataDir(), relativePath);
  });

  // 批量获取图像完整路径
  handleTyped("getImagesPaths", async (event, relativePaths: string[]) => {
    const dataDir = getCurrentDataDir();
    return relativePaths.map((p) => (p ? path.join(dataDir, p) : ""));
  });

  // 打开图像本地保存位置
  handleTyped("openImageLocation", async (event, relativePath: string) => {
    if (!relativePath || typeof relativePath !== "string") {
      throw new Error("Invalid relativePath: " + relativePath);
    }
    const fullPath = path.join(getCurrentDataDir(), relativePath);
    shell.showItemInFolder(fullPath);
  });
}
