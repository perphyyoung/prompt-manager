import path from "path";
import { describe, it, expect } from "vitest";
import {
  ExportFullBackupService,
  type ExportFullBackupDeps,
} from "../../../src/main/application/ExportFullBackupService.js";
import type { IBackupStats } from "../../../src/shared/ipc-contract.js";

const DATA_DIR = "D:/data/py-data";
const EXPORT_DIR = "D:/backup-out";
const TEMP_DIR = "/tmp/prompt-manager-backup-1";
const TIMESTAMP = "20260829-130000";

const STATS: IBackupStats = {
  database: true,
  prompts: { count: 3 },
  images: { count: 5, size: 1024 },
};

type FsOverrides = Partial<ExportFullBackupDeps["fs"]>;

function createDeps(
  options: {
    fsOverrides?: FsOverrides;
    overrides?: Partial<Omit<ExportFullBackupDeps, "fs">>;
  } = {},
) {
  const calls: string[] = [];
  const progress: Array<{ stage: string; percent: number; status: string; detail?: string }> = [];
  const writtenFiles: Array<{ path: string; content: string }> = [];

  const defaultFs: ExportFullBackupDeps["fs"] = {
    writeFile: async (filePath, content) => {
      calls.push(`writeFile:${filePath}`);
      writtenFiles.push({ path: filePath, content });
    },
    mkdir: async (dir) => {
      calls.push(`mkdir:${dir}`);
    },
    copyFile: async (src, dst) => {
      calls.push(`copyFile:${src}->${dst}`);
    },
    copyDirWithProgress: async (src, dst, onFile) => {
      calls.push(`copyDir:${src}->${dst}`);
      onFile(1, 1, "img.png");
    },
    createTempDir: async (prefix) => {
      calls.push(`createTempDir:${prefix}`);
      return TEMP_DIR;
    },
    removeDir: async (dir) => {
      calls.push(`removeDir:${dir}`);
    },
  };

  const deps: ExportFullBackupDeps = {
    getDataDir: () => DATA_DIR,
    getBackupStats: async () => {
      calls.push("getBackupStats");
      return STATS;
    },
    onProgress: (p) => {
      progress.push(p);
    },
    timestamp: () => TIMESTAMP,
    createZip: async (sourceDir, zipPath) => {
      calls.push(`createZip:${sourceDir}->${zipPath}`);
    },
    fs: { ...defaultFs, ...options.fsOverrides },
    ...options.overrides,
  };

  return { deps, calls, progress, writtenFiles };
}

describe("ExportFullBackupService", () => {
  it("happy path:按正确顺序执行,返回 ZIP 路径与统计", async () => {
    const { deps, calls } = createDeps();
    const result = await new ExportFullBackupService(deps).execute(EXPORT_DIR);

    const zipPath = path.join(EXPORT_DIR, `prompt-manager-backup-${TIMESTAMP}.zip`);
    expect(result).toEqual({ success: true, filePath: zipPath, stats: STATS });

    // 关键顺序:统计 → manifest 落盘 → 建库目录 → 复制数据库 → 复制图像 → 压缩
    expect(calls.indexOf("getBackupStats")).toBeLessThan(
      calls.indexOf(`writeFile:${path.join(TEMP_DIR, "manifest.json")}`),
    );
    expect(calls.indexOf(`writeFile:${path.join(TEMP_DIR, "manifest.json")}`)).toBeLessThan(
      calls.indexOf(
        `copyFile:${path.join(DATA_DIR, "prompt-manager.db")}->${path.join(TEMP_DIR, "database", "prompt-manager.db")}`,
      ),
    );
    expect(
      calls.indexOf(
        `copyDir:${path.join(DATA_DIR, "images")}->${path.join(TEMP_DIR, "files", "images")}`,
      ),
    ).toBeLessThan(calls.indexOf(`createZip:${TEMP_DIR}->${zipPath}`));
    // 临时目录最终清理
    expect(calls).toContain(`removeDir:${TEMP_DIR}`);
  });

  it("happy path:进度按阶段推进 0→100,图像数量进入详情", async () => {
    const { deps, progress } = createDeps();
    await new ExportFullBackupService(deps).execute(EXPORT_DIR);

    expect(progress.map((p) => p.percent)).toEqual([0, 5, 15, 15, 80, 80, 100]);
    expect(progress.map((p) => p.stage)).toEqual([
      "start",
      "manifest",
      "database",
      "images",
      "images",
      "compress",
      "complete",
    ]);
    expect(progress.find((p) => p.stage === "images")?.detail).toBe("共 5 个文件");
  });

  it("manifest 内容与统计一致,数据库/图像来自数据目录", async () => {
    const { deps, writtenFiles } = createDeps();
    await new ExportFullBackupService(deps).execute(EXPORT_DIR);

    const manifestFile = writtenFiles.find((f) => f.path.endsWith("manifest.json"));
    expect(manifestFile).toBeDefined();
    const manifest = JSON.parse(manifestFile!.content);
    expect(manifest.dataVersion).toBe(1);
    expect(manifest.contents).toEqual(STATS);
    expect(manifest.appName).toBe("prompt-manager");
  });

  it("压缩失败:错误传播,临时目录仍被清理,无完成进度", async () => {
    const { deps, calls, progress } = createDeps({
      fsOverrides: {},
      overrides: {
        createZip: async () => {
          calls.push("createZip:failed");
          throw new Error("zip failed");
        },
      },
    });

    await expect(new ExportFullBackupService(deps).execute(EXPORT_DIR)).rejects.toThrow(
      "zip failed",
    );

    expect(calls).toContain(`removeDir:${TEMP_DIR}`);
    expect(progress.some((p) => p.stage === "complete")).toBe(false);
  });
});
