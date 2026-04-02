/**
 * ID 生成工具
 * 提供统一的 ID 生成方法
 */

import { getFormattedLocalTimeToSecond } from './TimeUtils.ts';

/**
 * 生成唯一ID
 * @param prefix - ID前缀 (如 'pmt', 'img')
 * @returns 唯一ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = getFormattedLocalTimeToSecond();
  const random = Math.random().toString(36).slice(2, 7);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * 生成提示词ID
 * @returns 提示词ID
 * @example
 * generatePromptId()
 * // 返回: "pmt_20260322143052_123456"
 */
export function generatePromptId(): string {
  return generateId('pmt');
}

/**
 * 生成图像ID
 * @returns 图像ID
 * @example
 * generateImageId()
 * // 返回: "img_20260322143052_123456"
 */
export function generateImageId(): string {
  return generateId('img');
}
