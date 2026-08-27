/**
 * Renderer 工具类统一导出
 * 集中管理渲染进程专用工具类
 */

export { HoverTooltipManager } from "./HoverTooltipManager.ts";
export { SaveManager } from "./SaveManager.ts";
export { ShortcutManager } from "./ShortcutManager.ts";
export { ErrorHandler } from "./ErrorHandler.ts";
export { SaveStrategy, PromptSaveStrategy, ImageSaveStrategy } from "./SaveStrategy.ts";
export { focusInput } from "./DomUtils.ts";
export {
  VirtualScroller,
  type VisibleRange,
  type VirtualScrollerConfig,
} from "./VirtualScroller.ts";
export { VirtualScrollBar, type VirtualScrollBarOptions } from "./VirtualScrollBar.ts";
export { VirtualWindowRenderer, type IVirtualWindowHost } from "./VirtualWindowRenderer.ts";
