import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { uninstallAiyouTeam } from "../../dist/src/install/index.js";

test("uninstallAiyouTeam removes AiyouTeam entries while preserving foreign plugins in dry-run mode", async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-uninstall-install-"));
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "aiyou-team-uninstall-config-")), "opencode.json");
  const installedPackageRoot = path.join(installRoot, "packages", "@aiyou-dev/team@latest", "node_modules", "@aiyou-dev", "team");

  mkdirSync(installedPackageRoot, { recursive: true });
  writeFileSync(path.join(installedPackageRoot, "package.json"), '{"name":"@aiyou-dev/team"}\n', "utf8");
  writeFileSync(configPath, JSON.stringify({
    plugin: [
      "foreign-plugin",
      "file:///tmp/project/node_modules/aiyou-team/opencode-plugin.mjs",
    ],
  }, null, 2) + "\n", "utf8");

  const result = await uninstallAiyouTeam({
    configPath,
    dryRun: true,
    installRoot,
  });

  assert.equal(result.configChanged, true);
  assert.equal(result.packageRemoved, true);
  assert.deepEqual(result.removedEntries, ["file:///tmp/project/node_modules/aiyou-team/opencode-plugin.mjs"]);
  assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")).plugin, [
    "foreign-plugin",
    "file:///tmp/project/node_modules/aiyou-team/opencode-plugin.mjs",
  ]);
});

test("uninstallAiyouTeam detects cached package-layout installs in dry-run mode", async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-uninstall-cache-install-"));
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "aiyou-team-uninstall-cache-config-")), "opencode.json");
  const cachedPackageRoot = path.join(installRoot, "packages", "@aiyou-dev/team@latest", "node_modules", "@aiyou-dev", "team");

  mkdirSync(cachedPackageRoot, { recursive: true });
  writeFileSync(path.join(cachedPackageRoot, "package.json"), '{"name":"aiyou-team"}\n', "utf8");
  writeFileSync(configPath, JSON.stringify({
    plugin: ["aiyou-team"],
  }, null, 2) + "\n", "utf8");

  const result = await uninstallAiyouTeam({
    configPath,
    dryRun: true,
    installRoot,
  });

  assert.equal(result.configChanged, true);
  assert.equal(result.packageRemoved, true);
  assert.deepEqual(result.removedEntries, ["aiyou-team"]);
});

test("uninstallAiyouTeam removes package workspace and legacy top-level residue", async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "aiyou-team-uninstall-both-install-"));
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "aiyou-team-uninstall-both-config-")), "opencode.json");
  const packageWorkspaceRoot = path.join(installRoot, "packages", "@aiyou-dev/team@latest");
  const cachedPackageRoot = path.join(packageWorkspaceRoot, "node_modules", "@aiyou-dev", "team");
  const legacyPackageRoot = path.join(installRoot, "node_modules", "aiyou-team");

  mkdirSync(cachedPackageRoot, { recursive: true });
  mkdirSync(legacyPackageRoot, { recursive: true });
  writeFileSync(path.join(installRoot, "package.json"), JSON.stringify({ private: true, dependencies: { "aiyou-team": "0.1.0" } }, null, 2), "utf8");
  writeFileSync(path.join(packageWorkspaceRoot, "package.json"), JSON.stringify({ private: true, dependencies: { "aiyou-team": "0.1.10" } }, null, 2), "utf8");
  writeFileSync(path.join(cachedPackageRoot, "package.json"), '{"name":"@aiyou-dev/team"}\n', "utf8");
  writeFileSync(path.join(legacyPackageRoot, "package.json"), '{"name":"aiyou-team"}\n', "utf8");
  writeFileSync(configPath, JSON.stringify({ plugin: ["aiyou-team"] }, null, 2) + "\n", "utf8");

  const result = await uninstallAiyouTeam({
    configPath,
    dryRun: false,
    installRoot,
  });

  assert.equal(result.packageRemoved, true);
  assert.equal(existsSync(packageWorkspaceRoot), false);
  assert.equal(existsSync(legacyPackageRoot), false);
});
