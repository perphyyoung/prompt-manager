/**
 * Prompts 域 IPC 路由
 * 提示词的查询、新增、更新、收藏、导入导出。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import * as db from "../../database.js";
import type {
  CreatePromptParams,
  UpdatePromptParams,
} from "../../../shared/domain/database-types.js";
import { generatePromptId } from "../../../utils/idGenerator.js";
import { logError } from "../../mainLogger.js";
import { handleTyped } from "./handleTyped.js";

export function registerPromptIpc() {
  // 获取所有 Prompts（含已删除；供 e2e 测试与备份统计使用）
  handleTyped("getPrompts", async (event, sortBy, sortOrder) => {
    return await db.getPrompts(sortBy, sortOrder);
  });

  // 分页获取 Prompts
  handleTyped("getPromptsPaginated", async (event, options) => {
    return await db.getPromptsPaginated(options);
  });

  // 获取满足筛选条件的全部提示词 id（用于"全选"批量操作）
  handleTyped("getPromptIdsByFilter", async (event, options) => {
    try {
      return await db.getPromptIdsByFilter(options);
    } catch (error) {
      logError("Main", "Get prompt ids by filter error:", error);
      throw error;
    }
  });

  // 统计提示词标签数量
  handleTyped("countPromptTags", async (event, options) => {
    return await db.countPromptTags(options);
  });

  // 统计提示词特殊标签数量
  handleTyped("countPromptSpecialTags", async (event, options) => {
    return await db.countPromptSpecialTags(options);
  });

  // 添加 Prompt
  handleTyped("addPrompt", async (event, prompt) => {
    const newPrompt = {
      ...prompt,
      id: generatePromptId(),
    } as unknown as CreatePromptParams;
    // 如果没有提供标题，使用 ID 作为标题
    if (!newPrompt.title) {
      newPrompt.title = newPrompt.id;
    }
    return await db.addPrompt(newPrompt);
  });

  // 更新 Prompt
  handleTyped("updatePrompt", async (event, id, updates) => {
    await db.updatePrompt(id, updates as unknown as UpdatePromptParams);
  });

  // 批量切换提示词收藏状态
  handleTyped("batchFavoritePrompts", async (event, ids) => {
    try {
      return await db.batchFavoritePrompts(ids);
    } catch (error) {
      logError("Main", "Batch favorite prompts error:", error);
      throw error;
    }
  });

  // 批量获取提示词（按 ID 列表，保持传入顺序）
  handleTyped("getPromptsByIds", async (event, ids) => {
    try {
      return await db.getPromptsByIds(ids);
    } catch (error) {
      logError("Main", "Get prompts by ids error:", error);
      throw error;
    }
  });

  // 根据 ID 获取提示词信息
  handleTyped("getPromptById", async (event, promptId) => {
    try {
      return await db.getPromptById(promptId);
    } catch (error) {
      logError("Main", "Get prompt by id error:", error);
      throw error;
    }
  });
}
