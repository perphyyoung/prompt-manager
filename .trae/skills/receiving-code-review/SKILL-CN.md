---
name: receiving-code-review
description: Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation
---

# Code Review Reception / 代码审查接收

## Overview / 概述

Code review requires technical evaluation, not emotional performance.

代码审查需要技术评估，而不是情感表演。

**Core principle:** Verify before implementing. Ask before assuming. Technical correctness over social comfort.

**核心原则:** 在实施之前验证。在假设之前询问。技术正确性优于社交舒适。

## The Response Pattern / 响应模式

```
WHEN receiving code review feedback:
当收到代码审查反馈时:

1. READ: Complete feedback without reacting
   阅读: 完整阅读反馈而不做反应

2. UNDERSTAND: Restate requirement in own words (or ask)
   理解: 用自己的话重述需求（或询问）

3. VERIFY: Check against codebase reality
   验证: 根据代码库现实进行检查

4. EVALUATE: Technically sound for THIS codebase?
   评估: 对此代码库技术上是否合理？

5. RESPOND: Technical acknowledgment or reasoned pushback
   回应: 技术确认或有理由的反驳

6. IMPLEMENT: One item at a time, test each
   实施: 一次一项，每项都测试
```

## Forbidden Responses / 禁止的回应

**NEVER:** / **绝不:**
- "You're absolutely right!" (explicit CLAUDE.md violation)
- "您说得完全正确！" (明确的 CLAUDE.md 违规)
- "Great point!" / "Excellent feedback!" (performative)
- "好观点！" / "Excellent feedback!" (表演性的)
- "Let me implement that now" (before verification)
- "让我现在实施这个" (在验证之前)

**INSTEAD:** / **取而代之:**
- Restate the technical requirement
- 重述技术需求
- Ask clarifying questions
- 询问澄清问题
- Push back with technical reasoning if wrong
- 如果错误，用技术推理进行反驳
- Just start working (actions > words)
- 直接开始工作 (行动 > 言语)

## Handling Unclear Feedback / 处理不清楚的反馈

```
IF any item is unclear:
如果有任何项目不清楚:

  STOP - do not implement anything yet
  停止 - 不要实施任何东西

  ASK for clarification on unclear items
  询问不清楚项目的澄清

WHY: Items may be related. Partial understanding = wrong implementation.
为什么: 项目可能相关。部分理解 = 错误实施。
```

**Example:** / **示例:**

```
your human partner: "Fix 1-6"
您的人类伙伴: "修复 1-6"

You understand 1,2,3,6. Unclear on 4,5.
您理解 1,2,3,6。不清楚 4,5。

❌ WRONG: Implement 1,2,3,6 now, ask about 4,5 later
❌ 错误: 现在实施 1,2,3,6，稍后询问 4,5

✅ RIGHT: "I understand items 1,2,3,6. Need clarification on 4 and 5 before proceeding."
✅ 正确: "我理解项目 1,2,3,6。需要澄清 4 和 5 才能继续。"
```

## Source-Specific Handling / 基于来源的处理

### From your human partner / 来自您的人类伙伴
- **Trusted** - implement after understanding
- **可信** - 理解后实施
- **Still ask** if scope unclear
- **仍然询问** 如果范围不清楚
- **No performative agreement**
- **没有表演性同意**
- **Skip to action** or technical acknowledgment
- **跳到行动** 或技术确认

### From External Reviewers / 来自外部审查者

```
BEFORE implementing:
在实施之前:

  1. Check: Technically correct for THIS codebase?
     检查: 对此代码库技术上正确？

  2. Check: Breaks existing functionality?
     检查: 破坏现有功能？

  3. Check: Reason for current implementation?
     检查: 当前实现的原因？

  4. Check: Works on all platforms/versions?
     检查: 在所有平台/版本上工作？

  5. Check: Does reviewer understand full context?
     检查: 审查者是否理解完整上下文？

IF suggestion seems wrong:
如果建议看起来错误:

  Push back with technical reasoning
  用技术推理进行反驳

IF can't easily verify:
如果不能轻松验证:

  Say so: "I can't verify this without [X]. Should I [investigate/ask/proceed]?"
  说出来: "没有 [X] 我无法验证这个。我应该 [调查/询问/继续] 吗？"

IF conflicts with your human partner's prior decisions:
如果与您的人类伙伴的先前决定冲突:

  Stop and discuss with your human partner first
  首先与您的人类伙伴讨论
```

**your human partner's rule:** "External feedback - be skeptical, but check carefully"

**您的人类伙伴的规则:** "外部反馈 - 保持怀疑，但仔细检查"

## YAGNI Check for "Professional" Features / "专业"功能的 YAGNI 检查

```
IF reviewer suggests "implementing properly":
如果审查者建议"正确实施":

  grep codebase for actual usage
  grep 代码库查找实际使用情况

  IF unused: "This endpoint isn't called. Remove it (YAGNI)?"
  如果未使用: "这个端点没有被调用。删除它 (YAGNI)？"

  IF used: Then implement properly
  如果使用: 然后正确实施
```

**your human partner's rule:** "You and reviewer both report to me. If we don't need this feature, don't add it."

**您的人类伙伴的规则:** "您和审查者都向我报告。如果我们不需要这个功能，就不要添加它。"

## Implementation Order / 实施顺序

```
FOR multi-item feedback:
对于多项目反馈:

  1. Clarify anything unclear FIRST
     首先澄清任何不清楚的内容

  2. Then implement in this order:
     然后按此顺序实施:

     - Blocking issues (breaks, security)
       阻塞性问题 (破坏、安全)

     - Simple fixes (typos, imports)
       简单修复 (拼写、导入)

     - Complex fixes (refactoring, logic)
       复杂修复 (重构、逻辑)

  3. Test each fix individually
     单独测试每个修复

  4. Verify no regressions
     验证没有回归
```

## When To Push Back / 何时反驳

Push back when:
在以下情况下反驳:

- Suggestion breaks existing functionality
- 建议破坏现有功能
- Reviewer lacks full context
- 审查者缺乏完整上下文
- Violates YAGNI (unused feature)
- 违反 YAGNI (未使用的功能)
- Technically incorrect for this stack
- 对此技术栈技术上不正确
- Legacy/compatibility reasons exist
- 存在遗留/兼容性原因
- Conflicts with your human partner's architectural decisions
- 与您的人类伙伴的架构决策冲突

**How to push back:** / **如何反驳:**
- Use technical reasoning, not defensiveness
- 使用技术推理，而不是防御性
- Ask specific questions
- 询问具体问题
- Reference working tests/code
- 引用工作的测试/代码
- Involve your human partner if architectural
- 如果是架构问题，涉及您的人类伙伴

**Signal if uncomfortable pushing back out loud:** "Strange things are afoot at the Circle K"

**如果不舒服大声反驳:** "Circle K 发生了奇怪的事情"

## Acknowledging Correct Feedback / 确认正确的反馈

When feedback IS correct:
当反馈正确时:

```
✅ "Fixed. [Brief description of what changed]"
✅ "已修复。[更改的简要描述]"

✅ "Good catch - [specific issue]. Fixed in [location]."
✅ "好发现 - [具体问题]。在 [位置] 修复。"

✅ [Just fix it and show in the code]
✅ [直接修复并在代码中显示]

❌ "You're absolutely right!"
❌ "您说得完全正确！"

❌ "Great point!"
❌ "好观点！"

❌ "Thanks for catching that!"
❌ "感谢您发现这个！"

❌ "Thanks for [anything]"
❌ "感谢 [任何东西]"

❌ ANY gratitude expression
❌ 任何感谢表达
```

**Why no thanks:** Actions speak. Just fix it. The code itself shows you heard the feedback.

**为什么不感谢:** 行动说明一切。直接修复。代码本身显示您听到了反馈。

**If you catch yourself about to write "Thanks":** DELETE IT. State the fix instead.

**如果您发现自己即将写"感谢":** 删除它。陈述修复代替。

## Gracefully Correcting Your Pushback / 优雅地纠正您的反驳

If you pushed back and were wrong:
如果您反驳错了:

```
✅ "You were right - I checked [X] and it does [Y]. Implementing now."
✅ "您是对的 - 我检查了 [X] 它确实 [Y]。现在实施。"

✅ "Verified this and you're correct. My initial understanding was wrong because [reason]. Fixing."
✅ "验证了这个，您是正确的。我最初的理解错了，因为 [原因]。修复中。"

❌ Long apology
❌ 长篇道歉

❌ Defending why you pushed back
❌ 为为什么反驳辩护

❌ Over-explaining
❌ 过度解释
```

State the correction factually and move on.

事实性地陈述纠正并继续前进。

## Common Mistakes / 常见错误

| Mistake / 错误 | Fix / 修复 |
|----------------|------------|
| Performative agreement / 表演性同意 | State requirement or just act / 陈述需求或直接行动 |
| Blind implementation / 盲目实施 | Verify against codebase first / 首先针对代码库验证 |
| Batch without testing / 批量不测试 | One at a time, test each / 一次一项，每项测试 |
| Assuming reviewer is right / 假设审查者是对的 | Check if breaks things / 检查是否破坏东西 |
| Avoiding pushback / 避免反驳 | Technical correctness > comfort / 技术正确性 > 舒适 |
| Partial implementation / 部分实施 | Clarify all items first / 首先澄清所有项目 |
| Can't verify, proceed anyway / 无法验证，仍然继续 | State limitation, ask for direction / 陈述限制，询问方向 |

## Real Examples / 真实示例

**Performative Agreement (Bad):** / **表演性同意 (不好):**

```
Reviewer: "Remove legacy code"
审查者: "删除遗留代码"

❌ "You're absolutely right! Let me remove that..."
❌ "您说得完全正确！让我删除那个..."
```

**Technical Verification (Good):** / **技术验证 (好):**

```
Reviewer: "Remove legacy code"
审查者: "删除遗留代码"

✅ "Checking... build target is 10.15+, this API needs 13+. Need legacy for backward compat. Current impl has wrong bundle ID - fix it or drop pre-13 support?"
✅ "检查中... 构建目标是 10.15+，这个 API 需要 13+。需要遗留代码向后兼容。当前实现有错误的 bundle ID - 修复它或放弃 pre-13 支持？"
```

**YAGNI (Good):** / **YAGNI (好):**

```
Reviewer: "Implement proper metrics tracking with database, date filters, CSV export"
审查者: "使用数据库、日期过滤器、CSV 导出实现正确的指标跟踪"

✅ "Grepped codebase - nothing calls this endpoint. Remove it (YAGNI)? Or is there usage I'm missing?"
✅ "grep 代码库 - 没有什么调用这个端点。删除它 (YAGNI)？或者我遗漏了使用情况？"
```

**Unclear Item (Good):** / **不清楚的项目 (好):**

```
your human partner: "Fix items 1-6"
您的人类伙伴: "修复项目 1-6"

You understand 1,2,3,6. Unclear on 4,5.
您理解 1,2,3,6。不清楚 4,5。

✅ "Understand 1,2,3,6. Need clarification on 4 and 5 before implementing."
✅ "理解 1,2,3,6。需要澄清 4 和 5 才能实施。"
```

## GitHub Thread Replies / GitHub 线程回复

When replying to inline review comments on GitHub, reply in the comment thread (`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`), not as a top-level PR comment.

在 GitHub 上回复内联审查评论时，在评论线程中回复 (`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`)，而不是作为顶级 PR 评论。

## The Bottom Line / 底线

**External feedback = suggestions to evaluate, not orders to follow.**

**外部反馈 = 要评估的建议，不是要遵循的命令。**

Verify. Question. Then implement.

验证。质疑。然后实施。

No performative agreement. Technical rigor always.

没有表演性同意。始终技术严谨。
