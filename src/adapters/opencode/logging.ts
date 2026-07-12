import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { shouldEmitAiyouTeamLog, type AiyouTeamLogLevel } from "../../runtime/logging";

export async function logAiyouTeam(
  ctx: PluginInput | Parameters<Plugin>[0],
  message: string,
  extra?: Record<string, unknown>,
  level: AiyouTeamLogLevel = "info",
): Promise<void> {
  if (!shouldEmitAiyouTeamLog(level)) {
    return;
  }

  await ctx.client.app.log({
    body: {
      service: "aiyou-team",
      level,
      message,
      extra,
    },
  });
}
