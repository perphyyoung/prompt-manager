/**
 * 标签域 IPC 路由
 * 提示词/图像的标签 CRUD、标签组管理、按标签查询、合并标签缓存。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import * as db from "../../database.js";
import { logError } from "../../mainLogger.js";
import { getAllTagsCached } from "../../infrastructure/tagCache.js";
import { tagMutationService } from "../../application/index.js";
import { handleTyped } from "./handleTyped.js";

export function registerTagIpc() {
  // 获取所有提示词标签
  handleTyped("getPromptTags", async () => {
    try {
      return await db.getPromptTags();
    } catch (error) {
      logError("Main", "Get prompt tags error:", error);
      throw error;
    }
  });

  // 添加提示词标签
  handleTyped("addPromptTag", async (event, tag) => {
    try {
      return await tagMutationService.addPromptTag(tag);
    } catch (error) {
      logError("Main", "Add prompt tag error:", error);
      throw error;
    }
  });

  // 为提示词添加多个标签
  handleTyped("addPromptTags", async (event, promptId, tagNames) => {
    try {
      return await tagMutationService.addPromptTags(promptId, tagNames);
    } catch (error) {
      logError("Main", "Add prompt tags error:", error);
      throw error;
    }
  });

  // 批量为多个提示词添加标签（集合操作）
  handleTyped("addPromptTagsBatch", async (event, promptIds, tagNames) => {
    try {
      return await tagMutationService.addPromptTagsBatch(promptIds, tagNames);
    } catch (error) {
      logError("Main", "Add prompt tags batch error:", error);
      throw error;
    }
  });

  // 删除提示词标签
  handleTyped("deletePromptTag", async (event, tag) => {
    try {
      // 从数据库删除标签（会级联删除关联关系）
      return await tagMutationService.deletePromptTag(tag);
    } catch (error) {
      logError("Main", "Delete prompt tag error:", error);
      throw error;
    }
  });

  // 批量删除提示词标签
  handleTyped("deletePromptTags", async (event, tags) => {
    try {
      return await tagMutationService.deletePromptTags(tags);
    } catch (error) {
      logError("Main", "Batch delete prompt tags error:", error);
      throw error;
    }
  });

  // 获取使用指定标签的提示词列表
  handleTyped("getPromptsByTag", async (event, tagName) => {
    try {
      return await db.getPromptsByTag(tagName);
    } catch (error) {
      logError("Main", "Get prompts by tag error:", error);
      throw error;
    }
  });

  // 从提示词中移除标签
  handleTyped("removeTagFromPrompt", async (event, promptId, tagName) => {
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
  handleTyped("getPromptTagGroups", async () => {
    try {
      return await db.getPromptTagGroups();
    } catch (error) {
      logError("Main", "Get prompt tag groups error:", error);
      throw error;
    }
  });

  // 创建提示词标签组
  handleTyped("createPromptTagGroup", async (event, name, sortOrder) => {
    try {
      return await db.createPromptTagGroup(name, sortOrder);
    } catch (error) {
      logError("Main", "Create prompt tag group error:", error);
      throw error;
    }
  });

  // 更新提示词标签组属性
  handleTyped("updatePromptTagGroupAttrs", async (event, id, updates) => {
    try {
      await db.updatePromptTagGroup(id, updates);
    } catch (error) {
      logError("Main", "Update prompt tag group attrs error:", error);
      throw error;
    }
  });

  // 删除提示词标签组
  handleTyped("deletePromptTagGroup", async (event, id) => {
    try {
      return await db.deletePromptTagGroup(id);
    } catch (error) {
      logError("Main", "Delete prompt tag group error:", error);
      throw error;
    }
  });

  // 分配提示词标签到所属组
  handleTyped("assignPromptTagToBelongGroup", async (event, tagName, groupId) => {
    try {
      return await db.updatePromptTagGroupByTagName(tagName, groupId);
    } catch (error) {
      logError("Main", "Assign prompt tag to belong group error:", error);
      throw error;
    }
  });

  // 重命名提示词标签
  handleTyped("renamePromptTag", async (event, oldTag, newTag) => {
    try {
      return await tagMutationService.renamePromptTag(oldTag, newTag);
    } catch (error) {
      logError("Main", "Rename prompt tag error:", error);
      throw error;
    }
  });

  // 获取所有图像标签
  handleTyped("getImageTags", async () => {
    try {
      return await db.getImageTags();
    } catch (error) {
      logError("Main", "Get image tags error:", error);
      throw error;
    }
  });

  // 添加图像标签
  handleTyped("addImageTag", async (event, tag) => {
    try {
      return await tagMutationService.addImageTag(tag);
    } catch (error) {
      logError("Main", "Add image tag error:", error);
      throw error;
    }
  });

  // 为图像添加多个标签
  handleTyped("addImageTags", async (event, imageId, tagNames) => {
    try {
      return await tagMutationService.addImageTags(imageId, tagNames);
    } catch (error) {
      logError("Main", "Add image tags error:", error);
      throw error;
    }
  });

  // 批量为多张图像添加标签（集合操作）
  handleTyped("addImageTagsBatch", async (event, imageIds, tagNames) => {
    try {
      return await tagMutationService.addImageTagsBatch(imageIds, tagNames);
    } catch (error) {
      logError("Main", "Add image tags batch error:", error);
      throw error;
    }
  });

  // 重命名图像标签
  handleTyped("renameImageTag", async (event, oldTag, newTag) => {
    try {
      return await tagMutationService.renameImageTag(oldTag, newTag);
    } catch (error) {
      logError("Main", "Rename image tag error:", error);
      throw error;
    }
  });

  // 删除图像标签（集合级级联删除，单事务）
  handleTyped("deleteImageTag", async (event, tag) => {
    try {
      return await tagMutationService.deleteImageTag(tag);
    } catch (error) {
      logError("Main", "Delete image tag error:", error);
      throw error;
    }
  });

  // 批量删除图像标签（集合级级联删除，单事务）
  handleTyped("deleteImageTags", async (event, tags) => {
    try {
      return await tagMutationService.deleteImageTags(tags);
    } catch (error) {
      logError("Main", "Batch delete image tags error:", error);
      throw error;
    }
  });

  // 获取使用指定标签的图像列表
  handleTyped("getImagesByTag", async (event, tagName) => {
    try {
      return await db.getImagesByTag(tagName);
    } catch (error) {
      logError("Main", "Get images by tag error:", error);
      throw error;
    }
  });

  // 从图像中移除标签
  handleTyped("removeTagFromImage", async (event, imageId, tagName) => {
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
  handleTyped("getImageTagGroups", async () => {
    try {
      return await db.getImageTagGroups();
    } catch (error) {
      logError("Main", "Get image tag groups error:", error);
      throw error;
    }
  });

  // 创建图像标签组
  handleTyped("createImageTagGroup", async (event, name, sortOrder) => {
    try {
      return await db.createImageTagGroup(name, sortOrder);
    } catch (error) {
      logError("Main", "Create image tag group error:", error);
      throw error;
    }
  });

  // 更新图像标签组
  handleTyped("updateImageTagGroupAttrs", async (event, id, updates) => {
    try {
      await db.updateImageTagGroup(id, updates);
    } catch (error) {
      logError("Main", "Update image tag group error:", error);
      throw error;
    }
  });

  // 删除图像标签组
  handleTyped("deleteImageTagGroup", async (event, id) => {
    try {
      return await db.deleteImageTagGroup(id);
    } catch (error) {
      logError("Main", "Delete image tag group error:", error);
      throw error;
    }
  });

  // 获取所有标签（提示词和图像标签合并）
  handleTyped("getAllTags", async () => {
    return await getAllTagsCached();
  });

  // 分配图像标签到所属组
  handleTyped("assignImageTagToBelongGroup", async (event, tagName, groupId) => {
    try {
      return await db.assignImageTagToBelongGroup(tagName, groupId);
    } catch (error) {
      logError("Main", "Assign image tag to belong group error:", error);
      throw error;
    }
  });
}
