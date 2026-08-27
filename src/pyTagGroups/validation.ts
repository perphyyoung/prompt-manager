/**
 * PyTagGroups 验证模块
 * 所有标签相关的验证逻辑，纯函数，无副作用
 * 注意：特殊标签（保留标签）校验属于业务逻辑，由 TagService 直接读取 Constants.ALL_SPECIAL_TAGS 处理
 */

import type { TagName, ValidationResult, ErrorCode } from "./types.ts";

/**
 * 验证标签是否可以创建
 * @param tag - 要验证的标签
 * @param existingTags - 已存在的标签列表
 * @returns 验证结果
 */
export function validateTagCreate(tag: TagName, existingTags: TagName[]): ValidationResult {
  const trimmedTag = tag.trim();

  // 检查空标签
  if (!trimmedTag) {
    return {
      valid: false,
      error: "标签名称不能为空",
      code: "INVALID" as ErrorCode,
    };
  }

  // 检查已存在
  if (existingTags.includes(trimmedTag)) {
    return {
      valid: false,
      error: "标签已存在",
      code: "EXISTS" as ErrorCode,
    };
  }

  return { valid: true };
}

/**
 * 验证标签是否可以删除
 * @param tag - 要验证的标签
 * @param existingTags - 已存在的标签列表
 * @returns 验证结果
 */
export function validateTagDelete(tag: TagName, existingTags: TagName[]): ValidationResult {
  const trimmedTag = tag.trim();

  if (!trimmedTag) {
    return {
      valid: false,
      error: "标签名称不能为空",
      code: "INVALID" as ErrorCode,
    };
  }

  if (!existingTags.includes(trimmedTag)) {
    return {
      valid: false,
      error: "标签不存在",
      code: "NOT_FOUND" as ErrorCode,
    };
  }

  return { valid: true };
}

/**
 * 验证标签重命名
 * @param oldName - 旧标签名
 * @param newName - 新标签名
 * @param existingTags - 已存在的标签列表
 * @returns 验证结果
 */
export function validateTagRename(
  oldName: TagName,
  newName: TagName,
  existingTags: TagName[],
): ValidationResult {
  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();

  if (!trimmedOld) {
    return {
      valid: false,
      error: "原标签名称不能为空",
      code: "INVALID" as ErrorCode,
    };
  }

  if (!trimmedNew) {
    return {
      valid: false,
      error: "新标签名称不能为空",
      code: "INVALID" as ErrorCode,
    };
  }

  if (trimmedOld === trimmedNew) {
    return {
      valid: false,
      error: "新标签名称与原名称相同",
      code: "INVALID" as ErrorCode,
    };
  }

  if (!existingTags.includes(trimmedOld)) {
    return {
      valid: false,
      error: "原标签不存在",
      code: "NOT_FOUND" as ErrorCode,
    };
  }

  if (existingTags.includes(trimmedNew)) {
    return {
      valid: false,
      error: "新标签名称已存在",
      code: "EXISTS" as ErrorCode,
    };
  }

  return { valid: true };
}

/**
 * 验证标签组名称
 * @param name - 组名称
 * @returns 验证结果
 */
export function validateGroupName(name: string): ValidationResult {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return {
      valid: false,
      error: "组名称不能为空",
      code: "INVALID" as ErrorCode,
    };
  }

  return { valid: true };
}
