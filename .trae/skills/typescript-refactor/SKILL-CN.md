---
name: typescript-refactor
description: 来自首席专家视角的 TypeScript 重构和现代化指南。本技能应在重构、审查或现代化 TypeScript 代码以确保类型安全、编译器性能和惯用模式时使用。触发场景包括：TypeScript 类型架构、类型收窄、泛型、错误处理或迁移到现代 TypeScript 特性。
---

# TypeScript Refactor Best Practices

Comprehensive TypeScript refactoring and modernization guide designed for AI agents and LLMs. Contains 43 rules across 8 categories, prioritized by impact to guide automated refactoring, code review, and code generation.

为 AI 代理和 LLM 设计的综合性 TypeScript 重构和现代化指南。包含 43 条规则，分为 8 个类别，按影响力优先级排序，用于指导自动化重构、代码审查和代码生成。

## When to Apply

Reference these guidelines when:

在以下场景参考本指南：

- Refactoring TypeScript code for type safety and maintainability
- 为类型安全和可维护性重构 TypeScript 代码
- Designing type architectures (discriminated unions, branded types, generics)
- 设计类型架构（可辨识联合、品牌类型、泛型）
- Narrowing types to eliminate unsafe `as` casts
- 收窄类型以消除不安全的 `as` 类型断言
- Adopting modern TypeScript 4.x-5.x features (`satisfies`, `using`, const type parameters)
- 采用现代 TypeScript 4.x-5.x 特性（`satisfies`、`using`、const 类型参数）
- Optimizing compiler performance in large codebases
- 在大型代码库中优化编译器性能
- Implementing type-safe error handling patterns
- 实现类型安全的错误处理模式
- Reviewing code for TypeScript quirks and pitfalls
- 审查代码中的 TypeScript 怪癖和陷阱

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Type Architecture / 类型架构 | CRITICAL / 关键 | `arch-` |
| 2 | Type Narrowing & Guards / 类型收窄与守卫 | CRITICAL / 关键 | `narrow-` |
| 3 | Modern TypeScript / 现代 TypeScript | HIGH / 高 | `modern-` |
| 4 | Generic Patterns / 泛型模式 | HIGH / 高 | `generic-` |
| 5 | Compiler Performance / 编译器性能 | MEDIUM-HIGH / 中高 | `compile-` |
| 6 | Error Safety / 错误安全 | MEDIUM / 中 | `error-` |
| 7 | Runtime Patterns / 运行时模式 | MEDIUM / 中 | `perf-` |
| 8 | Quirks & Pitfalls / 怪癖与陷阱 | LOW-MEDIUM / 中低 | `quirk-` |

## Quick Reference

### 1. Type Architecture / 类型架构 (CRITICAL / 关键)

- [`arch-discriminated-unions`](references/arch-discriminated-unions.md) — Use discriminated unions over string enums for exhaustive pattern matching
- 使用可辨识联合替代字符串枚举进行穷尽式模式匹配
- [`arch-branded-types`](references/arch-branded-types.md) — Use branded types for domain identifiers to prevent value mix-ups
- 使用品牌类型作为领域标识符以防止值混淆
- [`arch-satisfies-over-annotation`](references/arch-satisfies-over-annotation.md) — Use `satisfies` for config objects to preserve literal types
- 对配置对象使用 `satisfies` 以保留字面量类型
- [`arch-interfaces-over-intersections`](references/arch-interfaces-over-intersections.md) — Extend interfaces instead of intersecting types for better error messages
- 扩展接口而非交叉类型以获得更好的错误信息
- [`arch-const-assertion`](references/arch-const-assertion.md) — Use `as const` for immutable literal inference
- 使用 `as const` 进行不可变字面量推断
- [`arch-readonly-by-default`](references/arch-readonly-by-default.md) — Default to readonly types for function parameters and return values
- 函数参数和返回值默认使用只读类型
- [`arch-avoid-partial-abuse`](references/arch-avoid-partial-abuse.md) — Avoid `Partial<T>` abuse for builder patterns
- 避免在构建器模式中滥用 `Partial<T>`

### 2. Type Narrowing & Guards / 类型收窄与守卫 (CRITICAL / 关键)

- [`narrow-custom-type-guards`](references/narrow-custom-type-guards.md) — Write custom type守卫 instead of type assertions
- 编写自定义类型守卫而非类型断言
- [`narrow-assertion-functions`](references/narrow-assertion-functions.md) — Use assertion functions for precondition checks
- 使用断言函数进行前置条件检查
- [`narrow-exhaustive-switch`](references/narrow-exhaustive-switch.md) — Enforce exhaustive switch with `never`
- 使用 `never` 强制穷尽式 switch
- [`narrow-in-operator`](references/narrow-in-operator.md) — Narrow with the `in` operator for interface unions
- 使用 `in` 操作符收窄接口联合类型
- [`narrow-eliminate-as-casts`](references/narrow-eliminate-as-casts.md) — Eliminate `as` casts with proper narrowing chains
- 通过正确的收窄链消除 `as` 类型断言
- [`narrow-typeof-chains`](references/narrow-typeof-chains.md) — Use `typeof` narrowing before property access
- 在属性访问前使用 `typeof` 收窄

### 3. Modern TypeScript / 现代 TypeScript (HIGH / 高)

- [`modern-using-keyword`](references/modern-using-keyword.md) — Use the `using` keyword for resource cleanup
- 使用 `using` 关键字进行资源清理
- [`modern-const-type-parameters`](references/modern-const-type-parameters.md) — Use const type parameters for literal inference
- 使用 const 类型参数进行字面量推断
- [`modern-template-literal-types`](references/modern-template-literal-types.md) — Use template literal types for string patterns
- 使用模板字面量类型处理字符串模式
- [`modern-noinfer-utility`](references/modern-noinfer-utility.md) — Use `NoInfer` to control type parameter inference
- 使用 `NoInfer` 控制类型参数推断
- [`modern-accessor-keyword`](references/modern-accessor-keyword.md) — Use `accessor` for auto-generated getters and setters
- 使用 `accessor` 自动生成 getter 和 setter
- [`modern-verbatim-module-syntax`](references/modern-verbatim-module-syntax.md) — Enable `verbatimModuleSyntax` for explicit import types
- 启用 `verbatimModuleSyntax` 以获得显式导入类型

### 4. Generic Patterns / 泛型模式 (HIGH / 高)

- [`generic-infer-over-annotate`](references/generic-infer-over-annotate.md) — Let TypeScript infer instead of explicit annotation
- 让 TypeScript 推断而非显式注解
- [`generic-constrain-dont-overconstrain`](references/generic-constrain-dont-overconstrain.md) — Constrain generics minimally
- 最小化约束泛型
- [`generic-avoid-distributive-surprises`](references/generic-avoid-distributive-surprises.md) — Control distributive conditional types
- 控制分布式条件类型
- [`generic-mapped-type-utilities`](references/generic-mapped-type-utilities.md) — Build custom mapped types for repeated transformations
- 为重复转换构建自定义映射类型
- [`generic-return-type-inference`](references/generic-return-type-inference.md) — Preserve return type inference in generic functions
- 在泛型函数中保留返回类型推断

### 5. Compiler Performance / 编译器性能 (MEDIUM-HIGH / 中高)

- [`compile-explicit-return-types`](references/compile-explicit-return-types.md) — Add explicit return types to exported functions
- 为导出函数添加显式返回类型
- [`compile-avoid-deep-recursion`](references/compile-avoid-deep-recursion.md) — Avoid deeply recursive type definitions
- 避免深度递归类型定义
- [`compile-project-references`](references/compile-project-references.md) — Use project references for monorepo builds
- 使用项目引用进行 monorepo 构建
- [`compile-base-types-over-unions`](references/compile-base-types-over-unions.md) — Use base types instead of large union types
- 使用基类型替代大型联合类型

### 6. Error Safety / 错误安全 (MEDIUM / 中)

- [`error-result-type`](references/error-result-type.md) — Use Result types instead of thrown exceptions
- 使用 Result 类型替代抛出异常
- [`error-exhaustive-error-handling`](references/error-exhaustive-error-handling.md) — Use exhaustive checks for typed error variants
- 对类型化错误变体使用穷尽式检查
- [`error-typed-catch`](references/error-typed-catch.md) — Type catch clause variables as `unknown`
- 将 catch 子句变量类型设为 `unknown`
- [`error-never-for-unreachable`](references/error-never-for-unreachable.md) — Use `never` to mark unreachable code paths
- 使用 `never` 标记不可达代码路径
- [`error-discriminated-error-unions`](references/error-discriminated-error-unions.md) — Model domain errors as discriminated unions
- 将领域错误建模为可辨识联合

### 7. Runtime Patterns / 运行时模式 (MEDIUM / 中)

- [`perf-union-literals-over-enums`](references/perf-union-literals-over-enums.md) — Use union literals instead of enums
- 使用联合字面量替代枚举
- [`perf-avoid-delete-operator`](references/perf-avoid-delete-operator.md) — Avoid the `delete` operator on objects
- 避免在对象上使用 `delete` 操作符
- [`perf-object-freeze-const`](references/perf-object-freeze-const.md) — Use `Object.freeze` with `as const` for true immutability
- 使用 `Object.freeze` 配合 `as const` 实现真正不可变
- [`perf-object-keys-narrowing`](references/perf-object-keys-narrowing.md) — Avoid `Object.keys` type widening
- 避免 `Object.keys` 类型拓宽
- [`perf-map-set-over-object`](references/perf-map-set-over-object.md) — Use `Map` and `Set` over plain objects for dynamic collections
- 对动态集合使用 `Map` 和 `Set` 替代普通对象

### 8. Quirks & Pitfalls / 怪癖与陷阱 (LOW-MEDIUM / 中低)

- [`quirk-excess-property-checks`](references/quirk-excess-property-checks.md) — Understand excess property checks on object literals
- 理解对象字面量的多余属性检查
- [`quirk-empty-object-type`](references/quirk-empty-object-type.md) — Avoid the `{}` type — it means non-nullish
- 避免使用 `{}` 类型——它表示非 nullish
- [`quirk-type-widening-let`](references/quirk-type-widening-let.md) — Prevent type widening with `let` declarations
- 防止 `let` 声明导致类型拓宽
- [`quirk-variance-annotations`](references/quirk-variance-annotations.md) — Use variance annotations for generic interfaces
- 对泛型接口使用变型注解
- [`quirk-structural-typing-escapes`](references/quirk-structural-typing-escapes.md) — Guard against structural typing escape hatches
- 防范结构类型逃逸舱口

## How to Use

Read individual reference files for detailed explanations and code examples:

阅读单独的参考文件以获取详细说明和代码示例：

- [Section definitions](references/_sections.md) — Category structure and impact levels
- 类别结构和影响级别
- [Rule template](assets/templates/_template.md) — Template for adding new rules
- 添加新规则的模板

## Reference Files

| File | Description |
|------|-------------|
| [references/_sections.md](references/_sections.md) | Category definitions and ordering / 类别定义和排序 |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for new rules / 新规则模板 |
| [metadata.json](metadata.json) | Version and reference information / 版本和参考信息 |
