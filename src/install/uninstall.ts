import { backupOpenCodeConfig, readOpenCodeConfig, removeAiyouTeamPluginEntries, restoreOpenCodeConfigBackup, writeOpenCodeConfig } from "./opencode-config-file";
import { resolveOpenCodeConfigPath, resolveInstallRoot } from "./install-root";
import { uninstallAiyouTeamPackage } from "./package-installation";
import type { UninstallOptions, UninstallResult } from "./types";

export async function uninstallAiyouTeam(options: UninstallOptions): Promise<UninstallResult> {
  const configPath = resolveOpenCodeConfigPath(options.configPath);
  const installRoot = resolveInstallRoot(options.installRoot);
  const configDocument = readOpenCodeConfig(configPath);
  const removal = removeAiyouTeamPluginEntries(configDocument.config);
  const configBackup = !options.dryRun && removal.changed
    ? backupOpenCodeConfig(configPath)
    : undefined;

  try {
    if (!options.dryRun && removal.changed) {
      writeOpenCodeConfig(configPath, configDocument.config);
    }

    const packageRemoved = uninstallAiyouTeamPackage({
      dryRun: options.dryRun,
      installRoot,
    });

    return {
      backupPath: configBackup?.backupPath,
      configChanged: removal.changed,
      configPath,
      dryRun: options.dryRun,
      installRoot,
      packageRemoved,
      removedEntries: removal.removedEntries,
    };
  } catch (error) {
    if (configBackup) {
      restoreOpenCodeConfigBackup(configBackup);
    }

    throw error;
  }
}
