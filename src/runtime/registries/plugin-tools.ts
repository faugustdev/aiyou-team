export type AiyouTeamPluginToolStatus = "reserved-placeholder" | "implemented";

export type AiyouTeamPluginToolVisibility = "agent-addressable" | "internal-only";

export interface AiyouTeamPluginToolDefinition {
  id: string;
  source: "aiyou-team-plugin";
  status: AiyouTeamPluginToolStatus;
  visibility: AiyouTeamPluginToolVisibility;
  description: string;
  hostTargets: string[];
}

const AIYOU_TEAM_PLUGIN_TOOLS: Record<string, AiyouTeamPluginToolDefinition> = {
  task: {
    id: "task",
    source: "aiyou-team-plugin",
    status: "implemented",
    visibility: "agent-addressable",
    description: "Delegate work to a aiyou-dev team member through the OpenCode-compatible task tool.",
    hostTargets: ["opencode"],
  },
  delegate_status: {
    id: "delegate_status",
    source: "aiyou-team-plugin",
    status: "implemented",
    visibility: "agent-addressable",
    description: "Query the status of a aiyou-dev background delegation.",
    hostTargets: ["opencode"],
  },
  delegate_cancel: {
    id: "delegate_cancel",
    source: "aiyou-team-plugin",
    status: "implemented",
    visibility: "agent-addressable",
    description: "Cancel a aiyou-dev background delegation.",
    hostTargets: ["opencode"],
  },
};

export function listAiyouTeamPluginTools(): AiyouTeamPluginToolDefinition[] {
  return Object.values(AIYOU_TEAM_PLUGIN_TOOLS);
}

export function listImplementedAiyouTeamPluginTools(): AiyouTeamPluginToolDefinition[] {
  return listAiyouTeamPluginTools().filter((tool) => tool.status === "implemented");
}

export function getAiyouTeamPluginTool(toolId: string): AiyouTeamPluginToolDefinition | undefined {
  return AIYOU_TEAM_PLUGIN_TOOLS[toolId];
}
