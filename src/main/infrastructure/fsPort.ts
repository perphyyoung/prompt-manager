/**
 * node fs 语义端口
 * "node fs 语义 → 用例端口语义"的翻译收敛于此,供所有 application 用例服务共用;
 * 服务侧用窄类型声明自己需要的子集,结构化类型保证本全量实现自动满足。
 */

import { promises as fs } from "fs";
import { copyDirectoryWithProgress } from "../../utils/FileUtils.js";
import { createTempDir, createZipArchive, extractZipArchive, removeDirectory } from "./backup.js";

export const nodeFsPort = {
  /** 以 utf8 读取文本文件 */
  readFile: async (filePath: string) => (await fs.readFile(filePath, "utf8")) as string,
  /** 以 utf8 写入文本文件 */
  writeFile: async (filePath: string, content: string) => {
    await fs.writeFile(filePath, content, "utf8");
  },
  copyFile: async (src: string, dst: string) => {
    await fs.copyFile(src, dst);
  },
  rename: async (from: string, to: string) => {
    await fs.rename(from, to);
  },
  /** 递归创建目录 */
  mkdir: async (dir: string) => {
    await fs.mkdir(dir, { recursive: true });
  },
  unlink: async (filePath: string) => {
    await fs.unlink(filePath);
  },
  /** 递归删除目录 */
  removeDir: async (dir: string) => {
    await removeDirectory(dir);
  },
  createTempDir,
  extractZip: extractZipArchive,
  createZip: createZipArchive,
  copyDirWithProgress: async (
    src: string,
    dst: string,
    onFile: (copied: number, total: number, fileName: string) => void,
  ) => {
    await copyDirectoryWithProgress(src, dst, { onProgress: onFile });
  },
} as const;
