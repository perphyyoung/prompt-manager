# Subagent Driven

## 触发条件

- 任务可做模块切分或文件级 ownership 切分
- 存在可并行的非阻塞工作流
- 任务涉及多文件、真实集成、测试补齐、根因分析、验证工件或文档同步

## 例外

- 单文件微调
- 下一步完全阻塞于某个未完成子任务
- 写集合无法隔离

## 规则

- 默认先做 decomposition，再决定 subagent 拆分
- 只要可拆分，至少派出 `1` 个 subagent；中等及以上任务默认 `2-3` 个
- 每个 subagent 只接一个明确目标，并绑定 ownership
- subagent prompt 至少包含：目标、ownership、交付物、验证要求、不得回退他人改动
- 主 Agent 负责 orchestration、integration、回归和最终验收

## 调度

- 优先委派适配器、测试、验证、排障、文档、可观测性等 side tasks
- 主 Agent 保持 critical path，负责接口契约和主线集成
- 派出后继续本地推进，只有在被结果阻塞时才 `wait_agent`

## 交付要求

- subagent 返回变更范围、验证结果、残留风险
- 主 Agent 复核 ownership 边界、关键行为和集成结果
