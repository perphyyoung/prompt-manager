---
name: development
description: 基于实施方案执行 TDD、并行开发与持续验证
---

# Development

## 目标

- 按实施方案执行开发
- 采用 TDD 和持续验证
- 默认采用 subagent 并行交付，主 Agent 负责集成与验收

## 约束

- TDD 是默认开发模式，不跳过失败测试, 最小实现, 回归验证
- Subagent-driven 是默认执行模式；除非任务是单文件微调或短路径修复，否则先拆分再编码
- 主 Agent 保留关键路径，不外包核心判断，不在派出 subagent 后空等。

## 流程

1. 准备并验证测试环境，构建可观测链路（log, trace, metrics）
2. 做 task decomposition，明确 ownership、依赖和验证方式
3. 只要可拆分，先派出 subagent。中等及以上任务默认并行 `2-3` 个 subagent
4. 按 TDD 推进主线：先失败测试，再最小实现，再重构
5. 非阻塞工作交给 subagent，主 Agent 负责集成、接口粘合、回归
6. 每完成一个功能点立即自验证；未通过则回到步骤 3 继续迭代
7. 最终按 verification 验收，通过后按 finish 收尾

## 参考

- [subagent-driven.md](/Users/rogn/Documents/code/buaa-2643/vibe/DevSkill/.agents/skills/development/subagent-driven.md)
