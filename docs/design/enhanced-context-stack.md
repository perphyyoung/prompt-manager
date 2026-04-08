# 增强型上下文栈设计文档

## 背景

当前 `ContextStackManager` 仅存储视图 ID，导致：
1. 视图状态（如批量工具栏是否显示）无法追踪
2. `VIEW_CHANGED` 事件被滥用为清理触发器，各组件自行处理，逻辑分散
3. 进入新视图时，无法确定上一个视图的状态是否需要清理

## 设计目标

1. 栈条目包含视图状态信息
2. 压栈时自动清理上一个视图的状态
3. 移除 `VIEW_CHANGED` 事件，清理逻辑内聚到 `ContextStackManager`
4. 兼容现有 `close` 等清理机制

## 核心设计

### 1. 栈条目结构

```typescript
export interface IContextStackEntry {
  id: ElementId;
  state: {
    isBatchToolbarVisible: boolean;
  };
  close: () => void;
}
```

- `close` 为必需字段，用于被覆盖时清理状态

### 2. ContextStackManager 实现

```typescript
export class ContextStackManager {
  private stack: IContextStackEntry[] = [];

  push(entry: IContextStackEntry): void {
    const currentTop = this.stack[this.stack.length - 1];
    if (currentTop?.id === entry.id) {
      return;
    }

    // 关闭当前栈顶（如果有批量工具栏显示）
    if (currentTop?.state.isBatchToolbarVisible) {
      currentTop.close();
      currentTop.state.isBatchToolbarVisible = false;
    }

    this.stack.push(entry);
  }

  pop(expectedId?: ElementId): boolean;
  peek(): IContextStackEntry | undefined;
  peekId(): ElementId | undefined;
}
```

### 3. 使用示例

#### DetailViewManager.showModal()

```typescript
showModal(): void {
  const stackEntry: IContextStackEntry = {
    id: this.modalId as ElementId,
    state: { isBatchToolbarVisible: this.isBatchMode },
    close: () => {
      if (this.isBatchMode) {
        this.exitBatchMode();
      }
    }
  };
  contextStack.push(stackEntry);
}
```

#### NavigationManager.switchTo()

```typescript
switchTo(panelName: string): void {
  contextStack.reset();
  const stackEntry: IContextStackEntry = {
    id: panelName === 'prompt' ? Constants.Ids.PROMPT_PANEL : Constants.Ids.IMAGE_PANEL,
    state: { isBatchToolbarVisible: false },
    close: () => { /* 面板级别不需要关闭 */ }
  };
  contextStack.push(stackEntry);
}
```

### 4. 清理职责

| 场景 | 清理方式 |
|------|----------|
| 用户主动关闭（ESC/点击关闭）| DOM 元素的 `close` 方法 |
| 被新视图覆盖 | `ContextStackManager.push()` 调用栈顶的 `close` |

两者互补：
- `close()` - 用户主动关闭时的清理
- `push()` 中的 `close` - 被覆盖时的清理

## 实现变更

### 删除的内容

- `Events.VIEW_CHANGED` 事件
- `TagManager.subscribeToViewChanges()` 方法
- `enableViewChangedEvent` 开关（未实现即删除）

### 修改的文件

- `ContextStackManager.ts` - 核心实现
- `NavigationManager.ts`
- `DetailViewManager.ts`
- `TagManager.ts`
- `BatchToolbar.ts`
- `ImageFullscreenManager.ts`
- `SettingsManager.ts`
- `StatisticsManager.ts`
- `TrashManager.ts`
- `DialogService.ts`
- `TagAutocomplete.ts`
- `ShortcutManager.ts` - `peek()` 改为 `peekId()`
