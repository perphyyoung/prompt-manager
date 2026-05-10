# E2E 测试专用数据库 SPEC

## 实现决策

### 测试文件结构

```
e2e/
├── *.spec.ts           # 测试文件
├── electron-test.ts    # 测试辅助工具和 fixture
└── global-setup.ts     # 全局构建
```

### Fixture 机制

使用 **worker-scoped fixture** 管理应用生命周期和测试数据目录：

```typescript
export const test = base.extend<
  {
    electronTest: ReturnType<typeof createElectronTest>;
    page: ReturnType<ReturnType<typeof createElectronTest>["getPage"]>;
  },
  {
    _electronTest: ReturnType<typeof createElectronTest>;
    _testDataDir: string;
  }
>({
  // worker-scoped fixture：测试数据目录
  _testDataDir: [
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const testDataDir = getTestDataDir();
      await use(testDataDir);
      // 测试完成后清理测试数据目录
      try {
        rmSync(testDataDir, { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    },
    { scope: "worker" },
  ],
  // worker-scoped fixture：在 worker 级别管理应用生命周期
  _electronTest: [
    async ({ _testDataDir }, use) => {
      const electronTest = createElectronTest(_testDataDir);
      await electronTest.launch();
      await use(electronTest);
      await electronTest.close();
    },
    { scope: "worker" },
  ],
  // test-scoped fixture：传递 electronTest 给测试使用
  electronTest: async ({ _electronTest }, use) => {
    await use(_electronTest);
  },
  // test-scoped fixture：传递 page 给测试使用
  page: async ({ _electronTest }, use) => {
    await use(_electronTest.getPage());
  },
});
```

> **说明**：
>
> - `_testDataDir` 是 worker-scoped，每个 worker 生成唯一的临时目录
> - `_electronTest` 是 worker-scoped，应用在 worker 生命周期内只启动和关闭一次
> - `electronTest` 和 `page` 是 test-scoped，每个测试项都能访问同一个应用实例

### Playwright 并行配置

```typescript
// playwright.config.ts
{
  workers: 4,        // 最多 4 个 worker 进程
  fullyParallel: false,  // 文件间并行，文件内顺序（默认行为）
}
```

| 配置 | Worker 分配 | 文件内测试 |
|------|-------------|-----------|
| `workers: N` | 最多 N 个 worker 进程并行执行测试文件 | 由 `fullyParallel` 控制 |
| `fullyParallel: false`（默认） | 测试文件并行分配给 workers | 同一文件内顺序执行 |
| `fullyParallel: true` | 测试文件并行分配给 workers | 同一文件内也并行执行 |

### 测试数据目录生成

```typescript
function getTestDataDir(): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).slice(2, 8);
  return join(tmpdir(), `prompt-manager-e2e-${timestamp}-${randomId}`);
}
```

### 主进程环境变量处理

```typescript
// 检测是否为 E2E 测试模式（使用独立的数据目录）
const e2eTestDataDir = process.env.E2E_TEST_DATA_DIR;

async function loadConfig() {
  // E2E 测试模式下使用独立的数据目录
  if (e2eTestDataDir) {
    currentDataDir = e2eTestDataDir;
    return { rootDir: app.getPath('userData'), dataDir: e2eTestDataDir };
  }

  const config = await configManager.loadConfig();
  currentDataDir = config.dataDir;
  return config;
}
```

### 测试数据标识

| 类型 | 标识 | 说明 |
|------|------|------|
| 图像文件名 | `e2e_` 前缀 | 用于识别测试创建的图像 |
| 提示词内容 | `e2e_` 前缀 | 用于识别测试创建的提示词 |
| 标签/标签组 | `e2e_` 前缀 | 用于识别测试创建的标签 |

命名模式：`e2e_{label}_{timestamp}_{random}`

### 测试文件模板

```typescript
import { expect } from "@playwright/test";
import { Constants } from "../src/constants.ts";
import {
  test,
  // ... 辅助函数
} from "./electron-test.ts";

test.describe("功能模块名称", () => {
  // ========== 初始化 ==========
  test.beforeAll(async ({ electronTest }) => {
    // 创建基础测试数据（用于打开详情视图、批量选择等操作）
    await electronTest.createTestImages(3, "shared");
    await electronTest.createTestPrompts(3, "shared");

    // 刷新界面以显示新数据
    await electronTest.refreshData();
  });

  // ========== 不涉及增删改的测试项 ==========
  test("测试项A", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    // 使用 beforeAll 创建的基础数据
  });

  // ========== 新建类测试（跳过 beforeAll 创建）==========
  test("新建标签", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    // 直接测试新建功能
    const newTagName = electronTest.generateE2ePrefixName("new_tag");
    await createImageTagInManager(page, newTagName);
    // 验证...
  });

  // ========== 删除类测试（确保创建足够数据）==========
  test("删除标签", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    // 确保有足够的测试数据（如果需要）
    await electronTest.createImageTags(2, "delete_test");
    // 执行删除测试
    // ...
  });
});
```

> **注意**：使用测试专用数据库后，不再需要 `afterAll` 清理数据，测试数据目录会在测试文件完成后自动删除。

## 模块设计

### 模块职责

| 模块 | 职责 |
|------|------|
| `electron-test.ts` | 提供测试 fixture、辅助函数、应用生命周期管理 |
| `global-setup.ts` | 全局构建配置 |
| `*.spec.ts` | 测试用例定义 |

### 公开接口

| 接口 | 说明 |
|------|------|
| `test` | Playwright 测试实例（已配置 worker-scoped fixture） |
| `electronTest` | 测试辅助工具实例 |
| `page` | Playwright 页面实例 |
| `createElectronTest(dir)` | 创建测试辅助工具实例 |
| `getTestDataDir()` | 获取测试专用数据目录路径 |

### 依赖关系

```
electron-test.ts
├── test fixture (_testDataDir, _electronTest, electronTest, page)
├── createElectronTest()
├── getTestDataDir()
└── 测试辅助函数 (generateE2ePrefixName, refreshData, cleanupAllE2eTestData)
```

### 数据流

```
Playwright Worker 启动
    ↓
_testDataDir fixture 创建临时目录
    ↓
_electronTest fixture 启动应用（传入数据目录）
    ↓
electronTest/page fixture 传递给测试
    ↓
测试执行
    ↓
Worker 结束
    ↓
_testDataDir fixture 清理临时目录
```

## 测试决策

### 好测试的标准

- 只测试外部行为（UI 状态、API 结果），不测试实现细节
- 测试文件之间相互独立，无隐式依赖

### 测试覆盖的模块

- `electron-test.ts` 中的 fixture 机制
- 测试专用数据库的隔离性
- 测试数据的自动清理

### 测试先例

参考 `1-shortcut-esc.spec.ts` 中的实现模式：

- `beforeAll` 创建基础测试数据
- `refreshData()` 刷新界面显示数据
- 不再调用 `cleanupAllE2eTestData()`（由测试专用数据库自动处理）

## 相关文档

- 产品需求文档：`.docs/prds/prd-e2e-测试专用数据库.md`
- 技能指导：`.trae/skills/py-e2e-testing/SKILL.md`
- 实现代码：`e2e/electron-test.ts`
