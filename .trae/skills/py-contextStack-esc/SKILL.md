---
name: "py-contextStack-esc"
description: "Use ContextStackManager to handle ESC key for closing nested UI contexts (modals, toolbars, dropdowns)."
---

# ESC Key Context Stack Management

Handle ESC key to close nested UI contexts in the correct order using ContextStackManager.

## Quick Start

### 1. Copy ContextStackManager

```typescript
// src/managers/ContextStackManager.ts
export interface IContextStackEntry {
  id: string;
  state: {
    isBatchToolbarVisible: boolean;
  };
  close: () => void;
}

export class ContextStackManager {
  private static instance: ContextStackManager;
  private stack: IContextStackEntry[] = [];

  static getInstance(): ContextStackManager {
    if (!ContextStackManager.instance) {
      ContextStackManager.instance = new ContextStackManager();
    }
    return ContextStackManager.instance;
  }

  private constructor() {}

  push(entry: IContextStackEntry): void {
    const currentTop = this.stack[this.stack.length - 1];
    if (currentTop?.id === entry.id) return;

    // Auto-close previous context if it has batch toolbar
    if (currentTop?.state.isBatchToolbarVisible) {
      currentTop.close();
      currentTop.state.isBatchToolbarVisible = false;
    }

    this.stack.push(entry);
  }

  pop(expectedId?: string): boolean {
    if (this.stack.length === 0) return false;
    if (expectedId && this.stack[this.stack.length - 1].id !== expectedId) {
      return false;
    }
    this.stack.pop();
    return true;
  }

  peekId(): string | undefined {
    return this.stack[this.stack.length - 1]?.id;
  }
}

export const contextStack = ContextStackManager.getInstance();
```

### 2. Setup ShortcutManager

```typescript
// src/utils/ShortcutManager.ts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const id = contextStack.peekId();
    if (!id) return;

    const element = document.getElementById(id);
    if (element && typeof (element as any).close === 'function') {
      (element as any).close();
      e.preventDefault();
    }
  }
});
```

### 3. Use in Your Component

```typescript
function openModal(): void {
  const modal = document.getElementById('myModal');
  modal.classList.add('active');

  const entry: IContextStackEntry = {
    id: 'myModal',
    state: { isBatchToolbarVisible: false },
    close: () => {
      modal.classList.remove('active');
      contextStack.pop('myModal');
    }
  };
  contextStack.push(entry);

  // Attach close method for ESC handling
  (modal as any).close = entry.close;
}
```

## How It Works

| Action | Stack State | ESC Result |
| -------- | ------------- | ------------ |
| Open modal | `['panel', 'modal']` | Close modal |
| Open toolbar | `['panel', 'modal', 'toolbar']` | Close toolbar |
| ESC pressed | `['panel', 'modal']` | Close modal |
| ESC pressed | `['panel']` | Nothing (panel stays) |

## Key Rules

1. **Always push when opening** - Any closable UI (modal, toolbar, dropdown) must push to stack
2. **Always attach close method** - `(element as any).close = entry.close` enables ESC handling
3. **Always pop when closing** - Keep stack in sync with actual UI state
4. **Main panels don't close** - Base panels (like 'panel') should not be closable by ESC

## Example: Modal with Batch Toolbar

```typescript
class DetailModal {
  private isBatchMode = false;

  open(): void {
    const modal = document.getElementById('detailModal');
    modal.classList.add('active');

    contextStack.push({
      id: 'detailModal',
      state: { isBatchToolbarVisible: this.isBatchMode },
      close: () => {
        // Clean up batch mode if active
        if (this.isBatchMode) {
          this.exitBatchMode();
        }
        modal.classList.remove('active');
        contextStack.pop('detailModal');
      }
    });

    (modal as any).close = () => this.close();
  }

  enterBatchMode(): void {
    this.isBatchMode = true;
    // Update stack state
    const entry = contextStack.getStack().find(e => e.id === 'detailModal');
    if (entry) entry.state.isBatchToolbarVisible = true;
  }

  close(): void {
    const entry = contextStack.getStack().find(e => e.id === 'detailModal');
    entry?.close();
  }
}
```

## API Reference

| Method | Description |
| -------- | ------------- |
| `push(entry)` | Add context to stack, auto-closes previous batch toolbar |
| `pop(id?)` | Remove context from stack, optionally verify ID |
| `peekId()` | Get current active context ID |
| `getStack()` | Get full stack array (for debugging) |

## State Field

The `state.isBatchToolbarVisible` field tells the manager:

- When `true`: This context has a batch toolbar that should be closed before opening another
- When `false`: Normal context, no special cleanup needed

This enables automatic cleanup when pushing new contexts.
