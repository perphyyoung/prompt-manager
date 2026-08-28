/**
 * Prompts 域 IPC 路由
 * 提示词的查询、新增、更新、收藏、导入导出。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import { ipcMain, dialog } from "electron";
import { promises as fs } from "fs";
import * as db from "../../database.js";
import { generatePromptId } from "../../../utils/idGenerator.js";
import { logError } from "../../mainLogger.js";
import { getMainWindow } from "../../runtime.js";

export function registerPromptIpc() {
  // 获取所有 Prompts（含已删除；供 e2e 测试与备份统计使用）
  ipcMain.handle("get-prompts", async (event, sortBy, sortOrder) => {
    return await db.getPrompts(sortBy, sortOrder);
  });

  // 分页获取 Prompts
  ipcMain.handle("get-prompts-paginated", async (event, options) => {
    return await db.getPromptsPaginated(options);
  });

  // 获取满足筛选条件的全部提示词 id（用于"全选"批量操作）
  ipcMain.handle("get-prompt-ids-by-filter", async (event, options) => {
    try {
      return await db.getPromptIdsByFilter(options);
    } catch (error) {
      logError("Main", "Get prompt ids by filter error:", error);
      throw error;
    }
  });

  // 统计提示词标签数量
  ipcMain.handle("count-prompt-tags", async (event, options) => {
    return await db.countPromptTags(options);
  });

  // 统计提示词特殊标签数量
  ipcMain.handle("count-prompt-special-tags", async (event, options) => {
    return await db.countPromptSpecialTags(options);
  });

  // 添加 Prompt
  ipcMain.handle("add-prompt", async (event, prompt) => {
    const newPrompt = {
      id: generatePromptId(),
      ...prompt,
    };
    // 如果没有提供标题，使用 ID 作为标题
    if (!newPrompt.title) {
      newPrompt.title = newPrompt.id;
    }
    return await db.addPrompt(newPrompt);
  });

  // 更新 Prompt
  ipcMain.handle("update-prompt", async (event, id, updates) => {
    return await db.updatePrompt(id, updates);
  });

  // 批量切换提示词收藏状态
  ipcMain.handle("batch-favorite-prompts", async (event, ids) => {
    try {
      return await db.batchFavoritePrompts(ids);
    } catch (error) {
      logError("Main", "Batch favorite prompts error:", error);
      throw error;
    }
  });

  // 检查标题是否已存在
  ipcMain.handle("is-title-exists", async (event, title, excludeId) => {
    return await db.isTitleExists(title, excludeId);
  });

  // 批量获取提示词（按 ID 列表，保持传入顺序）
  ipcMain.handle("get-prompts-by-ids", async (event, ids: string[]) => {
    try {
      return await db.getPromptsByIds(ids);
    } catch (error) {
      logError("Main", "Get prompts by ids error:", error);
      throw error;
    }
  });

  // 根据 ID 获取提示词信息
  ipcMain.handle("get-prompt-by-id", async (event, promptId) => {
    try {
      return await db.getPromptById(promptId);
    } catch (error) {
      logError("Main", "Get prompt by id error:", error);
      throw error;
    }
  });

  // 导出 Prompts
  ipcMain.handle("export-prompts", async (event, prompts) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) throw new Error("Main window is not available");
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "导出 Prompts",
      defaultPath: "prompts-backup.json",
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });

    if (filePath) {
      await fs.writeFile(filePath, JSON.stringify(prompts, null, 2), "utf8");
      return true;
    }
    return false;
  });

  // 导入 Prompts
  ipcMain.handle("import-prompts", async () => {
    const { filePaths } = await dialog.showOpenDialog({
      title: "导入 Prompts",
      filters: [{ name: "JSON Files", extensions: ["json"] }],
      properties: ["openFile"],
    });

    if (filePaths && filePaths.length > 0) {
      const data = await fs.readFile(filePaths[0], "utf8");
      const imported = JSON.parse(data);

      // 导入数据到数据库
      const importedPrompts = [];
      for (const item of imported) {
        const newPrompt = {
          ...item,
          id: generatePromptId(),
        };
        await db.addPrompt(newPrompt);
        importedPrompts.push(newPrompt);
      }

      return importedPrompts;
    }
    return null;
  });
}
