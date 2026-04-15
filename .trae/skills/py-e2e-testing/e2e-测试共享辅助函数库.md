# E2E 测试共享辅助函数库

**文件路径**： e2e/electron-test.ts

**主要功能模块**：

## 1. ElectronTestHelper 类

- `launch()` - 启动 Electron 应用
- `close()` - 关闭应用
- `getPage()` - 获取主窗口 Page 对象
- `waitForSelector()` - 等待元素出现
- `click()` - 点击元素
- `getText()` - 获取元素文本
- `exists()` - 检查元素是否存在
- `wait()` - 等待指定时间
- `screenshot()` - 截图
- `logTestStart()` - 记录测试开始日志

## 2. 标签管理器辅助函数

- `enterImageTagManager()` - 进入图像标签管理器
- `enterPromptTagManager()` - 进入提示词标签管理器
- `closeImageTagManager()` - 关闭图像标签管理器
- `closePromptTagManager()` - 关闭提示词标签管理器
- `createImageTagInManager()` - 在图像标签管理器中创建标签
- `createPromptTagInManager()` - 在提示词标签管理器中创建标签
- `createImageTagGroup()` - 在图像标签管理器中创建标签组
- `createPromptTagGroup()` - 在提示词标签管理器中创建标签组

## 3. 主界面视图导航辅助函数

- `enterImageGridView()` - 进入图像网格视图
- `enterPromptGridView()` - 进入提示词网格视图
- `enterImageListView()` - 进入图像列表视图
- `enterPromptListView()` - 进入提示词列表视图

## 4. 详情界面辅助函数

- `openImageDetail()` - 打开图像详情界面
- `openPromptDetail()` - 打开提示词详情界面
- `enterImageDetailView()` - 进入图像详情视图（带返回值）
- `enterPromptDetailView()` - 进入提示词详情视图（带返回值）

## 5. 数据库操作辅助函数

- `getImageFromDatabase()` - 从数据库获取图像完整信息
- `getPromptFromDatabase()` - 从数据库获取提示词完整信息
- `getFirstImageId()` - 获取第一个图像的ID
- `getFirstPromptId()` - 获取第一个提示词的ID

## 6. 标签筛选区域辅助函数

- `ensureTagFilterExpanded()` - 确保标签筛选区域展开
- `ensureTagFilterCollapsed()` - 确保标签筛选区域收起

## 7. 提示词详情测试辅助函数

- `getDisplayedImageIds()` - 获取当前显示的图像ID列表
- `rightClickAndSetAsFirst()` - 右键点击图像并选择"设为首张"
- `getAllPrompts()` - 获取所有提示词列表
- `findPromptWithImageCount()` - 查找具有指定图像数量范围的提示词
- `openPromptDetailById()` - 打开指定提示词的详情界面

## 8. ElectronTestHelper 测试数据管理方法

**功能说明**：
`ElectronTestHelper` 已集成测试数据管理功能，统一管理测试数据的生成和清理。

**主要方法**：

- `generateTagName(suffix: string)` - 生成带 `e2e_` 前缀的唯一测试标签名
- `generateTagNames(count: number, prefix: string)` - 批量生成测试标签名
- `createImageTag(suffix: string, groupId?: number)` - 创建单个图像标签
- `createImageTags(count: number, prefix: string, groupId?: number)` - 批量创建图像标签
- `createPromptTag(suffix: string, groupId?: number)` - 创建单个提示词标签
- `createPromptTags(count: number, prefix: string, groupId?: number)` - 批量创建提示词标签
- `getFirstImageTagGroupId()` - 获取首位图像标签组ID
- `getFirstPromptTagGroupId()` - 获取首位提示词标签组ID
- `cleanupAndReset()` - 清理所有带 `e2e_` 前缀的测试标签和标签组, 关闭所有模态框，回到图像主界面
- `clearTagCache(type: 'image' | 'prompt')` - 清除标签缓存（用于自动完成测试）
- `refreshTagFilters()` - 刷新标签筛选区
- `tagExists(tagName: string, type: 'image' | 'prompt')` - 验证标签是否存在

**使用方法**：

```typescript
import { createElectronTest } from './electron-test.ts';

const electronTest = createElectronTest();

// 在 test.afterEach 中清理测试数据并重置界面状态
test.afterEach(async () => {
  await electronTest.cleanupAndReset();
});

// 在测试用例中创建测试数据
test('应该创建标签', async () => {
  const tagName = electronTest.generateTagName('test_suffix');
  await electronTest.createImageTag('test_suffix');
  // ... 测试逻辑
});

// 自动完成测试需要清除缓存
test('自动完成测试', async () => {
  const tagNames = await electronTest.createImageTags(3, 'test');
  // 清除缓存确保新创建的标签在自动完成中可用
  await electronTest.clearTagCache('image');
  // ... 测试逻辑
});
```

**注意事项**：

- 所有测试标签名都会自动添加 `e2e_` 前缀
- `cleanupAndReset()` 会删除所有带 `e2e_` 前缀的标签和标签组, 关闭所有模态框、回到图像主界面，确保下一轮测试在一致的起点
- 自动完成测试需要在创建标签后调用 `clearTagCache()`，因为标签缓存可能导致新创建的标签在自动完成中不可用
- 无需额外导入，直接使用 `electronTest` 实例的方法

**使用方法**：

```typescript
import { createElectronTest, enterImageGridView, getImageFromDatabase } from './electron-test.ts';

const electronTest = createElectronTest();
await electronTest.launch();
const page = electronTest.getPage();

// 使用辅助函数
const firstCard = await enterImageGridView(page);
const imageData = await getImageFromDatabase(page, imageId);
```

**修改相关文件时需关注**：

- 修改 Electron 应用启动逻辑时
- 修改标签管理器相关功能时
- 修改主界面视图切换逻辑时
- 修改详情界面打开逻辑时
- 修改数据库 API 接口时
