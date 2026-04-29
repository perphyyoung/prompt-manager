# E2E 测试规范 PRD

## 问题陈述

当前 e2e 测试存在以下问题：

1. **数据管理不一致**：测试数据与生产数据混合，容易产生遗留数据
2. **应用生命周期频繁切换**：部分测试文件中存在多次启动/关闭应用的情况，增加测试时间
3. **测试数据状态耦合**：后续测试可能依赖前面测试创建的数据，当前置测试失败时会连带影响后续测试

## 解决方案

使用**测试专用数据库**，通过 Playwright worker-scoped fixture 实现：

- 每个测试文件使用独立的临时数据目录
- 应用在文件级别只启动和关闭一次
- 测试项之间数据隔离，避免级联失败
- 测试完成后自动清理测试数据
- **不支持并行测试**（并行执行时数据会相互干扰）

## 测试要求

- 公共方法写在 `./e2e/electron-test.ts` 里
- 使用测试专用数据库, 不再需要删除或恢复测试数据

## 功能清单

### 功能-测试数据库隔离

- 每个测试文件使用独立的临时数据目录（位于系统临时目录）
- 通过 `E2E_TEST_DATA_DIR` 环境变量传递测试数据目录路径
- 主进程检测到该环境变量时，使用测试数据目录替代默认数据目录
- 测试完成后自动删除临时数据目录

### 功能-应用生命周期管理

- 每个测试文件只启动和关闭一次应用
- 使用 Playwright worker-scoped fixture 管理应用生命周期
- 中间测试项不再关闭应用

### 功能-测试数据管理

- `beforeAll` 中创建文件级共享的基础测试数据
- 不涉及数据操作的测试项复用 beforeAll 创建的基础数据
- 新建类测试跳过 beforeAll 创建，直接测试新建功能
- 删除类测试在 beforeAll 创建足够数据，删除后不影响后续

### 功能-测试辅助工具

- 提供 `generateE2ePrefixName()` 生成带 e2e_ 前缀的唯一标识
- 提供 `cleanupAllE2eTestData()` 清理所有 e2e 测试数据（保留实现，但测试专用数据库模式下不调用）
- 提供 `refreshData()` 刷新界面以显示新创建的数据

### 功能-全局快捷键支持

为避免测试间状态污染（如模态框未关闭导致后续测试失败），实现以下全局快捷键：

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+I` | 切换到图像主界面 |
| `Ctrl+P` | 切换到提示词主界面 |

**使用场景**：

- 测试辅助函数（如 `enterImageGridView`、`enterPromptGridView` 等）使用快捷键替代点击按钮
- 确保每次进入视图前自动清理可能打开的模态框
- 避免测试间因状态未清理导致的失败

> 详细使用规范参见：`.trae/skills/py-e2e-testing/SKILL.md`

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
> - `_testDataDir` 是 worker-scoped，每个测试文件生成唯一的临时目录
> - `_electronTest` 是 worker-scoped，每个测试文件只执行一次（启动 → 测试 → 关闭）
> - `electronTest` 和 `page` 是 test-scoped，每个测试项都能访问同一个应用实例

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

## 行为约束矩阵

| 场景 | 触发条件 | 前置状态 | 预期行为 | 预期结果状态 |
|------|----------|----------|----------|-------------|
| 测试文件开始 | Playwright 执行测试文件 | 无 | fixture 创建临时数据目录并启动应用 | 应用启动，使用临时数据目录 |
| beforeAll 执行 | 测试文件的第一个测试开始前 | 应用已启动 | 创建基础测试数据并刷新界面 | 测试数据可见 |
| 测试项执行 | 各个 test 函数执行 | 数据已创建 | 测试执行 | 测试通过或失败 |
| 测试文件结束 | 所有测试项完成 | 无 | fixture 关闭应用并删除临时数据目录 | 应用关闭，数据清理完成 |

## 状态流转

```
创建临时目录 → 启动应用 → 创建测试数据 → 测试项执行 → 关闭应用 → 删除临时目录
```

## 超出范围

- 全局 beforeAll/afterAll 的实现（由 playwright 配置决定）
- 单个测试项内部的 beforeEach/afterEach（根据需要自行添加）
- 测试数据的持久化（每次运行都是新数据）
- 并行测试支持（当前设计不支持）

## 约束检查清单

- [ ] 每个测试文件只有一个应用生命周期（启动/关闭）
- [ ] 每个测试文件使用独立的临时数据目录
- [ ] beforeAll 中创建基础测试数据
- [ ] 创建数据后调用 refreshData() 刷新界面
- [ ] 新建类测试不依赖 beforeAll 创建的数据
- [ ] 删除类测试确保创建足够数据，不影响后续
- [ ] 后续测试不依赖可能被前面步骤修改的数据
- [ ] 使用 `generateE2ePrefixName()` 生成唯一标识

## 测试决策

### 好测试的标准

- 只测试外部行为（UI 状态、API 结果），不测试实现细节
- 测试之间相互独立，无隐式依赖
- 使用真实用户操作路径，而非直接调用内部方法

### 测试覆盖的模块

- `electron-test.ts` 中的 fixture 机制
- 测试专用数据库的隔离性
- 测试数据的自动清理

### 测试先例

参考 `1-shortcut-esc.spec.ts` 中的实现模式：

- `beforeAll` 创建基础测试数据
- `refreshData()` 刷新界面显示数据
- 不再调用 `cleanupAllE2eTestData()`（由测试专用数据库自动处理）

## 参考

- 详细编码规范：`.trae/skills/py-e2e-testing/SKILL.md`
