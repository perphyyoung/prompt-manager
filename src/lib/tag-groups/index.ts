/**
 * PyTagGroups 标签组库
 * 统一入口文件
 *
 * 使用示例：
 * ```typescript
 * import { PyTagGroups, Tag, TagGroup } from './lib/tag-groups';
 *
 * const lib = PyTagGroups.getInstance('prompt');
 * const result = await lib.create(['tag1', 'tag2']);
 * ```
 */

// 主库类
export { PyTagGroups } from "./PyTagGroups.ts";

// 类型定义
export type {
  TagName,
  TagGroupId,
  DataType,
  Tag,
  TagGroup,
  TagWithGroup,
  ErrorCode,
  TagError,
  TagOperationResult,
  TagDeleteResult,
  TagCreateOptions,
  TagQueryOptions,
  ValidationResult,
} from "./types.ts";

// 异常类
export {
  TagOperationError,
  TagExistsError,
  TagNotFoundError,
  InvalidTagNameError,
} from "./types.ts";

// 工具函数（按需导出）
export {
  diffTags,
  normalizeTag,
  hasTag,
  groupTagsByGroup,
  buildTagsWithGroupInfo,
  filterNewTags,
  filterExistingTags,
} from "./utils.ts";

// 验证函数（按需导出）
export {
  validateTagCreate,
  validateTagDelete,
  validateTagRename,
  validateGroupName,
} from "./validation.ts";

// 操作函数（高级使用，按需导出）
export {
  getTags,
  createTag,
  renameTag,
  deleteTag,
  assignTagToGroup,
  getTagGroups,
  createTagGroup,
  updateTagGroup,
  deleteTagGroup,
} from "./operations.ts";
