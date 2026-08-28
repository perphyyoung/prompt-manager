/**
 * 统计与系统仓库
 * 统计数据与数据清空。原样迁自 database.ts, 逻辑未改动。
 */

import { get, initDatabase, closeDatabase } from "../sqlite/connection.js";
import { logError, logDebug } from "../../mainLogger.js";
import { getFormattedLocalTimeToSecond } from "../../../utils/index.js";
import path from "path";
import { promises as fs } from "fs";
import type { Statistics } from "../../../shared/domain/database-types.js";

async function getStatistics(isSafeOnly: boolean): Promise<Statistics> {
  try {
    const safeFilter = isSafeOnly ? " AND is_safe = 1" : "";

    // 提示词计数
    const promptStats = await get<{
      totalPrompts: number;
      deletedPrompts: number;
      favoritePrompts: number;
    }>(`
      SELECT
        COUNT(*) AS totalPrompts,
        COALESCE(SUM(CASE WHEN is_deleted = 1 THEN 1 ELSE 0 END), 0) AS deletedPrompts,
        COALESCE(SUM(CASE WHEN is_favorite = 1 AND is_deleted = 0 THEN 1 ELSE 0 END), 0) AS favoritePrompts
      FROM prompts
      WHERE 1 = 1${safeFilter}
    `);

    // 有未删除关联图像的活跃提示词数
    const promptWithImageStats = await get<{ promptsWithImages: number }>(`
      SELECT COUNT(*) AS promptsWithImages
      FROM prompts p
      WHERE p.is_deleted = 0${isSafeOnly ? " AND p.is_safe = 1" : ""}
        AND EXISTS (
          SELECT 1 FROM prompt_image_relations pir
          JOIN images i ON i.id = pir.image_id AND i.is_deleted = 0
          WHERE pir.prompt_id = p.id
        )
    `);

    // 图像计数
    const imageStats = await get<{
      totalImages: number;
      deletedImages: number;
      favoriteImages: number;
      referencedImages: number;
    }>(`
      SELECT
        COUNT(*) AS totalImages,
        COALESCE(SUM(CASE WHEN i.is_deleted = 1 THEN 1 ELSE 0 END), 0) AS deletedImages,
        COALESCE(SUM(CASE WHEN i.is_favorite = 1 AND i.is_deleted = 0 THEN 1 ELSE 0 END), 0) AS favoriteImages,
        COALESCE(SUM(CASE WHEN i.is_deleted = 0 AND EXISTS (
          SELECT 1 FROM prompt_image_relations pir
          JOIN prompts p ON p.id = pir.prompt_id AND p.is_deleted = 0
          WHERE pir.image_id = i.id
        ) THEN 1 ELSE 0 END), 0) AS referencedImages
      FROM images i
      WHERE 1 = 1${safeFilter}
    `);

    return {
      totalPrompts: promptStats?.totalPrompts || 0,
      deletedPrompts: promptStats?.deletedPrompts || 0,
      favoritePrompts: promptStats?.favoritePrompts || 0,
      promptsWithImages: promptWithImageStats?.promptsWithImages || 0,
      totalImages: imageStats?.totalImages || 0,
      deletedImages: imageStats?.deletedImages || 0,
      favoriteImages: imageStats?.favoriteImages || 0,
      referencedImages: imageStats?.referencedImages || 0,
    };
  } catch (err: any) {
    logError("database.ts", "Get statistics failed:", err);
    throw err;
  }
}

// ==================== 清空所有数据 ====================

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
    const newDataDir = path.join(
      path.dirname(oldDataDir),
      `${path.basename(oldDataDir)}_${timestamp}`,
    );

    // 关闭数据库并等待连接完全释放（避免 Windows 下文件占用导致 rename 失败）
    await closeDatabase();

    // 重命名旧数据目录
    await fs.rename(oldDataDir, newDataDir);

    // 创建新的空数据目录
    await fs.mkdir(oldDataDir, { recursive: true });

    // 重新初始化数据库
    await initDatabase(oldDataDir);

    logDebug("Database", "All data cleared and database reset");
    return newDataDir;
  } catch (err: any) {
    logError("Database", "Clear all data failed:", err);
    throw err;
  }
}


export {
  getStatistics,
  clearAllData,
};
