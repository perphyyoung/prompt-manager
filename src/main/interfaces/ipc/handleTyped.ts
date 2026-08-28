/**
 * 类型化 IPC 注册
 * 通道名取自 IPC 常量, 入参/返回值受 IpcApi 契约约束;
 * 任何契约漂移(改名/漏通道/payload 不符)在编译期报错。
 */

import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { IPC, type IpcApi } from "../../../shared/ipc-contract.js";

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
