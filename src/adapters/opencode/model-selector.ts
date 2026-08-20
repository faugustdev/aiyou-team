import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { AGENT_MODEL_REQUIREMENTS, type AgentModelRequirements } from "../../agent-teams/constants";

// ── aiyoucli.config.json override (cross-host model pinning) ────────
//
// `aiyou-team.json`'s per-team `model_config_override.agents.<id>.model`
// (see agent-teams/filesystem.ts) is the pre-existing, more powerful way to
// pin a model on the OpenCode side — it's resolved upstream in
// model-resolution.ts and always wins when set. This reads the *same*
// `agents.<name>.model` key that `aiyoucli agent set-model` writes to
// `.aiyoucli/config.json` / `aiyoucli.config.json`, so a single CLI command
// pins a model on both hosts without hand-editing `aiyou-team.json`. Only
// consulted here, in the "auto" fallback path — an explicit team-manifest
// override still takes precedence upstream.

interface AiyouCliAgentsConfig {
  agents?: Record<string, { model?: string }>;
}

let cachedAgentModelOverrides: Record<string, string> | null | undefined;

function loadAiyouCliAgentModelOverrides(): Record<string, string> | null {
  if (cachedAgentModelOverrides !== undefined) {
    return cachedAgentModelOverrides;
  }

  const cwd = process.cwd();
  const candidates = [
    join(cwd, "aiyoucli.config.json"),
    join(cwd, ".aiyoucli", "config.json"),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8")) as AiyouCliAgentsConfig;
      const overrides: Record<string, string> = {};
      for (const [agentId, cfg] of Object.entries(parsed.agents ?? {})) {
        if (cfg?.model) overrides[agentId] = cfg.model;
      }
      cachedAgentModelOverrides = overrides;
      return overrides;
    } catch {
      // Malformed config — fall through to auto-selection rather than crash.
    }
  }

  cachedAgentModelOverrides = null;
  return null;
}

/** Exposed for tests — clears the memoized config read. */
export function resetAgentModelOverrideCache(): void {
  cachedAgentModelOverrides = undefined;
}

interface ModelCapability {
  vision?: boolean;
  contextWindow?: number;
}

const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  "anthropic/claude-sonnet-4-6": { vision: false, contextWindow: 200000 },
  "anthropic/claude-opus-4-7": { vision: false, contextWindow: 200000 },
  "anthropic/claude-3.5-sonnet": { vision: true, contextWindow: 200000 },
  "openai/gpt-5.5": { vision: true, contextWindow: 1000000 },
  "openai/gpt-5.5-pro": { vision: true, contextWindow: 1000000 },
  "openai/gpt-5.4-mini": { vision: true, contextWindow: 1000000 },
  "openai/gpt-4o": { vision: true, contextWindow: 128000 },
  "openai/gpt-4o-mini": { vision: true, contextWindow: 128000 },
  "google/gemini-3.1-pro-preview": { vision: true, contextWindow: 1000000 },
  "google/gemini-3.1-flash-lite-preview": { vision: true, contextWindow: 1000000 },
  "google/gemini-2.5-pro": { vision: true, contextWindow: 1000000 },
  "google/gemini-2.5-flash": { vision: true, contextWindow: 1000000 },
};

function getCapability(model: string): ModelCapability | undefined {
  if (MODEL_CAPABILITIES[model]) {
    return MODEL_CAPABILITIES[model];
  }

  const [provider] = model.split("/");
  if (provider === "google" || model.includes("gemini")) {
    return { vision: true, contextWindow: 1000000 };
  }
  if (provider === "openai" || model.includes("gpt")) {
    return { vision: true, contextWindow: 128000 };
  }

  return undefined;
}

function scoreModel(model: string, req: AgentModelRequirements): number {
  let score = 0;
  const caps = getCapability(model);
  const separator = model.indexOf("/");
  const provider = separator > 0 ? model.slice(0, separator) : "";

  if (req.preferProviders) {
    const idx = req.preferProviders.indexOf(provider);
    if (idx >= 0) {
      score += 30 - idx * 10;
    }
  }

  if (caps?.contextWindow) {
    if (caps.contextWindow >= 500000) {
      score += 15;
    } else if (caps.contextWindow >= 100000) {
      score += 10;
    } else if (caps.contextWindow >= 32000) {
      score += 5;
    }
  }

  if (!caps) {
    score += 2;
  }

  return score;
}

export function selectBestModelForAgent(input: {
  agentId: string;
  availableModels: readonly string[];
}): string | undefined {
  const pinned = loadAiyouCliAgentModelOverrides()?.[input.agentId];
  if (pinned && input.availableModels.includes(pinned)) {
    return pinned;
  }

  const requirements = AGENT_MODEL_REQUIREMENTS[input.agentId];
  if (!requirements) {
    return undefined;
  }

  let candidates = [...input.availableModels];

  if (requirements.needsVision) {
    candidates = candidates.filter((model) => {
      const caps = getCapability(model);
      return caps?.vision === true;
    });
  }

  if (candidates.length === 0) {
    return undefined;
  }

  const scored = candidates.map((model) => ({
    model,
    score: scoreModel(model, requirements),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.model;
}
