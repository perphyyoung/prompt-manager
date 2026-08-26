# Prompt Manager

本地 AI 绘画提示词管理工具，基于 Electron 开发，帮助用户高效管理提示词和关联图像。

> 一款专为 AI 绘画爱好者设计的本地提示词管理工具，支持标签系统、图像关联、批量操作等功能。

<!-- TODO: 添加应用截图 -->
<!-- ![Prompt Manager Screenshot](docs/screenshots/main.png) -->

## 功能特性

- **标签管理** - 支持标签组、拖拽排序、批量操作、批量删除
- **图像关联** - 提示词与图像双向关联，支持多图
- **批量操作** - 批量添加标签、批量收藏、批量删除
- **回收站** - 软删除机制，支持恢复
- **完整备份** - 支持数据库和图像的完整备份导入导出，自动重新生成缩略图
- **数据管理** - 孤儿文件清理、数据目录迁移
- **主题切换** - 明亮/暗黑模式
- **字体设置** - 支持自定义字体和字体文件导入
- **安全模式** - Safe/NSFW 内容分级

## 技术栈

| 类别 | 技术 | 选型理由 |
|------|------|----------|
| **桌面框架** | Electron 41.2.0 | 前端技术栈开发桌面应用（当前仅支持 Windows） |
| **前端** | 原生 ES2023 | 无需构建步骤，直接运行现代 JS |
| **数据库** | SQLite3 | 轻量级本地存储，无需额外服务 |
| **图像处理** | Sharp 0.35 | 高性能图像处理和缩略图生成 |
| **架构模式** | ES Module + 模块化 | 清晰的依赖管理，支持 Tree Shaking |
| **打包工具** | Vite + electron-builder | 快速构建，生成 Windows 安装包和可执行文件 |
| **代码检查** | OXLint + oxfmt | 高性能 TypeScript/JavaScript 检查与格式化 |

## 快速开始

### 环境要求

- **操作系统**: Windows 10/11（当前仅支持 Windows）
- Node.js ^20.19.0 或 >=22.12.0
- pnpm >= 11.0.0

### 安装与启动

```bash
# 克隆项目
git clone <repository-url>
cd prompt-manager

# 安装依赖
pnpm install

# 启动开发模式
pnpm dev
```

### 静默启动（无命令行窗口）

```bash
start-hidden.vbs
```

### 调试模式

```bash
start-debug.bat
```

### 打包构建

```bash
# 构建 Windows NSIS 安装包
pnpm release
```

## 架构亮点

### 1. 模块化设计

采用 ES Module 架构，核心模块职责分离：

```
src/
├── main/           # 主进程（Electron）
├── preload/        # 预加载脚本
├── renderer/       # 渲染进程
│   ├── components/ # 可复用组件
│   ├── managers/   # 业务逻辑管理器
│   ├── services/   # 服务层
│   └── utils/      # 工具函数
```

### 2. 自动保存机制

字段级变化追踪 + 防抖自动保存（800ms）：

```javascript
// 自动监听字段变化，延迟保存避免频繁写入
this.saveManager.debounceSave(field, value);
```

### 3. 批量操作架构

配置驱动设计，通过 `BatchConfig` 定义操作，统一处理批量删除、标签添加等：

```javascript
// 配置定义批量操作
batchConfig: {
  addTag: {
    inputTitle: '批量添加标签',
    api: 'batchAddTagToPrompts',
    successMsg: (count) => `已为 ${count} 项添加标签`
  }
}
```

### 4. 标签系统

支持标签组、特殊标签（收藏、未引、多引等）：

- **标签组** - 组织标签，支持展开/收起、优先级排序
- **特殊标签** - 系统自动标记（收藏、多图、未引用等）
- **拖拽添加** - 从标签区拖拽到卡片快捷添加

### 5. 完整备份系统

- **一键导出** - 打包数据库和所有图像为 ZIP 文件
- **智能导入** - 自动重新生成缩略图，支持版本兼容性检查
- **进度显示** - 实时显示备份/恢复进度
- **自动回滚** - 导入失败时自动恢复到原数据
- **本地时间** - 使用本地时间格式标记备份时间

### 6. 图像处理

- **MD5 去重** - 上传时检测重复图像，避免重复存储
- **缩略图生成** - 自动生成缩略图提升加载性能
- **延迟保存策略** - 图像预览确认后再写入数据库

## 项目结构

```
prompt-manager/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── index.ts       # 主入口
│   │   ├── database.js    # SQLite 数据库操作
│   │   └── logger.js      # 日志服务
│   ├── preload/           # 预加载脚本
│   │   └── index.ts       # 安全 API 暴露
│   ├── renderer/          # 渲染进程
│   │   ├── app.js         # 应用主逻辑
│   │   ├── components/    # UI 组件
│   │   ├── managers/      # 业务管理器
│   │   ├── services/      # 服务层
│   │   └── utils/         # 工具函数
│   └── types/             # TypeScript 类型定义
├── tests/                 # 测试文件
├── docs/                  # 项目文档
├── vitest.config.js       # 测试配置
└── electron.vite.config.ts # Vite 配置
```

## 数据存储

默认存储在应用目录下的 `py-data/` 文件夹：

```
py-data/
├── prompt-manager.db      # SQLite 数据库
├── images/{date}/         # 图像文件
└── thumbnails/{date}/     # 缩略图缓存
```

可通过设置界面更改数据存储路径。

## 相关文档

- [FEATURES.md](FEATURES.md) - 详细功能说明

## License

GPL-3.0
