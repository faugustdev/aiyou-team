import path from "node:path";

import { readOpenCodeConfig, resolveInstallRoot, resolveOpenCodeConfigPath } from "../install";

import type { AiyouTeamReleaseIntent } from "./types";

const EXACT_SEMVER_REGEX = /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;
const AIYOU_TEAM_PACKAGE_NAME = "aiyou-team";
const AIYOU_TEAM_NPM_PACKAGE_NAME = "@aiyou-dev/team";

export function findConfiguredAiyouTeamReleaseIntent(): AiyouTeamReleaseIntent | undefined {
  const configPath = resolveOpenCodeConfigPath();
  const config = readOpenCodeConfig(configPath).config;
  const plugins = Array.isArray(config.plugin) ? config.plugin : [];

  for (const entry of plugins) {
    if (typeof entry !== "string") {
      continue;
    }

    if (entry === AIYOU_TEAM_PACKAGE_NAME) {
      return {
        configPath,
        entry,
        packageName: AIYOU_TEAM_NPM_PACKAGE_NAME,
        requestedVersion: "latest",
        channel: "latest",
        isPinned: false,
        workspaceRoot: resolveReleaseWorkspaceRoot(entry),
      };
    }

    if (entry.startsWith(`${AIYOU_TEAM_PACKAGE_NAME}@`)) {
      const requestedVersion = entry.slice(AIYOU_TEAM_PACKAGE_NAME.length + 1).trim();
      if (!requestedVersion) {
        continue;
      }

      return {
        configPath,
        entry,
        packageName: AIYOU_TEAM_NPM_PACKAGE_NAME,
        requestedVersion,
        channel: EXACT_SEMVER_REGEX.test(requestedVersion) ? "latest" : requestedVersion,
        isPinned: EXACT_SEMVER_REGEX.test(requestedVersion),
        workspaceRoot: resolveReleaseWorkspaceRoot(entry),
      };
    }

    if (entry === AIYOU_TEAM_NPM_PACKAGE_NAME) {
      return {
        configPath,
        entry,
        packageName: AIYOU_TEAM_NPM_PACKAGE_NAME,
        requestedVersion: "latest",
        channel: "latest",
        isPinned: false,
        workspaceRoot: resolveReleaseWorkspaceRoot(entry),
      };
    }

    if (entry.startsWith(`${AIYOU_TEAM_NPM_PACKAGE_NAME}@`)) {
      const requestedVersion = entry.slice(AIYOU_TEAM_NPM_PACKAGE_NAME.length + 1).trim();
      if (!requestedVersion) {
        continue;
      }

      return {
        configPath,
        entry,
        packageName: AIYOU_TEAM_NPM_PACKAGE_NAME,
        requestedVersion,
        channel: EXACT_SEMVER_REGEX.test(requestedVersion) ? "latest" : requestedVersion,
        isPinned: EXACT_SEMVER_REGEX.test(requestedVersion),
        workspaceRoot: resolveReleaseWorkspaceRoot(entry),
      };
    }
  }

  return undefined;
}

function resolveReleaseWorkspaceRoot(entry: string): string {
  // The plugin entry in opencode.json can use either the canonical short alias
  // (`aiyou-team` or `aiyou-team@<version>`) or the scoped npm spec
  // (`@aiyou-dev/team` or `@aiyou-dev/team@<version>`). Workspace folders mirror
  // the npm install layout, so we always translate to the scoped spec here.
  let spec: string;
  if (entry === AIYOU_TEAM_PACKAGE_NAME) {
    spec = `${AIYOU_TEAM_NPM_PACKAGE_NAME}@latest`;
  } else if (entry.startsWith(`${AIYOU_TEAM_PACKAGE_NAME}@`)) {
    const requestedVersion = entry.slice(AIYOU_TEAM_PACKAGE_NAME.length + 1).trim();
    spec = `${AIYOU_TEAM_NPM_PACKAGE_NAME}@${requestedVersion}`;
  } else if (entry === AIYOU_TEAM_NPM_PACKAGE_NAME) {
    spec = `${AIYOU_TEAM_NPM_PACKAGE_NAME}@latest`;
  } else if (entry.startsWith(`${AIYOU_TEAM_NPM_PACKAGE_NAME}@`)) {
    spec = entry;
  } else {
    spec = entry;
  }
  return path.join(resolveInstallRoot(), "packages", sanitizePackageSpec(spec));
}

function sanitizePackageSpec(value: string): string {
  const illegal = process.platform === "win32" ? new Set(["<", ">", ":", '"', "|", "?", "*"]) : undefined;
  if (!illegal) {
    return value;
  }

  return Array.from(value, (char) => (illegal.has(char) || char.charCodeAt(0) < 32 ? "_" : char)).join("");
}
