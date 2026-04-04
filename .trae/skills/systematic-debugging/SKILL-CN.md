---
name: systematic-debugging-cn
description: 在遇到任何 bug、测试失败或意外行为时使用，在尝试修复之前
---

# Systematic Debugging / 系统化调试

## Overview / 概述

Random fixes waste time and create new bugs. Quick patches mask underlying issues.
随机修复浪费时间并产生新 bug。快速补丁掩盖了根本问题。

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.
**核心原则：** 在尝试修复之前，务必找到根本原因。症状修复就是失败。

**Violating the letter of this process is violating the spirit of debugging.**
**违反此流程的字面规定就是违反调试的精神。**

## The Iron Law / 铁律

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
没有事先的根本原因调查，就不进行修复
```

If you haven't completed Phase 1, you cannot propose fixes.
如果你尚未完成第 1 阶段，你就不能提出修复方案。

## When to Use / 何时使用

Use for ANY technical issue:
用于任何技术问题：
- Test failures / 测试失败
- Bugs in production / 生产环境中的 bug
- Unexpected behavior / 意外行为
- Performance problems / 性能问题
- Build failures / 构建失败
- Integration issues / 集成问题

**Use this ESPECIALLY when:**
**特别适用于以下情况：**
- Under time pressure (emergencies make guessing tempting)
- 时间紧迫时（紧急情况会让人想要猜测）
- "Just one quick fix" seems obvious
- "只是一个快速修复"似乎很明显
- You've already tried multiple fixes
- 你已经尝试了多种修复
- Previous fix didn't work
- 之前的修复不起作用
- You don't fully understand the issue
- 你不完全理解问题

**Don't skip when:**
**不要跳过以下情况：**
- Issue seems simple (simple bugs have root causes too)
- 问题看起来简单（简单的 bug 也有根本原因）
- You're in a hurry (rushing guarantees rework)
- 你很匆忙（匆忙保证会返工）
- Manager wants it fixed NOW (systematic is faster than thrashing)
- 经理要求立即修复（系统化比盲目尝试更快）

## The Four Phases / 四个阶段

You MUST complete each phase before proceeding to the next.
你必须完成每个阶段后才能进入下一个阶段。

### Phase 1: Root Cause Investigation / 第 1 阶段：根本原因调查

**BEFORE attempting ANY fix:**
**在尝试任何修复之前：**

1. **Read Error Messages Carefully / 仔细阅读错误信息**
   - Don't skip past errors or warnings
   - 不要跳过错误或警告
   - They often contain the exact solution
   - 它们通常包含确切的解决方案
   - Read stack traces completely
   - 完整阅读堆栈跟踪
   - Note line numbers, file paths, error codes
   - 记录行号、文件路径、错误代码

2. **Reproduce Consistently / 稳定复现**
   - Can you trigger it reliably?
   - 你能可靠地触发它吗？
   - What are the exact steps?
   - 确切的步骤是什么？
   - Does it happen every time?
   - 它每次都发生吗？
   - If not reproducible → gather more data, don't guess
   - 如果无法复现 → 收集更多数据，不要猜测

3. **Check Recent Changes / 检查最近的更改**
   - What changed that could cause this?
   - 什么更改可能导致这个问题？
   - Git diff, recent commits
   - Git 差异、最近的提交
   - New dependencies, config changes
   - 新依赖、配置更改
   - Environmental differences
   - 环境差异

4. **Gather Evidence in Multi-Component Systems / 在多组件系统中收集证据**

   **WHEN system has multiple components (CI → build → signing, API → service → database):**
   **当系统有多个组件时（CI → 构建 → 签名，API → 服务 → 数据库）：**

   **BEFORE proposing fixes, add diagnostic instrumentation:**
   **在提出修复方案之前，添加诊断工具：**
   ```
   For EACH component boundary:
   对于每个组件边界：
     - Log what data enters component
     - 记录进入组件的数据
     - Log what data exits component
     - 记录退出组件的数据
     - Verify environment/config propagation
     - 验证环境/配置传播
     - Check state at each layer
     - 检查每层的状态

   Run once to gather evidence showing WHERE it breaks
   运行一次以收集证据，显示问题发生在哪里
   THEN analyze evidence to identify failing component
   然后分析证据以识别失败的组件
   THEN investigate that specific component
   然后调查该特定组件
   ```

   **Example (multi-layer system): / 示例（多层系统）：**
   ```bash
   # Layer 1: Workflow / 第 1 层：工作流
   echo "=== Secrets available in workflow: ==="
   echo "=== 工作流中可用的密钥：==="
   echo "IDENTITY: ${IDENTITY:+SET}${IDENTITY:-UNSET}"

   # Layer 2: Build script / 第 2 层：构建脚本
   echo "=== Env vars in build script: ==="
   echo "=== 构建脚本中的环境变量：==="
   env | grep IDENTITY || echo "IDENTITY not in environment"
   echo "IDENTITY 不在环境中"

   # Layer 3: Signing script / 第 3 层：签名脚本
   echo "=== Keychain state: ==="
   echo "=== 钥匙串状态：==="
   security list-keychains
   security find-identity -v

   # Layer 4: Actual signing / 第 4 层：实际签名
   codesign --sign "$IDENTITY" --verbose=4 "$APP"
   ```

   **This reveals:** Which layer fails (secrets → workflow ✓, workflow → build ✗)
   **这揭示了：** 哪一层失败了（密钥 → 工作流 ✓，工作流 → 构建 ✗）

5. **Trace Data Flow / 追踪数据流**

   **WHEN error is deep in call stack:**
   **当错误位于调用堆栈深处时：**

   See `root-cause-tracing.md` in this directory for the complete backward tracing technique.
   查看此目录中的 `root-cause-tracing.md` 了解完整的反向追踪技术。

   **Quick version:**
   **快速版本：**
   - Where does bad value originate?
   - 错误值起源于哪里？
   - What called this with bad value?
   - 什么用错误值调用了这个？
   - Keep tracing up until you find the source
   - 持续向上追踪直到找到源头
   - Fix at source, not at symptom
   - 在源头修复，而不是在症状处

### Phase 2: Pattern Analysis / 第 2 阶段：模式分析

**Find the pattern before fixing:**
**在修复之前找到模式：**

1. **Find Working Examples / 找到工作示例**
   - Locate similar working code in same codebase
   - 在同一代码库中找到类似的工作代码
   - What works that's similar to what's broken?
   - 什么与损坏的代码类似但工作正常？

2. **Compare Against References / 与参考对比**
   - If implementing pattern, read reference implementation COMPLETELY
   - 如果实现模式，完整阅读参考实现
   - Don't skim - read every line
   - 不要略读 - 阅读每一行
   - Understand the pattern fully before applying
   - 在应用之前完全理解模式

3. **Identify Differences / 识别差异**
   - What's different between working and broken?
   - 工作正常和损坏的之间有什么不同？
   - List every difference, however small
   - 列出每个差异，无论多小
   - Don't assume "that can't matter"
   - 不要假设"那不重要"

4. **Understand Dependencies / 理解依赖**
   - What other components does this need?
   - 这需要什么其他组件？
   - What settings, config, environment?
   - 什么设置、配置、环境？
   - What assumptions does it make?
   - 它做了什么假设？

### Phase 3: Hypothesis and Testing / 第 3 阶段：假设和测试

**Scientific method:**
**科学方法：**

1. **Form Single Hypothesis / 形成单一假设**
   - State clearly: "I think X is the root cause because Y"
   - 清楚说明："我认为 X 是根本原因，因为 Y"
   - Write it down
   - 写下来
   - Be specific, not vague
   - 具体而非模糊

2. **Test Minimally / 最小化测试**
   - Make the SMALLEST possible change to test hypothesis
   - 做出最小的可能更改来测试假设
   - One variable at a time
   - 一次一个变量
   - Don't fix multiple things at once
   - 不要同时修复多个问题

3. **Verify Before Continuing / 在继续之前验证**
   - Did it work? Yes → Phase 4
   - 它起作用了吗？是 → 第 4 阶段
   - Didn't work? Form NEW hypothesis
   - 不起作用？形成新假设
   - DON'T add more fixes on top
   - 不要在上面添加更多修复

4. **When You Don't Know / 当你不知道时**
   - Say "I don't understand X"
   - 说"我不理解 X"
   - Don't pretend to know
   - 不要假装知道
   - Ask for help
   - 寻求帮助
   - Research more
   - 更多研究

### Phase 4: Implementation / 第 4 阶段：实施

**Fix the root cause, not the symptom:**
**修复根本原因，而不是症状：**

1. **Create Failing Test Case / 创建失败的测试用例**
   - Simplest possible reproduction
   - 最简单的可能复现
   - Automated test if possible
   - 如果可能，自动化测试
   - One-off test script if no framework
   - 如果没有框架，使用一次性测试脚本
   - MUST have before fixing
   - 修复前必须有
   - Use the `superpowers:test-driven-development` skill for writing proper failing tests
   - 使用 `superpowers:test-driven-development` 技能来编写正确的失败测试

2. **Implement Single Fix / 实施单一修复**
   - Address the root cause identified
   - 解决已识别的根本原因
   - ONE change at a time
   - 一次一个更改
   - No "while I'm here" improvements
   - 没有"既然我在这里"的改进
   - No bundled refactoring
   - 没有捆绑重构

3. **Verify Fix / 验证修复**
   - Test passes now?
   - 测试现在通过了吗？
   - No other tests broken?
   - 没有其他测试被破坏？
   - Issue actually resolved?
   - 问题实际解决了吗？

4. **If Fix Doesn't Work / 如果修复不起作用**
   - STOP
   - 停止
   - Count: How many fixes have you tried?
   - 计数：你尝试了多少次修复？
   - If < 3: Return to Phase 1, re-analyze with new information
   - 如果 < 3：返回第 1 阶段，用新信息重新分析
   - **If ≥ 3: STOP and question the architecture (step 5 below)**
   - **如果 ≥ 3：停止并质疑架构（下面的第 5 步）**
   - DON'T attempt Fix #4 without architectural discussion
   - 没有架构讨论不要尝试第 4 次修复

5. **If 3+ Fixes Failed: Question Architecture / 如果 3 次以上修复失败：质疑架构**

   **Pattern indicating architectural problem:**
   **表明架构问题的模式：**
   - Each fix reveals new shared state/coupling/problem in different place
   - 每次修复在不同地方揭示新的共享状态/耦合/问题
   - Fixes require "massive refactoring" to implement
   - 修复需要"大规模重构"来实现
   - Each fix creates new symptoms elsewhere
   - 每次修复在其他地方产生新症状

   **STOP and question fundamentals:**
   **停止并质疑基本原则：**
   - Is this pattern fundamentally sound?
   - 这个模式从根本上说是合理的吗？
   - Are we "sticking with it through sheer inertia"?
   - 我们是在"纯粹出于惯性坚持它"吗？
   - Should we refactor architecture vs. continue fixing symptoms?
   - 我们应该重构架构还是继续修复症状？

   **Discuss with your human partner before attempting more fixes**
   **在尝试更多修复之前与你的伙伴讨论**

   This is NOT a failed hypothesis - this is a wrong architecture.
   这不是一个失败的假设 - 这是一个错误的架构。

## Red Flags - STOP and Follow Process / 红旗 - 停止并遵循流程

If you catch yourself thinking:
如果你发现自己在想：
- "Quick fix for now, investigate later"
- "先快速修复，稍后调查"
- "Just try changing X and see if it works"
- "只是尝试更改 X 看看是否有效"
- "Add multiple changes, run tests"
- "添加多个更改，运行测试"
- "Skip the test, I'll manually verify"
- "跳过测试，我会手动验证"
- "It's probably X, let me fix that"
- "可能是 X，让我修复它"
- "I don't fully understand but this might work"
- "我不完全理解但这可能有效"
- "Pattern says X but I'll adapt it differently"
- "模式说 X 但我会以不同方式适应"
- "Here are the main problems: [lists fixes without investigation]"
- "以下是主要问题：[在没有调查的情况下列出修复]"
- Proposing solutions before tracing data flow
- 在追踪数据流之前提出解决方案
- **"One more fix attempt" (when already tried 2+)**
- **"再尝试一次修复"（当已经尝试了 2 次以上）**
- **Each fix reveals new problem in different place**
- **每次修复在不同地方揭示新问题**

**ALL of these mean: STOP. Return to Phase 1.**
**所有这些都意味着：停止。返回第 1 阶段。**

**If 3+ fixes failed:** Question the architecture (see Phase 4.5)
**如果 3 次以上修复失败：** 质疑架构（见第 4.5 阶段）

## Your Human Partner's Signals You're Doing It Wrong / 你的伙伴表明你做错了的信号

**Watch for these redirections:**
**注意这些重新引导：**
- "Is that not happening?" - You assumed without verifying
- "那不是没有发生吗？" - 你没有验证就假设了
- "Will it show us...?" - You should have added evidence gathering
- "它会向我们展示...？" - 你应该添加证据收集
- "Stop guessing" - You're proposing fixes without understanding
- "停止猜测" - 你在不理解的情况下提出修复
- "Ultrathink this" - Question fundamentals, not just symptoms
- "深入思考这个" - 质疑基本原则，而不仅仅是症状
- "We're stuck?" (frustrated) - Your approach isn't working
- "我们卡住了？"（沮丧）- 你的方法不起作用

**When you see these:** STOP. Return to Phase 1.
**当你看到这些时：** 停止。返回第 1 阶段。

## Common Rationalizations / 常见合理化借口

| Excuse / 借口 | Reality / 现实 |
|--------|---------------|
| "Issue is simple, don't need process" / "问题很简单，不需要流程" | Simple issues have root causes too. Process is fast for simple bugs. / 简单问题也有根本原因。流程对简单 bug 来说很快。 |
| "Emergency, no time for process" / "紧急情况，没时间走流程" | Systematic debugging is FASTER than guess-and-check thrashing. / 系统化调试比猜测和检查的盲目尝试更快。 |
| "Just try this first, then investigate" / "先试试这个，然后再调查" | First fix sets the pattern. Do it right from the start. / 第一次修复设定了模式。从一开始就正确做。 |
| "I'll write test after confirming fix works" / "确认修复有效后我会写测试" | Untested fixes don't stick. Test first proves it. / 未经测试的修复不会持久。先测试证明它。 |
| "Multiple fixes at once saves time" / "同时修复多个问题节省时间" | Can't isolate what worked. Causes new bugs. / 无法隔离什么起作用了。会产生新 bug。 |
| "Reference too long, I'll adapt the pattern" / "参考太长，我会适应模式" | Partial understanding guarantees bugs. Read it completely. / 部分理解保证会产生 bug。完整阅读它。 |
| "I see the problem, let me fix it" / "我看到问题了，让我修复它" | Seeing symptoms ≠ understanding root cause. / 看到症状 ≠ 理解根本原因。 |
| "One more fix attempt" (after 2+ failures) / "再尝试一次修复"（2 次以上失败后） | 3+ failures = architectural problem. Question pattern, don't fix again. / 3 次以上失败 = 架构问题。质疑模式，不要再修复。 |

## Quick Reference / 快速参考

| Phase / 阶段 | Key Activities / 关键活动 | Success Criteria / 成功标准 |
|-------|---------------|------------------|
| **1. Root Cause / 根本原因** | Read errors, reproduce, check changes, gather evidence / 阅读错误、复现、检查更改、收集证据 | Understand WHAT and WHY / 理解什么和为什么 |
| **2. Pattern / 模式** | Find working examples, compare / 找到工作示例、比较 | Identify differences / 识别差异 |
| **3. Hypothesis / 假设** | Form theory, test minimally / 形成理论、最小化测试 | Confirmed or new hypothesis / 确认或新假设 |
| **4. Implementation / 实施** | Create test, fix, verify / 创建测试、修复、验证 | Bug resolved, tests pass / Bug 解决，测试通过 |

## When Process Reveals "No Root Cause" / 当流程揭示"无根本原因"时

If systematic investigation reveals issue is truly environmental, timing-dependent, or external:
如果系统调查表明问题确实是环境性的、时间依赖性的或外部的：

1. You've completed the process
   你已经完成了流程
2. Document what you investigated
   记录你调查的内容
3. Implement appropriate handling (retry, timeout, error message)
   实现适当的处理（重试、超时、错误消息）
4. Add monitoring/logging for future investigation
   添加监控/日志以供将来调查

**But:** 95% of "no root cause" cases are incomplete investigation.
**但是：** 95% 的"无根本原因"案例是不完整的调查。

## Supporting Techniques / 支持技术

These techniques are part of systematic debugging and available in this directory:
这些技术是系统化调试的一部分，在此目录中可用：

- **`root-cause-tracing.md`** - Trace bugs backward through call stack to find original trigger
  通过调用堆栈向后追踪 bug 以找到原始触发器
- **`defense-in-depth.md`** - Add validation at multiple layers after finding root cause
  在找到根本原因后在多个层添加验证
- **`condition-based-waiting.md`** - Replace arbitrary timeouts with condition polling
  用条件轮询替换任意超时

**Related skills:**
**相关技能：**
- **superpowers:test-driven-development** - For creating failing test case (Phase 4, Step 1)
  用于创建失败的测试用例（第 4 阶段，第 1 步）
- **superpowers:verification-before-completion** - Verify fix worked before claiming success
  在声称成功之前验证修复有效

## Real-World Impact / 实际影响

From debugging sessions:
来自调试会话：
- Systematic approach: 15-30 minutes to fix
- 系统化方法：15-30 分钟修复
- Random fixes approach: 2-3 hours of thrashing
- 随机修复方法：2-3 小时的盲目尝试
- First-time fix rate: 95% vs 40%
- 首次修复成功率：95% vs 40%
- New bugs introduced: Near zero vs common
- 引入的新 bug：接近零 vs 常见
