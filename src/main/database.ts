/**
 * 数据库模块 Facade
 * 按域拆分后的统一出口，保持原 database.ts 的完整导出面不变。
 * 连接层: infrastructure/sqlite/connection.ts
 * 仓库层: infrastructure/repositories/*
 */

export { initDatabase, closeDatabase, run, get, all } from "./infrastructure/sqlite/connection.js";

export {
  createPromptTagGroup,
  getPromptTagGroups,
  getPromptTagGroupById,
  updatePromptTagGroup,
  deletePromptTagGroup,
  createImageTagGroup,
  getImageTagGroups,
  getImageTagGroupById,
  updateImageTagGroup,
  deleteImageTagGroup,
} from "./infrastructure/repositories/tagGroupRepository.js";

export {
  getPrompts,
  getPromptsPaginated,
  getPromptIdsByFilter,
  countPrompts,
  countPromptTags,
  countPromptSpecialTags,
  getPromptById,
  getPromptsByIds,
  addPrompt,
  updatePrompt,
  deletePrompt,
  softDeletePrompts,
  restorePrompt,
  restoreAllPrompts,
  permanentDeletePrompt,
  emptyPromptTrash,
  getDeletedPrompts,
  batchFavoritePrompts,
} from "./infrastructure/repositories/promptRepository.js";

export {
  getPromptTags,
  addPromptTag,
  addPromptTags,
  addPromptTagsBatch,
  deletePromptTag,
  deletePromptTags,
  updatePromptTagGroupByTagName,
  getPromptsByTag,
  removeTagFromPrompt,
  renameTag,
  checkTagGroupNameDuplicate,
  getImageTags,
  addImageTag,
  addImageTags,
  addImageTagsBatch,
  deleteImageTag,
  deleteImageTags,
  assignImageTagToBelongGroup,
  getImagesByTag,
  removeTagFromImage,
  getAllTags,
} from "./infrastructure/repositories/tagRepository.js";

export {
  getImages,
  getImagesPaginated,
  countImages,
  getImageIdsByFilter,
  countImageTags,
  countImageSpecialTags,
  getImagesByIds,
  getAllImages,
  getImageById,
  getImageByMD5IncludeTrash,
  addImage,
  replaceImage,
  softDeleteImage,
  softDeleteImages,
  restoreImage,
  restoreAllImages,
  permanentDeleteImage,
  getDeletedImages,
  emptyImageTrash,
  addPromptImages,
  addImagePrompts,
  updateImage,
  updateImagesBatch,
  batchFavoriteImages,
} from "./infrastructure/repositories/imageRepository.js";

export { getStatistics, clearAllData } from "./infrastructure/repositories/statsRepository.js";
