export const TEAM_CONFIG_ROOT = "teams";
export const AIYOU_TEAM_CONFIG_FILE = "aiyou-team.json";
export const BUILTIN_CODING_TEAM_ID = "coding-team";
export const DEFAULT_EMBEDDED_TEAM_PRIORITY = 0;
export const DEFAULT_FILE_TEAM_PRIORITY = 1;

export const EMBEDDED_TEAM_IDS = [BUILTIN_CODING_TEAM_ID] as const;

export const BUILTIN_CODING_TEAM_MODEL_PRESET = "sota-2026-05";
export const BUILTIN_CODING_TEAM_MODEL_FALLBACK = "builtin-role-chain";
export const BUILTIN_CODING_TEAM_FALLBACK_TO_HOST_DEFAULT = true;

/**
 * Current config version for aiyou-team.json. Bump this when adding new fields
 * so that existing user configs get auto-migrated with new defaults.
 */
export const AIYOU_TEAM_CONFIG_VERSION = 3;

/**
 * Supported agent languages. Agents can be rendered in different languages
 * based on this config value.
 */
export const SUPPORTED_LANGUAGES = ["en", "es"] as const;
export type AiyouTeamLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AiyouTeamLanguage = "en";

export const BUILTIN_CODING_TEAM_AGENT_MODELS: Record<string, string> = {
  "coding-leader": "anthropic/claude-sonnet-4-6",
  "coordination-leader": "anthropic/claude-sonnet-4-6",
  "coding-executor": "anthropic/claude-sonnet-4-6",
  "codebase-explorer": "anthropic/claude-sonnet-4-6",
  "web-researcher": "anthropic/claude-sonnet-4-6",
  reviewer: "anthropic/claude-sonnet-4-6",
  "principal-advisor": "anthropic/claude-sonnet-4-6",
  "multimodal-looker": "anthropic/claude-sonnet-4-6",
};
