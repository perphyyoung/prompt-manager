/**
 * Prompt Manager - Electron 主进程
 * 负责窗口管理、文件系统操作、IPC 通信
 */

import { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, clipboard, session } from 'electron';

// 扩展 Electron.App 类型
declare global {
  namespace Electron {
    interface App {
      isQuiting?: boolean;
    }
  }
}
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import os from 'os';
import sharp from 'sharp';
import crypto from 'crypto';
import { spawn } from 'child_process';
import * as db from './database.js';
import { generatePromptId, generateImageId } from '../utils/idGenerator.js';
import { getFormattedLocalTimeToSecond, getFormattedYearMonth, localTime } from '../utils/index.js';
import { logInfo, logDebug, logError, logWarn, initLogger } from './logger.js';
import { Constants } from '../constants.ts';
import { copyDirectory, copyDirectoryWithProgress } from '../utils/FileUtils.js';
import { ConfigManager, AppConfig } from './ConfigManager.js';

// 检测是否为生产环境（打包后的应用）
// 打包后 __dirname 包含 app.asar，开发环境不包含
const isProduction = __dirname.includes('app.asar');

// 项目根目录（基于 __dirname 反向推导：out/main/ -> 项目根目录）
const ROOT_DIR = path.join(__dirname, '..', '..');

// 配置文件路径（生产环境使用应用安装目录，开发环境使用项目根目录）
const CONFIG_FILE = isProduction
  ? path.join(path.dirname(app.getPath('exe')), 'config.json')
  : path.join(ROOT_DIR, 'config.json');

// 默认数据目录（生产环境使用应用安装目录下的 data 文件夹，开发环境使用项目根目录）
const DEFAULT_DATA_DIR = isProduction
  ? path.join(path.dirname(app.getPath('exe')), 'data')
  : path.join(ROOT_DIR, 'py-data');

// 初始化配置管理器
const configManager = new ConfigManager(CONFIG_FILE, isProduction ? path.dirname(app.getPath('exe')) : ROOT_DIR);

let mainWindow: BrowserWindow | null = null;
let tray = null;
let currentDataDir = DEFAULT_DATA_DIR;
let pendingOldDataDir: string | null = null;

// 标签缓存（用于自动完成功能）
let allTagsCache: string[] | null = null;

// 检测是否为测试模式
const isTestMode = process.env.PLAYWRIGHT_TEST === 'true' || process.env.NODE_ENV === 'test';

// 检测是否为 E2E 测试模式（使用独立的数据目录）
const e2eTestDataDir = process.env.E2E_TEST_DATA_DIR;

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(1);
  pendingOldDataDir = null;
  for (const arg of args) {
    if (arg.startsWith('--old-data-dir=')) {
      pendingOldDataDir = arg.split('=')[1];
    }
  }
}

parseArgs();

/**
 * 加载应用配置
 * 从 config.json 读取数据目录设置
 * E2E 测试模式下使用独立的数据目录
 * @returns {Promise<{rootDir: string, dataDir: string}>} 配置对象
 */
async function loadConfig() {
  // E2E 测试模式下使用独立的数据目录
  if (e2eTestDataDir) {
    currentDataDir = e2eTestDataDir;
    // E2E 测试模式下，日志写入项目根目录，便于查看
    const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
    return { rootDir: projectRoot, dataDir: e2eTestDataDir };
  }
  
  const config = await configManager.loadConfig();
  currentDataDir = config.dataDir;
  return config;
}

/**
 * 保存应用配置
 * @param {Object} config - 配置对象
 * @param {boolean} merge - 是否合并现有配置
 */
async function saveConfig(config: Partial<AppConfig>, merge = false) {
  await configManager.saveConfig(config, merge);
  if (config.dataDir) {
    currentDataDir = config.dataDir;
  }
}

/**
 * 迁移数据到新的数据目录
 * @param {string} oldDir - 旧数据目录
 * @param {string} newDir - 新数据目录
 * @returns {Promise<boolean>} 是否成功
 */
async function migrateData(oldDir: string, newDir: string) {
  try {
    // 检查旧目录是否存在
    try {
      await fs.access(oldDir);
    } catch {
      // 旧目录不存在，无需迁移
      return true;
    }

    // 清空新目录并复制数据
    await fs.rm(newDir, { recursive: true, force: true });
    await fs.mkdir(newDir, { recursive: true });
    await copyDirectory(oldDir, newDir);
    return true;
  } catch (err) {
    logError('Main', 'Data migration failed', err);
    return false;
  }
}

/**
 * 获取图像存储目录路径
 * @returns {string} images 目录路径
 */
function getImagesDir() {
  return path.join(currentDataDir, 'images');
}

/**
 * 获取缩略图存储目录路径
 * @returns {string} thumbnails 目录路径
 */
function getThumbnailsDir() {
  return path.join(currentDataDir, 'thumbnails');
}

/**
 * 确保图像目录存在
 * @param {string} subDir - 子目录（如年月：202603）
 * @returns {string} 图像目录路径
 */
async function ensureImagesDir(subDir = '') {
  const imagesDir = subDir ? path.join(getImagesDir(), subDir) : getImagesDir();
  try {
    await fs.access(imagesDir);
  } catch {
    await fs.mkdir(imagesDir, { recursive: true });
  }
  return imagesDir;
}

/**
 * 确保缩略图目录存在
 * @param {string} subDir - 子目录（如年月：202603）
 * @returns {string} 缩略图目录路径
 */
async function ensureThumbnailsDir(subDir = '') {
  const thumbnailsDir = subDir ? path.join(getThumbnailsDir(), subDir) : getThumbnailsDir();
  try {
    await fs.access(thumbnailsDir);
  } catch {
    await fs.mkdir(thumbnailsDir, { recursive: true });
  }
  return thumbnailsDir;
}

/**
 * 计算文件的 MD5 哈希值
 * @param {string} filePath - 文件路径
 * @returns {string} MD5 哈希值
 */
async function calculateFileMD5(filePath: string): Promise<string | null> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  } catch (error) {
    logError('Main', 'Failed to calculate MD5:', error);
    return null;
  }
}

/**
 * 查找已存在的图像（通过 MD5）
 * @param {string} md5 - 图像 MD5 值
 * @param {Array} images - 所有图像数据
 * @returns {Object|null} 已存在的图像信息
 */

/**
 * 生成图像缩略图
 * @param {string} imagePath - 原图像路径
 * @param {string} storedName - 存储的文件名
 * @param {string} subDir - 子目录（如年月：202603）
 * @returns {Object|null} 缩略图信息对象
 */
async function generateThumbnail(imagePath: string, storedName: string, subDir = ''): Promise<{ thumbnailName: string; thumbnailPath: string; relativePath: string } | null> {
  try {
    const thumbnailsDir = await ensureThumbnailsDir(subDir);
    const ext = path.extname(storedName) || '.png';
    const thumbnailName = `thumb_${path.basename(storedName, ext)}.jpg`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailName);

    // 检查缩略图是否已存在
    try {
      await fs.access(thumbnailPath);
      return {
        thumbnailName,
        thumbnailPath,
        relativePath: subDir ? 'thumbnails/' + subDir + '/' + thumbnailName : 'thumbnails/' + thumbnailName
      };
    } catch {
      // 缩略图不存在，需要生成
    }

    // 使用 sharp 生成缩略图
    await sharp(imagePath)
      .resize(200, 200, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    return {
      thumbnailName,
      thumbnailPath,
      relativePath: subDir ? 'thumbnails/' + subDir + '/' + thumbnailName : 'thumbnails/' + thumbnailName
    };
  } catch (error) {
    logError('Main', 'Failed to generate thumbnail:', error);
    return null;
  }
}

/**
 * 重新生成所有图像的缩略图
 * 用于导入备份后恢复缩略图
 * @param {Function} onProgress - 进度回调函数 (current, total, fileName) => void
 * @param {number} concurrency - 并发数，默认 5
 */
async function regenerateAllThumbnails(onProgress: ((current: number, total: number, fileName: string) => void) | null = null, concurrency = 5) {
  try {
    // 获取所有图像
    const images = await db.getAllImages();
    const total = images.length;

    if (total === 0) {
      logInfo('Main', 'No images to regenerate thumbnails');
      return { success: true, regenerated: 0, total: 0 };
    }

    logInfo('Main', `Starting to regenerate thumbnails for ${total} images with concurrency ${concurrency}`);

    let completed = 0;
    let regenerated = 0;
    let failed = 0;
    const updates: Array<{ id: string; thumbnailPath: string }> = [];

    // 处理单个图像的缩略图生成
    async function processImage(image: { id: string; relativePath: string; storedName: string; fileName: string }): Promise<{ success: boolean; image: { id: string; relativePath: string; storedName: string; fileName: string } }> {
      try {
        // 构建原图路径
        const imagePath = path.join(currentDataDir, image.relativePath);

        // 检查原图是否存在
        try {
          await fs.access(imagePath);
        } catch {
          logWarn('Main', `Image file not found: ${imagePath}`);
          return { success: false, image };
        }

        // 从 relativePath 提取年月子目录
        const pathParts = image.relativePath.split('/');
        const subDir = pathParts.length >= 2 ? pathParts[1] : '';

        // 重新生成缩略图
        const thumbnailInfo = await generateThumbnail(imagePath, image.storedName, subDir);

        if (thumbnailInfo) {
          // 收集更新数据，稍后批量更新
          updates.push({
            id: image.id,
            thumbnailPath: thumbnailInfo.relativePath
          });
          return { success: true, image };
        } else {
          return { success: false, image };
        }
      } catch (error) {
        logError('Main', `Failed to regenerate thumbnail for image ${image.id}:`, error);
        return { success: false, image };
      }
    }

    // 分批处理，控制并发数
    for (let i = 0; i < images.length; i += concurrency) {
      const batch = images.slice(i, i + concurrency);
      const results = await Promise.all(batch.map(img => processImage(img)));

      // 统计结果
      for (const result of results) {
        completed++;
        if (result.success) {
          regenerated++;
        } else {
          failed++;
        }

        // 报告进度
        if (onProgress) {
          onProgress(completed, total, result.image.fileName);
        }
      }
    }

    // 批量更新数据库
    if (updates.length > 0) {
      logInfo('Main', `Batch updating ${updates.length} thumbnail records`);
      await db.updateImagesBatch(updates);
    }

    logInfo('Main', `Thumbnail regeneration complete: ${regenerated} succeeded, ${failed} failed`);
    return { success: true, regenerated, failed, total };
  } catch (error) {
    logError('Main', 'Failed to regenerate all thumbnails:', error);
    throw error;
  }
}

/**
 * 保存图像文件到数据目录
 * 通过 MD5 检测避免重复存储相同图像
 * 图像信息单独存储到 images.json
 * @param {string} sourcePath - 源文件路径
 * @param {string} fileName - 原始文件名
 * @returns {Object} 保存后的图像信息
 */
async function saveImageFile(sourcePath: string, fileName: string): Promise<{ id: string; fileName: string; isDuplicate: boolean; duplicateType?: 'restored_from_trash' | 'existing' }> {
  // 计算源文件 MD5
  const sourceMD5 = await calculateFileMD5(sourcePath);
  if (!sourceMD5) {
    throw new Error('Failed to calculate MD5');
  }

  // 检查是否已存在相同 MD5 的图像（包括回收站中的）
  const existingImage = await db.getImageByMD5IncludeTrash(sourceMD5);
  if (existingImage) {
    // 如果图像在回收站中，自动恢复
    if (existingImage.isDeleted) {
      await db.restoreImage(existingImage.id);
      logInfo('Main', `Image was in trash, auto-restored: ${fileName}`);
      const result: { id: string; fileName: string; isDuplicate: boolean; duplicateType: 'restored_from_trash' } = {
        id: existingImage.id,
        fileName: fileName,
        isDuplicate: true,
        duplicateType: 'restored_from_trash'
      };
      return result;
    }

    logWarn('Found duplicate image by MD5, reusing:', fileName);
    const result: { id: string; fileName: string; isDuplicate: boolean; duplicateType: 'existing' } = {
      id: existingImage.id,
      fileName: fileName,
      isDuplicate: true,
      duplicateType: 'existing'
    };
    return result;
  }

  // 生成图像 ID
  const imageId = generateImageId();
  // 生成年月子目录（格式：202603）
  const yearMonth = getFormattedYearMonth();
  const imagesDir = await ensureImagesDir(yearMonth);

  const ext = path.extname(fileName) || '.png';
  const uniqueName = imageId + ext;
  const targetPath = path.join(imagesDir, uniqueName);

  await fs.copyFile(sourcePath, targetPath);

  // 获取图像尺寸和文件大小
  let width = null;
  let height = null;
  let fileSize = 0;
  try {
    const metadata = await sharp(targetPath).metadata();
    width = metadata.width;
    height = metadata.height;
    const stats = await fs.stat(targetPath);
    fileSize = stats.size;
  } catch (error) {
    logError('Main', 'Failed to get image info:', error);
  }

  // 生成缩略图（传入年月子目录）
  const thumbnailInfo = await generateThumbnail(targetPath, uniqueName, yearMonth);

  // 构建图像信息对象
  const imageInfo = {
    id: imageId,
    fileName: fileName,
    storedName: uniqueName,
    relativePath: 'images/' + yearMonth + '/' + uniqueName,
    thumbnailPath: thumbnailInfo ? thumbnailInfo.relativePath : null,
    md5: sourceMD5,
    width: width,
    height: height,
    fileSize: fileSize
  };

  // 保存到数据库
  await db.addImage(imageInfo);

  // 返回简化版信息（只包含 ID 和文件名）
  return {
    id: imageId,
    fileName: fileName,
    isDuplicate: false
  };
}

/**
 * 初始化标签缓存
 * 应用启动时从数据库加载所有标签
 */
async function initTagsCache() {
  try {
    allTagsCache = await db.getAllTags();
  } catch (error) {
    logError('Main', 'Failed to initialize tags cache:', error);
    allTagsCache = [];
  }
}

/**
 * 更新标签缓存（添加新标签）
 * @param {string} tagName - 标签名称
 */
function addTagToCache(tagName: string) {
  if (allTagsCache && !allTagsCache.includes(tagName)) {
    allTagsCache.push(tagName);
    allTagsCache.sort();
  }
}

/**
 * 批量更新标签缓存
 * @param {Array<string>} tagNames - 标签名称数组
 */
function addTagsToCache(tagNames: string[]) {
  if (!allTagsCache) return;
  let updated = false;
  for (const tagName of tagNames) {
    if (!allTagsCache.includes(tagName)) {
      allTagsCache.push(tagName);
      updated = true;
    }
  }
  if (updated) {
    allTagsCache.sort();
  }
}

/**
 * 创建主窗口
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'PromptManager',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload', 'index.js')
    },
    frame: true,
    show: false,
    fullscreenable: true,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.ico')
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    mainWindow.show();
    // 隐藏菜单栏
    mainWindow.setMenuBarVisibility(false);
    Menu.setApplicationMenu(null);
    // 最大化窗口（保留标题栏和关闭按钮）
    mainWindow.maximize();
  });

  // 注册 F12 快捷键打开/关闭开发者工具
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!mainWindow) return;
    if (input.key === 'F12' && !input.alt && !input.control && !input.meta && !input.shift) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
      event.preventDefault();
    }
  });

  // 拦截关闭事件，最小化到托盘（测试模式下直接关闭）
  mainWindow.on('close', (event) => {
    if (!mainWindow) return;
    if (!app.isQuiting && !isTestMode) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
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

    // 使用 npm run build 进行构建
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: ROOT_DIR,
      shell: true,
      stdio: 'pipe'
    });

    let errorOutput = '';

    buildProcess.stdout.on('data', (_data) => {
      // 忽略标准输出
    });

    buildProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        logError('Main', `构建失败，退出码: ${code}`, { error: errorOutput });
        resolve(false);
      }
    });

    buildProcess.on('error', (err) => {
      logError('Main', '构建进程启动失败', err);
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
async function relaunchApp(oldDataDir?: string, skipBuild = false) {
  app.isQuiting = true;

  // 如果不是生产环境且未指定跳过构建，则先执行构建
  if (!isProduction && !skipBuild) {
    const buildSuccess = await runBuild();
    if (!buildSuccess) {
      logWarn('Main', '构建失败，但仍将继续重启');
    }
  }

  const args = process.argv.slice(1)
    .filter(arg => !arg.startsWith('--relaunch') && !arg.startsWith('--old-data-dir'))
    .concat(['--relaunch']);
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
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.ico');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '重启',
      click: async () => {
        await relaunchApp();
      }
    },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Prompt Manager');
  tray.setContextMenu(contextMenu);

  // 点击托盘图标显示窗口
  tray.on('click', () => {
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

// IPC 处理器

// 获取所有 Prompts
ipcMain.handle('get-prompts', async (event, sortBy, sortOrder) => {
  return await db.getPrompts(sortBy, sortOrder);
});

// 添加 Prompt
ipcMain.handle('add-prompt', async (event, prompt) => {
  const newPrompt = {
    id: generatePromptId(),
    ...prompt
  };
  // 如果没有提供标题，使用 ID 作为标题
  if (!newPrompt.title) {
    newPrompt.title = newPrompt.id;
  }
  return await db.addPrompt(newPrompt);
});

// 更新 Prompt
ipcMain.handle('update-prompt', async (event, id, updates) => {
  return await db.updatePrompt(id, updates);
});

// 软删除提示词（移动到回收站）
ipcMain.handle('soft-delete-prompt', async (event, id) => {
  return await db.deletePrompt(id);
});

// 批量软删除提示词
ipcMain.handle('soft-delete-prompts', async (event, ids) => {
  try {
    return await db.softDeletePrompts(ids);
  } catch (error) {
    logError('Main', 'Batch soft delete prompts error:', error);
    throw error;
  }
});

// 批量切换提示词收藏状态
ipcMain.handle('batch-favorite-prompts', async (event, ids) => {
  try {
    return await db.batchFavoritePrompts(ids);
  } catch (error) {
    logError('Main', 'Batch favorite prompts error:', error);
    throw error;
  }
});

// 检查标题是否已存在
ipcMain.handle('is-title-exists', async (event, title, excludeId) => {
  return await db.isTitleExists(title, excludeId);
});

// 获取提示词回收站
ipcMain.handle('get-prompt-trash', async () => {
  try {
    const deletedPrompts = await db.getDeletedPrompts();
    
    // 为提示词添加 type 字段
    return deletedPrompts.map(prompt => ({
      ...prompt,
      type: Constants.TrashType.PROMPT
    }));
  } catch (error) {
    logError('Main', 'Get prompt trash error:', error);
    throw error;
  }
});

// 从提示词回收站恢复
ipcMain.handle('restore-prompt-from-trash', async (event, id) => {
  try {
    await db.restorePrompt(id);
    return true;
  } catch (error) {
    logError('Main', 'Restore from trash error:', error);
    throw error;
  }
});

// 永久删除提示词
ipcMain.handle('permanent-delete-prompt', async (event, id) => {
  try {
    await db.permanentDeletePrompt(id);
    return true;
  } catch (error) {
    logError('Main', 'Permanent delete prompt error:', error);
    throw error;
  }
});

// 恢复所有提示词
ipcMain.handle('restore-all-prompts', async () => {
  try {
    await db.restoreAllPrompts();
    return true;
  } catch (error) {
    logError('Main', 'Restore all prompts error:', error);
    throw error;
  }
});

// 清空提示词回收站
ipcMain.handle('empty-prompt-trash', async () => {
  try {
    return await db.emptyPromptTrash();
  } catch (error) {
    logError('Main', 'Empty prompt trash error:', error);
    throw error;
  }
});

// ==================== 图像回收站 ====================

// 获取图像回收站列表
ipcMain.handle('get-image-trash', async () => {
  try {
    const deletedImages = await db.getDeletedImages();

    // 为图像添加 type 字段
    return deletedImages.map(image => ({
      ...image,
      type: Constants.TrashType.IMAGE
    }));
  } catch (error) {
    logError('Main', 'Get image trash error:', error);
    throw error;
  }
});

// 从回收站恢复图像
ipcMain.handle('restore-image-from-trash', async (event, id) => {
  try {
    await db.restoreImage(id);
    return true;
  } catch (error) {
    logError('Main', 'Restore image from trash error:', error);
    throw error;
  }
});

// 永久删除图像
ipcMain.handle('permanent-delete-image', async (event, id) => {
  try {
    await db.permanentDeleteImage(id, currentDataDir);
    return true;
  } catch (error) {
    logError('Main', 'Permanently delete image error:', error);
    throw error;
  }
});

// 恢复所有图像
ipcMain.handle('restore-all-images', async () => {
  try {
    await db.restoreAllImages();
    return true;
  } catch (error) {
    logError('Main', 'Restore all images error:', error);
    throw error;
  }
});

// 清空图像回收站
ipcMain.handle('empty-image-trash', async () => {
  try {
    await db.emptyImageTrash(currentDataDir);
    return true;
  } catch (error) {
    logError('Main', 'Empty image trash error:', error);
    throw error;
  }
});

// 软删除图像（移动到回收站）
ipcMain.handle('soft-delete-image', async (event, id) => {
  try {
    await db.softDeleteImage(id);
    return true;
  } catch (error) {
    logError('Main', 'Soft delete image error:', error);
    throw error;
  }
});

// 批量软删除图像
ipcMain.handle('soft-delete-images', async (event, ids) => {
  try {
    const result = await db.softDeleteImages(ids);
    return result;
  } catch (error) {
    logError('Main', 'Batch soft delete images error:', error);
    throw error;
  }
});

// 批量切换图像收藏状态
ipcMain.handle('batch-favorite-images', async (event, ids) => {
  try {
    return await db.batchFavoriteImages(ids);
  } catch (error) {
    logError('Main', 'Batch favorite images error:', error);
    throw error;
  }
});

// 重启应用
ipcMain.handle('relaunch-app', async (event, oldDataDir) => {
  await relaunchApp(oldDataDir);
});

// 获取所有提示词标签
ipcMain.handle('get-prompt-tags', async () => {
  try {
    return await db.getPromptTags();
  } catch (error) {
    logError('Main', 'Get prompt tags error:', error);
    throw error;
  }
});

// 添加提示词标签
ipcMain.handle('add-prompt-tag', async (event, tag) => {
  try {
    await db.addPromptTag(tag);
    // 更新缓存
    addTagToCache(tag);
    return await db.getPromptTags();
  } catch (error) {
    logError('Main', 'Add prompt tag error:', error);
    throw error;
  }
});

// 为提示词添加多个标签
ipcMain.handle('add-prompt-tags', async (event, promptId, tagNames) => {
  try {
    await db.addPromptTags(promptId, tagNames);
    // 批量更新缓存
    addTagsToCache(tagNames);
    return true;
  } catch (error) {
    logError('Main', 'Add prompt tags error:', error);
    throw error;
  }
});

// 删除提示词标签
ipcMain.handle('delete-prompt-tag', async (event, tag) => {
  try {
    // 从数据库删除标签（会级联删除关联关系）
    await db.deletePromptTag(tag);
    return await db.getPromptTags();
  } catch (error) {
    logError('Main', 'Delete prompt tag error:', error);
    throw error;
  }
});

// 批量删除提示词标签
ipcMain.handle('delete-prompt-tags', async (event, tags) => {
  try {
    const result = await db.deletePromptTags(tags);
    const remainingTags = await db.getPromptTags();
    return { ...result, tags: remainingTags };
  } catch (error) {
    logError('Main', 'Batch delete prompt tags error:', error);
    throw error;
  }
});

// 获取使用指定标签的提示词列表
ipcMain.handle('get-prompts-by-tag', async (event, tagName) => {
  try {
    return await db.getPromptsByTag(tagName);
  } catch (error) {
    logError('Main', 'Get prompts by tag error:', error);
    throw error;
  }
});

// 从提示词中移除标签
ipcMain.handle('remove-tag-from-prompt', async (event, promptId, tagName) => {
  try {
    await db.removeTagFromPrompt(promptId, tagName);
    return true;
  } catch (error) {
    logError('Main', 'Remove tag from prompt error:', error);
    throw error;
  }
});

// ==================== 提示词标签组 IPC ====================

// 获取所有提示词标签组（包含标签列表）
ipcMain.handle('get-prompt-tag-groups', async () => {
  try {
    return await db.getPromptTagGroups();
  } catch (error) {
    logError('Main', 'Get prompt tag groups error:', error);
    throw error;
  }
});

// 创建提示词标签组
ipcMain.handle('create-prompt-tag-group', async (event, name, sortOrder) => {
  try {
    return await db.createPromptTagGroup(name, sortOrder);
  } catch (error) {
    logError('Main', 'Create prompt tag group error:', error);
    throw error;
  }
});

// 更新提示词标签组属性
ipcMain.handle('update-prompt-tag-group-attrs', async (event, id, updates) => {
  try {
    return await db.updatePromptTagGroup(id, updates);
  } catch (error) {
    logError('Main', 'Update prompt tag group attrs error:', error);
    throw error;
  }
});

// 删除提示词标签组
ipcMain.handle('delete-prompt-tag-group', async (event, id) => {
  try {
    return await db.deletePromptTagGroup(id);
  } catch (error) {
    logError('Main', 'Delete prompt tag group error:', error);
    throw error;
  }
});

// 分配提示词标签到所属组
ipcMain.handle('assign-prompt-tag-to-belong-group', async (event, tagName, groupId) => {
  try {
    return await db.updatePromptTagGroupByTagName(tagName, groupId);
  } catch (error) {
    logError('Main', 'Assign prompt tag to belong group error:', error);
    throw error;
  }
});

// 重命名提示词标签
ipcMain.handle('rename-prompt-tag', async (event, oldTag, newTag) => {
  try {
    return await db.renameTag('prompt', oldTag, newTag);
  } catch (error) {
    logError('Main', 'Rename prompt tag error:', error);
    throw error;
  }
});

// 搜索 Prompts
ipcMain.handle('search-prompts', async (event, query) => {
  if (!query) return await db.getPrompts();
  return await db.searchPrompts(query);
});

// 导出 Prompts
ipcMain.handle('export-prompts', async (event, prompts) => {
  if (!mainWindow) throw new Error('Main window is not available');
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '导出 Prompts',
    defaultPath: 'prompts-backup.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });
  
  if (filePath) {
    await fs.writeFile(filePath, JSON.stringify(prompts, null, 2), 'utf8');
    return true;
  }
  return false;
});

// 导入 Prompts
ipcMain.handle('import-prompts', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: '导入 Prompts',
    filters: [
      { name: 'JSON Files', extensions: ['json'] }
    ],
    properties: ['openFile']
  });
  
  if (filePaths && filePaths.length > 0) {
    const data = await fs.readFile(filePaths[0], 'utf8');
    const imported = JSON.parse(data);
    
    // 导入数据到数据库
    const importedPrompts = [];
    for (const item of imported) {
      const newPrompt = {
        ...item,
        id: generatePromptId()
      };
      await db.addPrompt(newPrompt);
      importedPrompts.push(newPrompt);
    }
    
    return importedPrompts;
  }
  return null;
});

// 复制到剪贴板
ipcMain.handle('copy-to-clipboard', async (event, text) => {
  clipboard.writeText(text);
  return true;
});

// 设置全屏模式
ipcMain.handle('set-fullscreen', async (event, flag) => {
  if (mainWindow) {
    mainWindow.setFullScreen(flag);
    // 全屏时隐藏菜单栏，退出全屏时恢复
    if (flag) {
      mainWindow.setMenuBarVisibility(false);
    } else {
      mainWindow.setMenuBarVisibility(true);
    }
    return true;
  }
  return false;
});



// 获取当前数据路径
ipcMain.handle('get-data-path', async () => {
  return currentDataDir;
});

// 选择新的数据路径
ipcMain.handle('select-data-path', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择数据目录',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: currentDataDir
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const newPath = result.filePaths[0];

    // 如果路径改变，处理数据目录变更
    if (newPath !== currentDataDir) {
      const oldPath = currentDataDir;

      if (!mainWindow) throw new Error('Main window is not available');

      // 显示迁移对话框
      const migrateAction = await mainWindow.webContents.executeJavaScript(
        `window.dialogService?.showMigrateDialog(${JSON.stringify(oldPath)}, ${JSON.stringify(newPath)})`
      ).catch(() => null);

      if (!migrateAction || migrateAction === 'cancel') {
        // 用户取消或对话框调用失败
        return null;
      }

      // 更新配置（使用 merge=true 保留现有字段）
      currentDataDir = newPath;
      await saveConfig({ dataDir: newPath }, true);

      // 迁移数据（如果用户选择复制）
      if (migrateAction === 'copy') {
        const success = await migrateData(oldPath, newPath);
        if (!success) {
          // 迁移失败或用户取消，恢复旧配置
          currentDataDir = oldPath;
          await saveConfig({ dataDir: oldPath }, true);
          return null;
        }
      }

      // 无论选择复制还是直接使用新目录，都重启应用
      await relaunchApp();
    }
  }

  return null;
});

// 选择目录（通用）
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择导出目录',
    properties: ['openDirectory'],
    defaultPath: currentDataDir
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});

// 保存图像文件
ipcMain.handle('save-image-file', async (event, sourcePath, fileName) => {
  return await saveImageFile(sourcePath, fileName);
});

// 打开图像文件对话框（支持多选）
ipcMain.handle('dialog:open-image-files', async () => {
  // 测试 mock 优先（支持单路径或多路径）
  const mockPath = (global as any).__testMockedImageFilePath as string | undefined;
  const mockPaths = (global as any).__testMockedImageFilePaths as string[] | undefined;
  
  if (mockPaths && mockPaths.length > 0) {
    delete (global as any).__testMockedImageFilePaths; // 一次性使用
    return mockPaths;
  }
  
  if (mockPath) {
    delete (global as any).__testMockedImageFilePath; // 一次性使用
    return [mockPath];
  }

  const result = await dialog.showOpenDialog({
    title: '选择图像',
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections']
  });

  if (result.canceled) {
    return [];
  }

  // 路径安全验证：只允许本地文件路径（以盘符开头）
  const validatedPaths = (result.filePaths || []).filter(filePath => {
    // Windows: 检查是否为本地盘符路径（如 D:\, C:\）
    const isLocalPath = /^[a-zA-Z]:[\\/]/.test(filePath);
    if (!isLocalPath) {
      logWarn('Main', 'Path validation failed (not a local path):', filePath);
    }
    return isLocalPath;
  });

  return validatedPaths;
});

// 获取所有图像信息
ipcMain.handle('get-images', async (event, sortBy, sortOrder) => {
  try {
    return await db.getImages(sortBy, sortOrder);
  } catch (error) {
    logError('Main', 'Get images error:', error);
    throw error;
  }
});

// 根据 ID 批量获取图像信息
ipcMain.handle('get-images-by-ids', async (event, ids) => {
  try {
    return await db.getImagesByIds(ids);
  } catch (error) {
    logError('Main', 'Get images by ids error:', error);
    throw error;
  }
});

// 获取所有图像（用于统计）
ipcMain.handle('get-all-images-for-stats', async () => {
  try {
    return await db.getAllImages();
  } catch (error) {
    logError('Main', 'Get all images for stats error:', error);
    throw error;
  }
});

// 根据 ID 获取提示词信息
ipcMain.handle('get-prompt-by-id', async (event, promptId) => {
  try {
    return await db.getPromptById(promptId);
  } catch (error) {
    logError('Main', 'Get prompt by id error:', error);
    throw error;
  }
});

// 根据 ID 获取图像信息
ipcMain.handle('get-image-by-id', async (event, imageId) => {
  try {
    return await db.getImageById(imageId);
  } catch (error) {
    logError('Main', 'Get image by id error:', error);
    throw error;
  }
});

// 获取提示词关联的图像
ipcMain.handle('get-prompt-images', async (event, promptId) => {
  try {
    return await db.getPromptImages(promptId);
  } catch (error) {
    logError('Main', 'Get prompt images error:', error);
    throw error;
  }
});

// 获取所有图像标签
ipcMain.handle('get-image-tags', async () => {
  try {
    return await db.getImageTags();
  } catch (error) {
    logError('Main', 'Get image tags error:', error);
    throw error;
  }
});

// 添加图像标签
ipcMain.handle('add-image-tag', async (event, tag) => {
  try {
    await db.addImageTag(tag);
    // 更新缓存
    addTagToCache(tag);
    return await db.getImageTags();
  } catch (error) {
    logError('Main', 'Add image tag error:', error);
    throw error;
  }
});

// 为图像添加多个标签
ipcMain.handle('add-image-tags', async (event, imageId, tagNames) => {
  try {
    await db.addImageTags(imageId, tagNames);
    // 批量更新缓存
    addTagsToCache(tagNames);
    return true;
  } catch (error) {
    logError('Main', 'Add image tags error:', error);
    throw error;
  }
});

// 更新图像
ipcMain.handle('update-image', async (event, id, updates) => {
  try {
    return await db.updateImage(id, updates);
  } catch (error) {
    logError('Main', 'Update image error:', error);
    throw error;
  }
});

// 重命名图像标签
ipcMain.handle('rename-image-tag', async (event, oldTag, newTag) => {
  try {
    return await db.renameTag('image', oldTag, newTag);
  } catch (error) {
    logError('Main', 'Rename image tag error:', error);
    throw error;
  }
});

// 删除图像标签
ipcMain.handle('delete-image-tag', async (event, tag) => {
  try {
    // 获取所有图像
    const images = await db.getImages();

    // 从每个包含该标签的图像中移除
    for (const image of images) {
      if (image.tags && image.tags.includes(tag)) {
        const newTags = image.tags.filter(t => t !== tag);
        await db.updateImage(image.id, { tags: newTags });
      }
    }

    // 从全局标签列表中删除
    await db.deleteImageTag(tag);

    return true;
  } catch (error) {
    logError('Main', 'Delete image tag error:', error);
    throw error;
  }
});

// 批量删除图像标签
ipcMain.handle('delete-image-tags', async (event, tags) => {
  try {
    // 获取所有图像
    const images = await db.getImages();

    // 从每个图像中移除这些标签
    for (const image of images) {
      if (image.tags && image.tags.some(tag => tags.includes(tag))) {
        const newTags = image.tags.filter(t => !tags.includes(t));
        await db.updateImage(image.id, { tags: newTags });
      }
    }

    // 从全局标签列表中批量删除
    const result = await db.deleteImageTags(tags);

    return result;
  } catch (error) {
    logError('Main', 'Batch delete image tags error:', error);
    throw error;
  }
});

// 获取使用指定标签的图像列表
ipcMain.handle('get-images-by-tag', async (event, tagName) => {
  try {
    return await db.getImagesByTag(tagName);
  } catch (error) {
    logError('Main', 'Get images by tag error:', error);
    throw error;
  }
});

// 从图像中移除标签
ipcMain.handle('remove-tag-from-image', async (event, imageId, tagName) => {
  try {
    await db.removeTagFromImage(imageId, tagName);
    return true;
  } catch (error) {
    logError('Main', 'Remove tag from image error:', error);
    throw error;
  }
});

// ==================== 图像标签组 IPC ====================

// 获取所有图像标签组（包含标签列表）
ipcMain.handle('get-image-tag-groups', async () => {
  try {
    return await db.getImageTagGroups();
  } catch (error) {
    logError('Main', 'Get image tag groups error:', error);
    throw error;
  }
});

// 创建图像标签组
ipcMain.handle('create-image-tag-group', async (event, name, sortOrder) => {
  try {
    return await db.createImageTagGroup(name, sortOrder);
  } catch (error) {
    logError('Main', 'Create image tag group error:', error);
    throw error;
  }
});

// 更新图像标签组
ipcMain.handle('update-image-tag-group-attrs', async (event, id, updates) => {
  try {
    return await db.updateImageTagGroup(id, updates);
  } catch (error) {
    logError('Main', 'Update image tag group error:', error);
    throw error;
  }
});

// 删除图像标签组
ipcMain.handle('delete-image-tag-group', async (event, id) => {
  try {
    return await db.deleteImageTagGroup(id);
  } catch (error) {
    logError('Main', 'Delete image tag group error:', error);
    throw error;
  }
});

// 获取所有标签（提示词和图像标签合并）
ipcMain.handle('get-all-tags', async () => {
  // 如果缓存未初始化，先加载
  if (!allTagsCache) {
    await initTagsCache();
  }
  return allTagsCache;
});

// 分配图像标签到所属组
ipcMain.handle('assign-image-tag-to-belong-group', async (event, tagName, groupId) => {
  try {
    return await db.assignImageTagToBelongGroup(tagName, groupId);
  } catch (error) {
    logError('Main', 'Assign image tag to belong group error:', error);
    throw error;
  }
});

// 双向同步标签
ipcMain.handle('sync-tags-bidirectional', async () => {
  try {
    const result = await db.syncTagsBidirectional();
    // 清除标签缓存，让下次获取时重新加载
    allTagsCache = null;
    return result;
  } catch (error) {
    logError('Main', 'Sync tags bidirectional error:', error);
    throw error;
  }
});

// 获取图像完整路径
ipcMain.handle('get-image-path', async (event, relativePath) => {
  if (!relativePath || typeof relativePath !== 'string') {
    throw new Error('Invalid relativePath: ' + relativePath);
  }
  return path.join(currentDataDir, relativePath);
});

// 选择图像文件
ipcMain.handle('select-image-files', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择图像',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '图像文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths;
  }
  return null;
});

// 显示确认对话框

// 清空所有数据
ipcMain.handle('clear-all-data', async () => {
  try {
    return await db.clearAllData(currentDataDir);
  } catch (error) {
    logError('Main', 'Clear all data error:', error);
    throw error;
  }
});

// 获取统计数据
ipcMain.handle('get-statistics', async () => {
  try {
    return await db.getStatistics();
  } catch (error) {
    logError('Main', 'Get statistics error:', error);
    throw error;
  }
});

// 优化数据库
ipcMain.handle('optimize-database', async () => {
  try {
    return await db.optimizeDatabase();
  } catch (error) {
    logError('Main', 'Optimize database error:', error);
    throw error;
  }
});

// 获取旧数据目录路径（清空数据后）
ipcMain.handle('get-old-data-dir', async () => {
  const oldDir = pendingOldDataDir;
  pendingOldDataDir = null;
  return oldDir;
});

// 渲染进程日志（通过 IPC 写入 debug.log）
ipcMain.handle('renderer-log', async (event, level, component, message, data) => {
  const logFn = level === 'error' ? logError : level === 'warn' ? logWarn : level === 'debug' ? logDebug : logInfo;
  logFn(component, message, data);
  return true;
});

/**
 * 获取备份统计信息
 * @returns {Promise<Object>} 统计信息
 */
async function getBackupStats() {
  const stats = {
    database: true,
    prompts: { count: 0 },
    images: { count: 0, size: 0 }
  };

  // 统计提示词
  try {
    const prompts = await db.getPrompts();
    stats.prompts.count = prompts.length;
  } catch {
    // 数据库可能为空
  }

  // 统计图像
  try {
    const imagesDir = getImagesDir();
    const imageFiles = await getAllFiles(imagesDir, currentDataDir);
    stats.images.count = imageFiles.length;
    stats.images.size = imageFiles.reduce((sum, f) => sum + f.size, 0);
  } catch {
    // 目录可能不存在
  }

  return stats;
}

/**
 * 递归删除目录
 * @param {string} dir - 要删除的目录
 */
async function removeDirectory(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    return; // 目录不存在
  }
  
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeDirectory(fullPath);
    } else {
      await fs.unlink(fullPath);
    }
  }
  
  await fs.rmdir(dir);
}

/**
 * 创建 ZIP 压缩包
 * @param {string} sourceDir - 源目录
 * @param {string} zipPath - ZIP 文件路径
 */
async function createZipArchive(sourceDir: string, zipPath: string) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  // 使用系统命令创建 ZIP（Windows 使用 PowerShell，其他使用 zip 命令）
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    // Windows: 使用 PowerShell Compress-Archive
    await execAsync(`powershell -command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force"`);
  } else {
    // Linux/Mac: 使用 zip 命令
    const parentDir = path.dirname(sourceDir);
    const dirName = path.basename(sourceDir);
    await execAsync(`cd "${parentDir}" && zip -r "${zipPath}" "${dirName}"`);
  }
}

/**
 * 解压 ZIP 压缩包
 * @param {string} zipPath - ZIP 文件路径
 * @param {string} targetDir - 目标目录
 */
async function extractZipArchive(zipPath: string, targetDir: string) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    // Windows: 使用 PowerShell Expand-Archive
    await execAsync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`);
  } else {
    // Linux/Mac: 使用 unzip 命令
    await execAsync(`unzip -o "${zipPath}" -d "${targetDir}"`);
  }
}

/**
 * 递归获取目录下所有文件
 * @param {string} dir - 目录路径
 * @param {string} baseDir - 基础目录（用于计算相对路径）
 * @returns {Array} 文件列表（包含相对路径和绝对路径）
 */
async function getAllFiles(dir: string, baseDir: string): Promise<Array<{ relativePath: string; fullPath: string; size: number }>> {
  const files: Array<{ relativePath: string; fullPath: string; size: number }> = [];
  const items = await fs.readdir(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (item.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      const stats = await fs.stat(fullPath);
      files.push({
        relativePath: relativePath.replace(/\\/g, '/'),
        fullPath,
        size: stats.size
      });
    }
  }

  return files;
}

/**
 * 扫描孤儿文件（内部函数）
 * @returns {Promise<Object>} 扫描结果
 */
async function scanOrphanFilesInternal() {
  const imagesDir = getImagesDir();
  const thumbnailsDir = getThumbnailsDir();

  // 获取数据库中所有图像的路径
  const allImages = await db.getAllImages({ forCleanup: true });
  const dbImagePaths = new Set(allImages.map(img => img.relative_path).filter(Boolean));
  const dbThumbnailPaths = new Set(allImages.map(img => img.thumbnail_path).filter(Boolean));

  // 扫描实际文件
  let actualImageFiles: Array<{ relativePath: string; fullPath: string; size: number }> = [];
  let actualThumbnailFiles: Array<{ relativePath: string; fullPath: string; size: number }> = [];

  try {
    actualImageFiles = await getAllFiles(imagesDir, currentDataDir);
  } catch (err) {
    logError('Main', 'Failed to get image files:', err);
    // 目录可能不存在
  }

  try {
    actualThumbnailFiles = await getAllFiles(thumbnailsDir, currentDataDir);
  } catch (err) {
    logError('Main', 'Failed to get image thumb files:', err);
    // 目录可能不存在
  }

  // 找出孤儿文件
  const orphanImages = actualImageFiles.filter(file => !dbImagePaths.has(file.relativePath));
  const orphanThumbnails = actualThumbnailFiles.filter(file => !dbThumbnailPaths.has(file.relativePath));

  // 计算总大小
  const orphanImageSize = orphanImages.reduce((sum, f) => sum + f.size, 0);
  const orphanThumbnailSize = orphanThumbnails.reduce((sum, f) => sum + f.size, 0);

  return {
    orphanImages,
    orphanThumbnails,
    orphanImageCount: orphanImages.length,
    orphanThumbnailCount: orphanThumbnails.length,
    orphanImageSize: (orphanImageSize / 1024 / 1024).toFixed(2),
    orphanThumbnailSize: (orphanThumbnailSize / 1024 / 1024).toFixed(2),
    totalCount: orphanImages.length + orphanThumbnails.length,
    totalSize: ((orphanImageSize + orphanThumbnailSize) / 1024 / 1024).toFixed(2)
  };
}

// 扫描孤儿文件
ipcMain.handle('scan-orphan-files', async () => {
  try {
    return await scanOrphanFilesInternal();
  } catch (error) {
    logError('Main', 'Scan orphan files error:', error);
    throw error;
  }
});

// 选择并安装自定义字体文件
ipcMain.handle('select-and-install-font', async () => {
  try {
    // 打开字体文件选择对话框
    const result = await dialog.showOpenDialog({
      title: '选择字体文件',
      properties: ['openFile'],
      filters: [
        { name: '字体文件', extensions: ['ttf', 'otf', 'ttc', 'woff', 'woff2'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const sourcePath = result.filePaths[0];
    const fileName = path.basename(sourcePath);
    const fontName = fileName.replace(/\.(ttf|otf|ttc|woff|woff2)$/i, '');

    // 创建应用字体目录
    const fontsDir = path.join(currentDataDir, 'fonts');
    await fs.mkdir(fontsDir, { recursive: true });

    // 复制字体文件到应用目录
    const targetPath = path.join(fontsDir, fileName);
    await fs.copyFile(sourcePath, targetPath);

    return {
      fontName,
      fileName,
      filePath: targetPath
    };
  } catch (error) {
    logError('Main', 'Failed to select and install font:', error);
    throw error;
  }
});

// 获取已安装的自定义字体列表
ipcMain.handle('get-installed-fonts', async () => {
  try {
    const fontsDir = path.join(currentDataDir, 'fonts');

    try {
      await fs.access(fontsDir);
    } catch {
      return [];
    }

    const files = await fs.readdir(fontsDir);
    const fonts = files
      .filter(file => /\.(ttf|otf|ttc|woff|woff2)$/i.test(file))
      .map(file => ({
        fontName: file.replace(/\.(ttf|otf|ttc|woff|woff2)$/i, ''),
        fileName: file,
        filePath: path.join(fontsDir, file)
      }));

    return fonts;
  } catch (error) {
    logError('Main', 'Failed to get installed fonts:', error);
    return [];
  }
});


// 导出孤儿文件（不删除）
ipcMain.handle('export-orphan-files', async (event, exportDir) => {
  try {
    // 先扫描孤儿文件
    const scanResult = await scanOrphanFilesInternal();
    
    if (scanResult.totalCount === 0) {
      return { successCount: 0, failedCount: 0, exportPath: '' };
    }
    
    // 创建导出目录
    const orphanExportDir = path.join(exportDir, `orphan_files_${Date.now()}`);
    await fs.mkdir(orphanExportDir, { recursive: true });
    
    // 创建子目录
    const imagesExportDir = path.join(orphanExportDir, 'images');
    const thumbnailsExportDir = path.join(orphanExportDir, 'thumbnails');
    await fs.mkdir(imagesExportDir, { recursive: true });
    await fs.mkdir(thumbnailsExportDir, { recursive: true });
    
    let successCount = 0;
    let failedCount = 0;
    
    // 导出所有孤儿文件
    const allOrphanFiles = [...scanResult.orphanImages, ...scanResult.orphanThumbnails];
    
    for (const file of allOrphanFiles) {
      try {
        // 确定导出子目录
        const isThumbnail = file.relativePath.includes('thumbnails/');
        const targetDir = isThumbnail ? thumbnailsExportDir : imagesExportDir;
        
        // 复制文件
        const fileName = path.basename(file.fullPath);
        const targetPath = path.join(targetDir, fileName);
        await fs.copyFile(file.fullPath, targetPath);
        successCount++;
      } catch (error) {
        logError('Main', 'Failed to export orphan file:', { fullPath: file.fullPath, error });
        failedCount++;
      }
    }
    
    return { 
      successCount, 
      failedCount, 
      exportPath: orphanExportDir 
    };
  } catch (error) {
    logError('Main', 'Export orphan files error:', error);
    throw error;
  }
});

// 发送备份进度到渲染进程
function sendBackupProgress(progress: { stage: string; percent: number; status: string; detail?: string }) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('backup-progress', progress);
  }
}

// 完整备份导出
ipcMain.handle('export-full-backup', async () => {
  try {
    if (!mainWindow) throw new Error('Main window is not available');

    // 选择保存目录（先让用户选择目录）
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '选择备份保存位置',
      properties: ['openDirectory'],
      buttonLabel: '保存备份'
    });

    if (!filePaths || filePaths.length === 0) {
      return { cancelled: true };
    }

    const exportDir = filePaths[0];

    // 发送开始进度
    sendBackupProgress({
      stage: 'start',
      percent: 0,
      status: '准备中...',
      detail: '正在统计文件...'
    });

    // 在实际开始备份时生成文件名（确保时间戳准确）
    const timestamp = getFormattedLocalTimeToSecond().replace(/[:\s]/g, '-');
    const fileName = `prompt-manager-backup-${timestamp}.zip`;
    const filePath = path.join(exportDir, fileName);
    
    // 创建临时目录
    const tempDir = path.join(os.tmpdir(), `prompt-manager-backup-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    try {
      // 1. 生成 manifest.json (5%)
      sendBackupProgress({
        stage: 'manifest',
        percent: 5,
        status: '正在生成备份清单...'
      });
      
      const stats = await getBackupStats();
      const manifest = {
        version: '1.0.0',
        appName: 'prompt-manager',
        exportedAt: localTime(),
        dataVersion: 1,
        contents: stats
      };
      await fs.writeFile(
        path.join(tempDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf8'
      );
      
      // 2. 复制数据库 (5% -> 15%)
      sendBackupProgress({
        stage: 'database',
        percent: 15,
        status: '正在复制数据库...'
      });
      
      const dbDir = path.join(tempDir, 'database');
      await fs.mkdir(dbDir, { recursive: true });
      const dbSource = path.join(currentDataDir, 'prompt-manager.db');
      const dbTarget = path.join(dbDir, 'prompt-manager.db');
      await fs.copyFile(dbSource, dbTarget);
      
      // 3. 复制图像文件 (15% -> 80%)
      const imagesSource = path.join(currentDataDir, 'images');
      const imagesTarget = path.join(tempDir, 'files', 'images');
      
      sendBackupProgress({
        stage: 'images',
        percent: 15,
        status: '正在复制图像文件...',
        detail: `共 ${stats.images.count} 个文件`
      });
      
      await copyDirectoryWithProgress(imagesSource, imagesTarget, {
        onProgress: (progress, fileName) => {
          const percent = 15 + progress * 65;
          sendBackupProgress({
            stage: 'images',
            percent: Math.round(percent),
            status: '正在复制图像文件...',
            detail: fileName
          });
        }
      });
      
      // 注意：缩略图、字体和设置不导出
      
      // 4. 压缩为 ZIP (80% -> 100%)
      sendBackupProgress({
        stage: 'compress',
        percent: 80,
        status: '正在压缩备份文件...'
      });
      
      await createZipArchive(tempDir, filePath);
      
      // 完成
      sendBackupProgress({
        stage: 'complete',
        percent: 100,
        status: '备份完成！'
      });
      
      return { 
        success: true, 
        filePath,
        stats
      };
    } finally {
      // 清理临时目录
      await removeDirectory(tempDir);
    }
  } catch (error) {
    logError('Main', 'Export full backup error:', error);
    sendBackupProgress({
      stage: 'error',
      percent: 0,
      status: '备份失败',
      detail: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
});

// 完整备份导入
ipcMain.handle('import-full-backup', async () => {
  try {
    if (!mainWindow) throw new Error('Main window is not available');

    // 选择备份文件
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '导入完整备份',
      filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
      properties: ['openFile']
    });
    
    if (!filePaths || filePaths.length === 0) {
      return { cancelled: true };
    }
    
    const zipPath = filePaths[0];
    
    // 发送开始进度
    sendBackupProgress({
      stage: 'start',
      percent: 0,
      status: '准备导入...',
      detail: '正在准备导入环境...'
    });
    
    // 解压到临时目录
    const tempDir = path.join(os.tmpdir(), `prompt-manager-restore-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    try {
      // 1. 解压 ZIP (0% -> 20%)
      sendBackupProgress({
        stage: 'compress',
        percent: 5,
        status: '正在解压备份文件...'
      });
      
      await extractZipArchive(zipPath, tempDir);
      
      // 2. 验证 manifest (20% -> 25%)
      sendBackupProgress({
        stage: 'manifest',
        percent: 20,
        status: '正在验证备份文件...'
      });
      
      const manifestPath = path.join(tempDir, 'manifest.json');
      let manifest;
      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        manifest = JSON.parse(manifestContent);
      } catch {
        throw new Error('无效的备份文件：缺少 manifest.json');
      }
      
      // 3. 版本兼容性检查 (25% -> 30%)
      sendBackupProgress({
        stage: 'manifest',
        percent: 25,
        status: '正在检查版本兼容性...'
      });

      // 使用 dataVersion 进行数据格式兼容性检查
      const backupDataVersion = manifest.dataVersion || 1;
      const currentDataVersion = 1; // 当前支持的数据格式版本

      if (backupDataVersion !== currentDataVersion) {
        throw new Error(`数据格式版本不兼容：备份数据版本 ${backupDataVersion}，当前支持版本 ${currentDataVersion}`);
      }

      // 4. 备份当前数据 (30% -> 40%)
      sendBackupProgress({
        stage: 'database',
        percent: 30,
        status: '正在备份当前数据...'
      });

      // 关闭数据库连接以释放文件锁
      await db.closeDatabase();

      const timestamp = getFormattedLocalTimeToSecond().replace(/[:\s]/g, '-');
      const backupDir = `${currentDataDir}_${timestamp}`;
      await fs.rename(currentDataDir, backupDir);
      
      try {
        // 5. 恢复数据
        await fs.mkdir(currentDataDir, { recursive: true });
        
        // 恢复数据库 (40% -> 50%)
        sendBackupProgress({
          stage: 'database',
          percent: 40,
          status: '正在恢复数据库...'
        });

        const dbSource = path.join(tempDir, 'database', 'prompt-manager.db');
        const dbTarget = path.join(currentDataDir, 'prompt-manager.db');
        await fs.copyFile(dbSource, dbTarget);

        // 重新初始化数据库连接
        await db.initDatabase(currentDataDir);

        // 恢复图像 (50% -> 80%)
        const imagesSource = path.join(tempDir, 'files', 'images');
        const imagesTarget = path.join(currentDataDir, 'images');
        const imageStats = manifest.contents?.images || { count: 0 };
        
        sendBackupProgress({
          stage: 'images',
          percent: 50,
          status: '正在恢复图像文件...',
          detail: `共 ${imageStats.count} 个文件`
        });
        
        await copyDirectoryWithProgress(imagesSource, imagesTarget, {
          onProgress: (progress, fileName) => {
            const percent = 50 + progress * 40;
            sendBackupProgress({
              stage: 'images',
              percent: Math.round(percent),
              status: '正在恢复图像文件...',
              detail: fileName
            });
          }
        });
        
        // 重新生成缩略图 (90% -> 100%)
        sendBackupProgress({
          stage: 'thumbnails',
          percent: 90,
          status: '正在重新生成缩略图...'
        });
        
        await regenerateAllThumbnails((current, total, fileName) => {
          const percent = 90 + (current / total) * 10;
          sendBackupProgress({
            stage: 'thumbnails',
            percent: Math.round(percent),
            status: '正在重新生成缩略图...',
            detail: `${current}/${total} ${fileName || ''}`
          });
        });
        
        // 完成
        sendBackupProgress({
          stage: 'complete',
          percent: 100,
          status: '导入完成！'
        });
        
        return { 
          success: true, 
          manifest,
          oldDataDir: backupDir
        };
      } catch (error) {
        // 恢复失败，尝试回滚
        logError('Main', 'Restore failed, attempting rollback:', error);
        sendBackupProgress({
          stage: 'error',
          percent: 0,
          status: '导入失败，正在回滚...',
          detail: '正在恢复到原数据...'
        });
        await removeDirectory(currentDataDir);
        await fs.rename(backupDir, currentDataDir);
        throw new Error('导入失败，已自动回滚到原数据');
      }
    } finally {
      // 清理临时目录
      await removeDirectory(tempDir);
    }
  } catch (error) {
    logError('Main', 'Import full backup error:', error);
    sendBackupProgress({
      stage: 'error',
      percent: 0,
      status: '导入失败',
      detail: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
});

// 请求单实例锁
const enableSingleInstance = process.env.E2E_SINGLE_INSTANCE !== "false";
const gotTheLock = enableSingleInstance ? app.requestSingleInstanceLock() : true;

if (!gotTheLock) {
  logError('Main', 'Another instance is already running. Quitting...');
  app.quit();
}

// 当尝试运行第二个实例时，聚焦到第一个实例的窗口
if (enableSingleInstance) {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
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
  // 加载配置
  const config = await loadConfig();

  // 初始化日志系统
  initLogger(config.rootDir);

  // 初始化数据库
  try {
    await db.initDatabase(currentDataDir);
  } catch (err) {
    logError('Main', 'Failed to initialize database:', err);
  }

  // 初始化标签缓存
  await initTagsCache();

  // 配置 CSP（Content Security Policy）
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' file: data:",
          "connect-src 'self'",
          "font-src 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'"
        ].join('; ')
      }
    });
  });

  // 设置应用图标（Windows 任务栏）
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.ico');
  try {
    await fs.access(iconPath);
    app.setAppUserModelId('com.promptmanager.app');
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

app.on('window-all-closed', () => {
  // 测试模式下直接退出，不保留托盘
  if (isTestMode || process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
