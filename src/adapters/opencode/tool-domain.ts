import {
  listAiyouTeamPluginTools,
  listImplementedAiyouTeamPluginTools,
  type AiyouTeamPluginToolDefinition,
} from "../../runtime/registries/plugin-tools";

export interface OpenCodeToolDomainPlan {
  hostId: "opencode";
  reservedTools: AiyouTeamPluginToolDefinition[];
  implementedTools: AiyouTeamPluginToolDefinition[];
  toolInjectionMode: "reserved-only" | "inject-implemented-tools";
}

export function createOpenCodeToolDomainPlan(): OpenCodeToolDomainPlan {
  const implementedTools = listImplementedAiyouTeamPluginTools().filter((tool) => tool.hostTargets.includes("opencode"));
  const reservedTools = listAiyouTeamPluginTools().filter((tool) => tool.hostTargets.includes("opencode"));

  return {
    hostId: "opencode",
    reservedTools,
    implementedTools,
    toolInjectionMode: implementedTools.length > 0 ? "inject-implemented-tools" : "reserved-only",
  };
}
