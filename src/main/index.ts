/**
 * Prompt Manager - Electron 主进程入口
 * 只负责装配：注册 IPC 路由并启动应用。
 * 窗口/托盘/生命周期见 bootstrap.ts，各域 handler 见 interfaces/ipc/*。
 */

import { registerAllIpc } from "./interfaces/ipc/index.js";
import { startApp } from "./bootstrap.js";

registerAllIpc();
startApp();
