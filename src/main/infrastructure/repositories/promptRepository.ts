/**
 * 提示词仓库
 * 提示词查询/CRUD/回收站/批量收藏。原样迁自 database.ts, 逻辑未改动。
 */

import { addPromptTags } from "./tagRepository.js";
import { addPromptImages } from "./imageRepository.js";
import { run, get, all, runInTransaction, TAG_SEPARATOR } from "../sqlite/connection.js";
import { dbTime, formatDbTimeToLocal } from "../../../utils/index.js";
import type { PromptRow, Prompt, CreatePromptParams, UpdatePromptParams, MapPromptOptions, GetPromptsPaginatedOptions, PaginatedPromptsResult, CountPromptTagsOptions, PromptSpecialTagCounts, ImageRef } from "../../database-types.js";
/**
 * 将数据库行映射为提示词对象
 * @param row - 数据库行
 * @param options - 可选配置
 * @returns 提示词对象
 */
function mapRowToPrompt(row: PromptRow, options: MapPromptOptions = {}): Prompt {
  const { includeImages = true, includeDeletedAt = false } = options;

  const prompt: Prompt = {
    id: row.id,
    title: row.title,
    content: row.content,
    contentTranslate: row.content_translate,
    createdAt: formatDbTimeToLocal(row.created_at),
    updatedAt: formatDbTimeToLocal(row.updated_at),
    isFavorite: row.is_favorite === 1,
    isSafe: row.is_safe === 1 ? 1 : 0, // 严格限制为 0 或 1，其他值视为 0
    isDeleted: row.is_deleted === 1,
    note: row.note,
    tags: row.tags ? row.tags.split(TAG_SEPARATOR).filter((t) => t) : [],
  };

  if (includeImages) {
    prompt.images = [];
  }

  if (includeDeletedAt) {
    prompt.deletedAt = formatDbTimeToLocal(row.deleted_at);
  }

  return prompt;
}

/**
 * 批量获取提示词的关联图像
 * 优化 N+1 查询问题，使用单次查询 + JavaScript 分组
 * @param promptRows - 提示词行数据
 * @param options - 选项
 * @returns 包含图像的提示词列表
 */
async function getPromptsWithImages(
  promptRows: PromptRow[],
  options: MapPromptOptions = {},
): Promise<Prompt[]> {
  if (promptRows.length === 0) return [];

  const promptIds = promptRows.map((r) => r.id);
  const placeholders = promptIds.map(() => "?").join(",");

  const sql = `
    SELECT pir.prompt_id, i.id, i.file_name as fileName,
           i.relative_path as relativePath, i.thumbnail_path as thumbnailPath
    FROM prompt_image_relations pir
    JOIN images i ON pir.image_id = i.id
    WHERE pir.prompt_id IN (${placeholders}) AND i.is_deleted = 0
    ORDER BY pir.prompt_id, pir.sort_order ASC
  `;

  const allImages = await all<ImageRef & { prompt_id: string }>(sql, promptIds);

  const imagesByPromptId: Record<string, ImageRef[]> = {};
  for (const img of allImages) {
    const key = String(img.prompt_id);
    if (!imagesByPromptId[key]) {
      imagesByPromptId[key] = [];
    }
    const { prompt_id: _, ...imageRef } = img;
    imagesByPromptId[key].push(imageRef);
  }

  return promptRows.map((row) => {
    const prompt = mapRowToPrompt(row, options);
    const rowIdStr = String(row.id);
    prompt.images = imagesByPromptId[rowIdStr] || [];
    return prompt;
  });
}

/**
 * 获取所有提示词（注意：包含已删除项）
 * 仅供 e2e 测试种子/断言与备份统计使用，界面数据一律走 getPromptsPaginated
 * @param sortBy - 排序字段: 'updatedAt', 'createdAt', 'title'
 * @param sortOrder - 排序顺序: 'asc', 'desc'
 */
async function getPrompts(sortBy = "updatedAt", sortOrder = "desc"): Promise<Prompt[]> {
  // 排序字段映射
  const sortFieldMap: Record<string, string> = {
    updatedAt: "p.updated_at",
    createdAt: "p.created_at",
    title: "p.title",
  };

  const sortField = sortFieldMap[sortBy] || "p.updated_at";
  const order = sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC";

  // 获取所有提示词基本信息（包括已删除的）
  const sql = `
    SELECT p.*, GROUP_CONCAT(pt.name, char(31)) as tags
    FROM prompts p
    LEFT JOIN prompt_tag_relations ptr ON p.id = ptr.prompt_id
    LEFT JOIN prompt_tags pt ON ptr.tag_id = pt.id
    GROUP BY p.id
    ORDER BY ${sortField} ${order}
  `;

  const rows = await all<PromptRow>(sql);

  // 使用批量查询获取图像，避免 N+1 问题
  return getPromptsWithImages(rows);
}

/**
 * 提示词特殊标签到 SQL 条件的映射
 * 键值需与 src/constants.ts 中的特殊标签常量保持一致
 */
const PROMPT_SPECIAL_TAG_CONDITIONS: Record<string, string> = {
  收藏: "p.is_favorite = 1",
  安全: "p.is_safe != 0",
  敏感: "p.is_safe = 0",
  多图: "(SELECT COUNT(*) FROM prompt_image_relations pir WHERE pir.prompt_id = p.id) >= 2",
  无图: "NOT EXISTS (SELECT 1 FROM prompt_image_relations pir WHERE pir.prompt_id = p.id)",
  无标: "NOT EXISTS (SELECT 1 FROM prompt_tag_relations ptr WHERE ptr.prompt_id = p.id)",
  单语: "COALESCE(p.content_translate, '') = ''",
};

/**
 * 构建提示词分页/计数查询的 WHERE 条件和参数
 * @param options - 查询选项
 * @returns WHERE 子句和参数数组
 */
function buildPromptFilterWhere(options: {
  searchQuery?: string;
  tagNames?: string[];
  specialTags?: string[];
  isSafe?: boolean;
  invertedFilter?: boolean;
}): { whereClause: string; params: any[] } {
  const conditions: string[] = ["p.is_deleted = 0"];
  const params: any[] = [];

  if (options.isSafe) {
    conditions.push("p.is_safe != 0");
  }

  if (options.searchQuery && options.searchQuery.trim()) {
    const query = `%${options.searchQuery.trim()}%`;
    conditions.push(
      `(p.title LIKE ? OR p.content LIKE ? OR p.content_translate LIKE ? OR p.note LIKE ? OR EXISTS (SELECT 1 FROM prompt_tag_relations ptr_search JOIN prompt_tags pt_search ON ptr_search.tag_id = pt_search.id WHERE ptr_search.prompt_id = p.id AND pt_search.name LIKE ?))`,
    );
    params.push(query, query, query, query, query);
  }

  // 构建标签筛选条件（普通标签 + 特殊标签）
  const tagConditions: string[] = [];

  if (options.tagNames && options.tagNames.length > 0) {
    const placeholders = options.tagNames.map(() => "?").join(",");
    tagConditions.push(
      `(SELECT COUNT(DISTINCT pt_tag.name) FROM prompt_tag_relations ptr_tag JOIN prompt_tags pt_tag ON ptr_tag.tag_id = pt_tag.id WHERE ptr_tag.prompt_id = p.id AND pt_tag.name IN (${placeholders})) = ${options.tagNames.length}`,
    );
    params.push(...options.tagNames);
  }

  if (options.specialTags && options.specialTags.length > 0) {
    for (const tag of options.specialTags) {
      const condition = PROMPT_SPECIAL_TAG_CONDITIONS[tag];
      if (condition) {
        tagConditions.push(condition);
      }
    }
  }

  if (tagConditions.length > 0) {
    const combinedTagCondition = tagConditions.join(" AND ");
    if (options.invertedFilter) {
      conditions.push(`NOT (${combinedTagCondition})`);
    } else {
      conditions.push(combinedTagCondition);
    }
  }

  return {
    whereClause: conditions.join(" AND "),
    params,
  };
}

/**
 * 分页获取提示词（不包括已删除的）
 * @param options - 分页和筛选选项
 */
async function getPromptsPaginated(
  options: GetPromptsPaginatedOptions,
): Promise<PaginatedPromptsResult> {
  const sortFieldMap: Record<string, string> = {
    createdAt: "p.created_at",
    updatedAt: "p.updated_at",
    title: "p.title",
  };

  const sortBy = options.sortBy || "updatedAt";
  const sortOrder = options.sortOrder || "desc";
  const sortField = sortFieldMap[sortBy] || "p.updated_at";
  const order = sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC";

  const { whereClause, params } = buildPromptFilterWhere(options);
  const limit = Math.max(1, options.limit);
  const offset = Math.max(0, options.offset);

  const promptSql = `
    SELECT p.*,
           (SELECT GROUP_CONCAT(pt.name, char(31))
            FROM prompt_tag_relations ptr
            JOIN prompt_tags pt ON ptr.tag_id = pt.id
            WHERE ptr.prompt_id = p.id) as tags
    FROM prompts p
    WHERE ${whereClause}
    ORDER BY ${sortField} ${order}
    LIMIT ? OFFSET ?
  `;

  const queryParams = [...params, limit, offset];
  const rows = await all<PromptRow>(promptSql, queryParams);

  const [items, totalCount] = await Promise.all([
    getPromptsWithImages(rows),
    countPrompts(options),
  ]);

  return {
    items,
    totalCount,
  };
}

/**
 * 统计满足条件的提示词总数
 * @param options - 筛选选项（不含 limit/offset）
 */
async function countPrompts(
  options: Omit<GetPromptsPaginatedOptions, "limit" | "offset">,
): Promise<number> {
  const { whereClause, params } = buildPromptFilterWhere(options);

  const sql = `
    SELECT COUNT(*) as count
    FROM prompts p
    WHERE ${whereClause}
  `;

  const row = await get<{ count: number }>(sql, params);
  return row?.count || 0;
}

/**
 * 获取满足筛选条件的全部提示词 id（轻量查询，用于"全选"等批量操作）
 * @param options - 筛选选项（不含 limit/offset）
 */
async function getPromptIdsByFilter(
  options: Omit<GetPromptsPaginatedOptions, "limit" | "offset">,
): Promise<string[]> {
  const { whereClause, params } = buildPromptFilterWhere(options);

  const sql = `
    SELECT p.id
    FROM prompts p
    WHERE ${whereClause}
  `;

  const rows = await all<{ id: string }>(sql, params);
  return rows.map((r) => r.id);
}

/**
 * 统计提示词标签数量（基于当前筛选条件）
 * @param options - 筛选选项
 */
async function countPromptTags(options: CountPromptTagsOptions): Promise<Record<string, number>> {
  const { whereClause, params } = buildPromptFilterWhere(options);

  const sql = `
    SELECT pt.name as tag_name, COUNT(DISTINCT p.id) as count
    FROM prompts p
    JOIN prompt_tag_relations ptr ON p.id = ptr.prompt_id
    JOIN prompt_tags pt ON ptr.tag_id = pt.id
    WHERE ${whereClause}
    GROUP BY pt.name
  `;

  const rows = await all<{ tag_name: string; count: number }>(sql, params);
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.tag_name] = row.count;
  }
  return result;
}

/**
 * 统计提示词特殊标签数量（基于当前筛选条件）
 * @param options - 筛选选项
 */
async function countPromptSpecialTags(
  options: CountPromptTagsOptions,
): Promise<PromptSpecialTagCounts> {
  const { whereClause, params } = buildPromptFilterWhere(options);

  const sql = `
    SELECT
      SUM(CASE WHEN p.is_favorite = 1 THEN 1 ELSE 0 END) as favorite,
      SUM(CASE WHEN p.is_safe != 0 THEN 1 ELSE 0 END) as safe,
      SUM(CASE WHEN p.is_safe = 0 THEN 1 ELSE 0 END) as unsafe,
      SUM(CASE WHEN (SELECT COUNT(*) FROM prompt_image_relations pir WHERE pir.prompt_id = p.id) >= 2 THEN 1 ELSE 0 END) as multi_image,
      SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM prompt_image_relations pir WHERE pir.prompt_id = p.id) THEN 1 ELSE 0 END) as no_image,
      SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM prompt_tag_relations ptr WHERE ptr.prompt_id = p.id) THEN 1 ELSE 0 END) as no_tag,
      SUM(CASE WHEN COALESCE(p.content_translate, '') = '' THEN 1 ELSE 0 END) as single_lang
    FROM prompts p
    WHERE ${whereClause}
  `;

  const row = await get<{
    favorite: number;
    safe: number;
    unsafe: number;
    multi_image: number;
    no_image: number;
    no_tag: number;
    single_lang: number;
  }>(sql, params);

  return {
    favorite: row?.favorite || 0,
    safe: row?.safe || 0,
    unsafe: row?.unsafe || 0,
    multiImage: row?.multi_image || 0,
    noImage: row?.no_image || 0,
    noTag: row?.no_tag || 0,
    singleLang: row?.single_lang || 0,
  };
}

/**
 * 检查标题是否已存在
 * @param title - 提示词标题
 * @param excludeId - 排除的提示词ID（用于编辑时排除自己）
 * @returns 是否存在
 */
async function isTitleExists(title: string, excludeId: string | null = null): Promise<boolean> {
  let sql = "SELECT COUNT(*) as count FROM prompts WHERE title = ? AND is_deleted = 0";
  const params: any[] = [title];

  if (excludeId) {
    sql += " AND id != ?";
    params.push(excludeId);
  }

  const result = await get<{ count: number }>(sql, params);
  return result ? result.count > 0 : false;
}

/**
 * 获取单个提示词
 */
async function getPromptById(id: string): Promise<Prompt | null> {
  const sql = `
    SELECT p.*, GROUP_CONCAT(pt.name, char(31)) as tags
    FROM prompts p
    LEFT JOIN prompt_tag_relations ptr ON p.id = ptr.prompt_id
    LEFT JOIN prompt_tags pt ON ptr.tag_id = pt.id
    WHERE p.id = ? AND p.is_deleted = 0
    GROUP BY p.id
  `;
  const row = await get<PromptRow>(sql, [id]);
  if (!row) return null;

  const prompt = mapRowToPrompt(row);

  // 获取关联的图像，按sort_order排序以保持顺序
  const imagesSql = `
    SELECT i.id, i.file_name as fileName,
           i.relative_path as relativePath, i.thumbnail_path as thumbnailPath
    FROM images i
    JOIN prompt_image_relations pir ON i.id = pir.image_id
    WHERE pir.prompt_id = ? AND i.is_deleted = 0
    ORDER BY pir.sort_order ASC
  `;
  const images = await all<ImageRef>(imagesSql, [id]);
  prompt.images = images || [];

  return prompt;
}

/**
 * 批量获取提示词（按 ID，含关联图像）
 * 用于替代循环内逐条 getPromptById 的 N+1 IPC 模式
 * @param ids - 提示词 ID 数组
 * @returns 提示词列表（按传入顺序排列，不存在的 ID 跳过）
 */
async function getPromptsByIds(ids: string[]): Promise<Prompt[]> {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(",");
  const sql = `
    SELECT p.*, GROUP_CONCAT(pt.name, char(31)) as tags
    FROM prompts p
    LEFT JOIN prompt_tag_relations ptr ON p.id = ptr.prompt_id
    LEFT JOIN prompt_tags pt ON ptr.tag_id = pt.id
    WHERE p.id IN (${placeholders})
    GROUP BY p.id
  `;
  const rows = await all<PromptRow>(sql, ids);
  const prompts = await getPromptsWithImages(rows);

  // 保持与传入 ids 一致的顺序
  const byId = new Map(prompts.map((p) => [String(p.id), p]));
  return ids.map((id) => byId.get(String(id))).filter((p): p is Prompt => !!p);
}

/**
 * 添加提示词
 * 使用事务确保数据一致性
 */
async function addPrompt(prompt: CreatePromptParams): Promise<Prompt | null> {
  const {
    id,
    title,
    content,
    contentTranslate,
    tags = [],
    images = [],
    note = "",
    isSafe = 1,
  } = prompt;
  const now = dbTime();

  return runInTransaction(async () => {
    await run(
      "INSERT INTO prompts (id, title, content, content_translate, note, is_safe, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, title, content, contentTranslate || "", note, isSafe, now, now],
    );

    // 添加标签关联
    if (tags.length > 0) {
      await addPromptTags(id, tags);
    }

    // 添加图像关联
    if (images.length > 0) {
      const imageIds = images.map((img) => img.id);
      await addPromptImages(id, imageIds);
    }

    return getPromptById(id);
  });
}

/**
 * 更新提示词
 * 使用事务确保数据一致性
 */
async function updatePrompt(id: string, updates: UpdatePromptParams): Promise<Prompt | null> {
  const { title, content, contentTranslate, tags, images, note, isSafe, isFavorite } = updates;
  const now = dbTime();

  return runInTransaction(async () => {
    const relatedFields = ["tags", "images"];
    const hasBasicFieldUpdate = Object.keys(updates).some((key) => !relatedFields.includes(key));

    if (hasBasicFieldUpdate) {
      const fields: string[] = [];
      const values: any[] = [];

      if (title !== undefined) {
        fields.push("title = ?");
        values.push(title);
      }
      if (content !== undefined) {
        fields.push("content = ?");
        values.push(content);
      }
      if (contentTranslate !== undefined) {
        fields.push("content_translate = ?");
        values.push(contentTranslate);
      }
      if (note !== undefined) {
        fields.push("note = ?");
        values.push(note);
      }
      if (isSafe !== undefined) {
        fields.push("is_safe = ?");
        values.push(isSafe ? 1 : 0);
      }
      if (isFavorite !== undefined) {
        fields.push("is_favorite = ?");
        values.push(isFavorite ? 1 : 0);
      }
      fields.push("updated_at = ?");
      values.push(now);
      values.push(id);

      await run(`UPDATE prompts SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    // 更新标签 - 增量更新方式
    if (tags !== undefined) {
      const currentTagsRow = await get<{ tags: string | null }>(
        "SELECT GROUP_CONCAT(pt.name, char(31)) as tags FROM prompt_tag_relations ptr JOIN prompt_tags pt ON ptr.tag_id = pt.id WHERE ptr.prompt_id = ?",
        [id],
      );
      const currentTagNames =
        currentTagsRow && currentTagsRow.tags ? currentTagsRow.tags.split(TAG_SEPARATOR) : [];

      const tagsToAdd = tags.filter((t) => !currentTagNames.includes(t));
      const tagsToRemove = currentTagNames.filter((t) => !tags.includes(t));

      const tagsChanged = tagsToAdd.length > 0 || tagsToRemove.length > 0;

      for (const tagName of tagsToRemove) {
        const tagRow = await get<{ id: number }>("SELECT id FROM prompt_tags WHERE name = ?", [
          tagName,
        ]);
        if (tagRow) {
          await run("DELETE FROM prompt_tag_relations WHERE prompt_id = ? AND tag_id = ?", [
            id,
            tagRow.id,
          ]);
        }
      }

      if (tagsToAdd.length > 0) {
        await addPromptTags(id, tagsToAdd);
      }

      if (tagsChanged && !hasBasicFieldUpdate) {
        await run("UPDATE prompts SET updated_at = ? WHERE id = ?", [now, id]);
      }
    }

    // 更新图像关联
    if (images !== undefined) {
      const currentImageRows = await all<{ image_id: string }>(
        "SELECT image_id FROM prompt_image_relations WHERE prompt_id = ?",
        [id],
      );
      const currentImageIds = currentImageRows.map((r) => r.image_id);
      const newImageIds = images.map((img) => img.id);

      const imagesToAdd = newImageIds.filter((imgId) => !currentImageIds.includes(imgId));
      const imagesToRemove = currentImageIds.filter((imgId) => !newImageIds.includes(imgId));
      // 集合一致且序列一致才可跳过；仅顺序变化也需重建以同步 sort_order（"设为首张"）
      const sameSequence =
        imagesToAdd.length === 0 &&
        imagesToRemove.length === 0 &&
        currentImageIds.every((imgId, idx) => String(imgId) === String(newImageIds[idx]));

      if (!sameSequence) {
        await run("DELETE FROM prompt_image_relations WHERE prompt_id = ?", [id]);
        if (images.length > 0) {
          await addPromptImages(id, newImageIds);
        }

        // 仅对发生增删的图像刷新更新时间，保证主界面按最近更新排序正确
        const touched = [...imagesToAdd, ...imagesToRemove];
        if (touched.length > 0) {
          await run(
            `UPDATE images SET updated_at = ? WHERE id IN (${touched.map(() => "?").join(",")})`,
            [now, ...touched],
          );
        }
      }

      if (!hasBasicFieldUpdate) {
        await run("UPDATE prompts SET updated_at = ? WHERE id = ?", [now, id]);
      }
    }

    return getPromptById(id);
  });
}

/**
 * 软删除提示词
 * 保留关联关系，仅标记删除状态
 */
async function deletePrompt(id: string): Promise<boolean> {
  const now = dbTime();

  // 仅标记软删除，保留所有关联关系
  await run("UPDATE prompts SET is_deleted = 1, deleted_at = ? WHERE id = ?", [now, id]);

  return true;
}

/**
 * 批量软删除提示词
 * 保留关联关系，仅标记删除状态
 * @param ids - 提示词ID数组
 * @returns 删除结果
 */
async function softDeletePrompts(ids: string[]): Promise<{ success: boolean; deleted: number }> {
  if (ids.length === 0) return { success: true, deleted: 0 };

  const now = dbTime();
  const placeholders = ids.map(() => "?").join(",");

  // 仅标记软删除，保留所有关联关系
  const result = await run(
    `UPDATE prompts SET is_deleted = 1, deleted_at = ? WHERE id IN (${placeholders})`,
    [now, ...ids],
  );

  return { success: true, deleted: result.changes || 0 };
}

/**
 * 恢复已删除的提示词
 */
async function restorePrompt(id: string): Promise<Prompt | null> {
  const now = dbTime();
  await run("UPDATE prompts SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ?", [
    now,
    id,
  ]);
  return getPromptById(id);
}

/**
 * 永久删除提示词
 */
async function permanentDeletePrompt(id: string): Promise<boolean> {
  // 删除关联关系与记录（单事务，保证原子性）
  await runInTransaction(async () => {
    // 1. 删除关联关系
    await run("DELETE FROM prompt_image_relations WHERE prompt_id = ?", [id]);

    // 2. 删除数据库记录
    await run("DELETE FROM prompts WHERE id = ?", [id]);
  });
  return true;
}

/**
 * 清空提示词回收站
 * 删除所有软删除的提示词记录及其关联关系
 */
async function emptyPromptTrash(): Promise<boolean> {
  // 两步删除包进单事务，避免中途失败残留半删状态
  await runInTransaction(async () => {
    // 1. 删除关联关系（使用 IN 子句批量删除）
    await run(
      "DELETE FROM prompt_image_relations WHERE prompt_id IN (SELECT id FROM prompts WHERE is_deleted = 1)",
    );

    // 2. 删除数据库记录
    await run("DELETE FROM prompts WHERE is_deleted = 1");
  });
  return true;
}

/**
 * 恢复所有已删除的提示词
 */
async function restoreAllPrompts(): Promise<boolean> {
  const now = dbTime();
  await run(
    "UPDATE prompts SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE is_deleted = 1",
    [now],
  );
  return true;
}

/**
 * 获取回收站中的提示词
 */
async function getDeletedPrompts(): Promise<Prompt[]> {
  const sql = `
    SELECT p.*, GROUP_CONCAT(pt.name, char(31)) as tags
    FROM prompts p
    LEFT JOIN prompt_tag_relations ptr ON p.id = ptr.prompt_id
    LEFT JOIN prompt_tags pt ON ptr.tag_id = pt.id
    WHERE p.is_deleted = 1
    GROUP BY p.id
    ORDER BY p.deleted_at DESC
  `;
  const rows = await all<PromptRow>(sql);
  return getPromptsWithImages(rows, { includeImages: true, includeDeletedAt: true });
}

// ==================== 标签操作 ====================


/**
 * 批量切换提示词收藏状态
 * 每个提示词的收藏状态会被切换（收藏->取消收藏，未收藏->收藏）
 * @param ids - 提示词ID数组
 * @returns 更新结果
 */
async function batchFavoritePrompts(ids: string[]): Promise<{ success: boolean; updated: number }> {
  if (ids.length === 0) return { success: true, updated: 0 };

  const now = dbTime();

  return runInTransaction(async () => {
    // 集合级切换收藏状态（已收藏→取消，未收藏→收藏）
    const placeholders = ids.map(() => "?").join(",");
    const result = await run(
      `UPDATE prompts SET is_favorite = 1 - is_favorite, updated_at = ? WHERE id IN (${placeholders})`,
      [now, ...ids],
    );

    return { success: true, updated: result.changes || 0 };
  });
}


export {
  getPrompts,
  getPromptsPaginated,
  countPrompts,
  getPromptIdsByFilter,
  countPromptTags,
  countPromptSpecialTags,
  isTitleExists,
  getPromptById,
  getPromptsByIds,
  addPrompt,
  updatePrompt,
  deletePrompt,
  softDeletePrompts,
  restorePrompt,
  permanentDeletePrompt,
  emptyPromptTrash,
  restoreAllPrompts,
  getDeletedPrompts,
  batchFavoritePrompts,
};
