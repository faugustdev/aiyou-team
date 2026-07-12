import type { TranslationMap } from "../types";
import { codingLeaderEs } from "./coding-leader";
import { coordinationLeaderEs } from "./coordination-leader";
import { codingExecutorEs } from "./coding-executor";
import { reviewerEs } from "./reviewer";
import { principalAdvisorEs } from "./principal-advisor";
import { codebaseExplorerEs } from "./codebase-explorer";
import { webResearcherEs } from "./web-researcher";
import { multimodalLookerEs } from "./multimodal-looker";

export const codingTeamEsTranslations: TranslationMap = {
  "coding-leader": codingLeaderEs,
  "coordination-leader": coordinationLeaderEs,
  "coding-executor": codingExecutorEs,
  "reviewer": reviewerEs,
  "principal-advisor": principalAdvisorEs,
  "codebase-explorer": codebaseExplorerEs,
  "web-researcher": webResearcherEs,
  "multimodal-looker": multimodalLookerEs,
};
