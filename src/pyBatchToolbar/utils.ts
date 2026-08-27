/**
 * pyBatchToolbar 工具函数
 */

import type { ToolbarButtonConfig } from "./types.ts";

/**
 * 排序按钮配置数组
 * @param buttons - 按钮配置数组
 * @returns 排序后的按钮数组
 */
export function sortButtons(buttons: ToolbarButtonConfig[]): ToolbarButtonConfig[] {
  return [...buttons].sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * 合并按钮配置
 * @param base - 基础配置
 * @param overrides - 覆盖配置
 * @returns 合并后的配置
 */
export function mergeButtonConfigs(
  base: ToolbarButtonConfig[],
  overrides: Partial<ToolbarButtonConfig>[],
): ToolbarButtonConfig[] {
  const result = [...base];

  overrides.forEach((override) => {
    const index = result.findIndex((b) => b.action === override.action);
    if (index >= 0) {
      result[index] = { ...result[index], ...override };
    } else if (override.action) {
      result.push(override as ToolbarButtonConfig);
    }
  });

  return sortButtons(result);
}

/**
 * 过滤可见按钮
 * @param buttons - 按钮配置数组
 * @returns 可见的按钮数组
 */
export function filterVisibleButtons(buttons: ToolbarButtonConfig[]): ToolbarButtonConfig[] {
  return buttons.filter((btn) => btn.visible !== false);
}

/**
 * 生成工具栏唯一 ID
 * @param context - 上下文
 * @returns 唯一 ID
 */
export function generateToolbarId(context: string): string {
  return `${context}BatchToolbar`;
}

/**
 * 检查是否为有效的工具栏上下文
 * @param context - 上下文字符串
 * @returns 是否有效
 */
export function isValidContext(context: string): boolean {
  const validContexts = ["promptMain", "imageMain"];
  return validContexts.includes(context);
}
