---
name: addy-code-simplification
description: 简化代码以提高清晰度。在重构代码以提高可读性而不改变行为时使用。在代码可以工作但比应有的更难阅读、维护或扩展时使用。在审查积累了不必要复杂性的代码时使用。
---

# 代码简化

> 灵感来自 [Claude Code Simplifier 插件](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md)。在此适配为模型无关、流程驱动的技能，适用于任何 AI 编码代理。

## 概述

通过降低复杂性同时保留确切行为来简化代码。目标不是减少行数——而是让代码更易于阅读、理解、修改和调试。每次简化都必须通过一个简单测试："新团队成员理解这个版本会比原版更快吗？"

## 何时使用

- 功能已实现且测试通过，但实现感觉比需要的更臃肿
- 代码审查时标记了可读性或复杂性问题
- 遇到深度嵌套逻辑、长函数或命名不清晰时
- 重构在压力下编写的代码时
- 整合分散在多个文件中的相关逻辑时
- 合并引入了重复或不一致的变更后

**何时不使用：**

- 代码已经干净且可读——不要为了简化而简化
- 你还不理解代码的作用——先理解再简化
- 代码是性能关键的，"更简单"的版本会明显变慢
- 你即将完全重写模块——简化一次性代码是浪费精力

## 五项原则

### 1. 完全保留行为

不要改变代码做什么——只改变它如何表达。所有输入、输出、副作用、错误行为和边界情况必须保持相同。如果不确定简化是否保留行为，就不要做。

```
每次更改前问自己：
→ 这对每个输入都产生相同的输出吗？
→ 这保持相同的错误行为吗？
→ 这保留相同的副作用和顺序吗？
→ 所有现有测试无需修改仍能通过吗？
```

### 2. 遵循项目约定

简化意味着使代码与代码库更一致，而不是强加外部偏好。简化前：

```
1. 阅读 CLAUDE.md / 项目约定
2. 研究相邻代码如何处理类似模式
3. 匹配项目的风格：
   - 导入顺序和模块系统
   - 函数声明风格
   - 命名约定
   - 错误处理模式
   - 类型注解深度
```

破坏项目一致性的简化不是简化——而是折腾。

### 3. 清晰优于巧妙

当紧凑版本需要停下来解析时，显式代码比紧凑代码更好。

```typescript
// 不清晰：密集的三元链
const label = isNew ? 'New' : isUpdated ? 'Updated' : isArchived ? 'Archived' : 'Active';

// 清晰：可读的映射
function getStatusLabel(item: Item): string {
  if (item.isNew) return 'New';
  if (item.isUpdated) return 'Updated';
  if (item.isArchived) return 'Archived';
  return 'Active';
}
```

```typescript
// 不清晰：链式 reduce 内联逻辑
const result = items.reduce((acc, item) => ({
  ...acc,
  [item.id]: { ...acc[item.id], count: (acc[item.id]?.count ?? 0) + 1 }
}), {});

// 清晰：命名的中间步骤
const countById = new Map<string, number>();
for (const item of items) {
  countById.set(item.id, (countById.get(item.id) ?? 0) + 1);
}
```

### 4. 保持平衡

简化有一个失败模式：过度简化。注意这些陷阱：

- **过度内联**——移除给概念命名的辅助函数会使调用点更难阅读
- **合并不相关逻辑**——两个简单函数合并成一个复杂函数不是更简单
- **移除"不必要"的抽象**——有些抽象是为了可扩展性或可测试性，不是为了复杂性
- **优化行数**——行数少不是目标；易于理解才是

### 5. 限定在变更范围内

默认简化最近修改的代码。除非明确要求扩大范围，否则避免顺带重构不相关的代码。无范围的简化会在 diff 中产生噪音，并带来意外回归的风险。

## 简化流程

### 步骤 1：动手前理解（切斯特顿的篱笆）

在更改或移除任何内容之前，先理解它为什么存在。这是切斯特顿的篱笆：如果你看到路上有篱笆但不知道为什么，不要拆掉它。先理解原因，再决定原因是否仍然适用。

```
简化前回答：
- 这段代码的职责是什么？
- 谁调用它？它调用什么？
- 边界情况和错误路径是什么？
- 有定义预期行为的测试吗？
- 为什么可能这样写？（性能？平台限制？历史原因？）
- 查看 git blame：这段代码的原始上下文是什么？
```

如果你无法回答这些问题，你还没准备好简化。先阅读更多上下文。

### 步骤 2：识别简化机会

扫描这些模式——每个都是具体信号，不是模糊的气味：

**结构复杂性：**

| 模式 | 信号 | 简化 |
|---------|--------|----------------|
| 深度嵌套（3+ 层） | 难以跟踪控制流 | 提取条件到守卫子句或辅助函数 |
| 长函数（50+ 行） | 多个职责 | 拆分为有描述性名称的专注函数 |
| 嵌套三元表达式 | 需要心智栈来解析 | 替换为 if/else 链、switch 或查找对象 |
| 布尔参数标志 | `doThing(true, false, true)` | 替换为选项对象或单独函数 |
| 重复条件 | 多个地方有相同的 `if` 检查 | 提取到命名良好的谓词函数 |

**命名和可读性：**

| 模式 | 信号 | 简化 |
|---------|--------|----------------|
| 通用名称 | `data`、`result`、`temp`、`val`、`item` | 重命名为描述内容：`userProfile`、`validationErrors` |
| 缩写名称 | `usr`、`cfg`、`btn`、`evt` | 使用完整单词，除非缩写是通用的（`id`、`url`、`api`） |
| 误导性名称 | 名为 `get` 但也会改变状态的函数 | 重命名以反映实际行为 |
| 解释"做什么"的注释 | `// increment counter` 在 `count++` 上方 | 删除注释——代码足够清晰 |
| 解释"为什么"的注释 | `// 重试因为 API 在高负载下不稳定` | 保留这些——它们携带代码无法表达的意图 |

**冗余：**

| 模式 | 信号 | 简化 |
|---------|--------|----------------|
| 重复逻辑 | 多个地方有相同的 5+ 行 | 提取到共享函数 |
| 死代码 | 不可达分支、未使用变量、注释掉的代码块 | 移除（确认真正死亡后） |
| 不必要的抽象 | 没有增加价值的包装器 | 内联包装器，直接调用底层函数 |
| 过度设计的模式 | 工厂的工厂、只有一个策略的策略 | 替换为简单直接的方法 |
| 冗余类型断言 | 转换为已经推断出的类型 | 移除断言 |

### 步骤 3：增量应用更改

一次做一个简化。每次更改后运行测试。**将重构更改与功能或 bug 修复更改分开提交。** 一个既重构又添加功能的 PR 是两个 PR——分开它们。

```
对于每次简化：
1. 做更改
2. 运行测试套件
3. 如果测试通过 → 提交（或继续下一次简化）
4. 如果测试失败 → 回退并重新考虑
```

避免将多个简化批量放入单个未测试的更改中。如果出现问题，你需要知道是哪个简化导致的。

**500 行规则：** 如果重构会触及超过 500 行，投资于自动化（codemods、sed 脚本、AST 转换）而不是手工更改。这种规模的手工编辑容易出错且审查起来令人疲惫。

### 步骤 4：验证结果

所有简化完成后，退一步评估整体：

```
比较前后：
- 简化版本真的更容易理解吗？
- 你引入了与代码库不一致的新模式吗？
- diff 干净且可审查吗？
- 队友会批准这个更改吗？
```

如果"简化"版本更难理解或审查，回退。不是每次简化尝试都会成功。

## 语言特定指导

### TypeScript / JavaScript

```typescript
// 简化：不必要的 async 包装器
// 之前
async function getUser(id: string): Promise<User> {
  return await userService.findById(id);
}
// 之后
function getUser(id: string): Promise<User> {
  return userService.findById(id);
}

// 简化：冗长的条件赋值
// 之前
let displayName: string;
if (user.nickname) {
  displayName = user.nickname;
} else {
  displayName = user.fullName;
}
// 之后
const displayName = user.nickname || user.fullName;

// 简化：手动数组构建
// 之前
const activeUsers: User[] = [];
for (const user of users) {
  if (user.isActive) {
    activeUsers.push(user);
  }
}
// 之后
const activeUsers = users.filter((user) => user.isActive);

// 简化：冗余的布尔返回
// 之前
function isValid(input: string): boolean {
  if (input.length > 0 && input.length < 100) {
    return true;
  }
  return false;
}
// 之后
function isValid(input: string): boolean {
  return input.length > 0 && input.length < 100;
}
```

### Python

```python
# 简化：冗长的字典构建
# 之前
result = {}
for item in items:
    result[item.id] = item.name
# 之后
result = {item.id: item.name for item in items}

# 简化：带提前返回的嵌套条件
# 之前
def process(data):
    if data is not None:
        if data.is_valid():
            if data.has_permission():
                return do_work(data)
            else:
                raise PermissionError("No permission")
        else:
            raise ValueError("Invalid data")
    else:
        raise TypeError("Data is None")
# 之后
def process(data):
    if data is None:
        raise TypeError("Data is None")
    if not data.is_valid():
        raise ValueError("Invalid data")
    if not data.has_permission():
        raise PermissionError("No permission")
    return do_work(data)
```

### React / JSX

```tsx
// 简化：冗长的条件渲染
// 之前
function UserBadge({ user }: Props) {
  if (user.isAdmin) {
    return <Badge variant="admin">Admin</Badge>;
  } else {
    return <Badge variant="default">User</Badge>;
  }
}
// 之后
function UserBadge({ user }: Props) {
  const variant = user.isAdmin ? 'admin' : 'default';
  const label = user.isAdmin ? 'Admin' : 'User';
  return <Badge variant={variant}>{label}</Badge>;
}

// 简化：通过中间组件的属性钻取
// 之前——考虑上下文或组合是否能更好地解决这个问题。
// 这是一个判断调用——标记它，不要自动重构。
```

## 常见合理化借口

| 合理化 | 现实 |
|---|---|
| "它能工作，没必要碰它" | 难以阅读的工作代码在出问题时将难以修复。现在简化可以节省每次未来更改的时间。 |
| "行数少总是更简单" | 1 行的嵌套三元表达式不比 5 行的 if/else 更简单。简单性关乎理解速度，不是行数。 |
| "我也顺便快速简化一下这段不相关的代码" | 无范围的简化会产生嘈杂的 diff 并带来你无意更改的代码的回归风险。保持专注。 |
| "类型使其自文档化" | 类型文档化结构，不是意图。命名良好的函数比类型签名更能解释*为什么*。 |
| "这个抽象以后可能有用" | 不要保留推测性抽象。如果现在没使用，它就是没有价值的复杂性。移除它，需要时再添加。 |
| "原作者一定有原因" | 也许。查看 git blame——应用切斯特顿的篱笆。但累积的复杂性往往没有原因；它只是压力下迭代的残留。 |
| "我会在添加这个功能时顺便重构" | 将重构与功能工作分开。混合更改更难审查、回退和理解历史。 |

## 危险信号

- 需要修改测试才能通过的简化（你可能改变了行为）
- 比原版更长更难跟踪的"简化"代码
- 为了匹配你的偏好而不是项目约定而重命名
- 因为"它使代码更干净"而移除错误处理
- 简化你不完全理解的代码
- 将许多简化批量放入一个难以审查的大提交
- 未被要求时重构当前任务范围之外的代码

## 验证

完成简化后：

- [ ] 所有现有测试无需修改即可通过
- [ ] 构建成功，没有新警告
- [ ] Linter/格式化器通过（没有风格回归）
- [ ] 每次简化都是可审查的增量更改
- [ ] diff 干净——没有混入不相关的更改
- [ ] 简化的代码遵循项目约定（对照 CLAUDE.md 或等效文件检查）
- [ ] 没有错误处理被移除或削弱
- [ ] 没有留下死代码（未使用的导入、不可达分支）
- [ ] 队友或审查代理会批准这个更改作为净改进
