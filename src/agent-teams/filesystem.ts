import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { AgentTeamDefinition } from "../core";
import { resolveOpenCodeConfigRoot } from "../install/install-root";

import type { TeamValidationIssue } from "./types";
import {
  BUILTIN_CODING_TEAM_FALLBACK_TO_HOST_DEFAULT,
  BUILTIN_CODING_TEAM_ID,
  BUILTIN_CODING_TEAM_MODEL_FALLBACK,
  BUILTIN_CODING_TEAM_MODEL_PRESET,
  AIYOU_TEAM_CONFIG_FILE,
  AIYOU_TEAM_CONFIG_VERSION,
  DEFAULT_EMBEDDED_TEAM_PRIORITY,
  DEFAULT_FILE_TEAM_PRIORITY,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  TEAM_CONFIG_ROOT,
} from "./constants";
import type { AiyouTeamLanguage } from "./constants";
import { resolveTeamDocumentation } from "./documentation";
import { mapAgentProfile, mapTeamManifest, mapTeamPolicy } from "./parsers";
import { validateTeamManifestFile, validateTeamPolicyFile } from "../napi/index";

const TEAM_MANIFEST_FILE = "team.manifest.yaml";
const TEAM_POLICY_FILE = "team.policy.yaml";

interface RawAiyouTeamConfig {
  teams?: unknown;
  language?: unknown;
}

interface RawConfiguredTeamEntry {
  id?: unknown;
  path?: unknown;
  enabled?: unknown;
  priority?: unknown;
  model_preset?: unknown;
  modelPreset?: unknown;
  fallback?: unknown;
  fallback_to_host_default?: unknown;
  fallbackToHostDefault?: unknown;
  agents?: unknown;
}

export interface ConfiguredTeamModelOverride {
  modelPreset?: string;
  fallback?: string;
  fallbackToHostDefault?: boolean;
  agents?: Record<string, { model?: string; variant?: string; options?: Record<string, unknown>; fallbackModels?: string[]; strict?: boolean }>;
}

export interface ConfiguredEmbeddedTeamSource {
  kind: "embedded";
  teamId: string;
  enabled: boolean;
  priority: number;
  order: number;
  sourceScope: TeamConfigSourceScope;
  sourcePrecedence: number;
  configPath: string;
  modelConfigOverride?: ConfiguredTeamModelOverride;
}

export interface ConfiguredFilesystemTeamSource {
  kind: "filesystem";
  teamDir: string;
  enabled: boolean;
  priority: number;
  order: number;
  sourceScope: TeamConfigSourceScope;
  sourcePrecedence: number;
  configPath: string;
  modelConfigOverride?: ConfiguredTeamModelOverride;
}

export type ConfiguredTeamSource = ConfiguredEmbeddedTeamSource | ConfiguredFilesystemTeamSource;

export type TeamConfigSourceScope = "project" | "global";

interface TeamConfigSourceDescriptor {
  scope: TeamConfigSourceScope;
  configRoot: string;
  configPath: string;
  precedence: number;
  addDefaultCodingTeam: boolean;
  missingIsWarning: boolean;
}

export interface AiyouTeamConfigFile {
  config_version?: number;
  language?: AiyouTeamLanguage;
  teams: Array<Record<string, unknown>>;
}

export type AiyouTeamConfigEnsureReason = "created-default" | "repaired-invalid" | "added-default-coding-team" | "migrated-config-version" | "unchanged";

export interface AiyouTeamConfigEnsureResult {
  changed: boolean;
  backupPath?: string;
  configPath: string;
  reason: AiyouTeamConfigEnsureReason;
}

function normalizeLanguage(value: unknown): AiyouTeamLanguage {
  if (typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)) {
    return value as AiyouTeamLanguage;
  }
  return DEFAULT_LANGUAGE;
}

export interface ConfiguredTeamSourceResult {
  sources: ConfiguredTeamSource[];
  issues: TeamValidationIssue[];
  language: AiyouTeamLanguage;
}

function createConfigIssue(input: {
  configPath: string;
  message: string;
  code?: string;
  path?: string;
  suggestion?: string;
  sourceScope?: TeamConfigSourceScope;
  fixable?: boolean;
}): TeamValidationIssue {
  return {
    level: "warning",
    filePath: input.configPath,
    message: input.message,
    code: input.code,
    path: input.path,
    suggestion: input.suggestion,
    sourceScope: input.sourceScope,
    fixable: input.fixable,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOptionalBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function getOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const entries = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return entries.length > 0 ? entries : undefined;
}

function getOptionalPriority(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function createProviderOptionOverrides(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const options = { ...(getOptionalRecord(raw.options) ?? {}) };
  const thinkingLevel = getOptionalString(raw.thinkingLevel ?? raw.thinking_level);
  const reasoningEffort = getOptionalString(raw.reasoningEffort ?? raw.reasoning_effort);

  if (thinkingLevel) {
    options.thinkingLevel = thinkingLevel;
  }

  if (reasoningEffort) {
    options.reasoningEffort = reasoningEffort;
  }

  return Object.keys(options).length > 0 ? options : undefined;
}

function normalizeConfiguredTeamModelOverride(raw: RawConfiguredTeamEntry): ConfiguredTeamModelOverride | undefined {
  const modelPreset = getOptionalString(raw.model_preset ?? raw.modelPreset);
  const fallback = getOptionalString(raw.fallback);
  const fallbackToHostDefaultValue = raw.fallback_to_host_default ?? raw.fallbackToHostDefault;
  const fallbackToHostDefault = typeof fallbackToHostDefaultValue === "boolean" ? fallbackToHostDefaultValue : undefined;
  const agents = isRecord(raw.agents)
    ? Object.fromEntries(
        Object.entries(raw.agents).flatMap(([agentId, value]) => {
          if (!isRecord(value)) {
            return [];
          }

          const model = getOptionalString(value.model);
          const variant = getOptionalString(value.variant);
          const options = createProviderOptionOverrides(value);
          const fallbackModels = getOptionalStringArray(value.fallback_models ?? value.fallbackModels);
          const strictValue = value.strict;
          const strict = typeof strictValue === "boolean" ? strictValue : undefined;
          return [[agentId, {
            ...(model ? { model } : {}),
            ...(variant ? { variant } : {}),
            ...(options ? { options } : {}),
            ...(fallbackModels ? { fallbackModels } : {}),
            ...(strict !== undefined ? { strict } : {}),
          }]];
        }),
      )
    : undefined;
  const normalizedAgents = agents && Object.keys(agents).length > 0 ? agents : undefined;

  if (!modelPreset && !fallback && fallbackToHostDefault === undefined && !normalizedAgents) {
    return undefined;
  }

  return {
    modelPreset,
    fallback,
    fallbackToHostDefault,
    agents: normalizedAgents,
  };
}

function createDefaultCodingTeamSource(input: {
  sourceScope: TeamConfigSourceScope;
  sourcePrecedence: number;
  configPath: string;
}): ConfiguredEmbeddedTeamSource {
  return {
    kind: "embedded",
    teamId: BUILTIN_CODING_TEAM_ID,
    enabled: true,
    priority: DEFAULT_EMBEDDED_TEAM_PRIORITY,
    order: -1,
    sourceScope: input.sourceScope,
    sourcePrecedence: input.sourcePrecedence,
    configPath: input.configPath,
    modelConfigOverride: normalizeConfiguredTeamModelOverride(createDefaultCodingTeamConfigEntry()),
  };
}

function createDefaultCodingTeamConfigEntry(): Record<string, unknown> {
  return {
    id: BUILTIN_CODING_TEAM_ID,
    enabled: true,
    priority: DEFAULT_EMBEDDED_TEAM_PRIORITY,
    model_preset: BUILTIN_CODING_TEAM_MODEL_PRESET,
    fallback: BUILTIN_CODING_TEAM_MODEL_FALLBACK,
    fallback_to_host_default: BUILTIN_CODING_TEAM_FALLBACK_TO_HOST_DEFAULT,
  };
}

function getPackagedTemplateRootPath(): string | undefined {
  const candidates = [
    // Runtime bundle: dist/opencode-plugin.mjs, with __dirname pointing at dist.
    path.resolve(__dirname, "..", "templates"),
    // Compiled module tests / direct imports: dist/src/agent-teams/filesystem.js.
    path.resolve(__dirname, "../../..", "templates"),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function getPackagedAiyouTeamConfigTemplatePath(): string | undefined {
  const templateRoot = getPackagedTemplateRootPath();
  return templateRoot ? path.join(templateRoot, AIYOU_TEAM_CONFIG_FILE) : undefined;
}

function ensurePackagedTeamTemplates(configRoot: string, dryRun?: boolean): void {
  const templateRoot = getPackagedTemplateRootPath();
  if (!templateRoot) {
    return;
  }

  const packagedTeamsRoot = path.join(templateRoot, TEAM_CONFIG_ROOT);
  if (!existsSync(packagedTeamsRoot) || dryRun) {
    return;
  }

  cpSync(packagedTeamsRoot, path.join(configRoot, TEAM_CONFIG_ROOT), {
    errorOnExist: false,
    force: false,
    recursive: true,
  });
}

function isAiyouTeamConfigFile(value: unknown): value is AiyouTeamConfigFile {
  return isRecord(value) && Array.isArray(value.teams);
}

export function createDefaultAiyouTeamConfig(): AiyouTeamConfigFile {
  const templatePath = getPackagedAiyouTeamConfigTemplatePath();

  if (templatePath) {
    try {
      const parsed = JSON.parse(readFileSync(templatePath, "utf8"));
      if (isAiyouTeamConfigFile(parsed)) {
        return parsed;
      }
    } catch (error) {
      // Fall back to the built-in minimal config below. Invalid package templates
      // should not block installation or startup self-repair.
      void error;
    }
  }

  return {
    config_version: AIYOU_TEAM_CONFIG_VERSION,
    teams: [createDefaultCodingTeamConfigEntry()],
  };
}

function writeAiyouTeamConfig(configPath: string, config: AiyouTeamConfigFile): void {
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function resolveAiyouTeamConfigBackupPath(configPath: string): string {
  const basePath = `${configPath}.bak`;
  if (!existsSync(basePath)) {
    return basePath;
  }

  let index = 1;
  while (true) {
    const nextPath = `${basePath}.${index}`;
    if (!existsSync(nextPath)) {
      return nextPath;
    }

    index += 1;
  }
}

function backupAiyouTeamConfig(configPath: string, rawText: string): string {
  const backupPath = resolveAiyouTeamConfigBackupPath(configPath);
  mkdirSync(path.dirname(backupPath), { recursive: true });
  writeFileSync(backupPath, rawText, "utf8");
  return backupPath;
}

function parseAiyouTeamConfigForEnsure(configPath: string): {
  config?: Record<string, unknown>;
  rawText?: string;
  valid: boolean;
} {
  if (!existsSync(configPath)) {
    return { valid: false };
  }

  try {
    const rawText = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(rawText);
    if (!isRecord(parsed)) {
      return { rawText, valid: false };
    }

    if (parsed.teams !== undefined && !Array.isArray(parsed.teams)) {
      return { rawText, valid: false };
    }

    return { config: parsed, rawText, valid: true };
  } catch {
    return { rawText: readFileSync(configPath, "utf8"), valid: false };
  }
}

function createUpdatedAiyouTeamConfigWithDefaultTeam(config: Record<string, unknown>): {
  changed: boolean;
  next: AiyouTeamConfigFile;
} {
  const rawTeams = config.teams;
  const teams = Array.isArray(rawTeams)
    ? rawTeams.map((entry) => (isRecord(entry) ? { ...entry } : entry))
    : [];
  const hasCodingTeam = teams.some((entry) => isRecord(entry) && entry.id === BUILTIN_CODING_TEAM_ID);

  return {
    changed: !hasCodingTeam,
    next: {
      ...config,
      teams: hasCodingTeam ? teams : [createDefaultCodingTeamConfigEntry(), ...teams],
    },
  };
}

/**
 * Migrate an existing config to the latest version by merging in new default
 * fields while preserving all user-configured values. Returns whether any
 * changes were made and the resulting config.
 */
function migrateAiyouTeamConfig(existing: Record<string, unknown>): {
  changed: boolean;
  config: AiyouTeamConfigFile;
} {
  const currentVersion = typeof existing.config_version === "number" ? existing.config_version : 1;

  if (currentVersion >= AIYOU_TEAM_CONFIG_VERSION) {
    // Already up-to-date; cast and return as-is.
    return { changed: false, config: existing as unknown as AiyouTeamConfigFile };
  }

  const defaults = createDefaultAiyouTeamConfig();

  // Start with a shallow copy of the existing config so we preserve all user keys.
  const migrated: Record<string, unknown> = { ...existing };

  // Stamp the new version.
  migrated.config_version = AIYOU_TEAM_CONFIG_VERSION;

  // Merge top-level keys from defaults that are missing in the existing config.
  for (const key of Object.keys(defaults)) {
    if (!(key in migrated)) {
      migrated[key] = (defaults as unknown as Record<string, unknown>)[key];
    }
  }

  // Deep-merge each team entry: for teams that match by id, merge missing fields
  // from the corresponding default team entry.
  const existingTeams = Array.isArray(migrated.teams) ? migrated.teams : [];
  const defaultTeams = defaults.teams ?? [];

  const mergedTeams = existingTeams.map((entry: unknown) => {
    if (!isRecord(entry)) return entry;

    const teamId = getOptionalString(entry.id);
    if (!teamId) return entry;

    const defaultEntry = defaultTeams.find(
      (d: Record<string, unknown>) => isRecord(d) && d.id === teamId,
    );
    if (!defaultEntry || !isRecord(defaultEntry)) return entry;

    // Shallow-merge missing top-level team fields from default.
    const merged: Record<string, unknown> = { ...entry };
    for (const key of Object.keys(defaultEntry)) {
      if (!(key in merged)) {
        merged[key] = defaultEntry[key];
      }
    }

    // Deep-merge agents: preserve user agent models, add new agents from default.
    if (isRecord(defaultEntry.agents)) {
      const existingAgents = isRecord(merged.agents) ? { ...merged.agents } : {};
      for (const [agentId, agentConfig] of Object.entries(defaultEntry.agents)) {
        if (!(agentId in existingAgents)) {
          existingAgents[agentId] = agentConfig;
        }
      }
      merged.agents = existingAgents;
    }

    return merged;
  });

  // Append any default teams that don't exist in the user config at all.
  for (const defaultEntry of defaultTeams) {
    if (!isRecord(defaultEntry)) continue;
    const defaultId = getOptionalString(defaultEntry.id);
    const defaultPath = getOptionalString(defaultEntry.path);
    const key = defaultId ?? defaultPath;
    if (!key) continue;

    const alreadyExists = mergedTeams.some((entry: unknown) => {
      if (!isRecord(entry)) return false;
      if (defaultId) return entry.id === defaultId;
      if (defaultPath) return entry.path === defaultPath;
      return false;
    });

    if (!alreadyExists) {
      mergedTeams.push(defaultEntry);
    }
  }

  migrated.teams = mergedTeams;

  return { changed: true, config: migrated as unknown as AiyouTeamConfigFile };
}

export function ensureAiyouTeamConfigFile(input: {
  configRoot?: string;
  dryRun?: boolean;
  mode: "install" | "startup";
}): AiyouTeamConfigEnsureResult {
  const configRoot = input.configRoot ?? resolveOpenCodeConfigRoot();
  const configPath = resolveAiyouTeamConfigPath(configRoot);

  if (!existsSync(configPath)) {
    if (!input.dryRun) {
      ensurePackagedTeamTemplates(configRoot);
      writeAiyouTeamConfig(configPath, createDefaultAiyouTeamConfig());
    }

    return {
      changed: true,
      configPath,
      reason: "created-default",
    };
  }

  const parsed = parseAiyouTeamConfigForEnsure(configPath);
  if (!parsed.valid || !parsed.config) {
    const backupPath = !input.dryRun && parsed.rawText !== undefined
      ? backupAiyouTeamConfig(configPath, parsed.rawText)
      : undefined;

    if (!input.dryRun) {
      ensurePackagedTeamTemplates(configRoot);
      writeAiyouTeamConfig(configPath, createDefaultAiyouTeamConfig());
    }

    return {
      changed: true,
      backupPath,
      configPath,
      reason: "repaired-invalid",
    };
  }

  if (input.mode === "startup") {
    // Even in startup mode, migrate outdated configs to add new default fields.
    const migration = migrateAiyouTeamConfig(parsed.config);
    if (migration.changed && !input.dryRun) {
      writeAiyouTeamConfig(configPath, migration.config);
    }

    return {
      changed: migration.changed,
      configPath,
      reason: migration.changed ? "migrated-config-version" : "unchanged",
    };
  }

  const updated = createUpdatedAiyouTeamConfigWithDefaultTeam(parsed.config);
  
  // After ensuring the coding team exists, also migrate to latest config version.
  const migration = migrateAiyouTeamConfig(updated.next as unknown as Record<string, unknown>);
  const finalConfig = migration.config;
  const changed = updated.changed || migration.changed;

  if (!changed) {
    return {
      changed: false,
      configPath,
      reason: "unchanged",
    };
  }

  if (!input.dryRun) {
    writeAiyouTeamConfig(configPath, finalConfig);
  }

  return {
    changed: true,
    configPath,
    reason: updated.changed ? "added-default-coding-team" : "migrated-config-version",
  };
}

function resolveConfiguredTeamPath(teamPath: string, configRoot: string): string {
  if (path.isAbsolute(teamPath)) {
    return path.normalize(teamPath);
  }

  if (teamPath.startsWith("~/") || teamPath.startsWith("~\\")) {
    return path.resolve(os.homedir(), teamPath.slice(2));
  }

  const relativePath = teamPath.startsWith("@") ? teamPath.slice(1) : teamPath;

  if (!relativePath.trim()) {
    throw new Error("Configured Team path must not be empty.");
  }

  return path.resolve(configRoot, relativePath);
}

function normalizeConfiguredTeamEntry(input: {
  value: unknown;
  index: number;
  configRoot: string;
  configPath: string;
  sourceScope: TeamConfigSourceScope;
  sourcePrecedence: number;
}): { source?: ConfiguredTeamSource; issues: TeamValidationIssue[] } {
  if (!isRecord(input.value)) {
    return {
      issues: [createConfigIssue({
        configPath: input.configPath,
        message: `aiyou-team.json teams[${input.index}] must be an object.`,
        code: "aiyou_team_config_team_entry_invalid",
        path: `teams[${input.index}]`,
        sourceScope: input.sourceScope,
        suggestion: "Replace this entry with an object containing either id or path.",
      })],
    };
  }

  const raw = input.value as RawConfiguredTeamEntry;
  const teamId = getOptionalString(raw.id);
  const teamPath = getOptionalString(raw.path);

  if (teamId && teamPath) {
    return {
      issues: [createConfigIssue({
        configPath: input.configPath,
        message: `aiyou-team.json teams[${input.index}] cannot declare both id and path.`,
        code: "aiyou_team_config_team_entry_conflict",
        path: `teams[${input.index}]`,
        sourceScope: input.sourceScope,
        suggestion: "Keep id for embedded Teams or path for filesystem Teams, not both.",
      })],
    };
  }

  if (!teamId && !teamPath) {
    return {
      issues: [createConfigIssue({
        configPath: input.configPath,
        message: `aiyou-team.json teams[${input.index}] must declare either id or path.`,
        code: "aiyou_team_config_team_entry_missing_source",
        path: `teams[${input.index}]`,
        sourceScope: input.sourceScope,
        suggestion: "Add an embedded Team id or a filesystem Team path.",
      })],
    };
  }

  if (raw.enabled !== undefined && typeof raw.enabled !== "boolean") {
    return {
      issues: [createConfigIssue({
        configPath: input.configPath,
        message: `aiyou-team.json teams[${input.index}].enabled must be a boolean when provided.`,
        code: "aiyou_team_config_team_entry_enabled_invalid",
        path: `teams[${input.index}].enabled`,
        sourceScope: input.sourceScope,
        suggestion: "Use true or false for enabled.",
      })],
    };
  }

  if (raw.priority !== undefined && (typeof raw.priority !== "number" || !Number.isFinite(raw.priority))) {
    return {
      issues: [createConfigIssue({
        configPath: input.configPath,
        message: `aiyou-team.json teams[${input.index}].priority must be a finite number when provided.`,
        code: "aiyou_team_config_team_entry_priority_invalid",
        path: `teams[${input.index}].priority`,
        sourceScope: input.sourceScope,
        suggestion: "Use a finite numeric priority; lower values load first.",
      })],
    };
  }

  if (teamId) {
    return {
      source: {
        kind: "embedded",
        teamId,
        enabled: getOptionalBoolean(raw.enabled, true),
        priority: getOptionalPriority(raw.priority, DEFAULT_EMBEDDED_TEAM_PRIORITY),
        order: input.index,
        sourceScope: input.sourceScope,
        sourcePrecedence: input.sourcePrecedence,
        configPath: input.configPath,
        modelConfigOverride: normalizeConfiguredTeamModelOverride(raw),
      },
      issues: [],
    };
  }

  try {
    return {
      source: {
        kind: "filesystem",
        teamDir: resolveConfiguredTeamPath(teamPath!, input.configRoot),
        enabled: getOptionalBoolean(raw.enabled, true),
        priority: getOptionalPriority(raw.priority, DEFAULT_FILE_TEAM_PRIORITY),
        order: input.index,
        sourceScope: input.sourceScope,
        sourcePrecedence: input.sourcePrecedence,
        configPath: input.configPath,
        modelConfigOverride: normalizeConfiguredTeamModelOverride(raw),
      },
      issues: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      issues: [createConfigIssue({
        configPath: input.configPath,
        message: `aiyou-team.json teams[${input.index}].path is invalid: ${message}`,
        code: "aiyou_team_config_team_entry_path_invalid",
        path: `teams[${input.index}].path`,
        sourceScope: input.sourceScope,
        suggestion: "Use an absolute path, ~/path, or @path relative to the aiyou-team.json directory.",
      })],
    };
  }
}

function dedupeConfiguredTeamSources(input: {
  sources: ConfiguredTeamSource[];
  configPath: string;
}): { sources: ConfiguredTeamSource[]; issues: TeamValidationIssue[] } {
  const issues: TeamValidationIssue[] = [];
  const seen = new Set<string>();
  const sources = input.sources.filter((source) => {
    const key = source.kind === "embedded"
      ? `embedded:${source.teamId}`
      : `filesystem:${source.teamDir.toLowerCase()}`;

    if (seen.has(key)) {
      issues.push(createConfigIssue({
        configPath: input.configPath,
        message: `aiyou-team.json contains a duplicate Team entry for '${key}'.`,
        code: "aiyou_team_config_duplicate_team_entry",
        suggestion: "Remove the duplicate Team entry; the first matching entry is used.",
      }));
      return false;
    }

    seen.add(key);
    return true;
  });

  return { sources, issues };
}

export function resolveAiyouTeamConfigPath(configRoot: string = resolveOpenCodeConfigRoot()): string {
  return path.join(configRoot, AIYOU_TEAM_CONFIG_FILE);
}

function resolveProjectAiyouTeamConfigRoot(worktree: string): string {
  return path.join(worktree, ".aiyou-team");
}

function createConfiguredTeamSourceDescriptors(input: {
  globalConfigRoot: string;
  projectWorktree?: string;
}): TeamConfigSourceDescriptor[] {
  const sources: TeamConfigSourceDescriptor[] = [];

  if (input.projectWorktree) {
    const projectConfigRoot = resolveProjectAiyouTeamConfigRoot(input.projectWorktree);
    sources.push({
      scope: "project",
      configRoot: projectConfigRoot,
      configPath: resolveAiyouTeamConfigPath(projectConfigRoot),
      precedence: 0,
      addDefaultCodingTeam: false,
      missingIsWarning: false,
    });
  }

  sources.push({
    scope: "global",
    configRoot: input.globalConfigRoot,
    configPath: resolveAiyouTeamConfigPath(input.globalConfigRoot),
    precedence: 1,
    addDefaultCodingTeam: true,
    missingIsWarning: false,
  });

  return sources;
}

function listConfiguredTeamSourcesFromDescriptor(descriptor: TeamConfigSourceDescriptor): ConfiguredTeamSourceResult {
  const configPath = descriptor.configPath;

  if (!existsSync(configPath)) {
    return {
      sources: descriptor.addDefaultCodingTeam
        ? [createDefaultCodingTeamSource({
            sourceScope: descriptor.scope,
            sourcePrecedence: descriptor.precedence,
            configPath,
          })]
        : [],
      issues: descriptor.missingIsWarning ? [createConfigIssue({
        configPath,
        message: `aiyou-team.json source '${descriptor.scope}' does not exist.`,
        code: "aiyou_team_config_missing",
        sourceScope: descriptor.scope,
      })] : [],
      language: DEFAULT_LANGUAGE,
    };
  }

  let parsed: RawAiyouTeamConfig;

  try {
    const rawConfig = readFileSync(configPath, "utf8");
    const value = JSON.parse(rawConfig);

    if (!isRecord(value)) {
      return {
        sources: descriptor.addDefaultCodingTeam
          ? [createDefaultCodingTeamSource({
              sourceScope: descriptor.scope,
              sourcePrecedence: descriptor.precedence,
              configPath,
            })]
          : [],
        issues: [createConfigIssue({
          configPath,
          message: "aiyou-team.json must contain a top-level object.",
          code: "aiyou_team_config_root_invalid",
          sourceScope: descriptor.scope,
          fixable: descriptor.addDefaultCodingTeam,
          suggestion: descriptor.addDefaultCodingTeam
            ? "Run aiyou-team install to rewrite the global aiyou-team.json from the packaged template."
            : "Replace project aiyou-team.json with an object containing a teams array.",
        })],
        language: DEFAULT_LANGUAGE,
      };
    }

    parsed = value as RawAiyouTeamConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      sources: descriptor.addDefaultCodingTeam
        ? [createDefaultCodingTeamSource({
            sourceScope: descriptor.scope,
            sourcePrecedence: descriptor.precedence,
            configPath,
          })]
        : [],
      issues: [createConfigIssue({
        configPath,
        message: `Failed to parse aiyou-team.json: ${message}`,
        code: "aiyou_team_config_parse_failed",
        sourceScope: descriptor.scope,
        fixable: descriptor.addDefaultCodingTeam,
        suggestion: descriptor.addDefaultCodingTeam
          ? "The global config can be safely repaired from the packaged template on install or plugin startup."
          : "Fix the JSON syntax; project configs are reported but not auto-rewritten.",
      })],
      language: DEFAULT_LANGUAGE,
    };
  }

  if (parsed.teams !== undefined && !Array.isArray(parsed.teams)) {
    return {
      sources: descriptor.addDefaultCodingTeam
        ? [createDefaultCodingTeamSource({
            sourceScope: descriptor.scope,
            sourcePrecedence: descriptor.precedence,
            configPath,
          })]
        : [],
      issues: [createConfigIssue({
        configPath,
        message: "aiyou-team.json teams must be an array when provided.",
        code: "aiyou_team_config_teams_invalid",
        path: "teams",
        sourceScope: descriptor.scope,
        fixable: descriptor.addDefaultCodingTeam,
        suggestion: descriptor.addDefaultCodingTeam
          ? "The global config can be safely repaired from the packaged template on install or plugin startup."
          : "Use teams: [] or a list of Team entries in project aiyou-team.json.",
      })],
      language: DEFAULT_LANGUAGE,
    };
  }

  const resolved = (parsed.teams ?? []).map((value, index) => normalizeConfiguredTeamEntry({
    value,
    index,
    configRoot: descriptor.configRoot,
    configPath,
    sourceScope: descriptor.scope,
    sourcePrecedence: descriptor.precedence,
  }));
  const configuredSources = resolved.flatMap((entry) => (entry.source ? [entry.source] : []));
  const issues = resolved.flatMap((entry) => entry.issues);
  const withDefaultCodingTeam = configuredSources.some(
    (source) => source.kind === "embedded" && source.teamId === BUILTIN_CODING_TEAM_ID,
  )
    || !descriptor.addDefaultCodingTeam
      ? configuredSources
      : [createDefaultCodingTeamSource({
          sourceScope: descriptor.scope,
          sourcePrecedence: descriptor.precedence,
          configPath,
        }), ...configuredSources];
  const deduped = dedupeConfiguredTeamSources({
    sources: withDefaultCodingTeam,
    configPath,
  });

  const language = normalizeLanguage(parsed.language);

  return {
    sources: deduped.sources,
    issues: [...issues, ...deduped.issues],
    language,
  };
}

export function listConfiguredTeamSources(input?: string | {
  globalConfigRoot?: string;
  projectWorktree?: string;
}): {
  sources: ConfiguredTeamSource[];
  issues: TeamValidationIssue[];
  language: AiyouTeamLanguage;
} {
  const globalConfigRoot = typeof input === "string"
    ? input
    : (input?.globalConfigRoot ?? resolveOpenCodeConfigRoot());
  const projectWorktree = typeof input === "string" ? undefined : input?.projectWorktree;
  const descriptors = createConfiguredTeamSourceDescriptors({ globalConfigRoot, projectWorktree });
  const resolved = descriptors.map((descriptor) => listConfiguredTeamSourcesFromDescriptor(descriptor));

  // Use the highest-precedence config's language (project > global)
  const language = resolved.reduce<AiyouTeamLanguage>((lang, entry) => {
    return entry.language !== DEFAULT_LANGUAGE ? entry.language : lang;
  }, DEFAULT_LANGUAGE);

  return {
    sources: resolved.flatMap((entry) => entry.sources),
    issues: resolved.flatMap((entry) => entry.issues),
    language,
  };
}

export function resolveTeamConfigRoot(baseDir: string = process.cwd()): string {
  return path.resolve(baseDir, TEAM_CONFIG_ROOT);
}

export function listTeamDirectories(teamRoot: string = resolveTeamConfigRoot()): string[] {
  if (!existsSync(teamRoot)) {
    return [];
  }

  return readdirSync(teamRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(teamRoot, entry.name))
    .filter((teamDir) => existsSync(path.join(teamDir, TEAM_MANIFEST_FILE)))
    .sort();
}

export function loadTeamDefinitionFromDirectory(
  teamDir: string,
  workspaceRoot: string = process.cwd(),
  language?: AiyouTeamLanguage,
): AgentTeamDefinition {
  return loadTeamDefinitionFromDirectoryWithIssues(teamDir, workspaceRoot, language).team;
}

function createSkippedAgentIssue(filePath: string, message: string): TeamValidationIssue {
  return {
    level: "error",
    blocking: false,
    filePath,
    code: "agent_profile_load_failed",
    message: `Skipped Agent '${path.basename(filePath)}': ${message}`,
    suggestion: "Fix this Agent profile file; other valid Agents in the same Team remain loadable when possible.",
  };
}

function resolveLanguageFile(dir: string, baseName: string, lang: AiyouTeamLanguage, ext: string): string {
  if (lang !== DEFAULT_LANGUAGE) {
    const langPath = path.join(dir, `${baseName.replace(ext, `.${lang}${ext}`)}`);
    if (existsSync(langPath)) return langPath;
  }
  return path.join(dir, baseName);
}

export function loadTeamDefinitionFromDirectoryWithIssues(
  teamDir: string,
  workspaceRoot: string = process.cwd(),
  language?: AiyouTeamLanguage,
): { team: AgentTeamDefinition; issues: TeamValidationIssue[] } {
  const lang = language ?? DEFAULT_LANGUAGE;

  const manifestPath = resolveLanguageFile(teamDir, TEAM_MANIFEST_FILE, lang, ".yaml");
  const manifest = mapTeamManifest(manifestPath);
  const policyPath = path.join(teamDir, TEAM_POLICY_FILE);

  if (!existsSync(policyPath)) {
    throw new Error(`${teamDir} is missing ${TEAM_POLICY_FILE}.`);
  }

  const allFiles = readdirSync(teamDir).sort();
  const langSuffix = lang !== DEFAULT_LANGUAGE ? `.${lang}` : "";

  const agentFiles = allFiles
    .filter((entry) => {
      if (!entry.endsWith(".agent.md")) return false;
      if (langSuffix && entry.includes(langSuffix)) return true;
      if (langSuffix) {
        const langVersion = entry.replace(".agent.md", `${langSuffix}.agent.md`);
        return !allFiles.includes(langVersion);
      }
      return true;
    })
    .sort();

  const issues: TeamValidationIssue[] = [];

  // YAML structural validation from Rust
  const manifestValidationIssues = validateTeamManifestFile(manifestPath);
  for (const issue of manifestValidationIssues) {
    issues.push({
      level: (issue.level as string) === "error" ? "error" : "warning",
      code: (issue.code as string) ?? "team_manifest_validation",
      path: (issue.field as string) ?? "team.manifest.yaml",
      message: issue.message as string,
      suggestion: issue.suggestion as string | undefined,
    });
  }

  const agents = agentFiles.flatMap((entry) => {
    const agentPath = path.join(teamDir, entry);

    try {
      return [mapAgentProfile(agentPath)];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push(createSkippedAgentIssue(agentPath, message));
      return [];
    }
  });

  if (agents.length === 0) {
    throw new Error(`${teamDir} must contain at least one *.agent.md file at the team root.`);
  }

  // YAML structural validation from Rust
  const policyValidationIssues = validateTeamPolicyFile(policyPath);
  for (const issue of policyValidationIssues) {
    issues.push({
      level: (issue.level as string) === "error" ? "error" : "warning",
      code: (issue.code as string) ?? "team_policy_validation",
      path: (issue.field as string) ?? "team.policy.yaml",
      message: issue.message as string,
      suggestion: issue.suggestion as string | undefined,
    });
  }

  return {
    team: {
      manifest,
      policy: mapTeamPolicy(policyPath),
      agents,
      documentation: resolveTeamDocumentation(teamDir, workspaceRoot),
    },
    issues,
  };
}
