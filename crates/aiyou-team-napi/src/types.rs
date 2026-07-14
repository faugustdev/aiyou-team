#![allow(dead_code)]

use serde::{Deserialize, Serialize};

// ── Agent Profile ─────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize)]
pub struct PersonaCore {
    pub temperament: String,
    pub cognitive_style: String,
    pub risk_posture: String,
    pub communication_style: String,
    pub persistence_style: String,
    pub conflict_style: Option<String>,
    pub decision_priorities: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ResponsibilityCore {
    pub description: String,
    pub use_when: Vec<String>,
    pub avoid_when: Vec<String>,
    pub objective: String,
    pub success_definition: Vec<String>,
    pub non_goals: Vec<String>,
    pub in_scope: Vec<String>,
    pub out_of_scope: Vec<String>,
    pub authority: Option<String>,
    pub output_preference: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct AgentMetadata {
    pub id: String,
    pub name: String,
    pub kind: Option<String>,
    pub version: Option<String>,
    pub archetype: Option<String>,
    pub status: Option<String>,
    pub owner: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct PermissionRule {
    pub permission: String,
    pub action: String,
    #[serde(default = "default_pattern")]
    pub pattern: String,
}

fn default_pattern() -> String {
    "*".to_string()
}

#[derive(Debug, Deserialize)]
pub struct AgentRuntimeConfig {
    pub requested_tools: Vec<String>,
    pub permission: Vec<PermissionRule>,
    pub skills: Option<Vec<String>>,
    pub memory: Option<String>,
    pub hooks: Option<String>,
    pub instructions: Option<Vec<String>>,
    pub mcp_servers: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct OutputContract {
    pub tone: String,
    #[serde(alias = "defaultFormat")]
    pub default_format: String,
    #[serde(alias = "updatePolicy")]
    pub update_policy: String,
}

#[derive(Debug, Deserialize)]
pub struct CollaborationBinding {
    #[serde(alias = "agentRef")]
    pub agent_ref: String,
    pub description: String,
    pub runtime_config: Option<AgentRuntimeConfig>,
    pub output_contract: Option<OutputContract>,
}

#[derive(Debug, Deserialize)]
pub struct CollaborationSpec {
    #[serde(default, alias = "defaultConsults")]
    pub default_consults: Vec<serde_yaml::Value>,
    #[serde(default, alias = "defaultHandoffs")]
    pub default_handoffs: Vec<serde_yaml::Value>,
}

#[derive(Debug, Deserialize)]
pub struct EntryPointSpec {
    pub exposure: String,
    #[serde(alias = "selectionDescription")]
    pub selection_description: Option<String>,
    #[serde(alias = "selectionPriority")]
    pub selection_priority: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct ToolSkillStrategySpec {
    pub principles: Option<Vec<String>>,
    #[serde(alias = "preferredOrder")]
    pub preferred_order: Option<Vec<String>>,
    pub avoid: Option<Vec<String>>,
    pub notes: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct ExamplesSpec {
    pub good_fit: Option<Vec<String>>,
    pub bad_fit: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct FitExamples {
    pub good_fit: Option<Vec<String>>,
    pub bad_fit: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct MicroExamples {
    pub ambiguity_resolution: Option<Vec<String>>,
    pub final_closure: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct AgentExamples {
    pub fit: Option<FitExamples>,
    pub micro: Option<MicroExamples>,
    pub good_fit: Option<Vec<String>>,
    pub bad_fit: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct MinimalOperations {
    pub autonomy_level: Option<String>,
    pub stop_conditions: Option<Vec<String>>,
    pub core_operation_skeleton: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct MinimalTemplates {
    pub exploration_checklist: Option<Vec<String>>,
    pub execution_plan: Option<Vec<String>>,
    pub final_report: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct AgentGuardrails {
    pub critical: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct PromptProjectionSpec {
    pub include: Option<Vec<String>>,
    pub exclude: Option<Vec<String>>,
    pub labels: Option<Vec<String>>,
}

/// The raw YAML frontmatter structure for an agent profile.
/// All fields are optional because frontmatter may omit keys (fallback to body markdown).
#[derive(Debug, Deserialize)]
pub struct AgentFrontmatter {
    pub id: Option<String>,
    pub kind: Option<String>,
    pub version: Option<String>,
    pub name: Option<String>,
    pub archetype: Option<String>,
    pub status: Option<String>,
    pub owner: Option<String>,
    pub tags: Option<Vec<String>>,

    pub persona_core: Option<serde_yaml::Value>,
    pub responsibility_core: Option<serde_yaml::Value>,

    pub core_principle: Option<serde_yaml::Value>,
    pub scope_control: Option<serde_yaml::Value>,
    pub ambiguity_policy: Option<serde_yaml::Value>,
    pub support_triggers: Option<serde_yaml::Value>,
    pub repository_assessment: Option<serde_yaml::Value>,

    pub collaboration: Option<serde_yaml::Value>,
    pub task_triage: Option<serde_yaml::Value>,
    pub delegation_review: Option<serde_yaml::Value>,
    pub todo_discipline: Option<serde_yaml::Value>,
    pub completion_gate: Option<serde_yaml::Value>,
    pub failure_recovery: Option<serde_yaml::Value>,

    pub runtime_config: Option<serde_yaml::Value>,
    pub output_contract: Option<serde_yaml::Value>,

    pub operations: Option<serde_yaml::Value>,
    pub templates: Option<serde_yaml::Value>,
    pub guardrails: Option<serde_yaml::Value>,
    pub heuristics: Option<Vec<String>>,
    pub anti_patterns: Option<Vec<String>>,
    pub examples: Option<serde_yaml::Value>,

    pub tool_skill_strategy: Option<serde_yaml::Value>,
    pub entry_point: Option<serde_yaml::Value>,
    pub prompt_projection: Option<serde_yaml::Value>,

    /// Any extra keys not in the known list
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, serde_yaml::Value>,
}

// ── Team Manifest ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TeamMissionSpec {
    pub objective: String,
    #[serde(alias = "successDefinition")]
    pub success_definition: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct TeamScopeSpec {
    #[serde(alias = "inScope")]
    pub in_scope: Vec<String>,
    #[serde(alias = "outOfScope")]
    pub out_of_scope: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct TeamLeaderRef {
    #[serde(alias = "agentRef")]
    pub agent_ref: String,
    pub responsibilities: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct MemberGuidance {
    pub responsibility: String,
    #[serde(alias = "delegateWhen")]
    pub delegate_when: Option<String>,
    #[serde(alias = "delegateMode")]
    pub delegate_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApprovalPolicy {
    #[serde(alias = "requiredFor")]
    pub required_for: Vec<String>,
    #[serde(alias = "allowAssumeFor")]
    pub allow_assume_for: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct QualityFloor {
    #[serde(alias = "requiredChecks")]
    pub required_checks: Vec<String>,
    #[serde(alias = "evidenceRequired")]
    pub evidence_required: bool,
}

#[derive(Debug, Deserialize)]
pub struct TeamGovernance {
    #[serde(alias = "instructionPrecedence")]
    pub instruction_precedence: Vec<String>,
    #[serde(alias = "approvalPolicy")]
    pub approval_policy: Option<ApprovalPolicy>,
    #[serde(alias = "forbiddenActions")]
    pub forbidden_actions: Vec<String>,
    #[serde(alias = "qualityFloor")]
    pub quality_floor: Option<QualityFloor>,
    #[serde(alias = "workingRules")]
    pub working_rules: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct TeamWorkflow {
    pub stages: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct AgentModelOverride {
    pub model: Option<String>,
    pub variant: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AgentRuntimeModelConfig {
    pub provider: Option<String>,
    pub model: String,
    pub temperature: Option<f64>,
    #[serde(alias = "topP")]
    pub top_p: Option<f64>,
    pub variant: Option<String>,
    pub options: Option<std::collections::HashMap<String, serde_yaml::Value>>,
    #[serde(alias = "fallbackModels")]
    pub fallback_models: Option<Vec<String>>,
    #[serde(alias = "fallbackToHostDefault")]
    pub fallback_to_host_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct TeamModelConfigOverride {
    pub model_preset: Option<String>,
    pub fallback: Option<String>,
    pub fallback_to_host_default: Option<bool>,
    pub agents: Option<std::collections::HashMap<String, AgentModelOverride>>,
}

#[derive(Debug, Deserialize)]
pub struct TeamManifest {
    pub id: String,
    pub version: String,
    pub name: String,
    pub description: String,
    pub mission: TeamMissionSpec,
    pub scope: TeamScopeSpec,
    pub leader: TeamLeaderRef,
    pub members: TeamMembers,
    pub workflow: TeamWorkflow,
    pub governance: TeamGovernance,
    pub agent_runtime: Option<std::collections::HashMap<String, AgentRuntimeModelConfig>>,
    pub tags: Option<Vec<String>>,
    pub prompt_projection: Option<PromptProjectionSpec>,
    pub model_config_override: Option<TeamModelConfigOverride>,
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, serde_yaml::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum TeamMembers {
    Legacy(Vec<LegacyMemberEntry>),
    Map(std::collections::HashMap<String, MemberGuidance>),
}

#[derive(Debug, Deserialize)]
pub struct LegacyMemberEntry {
    #[serde(alias = "agentRef")]
    pub agent_ref: String,
    pub role: String,
}

// ── Team Policy ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TeamPolicy {
    pub id: Option<String>,
    pub kind: Option<String>,
    pub version: Option<String>,
    pub instruction_precedence: Option<serde_yaml::Value>,
    pub approval_policy: Option<serde_yaml::Value>,
    pub forbidden_actions: Option<serde_yaml::Value>,
    pub quality_floor: Option<serde_yaml::Value>,
    pub working_rules: Option<serde_yaml::Value>,
    pub prompt_projection: Option<PromptProjectionSpec>,
}

// ── Frontmatter Parse Result ─────────────────────────────────────

#[derive(Debug)]
pub struct FrontmatterResult {
    pub data: serde_yaml::Value,
    pub body: String,
}

pub const KNOWN_AGENT_TOP_LEVEL_KEYS: &[&str] = &[
    "id", "kind", "version", "name", "archetype", "status", "owner", "tags",
    "persona_core", "responsibility_core",
    "core_principle", "scope_control", "ambiguity_policy", "support_triggers",
    "collaboration", "repository_assessment", "task_triage", "delegation_review",
    "todo_discipline", "completion_gate", "failure_recovery",
    "runtime_config", "output_contract",
    "operations", "templates", "guardrails", "heuristics", "anti_patterns", "examples",
    "tool_skill_strategy", "entry_point", "prompt_projection",
];

pub const REMOVED_AGENT_FIELDS: &[&str] = &[
    "role_boundary", "roleBoundary",
    "workflow_override", "workflowOverride",
    "autonomy_level", "autonomyLevel",
    "stop_conditions", "stopConditions",
    "projection_schema", "projectionSchema",
];

pub const REMOVED_TEAM_FIELDS: &[&str] = &[
    "status", "owner", "modes",
    "working_mode", "workingMode",
    "implementation_bias", "implementationBias",
    "ownership_routing", "ownershipRouting",
    "role_boundaries", "roleBoundaries",
    "structure_principles", "structurePrinciples",
    "projection_schema", "projectionSchema",
];
