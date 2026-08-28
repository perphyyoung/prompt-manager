/**
 * 标签组仓库
 * 提示词/图像标签组的 CRUD。原样迁自 database.ts, 逻辑未改动。
 */

import { checkTagGroupNameDuplicate } from "./tagRepository.js";
import { run, get, all } from "../sqlite/connection.js";
import { dbTime } from "../../../utils/index.js";
import { DuplicateNameError, isConstraintError } from "../../database-errors.js";
import type {
  PromptTagGroup,
  ImageTagGroup,
  PromptTagGroupRow,
  ImageTagGroupRow,
  UpdateTagGroupParams,
} from "../../../shared/domain/database-types.js";
/**
 * 创建提示词标签组
 * @param name - 标签组名称
 * @param sortOrder - 排序顺序
 */
async function createPromptTagGroup(name: string, sortOrder = 0): Promise<PromptTagGroup> {
  const existing = await checkTagGroupNameDuplicate("prompt", name);
  if (existing) {
    throw new DuplicateNameError("提示词标签组", name);
  }
  const now = dbTime();
  const sql = `
    INSERT INTO prompt_tag_groups (name, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `;
  try {
    const result = await run(sql, [name, sortOrder, now, now]);
    return { id: result.id, name, sortOrder, tags: [] };
  } catch (error) {
    if (isConstraintError(error)) {
      throw new DuplicateNameError("提示词标签组", name);
    }
    throw error;
  }
}

/**
 * 获取所有提示词标签组（包含标签列表）
 */
async function getPromptTagGroups(): Promise<PromptTagGroup[]> {
  const groupsSql = `
    SELECT id, name, sort_order as sortOrder
    FROM prompt_tag_groups
    ORDER BY sort_order ASC, created_at ASC
  `;
  const groups = await all<{ id: number; name: string; sortOrder: number }>(groupsSql);

  const tagsSql = `
    SELECT name, group_id as groupId
    FROM prompt_tags
  `;
  const tags = await all<{ name: string; groupId: number | null }>(tagsSql);

  // 组装数据
  return groups.map((group) => ({
    ...group,
    tags: tags.filter((t) => t.groupId === group.id).map((t) => t.name),
  }));
}

// 有效的提示词标签组字段白名单
const VALID_PROMPT_TAG_GROUP_FIELDS: Record<string, string> = {
  name: "name = ?",
  sortOrder: "sort_order = ?",
};

/**
 * 更新提示词标签组
 * @param id - 标签组 ID
 * @param updates - 更新内容
 */
async function updatePromptTagGroup(
  id: number,
  updates: UpdateTagGroupParams,
): Promise<PromptTagGroupRow | undefined> {
  const { name, sortOrder } = updates;
  const now = dbTime();

  if (name !== undefined) {
    const existing = await checkTagGroupNameDuplicate("prompt", name, id);
    if (existing) {
      throw new DuplicateNameError("提示词标签组", name);
    }
  }

  const fields: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    fields.push(VALID_PROMPT_TAG_GROUP_FIELDS.name);
    values.push(name);
  }
  if (sortOrder !== undefined) {
    fields.push(VALID_PROMPT_TAG_GROUP_FIELDS.sortOrder);
    values.push(sortOrder);
  }

  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);

  const sql = `UPDATE prompt_tag_groups SET ${fields.join(", ")} WHERE id = ?`;
  await run(sql, values);
  return getPromptTagGroupById(id);
}

/**
 * 获取单个提示词标签组
 */
async function getPromptTagGroupById(id: number): Promise<PromptTagGroupRow | undefined> {
  const sql = `
    SELECT id, name, sort_order as sort_order, created_at as created_at, updated_at as updated_at
    FROM prompt_tag_groups
    WHERE id = ?
  `;
  return await get<PromptTagGroupRow>(sql, [id]);
}

/**
 * 删除提示词标签组
 * @param id - 标签组ID
 */
async function deletePromptTagGroup(id: number): Promise<boolean> {
  // 关联的标签会被设置为 group_id = NULL (ON DELETE SET NULL)
  const sql = "DELETE FROM prompt_tag_groups WHERE id = ?";
  await run(sql, [id]);
  return true;
}

/**
 * 创建图像标签组
 * @param name - 标签组名称
 * @param sortOrder - 排序顺序
 */
async function createImageTagGroup(name: string, sortOrder = 0): Promise<ImageTagGroup> {
  const existing = await checkTagGroupNameDuplicate("image", name);
  if (existing) {
    throw new DuplicateNameError("图像标签组", name);
  }
  const now = dbTime();
  const sql = `
    INSERT INTO image_tag_groups (name, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `;
  try {
    const result = await run(sql, [name, sortOrder, now, now]);
    return { id: result.id, name, sortOrder, tags: [] };
  } catch (error) {
    if (isConstraintError(error)) {
      throw new DuplicateNameError("图像标签组", name);
    }
    throw error;
  }
}

/**
 * 获取所有图像标签组（包含标签列表）
 */
async function getImageTagGroups(): Promise<ImageTagGroup[]> {
  const groupsSql = `
    SELECT id, name, sort_order as sortOrder
    FROM image_tag_groups
    ORDER BY sort_order ASC, created_at ASC
  `;
  const groups = await all<{ id: number; name: string; sortOrder: number }>(groupsSql);

  const tagsSql = `
    SELECT name, group_id as groupId
    FROM image_tags
  `;
  const tags = await all<{ name: string; groupId: number | null }>(tagsSql);

  // 组装数据
  return groups.map((group) => ({
    ...group,
    tags: tags.filter((t) => t.groupId === group.id).map((t) => t.name),
  }));
}

// 有效的图像标签组字段白名单
const VALID_IMAGE_TAG_GROUP_FIELDS: Record<string, string> = {
  name: "name = ?",
  sortOrder: "sort_order = ?",
};

/**
 * 更新图像标签组
 * @param id - 标签组 ID
 * @param updates - 更新内容
 */
async function updateImageTagGroup(
  id: number,
  updates: UpdateTagGroupParams,
): Promise<ImageTagGroupRow | undefined> {
  const { name, sortOrder } = updates;
  const now = dbTime();

  if (name !== undefined) {
    const existing = await checkTagGroupNameDuplicate("image", name, id);
    if (existing) {
      throw new DuplicateNameError("图像标签组", name);
    }
  }

  const fields: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    fields.push(VALID_IMAGE_TAG_GROUP_FIELDS.name);
    values.push(name);
  }
  if (sortOrder !== undefined) {
    fields.push(VALID_IMAGE_TAG_GROUP_FIELDS.sortOrder);
    values.push(sortOrder);
  }

  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);

  const sql = `UPDATE image_tag_groups SET ${fields.join(", ")} WHERE id = ?`;
  await run(sql, values);
  return getImageTagGroupById(id);
}

/**
 * 获取单个图像标签组
 */
async function getImageTagGroupById(id: number): Promise<ImageTagGroupRow | undefined> {
  const sql = `
    SELECT id, name, sort_order as sort_order, created_at as created_at, updated_at as updated_at
    FROM image_tag_groups
    WHERE id = ?
  `;
  return await get<ImageTagGroupRow>(sql, [id]);
}

/**
 * 删除图像标签组
 * @param id - 标签组ID
 */
async function deleteImageTagGroup(id: number): Promise<boolean> {
  // 关联的标签会被设置为 group_id = NULL (ON DELETE SET NULL)
  const sql = "DELETE FROM image_tag_groups WHERE id = ?";
  await run(sql, [id]);
  return true;
}

// ==================== Prompt 操作 ====================

export {
  createPromptTagGroup,
  getPromptTagGroups,
  getPromptTagGroupById,
  updatePromptTagGroup,
  deletePromptTagGroup,
  createImageTagGroup,
  getImageTagGroups,
  getImageTagGroupById,
  updateImageTagGroup,
  deleteImageTagGroup,
};
