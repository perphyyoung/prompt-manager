/**
 * PyTagGroups 标签组库
 * 统一入口文件
 *
 * 使用示例：
 * ```typescript
 * import { PyTagGroups, Tag, TagGroup } from './pyTagGroups';
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
  ReservedTagError,
  TagGroupNotFoundError,
} from "./types.ts";

// 工具函数（按需导出）
export {
  parseTagInput,
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
  getReservedTags,
  getAllReservedTags,
} from "./validation.ts";

// 操作函数（高级使用，按需导出）
export {
  getTags,
  createTags,
  renameTag,
  deleteTags,
  assignTagToGroup,
  getTagGroups,
  createTagGroup,
  updateTagGroup,
  deleteTagGroup,
  clearTagsCache,
} from "./operations.ts";

// 数据访问层（高级使用，按需导出）
export type { TagDataAccess } from "./dataAccess.ts";
export { ElectronTagDataAccess, createDataAccess } from "./dataAccess.ts";

// 项目标签关联服务
export { linkTags } from "./itemTagService.ts";

export type { LinkTagsOptions, LinkTagsResult } from "./itemTagService.ts";
