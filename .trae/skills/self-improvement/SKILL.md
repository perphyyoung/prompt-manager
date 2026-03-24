---
name: "self-improvement"
description: "Captures learnings, errors, and corrections to enable continuous improvement. Invoke when: (1) A command or operation fails unexpectedly, (2) User corrects me ('No, that's wrong...', 'Actually...'), (3) User requests a capability that doesn't exist, (4) An external API or tool fails, (5) I realize my knowledge is outdated or incorrect, (6) A better approach is discovered for a recurring task."
---

# Self-Improvement Skill

记录学习、错误和修正，实现持续改进。

## 快速参考

| 场景 | 操作 |
|------|------|
| 命令/操作失败 | 记录到 `.learnings/ERRORS.md` |
| 用户纠正我 | 记录到 `.learnings/LEARNINGS.md`，分类为 correction |
| 用户想要缺失的功能 | 记录到 `.learnings/FEATURE_REQUESTS.md` |
| API/外部工具失败 | 记录到 `.learnings/ERRORS.md`，包含集成详情 |
| 知识已过时 | 记录到 `.learnings/LEARNINGS.md`，分类为 knowledge_gap |
| 发现更好的方法 | 记录到 `.learnings/LEARNINGS.md`，分类为 best_practice |

## 日志文件位置

```
.learnings/
├── LEARNINGS.md    # 经验总结、最佳实践、知识补充
├── ERRORS.md       # 错误记录和解决方案
└── FEATURE_REQUESTS.md  # 功能需求
```

## 记录格式

### LEARNINGS.md 格式

```markdown
## [LRN-YYYYMMDD-XXX] 分类

**记录时间**: ISO-8601 时间戳
**优先级**: low | medium | high | critical
**状态**: pending | applied
**领域**: frontend | backend | infra | tests | docs | config

### 摘要
一句话描述学到的内容

### 详情
完整上下文：发生了什么、哪里错了、什么是正确的

### 建议操作
具体的修复或改进措施

### 元数据
- **来源**: 对话/文档/错误
- **相关文件**: 文件路径
- **参见**: 相关条目链接
```

### ERRORS.md 格式

```markdown
## [ERR-YYYYMMDD-XXX]

**记录时间**: ISO-8601 时间戳
**优先级**: low | medium | high | critical
**状态**: pending | investigating | resolved
**领域**: frontend | backend | infra | tests | docs | config

### 错误描述
发生了什么错误

### 重现步骤
1. 步骤一
2. 步骤二

### 预期行为
应该发生什么

### 实际行为
实际发生了什么

### 解决方案
如何修复的

### 根因分析
为什么会发生这个错误

### 预防措施
如何避免再次发生
```

### FEATURE_REQUESTS.md 格式

```markdown
## [FEAT-YYYYMMDD-XXX]

**记录时间**: ISO-8601 时间戳
**优先级**: low | medium | high | critical
**状态**: pending | planned | implemented | rejected
**领域**: frontend | backend | infra | tests | docs | config

### 功能描述
用户请求的功能是什么

### 使用场景
为什么需要这个功能

### 建议实现
可能的实现方案

### 相关文件
可能涉及的文件
```

## 升级策略

当学习记录证明具有广泛适用性时，升级到项目文档：

| 学习类型 | 升级目标 | 示例 |
|---------|---------|------|
| 行为模式 | 项目规则 | "简洁回答，避免免责声明" |
| 工作流程改进 | AGENTS.md | "长时间任务使用子代理" |
| 工具注意事项 | TOOLS.md | "Git push 需要先配置认证" |

## 工作流程

1. **识别触发条件** - 当出现上述场景时
2. **选择正确的日志文件** - 根据场景选择
3. **使用正确格式记录** - 遵循模板格式
4. **定期回顾** - 在执行重要任务前回顾相关学习
5. **升级通用学习** - 将广泛适用的学习升级到项目规则
