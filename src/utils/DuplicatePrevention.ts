import { logger } from "./Logger.ts";
/**
 * 防重复提交工具
 * 提供装饰器和辅助函数防止重复提交
 */

/**
 * 防重复提交装饰器选项
 */
interface DuplicatePreventionOptions {
  /** 错误消息 */
  errorMessage?: string;
  /** 是否在完成后自动重置 */
  autoReset?: boolean;
}

/**
 * 带防重复提交功能的方法类型
 */
type MethodWithDuplicatePrevention<T, Args extends unknown[], R> = ((
  this: T,
  ...args: Args
) => Promise<R>) & {
  /** 是否正在执行中 */
  _isExecuting?: boolean;
  /** 重置执行状态 */
  _resetExecution?: () => void;
};

/**
 * 防重复提交装饰器
 * 防止异步方法被重复调用
 *
 * @example
 * class MyManager {
 *   @withDuplicatePrevention({ errorMessage: '正在保存中...' })
 *   async save() {
 *     // 保存逻辑
 *   }
 * }
 *
 * @param options - 配置选项
 * @returns 装饰器函数
 */
export function withDuplicatePrevention<T, Args extends unknown[], R>(
  options: DuplicatePreventionOptions = {},
): (
  target: MethodWithDuplicatePrevention<T, Args, R>,
  context: ClassMethodDecoratorContext<T, MethodWithDuplicatePrevention<T, Args, R>>,
) => MethodWithDuplicatePrevention<T, Args, R> {
  const { errorMessage = "操作正在进行中，请稍候...", autoReset = true } = options;

  return function (
    target: MethodWithDuplicatePrevention<T, Args, R>,
    _context: ClassMethodDecoratorContext<T, MethodWithDuplicatePrevention<T, Args, R>>,
  ): MethodWithDuplicatePrevention<T, Args, R> {
    let isExecuting = false;

    const wrappedMethod = async function (this: T, ...args: Args): Promise<R | undefined> {
      if (isExecuting) {
        logger.warn("DuplicatePrevention", errorMessage);
        return undefined;
      }

      isExecuting = true;

      try {
        const result = await target.call(this, ...args);
        return result;
      } finally {
        if (autoReset) {
          isExecuting = false;
        }
      }
    } as MethodWithDuplicatePrevention<T, Args, R>;

    // 暴露重置方法
    wrappedMethod._resetExecution = () => {
      isExecuting = false;
    };

    return wrappedMethod;
  };
}

/**
 * 防重复提交包装函数
 * 用于函数式编程场景
 *
 * @example
 * const saveWithPrevention = wrapWithDuplicatePrevention(saveFunction, {
 *   errorMessage: '正在保存中...'
 * });
 *
 * @param fn - 要包装的函数
 * @param options - 配置选项
 * @returns 包装后的函数
 */
export function wrapWithDuplicatePrevention<T, Args extends unknown[], R>(
  fn: (this: T, ...args: Args) => Promise<R>,
  options: DuplicatePreventionOptions = {},
): (this: T, ...args: Args) => Promise<R | undefined> {
  const { errorMessage = "操作正在进行中，请稍候...", autoReset = true } = options;
  let isExecuting = false;

  return async function (this: T, ...args: Args): Promise<R | undefined> {
    if (isExecuting) {
      logger.warn("DuplicatePrevention", errorMessage);
      return undefined;
    }

    isExecuting = true;

    try {
      const result = await fn.call(this, ...args);
      return result;
    } finally {
      if (autoReset) {
        isExecuting = false;
      }
    }
  };
}

/**
 * 创建防重复提交执行器
 * 用于需要更精细控制的场景
 *
 * @example
 * const executor = createDuplicatePreventionExecutor();
 *
 * async function save() {
 *   return executor.execute(async () => {
 *     // 保存逻辑
 *   }, { errorMessage: '正在保存中...' });
 * }
 *
 * @returns 执行器对象
 */
export function createDuplicatePreventionExecutor() {
  let isExecuting = false;

  return {
    /**
     * 执行函数，防止重复执行
     * @param fn - 要执行的函数
     * @param options - 配置选项
     * @returns 执行结果
     */
    async execute<R>(
      fn: () => Promise<R>,
      options: DuplicatePreventionOptions = {},
    ): Promise<R | undefined> {
      const { errorMessage = "操作正在进行中，请稍候..." } = options;

      if (isExecuting) {
        logger.warn("DuplicatePrevention", errorMessage);
        return undefined;
      }

      isExecuting = true;

      try {
        const result = await fn();
        return result;
      } finally {
        isExecuting = false;
      }
    },

    /**
     * 重置执行状态
     */
    reset(): void {
      isExecuting = false;
    },

    /**
     * 获取当前执行状态
     */
    get isExecuting(): boolean {
      return isExecuting;
    },
  };
}

/**
 * 防重复提交 Mixin 接口
 */
export interface IDuplicatePrevention {
  executeWithPrevention<R>(
    operationKey: string,
    fn: () => Promise<R>,
    options?: DuplicatePreventionOptions,
  ): Promise<R | undefined>;
  resetPreventionState(operationKey: string): void;
  resetAllPreventionStates(): void;
}

/**
 * 管理器基类混入
 * 为类提供防重复提交功能
 *
 * @example
 * class MyManager extends DuplicatePreventionMixin(BaseClass) {
 *   async save() {
 *     return this.executeWithPrevention(async () => {
 *       // 保存逻辑
 *     }, { errorMessage: '正在保存中...' });
 *   }
 * }
 */
export function DuplicatePreventionMixin<T extends new (...args: any[]) => object>(
  Base: T,
): T & (new (...args: any[]) => IDuplicatePrevention) {
  return class extends Base implements IDuplicatePrevention {
    private _duplicatePreventionExecutors = new Map<
      string,
      ReturnType<typeof createDuplicatePreventionExecutor>
    >();

    constructor(...args: any[]) {
      super(...args);
    }

    /**
     * 执行函数，防止重复执行
     * @param operationKey - 操作标识
     * @param fn - 要执行的函数
     * @param options - 配置选项
     * @returns 执行结果
     */
    executeWithPrevention<R>(
      operationKey: string,
      fn: () => Promise<R>,
      options: DuplicatePreventionOptions = {},
    ): Promise<R | undefined> {
      if (!this._duplicatePreventionExecutors.has(operationKey)) {
        this._duplicatePreventionExecutors.set(operationKey, createDuplicatePreventionExecutor());
      }

      const executor = this._duplicatePreventionExecutors.get(operationKey)!;
      return executor.execute(fn, options);
    }

    /**
     * 重置指定操作的执行状态
     * @param operationKey - 操作标识
     */
    resetPreventionState(operationKey: string): void {
      const executor = this._duplicatePreventionExecutors.get(operationKey);
      if (executor) {
        executor.reset();
      }
    }

    /**
     * 重置所有操作的执行状态
     */
    resetAllPreventionStates(): void {
      this._duplicatePreventionExecutors.forEach((executor) => executor.reset());
    }
  } as T & (new (...args: any[]) => IDuplicatePrevention);
}
