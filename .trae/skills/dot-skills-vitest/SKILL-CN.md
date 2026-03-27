---

name: dot-skills-vitest
description: Vitest 测试框架模式，包括测试设置、异步测试、使用 vi.* 进行模拟、快照和测试性能（前身为 test-vitest）。本技能应在编写或调试 Vitest 测试时使用。本技能不包含 TDD 方法论（请使用 test-tdd 技能）、使用 MSW 进行 API 模拟（请使用 test-msw 技能）或 Jest 特定 API。

---

# Vitest 最佳实践 / Vitest Best Practices

全面的 Vitest 测试框架性能优化和最佳实践指南。包含 44 条规则，分为 8 个类别，按影响力优先级排序，用于指导测试编写、重构和代码审查。

Comprehensive performance optimization and best practices guide for Vitest testing framework. Contains 44 rules across 8 categories, prioritized by impact to guide test writing, refactoring, and code review.

## 适用场景 / When to Apply

在以下情况下参考这些指南：

Reference these guidelines when:

- 编写新的 Vitest 测试 / Writing new Vitest tests
- 调试不稳定或缓慢的测试 / Debugging flaky or slow tests
- 设置测试配置 / Setting up test configuration
- 在 PR 中审查测试代码 / Reviewing test code in PRs
- 从 Jest 迁移到 Vitest / Migrating from Jest to Vitest
- 优化 CI/CD 测试性能 / Optimizing CI/CD test performance

## 按优先级排序的规则类别 / Rule Categories by Priority

| 优先级 / Priority | 类别 / Category | 影响力 / Impact | 前缀 / Prefix |
| --- | --- | --- | --- |
| 1 | 异步模式 / Async Patterns | 关键 / CRITICAL | `async-` |
| 2 | 测试设置与隔离 / Test Setup & Isolation | 关键 / CRITICAL | `setup-` |
| 3 | 模拟模式 / Mocking Patterns | 高 / HIGH | `mock-` |
| 4 | 性能 / Performance | 高 / HIGH | `perf-` |
| 5 | 快照测试 / Snapshot Testing | 中 / MEDIUM | `snap-` |
| 6 | 环境 / Environment | 中 / MEDIUM | `env-` |
| 7 | 断言 / Assertions | 低-中 / LOW-MEDIUM | `assert-` |
| 8 | 测试组织 / Test Organization | 低 / LOW | `org-` |

## 快速参考 / Quick Reference

### 1. 异步模式 (关键) / Async Patterns (CRITICAL)

- `async-await-assertions` - 等待异步断言以防止假阳性 / Await async assertions to prevent false positives
- `async-return-promises` - 从测试函数返回 Promise / Return promises from test functions
- `async-fake-timers` - 对时间相关代码使用假计时器 / Use fake timers for time-dependent code
- `async-waitfor-polling` - 对异步条件使用 vi.waitFor / Use vi.waitFor for async conditions
- `async-concurrent-expect` - 在并发测试中使用测试上下文 expect / Use test context expect in concurrent tests
- `async-act-wrapper` - 等待用户事件以避免 act 警告 / Await user events to avoid act warnings
- `async-error-handling` - 正确测试异步错误处理 / Test async error handling properly

### 2. 测试设置与隔离 (关键) / Test Setup & Isolation (CRITICAL)

- `setup-beforeeach-cleanup` - 在 afterEach 钩子中清理状态 / Clean up state in afterEach hooks
- `setup-restore-mocks` - 在每个测试后恢复模拟 / Restore mocks after each test
- `setup-avoid-shared-state` - 避免测试间共享可变状态 / Avoid shared mutable state between tests
- `setup-beforeall-expensive` - 对昂贵的一次性设置使用 beforeAll / Use beforeAll for expensive one-time setup
- `setup-reset-modules` - 测试模块状态时重置模块 / Reset modules when testing module state
- `setup-test-factories` - 对复杂测试数据使用测试工厂 / Use test factories for complex test data

### 3. 模拟模式 (高) / Mocking Patterns (HIGH)

- `mock-vi-mock-hoisting` - 理解 vi.mock 的提升行为 / Understand vi.mock hoisting behavior
- `mock-spyon-vs-mock` - 适当选择 vi.spyOn 与 vi.mock / Choose vi.spyOn vs vi.mock appropriately
- `mock-implementation-not-value` - 对动态模拟使用 mockImplementation / Use mockImplementation for dynamic mocks
- `mock-msw-network` - 使用 MSW 进行网络请求模拟 / Use MSW for network request mocking
- `mock-avoid-overmocking` - 避免过度模拟 / Avoid over-mocking
- `mock-type-safety` - 在模拟中保持类型安全 / Maintain type safety in mocks
- `mock-clear-between-tests` - 在测试间清除模拟状态 / Clear mock state between tests

### 4. 性能 (高) / Performance (HIGH)

- `perf-pool-selection` - 为性能选择正确的池 / Choose the right pool for performance
- `perf-disable-isolation` - 安全时禁用测试隔离 / Disable test isolation when safe
- `perf-happy-dom` - 尽可能使用 happy-dom 而非 jsdom / Use happy-dom over jsdom when possible
- `perf-sharding` - 使用分片进行 CI 并行化 / Use sharding for CI parallelization
- `perf-run-mode-ci` - 在 CI 环境中使用运行模式 / Use run mode in CI environments
- `perf-bail-fast-fail` - 在 CI 中使用 bail 实现快速失败 / Use bail for fast failure in CI

### 5. 快照测试 (中) / Snapshot Testing (MEDIUM)

- `snap-inline-over-file` - 对小值优先使用内联快照 / Prefer inline snapshots for small values
- `snap-avoid-large` - 避免大快照 / Avoid large snapshots
- `snap-stable-serialization` - 确保稳定的快照序列化 / Ensure stable snapshot serialization
- `snap-review-updates` - 提交前审查快照更新 / Review snapshot updates before committing
- `snap-describe-intent` - 描述性地命名快照测试 / Name snapshot tests descriptively

### 6. 环境 (中) / Environment (MEDIUM)

- `env-per-file-override` - 需要时按文件覆盖环境 / Override environment per file when needed
- `env-setup-files` - 对全局配置使用设置文件 / Use setup files for global configuration
- `env-globals-config` - 一致地配置全局变量 / Configure globals consistently
- `env-browser-api-mocking` - 模拟测试环境中不可用的浏览器 API / Mock browser APIs not available in test environment

### 7. 断言 (低-中) / Assertions (LOW-MEDIUM)

- `assert-specific-matchers` - 使用特定匹配器而非通用匹配器 / Use specific matchers over generic ones
- `assert-edge-cases` - 测试边界情况和边界 / Test edge cases and boundaries
- `assert-one-assertion-concept` - 每个测试一个概念 / Test one concept per test
- `assert-expect-assertions` - 对异步测试使用 expect.assertions / Use expect.assertions for async tests
- `assert-toequal-vs-tobe` - 正确选择 toBe 与 toEqual / Choose toBe vs toEqual correctly

### 8. 测试组织 (低) / Test Organization (LOW)

- `org-file-colocation` - 将测试文件与源文件放在一起 / Colocate test files with source files
- `org-describe-nesting` - 使用 describe 块进行逻辑分组 / Use describe blocks for logical grouping
- `org-test-naming` - 编写描述性的测试名称 / Write descriptive test names
- `org-test-skip-only` - 适当使用 skip 和 only / Use skip and only appropriately

## 使用方法 / How to Use

阅读单独的参考文件以获取详细说明和代码示例：

Read individual reference files for detailed explanations and code examples:

- [Section definitions](references/_sections.md) - 类别结构和影响力级别 / Category structure and impact levels
- [Rule template](assets/templates/_template.md) - 添加新规则的模板 / Template for adding new rules
- [async-await-assertions](references/async-await-assertions.md) - 示例规则文件 / Example rule file
- [mock-vi-mock-hoisting](references/mock-vi-mock-hoisting.md) - 示例规则文件 / Example rule file

## 相关技能 / Related Skills

- 关于 TDD 方法论，请参见 `test-tdd` 技能 / For TDD methodology, see `test-tdd` skill
- 关于使用 MSW 进行 API 模拟，请参见 `test-msw` 技能 / For API mocking with MSW, see `test-msw` skill
- 关于 TypeScript 测试模式，请参见 `typescript` 技能 / For TypeScript testing patterns, see `typescript` skill

## 完整编译文档 / Full Compiled Document

获取包含所有规则扩展的完整指南：[AGENTS.md](AGENTS.md)

For the complete guide with all rules expanded: [AGENTS.md](AGENTS.md)
