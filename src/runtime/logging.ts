export type AiyouTeamLogLevel = "debug" | "info" | "warn" | "error";

export interface AiyouTeamLogEvent {
  level?: AiyouTeamLogLevel;
  message: string;
  extra?: Record<string, unknown>;
}

export function isAiyouTeamLoggingEnabled(): boolean {
  const raw = process.env.AIYOU_TEAM_LOG?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on" || raw === "debug";
}

export function shouldEmitAiyouTeamLog(level: AiyouTeamLogLevel = "info"): boolean {
  return level === "error" || level === "warn" || isAiyouTeamLoggingEnabled();
}
