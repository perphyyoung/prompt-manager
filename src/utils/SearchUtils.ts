/**
 * 通用搜索匹配工具
 * 用于提示词和图像的搜索过滤
 */

/**
 * 可搜索项的接口
 * 包含文件名、备注、标签等字段
 */
export interface ISearchableItem {
  fileName?: string;
  note?: string;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * 检查可搜索项是否匹配搜索查询
 * 同时搜索：文件名、备注、标签
 * @param item - 可搜索项
 * @param query - 搜索查询（小写）
 * @returns 是否匹配
 */
export function searchMatches(item: ISearchableItem, query: string): boolean {
  if (!query) return true;
  return (
    item.fileName?.toLowerCase().includes(query) ||
    item.note?.toLowerCase().includes(query) ||
    (item.tags && item.tags.some(tag => tag.toLowerCase().includes(query))) ||
    false
  );
}

/**
 * 搜索工具默认导出
 */
const SearchUtils = {
  searchMatches
};

export default SearchUtils;
