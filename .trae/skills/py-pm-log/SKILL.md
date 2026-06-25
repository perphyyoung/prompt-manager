---
name: "py-pm-log"
description: "Used for debugging in Electron main/renderer process. Logs are unified to pm.log in the project root directory. Invoke when adding debug logs to trace issues in main or renderer processes."
---

# Prompt Manager Log 使用指南

项目日志**统一输出到项目根目录 `pm.log`**。通过 `electron-log` 实现，主进程和渲染进程共用同一日志文件。

## 主进程 (src/main/)

直接导入 logger 模块：

```typescript
import { logDebug, logInfo, logWarn, logError } from './logger.js';

// 所有日志函数签名一致：(component: string, message: string, data?: unknown)
logDebug('Component', '调试信息', { key: 'value' });
logInfo('Component', '普通信息');
logWarn('Component', '警告信息');
logError('Component', '错误信息', error);
```

## 渲染进程 (src/renderer/)

通过 IPC 通道写入日志：

```typescript
// 正确用法 - 三个参数: (component, message, data?)
window.electronAPI.logDebug('Component', '调试信息', { key: 'value' });
window.electronAPI.logInfo('Renderer', '普通信息');
window.electronAPI.logWarn('Renderer', '警告信息');
window.electronAPI.logError('Renderer', '错误信息', error);

// 多变量拼接
window.electronAPI.logDebug('ImagePanel', `[渲染] 加载 ${count} 张图片`);
```

## 注意事项

- 日志文件位于项目根目录 `pm.log`
- 渲染进程通过 `window.electronAPI` 调用，主进程直接 import
- 删除日志时保留日志系统，不要删除日志生成语句（需用户确认）
- 第一个参数是组件名（component），用于日志过滤和定位问题模块
