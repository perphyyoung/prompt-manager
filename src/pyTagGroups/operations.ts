/**
 * PyTagGroups 操作模块
 * 封装所有标签和标签组的 CRUD 操作（纯数据操作，缓存由 TagService 管理）
 * 直接调用 IPC（window.electronAPI）
 * 错误处理：抛出异常，由调用方处理日志
 */

import type {
  TagName,
  TagGroup,
  TagGroupId,
  DataType,
  TagDeleteResult,
  TagCreateOptions,
} from "./types.ts";
import { TagExistsError, InvalidTagNameError } from "./types.ts";

// ========== 标签操作 ==========

/**
 * 获取所有标签
 * @param type - 数据类型
 * @returns 标签列表
 * @throws 数据库操作失败时抛出异常
 */
export async function getTags(type: DataType): Promise<TagName[]> {
  return type === "prompt" ? window.electronAPI.getPromptTags() : window.electronAPI.getImageTags();
}

/**
 * 创建标签（纯数据操作，业务校验由 TagService 负责）
 * @param type - 数据类型
 * @param tag - 标签名（调用方保证已 trim 且非空）
 * @param options - 创建选项
 * @throws 数据库操作失败时抛出异常
 */
export async function createTag(
  type: DataType,
  tag: TagName,
  options: TagCreateOptions = {},
): Promise<void> {
  if (type === "prompt") {
    await window.electronAPI.addPromptTag(tag);
  } else {
    await window.electronAPI.addImageTag(tag);
  }

  // 分配到组
  if (options.defaultGroupId !== undefined && options.defaultGroupId !== null) {
    await assignTagToGroup(type, tag, options.defaultGroupId);
  }
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

  if (type === "prompt") {
    await window.electronAPI.renamePromptTag(oldName, trimmedNewName);
  } else {
    await window.electronAPI.renameImageTag(oldName, trimmedNewName);
  }
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

  const removeTagFromItem = (itemId: string, tag: TagName) =>
    type === "prompt"
      ? window.electronAPI.removeTagFromPrompt(itemId, tag)
      : window.electronAPI.removeTagFromImage(itemId, tag);

  for (const tag of tags) {
    const trimmedTag = tag.trim();
    if (!trimmedTag) continue;

    try {
      // 1. 从所有项目中移除标签
      const itemIds =
        type === "prompt"
          ? await window.electronAPI.getPromptsByTag(trimmedTag)
          : await window.electronAPI.getImagesByTag(trimmedTag);
      for (const itemId of itemIds) {
        await removeTagFromItem(itemId, trimmedTag);
      }

      // 2. 清除标签组关联
      await assignTagToGroup(type, trimmedTag, null);

      // 3. 删除标签
      if (type === "prompt") {
        await window.electronAPI.deletePromptTag(trimmedTag);
      } else {
        await window.electronAPI.deleteImageTag(trimmedTag);
      }

      result.deleted++;
    } catch (error) {
      result.errors.push({
        tag: trimmedTag,
        error: error instanceof Error ? error.message : "删除失败",
        code: "INVALID",
      });
    }
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
  if (type === "prompt") {
    await window.electronAPI.assignPromptTagToBelongGroup(tag, groupId);
  } else {
    await window.electronAPI.assignImageTagToBelongGroup(tag, groupId);
  }
}

// ========== 标签组操作 ==========

/**
 * 获取所有标签组
 * @param type - 数据类型
 * @returns 标签组列表
 * @throws 数据库操作失败时抛出异常
 */
export async function getTagGroups(type: DataType): Promise<TagGroup[]> {
  return type === "prompt"
    ? window.electronAPI.getPromptTagGroups()
    : window.electronAPI.getImageTagGroups();
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

  return type === "prompt"
    ? window.electronAPI.createPromptTagGroup(trimmedName, sortOrder)
    : window.electronAPI.createImageTagGroup(trimmedName, sortOrder);
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
  if (type === "prompt") {
    await window.electronAPI.updatePromptTagGroupAttrs(id, attrs);
  } else {
    await window.electronAPI.updateImageTagGroupAttrs(id, attrs);
  }
}

/**
 * 删除标签组
 * @param type - 数据类型
 * @param id - 组ID
 * @throws 数据库操作失败时抛出异常
 */
export async function deleteTagGroup(type: DataType, id: TagGroupId): Promise<void> {
  if (type === "prompt") {
    await window.electronAPI.deletePromptTagGroup(id);
  } else {
    await window.electronAPI.deleteImageTagGroup(id);
  }
}
