---
name: knip-deadcode
description: Knip 死代码检测最佳实践，适用于 JavaScript 和 TypeScript 项目。在配置 Knip、分析未使用代码、设置 CI 集成或清理代码库时使用。触发场景包括：knip.json、死代码、未使用的导出、未使用的依赖、包优化。
---

# Community Knip Dead Code Detection Best Practices

Comprehensive guide for detecting and removing dead code in JavaScript and TypeScript projects using Knip. Contains 43 rules across 8 categories, prioritized by impact to guide configuration, CI integration, and cleanup workflows.

使用 Knip 检测和移除 JavaScript 和 TypeScript 项目中死代码的综合性指南。包含 43 条规则，分为 8 个类别，按影响力优先级排序，用于指导配置、CI 集成和清理工作流。

## When to Apply

Reference these guidelines when:

在以下场景参考本指南：

- Configuring Knip for a new project or monorepo
- 为新项目或 monorepo 配置 Knip
- Investigating false positives or false negatives
- 调查误报或漏报
- Setting up CI pipelines to prevent dead code regressions
- 设置 CI 流水线以防止死代码回归
- Using auto-fix to clean up unused code
- 使用自动修复清理未使用代码
- Optimizing Knip performance for large codebases
- 优化大型代码库的 Knip 性能

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Configuration Foundations / 配置基础 | CRITICAL / 关键 | `config-` |
| 2 | Entry Point Strategy / 入口点策略 | CRITICAL / 关键 | `entry-` |
| 3 | Workspace & Monorepo / 工作区与 Monorepo | HIGH / 高 | `workspace-` |
| 4 | Dependency Analysis / 依赖分析 | HIGH / 高 | `deps-` |
| 5 | Export Detection / 导出检测 | MEDIUM-HIGH / 中高 | `exports-` |
| 6 | CI Integration / CI 集成 | MEDIUM / 中 | `ci-` |
| 7 | Auto-Fix Workflow / 自动修复工作流 | MEDIUM / 中 | `fix-` |
| 8 | Performance Optimization / 性能优化 | LOW-MEDIUM / 中低 | `perf-` |

## Quick Reference

### 1. Configuration Foundations / 配置基础 (CRITICAL / 关键)

- [`config-avoid-broad-ignore`](references/config-avoid-broad-ignore.md) - Avoid broad ignore patterns
- 避免宽泛的忽略模式
- [`config-configure-path-aliases`](references/config-configure-path-aliases.md) - Configure path aliases in Knip
- 在 Knip 中配置路径别名
- [`config-enable-plugins-explicitly`](references/config-enable-plugins-explicitly.md) - Enable framework plugins explicitly
- 显式启用框架插件
- [`config-run-without-config`](references/config-run-without-config.md) - Run without config first for baseline
- 先无配置运行以获取基线
- [`config-separate-entry-project`](references/config-separate-entry-project.md) - Separate entry files from project files
- 将入口文件与项目文件分离
- [`config-use-json-schema`](references/config-use-json-schema.md) - Use JSON schema for configuration validation
- 使用 JSON schema 进行配置验证
- [`config-use-negation-patterns`](references/config-use-negation-patterns.md) - Use negation patterns for exclusions
- 使用否定模式进行排除
- [`config-use-production-mode`](references/config-use-production-mode.md) - Use production mode for shipping code analysis
- 使用生产模式分析交付代码

### 2. Entry Point Strategy / 入口点策略 (CRITICAL / 关键)

- [`entry-add-dynamic-imports`](references/entry-add-dynamic-imports.md) - Add dynamic import targets as entry points
- 将动态导入目标添加为入口点
- [`entry-exclude-test-files`](references/entry-exclude-test-files.md) - Exclude test files from production entries
- 从生产入口中排除测试文件
- [`entry-include-all-entry-points`](references/entry-include-all-entry-points.md) - Include all application entry points
- 包含所有应用程序入口点
- [`entry-include-bin-scripts`](references/entry-include-bin-scripts.md) - Include binary scripts as entry points
- 将二进制脚本添加为入口点
- [`entry-use-compilers`](references/entry-use-compilers.md) - Use compilers for non-standard file types
- 对非标准文件类型使用编译器
- [`entry-use-plugin-entries`](references/entry-use-plugin-entries.md) - Use plugin entry points for frameworks
- 使用插件入口点处理框架
- [`entry-verify-with-debug`](references/entry-verify-with-debug.md) - Verify entry points with debug mode
- 使用调试模式验证入口点

### 3. Workspace & Monorepo / 工作区与 Monorepo (HIGH / 高)

- [`workspace-configure-root-workspace`](references/workspace-configure-root-workspace.md) - Configure root workspace explicitly
- 显式配置根工作区
- [`workspace-ignore-specific`](references/workspace-ignore-specific.md) - Ignore specific workspaces when needed
- 需要时忽略特定工作区
- [`workspace-isolate-for-strict`](references/workspace-isolate-for-strict.md) - Isolate workspaces for strict dependency checking
- 隔离工作区以进行严格依赖检查
- [`workspace-list-cross-deps`](references/workspace-list-cross-deps.md) - List cross-workspace dependencies explicitly
- 显式列出跨工作区依赖
- [`workspace-per-workspace-plugins`](references/workspace-per-workspace-plugins.md) - Configure plugins per workspace
- 为每个工作区配置插件
- [`workspace-use-workspace-globs`](references/workspace-use-workspace-globs.md) - Use workspace globs for consistent configuration
- 使用工作区 glob 进行一致配置

### 4. Dependency Analysis / 依赖分析 (HIGH / 高)

- [`deps-add-unlisted-deps`](references/deps-add-unlisted-deps.md) - Add unlisted dependencies to package.json
- 将未列出的依赖添加到 package.json
- [`deps-avoid-transitive-reliance`](references/deps-avoid-transitive-reliance.md) - Avoid relying on transitive dependencies
- 避免依赖传递性依赖
- [`deps-configure-plugin-deps`](references/deps-configure-plugin-deps.md) - Configure plugins for tool-specific dependencies
- 为工具特定依赖配置插件
- [`deps-fix-files-first`](references/deps-fix-files-first.md) - Fix unused files before dependencies
- 先修复未使用文件再处理依赖
- [`deps-ignore-conditional-deps`](references/deps-ignore-conditional-deps.md) - Ignore conditionally loaded dependencies
- 忽略条件加载的依赖
- [`deps-remove-obsolete-types`](references/deps-remove-obsolete-types.md) - Remove obsolete type definition packages
- 移除过时的类型定义包

### 5. Export Detection / 导出检测 (MEDIUM-HIGH / 中高)

- [`exports-check-class-members`](references/exports-check-class-members.md) - Check class members for unused code
- 检查类成员中的未使用代码
- [`exports-enable-entry-exports`](references/exports-enable-entry-exports.md) - Enable entry export checking for private packages
- 为私有包启用入口导出检查
- [`exports-handle-reexports`](references/exports-handle-reexports.md) - Handle re-exports in barrel files
- 处理 barrel 文件中的重新导出
- [`exports-ignore-same-file`](references/exports-ignore-same-file.md) - Ignore exports used in same file
- 忽略在同文件中使用的导出
- [`exports-tag-public-api`](references/exports-tag-public-api.md) - Tag public API exports with JSDoc
- 使用 JSDoc 标记公共 API 导出
- [`exports-trace-usage`](references/exports-trace-usage.md) - Trace export usage before removal
- 移除前追踪导出使用情况
- [`exports-use-include-libs`](references/exports-use-include-libs.md) - Use include libs for type-based consumption
- 使用 include libs 进行基于类型的消费

### 6. CI Integration / CI 集成 (MEDIUM / 中)

- [`ci-add-to-pipeline`](references/ci-add-to-pipeline.md) - Add Knip to CI pipeline
- 将 Knip 添加到 CI 流水线
- [`ci-separate-production-check`](references/ci-separate-production-check.md) - Separate production and default mode checks
- 分离生产模式和默认模式检查
- [`ci-use-cache`](references/ci-use-cache.md) - Enable cache for faster CI runs
- 启用缓存以加快 CI 运行
- [`ci-use-max-issues`](references/ci-use-max-issues.md) - Use max issues for gradual adoption
- 使用最大问题数进行渐进式采用
- [`ci-use-reporters`](references/ci-use-reporters.md) - Use appropriate reporters for CI output
- 为 CI 输出使用适当的报告器
- [`ci-watch-mode-local`](references/ci-watch-mode-local.md) - Use watch mode for local development
- 在本地开发中使用监视模式

### 7. Auto-Fix Workflow / 自动修复工作流 (MEDIUM / 中)

- [`fix-allow-remove-files`](references/fix-allow-remove-files.md) - Explicitly allow file removal
- 显式允许文件移除
- [`fix-format-after-fix`](references/fix-format-after-fix.md) - Format code after auto-fix
- 自动修复后格式化代码
- [`fix-review-before-commit`](references/fix-review-before-commit.md) - Review auto-fix changes before commit
- 提交前审查自动修复更改
- [`fix-update-deps-after`](references/fix-update-deps-after.md) - Update package manager after dependency fix
- 依赖修复后更新包管理器
- [`fix-use-fix-type`](references/fix-use-fix-type.md) - Use fix type for targeted cleanup
- 使用修复类型进行针对性清理

### 8. Performance Optimization / 性能优化 (LOW-MEDIUM / 中低)

- [`perf-filter-issue-types`](references/perf-filter-issue-types.md) - Filter issue types for focused analysis
- 过滤问题类型以进行聚焦分析
- [`perf-limit-output`](references/perf-limit-output.md) - Limit output for large codebases
- 限制大型代码库的输出
- [`perf-profile-performance`](references/perf-profile-performance.md) - Profile performance for slow analysis
- 对慢速分析进行性能分析
- [`perf-use-bun-runtime`](references/perf-use-bun-runtime.md) - Use Bun runtime for faster analysis
- 使用 Bun 运行时进行更快分析
- [`perf-use-cache-flag`](references/perf-use-cache-flag.md) - Enable cache for repeated analysis
- 为重复分析启用缓存
- [`perf-use-workspace-filter`](references/perf-use-workspace-filter.md) - Filter workspaces for faster monorepo analysis
- 过滤工作区以加快 monorepo 分析

## How to Use

Read individual reference files for detailed explanations and code examples:

阅读单独的参考文件以获取详细说明和代码示例：

- [Section definitions](references/_sections.md) - Category structure and impact levels
- 类别结构和影响级别
- [Rule template](assets/templates/_template.md) - Template for adding new rules
- 添加新规则的模板

## Reference Files

| File | Description |
|------|-------------|
| [references/_sections.md](references/_sections.md) | Category definitions and ordering / 类别定义和排序 |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for new rules / 新规则模板 |
| [metadata.json](metadata.json) | Version and reference information / 版本和参考信息 |
