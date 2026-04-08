# 自定义 Skills

## py-contextStack-esc

**路径**: `.trae/skills/py-contextStack-esc`

**功能**: 使用 ContextStackManager 处理 ESC 键关闭嵌套 UI 上下文（模态框、工具栏、下拉菜单）。

**核心能力**:

- 管理 UI 上下文堆栈
- ESC 键按正确顺序关闭嵌套界面
- 自动清理批量工具栏状态

---

## py-html-variables-plugin

**路径**: `.trae/skills/py-html-variables-plugin`

**功能**: 创建 Vite 插件，在构建时将 TypeScript 常量注入 HTML。

**核心能力**:

- HTML 中使用 `{{CONSTANT_NAME}}` 占位符
- 构建时替换为 TypeScript 常量值
- 编译时验证占位符有效性

---

## py-e2e-testing

**路径**: `.trae/skills/py-e2e-testing`

**功能**: 使用 Playwright 编写和调试端到端测试。

**核心能力**:

- 处理测试不稳定、竞态条件
- 截图验证 UI 交互
- 测试性能优化技巧
