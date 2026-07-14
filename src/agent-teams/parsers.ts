import type {
  AgentRuntimeModelConfig,
  AgentRuntimeConfig,
  AgentProfileSpec,
  OutputContract,
  TeamManifest,
  TeamPolicySpec,
  TeamMemberMap,
  TeamAgentRuntimeMap,
  ToolSkillStrategySpec,
} from "../core";
import { parseMarkdownBodySections } from "../loader/markdown-body-loader";
import { mapPromptProjection } from "../loader/profile-loader";
import { normalizeMarkdownSection } from "../normalize/normalize-value";

import {
  parseAgentFile as napiParseAgentFile,
  parseTeamManifest as napiParseTeamManifest,
  parseTeamPolicy as napiParseTeamPolicy,
} from "../napi/index";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as UnknownRecord;
}

function asOptionalRecord(value: unknown): UnknownRecord | undefined {
  if (!value) return undefined;
  return asRecord(value, "record");
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  return value;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asOptionalNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((entry, index) => asString(entry, `${label}[${index}]`));
}

function mapProviderOptions(record: UnknownRecord): Record<string, unknown> | undefined {
  const options = { ...(asOptionalRecord(record.options) ?? {}) };
  const thinkingLevel = asOptionalString(record.thinking_level ?? record.thinkingLevel);
  const reasoningEffort = asOptionalString(record.reasoning_effort ?? record.reasoningEffort);
  if (thinkingLevel) options.thinkingLevel = thinkingLevel;
  if (reasoningEffort) options.reasoningEffort = reasoningEffort;
  return Object.keys(options).length > 0 ? options : undefined;
}

function mapLegacyTeamMembers(rawMembers: unknown): TeamMemberMap {
  if (!Array.isArray(rawMembers)) return {};
  return Object.fromEntries(
    rawMembers.map((entry, index) => {
      const member = asRecord(entry, `members[${index}]`);
      const agentRef = asString(member.agent_ref ?? member.agentRef, `members[${index}].agent_ref`);
      return [
        agentRef,
        {
          responsibility: asString(member.role, `members[${index}].role`),
          delegateWhen: "",
          delegateMode: "",
        },
      ];
    }),
  );
}

function mapTeamMembers(rawMembers: unknown): TeamMemberMap {
  if (!rawMembers) return {};
  if (Array.isArray(rawMembers)) return mapLegacyTeamMembers(rawMembers);
  const members = asRecord(rawMembers, "members");
  return Object.fromEntries(
    Object.entries(members).map(([agentRef, value]) => {
      const member = asRecord(value, `members.${agentRef}`);
      return [
        agentRef,
        {
          responsibility: asString(member.responsibility, `members.${agentRef}.responsibility`),
          delegateWhen: asOptionalString(member.delegate_when ?? member.delegateWhen) ?? "",
          delegateMode: asOptionalString(member.delegate_mode ?? member.delegateMode) ?? "",
        },
      ];
    }),
  );
}

function mapExecutionPolicyTriageBucket(raw: UnknownRecord | undefined, label: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  return {
    signals: raw.signals ? asStringArray(raw.signals, `${label}.signals`) : [],
    defaultAction: asString(raw.default_action ?? raw.defaultAction, `${label}.default_action`),
  };
}

function mapExecutionPolicy(raw: UnknownRecord | undefined): Record<string, unknown> {
  if (!raw) return {};
  return {
    directAnswer: mapExecutionPolicyTriageBucket(
      asOptionalRecord(raw.direct_answer ?? raw.directAnswer), "task_triage.direct_answer",
    ),
    summarizeOrOrganize: mapExecutionPolicyTriageBucket(
      asOptionalRecord(raw.summarize_or_organize ?? raw.summarizeOrOrganize), "task_triage.summarize_or_organize",
    ),
    researchOrRetrieval: mapExecutionPolicyTriageBucket(
      asOptionalRecord(raw.research_or_retrieval ?? raw.researchOrRetrieval), "task_triage.research_or_retrieval",
    ),
    dataOrAnalysis: mapExecutionPolicyTriageBucket(
      asOptionalRecord(raw.data_or_analysis ?? raw.dataOrAnalysis), "task_triage.data_or_analysis",
    ),
    delegationPolicy: raw.delegation_policy ?? raw.delegationPolicy,
    reviewPolicy: raw.review_policy ?? raw.reviewPolicy,
    completionGate: raw.completion_gate ?? raw.completionGate,
    todoDiscipline: raw.todo_discipline ?? raw.todoDiscipline,
    failureRecovery: raw.failure_recovery ?? raw.failureRecovery,
  };
}

function mapRuntimeConfig(raw: UnknownRecord): AgentRuntimeConfig {
  return {
    requestedTools: (raw.requested_tools ?? raw.requestedTools)
      ? asStringArray(raw.requested_tools ?? raw.requestedTools, "runtime_config.requested_tools") : [],
    permission: Array.isArray(raw.permission)
      ? raw.permission.map((entry: unknown, index: number) => {
          const rule = asRecord(entry, `runtime_config.permission[${index}]`);
          return {
            permission: asString(rule.permission, `runtime_config.permission[${index}].permission`),
            action: asString(rule.action, `runtime_config.permission[${index}].action`) as AgentRuntimeConfig["permission"][number]["action"],
            pattern: asOptionalString(rule.pattern) ?? "*",
          };
        })
      : [],
    skills: asOptionalStringArray(raw.skills),
    memory: asOptionalString(raw.memory),
    hooks: asOptionalString(raw.hooks),
    instructions: asOptionalStringArray(raw.instructions),
    mcpServers: asOptionalStringArray(raw.mcp_servers ?? raw.mcpServers),
  };
}

function asOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.map((v) => (typeof v === "string" ? v : undefined)).filter(Boolean) as string[];
  return entries.length > 0 ? entries : undefined;
}

function mapOutputContract(raw: UnknownRecord | undefined): OutputContract {
  return {
    tone: asString(raw?.tone ?? "direct-helpful", "output_contract.tone"),
    defaultFormat: asString(raw?.default_format ?? raw?.defaultFormat ?? "answer-then-details-when-useful", "output_contract.default_format"),
    updatePolicy: asString(raw?.update_policy ?? raw?.updatePolicy ?? "concise milestone updates only for multi-step work", "output_contract.update_policy"),
  };
}

function mapCollaborationBinding(entry: UnknownRecord): Record<string, unknown> | undefined {
  if (!entry) return undefined;
  return {
    agentRef: asString(entry.agent_ref ?? entry.agentRef, "collaboration binding agent_ref"),
    description: asString(entry.description, "collaboration binding description"),
    runtimeConfig: entry.runtime_config ?? entry.runtimeConfig,
    outputContract: entry.output_contract ?? entry.outputContract,
  };
}

function mapCollaboration(raw: UnknownRecord | undefined): {
  defaultConsults: Record<string, unknown>[];
  defaultHandoffs: Record<string, unknown>[];
} {
  const consults: unknown[] = Array.isArray(raw?.default_consults ?? raw?.defaultConsults)
    ? (raw?.default_consults ?? raw?.defaultConsults) as unknown[]
    : [];
  const handoffs: unknown[] = Array.isArray(raw?.default_handoffs ?? raw?.defaultHandoffs)
    ? (raw?.default_handoffs ?? raw?.defaultHandoffs) as unknown[]
    : [];
  return {
    defaultConsults: consults.map((entry: unknown) => mapCollaborationBinding(asRecord(entry, "collaboration binding")) ?? { agentRef: "", description: "" }),
    defaultHandoffs: handoffs.map((entry: unknown) => mapCollaborationBinding(asRecord(entry, "collaboration binding")) ?? { agentRef: "", description: "" }),
  };
}

function mapMinimalOperations(raw: UnknownRecord | undefined, _body: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  return {
    autonomyLevel: asOptionalString(raw.autonomy_level ?? raw.autonomyLevel),
    stopConditions: asOptionalStringArray(raw.stop_conditions ?? raw.stopConditions),
    coreOperationSkeleton: asOptionalStringArray(raw.core_operation_skeleton ?? raw.coreOperationSkeleton),
  };
}

function mapMinimalTemplates(raw: UnknownRecord | undefined, _body: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  return {
    explorationChecklist: asOptionalStringArray(raw.exploration_checklist ?? raw.explorationChecklist),
    executionPlan: asOptionalStringArray(raw.execution_plan ?? raw.executionPlan),
    finalReport: asOptionalStringArray(raw.final_report ?? raw.finalReport),
  };
}

function mapGuardrails(raw: UnknownRecord | undefined, _body: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  return { critical: asOptionalStringArray(raw.critical) };
}

function mapToolSkillStrategy(raw: UnknownRecord | undefined): ToolSkillStrategySpec | undefined {
  if (!raw) return undefined;
  return {
    principles: asOptionalStringArray(raw.principles),
    preferredOrder: asOptionalStringArray(raw.preferred_order ?? raw.preferredOrder),
    avoid: asOptionalStringArray(raw.avoid),
    notes: asOptionalStringArray(raw.notes),
  };
}

function mapExamples(raw: UnknownRecord | undefined, body: string): Record<string, unknown> | undefined {
  if (raw) return raw as Record<string, unknown>;

  const section = extractSection(body, "Examples");
  if (!section) return undefined;

  const good: string[] = [];
  const bad: string[] = [];
  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- Good fit:")) good.push(trimmed.slice("- Good fit:".length).trim());
    if (trimmed.startsWith("- Bad fit:")) bad.push(trimmed.slice("- Bad fit:".length).trim());
  }
  if (good.length === 0 && bad.length === 0) return undefined;
  return { fit: { goodFit: good, badFit: bad } };
}

function mapEntryPoint(raw: UnknownRecord | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const result: Record<string, unknown> = {
    exposure: asString(raw.exposure, "entry_point.exposure"),
  };
  if (raw.selection_description ?? raw.selectionDescription) {
    result.selectionDescription = asOptionalString(raw.selection_description ?? raw.selectionDescription);
  }
  if (raw.selection_priority ?? raw.selectionPriority) {
    result.selectionPriority = asOptionalNumber(raw.selection_priority ?? raw.selectionPriority, "entry_point.selection_priority");
  }
  return result;
}

function mapAgentRuntime(raw: UnknownRecord | undefined): TeamAgentRuntimeMap {
  if (!raw) return {};
  return Object.fromEntries(
    Object.entries(raw).map(([agentId, value]) => {
      const config = asRecord(value, `agent_runtime.${agentId}`);
      return [
        agentId,
        {
          provider: asOptionalString(config.provider),
          model: asOptionalString(config.model),
          temperature: asOptionalNumber(config.temperature, `agent_runtime.${agentId}.temperature`),
          topP: asOptionalNumber(config.top_p ?? config.topP, `agent_runtime.${agentId}.top_p`),
          variant: asOptionalString(config.variant),
          options: mapProviderOptions(config),
          fallbackModels: asOptionalStringArray(config.fallback_models ?? config.fallbackModels),
          fallbackToHostDefault: asOptionalBoolean(config.fallback_to_host_default ?? config.fallbackToHostDefault),
        } as AgentRuntimeModelConfig,
      ];
    }),
  );
}

function omitKeys(record: UnknownRecord, keys: readonly string[]): UnknownRecord {
  const keySet = new Set(keys);
  return Object.fromEntries(Object.entries(record).filter(([k]) => !keySet.has(k)));
}

const KNOWN_AGENT_TOP_LEVEL_KEYS = [
  "id", "kind", "version", "name", "archetype", "status", "owner", "tags",
  "persona_core", "responsibility_core",
  "core_principle", "scope_control", "ambiguity_policy", "support_triggers",
  "collaboration", "repository_assessment", "task_triage", "delegation_review",
  "todo_discipline", "completion_gate", "failure_recovery",
  "runtime_config", "output_contract",
  "operations", "templates", "guardrails", "heuristics", "anti_patterns", "examples",
  "tool_skill_strategy", "entry_point", "prompt_projection",
] as const;

const KNOWN_TEAM_TOP_LEVEL_KEYS = [
  "id", "version", "name", "description",
  "mission", "scope", "leader", "members", "workflow",
  "governance", "agent_runtime", "agentRuntime",
  "tags", "prompt_projection", "model_config_override", "modelConfigOverride",
] as const;

function extractSection(body: string, title: string): string | undefined {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = `(?:^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?:\\n##\\s+|$)`;
  const match = body.match(new RegExp(pattern, "m"));
  if (!match) return undefined;
  const content = match[1].trim();
  return content.length > 0 ? content : undefined;
}

function extractBullets(section: string | undefined): string[] {
  if (!section) return [];
  return section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter((l) => l.length > 0);
}

export function mapAgentProfile(filePath: string): AgentProfileSpec {
  const raw = napiParseAgentFile(filePath);

  const data = raw as UnknownRecord;
  const metadata = asRecord(data.metadata, "metadata");
  const personaCore = asRecord(data.personaCore, "personaCore");
  const responsibilityCore = asRecord(data.responsibilityCore, "responsibilityCore");
  const collaboration = asOptionalRecord(data.collaboration);
  const runtimeConfig = asRecord(data.runtimeConfig, "runtimeConfig");

  const body = "";

  const extraContent = omitKeys(data, KNOWN_AGENT_TOP_LEVEL_KEYS.map((k) => {
    return k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }));
  const reservedCamel = new Set<string>(KNOWN_AGENT_TOP_LEVEL_KEYS.map((k) => {
    return k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }));
  const bodySections = Object.fromEntries(
    parseMarkdownBodySections(body)
      .filter((section) => !reservedCamel.has(section.key) && !(section.key in extraContent))
      .map((section) => [section.key, normalizeMarkdownSection(section.rawMarkdown) ?? section.rawMarkdown]),
  );

  const profile: AgentProfileSpec & Record<string, unknown> = {
    metadata: {
      id: asString(metadata.id, "id"),
      name: asString(metadata.name, "name"),
      archetype: asOptionalString(metadata.archetype),
      owner: asOptionalString(metadata.owner),
      tags: metadata.tags ? asStringArray(metadata.tags, "tags") : undefined,
    },
    personaCore: {
      temperament: asString(personaCore.temperament, "persona_core.temperament"),
      cognitiveStyle: asString(personaCore.cognitive_style, "persona_core.cognitive_style"),
      riskPosture: asString(personaCore.risk_posture, "persona_core.risk_posture"),
      communicationStyle: asString(personaCore.communication_style, "persona_core.communication_style"),
      persistenceStyle: asString(personaCore.persistence_style, "persona_core.persistence_style"),
      conflictStyle: asOptionalString(personaCore.conflict_style),
      decisionPriorities: asStringArray(personaCore.decision_priorities, "persona_core.decision_priorities"),
    },
    responsibilityCore: {
      description: asString(responsibilityCore.description, "responsibility_core.description"),
      useWhen: asStringArray(responsibilityCore.use_when, "responsibility_core.use_when"),
      avoidWhen: asStringArray(responsibilityCore.avoid_when, "responsibility_core.avoid_when"),
      objective: asString(responsibilityCore.objective, "responsibility_core.objective"),
      successDefinition: asStringArray(responsibilityCore.success_definition, "responsibility_core.success_definition"),
      nonGoals: asStringArray(responsibilityCore.non_goals, "responsibility_core.non_goals"),
      inScope: asStringArray(responsibilityCore.in_scope, "responsibility_core.in_scope"),
      outOfScope: asStringArray(responsibilityCore.out_of_scope, "responsibility_core.out_of_scope"),
      authority: asOptionalString(responsibilityCore.authority),
      outputPreference: responsibilityCore.output_preference
        ? asStringArray(responsibilityCore.output_preference, "responsibility_core.output_preference")
        : undefined,
    },
    corePrinciple: data.corePrinciple as AgentProfileSpec["corePrinciple"],
    scopeControl: data.scopeControl as AgentProfileSpec["scopeControl"],
    ambiguityPolicy: data.ambiguityPolicy as AgentProfileSpec["ambiguityPolicy"],
    supportTriggers: data.supportTriggers as AgentProfileSpec["supportTriggers"],
    repositoryAssessment: data.repositoryAssessment as AgentProfileSpec["repositoryAssessment"],
    collaboration: mapCollaboration(collaboration) as unknown as AgentProfileSpec["collaboration"],
    taskTriage: data.taskTriage as AgentProfileSpec["taskTriage"],
    delegationReview: data.delegationReview as AgentProfileSpec["delegationReview"],
    todoDiscipline: data.todoDiscipline as AgentProfileSpec["todoDiscipline"],
    completionGate: data.completionGate as AgentProfileSpec["completionGate"],
    failureRecovery: data.failureRecovery as AgentProfileSpec["failureRecovery"],
    runtimeConfig: mapRuntimeConfig(runtimeConfig) as AgentRuntimeConfig,
    outputContract: mapOutputContract(asOptionalRecord(data.outputContract)) as OutputContract,
    executionPolicy: undefined,
    operations: mapMinimalOperations(asOptionalRecord(data.operations), body),
    templates: mapMinimalTemplates(asOptionalRecord(data.templates), body),
    guardrails: mapGuardrails(asOptionalRecord(data.guardrails), body),
    heuristics:
      data.heuristics ? asStringArray(data.heuristics, "heuristics") : extractBullets(extractSection(body, "Unique Heuristics")),
    antiPatterns:
      data.antiPatterns
        ? asStringArray(data.antiPatterns, "anti_patterns")
        : extractBullets(extractSection(body, "Agent-Specific Anti-patterns")),
    examples: mapExamples(asOptionalRecord(data.examples), body),
    toolSkillStrategy: mapToolSkillStrategy(asOptionalRecord(data.toolSkillStrategy)),
    entryPoint: mapEntryPoint(asOptionalRecord(data.entryPoint)) as unknown as AgentProfileSpec["entryPoint"],
    promptProjection: mapPromptProjection(asOptionalRecord(data.promptProjection)),
    extraSections: {
      ...extraContent,
      ...bodySections,
    },
  };

  return profile;
}

export function mapTeamManifest(filePath: string): TeamManifest {
  const raw = napiParseTeamManifest(filePath) as UnknownRecord;

  const id = asString(raw.id, "id");
  const name = asString(raw.name, "name");
  const mission = asRecord(raw.mission, "mission");
  const scope = asRecord(raw.scope, "scope");
  const leader = asRecord(raw.leader, "leader");
  const workflow = asOptionalRecord(raw.workflow);
  const governance = asRecord(raw.governance, "governance");
  const governanceApprovalPolicy = asRecord(
    governance.approval_policy ?? governance.approvalPolicy,
    "governance.approval_policy",
  );
  const governanceQualityFloor = asRecord(
    governance.quality_floor ?? governance.qualityFloor,
    "governance.quality_floor",
  );
  const agentRuntime = asOptionalRecord(raw.agent_runtime ?? raw.agentRuntime);
  const resolvedWorkflowStages = workflow
    ? asStringArray(workflow.stages, "workflow.stages")
    : [];

  if (resolvedWorkflowStages.length === 0) {
    throw new Error(`${filePath} must define workflow.stages.`);
  }

  const extraContent = omitKeys(raw, KNOWN_TEAM_TOP_LEVEL_KEYS);

  const manifest: TeamManifest & Record<string, unknown> = {
    id,
    version: asString(raw.version, "version"),
    name,
    description: asString(raw.description, "description"),
    mission: {
      objective: asString(mission.objective, "mission.objective"),
      successDefinition: asStringArray(mission.success_definition ?? mission.successDefinition, "mission.success_definition"),
    },
    scope: {
      inScope: asStringArray(scope.in_scope ?? scope.inScope, "scope.in_scope"),
      outOfScope: asStringArray(scope.out_of_scope ?? scope.outOfScope, "scope.out_of_scope"),
    },
    leader: {
      agentRef: asString(leader.agent_ref ?? leader.agentRef, "leader.agent_ref"),
      responsibilities: asStringArray(leader.responsibilities, "leader.responsibilities"),
    },
    members: mapTeamMembers(raw.members),
    workflow: {
      stages: resolvedWorkflowStages,
    },
    governance: {
      instructionPrecedence: asStringArray(
        governance.instruction_precedence ?? governance.instructionPrecedence,
        "governance.instruction_precedence",
      ),
      approvalPolicy: {
        requiredFor: asStringArray(
          governanceApprovalPolicy.required_for ?? governanceApprovalPolicy.requiredFor,
          "governance.approval_policy.required_for",
        ),
        allowAssumeFor: asStringArray(
          governanceApprovalPolicy.allow_assume_for ?? governanceApprovalPolicy.allowAssumeFor,
          "governance.approval_policy.allow_assume_for",
        ),
      },
      forbiddenActions: asStringArray(
        governance.forbidden_actions ?? governance.forbiddenActions,
        "governance.forbidden_actions",
      ),
      qualityFloor: {
        requiredChecks: asStringArray(
          governanceQualityFloor.required_checks ?? governanceQualityFloor.requiredChecks,
          "governance.quality_floor.required_checks",
        ),
        evidenceRequired: asBoolean(
          governanceQualityFloor.evidence_required ?? governanceQualityFloor.evidenceRequired,
          "governance.quality_floor.evidence_required",
        ),
      },
      workingRules: asStringArray(
        governance.working_rules ?? governance.workingRules,
        "governance.working_rules",
      ),
    },
    agentRuntime: mapAgentRuntime(agentRuntime),
    tags: raw.tags ? asStringArray(raw.tags, "tags") : [],
    promptProjection: mapPromptProjection(asOptionalRecord(raw.prompt_projection)),
    ...extraContent,
  };

  return manifest;
}

export function mapTeamPolicy(filePath: string): TeamPolicySpec {
  const raw = napiParseTeamPolicy(filePath) as UnknownRecord;

  return {
    id: asOptionalString(raw.id),
    kind: raw.kind === "team-policy" ? "team-policy" : undefined,
    version: asOptionalString(raw.version),
    instructionPrecedence: raw.instruction_precedence as TeamPolicySpec["instructionPrecedence"],
    approvalPolicy: raw.approval_policy as TeamPolicySpec["approvalPolicy"],
    forbiddenActions: raw.forbidden_actions as TeamPolicySpec["forbiddenActions"],
    qualityFloor: raw.quality_floor as TeamPolicySpec["qualityFloor"],
    workingRules: raw.working_rules as TeamPolicySpec["workingRules"],
    promptProjection: mapPromptProjection(asOptionalRecord(raw.prompt_projection)),
  };
}
