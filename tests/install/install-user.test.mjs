import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

import agentTeams from "../../dist/src/agent-teams/index.js";
import { installAiyouTeam } from "../../dist/src/install/index.js";

const { ensureAiyouTeamConfigFile, resolveAiyouTeamConfigPath } = agentTeams;

function readExpectedAiyouTeamConfigTemplate() {
  return JSON.parse(readFileSync(path.join(process.cwd(), "templates", "aiyou-team.json"), "utf8"));
}

test("installAiyouTeam plans a user-level install without mutating files in dry-run mode", async () => {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-repo-"));
  const installRoot = path.join(mkdtempSync(path.join(os.tmpdir(), "aiyou-team-install-")), "workspace");
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "aiyou-team-config-")), "opencode.json");
  const localArtifactsRoot = path.join(repoRoot, ".artifacts", "local");
  const tarballPath = path.join(localArtifactsRoot, "aiyou-team-local.tgz");

  mkdirSync(localArtifactsRoot, { recursive: true });
  writeFileSync(path.join(repoRoot, "placeholder.txt"), "repo\n", "utf8");
  writeFileSync(tarballPath, "fake tarball\n", { encoding: "utf8", flag: "w" });

  const result = await installAiyouTeam({
    context: {
      cwd: repoRoot,
      packageRoot: repoRoot,
    },
    options: {
      configPath,
      dryRun: true,
      installRoot,
      source: "local",
    },
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.workspaceCreated, true);
  assert.equal(result.tarballPath, tarballPath);
  assert.equal(result.pluginEntry, "@aiyou-dev/team");
  assert.equal(result.aiyouTeamConfigPath, path.join(path.dirname(configPath), "aiyou-team.json"));
  assert.equal(result.aiyouTeamConfigChanged, true);
  assert.equal(result.aiyouTeamConfigReason, "created-default");
  assert.equal(existsSync(configPath), false);
  assert.equal(existsSync(result.aiyouTeamConfigPath), false);
  assert.equal(existsSync(path.join(path.dirname(configPath), "teams")), false);
});

test("installAiyouTeam supports registry source in dry-run mode", async () => {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-repo-registry-"));
  const installRoot = path.join(mkdtempSync(path.join(os.tmpdir(), "aiyou-team-install-registry-")), "workspace");
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "aiyou-team-config-registry-")), "opencode.json");

  writeFileSync(path.join(repoRoot, "package.json"), JSON.stringify({ name: "aiyou-team", version: "0.9.1" }, null, 2), "utf8");

  const result = await installAiyouTeam({
    context: {
      cwd: repoRoot,
      packageRoot: repoRoot,
    },
    options: {
      configPath,
      dryRun: true,
      installRoot,
      source: "registry",
    },
  });

  assert.equal(result.pluginEntry, "@aiyou-dev/team");
  assert.equal(result.packageSpec, "@aiyou-dev/team@latest");
  assert.equal(result.tarballPath, undefined);
  assert.equal(existsSync(configPath), false);
});

test("ensureAiyouTeamConfigFile adds default coding-team during install mode", () => {
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-team-config-"));
  const configPath = resolveAiyouTeamConfigPath(configRoot);

  writeFileSync(configPath, JSON.stringify({
    teams: [
      { path: "@tmp/custom-team", enabled: true, priority: 3 },
    ],
  }, null, 2) + "\n", "utf8");

  const result = ensureAiyouTeamConfigFile({
    configRoot,
    mode: "install",
  });
  const written = JSON.parse(readFileSync(configPath, "utf8"));

  assert.equal(result.changed, true);
  assert.equal(result.reason, "added-default-coding-team");
  assert.deepEqual(written.teams[0], readExpectedAiyouTeamConfigTemplate().teams[0]);
  assert.deepEqual(written.teams[1], {
    path: "@tmp/custom-team",
    enabled: true,
    priority: 3,
  });
  assert.equal(existsSync(path.join(configRoot, "teams")), false);
});

test("ensureAiyouTeamConfigFile creates aiyou-team.json from the packaged template", () => {
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-team-config-template-"));
  const configPath = resolveAiyouTeamConfigPath(configRoot);

  const result = ensureAiyouTeamConfigFile({
    configRoot,
    mode: "install",
  });
  const written = JSON.parse(readFileSync(configPath, "utf8"));

  assert.equal(result.changed, true);
  assert.equal(result.reason, "created-default");
  assert.deepEqual(written, readExpectedAiyouTeamConfigTemplate());
  // Legacy team templates (general-team / template-team / wukong-team) were
  // removed in 083f501 ("refactor: remove legacy team templates and initialize
  // coming-soon directory"). The only packaged team asset now is the
  // coming-soon placeholder directory.
  assert.equal(existsSync(path.join(configRoot, "teams", "coming-soon")), true);
  assert.equal(existsSync(path.join(configRoot, "teams", "general-team")), false);
  assert.equal(existsSync(path.join(configRoot, "teams", "template-team")), false);
  assert.equal(existsSync(path.join(configRoot, "teams", "wukong-team")), false);
});

test("package manifest includes the aiyou-team.json template asset", () => {
  const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));

  assert.ok(manifest.files.includes("templates"));
  assert.ok(existsSync(path.join(process.cwd(), "templates", "aiyou-team.json")));
});

test("npm pack dry-run includes packaged config and team templates", () => {
  const result = process.platform === "win32"
    ? spawnSync("npm pack --dry-run --json --ignore-scripts", {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: true,
    })
    : spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

  assert.equal(result.status, 0, result.stderr || result.error?.message);

  const [packInfo] = JSON.parse(result.stdout);
  const files = packInfo.files.map((entry) => entry.path);

  assert.ok(files.includes("templates/aiyou-team.json"));
  // The legacy team template directories were removed in commit 083f501
  // ("refactor: remove legacy team templates and initialize coming-soon
  // directory"). The packaged templates/ now only ships the coming-soon
  // placeholder, so the npm pack dry-run must reflect that.
  assert.equal(files.includes("templates/teams/general-team/team.manifest.yaml"), false);
  assert.equal(files.includes("templates/teams/template-team/team.manifest.yaml"), false);
  assert.equal(files.includes("templates/teams/wukong-team/team.manifest.yaml"), false);
});

test("ensureAiyouTeamConfigFile preserves existing non-object team entries while adding coding-team", () => {
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-team-config-preserve-"));
  const configPath = resolveAiyouTeamConfigPath(configRoot);

  writeFileSync(configPath, JSON.stringify({
    teams: [
      "legacy-entry",
      { path: "@tmp/custom-team", enabled: true },
    ],
  }, null, 2) + "\n", "utf8");

  const result = ensureAiyouTeamConfigFile({
    configRoot,
    mode: "install",
  });
  const written = JSON.parse(readFileSync(configPath, "utf8"));

  assert.equal(result.changed, true);
  assert.equal(result.reason, "added-default-coding-team");
  // Migration also adds config_version and appends missing default teams.
  assert.equal(written.config_version, readExpectedAiyouTeamConfigTemplate().config_version);
  // First team is the default coding-team, followed by preserved user entries.
  assert.deepEqual(written.teams[0], readExpectedAiyouTeamConfigTemplate().teams[0]);
  assert.equal(written.teams[1], "legacy-entry");
  assert.deepEqual(written.teams[2], { path: "@tmp/custom-team", enabled: true });
  // Additional default teams appended by migration.
  const template = readExpectedAiyouTeamConfigTemplate();
  for (let i = 1; i < template.teams.length; i++) {
    assert.deepEqual(written.teams[2 + i], template.teams[i]);
  }
  assert.equal(existsSync(path.join(configRoot, "teams")), false);
});

test("ensureAiyouTeamConfigFile repairs invalid config during startup mode", () => {
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-team-config-invalid-"));
  const configPath = resolveAiyouTeamConfigPath(configRoot);
  const invalidContent = "{invalid json";

  writeFileSync(configPath, invalidContent, "utf8");

  const result = ensureAiyouTeamConfigFile({
    configRoot,
    mode: "startup",
  });
  const written = JSON.parse(readFileSync(configPath, "utf8"));

  assert.equal(result.changed, true);
  assert.equal(result.reason, "repaired-invalid");
  assert.equal(typeof result.backupPath, "string");
  assert.equal(readFileSync(result.backupPath, "utf8"), invalidContent);
  assert.deepEqual(written, readExpectedAiyouTeamConfigTemplate());
});
