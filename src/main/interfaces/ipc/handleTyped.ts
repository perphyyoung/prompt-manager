/**
 * 类型化 IPC 注册
 * 通道名取自 IPC 常量, 入参/返回值受 IpcApi 契约约束;
 * 任何契约漂移(改名/漏通道/payload 不符)在编译期报错。
 */

import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { IPC, type IpcApi } from "../../../shared/ipc-contract.js";
import { logError } from "../../mainLogger.js";

type MaybePromise<T> = T | Promise<T>;

export function handleTyped<K extends keyof IpcApi>(
  key: K,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: Parameters<IpcApi[K]>
  ) => MaybePromise<Awaited<ReturnType<IpcApi[K]>>>,
): void {
  ipcMain.handle(IPC[key], (event, ...args: unknown[]) =>
    (handler as unknown as (e: IpcMainInvokeEvent, ...a: unknown[]) => unknown)(event, ...args),
  );
}

/**
 * 带错误日志的类型化注册:handler 抛错时统一记录日志后原样抛出。
 * 路由层"错误翻译"的固定形态(log + rethrow)由这里承担,handler 不再手写 try/catch;
 * catch 中有额外行为(error 进度、降级返回值)的场景仍用 handleTyped 自己写。
 */
export function handleLogged<K extends keyof IpcApi>(
  key: K,
  logMessage: string,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: Parameters<IpcApi[K]>
  ) => MaybePromise<Awaited<ReturnType<IpcApi[K]>>>,
): void {
  ipcMain.handle(IPC[key], async (event, ...args: unknown[]) => {
    try {
      return await (handler as unknown as (e: IpcMainInvokeEvent, ...a: unknown[]) => unknown)(
        event,
        ...args,
      );
    } catch (error) {
      logError("Main", logMessage, error);
      throw error;
    }
  });
}
