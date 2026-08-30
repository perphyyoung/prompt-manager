/**
 * 导出完整备份用例服务
 * 编排:统计 → 写 manifest → 复制数据库 → 复制图像(进度) → 压缩 ZIP,临时目录始终清理。
 * 职责边界:目录选择与错误翻译留在路由;本服务只依赖注入的端口,可独立单测。
 * 注意:缩略图、字体和设置不导出。
 */

import path from "path";
import type { IBackupStats } from "../../shared/ipc-contract.js";
import { buildBackupManifest } from "../infrastructure/backup.js";
import type { BackupProgressPayload, CopyDirProgressListener } from "./ImportFullBackupService.js";

export interface ExportFullBackupDeps {
  /** 数据目录(manifest 里的数据库与图像从这里复制) */
  getDataDir: () => string;
  /** 备份统计(prompts/images 计数与体积) */
  getBackupStats: () => Promise<IBackupStats>;
  /** 进度回调(路由侧绑定 webContents.send) */
  onProgress: (progress: BackupProgressPayload) => void;
  /** 备份文件名时间戳(注入以便断言) */
  timestamp: () => string;
  /** 压缩为 ZIP */
  createZip: (sourceDir: string, zipPath: string) => Promise<void>;
  /** 文件系统聚合端口,由 infrastructure 既有函数装配 */
  fs: {
    writeFile: (filePath: string, content: string) => Promise<void>;
    /** 递归创建目录 */
    mkdir: (dir: string) => Promise<void>;
    copyFile: (src: string, dst: string) => Promise<void>;
    copyDirWithProgress: (
      src: string,
      dst: string,
      onFile: CopyDirProgressListener,
    ) => Promise<void>;
    createTempDir: (prefix: string) => Promise<string>;
    removeDir: (dir: string) => Promise<void>;
  };
}

export type ExportFullBackupResult = {
  success: true;
  filePath: string;
  stats: IBackupStats;
};

export class ExportFullBackupService {
  constructor(private readonly deps: ExportFullBackupDeps) {}

  async execute(exportDir: string): Promise<ExportFullBackupResult> {
    const { onProgress, fs } = this.deps;

    onProgress({ stage: "start", percent: 0, status: "准备中...", detail: "正在统计文件..." });

    // 在实际开始备份时生成文件名（确保时间戳准确）
    const fileName = `prompt-manager-backup-${this.deps.timestamp()}.zip`;
    const filePath = path.join(exportDir, fileName);

    const tempDir = await fs.createTempDir("prompt-manager-backup");

    try {
      // 1. 生成 manifest.json (5%)
      onProgress({ stage: "manifest", percent: 5, status: "正在生成备份清单..." });

      const stats = await this.deps.getBackupStats();
      const manifest = buildBackupManifest(stats);
      await fs.writeFile(path.join(tempDir, "manifest.json"), JSON.stringify(manifest, null, 2));

      // 2. 复制数据库 (5% -> 15%)
      onProgress({ stage: "database", percent: 15, status: "正在复制数据库..." });

      const dbDir = path.join(tempDir, "database");
      await fs.mkdir(dbDir);
      await fs.copyFile(
        path.join(this.deps.getDataDir(), "prompt-manager.db"),
        path.join(dbDir, "prompt-manager.db"),
      );

      // 3. 复制图像文件 (15% -> 80%)
      const imagesSource = path.join(this.deps.getDataDir(), "images");
      const imagesTarget = path.join(tempDir, "files", "images");

      onProgress({
        stage: "images",
        percent: 15,
        status: "正在复制图像文件...",
        detail: `共 ${stats.images.count} 个文件`,
      });

      await fs.copyDirWithProgress(imagesSource, imagesTarget, (copied, total, fileName) => {
        onProgress({
          stage: "images",
          percent: Math.round(15 + (copied / total) * 65),
          status: `正在复制图像文件... (${copied}/${total})`,
          detail: fileName,
        });
      });

      // 4. 压缩为 ZIP (80% -> 100%)
      onProgress({ stage: "compress", percent: 80, status: "正在压缩备份文件..." });
      await this.deps.createZip(tempDir, filePath);

      // 完成
      onProgress({ stage: "complete", percent: 100, status: "备份完成！" });

      return { success: true, filePath, stats };
    } finally {
      // 清理临时目录
      await fs.removeDir(tempDir);
    }
  }
}
