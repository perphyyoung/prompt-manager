import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, throttle } from '../../src/utils/debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应该延迟执行函数', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('应该在延迟时间内多次调用时只执行最后一次', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('first');
    debouncedFn('second');
    debouncedFn('third');

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('应该正确传递参数', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('arg1', 'arg2', 123);

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123);
  });
});

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应该限制执行频率', () => {
    const fn = vi.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    throttledFn();
    throttledFn();

    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    throttledFn();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
