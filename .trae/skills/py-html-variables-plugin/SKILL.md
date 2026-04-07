---
name: "py-html-variables-plugin"
description: "Creates a Vite plugin to inject TypeScript constants into HTML at build time. Invoke when needing to share constants between HTML templates and TypeScript code."
---

# HTML TypeScript Constants Plugin

Inject TypeScript constants into HTML at build time via placeholder replacement.

## Usage

### 1. Create the Vite Plugin

```typescript
// electron.vite.config.ts
import { Constants } from './src/constants.ts'

function htmlVariablesPlugin() {
  return {
    name: 'py-html-variables-plugin',
    transformIndexHtml(html: string) {
      const usedKeys = new Set<string>()
      const result = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        usedKeys.add(key)
        const id = (Constants.Ids as Record<string, string>)[key]
        return id ?? match
      })

      for (const key of usedKeys) {
        if (!(key in Constants.Ids)) {
          throw new Error(`[py-html-variables-plugin] Invalid placeholder: {{${key}}}`)
        }
      }

      return result
    }
  }
}
```

### 2. Register the Plugin

```typescript
renderer: {
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: [
    htmlVariablesPlugin()
  ],
}
```

### 3. Define Constants

```typescript
// src/constants.ts
export class Constants {
  static Ids = Object.freeze({
    REFRESH_DATA_BTN: 'refreshDataBtn',
    RELAUNCH_BTN: 'relaunchBtn'
  } as const)
}
```

### 4. Use Placeholders in HTML

```html
<button id="{{REFRESH_DATA_BTN}}">刷新</button>
<button id="{{RELAUNCH_BTN}}">重启</button>
```

## Placeholder Syntax

- Format: `{{CONSTANT_NAME}}`
- Regex: `/\{\{(\w+)\}\}/g`
- Must match a key in `Constants.Ids`

## Features

| Feature | Description |
| ------- | ----------- |
| Build-time replacement | No runtime overhead |
| Single source of truth | Constants defined once in TypeScript |
| Compile-time validation | Throws error for undefined placeholders during build |
| Fallback behavior | Undefined placeholders are preserved as-is for easy debugging |

## Requirements

- Vite or electron-vite project
- Constants defined in a module that can be imported in config files

## When NOT to Use

- When constants are only used in TypeScript files (no HTML reference)

## Known Limitations

- Duplicate placeholders in HTML are de-duplicated during validation (using Set)
- Constants.Ids is accessed via type assertion `as Record<string, string>`
- No warning for unused constants in Constants.Ids (definitions not referenced in HTML)

## Usage Example

This plugin is used in the prompt-manager project:

- Plugin definition: `electron.vite.config.ts`
- Constants: `src/constants.ts` (`Constants.Ids`)
- HTML usage: `src/renderer/index.html` (`{{REFRESH_DATA_BTN}}`, `{{RELAUNCH_BTN}}`)

## Problem

HTML templates cannot directly import TypeScript modules. When you want to use the same constant values (like element IDs) in both HTML and TypeScript, you traditionally have to:

1. Define constants in TypeScript
2. Duplicate the values as string literals in HTML attributes

This leads to maintenance issues where the two definitions can get out of sync.

## Solution

Use a Vite plugin to replace placeholder syntax in HTML with actual constant values during the build phase.
