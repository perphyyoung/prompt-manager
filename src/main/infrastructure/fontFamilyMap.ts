/**
 * 字体中文名映射（数据目录 toml）
 *
 * 位置：数据目录下 `font-family-map.toml`，随数据目录备份/迁移，设置页「打开文件夹」可找到。
 * 首次使用时从随程序分发的模板原样复制生成；模板定位按候选路径依次探测，
 * 兼容 dev（源码 public/）与打包/e2e（构建产物 out/renderer/）两种环境。
 * 解析逐行进行，注释/空行/不规范行跳过，单个坏行不影响其余行。
 */

import path from "path";
import { promises as fs } from "fs";
import { app } from "electron";
import { getCurrentDataDir } from "../runtime.js";
import { logError } from "../mainLogger.js";

/** 数据目录中的映射文件名 */
const FONT_MAP_FILE = "font-family-map.toml";
/** 随程序分发的模板文件名 */
const FONT_MAP_TEMPLATE = "font-family-map-template.toml";

/**
 * 逐行解析映射内容，跳过注释、空行与不规范行
 * @param content - toml 文本
 */
export function parseFontFamilyMap(content: string): Record<string, string> {
  const map: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const matched = trimmed.match(/^"?([^"=]+?)"?\s*=\s*"([^"]*)"$/);
    if (!matched) {
      continue;
    }

    const family = matched[1].trim();
    const cnName = matched[2].trim();
    if (family && cnName) {
      map[family] = cnName;
    }
  }

  return map;
}

/**
 * 模板候选路径：构建产物优先（dev/e2e/打包均产出 out/renderer），源码 public 兜底
 */
function templateCandidates(): string[] {
  const appPath = app.getAppPath();
  return [
    path.join(appPath, "out", "renderer", FONT_MAP_TEMPLATE),
    path.join(appPath, "src", "renderer", "public", FONT_MAP_TEMPLATE),
    path.join(appPath, "public", FONT_MAP_TEMPLATE),
  ];
}

/** 取首个存在的候选路径，均不存在时返回首选路径（后续读取失败会被捕获） */
async function resolveTemplatePath(): Promise<string> {
  const candidates = templateCandidates();
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // 探测下一个候选路径
    }
  }
  return candidates[0];
}

/**
 * 读取字体中文名映射：文件不存在时从模板复制生成，读取失败回退模板，模板也不可用返回空映射
 */
export async function loadFontFamilyMap(): Promise<Record<string, string>> {
  const mapPath = path.join(getCurrentDataDir(), FONT_MAP_FILE);
  const templatePath = await resolveTemplatePath();

  try {
    await fs.access(mapPath);
  } catch {
    // 首次使用：从模板生成，之后由用户按需维护
    try {
      await fs.copyFile(templatePath, mapPath);
    } catch (error) {
      logError("Main", "Failed to create font family map from template:", error);
    }
  }

  try {
    return parseFontFamilyMap(await fs.readFile(mapPath, "utf-8"));
  } catch (error) {
    logError("Main", "Failed to read font family map, fallback to template:", error);
    try {
      return parseFontFamilyMap(await fs.readFile(templatePath, "utf-8"));
    } catch (templateError) {
      logError("Main", "Failed to read font family map template:", templateError);
      return {};
    }
  }
}
