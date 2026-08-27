/**
 * 文本工具类
 * 提供文本校验和格式化功能
 */

// 校验结果接口
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// 比较函数类型
type CompareFn<T> = (a: T, b: T) => boolean;
// 获取ID函数类型
type GetIdFn<T> = (item: T) => unknown;
// 校验器函数类型
type ValidatorFn = () => ValidationResult;

/**
 * 空值校验
 * 检查值是否为空（null、undefined、空字符串、仅空白字符）
 * @param value - 要校验的值
 * @param fieldName - 字段名称（用于错误提示）
 * @returns 校验结果
 */
export function validateNotEmpty(value: unknown, fieldName: string = "该字段"): ValidationResult {
  if (value === null || value === undefined) {
    return { valid: false, error: `${fieldName}不能为空` };
  }

  const strValue = String(value).trim();
  if (strValue === "") {
    return { valid: false, error: `${fieldName}不能为空` };
  }

  return { valid: true };
}

/**
 * 重复校验
 * 检查值是否在现有列表中已存在
 * @param value - 要校验的值
 * @param existingList - 现有值列表
 * @param fieldName - 字段名称（用于错误提示）
 * @param compareFn - 自定义比较函数，默认使用严格相等
 * @param excludeId - 要排除的ID（用于编辑时排除自身）
 * @param getIdFn - 从列表项中获取ID的函数
 * @returns 校验结果
 */
export function validateNotDuplicate<T>(
  value: T,
  existingList: T[] | null | undefined,
  fieldName: string = "该字段",
  compareFn: CompareFn<T> = (a, b) => a === b,
  excludeId: unknown = null,
  getIdFn: GetIdFn<T> | null = null,
): ValidationResult {
  if (!Array.isArray(existingList)) {
    return { valid: true };
  }

  const isDuplicate = existingList.some((item) => {
    // 如果提供了排除ID和获取ID函数，跳过该项
    if (excludeId !== null && getIdFn !== null) {
      const itemId = getIdFn(item);
      if (String(itemId) === String(excludeId)) {
        return false;
      }
    }

    return compareFn(item, value);
  });

  if (isDuplicate) {
    return { valid: false, error: `${fieldName}已存在` };
  }

  return { valid: true };
}

/**
 * 长度校验
 * 检查字符串长度是否在指定范围内
 * @param value - 要校验的字符串
 * @param maxLength - 最大长度
 * @param minLength - 最小长度
 * @param fieldName - 字段名称（用于错误提示）
 * @returns 校验结果
 */
export function validateLength(
  value: unknown,
  maxLength: number | null = null,
  minLength: number | null = null,
  fieldName: string = "该字段",
): ValidationResult {
  const strValue = String(value);

  if (minLength !== null && strValue.length < minLength) {
    return { valid: false, error: `${fieldName}长度不能少于${minLength}个字符` };
  }

  if (maxLength !== null && strValue.length > maxLength) {
    return { valid: false, error: `${fieldName}长度不能超过${maxLength}个字符` };
  }

  return { valid: true };
}

/**
 * 非法字符校验
 * 检查字符串是否包含非法字符
 * @param value - 要校验的字符串
 * @param invalidPattern - 非法字符正则表达式
 * @param fieldName - 字段名称（用于错误提示）
 * @returns 校验结果
 */
export function validateNoInvalidChars(
  value: unknown,
  invalidPattern: RegExp = /[\\/:*?"<>|]/,
  fieldName: string = "该字段",
): ValidationResult {
  const strValue = String(value);

  if (invalidPattern.test(strValue)) {
    return { valid: false, error: `${fieldName}包含非法字符` };
  }

  return { valid: true };
}

/**
 * 组合校验
 * 按顺序执行多个校验，返回第一个错误
 * @param validators - 校验函数数组
 * @returns 校验结果
 */
export function combineValidators(validators: ValidatorFn[]): ValidationResult {
  for (const validator of validators) {
    const result = validator();
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}

/**
 * 文件名专用校验
 * 组合空值校验和非法字符校验
 * @param fileName - 文件名
 * @returns 校验结果
 */
export function validateFileName(fileName: unknown): ValidationResult {
  // 空值校验
  const emptyResult = validateNotEmpty(fileName, "文件名");
  if (!emptyResult.valid) {
    return emptyResult;
  }

  // 非法字符校验（Windows 文件名非法字符）
  const invalidCharsResult = validateNoInvalidChars(fileName, /[\\/:*?"<>|]/, "文件名");
  if (!invalidCharsResult.valid) {
    return invalidCharsResult;
  }

  return { valid: true };
}

/**
 * 标题专用校验
 * 组合空值校验和长度校验
 * @param title - 标题
 * @param maxLength - 最大长度，默认255
 * @returns 校验结果
 */
export function validateTitle(title: unknown, maxLength: number = 255): ValidationResult {
  // 空值校验
  const emptyResult = validateNotEmpty(title, "标题");
  if (!emptyResult.valid) {
    return emptyResult;
  }

  // 长度校验
  const lengthResult = validateLength(title, maxLength, null, "标题");
  if (!lengthResult.valid) {
    return lengthResult;
  }

  return { valid: true };
}
