import type { AiyouTeamLanguage } from "../../../constants";

export interface TextOverride {
  [key: string]: string | string[] | TextOverride;
}

export interface AgentTranslationOverride {
  name?: string;
  personaCore?: {
    temperament?: string;
    cognitiveStyle?: string;
    riskPosture?: string;
    communicationStyle?: string;
    persistenceStyle?: string;
    conflictStyle?: string;
    decisionPriorities?: string[];
  };
  responsibilityCore?: {
    description?: string;
    useWhen?: string[];
    avoidWhen?: string[];
    objective?: string;
    successDefinition?: string[];
    nonGoals?: string[];
    inScope?: string[];
    outOfScope?: string[];
    authority?: string;
    outputPreference?: string[];
  };
  collaboration?: {
    defaultConsults?: { agentRef: string; description: string }[];
    defaultHandoffs?: { agentRef: string; description: string }[];
  };
  corePrinciple?: string[];
  scopeControl?: string[];
  ambiguityPolicy?: string[];
  extraSections?: Record<string, string[]>;
  supportTriggers?: string[];
  repositoryAssessment?: string[];
  taskTriage?: Record<string, { signals?: string[]; defaultAction?: string }>;
  delegationReview?: {
    delegation_policy?: string[];
    review_policy?: string[];
  };
  todoDiscipline?: string[];
  completionGate?: string[];
  failureRecovery?: string[];
  outputContract?: {
    tone?: string;
    defaultFormat?: string;
    updatePolicy?: string;
  };
  operations?: {
    autonomyLevel?: string;
    stopConditions?: string[];
    coreOperationSkeleton?: string[];
  };
  templates?: Record<string, string[]>;
  guardrails?: {
    critical?: string[];
  };
  heuristics?: string[];
  antiPatterns?: string[];
  examples?: {
    goodFit?: string[];
    badFit?: string[];
    fit?: { goodFit?: string[]; badFit?: string[] };
    micro?: Record<string, string[]>;
  };
  entryPoint?: {
    exposure?: string;
    selectionDescription?: string;
  };
}

export interface ManifestTranslationOverride {
  name?: string;
  description?: string;
  mission?: {
    objective?: string;
    successDefinition?: string[];
  };
  scope?: {
    inScope?: string[];
    outOfScope?: string[];
  };
  leader?: {
    agentRef?: string;
    responsibilities?: string[];
  };
  members?: Record<string, {
    responsibility?: string;
    delegateWhen?: string;
    delegateMode?: string;
  }>;
  workflow?: {
    stages?: string[];
  };
  governance?: {
    instructionPrecedence?: string[];
    approvalPolicy?: {
      requiredFor?: string[];
      allowAssumeFor?: string[];
    };
    forbiddenActions?: string[];
    qualityFloor?: {
      requiredChecks?: string[];
    };
    workingRules?: string[];
  };
  tags?: string[];
}

export type TranslationMap = Record<string, AgentTranslationOverride>;
export type ManifestTranslationMap = Record<string, ManifestTranslationOverride>;

export function applyAgentTranslation<T extends Record<string, unknown>>(
  base: T,
  override?: AgentTranslationOverride,
): T {
  if (!override) return base;
  return deepMerge(base, override) as T;
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (!isRecord(target) || !isRecord(source)) return source;
  const result: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const targetVal = result[key];
    const sourceVal = source[key];
    if (Array.isArray(sourceVal) || typeof sourceVal !== "object" || sourceVal === null) {
      result[key] = sourceVal;
    } else if (isRecord(targetVal) && isRecord(sourceVal)) {
      result[key] = deepMerge(targetVal, sourceVal);
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
