import { existsSync } from "node:fs";
import path from "node:path";

import { loadDefaultTeamLibrary, summarizeTeamDiagnostics, validateTeamLibrary } from "../agent-teams";
import { createOpenCodeBootstrap } from "../adapters/opencode/bootstrap";
import { DEFAULT_OPENCODE_EXECUTION_MODE } from "../adapters/opencode/defaults";

import { findAiyouTeamPluginEntries, readOpenCodeConfig } from "./opencode-config-file";
import { resolveOpenCodeConfigPath, resolveInstallRoot } from "./install-root";
import { detectOpenCodeCli } from "./opencode-cli";
import {
  createCanonicalPluginEntry,
  detectInstalledPackageRoot,
  detectInstalledPluginPath,
  resolveLegacyInstalledPackageRoot,
  resolvePackageWorkspaceRoot,
} from "./plugin-entry";
import type { DoctorOptions, DoctorResult } from "./types";

function isValidAiyouTeamConfigEntry(entry: string, expectedPluginEntry: string): boolean {
  if (entry === expectedPluginEntry || entry === `${expectedPluginEntry}@latest`) {
    return true;
  }

  // Accept the scoped npm spec directly: `@aiyou-dev/team` or `@aiyou-dev/team@<version>`.
  // This is the form npm registry publishes under, and what users naturally write
  // when copy-pasting from the npm page.
  if (entry === "@aiyou-dev/team" || entry.startsWith("@aiyou-dev/team@")) {
    return true;
  }

  // Accept the legacy short alias: `aiyou-team` or `aiyou-team@<version>`.
  if (entry === "aiyou-team" || entry.startsWith("aiyou-team@")) {
    return true;
  }

  return false;
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const configPath = resolveOpenCodeConfigPath(options.configPath);
  const installRoot = resolveInstallRoot(options.installRoot);
  const projectWorktree = path.resolve(options.projectWorktree ?? process.cwd());
  const expectedPluginEntry = createCanonicalPluginEntry(installRoot);
  const installedPackageRoot = detectInstalledPackageRoot(installRoot);
  const opencode = detectOpenCodeCli();
  const packageWorkspaceRoot = resolvePackageWorkspaceRoot(installRoot);
  const hasLegacyInstalledPackage = existsSync(path.join(resolveLegacyInstalledPackageRoot(installRoot), "package.json"));
  const currentPluginEntries = findAiyouTeamPluginEntries(readOpenCodeConfig(configPath).config);
  const teamLibrary = await loadDefaultTeamLibrary({
    globalConfigRoot: path.dirname(configPath),
    projectWorktree,
  });
  const teamIssues = validateTeamLibrary(teamLibrary);
  const teamDiagnostics = summarizeTeamDiagnostics(teamIssues);
  const boot = createOpenCodeBootstrap({
    teamLibrary,
    defaults: { defaultMode: DEFAULT_OPENCODE_EXECUTION_MODE },
  });
  const hasWorkspaceManifest = existsSync(path.join(packageWorkspaceRoot, "package.json"));
  const configMatchesCanonical = currentPluginEntries.length === 1 && isValidAiyouTeamConfigEntry(currentPluginEntries[0] ?? "", expectedPluginEntry);
  const hasInstalledPackage = existsSync(path.join(installedPackageRoot, "package.json"));
  const hasPluginFile = existsSync(detectInstalledPluginPath(installRoot));
  const teamHealthy = teamDiagnostics.healthy;
  const healthy = opencode.found && hasWorkspaceManifest && hasInstalledPackage && hasPluginFile && configMatchesCanonical && teamHealthy;

  return {
    configMatchesCanonical,
    configPath,
    currentPluginEntries,
    expectedPluginEntry,
    hasInstalledPackage,
    hasPluginFile,
    hasLegacyInstalledPackage,
    hasWorkspaceManifest,
    healthy,
    installedPackageRoot,
    installRoot,
    opencodeFound: opencode.found,
    opencodePath: opencode.path,
    opencodeVersion: opencode.version,
    projectWorktree,
    blockingTeamIssueCount: teamDiagnostics.blockingIssueCount,
    teamCount: teamLibrary.teams.length,
    teamHealthy,
    teamIssues,
    modelResolution: boot.projectedAgents.map((agent) => agent.modelResolution),
  };
}
