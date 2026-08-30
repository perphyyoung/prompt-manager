/**
 * application 层组合根
 * 用例服务的单例装配集中在这里:服务全部无状态(只持有依赖),可安全单例。
 * 新增用例服务:创建 Service 文件 → 在此注册一行 → 路由经 backupUseCases 调用。
 * fs 端口统一用 nodeFsPort(全量实现按结构化类型满足各服务声明的窄端口)。
 */

import { getFormattedLocalTimeToSecond } from "../../utils/index.js";
import * as db from "../database.js";
import { getCurrentDataDir } from "../runtime.js";
import { initTagsCache } from "../infrastructure/tagCache.js";
import { regenerateAllThumbnails } from "../infrastructure/imageFiles.js";
import {
  createZipArchive,
  getBackupStats,
  scanOrphanFilesInternal,
  sendBackupProgress,
} from "../infrastructure/backup.js";
import { nodeFsPort } from "../infrastructure/fsPort.js";
import { ExportFullBackupService } from "./ExportFullBackupService.js";
import { ExportOrphanFilesService } from "./ExportOrphanFilesService.js";
import { ImportFullBackupService } from "./ImportFullBackupService.js";
import { TagMutationService } from "./TagMutationService.js";

/** 备份文件名时间戳 */
const backupTimestamp = () => getFormattedLocalTimeToSecond().replace(/[:\s]/g, "-");

export const backupUseCases = {
  /** 扫描孤儿文件 */
  scanOrphanFiles: scanOrphanFilesInternal,

  exportOrphanFiles: new ExportOrphanFilesService({
    scanOrphanFiles: scanOrphanFilesInternal,
    timestamp: Date.now,
    fs: nodeFsPort,
  }),

  exportFullBackup: new ExportFullBackupService({
    getDataDir: getCurrentDataDir,
    getBackupStats,
    onProgress: sendBackupProgress,
    timestamp: backupTimestamp,
    createZip: createZipArchive,
    fs: nodeFsPort,
  }),

  importFullBackup: new ImportFullBackupService({
    closeDatabase: () => db.closeDatabase(),
    initDatabase: (dataDir) => db.initDatabase(dataDir),
    getDataDir: getCurrentDataDir,
    onProgress: sendBackupProgress,
    timestamp: backupTimestamp,
    regenerateThumbnails: regenerateAllThumbnails,
    fs: nodeFsPort,
  }),
};

/** 标签写操作 + 全标签缓存一致性(写后全量重建,见 TagMutationService 注释) */
export const tagMutationService = new TagMutationService({
  tags: db,
  cache: { refreshAll: initTagsCache },
});
