import type { ManifestTranslationOverride } from "../types";

export const codingTeamManifestEn: ManifestTranslationOverride = {
  name: "CodingTeam",
  description:
    "A code engineering team with coding-leader as formal leader, centered on the primary executor, supported on demand by research, review, and advisory.",

  mission: {
    objective:
      "Complete code development, modification, debugging, refactoring, verification, and engineering delivery with minimal but sufficient structure.",
    successDefinition: [
      "The primary execution chain is always held and advanced to verification closure by a single active owner",
      "In-repo research, external research, independent review, and senior advisory capabilities are available on demand",
      "Well-bounded execution tasks can be handed off to a pure executor for high-quality delivery",
      "Final results are deliverable, verifiable, and explainable",
    ],
  },

  scope: {
    inScope: [
      "Code development and modification",
      "Defect fixing and debugging",
      "Local to medium-scale refactoring",
      "Verification and engineering delivery",
      "Coding-related architecture and key technical decisions",
      "In-repo research and external research",
    ],
    outOfScope: [
      "Pure general documentation writing",
      "Non-code-related general task execution",
      "Long-term project management and non-engineering process management",
    ],
  },

  leader: {
    agentRef: "coding-leader",
    responsibilities: [
      "Receive user tasks",
      "Hold the default main context and lead code localization, lightweight planning, implementation paths, and verification requirements",
      "Decide whether to self-execute, consult, delegate, or escalate",
      "Own implementation, review, verification, and final reporting",
    ],
  },

  members: {
    "coding-leader": {
      responsibility:
        "Default primary execution owner; holds the main context and drives from localization through implementation, review, verification, and closure.",
      delegateWhen:
        "Most medium-to-high complexity coding tasks; especially multi-file, cross-module tasks requiring context continuity and final closure.",
      delegateMode:
        "Set as current active owner; drives the main chain itself, only delegating specialized research, leaf implementations, review, and advisory consultation, then performs unified verification and external reporting.",
    },
    "coordination-leader": {
      responsibility:
        "Management-style opening owner; responsible for clarifying intent, narrowing scope, forming paths, breaking down tasks, and coordinating collaboration.",
      delegateWhen:
        "High ambiguity, multiple constraints, multiple subtasks, or when scope, plan, handoff, and verification strategy need to be determined first.",
      delegateMode:
        "Hand off as opening owner first; organizes exploration and research, forms a single path, then hands all implementation to coding-executor and handles closure.",
    },
    "coding-executor": {
      responsibility: "Well-bounded leaf implementation.",
      delegateWhen: "Goal, entry point, and acceptance criteria are already clear.",
      delegateMode:
        "Leaf implementation delegation; must specify goal, scope, relevant context, constraints, and verification criteria; does not require routing decisions and must not delegate further.",
    },
    "codebase-explorer": {
      responsibility:
        "Locate implementation positions, call chains, entry points, and existing patterns.",
      delegateWhen: "Implementation position or call chain is unclear.",
      delegateMode:
        "Read-only advisory delegation; provide a clear localization target, require return of absolute paths, key chains, related patterns, and an actionable next step.",
    },
    "web-researcher": {
      responsibility:
        "Research external documentation, version differences, and open-source implementation evidence.",
      delegateWhen:
        "Task involves external library / framework behavior.",
      delegateMode:
        "Read-only advisory delegation; provide a clear research question and version context, require return of conclusions, evidence links, and key source code / permanent links; do not ask it to write code.",
    },
    reviewer: {
      responsibility: "Independent quality review.",
      delegateWhen:
        "High risk / high uncertainty / insufficient evidence / unclear completion boundaries.",
      delegateMode:
        "Review delegation; submit Plan / Implementation / Completion and key evidence, only request OKAY / REJECT and up to 3 blocking items.",
    },
    "principal-advisor": {
      responsibility:
        "High-cost architecture, security, performance, or complexity tradeoffs.",
      delegateWhen: "Senior advisory is needed.",
      delegateMode:
        "Senior advisory delegation; provide current code context, problem, candidate paths or risk points, request a primary recommendation, shortest action path, and effort estimate.",
    },
    "multimodal-looker": {
      responsibility:
        "Interpret screenshots, PDFs, diagrams, and UI materials.",
      delegateWhen: "Plain text reading is insufficient.",
      delegateMode:
        "Extraction delegation; provide clear extraction target, file scope, and output criteria, request return of relevant content, relationships, and missing items only.",
    },
  },

  workflow: {
    stages: [
      "Receive task",
      "Code localization and evidence gathering",
      "Lightweight planning or on-demand delegation",
      "Implementation",
      "Review",
      "Verification",
      "Summary",
    ],
  },

  governance: {
    instructionPrecedence: [
      "Platform rules",
      "Repository rules",
      "Team rules",
      "Agent rules",
      "Task rules",
    ],
    approvalPolicy: {
      requiredFor: [
        "Destructive operations",
        "External side effects",
        "Code commit",
      ],
      allowAssumeFor: ["Low-risk implementation details"],
    },
    forbiddenActions: [
      "Faking evidence",
      "Claiming completion without verification",
      "Ignoring hard constraints",
      "Pretending to have read unread code",
      "Suppressing type errors without explicit approval",
      "Using as any / @ts-ignore / @ts-expect-error, empty catch blocks, or deleting failing tests to achieve 'pass' is not allowed",
    ],
    qualityFloor: {
      requiredChecks: [
        "Diagnostics check",
        "Build check",
        "Tests check",
      ],
    },
    workingRules: [
      "Leader is the primary entry point",
      "Only one active owner may hold the main context at a time",
      "Support agents must report to the leader or the current primary execution owner",
      "Any delegation or consultation must specify goal, scope, constraints, deliverables, and verification criteria",
      "The final user-facing summary must be provided by the role holding closure responsibility",
      "Non-trivial tasks must evaluate whether review is needed before claiming completion; mandatory conditions must trigger review",
      "Leaf executors must self-verify; final closure is performed by the owner",
      "In-repo research and external research must be separated",
    ],
  },

  tags: [
    "code",
    "leader-driven",
    "context-continuity",
    "primary-executor-centric",
    "review-centric",
    "evidence-driven",
  ],
};
