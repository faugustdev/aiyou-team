export { backupOpenCodeConfig, readOpenCodeConfig, removeAiyouTeamPluginEntries, restoreOpenCodeConfigBackup, upsertAiyouTeamPluginEntry, writeOpenCodeConfig } from "./opencode-config-file";
export { runDoctor } from "./doctor";
export { installAiyouTeam } from "./install";
export { resolveOpenCodeConfigPath, resolveOpenCodeConfigRoot, resolveInstallRoot } from "./install-root";
export { resolveLocalTarballPath } from "./local-tarball";
export { cleanupLegacyAiyouTeamPackage, installLocalTarball, installRegistryPackage, uninstallAiyouTeamPackage } from "./package-installation";
export { detectOpenCodeCli, installOpenCodeCli } from "./opencode-cli";
export {
  assertInstalledPluginExists,
  createCanonicalPluginEntry,
  detectInstalledPackageRoot,
  detectInstalledPluginPath,
  resolveLegacyInstalledPackageRoot,
  resolveInstalledPackageRoot,
  resolveInstalledPluginPath,
  resolvePackageWorkspaceRoot,
} from "./plugin-entry";
export { setupAiyouTeam } from "./setup";
export type { DoctorOptions, DoctorResult, InstallCommandContext, InstallCommandOptions, InstallResult, InstallSource, SetupOptions, SetupResult, UninstallOptions, UninstallResult } from "./types";
export { uninstallAiyouTeam } from "./uninstall";
export { ensureInstallWorkspace } from "./workspace";
