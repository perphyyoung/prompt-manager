/**
 * 可关闭接口
 * 实现此接口的 DOM 元素可以通过 ESC 键关闭
 */
export interface ICloseable {
  close(): void;
}

export {};

declare global {
  interface HTMLElement {
    close?: () => void;
  }
}
