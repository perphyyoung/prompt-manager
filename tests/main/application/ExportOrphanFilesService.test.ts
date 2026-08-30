import path from "path";
import { describe, it, expect } from "vitest";
import {
  ExportOrphanFilesService,
  type ExportOrphanFilesDeps,
} from "../../../src/main/application/ExportOrphanFilesService.js";
import type { IOrphanFile, IScanOrphanFilesResult } from "../../../src/types/entities.js";

const EXPORT_DIR = "D:/orphan-out";
const TIMESTAMP = 1756440000000;
const EXPORT_SUBDIR = path.join(EXPORT_DIR, `orphan_files_${TIMESTAMP}`);

function orphan(fullPath: string): IOrphanFile {
  return { fullPath, relativePath: `images/${fullPath.split(/[\\/]/).pop()}`, size: 10 };
}

function scanResult(
  orphanImages: IOrphanFile[],
  orphanThumbnails: IOrphanFile[],
): IScanOrphanFilesResult {
  return {
    orphanImages,
    orphanThumbnails,
    orphanImageCount: orphanImages.length,
    orphanThumbnailCount: orphanThumbnails.length,
    orphanImageSize: "1.00",
    orphanThumbnailSize: "0.10",
    totalCount: orphanImages.length + orphanThumbnails.length,
    totalSize: "1.10",
  };
}

type FsOverrides = Partial<ExportOrphanFilesDeps["fs"]>;

function createDeps(options: { scan?: IScanOrphanFilesResult; fsOverrides?: FsOverrides } = {}) {
  const calls: string[] = [];

  const deps: ExportOrphanFilesDeps = {
    scanOrphanFiles: async () => {
      calls.push("scanOrphanFiles");
      return (
        options.scan ??
        scanResult(
          [orphan("D:/data/images/a.png"), orphan("D:/data/images/b.png")],
          [orphan("D:/data/thumbnails/thumb_a.jpg")],
        )
      );
    },
    timestamp: () => TIMESTAMP,
    fs: {
      mkdir: async (dir) => {
        calls.push(`mkdir:${dir}`);
      },
      copyFile: async (src, dst) => {
        calls.push(`copyFile:${src}->${dst}`);
      },
      unlink: async (filePath) => {
        calls.push(`unlink:${filePath}`);
      },
      ...options.fsOverrides,
    },
  };

  return { deps, calls };
}

describe("ExportOrphanFilesService", () => {
  it("无孤儿文件:直接返回全零结果,不建目录", async () => {
    const { deps, calls } = createDeps({ scan: scanResult([], []) });

    const result = await new ExportOrphanFilesService(deps).execute(EXPORT_DIR);

    expect(result).toEqual({
      successCount: 0,
      failedCount: 0,
      exportCount: 0,
      deletedCount: 0,
      exportPath: "",
    });
    expect(calls).not.toContain(`mkdir:${EXPORT_SUBDIR}`);
  });

  it("happy path:图像复制后删除、缩略图只删除,计数正确", async () => {
    const { deps, calls } = createDeps();

    const result = await new ExportOrphanFilesService(deps).execute(EXPORT_DIR);

    expect(result).toEqual({
      successCount: 3,
      failedCount: 0,
      exportCount: 2,
      deletedCount: 3,
      exportPath: EXPORT_SUBDIR,
    });
    // 先建目录,再逐个处理
    expect(calls.indexOf(`mkdir:${EXPORT_SUBDIR}`)).toBe(1);
    // 图像:复制到导出目录后删除源文件
    expect(calls).toContain(`copyFile:D:/data/images/a.png->${path.join(EXPORT_SUBDIR, "a.png")}`);
    expect(calls).toContain(`unlink:D:/data/images/a.png`);
    // 缩略图:直接删除,不导出
    expect(calls).toContain(`unlink:D:/data/thumbnails/thumb_a.jpg`);
    expect(calls.some((c) => c.startsWith("copyFile:D:/data/thumbnails"))).toBe(false);
  });

  it("单个图像复制失败:计入 failedCount 且不删除源文件,其余文件继续处理", async () => {
    const { deps, calls } = createDeps({
      fsOverrides: {
        copyFile: async (src) => {
          if (src.endsWith("a.png")) throw new Error("EBUSY");
        },
      },
    });

    const result = await new ExportOrphanFilesService(deps).execute(EXPORT_DIR);

    expect(result.failedCount).toBe(1);
    expect(result.successCount).toBe(2);
    // 失败文件未被删除,后续文件未受影响
    expect(calls).not.toContain(`unlink:D:/data/images/a.png`);
    expect(calls).toContain(`unlink:D:/data/images/b.png`);
  });

  it("复制成功但删除失败:exportCount 已计(文件确实导出),该文件计入 failedCount", async () => {
    const { deps } = createDeps({
      fsOverrides: {
        unlink: async (filePath) => {
          if (filePath.endsWith("a.png")) throw new Error("EBUSY");
        },
      },
    });

    const result = await new ExportOrphanFilesService(deps).execute(EXPORT_DIR);

    expect(result.exportCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.successCount).toBe(2);
  });
});
