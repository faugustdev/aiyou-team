// Compatibility boundary: new install code should import package side effects from
// package-installation.ts, which names the module after its actual responsibility.
export {
  cleanupLegacyAiyouTeamPackage,
  installLocalTarball,
  installRegistryPackage,
  uninstallAiyouTeamPackage,
} from "./package-installation";
