# Lessons

- 如果读到该文件, 输出`我已阅读 lessons.md, 并严格遵守`
- 批量修改后必须用工具验证，不能依赖记忆
- 使用 skill 时必须严格遵守 skill 规范流程
- 提交消息要包含所有文件变更，包括 lessons.md 等配置/文档文件
- 优先使用 SearchReplace 进行局部修改，只有在修改量超过 50% 或需要结构重组时才考虑重写（Write）文件
- 简化代码时，只删除未使用的代码和对应注释，不删除有价值的注释（如 JSDoc）
- 谨慎使用 `declare global`，它会覆盖整个项目的类型声明；如果必须使用，确保与现有声明兼容，修改后需要重启 TypeScript 服务
- 代码搜索遵守"用 rg 而不是 grep"：Agent 环境内置搜索工具底层即 ripgrep 可直接使用；shell 层搜索一律用 `rg`/`rtk grep`，不用裸 grep
- 涉及 SQL 的修改，pnpm check（tsc/oxlint）完全无法覆盖，必须在提交前实际启动应用或对真实库冒烟验证，否则语法错误会直接导致启动失败
