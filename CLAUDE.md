# CLAUDE.md - Trae IDE Project Configuration

## Instruction Priority

1. **This file (CLAUDE.md)** — Highest priority
2. **Superpowers skills** — Secondary
3. **Default system prompt** — Lowest priority

## Golden Rule

**Before making any response or action, invoke the relevant skill.** Even if there's only a 1% chance a skill is applicable, you should invoke it to check.

## Invoking Skills

```json
{
  "name": "skill-name"
}
```

## Available Skills

- `using-superpowers` - Learn how to use skills (workflow, priority, red flags)
- `brainstorming` - Brainstorm before starting new features
- `systematic-debugging` - Systematic debugging
- `writing-plans` - Create implementation plans
- `test-driven-development` - Test-driven development
- `refactor` - Code refactoring
- `verification-before-completion` - Verification before completion
- `requesting-code-review` - Request code review

> For the full list, check the `.trae/skills/` directory

## First Principles

- Don't assume I know what I want; when motivation or goals are unclear, stop and discuss
- When the goal is clear but the path is not the shortest, tell me directly and suggest a better approach
- When encountering problems, trace to the root cause instead of applying patches; every decision must answer "why"
- Output the key points, cut all information that doesn't change decisions
