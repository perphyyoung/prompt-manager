/**
 * pyBatchToolbar 类型定义
 * 批量工具栏库的核心类型
 */

// ========== 基础类型 ==========

/** 工具栏上下文 */
export type ToolbarContext =
  | 'promptMain'
  | 'imageMain'
  | 'promptDetail'
  | 'imageDetail';

/** 数据类型 */
export type DataType = 'prompt' | 'image';

/** 按钮配置 */
export interface ToolbarButtonConfig {
  action: string;           // 动作标识
  text: string;            // 按钮文本
  icon?: string;           // 图标 SVG（可选）
  className?: string;      // 自定义样式类
  title?: string;          // 提示文本
  visible?: boolean;       // 是否显示（默认 true）
  order?: number;          // 排序（默认 0）
}

/** 工具栏配置 */
export interface BatchToolbarConfig {
  id: string;                    // 工具栏唯一 ID
  context: ToolbarContext;       // 上下文
  dataType: DataType;            // 数据类型
  label: string;                 // 计数标签文本
  containerSelector?: string;    // 容器选择器（可选，用于动态创建）
  buttons: ToolbarButtonConfig[]; // 按钮配置
}

// ========== 操作结果类型 ==========

/** 按钮点击事件 */
export interface ButtonClickEvent {
  action: string;
  context: ToolbarContext;
  timestamp: number;
}

/** 工具栏状态 */
export interface ToolbarState {
  isVisible: boolean;
  count: number;
  context: ToolbarContext;
}

// ========== 选项类型 ==========

/** 工具栏选项 */
export interface BatchToolbarOptions {
  config?: Partial<BatchToolbarConfig>;
  onAction: (event: ButtonClickEvent) => void;
  onClose?: () => void;
}

/** 创建选项 */
export interface CreateToolbarOptions {
  context: ToolbarContext;
  customConfig?: Partial<BatchToolbarConfig>;
  onAction: (event: ButtonClickEvent) => void;
  onClose?: () => void;
}
