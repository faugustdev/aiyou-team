import { existsSync } from "node:fs";
import path from "node:path";

export const AIYOU_TEAM_PACKAGE_NAME = "aiyou-team";
export const AIYOU_TEAM_NPM_PACKAGE_NAME = "@aiyou-dev/team";
export const AIYOU_TEAM_PACKAGE_WORKSPACE = "@aiyou-dev/team@latest";

export function resolvePackageWorkspaceRoot(installRoot: string): string {
  return path.join(installRoot, "packages", AIYOU_TEAM_PACKAGE_WORKSPACE);
}

export function resolveInstalledPackageRoot(installRoot: string): string {
  return path.join(resolvePackageWorkspaceRoot(installRoot), "node_modules", AIYOU_TEAM_NPM_PACKAGE_NAME);
}

export function resolveInstalledPluginPath(installRoot: string): string {
  return path.join(resolveInstalledPackageRoot(installRoot), "opencode-plugin.mjs");
}

export function detectInstalledPackageRoot(installRoot: string): string {
  return resolveInstalledPackageRoot(installRoot);
}

export function detectInstalledPluginPath(installRoot: string): string {
  return path.join(detectInstalledPackageRoot(installRoot), "opencode-plugin.mjs");
}

export function createCanonicalPluginEntry(_installRoot?: string): string {
  return AIYOU_TEAM_PACKAGE_NAME;
}

export function assertInstalledPluginExists(installRoot: string): void {
  const pluginPath = detectInstalledPluginPath(installRoot);

  if (!existsSync(pluginPath)) {
    throw new Error(`aiyou-team plugin entry does not exist at ${pluginPath}.`);
  }
}

export function resolveLegacyInstalledPackageRoot(installRoot: string): string {
  return path.join(installRoot, "node_modules", AIYOU_TEAM_PACKAGE_NAME);
}
