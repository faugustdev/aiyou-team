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
export const AIYOU_TEAM_CONFIG_VERSION = 4;

/**
 * Marker value indicating that a model should be auto-selected from available
 * models based on agent role requirements, instead of using a hardcoded model.
 */
export const AUTO_MODEL_MARKER = "auto";

/**
 * Supported agent languages. Agents can be rendered in different languages
 * based on this config value.
 */
export const SUPPORTED_LANGUAGES = ["en", "es"] as const;
export type AiyouTeamLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AiyouTeamLanguage = "en";

/**
 * Suggested default models per agent. Used as last-resort fallback when
 * auto-selection cannot find a suitable model from available providers.
 */
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

/**
 * Descriptive display names for each agent, used in the interactive CLI.
 */
export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  "coding-leader": "Coding Leader",
  "coordination-leader": "Coordination Leader",
  "coding-executor": "Coding Executor",
  "codebase-explorer": "Codebase Explorer",
  "web-researcher": "Web Researcher",
  reviewer: "Reviewer",
  "principal-advisor": "Principal Advisor",
  "multimodal-looker": "Multimodal Looker",
};

export type AgentModelTier = "flagship" | "strong" | "balanced" | "fast";

export interface AgentModelRequirements {
  needsVision?: boolean;
  tier: AgentModelTier;
  preferProviders?: string[];
}

/**
 * Per-agent model requirements used by the auto-selection engine to pick the
 * best available model from the user's configured providers.
 */
export const AGENT_MODEL_REQUIREMENTS: Record<string, AgentModelRequirements> = {
  "coding-leader": { tier: "flagship", preferProviders: ["anthropic", "openai", "google"] },
  "coordination-leader": { tier: "strong", preferProviders: ["anthropic", "openai", "google"] },
  "coding-executor": { tier: "flagship", preferProviders: ["openai", "anthropic", "google"] },
  "codebase-explorer": { tier: "fast", preferProviders: ["google", "openai", "anthropic"] },
  "web-researcher": { tier: "balanced", preferProviders: ["openai", "anthropic", "google"] },
  reviewer: { tier: "strong", preferProviders: ["openai", "anthropic", "google"] },
  "principal-advisor": { tier: "strong", preferProviders: ["openai", "anthropic", "google"] },
  "multimodal-looker": { tier: "balanced", needsVision: true, preferProviders: ["google", "openai", "anthropic"] },
};
