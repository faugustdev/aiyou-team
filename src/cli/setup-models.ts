import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import type { Writable } from "node:stream";

import {
  AGENT_DISPLAY_NAMES,
  AGENT_MODEL_REQUIREMENTS,
  AUTO_MODEL_MARKER,
  BUILTIN_CODING_TEAM_ID,
} from "../agent-teams/constants";
import { parseJsoncText } from "../install/jsonc";
import { resolveOpenCodeConfigRoot, resolveOpenCodeConfigPath } from "../install/install-root";
import { selectBestModelForAgent } from "../adapters/opencode/model-selector";

import { parseSetupModelsOptions } from "./parse-setup-models-options";

interface DiscoveredModel {
  model: string;
  providerID: string;
  modelID: string;
}

interface AgentAssignment {
  agentId: string;
  displayName: string;
  model: string;
}

const AGENT_ORDER = [
  "coding-leader",
  "coordination-leader",
  "coding-executor",
  "codebase-explorer",
  "web-researcher",
  "reviewer",
  "principal-advisor",
  "multimodal-looker",
];

function discoverModelsFromConfig(configPath: string): DiscoveredModel[] {
  if (!existsSync(configPath)) {
    return [];
  }

  try {
    const raw = readFileSync(configPath, "utf8");
    const config = parseJsoncText(raw);
    const providers = config.provider;

    if (!providers || typeof providers !== "object") {
      return [];
    }

    const models: DiscoveredModel[] = [];

    for (const [providerID, providerConfig] of Object.entries(providers)) {
      if (!providerConfig || typeof providerConfig !== "object") {
        continue;
      }

      const providerRecord = providerConfig as Record<string, unknown>;
      const modelsObj = providerRecord.models;

      if (!modelsObj || typeof modelsObj !== "object") {
        continue;
      }

      for (const modelID of Object.keys(modelsObj as Record<string, unknown>)) {
        models.push({
          model: `${providerID}/${modelID}`,
          providerID,
          modelID,
        });
      }
    }

    return models.sort((a, b) => a.model.localeCompare(b.model));
  } catch {
    return [];
  }
}

function readCurrentAssignments(configPath: string): Map<string, string> {
  const assignments = new Map<string, string>();

  if (!existsSync(configPath)) {
    return assignments;
  }

  try {
    const raw = readFileSync(configPath, "utf8");
    const config = parseJsoncText(raw);
    const teams = config.teams;

    if (!Array.isArray(teams)) {
      return assignments;
    }

    for (const team of teams) {
      if (!team || typeof team !== "object") {
        continue;
      }

      const teamRecord = team as Record<string, unknown>;
      if (teamRecord.id !== BUILTIN_CODING_TEAM_ID) {
        continue;
      }

      const agents = teamRecord.agents;
      if (!agents || typeof agents !== "object") {
        continue;
      }

      for (const [agentId, agentConfig] of Object.entries(agents as Record<string, unknown>)) {
        if (!agentConfig || typeof agentConfig !== "object") {
          continue;
        }

        const agentRecord = agentConfig as Record<string, unknown>;
        if (typeof agentRecord.model === "string") {
          assignments.set(agentId, agentRecord.model);
        }
      }

      break;
    }
  } catch {
    // Ignore parse errors
  }

  return assignments;
}

function writeAssignments(configPath: string, assignments: AgentAssignment[]): void {
  let config: Record<string, unknown>;

  if (existsSync(configPath)) {
    try {
      config = parseJsoncText(readFileSync(configPath, "utf8"));
    } catch {
      config = {};
    }
  } else {
    config = {};
  }

  if (!Array.isArray(config.teams)) {
    config.teams = [];
  }

  const teams = config.teams as Array<Record<string, unknown>>;
  let codingTeam = teams.find((t) => t && typeof t === "object" && t.id === BUILTIN_CODING_TEAM_ID);

  if (!codingTeam) {
    codingTeam = {
      id: BUILTIN_CODING_TEAM_ID,
      enabled: true,
      priority: 0,
      model_preset: "sota-2026-05",
      fallback: "builtin-role-chain",
      fallback_to_host_default: true,
      agents: {},
    };
    teams.push(codingTeam);
  }

  if (!codingTeam.agents || typeof codingTeam.agents !== "object") {
    codingTeam.agents = {};
  }

  const agents = codingTeam.agents as Record<string, Record<string, string>>;

  for (const assignment of assignments) {
    if (!agents[assignment.agentId]) {
      agents[assignment.agentId] = {};
    }

    agents[assignment.agentId].model = assignment.model;
  }

  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function promptUser(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function groupByProvider(models: DiscoveredModel[]): Map<string, DiscoveredModel[]> {
  const grouped = new Map<string, DiscoveredModel[]>();

  for (const m of models) {
    const existing = grouped.get(m.providerID) ?? [];
    existing.push(m);
    grouped.set(m.providerID, existing);
  }

  return grouped;
}

export async function runSetupModelsCommand(argv: string[], io: {
  stderr: Writable;
  stdout: Writable;
}, context: { cwd: string; packageRoot: string }): Promise<number> {
  let options;

  try {
    options = parseSetupModelsOptions(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }

  const configRoot = resolveOpenCodeConfigRoot(options.globalConfigRoot);
  const configPath = resolveOpenCodeConfigPath(options.configPath);
  const opencodeConfigPath = path.join(configRoot, "opencode.json");
  const opencodeJsoncPath = path.join(configRoot, "opencode.jsonc");
  const actualOpenCodeConfigPath = existsSync(opencodeJsoncPath) ? opencodeJsoncPath : opencodeConfigPath;

  const discoveredModels = discoverModelsFromConfig(actualOpenCodeConfigPath);

  if (discoveredModels.length === 0) {
    io.stderr.write([
      "No models found in OpenCode config.",
      "",
      `Config path: ${actualOpenCodeConfigPath}`,
      "",
      "Make sure you have providers configured in your OpenCode config.",
      "Example config entry:",
      '  "provider": {',
      '    "openai": {',
      '      "npm": "@ai-sdk/openai",',
      '      "models": {',
      '        "gpt-5.5": { "name": "GPT 5.5" }',
      "      }",
      "    }",
      "  }",
    ].join("\n") + "\n");
    return 1;
  }

  const grouped = groupByProvider(discoveredModels);
  const currentAssignments = readCurrentAssignments(configPath);

  io.stdout.write([
    "",
    "aiyou-team Model Setup",
    "",
    `OpenCode config: ${actualOpenCodeConfigPath}`,
    `aiyou-team config: ${configPath}`,
    "",
    `Available models (${grouped.size} provider${grouped.size === 1 ? "" : "s"}, ${discoveredModels.length} model${discoveredModels.length === 1 ? "" : "s"}):`,
    "",
    ...Array.from(grouped.entries()).map(([provider, models]) => [
      `  ${provider}:`,
      ...models.map((m) => `    - ${m.modelID}`),
    ].join("\n")),
    "",
    "Agent model assignment:",
    "  (type a model name, 'auto' for auto-selection, or press Enter to keep current)",
    "",
  ].join("\n"));

  const assignments: AgentAssignment[] = [];

  for (const agentId of AGENT_ORDER) {
    const displayName = AGENT_DISPLAY_NAMES[agentId] ?? agentId;
    const currentModel = currentAssignments.get(agentId) ?? AUTO_MODEL_MARKER;
    const isAuto = currentModel === AUTO_MODEL_MARKER;

    let predictedAuto = "";
    if (isAuto) {
      const best = selectBestModelForAgent({ agentId, availableModels: discoveredModels.map((m) => m.model) });
      if (best) {
        predictedAuto = best;
      }
    }

    const displayCurrent = isAuto
      ? (predictedAuto ? `auto -> ${predictedAuto}` : "auto")
      : currentModel;

    const answer = await promptUser(`  ${displayName.padEnd(24)} [${displayCurrent}]: `);

    let selectedModel: string;

    if (answer === "" || answer === "\n") {
      selectedModel = currentModel;
    } else if (answer.toLowerCase() === "auto") {
      selectedModel = AUTO_MODEL_MARKER;
    } else if (discoveredModels.some((m) => m.model === answer)) {
      selectedModel = answer;
    } else {
      io.stderr.write(`  Warning: '${answer}' not found in available models. Using as-is.\n`);
      selectedModel = answer;
    }

    assignments.push({
      agentId,
      displayName,
      model: selectedModel,
    });
  }

  io.stdout.write([
    "",
    "Summary:",
    ...assignments.map((a) => {
      const display = a.model === AUTO_MODEL_MARKER ? "auto" : a.model;
      return `  ${a.displayName.padEnd(24)} -> ${display}`;
    }),
    "",
  ].join("\n"));

  if (options.dryRun) {
    io.stdout.write("Dry run — no files written.\n");
    return 0;
  }

  const confirm = await promptUser("Write to aiyou-team.json? [Y/n]: ");
  if (confirm.toLowerCase() === "n" || confirm.toLowerCase() === "no") {
    io.stdout.write("Cancelled.\n");
    return 0;
  }

  writeAssignments(configPath, assignments);
  io.stdout.write(`\naiyou-team.json updated: ${configPath}\n`);

  return 0;
}
