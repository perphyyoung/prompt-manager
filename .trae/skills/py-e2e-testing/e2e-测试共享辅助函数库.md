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

- `generateTestTagName()` - 生成唯一测试标签名
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

**使用方法**：

```typescript
// 确保标签筛选区域展开
await ensureTagFilterExpanded(page, Constants.Ids.IMAGE_TAG_FILTER_SECTION, Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN);

// 确保标签筛选区域收起
await ensureTagFilterCollapsed(page, Constants.Ids.IMAGE_TAG_FILTER_SECTION, Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN);
```

**使用场景**：

- 展开状态测试：使用 `ensureTagFilterExpanded()`，标签显示在筛选列表中
- 收起状态测试：使用 `ensureTagFilterCollapsed()`，只有首位组标签显示在 header 中

**修改相关文件时需关注**

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
