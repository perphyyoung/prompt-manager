import path from "path";
import { describe, it, expect } from "vitest";
import {
  ImportFullBackupService,
  type ImportFullBackupDeps,
  type BackupProgressPayload,
} from "../../../src/main/application/ImportFullBackupService.js";
import type { IBackupManifest } from "../../../src/shared/ipc-contract.js";

const DATA_DIR = "D:/data/py-data";
const BACKUP_DIR = `${DATA_DIR}_20260829-120000`;
const TEMP_DIR = "/tmp/prompt-manager-restore-1";

function buildManifest(overrides: Partial<IBackupManifest> = {}): IBackupManifest {
  return {
    version: "1.0.0",
    appName: "prompt-manager",
    exportedAt: "2026/8/29 12:00:00",
    dataVersion: 1,
    contents: { database: true, prompts: { count: 1 }, images: { count: 2, size: 10 } },
    ...overrides,
  };
}

type FsOverrides = Partial<ImportFullBackupDeps["fs"]>;

function createDeps(
  options: {
    manifest?: IBackupManifest;
    fsOverrides?: FsOverrides;
    overrides?: Partial<Omit<ImportFullBackupDeps, "fs">>;
  } = {},
) {
  const calls: string[] = [];
  const progress: Array<{ stage: string; percent: number; status: string; detail?: string }> = [];
  const manifest = options.manifest ?? buildManifest();

  const defaultFs: ImportFullBackupDeps["fs"] = {
    extractZip: async (zipPath, targetDir) => {
      calls.push(`extractZip:${zipPath}->${targetDir}`);
    },
    copyFile: async (src, dst) => {
      calls.push(`copyFile:${src}->${dst}`);
    },
    rename: async (from, to) => {
      calls.push(`rename:${from}->${to}`);
    },
    mkdir: async (dir) => {
      calls.push(`mkdir:${dir}`);
    },
    readFile: async () => JSON.stringify(manifest),
    copyDirWithProgress: async (src, dst) => {
      calls.push(`copyDir:${src}->${dst}`);
    },
    removeDir: async (dir) => {
      calls.push(`removeDir:${dir}`);
    },
    createTempDir: async (prefix) => {
      calls.push(`createTempDir:${prefix}`);
      return TEMP_DIR;
    },
  };

  const deps: ImportFullBackupDeps = {
    closeDatabase: async () => {
      calls.push("closeDatabase");
    },
    initDatabase: async (dir) => {
      calls.push(`initDatabase:${dir}`);
    },
    getDataDir: () => DATA_DIR,
    onProgress: (p: BackupProgressPayload) => {
      progress.push(p);
    },
    regenerateThumbnails: async () => {
      calls.push("regenerateThumbnails");
      return { success: true, regenerated: 2, failed: 0, total: 2 };
    },
    timestamp: () => "20260829-120000",
    fs: { ...defaultFs, ...options.fsOverrides },
    ...options.overrides,
  };

  return { deps, calls, progress, manifest };
}

describe("ImportFullBackupService", () => {
  it("happy path:按正确顺序执行,返回备份清单与旧数据目录", async () => {
    const { deps, calls, manifest } = createDeps();
    const result = await new ImportFullBackupService(deps).execute("/backup/backup.zip");

    expect(result).toEqual({
      success: true,
      manifest,
      oldDataDir: BACKUP_DIR,
    });

    // 关键顺序:关库在改名数据目录之前;初始化在恢复数据库文件之后
    expect(calls.indexOf("closeDatabase")).toBeLessThan(
      calls.indexOf(`rename:${DATA_DIR}->${BACKUP_DIR}`),
    );
    expect(
      calls.indexOf(
        `copyFile:${path.join(TEMP_DIR, "database", "prompt-manager.db")}->${path.join(DATA_DIR, "prompt-manager.db")}`,
      ),
    ).toBeLessThan(calls.indexOf(`initDatabase:${DATA_DIR}`));
    // 图像恢复来自备份包
    expect(calls).toContain(
      `copyDir:${path.join(TEMP_DIR, "files", "images")}->${path.join(DATA_DIR, "images")}`,
    );
    // 临时目录最终清理
    expect(calls).toContain(`removeDir:${TEMP_DIR}`);
  });

  it("happy path:进度按阶段推进 0→100", async () => {
    const { deps, progress } = createDeps();
    await new ImportFullBackupService(deps).execute("/backup/backup.zip");

    expect(progress.map((p) => p.percent)).toEqual([0, 5, 20, 25, 30, 40, 50, 90, 100]);
    expect(progress.map((p) => p.stage)).toEqual([
      "start",
      "compress",
      "manifest",
      "manifest",
      "database",
      "database",
      "images",
      "thumbnails",
      "complete",
    ]);
  });

  it("manifest 缺失:报错且不触碰数据库,临时目录仍被清理", async () => {
    const { deps, calls } = createDeps({
      fsOverrides: {
        readFile: async () => {
          throw new Error("ENOENT");
        },
      },
    });

    await expect(new ImportFullBackupService(deps).execute("/backup/backup.zip")).rejects.toThrow(
      "无效的备份文件：缺少 manifest.json",
    );

    expect(calls).not.toContain("closeDatabase");
    expect(calls).toContain(`removeDir:${TEMP_DIR}`);
  });

  it("数据版本不兼容:在触碰数据库之前失败", async () => {
    const { deps, calls } = createDeps({ manifest: buildManifest({ dataVersion: 99 }) });

    await expect(new ImportFullBackupService(deps).execute("/backup/backup.zip")).rejects.toThrow(
      "数据格式版本不兼容：备份数据版本 99，当前支持版本 1",
    );

    expect(calls).not.toContain("closeDatabase");
  });

  it("恢复中途失败:自动回滚(删新目录 + 改名旧目录回来),并抛回滚错误", async () => {
    const { deps, calls, progress } = createDeps({
      fsOverrides: {
        copyFile: async (src) => {
          if (src.includes("prompt-manager.db")) throw new Error("disk full");
        },
      },
    });

    await expect(new ImportFullBackupService(deps).execute("/backup/backup.zip")).rejects.toThrow(
      "导入失败，已自动回滚到原数据",
    );

    expect(calls).toContain(`removeDir:${DATA_DIR}`);
    expect(calls).toContain(`rename:${BACKUP_DIR}->${DATA_DIR}`);
    // 回滚先于临时目录清理
    expect(calls.indexOf(`removeDir:${DATA_DIR}`)).toBeLessThan(
      calls.lastIndexOf(`removeDir:${TEMP_DIR}`),
    );
    expect(progress.some((p) => p.stage === "error" && p.status.includes("回滚"))).toBe(true);
  });

  it("回滚自身失败:原始错误向上传播,不被回滚成功信息吞掉", async () => {
    const { deps } = createDeps({
      fsOverrides: {
        copyFile: async (src) => {
          if (src.includes("prompt-manager.db")) throw new Error("disk full");
        },
        removeDir: async (dir) => {
          if (dir === DATA_DIR) throw new Error("EBUSY: rollback failed");
        },
      },
    });

    await expect(new ImportFullBackupService(deps).execute("/backup/backup.zip")).rejects.toThrow(
      "EBUSY: rollback failed",
    );
  });
});
