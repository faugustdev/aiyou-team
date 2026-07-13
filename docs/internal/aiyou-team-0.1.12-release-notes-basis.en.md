Language: English | Español

# aiyou-team 0.1.12 Release Notes Material Pack

> Purpose: For use by ChatGPT / writers to compose aiyou-team 0.1.12 release notes, promotional articles, update announcements, or technical blog posts.
> Comparison baseline: From `aiyou-team@0.1.10` to the currently prepared `aiyou-team@0.1.12`.
> Writing principle: Based on the latest features; intermediate processes, internal context maintenance materials, and deprecated implementations are not included as public feature points.
> Release note: The source version number may still display as `0.1.11` at the time of writing; it needs to be bumped to `0.1.12` before official release.

---

## 1. One-sentence summary

aiyou-team 0.1.12 is an iteration moving from "installable and usable" to "easier to install, more transparent, and more configurable": it productizes the installation experience for OpenCode users, upgrades the built-in Coding Team's model configuration from hardcoded defaults to a visible, modifiable, fallback-capable, and diagnosable system, and further enhances doctor, project-level Teams, configuration safety, and engineering maintainability.

---

## 2. Recommended main title directions

Optional titles:

1. **aiyou-team 0.1.12: Easier OpenCode Installation, Stronger Coding Team Model Configuration**
2. **aiyou-team 0.1.12 Released: One Command Setup, Coding Team Supports Model Fallback**
3. **From Installation to Model Selection: aiyou-team 0.1.12 Makes Agent Teams More Usable and Transparent**
4. **aiyou-team 0.1.12: The Agent Team Framework for OpenCode Continues to Evolve**

Recommended subtitle:

> New productized setup flow, OpenCode detection and optional installation, configuration backup and doctor checks, built-in Coding Team per-agent model configuration, projection-time fallback, and host-default fallback.

---

## 3. Core user-facing changes

### 3.1 Installation experience: Upgraded from install command to setup flow

Before 0.1.10, users were closer to using a low-level install command. Starting with 0.1.12, the recommended path becomes:

```bash
npx aiyou-team@latest setup --with-opencode
```

This command represents a complete onboarding flow, not a single install action. It does the following:

- Checks whether OpenCode is already installed on the machine.
- If the user passes `--with-opencode`, attempts to install OpenCode when needed.
- Installs aiyou-team from the npm registry.
- Writes the OpenCode plugin configuration.
- Creates or repairs aiyou-team's own `aiyou-team.json`.
- Runs doctor by default after installation.
- Outputs next-step usage tips.

This can be explained publicly as:

> aiyou-team now combines "installing the OpenCode plugin, configuring aiyou-team, and checking health status" into a more productized setup flow. New users don't need to understand internal plugin paths or manually modify OpenCode configuration.

### 3.2 Upgrade experience: New update entry

Users can upgrade using:

```bash
aiyou-team update
```

Its semantics: fetch the latest aiyou-team from the registry using the setup approach and forcefully refresh the current installation. For users, the upgrade path is more direct:

```text
Install: npx aiyou-team@latest setup --with-opencode
Upgrade: aiyou-team update
Check: aiyou-team doctor
```

### 3.3 Safety: Backup before writing config, rollback on failure

aiyou-team is now more cautious when writing OpenCode configuration:

- Reads existing OpenCode configuration first.
- Identifies and migrates old aiyou-team plugin entries.
- Writes a stable canonical plugin entry: `aiyou-team`.
- Creates a backup before writing configuration.
- Restores backup when subsequent steps fail.
- Dry-run mode only outputs the plan, does not modify files.

This can be emphasized publicly as:

> aiyou-team no longer requires users to manually edit OpenCode configuration, and retains backups before writing config, reducing the risk of configuration corruption from failed installations.

### 3.4 Does not pollute business projects

aiyou-team's installation target is the OpenCode user-level package workspace, not the business project directory. For users:

- No need to install aiyou-team into the business project's `node_modules`.
- No requirement to modify the business repository.
- Plugin entry remains simple: `aiyou-team`.
- Install, upgrade, and uninstall targets are more predictable.

This can be stated as:

> aiyou-team is more like a user-level capability extension for OpenCode, rather than a dependency of a specific business project.

---

## 4. OpenCode integration enhancements

### 4.1 OpenCode detection

Setup and doctor both detect whether OpenCode is available:

```text
opencode --version
```

If detection succeeds, doctor shows whether OpenCode exists, its path and version. When OpenCode does not exist, doctor marks the environment as unhealthy.

### 4.2 Optional OpenCode installation

When users run:

```bash
npx aiyou-team@latest setup --with-opencode
```

aiyou-team will attempt to run a similar command when OpenCode is missing:

```bash
npm install -g opencode-ai --no-audit --no-fund
```

If the install command succeeds but the current terminal still cannot recognize `opencode`, aiyou-team prompts the user to open a new terminal and verify `opencode --version`.

This addresses a common issue: after installing a global npm package, the PATH may require reopening the terminal to take effect.

---

## 5. Major upgrade to built-in Coding Team model configuration

This is one of the most noteworthy features of 0.1.12.

### 5.1 Previous problem

The built-in Coding Team previously had default provider/model, but it was closer to hardcoded defaults. The problems were:

- Users may not have configured the corresponding provider.
- Users may not have permission to access certain models.
- Hard-coding the same default models across all environments is not robust.
- Users wanting to change the built-in Coding Team's models had to copy or shadow the entire Team, at high cost.
- Model configuration results were not transparent enough; users didn't know which model the final OpenCode agent actually used.

### 5.2 Current design

aiyou-team 0.1.12 lets the built-in Coding Team explicitly expand each Agent's default model in `aiyou-team.json`:

```jsonc
{
  "id": "coding-team",
  "enabled": true,
  "priority": 0,
  "model_preset": "sota-2026-05",
  "fallback": "builtin-role-chain",
  "fallback_to_host_default": true,
  "agents": {
    "coding-leader": {
      "model": "openai/gpt-5.5"
    },
    "coordination-leader": {
      "model": "openai/gpt-5.5"
    },
    "coding-executor": {
      "model": "openai/gpt-5.5"
    },
    "codebase-explorer": {
      "model": "openai/gpt-5.4-mini"
    },
    "web-researcher": {
      "model": "google/gemini-3.1-pro-preview"
    },
    "reviewer": {
      "model": "anthropic/claude-opus-4-7"
    },
    "principal-advisor": {
      "model": "anthropic/claude-opus-4-7"
    },
    "multimodal-looker": {
      "model": "google/gemini-3.1-pro-preview"
    }
  }
}
```

This configuration has several important implications:

- `model_preset` indicates this is a versioned set of aiyou-team recommended models.
- `fallback` enables the built-in role fallback chain.
- `fallback_to_host_default` allows falling back to the OpenCode default model at the end.
- `agents` makes each Agent's model directly visible and modifiable.

### 5.3 Default models assigned by role

The built-in Coding Team no longer uses "the same default model for all roles". It selects different models by role:

| Agent | Default Model | Target Task |
| --- | --- | --- |
| `coding-leader` | `openai/gpt-5.5` | Primary owner, complex code tasks, context holder, final convergence |
| `coordination-leader` | `openai/gpt-5.5` | High-ambiguity tasks, scope convergence, planning and coordination |
| `coding-executor` | `openai/gpt-5.5` | Clear implementation, fixes, debugging, local refactoring |
| `codebase-explorer` | `openai/gpt-5.4-mini` | Quick code entry point location, call chains, similar implementations |
| `web-researcher` | `google/gemini-3.1-pro-preview` | Official docs, external resources, version difference research |
| `reviewer` | `anthropic/claude-opus-4-7` | Independent review, risk identification, completion criteria checks |
| `principal-advisor` | `anthropic/claude-opus-4-7` | Architectural judgment, complex trade-offs, advanced recommendations |
| `multimodal-looker` | `google/gemini-3.1-pro-preview` | Images, PDFs, screenshots, architecture diagrams, multimodal understanding |

This can be expressed publicly as:

> aiyou-team's Coding Team is not just multiple prompts, but a group of engineering collaboration Agents with role assignments. Starting with 0.1.12, model configuration is also designed by role.

### 5.4 Users can directly modify individual Agent models

For example, if a user wants the reviewer to use OpenAI instead of Claude:

```jsonc
"agents": {
  "reviewer": {
    "model": "openai/gpt-5.5"
  }
}
```

If a user wants the leader to use Claude:

```jsonc
"agents": {
  "coding-leader": {
    "model": "anthropic/claude-opus-4-7"
  }
}
```

This is simpler than before: no need to copy the built-in Team or maintain a forked set of Team files.

### 5.5 `host-default`: Delegating back to OpenCode's default model

If a user wants a particular Agent to use OpenCode's default model entirely, they can write:

```jsonc
"agents": {
  "reviewer": {
    "model": "host-default"
  }
}
```

This means:

```text
aiyou-team does not write the model field for this OpenCode agent.
OpenCode uses its own default model or the user's currently selected model.
```

This is important because different users' OpenCode environments may differ. Some users have already configured their own default provider/model, and aiyou-team should not force an override.

---

## 6. Model Resolver: Model selection is no longer a black box

### 6.1 Core logic

aiyou-team 0.1.12 adds projection-time model resolution. It does not call LLMs, but decides before generating the OpenCode agent config:

```text
Which model should this Agent have written?
Or should no model be written, letting OpenCode use the Host Default?
```

Core decision order:

```text
Per-agent override in aiyou-team.json
  -> agent_runtime.<agent> in Team manifest
  -> agent_runtime.$default in Team manifest
  -> Built-in Coding Team role fallback chain, or custom Team's fallback_models
  -> host-default
```

Simplified pseudocode:

```ts
resolveModel(agent) {
  candidates = []

  candidates.add(userConfiguredModel)
  candidates.add(teamManifestAgentModel)
  candidates.add(teamManifestDefaultModel)
  candidates.add(roleFallbackModels)

  for (candidate of candidates) {
    if (candidate === "host-default") return omitOpenCodeModelField()
    if (candidate is available) return writeOpenCodeModel(candidate)
  }

  return omitOpenCodeModelField()
}
```

### 6.2 What fallback means

This fallback is **projection-time / config-time fallback**.

What it can do:

- Select a model based on configuration and candidate lists.
- Skip unavailable models when a list of available models is provided.
- Fall back to host-default at the end.
- Generate doctor traces explaining the selection process.

What it does not do:

- Automatic runtime retry after LLM API call failures.
- Auto-discover all providers/models actually available to the user.
- Take over OpenCode's runtime model calling logic.

When writing articles, you can say:

> aiyou-team 0.1.12 first addresses "robustness during configuration generation": don't turn the built-in recommended models into hard dependencies for the user's environment. If it cannot confirm or select an appropriate model, aiyou-team can omit the model field, letting OpenCode use its own default model.

Do not say:

> aiyou-team has already implemented automatic runtime model switching after API errors.

### 6.3 Observability in Doctor

Doctor can now show the model resolution result for each Agent, for example:

```text
Model Resolution:
- coding-team/coding-leader: openai/gpt-5.5
  configured: openai/gpt-5.5
  source: aiyou-team-json
  fallback: builtin-role-chain
  fallback_to_host_default: true

- coding-team/reviewer: host-default
  configured: host-default
  source: host-default
  fallback: builtin-role-chain
  fallback_to_host_default: true
  reason: host-default selected explicitly
```

This lets users know:

- Where the model comes from.
- Whether fallback is enabled.
- Whether the OpenCode model field was ultimately written.
- Why certain candidates were skipped.

---

## 7. Model fallback for custom Teams

0.1.12 not only enhances the built-in Coding Team but also enhances model configuration for file-based custom Teams.

### 7.1 Old syntax continues to work

Existing Teams can continue using:

```yaml
agent_runtime:
  leader:
    provider: openai
    model: gpt-5.5
```

This means the final model is:

```text
openai/gpt-5.5
```

### 7.2 New syntax supports provider/model strings

You can also write directly:

```yaml
agent_runtime:
  leader:
    model: openai/gpt-5.5
```

This syntax is closer to OpenCode's model representation.

### 7.3 `$default` support

You can set a default model for the entire Team:

```yaml
agent_runtime:
  $default:
    model: host-default
    fallback_to_host_default: true

  researcher:
    model: google/gemini-3.1-pro-preview
```

Meaning:

- `researcher` uses its own model.
- Other Agents without explicit configuration use `$default`.
- `$default` can be a specific model or `host-default`.

### 7.4 `fallback_models` support

Custom Team authors can provide a fallback chain for a specific Agent:

```yaml
agent_runtime:
  research-leader:
    model: openai/gpt-5.5
    fallback_models:
      - anthropic/claude-opus-4-7
      - google/gemini-3.1-pro-preview
    fallback_to_host_default: true
```

Resolution order:

```text
primary model
  -> fallback_models tried in order
  -> host-default
```

### 7.5 User overrides for custom Teams

Users can also override Agent models for file-based Teams in `aiyou-team.json`:

```jsonc
{
  "teams": [
    {
      "path": "@teams/research-team",
      "enabled": true,
      "priority": 0,
      "agents": {
        "research-leader": {
          "model": "anthropic/claude-opus-4-7"
        }
      }
    }
  ]
}
```

This can be summarized publicly as:

> Team authors can define recommended models and fallback, and users can override models in their own environment configuration. Team definitions and user environment adaptation are now separated.

---

## 8. Doctor and Validate enhancements

### 8.1 Doctor now checks more

`aiyou-team doctor` has been upgraded from "is the installation present" to "is the current OpenCode + aiyou-team + Team configuration healthy". It shows:

- Whether OpenCode is available.
- OpenCode path and version.
- aiyou-team config file status.
- Install root status.
- Whether the package workspace exists.
- Whether the aiyou-team package is installed.
- Whether the plugin file exists.
- Whether there is legacy package residue.
- Whether the OpenCode plugin entry is canonical.
- Current aiyou-team plugin entries.
- Current project worktree.
- How many Teams were loaded.
- Whether Team definitions are healthy.
- Team validation issues.
- Model Resolution trace.

OpenCode not existing causes doctor to return unhealthy, helping users detect environment issues early.

### 8.2 Project-level Team diagnostics

aiyou-team supports global Team configuration and project-level Team configuration. Project-level configuration is typically located in the `.aiyou-team` directory of the current project.

Users can check the Team status of a specific project:

```bash
aiyou-team doctor --project-worktree /path/to/project
aiyou-team validate --project-worktree /path/to/project
```

This is important for users who use different Agent Teams across multiple projects.

---

## 9. Documentation and project presentation

The 0.1.12 cycle also updated a large amount of documentation:

- English README.
- Chinese README.
- English installation guide.
- Chinese installation guide.
- Project-level Team configuration guide.
- Custom Team guide.
- Built-in Coding Team design documentation.

The documentation overall emphasizes:

```text
aiyou-team = Agent Team definition framework + Runtime Projection layer + OpenCode Host Adapter
```

For articles, this can be expressed as:

> aiyou-team is not simply a set of prompts, nor another heavyweight agent runtime. It is more like the definition layer, projection layer, and host adapter layer for Agent Teams. The current focus host is OpenCode.

---

## 10. Engineering quality and maintainability improvements

This section can be briefly noted in release notes but expanded in technical articles.

### 10.1 Installation layer responsibility separation

Installation-related logic has been split into clearer responsibilities:

- OpenCode config read/write, backup, restore.
- aiyou-team plugin entry migration and canonical entry generation.
- npm package install, uninstall, legacy cleanup.
- OpenCode CLI detection and optional installation.
- Different entries for setup / install / update / uninstall / doctor.

Benefits of this approach:

- Easier to test.
- Easier to diagnose installation issues.
- Easier to maintain backward compatibility with older entries.
- Better suited for future expansion with more host adapters or installation strategies.

### 10.2 Cleaner OpenCode Adapter boundaries

OpenCode-related logic is further stratified:

- Bootstrap handles overall projection and default agent selection.
- Projection handles generating OpenCode agent definitions.
- Model resolver handles model selection.
- Config hook handles writing results to OpenCode config.
- Doctor handles displaying results and health status.

This can be stated publicly as:

> aiyou-team did not stuff model fallback logic into prompts or scatter it across hooks; instead, it placed it in a dedicated model resolution layer, keeping the OpenCode projection simple.

### 10.3 Built-in Coding Team definition is more maintainable

The built-in Coding Team's Agent profile construction, runtime parameters, model defaults, and other elements are further made explicit. This means that when updating an Agent's responsibilities, tool permissions, model selection, or fallback chain in the future, there is no need to search through multiple implicit logic locations.

### 10.4 Automated dependency update workflow

New GitHub workflow for automatically updating OpenCode plugin dependencies:

- Periodically checks the latest version of `@opencode-ai/plugin`.
- Updates dependencies when changes are detected.
- Automatically runs typecheck, build, and tests.
- Creates a PR.

This shows the project continues to track changes in the OpenCode ecosystem.

---

## 11. Test coverage enhancements

The 0.1.12 cycle strengthened these test scenarios:

- Setup parameter parsing.
- Setup dry-run output.
- Doctor output.
- Doctor unhealthy when OpenCode is missing.
- Registry / local install paths.
- User-level package workspace.
- Legacy package residue detection.
- OpenCode config backup / restore.
- Plugin entry migration.
- Default `aiyou-team.json` template.
- Packaged Team templates.
- Auto-create / repair config on plugin startup.
- Project Team priority.
- Project Team shadowing global Team.
- Invalid project config falling back to global Team.
- Built-in Coding Team per-agent model override.
- `host-default` not writing OpenCode model field.
- Builtin role fallback chain.
- File-based Team `fallback_models`.

Latest known verification record:

```text
npm run typecheck passed
npm test passed, 90 passed / 0 failed
```

Before official release, it is recommended to re-run:

```bash
npm run typecheck
npm run build
npm test
```

---

## 12. Release notes draft ready for use

### 12.1 English short version

```md
## aiyou-team 0.1.12

aiyou-team 0.1.12 focuses on smoother OpenCode onboarding and a more transparent model configuration story for the built-in Coding Team.

### Highlights

- New recommended setup flow: `npx aiyou-team@latest setup --with-opencode`.
- Optional OpenCode detection and installation during setup.
- Safer OpenCode config updates with backup and rollback.
- New `aiyou-team update` entry for registry-based upgrades.
- Built-in Coding Team now ships with visible per-agent model defaults in `aiyou-team.json`.
- Users can override each Coding Team agent model directly in `aiyou-team.json`.
- `host-default` lets OpenCode keep control of the model when desired.
- Projection-time model fallback supports role-aware built-in chains and file-team `fallback_models`.
- `aiyou-team doctor` now reports model resolution traces.
- Updated bilingual docs and stronger install / doctor / model fallback test coverage.

Note: model fallback in this release happens during OpenCode agent config projection. It is not runtime provider API-error retry.
```
---

## 13. Structure for promotional articles

### Title

aiyou-team 0.1.12: Making OpenCode's Agent Teams Easier to Install, Configure, and Diagnose

### Opening

aiyou-team is an Agent Team framework for OpenCode. Its goal is not to cram everything into an ever-growing prompt, but to give different tasks different Agent Teams, role assignments, collaboration rules, and completion criteria.

0.1.12 is a concentrated release of recent work: the installation experience has been productized, the built-in Coding Team's model configuration has been made explicit, and fallback and doctor make model selection more robust and transparent.

### Part 1: Installation goes from "command" to "flow"

Introduce `setup --with-opencode`, explain that it checks OpenCode, installs aiyou-team, writes config, creates `aiyou-team.json`, and runs doctor.

### Part 2: Safer configuration

Introduce backup / rollback / dry-run / canonical plugin entry.

### Part 3: Coding Team model configuration upgrade

Explain that each Agent has different default models and why reviewer, explorer, leader, and multimodal-looker should not all use the same model.

### Part 4: Users are in control

Show modifying a single Agent model in `aiyou-team.json`, and `host-default`.

### Part 5: Fallback and doctor

Explain projection-time fallback, show doctor trace examples.

### Part 6: Custom Teams also benefit

Show `agent_runtime.$default` and `fallback_models`.

### Part 7: The project continues to iterate quickly

Mention bilingual docs, test coverage, automated OpenCode dependency update workflow, and cleaner engineering boundaries.

### Closing

aiyou-team 0.1.12 moves Agent Teams from "can be defined and projected" further toward "can be installed, configured, diagnosed, and used long-term by everyday users". This is an important step as aiyou-team continues to build the Agent Team ecosystem around OpenCode.

---

## 14. Boundaries to observe in public communications

Do not say:

```text
aiyou-team now supports automatic runtime retry after model API errors.
aiyou-team has auto-discovered all providers/models available to the user.
aiyou-team has fully integrated with the Models.dev catalog for provider routing.
```

Instead, say:

```text
aiyou-team supports projection-time / config-time model fallback.
aiyou-team can decide whether to write a model or fall back to host-default when generating OpenCode agent config.
aiyou-team's resolver has reserved availableModels filtering capability, but real provider catalog integration is future work.
```

Do not promote internal processes as user-facing features:

- Internal context maintenance materials.
- Internal research documents.
- Temporary caches or context updates.
- Intermediate release commits.

These can be categorized as internal engineering maintenance and omitted from user release notes.

---

## 15. Pre-release checklist

- [ ] Confirm version number has been bumped to `0.1.12`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm test`.
- [ ] Confirm npm dist-tag target is `latest`.
- [ ] Confirm release notes do not claim runtime API-error fallback.
- [ ] Confirm release notes do not claim real provider catalog auto-discovery.
- [ ] After release, query npm registry to confirm `aiyou-team@0.1.12` has been published.

---

## 16. Suggested prompt for ChatGPT

If you want to hand this to ChatGPT to write an article, you can use:

```text
Based on the following materials, write a Chinese release article for aiyou-team 0.1.12.

Requirements:
1. Target audience: OpenCode users and developers interested in Agent Teams.
2. Key highlights: setup --with-opencode, one-stop installation, config backup and doctor, built-in Coding Team per-agent model configuration, host-default, projection-time fallback, custom Team fallback_models.
3. Do not promote runtime API error auto-retry or real provider catalog auto-discovery.
4. Writing style: technical but readable, with clear structure, headings, sections, code snippets, and a summary.
5. Do not include internal file paths or mention internal scaffolding.
```
