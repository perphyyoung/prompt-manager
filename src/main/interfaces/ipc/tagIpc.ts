/**
 * 标签域 IPC 路由
 * 提示词/图像的标签 CRUD、标签组管理、按标签查询、合并标签缓存。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import { ipcMain } from "electron";
import * as db from "../../database.js";
import { logError } from "../../mainLogger.js";
import { addTagToCache, addTagsToCache, getAllTagsCached } from "../../infrastructure/tagCache.js";

export function registerTagIpc() {
  // 获取所有提示词标签
  ipcMain.handle("get-prompt-tags", async () => {
    try {
      return await db.getPromptTags();
    } catch (error) {
      logError("Main", "Get prompt tags error:", error);
      throw error;
    }
  });

  // 添加提示词标签
  ipcMain.handle("add-prompt-tag", async (event, tag) => {
    try {
      await db.addPromptTag(tag);
      // 更新缓存
      addTagToCache(tag);
      return await db.getPromptTags();
    } catch (error) {
      logError("Main", "Add prompt tag error:", error);
      throw error;
    }
  });

  // 为提示词添加多个标签
  ipcMain.handle("add-prompt-tags", async (event, promptId, tagNames) => {
    try {
      await db.addPromptTags(promptId, tagNames);
      // 批量更新缓存
      addTagsToCache(tagNames);
      return true;
    } catch (error) {
      logError("Main", "Add prompt tags error:", error);
      throw error;
    }
  });

  // 批量为多个提示词添加标签（集合操作）
  ipcMain.handle("add-prompt-tags-batch", async (event, promptIds, tagNames) => {
    try {
      const result = await db.addPromptTagsBatch(promptIds, tagNames);
      addTagsToCache(tagNames);
      return result;
    } catch (error) {
      logError("Main", "Add prompt tags batch error:", error);
      throw error;
    }
  });

  // 删除提示词标签
  ipcMain.handle("delete-prompt-tag", async (event, tag) => {
    try {
      // 从数据库删除标签（会级联删除关联关系）
      await db.deletePromptTag(tag);
      return await db.getPromptTags();
    } catch (error) {
      logError("Main", "Delete prompt tag error:", error);
      throw error;
    }
  });

  // 批量删除提示词标签
  ipcMain.handle("delete-prompt-tags", async (event, tags) => {
    try {
      const result = await db.deletePromptTags(tags);
      const remainingTags = await db.getPromptTags();
      return { ...result, tags: remainingTags };
    } catch (error) {
      logError("Main", "Batch delete prompt tags error:", error);
      throw error;
    }
  });

  // 获取使用指定标签的提示词列表
  ipcMain.handle("get-prompts-by-tag", async (event, tagName) => {
    try {
      return await db.getPromptsByTag(tagName);
    } catch (error) {
      logError("Main", "Get prompts by tag error:", error);
      throw error;
    }
  });

  // 从提示词中移除标签
  ipcMain.handle("remove-tag-from-prompt", async (event, promptId, tagName) => {
    try {
      await db.removeTagFromPrompt(promptId, tagName);
      return true;
    } catch (error) {
      logError("Main", "Remove tag from prompt error:", error);
      throw error;
    }
  });

  // ==================== 提示词标签组 IPC ====================

  // 获取所有提示词标签组（包含标签列表）
  ipcMain.handle("get-prompt-tag-groups", async () => {
    try {
      return await db.getPromptTagGroups();
    } catch (error) {
      logError("Main", "Get prompt tag groups error:", error);
      throw error;
    }
  });

  // 创建提示词标签组
  ipcMain.handle("create-prompt-tag-group", async (event, name, sortOrder) => {
    try {
      return await db.createPromptTagGroup(name, sortOrder);
    } catch (error) {
      logError("Main", "Create prompt tag group error:", error);
      throw error;
    }
  });

  // 更新提示词标签组属性
  ipcMain.handle("update-prompt-tag-group-attrs", async (event, id, updates) => {
    try {
      return await db.updatePromptTagGroup(id, updates);
    } catch (error) {
      logError("Main", "Update prompt tag group attrs error:", error);
      throw error;
    }
  });

  // 删除提示词标签组
  ipcMain.handle("delete-prompt-tag-group", async (event, id) => {
    try {
      return await db.deletePromptTagGroup(id);
    } catch (error) {
      logError("Main", "Delete prompt tag group error:", error);
      throw error;
    }
  });

  // 分配提示词标签到所属组
  ipcMain.handle("assign-prompt-tag-to-belong-group", async (event, tagName, groupId) => {
    try {
      return await db.updatePromptTagGroupByTagName(tagName, groupId);
    } catch (error) {
      logError("Main", "Assign prompt tag to belong group error:", error);
      throw error;
    }
  });

  // 重命名提示词标签
  ipcMain.handle("rename-prompt-tag", async (event, oldTag, newTag) => {
    try {
      return await db.renameTag("prompt", oldTag, newTag);
    } catch (error) {
      logError("Main", "Rename prompt tag error:", error);
      throw error;
    }
  });

  // 获取所有图像标签
  ipcMain.handle("get-image-tags", async () => {
    try {
      return await db.getImageTags();
    } catch (error) {
      logError("Main", "Get image tags error:", error);
      throw error;
    }
  });

  // 添加图像标签
  ipcMain.handle("add-image-tag", async (event, tag) => {
    try {
      await db.addImageTag(tag);
      // 更新缓存
      addTagToCache(tag);
      return await db.getImageTags();
    } catch (error) {
      logError("Main", "Add image tag error:", error);
      throw error;
    }
  });

  // 为图像添加多个标签
  ipcMain.handle("add-image-tags", async (event, imageId, tagNames) => {
    try {
      await db.addImageTags(imageId, tagNames);
      // 批量更新缓存
      addTagsToCache(tagNames);
      return true;
    } catch (error) {
      logError("Main", "Add image tags error:", error);
      throw error;
    }
  });

  // 批量为多张图像添加标签（集合操作）
  ipcMain.handle("add-image-tags-batch", async (event, imageIds, tagNames) => {
    try {
      const result = await db.addImageTagsBatch(imageIds, tagNames);
      addTagsToCache(tagNames);
      return result;
    } catch (error) {
      logError("Main", "Add image tags batch error:", error);
      throw error;
    }
  });

  // 重命名图像标签
  ipcMain.handle("rename-image-tag", async (event, oldTag, newTag) => {
    try {
      return await db.renameTag("image", oldTag, newTag);
    } catch (error) {
      logError("Main", "Rename image tag error:", error);
      throw error;
    }
  });

  // 删除图像标签（集合级级联删除，单事务）
  ipcMain.handle("delete-image-tag", async (event, tag) => {
    try {
      await db.deleteImageTag(tag);
      return true;
    } catch (error) {
      logError("Main", "Delete image tag error:", error);
      throw error;
    }
  });

  // 批量删除图像标签（集合级级联删除，单事务）
  ipcMain.handle("delete-image-tags", async (event, tags) => {
    try {
      return await db.deleteImageTags(tags);
    } catch (error) {
      logError("Main", "Batch delete image tags error:", error);
      throw error;
    }
  });

  // 获取使用指定标签的图像列表
  ipcMain.handle("get-images-by-tag", async (event, tagName) => {
    try {
      return await db.getImagesByTag(tagName);
    } catch (error) {
      logError("Main", "Get images by tag error:", error);
      throw error;
    }
  });

  // 从图像中移除标签
  ipcMain.handle("remove-tag-from-image", async (event, imageId, tagName) => {
    try {
      await db.removeTagFromImage(imageId, tagName);
      return true;
    } catch (error) {
      logError("Main", "Remove tag from image error:", error);
      throw error;
    }
  });

  // ==================== 图像标签组 IPC ====================

  // 获取所有图像标签组（包含标签列表）
  ipcMain.handle("get-image-tag-groups", async () => {
    try {
      return await db.getImageTagGroups();
    } catch (error) {
      logError("Main", "Get image tag groups error:", error);
      throw error;
    }
  });

  // 创建图像标签组
  ipcMain.handle("create-image-tag-group", async (event, name, sortOrder) => {
    try {
      return await db.createImageTagGroup(name, sortOrder);
    } catch (error) {
      logError("Main", "Create image tag group error:", error);
      throw error;
    }
  });

  // 更新图像标签组
  ipcMain.handle("update-image-tag-group-attrs", async (event, id, updates) => {
    try {
      return await db.updateImageTagGroup(id, updates);
    } catch (error) {
      logError("Main", "Update image tag group error:", error);
      throw error;
    }
  });

  // 删除图像标签组
  ipcMain.handle("delete-image-tag-group", async (event, id) => {
    try {
      return await db.deleteImageTagGroup(id);
    } catch (error) {
      logError("Main", "Delete image tag group error:", error);
      throw error;
    }
  });

  // 获取所有标签（提示词和图像标签合并）
  ipcMain.handle("get-all-tags", async () => {
    return await getAllTagsCached();
  });

  // 分配图像标签到所属组
  ipcMain.handle("assign-image-tag-to-belong-group", async (event, tagName, groupId) => {
    try {
      return await db.assignImageTagToBelongGroup(tagName, groupId);
    } catch (error) {
      logError("Main", "Assign image tag to belong group error:", error);
      throw error;
    }
  });
}
