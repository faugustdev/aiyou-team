import path from "node:path";

import type { AgentTeamDefinition, TeamLibrary } from "../core";
import type { AiyouTeamLanguage } from "./constants";

import type { TeamValidationIssue } from "./types";
import { normalizeTeamAgentIds } from "./canonical-agent-id";
import { BUILTIN_CODING_TEAM_ID, TEAM_CONFIG_ROOT } from "./constants";
import { createEmbeddedCodingTeam } from "./embedded/coding-team";
import {
  listConfiguredTeamSources,
  listTeamDirectories,
  loadTeamDefinitionFromDirectory,
  loadTeamDefinitionFromDirectoryWithIssues,
  resolveTeamConfigRoot,
  type ConfiguredTeamSource,
  type TeamConfigSourceScope,
} from "./filesystem";
import { validateTeamDefinition } from "./validation";

function createSkippedTeamIssue(teamDir: string, message: string): TeamValidationIssue {
  return {
    level: "warning",
    filePath: teamDir,
    code: "team_load_failed",
    message: `Skipped Team '${path.basename(teamDir)}': ${message}`,
    suggestion: "Fix this Team directory; aiyou-team will continue loading other valid Teams.",
  };
}

export interface LoadDefaultTeamLibraryOptions {
  globalConfigRoot?: string;
  projectWorktree?: string;
}

function loadValidatedTeamDefinition(input: {
  teamDir: string;
  workspaceRoot: string;
  usedCanonicalIds: Set<string>;
  language?: AiyouTeamLanguage;
}): { team?: AgentTeamDefinition; issues: TeamValidationIssue[] } {
  try {
    const loaded = loadTeamDefinitionFromDirectoryWithIssues(input.teamDir, input.workspaceRoot, input.language);
    const loadedTeam = loaded.team;
    const normalized = normalizeTeamAgentIds({ team: loadedTeam, usedCanonicalIds: input.usedCanonicalIds });
    if (!normalized.team) {
      return {
        issues: [
          ...loaded.issues,
          ...normalized.issues.map((issue) => createSkippedTeamIssue(input.teamDir, issue.message)),
        ],
      };
    }

    const issues = [...normalized.issues, ...validateTeamDefinition(normalized.team)];
    const errors = issues.filter((issue) => issue.level === "error");

    if (errors.length > 0) {
      return {
        issues: [
          ...loaded.issues,
          ...errors.map((issue) => createSkippedTeamIssue(input.teamDir, issue.message)),
        ],
      };
    }

    return {
      team: normalized.team,
      issues: [...loaded.issues, ...issues.filter((issue) => issue.level === "warning")],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      issues: [createSkippedTeamIssue(input.teamDir, message)],
    };
  }
}

export function loadTeamLibraryFromDirectory(
  teamRoot: string = resolveTeamConfigRoot(),
  workspaceRoot: string = process.cwd(),
): TeamLibrary {
  const usedCanonicalIds = new Set<string>();
  const configuredTeams = listTeamDirectories(teamRoot).map((teamDir) => loadValidatedTeamDefinition({
    teamDir,
    workspaceRoot,
    usedCanonicalIds,
  }));

  return {
    version: "file-config-v1",
    teams: configuredTeams.flatMap((entry) => (entry.team ? [entry.team] : [])),
    loadIssues: configuredTeams.flatMap((entry) => entry.issues),
  };
}

/**
 * Auto-discovered filesystem Team source. Created when a `<root>/teams/`
 * directory exists and contains subdirectories with a `team.manifest.yaml`,
 * but the user has not declared them explicitly in `aiyou-team.json`.
 */
interface AutoDiscoveredFilesystemSource {
  kind: "filesystem";
  teamDir: string;
  priority: number;
  sourceScope: TeamConfigSourceScope;
  sourcePrecedence: number;
  configPath: string;
}

/**
 * Auto-discovered filesystem Teams get a priority *higher* (numerically) than
 * any explicit configuration entry, so they lose to user-declared teams but
 * still benefit from project > global precedence ordering. Embedded Teams
 * keep their default `0` priority so auto-discovered filesystem Teams can
 * shadow embedded Teams with the same id (a common case when a project ships
 * a custom `coding-team`).
 */
const PROJECT_TEAMS_AUTO_DISCOVERY_PRIORITY = 2;
const GLOBAL_TEAMS_AUTO_DISCOVERY_PRIORITY = 3;

function collectAutoDiscoveredFilesystemSources(input: {
  globalConfigRoot?: string;
  projectWorktree?: string;
}): AutoDiscoveredFilesystemSource[] {
  const sources: AutoDiscoveredFilesystemSource[] = [];
  const seen = new Set<string>();

  const addDir = (teamDir: string, opts: {
    scope: TeamConfigSourceScope;
    precedence: number;
    priority: number;
  }): void => {
    const normalized = path.resolve(teamDir);
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    sources.push({
      kind: "filesystem",
      teamDir: normalized,
      priority: opts.priority,
      sourceScope: opts.scope,
      sourcePrecedence: opts.precedence,
      configPath: path.join(normalized, "team.manifest.yaml"),
    });
  };

  if (input.projectWorktree) {
    const projectTeamsRoot = path.resolve(input.projectWorktree, TEAM_CONFIG_ROOT);
    for (const teamDir of listTeamDirectories(projectTeamsRoot)) {
      addDir(teamDir, {
        scope: "project",
        precedence: 0,
        priority: PROJECT_TEAMS_AUTO_DISCOVERY_PRIORITY,
      });
    }
  }

  if (input.globalConfigRoot) {
    const globalTeamsRoot = path.resolve(input.globalConfigRoot, TEAM_CONFIG_ROOT);
    for (const teamDir of listTeamDirectories(globalTeamsRoot)) {
      addDir(teamDir, {
        scope: "global",
        precedence: 1,
        priority: GLOBAL_TEAMS_AUTO_DISCOVERY_PRIORITY,
      });
    }
  }

  return sources;
}

export function loadDefaultTeamLibrary(input: string | LoadDefaultTeamLibraryOptions = process.cwd()): TeamLibrary {
  const baseDir = typeof input === "string"
    ? input
    : (input.projectWorktree ?? process.cwd());
  const globalConfigRoot = typeof input === "string"
    ? undefined
    : input.globalConfigRoot;
  const projectWorktree = typeof input === "string"
    ? input
    : input.projectWorktree;
  const configured = listConfiguredTeamSources(
    typeof input === "string"
      ? { projectWorktree: input }
      : { globalConfigRoot: input.globalConfigRoot, projectWorktree: input.projectWorktree },
  );
  const language = configured.language;
  const pendingTeams: Array<{
    loader: () => { team?: AgentTeamDefinition; issues: TeamValidationIssue[] };
    priority: number;
    order: number;
    sourcePrecedence: number;
    sourceScope: string;
    configPath: string;
  }> = [];

  // Auto-discover filesystem Teams from conventional `<worktree>/teams/` and
  // `<globalConfigRoot>/teams/` directories so users don't have to declare them
  // in `aiyou-team.json` for every project. Explicit config entries still take
  // precedence (they're already in `configured.sources` and win because they
  // share the same precedence but use a non-negative priority while auto-
  // discovered ones use negative priorities).
  const autoDiscovered = collectAutoDiscoveredFilesystemSources({
    globalConfigRoot,
    projectWorktree,
  });

  // Track explicit filesystem source paths so we skip auto-discovered ones
  // that the user has already declared explicitly.
  const explicitFilesystemDirs = new Set(
    configured.sources
      .filter((source): source is Extract<ConfiguredTeamSource, { kind: "filesystem" }> => source.kind === "filesystem")
      .map((source) => source.teamDir.toLowerCase()),
  );

  for (const auto of autoDiscovered) {
    if (explicitFilesystemDirs.has(auto.teamDir.toLowerCase())) {
      continue;
    }

    pendingTeams.push({
      loader: () => {
        try {
          const loaded = loadTeamDefinitionFromDirectoryWithIssues(auto.teamDir, baseDir, language);
          return {
            team: loaded.team,
            issues: loaded.issues,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            issues: [createSkippedTeamIssue(auto.teamDir, message)],
          };
        }
      },
      priority: auto.priority,
      order: 0,
      sourcePrecedence: auto.sourcePrecedence,
      sourceScope: auto.sourceScope,
      configPath: auto.configPath,
    });
  }

  for (const source of configured.sources) {
    if (!source.enabled) {
      continue;
    }

    if (source.kind === "embedded") {
      const embeddedTeam = loadEmbeddedTeam(source, language);
      configured.issues.push(...embeddedTeam.issues);

      if (!embeddedTeam.team) {
        continue;
      }

      pendingTeams.push({
        loader: () => ({
          team: embeddedTeam.team
            ? { ...embeddedTeam.team, modelConfigOverride: source.modelConfigOverride }
            : undefined,
          issues: [],
        }),
        priority: source.priority,
        order: source.order,
        sourcePrecedence: source.sourcePrecedence,
        sourceScope: source.sourceScope,
        configPath: source.configPath,
      });
      continue;
    }

    pendingTeams.push({
      loader: () => {
        try {
          const loaded = loadTeamDefinitionFromDirectoryWithIssues(source.teamDir, baseDir, language);
          return {
            team: { ...loaded.team, modelConfigOverride: source.modelConfigOverride },
            issues: loaded.issues,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            issues: [createSkippedTeamIssue(source.teamDir, message)],
          };
        }
      },
      priority: source.priority,
      order: source.order,
      sourcePrecedence: source.sourcePrecedence,
      sourceScope: source.sourceScope,
      configPath: source.configPath,
    });
  }

  pendingTeams.sort((left, right) => {
    const sourceOrder = left.sourcePrecedence - right.sourcePrecedence;
    if (sourceOrder !== 0) {
      return sourceOrder;
    }

    const priorityOrder = left.priority - right.priority;
    if (priorityOrder !== 0) {
      return priorityOrder;
    }

    return left.order - right.order;
  });

  const usedCanonicalIds = new Set<string>();
  const usedTeamIds = new Map<string, { sourceScope: string; configPath: string }>();
  const orderedTeams: AgentTeamDefinition[] = [];

  for (const entry of pendingTeams) {
    const loaded = entry.loader();
    configured.issues.push(...loaded.issues);
    if (loaded.team) {
      const existing = usedTeamIds.get(loaded.team.manifest.id);
      if (existing) {
        configured.issues.push({
          level: "warning",
          filePath: entry.configPath,
          code: "team_id_shadowed_or_duplicate",
          sourceScope: entry.sourceScope === "project" || entry.sourceScope === "global" ? entry.sourceScope : undefined,
          message: entry.sourceScope === "global" && existing.sourceScope === "project"
            ? `Project Team '${loaded.team.manifest.id}' shadows global Team '${loaded.team.manifest.id}'.`
            : `Skipped Team '${loaded.team.manifest.id}': duplicate Team id already loaded from ${existing.sourceScope} source.`,
          suggestion: entry.sourceScope === "global" && existing.sourceScope === "project"
            ? "This is expected when a project intentionally overrides a global Team id."
            : "Rename one Team id or disable one Team entry.",
        });
        continue;
      }

      const usedCanonicalIdsBeforeNormalize = new Set(usedCanonicalIds);
      const normalized = normalizeTeamAgentIds({
        team: loaded.team,
        usedCanonicalIds,
      });
      configured.issues.push(...normalized.issues);
      if (normalized.team) {
        const validationIssues = validateTeamDefinition(normalized.team);
        const errors = validationIssues.filter((issue) => issue.level === "error");
        if (errors.length > 0) {
          usedCanonicalIds.clear();
          for (const usedId of usedCanonicalIdsBeforeNormalize) {
            usedCanonicalIds.add(usedId);
          }
          configured.issues.push(...errors.map((issue) => ({
            level: "warning" as const,
            filePath: issue.filePath,
            code: issue.code ?? "team_validation_failed",
            path: issue.path,
            suggestion: issue.suggestion,
            message: `Skipped Team '${normalized.team?.manifest.id ?? "unknown"}': ${issue.message}`,
          })));
          continue;
        }
        configured.issues.push(...validationIssues.filter((issue) => issue.level === "warning"));
        orderedTeams.push(normalized.team);
        usedTeamIds.set(normalized.team.manifest.id, {
          sourceScope: entry.sourceScope,
          configPath: entry.configPath,
        });
      }
    }
  }

  return {
    version: "config-driven-v1",
    teams: orderedTeams,
    loadIssues: configured.issues,
  };
}

function loadEmbeddedTeam(
  source: Extract<ConfiguredTeamSource, { kind: "embedded" }>,
  language?: AiyouTeamLanguage,
): {
  team?: AgentTeamDefinition;
  issues: TeamValidationIssue[];
} {
  if (source.teamId === BUILTIN_CODING_TEAM_ID) {
    return {
      team: createEmbeddedCodingTeam(language),
      issues: [],
    };
  }

  return {
    issues: [{
      level: "warning",
      filePath: source.teamId,
      message: `Skipped embedded Team '${source.teamId}': unknown embedded Team id.`,
    }],
  };
}

export function findTeam(teamId: string, teamLibrary: TeamLibrary): AgentTeamDefinition | undefined {
  return teamLibrary.teams.find((team) => team.manifest.id === teamId);
}
