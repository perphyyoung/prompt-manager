/**
 * 图像域 IPC 路由
 * 图像查询、更新、收藏、文件保存/替换、路径解析、缩略图维护。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import path from "path";
import { promises as fs } from "fs";
import { dialog, shell } from "electron";
import * as db from "../../database.js";
import { logWarn } from "../../mainLogger.js";
import { getCurrentDataDir } from "../../runtime.js";
import {
  generateThumbnail,
  regenerateAllThumbnails,
  saveImageFile,
} from "../../infrastructure/imageFiles.js";
import { handleLogged, handleTyped } from "./handleTyped.js";
import { IPC_EVENTS } from "../../../shared/ipc-contract.js";
import type { UpdateImageParams } from "../../../shared/domain/database-types.js";

export function registerImageIpc() {
  registerImageQueryIpc();
  registerImageMutationIpc();
  registerImageFileIpc();
}

/** 查询与统计 */
function registerImageQueryIpc() {
  // 获取所有图像信息
  handleLogged("getImages", "Get images error:", async (event, sortBy, sortOrder) => {
    return await db.getImages(sortBy, sortOrder);
  });
  // 分页获取图像信息
  handleLogged("getImagesPaginated", "Get images paginated error:", async (event, options) => {
    return await db.getImagesPaginated(options);
  });
  // 获取满足筛选条件的全部图像 id（用于"全选"批量操作）
  handleLogged("getImageIdsByFilter", "Get image ids by filter error:", async (event, options) => {
    return await db.getImageIdsByFilter(options);
  });
  // 统计图像标签数量
  handleLogged("countImageTags", "Count image tags error:", async (event, options) => {
    return await db.countImageTags(options);
  });
  // 统计图像特殊标签数量
  handleLogged(
    "countImageSpecialTags",
    "Count image special tags error:",
    async (event, options) => {
      return await db.countImageSpecialTags(options);
    },
  );
  // 根据 ID 批量获取图像信息
  handleLogged("getImagesByIds", "Get images by ids error:", async (event, ids) => {
    return await db.getImagesByIds(ids);
  });
  // 根据 ID 获取图像信息
  handleLogged("getImageById", "Get image by id error:", async (event, imageId) => {
    return await db.getImageById(imageId);
  });
}

/** 写操作与替换 */
function registerImageMutationIpc() {
  // 保存图像文件
  handleTyped("saveImageFile", async (event, sourcePath, fileName) => {
    return await saveImageFile(sourcePath, fileName);
  });
  // 替换图像：选择新图像文件，软删除旧图并迁移关联关系
  handleLogged("replaceImage", "Replace image error:", async (event, oldImageId: string) => {
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

    const saveResult = await saveImageFile(sourcePath, fileName);

    if (
      saveResult.isDuplicate &&
      saveResult.duplicateType === "existing" &&
      saveResult.id === oldImageId
    ) {
      return { success: false, reason: "same_image" };
    }

    await db.replaceImage(oldImageId, saveResult.id);

    const newImage = await db.getImageById(saveResult.id);
    const relatedPromptIds = (newImage?.promptRefs || []).map((ref) => String(ref.promptId));
    return { success: true, image: newImage, relatedPromptIds };
  });
  // 打开图像文件对话框（支持多选）
  handleTyped("openImageFiles", async () => {
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

    const validatedPaths = (result.filePaths || []).filter((filePath) => {
      const isLocalPath = /^[a-zA-Z]:[\\/]/.test(filePath);
      if (!isLocalPath) {
        logWarn("Main", "Path validation failed (not a local path):", filePath);
      }
      return isLocalPath;
    });

    return validatedPaths;
  });
  // 更新图像
  handleLogged("updateImage", "Update image error:", async (event, id, updates) => {
    await db.updateImage(id, updates as unknown as UpdateImageParams);
  });
  // 批量切换图像收藏状态
  handleLogged("batchFavoriteImages", "Batch favorite images error:", async (event, ids) => {
    return await db.batchFavoriteImages(ids);
  });
}

/** 路径与缩略图 */
function registerImageFileIpc() {
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
  // 校验并按需重建缩略图（懒自愈）：缩略图文件缺失且原图存在时按需生成并更新 DB
  handleLogged(
    "ensureImageThumbnails",
    "Ensure image thumbnails error:",
    async (event, ids: string[]) => {
      const fixed: Array<{ id: string; relativePath: string; fullPath: string }> = [];
      const missing: string[] = [];
      const pendingUpdates: Array<{ id: string; thumbnailPath: string }> = [];
      const dataDir = getCurrentDataDir();

      for (const id of ids || []) {
        const image = await db.getImageById(id);
        if (!image) {
          missing.push(id);
          continue;
        }

        const thumbRelative = image.thumbnailPath || "";
        if (thumbRelative) {
          try {
            await fs.access(path.join(dataDir, thumbRelative));
            continue;
          } catch {}
        }

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
    },
  );
  // 全量重建缩略图（设置页手动触发），进度经 sender 推送
  handleLogged("rebuildThumbnails", "Rebuild thumbnails error:", async (event) => {
    return await regenerateAllThumbnails((current, total, fileName) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_EVENTS.rebuildThumbnailsProgress, { current, total, fileName });
      }
    });
  });
}
