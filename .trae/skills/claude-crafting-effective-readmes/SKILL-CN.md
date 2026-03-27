---

name: claude-crafting-effective-readmes
description: 在编写或改进 README 文件时使用。并非所有 README 都相同 —— 根据受众和项目类型提供匹配的模板和指导。

---

# 编写有效的 README / Crafting Effective READMEs

## 概述 / Overview

README 回答受众会有的问题。不同的受众需要不同的信息 —— 开源项目的贡献者需要的上下文与将来打开配置文件夹的你自己不同。

READMEs answer questions your audience will have. Different audiences need different information - a contributor to an OSS project needs different context than future-you opening a config folder.

**始终问自己：** 谁会阅读这个，他们需要知道什么？

**Always ask:** Who will read this, and what do they need to know?

## 流程 / Process

### 步骤 1：确定任务 / Step 1: Identify the Task

**问：** "你正在处理什么 README 任务？"

**Ask:** "What README task are you working on?"

| 任务 / Task | 何时 / When |
| --- | --- |
| **创建 / Creating** | 新项目，还没有 README / New project, no README yet |
| **添加 / Adding** | 需要记录新内容 / Need to document something new |
| **更新 / Updating** | 功能变更，内容过时 / Capabilities changed, content is stale |
| **审查 / Reviewing** | 检查 README 是否仍然准确 / Checking if README is still accurate |

### 步骤 2：任务特定问题 / Step 2: Task-Specific Questions

**创建初始 README / Creating initial README:**

1. 什么类型的项目？（见下方的项目类型）/ What type of project? (see Project Types below)
2. 用一句话说明这解决了什么问题？/ What problem does this solve in one sentence?
3. 达到"它能工作"的最快路径是什么？/ What's the quickest path to "it works"?
4. 有什么值得注意的亮点？/ Anything notable to highlight?

**添加章节 / Adding a section:**

1. 需要记录什么？/ What needs documenting?
2. 在现有结构中应该放在哪里？/ Where should it go in the existing structure?
3. 谁最需要这些信息？/ Who needs this info most?

**更新现有内容 / Updating existing content:**

1. 什么改变了？/ What changed?
2. 阅读当前 README，识别过时章节 / Read current README, identify stale sections
3. 提出具体编辑建议 / Propose specific edits

**审查/刷新 / Reviewing/refreshing:**

1. 阅读当前 README / Read current README
2. 对照实际项目状态检查（package.json、主文件等）/ Check against actual project state (package.json, main files, etc.)
3. 标记过时章节 / Flag outdated sections
4. 如有"最后审查日期"则更新 / Update "Last reviewed" date if present

### 步骤 3：始终询问 / Step 3: Always Ask

起草后，问：**"有什么其他我应该强调或包含的内容我可能遗漏了吗？"**

After drafting, ask: **"Anything else to highlight or include that I might have missed?"**

## 项目类型 / Project Types

| 类型 / Type | 受众 / Audience | 关键章节 / Key Sections | 模板 / Template |
| --- | --- | --- | --- |
| **开源 / Open Source** | 贡献者、全球用户 / Contributors, users worldwide | 安装、使用、贡献、许可 / Install, Usage, Contributing, License | `templates/oss.md` |
| **个人 / Personal** | 将来的你、作品集浏览者 / Future you, portfolio viewers | 功能、技术栈、心得 / What it does, Tech stack, Learnings | `templates/personal.md` |
| **内部 / Internal** | 团队成员、新员工 / Teammates, new hires | 设置、架构、操作手册 / Setup, Architecture, Runbooks | `templates/internal.md` |
| **配置 / Config** | 将来的你（困惑的）/ Future you (confused) | 内容、原因、如何扩展、注意事项 / What's here, Why, How to extend, Gotchas | `templates/xdg-config.md` |

**询问用户** 如果不清楚。不要为所有内容假设开源默认。

**Ask the user** if unclear. Don't assume OSS defaults for everything.

## 基本章节（所有类型）/ Essential Sections (All Types)

每个 README 至少需要：

Every README needs at minimum:

1. **名称 / Name** - 自解释的标题 / Self-explanatory title
2. **描述 / Description** - 1-2 句话说明是什么+为什么 / What + why in 1-2 sentences  
3. **使用 / Usage** - 如何使用（示例有帮助）/ How to use it (examples help)

## 参考 / References

- `section-checklist.md` - 按项目类型应包含哪些章节 / Which sections to include by project type
- `style-guide.md` - 常见 README 错误和写作指导 / Common README mistakes and prose guidance
- `using-references.md` - 深入参考材料指南 / Guide to deeper reference materials
