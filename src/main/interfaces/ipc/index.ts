/**
 * IPC 路由注册入口
 * 按域聚合所有 IPC handler 注册。
 */

import { registerPromptIpc } from "./promptIpc.js";
import { registerImageIpc } from "./imageIpc.js";
import { registerTagIpc } from "./tagIpc.js";
import { registerTrashIpc } from "./trashIpc.js";
import { registerSystemIpc } from "./systemIpc.js";
import { registerBackupIpc } from "./backupIpc.js";

export function registerAllIpc() {
  registerPromptIpc();
  registerImageIpc();
  registerTagIpc();
  registerTrashIpc();
  registerSystemIpc();
  registerBackupIpc();
}
