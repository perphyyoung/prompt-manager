#!/usr/bin/env tsx
/**
 * 检查 constants.ts 中的 ID 常量命名是否符合规范
 * 规则：字面量 camelCase → 常量全大写下划线分隔
 */

import { Constants } from '../src/constants';

/**
 * 将 camelCase 转换为 SNAKE_CASE
 * @param camel - camelCase 字符串
 * @returns SNAKE_CASE 字符串
 */
function camelToSnake(camel: string): string {
  return camel
    .replace(/([A-Z])/g, '_$1')  // 在大写字母前加下划线
    .toUpperCase()               // 转全大写
    .replace(/^_/, '');          // 移除开头的下划线
}

/**
 * 检查常量命名
 */
function checkConstants(): void {
  const errors: string[] = [];

  for (const [key, value] of Object.entries(Constants.Ids)) {
    if (typeof value !== 'string') continue;

    const expectedKey = camelToSnake(value);

    if (key !== expectedKey) {
      errors.push(`  '${key}' → 应为 '${expectedKey}' (对应 '${value}')`);
    }
  }

  if (errors.length > 0) {
    console.error('❌ 常量命名不规范：\n');
    errors.forEach(e => console.error(e));
    console.error('\n📋 规则：字面量 camelCase → 常量全大写下划线分隔');
    console.error('   例如：imageTrashList → IMAGE_TRASH_LIST');
    process.exit(1);
  }

  console.log('✅ 常量命名检查通过');
}

// 执行检查
checkConstants();
