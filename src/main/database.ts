/**
 * 数据库模块 - SQLite
 * 管理提示词、图像和它们之间的关系
 */

// @ts-ignore - sqlite3 类型定义不完整
import sqlite3 from 'sqlite3';
import path from 'path';
import { promises as fs } from 'fs';
import { logError, logWarn, logDebug } from './logger.js';
import { getFormattedLocalTimeToSecond, dbTime, formatDbTimeToLocal } from '../utils/index.js';
import {
  DatabaseError,
  DatabaseErrorCode,
  DuplicateNameError,
  ConstraintViolationError,
  isConstraintError
} from './database-errors.ts';
import type {
  PromptRow, ImageRow, PromptTagGroupRow, ImageTagGroupRow,
  Prompt, Image, ImageRef, PromptImage,
  PromptTagGroup, ImageTagGroup,
  TagConfig, TagConfigMap,
  CreatePromptParams, UpdatePromptParams,
  CreateImageParams, UpdateImageParams, UpdateThumbnailParams,
  UpdateTagGroupParams,
  MapPromptOptions, MapImageOptions, GetImagesOptions,
  GetImagesPaginatedOptions, PaginatedImagesResult, CountImageTagsOptions, ImageSpecialTagCounts,
  RunResult, TagSyncResult, Statistics, UnreferencedImage,
  ImageFilePaths, ImageCleanupInfo
} from './database-types.js';

sqlite3.verbose();

let db: sqlite3.Database | null = null;

/**
 * 初始化数据库
 * @param dataDir - 数据目录路径
 */
async function initDatabase(dataDir: string): Promise<void> {
  // 确保数据目录存在
  try {
    const stats = await fs.stat(dataDir);
    if (!stats.isDirectory()) {
      // 如果路径存在但不是目录，删除它
      await fs.unlink(dataDir);
      await fs.mkdir(dataDir, { recursive: true });
    }
  } catch {
    // 目录不存在，创建它
    await fs.mkdir(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'prompt-manager.db');

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err: Error | null) => {
      if (err) {
        logError('Database', 'Failed to open database', { error: err.message });
        reject(err);
        return;
      }

      createTables().then(resolve).catch(reject);
    });
  });
}

/**
 * 关闭数据库连接
 */
function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err: Error | null) => {
        if (err) {
          logError('Database', 'Failed to close database', { error: err.message });
          reject(err);
          return;
        }
        db = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * 创建数据库表
 */
async function createTables(): Promise<void> {
  const tables = [
    // 提示词表
    `CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      content_translate TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0,
      deleted_at DATETIME,
      is_favorite INTEGER DEFAULT 0,
      is_safe INTEGER DEFAULT 1,
      note TEXT DEFAULT ''
    )`,

    // 图像表
    `CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      thumbnail_path TEXT,
      md5 TEXT UNIQUE,
      width INTEGER,
      height INTEGER,
      file_size INTEGER DEFAULT 0,
      gen_params TEXT DEFAULT '{}',  -- JSON格式存储生成参数
      is_deleted INTEGER DEFAULT 0,
      deleted_at DATETIME,
      is_favorite INTEGER DEFAULT 0,
      is_safe INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      note TEXT DEFAULT ''
    )`,

    // 提示词标签组表
    `CREATE TABLE IF NOT EXISTS prompt_tag_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // 提示词标签表
    `CREATE TABLE IF NOT EXISTS prompt_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      group_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES prompt_tag_groups(id) ON DELETE SET NULL
    )`,

    // 提示词-标签关联表
    `CREATE TABLE IF NOT EXISTS prompt_tag_relations (
      prompt_id TEXT,
      tag_id INTEGER,
      PRIMARY KEY (prompt_id, tag_id),
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES prompt_tags(id) ON DELETE CASCADE
    )`,

    // 提示词-图像关联表
    `CREATE TABLE IF NOT EXISTS prompt_image_relations (
      prompt_id TEXT,
      image_id TEXT,
      sort_order INTEGER DEFAULT 0,
      PRIMARY KEY (prompt_id, image_id),
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
    )`,

    // 图像标签组表
    `CREATE TABLE IF NOT EXISTS image_tag_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // 图像标签表
    `CREATE TABLE IF NOT EXISTS image_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      group_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES image_tag_groups(id) ON DELETE SET NULL
    )`,

    // 图像-标签关联表
    `CREATE TABLE IF NOT EXISTS image_tag_relations (
      image_id TEXT,
      tag_id INTEGER,
      PRIMARY KEY (image_id, tag_id),
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES image_tags(id) ON DELETE CASCADE
    )`
  ];

  for (const sql of tables) {
    await run(sql);
  }

  // 创建数据库版本表（用于未来可能的迁移）
  await run(`CREATE TABLE IF NOT EXISTS db_version (
    version INTEGER PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 执行数据库迁移
  await runMigrations();

  // 创建索引以优化查询性能
  await createIndexes();

  // 配置 PRAGMA 以优化性能
  await configurePragmas();
}

/**
 * 获取当前数据库版本
 * @returns 当前版本号，无记录返回 0
 */
async function getDbVersion(): Promise<number> {
  try {
    const result = await get<{ version: number }>('SELECT version FROM db_version ORDER BY version DESC LIMIT 1');
    return result?.version || 0;
  } catch {
    return 0;
  }
}

/**
 * 设置数据库版本
 * @param version - 版本号
 */
async function setDbVersion(version: number): Promise<void> {
  await run(
    'INSERT OR REPLACE INTO db_version (version, applied_at) VALUES (?, ?)',
    [version, dbTime()]
  );
}

/**
 * 将旧版本本地时间格式转换为 ISO 8601
 * @param localTimeStr - 本地时间字符串，如 "2026/3/20 20:34:56"
 * @returns ISO 8601 字符串，转换失败返回原字符串
 */
function localTimeToIso(localTimeStr: string): string {
  const timestamp = new Date(localTimeStr).getTime();
  if (isNaN(timestamp)) return localTimeStr;
  return new Date(timestamp).toISOString();
}

/**
 * 迁移日期格式：把本地格式转换为 ISO 8601，使 SQL 排序正确
 */
async function migrateDateFormats(): Promise<void> {
  logDebug('Database', 'Migrating date formats to ISO 8601');

  const tables = [
    { table: 'prompts', columns: ['created_at', 'updated_at', 'deleted_at'], idColumn: 'id' },
    { table: 'images', columns: ['created_at', 'updated_at', 'deleted_at'], idColumn: 'id' },
    { table: 'prompt_tags', columns: ['created_at', 'updated_at'], idColumn: 'id' },
    { table: 'image_tags', columns: ['created_at', 'updated_at'], idColumn: 'id' },
    { table: 'prompt_tag_groups', columns: ['created_at', 'updated_at'], idColumn: 'id' },
    { table: 'image_tag_groups', columns: ['created_at', 'updated_at'], idColumn: 'id' }
  ];

  for (const { table, columns, idColumn } of tables) {
    for (const column of columns) {
      const rows = await all<{ [key: string]: string | number | null }>(
        `SELECT ${idColumn} as id, ${column} as value FROM ${table} WHERE ${column} IS NOT NULL AND ${column} LIKE '%/%'`
      );

      for (const row of rows) {
        const localValue = row.value as string;
        const isoValue = localTimeToIso(localValue);
        if (isoValue !== localValue) {
          await run(`UPDATE ${table} SET ${column} = ? WHERE ${idColumn} = ?`, [isoValue, row.id]);
        }
      }
    }
  }

  logDebug('Database', 'Date format migration completed');
}

/**
 * 执行数据库迁移
 */
async function runMigrations(): Promise<void> {
  const version = await getDbVersion();

  if (version < 1) {
    await migrateDateFormats();
    await setDbVersion(1);
  }
}

/**
 * 配置数据库 PRAGMA
 * 优化缓存、并发和 I/O 性能
 */
async function configurePragmas(): Promise<void> {
  const pragmas = [
    { name: 'journal_mode', value: 'WAL' },           // 写前日志模式，提升并发性能
    { name: 'synchronous', value: 'NORMAL' },         // 平衡安全与性能
    { name: 'cache_size', value: '-64000' },          // 64MB 缓存（负值表示 KB）
    { name: 'foreign_keys', value: 'ON' },            // 启用外键约束
    { name: 'temp_store', value: 'MEMORY' },          // 临时表存内存
    { name: 'mmap_size', value: '268435456' }         // 256MB 内存映射
  ];

  for (const { name, value } of pragmas) {
    try {
      await run(`PRAGMA ${name} = ${value}`);
    } catch (error: any) {
      console.warn(`Failed to set PRAGMA ${name}:`, error.message);
    }
  }
}

/**
 * 创建数据库索引
 * 优化常用查询的性能
 */
async function createIndexes(): Promise<void> {
  const indexes = [
    // 提示词表索引
    'CREATE INDEX IF NOT EXISTS idx_prompts_updated_at ON prompts(updated_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_prompts_is_deleted ON prompts(is_deleted)',
    'CREATE INDEX IF NOT EXISTS idx_prompts_is_favorite ON prompts(is_favorite)',
    'CREATE INDEX IF NOT EXISTS idx_prompts_is_safe ON prompts(is_safe)',
    // 复合索引：常用查询模式
    'CREATE INDEX IF NOT EXISTS idx_prompts_deleted_updated ON prompts(is_deleted, updated_at DESC)',

    // 图像表索引
    'CREATE INDEX IF NOT EXISTS idx_images_updated_at ON images(updated_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_images_is_deleted ON images(is_deleted)',
    'CREATE INDEX IF NOT EXISTS idx_images_is_favorite ON images(is_favorite)',
    'CREATE INDEX IF NOT EXISTS idx_images_is_safe ON images(is_safe)',
    'CREATE INDEX IF NOT EXISTS idx_images_md5 ON images(md5)',
    // 复合索引
    'CREATE INDEX IF NOT EXISTS idx_images_deleted_updated ON images(is_deleted, updated_at DESC)',

    // 关联表索引 - 优化 JOIN 查询
    'CREATE INDEX IF NOT EXISTS idx_prompt_image_relations_prompt_id ON prompt_image_relations(prompt_id)',
    'CREATE INDEX IF NOT EXISTS idx_prompt_image_relations_image_id ON prompt_image_relations(image_id)',
    'CREATE INDEX IF NOT EXISTS idx_prompt_tag_relations_prompt_id ON prompt_tag_relations(prompt_id)',
    'CREATE INDEX IF NOT EXISTS idx_prompt_tag_relations_tag_id ON prompt_tag_relations(tag_id)',
    'CREATE INDEX IF NOT EXISTS idx_image_tag_relations_image_id ON image_tag_relations(image_id)',
    'CREATE INDEX IF NOT EXISTS idx_image_tag_relations_tag_id ON image_tag_relations(tag_id)',

    // 标签组索引 - 优化标签组查询
    'CREATE INDEX IF NOT EXISTS idx_prompt_tags_group_id ON prompt_tags(group_id)',
    'CREATE INDEX IF NOT EXISTS idx_image_tags_group_id ON image_tags(group_id)',

    // 部分索引 - 只索引活跃数据，更小更快
    'CREATE INDEX IF NOT EXISTS idx_prompts_active_updated ON prompts(updated_at DESC) WHERE is_deleted = 0',
    'CREATE INDEX IF NOT EXISTS idx_images_active_updated ON images(updated_at DESC) WHERE is_deleted = 0',
    'CREATE INDEX IF NOT EXISTS idx_prompts_active_favorite ON prompts(updated_at DESC) WHERE is_deleted = 0 AND is_favorite = 1',
    'CREATE INDEX IF NOT EXISTS idx_images_active_favorite ON images(updated_at DESC) WHERE is_deleted = 0 AND is_favorite = 1'
  ];

  for (const sql of indexes) {
    try {
      await run(sql);
    } catch (error: any) {
      console.error('Failed to create index:', sql, error);
    }
  }
}

// 事务状态跟踪
let transactionDepth = 0;

/**
 * 在事务中执行异步操作
 * 支持嵌套调用（如果已经在事务中，直接执行函数而不开始新事务）
 * @param asyncFn - 异步函数
 * @returns 函数返回值
 *
 * 注意：嵌套事务采用扁平化策略
 * - 当 transactionDepth > 0 时，内部操作不开启新事务，直接执行
 * - 内部操作失败会抛出错误，由最外层事务统一回滚
 * - 这确保了事务的原子性，但要求调用方理解：内部操作失败会导致整个事务回滚
 */
async function runInTransaction<T>(asyncFn: () => Promise<T>): Promise<T> {
  // 如果已经在事务中，直接执行函数（扁平化事务策略）
  if (transactionDepth > 0) {
    return await asyncFn();
  }

  transactionDepth++;
  await run('BEGIN TRANSACTION');
  try {
    const result = await asyncFn();
    await run('COMMIT');
    return result;
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  } finally {
    transactionDepth--;
  }
}

/**
 * 数据库维护优化
 * 定期执行 VACUUM 和 ANALYZE
 */
async function optimizeDatabase(): Promise<boolean> {
  console.log('[DB] Starting optimization...');

  try {
    // 回收空间
    await run('VACUUM');
    console.log('[DB] VACUUM completed');

    // 更新统计信息
    await run('ANALYZE');
    console.log('[DB] ANALYZE completed');

    // 完整性检查
    const result = await get<{ integrity_check: string }>('PRAGMA integrity_check');
    if (result && result.integrity_check !== 'ok') {
      console.error('[DB] Integrity check failed:', result);
    } else {
      console.log('[DB] Integrity check passed');
    }

    console.log('[DB] Optimization completed');
    return true;
  } catch (error: any) {
    console.error('[DB] Optimization failed:', error);
    throw error;
  }
}

/**
 * 数据库配置
 * 可通过环境变量或运行时修改
 */
const DB_CONFIG = {
  /**
   * 慢查询阈值（毫秒）
   * 超过此时间的查询会被记录为警告
   */
  get SLOW_QUERY_THRESHOLD_MS(): number {
    // 允许通过环境变量覆盖
    const envValue = process.env.DB_SLOW_QUERY_THRESHOLD;
    if (envValue) {
      const parsed = parseInt(envValue, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return 100; // 默认值
  }
};

/**
 * 解析 SQLite 错误，转换为统一的 DatabaseError
 */
function parseSQLiteError(err: Error, sql?: string, params?: any[]): DatabaseError {
  const message = err.message;

  // 唯一约束违反
  if (message.includes('UNIQUE constraint failed')) {
    // 提取表名和字段名（支持带引号的标识符，如 "my-table"."my-column"）
    const match = message.match(/UNIQUE constraint failed:\s*"?([^"\s.]+)"?\."?([^"\s.]+)"?/);
    const details = match ? `表 ${match[1]} 的 ${match[2]} 字段` : '';
    return new ConstraintViolationError(
      details ? `唯一约束违反: ${details} 的值已存在` : message,
      'UNIQUE',
      err
    );
  }

  // 外键约束违反
  if (message.includes('FOREIGN KEY constraint failed')) {
    return new ConstraintViolationError(
      '外键约束违反: 引用的记录不存在',
      'FOREIGN_KEY',
      err
    );
  }

  // 检查约束违反
  if (message.includes('CHECK constraint failed')) {
    return new ConstraintViolationError(
      '检查约束违反: 数据不符合约束条件',
      'CHECK',
      err
    );
  }

  // 非空约束违反
  if (message.includes('NOT NULL constraint failed')) {
    // 提取表名和字段名（支持带引号的标识符）
    const match = message.match(/NOT NULL constraint failed:\s*"?([^"\s.]+)"?\."?([^"\s.]+)"?/);
    const details = match ? `表 ${match[1]} 的 ${match[2]} 字段` : '';
    return new ConstraintViolationError(
      details ? `非空约束违反: ${details} 不能为空` : message,
      'NOT_NULL',
      err
    );
  }

  // 通用 SQL 错误
  return new DatabaseError(
    `数据库操作失败: ${message}`,
    DatabaseErrorCode.SQL_ERROR,
    err,
    { sql: sql?.substring(0, 200), params }
  );
}

/**
 * 执行 SQL 语句
 */
function run(sql: string, params: any[] = []): Promise<RunResult> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new DatabaseError(
        '数据库未初始化',
        DatabaseErrorCode.DB_NOT_INITIALIZED
      ));
      return;
    }
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      const duration = Date.now() - startTime;
      if (duration > DB_CONFIG.SLOW_QUERY_THRESHOLD_MS) {
        logWarn('Database', `慢查询 (${duration}ms)`, { sql: sql.substring(0, 100) });
      }
      if (err) {
        logError('Database', `SQL 执行失败: ${sql.substring(0, 100)}`, err);
        reject(parseSQLiteError(err, sql, params));
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

/**
 * 查询单条记录
 */
function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new DatabaseError(
        '数据库未初始化',
        DatabaseErrorCode.DB_NOT_INITIALIZED
      ));
      return;
    }
    db.get(sql, params, (err: Error | null, row: T) => {
      const duration = Date.now() - startTime;
      if (duration > DB_CONFIG.SLOW_QUERY_THRESHOLD_MS) {
        logWarn('Database', `慢查询 (${duration}ms)`, { sql: sql.substring(0, 100) });
      }
      if (err) {
        logError('Database', `SQL 查询失败: ${sql.substring(0, 100)}`, err);
        reject(parseSQLiteError(err, sql, params));
      } else {
        resolve(row);
      }
    });
  });
}

/**
 * 查询多条记录
 */
function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new DatabaseError(
        '数据库未初始化',
        DatabaseErrorCode.DB_NOT_INITIALIZED
      ));
      return;
    }
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      const duration = Date.now() - startTime;
      if (duration > DB_CONFIG.SLOW_QUERY_THRESHOLD_MS) {
        logWarn('Database', `慢查询 (${duration}ms)`, { sql: sql.substring(0, 100) });
      }
      if (err) {
        logError('Database', `SQL 查询失败: ${sql.substring(0, 100)}`, err);
        reject(parseSQLiteError(err, sql, params));
      } else {
        resolve(rows);
      }
    });
  });
}

// ==================== Tag Group 操作 ====================

/**
 * 创建提示词标签组
 * @param name - 标签组名称
 * @param sortOrder - 排序顺序
 */
async function createPromptTagGroup(name: string, sortOrder = 0): Promise<PromptTagGroup> {
  const existing = await checkTagGroupNameDuplicate('prompt', name);
  if (existing) {
    throw new DuplicateNameError('提示词标签组', name);
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
      throw new DuplicateNameError('提示词标签组', name);
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
  return groups.map(group => ({
    ...group,
    tags: tags
      .filter(t => t.groupId === group.id)
      .map(t => t.name)
  }));
}

// 有效的提示词标签组字段白名单
const VALID_PROMPT_TAG_GROUP_FIELDS: Record<string, string> = {
  name: 'name = ?',
  sortOrder: 'sort_order = ?'
};

/**
 * 更新提示词标签组
 * @param id - 标签组 ID
 * @param updates - 更新内容
 */
async function updatePromptTagGroup(id: number, updates: UpdateTagGroupParams): Promise<PromptTagGroupRow | undefined> {
  const { name, sortOrder } = updates;
  const now = dbTime();

  if (name !== undefined) {
    const existing = await checkTagGroupNameDuplicate('prompt', name, id);
    if (existing) {
      throw new DuplicateNameError('提示词标签组', name);
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

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const sql = `UPDATE prompt_tag_groups SET ${fields.join(', ')} WHERE id = ?`;
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
  const sql = 'DELETE FROM prompt_tag_groups WHERE id = ?';
  await run(sql, [id]);
  return true;
}

/**
 * 创建图像标签组
 * @param name - 标签组名称
 * @param sortOrder - 排序顺序
 */
async function createImageTagGroup(name: string, sortOrder = 0): Promise<ImageTagGroup> {
  const existing = await checkTagGroupNameDuplicate('image', name);
  if (existing) {
    throw new DuplicateNameError('图像标签组', name);
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
      throw new DuplicateNameError('图像标签组', name);
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
  return groups.map(group => ({
    ...group,
    tags: tags
      .filter(t => t.groupId === group.id)
      .map(t => t.name)
  }));
}

// 有效的图像标签组字段白名单
const VALID_IMAGE_TAG_GROUP_FIELDS: Record<string, string> = {
  name: 'name = ?',
  sortOrder: 'sort_order = ?'
};

/**
 * 更新图像标签组
 * @param id - 标签组 ID
 * @param updates - 更新内容
 */
async function updateImageTagGroup(id: number, updates: UpdateTagGroupParams): Promise<ImageTagGroupRow | undefined> {
  const { name, sortOrder } = updates;
  const now = dbTime();

  if (name !== undefined) {
    const existing = await checkTagGroupNameDuplicate('image', name, id);
    if (existing) {
      throw new DuplicateNameError('图像标签组', name);
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

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const sql = `UPDATE image_tag_groups SET ${fields.join(', ')} WHERE id = ?`;
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
  const sql = 'DELETE FROM image_tag_groups WHERE id = ?';
  await run(sql, [id]);
  return true;
}

// ==================== Prompt 操作 ====================

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
    isSafe: row.is_safe === 1 ? 1 : 0,  // 严格限制为 0 或 1，其他值视为 0
    isDeleted: row.is_deleted === 1,
    note: row.note,
    tags: row.tags ? row.tags.split(',').filter(t => t) : []
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
async function getPromptsWithImages(promptRows: PromptRow[], options: MapPromptOptions = {}): Promise<Prompt[]> {
  if (promptRows.length === 0) return [];

  const promptIds = promptRows.map(r => r.id);
  const placeholders = promptIds.map(() => '?').join(',');

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

  return promptRows.map(row => {
    const prompt = mapRowToPrompt(row, options);
    const rowIdStr = String(row.id);
    prompt.images = imagesByPromptId[rowIdStr] || [];
    return prompt;
  });
}

/**
 * 获取所有提示词（不包括已删除的）
 * @param sortBy - 排序字段: 'updatedAt', 'createdAt', 'title'
 * @param sortOrder - 排序顺序: 'asc', 'desc'
 */
async function getPrompts(sortBy = 'updatedAt', sortOrder = 'desc'): Promise<Prompt[]> {
  // 排序字段映射
  const sortFieldMap: Record<string, string> = {
    'updatedAt': 'p.updated_at',
    'createdAt': 'p.created_at',
    'title': 'p.title'
  };

  const sortField = sortFieldMap[sortBy] || 'p.updated_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // 获取所有提示词基本信息（包括已删除的）
  const sql = `
    SELECT p.*, GROUP_CONCAT(pt.name) as tags
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
 * 检查标题是否已存在
 * @param title - 提示词标题
 * @param excludeId - 排除的提示词ID（用于编辑时排除自己）
 * @returns 是否存在
 */
async function isTitleExists(title: string, excludeId: string | null = null): Promise<boolean> {
  let sql = 'SELECT COUNT(*) as count FROM prompts WHERE title = ? AND is_deleted = 0';
  const params: any[] = [title];

  if (excludeId) {
    sql += ' AND id != ?';
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
    SELECT p.*, GROUP_CONCAT(pt.name) as tags
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
 * 搜索提示词
 * 在数据库层面进行搜索，支持标题、内容、翻译、标签和备注搜索
 * 使用 JOIN 替代子查询优化性能
 * @param query - 搜索关键词
 * @returns 匹配的提示词列表
 */
async function searchPrompts(query: string): Promise<Prompt[]> {
  const lowerQuery = `%${query.toLowerCase()}%`;

  // 搜索提示词（标题、内容、翻译、标签、备注匹配）
  // 使用 LEFT JOIN 替代子查询，提升查询性能
  const sql = `
    SELECT DISTINCT p.*, GROUP_CONCAT(DISTINCT pt.name) as tags
    FROM prompts p
    LEFT JOIN prompt_tag_relations ptr ON p.id = ptr.prompt_id
    LEFT JOIN prompt_tags pt ON ptr.tag_id = pt.id
    LEFT JOIN prompt_tag_relations ptr2 ON p.id = ptr2.prompt_id
    LEFT JOIN prompt_tags pt2 ON ptr2.tag_id = pt2.id
    WHERE p.is_deleted = 0
    AND (
      LOWER(p.title) LIKE ?
      OR LOWER(p.content) LIKE ?
      OR LOWER(p.content_translate) LIKE ?
      OR LOWER(p.note) LIKE ?
      OR LOWER(pt2.name) LIKE ?
    )
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `;

  const rows = await all<PromptRow>(sql, [lowerQuery, lowerQuery, lowerQuery, lowerQuery, lowerQuery]);

  // 使用批量查询获取图像，避免 N+1 问题
  return getPromptsWithImages(rows);
}

/**
 * 添加提示词
 * 使用事务确保数据一致性
 */
async function addPrompt(prompt: CreatePromptParams): Promise<Prompt | null> {
  const { id, title, content, contentTranslate, tags = [], images = [], note = '', isSafe = 1 } = prompt;
  const now = dbTime();

  return runInTransaction(async () => {
    await run(
      'INSERT INTO prompts (id, title, content, content_translate, note, is_safe, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, content, contentTranslate || '', note, isSafe, now, now]
    );

    // 添加标签关联
    if (tags.length > 0) {
      await addPromptTags(id, tags);
    }

    // 添加图像关联
    if (images.length > 0) {
      const imageIds = images.map(img => img.id);
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
    const relatedFields = ['tags', 'images'];
    const hasBasicFieldUpdate = Object.keys(updates).some(key => !relatedFields.includes(key));

    if (hasBasicFieldUpdate) {
      const fields: string[] = [];
      const values: any[] = [];

      if (title !== undefined) {
        fields.push('title = ?');
        values.push(title);
      }
      if (content !== undefined) {
        fields.push('content = ?');
        values.push(content);
      }
      if (contentTranslate !== undefined) {
        fields.push('content_translate = ?');
        values.push(contentTranslate);
      }
      if (note !== undefined) {
        fields.push('note = ?');
        values.push(note);
      }
      if (isSafe !== undefined) {
        fields.push('is_safe = ?');
        values.push(isSafe ? 1 : 0);
      }
      if (isFavorite !== undefined) {
        fields.push('is_favorite = ?');
        values.push(isFavorite ? 1 : 0);
      }
      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);

      await run(`UPDATE prompts SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    // 更新标签 - 增量更新方式
    if (tags !== undefined) {
      const currentTagsRow = await get<{ tags: string | null }>(
        'SELECT GROUP_CONCAT(pt.name) as tags FROM prompt_tag_relations ptr JOIN prompt_tags pt ON ptr.tag_id = pt.id WHERE ptr.prompt_id = ?',
        [id]
      );
      const currentTagNames = currentTagsRow && currentTagsRow.tags ? currentTagsRow.tags.split(',') : [];

      const tagsToAdd = tags.filter(t => !currentTagNames.includes(t));
      const tagsToRemove = currentTagNames.filter(t => !tags.includes(t));

      const tagsChanged = tagsToAdd.length > 0 || tagsToRemove.length > 0;

      for (const tagName of tagsToRemove) {
        const tagRow = await get<{ id: number }>('SELECT id FROM prompt_tags WHERE name = ?', [tagName]);
        if (tagRow) {
          await run('DELETE FROM prompt_tag_relations WHERE prompt_id = ? AND tag_id = ?', [id, tagRow.id]);
        }
      }

      if (tagsToAdd.length > 0) {
        await addPromptTags(id, tagsToAdd);
      }

      if (tagsChanged && !hasBasicFieldUpdate) {
        await run('UPDATE prompts SET updated_at = ? WHERE id = ?', [now, id]);
      }
    }

    // 更新图像关联
    if (images !== undefined) {
      const currentImageRows = await all<{ image_id: string }>(
        'SELECT image_id FROM prompt_image_relations WHERE prompt_id = ?',
        [id]
      );
      const currentImageIds = currentImageRows.map(r => r.image_id);
      const newImageIds = images.map(img => img.id);

      const imagesToAdd = newImageIds.filter(imgId => !currentImageIds.includes(imgId));
      const imagesToRemove = currentImageIds.filter(imgId => !newImageIds.includes(imgId));

      await run('DELETE FROM prompt_image_relations WHERE prompt_id = ?', [id]);
      if (images.length > 0) {
        await addPromptImages(id, newImageIds);
      }

      if (imagesToAdd.length > 0) {
        await run(
          `UPDATE images SET updated_at = ? WHERE id IN (${imagesToAdd.map(() => '?').join(',')})`,
          [now, ...imagesToAdd]
        );
      }
      if (imagesToRemove.length > 0) {
        await run(
          `UPDATE images SET updated_at = ? WHERE id IN (${imagesToRemove.map(() => '?').join(',')})`,
          [now, ...imagesToRemove]
        );
      }

      if (!hasBasicFieldUpdate) {
        await run('UPDATE prompts SET updated_at = ? WHERE id = ?', [now, id]);
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
  await run(
    'UPDATE prompts SET is_deleted = 1, deleted_at = ? WHERE id = ?',
    [now, id]
  );

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
  const placeholders = ids.map(() => '?').join(',');

  // 仅标记软删除，保留所有关联关系
  const result = await run(
    `UPDATE prompts SET is_deleted = 1, deleted_at = ? WHERE id IN (${placeholders})`,
    [now, ...ids]
  );

  return { success: true, deleted: result.changes || 0 };
}

/**
 * 恢复已删除的提示词
 */
async function restorePrompt(id: string): Promise<Prompt | null> {
  const now = dbTime();
  await run(
    'UPDATE prompts SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ?',
    [now, id]
  );
  return getPromptById(id);
}

/**
 * 永久删除提示词
 */
async function permanentDeletePrompt(id: string): Promise<boolean> {
  // 1. 删除关联关系
  await run('DELETE FROM prompt_image_relations WHERE prompt_id = ?', [id]);

  // 2. 删除数据库记录
  await run('DELETE FROM prompts WHERE id = ?', [id]);
  return true;
}

/**
 * 清空提示词回收站
 * 删除所有软删除的提示词记录及其关联关系
 */
async function emptyPromptTrash(): Promise<boolean> {
  // 1. 删除关联关系（使用 IN 子句批量删除）
  await run(
    'DELETE FROM prompt_image_relations WHERE prompt_id IN (SELECT id FROM prompts WHERE is_deleted = 1)'
  );

  // 2. 删除数据库记录
  await run('DELETE FROM prompts WHERE is_deleted = 1');
  return true;
}

/**
 * 恢复所有已删除的提示词
 */
async function restoreAllPrompts(): Promise<boolean> {
  const now = dbTime();
  await run(
    'UPDATE prompts SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE is_deleted = 1',
    [now]
  );
  return true;
}

/**
 * 获取回收站中的提示词
 */
async function getDeletedPrompts(): Promise<Prompt[]> {
  const sql = `
    SELECT p.*, GROUP_CONCAT(pt.name) as tags
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
 * 获取所有提示词标签
 */
async function getPromptTags(): Promise<string[]> {
  const rows = await all<{ name: string }>('SELECT name FROM prompt_tags ORDER BY name');
  return rows.map(row => row.name);
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
    'SELECT id, group_id FROM prompt_tags WHERE name = ?',
    [name]
  );

  if (existingRow) {
    // 标签已存在，如果需要更新组ID
    if (groupId !== null && existingRow.group_id !== groupId) {
      await run(
        'UPDATE prompt_tags SET group_id = ?, updated_at = ? WHERE name = ?',
        [groupId, now, name]
      );
    }
    return existingRow.id;
  }

  // 2. 创建新标签
  try {
    const result = await run(
      'INSERT INTO prompt_tags (name, group_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [name, groupId, now, now]
    );
    return result.id;
  } catch (err: any) {
    // 可能是并发导致，尝试查询获取ID
    if (isConstraintError(err)) {
      const row = await get<{ id: number }>('SELECT id FROM prompt_tags WHERE name = ?', [name]);
      if (row && groupId !== null) {
        await run(
          'UPDATE prompt_tags SET group_id = ?, updated_at = ? WHERE name = ?',
          [groupId, now, name]
        );
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
async function updatePromptTagGroupByTagName(tagName: string, groupId: number | null): Promise<void> {
  const now = dbTime();
  await run(
    'UPDATE prompt_tags SET group_id = ?, updated_at = ? WHERE name = ?',
    [groupId, now, tagName]
  );
}

/**
 * 删除提示词标签
 * @param name - 标签名称
 */
async function deletePromptTag(name: string): Promise<void> {
  await run('DELETE FROM prompt_tags WHERE name = ?', [name]);
}

/**
 * 批量删除提示词标签
 * @param names - 标签名称数组
 * @returns 删除结果
 */
async function deletePromptTags(names: string[]): Promise<{ success: boolean; deleted: number }> {
  if (names.length === 0) return { success: true, deleted: 0 };

  const placeholders = names.map(() => '?').join(',');
  const sql = `DELETE FROM prompt_tags WHERE name IN (${placeholders})`;
  const result = await run(sql, names);

  return { success: true, deleted: result.changes || 0 };
}

/**
 * 标签配置定义
 */
const TagConfig: TagConfigMap = {
  prompt: {
    tagTable: 'prompt_tags',
    relationTable: 'prompt_tag_relations',
    itemIdColumn: 'prompt_id',
    tagIdColumn: 'tag_id',
    getTags: getPromptTags,
    groupTable: 'prompt_tag_groups'
  },
  image: {
    tagTable: 'image_tags',
    relationTable: 'image_tag_relations',
    itemIdColumn: 'image_id',
    tagIdColumn: 'tag_id',
    getTags: getImageTags,
    groupTable: 'image_tag_groups'
  }
};

/**
 * 批量获取或创建标签组
 * 用于 syncTagsBidirectional 优化 N+1 查询问题
 * @param type - 标签类型: 'prompt' | 'image'
 * @param groupNames - 标签组名称数组
 * @param now - 当前时间字符串
 * @returns 标签组名称到 ID 的映射
 */
async function getOrCreateTagGroups(
  type: keyof TagConfigMap,
  groupNames: string[],
  now: string
): Promise<Map<string, number>> {
  const config = TagConfig[type];
  if (!config) {
    throw new Error(`Unknown tag type: ${type}`);
  }

  const groupIdMap = new Map<string, number>();
  if (groupNames.length === 0) {
    return groupIdMap;
  }

  const { groupTable } = config;

  // 1. 查询已存在的标签组
  const placeholders = groupNames.map(() => '?').join(',');
  const existingRows = await all<{ id: number; name: string }>(
    `SELECT id, name FROM ${groupTable} WHERE name IN (${placeholders})`,
    groupNames
  );

  for (const row of existingRows) {
    groupIdMap.set(row.name, row.id);
  }

  // 2. 找出需要创建的标签组
  const newGroupNames = groupNames.filter(name => !groupIdMap.has(name));

  // 3. 批量创建新标签组
  for (const name of newGroupNames) {
    try {
      const result = await run(
        `INSERT INTO ${groupTable} (name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        [name, 0, now, now]
      );
      groupIdMap.set(name, result.id);
    } catch (err: any) {
      // 可能是并发导致，尝试查询获取 ID
      if (isConstraintError(err)) {
        const row = await get<{ id: number }>(`SELECT id FROM ${groupTable} WHERE name = ?`, [name]);
        if (row) {
          groupIdMap.set(name, row.id);
        }
      } else {
        throw err;
      }
    }
  }

  return groupIdMap;
}

/**
 * 检查标签组名称是否重复（配置驱动）
 * @param type - 标签类型: 'prompt' | 'image'
 * @param name - 标签组名称
 * @param excludeId - 排除的标签组ID（用于更新时检查）
 * @returns 存在返回记录，不存在返回null
 */
async function checkTagGroupNameDuplicate(type: keyof TagConfigMap, name: string, excludeId: number | null = null): Promise<{ id: number } | undefined> {
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
async function renameTag(type: keyof TagConfigMap, oldTag: string, newTag: string): Promise<string[]> {
  const config = TagConfig[type];
  if (!config) {
    throw new Error(`Unknown tag type: ${type}`);
  }

  const { tagTable, relationTable, itemIdColumn, tagIdColumn, getTags } = config;

  // 获取旧标签的 ID
  const oldTagRow = await get<{ id: number }>(`SELECT id FROM ${tagTable} WHERE name = ?`, [oldTag]);
  if (!oldTagRow) {
    return await getTags();
  }

  // 检查新标签是否已存在
  const newTagRow = await get<{ id: number }>(`SELECT id FROM ${tagTable} WHERE name = ?`, [newTag]);

  if (newTagRow) {
    // 新标签已存在，将所有旧标签的关联迁移到新标签
    const relations = await all<{ [key: string]: string }>(
      `SELECT ${itemIdColumn} FROM ${relationTable} WHERE ${tagIdColumn} = ?`,
      [oldTagRow.id]
    );
    for (const rel of relations) {
      try {
        await run(
          `INSERT INTO ${relationTable} (${itemIdColumn}, ${tagIdColumn}) VALUES (?, ?)`,
          [rel[itemIdColumn], newTagRow.id]
        );
      } catch (err: any) {
        // 关联已存在，忽略
        window.electronAPI.logError('database.ts', 'Failed to insert relation', err);
      }
    }
    // 删除旧标签
    await run(`DELETE FROM ${tagTable} WHERE id = ?`, [oldTagRow.id]);
  } else {
    // 新标签不存在，直接重命名
    await run(`UPDATE ${tagTable} SET name = ? WHERE id = ?`, [newTag, oldTagRow.id]);
  }

  return await getTags();
}

/**
 * 有效的标签表名
 */
const VALID_TAG_TABLES = ['prompt_tags', 'image_tags'] as const;
type ValidTagTable = typeof VALID_TAG_TABLES[number];

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
  const placeholders = tagNames.map(() => '?').join(',');
  const existingRows = await all<{ id: number; name: string }>(
    `SELECT id, name FROM ${tagTable} WHERE name IN (${placeholders})`,
    tagNames
  );

  // 记录已存在的标签
  for (const row of existingRows) {
    tagIdMap.set(row.name, row.id);
  }

  // 2. 找出需要创建的标签
  const newTagNames = tagNames.filter(name => !tagIdMap.has(name));

  if (newTagNames.length === 0) {
    return tagIdMap;
  }

  // 3. 使用事务批量创建新标签
  if (!db) {
    throw new Error('数据库未初始化');
  }

  await runInTransaction(async () => {
    const insertStmt = db!.prepare(
      `INSERT INTO ${tagTable} (name, group_id, created_at, updated_at) VALUES (?, ?, ?, ?)`
    );

    try {
      for (const name of newTagNames) {
        try {
          const result = await new Promise<{ lastID: number }>((resolve, reject) => {
            insertStmt.run([name, null, now, now], function(this: { lastID: number }, err: Error | null) {
              if (err) reject(err);
              else resolve({ lastID: this.lastID });
            });
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
  const missingTagNames = newTagNames.filter(name => !tagIdMap.has(name));
  if (missingTagNames.length > 0) {
    const missingPlaceholders = missingTagNames.map(() => '?').join(',');
    const missingRows = await all<{ id: number; name: string }>(
      `SELECT id, name FROM ${tagTable} WHERE name IN (${missingPlaceholders})`,
      missingTagNames
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
  const tagIdMap = await getOrCreateTags('prompt_tags', tagNames);

  // 批量添加关联
  for (const tagName of tagNames) {
    const tagId = tagIdMap.get(tagName);
    if (tagId) {
      try {
        await run(
          'INSERT INTO prompt_tag_relations (prompt_id, tag_id) VALUES (?, ?)',
          [promptId, tagId]
        );
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
  await run('UPDATE prompts SET updated_at = ? WHERE id = ?', [now, promptId]);
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
  return rows.map(row => row.id);
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
  return rows.map(row => row.id);
}

/**
 * 从提示词中移除标签
 * @param promptId - 提示词ID
 * @param tagName - 标签名称
 */
async function removeTagFromPrompt(promptId: string, tagName: string): Promise<void> {
  // 获取标签ID
  const tagRow = await get<{ id: number }>(
    'SELECT id FROM prompt_tags WHERE name = ?',
    [tagName]
  );

  if (tagRow) {
    await run(
      'DELETE FROM prompt_tag_relations WHERE prompt_id = ? AND tag_id = ?',
      [promptId, tagRow.id]
    );

    // 更新提示词的 updated_at 字段
    const now = dbTime();
    await run(
      'UPDATE prompts SET updated_at = ? WHERE id = ?',
      [now, promptId]
    );
  }
}

/**
 * 从图像中移除标签
 * @param imageId - 图像ID
 * @param tagName - 标签名称
 */
async function removeTagFromImage(imageId: string, tagName: string): Promise<void> {
  // 获取标签ID
  const tagRow = await get<{ id: number }>(
    'SELECT id FROM image_tags WHERE name = ?',
    [tagName]
  );

  if (tagRow) {
    await run(
      'DELETE FROM image_tag_relations WHERE image_id = ? AND tag_id = ?',
      [imageId, tagRow.id]
    );

    // 更新图像的 updated_at 字段
    const now = dbTime();
    await run(
      'UPDATE images SET updated_at = ? WHERE id = ?',
      [now, imageId]
    );
  }
}

// ==================== 图像操作 ====================

/**
 * 将数据库行映射为图像对象
 * @param row - 数据库行
 * @param promptRows - 关联的提示词行
 * @param options - 可选配置
 * @returns 图像对象
 */
function mapRowToImage(row: ImageRow, promptRows: Array<{ id: string; title: string; content: string }> = [], options: MapImageOptions = {}): Image {
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
    isSafe: row.is_safe === 1 ? 1 : 0,  // 严格限制为 0 或 1，其他值视为 0
    isDeleted: row.is_deleted === 1,
    note: row.note,
    createdAt: formatDbTimeToLocal(row.created_at),
    updatedAt: formatDbTimeToLocal(row.updated_at),
    tags: row.image_tags ? row.image_tags.split(',').filter(t => t) : [],
    promptRefs: promptRows.map(p => ({
      promptId: p.id,
      promptTitle: p.title,
      promptContent: p.content,
      promptContentTranslate: (p as any).content_translate,
      promptNote: (p as any).note
    }))
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
async function getPromptRefsForImages(imageIds: string[]): Promise<Array<{ image_id: string; id: string; title: string; content: string; content_translate: string; note: string }>> {
  if (imageIds.length === 0) return [];
  const placeholders = imageIds.map(() => '?').join(',');
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

  const imageIds = rows.map(r => r.id);
  const promptRefs = await getPromptRefsForImages(imageIds);

  const refsByImageId: Record<string, Array<{ id: string; title: string; content: string; content_translate: string; note: string }>> = {};
  for (const ref of promptRefs) {
    if (!refsByImageId[ref.image_id]) refsByImageId[ref.image_id] = [];
    refsByImageId[ref.image_id].push({
      id: ref.id,
      title: ref.title,
      content: ref.content,
      content_translate: ref.content_translate,
      note: ref.note
    });
  }

  return rows.map(row => mapRowToImage(row, refsByImageId[row.id] || []));
}

/**
 * 获取所有图像（不包括已删除的）
 * @param sortBy - 排序字段: 'createdAt', 'fileName', 'width', 'height'
 * @param sortOrder - 排序顺序: 'asc', 'desc'
 */
async function getImages(sortBy = 'createdAt', sortOrder = 'desc'): Promise<Image[]> {
  const sortFieldMap: Record<string, string> = {
    'createdAt': 'i.created_at',
    'updatedAt': 'i.updated_at',
    'fileName': 'i.file_name',
    'width': 'i.width',
    'height': 'i.height',
    'fileSize': 'i.file_size'
  };

  const sortField = sortFieldMap[sortBy] || 'i.created_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const imageSql = `
    SELECT i.*,
           (SELECT GROUP_CONCAT(DISTINCT it.name)
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
 * 键值需与 src/constants.ts 中的特殊标签常量保持一致
 */
const IMAGE_SPECIAL_TAG_CONDITIONS: Record<string, string> = {
  '收藏': 'i.is_favorite = 1',
  '未引': 'NOT EXISTS (SELECT 1 FROM prompt_image_relations pir WHERE pir.image_id = i.id)',
  '多引': '(SELECT COUNT(*) FROM prompt_image_relations pir WHERE pir.image_id = i.id) > 1',
  '无标': 'NOT EXISTS (SELECT 1 FROM image_tag_relations itr WHERE itr.image_id = i.id)',
  '安全': 'i.is_safe != 0',
  '敏感': 'i.is_safe = 0'
};

/**
 * 构建分页/计数查询的 WHERE 条件和参数
 * @param options - 查询选项
 * @returns WHERE 子句和参数数组
 */
function buildImageFilterWhere(options: { searchQuery?: string; tagNames?: string[]; specialTags?: string[]; isSafe?: boolean }): { whereClause: string; params: any[] } {
  const conditions: string[] = ['i.is_deleted = 0'];
  const params: any[] = [];

  if (options.isSafe) {
    conditions.push('i.is_safe != 0');
  }

  if (options.searchQuery && options.searchQuery.trim()) {
    const query = `%${options.searchQuery.trim()}%`;
    conditions.push(`(i.file_name LIKE ? OR i.note LIKE ? OR EXISTS (SELECT 1 FROM image_tag_relations itr_search JOIN image_tags it_search ON itr_search.tag_id = it_search.id WHERE itr_search.image_id = i.id AND it_search.name LIKE ?))`);
    params.push(query, query, query);
  }

  if (options.tagNames && options.tagNames.length > 0) {
    for (const tagName of options.tagNames) {
      conditions.push(`EXISTS (SELECT 1 FROM image_tag_relations itr_tag JOIN image_tags it_tag ON itr_tag.tag_id = it_tag.id WHERE itr_tag.image_id = i.id AND it_tag.name = ?)`);
      params.push(tagName);
    }
  }

  if (options.specialTags && options.specialTags.length > 0) {
    for (const tag of options.specialTags) {
      const condition = IMAGE_SPECIAL_TAG_CONDITIONS[tag];
      if (condition) {
        conditions.push(condition);
      }
    }
  }

  return {
    whereClause: conditions.join(' AND '),
    params
  };
}

/**
 * 分页获取图像（不包括已删除的）
 * @param options - 分页和筛选选项
 */
async function getImagesPaginated(options: GetImagesPaginatedOptions): Promise<PaginatedImagesResult> {
  const sortFieldMap: Record<string, string> = {
    'createdAt': 'i.created_at',
    'updatedAt': 'i.updated_at',
    'fileName': 'i.file_name',
    'width': 'i.width',
    'height': 'i.height',
    'fileSize': 'i.file_size'
  };

  const sortBy = options.sortBy || 'createdAt';
  const sortOrder = options.sortOrder || 'desc';
  const sortField = sortFieldMap[sortBy] || 'i.created_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const { whereClause, params } = buildImageFilterWhere(options);
  const limit = Math.max(1, options.limit);
  const offset = Math.max(0, options.offset);

  const imageSql = `
    SELECT i.*,
           (SELECT GROUP_CONCAT(DISTINCT it.name)
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
    countImages(options)
  ]);

  return {
    items,
    totalCount: countResult
  };
}

/**
 * 统计满足条件的图像总数
 * @param options - 筛选选项（不含 limit/offset）
 */
async function countImages(options: Omit<GetImagesPaginatedOptions, 'limit' | 'offset'>): Promise<number> {
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
async function countImageSpecialTags(options: CountImageTagsOptions): Promise<ImageSpecialTagCounts> {
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
    unsafe: row?.unsafe || 0
  };
}

/**
 * 根据 ID 批量获取图像
 * @param ids - 图像 ID 数组
 * @returns 图像列表
 */
async function getImagesByIds(ids: string[]): Promise<Image[]> {
  if (!ids || ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  const sql = `
    SELECT i.*,
           (SELECT GROUP_CONCAT(DISTINCT it.name)
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
    const sql = 'SELECT id, relative_path, thumbnail_path FROM images';
    return await all<ImageCleanupInfo>(sql);
  }

  // 默认：统计或其他场景，使用完整查询
  const imageSql = `
    SELECT i.*,
           (SELECT GROUP_CONCAT(DISTINCT it.name)
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
           (SELECT GROUP_CONCAT(DISTINCT it.name)
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
  const promptRows = await all<{ id: string; title: string; content: string; content_translate: string; note: string }>(promptSql, [id]);

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
    const relatedFields = ['tags', 'prompts'];
    const hasBasicFieldUpdate = Object.keys(updates).some(key => !relatedFields.includes(key));

    if (hasBasicFieldUpdate) {
      const fields: string[] = [];
      const values: any[] = [];

      if (isFavorite !== undefined) {
        fields.push('is_favorite = ?');
        values.push(isFavorite ? 1 : 0);
      }
      if (isSafe !== undefined) {
        fields.push('is_safe = ?');
        values.push(isSafe ? 1 : 0);
      }
      if (note !== undefined) {
        fields.push('note = ?');
        values.push(note);
      }
      if (fileName !== undefined) {
        fields.push('file_name = ?');
        values.push(fileName);
      }
      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);

      await run(`UPDATE images SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if (tags !== undefined) {
      const currentTagNames = await getImageTagsByImageId(id);
      const tagsToAdd = tags.filter(t => !currentTagNames.includes(t));
      const tagsToRemove = currentTagNames.filter(t => !tags.includes(t));
      const tagsChanged = tagsToAdd.length > 0 || tagsToRemove.length > 0;

      for (const tagName of tagsToRemove) {
        const tagRow = await get<{ id: number }>('SELECT id FROM image_tags WHERE name = ?', [tagName]);
        if (tagRow) {
          await run('DELETE FROM image_tag_relations WHERE image_id = ? AND tag_id = ?', [id, tagRow.id]);
        }
      }

      if (tagsToAdd.length > 0) {
        await addImageTags(id, tagsToAdd);
      }

      if (tagsChanged && !hasBasicFieldUpdate) {
        await run('UPDATE images SET updated_at = ? WHERE id = ?', [now, id]);
      }
    }

    if (prompts !== undefined) {
      const currentPromptRows = await all<{ prompt_id: string }>(
        'SELECT prompt_id FROM prompt_image_relations WHERE image_id = ?',
        [id]
      );
      const currentPromptIds = currentPromptRows.map(r => r.prompt_id);
      const newPromptIds = prompts.map(p => typeof p === 'string' ? p : p.id);

      const promptsToAdd = newPromptIds.filter(pid => !currentPromptIds.includes(pid));
      const promptsToRemove = currentPromptIds.filter(pid => !newPromptIds.includes(pid));
      const promptsChanged = promptsToAdd.length > 0 || promptsToRemove.length > 0;

      // 只删除需要移除的关联（增量更新）
      if (promptsToRemove.length > 0) {
        await run(
          `DELETE FROM prompt_image_relations WHERE image_id = ? AND prompt_id IN (${promptsToRemove.map(() => '?').join(',')})`,
          [id, ...promptsToRemove]
        );
      }

      // 只添加新增的关联
      if (promptsToAdd.length > 0) {
        await addImagePrompts(id, promptsToAdd);
      }

      if (promptsToAdd.length > 0) {
        await run(
          `UPDATE prompts SET updated_at = ? WHERE id IN (${promptsToAdd.map(() => '?').join(',')})`,
          [now, ...promptsToAdd]
        );
      }
      if (promptsToRemove.length > 0) {
        await run(
          `UPDATE prompts SET updated_at = ? WHERE id IN (${promptsToRemove.map(() => '?').join(',')})`,
          [now, ...promptsToRemove]
        );
      }

      if (promptsChanged && !hasBasicFieldUpdate) {
        await run('UPDATE images SET updated_at = ? WHERE id = ?', [now, id]);
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

  const now = dbTime();

  return runInTransaction(async () => {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const stmt = db.prepare(
      'UPDATE images SET thumbnail_path = ?, updated_at = ? WHERE id = ?'
    );

    try {
      for (const update of updates) {
        await new Promise<void>((resolve, reject) => {
          stmt.run(update.thumbnailPath, now, update.id, (err: Error | null) => {
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
async function getImageByMD5IncludeTrash(md5: string): Promise<{ id: string; isDeleted: boolean } | null> {
  const row = await get<{ id: string; is_deleted: number }>('SELECT id, is_deleted FROM images WHERE md5 = ?', [md5]);
  return row ? { id: row.id, isDeleted: row.is_deleted === 1 } : null;
}

/**
 * 添加图像
 */
async function addImage(image: CreateImageParams): Promise<Image | null> {
  const {
    id,
    fileName,
    storedName,
    relativePath,
    thumbnailPath,
    md5,
    width,
    height,
    fileSize
  } = image;

  const now = dbTime();

  await run(
    `INSERT INTO images (id, file_name, stored_name, relative_path, thumbnail_path, md5, width, height, file_size, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, fileName, storedName, relativePath, thumbnailPath, md5, width || null, height || null, fileSize || 0, now, now]
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
  await run(
    'UPDATE images SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );

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
      [newId, oldId]
    );

    // 3. 迁移图像-标签关联关系
    await run(
      `UPDATE OR IGNORE image_tag_relations
       SET image_id = ?
       WHERE image_id = ?`,
      [newId, oldId]
    );

    // 4. 同步更新新图像和相关提示词的更新时间
    const now = dbTime();
    await run(
      'UPDATE images SET updated_at = ? WHERE id = ?',
      [now, newId]
    );

    const relatedPromptRows = await all<{ prompt_id: string }>(
      'SELECT prompt_id FROM prompt_image_relations WHERE image_id = ?',
      [newId]
    );
    const relatedPromptIds = relatedPromptRows.map(row => row.prompt_id);
    if (relatedPromptIds.length > 0) {
      const placeholders = relatedPromptIds.map(() => '?').join(',');
      await run(
        `UPDATE prompts SET updated_at = ? WHERE id IN (${placeholders})`,
        [now, ...relatedPromptIds]
      );
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
  const placeholders = ids.map(() => '?').join(',');

  // 仅标记软删除，保留所有关联关系
  const result = await run(
    `UPDATE images SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id IN (${placeholders})`,
    [now, now, ...ids]
  );

  return { success: true, deleted: result.changes || 0 };
}

/**
 * 恢复已删除的图像
 */
async function restoreImage(id: string): Promise<Image | null> {
  const now = dbTime();
  await run(
    'UPDATE images SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ?',
    [now, id]
  );
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
    console.error('Failed to delete image file:', error);
  }
}

/**
 * 永久删除图像
 * @param id - 图像ID
 * @param dataDir - 数据目录路径
 */
async function permanentDeleteImage(id: string, dataDir: string): Promise<boolean> {
  // 1. 删除关联关系
  await run('DELETE FROM prompt_image_relations WHERE image_id = ?', [id]);

  // 2. 先获取图像信息以删除物理文件（只选择需要的字段）
  const image = await get<ImageFilePaths>(
    'SELECT relative_path, thumbnail_path FROM images WHERE id = ?',
    [id]
  );

  if (image) {
    await deleteImageFiles(image, dataDir);
  }

  // 3. 删除数据库记录
  await run('DELETE FROM images WHERE id = ?', [id]);
  return true;
}

/**
 * 恢复所有已删除的图像
 */
async function restoreAllImages(): Promise<boolean> {
  const now = dbTime();
  await run(
    'UPDATE images SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE is_deleted = 1',
    [now]
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
           (SELECT GROUP_CONCAT(DISTINCT it.name)
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
  const imageIds = rows.map(r => r.id);
  const placeholders = imageIds.map(() => '?').join(',');
  const promptSql = `
    SELECT pir.image_id, p.id, p.title, p.content
    FROM prompt_image_relations pir
    JOIN prompts p ON pir.prompt_id = p.id
    WHERE pir.image_id IN (${placeholders}) AND p.is_deleted = 0
  `;
  const allPromptRows = await all<{ image_id: string; id: string; title: string; content: string }>(promptSql, imageIds);

  // 按 image_id 分组提示词
  const promptsByImageId: Record<string, Array<{ id: string; title: string; content: string }>> = {};
  for (const row of allPromptRows) {
    if (!promptsByImageId[row.image_id]) {
      promptsByImageId[row.image_id] = [];
    }
    promptsByImageId[row.image_id].push({ id: row.id, title: row.title, content: row.content });
  }

  // 组装图像列表
  return rows.map(row => mapRowToImage(row, promptsByImageId[row.id] || [], { includeDeletedAt: true }));
}

/**
 * 清空图像回收站
 * 删除所有软删除的图像记录和对应的物理文件
 * @param dataDir - 数据目录路径
 */
async function emptyImageTrash(dataDir: string): Promise<boolean> {
  // 1. 删除关联关系（使用 IN 子句批量删除）
  await run(
    'DELETE FROM prompt_image_relations WHERE image_id IN (SELECT id FROM images WHERE is_deleted = 1)'
  );

  // 2. 获取所有软删除的图像（只选择文件路径相关字段）
  const deletedImages = await all<ImageFilePaths>(
    'SELECT relative_path, thumbnail_path FROM images WHERE is_deleted = 1'
  );

  // 3. 删除物理文件
  for (const image of deletedImages) {
    await deleteImageFiles(image, dataDir);
  }

  // 4. 删除数据库记录
  await run('DELETE FROM images WHERE is_deleted = 1');
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
  preserveOrder = true
): Promise<void> {
  if (secondIds.length === 0) return;

  const now = dbTime();

  await runInTransaction(async () => {
    if (!db) {
      throw new Error('数据库未初始化');
    }

    // 使用预处理语句批量插入
    const insertStmt = db.prepare(
      `INSERT INTO ${config.relationTable} (${config.firstIdColumn}, ${config.secondIdColumn}, sort_order) VALUES (?, ?, ?)`
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
            logDebug('Database', `跳过关联添加: ${err.message}`, {
              [config.firstIdLabel]: firstId,
              [config.secondIdLabel]: secondId
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
      const placeholders = secondIds.map(() => '?').join(',');
      await run(
        `UPDATE ${config.secondUpdateTable} SET updated_at = ? WHERE id IN (${placeholders})`,
        [now, ...secondIds]
      );
    }

    // 更新第一列对应表的 updated_at
    await run(`UPDATE ${config.firstUpdateTable} SET updated_at = ? WHERE id = ?`, [now, firstId]);
  });
}

// 提示词-图像关联配置
const PROMPT_IMAGE_RELATION_CONFIG: RelationConfig = {
  relationTable: 'prompt_image_relations',
  firstIdColumn: 'prompt_id',
  secondIdColumn: 'image_id',
  firstUpdateTable: 'prompts',
  secondUpdateTable: 'images',
  firstIdLabel: 'promptId',
  secondIdLabel: 'imageId'
};

// 图像-提示词关联配置
const IMAGE_PROMPT_RELATION_CONFIG: RelationConfig = {
  relationTable: 'prompt_image_relations',
  firstIdColumn: 'image_id',
  secondIdColumn: 'prompt_id',
  firstUpdateTable: 'images',
  secondUpdateTable: 'prompts',
  firstIdLabel: 'imageId',
  secondIdLabel: 'promptId'
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
async function addPromptImages(promptId: string, imageIds: string[], preserveOrder = true): Promise<void> {
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
async function addImagePrompts(imageId: string, promptIds: string[], preserveOrder = true): Promise<void> {
  return addRelationsBatch(imageId, promptIds, IMAGE_PROMPT_RELATION_CONFIG, preserveOrder);
}

/**
 * 获取提示词关联的图像
 */
async function getPromptImages(promptId: string): Promise<PromptImage[]> {
  const sql = `
    SELECT i.*,
           (SELECT GROUP_CONCAT(DISTINCT it.name)
            FROM image_tag_relations itr
            JOIN image_tags it ON itr.tag_id = it.id
            WHERE itr.image_id = i.id) as image_tags
    FROM images i
    JOIN prompt_image_relations pir ON i.id = pir.image_id
    WHERE pir.prompt_id = ? AND i.is_deleted = 0
    ORDER BY pir.sort_order ASC
  `;
  const rows = await all<ImageRow>(sql, [promptId]);
  return rows.map(row => ({
    id: row.id,
    fileName: row.file_name,
    storedName: row.stored_name,
    relativePath: row.relative_path,
    thumbnailPath: row.thumbnail_path,
    width: row.width,
    height: row.height,
    isSafe: row.is_safe === 1 ? 1 : 0,  // 严格限制为 0 或 1，其他值视为 0
    note: row.note,
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    tags: row.image_tags ? row.image_tags.split(',').filter(t => t) : [],
    promptRefs: [{ promptId: promptId }]
  }));
}

/**
 * 获取未被引用的图像
 */
async function getUnreferencedImages(): Promise<UnreferencedImage[]> {
  const sql = `
    SELECT i.*
    FROM images i
    LEFT JOIN prompt_image_relations pir ON i.id = pir.image_id
    WHERE pir.prompt_id IS NULL
  `;
  const rows = await all<ImageRow>(sql);
  return rows.map(row => ({
    id: row.id,
    fileName: row.file_name,
    storedName: row.stored_name,
    relativePath: row.relative_path,
    thumbnailPath: row.thumbnail_path,
    width: row.width,
    height: row.height,
    isSafe: row.is_safe === 1 ? 1 : 0,  // 严格限制为 0 或 1，其他值视为 0
    note: row.note,
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

// ==================== 图像标签管理 ====================

/**
 * 获取所有图像标签
 */
async function getImageTags(): Promise<string[]> {
  const sql = 'SELECT name FROM image_tags ORDER BY name';
  const rows = await all<{ name: string }>(sql);
  return rows.map(row => row.name);
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
    'SELECT id, group_id FROM image_tags WHERE name = ?',
    [name]
  );

  if (existingRow) {
    // 标签已存在，如果需要更新组ID
    if (groupId !== null && existingRow.group_id !== groupId) {
      await run(
        'UPDATE image_tags SET group_id = ?, updated_at = ? WHERE name = ?',
        [groupId, now, name]
      );
    }
    return;
  }

  // 2. 创建新标签
  try {
    await run(
      'INSERT INTO image_tags (name, group_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [name, groupId, now, now]
    );
  } catch (err: any) {
    // 可能是并发导致，尝试更新组ID
    if (isConstraintError(err)) {
      if (groupId !== null) {
        await run(
          'UPDATE image_tags SET group_id = ?, updated_at = ? WHERE name = ?',
          [groupId, now, name]
        );
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
  const tagIdMap = await getOrCreateTags('image_tags', tagNames);

  // 批量添加关联
  for (const tagName of tagNames) {
    const tagId = tagIdMap.get(tagName);
    if (tagId) {
      try {
        await run('INSERT INTO image_tag_relations (image_id, tag_id) VALUES (?, ?)', [imageId, tagId]);
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
  await run('UPDATE images SET updated_at = ? WHERE id = ?', [now, imageId]);
}

/**
 * 删除图像标签
 * 从 image_tags 表中删除标签
 * @param name - 标签名称
 */
async function deleteImageTag(name: string): Promise<void> {
  await run('DELETE FROM image_tags WHERE name = ?', [name]);
}

/**
 * 批量删除图像标签
 * @param names - 标签名称数组
 * @returns 删除结果
 */
async function deleteImageTags(names: string[]): Promise<{ success: boolean; deleted: number }> {
  if (names.length === 0) return { success: true, deleted: 0 };

  const placeholders = names.map(() => '?').join(',');
  const sql = `DELETE FROM image_tags WHERE name IN (${placeholders})`;
  const result = await run(sql, names);

  return { success: true, deleted: result.changes || 0 };
}

/**
 * 分配图像标签到所属组
 * @param tagName - 标签名称
 * @param groupId - 标签组ID
 */
async function assignImageTagToBelongGroup(tagName: string, groupId: number | null): Promise<void> {
  const now = dbTime();
  await run(
    'UPDATE image_tags SET group_id = ?, updated_at = ? WHERE name = ?',
    [groupId, now, tagName]
  );
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
  return rows.map(row => row.name);
}

/**
 * 双向同步标签
 * 将提示词和图像双方的标签差异同步到对方，保留组信息
 */
async function syncTagsBidirectional(): Promise<TagSyncResult> {
  const now = dbTime();

  // 获取提示词标签和图像标签
  const promptTagsSql = `
    SELECT pt.name, pt.group_id, pg.name as group_name
    FROM prompt_tags pt
    LEFT JOIN prompt_tag_groups pg ON pt.group_id = pg.id
  `;
  const imageTagsSql = `
    SELECT it.name, it.group_id, ig.name as group_name
    FROM image_tags it
    LEFT JOIN image_tag_groups ig ON it.group_id = ig.id
  `;

  const promptTags = await all<{ name: string; group_id: number | null; group_name: string | null }>(promptTagsSql);
  const imageTags = await all<{ name: string; group_id: number | null; group_name: string | null }>(imageTagsSql);

  const promptTagNames = new Set(promptTags.map(t => t.name));
  const imageTagNames = new Set(imageTags.map(t => t.name));

  // 找出差异：提示词有而图像没有的 → 同步到图像
  const toImageTags = promptTags.filter(t => !imageTagNames.has(t.name));
  // 找出差异：图像有而提示词没有的 → 同步到提示词
  const toPromptTags = imageTags.filter(t => !promptTagNames.has(t.name));

  // 准备结果
  const result: TagSyncResult = {
    promptToImage: { imported: 0, skipped: 0, tags: [], tagGroups: [], ungroupedTags: [] },
    imageToPrompt: { imported: 0, skipped: 0, tags: [], tagGroups: [], ungroupedTags: [] }
  };

  if (toImageTags.length === 0 && toPromptTags.length === 0) {
    return result;
  }

  // 使用 runInTransaction 管理事务
  return runInTransaction(async () => {
    // 同步到图像
    if (toImageTags.length > 0) {
      const tagGroupsMap = new Map<string, string[]>();
      const existingImageTags = new Set((await all<{ name: string }>('SELECT name FROM image_tags')).map(t => t.name));

      // 批量获取需要创建的图像标签组，避免 N+1 查询
      const imageGroupNames = [...new Set(toImageTags.filter(t => t.group_name).map(t => t.group_name!))];
      const imageGroupIdMap = await getOrCreateTagGroups('image', imageGroupNames, now);

      for (const tag of toImageTags) {
        if (existingImageTags.has(tag.name)) {
          result.promptToImage.skipped++;
          continue;
        }

        const targetGroupId = tag.group_name ? imageGroupIdMap.get(tag.group_name) ?? null : null;

        if (tag.group_name) {
          if (!tagGroupsMap.has(tag.group_name)) {
            tagGroupsMap.set(tag.group_name, []);
          }
          tagGroupsMap.get(tag.group_name)!.push(tag.name);
        }

        await run('INSERT INTO image_tags (name, group_id, created_at, updated_at) VALUES (?, ?, ?, ?)', [tag.name, targetGroupId, now, now]);
        result.promptToImage.imported++;
        result.promptToImage.tags.push(tag.name);
        // 记录未分组标签
        if (!tag.group_name) {
          result.promptToImage.ungroupedTags.push(tag.name);
        }
      }

      result.promptToImage.tagGroups = Array.from(tagGroupsMap.entries()).map(([groupName, tags]) => ({ groupName, tags }));
    }

    // 同步到提示词
    if (toPromptTags.length > 0) {
      const tagGroupsMap = new Map<string, string[]>();
      const existingPromptTags = new Set((await all<{ name: string }>('SELECT name FROM prompt_tags')).map(t => t.name));

      // 批量获取需要创建的提示词标签组，避免 N+1 查询
      const promptGroupNames = [...new Set(toPromptTags.filter(t => t.group_name).map(t => t.group_name!))];
      const promptGroupIdMap = await getOrCreateTagGroups('prompt', promptGroupNames, now);

      for (const tag of toPromptTags) {
        if (existingPromptTags.has(tag.name)) {
          result.imageToPrompt.skipped++;
          continue;
        }

        const targetGroupId = tag.group_name ? promptGroupIdMap.get(tag.group_name) ?? null : null;

        if (tag.group_name) {
          if (!tagGroupsMap.has(tag.group_name)) {
            tagGroupsMap.set(tag.group_name, []);
          }
          tagGroupsMap.get(tag.group_name)!.push(tag.name);
        }

        await run('INSERT INTO prompt_tags (name, group_id, created_at, updated_at) VALUES (?, ?, ?, ?)', [tag.name, targetGroupId, now, now]);
        result.imageToPrompt.imported++;
        result.imageToPrompt.tags.push(tag.name);
        // 记录未分组标签
        if (!tag.group_name) {
          result.imageToPrompt.ungroupedTags.push(tag.name);
        }
      }

      result.imageToPrompt.tagGroups = Array.from(tagGroupsMap.entries()).map(([groupName, tags]) => ({ groupName, tags }));
    }

    return result;
  });
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
  return rows.map(row => row.name);
}

// ==================== 统计数据 ====================

/**
 * 获取数据库统计信息
 * 返回提示词、图像、标签等的数量统计
 */
async function getStatistics(): Promise<Statistics> {
  try {
    // 提示词统计
    const promptStats = await get<{
      total: number;
      active: number;
      deleted: number;
    }>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_deleted = 0 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_deleted = 1 THEN 1 ELSE 0 END) as deleted
      FROM prompts
    `);

    // 图像统计
    // 使用 LEFT JOIN 关联 prompt_image_relations 表统计引用情况，提升性能
    const imageStats = await get<{
      total: number;
      referenced: number;
      unreferenced: number;
      deleted: number;
    }>(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN i.is_deleted = 0 AND pir.image_id IS NOT NULL THEN 1 END) as referenced,
        COUNT(CASE WHEN i.is_deleted = 0 AND pir.image_id IS NULL THEN 1 END) as unreferenced,
        COUNT(CASE WHEN i.is_deleted = 1 THEN 1 END) as deleted
      FROM images i
      LEFT JOIN (SELECT DISTINCT image_id FROM prompt_image_relations) pir ON i.id = pir.image_id
    `);

    // 标签统计
    const promptTagStats = await get<{ total: number }>(`
      SELECT COUNT(*) as total FROM prompt_tags
    `);

    const imageTagStats = await get<{ total: number }>(`
      SELECT COUNT(*) as total FROM image_tags
    `);

    // 关联统计
    const relationStats = await get<{
      totalRelations: number;
      promptsWithImages: number;
    }>(`
      SELECT
        COUNT(*) as totalRelations,
        COUNT(DISTINCT prompt_id) as promptsWithImages
      FROM prompt_image_relations
    `);

    return {
      prompts: {
        total: promptStats?.total || 0,
        active: promptStats?.active || 0,
        deleted: promptStats?.deleted || 0,
        tags: promptTagStats?.total || 0
      },
      images: {
        total: imageStats?.total || 0,
        referenced: imageStats?.referenced || 0,
        unreferenced: imageStats?.unreferenced || 0,
        deleted: imageStats?.deleted || 0,
        tags: imageTagStats?.total || 0
      },
      relations: {
        total: relationStats?.totalRelations || 0,
        promptsWithImages: relationStats?.promptsWithImages || 0
      }
    };
  } catch (err: any) {
    console.error('Get statistics failed:', err);
    throw err;
  }
}

// ==================== 清空所有数据 ====================

/**
 * 重命名数据目录
 * @param dataDir - 当前数据目录路径
 * @returns 新目录路径（带时间后缀）
 */
async function renameDataDirectory(dataDir: string): Promise<string> {
  const timestamp = getFormattedLocalTimeToSecond();
  const parentDir = path.dirname(dataDir);
  const dirName = path.basename(dataDir);
  const newPath = path.join(parentDir, `${dirName}_${timestamp}`);
  await fs.rename(dataDir, newPath);
  return newPath;
}

/**
 * 清空所有数据
 * 重命名当前数据目录并创建新的空数据目录，应用将重启
 * 旧数据目录保留，可手动备份或删除
 * @param dataDir - 数据目录路径
 * @returns 旧数据目录路径（带日期后缀，用于重启应用后提示用户）
 */
async function clearAllData(dataDir: string): Promise<string> {
  try {
    const oldDataDir = dataDir;
    const timestamp = getFormattedLocalTimeToSecond();
    const newDataDir = path.join(path.dirname(oldDataDir), `${path.basename(oldDataDir)}_${timestamp}`);

    // 关闭数据库
    closeDatabase();

    // 等待数据库连接完全关闭
    await new Promise(resolve => setTimeout(resolve, 500));

    // 重命名旧数据目录
    await fs.rename(oldDataDir, newDataDir);

    // 创建新的空数据目录
    await fs.mkdir(oldDataDir, { recursive: true });

    // 重新初始化数据库
    await initDatabase(oldDataDir);

    console.debug('All data cleared and database reset');
    return newDataDir;
  } catch (err: any) {
    console.error('Clear all data failed:', err);
    throw err;
  }
}

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
    // 先获取当前收藏状态
    const placeholders = ids.map(() => '?').join(',');
    const rows = await all<{ id: string; is_favorite: number }>(
      `SELECT id, is_favorite FROM prompts WHERE id IN (${placeholders})`,
      [...ids]
    );

    // 批量更新：切换收藏状态
    let updatedCount = 0;
    for (const row of rows) {
      const newStatus = row.is_favorite ? 0 : 1;
      const result = await run(
        'UPDATE prompts SET is_favorite = ?, updated_at = ? WHERE id = ?',
        [newStatus, now, row.id]
      );
      updatedCount += result.changes || 0;
    }

    return { success: true, updated: updatedCount };
  });
}

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
    // 先获取当前收藏状态
    const placeholders = ids.map(() => '?').join(',');
    const rows = await all<{ id: string; is_favorite: number }>(
      `SELECT id, is_favorite FROM images WHERE id IN (${placeholders})`,
      [...ids]
    );

    // 批量更新：切换收藏状态
    let updatedCount = 0;
    for (const row of rows) {
      const newStatus = row.is_favorite ? 0 : 1;
      const result = await run(
        'UPDATE images SET is_favorite = ?, updated_at = ? WHERE id = ?',
        [newStatus, now, row.id]
      );
      updatedCount += result.changes || 0;
    }

    return { success: true, updated: updatedCount };
  });
}

export {
  initDatabase,
  closeDatabase,
  run,
  get,
  all,
  // Prompt 操作
  getPrompts,
  getPromptById,
  isTitleExists,
  addPrompt,
  updatePrompt,
  searchPrompts,
  deletePrompt,
  softDeletePrompts,
  restorePrompt,
  restoreAllPrompts,
  permanentDeletePrompt,
  emptyPromptTrash,
  getDeletedPrompts,
  // 提示词标签组操作
  createPromptTagGroup,
  getPromptTagGroups,
  getPromptTagGroupById,
  updatePromptTagGroup,
  deletePromptTagGroup,
  // 提示词标签操作
  getPromptTags,
  addPromptTag,
  addPromptTags,
  deletePromptTag,
  deletePromptTags,
  updatePromptTagGroupByTagName,
  getPromptsByTag,
  removeTagFromPrompt,
  // 通用标签操作
  renameTag,
  checkTagGroupNameDuplicate,
  // 图像操作
  getImages,
  getImagesPaginated,
  countImages,
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
  restoreAllImages,
  permanentDeleteImage,
  getDeletedImages,
  emptyImageTrash,
  addPromptImages,
  addImagePrompts,
  getPromptImages,
  getUnreferencedImages,
  updateImage,
  updateImagesBatch,
  // 图像标签组操作
  createImageTagGroup,
  getImageTagGroups,
  getImageTagGroupById,
  updateImageTagGroup,
  deleteImageTagGroup,
  // 图像标签操作
  getImageTags,
  addImageTag,
  addImageTags,
  deleteImageTag,
  deleteImageTags,
  assignImageTagToBelongGroup,
  getImagesByTag,
  removeTagFromImage,
  // 共享标签
  getAllTags,
  // 标签同步
  syncTagsBidirectional,
  // 数据清理
  renameDataDirectory,
  clearAllData,
  // 统计
  getStatistics,
  // 数据库维护
  optimizeDatabase,
  // 批量收藏
  batchFavoritePrompts,
  batchFavoriteImages
};
