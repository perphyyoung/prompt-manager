/**
 * DOM 工具函数
 */

/**
 * 延迟聚焦到输入框
 * 确保在元素可见后再聚焦
 * @param {HTMLElement} input - 要聚焦的元素
 * @param {number} delay - 延迟毫秒数，默认 100ms
 */
export function focusInput(input, delay = 100) {
  if (input) {
    setTimeout(() => input.focus(), delay);
  }
}
