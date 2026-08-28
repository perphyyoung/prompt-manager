/**
 * 主进程运行时状态
 * 集中管理原先散落在 index.ts 顶层的模块级状态，通过访问器读写，
 * 避免 router / infrastructure 直接耦合可变全局变量。
 */

import path from "path";
import type { BrowserWindow, Tray } from "electron";
import { app } from "electron";

// 扩展 Electron.App 类型
declare global {
  namespace Electron {
    interface App {
      isQuiting?: boolean;
    }
  }
}

// 检测是否为生产环境（打包后的应用）
// 打包后 __dirname 包含 app.asar，开发环境不包含
export const isProduction = __dirname.includes("app.asar");

// 项目根目录（基于 __dirname 反向推导：out/main/ -> 项目根目录）
export const ROOT_DIR = path.join(__dirname, "..", "..");

// 默认数据目录（生产环境使用用户数据目录下的 py-data，开发环境使用项目根目录）
const DEFAULT_DATA_DIR = isProduction
  ? path.join(app.getPath("userData"), "py-data")
  : path.join(ROOT_DIR, "py-data");

// 检测是否为测试模式
export const isTestMode = process.env.PLAYWRIGHT_TEST === "true" || process.env.NODE_ENV === "test";

// 检测是否为 E2E 测试模式（使用独立的数据目录）
const e2eTestDataDir = process.env.E2E_TEST_DATA_DIR;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentDataDir = DEFAULT_DATA_DIR;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

export function getTray(): Tray | null {
  return tray;
}

export function setTray(nextTray: Tray | null): void {
  tray = nextTray;
}

export function getCurrentDataDir(): string {
  return currentDataDir;
}

export function setCurrentDataDir(dataDir: string): void {
  currentDataDir = dataDir;
}

/**
 * 获取数据目录路径
 * E2E 测试模式下使用独立的数据目录
 * @returns {string} 数据目录路径
 */
export function getDataDir(): string {
  if (e2eTestDataDir) {
    return e2eTestDataDir;
  }
  return DEFAULT_DATA_DIR;
}
