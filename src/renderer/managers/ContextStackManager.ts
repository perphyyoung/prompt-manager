import { Constants, ElementId } from "../../constants.ts";

/**
 * 上下文栈条目接口
 * 包含视图 ID、状态和关闭回调
 */
export interface IContextStackEntry {
  id: ElementId;
  title?: string;
  state: {
    isBatchToolbarVisible: boolean;
  };
  close: () => void;
}

/**
 * 上下文堆栈管理器
 * 使用堆栈结构管理 UI 上下文层级，支持嵌套界面
 *
 * 堆栈操作示例：
 * 初始: ['promptPanel']
 * 打开详情: ['promptPanel', 'promptDetailModal']  (push)
 * 进入批量: ['promptPanel', 'promptDetailModal', 'promptDetailBatchToolbar']  (push)
 * 按 Esc: 处理 promptDetailBatchToolbar -> pop -> ['promptPanel', 'promptDetailModal']
 * 按 Esc: 处理 promptDetailModal -> pop -> ['promptPanel']
 * 切换面板: ['imagePanel']  (switchPanel)
 */
export class ContextStackManager {
  private static instance: ContextStackManager;
  private stack: IContextStackEntry[] = [];

  static getInstance(): ContextStackManager {
    if (!ContextStackManager.instance) {
      ContextStackManager.instance = new ContextStackManager();
    }
    return ContextStackManager.instance;
  }

  private constructor() {}

  /**
   * 获取堆栈ID列表的字符串表示（用于日志）
   * @returns 格式化的堆栈ID列表字符串
   */
  private getStackIdsString(): string {
    return this.stack.map((e) => e.id).join(", ");
  }

  /**
   * 压栈 - 进入新的 UI 上下文
   * @param entry - 栈条目
   */
  push(entry: IContextStackEntry): void {
    const titleStr = entry.title || "";
    const newId = `${entry.id}${titleStr}`;

    // 检查是否已在栈顶
    const currentTop = this.stack[this.stack.length - 1];
    if (currentTop?.id === entry.id) {
      window.electronAPI.logWarn(
        "ContextStackManager",
        `push ${newId} skipped, stack=[${this.getStackIdsString()}]`,
      );
      return;
    }

    // 关闭当前栈顶（如果有批量工具栏显示）
    // 但确认对话框、输入对话框和选择对话框弹出时不关闭批量工具栏
    const isDialog =
      entry.id === Constants.Ids.CONFIRM_MODAL ||
      entry.id === Constants.Ids.INPUT_MODAL ||
      entry.id === Constants.Ids.SELECT_MODAL;
    if (currentTop?.state.isBatchToolbarVisible && !isDialog) {
      window.electronAPI.logInfo(
        "ContextStackManager",
        `close before push ${currentTop.id} for ${newId}`,
      );
      currentTop.close();
      currentTop.state.isBatchToolbarVisible = false;
    }

    this.stack.push(entry);
    window.electronAPI.logInfo(
      "ContextStackManager",
      `push ${newId}, stack=[${this.getStackIdsString()}]`,
    );
  }

  /**
   * 出栈 - 退出指定的 UI 上下文
   * @param expectedId - 期望出栈的 ID（用于验证）
   * @returns 是否成功出栈
   */
  pop(expectedId: ElementId): boolean {
    if (this.stack.length === 0) {
      window.electronAPI.logWarn(
        "ContextStackManager",
        `pop ${expectedId}: skipped (stack is empty)`,
      );
      return false;
    }

    const top = this.stack[this.stack.length - 1];
    if (top.id !== expectedId) {
      window.electronAPI.logError(
        "ContextStackManager",
        `pop: mismatch! expected=${expectedId}, actual=${top.id}, stack=[${this.getStackIdsString()}]`,
      );
      return false;
    }

    const popped = this.stack.pop();
    const titleStr = popped?.title || "";
    const newId = `${popped?.id}${titleStr}`;
    window.electronAPI.logInfo(
      "ContextStackManager",
      `pop: ${newId}, stack=[${this.getStackIdsString()}]`,
    );

    return true;
  }

  /**
   * 获取栈顶条目（当前活动上下文）
   * @returns 当前活动的栈条目
   */
  peek(): IContextStackEntry | undefined {
    return this.stack[this.stack.length - 1];
  }

  /**
   * 获取栈顶 ID（当前活动上下文）
   * @returns 当前活动的 DOM 元素 ID
   */
  peekId(): ElementId | undefined {
    return this.stack[this.stack.length - 1]?.id;
  }

  /**
   * 获取完整堆栈（用于调试）
   * @returns 堆栈的副本
   */
  getStack(): IContextStackEntry[] {
    return [...this.stack];
  }

  /**
   * 获取堆栈 ID 列表（用于调试）
   * @returns ID 列表
   */
  getStackIds(): ElementId[] {
    return this.stack.map((e) => e.id);
  }

  /**
   * 重置堆栈
   */
  reset(): void {
    window.electronAPI.logInfo("ContextStackManager", `reset stack`);
    this.stack = [];
  }

  /**
   * 检查指定 ID 是否在堆栈中
   * @param id - 要检查的 DOM 元素 ID
   * @returns 是否在堆栈中
   */
  contains(id: ElementId): boolean {
    return this.stack.some((entry) => entry.id === id);
  }

  /**
   * 获取堆栈深度
   * @returns 堆栈中元素的数量
   */
  depth(): number {
    return this.stack.length;
  }

  /**
   * 检查指定 ID 是否在栈顶（当前活动上下文）
   * @param id - 要检查的 DOM 元素 ID
   * @returns 是否在栈顶
   */
  isInContext(id: ElementId): boolean {
    return this.stack[this.stack.length - 1]?.id === id;
  }
}

// 导出单例实例
export const contextStack = ContextStackManager.getInstance();
