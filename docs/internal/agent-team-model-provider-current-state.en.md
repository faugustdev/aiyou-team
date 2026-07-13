Language: English | Español

# aiyou-team Agent Team and Provider/Model Configuration Current State

> Purpose: To provide current engineering facts for designing "default provider/model for the built-in Coding Team and environment adaptation / fallback schemes" in the future. This document only describes the current state and does not propose final implementation solutions.

## 1. Current Configuration System Overview

aiyou-team's current Team configuration chain is:

```text
aiyou-team.json
  -> Team Registration Source
  -> Team Registration
  -> AgentTeamDefinition
  -> TeamLibrary
  -> TeamLibraryProjection
  -> OpenCode Agent Config Patch
  -> OpenCode cfg.agent / cfg.default_agent
```

Core implementation locations:

- `src/agent-teams/filesystem.ts`: Reads global / project-level `aiyou-team.json`, normalizes Team registration entries, loads file-based Teams.
- `src/agent-teams/library.ts`: Loads built-in Teams and file-based Teams, sorts, deduplicates, handles shadowing, validates, and generates `TeamLibrary`.
- `src/runtime/team-library-projection.ts`: Projects `TeamLibrary` into `ProjectedTeam` / `ProjectedAgent`.
- `src/adapters/opencode/projection.ts`: Projects `ProjectedAgent` into OpenCode Agent definitions, including `model`, `temperature`, `top_p`, `variant`.
- `src/adapters/opencode/bootstrap.ts` and `src/adapters/opencode/config-hook.ts`: Generates and writes back `cfg.agent` and default Agent in the OpenCode config hook.

Currently there is no independent model resolver, provider availability detection, fallback chain, or runtime API error fallback. Provider/model primarily comes from the Team manifest's `agent_runtime`.

## 2. Agent Team Configuration Methods

### 2.1 Built-in Team Configuration

Built-in Teams are referenced by `id` in `aiyou-team.json`:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 }
  ]
}
```

Loading logic:

- `src/agent-teams/filesystem.ts` normalizes `{ "id": "coding-team" }` into `ConfiguredEmbeddedTeamSource`.
- `loadEmbeddedTeam()` in `src/agent-teams/library.ts` only recognizes `BUILTIN_CODING_TEAM_ID` and calls `createEmbeddedCodingTeam()`.
- The complete Team manifest, policy, and agent list for the built-in Coding Team are defined in `src/agent-teams/embedded/coding-team.ts` and `src/agent-teams/embedded/coding-team/agents/*`.

When the global config is missing or during install repair, aiyou-team adds the built-in `coding-team` by default:

- `createDefaultConfig()` returns `teams: [{ id: "coding-team", enabled: true, priority: 0 }]` by default.
- The packaged template `templates/aiyou-team.json` also enables `coding-team` by default; other template Teams are disabled by default.
- When the global source config is missing, `listConfiguredTeamSourcesFromDescriptor()` falls back to `createDefaultCodingTeamSource()`.

### 2.2 File-based Teams: Template Directory + YAML/Markdown Configuration

A file-based Team is a directory; currently only root-level files are read:

```text
<TeamDir>/
  team.manifest.yaml
  team.policy.yaml
  <agent-1>.agent.md
  <agent-2>.agent.md
  TEAM.md        # optional
  README.md      # optional
```

Required files:

- `team.manifest.yaml`
- `team.policy.yaml`
- At least one `*.agent.md`

The current implementation does not scan Agent files in subdirectories like `agents/` or `docs/`. The corresponding implementation is `loadTeamDefinitionFromDirectoryWithIssues()`: reads manifest, policy, and enumerates `*.agent.md` in the Team root directory.

File-based Teams are referenced by `path` in `aiyou-team.json`:

```json
{
  "teams": [
    { "path": "@teams/general-team", "enabled": false, "priority": 1 }
  ]
}
```

Bundled templates are located at:

```text
templates/
  aiyou-team.json
  teams/
    general-team/
    template-team/
    wukong-team/
```

During install / repair, template Teams are copied to the `teams/` directory under the OpenCode config root.

### 2.3 `team.manifest.yaml`

`team.manifest.yaml` defines the Team itself:

- `id` / `version` / `name` / `description`
- `mission`
- `scope`
- `leader.agent_ref`
- `members`
- `workflow.stages`
- `governance`
- `agent_runtime`
- `tags`
- `prompt_projection`

The parsing implementation is `mapTeamManifest()` in `src/agent-teams/parsers.ts`. The `agent_runtime` is parsed into `TeamManifest.agentRuntime`.

### 2.4 `team.policy.yaml`

`team.policy.yaml` defines shared Team rules, currently used for Team Contract / prompt projection:

- `instruction_precedence`
- `approval_policy`
- `forbidden_actions`
- `quality_floor`
- `working_rules`
- `prompt_projection`

The parsing implementation is `mapTeamPolicy()` in `src/agent-teams/parsers.ts`.

### 2.5 `*.agent.md`

Agent files use Markdown + frontmatter style definitions. Core fields include:

- metadata: `id`, `kind`, `version`, `name`
- `persona_core`
- `responsibility_core`
- execution semantics: `core_principle`, `scope_control`, `ambiguity_policy`, `support_triggers`, `task_triage`, `delegation_review`, `completion_gate`, `failure_recovery`
- `collaboration`
- `runtime_config`
- `output_contract`
- `entry_point`
- `prompt_projection`

Note: The Agent's own `runtime_config` manages tools, permissions, skills, instructions, MCP, memory, hooks, and other runtime capabilities; it does not include provider/model. Provider/model is configured centrally in the Team manifest's `agent_runtime`.

## 3. Global Config, Project Config, and Different Teams for Different Projects

### 3.1 Configuration File Locations

aiyou-team currently supports two isomorphic configuration sources:

| Scope | Config File | Path Resolution Base | Source Precedence |
| --- | --- | --- | --- |
| global | `<OpenCodeConfigRoot>/aiyou-team.json` | OpenCode config root | Low |
| project | `<project-worktree>/.aiyou-team/aiyou-team.json` | `<project-worktree>/.aiyou-team` | High |

Common global paths:

```text
~/.config/opencode/aiyou-team.json
```

Common Windows paths:

```text
C:\Users\<user>\.config\opencode\aiyou-team.json
```

Project-level paths:

```text
<project-worktree>/.aiyou-team/aiyou-team.json
```

### 3.2 Current `aiyou-team.json` Schema

The currently valid Team entry fields in `aiyou-team.json` are only:

| Field | Description |
| --- | --- |
| `id` | References a built-in Team, e.g. `coding-team` |
| `path` | References a file-based Team directory |
| `enabled` | Whether enabled, defaults to `true` |
| `priority` | Sort value within the same source; lower numbers = higher priority |

Constraint: An entry can only have `id` or `path`, not both.

Currently `aiyou-team.json` does not support provider/model override, Team override, Agent override, extends, include, or per-agent runtime patch.

### 3.3 Path Resolution Rules

`path` supports:

```json
{ "path": "@teams/ProjectCodingTeam" }
{ "path": "teams/ProjectCodingTeam" }
{ "path": "~/aiyouTeams/ProjectCodingTeam" }
{ "path": "E:/aiyouTeams/ProjectCodingTeam" }
```

Rules:

- `@teams/xxx`: After removing `@`, resolved relative to the directory containing the current `aiyou-team.json`.
- `teams/xxx`: Resolved relative to the directory containing the current `aiyou-team.json`.
- `~/xxx`: Resolved relative to the user's home directory.
- Absolute paths: Used as-is.

Therefore, the same `@teams/foo` resolves to different directories in global vs. project config:

```text
global  @teams/foo -> <OpenCodeConfigRoot>/teams/foo
project @teams/foo -> <project-worktree>/.aiyou-team/teams/foo
```

### 3.4 Different Teams for Different Projects

Different projects configure different Teams via their respective worktree's `.aiyou-team/aiyou-team.json`. For example:

```json
{
  "teams": [
    { "path": "@teams/project-coding-team", "enabled": true, "priority": 0 },
    { "id": "coding-team", "enabled": true, "priority": 1 }
  ]
}
```

Corresponding directory structure:

```text
<project-worktree>/
  .aiyou-team/
    aiyou-team.json
    teams/
      project-coding-team/
        team.manifest.yaml
        team.policy.yaml
        project-leader.agent.md
```

Loading sort rules:

1. Project source takes precedence over global source.
2. Within the same source, sorted by `priority` from low to high.
3. Within the same source with the same priority, sorted by declaration order in `aiyou-team.json`.

When Team IDs conflict, the first-loaded Team wins. A typical scenario: when a project-level Team uses the same manifest ID as a global Team, it shadows the global Team. The implementation is in the `usedTeamIds` logic in `src/agent-teams/library.ts`.

## 4. Where Provider/Model Is Currently Configured

### 4.1 Type Definitions

The core type for provider/model is `AgentRuntimeModelConfig`:

```ts
export interface AgentRuntimeModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  topP?: number;
  variant?: string;
  options?: Record<string, unknown>;
}
```

It is attached to `TeamManifest.agentRuntime?: Record<string, AgentRuntimeModelConfig>`.

### 4.2 File-based Team Configuration Fields

File-based Teams configure `agent_runtime` in `team.manifest.yaml`:

```yaml
agent_runtime:
  leader:
    provider: openai
    model: gpt-5.5
    temperature: 0.25
    top_p: 0.9
    variant: generalist-orchestrator
    options:
      reasoning_effort: high
```

Parsing rules:

- `provider` is required.
- `model` is required.
- `temperature` is optional, converted directly with `Number(...)`.
- `top_p` or `topP` is optional, mapped to `topP`.
- `variant` is optional.
- `options` is optional, shallow-copied as an object.

Implementation: `mapAgentRuntime()` in `src/agent-teams/parsers.ts`.

Validation rules: Currently only validates whether `agent_runtime` keys point to existing Agents within the Team; generates a warning if not found. Does not currently validate whether the provider/model exists, is connectable, or whether parameters are supported by the provider.

### 4.3 Built-in Coding Team Provider/Model Configuration Location

The built-in Coding Team's provider/model is directly hardcoded in:

```text
src/agent-teams/embedded/coding-team.ts
```

Currently located in `createEmbeddedCodingTeam()`'s `manifest.agentRuntime`:

```ts
agentRuntime: {
  "coding-leader": { provider: "openai", model: "gpt-5.5", temperature: 0.2, topP: 0.85, variant: "long-context" },
  "coordination-leader": { provider: "openai", model: "gpt-5.5", temperature: 0.15, topP: 0.75 },
  "coding-executor": { provider: "openai", model: "gpt-5.5", temperature: 0.25, topP: 0.9 },
  "codebase-explorer": { provider: "openai", model: "gpt-5.5", temperature: 0.1, topP: 0.8 },
  "web-researcher": { provider: "openai", model: "gpt-5.5", temperature: 0.2, topP: 0.85 },
  reviewer: { provider: "openai", model: "gpt-5.5", temperature: 0.15, topP: 0.75 },
  "principal-advisor": { provider: "openai", model: "gpt-5.5", temperature: 0.15, topP: 0.75 },
  "multimodal-looker": { provider: "openai", model: "gpt-5.5", temperature: 0.2, topP: 0.85 },
}
```

This means the built-in Coding Team currently has a hard dependency on `openai/gpt-5.5` via projection: whenever the built-in `coding-team` is enabled, these model fields are written into the OpenCode agent config.

### 4.4 Other Template Team Provider/Model Configuration

Bundled template Teams also configure provider/model in their respective `team.manifest.yaml`'s `agent_runtime`. For example:

- `templates/teams/general-team/team.manifest.yaml`
- `templates/teams/template-team/team.manifest.yaml`

They currently also default to `provider: openai`, `model: gpt-5.5`.

## 5. How Provider/Model Projects to OpenCode

### 5.1 Impact of Agent ID Normalization on `agent_runtime`

After Team loading, `normalizeTeamAgentIds()` is executed. It normalizes Agent source IDs to canonical IDs and synchronously rewrites:

- `manifest.leader.agentRef`
- `manifest.members`
- `manifest.agentRuntime`
- Agent metadata / collaboration refs

Therefore, the projection stage uses canonical agent IDs:

```ts
const runtimeOverride = agent.sourceTeam.manifest.agentRuntime?.[agent.canonicalAgentId];
```

For the built-in `coding-team`, IDs like `coding-leader` already match the canonical result and remain unchanged. For file-based Teams, if the Team ID prefix is added to Agent IDs, `agent_runtime` keys are also rewritten accordingly.

### 5.2 resolvedModel in OpenCode Agent Config

`createOpenCodeAgentConfig()` in `src/adapters/opencode/projection.ts` reads:

```ts
agent.sourceTeam.manifest.agentRuntime?.[agent.canonicalAgentId]
```

If a runtime override exists, it generates:

```ts
resolvedModel: {
  providerID: runtimeOverride.provider,
  modelID: runtimeOverride.model,
  temperature: runtimeOverride.temperature,
  topP: runtimeOverride.topP,
  variant: runtimeOverride.variant,
  options: runtimeOverride.options,
  source: "team-manifest",
}
```

If no override exists, `resolvedModel` is not generated.

### 5.3 Writing to OpenCode Agent Definition

`createOpenCodeAgentDefinition()` writes `resolvedModel` as OpenCode agent definition fields:

```ts
model: agent.resolvedModel
  ? `${agent.resolvedModel.providerID}/${agent.resolvedModel.modelID}`
  : undefined,
temperature: agent.resolvedModel?.temperature,
top_p: agent.resolvedModel?.topP,
variant: agent.resolvedModel?.variant,
options: createManagedAgentOptions({
  teamId: agent.teamId,
  canonicalAgentId: agent.canonicalAgentId,
  existingOptions: agent.resolvedModel?.options,
}),
```

Important current behavior:

- If `agent_runtime` exists, the OpenCode agent definition always writes `model: "provider/model"`.
- If `agent_runtime` does not exist, `model`, `temperature`, `top_p`, and `variant` are all `undefined`, and OpenCode uses the host default model.
- aiyou-team currently does not check whether the provider/model is available in the user's OpenCode environment.

- aiyou-team currently does not dynamically rewrite Team models based on the user's currently UI-selected model or default model in OpenCode.

### 5.4 Config Hook Writing Back to OpenCode

OpenCode config hook chain:

```text
createConfigHook()
  -> createOpenCodeBootstrap()
  -> createOpenCodeAgentConfigs()
  -> createOpenCodeAgentConfigPatch()
  -> applyOpenCodeAgentConfigPatch()
  -> cfg.agent = merged agents
  -> current.default_agent = merged default_agent
```

`applyOpenCodeAgentConfigPatch()` will:

- Remove keys from old aiyou-team managed agents that no longer exist.
- Insert new aiyou-team agents.
- Update existing aiyou-team managed agents.
- Skip when encountering external agents with the same name, to avoid overwriting non-aiyou-team agents.

The default Agent is selected by `bootstrap.ts`: prioritizes the selected host agent / explicit selected team-agent; otherwise selects the user-selectable leader of the default Team based on TeamLibrary sort order.

## 6. How Users Can Currently Influence the Built-in Coding Team's Provider/Model

Users can indirectly influence it, but there is no direct override mechanism.

### 6.1 Viable Approach A: Disable the Built-in Coding Team and Use a File-based Alternative

Users can enable their own file-based Team in the project's `.aiyou-team/aiyou-team.json` or global `aiyou-team.json` with higher priority. However, if the built-in `coding-team` is still enabled, it will still be projected, though the default entry point may not be it.

Project example:

```json
{
  "teams": [
    { "path": "@teams/project-coding-team", "enabled": true, "priority": 0 },
    { "id": "coding-team", "enabled": false, "priority": 1 }
  ]
}
```

Limitation: This is not "configuring the built-in Coding Team's provider/model" but replacing it with a different file-based Team. Users need to copy / maintain the entire Team definition.

### 6.2 Viable Approach B: Project Team Shadows a Global Team with the Same Name

A project-level file-based Team can use manifest ID `coding-team` to shadow the global / built-in `coding-team`. During loading, project source has higher precedence, and the globally loaded Team with the same ID is skipped.

Project example:

```json
{
  "teams": [
    { "path": "@teams/coding-team", "enabled": true, "priority": 0 }
  ]
}
```

Where:

```text
<project-worktree>/.aiyou-team/teams/coding-team/team.manifest.yaml
```

has its `id` set to:

```yaml
id: coding-team
```

Limitation: Still requires copying all manifest, policy, and agent files from the built-in Coding Team; not a lightweight override.

### 6.3 Currently Not Supported: Overriding Built-in Coding Team Model in `aiyou-team.json`

The current `aiyou-team.json` entry schema does not support:

```json
{
  "id": "coding-team",
  "agent_runtime": {
    "coding-leader": { "provider": "anthropic", "model": "claude-sonnet" }
  }
}
```

Nor does it support:

```json
{
  "models": { ... },
  "teams": { ... }
}
```

These fields would be ignored by the current loader or treated as unknown configuration and would not enter `AgentTeamDefinition`.

## 7. Current Constraints Relevant to Fallback Scheme Design

### 7.1 Provider/Model Is Currently a Static Field in the Team Manifest

The current design treats provider/model as part of the Team definition, not as an independent user environment adaptation layer. In implementation, `OpenCodeResolvedModelConfig.source` is only `"team-manifest"`.

If fallback needs to be supported in the future, a decision must be made about which layer to insert the resolver into:

```text
Team manifest agentRuntime
  -> model resolver / override / fallback
  -> OpenCodeResolvedModelConfig
  -> OpenCode Agent Definition
```

### 7.2 Omitting the Model Field Falls Back to Host Default

The current projection code already naturally supports "not writing model when there is no resolvedModel". This provides a low-invasion implementation point for Host Default fallback: as long as the resolver returns `undefined` when it cannot confirm an available model, the OpenCode agent definition will not include a `model` field.

### 7.3 Built-in Coding Team Currently Cannot Be Lightly Configured

The built-in Coding Team's `agentRuntime` is hardcoded directly in TypeScript. Users cannot patch individual Agent models of the built-in Team through `aiyou-team.json`; they can only replace the entire Team or disable it.

This is exactly the key point that future feature design needs to address: allowing users to configure the built-in `coding-team`'s provider/model while avoiding turning the built-in recommended models into hard dependencies.

### 7.4 No Provider Availability Source Currently Exists

The current code does not read the OpenCode provider/model registry, user authentication state, environment variables, or models.dev metadata. There is also no doctor output for "model resolution path".

If "environment resolution" is needed for future fallback schemes, new availability sources must be added or a conservative strategy adopted: when availability cannot be confirmed, omit the model and delegate to Host Default.

### 7.5 Parameters Currently Are Not Capability-Normalized

`temperature`, `top_p`, `variant`, and `options` are currently projected as-is from the Team manifest. There is no logic to remove unsupported fields based on provider/model capabilities.

If cross-provider fallback is introduced later, parameter compatibility must be considered: for example, some providers do not support `variant`, and some models do not support specific `options.reasoning_effort`.

## 8. Minimal Insertion Points Available for Future Design

Based on the current state, the following insertion points can be considered for the future provider/model default and adaptation features:

1. **Configuration schema layer**: Extend `aiyou-team.json` to support global / project-level model configuration, Team override, Agent override.
2. **Team loading layer**: After `loadDefaultTeamLibrary()` or loading built-in Teams, apply override patches to `manifest.agentRuntime`.
3. **Projection layer**: In `createOpenCodeAgentConfig()`, pass `runtimeOverride` to the model resolver, outputting `resolvedModel | undefined`.
4. **Doctor / diagnostics layer**: Extend `doctor` and config hook logs to output each Agent's expected profile, actual model, and fallback/host-default reason.

The Projection layer is closest to the "whether to write to the OpenCode model field" decision; the configuration schema layer is closest to the "how users can override the built-in Coding Team" need.

## 9. Key File Index

| Topic | File |
| --- | --- |
| Built-in Coding Team manifest / agentRuntime | `src/agent-teams/embedded/coding-team.ts` |
| Built-in Coding Team agents | `src/agent-teams/embedded/coding-team/agents/*` |
| Team / Agent core types | `src/core/index.ts` |
| `aiyou-team.json` reading and Team source normalization | `src/agent-teams/filesystem.ts` |
| TeamLibrary loading, sorting, shadowing | `src/agent-teams/library.ts` |
| YAML / Agent MD parsing | `src/agent-teams/parsers.ts` |
| Team validation | `src/agent-teams/validation.ts` |
| Agent canonical ID and `agentRuntime` key rewriting | `src/agent-teams/canonical-agent-id.ts` |
| Runtime projection | `src/runtime/team-library-projection.ts` |
| OpenCode agent projection / model field writing | `src/adapters/opencode/projection.ts` |
| OpenCode bootstrap / default Agent | `src/adapters/opencode/bootstrap.ts` |
| OpenCode config hook | `src/adapters/opencode/config-hook.ts` |
| OpenCode config merge | `src/adapters/opencode/config-merge.ts` |
| Packaged `aiyou-team.json` | `templates/aiyou-team.json` |
| Template Teams | `templates/teams/*` |
| Custom Team guide | `docs/guide/custom-agent-team.md` |
| Project-level Team config guide | `docs/guide/project-team-config.md` |
