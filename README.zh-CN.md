# aiyou-team

[aiyou-dev](https://github.com/faugustdev/aiyou-dev) 的 AI agent 团队系统 — 结构化、基于文件的 agent 团队，支持角色专业化、质量门控和 OpenCode 集成。

> Fork 自 [CrewBee](https://github.com/CrewBeeLab/CrewBee)（CrewBeeLab），MIT 许可证。

## 什么是 aiyou-team？

aiyou-team 为 aiyou-dev 和 OpenCode 提供结构化的 agent 团队。每个团队包含：

- **角色专业化的 agent** — 领导者、执行者、研究员、评审者、顾问
- **质量门控** — 诊断、构建、测试通过后才能完成
- **治理规则** — 指令优先级、审批策略、禁止行为
- **基于文件的配置** — `.agent.md` + `team.manifest.yaml` + `team.policy.yaml`

## 快速开始

```bash
# 安装
npm install -g @aiyou-dev/team

# 设置 OpenCode
aiyou-team setup --with-opencode

# 或添加到现有项目
aiyou-team install --source registry
```

## 团队

### 内嵌团队

| 团队 | 描述 |
|------|------|
| `coding-team` | 全生命周期编码团队，包含领导者、执行者、探索者、研究员、评审者和顾问 |

### 基于文件的团队

团队定义在 `~/.config/opencode/teams/`：

```
teams/
├── coding-team/
│   ├── team.manifest.yaml
│   ├── team.policy.yaml
│   └── agents/
│       ├── coding-leader.agent.md
│       ├── coding-executor.agent.md
│       └── ...
└── general-team/
    └── ...
```

## 架构

```
aiyou-team/
├── src/
│   ├── agent-teams/          # 团队加载、解析、验证
│   │   ├── embedded/         # 内置团队 (coding-team)
│   │   └── filesystem/       # 基于文件的团队加载
│   ├── adapters/opencode/    # OpenCode 集成
│   ├── loader/               # .agent.md 解析器
│   ├── render/               # 提示词渲染
│   └── runtime/              # 运行时投影
├── templates/                # 团队模板
└── bin/                      # CLI 入口点
```

## Agent 格式

每个 agent 是一个 `.agent.md` 文件，包含 YAML frontmatter + markdown 正文：

```markdown
---
id: my-agent
name: My Agent
archetype: executor
tags: ["coding", "executor"]
---

## persona_core
...

## responsibility_core
...

## collaboration
...
```

## 团队清单

```yaml
id: my-team
version: 1.0.0
name: My Team
description: A team for...

mission:
  objective: ...
  success_definition:
    - ...

scope:
  in_scope: [...]
  out_of_scope: [...]

leader:
  agent_ref: my-leader
  responsibilities: [...]

workflow:
  stages:
    - intake
    - execute
    - verify
    - closeout

governance:
  instruction_precedence: [...]
  approval_policy: {...}
  forbidden_actions: [...]
  quality_floor: {...}
  working_rules: [...]
```

## 配置

团队配置在 `crewbee.json`（或 `aiyou-team.json`）：

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true },
    { "id": "my-custom-team", "path": "./teams/my-team" }
  ]
}
```

## 许可证

MIT — 详见 [LICENSE](LICENSE)

## 致谢

基于 [CrewBee](https://github.com/CrewBeeLab/CrewBee)（CrewBeeLab）。
