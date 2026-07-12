export interface AiyouTeamReleaseIntent {
  configPath: string;
  entry: string;
  packageName: string;
  requestedVersion: string;
  channel: string;
  isPinned: boolean;
  workspaceRoot: string;
}

export interface AiyouTeamReleaseCheckResult {
  currentVersion?: string;
  latestVersion?: string;
  needsRefresh: boolean;
  reason:
    | "plugin-not-configured"
    | "pinned-version"
    | "latest-unavailable"
    | "up-to-date"
    | "refresh-required";
}

export interface AiyouTeamReleaseRefreshDependencies {
  fetchJson(url: string): Promise<unknown>;
  runInstall(workspaceRoot: string): Promise<boolean>;
}
