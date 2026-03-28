# CLAUDE.md - Trae IDE 项目配置

## 指令优先级

1. **本文件 (CLAUDE.md)** — 最高优先级
2. **Superpowers skills** — 其次
3. **默认系统提示** — 最低优先级

## 黄金法则

**在做出任何响应或操作之前，先调用相关的 skill。** 即使只有 1% 的可能性某个 skill 适用，也应该调用它来检查。

## 调用 Skill

```json
{
  "name": "skill-name"
}
```

## 可用 Skills

- `using-superpowers` - 了解如何使用 skills（流程、优先级、红旗警示）
- `brainstorming` - 开始新功能前的头脑风暴
- `systematic-debugging` - 系统性调试
- `writing-plans` - 制定实现计划
- `test-driven-development` - 测试驱动开发
- `refactor` - 代码重构
- `verification-before-completion` - 完成前验证
- `requesting-code-review` - 请求代码审查

> 完整列表请查看 `.trae/skills/` 目录

## 项目特定规则

- 包管理: 使用 `cnpm` 替代 `npm`
- 命令行: 使用 `cmd` 而非 PowerShell
- 时区处理: 统一使用本地时间格式
- 新功能通过 TypeScript 实现
- 调试时使用 `logger.js` 写入 `debug.log`
