/**
 * 导入完整备份用例服务
 * 编排:解压 → 校验 manifest → 版本兼容检查 → 备份当前数据(关库+改名) → 恢复 → 重建缩略图,失败自动回滚。
 * 职责边界:文件选择与错误翻译(日志 + error 进度)留在路由;本服务只依赖注入的端口,可独立单测。
 */

import path from "path";
import type { IBackupManifest } from "../../shared/ipc-contract.js";
import { logError } from "../mainLogger.js";

/** 备份进度载荷(与 IPC_EVENTS.backupProgress 的推送体一致) */
export interface BackupProgressPayload {
  stage: string;
  percent: number;
  status: string;
  detail?: string;
}

export type CopyDirProgressListener = (copied: number, total: number, fileName: string) => void;

export interface ImportFullBackupDeps {
  /** 关闭数据库连接(释放数据目录的文件锁) */
  closeDatabase: () => Promise<void>;
  /** 重新初始化数据库连接 */
  initDatabase: (dataDir: string) => Promise<void>;
  /** 当前数据目录(会被整体改名,必须经访问器在执行时读取) */
  getDataDir: () => string;
  /** 进度回调(路由侧绑定 webContents.send) */
  onProgress: (progress: BackupProgressPayload) => void;
  /** 文件系统聚合端口,由 infrastructure 既有函数装配 */
  fs: {
    extractZip: (zipPath: string, targetDir: string) => Promise<void>;
    copyFile: (src: string, dst: string) => Promise<void>;
    rename: (from: string, to: string) => Promise<void>;
    /** 递归创建目录 */
    mkdir: (dir: string) => Promise<void>;
    /** 以 utf8 读取文本文件 */
    readFile: (filePath: string) => Promise<string>;
    copyDirWithProgress: (
      src: string,
      dst: string,
      onFile: CopyDirProgressListener,
    ) => Promise<void>;
    /** 递归删除目录 */
    removeDir: (dir: string) => Promise<void>;
    createTempDir: (prefix: string) => Promise<string>;
  };
  /** 全量重建缩略图 */
  regenerateThumbnails: (
    onProgress: (current: number, total: number, fileName: string) => void,
  ) => Promise<{ success: boolean; regenerated: number; failed: number; total: number }>;
  /** 备份目录后缀时间戳(注入以便断言) */
  timestamp: () => string;
}

export type ImportFullBackupResult = {
  success: true;
  manifest: IBackupManifest;
  oldDataDir: string;
};

/** 当前支持的数据格式版本 */
const CURRENT_DATA_VERSION = 1;

export class ImportFullBackupService {
  constructor(private readonly deps: ImportFullBackupDeps) {}

  async execute(zipPath: string): Promise<ImportFullBackupResult> {
    const { onProgress, fs } = this.deps;

    onProgress({
      stage: "start",
      percent: 0,
      status: "准备导入...",
      detail: "正在准备导入环境...",
    });

    const tempDir = await fs.createTempDir("prompt-manager-restore");

    try {
      // 1. 解压 ZIP (0% -> 20%)
      onProgress({ stage: "compress", percent: 5, status: "正在解压备份文件..." });
      await fs.extractZip(zipPath, tempDir);

      // 2. 验证 manifest (20% -> 25%)
      onProgress({ stage: "manifest", percent: 20, status: "正在验证备份文件..." });
      const manifest = await this.readManifest(tempDir);

      // 3. 版本兼容性检查 (25% -> 30%)
      onProgress({ stage: "manifest", percent: 25, status: "正在检查版本兼容性..." });
      const backupDataVersion = manifest.dataVersion || 1;
      if (backupDataVersion !== CURRENT_DATA_VERSION) {
        throw new Error(
          `数据格式版本不兼容：备份数据版本 ${backupDataVersion}，当前支持版本 ${CURRENT_DATA_VERSION}`,
        );
      }

      // 4. 备份当前数据 (30% -> 40%)
      onProgress({ stage: "database", percent: 30, status: "正在备份当前数据..." });
      const dataDir = this.deps.getDataDir();
      // 关闭数据库连接以释放文件锁
      await this.deps.closeDatabase();

      const backupDir = `${dataDir}_${this.deps.timestamp()}`;
      await fs.rename(dataDir, backupDir);

      try {
        // 5. 恢复数据
        await fs.mkdir(dataDir);

        // 恢复数据库 (40% -> 50%)
        onProgress({ stage: "database", percent: 40, status: "正在恢复数据库..." });
        await fs.copyFile(
          path.join(tempDir, "database", "prompt-manager.db"),
          path.join(dataDir, "prompt-manager.db"),
        );
        // 重新初始化数据库连接
        await this.deps.initDatabase(dataDir);

        // 恢复图像 (50% -> 80%)
        const imageStats = manifest.contents?.images || { count: 0 };
        onProgress({
          stage: "images",
          percent: 50,
          status: "正在恢复图像文件...",
          detail: `共 ${imageStats.count} 个文件`,
        });
        await fs.copyDirWithProgress(
          path.join(tempDir, "files", "images"),
          path.join(dataDir, "images"),
          (copied, total, fileName) => {
            onProgress({
              stage: "images",
              percent: Math.round(50 + (copied / total) * 40),
              status: `正在恢复图像文件... (${copied}/${total})`,
              detail: fileName,
            });
          },
        );

        // 重新生成缩略图 (90% -> 100%)
        onProgress({ stage: "thumbnails", percent: 90, status: "正在重新生成缩略图..." });
        await this.deps.regenerateThumbnails((current, total, fileName) => {
          onProgress({
            stage: "thumbnails",
            percent: Math.round(90 + (current / total) * 10),
            status: "正在重新生成缩略图...",
            detail: `${current}/${total} ${fileName || ""}`,
          });
        });

        // 完成
        onProgress({ stage: "complete", percent: 100, status: "导入完成！" });

        return { success: true, manifest, oldDataDir: backupDir };
      } catch (error) {
        // 恢复失败，尝试回滚
        logError("Main", "Restore failed, attempting rollback:", error);
        onProgress({
          stage: "error",
          percent: 0,
          status: "导入失败，正在回滚...",
          detail: "正在恢复到原数据...",
        });
        await fs.removeDir(dataDir);
        await fs.rename(backupDir, dataDir);
        throw new Error("导入失败，已自动回滚到原数据");
      }
    } finally {
      // 清理临时目录
      await fs.removeDir(tempDir);
    }
  }

  /** 读取并解析 manifest,缺失/损坏时统一报错 */
  private async readManifest(tempDir: string): Promise<IBackupManifest> {
    try {
      const content = await this.deps.fs.readFile(path.join(tempDir, "manifest.json"));
      return JSON.parse(content) as IBackupManifest;
    } catch {
      throw new Error("无效的备份文件：缺少 manifest.json");
    }
  }
}
