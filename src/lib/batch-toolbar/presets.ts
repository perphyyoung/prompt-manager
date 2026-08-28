/**
 * batch-toolbar 库 预设配置
 * 2 个入口的默认工具栏配置
 */

import type { BatchToolbarConfig, ToolbarContext } from "./types.ts";
import { Constants } from "../../renderer/constants.ts";

/** 提示词主界面批量工具栏配置 */
export const PROMPT_MAIN_BATCH_TOOLBAR: BatchToolbarConfig = {
  id: Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR,
  context: "promptMain",
  dataType: "prompt",
  label: "提示词",
  buttons: [
    { action: "SelectAll", text: "全选", className: "batch-action-select-all", order: 1 },
    { action: "Invert", text: "反选", className: "batch-action-invert", order: 2 },
    { action: "AddTag", text: "添加标签", className: "batch-action-addtag", order: 3 },
    { action: "Favorite", text: "切换收藏", className: "batch-action-favorite", order: 4 },
    { action: "Delete", text: "删除", className: "batch-action-delete", order: 5 },
    { action: "Cancel", text: "取消", className: "batch-action-cancel", order: 6 },
  ],
};

/** 图像主界面批量工具栏配置 */
export const IMAGE_MAIN_BATCH_TOOLBAR: BatchToolbarConfig = {
  id: Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR,
  context: "imageMain",
  dataType: "image",
  label: "图像",
  buttons: [
    { action: "SelectAll", text: "全选", className: "batch-action-select-all", order: 1 },
    { action: "Invert", text: "反选", className: "batch-action-invert", order: 2 },
    { action: "AddTag", text: "添加标签", className: "batch-action-addtag", order: 3 },
    { action: "Favorite", text: "切换收藏", className: "batch-action-favorite", order: 4 },
    { action: "Delete", text: "删除", className: "batch-action-delete", order: 5 },
    { action: "Cancel", text: "取消", className: "batch-action-cancel", order: 6 },
  ],
};

/** 预设配置映射 */
export const PRESET_CONFIGS: Record<ToolbarContext, BatchToolbarConfig> = {
  promptMain: PROMPT_MAIN_BATCH_TOOLBAR,
  imageMain: IMAGE_MAIN_BATCH_TOOLBAR,
};

/**
 * 获取预设配置
 * @param context - 工具栏上下文
 * @returns 预设配置
 */
export function getPresetConfig(context: ToolbarContext): BatchToolbarConfig {
  return PRESET_CONFIGS[context];
}

/**
 * 获取所有预设配置
 * @returns 所有预设配置
 */
export function getAllPresetConfigs(): BatchToolbarConfig[] {
  return Object.values(PRESET_CONFIGS);
}
