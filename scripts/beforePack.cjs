/**
 * 打包前优化脚本
 * 清理无用文件以减小包体积
 */

const fs = require('fs');
const path = require('path');

/**
 * 递归删除目录
 * @param {string} dirPath - 目录路径
 */
function removeDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      removeDir(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }
  fs.rmdirSync(dirPath);
}

/**
 * 清理 Sharp 的多平台二进制文件
 * 只保留 Windows x64 版本
 * @param {string} appDir - 应用目录
 */
function cleanupSharp(appDir) {
  const sharpVendor = path.join(appDir, 'node_modules', 'sharp', 'vendor');
  if (!fs.existsSync(sharpVendor)) {
    console.log('[beforePack] Sharp vendor directory not found, skipping cleanup');
    return;
  }

  const entries = fs.readdirSync(sharpVendor, { withFileTypes: true });
  let removedCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirName = entry.name;
    const fullPath = path.join(sharpVendor, dirName);

    // 删除非 Windows 平台目录 (darwin, linux)
    if (dirName.includes('darwin') || dirName.includes('linux')) {
      removeDir(fullPath);
      console.log(`[beforePack] Removed platform binary: ${dirName}`);
      removedCount++;
      continue;
    }

    // 删除非 x64 架构 (arm64, ia32, armv6, armv7)
    if (/arm|ia32/.test(dirName)) {
      removeDir(fullPath);
      console.log(`[beforePack] Removed arch binary: ${dirName}`);
      removedCount++;
    }
  }

  console.log(`[beforePack] Sharp cleanup complete, removed ${removedCount} directories`);
}

/**
 * 匹配文件路径是否符合模式
 * @param {string} filePath - 文件路径
 * @param {string} pattern - glob 模式
 * @returns {boolean}
 */
function matchPattern(filePath, pattern) {
  // 简单的 glob 匹配实现
  const regex = pattern
    .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
    .replace(/\*/g, '[^/\\]*')
    .replace(/<<<DOUBLESTAR>>>/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(regex).test(filePath);
}

/**
 * 递归扫描目录并删除匹配的文件
 * @param {string} dir - 扫描目录
 * @param {string[]} patterns - 匹配模式数组
 * @param {string} baseDir - 基础目录（用于计算相对路径）
 * @returns {number} 删除的文件数
 */
function removeFilesByPatterns(dir, patterns, baseDir) {
  let removedCount = 0;

  if (!fs.existsSync(dir)) return removedCount;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      // 递归扫描子目录
      removedCount += removeFilesByPatterns(fullPath, patterns, baseDir);

      // 检查目录是否为空，如果为空则删除
      try {
        const remaining = fs.readdirSync(fullPath);
        if (remaining.length === 0) {
          fs.rmdirSync(fullPath);
          removedCount++;
        }
      } catch {
        // 忽略删除目录的错误
      }
    } else {
      // 检查文件是否匹配任何模式
      for (const pattern of patterns) {
        if (matchPattern(relativePath, pattern) || matchPattern(entry.name, pattern)) {
          try {
            fs.unlinkSync(fullPath);
            removedCount++;
          } catch {
            // 忽略删除文件的错误
          }
          break;
        }
      }
    }
  }

  return removedCount;
}

/**
 * 清理开发依赖和无用文件
 * @param {string} appDir - 应用目录
 */
function cleanupDevFiles(appDir) {
  // 需要删除的文件模式
  const filePatterns = [
    '**/*.d.ts',           // TypeScript 类型定义
    '**/*.map',            // Source map
    '**/*.md',             // Markdown 文档
    '**/.github/**/*',     // GitHub 配置
    '**/.gitignore',       // Git 忽略文件
    '**/.npmignore',       // NPM 忽略文件
    '**/test/**/*',        // 测试文件
    '**/tests/**/*',
    '**/__tests__/**/*',
    '**/docs/**/*',        // 文档
    '**/examples/**/*',    // 示例
    '**/benchmark/**/*',   // 基准测试
    '**/.eslintrc*',       // ESLint 配置
    '**/.prettierrc*',     // Prettier 配置
    '**/tsconfig.json',    // TypeScript 配置
    '**/jest.config.*',    // Jest 配置
    '**/vitest.config.*',  // Vitest 配置
    '**/*.test.js',        // 测试文件
    '**/*.test.ts',
    '**/*.spec.js',
    '**/*.spec.ts'
  ];

  // 特定大文件/目录清理
  const specificPaths = [
    'node_modules/electron/dist',
    'node_modules/@types'
  ];

  // 清理特定目录
  for (const specificPath of specificPaths) {
    const fullPath = path.join(appDir, specificPath);
    if (fs.existsSync(fullPath)) {
      removeDir(fullPath);
    }
  }

  // 按模式清理文件
  removeFilesByPatterns(appDir, filePatterns, appDir);
}

/**
 * 主函数
 */
exports.default = async function(context) {
  // 尝试多种方式获取应用目录
  const appDir = context.packager?.appDir ||
                 context.packager?.projectDir ||
                 context.appDir ||
                 process.cwd();

  try {
    // 清理 Sharp 多平台二进制
    cleanupSharp(appDir);

    // 清理开发文件
    cleanupDevFiles(appDir);
  } catch (error) {
    console.error('[beforePack] Error during optimization:', error);
    // 不中断打包流程
  }
};
