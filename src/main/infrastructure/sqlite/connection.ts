/**
 * 数据库模块 - SQLite
 * 管理提示词、图像和它们之间的关系
 */

// @ts-ignore - sqlite3 类型定义不完整
import sqlite3 from "sqlite3";
import path from "path";
import { promises as fs } from "fs";
import { logError, logWarn, logDebug } from "../../mainLogger.js";
import { dbTime } from "../../../utils/index.js";
import {
  DatabaseError,
  DatabaseErrorCode,
  ConstraintViolationError,
} from "../../database-errors.ts";
import type {
  RunResult,
} from "../../database-types.js";

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

  const dbPath = path.join(dataDir, "prompt-manager.db");

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err: Error | null) => {
      if (err) {
        logError("Database", "Failed to open database", { error: err.message });
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
          logError("Database", "Failed to close database", { error: err.message });
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
    )`,
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
    const result = await get<{ version: number }>(
      "SELECT version FROM db_version ORDER BY version DESC LIMIT 1",
    );
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
  await run("INSERT OR REPLACE INTO db_version (version, applied_at) VALUES (?, ?)", [
    version,
    dbTime(),
  ]);
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
  logDebug("Database", "Migrating date formats to ISO 8601");

  const tables = [
    { table: "prompts", columns: ["created_at", "updated_at", "deleted_at"], idColumn: "id" },
    { table: "images", columns: ["created_at", "updated_at", "deleted_at"], idColumn: "id" },
    { table: "prompt_tags", columns: ["created_at", "updated_at"], idColumn: "id" },
    { table: "image_tags", columns: ["created_at", "updated_at"], idColumn: "id" },
    { table: "prompt_tag_groups", columns: ["created_at", "updated_at"], idColumn: "id" },
    { table: "image_tag_groups", columns: ["created_at", "updated_at"], idColumn: "id" },
  ];

  for (const { table, columns, idColumn } of tables) {
    for (const column of columns) {
      const rows = await all<{ [key: string]: string | number | null }>(
        `SELECT ${idColumn} as id, ${column} as value FROM ${table} WHERE ${column} IS NOT NULL AND ${column} LIKE '%/%'`,
      );

      if (rows.length === 0) continue;

      // 单事务包裹整批 UPDATE，避免 WAL 模式下逐行 fsync 的写放大
      await runInTransaction(async () => {
        for (const row of rows) {
          const localValue = row.value as string;
          const isoValue = localTimeToIso(localValue);
          if (isoValue !== localValue) {
            await run(`UPDATE ${table} SET ${column} = ? WHERE ${idColumn} = ?`, [
              isoValue,
              row.id,
            ]);
          }
        }
      });
    }
  }

  logDebug("Database", "Date format migration completed");
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
    { name: "journal_mode", value: "WAL" }, // 写前日志模式，提升并发性能
    { name: "synchronous", value: "NORMAL" }, // 平衡安全与性能
    { name: "cache_size", value: "-64000" }, // 64MB 缓存（负值表示 KB）
    { name: "foreign_keys", value: "ON" }, // 启用外键约束
    { name: "temp_store", value: "MEMORY" }, // 临时表存内存
    { name: "mmap_size", value: "268435456" }, // 256MB 内存映射
  ];

  for (const { name, value } of pragmas) {
    try {
      await run(`PRAGMA ${name} = ${value}`);
    } catch (error: any) {
      logWarn("Database", `Failed to set PRAGMA ${name}: ${error.message}`);
    }
  }
}

/**
 * 创建数据库索引
 * 优化常用查询的性能
 */
async function createIndexes(): Promise<void> {
  // 冗余索引清理：三张关系表的主键即为 (prompt_id|image_id, xxx) 复合主键，
  // 其左前缀自动索引已覆盖单列 prompt_id/image_id 查询，这些历史遗留单列索引是纯写放大
  const droppedIndexes = [
    "DROP INDEX IF EXISTS idx_prompt_image_relations_prompt_id",
    "DROP INDEX IF EXISTS idx_prompt_tag_relations_prompt_id",
    "DROP INDEX IF EXISTS idx_image_tag_relations_image_id",
  ];

  const indexes = [
    // 提示词表索引
    "CREATE INDEX IF NOT EXISTS idx_prompts_updated_at ON prompts(updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_prompts_is_deleted ON prompts(is_deleted)",
    "CREATE INDEX IF NOT EXISTS idx_prompts_is_favorite ON prompts(is_favorite)",
    "CREATE INDEX IF NOT EXISTS idx_prompts_is_safe ON prompts(is_safe)",
    // 复合索引：常用查询模式
    "CREATE INDEX IF NOT EXISTS idx_prompts_deleted_updated ON prompts(is_deleted, updated_at DESC)",
    // 标题唯一性检查（isTitleExists: WHERE title = ? AND is_deleted = 0）
    "CREATE INDEX IF NOT EXISTS idx_prompts_title_deleted ON prompts(title, is_deleted)",

    // 图像表索引
    "CREATE INDEX IF NOT EXISTS idx_images_updated_at ON images(updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_images_is_deleted ON images(is_deleted)",
    "CREATE INDEX IF NOT EXISTS idx_images_is_favorite ON images(is_favorite)",
    "CREATE INDEX IF NOT EXISTS idx_images_is_safe ON images(is_safe)",
    "CREATE INDEX IF NOT EXISTS idx_images_md5 ON images(md5)",
    // 复合索引
    "CREATE INDEX IF NOT EXISTS idx_images_deleted_updated ON images(is_deleted, updated_at DESC)",

    // 关联表索引 - 优化 JOIN 查询
    // 复合索引同时满足按提示词查关联与 sort_order 排序（加载关联图像的高频路径）
    "CREATE INDEX IF NOT EXISTS idx_prompt_image_relations_prompt_sort ON prompt_image_relations(prompt_id, sort_order ASC)",
    "CREATE INDEX IF NOT EXISTS idx_prompt_image_relations_image_id ON prompt_image_relations(image_id)",
    "CREATE INDEX IF NOT EXISTS idx_prompt_tag_relations_tag_id ON prompt_tag_relations(tag_id)",
    "CREATE INDEX IF NOT EXISTS idx_image_tag_relations_image_id ON image_tag_relations(image_id)",
    "CREATE INDEX IF NOT EXISTS idx_image_tag_relations_tag_id ON image_tag_relations(tag_id)",

    // 标签组索引 - 优化标签组查询
    "CREATE INDEX IF NOT EXISTS idx_prompt_tags_group_id ON prompt_tags(group_id)",
    "CREATE INDEX IF NOT EXISTS idx_image_tags_group_id ON image_tags(group_id)",

    // 部分索引 - 只索引活跃数据，更小更快
    "CREATE INDEX IF NOT EXISTS idx_prompts_active_updated ON prompts(updated_at DESC) WHERE is_deleted = 0",
    "CREATE INDEX IF NOT EXISTS idx_images_active_updated ON images(updated_at DESC) WHERE is_deleted = 0",
    "CREATE INDEX IF NOT EXISTS idx_prompts_active_favorite ON prompts(updated_at DESC) WHERE is_deleted = 0 AND is_favorite = 1",
    "CREATE INDEX IF NOT EXISTS idx_images_active_favorite ON images(updated_at DESC) WHERE is_deleted = 0 AND is_favorite = 1",
  ];

  for (const sql of [...droppedIndexes, ...indexes]) {
    try {
      await run(sql);
    } catch (error: any) {
      logError("Database", `Failed to create index: ${sql}`, error);
    }
  }
}

// 事务状态跟踪
let transactionDepth = 0;

/**
 * 标签名聚合分隔符：U+001F（单元分隔符，控制字符，正常输入不会出现）
 * 避免标签名本身包含逗号时 GROUP_CONCAT 结果被错误拆分
 */
const TAG_SEPARATOR = "\u001F";

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
  await run("BEGIN TRANSACTION");
  try {
    const result = await asyncFn();
    await run("COMMIT");
    return result;
  } catch (error) {
    await run("ROLLBACK");
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
  logDebug("Database", "Starting optimization...");

  try {
    // 回收空间
    await run("VACUUM");
    logDebug("Database", "VACUUM completed");

    // 更新统计信息
    await run("ANALYZE");
    logDebug("Database", "ANALYZE completed");

    // 完整性检查
    const result = await get<{ integrity_check: string }>("PRAGMA integrity_check");
    if (result && result.integrity_check !== "ok") {
      logError("Database", `Integrity check failed: ${result.integrity_check}`);
    } else {
      logDebug("Database", "Integrity check passed");
    }

    logDebug("Database", "Optimization completed");
    return true;
  } catch (error: any) {
    logError("Database", "Optimization failed:", error);
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
    return 200; // 默认值
  },
};

/**
 * 解析 SQLite 错误，转换为统一的 DatabaseError
 */
function parseSQLiteError(err: Error, sql?: string, params?: any[]): DatabaseError {
  const message = err.message;

  // 唯一约束违反
  if (message.includes("UNIQUE constraint failed")) {
    // 提取表名和字段名（支持带引号的标识符，如 "my-table"."my-column"）
    const match = message.match(/UNIQUE constraint failed:\s*"?([^"\s.]+)"?\."?([^"\s.]+)"?/);
    const details = match ? `表 ${match[1]} 的 ${match[2]} 字段` : "";
    return new ConstraintViolationError(
      details ? `唯一约束违反: ${details} 的值已存在` : message,
      "UNIQUE",
      err,
    );
  }

  // 外键约束违反
  if (message.includes("FOREIGN KEY constraint failed")) {
    return new ConstraintViolationError("外键约束违反: 引用的记录不存在", "FOREIGN_KEY", err);
  }

  // 检查约束违反
  if (message.includes("CHECK constraint failed")) {
    return new ConstraintViolationError("检查约束违反: 数据不符合约束条件", "CHECK", err);
  }

  // 非空约束违反
  if (message.includes("NOT NULL constraint failed")) {
    // 提取表名和字段名（支持带引号的标识符）
    const match = message.match(/NOT NULL constraint failed:\s*"?([^"\s.]+)"?\."?([^"\s.]+)"?/);
    const details = match ? `表 ${match[1]} 的 ${match[2]} 字段` : "";
    return new ConstraintViolationError(
      details ? `非空约束违反: ${details} 不能为空` : message,
      "NOT_NULL",
      err,
    );
  }

  // 通用 SQL 错误
  return new DatabaseError(`数据库操作失败: ${message}`, DatabaseErrorCode.SQL_ERROR, err, {
    sql: sql?.substring(0, 200),
    params,
  });
}

/**
 * 执行 SQL 语句
 */
function run(sql: string, params: any[] = []): Promise<RunResult> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new DatabaseError("数据库未初始化", DatabaseErrorCode.DB_NOT_INITIALIZED));
      return;
    }
    db.run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
      const duration = Date.now() - startTime;
      if (duration > DB_CONFIG.SLOW_QUERY_THRESHOLD_MS) {
        logWarn("Database", `慢查询 (${duration}ms)`, { sql: sql.substring(0, 100) });
      }
      if (err) {
        logError("Database", `SQL 执行失败: ${sql.substring(0, 100)}`, err);
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
      reject(new DatabaseError("数据库未初始化", DatabaseErrorCode.DB_NOT_INITIALIZED));
      return;
    }
    db.get(sql, params, (err: Error | null, row: T) => {
      const duration = Date.now() - startTime;
      if (duration > DB_CONFIG.SLOW_QUERY_THRESHOLD_MS) {
        logWarn("Database", `慢查询 (${duration}ms)`, { sql: sql.substring(0, 100) });
      }
      if (err) {
        logError("Database", `SQL 查询失败: ${sql.substring(0, 100)}`, err);
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
      reject(new DatabaseError("数据库未初始化", DatabaseErrorCode.DB_NOT_INITIALIZED));
      return;
    }
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      const duration = Date.now() - startTime;
      if (duration > DB_CONFIG.SLOW_QUERY_THRESHOLD_MS) {
        logWarn("Database", `慢查询 (${duration}ms)`, { sql: sql.substring(0, 100) });
      }
      if (err) {
        logError("Database", `SQL 查询失败: ${sql.substring(0, 100)}`, err);
        reject(parseSQLiteError(err, sql, params));
      } else {
        resolve(rows);
      }
    });
  });
}

// ==================== Tag Group 操作 ====================


// 供按域仓库模块使用的连接层导出
export {
  initDatabase,
  closeDatabase,
  run,
  get,
  all,
  runInTransaction,
  optimizeDatabase,
  TAG_SEPARATOR,
};

/** 获取底层 sqlite 连接（用于 run/get/all 未覆盖的预处理语句场景） */
export function getDb(): sqlite3.Database | null {
  return db;
}
