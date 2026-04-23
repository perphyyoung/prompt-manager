# E2E 测试共享辅助函数库

**文件路径**： e2e/electron-test.ts

**主要功能模块**：

## 1. ElectronTestHelper 类

### 应用生命周期管理

- `launch()` - 启动 Electron 应用
- `close()` - 关闭应用
- `getPage()` - 获取主窗口 Page 对象
- `getElectronApp()` - 获取 Electron 应用实例

### Mock 辅助方法

- `mockImageTagGroupsEmpty()` - Mock 图像标签组 API 返回空数组（用于测试"无可选组"场景）
- `mockPromptTagGroupsEmpty()` - Mock 提示词标签组 API 返回空数组（用于测试"无可选组"场景）

### 基础操作

- `waitForSelector()` - 等待元素出现
- `click()` - 点击元素
- `getText()` - 获取元素文本
- `exists()` - 检查元素是否存在
- `wait()` - 等待指定时间
- `screenshot()` - 截图
- `logTestStart()` - 记录测试开始日志

### 测试数据生成

- `generateE2ePrefixName(label)` - 生成带 `e2e_` 前缀和时间戳的唯一名称
- `generateTagNames(count, prefix)` - 批量生成测试标签名
- `generatePromptTitle(suffix)` - 生成测试提示词标题
- `generateImageFileName(suffix)` - 生成测试图像文件名

### 标签管理（API 级别）

- `createImageTags(count, prefix)` - 批量创建图像标签（仅创建标签，不关联到图像）
- `createPromptTags(count, prefix)` - 批量创建提示词标签（仅创建标签，不关联到提示词）
- `linkTagsToImage(imageId, tagNames)` - 将标签关联到图像
- `linkTagsToPrompt(promptId, tagNames)` - 将标签关联到提示词
- `assignImageTagsToGroup(tagNames, groupId)` - 将图像标签分配到指定组
- `assignPromptTagsToGroup(tagNames, groupId)` - 将提示词标签分配到指定组
- `getFirstImageTagGroupId()` - 获取首位图像标签组ID
- `getFirstPromptTagGroupId()` - 获取首位提示词标签组ID

### 主界面测试数据生成

- `createTestPrompt(suffix, overrides?)` - 创建测试提示词
- `createTestPrompts(count, prefix)` - 批量创建测试提示词
- `createTestImage(suffix)` - 创建测试图像（自动生成随机颜色的临时图像）
- `createTestImages(count, prefix)` - 批量创建测试图像

### 元素定位

- `findPromptCardByTitle(title)` - 根据标题搜索提示词卡片
- `findImageCardByFileName(fileName)` - 根据文件名搜索图像卡片
- `findPromptCardById(promptId)` - 根据ID定位提示词卡片
- `findImageCardById(imageId)` - 根据ID定位图像卡片

### 测试数据清理

- `deleteTestPrompt(promptId)` - 软删除测试提示词到回收站
- `deleteTestImage(imageId)` - 软删除测试图像到回收站
- `cleanupImageTagsAndGroups()` - 清理图像测试标签和标签组
- `cleanupPromptTagsAndGroups()` - 清理提示词测试标签和标签组
- `clearTagCache(type)` - 清除标签缓存（用于自动完成测试）
- `refreshTagFilters()` - 点击刷新按钮刷新标签筛选区
- `tagExists(tagName, type)` - 验证标签是否存在
- `cleanupAndReset()` - 测试后清理和重置（关闭所有模态框，清理测试标签和标签组，回到图像主界面）

## 2. 标签管理器辅助函数

- `enterImageTagManager()` - 进入图像标签管理器
- `enterPromptTagManager()` - 进入提示词标签管理器
- `closeImageTagManager()` - 关闭图像标签管理器
- `closePromptTagManager()` - 关闭提示词标签管理器
- `createImageTagInManager()` - 在图像标签管理器中创建标签
- `createPromptTagInManager()` - 在提示词标签管理器中创建标签
- `createImageTagsInManagerBatch()` - 在图像标签管理器中批量创建标签
- `createPromptTagsInManagerBatch()` - 在提示词标签管理器中批量创建标签
- `createImageTagInDetail()` - 在图像详情界面创建标签
- `createPromptTagInDetail()` - 在提示词详情界面创建标签
- `createImageTagInBatchToolbar()` - 在主界面批量工具栏创建图像标签
- `createPromptTagInBatchToolbar()` - 在主界面批量工具栏创建提示词标签
- `createImageTagGroup()` - 在图像标签管理器中创建标签组
- `createPromptTagGroup()` - 在提示词标签管理器中创建标签组

## 3. 主界面视图导航辅助函数

- `enterImageGridView()` - 进入图像网格视图
- `enterPromptGridView()` - 进入提示词网格视图
- `enterImageListView()` - 进入图像列表视图
- `enterPromptListView()` - 进入提示词列表视图
- `enterImageCompactView()` - 进入图像紧凑视图
- `enterPromptCompactView()` - 进入提示词紧凑视图

## 4. 详情界面辅助函数

- `openImageDetail()` - 打开图像详情界面
- `openPromptDetail()` - 打开提示词详情界面
- `enterImageDetailView()` - 进入图像详情视图（带返回值）
- `enterPromptDetailView()` - 进入提示词详情视图（带返回值）
- `openPromptDetailById()` - 打开指定提示词的详情界面

## 5. 数据库操作辅助函数

- `getImageFromDatabase()` - 从数据库获取图像完整信息
- `getPromptFromDatabase()` - 从数据库获取提示词完整信息
- `getFirstImageId()` - 获取第一个图像的ID
- `getFirstPromptId()` - 获取第一个提示词的ID
- `getAllPrompts()` - 获取所有提示词列表
- `findPromptWithImageCount()` - 查找具有指定图像数量范围的提示词

## 6. 标签筛选区域辅助函数

- `ensureTagFilterExpanded()` - 确保标签筛选区域展开
- `ensureTagFilterCollapsed()` - 确保标签筛选区域收起

## 7. 提示词详情测试辅助函数

- `getDisplayedImageIds()` - 获取当前显示的图像ID列表
- `rightClickAndSetAsFirst()` - 右键点击图像并选择"设为首张"
- `waitForImageOrderChange()` - 等待图像顺序变化为目标顺序
- `waitForDatabaseImageOrder()` - 等待数据库中的图像顺序更新

## 8. 测试数据恢复辅助函数

- `restoreImageFavoriteStatus()` - 恢复图像收藏状态
- `restorePromptFavoriteStatus()` - 恢复提示词收藏状态

## 9. 共用 Fixture

- `test` - 共用的 Playwright fixture，每个测试独立启动和关闭应用，page fixture 接管应用关闭，避免超时冲突

## 使用方法

```typescript
import { test, createElectronTest, enterImageGridView, getImageFromDatabase } from './electron-test.ts';

// 使用 test fixture（推荐）
test('测试用例', async ({ electronTest, page }) => {
  // electronTest 和 page 已自动初始化
  const firstCard = await enterImageGridView(page);
  const imageData = await getImageFromDatabase(page, imageId);
});

// 或者手动创建实例
const electronTest = createElectronTest();
await electronTest.launch();
const page = electronTest.getPage();
```

## 注意事项

- 所有测试标签名都会自动添加 `e2e_` 前缀
- `cleanupAndReset()` 会删除所有带 `e2e_` 前缀的标签和标签组，关闭所有模态框、回到图像主界面，确保下一轮测试在一致的起点
- 自动完成测试需要在创建标签后调用 `clearTagCache()`，因为标签缓存可能导致新创建的标签在自动完成中不可用
- 使用 `test` fixture 时，应用会在测试完成后自动关闭，无需手动调用 `close()`

## 修改相关文件时需关注

- 修改 Electron 应用启动逻辑时
- 修改标签管理器相关功能时
- 修改主界面视图切换逻辑时
- 修改详情界面打开逻辑时
- 修改数据库 API 接口时
