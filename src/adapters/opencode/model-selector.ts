import { AGENT_MODEL_REQUIREMENTS, type AgentModelRequirements } from "../../agent-teams/constants";

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
