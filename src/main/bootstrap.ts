/**
 * 应用引导
 * 窗口/托盘创建、应用生命周期、单实例锁、重启逻辑。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import path from "path";
import { promises as fs } from "fs";
import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  session,
} from "electron";
import { spawn } from "child_process";
import * as db from "./database.js";
import { logError, logWarn, initLogger } from "./mainLogger.js";
import { getDataDir, getMainWindow, isProduction, isTestMode, ROOT_DIR, setMainWindow, setTray, setCurrentDataDir } from "./runtime.js";
import { initTagsCache } from "./infrastructure/tagCache.js";

/**
 * 创建主窗口
 */
export function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "PromptManager",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "..", "preload", "index.js"),
    },
    frame: true,
    show: false,
    fullscreenable: true,
    icon: path.join(__dirname, "..", "..", "assets", "icon.ico"),
  });

  setMainWindow(mainWindow);

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    if (!getMainWindow()) return;
    mainWindow.show();
    // 隐藏菜单栏
    mainWindow.setMenuBarVisibility(false);
    Menu.setApplicationMenu(null);
    // 最大化窗口（保留标题栏和关闭按钮）
    mainWindow.maximize();
  });

  // 注册 F12 快捷键打开/关闭开发者工具
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && !input.alt && !input.control && !input.meta && !input.shift) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
      event.preventDefault();
    }
  });

  // 拦截关闭事件，最小化到托盘（测试模式下直接关闭）
  mainWindow.on("close", (event) => {
    if (!app.isQuiting && !isTestMode) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    setMainWindow(null);
  });

  // 创建系统托盘（测试模式下不创建）
  if (!isTestMode) {
    createTray();
  }
}

/**
 * 执行构建命令
 * @returns Promise<boolean> 构建是否成功
 */
async function runBuild(): Promise<boolean> {
  return new Promise((resolve) => {
    // 使用 pnpm run build 进行构建
    const buildProcess = spawn("pnpm", ["run", "build"], {
      cwd: ROOT_DIR,
      shell: true,
      stdio: "pipe",
    });

    let errorOutput = "";

    buildProcess.stdout.on("data", (_data) => {
      // 忽略标准输出
    });

    buildProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    buildProcess.on("close", (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        logError("Main", `构建失败，退出码: ${code}`, { error: errorOutput });
        resolve(false);
      }
    });

    buildProcess.on("error", (err) => {
      logError("Main", "构建进程启动失败", err);
      resolve(false);
    });
  });
}

/**
 * 重启应用
 * 统一的重启逻辑，供托盘菜单和IPC调用
 * @param {string} oldDataDir - 旧的数据库目录路径（可选）
 * @param {boolean} skipBuild - 是否跳过构建（可选，默认false）
 */
export async function relaunchApp(oldDataDir?: string, skipBuild = false) {
  app.isQuiting = true;

  // 如果不是生产环境且未指定跳过构建，则先执行构建
  if (!isProduction && !skipBuild) {
    const buildSuccess = await runBuild();
    if (!buildSuccess) {
      logWarn("Main", "构建失败，但仍将继续重启");
    }
  }

  const args = process.argv
    .slice(1)
    .filter((arg) => !arg.startsWith("--relaunch") && !arg.startsWith("--old-data-dir"))
    .concat(["--relaunch"]);
  if (oldDataDir) {
    args.push(`--old-data-dir=${oldDataDir}`);
  }
  app.relaunch({ args });
  app.quit();
}

/**
 * 创建系统托盘图标和菜单
 */
function createTray() {
  // 从文件加载图标
  const iconPath = path.join(__dirname, "..", "..", "assets", "icon.ico");
  const tray = new Tray(iconPath);
  setTray(tray);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示主窗口",
      click: () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "重启",
      click: async () => {
        await relaunchApp();
      },
    },
    {
      label: "退出",
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Prompt Manager");
  tray.setContextMenu(contextMenu);

  // 点击托盘图标显示窗口
  tray.on("click", () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

/**
 * 启动应用：单实例锁、生命周期监听、whenReady 初始化
 */
export function startApp() {
  // 请求单实例锁
  const enableSingleInstance = process.env.E2E_SINGLE_INSTANCE !== "false";
  const gotTheLock = enableSingleInstance ? app.requestSingleInstanceLock() : true;

  if (!gotTheLock) {
    logError("Main", "Another instance is already running. Quitting...");
    app.quit();
  }

  // 当尝试运行第二个实例时，聚焦到第一个实例的窗口
  if (enableSingleInstance) {
    app.on("second-instance", (_event, _commandLine, _workingDirectory) => {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  app.whenReady().then(async () => {
    // 获取数据目录
    setCurrentDataDir(getDataDir());

    // 初始化日志系统
    initLogger(ROOT_DIR);

    // 初始化数据库
    try {
      await db.initDatabase(getDataDir());
    } catch (err) {
      logError("Main", "Failed to initialize database:", err);
    }

    // 初始化标签缓存
    await initTagsCache();

    // 配置 CSP（Content Security Policy）
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' file: data:",
            "connect-src 'self'",
            "font-src 'self'",
            "object-src 'none'",
            "frame-ancestors 'none'",
          ].join("; "),
        },
      });
    });

    // 设置应用图标（Windows 任务栏）
    const iconPath = path.join(__dirname, "..", "..", "assets", "icon.ico");
    try {
      await fs.access(iconPath);
      app.setAppUserModelId("com.promptmanager.app");
      // 设置应用图标
      const nativeIcon = nativeImage.createFromPath(iconPath);
      if (!nativeIcon.isEmpty()) {
        app.dock?.setIcon?.(nativeIcon);
      }
    } catch {
      // 图标不存在，忽略
    }

    // 创建主窗口
    createWindow();
  });

  app.on("window-all-closed", () => {
    // 测试模式下直接退出，不保留托盘
    if (isTestMode || process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
