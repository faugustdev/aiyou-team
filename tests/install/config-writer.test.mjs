import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { backupOpenCodeConfig, removeAiyouTeamPluginEntries, restoreOpenCodeConfigBackup, upsertAiyouTeamPluginEntry } from "../../dist/src/install/index.js";

test("upsertAiyouTeamPluginEntry migrates project-local entries to the canonical user-level entry", () => {
  const config = {
    plugin: [
      "foreign-plugin",
      "file:///tmp/project/node_modules/aiyou-team/opencode-plugin.mjs",
    ],
  };

  const result = upsertAiyouTeamPluginEntry(config, "aiyou-team");

  assert.equal(result.changed, true);
  assert.deepEqual(result.migratedEntries, ["file:///tmp/project/node_modules/aiyou-team/opencode-plugin.mjs"]);
  assert.deepEqual(config.plugin, [
    "foreign-plugin",
    "aiyou-team",
  ]);
});

test("removeAiyouTeamPluginEntries removes all AiyouTeam references and preserves foreign plugins", () => {
  const config = {
    plugin: [
      "foreign-plugin",
      "aiyou-team",
      "file:///tmp/user/.cache/opencode/node_modules/aiyou-team/opencode-plugin.mjs",
    ],
  };

  const result = removeAiyouTeamPluginEntries(config);

  assert.equal(result.changed, true);
  assert.deepEqual(result.removedEntries, [
    "aiyou-team",
    "file:///tmp/user/.cache/opencode/node_modules/aiyou-team/opencode-plugin.mjs",
  ]);
  assert.deepEqual(config.plugin, ["foreign-plugin"]);
});

test("upsertAiyouTeamPluginEntry preserves non-string plugin entries", () => {
  const customPlugin = { name: "foreign-object-plugin" };
  const config = {
    plugin: [
      customPlugin,
      "file:///tmp/project/node_modules/aiyou-team/opencode-plugin.mjs",
    ],
  };

  upsertAiyouTeamPluginEntry(config, "aiyou-team");

  assert.deepEqual(config.plugin, [
    customPlugin,
    "aiyou-team",
  ]);
});

test("upsertAiyouTeamPluginEntry migrates package-internal js entries to the canonical package entry", () => {
  const config = {
    plugin: [
      "file:///tmp/user/.cache/opencode/aiyou-team/node_modules/aiyou-team/opencode-plugin.js",
    ],
  };

  const result = upsertAiyouTeamPluginEntry(config, "aiyou-team");

  assert.equal(result.changed, true);
  assert.deepEqual(result.migratedEntries, ["file:///tmp/user/.cache/opencode/aiyou-team/node_modules/aiyou-team/opencode-plugin.js"]);
  assert.deepEqual(config.plugin, ["aiyou-team"]);
});

test("upsertAiyouTeamPluginEntry migrates legacy standalone shim entries to the canonical package entry", () => {
  const config = {
    plugin: [
      "file:///tmp/user/.cache/opencode/aiyou-team/entry/aiyou-team-opencode-entry.mjs",
    ],
  };

  const result = upsertAiyouTeamPluginEntry(config, "aiyou-team");

  assert.equal(result.changed, true);
  assert.deepEqual(result.migratedEntries, ["file:///tmp/user/.cache/opencode/aiyou-team/entry/aiyou-team-opencode-entry.mjs"]);
  assert.deepEqual(config.plugin, ["aiyou-team"]);
});

test("OpenCode config backup can restore an existing config", () => {
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "aiyou-team-config-backup-")), "opencode.json");
  const original = JSON.stringify({ plugin: ["foreign-plugin"] }, null, 2) + "\n";

  writeFileSync(configPath, original, "utf8");
  const backup = backupOpenCodeConfig(configPath);
  writeFileSync(configPath, JSON.stringify({ plugin: ["aiyou-team"] }, null, 2) + "\n", "utf8");

  restoreOpenCodeConfigBackup(backup);

  assert.equal(typeof backup.backupPath, "string");
  assert.equal(existsSync(backup.backupPath), true);
  assert.equal(readFileSync(configPath, "utf8"), original);
});
