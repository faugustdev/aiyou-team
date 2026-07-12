export interface AiyouTeamManagedAgentOptions {
  managed: true;
  teamId: string;
  canonicalAgentId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isManagedAiyouTeamAgentDefinition(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const options = value.options;
  if (!isRecord(options)) {
    return false;
  }

  const aiyouTeam = options.aiyouTeam;
  return isRecord(aiyouTeam) && aiyouTeam.managed === true;
}

export function createManagedAiyouTeamAgentOptions(input: {
  teamId: string;
  canonicalAgentId: string;
  existingOptions?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...(input.existingOptions ?? {}),
    aiyouTeam: {
      managed: true,
      teamId: input.teamId,
      canonicalAgentId: input.canonicalAgentId,
    } satisfies AiyouTeamManagedAgentOptions,
  };
}
