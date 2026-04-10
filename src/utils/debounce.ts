/**
 * 防抖函数
 * 延迟执行，如果在延迟时间内再次调用，则重新计时
 * @param fn - 要执行的函数
 * @param delay - 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * 使用 requestAnimationFrame 的防抖函数
 * 适用于 UI 更新场景，确保在下一帧渲染前执行
 * @param fn - 要执行的函数
 * @returns 防抖后的函数
 */
export function rafDebounce<T extends (...args: unknown[]) => unknown>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;

  return (...args: Parameters<T>) => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
    rafId = window.requestAnimationFrame(() => {
      fn(...args);
    });
  };
}

/**
 * 节流函数
 * 固定时间间隔执行一次
 * @param fn - 要执行的函数
 * @param interval - 间隔时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastTime >= interval) {
      fn(...args);
      lastTime = now;
    }
  };
}

/**
 * 立即执行防抖（适用于防止快速连续点击）
 * 第一次立即执行，后续调用在间隔时间内被忽略
 * 等待上一次函数执行完成后才允许下一次执行
 * @param fn - 要执行的函数
 * @param interval - 间隔时间（毫秒），默认 300ms
 * @returns 防抖后的函数
 * @example
 * const safeClick = immediateDebounce(() => console.log('clicked'), 300);
 * safeClick(); // 立即执行
 * safeClick(); // 被忽略（如果在 300ms 内）
 * safeClick(); // 被忽略（如果在 300ms 内）
 */
export function immediateDebounce<A extends unknown[], R>(
  fn: (...args: A) => R,
  interval: number = 300
): (...args: A) => R | undefined {
  let lastExecutionTime = 0;
  let isExecuting = false;

  return (...args: A): R | undefined => {
    const now = Date.now();
    if (!isExecuting && now - lastExecutionTime >= interval) {
      lastExecutionTime = now;
      isExecuting = true;
      const result = fn(...args);
      if (result instanceof Promise) {
        (result as Promise<void>).finally(() => {
          isExecuting = false;
        });
      } else {
        isExecuting = false;
      }
      return result;
    }
    return undefined;
  };
}
