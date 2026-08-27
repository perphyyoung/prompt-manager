/**
 * 哈希工具
 * 提供轻量的非加密字符串哈希，用于数据指纹等相等性判断场景
 */

/**
 * cyrb53：53 位非加密字符串哈希
 * 无依赖、固定长度输出，碰撞概率对中等规模数据可忽略
 * @param str - 输入字符串
 * @param seed - 可选种子，用于区分不同用途的指纹
 * @returns 16 位十六进制哈希字符串
 */
export function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}
