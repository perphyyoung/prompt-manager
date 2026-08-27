// 验证所有 JS 文件的语法和导入
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = __dirname;

async function getAllJsFiles(dir, files = []) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.name === "node_modules" || item.name === ".git" || item.name === "tests") continue;
    if (item.isDirectory()) {
      await getAllJsFiles(fullPath, files);
    } else if (item.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function checkFile(filePath) {
  try {
    // 尝试动态导入 - 这是故意的，用于验证文件是否可导入
    // oxlint-disable-next-line prompt-manager-custom/no-dynamic-import, no-unsanitized/method
    await import(`file://${filePath}`);
    return { path: filePath, status: "OK", error: null };
  } catch (error) {
    // 检查是否是语法错误
    if (error.code === "ERR_MODULE_NOT_FOUND" || error.code === "MODULE_NOT_FOUND") {
      return { path: filePath, status: "IMPORT_ERROR", error: error.message };
    }
    // 检查语法错误
    if (error.message.includes("SyntaxError") || error.message.includes("Unexpected token")) {
      return { path: filePath, status: "SYNTAX_ERROR", error: error.message };
    }
    return { path: filePath, status: "ERROR", error: error.message };
  }
}

async function main() {
  console.log("Scanning all JS files...\n");

  const files = await getAllJsFiles(baseDir);
  console.log(`Found ${files.length} JS files\n`);

  const results = [];
  let checked = 0;

  for (const file of files) {
    const result = await checkFile(file);
    results.push(result);
    checked++;
    if (result.status !== "OK") {
      console.log(
        `[${checked}/${files.length}] ${result.status}: ${path.relative(baseDir, result.path)}`,
      );
    }
  }

  console.log("\n=== Summary ===");
  const ok = results.filter((r) => r.status === "OK").length;
  const importErr = results.filter((r) => r.status === "IMPORT_ERROR").length;
  const syntaxErr = results.filter((r) => r.status === "SYNTAX_ERROR").length;
  const otherErr = results.filter((r) => r.status === "ERROR").length;

  console.log(`Total: ${files.length}`);
  console.log(`OK: ${ok}`);
  console.log(`Import Error: ${importErr}`);
  console.log(`Syntax Error: ${syntaxErr}`);
  console.log(`Other Error: ${otherErr}`);

  if (importErr > 0 || syntaxErr > 0 || otherErr > 0) {
    console.log("\n=== Failed Files ===");
    for (const r of results) {
      if (r.status !== "OK") {
        console.log(`\n[${r.status}] ${path.relative(baseDir, r.path)}`);
        console.log(`  ${r.error.substring(0, 200)}`);
      }
    }
  }
}

main().catch(console.error);
