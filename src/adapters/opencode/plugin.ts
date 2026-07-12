import type { Plugin } from "@opencode-ai/plugin";

import { ensureAiyouTeamConfigFile, loadDefaultTeamLibrary } from "../../agent-teams";
import { resolveOpenCodeConfigRoot } from "../../install";
import { createSessionRuntimeBinding, type SessionRuntimeBinding } from "../../runtime";

import { createChatMessageHook } from "./chat-message-hook";
import { createCompactionHook } from "./compaction-hook";
import { createConfigHook, createInitialBootstrap, validateAndLogTeamLibrary } from "./config-hook";
import { createEventHook } from "./event-hook";
import { DelegateStateStore } from "./delegation/store";
import { createDelegateTools } from "./delegation/tools";
import { logAiyouTeam } from "./logging";
import { createSystemTransformHook } from "./system-transform-hook";
import { createToolDefinitionHook, createToolExecuteAfterHook, createToolExecuteBeforeHook } from "./tool-hooks";
import { startBackgroundReleaseRefresh } from "../../update/refresh";

export const OpenCodeAiyouTeamPlugin: Plugin = async (ctx) => {
  const aiyouTeamConfigUpdate = ensureAiyouTeamConfigFile({
    configRoot: resolveOpenCodeConfigRoot(),
    mode: "startup",
  });
  if (aiyouTeamConfigUpdate.changed) {
    await logAiyouTeam(ctx, "aiyou-team auto-repaired Team config", {
      backupPath: aiyouTeamConfigUpdate.backupPath,
      configPath: aiyouTeamConfigUpdate.configPath,
      reason: aiyouTeamConfigUpdate.reason,
    }, "warn");
  }

  const teamLibrary = await loadDefaultTeamLibrary(ctx.worktree);
  await validateAndLogTeamLibrary(ctx, teamLibrary);

  const initial = await createInitialBootstrap(ctx, teamLibrary);
  await logAiyouTeam(ctx, "aiyou-team plugin initialized", {
    worktree: ctx.worktree,
    projectedAgentCount: initial.boot.projectedAgents.length,
    visibleAgentCount: initial.boot.projectedAgents.filter((agent) => !agent.hidden).length,
    defaultAgent: initial.boot.configPatch.defaultAgent,
  });
  startBackgroundReleaseRefresh(ctx);

  let boot = initial.boot;
  let aliasIndex = initial.aliasIndex;
  const bindings = new Map<string, SessionRuntimeBinding>();
  const store = new DelegateStateStore(ctx.worktree);

  return {
    config: createConfigHook({
      ctx,
      teamLibrary,
      getBoot: () => boot,
      setBoot: (next) => {
        boot = next;
      },
      setAliasIndex: (next) => {
        aliasIndex = next;
      },
    }),
    tool: createDelegateTools({
      client: ctx.client,
      store,
      getProjectedAgents: () => boot.projectedAgents,
      getAliasIndex: () => aliasIndex,
      bindings,
    }),
    event: createEventHook(ctx, store),
    "chat.message": createChatMessageHook({
      bindings,
      store,
      getBoot: () => boot,
    }),
    "tool.definition": createToolDefinitionHook(() => boot.projectedAgents),
    "tool.execute.before": createToolExecuteBeforeHook({
      bindings,
      getAliasIndex: () => aliasIndex,
    }),
    "tool.execute.after": createToolExecuteAfterHook(),
    "experimental.chat.system.transform": createSystemTransformHook(
      bindings,
      () => teamLibrary.loadIssues ?? [],
    ),
    "experimental.session.compacting": createCompactionHook(ctx, store),
  };
};

export default OpenCodeAiyouTeamPlugin;
