#!/usr/bin/env node
/**
 * 检测未初始化属性的使用
 * 检查 this.xxx 在使用前是否被赋值
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const issues = [];

/**
 * 检查文件
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // 简单的类分析
  let currentClass = null;
  let initializedProperties = new Set();
  let inConstructor = false;

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // 检测类定义
    const classMatch = line.match(/class\s+(\w+)/);
    if (classMatch) {
      currentClass = classMatch[1];
      initializedProperties.clear();
    }

    // 检测构造函数
    if (line.match(/constructor\s*\(/)) {
      inConstructor = true;
    }

    // 检测构造函数结束（简化判断）
    if (inConstructor && line.trim() === "}" && !line.includes("{")) {
      inConstructor = false;
    }

    // 在构造函数中检测属性初始化
    if (inConstructor) {
      // this.xxx = ...
      const initMatch = line.match(/this\.(\w+)\s*=/);
      if (initMatch) {
        initializedProperties.add(initMatch[1]);
      }
    }

    // 检测 this.xxx.yyy() 调用
    const methodCall = line.match(/this\.(\w+)\.(\w+)\s*\(/);
    if (methodCall && !inConstructor) {
      const [, propName] = methodCall;

      // 检查是否在构造函数中初始化
      if (!initializedProperties.has(propName)) {
        // 可能是延迟初始化，记录警告
        issues.push({
          file: filePath,
          line: lineNum,
          type: "warning",
          message: `属性 '${propName}' 可能在构造函数中未初始化`,
          code: line.trim(),
          className: currentClass,
        });
      }
    }
  });
}

/**
 * 递归遍历
 */
function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== "tests") {
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
  console.log("🔍 检查属性初始化...\n");

  const targetDir = path.join(__dirname, "..", "renderer");
  if (fs.existsSync(targetDir)) {
    walkDir(targetDir, checkFile);
  }

  if (issues.length === 0) {
    console.log("✅ 没有发现潜在问题\n");
  } else {
    console.log(`⚠️ 发现 ${issues.length} 个潜在问题：\n`);

    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.file}:${issue.line}`);
      console.log(`   🟡 ${issue.message}`);
      if (issue.className) {
        console.log(`   类: ${issue.className}`);
      }
      console.log(`   代码: ${issue.code}`);
      console.log("");
    });
  }
}

main();
