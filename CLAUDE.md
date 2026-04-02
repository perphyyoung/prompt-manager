# CLAUDE.md - Trae IDE 项目配置

## 核心原则

- 使用中文回答
- 添加功能时有更好的想法, 与我商量
- 禁止自动提交 git commit
- 按照大型项目来设计
- 禁止使用 PowerShell 替换，可以使用 TS 替换

## 指令优先级

1. **本文件 (CLAUDE.md)** — 最高优先级
2. **Superpowers skills** — 其次
3. **默认系统提示** — 最低优先级

## 黄金法则 / Golden Rule

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

## 第一性原理

- 不要假设我清楚自己想要什么; 动机或目标不清晰时, 停下来讨论
- 目标清晰但路径不是最短的, 直接告诉我并建议更好的方案
- 遇到问题追根因, 不打补丁; 每个决策都要能回答"为什么"
- 输出说重点, 砍掉一切不改变决策的信息

## 调试流程

- 根据真实逻辑测试
- 不要过度思考, 问题复杂时, 使用调试日志定位问题
- 调试时使用 `logger.ts` 写入 `pm.log`
- 删除日志时, 保留日志系统
- 做出修改后, 禁止直接删除日志生成语句, 需要我确认才能删除

## 修改原则

- 不要保留弃用方法

## 方案实施

- 改代码前，先简述计划与影响范围; 如果有类似的功能已实现, 给出复用代码的利弊分析
- 启动应用、安装依赖时提示我来操作, 而不是启动 `npm start`
- 修改后通过 `npm run build` 验证
- 删除时, 一次删除不要超过 100 行, 分次删除; 已删除方法的注释也删除
- 注释简洁; 更改代码时, 需要同步更改注释, 不要修改不必要的空格和空行

## 命名规范

- 数据库 `snake_case`，前端 `camelCase`
- 命名体现出变量/函数/类的作用和类型, 禁止太泛的通用名称
- 功能相似的代码, 使用相同的命名规则

## 接口规范

- 接口使用 I 前缀
- 非私有接口定义在 `src/types/entities.ts`
- 禁止 `!` 断言

## 项目规定

- 项目简介: `README.md`
- 功能特性: `FEATURES.md`
- 包管理: 使用 `cnpm` 替代 `npm`
- 字符串字面量定义在 `src/Constants` 中
- 使用 `src/utils/isSameId` 的 isSameId() 函数进行 ID 比较，避免类型不匹配
- 截取字符串时, 使用 slice()
- 同目录模块之间导入时，直接导入具体文件，不通过 index; 跨目录导入时，统一使用 index
- 使用 `src/utils/CacheManager` 管理缓存
- 时区处理: 使用本地时间格式: `src/utils/TimeUtils` 的 localTime()
- 网格视图没有多选功能, 只有列表视图和紧凑视图有多选功能
- 新建的 utils 文件, 如果不包含 `document`, 放入 `src/utils`; 否则放入 `src/renderer/renderer_utils`

## TypeScript 规定

- 新功能通过 `TypeScript` 实现
- TypeScript 中优先使用类型守卫，仅在以下情况允许使用 `as`：
  - DOM 元素类型断言（如 HTMLElement）
  - 与无类型定义的第三方库集成
  - 类型守卫会导致代码过度复杂的情况
