/**
 * 批量工具栏特性模块
 * 原为 src/middle 独立层，现归位为 renderer 特性切片；
 * 对 renderer 其余部分单向提供批量工具栏能力。
 */

export { BatchToolbarMiddle, batchToolbarMiddle } from "./BatchToolbarMiddle.ts";
export type {
  BatchBusinessConfig,
  ToolbarContext,
  BatchToolbarConfig,
} from "./BatchToolbarMiddle.ts";
export type { ToolbarButtonConfig } from "../../../lib/batch-toolbar/index.ts";
