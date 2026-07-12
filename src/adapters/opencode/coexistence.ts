export interface OpenCodeCoexistencePolicy {
  pluginId: "aiyou-team";
  dependsOnOhMyOpenCode: false;
  featureDevelopmentMode: "mutually-exclusive";
  safeWhenCoInstalled: boolean;
  reservedConfigKeyPrefix: string;
  neverMutateForeignAgents: boolean;
}

export interface OpenCodeProjectionCollisionReport {
  configKeyCollisions: string[];
}

export interface OpenCodeProjectedIdentity {
  configKey: string;
}

export function createOpenCodeCoexistencePolicy(): OpenCodeCoexistencePolicy {
  return {
    pluginId: "aiyou-team",
    dependsOnOhMyOpenCode: false,
    featureDevelopmentMode: "mutually-exclusive",
    safeWhenCoInstalled: true,
    reservedConfigKeyPrefix: "",
    neverMutateForeignAgents: true,
  };
}

export function detectOpenCodeProjectionCollisions(input: {
  projectedAgents: OpenCodeProjectedIdentity[];
  existingConfigKeys?: string[];
}): OpenCodeProjectionCollisionReport {
  const existingConfigKeys = new Set(input.existingConfigKeys ?? []);

  return {
    configKeyCollisions: input.projectedAgents
      .filter((agent) => existingConfigKeys.has(agent.configKey))
      .map((agent) => agent.configKey),
  };
}
