import { expect } from "@playwright/test";
import { existsSync, copyFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { test } from "./electron-test.ts";

/**
 * 导出并删除孤儿文件 E2E 测试
 *
 * 验证行为：
 * - 原图像被导出到指定目录，随后从数据目录删除
 * - 缩略图不导出，直接从数据目录删除
 */

test.describe("设置界面导出并删除孤儿文件", () => {
  test("导出原图像并删除，缩略图直接删除", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    const factory = electronTest.getApiFactory();

    // 1. 创建一个正常图像，用于生成物理文件
    const image = await factory.createImageFactory().create({ label: "orphan-source" });

    // 2. 获取该图像的完整物理路径，并推断数据目录根路径
    const sourceImagePath = await page.evaluate(async (relativePath: string) => {
      return await window.electronAPI.getImagePath(relativePath);
    }, image.relativePath);

    // sourceImagePath 形如 .../py-data/images/202603/file.png
    // 两次 dirname 后得到 images 目录，再上一级是数据目录根
    const imagesDir = dirname(dirname(sourceImagePath));
    const dataDir = dirname(imagesDir);
    const orphanImageName = `orphan_${Date.now()}.png`;
    const orphanImagePath = join(imagesDir, orphanImageName);
    const orphanThumbnailPath = join(dataDir, "thumbnails", orphanImageName);

    // 3. 创建一个不在数据库中的原图像孤儿文件
    copyFileSync(sourceImagePath, orphanImagePath);

    // 4. 创建一个不在数据库中的缩略图孤儿文件
    mkdirSync(join(dataDir, "thumbnails"), { recursive: true });
    copyFileSync(sourceImagePath, orphanThumbnailPath);

    // 5. 扫描确认发现 2 个孤儿文件
    const scanResult = await page.evaluate(async () => {
      return await window.electronAPI.scanOrphanFiles();
    });
    expect(scanResult.totalCount).toBe(2);

    // 6. 创建临时导出目录并执行导出并删除
    const exportBaseDir = mkdtempSync(join(tmpdir(), "orphan-export-"));
    const result = await page.evaluate(async (dir: string) => {
      return await window.electronAPI.exportOrphanFiles(dir);
    }, exportBaseDir);
    expect(result.successCount).toBe(2);
    expect(result.exportCount).toBe(1);
    expect(result.deletedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.exportPath).toContain(exportBaseDir);

    // 7. 验证原图像已导出到目标目录
    const exportedImagePath = join(result.exportPath, orphanImageName);
    expect(existsSync(exportedImagePath)).toBe(true);

    // 8. 验证源文件已从数据目录删除
    expect(existsSync(orphanImagePath)).toBe(false);
    expect(existsSync(orphanThumbnailPath)).toBe(false);
  });
});
