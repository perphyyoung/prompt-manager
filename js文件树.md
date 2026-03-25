# JS 文件树

## 主进程

```bash
main.js                          # 应用主进程入口，管理窗口生命周期和 IPC 通信
database.js                      # 数据库操作层，封装 SQLite 数据存取
logger.js                        # 日志服务，统一输出到控制台和 debug.log
```

## 渲染进程

```bash
renderer/
├── app.js                       # 应用主类，协调各管理器，处理全局状态和事件
├── constants.js                 # 应用常量定义，包括枚举和配置项
│
├── config/                      # 配置目录
│   ├── index.js                 # 配置统一导出
│   └── BatchConfig.js           # 批量操作配置
│
├── managers/                    # 管理器层 - 业务逻辑核心
│   ├── index.js                 # 管理器统一导出
│   │
│   ├── PanelManagerBase.js      # 面板管理器基类，提供列表/网格视图通用功能
│   ├── PromptPanelManager.js    # 提示词面板管理器，管理提示词列表展示
│   ├── ImagePanelManager.js     # 图像面板管理器，管理图像列表展示
│   │
│   ├── PromptDetailManager.js   # 提示词详情管理器，管理提示词编辑模态框
│   ├── ImageDetailManager.js    # 图像详情管理器，管理图像详情模态框
│   ├── DetailViewManager.js     # 详情视图管理器基类
│   │
│   ├── ImageFullscreenManager.js    # 图像全屏查看管理器
│   ├── ImageSelectorManager.js      # 图像选择器管理器，提示词关联图像选择
│   ├── ImageUploadManager.js       # 图像上传管理器，处理图像上传流程
│   ├── ImagePreviewManager.js      # 图像预览管理器，负责预览渲染和交互
│   ├── ImageContextMenuManager.js   # 图像右键菜单管理器
│   │
│   ├── NewPromptManager.js      # 新建提示词管理器，管理新建提示词页面
│   ├── TrashManager.js          # 回收站管理器，统一管理提示词和图像回收站
│   │
│   ├── SimpleTagManager.js       # 简单标签管理器，基础标签功能
│   ├── TagRegistry.js           # 标签注册表，管理标签数据和业务逻辑
│   ├── TagService.js            # 标签服务，封装标签相关 API 调用
│   ├── TagUI.js                 # 标签 UI 组件，生成标签 HTML 和渲染
│   ├── TagGroupModalManager.js  # 标签组模态框管理器
│   │
│   ├── BatchProcessor.js            # 批量操作处理器，执行批量添加标签/收藏等操作
│   ├── BatchToolbarUI.js            # 批量操作工具栏 UI 控制器
│   ├── SearchSortManager.js         # 搜索排序管理器，处理搜索和排序逻辑
│   │
│   ├── NavigationManager.js      # 导航管理器，处理面板切换导航
│   ├── ToolbarManager.js        # 工具栏管理器，管理顶部工具栏
│   ├── ModalManager.js          # 模态框管理器，通用模态框控制
│   ├── ToastManager.js          # 提示管理器，显示操作提示
│   ├── SettingsManager.js       # 设置管理器，管理应用设置
│   ├── ImportExportManager.js   # 导入导出管理器，处理数据导入导出
│   │
│   └── SharedComponents/        # 共享组件
│       ├── index.js             # 共享组件统一导出
│       ├── PanelRenderer.js     # 面板渲染器，渲染列表/网格视图容器
│       ├── UnifiedCardRenderer.js   # 统一卡片渲染器，渲染所有类型卡片
│       ├── CardConfig.js        # 卡片配置类，定义卡片结构和行为
│       ├── UnifiedListRenderer.js   # 统一列表渲染器，渲染所有类型列表项
│       ├── ListConfig.js        # 列表配置类，定义列表项结构和行为
│       ├── ButtonFactory.js     # 按钮工厂，创建各类卡片按钮
│       ├── TagFilterHeader.js   # 标签筛选头部组件，渲染标签筛选栏
│       └── TagHtmlGenerator.js  # 标签 HTML 生成器，生成标签 HTML 字符串
│
├── components/                  # 组件层
│   ├── index.js                 # 组件统一导出
│   └── EditableTagList.js       # 可编辑标签列表组件，支持增删改标签
│
├── services/                    # 服务层
│   ├── index.js                 # 服务统一导出
│   ├── DialogService.js         # 对话框服务，管理确认对话框
│   ├── ImageUploadService.js    # 图像上传服务，核心上传逻辑
│   ├── SafeRatingService.js     # 安全评级服务，处理内容安全过滤
│   ├── TagAutocomplete.js       # 标签自动完成服务，提供标签输入自动完成功能
│   ├── UploadNotificationService.js # 上传通知服务，处理上传成功/失败通知
│   └── UploadStrategies.js      # 上传策略，DelaySaveStrategy/DirectSaveStrategy
│
├── renderer_utils/              # 渲染进程工具类
│   ├── index.js                 # 工具类统一导出
│   ├── HoverTooltipManager.js   # 悬停提示管理器，处理鼠标悬停提示
│   ├── SaveManager.js           # 保存管理器，自动保存表单变更
│   ├── SaveStrategy.js          # 保存策略
│   └── ShortcutManager.js       # 快捷键管理器，处理键盘快捷键绑定
│
└── (其他)
    ├── index.html                # HTML 入口
    └── styles.css               # 样式文件
```

## 项目根目录工具

```bash
utils/                           # 共享工具类
├── index.js                     # 工具类统一导出
├── CacheManager.js              # 缓存管理器，管理数据缓存
├── EventBus.js                 # 事件总线，提供发布订阅模式
├── HtmlUtils.js                 # HTML 工具类，提供 escapeHtml、formatFileSize 等方法
├── idGenerator.js               # ID 生成器，生成唯一 ID
├── isSameId.js                 # ID 比较工具，统一处理 ID 类型比较
├── ListNavigator.js             # 列表导航器，处理列表项键盘导航
├── LRUCache.js                 # LRU 缓存实现，有限容量缓存
├── TextUtils.js                # 文本工具类
└── TimeUtils.js                # 时间工具类
```

## 工具脚本

```bash
verify-imports.js                # JS 文件导入验证脚本（node verify-imports.js）
```

## 文件统计

| 目录 | 文件数 | 说明 |
|------|--------|------|
| 主进程 | 3 | main.js, database.js, logger.js |
| renderer/config | 2 | 配置目录（含 index.js） |
| renderer/managers | 25 | 业务管理器 |
| renderer/managers/SharedComponents | 9 | 共享组件（含 index.js）|
| renderer/renderer_utils | 5 | 渲染进程工具类（含 index.js） |
| renderer/components | 2 | UI 组件（含 index.js） |
| renderer/services | 7 | 服务类（含 index.js） |
| 根目录 utils | 10 | 共享工具类（含 index.js） |
| 工具脚本 | 1 | verify-imports.js |
| **总计** | **64** | - |

## 架构分层

```bash
┌─────────────────────────────────────┐
│  components/     UI 组件层          │
├─────────────────────────────────────┤
│  managers/      业务逻辑层          │
├─────────────────────────────────────┤
│  services/      服务层              │
├─────────────────────────────────────┤
│  utils/         工具类层            │
├─────────────────────────────────────┤
│  main.js        主进程              │
│  database.js     数据层              │
└─────────────────────────────────────┘
```

## 日志系统

```bash
logger.js                        # 统一日志服务
├── 输出到控制台                   # 实时查看
├── 输出到 debug.log              # 持久化记录
└── IPC: renderer-log            # 渲染进程日志通道
```
