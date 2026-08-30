/**
 * 标签域 IPC 路由
 * 提示词/图像的标签 CRUD、标签组管理、按标签查询、合并标签缓存。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import * as db from "../../database.js";
import { getAllTagsCached } from "../../infrastructure/tagCache.js";
import { tagMutationService } from "../../application/index.js";
import { handleLogged, handleTyped } from "./handleTyped.js";

export function registerTagIpc() {
  // 获取所有提示词标签
  handleLogged("getPromptTags", "Get prompt tags error:", async () => {
    return await db.getPromptTags();
  });

  // 添加提示词标签
  handleLogged("addPromptTag", "Add prompt tag error:", async (event, tag) => {
    return await tagMutationService.addPromptTag(tag);
  });

  // 为提示词添加多个标签
  handleLogged("addPromptTags", "Add prompt tags error:", async (event, promptId, tagNames) => {
    return await tagMutationService.addPromptTags(promptId, tagNames);
  });

  // 批量为多个提示词添加标签（集合操作）
  handleLogged(
    "addPromptTagsBatch",
    "Add prompt tags batch error:",
    async (event, promptIds, tagNames) => {
      return await tagMutationService.addPromptTagsBatch(promptIds, tagNames);
    },
  );

  // 删除提示词标签
  handleLogged("deletePromptTag", "Delete prompt tag error:", async (event, tag) => {
    // 从数据库删除标签（会级联删除关联关系）
    return await tagMutationService.deletePromptTag(tag);
  });

  // 批量删除提示词标签
  handleLogged("deletePromptTags", "Batch delete prompt tags error:", async (event, tags) => {
    return await tagMutationService.deletePromptTags(tags);
  });

  // 获取使用指定标签的提示词列表
  handleLogged("getPromptsByTag", "Get prompts by tag error:", async (event, tagName) => {
    return await db.getPromptsByTag(tagName);
  });

  // 从提示词中移除标签
  handleLogged(
    "removeTagFromPrompt",
    "Remove tag from prompt error:",
    async (event, promptId, tagName) => {
      await db.removeTagFromPrompt(promptId, tagName);
      return true;
    },
  );

  // ==================== 提示词标签组 IPC ====================

  // 获取所有提示词标签组（包含标签列表）
  handleLogged("getPromptTagGroups", "Get prompt tag groups error:", async () => {
    return await db.getPromptTagGroups();
  });

  // 创建提示词标签组
  handleLogged(
    "createPromptTagGroup",
    "Create prompt tag group error:",
    async (event, name, sortOrder) => {
      return await db.createPromptTagGroup(name, sortOrder);
    },
  );

  // 更新提示词标签组属性
  handleLogged(
    "updatePromptTagGroupAttrs",
    "Update prompt tag group attrs error:",
    async (event, id, updates) => {
      await db.updatePromptTagGroup(id, updates);
    },
  );

  // 删除提示词标签组
  handleLogged("deletePromptTagGroup", "Delete prompt tag group error:", async (event, id) => {
    return await db.deletePromptTagGroup(id);
  });

  // 分配提示词标签到所属组
  handleLogged(
    "assignPromptTagToBelongGroup",
    "Assign prompt tag to belong group error:",
    async (event, tagName, groupId) => {
      return await db.updatePromptTagGroupByTagName(tagName, groupId);
    },
  );

  // 重命名提示词标签
  handleLogged("renamePromptTag", "Rename prompt tag error:", async (event, oldTag, newTag) => {
    return await tagMutationService.renamePromptTag(oldTag, newTag);
  });

  // 获取所有图像标签
  handleLogged("getImageTags", "Get image tags error:", async () => {
    return await db.getImageTags();
  });

  // 添加图像标签
  handleLogged("addImageTag", "Add image tag error:", async (event, tag) => {
    return await tagMutationService.addImageTag(tag);
  });

  // 为图像添加多个标签
  handleLogged("addImageTags", "Add image tags error:", async (event, imageId, tagNames) => {
    return await tagMutationService.addImageTags(imageId, tagNames);
  });

  // 批量为多张图像添加标签（集合操作）
  handleLogged(
    "addImageTagsBatch",
    "Add image tags batch error:",
    async (event, imageIds, tagNames) => {
      return await tagMutationService.addImageTagsBatch(imageIds, tagNames);
    },
  );

  // 重命名图像标签
  handleLogged("renameImageTag", "Rename image tag error:", async (event, oldTag, newTag) => {
    return await tagMutationService.renameImageTag(oldTag, newTag);
  });

  // 删除图像标签（集合级级联删除，单事务）
  handleLogged("deleteImageTag", "Delete image tag error:", async (event, tag) => {
    return await tagMutationService.deleteImageTag(tag);
  });

  // 批量删除图像标签（集合级级联删除，单事务）
  handleLogged("deleteImageTags", "Batch delete image tags error:", async (event, tags) => {
    return await tagMutationService.deleteImageTags(tags);
  });

  // 获取使用指定标签的图像列表
  handleLogged("getImagesByTag", "Get images by tag error:", async (event, tagName) => {
    return await db.getImagesByTag(tagName);
  });

  // 从图像中移除标签
  handleLogged(
    "removeTagFromImage",
    "Remove tag from image error:",
    async (event, imageId, tagName) => {
      await db.removeTagFromImage(imageId, tagName);
      return true;
    },
  );

  // ==================== 图像标签组 IPC ====================

  // 获取所有图像标签组（包含标签列表）
  handleLogged("getImageTagGroups", "Get image tag groups error:", async () => {
    return await db.getImageTagGroups();
  });

  // 创建图像标签组
  handleLogged(
    "createImageTagGroup",
    "Create image tag group error:",
    async (event, name, sortOrder) => {
      return await db.createImageTagGroup(name, sortOrder);
    },
  );

  // 更新图像标签组
  handleLogged(
    "updateImageTagGroupAttrs",
    "Update image tag group error:",
    async (event, id, updates) => {
      await db.updateImageTagGroup(id, updates);
    },
  );

  // 删除图像标签组
  handleLogged("deleteImageTagGroup", "Delete image tag group error:", async (event, id) => {
    return await db.deleteImageTagGroup(id);
  });

  // 获取所有标签（提示词和图像标签合并）
  handleTyped("getAllTags", async () => {
    return await getAllTagsCached();
  });

  // 分配图像标签到所属组
  handleLogged(
    "assignImageTagToBelongGroup",
    "Assign image tag to belong group error:",
    async (event, tagName, groupId) => {
      return await db.assignImageTagToBelongGroup(tagName, groupId);
    },
  );
}
