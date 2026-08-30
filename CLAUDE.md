# CLAUDE.md

行为准则，用于减少常见的 LLM 编码错误。根据需要与项目特定说明合并。

**权衡：** 这些准则倾向于谨慎而非速度。对于琐碎任务，请自行判断。

## 指令优先级(从高到低)

- 用户指令
- 本文件 (CLAUDE.md)
- AGENTS.md
- .trae/rules/项目规则.md
- 默认系统提示

## mcp 工具

- 代码搜索使用 rg, 而不是 grep
- 语义搜索优先使用 gitnexus，参数添加 `"repo": "prompt-manager"` 指定当前仓库

## 教训

- 会话开始前, 阅读 `lessons.md`, 确保不会再犯
- 我要求纠正, 或者其他你觉得必要的情况, 添加一条规则到 `lessons.md`, 说明为什么出错, 如何避免再犯
- 规则为一条无序列表, 简洁描述, 要有通用性
- 追加而非重写

## 禁止行为

- 禁止为了静默失败而添加的可选链
- 禁止开场白和结尾, 输出简洁但推理充分, 砍掉一切不改变决策的信息
- 禁止不使用 gitnexus 就直接修改代码, 禁止猜测给出结论
- 禁止直接重写整个文件, 优先编辑
- 禁止以下替换方式(允许使用 TypeScript 脚本进行替换)：
  - PowerShell 命令替换（如 `(Get-Content file) -replace 'old', 'new' | Set-Content file`）
  - 任何命令行文本替换工具（如 sed、awk、perl 等）
  - 正则表达式批量替换整个文件
- 禁止直接删除日志生成语句, 需要我确认

## 原则

- 修改代码时，必须参考 `代码目录结构说明.md`，并及时更新该文件
- 如果有多个方案可选, 给出方案的比较
- 每次修改代码后(包括实际代码和测试代码), 使用 `pnpm check` 验证
- 使用中文回答
- 改代码前，先简述计划与影响范围; 如果有类似的功能已实现, 给出复用代码的利弊分析
- 给出的方案中, 需要遵循 `.trae/rules/具体规范.md` 要求
- 启动应用、安装依赖时提示我来操作, 而不是启动 `pnpm start`
- 易错点记录到 `docs/易错点.md`, 以备查阅
- 测试过程如果发现是实现的问题, 询问是否需要修改实现
- 删除文件改用移动代替, mv 到 `bak/`
- e2e 测试写入 `e2e/`, 单元测试写入 `tests/`
- 如果需要运行 e2e 测试，最多运行3个相关测试文件，不需要全部运行

## 建议

- 按照大型项目来设计和重构
- 只要可拆分，先派出 subagent; 中等及以上任务默认并行 `2-3` 个 subagent
- 删除时, 一次删除不要超过 100 行, 分次删除; 已删除方法的注释也删除
- 抽象方法使用 `abstract` 声明, 而不是抛出实现错误
- 默认终端为 powershell, 不要使用 `&&`

## 编码前先思考

**不要假设。不要隐藏困惑。提出权衡。**

实施前：

- 明确说明你的假设。如果不确定，请询问。
- 如果存在多种解释，请提出它们——不要默默选择。
- 如果存在更简单的方法，请说出来。必要时提出反对意见。
- 如果有不清楚的地方，停下来。指出困惑之处。询问。

## 简单优先

**解决问题的最少代码。不要推测。**

- 不要添加未要求的功能。
- 不要为一次性代码创建抽象。
- 不要添加未要求的"灵活性"或"可配置性"。
- 不要为不可能的场景添加错误处理。
- 如果你写了 200 行代码而其实可以只用 50 行，请重写。

问自己："资深工程师会说这过于复杂吗？"如果是，请简化。

## 精准修改

**只接触必须修改的部分。只清理自己造成的混乱。**

编辑现有代码时：

- 不要"改进"相邻的代码、注释或格式。
- 不要重构没有问题的代码。
- 遵循现有风格，即使你会用不同的方式。
- 如果你注意到无关的死代码，请提及——但不要删除它。

当你的更改产生孤立代码时：

- 删除因你的更改而变得未使用的导入/变量/函数。
- 除非被要求，否则不要删除预先存在的死代码。

测试标准：每一行更改都应该直接追溯到用户的请求。

## 目标驱动执行

**定义成功标准。循环直到验证通过。**

将任务转化为可验证的目标：

- "添加验证" → "为无效输入编写测试，然后让它们通过"
- "修复 bug" → "编写能重现问题的测试，然后让它通过"
- "重构 X" → "确保测试在重构前后都能通过"

对于多步骤任务，简要说明计划：

```
1. [步骤] → 验证：[检查]
2. [步骤] → 验证：[检查]
```

强有力的成功标准让你能够独立循环。弱标准（"让它工作"）需要不断的澄清。

---

**这些准则有效的情况是：** diff 中不必要更改更少，因过度复杂而重写的次数更少，澄清问题出现在实施前而非犯错后。

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->