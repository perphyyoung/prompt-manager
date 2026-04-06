import { ElementId } from '../../constants.ts';

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
  private stack: ElementId[] = [];

  static getInstance(): ContextStackManager {
    if (!ContextStackManager.instance) {
      ContextStackManager.instance = new ContextStackManager();
    }
    return ContextStackManager.instance;
  }

  private constructor() {}

  /**
   * 压栈 - 进入新的 UI 上下文
   * @param id - DOM 元素 ID
   */
  push(id: ElementId): void {
    if (this.stack[this.stack.length - 1] === id) {
      window.electronAPI.logWarn('ContextStackManager', `push: skipped ${id} (already on top)`);
      return;
    }

    this.stack.push(id);
    window.electronAPI.logDebug('ContextStackManager', `push: ${id}, stack=[${this.stack.join(', ')}]`);
  }

  /**
   * 出栈 - 退出指定的 UI 上下文
   * @param expectedId - 期望出栈的 ID（用于验证）
   * @returns 是否成功出栈
   */
  pop(expectedId?: ElementId): boolean {
    if (this.stack.length === 0) {
      window.electronAPI.logWarn('ContextStackManager', `pop: skipped (stack is empty)`);
      return false;
    }

    const top = this.stack[this.stack.length - 1];
    if (expectedId && top !== expectedId) {
      window.electronAPI.logError('ContextStackManager',
        `pop: mismatch! expected=${expectedId}, actual=${top}, stack=[${this.stack.join(', ')}]`);
      return false;
    }

    const popped = this.stack.pop();
    const stackTrace = new Error().stack?.split('\n').slice(2, 5).join(' | ');
    window.electronAPI.logDebug('ContextStackManager',
      `pop: ${popped}, stack=[${this.stack.join(', ')}], caller=${stackTrace}`);
    return true;
  }

  /**
   * 获取栈顶 ID（当前活动上下文）
   * @returns 当前活动的 DOM 元素 ID
   */
  peek(): ElementId | undefined {
    return this.stack[this.stack.length - 1];
  }

  /**
   * 获取完整堆栈（用于调试）
   * @returns 堆栈的副本
   */
  getStack(): ElementId[] {
    return [...this.stack];
  }

  /**
   * 重置堆栈
   */
  reset(): void {
    window.electronAPI.logInfo('ContextStackManager', `reset stack`);
    this.stack = [];
  }

  /**
   * 检查指定 ID 是否在堆栈中
   * @param id - 要检查的 DOM 元素 ID
   * @returns 是否在堆栈中
   */
  contains(id: ElementId): boolean {
    return this.stack.includes(id);
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
    return this.stack[this.stack.length - 1] === id;
  }
}

// 导出单例实例
export const contextStack = ContextStackManager.getInstance();
