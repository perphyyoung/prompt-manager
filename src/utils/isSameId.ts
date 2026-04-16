/**
 * 比较两个 ID 是否相等（统一转换为字符串比较）
 * @param id1 - 第一个 ID
 * @param id2 - 第二个 ID
 * @returns 是否相等
 */
export function isSameId(id1: string | number, id2: string | number): boolean {
  return String(id1) === String(id2);
}
