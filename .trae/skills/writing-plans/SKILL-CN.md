---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans / 编写计划

## Overview / 概述

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

编写全面的实现计划，假设工程师对我们的代码库一无所知且品味存疑。记录他们需要知道的一切：每个任务要接触哪些文件、代码、测试、可能需要检查的文档、如何测试。将整个计划分解为小而具体的任务。DRY（不要重复自己）、YAGNI（你不会需要它）、TDD（测试驱动开发）、频繁提交。

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

假设他们是有经验的开发者，但几乎不了解我们的工具集或问题领域。假设他们对良好的测试设计不太了解。

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**开始时声明：**"我正在使用 writing-plans 技能来创建实现计划。"

**Context:** This should be run in a dedicated worktree (created by brainstorming skill).

**上下文：**这应该在专用的 worktree 中运行（由 brainstorming 技能创建）。

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)

**保存计划到：**`docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
-（用户对计划位置的偏好会覆盖此默认值）

## Project-Specific Requirements / 项目特定要求

The following requirements from project rules must be followed in every plan:

以下项目规则中的要求必须在每个计划中遵循：

1. **Unit Testing / 单元测试**: After code changes, all involved methods (including new and called ones) need unit tests. Only test the modified parts, not all unit tests.

   代码修改后，所有涉及的方法（包括新增和被调用的）都需要单元测试。只测试修改的部分，而不是所有单元测试。

2. **Caching / 缓存**: New caching should uniformly use the implemented `CacheManager` class. If the feature has special requirements, ask the user if a custom cache class is needed.

   新的缓存应统一使用已实现的 `CacheManager` 类。如果功能有特殊需求，询问用户是否需要自定义缓存类。

3. **Multiple Approaches / 多种方案**: Each time a plan is given, provide at least two different implementation approaches and compare their pros and cons.

   每次给出计划时，至少提供两种不同的实现方式，并比较它们的优劣。

4. **Approach Combination / 方案组合**: When approaches are complementary, give combination recommendations.

   当方案互补时，给出方案组合建议。

5. **User Choice / 用户选择**: During implementation, if multiple approaches are available, ask the user which one to choose and execute accordingly. Do not only consider the simple approach.

   在方案实施中，如果有多个方案可选，需要询问用户选择哪个方案，并根据用户选择执行对应的方案，不能只考虑简单的方案。

6. **Quality Factors / 质量因素**: When giving implementation plans, consider maintainability, scalability, performance, etc. Do not only consider current requirements.

   给出实现方案或计划时，必须考虑到方案的可维护性、可扩展性、性能等因素，不能只考虑当前需求。

7. **Numbered Options / 编号选项**: Do not use "or" in plans. If there are multiple options, list them with numbers and give brief explanations.

   方案中不要出现"或"，如果有多个选项，通过数字序号列出，给出简要说明。

8. **No PowerShell / 禁止 PowerShell**: Do not use PowerShell for replacements. Use JS replacements instead.

   禁止使用 PowerShell 替换，可以使用 JS 替换。

9. **No Code Changes Without Approval / 未经批准不改代码**: When the user has not entered "modify" or "implement", do not immediately change code. Only output ideas for preparation. Code blocks are not necessary unless required.

   当用户未输入"修改"或"实施"时，不允许立即改动代码，只允许输出准备修改的思路，代码块非必要的话不需要展示。

10. **Dead Code Check / 死代码检查**: After the plan is completed, check for unused variables, functions, classes, etc. Confirm whether they need to be deleted.

    方案完成后，检查是否导致了未引用的变量、函数、类等，确认是否需要删除。

11. **Industry Standard Check / 行业标准检查**: If the user's requirements are inconsistent with industry standard solutions, remind the user to confirm if they really need to implement it this way.

    如果用户的要求和行业通用方案不一致，需要提醒用户确认是否真需要这么实现。

## Scope Check / 范围检查

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

如果规范涵盖多个独立的子系统，它应该在头脑风暴阶段被分解为子项目规范。如果没有，建议将其分解为独立的计划——每个子系统一个。每个计划都应该能够独立产生可工作的、可测试的软件。

## File Structure / 文件结构

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

在定义任务之前，先规划将要创建或修改哪些文件，以及每个文件的职责。这是分解决策被确定的地方。

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- 设计具有清晰边界和明确定义接口的单元。每个文件应该有一个明确的职责。
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- 你对能够同时在上下文中理解的代码推理得最好，当文件聚焦时，你的编辑更可靠。优先选择小而聚焦的文件，而不是做得太多的大文件。
- Files that change together should live together. Split by responsibility, not by technical layer.
- 一起变更的文件应该放在一起。按职责拆分，而不是按技术层拆分。
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.
- 在现有代码库中，遵循已建立的模式。如果代码库使用大文件，不要单方面重构——但如果你正在修改的文件变得难以管理，在计划中包含拆分是合理的。

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

这个结构指导任务分解。每个任务应该产生独立的、有意义的自包含变更。

## Bite-Sized Task Granularity / 小而具体的任务粒度

**Each step is one action (2-5 minutes):**

**每个步骤是一个动作（2-5分钟）：**

- "Write the failing test" - step
- "编写失败的测试" - 步骤
- "Run it to make sure it fails" - step
- "运行它以确保失败" - 步骤
- "Implement the minimal code to make the test pass" - step
- "实现最小代码使测试通过" - 步骤
- "Run the tests and make sure they pass" - step
- "运行测试并确保通过" - 步骤
- "Commit" - step
- "提交" - 步骤

## Plan Document Header / 计划文档头部

**Every plan MUST start with this header:**

**每个计划必须以此头部开始：**

```markdown
# [Feature Name] Implementation Plan / [功能名称] 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **对于代理工作者：**必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 来逐任务实现此计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**Goal:** [One sentence describing what this builds]

**目标：**[一句话描述构建什么]

**Architecture:** [2-3 sentences about approach]

**架构：**[2-3句话描述方法]

**Tech Stack:** [Key technologies/libraries]

**技术栈：**[关键技术/库]

**Approaches Considered:**

**考虑的方案：**

1. [Approach 1 name] - [Brief description and pros/cons]

   [方案1名称] - [简要说明和优劣]

2. [Approach 2 name] - [Brief description and pros/cons]

   [方案2名称] - [简要说明和优劣]

**Selected Approach:** [Which one and why]

**选择的方案：**[选择哪个及原因]

---
```

## Task Structure / 任务结构

````markdown
### Task N: [Component Name] / 任务 N：[组件名称]

**Files:** / **文件：**
- Create: `exact/path/to/file.py` / 创建：`exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145` / 修改：`exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py` / 测试：`tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test** / **步骤 1：编写失败的测试**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails** / **步骤 2：运行测试以验证失败**

Run: `pytest tests/path/test.py::test_name -v`
运行：`pytest tests/path/test.py::test_name -v`

Expected: FAIL with "function not defined"
预期：失败，提示"function not defined"

- [ ] **Step 3: Write minimal implementation** / **步骤 3：编写最小实现**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes** / **步骤 4：运行测试以验证通过**

Run: `pytest tests/path/test.py::test_name -v`
运行：`pytest tests/path/test.py::test_name -v`

Expected: PASS
预期：通过

- [ ] **Step 5: Commit** / **步骤 5：提交**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## No Placeholders / 禁止占位符

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:

每个步骤必须包含工程师需要的实际内容。这些是**计划失败**——永远不要写：

- "TBD", "TODO", "implement later", "fill in details"
- "待定"、"待办"、"稍后实现"、"填写详情"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "添加适当的错误处理"/"添加验证"/"处理边界情况"
- "Write tests for the above" (without actual test code)
- "为上述内容编写测试"（没有实际测试代码）
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- "类似于任务 N"（重复代码——工程师可能按无序阅读任务）
- Steps that describe what to do without showing how (code blocks required for code steps)
- 描述做什么但不展示如何做的步骤（代码步骤需要代码块）
- References to types, functions, or methods not defined in any task
- 引用任何任务中未定义的类型、函数或方法

## Remember / 记住

- Exact file paths always
- 始终使用确切的文件路径
- Complete code in every step — if a step changes code, show the code
- 每个步骤都有完整代码——如果步骤变更代码，展示代码
- Exact commands with expected output
- 带有预期输出的确切命令
- DRY, YAGNI, TDD, frequent commits
- DRY（不要重复自己）、YAGNI（你不会需要它）、TDD（测试驱动开发）、频繁提交
- Follow project-specific requirements listed above
- 遵循上面列出的项目特定要求

## Self-Review / 自我审查

After writing the complete plan, look at the spec with fresh eyes and check the plan against it. This is a checklist you run yourself — not a subagent dispatch.

编写完完整计划后，用新的眼光审视规范并检查计划。这是你自己运行的检查清单——不是子代理分派。

**1. Spec coverage:** Skim each section/requirement in the spec. Can you point to a task that implements it? List any gaps.

**1. 规范覆盖：**浏览规范中的每个部分/需求。你能指出实现它的任务吗？列出任何遗漏。

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**2. 占位符扫描：**在计划中搜索红旗——上面"禁止占位符"部分中的任何模式。修复它们。

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

**3. 类型一致性：**你在后续任务中使用的类型、方法签名和属性名称是否与早期任务中定义的匹配？任务 3 中名为 `clearLayers()` 但任务 7 中名为 `clearFullLayers()` 的函数是一个错误。

**4. Approach comparison:** Did you provide at least two approaches with pros/cons comparison as required?

**4. 方案比较：**你是否按要求提供了至少两种方案及其优劣比较？

**5. Test coverage:** Did you include unit test steps for all modified methods?

**5. 测试覆盖：**你是否为所有修改的方法包含了单元测试步骤？

**6. Dead code check:** Will the implementation produce unused variables, functions, or classes?

**6. 死代码检查：**实现是否会产生未使用的变量、函数或类？

If you find issues, fix them inline. No need to re-review — just fix and move on. If you find a spec requirement with no task, add the task.

如果发现问题，内联修复。无需重新审查——只需修复并继续。如果发现没有任务的规范需求，添加任务。

## Execution Handoff / 执行交接

After saving the plan, offer execution choice:

保存计划后，提供执行选择：

**"Plan complete and saved to `docs/superpowers/plans/<filename>.md`. Two execution options:**

**"计划完成并保存到 `docs/superpowers/plans/<filename>.md`。两种执行选项：**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**1. 子代理驱动（推荐）**——我为每个任务分派一个新的子代理，任务之间审查，快速迭代

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**2. 内联执行**——使用 executing-plans 在本会话中执行任务，批量执行带检查点

**Which approach?"

**选择哪种方法？"

**If Subagent-Driven chosen:**

**如果选择子代理驱动：**

- **REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development
- **必需子技能：**使用 superpowers:subagent-driven-development
- Fresh subagent per task + two-stage review
- 每个任务新子代理 + 两阶段审查

**If Inline Execution chosen:**

**如果选择内联执行：**

- **REQUIRED SUB-SKILL:** Use superpowers:executing-plans
- **必需子技能：**使用 superpowers:executing-plans
- Batch execution with checkpoints for review
- 批量执行带检查点审查
