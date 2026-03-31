# CLAUDE.md - Trae IDE 项目配置 / Trae IDE Project Configuration

## 指令优先级 / Instruction Priority

1. **本文件 (CLAUDE.md)** — 最高优先级 / Highest priority
2. **Superpowers skills** — 其次 / Secondary
3. **默认系统提示** — 最低优先级 / Lowest priority

## 黄金法则 / Golden Rule

**在做出任何响应或操作之前，先调用相关的 skill。** 即使只有 1% 的可能性某个 skill 适用，也应该调用它来检查。

**Before making any response or action, invoke the relevant skill.** Even if there's only a 1% chance a skill is applicable, you should invoke it to check.

## 调用 Skill / Invoking Skills

```json
{
  "name": "skill-name"
}
```

## 可用 Skills / Available Skills

- `using-superpowers` - 了解如何使用 skills（流程、优先级、红旗警示）/ Learn how to use skills (workflow, priority, red flags)
- `brainstorming` - 开始新功能前的头脑风暴 / Brainstorm before starting new features
- `systematic-debugging` - 系统性调试 / Systematic debugging
- `writing-plans` - 制定实现计划 / Create implementation plans
- `test-driven-development` - 测试驱动开发 / Test-driven development
- `refactor` - 代码重构 / Code refactoring
- `verification-before-completion` - 完成前验证 / Verification before completion
- `requesting-code-review` - 请求代码审查 / Request code review

> 完整列表请查看 `.trae/skills/` 目录 / For the full list, check the `.trae/skills/` directory

## 第一性原理

- 不要假设我清楚自己想要什么; 动机或目标不清晰时, 停下来讨论
- 目标清晰但路径不是最短的, 直接告诉我并建议更好的方案
- 遇到问题追根因, 不打补丁; 每个决策都要能回答"为什么"
- 输出说重点, 砍掉一切不改变决策的信息
