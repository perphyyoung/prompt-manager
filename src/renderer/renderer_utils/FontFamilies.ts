/**
 * 系统字体家族枚举
 *
 * 数据来源：window.queryLocalFonts()（Local Font Access API，Chromium 104+），
 * 以官方 API 返回的 family 为准（对齐 chat-manager 的实现，不用文件名拼家族名）。
 * 该 API 需要 secure context + 用户手势，故只能在用户交互（如打开设置页）中调用。
 * 不支持 / 拒绝授权 / 返回空时回退内置候选表，保证设置页下拉始终有可选字体。
 */

import { logger } from "../../utils/Logger.ts";

/** 内置候选字体（枚举不可用时的回退表） */
export const FONT_CANDIDATES = Object.freeze([
  "system-ui",
  "Segoe UI",
  "Microsoft YaHei",
  "PingFang SC",
  "Roboto",
  "Arial",
  "Helvetica Neue",
  "Noto Sans SC",
]);

export type FontListStatus = "ok" | "fallback";

export interface FontListData {
  /** 可直接写入 CSS 的字体家族名（已清洗、去重、排序） */
  families: string[];
  /** ok=系统枚举结果；fallback=内置候选表 */
  status: FontListStatus;
}

/** queryLocalFonts 返回的字体项（仅取 family） */
interface ILocalFontData {
  family: string;
}

/** 带 Local Font Access API 的 window（TS DOM lib 暂未内置该类型） */
type WindowWithLocalFonts = Window & {
  queryLocalFonts?: () => Promise<ILocalFontData[]>;
};

/**
 * 清洗字体家族名：去除首尾引号、前导点与空白
 */
function sanitizeFontFamily(family: string): string {
  return family
    .replace(/^["']+|["']+$/g, "")
    .replace(/^\./, "")
    .trim();
}

function buildFallbackList(): FontListData {
  return { families: [...FONT_CANDIDATES], status: "fallback" };
}

async function enumerateFonts(): Promise<FontListData> {
  const win = window as WindowWithLocalFonts;
  if (typeof win.queryLocalFonts !== "function") {
    logger.warn("FontFamilies", "queryLocalFonts 不可用，使用内置候选字体");
    return buildFallbackList();
  }

  try {
    const fonts = await win.queryLocalFonts();
    const families = [
      ...new Set(fonts.map((font) => sanitizeFontFamily(font.family)).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

    if (families.length === 0) {
      logger.warn("FontFamilies", "字体枚举返回空（可能被拒绝授权），使用内置候选字体");
      return buildFallbackList();
    }

    return { families, status: "ok" };
  } catch (error) {
    logger.warn("FontFamilies", "字体枚举失败（可能被拒绝授权），使用内置候选字体", error);
    return buildFallbackList();
  }
}

/**
 * 关键字过滤（大小写不敏感，空关键字返回全部）
 */
export function filterFonts(families: string[], keyword: string): string[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) {
    return families;
  }
  return families.filter((family) => family.toLowerCase().includes(kw));
}

/**
 * 列表渲染窗口：有选中项时把窗口挪到它附近（保留原顺序），否则从头开始。
 * 本机字体常上千，只渲染 `max` 项；选中项若落在窗口外就不在 DOM 中，滚动定位无从谈起。
 * `offset` 为选中项上方保留的上下文项数，末尾再夹一次避免选中项靠后时窗口留白。
 */
export function fontListWindow(
  all: string[],
  selected: string,
  max: number,
  offset: number,
): string[] {
  const index = selected ? all.indexOf(selected) : -1;
  const desired = index > offset ? index - offset : 0;
  const start = Math.min(desired, Math.max(0, all.length - max));
  return all.slice(start, start + max);
}

/** 单例枚举：整个会话只调用一次 queryLocalFonts */
let fontListPromise: Promise<FontListData> | null = null;

/**
 * 获取本机字体家族列表（失败时回退内置候选表）
 */
export function loadFontList(): Promise<FontListData> {
  fontListPromise ??= enumerateFonts();
  return fontListPromise;
}
