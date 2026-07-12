# aiyou-team

AI agent teams for [aiyou-dev](https://github.com/faugustdev/aiyou-dev) — structured, file-based agent teams with role specialization, quality gates, and OpenCode integration.

> Fork of [CrewBee](https://github.com/CrewBeeLab/CrewBee) by CrewBeeLab, licensed under MIT.

## What is aiyou-team?

aiyou-team provides structured agent teams that work with aiyou-dev and OpenCode. Each team has:

- **Role-specialized agents** — leaders, executors, researchers, reviewers, advisors
- **Quality gates** — diagnostics, build, tests required before completion
- **Governance rules** — instruction precedence, approval policies, forbidden actions
- **File-based configuration** — `.agent.md` + `team.manifest.yaml` + `team.policy.yaml`

## Quick Start

### Via aiyoucli (recommended)

```bash
# Initialize with OpenCode + agent teams
aiyoucli init --tool opencode

# This will:
#   1. Generate opencode.json with aiyou-team plugin
#   2. Install @aiyou-dev/team globally (if not present)
#   3. Run aiyou-team setup to configure teams
```

### Standalone

```bash
# Install
npm install -g @aiyou-dev/team

# Setup with OpenCode
aiyou-team setup --with-opencode

# Or add to existing project
aiyou-team install --source registry
```

## Teams

### Embedded Teams

| Team | Description |
|------|-------------|
| `coding-team` | Full-lifecycle coding team with leader, executor, explorer, researcher, reviewer, and advisor |

### File-Based Teams

Teams are defined in `~/.config/opencode/teams/`:

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

## Architecture

```
aiyou-team/
├── src/
│   ├── agent-teams/          # Team loading, parsing, validation
│   │   ├── embedded/         # Built-in teams (coding-team)
│   │   └── filesystem/       # File-based team loading
│   ├── adapters/opencode/    # OpenCode integration
│   ├── loader/               # .agent.md parser
│   ├── render/               # Prompt rendering
│   └── runtime/              # Runtime projection
├── templates/                # Team templates
└── bin/                      # CLI entry points
```

## Agent Format

Each agent is a `.agent.md` file with YAML frontmatter + markdown body:

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

## Team Manifest

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

## Configuration

Teams are configured in `aiyou-team.json`:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true },
    { "id": "my-custom-team", "path": "./teams/my-team" }
  ]
}
```

## License

MIT — see [LICENSE](LICENSE)

## Attribution

Based on [CrewBee](https://github.com/CrewBeeLab/CrewBee) by CrewBeeLab.
