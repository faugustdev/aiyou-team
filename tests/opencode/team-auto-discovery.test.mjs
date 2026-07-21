import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadDefaultTeamLibrary } from "../../dist/src/agent-teams/library.js";

function createTeamManifestYaml(teamId, teamName, leaderId, memberId) {
  return [
    `id: ${teamId}`,
    `version: 1.0.0`,
    `name: ${teamName}`,
    `description: Auto-discovered test team`,
    `mission:`,
    `  objective: Validate auto-discovery.`,
    `  success_definition:`,
    `    - Loaded successfully.`,
    `scope:`,
    `  in_scope:`,
    `    - tests`,
    `  out_of_scope:`,
    `    - none`,
    `leader:`,
    `  agent_ref: ${leaderId}`,
    `  responsibilities:`,
    `    - Lead the team`,
    `members:`,
    `  ${memberId}:`,
    `    responsibility: Delivery`,
    `    delegate_when: When execution is clear.`,
    `    delegate_mode: direct execution.`,
    `workflow:`,
    `  stages:`,
    `    - intake`,
    `governance:`,
    `  instruction_precedence:`,
    `    - platform rules`,
    `  approval_policy:`,
    `    required_for:`,
    `      - destructive actions`,
    `    allow_assume_for:`,
    `      - low-risk implementation details`,
    `  forbidden_actions:`,
    `    - fabricate evidence`,
    `  quality_floor:`,
    `    required_checks:`,
    `      - diagnostics`,
    `    evidence_required: true`,
    `  working_rules:`,
    `    - leader is the primary interface`,
    `agent_runtime:`,
    `  ${leaderId}:`,
    `    provider: openai`,
    `    model: gpt-5.5`,
    `  ${memberId}:`,
    `    provider: openai`,
    `    model: gpt-5.5`,
    `tags:`,
    `  - tests`,
    ``,
  ].join("\n");
}

function createTeamPolicyYaml() {
  return [
    `kind: team-policy`,
    `version: 1.0.0`,
    ``,
    `instruction_precedence:`,
    `  - platform rules`,
    `  - team rules`,
    `  - agent rules`,
    ``,
    `approval_policy:`,
    `  required_for:`,
    `    - destructive actions`,
    `  allow_assume_for:`,
    `    - low-risk implementation details`,
    ``,
    `forbidden_actions:`,
    `  - fabricate evidence`,
    ``,
    `quality_floor:`,
    `  required_checks:`,
    `    - diagnostics`,
    `  evidence_required: true`,
    ``,
    `working_rules:`,
    `  - leader is the primary interface`,
    ``,
    `prompt_projection:`,
    `  include:`,
    `    - working_rules`,
    `    - approval_safety`,
    ``,
  ].join("\n");
}

function createAgentProfileYaml(agentId, agentName, exposure, selectionLabel) {
  return [
    `---`,
    `id: ${agentId}`,
    `name: ${agentName}`,
    `archetype: orchestrator`,
    `persona_core:`,
    `  temperament: calm`,
    `  cognitive_style: direct`,
    `  risk_posture: balanced`,
    `  communication_style: concise`,
    `  persistence_style: high`,
    `  decision_priorities:`,
    `    - correctness`,
    `responsibility_core:`,
    `  description: ${agentName} description.`,
    `  use_when:`,
    `    - Test coverage needs this agent.`,
    `  avoid_when:`,
    `    - Never`,
    `  objective: ${agentName} objective.`,
    `  success_definition:`,
    `    - Return a useful result.`,
    `  non_goals:`,
    `    - none`,
    `  in_scope:`,
    `    - tests`,
    `  out_of_scope:`,
    `    - none`,
    `  authority: Operate within the assigned scope.`,
    `collaboration:`,
    `  default_consults: []`,
    `  default_handoffs: []`,
    `runtime_config:`,
    `  requested_tools:`,
    `    - read`,
    `  permission:`,
    `    - permission: read`,
    `      pattern: "*"`,
    `      action: allow`,
    `output_contract:`,
    `  tone: concise`,
    `  default_format: text`,
    `  update_policy: final-only`,
    `entry_point:`,
    `  exposure: ${exposure}`,
    `  selection_label: ${selectionLabel}`,
    `  selection_description: ${agentName} selection.`,
    `---`,
    ``,
  ].join("\n");
}

function makeTeamDir(rootDir, teamName, teamId, leaderId, executorId) {
  const teamDir = path.join(rootDir, teamName);
  mkdirSync(teamDir, { recursive: true });
  writeFileSync(
    path.join(teamDir, "team.manifest.yaml"),
    createTeamManifestYaml(teamId, teamName, leaderId, executorId),
  );
  writeFileSync(path.join(teamDir, "team.policy.yaml"), createTeamPolicyYaml());
  writeFileSync(path.join(teamDir, `${leaderId}.agent.md`), createAgentProfileYaml(leaderId, leaderId, "user-selectable", "leader"));
  writeFileSync(path.join(teamDir, `${executorId}.agent.md`), createAgentProfileYaml(executorId, executorId, "internal-only", "executor"));
  return teamDir;
}

test("auto-discovers project Teams under <worktree>/teams/", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-auto-discovery-project-"));
  try {
    const teamsRoot = path.join(workspace, "teams");
    makeTeamDir(teamsRoot, "AutoTeam", "auto-team", "auto-leader", "auto-executor");

    const library = loadDefaultTeamLibrary(workspace);

    assert.ok(
      library.teams.some((team) => team.manifest.id === "auto-team"),
      `expected auto-team to be discovered, got: ${library.teams.map((t) => t.manifest.id).join(", ")}`,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("auto-discovers global Teams under <globalConfigRoot>/teams/", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-auto-discovery-global-"));
  try {
    const configRoot = path.join(root, "config", "opencode");
    mkdirSync(configRoot, { recursive: true });
    const globalTeamsRoot = path.join(configRoot, "teams");
    makeTeamDir(globalTeamsRoot, "GlobalTeam", "global-team", "global-leader", "global-executor");

    const worktree = path.join(root, "worktree");
    mkdirSync(worktree, { recursive: true });

    const library = loadDefaultTeamLibrary({
      globalConfigRoot: configRoot,
      projectWorktree: worktree,
    });

    assert.ok(
      library.teams.some((team) => team.manifest.id === "global-team"),
      `expected global-team to be discovered, got: ${library.teams.map((t) => t.manifest.id).join(", ")}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("project auto-discovered Teams shadow global auto-discovered Teams with same id", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-auto-discovery-shadow-"));
  try {
    const configRoot = path.join(root, "config", "opencode");
    mkdirSync(configRoot, { recursive: true });
    const worktree = path.join(root, "worktree");
    mkdirSync(worktree, { recursive: true });

    const globalTeamsRoot = path.join(configRoot, "teams");
    const globalDir = makeTeamDir(globalTeamsRoot, "SharedTeam", "shared-team", "global-leader", "global-executor");
    const projectTeamsRoot = path.join(worktree, "teams");
    const projectDir = makeTeamDir(projectTeamsRoot, "SharedTeam", "shared-team", "project-leader", "project-executor");

    const library = loadDefaultTeamLibrary({
      globalConfigRoot: configRoot,
      projectWorktree: worktree,
    });

    const shared = library.teams.find((team) => team.manifest.id === "shared-team");
    assert.ok(shared, "expected shared-team to be loaded");
    const agentIds = shared?.agents.map((agent) => agent.metadata.id) ?? [];
    assert.ok(
      agentIds.some((id) => id.includes("project-leader")),
      `expected a project-leader agent, got: ${agentIds.join(", ")}`,
    );
    assert.ok(
      !agentIds.some((id) => id.includes("global-leader")),
      `expected global-leader to be shadowed, got: ${agentIds.join(", ")}`,
    );
    // Sanity-check that a "Project Team ... shadows" warning was emitted.
    assert.ok(
      library.loadIssues.some((issue) => issue.message.includes("Project Team 'shared-team' shadows global Team 'shared-team'.")),
      "expected a project-shadows-global warning",
    );

    assert.ok(existsSync(projectDir), "project team dir must exist");
    assert.ok(existsSync(globalDir), "global team dir must exist");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("explicit aiyou-team.json path entries override auto-discovered Teams (same scope)", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-auto-discovery-explicit-"));
  try {
    const configRoot = path.join(root, "config", "opencode");
    mkdirSync(configRoot, { recursive: true });
    const worktree = path.join(root, "worktree");
    mkdirSync(worktree, { recursive: true });
    mkdirSync(path.join(worktree, ".aiyou-team"), { recursive: true });

    const projectTeamsRoot = path.join(worktree, "teams");
    makeTeamDir(projectTeamsRoot, "ExplicitTeam", "explicit-team", "auto-leader", "auto-executor");

    const overrideDir = path.join(root, "override", "ExplicitTeam");
    mkdirSync(overrideDir, { recursive: true });
    writeFileSync(
      path.join(overrideDir, "team.manifest.yaml"),
      createTeamManifestYaml("explicit-team", "ExplicitTeam", "override-leader", "override-executor"),
    );
    writeFileSync(path.join(overrideDir, "team.policy.yaml"), createTeamPolicyYaml());
    writeFileSync(path.join(overrideDir, "override-leader.agent.md"), createAgentProfileYaml("override-leader", "override-leader", "user-selectable", "leader"));
    writeFileSync(path.join(overrideDir, "override-executor.agent.md"), createAgentProfileYaml("override-executor", "override-executor", "internal-only", "executor"));

    writeFileSync(
      path.join(worktree, ".aiyou-team", "aiyou-team.json"),
      JSON.stringify({
        config_version: 4,
        language: "en",
        teams: [
          { id: "coding-team", enabled: true, priority: 0 },
          { path: overrideDir, enabled: true, priority: 1 },
        ],
      }),
    );

    const previousConfigDir = process.env.OPENCODE_CONFIG_DIR;
    process.env.OPENCODE_CONFIG_DIR = configRoot;
    try {
      const library = loadDefaultTeamLibrary({
        globalConfigRoot: configRoot,
        projectWorktree: worktree,
      });

      const explicit = library.teams.find((team) => team.manifest.id === "explicit-team");
      assert.ok(explicit, "expected explicit-team to be loaded");
      const explicitAgentIds = explicit?.agents.map((agent) => agent.metadata.id) ?? [];
      assert.ok(
        explicitAgentIds.some((id) => id.includes("override-leader")),
        `explicit config entry must win over auto-discovery; got: ${explicitAgentIds.join(", ")}`,
      );
      assert.ok(
        !explicitAgentIds.some((id) => id.includes("auto-leader")),
        `auto-discovered version must be skipped when explicit entry exists; got: ${explicitAgentIds.join(", ")}`,
      );
    } finally {
      if (previousConfigDir === undefined) delete process.env.OPENCODE_CONFIG_DIR;
      else process.env.OPENCODE_CONFIG_DIR = previousConfigDir;
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});