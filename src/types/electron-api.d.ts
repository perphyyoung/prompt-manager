/**
 * Electron API 类型声明
 * 为 window.electronAPI 提供 TypeScript 类型支持
 */

export interface ElectronAPI {
  // 日志方法
  logDebug(component: string, message: string, data?: any): void;
  logError(component: string, message: string, data?: any): void;
  logWarn(component: string, message: string, data?: any): void;
  logInfo(component: string, message: string, data?: any): void;

  // Prompt 管理
  getPrompts(sortBy: string, sortOrder: string): Promise<any[]>;
  getPromptById(id: string): Promise<any>;
  addPrompt(prompt: any): Promise<any>;
  updatePrompt(id: string, updates: any): Promise<any>;
  softDeletePrompt(id: string): Promise<any>;
  isTitleExists(title: string, excludeId?: string): Promise<boolean>;
  searchPrompts(query: string): Promise<any[]>;
  savePrompts(prompts: any[]): Promise<any>;
  getFavoritePrompts(): Promise<any[]>;
  getFavoriteImages(): Promise<any[]>;

  // 导入导出
  exportPrompts(prompts: any[]): Promise<any>;
  importPrompts(): Promise<any>;

  // 剪贴板
  copyToClipboard(text: string): Promise<void>;

  // 全屏控制
  setFullscreen(flag: boolean): Promise<void>;

  // 设置
  getDataPath(): Promise<string>;
  selectDataPath(): Promise<string | null>;
  selectDirectory(): Promise<string | null>;
  selectAndInstallFont(): Promise<{ fontName: string; fileName: string; filePath: string } | null>;
  getInstalledFonts(): Promise<{ fontName: string; fileName: string; filePath: string }[]>;

  // 图像文件操作
  saveImageFile(sourcePath: string, fileName: string): Promise<string>;
  getImagePath(relativePath: string): Promise<string>;
  selectImageFiles(): Promise<string[]>;
  openImageFiles(): Promise<string[]>;
  clearAllData(): Promise<any>;
  getImages(sortBy: string, sortOrder: string): Promise<any[]>;
  getImagesByIds(ids: string[]): Promise<any[]>;
  getAllImagesForStats(): Promise<any[]>;
  getImageById(imageId: string): Promise<any>;
  getPromptImages(promptId: string): Promise<any[]>;

  // 提示词回收站
  getPromptTrash(): Promise<any[]>;
  restorePromptFromTrash(id: string): Promise<any>;
  restoreAllPrompts(): Promise<any>;
  permanentDeletePrompt(id: string): Promise<any>;
  emptyPromptTrash(): Promise<any>;

  // 应用控制
  relaunchApp(oldDataDir?: string): Promise<void>;

  // 提示词标签组管理
  getPromptTagGroups(): Promise<any[]>;
  createPromptTagGroup(name: string, sortOrder: number): Promise<any>;
  updatePromptTagGroupAttrs(id: number, updates: any): Promise<any>;
  deletePromptTagGroup(id: number): Promise<any>;
  assignPromptTagToBelongGroup(tagName: string, groupId: number | null): Promise<any>;

  // 提示词标签管理
  getPromptTags(): Promise<string[]>;
  addPromptTag(tag: string): Promise<any>;
  addPromptTags(promptId: string, tagNames: string[]): Promise<any>;
  deletePromptTag(tag: string): Promise<any>;
  renamePromptTag(oldTag: string, newTag: string): Promise<any>;

  // 图像标签组管理
  getImageTagGroups(): Promise<any[]>;
  createImageTagGroup(name: string, sortOrder: number): Promise<any>;
  updateImageTagGroupAttrs(id: number, updates: any): Promise<any>;
  deleteImageTagGroup(id: number): Promise<any>;
  assignImageTagToBelongGroup(tagName: string, groupId: number | null): Promise<any>;

  // 图像标签管理
  getImageTags(): Promise<string[]>;
  addImageTag(tag: string): Promise<any>;
  addImageTags(imageId: string, tagNames: string[]): Promise<any>;
  updateImage(id: string, updates: any): Promise<any>;
  renameImageTag(oldTag: string, newTag: string): Promise<any>;
  deleteImageTag(tag: string): Promise<any>;

  // 图像回收站
  getImageTrash(): Promise<any[]>;
  softDeleteImage(id: string): Promise<any>;
  restoreImageFromTrash(id: string): Promise<any>;
  restoreAllImages(): Promise<any>;
  permanentDeleteImage(id: string): Promise<any>;
  emptyImageTrash(): Promise<any>;

  // 导出孤儿文件
  scanOrphanFiles(): Promise<{ totalCount: number; files: Array<{ fullPath: string; relativePath: string }> }>;
  exportOrphanFiles(exportDir: string): Promise<{ successCount: number; failedCount: number; exportPath: string }>;

  // 标签同步
  syncTagsBidirectional(): Promise<{
    promptToImage: { imported: number; skipped: number; tags: string[]; tagGroups: { groupName: string; tags: string[] }[] };
    imageToPrompt: { imported: number; skipped: number; tags: string[]; tagGroups: { groupName: string; tags: string[] }[] };
  }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
