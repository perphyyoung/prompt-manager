/**
 * PyTagGroups 操作模块
 * 封装所有标签和标签组的 CRUD 操作
 * 通过 dataAccess 访问数据，处理缓存同步
 * 错误处理：抛出异常，由调用方处理日志
 */

import { cacheManager } from "../utils/CacheManager.ts";
import type {
  TagName,
  TagGroup,
  TagGroupId,
  DataType,
  TagOperationResult,
  TagDeleteResult,
  TagCreateOptions,
} from "./types.ts";
import { TagExistsError, InvalidTagNameError } from "./types.ts";
import { createDataAccess } from "./dataAccess.ts";

// ========== 缓存操作 ==========

function getTagsCacheKey(type: DataType): string {
  return `${type}Tags`;
}

function getTagGroupsCacheKey(type: DataType): string {
  return `${type}TagGroups`;
}

function getFromCache<T>(key: string): T | null {
  const cache = cacheManager.getCache(key);
  if (!cache) {
    return null;
  }
  return cache.get("data")?.data || null;
}

function setCache<T>(key: string, data: T): void {
  const cache = cacheManager.createCache(key, 10);
  cache.set("data", { data, time: Date.now() });
}

function clearCache(key: string): void {
  const cache = cacheManager.getCache(key);
  if (cache) {
    cache.clear();
  }
}

/**
 * 清除指定类型的标签缓存
 * @param type - 数据类型
 */
export function clearTagsCache(type: DataType): void {
  clearCache(getTagsCacheKey(type));
  clearCache(getTagGroupsCacheKey(type));
}

// ========== 标签操作 ==========

/**
 * 获取所有标签
 * @param type - 数据类型
 * @returns 标签列表
 * @throws 数据库操作失败时抛出异常
 */
export async function getTags(type: DataType): Promise<TagName[]> {
  const cacheKey = getTagsCacheKey(type);
  const cached = getFromCache<TagName[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const dataAccess = createDataAccess(type);
  const data = await dataAccess.getTags();

  setCache(cacheKey, data);
  return data;
}

/**
 * 创建标签
 * @param type - 数据类型
 * @param tags - 标签列表
 * @param options - 创建选项
 * @returns 操作结果
 * @throws 验证失败或数据库操作失败时抛出异常
 */
export async function createTags(
  type: DataType,
  tags: TagName[],
  options: TagCreateOptions = {},
): Promise<TagOperationResult> {
  const result: TagOperationResult = {
    success: true,
    created: [],
    skipped: [],
    errors: [],
  };

  const existingTags = await getTags(type);
  const dataAccess = createDataAccess(type);

  for (const tag of tags) {
    const trimmedTag = tag.trim();
    if (!trimmedTag) {
      throw new InvalidTagNameError(tag, "标签名不能为空");
    }

    // 检查已存在
    if (existingTags.includes(trimmedTag)) {
      result.skipped.push(trimmedTag);
      continue;
    }

    // 创建标签
    await dataAccess.addTag(trimmedTag);

    // 分配到组
    if (options.defaultGroupId !== undefined && options.defaultGroupId !== null) {
      await dataAccess.assignTagToGroup(trimmedTag, options.defaultGroupId);
    }

    result.created.push(trimmedTag);
    existingTags.push(trimmedTag);
  }

  // 清除缓存
  if (result.created.length > 0 || result.errors.length > 0) {
    clearCache(getTagsCacheKey(type));
    clearCache(getTagGroupsCacheKey(type));
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * 重命名标签
 * @param type - 数据类型
 * @param oldName - 旧标签名
 * @param newName - 新标签名
 * @throws 新标签已存在或数据库操作失败时抛出异常
 */
export async function renameTag(type: DataType, oldName: TagName, newName: TagName): Promise<void> {
  const trimmedNewName = newName.trim();
  if (!trimmedNewName) {
    throw new InvalidTagNameError(newName, "新标签名不能为空");
  }

  const existingTags = await getTags(type);
  if (existingTags.includes(trimmedNewName)) {
    throw new TagExistsError(trimmedNewName);
  }

  const dataAccess = createDataAccess(type);
  await dataAccess.renameTag(oldName, trimmedNewName);

  clearCache(getTagsCacheKey(type));
  clearCache(getTagGroupsCacheKey(type));
}

/**
 * 删除标签
 * @param type - 数据类型
 * @param tags - 要删除的标签列表
 * @returns 删除结果（批量操作，不抛出异常，返回错误列表）
 */
export async function deleteTags(type: DataType, tags: TagName[]): Promise<TagDeleteResult> {
  const result: TagDeleteResult = {
    deleted: 0,
    errors: [],
  };

  const dataAccess = createDataAccess(type);

  for (const tag of tags) {
    const trimmedTag = tag.trim();
    if (!trimmedTag) continue;

    try {
      // 1. 从所有项目中移除标签
      const itemIds = await dataAccess.getItemsByTag(trimmedTag);
      for (const itemId of itemIds) {
        await dataAccess.removeTagFromItem(itemId, trimmedTag);
      }

      // 2. 清除标签组关联
      await dataAccess.assignTagToGroup(trimmedTag, null);

      // 3. 删除标签
      await dataAccess.deleteTag(trimmedTag);

      result.deleted++;
    } catch (error) {
      result.errors.push({
        tag: trimmedTag,
        error: error instanceof Error ? error.message : "删除失败",
        code: "INVALID",
      });
    }
  }

  if (result.deleted > 0) {
    clearCache(getTagsCacheKey(type));
    clearCache(getTagGroupsCacheKey(type));
  }

  return result;
}

/**
 * 分配标签到组
 * @param type - 数据类型
 * @param tag - 标签名
 * @param groupId - 组ID（null表示移除分组）
 * @throws 数据库操作失败时抛出异常
 */
export async function assignTagToGroup(
  type: DataType,
  tag: TagName,
  groupId: TagGroupId | null,
): Promise<void> {
  const dataAccess = createDataAccess(type);
  await dataAccess.assignTagToGroup(tag, groupId);

  clearCache(getTagGroupsCacheKey(type));
}

/**
 * 获取使用指定标签的所有项目
 * @param type - 数据类型
 * @param tag - 标签名
 * @returns 项目ID列表
 * @throws 数据库操作失败时抛出异常
 */
export async function getItemsByTag(type: DataType, tag: TagName): Promise<string[]> {
  const dataAccess = createDataAccess(type);
  return await dataAccess.getItemsByTag(tag);
}

// ========== 标签组操作 ==========

/**
 * 获取所有标签组
 * @param type - 数据类型
 * @returns 标签组列表
 * @throws 数据库操作失败时抛出异常
 */
export async function getTagGroups(type: DataType): Promise<TagGroup[]> {
  const cacheKey = getTagGroupsCacheKey(type);
  const cached = getFromCache<TagGroup[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const dataAccess = createDataAccess(type);
  const data = await dataAccess.getTagGroups();

  setCache(cacheKey, data);
  return data;
}

/**
 * 创建标签组
 * @param type - 数据类型
 * @param name - 组名称
 * @param sortOrder - 排序顺序
 * @returns 创建的标签组
 * @throws 数据库操作失败时抛出异常
 */
export async function createTagGroup(
  type: DataType,
  name: string,
  sortOrder: number,
): Promise<TagGroup> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("标签组名称不能为空");
  }

  const dataAccess = createDataAccess(type);
  const result = await dataAccess.createTagGroup(trimmedName, sortOrder);

  clearCache(getTagGroupsCacheKey(type));
  return result;
}

/**
 * 更新标签组
 * @param type - 数据类型
 * @param id - 组ID
 * @param attrs - 更新属性
 * @throws 数据库操作失败时抛出异常
 */
export async function updateTagGroup(
  type: DataType,
  id: TagGroupId,
  attrs: Partial<TagGroup>,
): Promise<void> {
  const dataAccess = createDataAccess(type);
  await dataAccess.updateTagGroup(id, attrs);

  clearCache(getTagGroupsCacheKey(type));
}

/**
 * 删除标签组
 * @param type - 数据类型
 * @param id - 组ID
 * @throws 数据库操作失败时抛出异常
 */
export async function deleteTagGroup(type: DataType, id: TagGroupId): Promise<void> {
  const dataAccess = createDataAccess(type);
  await dataAccess.deleteTagGroup(id);

  clearCache(getTagGroupsCacheKey(type));
}
