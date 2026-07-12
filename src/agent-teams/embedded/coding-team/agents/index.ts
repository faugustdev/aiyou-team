import type { AgentProfileSpec } from "../../../../core";
import type { AiyouTeamLanguage } from "../../../constants";
import type { TranslationMap } from "../translations/types";

import { createCodebaseExplorerAgent } from "./codebase-explorer";
import { createCoordinationLeaderAgent } from "./coordination-leader";
import { createCodingExecutorAgent } from "./coding-executor";
import { createCodingLeaderAgent } from "./coding-leader";
import { createMultimodalLookerAgent } from "./multimodal-looker";
import { createPrincipalAdvisorAgent } from "./principal-advisor";
import { createReviewerAgent } from "./reviewer";
import { createWebResearcherAgent } from "./web-researcher";
import { codingTeamEnTranslations } from "../translations/en/index.js";
import { codingTeamEsTranslations } from "../translations/es/index.js";

function applyTranslation(agent: AgentProfileSpec, translations?: TranslationMap): AgentProfileSpec {
  if (!translations) return agent;
  const override = translations[agent.metadata.id];
  if (!override) return agent;
  return deepMerge(agent, override) as AgentProfileSpec;
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

const translationMaps: Record<AiyouTeamLanguage, TranslationMap | undefined> = {
  en: codingTeamEnTranslations,
  es: codingTeamEsTranslations,
};

function loadTranslations(lang: AiyouTeamLanguage): TranslationMap | undefined {
  return translationMaps[lang];
}

export function createCodingTeamAgents(
  language?: AiyouTeamLanguage,
): AgentProfileSpec[] {
  const lang = language ?? "en";
  const translations = loadTranslations(lang);

  const agents = [
    createCodingLeaderAgent(),
    createCodingExecutorAgent(),
    createCoordinationLeaderAgent(),
    createReviewerAgent(),
    createPrincipalAdvisorAgent(),
    createMultimodalLookerAgent(),
    createCodebaseExplorerAgent(),
    createWebResearcherAgent(),
  ];

  if (!translations) return agents;
  return agents.map((agent) => applyTranslation(agent, translations));
}
