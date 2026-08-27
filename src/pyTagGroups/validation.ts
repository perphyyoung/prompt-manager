/**
 * PyTagGroups 验证模块
 * 所有标签相关的验证逻辑，纯函数，无副作用
 */

import { Constants } from "../constants.ts";
import type { TagName, DataType, ValidationResult, ErrorCode } from "./types.ts";

/**
 * 验证标签是否可以创建
 * @param tag - 要验证的标签
 * @param existingTags - 已存在的标签列表
 * @param reservedTags - 保留标签列表
 * @param options - 验证选项
 * @returns 验证结果
 */
export function validateTagCreate(
  tag: TagName,
  existingTags: TagName[],
  reservedTags: TagName[],
): ValidationResult {
  const trimmedTag = tag.trim();

  // 检查空标签
  if (!trimmedTag) {
    return {
      valid: false,
      error: "标签名称不能为空",
      code: "INVALID" as ErrorCode,
    };
  }

  // 检查保留标签 - 系统保留标签必须不能手动添加
  if (reservedTags.includes(trimmedTag)) {
    return {
      valid: false,
      error: `"${trimmedTag}" 是系统保留标签，不能使用`,
      code: "RESERVED" as ErrorCode,
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

/**
 * 获取系统保留标签
 * @param type - 数据类型
 * @returns 保留标签列表
 */
export function getReservedTags(type: DataType): TagName[] {
  return type === "prompt" ? [...Constants.PROMPT_SPECIAL_TAGS] : [...Constants.IMAGE_SPECIAL_TAGS];
}

/**
 * 获取所有系统保留标签（通用）
 * @returns 所有保留标签列表
 */
export function getAllReservedTags(): TagName[] {
  return [...Constants.ALL_SPECIAL_TAGS];
}
