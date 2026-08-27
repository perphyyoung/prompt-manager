#!/usr/bin/env node
/**
 * 静态代码分析工具
 * 检测可能调用不存在方法的代码
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义已知的类和方法映射
const KNOWN_CLASSES = {
  TagRegistry: {
    methods: [
      "refresh",
      "render",
      "addTag",
      "deleteTag",
      "updateTag",
      "getTags",
      "bindEvents",
      "addTagInManager",
    ],
    file: "renderer/managers/TagRegistry.js",
  },
  ImageTagRegistry: {
    methods: [
      "refresh",
      "render",
      "addTag",
      "deleteTag",
      "updateTag",
      "getTags",
      "bindEvents",
      "addTagInManager",
    ],
    file: "renderer/managers/ImageTagRegistry.js",
  },
  TagService: {
    methods: [
      "getTagGroups",
      "createTagGroup",
      "updateTagGroup",
      "deleteTagGroup",
      "createTag",
      "updateTag",
      "deleteTag",
    ],
    file: "renderer/services/TagService.js",
  },
  TagSyncIpcService: {
    methods: ["syncPromptTagsToImage", "syncImageTagsToPrompt"],
    file: "renderer/services/TagSyncIpcService.js",
  },
};

// 问题记录
const issues = [];

/**
 * 检查文件中的方法调用
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // 检查 this.xxx.yyy() 调用
    const thisMethodCall = /this\.(\w+)\.(\w+)\s*\(/g;
    let match;

    while ((match = thisMethodCall.exec(line)) !== null) {
      const [, propertyName, methodName] = match;

      // 检查是否是已知的类
      const classInfo = findClassByProperty(propertyName);
      if (classInfo) {
        if (!classInfo.methods.includes(methodName)) {
          issues.push({
            file: filePath,
            line: lineNum,
            column: match.index + 1,
            type: "error",
            message: `类 ${classInfo.className} 可能没有方法 '${methodName}'`,
            code: line.trim(),
          });
        }
      }
    }

    // 检查 window.electronAPI.xxx 调用
    const ipcCall = /window\.electronAPI\.(\w+)\s*\(/g;
    while ((match = ipcCall.exec(line)) !== null) {
      const [, _methodName] = match;
      // 这里可以添加已知的 IPC 方法列表检查
    }
  });
}

/**
 * 根据属性名查找类信息
 */
function findClassByProperty(propertyName) {
  // 常见的属性名映射
  const propertyMappings = {
    tagRegistry: "TagRegistry",
    imageTagRegistry: "ImageTagRegistry",
    tagService: "TagService",
    tagSyncService: "TagSyncIpcService",
  };

  const className = propertyMappings[propertyName];
  if (className && KNOWN_CLASSES[className]) {
    return {
      className,
      ...KNOWN_CLASSES[className],
    };
  }

  return null;
}

/**
 * 递归遍历目录
 */
function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // 跳过 node_modules 和 tests
      if (file !== "node_modules" && file !== "tests" && file !== "scripts") {
        walkDir(filePath, callback);
      }
    } else if (file.endsWith(".js")) {
      callback(filePath);
    }
  });
}

/**
 * 主函数
 */
function main() {
  console.log("🔍 开始检查方法调用...\n");

  const targetDirs = [
    path.join(__dirname, "..", "renderer"),
    path.join(__dirname, "..", "main.js"),
  ];

  targetDirs.forEach((dir) => {
    if (fs.existsSync(dir)) {
      const stat = fs.statSync(dir);
      if (stat.isDirectory()) {
        walkDir(dir, checkFile);
      } else {
        checkFile(dir);
      }
    }
  });

  // 输出结果
  if (issues.length === 0) {
    console.log("✅ 没有发现潜在问题\n");
    process.exit(0);
  } else {
    console.log(`❌ 发现 ${issues.length} 个潜在问题：\n`);

    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.file}:${issue.line}:${issue.column}`);
      console.log(`   ${issue.type === "error" ? "🔴" : "🟡"} ${issue.message}`);
      console.log(`   代码: ${issue.code}`);
      console.log("");
    });

    process.exit(1);
  }
}

main();
