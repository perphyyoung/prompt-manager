/**
 * 回收站域 IPC 路由
 * 提示词与图像的软删除、回收站查询、恢复、永久删除、清空。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import { ipcMain } from "electron";
import * as db from "../../database.js";
import { TrashType } from "../../../shared/domain/trashType.ts";
import { logError } from "../../mainLogger.js";
import { getCurrentDataDir } from "../../runtime.js";

export function registerTrashIpc() {
  // 软删除提示词（移动到回收站）
  ipcMain.handle("soft-delete-prompt", async (event, id) => {
    return await db.deletePrompt(id);
  });

  // 批量软删除提示词
  ipcMain.handle("soft-delete-prompts", async (event, ids) => {
    try {
      return await db.softDeletePrompts(ids);
    } catch (error) {
      logError("Main", "Batch soft delete prompts error:", error);
      throw error;
    }
  });

  // 获取提示词回收站
  ipcMain.handle("get-prompt-trash", async () => {
    try {
      const deletedPrompts = await db.getDeletedPrompts();

      // 为提示词添加 type 字段
      return deletedPrompts.map((prompt) => ({
        ...prompt,
        type: TrashType.PROMPT,
      }));
    } catch (error) {
      logError("Main", "Get prompt trash error:", error);
      throw error;
    }
  });

  // 从提示词回收站恢复
  ipcMain.handle("restore-prompt-from-trash", async (event, id) => {
    try {
      await db.restorePrompt(id);
      return true;
    } catch (error) {
      logError("Main", "Restore from trash error:", error);
      throw error;
    }
  });

  // 永久删除提示词
  ipcMain.handle("permanent-delete-prompt", async (event, id) => {
    try {
      await db.permanentDeletePrompt(id);
      return true;
    } catch (error) {
      logError("Main", "Permanent delete prompt error:", error);
      throw error;
    }
  });

  // 恢复所有提示词
  ipcMain.handle("restore-all-prompts", async () => {
    try {
      await db.restoreAllPrompts();
      return true;
    } catch (error) {
      logError("Main", "Restore all prompts error:", error);
      throw error;
    }
  });

  // 清空提示词回收站
  ipcMain.handle("empty-prompt-trash", async () => {
    try {
      return await db.emptyPromptTrash();
    } catch (error) {
      logError("Main", "Empty prompt trash error:", error);
      throw error;
    }
  });

  // ==================== 图像回收站 ====================

  // 获取图像回收站列表
  ipcMain.handle("get-image-trash", async () => {
    try {
      const deletedImages = await db.getDeletedImages();

      // 为图像添加 type 字段
      return deletedImages.map((image) => ({
        ...image,
        type: TrashType.IMAGE,
      }));
    } catch (error) {
      logError("Main", "Get image trash error:", error);
      throw error;
    }
  });

  // 从回收站恢复图像
  ipcMain.handle("restore-image-from-trash", async (event, id) => {
    try {
      await db.restoreImage(id);
      return true;
    } catch (error) {
      logError("Main", "Restore image from trash error:", error);
      throw error;
    }
  });

  // 永久删除图像
  ipcMain.handle("permanent-delete-image", async (event, id) => {
    try {
      await db.permanentDeleteImage(id, getCurrentDataDir());
      return true;
    } catch (error) {
      logError("Main", "Permanently delete image error:", error);
      throw error;
    }
  });

  // 恢复所有图像
  ipcMain.handle("restore-all-images", async () => {
    try {
      await db.restoreAllImages();
      return true;
    } catch (error) {
      logError("Main", "Restore all images error:", error);
      throw error;
    }
  });

  // 清空图像回收站
  ipcMain.handle("empty-image-trash", async () => {
    try {
      await db.emptyImageTrash(getCurrentDataDir());
      return true;
    } catch (error) {
      logError("Main", "Empty image trash error:", error);
      throw error;
    }
  });

  // 软删除图像（移动到回收站）
  ipcMain.handle("soft-delete-image", async (event, id) => {
    try {
      await db.softDeleteImage(id);
      return true;
    } catch (error) {
      logError("Main", "Soft delete image error:", error);
      throw error;
    }
  });

  // 批量软删除图像
  ipcMain.handle("soft-delete-images", async (event, ids) => {
    try {
      const result = await db.softDeleteImages(ids);
      return result;
    } catch (error) {
      logError("Main", "Batch soft delete images error:", error);
      throw error;
    }
  });
}
