---
name: refactor
description: 基于 Martin Fowler 的重构目录和 Clean Code 原则的代码重构最佳实践。本技能应在重构现有代码、改进代码结构、降低复杂度、消除代码异味或审查代码可维护性时使用。触发场景包括：提取方法、重命名、分解条件语句、降低耦合或提高可读性。
---

# Fowler/Martin 代码重构最佳实践

Comprehensive code refactoring guide based on Martin Fowler's catalog and Clean Code principles, designed for AI agents and LLMs. Contains 43 rules across 8 categories, prioritized by impact to guide automated refactoring and code generation.

基于 Martin Fowler 重构目录和 Clean Code 原则的综合性代码重构指南，专为 AI 代理和 LLM 设计。包含 43 条规则，分为 8 个类别，按影响力优先级排序，用于指导自动化重构和代码生成。

## 何时应用 / When to Apply

Reference these guidelines when:

在以下场景参考本指南：

- Refactoring existing code to improve maintainability
- 重构现有代码以提高可维护性
- Decomposing long methods or large classes
- 分解长方法或大类
- Reducing coupling between components
- 降低组件之间的耦合
- Simplifying complex conditional logic
- 简化复杂的条件逻辑
- Reviewing code for code smells and anti-patterns
- 审查代码中的代码异味和反模式

## 规则类别按优先级排序 / Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Structure & Decomposition / 结构与分解 | CRITICAL / 关键 | `struct-` |
| 2 | Coupling & Dependencies / 耦合与依赖 | CRITICAL / 关键 | `couple-` |
| 3 | Naming & Clarity / 命名与清晰 | HIGH / 高 | `name-` |
| 4 | Conditional Logic / 条件逻辑 | HIGH / 高 | `cond-` |
| 5 | Abstraction & Patterns / 抽象与模式 | MEDIUM-HIGH / 中高 | `pattern-` |
| 6 | Data Organization / 数据组织 | MEDIUM / 中 | `data-` |
| 7 | Error Handling / 错误处理 | MEDIUM / 中 | `error-` |
| 8 | Micro-Refactoring / 微重构 | LOW / 低 | `micro-` |

## 快速参考 / Quick Reference

### 1. Structure & Decomposition / 结构与分解 (CRITICAL / 关键)

- `struct-extract-method` - Extract Method for Long Functions / 提取长函数为方法
- `struct-single-responsibility` - Apply Single Responsibility Principle / 应用单一职责原则
- `struct-extract-class` - Extract Class from Large Class / 从大类中提取类
- `struct-compose-method` - Compose Method for Readable Flow / 组合方法以获得可读流程
- `struct-function-length` - Keep Functions Under 20 Lines / 保持函数在 20 行以内
- `struct-replace-method-with-object` - Replace Method with Method Object / 用方法对象替换方法
- `struct-parameter-object` - Introduce Parameter Object / 引入参数对象

### 2. Coupling & Dependencies / 耦合与依赖 (CRITICAL / 关键)

- `couple-dependency-injection` - Use Dependency Injection / 使用依赖注入
- `couple-hide-delegate` - Hide Delegate to Reduce Coupling / 隐藏委托以降低耦合
- `couple-remove-middle-man` - Remove Middle Man When Excessive / 当中间人过多时移除
- `couple-feature-envy` - Fix Feature Envy by Moving Methods / 通过移动方法修复特性嫉妒
- `couple-interface-segregation` - Apply Interface Segregation Principle / 应用接口隔离原则
- `couple-preserve-whole-object` - Preserve Whole Object Instead of Fields / 保留整个对象而非字段

### 3. Naming & Clarity / 命名与清晰 (HIGH / 高)

- `name-intention-revealing` - Use Intention-Revealing Names / 使用意图揭示型命名
- `name-avoid-abbreviations` - Avoid Abbreviations and Acronyms / 避免缩写和首字母缩略词
- `name-consistent-vocabulary` - Use Consistent Vocabulary / 使用一致的词汇
- `name-searchable-names` - Use Searchable Names / 使用可搜索的名称
- `name-avoid-encodings` - Avoid Type Encodings in Names / 避免名称中的类型编码

### 4. Conditional Logic / 条件逻辑 (HIGH / 高)

- `cond-guard-clauses` - Replace Nested Conditionals with Guard Clauses / 用卫语句替换嵌套条件
- `cond-polymorphism` - Replace Conditional with Polymorphism / 用多态替换条件语句
- `cond-decompose` - Decompose Complex Conditionals / 分解复杂条件
- `cond-consolidate` - Consolidate Duplicate Conditional Fragments / 合并重复的条件片段
- `cond-special-case` - Introduce Special Case Object / 引入特例对象
- `cond-lookup-table` - Replace Conditional with Lookup Table / 用查找表替换条件语句

### 5. Abstraction & Patterns / 抽象与模式 (MEDIUM-HIGH / 中高)

- `pattern-strategy` - Extract Strategy for Algorithm Variants / 为算法变体提取策略
- `pattern-template-method` - Use Template Method for Shared Skeleton / 使用模板方法共享骨架
- `pattern-factory` - Use Factory for Complex Object Creation / 使用工厂创建复杂对象
- `pattern-open-closed` - Apply Open-Closed Principle / 应用开闭原则
- `pattern-composition-over-inheritance` - Prefer Composition Over Inheritance / 优先使用组合而非继承
- `pattern-extract-superclass` - Extract Superclass for Common Behavior / 为共同行为提取超类

### 6. Data Organization / 数据组织 (MEDIUM / 中)

- `data-encapsulate-collection` - Encapsulate Collection / 封装集合
- `data-replace-primitive` - Replace Primitive with Object / 用对象替换基本类型
- `data-encapsulate-record` - Encapsulate Record into Class / 将记录封装为类
- `data-split-variable` - Split Variable with Multiple Assignments / 拆分多次赋值的变量
- `data-replace-temp-with-query` - Replace Temp with Query / 用查询替换临时变量

### 7. Error Handling / 错误处理 (MEDIUM / 中)

- `error-exceptions-over-codes` - Use Exceptions Instead of Error Codes / 使用异常而非错误码
- `error-custom-exceptions` - Create Domain-Specific Exception Types / 创建领域特定的异常类型
- `error-fail-fast` - Fail Fast with Preconditions / 使用前置条件快速失败
- `error-separate-concerns` - Separate Error Handling from Business Logic / 将错误处理与业务逻辑分离

### 8. Micro-Refactoring / 微重构 (LOW / 低)

- `micro-remove-dead-code` - Remove Dead Code / 移除死代码
- `micro-inline-variable` - Inline Trivial Variables / 内联简单变量
- `micro-simplify-expressions` - Simplify Boolean Expressions / 简化布尔表达式
- `micro-rename-for-clarity` - Rename for Clarity / 为清晰而重命名

## 如何使用 / How to Use

Read individual reference files for detailed explanations and code examples:

阅读单独的参考文件以获取详细说明和代码示例：

- [Section definitions](references/_sections.md) - Category structure and impact levels / 类别结构和影响级别
- [Rule template](assets/templates/_template.md) - Template for adding new rules / 添加新规则的模板
- Individual rules: `references/{prefix}-{slug}.md` / 单独规则

## 完整编译文档 / Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`

获取包含所有规则展开的完整指南：`AGENTS.md`
