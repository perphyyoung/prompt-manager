/**
 * 事件总线
 * 用于模块间通信和解耦
 * 单例模式实现
 */

// 事件回调函数类型
type EventCallback<T = unknown> = (data: T) => void;

class EventBus {
  private static instance: EventBus;
  private events: Map<string, Set<EventCallback>>;

  private constructor() {
    this.events = new Map();
  }

  /**
   * 获取单例实例
   * @returns EventBus 单例
   */
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * 订阅事件
   * @param event - 事件名称
   * @param callback - 回调函数
   * @returns 取消订阅函数
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback as EventCallback);

    return () => this.off(event, callback);
  }

  /**
   * 取消订阅事件
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    if (!this.events.has(event)) return;
    this.events.get(event)!.delete(callback as EventCallback);

    // 如果没有订阅者，删除事件
    if (this.events.get(event)!.size === 0) {
      this.events.delete(event);
    }
  }

  /**
   * 订阅一次性事件（触发后自动取消订阅）
   * @param event - 事件名称
   * @param callback - 回调函数
   * @returns 取消订阅函数
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    const wrapper = (data: T) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * 触发事件
   * @param event - 事件名称
   * @param data - 事件数据
   */
  emit<T = unknown>(event: string, data?: T): void {
    if (!this.events.has(event)) return;

    const count = this.events.get(event)!.size;
    window.electronAPI.logInfo("EventBus", `emit "${event}", subscribers: ${count}`);
    this.events.get(event)!.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        window.electronAPI?.logError?.("EventBus", `Error in event handler for "${event}":`, error);
      }
    });
  }

  /**
   * 清除所有事件
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * 获取事件订阅者数量
   * @param event - 事件名称
   * @returns 订阅者数量
   */
  listenerCount(event: string): number {
    if (!this.events.has(event)) return 0;
    return this.events.get(event)!.size;
  }
}

// 导出单例实例
export default EventBus.getInstance();
