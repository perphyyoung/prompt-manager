/**
 * 标签缓存基础设施
 * 主进程侧的全标签缓存，供自动完成功能使用。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import * as db from "../database.js";
import { logError } from "../mainLogger.js";

// 标签缓存（用于自动完成功能）
let allTagsCache: string[] | null = null;

/**
 * 初始化标签缓存
 * 应用启动时从数据库加载所有标签
 */
export async function initTagsCache() {
  try {
    allTagsCache = await db.getAllTags();
  } catch (error) {
    logError("Main", "Failed to initialize tags cache:", error);
    allTagsCache = [];
  }
}

/**
 * 获取标签缓存（未初始化时先加载）
 */
export async function getAllTagsCached(): Promise<string[]> {
  if (!allTagsCache) {
    await initTagsCache();
  }
  return allTagsCache ?? [];
}
