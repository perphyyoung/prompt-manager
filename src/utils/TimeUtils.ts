/**
 * 时间工具类
 * 提供时间格式化和转换功能
 */

/**
 * 获取当前本地时间字符串
 * @returns 本地时间字符串
 * @example
 * localTime()
 * // 返回: "2026/3/20 20:34:56"
 */
export function localTime(): string {
  return new Date().toLocaleString('zh-CN');
}

/**
 * 格式化本地时间为紧凑格式
 * @returns 格式化后的时间字符串 YYYYMMDD-HHmmss
 * @example
 * getFormattedLocalTimeToSecond()
 * // 返回: "20260322143052"
 */
export function getFormattedLocalTimeToSecond(): string {
  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * 格式化本地日期为紧凑格式
 * @returns 格式化后的日期字符串 YYYYMMDD
 * @example
 * getFormattedLocalDate()
 * // 返回: "20260322"
 */
export function getFormattedLocalDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 格式化当前时间为年月格式
 * @returns 格式化后的年月字符串 YYYYMM
 * @example
 * getFormattedYearMonth()
 * // 返回: "202603"
 */
export function getFormattedYearMonth(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

// 默认导出对象
const TimeUtils = {
  localTime,
  getFormattedLocalTimeToSecond,
  getFormattedLocalDate,
  getFormattedYearMonth
};

export default TimeUtils;
