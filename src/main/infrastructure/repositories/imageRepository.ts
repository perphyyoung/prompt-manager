/**
 * 图像仓库
 * 图像查询/CRUD/文件删除/回收站/提示词关联。原样迁自 database.ts, 逻辑未改动。
 */

import { getImageTagsByImageId, addImageTags } from "./tagRepository.js";
import { run, get, all, runInTransaction, TAG_SEPARATOR, getDb } from "../sqlite/connection.js";
import { logError, logDebug } from "../../mainLogger.js";
import { dbTime, formatDbTimeToLocal } from "../../../utils/index.js";
import { isConstraintError } from "../../database-errors.js";
import path from "path";
import { promises as fs } from "fs";
import type { ImageRow, Image, CreateImageParams, UpdateImageParams, MapImageOptions, GetImagesOptions, GetImagesPaginatedOptions, PaginatedImagesResult, CountImageTagsOptions, ImageSpecialTagCounts, ImageFilePaths, ImageCleanupInfo, PromptImage, UpdateThumbnailParams } from "../../../shared/domain/database-types.js";
/**
 * 将数据库行映射为图像对象
 * @param row - 数据库行
 * @param promptRows - 关联的提示词行
 * @param options - 可选配置
 * @returns 图像对象
 */
function mapRowToImage(
  row: ImageRow,
  promptRows: Array<{ id: string; title: string; content: string }> = [],
  options: MapImageOptions = {},
): Image {
  const { includeDeletedAt = false } = options;

  const image: Image = {
    id: row.id,
    fileName: row.file_name,
    storedName: row.stored_name,
    relativePath: row.relative_path,
    thumbnailPath: row.thumbnail_path,
    width: row.width,
    height: row.height,
    fileSize: row.file_size || 0,
    isFavorite: row.is_favorite === 1,
    isSafe: row.is_safe === 1 ? 1 : 0, // 严格限制为 0 或 1，其他值视为 0
    isDeleted: row.is_deleted === 1,
    note: row.note,
    createdAt: formatDbTimeToLocal(row.created_at),
    updatedAt: formatDbTimeToLocal(row.updated_at),
    tags: row.image_tags ? row.image_tags.split(TAG_SEPARATOR).filter((t) => t) : [],
    promptRefs: promptRows.map((p) => ({
      promptId: p.id,
      promptTitle: p.title,
      promptContent: p.content,
      promptContentTranslate: (p as any).content_translate,
      promptNote: (p as any).note,
    })),
  };

  if (includeDeletedAt) {
    image.deletedAt = formatDbTimeToLocal(row.deleted_at);
  }

  return image;
}

/**
 * 批量获取图像的关联提示词引用
 * @param imageIds - 图像 ID 数组
 * @returns 提示词引用列表
 */
async function getPromptRefsForImages(imageIds: string[]): Promise<
  Array<{
    image_id: string;
    id: string;
    title: string;
    content: string;
    content_translate: string;
    note: string;
  }>
> {
  if (imageIds.length === 0) return [];
  const placeholders = imageIds.map(() => "?").join(",");
  const sql = `
    SELECT pir.image_id, p.id, p.title, p.content, p.content_translate, p.note
    FROM prompt_image_relations pir
    JOIN prompts p ON pir.prompt_id = p.id
    WHERE pir.image_id IN (${placeholders}) AND p.is_deleted = 0
  `;
  return await all(sql, imageIds);
}

/**
 * 图像查询公共方法 - 批量获取关联数据避免 N+1 问题
 * @param baseSql - 基础 SQL 查询
 * @param params - 查询参数
 * @returns 图像列表
 */
async function getImagesCore(baseSql: string, params: any[]): Promise<Image[]> {
  const rows = await all<ImageRow>(baseSql, params);
  if (rows.length === 0) return [];

  const imageIds = rows.map((r) => r.id);
  const promptRefs = await getPromptRefsForImages(imageIds);

  const refsByImageId: Record<
    string,
    Array<{ id: string; title: string; content: string; content_translate: string; note: string }>
  > = {};
  for (const ref of promptRefs) {
    if (!refsByImageId[ref.image_id]) refsByImageId[ref.image_id] = [];
    refsByImageId[ref.image_id].push({
      id: ref.id,
      title: ref.title,
      content: ref.content,
      content_translate: ref.content_translate,
      note: ref.note,
    });
  }

  return rows.map((row) => mapRowToImage(row, refsByImageId[row.id] || []));
}

/**
 * 获取所有图像（不包括已删除的）
 * @param sortBy - 排序字段: 'createdAt', 'fileName', 'width', 'height'
 * @param sortOrder - 排序顺序: 'asc', 'desc'
 */
async function getImages(sortBy = "createdAt", sortOrder = "desc"): Promise<Image[]> {
  const sortFieldMap: Record<string, string> = {
    createdAt: "i.created_at",
    updatedAt: "i.updated_at",
    fileName: "i.file_name",
    width: "i.width",
    height: "i.height",
    fileSize: "i.file_size",
  };

  const sortField = sortFieldMap[sortBy] || "i.created_at";
  const order = sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC";

  const imageSql = `
    SELECT i.*,
           (SELECT GROUP_CONCAT(it.name, char(31))
            FROM image_tag_relations itr
            JOIN image_tags it ON itr.tag_id = it.id
            WHERE itr.image_id = i.id) as image_tags
    FROM images i
    WHERE i.is_deleted = 0
    ORDER BY ${sortField} ${order}
  `;
  return getImagesCore(imageSql, []);
}

/**
 * 图像特殊标签到 SQL 条件的映射
 * 键值需与 src/renderer/constants.ts 中的特殊标签常量保持一致
 */
const IMAGE_SPECIAL_TAG_CONDITIONS: Record<string, string> = {
  收藏: "i.is_favorite = 1",
  未引: "NOT EXISTS (SELECT 1 FROM prompt_image_relations pir WHERE pir.image_id = i.id)",
  多引: "(SELECT COUNT(*) FROM prompt_image_relations pir WHERE pir.image_id = i.id) > 1",
  无标: "NOT EXISTS (SELECT 1 FROM image_tag_relations itr WHERE itr.image_id = i.id)",
  安全: "i.is_safe != 0",
  敏感: "i.is_safe = 0",
};

/**
 * 构建分页/计数查询的 WHERE 条件和参数
 * @param options - 查询选项
 * @returns WHERE 子句和参数数组
 */
function buildImageFilterWhere(options: {
  searchQuery?: string;
  tagNames?: string[];
  specialTags?: string[];
  isSafe?: boolean;
  invertedFilter?: boolean;
}): { whereClause: string; params: any[] } {
  const conditions: string[] = ["i.is_deleted = 0"];
  const params: any[] = [];

  if (options.isSafe) {
    conditions.push("i.is_safe != 0");
  }

  if (options.searchQuery && options.searchQuery.trim()) {
    const query = `%${options.searchQuery.trim()}%`;
    conditions.push(
      `(i.file_name LIKE ? OR i.note LIKE ? OR EXISTS (SELECT 1 FROM image_tag_relations itr_search JOIN image_tags it_search ON itr_search.tag_id = it_search.id WHERE itr_search.image_id = i.id AND it_search.name LIKE ?))`,
    );
    params.push(query, query, query);
  }

  // 构建标签筛选条件（普通标签 + 特殊标签）
  const tagConditions: string[] = [];

  if (options.tagNames && options.tagNames.length > 0) {
    const placeholders = options.tagNames.map(() => "?").join(",");
    tagConditions.push(
      `(SELECT COUNT(DISTINCT it_tag.name) FROM image_tag_relations itr_tag JOIN image_tags it_tag ON itr_tag.tag_id = it_tag.id WHERE itr_tag.image_id = i.id AND it_tag.name IN (${placeholders})) = ${options.tagNames.length}`,
    );
    params.push(...options.tagNames);
  }

  if (options.specialTags && options.specialTags.length > 0) {
    for (const tag of options.specialTags) {
      const condition = IMAGE_SPECIAL_TAG_CONDITIONS[tag];
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
 * 分页获取图像（不包括已删除的）
 * @param options - 分页和筛选选项
 */
async function getImagesPaginated(
  options: GetImagesPaginatedOptions,
): Promise<PaginatedImagesResult> {
  const sortFieldMap: Record<string, string> = {
    createdAt: "i.created_at",
    updatedAt: "i.updated_at",
    fileName: "i.file_name",
    width: "i.width",
    height: "i.height",
    fileSize: "i.file_size",
  };

  const sortBy = options.sortBy || "createdAt";
  const sortOrder = options.sortOrder || "desc";
  const sortField = sortFieldMap[sortBy] || "i.created_at";
  const order = sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC";

  const { whereClause, params } = buildImageFilterWhere(options);
  const limit = Math.max(1, options.limit);
  const offset = Math.max(0, options.offset);

  const imageSql = `
    SELECT i.*,
           (SELECT GROUP_CONCAT(it.name, char(31))
            FROM image_tag_relations itr
            JOIN image_tags it ON itr.tag_id = it.id
            WHERE itr.image_id = i.id) as image_tags
    FROM images i
    WHERE ${whereClause}
    ORDER BY ${sortField} ${order}
    LIMIT ? OFFSET ?
  `;

  const queryParams = [...params, limit, offset];
  const [items, countResult] = await Promise.all([
    getImagesCore(imageSql, queryParams),
    countImages(options),
  ]);

  return {
    items,
    totalCount: countResult,
  };
}

/**
 * 统计满足条件的图像总数
 * @param options - 筛选选项（不含 limit/offset）
 */
async function countImages(
  options: Omit<GetImagesPaginatedOptions, "limit" | "offset">,
): Promise<number> {
  const { whereClause, params } = buildImageFilterWhere(options);

  const sql = `
    SELECT COUNT(DISTINCT i.id) as count
    FROM images i
    WHERE ${whereClause}
  `;

  const row = await get<{ count: number }>(sql, params);
  return row?.count || 0;
}

/**
 * 获取满足筛选条件的全部图像 id（轻量查询，用于"全选"等批量操作）
 * @param options - 筛选选项（不含 limit/offset）
 */
async function getImageIdsByFilter(
  options: Omit<GetImagesPaginatedOptions, "limit" | "offset">,
): Promise<string[]> {
  const { whereClause, params } = buildImageFilterWhere(options);

  const sql = `
    SELECT i.id
    FROM images i
    WHERE ${whereClause}
  `;

  const rows = await all<{ id: string }>(sql, params);
  return rows.map((r) => r.id);
}

/**
 * 统计图像标签数量（基于当前筛选条件）
 * @param options - 筛选选项
 */
async function countImageTags(options: CountImageTagsOptions): Promise<Record<string, number>> {
  const { whereClause, params } = buildImageFilterWhere(options);

  const sql = `
    SELECT it.name as tag_name, COUNT(DISTINCT i.id) as count
    FROM images i
    JOIN image_tag_relations itr ON i.id = itr.image_id
    JOIN image_tags it ON itr.tag_id = it.id
    WHERE ${whereClause}
    GROUP BY it.name
  `;

  const rows = await all<{ tag_name: string; count: number }>(sql, params);
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.tag_name] = row.count;
  }
  return result;
}

/**
 * 统计图像特殊标签数量（基于当前筛选条件）
 * @param options - 筛选选项
 */
async function countImageSpecialTags(
  options: CountImageTagsOptions,
): Promise<ImageSpecialTagCounts> {
  const { whereClause, params } = buildImageFilterWhere(options);

  const sql = `
    SELECT
      SUM(CASE WHEN i.is_favorite = 1 THEN 1 ELSE 0 END) as favorite,
      SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM prompt_image_relations pir WHERE pir.image_id = i.id) THEN 1 ELSE 0 END) as unreferenced,
      SUM(CASE WHEN (SELECT COUNT(*) FROM prompt_image_relations pir WHERE pir.image_id = i.id) > 1 THEN 1 ELSE 0 END) as multi_ref,
      SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM image_tag_relations itr WHERE itr.image_id = i.id) THEN 1 ELSE 0 END) as no_tag,
      SUM(CASE WHEN i.is_safe != 0 THEN 1 ELSE 0 END) as safe,
      SUM(CASE WHEN i.is_safe = 0 THEN 1 ELSE 0 END) as unsafe
    FROM images i
    WHERE ${whereClause}
  `;

  const row = await get<{
    favorite: number;
    unreferenced: number;
    multi_ref: number;
    no_tag: number;
    safe: number;
    unsafe: number;
  }>(sql, params);

  return {
    favorite: row?.favorite || 0,
    unreferenced: row?.unreferenced || 0,
    multiRef: row?.multi_ref || 0,
    noTag: row?.no_tag || 0,
    safe: row?.safe || 0,
    unsafe: row?.unsafe || 0,
  };
}

/**
 * 根据 ID 批量获取图像
 * @param ids - 图像 ID 数组
 * @returns 图像列表
 */
async function getImagesByIds(ids: string[]): Promise<Image[]> {
  if (!ids || ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(",");
  const sql = `
    SELECT i.*,
           (SELECT GROUP_CONCAT(it.name, char(31))
            FROM image_tag_relations itr
            JOIN image_tags it ON itr.tag_id = it.id
            WHERE itr.image_id = i.id) as image_tags
    FROM images i
    WHERE i.id IN (${placeholders}) AND i.is_deleted = 0
  `;
  return await getImagesCore(sql, ids);
}

/**
 * 获取所有图像（用于清理）
 * @param options - 选项，forCleanup 为 true
 * @returns 图像清理信息列表
 */
async function getAllImages(options: { forCleanup: true }): Promise<ImageCleanupInfo[]>;
/**
 * 获取所有图像（完整信息）
 * @param options - 选项，forCleanup 为 false 或未指定
 * @returns 图像对象列表
 */
async function getAllImages(options?: { forCleanup?: false }): Promise<Image[]>;
/**
 * 获取所有图像
 * @param options - 选项
 * @returns 图像记录
 */
async function getAllImages(options: GetImagesOptions = {}): Promise<Image[] | ImageCleanupInfo[]> {
  const { forCleanup = false } = options;

  if (forCleanup) {
    // 清理孤儿文件：只需要路径，不需要关联数据
    const sql = "SELECT id, relative_path, thumbnail_path FROM images";
    return await all<ImageCleanupInfo>(sql);
  }

  // 默认：统计或其他场景，使用完整查询
  const imageSql = `
    SELECT i.*,
           (SELECT GROUP_CONCAT(it.name, char(31))
            FROM image_tag_relations itr
            JOIN image_tags it ON itr.tag_id = it.id
            WHERE itr.image_id = i.id) as image_tags
    FROM images i
    ORDER BY i.created_at DESC
  `;
  return getImagesCore(imageSql, []);
}

/**
 * 根据 ID 查找图像
 */
async function getImageById(id: string): Promise<Image | null> {
  // 先获取图像基本信息和标签（使用子查询避免重复）
  const imageSql = `
    SELECT i.*,
           (SELECT GROUP_CONCAT(it.name, char(31))
            FROM image_tag_relations itr
            JOIN image_tags it ON itr.tag_id = it.id
            WHERE itr.image_id = i.id) as image_tags
    FROM images i
    WHERE i.id = ?
  `;
  const row = await get<ImageRow>(imageSql, [id]);
  if (!row) return null;

  // 单独获取关联的提示词信息
  const promptSql = `
    SELECT p.id, p.title, p.content, p.content_translate, p.note
    FROM prompts p
    JOIN prompt_image_relations pir ON p.id = pir.prompt_id
    WHERE pir.image_id = ? AND p.is_deleted = 0
  `;
  const promptRows = await all<{
    id: string;
    title: string;
    content: string;
    content_translate: string;
    note: string;
  }>(promptSql, [id]);

  return mapRowToImage(row, promptRows);
}

/**
 * 更新图像
 * @param id - 图像 ID
 * @param updates - 更新内容
 */
async function updateImage(id: string, updates: UpdateImageParams): Promise<Image | null> {
  const { isFavorite, isSafe, note, fileName, tags, prompts } = updates;
  const now = dbTime();

  return runInTransaction(async () => {
    const relatedFields = ["tags", "prompts"];
    const hasBasicFieldUpdate = Object.keys(updates).some((key) => !relatedFields.includes(key));

    if (hasBasicFieldUpdate) {
      const fields: string[] = [];
      const values: any[] = [];

      if (isFavorite !== undefined) {
        fields.push("is_favorite = ?");
        values.push(isFavorite ? 1 : 0);
      }
      if (isSafe !== undefined) {
        fields.push("is_safe = ?");
        values.push(isSafe ? 1 : 0);
      }
      if (note !== undefined) {
        fields.push("note = ?");
        values.push(note);
      }
      if (fileName !== undefined) {
        fields.push("file_name = ?");
        values.push(fileName);
      }
      fields.push("updated_at = ?");
      values.push(now);
      values.push(id);

      await run(`UPDATE images SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    if (tags !== undefined) {
      const currentTagNames = await getImageTagsByImageId(id);
      const tagsToAdd = tags.filter((t) => !currentTagNames.includes(t));
      const tagsToRemove = currentTagNames.filter((t) => !tags.includes(t));
      const tagsChanged = tagsToAdd.length > 0 || tagsToRemove.length > 0;

      for (const tagName of tagsToRemove) {
        const tagRow = await get<{ id: number }>("SELECT id FROM image_tags WHERE name = ?", [
          tagName,
        ]);
        if (tagRow) {
          await run("DELETE FROM image_tag_relations WHERE image_id = ? AND tag_id = ?", [
            id,
            tagRow.id,
          ]);
        }
      }

      if (tagsToAdd.length > 0) {
        await addImageTags(id, tagsToAdd);
      }

      if (tagsChanged && !hasBasicFieldUpdate) {
        await run("UPDATE images SET updated_at = ? WHERE id = ?", [now, id]);
      }
    }

    if (prompts !== undefined) {
      const currentPromptRows = await all<{ prompt_id: string }>(
        "SELECT prompt_id FROM prompt_image_relations WHERE image_id = ?",
        [id],
      );
      const currentPromptIds = currentPromptRows.map((r) => r.prompt_id);
      const newPromptIds = prompts.map((p) => (typeof p === "string" ? p : p.id));

      const promptsToAdd = newPromptIds.filter((pid) => !currentPromptIds.includes(pid));
      const promptsToRemove = currentPromptIds.filter((pid) => !newPromptIds.includes(pid));
      const promptsChanged = promptsToAdd.length > 0 || promptsToRemove.length > 0;

      // 只删除需要移除的关联（增量更新）
      if (promptsToRemove.length > 0) {
        await run(
          `DELETE FROM prompt_image_relations WHERE image_id = ? AND prompt_id IN (${promptsToRemove.map(() => "?").join(",")})`,
          [id, ...promptsToRemove],
        );
      }

      // 只添加新增的关联
      if (promptsToAdd.length > 0) {
        await addImagePrompts(id, promptsToAdd);
      }

      if (promptsToAdd.length > 0) {
        await run(
          `UPDATE prompts SET updated_at = ? WHERE id IN (${promptsToAdd.map(() => "?").join(",")})`,
          [now, ...promptsToAdd],
        );
      }
      if (promptsToRemove.length > 0) {
        await run(
          `UPDATE prompts SET updated_at = ? WHERE id IN (${promptsToRemove.map(() => "?").join(",")})`,
          [now, ...promptsToRemove],
        );
      }

      if (promptsChanged && !hasBasicFieldUpdate) {
        await run("UPDATE images SET updated_at = ? WHERE id = ?", [now, id]);
      }
    }

    return getImageById(id);
  });
}

/**
 * 批量更新图像缩略图信息
 * 用于导入备份后批量更新缩略图路径
 * @param updates - 更新列表
 *
 * 注意：直接使用 db.prepare 而非封装的 run 函数，以利用 prepared statement 的性能优势。
 * 批量更新时，复用 prepared statement 可避免重复编译 SQL，显著提升性能。
 */
async function updateImagesBatch(updates: UpdateThumbnailParams[]): Promise<void> {
  if (!updates || updates.length === 0) {
    return;
  }

  return runInTransaction(async () => {
    const db = getDb();
    if (!db) {
      throw new Error("Database not initialized");
    }
    const stmt = db.prepare("UPDATE images SET thumbnail_path = ? WHERE id = ?");

    try {
      for (const update of updates) {
        await new Promise<void>((resolve, reject) => {
          stmt.run(update.thumbnailPath, update.id, (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } finally {
      // 确保预处理语句被释放（使用 Promise 包装以正确处理异步）
      await new Promise<void>((resolve, reject) => {
        stmt.finalize((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });
}

/**
 * 根据 MD5 查找图像（包含回收站中的图像）
 * @returns 图像信息，包含 isDeleted 字段标识是否在回收站中
 */
async function getImageByMD5IncludeTrash(
  md5: string,
): Promise<{ id: string; isDeleted: boolean } | null> {
  const row = await get<{ id: string; is_deleted: number }>(
    "SELECT id, is_deleted FROM images WHERE md5 = ?",
    [md5],
  );
  return row ? { id: row.id, isDeleted: row.is_deleted === 1 } : null;
}

/**
 * 添加图像
 */
async function addImage(image: CreateImageParams): Promise<Image | null> {
  const { id, fileName, storedName, relativePath, thumbnailPath, md5, width, height, fileSize } =
    image;

  const now = dbTime();

  await run(
    `INSERT INTO images (id, file_name, stored_name, relative_path, thumbnail_path, md5, width, height, file_size, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      fileName,
      storedName,
      relativePath,
      thumbnailPath,
      md5,
      width || null,
      height || null,
      fileSize || 0,
      now,
      now,
    ],
  );

  return getImageById(id);
}

/**
 * 软删除图像（移动到回收站）
 * 保留关联关系，仅标记删除状态
 */
async function softDeleteImage(id: string): Promise<boolean> {
  const now = dbTime();

  // 仅标记软删除，保留所有关联关系
  await run("UPDATE images SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ?", [
    now,
    now,
    id,
  ]);

  return true;
}

/**
 * 替换图像
 * 将旧图像软删除，并把旧图像的关联关系迁移到新图像
 * @param oldId - 被替换的图像ID
 * @param newId - 新图像ID
 * @returns 是否成功
 */
async function replaceImage(oldId: string, newId: string): Promise<boolean> {
  if (oldId === newId) return true;

  return runInTransaction(async () => {
    // 1. 软删除旧图像
    await softDeleteImage(oldId);

    // 2. 迁移提示词-图像关联关系
    await run(
      `UPDATE OR IGNORE prompt_image_relations
       SET image_id = ?
       WHERE image_id = ?`,
      [newId, oldId],
    );

    // 3. 迁移图像-标签关联关系
    await run(
      `UPDATE OR IGNORE image_tag_relations
       SET image_id = ?
       WHERE image_id = ?`,
      [newId, oldId],
    );

    // 4. 迁移元数据字段（收藏/备注/安全状态），保留用户手工设置
    await run(
      `UPDATE images
       SET note = (SELECT note FROM images WHERE id = ?),
           is_favorite = (SELECT is_favorite FROM images WHERE id = ?),
           is_safe = (SELECT is_safe FROM images WHERE id = ?)
       WHERE id = ?`,
      [oldId, oldId, oldId, newId],
    );

    // 5. 同步更新新图像和相关提示词的更新时间
    const now = dbTime();
    await run("UPDATE images SET updated_at = ? WHERE id = ?", [now, newId]);

    const relatedPromptRows = await all<{ prompt_id: string }>(
      "SELECT prompt_id FROM prompt_image_relations WHERE image_id = ?",
      [newId],
    );
    const relatedPromptIds = relatedPromptRows.map((row) => row.prompt_id);
    if (relatedPromptIds.length > 0) {
      const placeholders = relatedPromptIds.map(() => "?").join(",");
      await run(`UPDATE prompts SET updated_at = ? WHERE id IN (${placeholders})`, [
        now,
        ...relatedPromptIds,
      ]);
    }

    return true;
  });
}

/**
 * 批量软删除图像
 * 保留关联关系，仅标记删除状态
 * @param ids - 图像ID数组
 * @returns 删除结果
 */
async function softDeleteImages(ids: string[]): Promise<{ success: boolean; deleted: number }> {
  if (ids.length === 0) return { success: true, deleted: 0 };

  const now = dbTime();
  const placeholders = ids.map(() => "?").join(",");

  // 仅标记软删除，保留所有关联关系
  const result = await run(
    `UPDATE images SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id IN (${placeholders})`,
    [now, now, ...ids],
  );

  return { success: true, deleted: result.changes || 0 };
}

/**
 * 恢复已删除的图像
 */
async function restoreImage(id: string): Promise<Image | null> {
  const now = dbTime();
  await run("UPDATE images SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ?", [
    now,
    id,
  ]);
  return getImageById(id);
}

/**
 * 删除图像的物理文件
 * @param image - 图像对象
 * @param dataDir - 数据目录路径
 */
async function deleteImageFiles(image: ImageFilePaths, dataDir: string): Promise<void> {
  try {
    // 删除原图
    if (image.relative_path) {
      const imagePath = path.join(dataDir, image.relative_path);
      await fs.unlink(imagePath).catch(() => {});
    }
    // 删除缩略图
    if (image.thumbnail_path) {
      const thumbnailPath = path.join(dataDir, image.thumbnail_path);
      await fs.unlink(thumbnailPath).catch(() => {});
    }
  } catch (error: any) {
    logError("Database", "Failed to delete image file:", error);
  }
}

/**
 * 永久删除图像
 * @param id - 图像ID
 * @param dataDir - 数据目录路径
 */
async function permanentDeleteImage(id: string, dataDir: string): Promise<boolean> {
  // 1. 先获取图像信息以删除物理文件（只选择需要的字段）
  const image = await get<ImageFilePaths>(
    "SELECT relative_path, thumbnail_path FROM images WHERE id = ?",
    [id],
  );

  // 2. 删除关联关系与数据库记录（单事务，保证原子性）
  await runInTransaction(async () => {
    await run("DELETE FROM prompt_image_relations WHERE image_id = ?", [id]);
    await run("DELETE FROM images WHERE id = ?", [id]);
  });

  // 3. 事务提交后再删除物理文件（文件删除失败不影响已一致的数据库状态）
  if (image) {
    await deleteImageFiles(image, dataDir);
  }

  return true;
}

/**
 * 恢复所有已删除的图像
 */
async function restoreAllImages(): Promise<boolean> {
  const now = dbTime();
  await run(
    "UPDATE images SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE is_deleted = 1",
    [now],
  );
  return true;
}

/**
 * 获取回收站中的图像
 */
async function getDeletedImages(): Promise<Image[]> {
  // 先获取所有已删除的图像基本信息
  const imageSql = `
    SELECT i.*,
           (SELECT GROUP_CONCAT(it.name, char(31))
            FROM image_tag_relations itr
            JOIN image_tags it ON itr.tag_id = it.id
            WHERE itr.image_id = i.id) as image_tags
    FROM images i
    WHERE i.is_deleted = 1
    ORDER BY i.deleted_at DESC
  `;
  const rows = await all<ImageRow>(imageSql);

  if (rows.length === 0) return [];

  // 批量获取所有已删除图像的关联提示词信息，避免 N+1 查询
  const imageIds = rows.map((r) => r.id);
  const placeholders = imageIds.map(() => "?").join(",");
  const promptSql = `
    SELECT pir.image_id, p.id, p.title, p.content
    FROM prompt_image_relations pir
    JOIN prompts p ON pir.prompt_id = p.id
    WHERE pir.image_id IN (${placeholders}) AND p.is_deleted = 0
  `;
  const allPromptRows = await all<{ image_id: string; id: string; title: string; content: string }>(
    promptSql,
    imageIds,
  );

  // 按 image_id 分组提示词
  const promptsByImageId: Record<
    string,
    Array<{ id: string; title: string; content: string }>
  > = {};
  for (const row of allPromptRows) {
    if (!promptsByImageId[row.image_id]) {
      promptsByImageId[row.image_id] = [];
    }
    promptsByImageId[row.image_id].push({ id: row.id, title: row.title, content: row.content });
  }

  // 组装图像列表
  return rows.map((row) =>
    mapRowToImage(row, promptsByImageId[row.id] || [], { includeDeletedAt: true }),
  );
}

/**
 * 清空图像回收站
 * 删除所有软删除的图像记录和对应的物理文件
 * @param dataDir - 数据目录路径
 */
async function emptyImageTrash(dataDir: string): Promise<boolean> {
  // 1. 先收集待删除图像的文件路径（只选择文件路径相关字段）
  const deletedImages = await all<ImageFilePaths>(
    "SELECT relative_path, thumbnail_path FROM images WHERE is_deleted = 1",
  );

  if (deletedImages.length === 0) return true;

  // 2. 删除关联关系与数据库记录（单事务，保证原子性）
  await runInTransaction(async () => {
    await run(
      "DELETE FROM prompt_image_relations WHERE image_id IN (SELECT id FROM images WHERE is_deleted = 1)",
    );
    await run("DELETE FROM images WHERE is_deleted = 1");
  });

  // 3. 事务提交后再删除物理文件
  for (const image of deletedImages) {
    await deleteImageFiles(image, dataDir);
  }
  return true;
}

/**
 * 关联类型配置
 */
interface RelationConfig {
  /** 关联表名 */
  relationTable: string;
  /** 第一列名（如 prompt_id） */
  firstIdColumn: string;
  /** 第二列名（如 image_id） */
  secondIdColumn: string;
  /** 第一列对应的更新表（如 prompts） */
  firstUpdateTable: string;
  /** 第二列对应的更新表（如 images） */
  secondUpdateTable: string;
  /** 第一列ID的日志标签 */
  firstIdLabel: string;
  /** 第二列ID的日志标签 */
  secondIdLabel: string;
}

/**
 * 通用关联添加函数
 * 抽象 addPromptImages 和 addImagePrompts 的公共逻辑
 * @param firstId - 第一列ID（如 promptId 或 imageId）
 * @param secondIds - 第二列ID数组（如 imageIds 或 promptIds）
 * @param config - 关联配置
 * @param preserveOrder - 是否保留数组顺序
 */
async function addRelationsBatch(
  firstId: string,
  secondIds: string[],
  config: RelationConfig,
  preserveOrder = true,
): Promise<void> {
  if (secondIds.length === 0) return;

  const now = dbTime();

  await runInTransaction(async () => {
    const db = getDb();
    if (!db) {
      throw new Error("数据库未初始化");
    }

    // 使用预处理语句批量插入
    const insertStmt = db.prepare(
      `INSERT INTO ${config.relationTable} (${config.firstIdColumn}, ${config.secondIdColumn}, sort_order) VALUES (?, ?, ?)`,
    );

    try {
      for (let i = 0; i < secondIds.length; i++) {
        const secondId = secondIds[i];
        const sortOrder = preserveOrder ? i : 0;

        try {
          await new Promise<void>((resolve, reject) => {
            insertStmt.run([firstId, secondId, sortOrder], (err: Error | null) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (err: any) {
          if (isConstraintError(err)) {
            // 约束违反时跳过，继续处理其他记录
            logDebug("Database", `跳过关联添加: ${err.message}`, {
              [config.firstIdLabel]: firstId,
              [config.secondIdLabel]: secondId,
            });
            continue;
          }
          throw err;
        }
      }
    } finally {
      // 确保预处理语句被释放（使用 Promise 包装以正确处理异步）
      await new Promise<void>((resolve, reject) => {
        insertStmt.finalize((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // 批量更新第二列对应表的 updated_at
    if (secondIds.length > 0) {
      const placeholders = secondIds.map(() => "?").join(",");
      await run(
        `UPDATE ${config.secondUpdateTable} SET updated_at = ? WHERE id IN (${placeholders})`,
        [now, ...secondIds],
      );
    }

    // 更新第一列对应表的 updated_at
    await run(`UPDATE ${config.firstUpdateTable} SET updated_at = ? WHERE id = ?`, [now, firstId]);
  });
}

// 提示词-图像关联配置
const PROMPT_IMAGE_RELATION_CONFIG: RelationConfig = {
  relationTable: "prompt_image_relations",
  firstIdColumn: "prompt_id",
  secondIdColumn: "image_id",
  firstUpdateTable: "prompts",
  secondUpdateTable: "images",
  firstIdLabel: "promptId",
  secondIdLabel: "imageId",
};

// 图像-提示词关联配置
const IMAGE_PROMPT_RELATION_CONFIG: RelationConfig = {
  relationTable: "prompt_image_relations",
  firstIdColumn: "image_id",
  secondIdColumn: "prompt_id",
  firstUpdateTable: "images",
  secondUpdateTable: "prompts",
  firstIdLabel: "imageId",
  secondIdLabel: "promptId",
};

/**
 * 为提示词添加图像关联
 * @param promptId - 提示词ID
 * @param imageIds - 图像ID数组
 * @param preserveOrder - 是否保留数组顺序（默认true）
 *
 * 使用预处理语句批量插入，提升性能。
 * 当某个关联已存在（UNIQUE约束）或图像不存在（外键约束）时，
 * 可以跳过该记录而继续处理其他记录，而不是让整个批量操作失败。
 */
async function addPromptImages(
  promptId: string,
  imageIds: string[],
  preserveOrder = true,
): Promise<void> {
  return addRelationsBatch(promptId, imageIds, PROMPT_IMAGE_RELATION_CONFIG, preserveOrder);
}

/**
 * 为图像添加提示词关联
 * @param imageId - 图像ID
 * @param promptIds - 提示词ID数组
 * @param preserveOrder - 是否保留数组顺序（默认true）
 *
 * 使用预处理语句批量插入，提升性能。
 * 当某个关联已存在（UNIQUE约束）或提示词不存在（外键约束）时，
 * 可以跳过该记录而继续处理其他记录，而不是让整个批量操作失败。
 */
async function addImagePrompts(
  imageId: string,
  promptIds: string[],
  preserveOrder = true,
): Promise<void> {
  return addRelationsBatch(imageId, promptIds, IMAGE_PROMPT_RELATION_CONFIG, preserveOrder);
}

/**
 * 获取提示词关联的图像
 */
async function getPromptImages(promptId: string): Promise<PromptImage[]> {
  const sql = `
    SELECT i.*,
           (SELECT GROUP_CONCAT(it.name, char(31))
            FROM image_tag_relations itr
            JOIN image_tags it ON itr.tag_id = it.id
            WHERE itr.image_id = i.id) as image_tags
    FROM images i
    JOIN prompt_image_relations pir ON i.id = pir.image_id
    WHERE pir.prompt_id = ? AND i.is_deleted = 0
    ORDER BY pir.sort_order ASC
  `;
  const rows = await all<ImageRow>(sql, [promptId]);
  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    storedName: row.stored_name,
    relativePath: row.relative_path,
    thumbnailPath: row.thumbnail_path,
    width: row.width,
    height: row.height,
    isSafe: row.is_safe === 1 ? 1 : 0, // 严格限制为 0 或 1，其他值视为 0
    note: row.note,
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    tags: row.image_tags ? row.image_tags.split(TAG_SEPARATOR).filter((t) => t) : [],
    promptRefs: [{ promptId: promptId }],
  }));
}

// ==================== 图像标签管理 ====================


/**
 * 批量切换图像收藏状态
 * 每个图像的收藏状态会被切换（收藏->取消收藏，未收藏->收藏）
 * @param ids - 图像ID数组
 * @returns 更新结果
 */
async function batchFavoriteImages(ids: string[]): Promise<{ success: boolean; updated: number }> {
  if (ids.length === 0) return { success: true, updated: 0 };

  const now = dbTime();

  return runInTransaction(async () => {
    // 集合级切换收藏状态（已收藏→取消，未收藏→收藏）
    const placeholders = ids.map(() => "?").join(",");
    const result = await run(
      `UPDATE images SET is_favorite = 1 - is_favorite, updated_at = ? WHERE id IN (${placeholders})`,
      [now, ...ids],
    );

    return { success: true, updated: result.changes || 0 };
  });
}


export {
  getImages,
  getImagesPaginated,
  countImages,
  getImageIdsByFilter,
  countImageTags,
  countImageSpecialTags,
  getImagesByIds,
  getAllImages,
  getImageById,
  getImageByMD5IncludeTrash,
  addImage,
  replaceImage,
  softDeleteImage,
  softDeleteImages,
  restoreImage,
  permanentDeleteImage,
  restoreAllImages,
  getDeletedImages,
  emptyImageTrash,
  addPromptImages,
  addImagePrompts,
  getPromptImages,
  updateImage,
  updateImagesBatch,
  batchFavoriteImages,
};
