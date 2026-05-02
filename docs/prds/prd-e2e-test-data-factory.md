# PRD：E2E 测试数据抽象工厂重构

## 问题陈述

当前 `e2e/electron-test.ts` 中的测试数据创建方法存在以下问题：

1. **职责混杂**：`ElectronTestHelper` 同时承担应用生命周期管理、UI 操作、数据创建三重职责，违反单一职责原则
2. **缺乏抽象**：Image 和 Prompt 的数据创建逻辑各自独立，没有统一接口，重复代码难以复用
3. **API/UI 混合**：数据创建方法中既有直接 API 调用（`createTestPrompt`），也有完整 UI 流程（`createTestPromptViaUI`），边界不清晰
4. **标签创建分散**：标签相关操作散落在多个独立方法中，没有与 Image/Prompt 创建形成整体

## 解决方案

引入**抽象工厂模式**重构测试数据创建层：

- **抽象工厂接口** `ITestDataFactory`：定义创建 Prompt 工厂和 Image 工厂的接口
- **具体工厂** `ApiTestFactory`：通过 `electronAPI` 直接调用后端 API 创建数据
- **产品族基类** `BaseTestDataFactory<T>`：封装 name 生成、batch 创建、tag 关联等通用逻辑
- **具体产品** `PromptApiFactory` / `ImageApiFactory`：实现各自领域的创建逻辑

重构后，测试用例通过 `electronTest.getApiFactory()` 获取工厂实例，统一使用 API 创建测试数据，创建后调用 `refreshData()` 刷新 UI。

## 功能清单

### 功能-抽象工厂接口

- `ITestDataFactory` 接口定义 `createPromptFactory()` 和 `createImageFactory()` 方法
- `ApiTestFactory` 实现 `ITestDataFactory`，通过 Playwright `page.evaluate()` 调用 `window.electronAPI`

### 功能-基类工厂复用

- `BaseTestDataFactory<T>` 抽象类封装 `generateName()` 方法，生成 `e2e_{label}_{timestamp}_{random}` 格式名称
- `BaseTestDataFactory<T>` 封装 `createTags(count, label, addTagFn)` 批量创建独立标签的通用逻辑
- `createBatch(count, label)` 批量创建方法在基类中实现，循环调用子类的 `create()` 方法
- `createWithTags(data, tagNames)` 在基类中实现：先创建实体，再调用子类实现的 `_createTags()` 关联标签

### 功能-提示词数据工厂

- `PromptApiFactory.create(data)` 调用 `window.electronAPI.addPrompt()` 创建提示词
- `PromptApiFactory.createBatch(count, label)` 批量创建提示词
- `PromptApiFactory.createTag(tagName)` 调用 `window.electronAPI.addPromptTag()` 创建独立标签
- `PromptApiFactory.createTags(count, label)` 批量创建独立标签
- `PromptApiFactory.createTagGroup(name, isTop?)` 调用 `window.electronAPI.createPromptTagGroup()` 创建标签组，`isTop` 为 true 时查询现有组最小 `sortOrder`，取 `min(现有) - 1`（无现有组时为 `-1`）使其成为首位组
- `PromptApiFactory.createTagInGroup(groupName, tagLabel, isTop?)` 创建标签组并在其中创建一个标签，返回标签名称
- `PromptApiFactory.createWithTags(data, tagNames)` 创建提示词并关联标签
- `PromptApiFactory.createWithImages(data, imageIds)` 创建提示词时直接设置 `images` 字段关联图像

### 功能-图像数据工厂

- `ImageApiFactory.create(data)` 生成临时测试图像文件，调用 `window.electronAPI.saveImageFile()` 创建图像
- `ImageApiFactory.createBatch(count, label)` 批量创建图像
- `ImageApiFactory.createTag(tagName)` 调用 `window.electronAPI.addImageTag()` 创建独立标签
- `ImageApiFactory.createTags(count, label)` 批量创建独立标签
- `ImageApiFactory.createTagGroup(name, isTop?)` 调用 `window.electronAPI.createImageTagGroup()` 创建标签组，`isTop` 为 true 时查询现有组最小 `sortOrder`，取 `min(现有) - 1`（无现有组时为 `-1`）使其成为首位组
- `ImageApiFactory.createTagInGroup(groupName, tagLabel, isTop?)` 创建标签组并在其中创建一个标签，返回标签名称
- `ImageApiFactory.createWithTags(data, tagNames)` 创建图像并关联标签
- `ImageApiFactory.createWithPrompts(data, promptDataList)` 创建图像并同时创建关联的提示词

### 功能-工厂集成到 ElectronTestHelper

- `ElectronTestHelper` 新增 `getApiFactory()` 方法，返回 `ApiTestFactory` 实例
- `ApiTestFactory` 构造函数接收 `Page` 对象，用于执行 `page.evaluate()`

### 功能-单元测试覆盖

- 对 `ApiTestFactory`、`PromptApiFactory`、`ImageApiFactory` 编写单元测试
- 使用 `tests/mocks/electronAPI.ts` 中的 mock 机制模拟 `window.electronAPI`
- 测试覆盖：name 生成、create、createBatch、createWithTags、createWithImages、createWithPrompts

## 实现决策

- **模块划分**：新代码放在 `e2e/factories/` 目录下，包含 `interfaces.ts`、`base-factory.ts`、`prompt-factory.ts`、`image-factory.ts`、`api-factory.ts`
- **单元测试**：放在 `tests/e2e-factories/` 目录下，使用 vitest 框架
- **错误处理**：创建失败直接抛出异常，异常信息包含操作类型和实体类型，不定义自定义异常类
- **返回值**：所有 `create*` 方法返回非 null 值，失败即抛异常
- **关联创建**：`createWithImages` 直接设置 `promptData.images` 字段；`createWithPrompts` 创建图像后调用 `addPrompt` 并设置 `images` 关联
- **Tag 关联**：作为 `BaseTestDataFactory` 的内部方法实现，不独立暴露

## 行为约束矩阵

| 场景 | 触发条件 | 前置状态 | 预期行为 | 预期结果状态 |
|------|----------|----------|----------|-------------|
| 创建单个提示词 | 调用 `promptFactory.create(data)` | 应用已启动，page 可用 | 调用 `addPrompt` API | 返回创建的 `IPrompt` 对象 |
| 批量创建提示词 | 调用 `promptFactory.createBatch(3, "test")` | 应用已启动 | 循环调用 `create()` 3 次 | 返回包含 3 个 `IPrompt` 的数组 |
| 创建独立提示词标签 | 调用 `promptFactory.createTag("tag")` | 应用已启动 | 调用 `addPromptTag` API | 标签创建成功 |
| 批量创建独立提示词标签 | 调用 `promptFactory.createTags(3, "test")` | 应用已启动 | 循环调用 `createTag()` 3 次 | 创建 3 个独立标签 |
| 创建提示词标签组 | 调用 `promptFactory.createTagGroup("组名")` | 应用已启动 | 调用 `createPromptTagGroup` API | 标签组创建成功 |
| 创建首位提示词标签组 | 调用 `promptFactory.createTagGroup("组名", true)` | 应用已启动 | 查询现有组最小 sortOrder，取 min(现有) - 1 后调用 API | 标签组 sortOrder 小于所有现有组 |
| 创建带标签的提示词 | 调用 `promptFactory.createWithTags(data, ["tag1"])` | 应用已启动 | 先创建提示词，再调用 `addPromptTags` | 返回带标签的 `IPrompt` |
| 创建带图像的提示词 | 调用 `promptFactory.createWithImages(data, ["img1"])` | 图像已存在 | 设置 `data.images` 后调用 `addPrompt` | 返回关联图像的 `IPrompt` |
| 创建单个图像 | 调用 `imageFactory.create(data)` | 应用已启动 | 生成临时文件，调用 `saveImageFile` | 返回创建的 `IImage` 对象 |
| 批量创建图像 | 调用 `imageFactory.createBatch(2, "test")` | 应用已启动 | 循环调用 `create()` 2 次 | 返回包含 2 个 `IImage` 的数组 |
| 创建独立图像标签 | 调用 `imageFactory.createTag("tag")` | 应用已启动 | 调用 `addImageTag` API | 标签创建成功 |
| 批量创建独立图像标签 | 调用 `imageFactory.createTags(3, "test")` | 应用已启动 | 循环调用 `createTag()` 3 次 | 创建 3 个独立标签 |
| 创建图像标签组 | 调用 `imageFactory.createTagGroup("组名")` | 应用已启动 | 调用 `createImageTagGroup` API | 标签组创建成功 |
| 创建首位图像标签组 | 调用 `imageFactory.createTagGroup("组名", true)` | 应用已启动 | 查询现有组最小 sortOrder，取 min(现有) - 1 后调用 API | 标签组 sortOrder 小于所有现有组 |
| 创建带标签的图像 | 调用 `imageFactory.createWithTags(data, ["tag1"])` | 应用已启动 | 先创建图像，再调用 `addImageTags` | 返回带标签的 `IImage` |
| 创建带提示词的图像 | 调用 `imageFactory.createWithPrompts(data, [data])` | 应用已启动 | 创建图像，再创建提示词并关联 | 返回 `{image, prompts}` |
| API 调用失败 | 网络或后端错误 | 应用已启动 | 抛出异常 | 异常信息包含操作详情 |

## 状态流转

本功能无复杂状态机，核心状态为：

- **初始化**：`ApiTestFactory` 被创建，持有 `Page` 引用
- **创建中**：调用 `create*` 方法，执行 `page.evaluate()`
- **完成**：API 调用成功，返回实体数据
- **失败**：API 调用失败，抛出异常

## 超出范围

- 不修改任何现有 UI 测试流程（`createTestPromptViaUI`、`createTestImageViaUI` 等保持原样）
- 不修改 `ElectronTestHelper` 的 UI 操作方法（`click`、`waitForSelector` 等）
- 不修改清理方法（`cleanupTestPrompts`、`cleanupTestImages` 等）
- 不涉及标签管理器 UI 相关函数（`createImageTagInManager` 等）
- 不修改现有测试文件，仅提供新的工厂接口供后续逐步迁移

## 约束检查清单

- [ ] `ITestDataFactory` 接口定义完整
- [ ] `ApiTestFactory` 正确实现 `ITestDataFactory`
- [ ] `BaseTestDataFactory` 封装通用逻辑（name 生成、batch、tag 关联）
- [ ] `PromptApiFactory` 实现 `create`、`createWithImages`、`createTag`、`createTags`、`_linkTagsToEntity`
- [ ] `ImageApiFactory` 实现 `create`、`createWithPrompts`、`createTag`、`createTags`、`_linkTagsToEntity`
- [ ] `ElectronTestHelper.getApiFactory()` 返回正确实例
- [ ] 单元测试覆盖所有工厂方法
- [ ] `bun run test` 通过
- [ ] `bun run check` 通过

## 测试决策

- **测试类型**：单元测试，mock `window.electronAPI` 的返回结果
- **测试框架**：vitest，复用现有 `tests/setup.ts` 和 `tests/mocks/electronAPI.ts`
- **测试范围**：验证工厂方法调用正确的 API、传递正确的参数、处理返回值和错误
- **测试文件**：`tests/e2e-factories/api-factory.test.ts`
- **好测试的标准**：只测试外部行为（调用哪个 API、传什么参数、返回什么），不测试内部实现细节

## 进一步说明

- 现有测试数据创建方法（`createTestPrompt`、`createTestImage` 等）在 `ElectronTestHelper` 中保持原样，标记为 `@deprecated`，供后续逐步迁移
- 新的工厂类与现有代码无耦合，可以独立开发、测试、验证
- 逐步迁移策略：新测试用例优先使用工厂，旧测试用例在需要修改时迁移
