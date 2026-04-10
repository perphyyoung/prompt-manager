# DialogService 重构方案

## 1. 问题分析

### 1.1 当前问题

- **TagManager 事件重复绑定**: `render()` 每次调用都重新绑定事件监听器，导致多次点击按钮时事件处理函数被多次触发
- **DialogService 焦点恢复问题**: 输入对话框关闭时恢复焦点 (`_previousFocus.focus()`)，触发意外的 click 事件
- **MultiSelectManager 性能问题**: `updateToolbarUI` 被频繁调用，导致 UI 卡顿

### 1.2 根因

- TagManager: `render()` 中重置 `_eventsBound = false` 并重新调用 `bindEvents()`，但事件监听器没有被移除
- DialogService: 焦点恢复机制在特定场景下（如新建标签后删除）触发意外的点击事件
- MultiSelectManager: 每次状态变化都同步调用 `updateToolbarUI()`，没有防抖机制

## 2. 设计方案

### 2.1 核心原则

- **单一职责**: DialogService 只负责对话框显示/隐藏，TagManager 只负责标签管理
- **事件绑定分离**: 初始化时绑定一次事件，不在 render 中重复绑定
- **性能优化**: 使用防抖 (debounce) 和 requestAnimationFrame 优化 UI 更新
- **Promise 异步**: 保持现有 Promise 接口，兼容现有代码

### 2.2 架构图

```
TagManager/其他调用者
    ↓ 调用 showInputDialog/showConfirmDialog
DialogService
    ├─ init() - 页面加载时调用，绑定事件（一次）
    ├─ showXxxDialog() - 显示对话框，返回 Promise
    └─ 事件处理器 - 调用 resolve 并关闭对话框
ContextStackManager
    ↓ push/pop 管理对话框层级
DOM
```

## 3. 详细实现

### 3.1 DialogService 重构

**关键变更**:

- 移除 `_previousFocus` 焦点恢复机制（简化代码，避免意外触发）
- 事件绑定已在 `init()` 中完成，保持不变

```typescript
// src/renderer/services/DialogService.ts

// ==================== 静态变量 ====================
let _initialized = false;
let _confirmCallback: ((result: boolean) => void) | null = null;
let _inputResolve: ((result: { value: string; groupId?: number | null } | null) => void) | null = null;
let _selectResolve: ((result: string | null) => void) | null = null;
// 已移除: _previousFocus

// ==================== 对话框服务 ====================
export class DialogService {
  /**
   * 初始化 - 页面加载时调用一次
   */
  static init(): void {
    if (_initialized) return;
    _initialized = true;

    // 使用事件委托处理所有对话框按钮点击
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // 输入对话框 - 确定按钮
      if (target.closest(`#${Constants.Ids.INPUT_OK_BTN}`)) {
        e.stopPropagation();
        // ... 处理逻辑
        DialogService._closeInputDialog();
        return;
      }

      // 其他按钮处理...
    });
  }

  private static _closeInputDialog(): void {
    const modal = document.getElementById(Constants.Ids.INPUT_MODAL);
    if (modal) {
      (modal as HTMLElement).style.display = 'none';
    }
    contextStack.pop(Constants.Ids.INPUT_DIALOG);
    _inputResolve = null;
    // 已移除: _previousFocus.focus()
  }

  // 其他方法类似...
}
```

### 3.2 TagManager 重构

**关键变更**:

- 将事件绑定从 `container.addEventListener` 改为 `document.addEventListener`
- 在构造函数中绑定一次，不在 `render()` 中重复绑定
- 使用 `container.contains(target)` 检查点击是否在容器内

```typescript
// src/renderer/managers/TagManager.ts

export abstract class TagManager {
  constructor() {
    // ... 其他初始化
    this.bindEvents(); // 只绑定一次
  }

  /**
   * 绑定事件（使用事件委托到 document）
   * 只在初始化时调用一次，不在 render 中重复绑定
   */
  bindEvents(): void {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // 使用事件委托处理所有点击事件
    document.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      
      // 检查点击是否在标签管理器容器内
      const container = document.getElementById(this.elements.containerId);
      if (!container?.contains(target)) return;
      
      // 处理删除按钮点击
      const deleteBtn = target.closest('.tag-delete-btn');
      if (deleteBtn && !this._isOperationInProgress) {
        e.stopPropagation();
        const tag = (deleteBtn as HTMLElement).dataset.tag;
        if (tag) {
          this._isOperationInProgress = true;
          await this.deleteTag(tag);
          this._isOperationInProgress = false;
        }
        return;
      }
      
      // 其他处理...
    });
  }

  render(): void {
    // 只负责渲染，不绑定事件
    container.innerHTML = html;
    
    // 绑定容器特定的拖拽和右键菜单事件
    this.bindContainerEvents(container);
  }
}
```

### 3.3 MultiSelectManager 性能优化

**关键变更**:

- 使用 `rafDebounce` 防抖 `updateToolbarUI`
- 将同步更新改为异步批量更新

```typescript
// src/renderer/managers/MultiSelectManager.ts

import { rafDebounce } from '../../utils/debounce';

export class MultiSelectManager {
  // 将原来的 updateToolbarUI 重命名为 _doUpdateToolbarUI
  private _doUpdateToolbarUI(): void {
    window.electronAPI.logDebug('MultiSelectManager', `updateToolbarUI called, hasSelection=${this.hasSelection}, count=${this.count}`);
    if (this.hasSelection) {
      if (this.toolbar?.visible) {
        this.toolbar?.updateCount(this.count);
      } else {
        this.toolbar?.show(this.count);
      }
    } else {
      this.toolbar?.hide(false);
    }
  }

  // 创建防抖版本的 updateToolbarUI
  updateToolbarUI = rafDebounce(() => {
    this._doUpdateToolbarUI();
  });
}
```

### 3.4 防抖工具函数

```typescript
// src/utils/debounce.ts

/**
 * 防抖函数
 * 延迟执行，如果在延迟时间内再次调用，则重新计时
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
```

## 4. 改动点总结

| 文件 | 改动内容 |
|------|----------|
| `DialogService.ts` | 移除 `_previousFocus` 焦点恢复机制 |
| `TagManager.ts` | 事件绑定改为 document 委托，render 不再绑定事件 |
| `MultiSelectManager.ts` | 使用 `rafDebounce` 优化 `updateToolbarUI` |
| `debounce.ts` (新建) | 添加防抖工具函数（`debounce`、`rafDebounce`、`throttle`、`immediateDebounce`） |

## 5. 兼容性

- 保持现有 `showInputDialog` / `showConfirmDialogByConfig` / `showSelectDialog` 接口不变
- 保持 Promise 返回值不变
- 保持 ContextStackManager 集成不变
- 无需修改调用者代码

## 6. 预期效果

- **消除重复 click**: 事件只绑定一次，不再出现多次触发
- **消除焦点问题**: 移除焦点恢复机制，避免意外触发点击
- **性能提升**: `updateToolbarUI` 调用频率大幅降低，UI 更流畅
- **代码更简洁**: 职责分离，易于维护

## 7. 验证结果

测试验证通过:

- ✅ 新建标签后删除 - 只触发 1 次 click
- ✅ 删除已有标签 - 只触发 1 次 click  
- ✅ 批量删除 - 只触发 1 次 click
- ✅ 删除标签组 - 只触发 1 次 click
