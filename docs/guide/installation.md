# Installation

Language: English | Español

Audience: **users** installing or operating aiyou-team with OpenCode. Maintainer-only CI/CD and release work is covered in the [Release And CI/CD Guide](../developer/release.md).

## Quick Start

Install aiyou-team for OpenCode in one command:

```bash
npx aiyou-team@latest setup --with-opencode
```

Then open your project:

```bash
cd /path/to/your/project
opencode
```

Select:

```text
coding-leader
```

aiyou-team installs into the OpenCode user-level workspace, writes the canonical plugin entry `"@aiyou-dev/team"`, runs doctor checks, and prints the next step. It does not install into your business project's `node_modules` and does not modify repository files.

## Already Have OpenCode

If OpenCode is already installed and available in your terminal:

```bash
npx aiyou-team@latest setup
```

If OpenCode is missing, use the recommended command instead:

```bash
npx aiyou-team@latest setup --with-opencode
```

When `--with-opencode` is used, aiyou-team installs OpenCode with the official npm package path:

```bash
npm install -g opencode-ai
```

If global npm installation is not writable, install OpenCode manually from the official docs and re-run `npx aiyou-team@latest setup`.

## What `setup` Does

```text
Detect runtime and OpenCode
→ install OpenCode if missing and --with-opencode is set
→ install @aiyou-dev/team@latest into the OpenCode user-level workspace
→ back up OpenCode config before writing
→ write OpenCode plugin entry: "@aiyou-dev/team"
→ create or repair aiyou-team's user-level aiyou-team.json
→ run aiyou-team doctor
→ show how to start OpenCode and select coding-leader
```

Default roots:

```text
Config root:  ~/.config/opencode
Install root: ~/.cache/opencode
```

On Windows, OpenCode works best in WSL. Native Windows is supported when OpenCode is available in `PATH`; OpenCode can be installed via npm, Chocolatey, or Scoop.

## Website Installation Copy

Use this copy for the homepage installation card:

```text
Install aiyou-team

Set up aiyou-team for OpenCode in one command.
No project-local node_modules. No manual config editing.
```

```bash
npx aiyou-team@latest setup --with-opencode
```

Three-step section:

```text
1. Setup aiyou-team for OpenCode
2. Open your project with opencode
3. Select coding-leader and run a real task
```

## Installation Tabs

### Recommended

```bash
npx aiyou-team@latest setup --with-opencode
```

Best for first-time users. Installs OpenCode if missing, installs aiyou-team, writes the OpenCode plugin entry, and runs doctor.

### Already have OpenCode

```bash
npx aiyou-team@latest setup
```

Use this if OpenCode is already installed and available in your terminal.

### For LLM Agents

```bash
npx aiyou-team@latest setup --with-opencode --yes
npx aiyou-team@latest doctor
```

Important:

```text
Do not install aiyou-team into this project's node_modules.
Do not manually edit business project files.
aiyou-team should be installed into the OpenCode user-level workspace.
The OpenCode plugin entry should be "@aiyou-dev/team".
After installation, tell the user to open a project with `opencode` and select `coding-leader`.
```

## CLI Reference

### Setup

```bash
npx aiyou-team@latest setup [options]
```

Options:

```text
--with-opencode       Install OpenCode when it is missing
--yes, -y             Non-interactive mode for LLM agents and copy-paste setup
--doctor              Run doctor after setup, default true
--no-doctor           Skip doctor
--dry-run             Show the plan without changing files
--force               Reinstall aiyou-team
--channel stable      Install the stable npm dist-tag, default
--channel next        Install the next npm dist-tag
--config-path <path>  Use a custom OpenCode config file
--install-root <path> Use a custom OpenCode user-level install root
--verbose             Print additional setup details
```

### Verify

```bash
npx aiyou-team@latest doctor
```

Doctor checks the OpenCode config, user-level install workspace, package layout, plugin entry, plugin file, and built-in Team definitions.

### Update

```bash
npx aiyou-team@latest update
```

Use `--channel next` to update to the next dist-tag.

### Uninstall

```bash
npx aiyou-team@latest uninstall
```

This removes aiyou-team entries from OpenCode config and removes aiyou-team from the OpenCode user-level workspace. User Team configuration is preserved unless a future purge option is explicitly used.

## Safety Model

aiyou-team setup is intentionally conservative:

```text
No project-local node_modules install
No business repository file modifications
OpenCode config backup before writes
Rollback of OpenCode config on setup/uninstall failure
Canonical plugin entry only: "@aiyou-dev/team"
Dry-run mode for transparent planning
```

Dry-run example:

```bash
npx aiyou-team@latest setup --with-opencode --dry-run
```

## Developer Local Install

The local tarball path is for contributors and maintainers, not first-time users. It is summarized here only to point developers to the correct workflow; full release and CI/CD details live in the [Release And CI/CD Guide](../developer/release.md).

```bash
npm install
npm run pack:local
npm run install:local:user
npm run doctor
```

The local tarball is written to:

```text
.artifacts/local/aiyou-team-local.tgz
```

## Project-specific Teams

aiyou-team supports global Teams and project Teams. Project Teams are configured from the current OpenCode worktree:

```text
<project-worktree>/.aiyou-team/aiyou-team.json
```

For the full design and examples, see:

```text
docs/guide/project-team-config.md
```
