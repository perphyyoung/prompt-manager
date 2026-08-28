/**
 * 标签仓库
 * 提示词/图像标签与通用标签操作(重命名/关联/合并缓存)。原样迁自 database.ts, 逻辑未改动。
 */

import { run, get, all, runInTransaction, getDb } from "../sqlite/connection.js";
import { dbTime } from "../../../utils/index.js";
import { isConstraintError } from "../../database-errors.js";
import type { TagConfigMap } from "../../../shared/domain/database-types.js";
/**
 * 获取所有提示词标签
 */
async function getPromptTags(): Promise<string[]> {
  const rows = await all<{ name: string }>("SELECT name FROM prompt_tags ORDER BY name");
  return rows.map((row) => row.name);
}

/**
 * 添加提示词标签
 * @param name - 标签名称
 * @param groupId - 标签组ID（可选）
 * @returns 标签ID
 */
async function addPromptTag(name: string, groupId: number | null = null): Promise<number | null> {
  const now = dbTime();

  // 1. 先查询标签是否已存在
  const existingRow = await get<{ id: number; group_id: number | null }>(
    "SELECT id, group_id FROM prompt_tags WHERE name = ?",
    [name],
  );

  if (existingRow) {
    // 标签已存在，如果需要更新组ID
    if (groupId !== null && existingRow.group_id !== groupId) {
      await run("UPDATE prompt_tags SET group_id = ?, updated_at = ? WHERE name = ?", [
        groupId,
        now,
        name,
      ]);
    }
    return existingRow.id;
  }

  // 2. 创建新标签
  try {
    const result = await run(
      "INSERT INTO prompt_tags (name, group_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [name, groupId, now, now],
    );
    return result.id;
  } catch (err: any) {
    // 可能是并发导致，尝试查询获取ID
    if (isConstraintError(err)) {
      const row = await get<{ id: number }>("SELECT id FROM prompt_tags WHERE name = ?", [name]);
      if (row && groupId !== null) {
        await run("UPDATE prompt_tags SET group_id = ?, updated_at = ? WHERE name = ?", [
          groupId,
          now,
          name,
        ]);
      }
      return row ? row.id : null;
    }
    throw err;
  }
}

/**
 * 更新提示词标签的所属组
 * @param tagName - 标签名称
 * @param groupId - 标签组ID
 */
async function updatePromptTagGroupByTagName(
  tagName: string,
  groupId: number | null,
): Promise<void> {
  const now = dbTime();
  await run("UPDATE prompt_tags SET group_id = ?, updated_at = ? WHERE name = ?", [
    groupId,
    now,
    tagName,
  ]);
}

/**
 * 删除提示词标签
 * @param name - 标签名称
 */
async function deletePromptTag(name: string): Promise<void> {
  await run("DELETE FROM prompt_tags WHERE name = ?", [name]);
}

/**
 * 批量删除提示词标签
 * @param names - 标签名称数组
 * @returns 删除结果
 */
async function deletePromptTags(names: string[]): Promise<{ success: boolean; deleted: number }> {
  if (names.length === 0) return { success: true, deleted: 0 };

  const placeholders = names.map(() => "?").join(",");
  const sql = `DELETE FROM prompt_tags WHERE name IN (${placeholders})`;
  const result = await run(sql, names);

  return { success: true, deleted: result.changes || 0 };
}

/**
 * 标签配置定义
 */
const TagConfig: TagConfigMap = {
  prompt: {
    tagTable: "prompt_tags",
    relationTable: "prompt_tag_relations",
    itemIdColumn: "prompt_id",
    tagIdColumn: "tag_id",
    getTags: getPromptTags,
    groupTable: "prompt_tag_groups",
  },
  image: {
    tagTable: "image_tags",
    relationTable: "image_tag_relations",
    itemIdColumn: "image_id",
    tagIdColumn: "tag_id",
    getTags: getImageTags,
    groupTable: "image_tag_groups",
  },
};

/**
 * 检查标签组名称是否重复（配置驱动）
 * @param type - 标签类型: 'prompt' | 'image'
 * @param name - 标签组名称
 * @param excludeId - 排除的标签组ID（用于更新时检查）
 * @returns 存在返回记录，不存在返回null
 */
async function checkTagGroupNameDuplicate(
  type: keyof TagConfigMap,
  name: string,
  excludeId: number | null = null,
): Promise<{ id: number } | undefined> {
  const config = TagConfig[type];
  if (!config) {
    throw new Error(`Unknown tag type: ${type}`);
  }

  const { groupTable } = config;
  let sql = `SELECT id FROM ${groupTable} WHERE name = ?`;
  const params: any[] = [name];

  if (excludeId) {
    sql += ` AND id != ?`;
    params.push(excludeId);
  }

  return await get<{ id: number }>(sql, params);
}

/**
 * 通用标签重命名函数（配置驱动）
 * @param type - 标签类型: 'prompt' | 'image'
 * @param oldTag - 旧标签名
 * @param newTag - 新标签名
 * @returns 最新的标签列表
 */
async function renameTag(
  type: keyof TagConfigMap,
  oldTag: string,
  newTag: string,
): Promise<string[]> {
  const config = TagConfig[type];
  if (!config) {
    throw new Error(`Unknown tag type: ${type}`);
  }

  const { tagTable, relationTable, itemIdColumn, tagIdColumn, getTags } = config;

  // 获取旧标签的 ID
  const oldTagRow = await get<{ id: number }>(`SELECT id FROM ${tagTable} WHERE name = ?`, [
    oldTag,
  ]);
  if (!oldTagRow) {
    return await getTags();
  }

  // 检查新标签是否已存在
  const newTagRow = await get<{ id: number }>(`SELECT id FROM ${tagTable} WHERE name = ?`, [
    newTag,
  ]);

  if (newTagRow) {
    // 新标签已存在，将所有旧标签的关联迁移到新标签
    const relations = await all<{ [key: string]: string }>(
      `SELECT ${itemIdColumn} FROM ${relationTable} WHERE ${tagIdColumn} = ?`,
      [oldTagRow.id],
    );
    await runInTransaction(async () => {
      for (const rel of relations) {
        // OR IGNORE：目标项已有同款关联时跳过（合并语义）
        await run(
          `INSERT OR IGNORE INTO ${relationTable} (${itemIdColumn}, ${tagIdColumn}) VALUES (?, ?)`,
          [rel[itemIdColumn], newTagRow.id],
        );
      }
      // 删除旧标签
      await run(`DELETE FROM ${tagTable} WHERE id = ?`, [oldTagRow.id]);
    });
  } else {
    // 新标签不存在，直接重命名
    await run(`UPDATE ${tagTable} SET name = ? WHERE id = ?`, [newTag, oldTagRow.id]);
  }

  return await getTags();
}

/**
 * 有效的标签表名
 */
const VALID_TAG_TABLES = ["prompt_tags", "image_tags"] as const;
type ValidTagTable = (typeof VALID_TAG_TABLES)[number];

/**
 * 批量获取或创建标签
 * 先查询已存在的标签，只创建不存在的标签，避免不必要的 SQL 错误
 * 使用事务和预处理语句优化性能
 * @param tagTable - 标签表名
 * @param tagNames - 标签名称数组
 * @returns 标签名称到 ID 的映射
 */
async function getOrCreateTags(tagTable: string, tagNames: string[]): Promise<Map<string, number>> {
  // 验证表名，防止 SQL 注入
  if (!VALID_TAG_TABLES.includes(tagTable as ValidTagTable)) {
    throw new Error(`无效的表名: ${tagTable}`);
  }

  if (tagNames.length === 0) {
    return new Map();
  }

  const now = dbTime();
  const tagIdMap = new Map<string, number>();

  // 1. 查询已存在的标签
  const placeholders = tagNames.map(() => "?").join(",");
  const existingRows = await all<{ id: number; name: string }>(
    `SELECT id, name FROM ${tagTable} WHERE name IN (${placeholders})`,
    tagNames,
  );

  // 记录已存在的标签
  for (const row of existingRows) {
    tagIdMap.set(row.name, row.id);
  }

  // 2. 找出需要创建的标签
  const newTagNames = tagNames.filter((name) => !tagIdMap.has(name));

  if (newTagNames.length === 0) {
    return tagIdMap;
  }

  // 3. 使用事务批量创建新标签
  const db = getDb();
  if (!db) {
    throw new Error("数据库未初始化");
  }

  await runInTransaction(async () => {
    const insertStmt = db.prepare(
      `INSERT INTO ${tagTable} (name, group_id, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    );

    try {
      for (const name of newTagNames) {
        try {
          const result = await new Promise<{ lastID: number }>((resolve, reject) => {
            insertStmt.run(
              [name, null, now, now],
              function (this: { lastID: number }, err: Error | null) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID });
              },
            );
          });
          tagIdMap.set(name, result.lastID);
        } catch (err: any) {
          // 如果创建失败（可能是并发导致），记录下来稍后查询
          if (!isConstraintError(err)) {
            throw err;
          }
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
  });

  // 4. 查询那些因并发冲突而未能插入的标签 ID
  const missingTagNames = newTagNames.filter((name) => !tagIdMap.has(name));
  if (missingTagNames.length > 0) {
    const missingPlaceholders = missingTagNames.map(() => "?").join(",");
    const missingRows = await all<{ id: number; name: string }>(
      `SELECT id, name FROM ${tagTable} WHERE name IN (${missingPlaceholders})`,
      missingTagNames,
    );
    for (const row of missingRows) {
      tagIdMap.set(row.name, row.id);
    }
  }

  return tagIdMap;
}

/**
 * 为提示词添加标签
 */
async function addPromptTags(promptId: string, tagNames: string[]): Promise<void> {
  // 批量获取或创建标签
  const tagIdMap = await getOrCreateTags("prompt_tags", tagNames);

  // 批量添加关联
  for (const tagName of tagNames) {
    const tagId = tagIdMap.get(tagName);
    if (tagId) {
      try {
        await run("INSERT INTO prompt_tag_relations (prompt_id, tag_id) VALUES (?, ?)", [
          promptId,
          tagId,
        ]);
      } catch (err: any) {
        // 关联已存在，忽略错误
        if (!isConstraintError(err)) {
          throw err;
        }
      }
    }
  }

  // 更新提示词的 updated_at
  const now = dbTime();
  await run("UPDATE prompts SET updated_at = ? WHERE id = ?", [now, promptId]);
}

/**
 * 批量为多个提示词添加标签（集合操作，单事务），语义同 addImageTagsBatch
 * @param promptIds - 提示词 ID 数组
 * @param tagNames - 标签名数组
 */
async function addPromptTagsBatch(
  promptIds: string[],
  tagNames: string[],
): Promise<{ success: boolean; added: number }> {
  if (promptIds.length === 0 || tagNames.length === 0) return { success: true, added: 0 };

  return runInTransaction(async () => {
    const tagIdMap = await getOrCreateTags("prompt_tags", tagNames);
    let added = 0;

    const placeholders = promptIds.map(() => "?").join(",");
    for (const [, tagId] of tagIdMap) {
      const result = await run(
        `INSERT OR IGNORE INTO prompt_tag_relations (prompt_id, tag_id)
         SELECT id, ? FROM prompts WHERE id IN (${placeholders})`,
        [tagId, ...promptIds],
      );
      added += result.changes || 0;
    }

    if (added > 0) {
      const now = dbTime();
      await run(`UPDATE prompts SET updated_at = ? WHERE id IN (${placeholders})`, [
        now,
        ...promptIds,
      ]);
    }

    return { success: true, added };
  });
}

/**
 * 获取使用指定标签的提示词列表
 * @param tagName - 标签名称
 * @returns 提示词ID列表
 */
async function getPromptsByTag(tagName: string): Promise<string[]> {
  const sql = `
    SELECT DISTINCT p.id
    FROM prompts p
    JOIN prompt_tag_relations ptr ON p.id = ptr.prompt_id
    JOIN prompt_tags pt ON ptr.tag_id = pt.id
    WHERE pt.name = ? AND p.is_deleted = 0
  `;

  const rows = await all<{ id: string }>(sql, [tagName]);
  return rows.map((row) => row.id);
}

/**
 * 获取使用指定标签的图像列表
 * @param tagName - 标签名称
 * @returns 图像ID列表
 */
async function getImagesByTag(tagName: string): Promise<string[]> {
  const sql = `
    SELECT DISTINCT i.id
    FROM images i
    JOIN image_tag_relations itr ON i.id = itr.image_id
    JOIN image_tags it ON itr.tag_id = it.id
    WHERE it.name = ? AND i.is_deleted = 0
  `;

  const rows = await all<{ id: string }>(sql, [tagName]);
  return rows.map((row) => row.id);
}

/**
 * 从提示词中移除标签
 * @param promptId - 提示词ID
 * @param tagName - 标签名称
 */
async function removeTagFromPrompt(promptId: string, tagName: string): Promise<void> {
  // 获取标签ID
  const tagRow = await get<{ id: number }>("SELECT id FROM prompt_tags WHERE name = ?", [tagName]);

  if (tagRow) {
    await run("DELETE FROM prompt_tag_relations WHERE prompt_id = ? AND tag_id = ?", [
      promptId,
      tagRow.id,
    ]);

    // 更新提示词的 updated_at 字段
    const now = dbTime();
    await run("UPDATE prompts SET updated_at = ? WHERE id = ?", [now, promptId]);
  }
}

/**
 * 从图像中移除标签
 * @param imageId - 图像ID
 * @param tagName - 标签名称
 */
async function removeTagFromImage(imageId: string, tagName: string): Promise<void> {
  // 获取标签ID
  const tagRow = await get<{ id: number }>("SELECT id FROM image_tags WHERE name = ?", [tagName]);

  if (tagRow) {
    await run("DELETE FROM image_tag_relations WHERE image_id = ? AND tag_id = ?", [
      imageId,
      tagRow.id,
    ]);

    // 更新图像的 updated_at 字段
    const now = dbTime();
    await run("UPDATE images SET updated_at = ? WHERE id = ?", [now, imageId]);
  }
}

// ==================== 图像操作 ====================

/**
 * 获取所有图像标签
 */
async function getImageTags(): Promise<string[]> {
  const sql = "SELECT name FROM image_tags ORDER BY name";
  const rows = await all<{ name: string }>(sql);
  return rows.map((row) => row.name);
}

/**
 * 添加图像标签
 * @param name - 标签名称
 * @param groupId - 标签组ID（可选）
 */
async function addImageTag(name: string, groupId: number | null = null): Promise<void> {
  const now = dbTime();

  // 1. 先查询标签是否已存在
  const existingRow = await get<{ id: number; group_id: number | null }>(
    "SELECT id, group_id FROM image_tags WHERE name = ?",
    [name],
  );

  if (existingRow) {
    // 标签已存在，如果需要更新组ID
    if (groupId !== null && existingRow.group_id !== groupId) {
      await run("UPDATE image_tags SET group_id = ?, updated_at = ? WHERE name = ?", [
        groupId,
        now,
        name,
      ]);
    }
    return;
  }

  // 2. 创建新标签
  try {
    await run(
      "INSERT INTO image_tags (name, group_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [name, groupId, now, now],
    );
  } catch (err: any) {
    // 可能是并发导致，尝试更新组ID
    if (isConstraintError(err)) {
      if (groupId !== null) {
        await run("UPDATE image_tags SET group_id = ?, updated_at = ? WHERE name = ?", [
          groupId,
          now,
          name,
        ]);
      }
    } else {
      throw err;
    }
  }
}

/**
 * 为图像添加多个标签
 */
async function addImageTags(imageId: string, tagNames: string[]): Promise<void> {
  // 批量获取或创建标签
  const tagIdMap = await getOrCreateTags("image_tags", tagNames);

  // 批量添加关联
  for (const tagName of tagNames) {
    const tagId = tagIdMap.get(tagName);
    if (tagId) {
      try {
        await run("INSERT INTO image_tag_relations (image_id, tag_id) VALUES (?, ?)", [
          imageId,
          tagId,
        ]);
      } catch (err: any) {
        // 关联已存在，忽略错误
        if (!isConstraintError(err)) {
          throw err;
        }
      }
    }
  }

  // 更新图像的 updated_at
  const now = dbTime();
  await run("UPDATE images SET updated_at = ? WHERE id = ?", [now, imageId]);
}

/**
 * 批量为多张图像添加标签（集合操作，单事务）
 * 每个标签一条 INSERT...SELECT（仅关联真实存在的图像，OR IGNORE 去重已有关联），
 * 避免 N 张图像 × M 个标签的逐条 IPC/SQL 循环
 * @param imageIds - 图像 ID 数组
 * @param tagNames - 标签名数组
 */
async function addImageTagsBatch(
  imageIds: string[],
  tagNames: string[],
): Promise<{ success: boolean; added: number }> {
  if (imageIds.length === 0 || tagNames.length === 0) return { success: true, added: 0 };

  return runInTransaction(async () => {
    const tagIdMap = await getOrCreateTags("image_tags", tagNames);
    let added = 0;

    const placeholders = imageIds.map(() => "?").join(",");
    for (const [, tagId] of tagIdMap) {
      const result = await run(
        `INSERT OR IGNORE INTO image_tag_relations (image_id, tag_id)
         SELECT id, ? FROM images WHERE id IN (${placeholders})`,
        [tagId, ...imageIds],
      );
      added += result.changes || 0;
    }

    if (added > 0) {
      const now = dbTime();
      await run(`UPDATE images SET updated_at = ? WHERE id IN (${placeholders})`, [
        now,
        ...imageIds,
      ]);
    }

    return { success: true, added };
  });
}

/**
 * 删除图像标签及其全部关联（集合级 SQL，单事务）
 * 替代早期"全量加载图像 + 逐张 updateImage 移除标签"的 N+1 写放大实现
 * @param name - 标签名称
 */
async function deleteImageTag(name: string): Promise<void> {
  await runInTransaction(async () => {
    await run(
      "DELETE FROM image_tag_relations WHERE tag_id IN (SELECT id FROM image_tags WHERE name = ?)",
      [name],
    );
    await run("DELETE FROM image_tags WHERE name = ?", [name]);
  });
}

/**
 * 批量删除图像标签及其全部关联（集合级 SQL，单事务）
 * @param names - 标签名称数组
 * @returns 删除结果（deleted 为删除的标签数）
 */
async function deleteImageTags(names: string[]): Promise<{ success: boolean; deleted: number }> {
  if (names.length === 0) return { success: true, deleted: 0 };

  const placeholders = names.map(() => "?").join(",");
  const result = await runInTransaction(async () => {
    await run(
      `DELETE FROM image_tag_relations WHERE tag_id IN (SELECT id FROM image_tags WHERE name IN (${placeholders}))`,
      names,
    );
    return await run(`DELETE FROM image_tags WHERE name IN (${placeholders})`, names);
  });

  return { success: true, deleted: result.changes || 0 };
}

/**
 * 分配图像标签到所属组
 * @param tagName - 标签名称
 * @param groupId - 标签组ID
 */
async function assignImageTagToBelongGroup(tagName: string, groupId: number | null): Promise<void> {
  const now = dbTime();
  await run("UPDATE image_tags SET group_id = ?, updated_at = ? WHERE name = ?", [
    groupId,
    now,
    tagName,
  ]);
}

/**
 * 获取图像的标签
 */
async function getImageTagsByImageId(imageId: string): Promise<string[]> {
  const sql = `
    SELECT it.name
    FROM image_tags it
    JOIN image_tag_relations itr ON it.id = itr.tag_id
    WHERE itr.image_id = ?
    ORDER BY it.name
  `;
  const rows = await all<{ name: string }>(sql, [imageId]);
  return rows.map((row) => row.name);
}

// ==================== 共享标签 ====================

/**
 * 获取所有标签（提示词标签和图像标签合并）
 * 用于自动完成功能
 * @returns 合并后的标签列表
 */
async function getAllTags(): Promise<string[]> {
  const sql = `
    SELECT name FROM prompt_tags
    UNION
    SELECT name FROM image_tags
    ORDER BY name
  `;
  const rows = await all<{ name: string }>(sql);
  return rows.map((row) => row.name);
}

// ==================== 统计数据 ====================

/**
 * 获取统计数据汇总（SQL 聚合计数，避免全量拉表经 IPC 到渲染进程）
 * 语义与原前端计数对齐：
 *   favorite = 已收藏且未删除；promptsWithImages = 有未删除关联图像的活跃提示词；
 *   referencedImages = 关联到未删除提示词的活跃图像
 * @param isSafeOnly - 是否只统计安全模式（is_safe = 1）的项目
 */

export {
  getPromptTags,
  addPromptTag,
  updatePromptTagGroupByTagName,
  deletePromptTag,
  deletePromptTags,
  checkTagGroupNameDuplicate,
  renameTag,
  addPromptTags,
  addPromptTagsBatch,
  getPromptsByTag,
  getImagesByTag,
  removeTagFromPrompt,
  removeTagFromImage,
  getImageTags,
  addImageTag,
  addImageTags,
  addImageTagsBatch,
  deleteImageTag,
  deleteImageTags,
  assignImageTagToBelongGroup,
  getImageTagsByImageId,
  getAllTags,
};
