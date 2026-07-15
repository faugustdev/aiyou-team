import { createRequire } from "node:module";
import path from "node:path";

let _napi: NapiBindings | null = null;

interface NapiBindings {
  parseAgentFile(filePath: string): string;
  parseTeamManifest(filePath: string): string;
  parseTeamPolicy(filePath: string): string;
  loadTeamDirectory(dirPath: string): string;
  validateAgentFile(filePath: string): string;
  validateTeamDirectory(dirPath: string): string;
  validateTeamManifestFile(filePath: string): string;
  validateTeamPolicyFile(filePath: string): string;
}

function resolveBinaryNames(): string[] {
  const base = "aiyou-team-napi." + process.platform + "-" + process.arch;

  if (process.platform === "linux") {
    return [`${base}-gnu.node`, `${base}.node`];
  }

  return [`${base}.node`];
}

function loadBindings(): NapiBindings {
  if (_napi) return _napi;

  const binaryNames = resolveBinaryNames();

  // __dirname is either src/napi/ (dev) or dist/src/napi/ (prod).
  // Walk up to find project root (contains package.json).
  let dir = __dirname;
  for (let i = 0; i < 4; i++) {
    for (const binaryName of binaryNames) {
      const candidate = path.resolve(dir, binaryName);
      try {
        const bindings = createRequire(candidate)(candidate) as NapiBindings;
        _napi = bindings;
        return bindings;
      } catch {
        // continue to next candidate
      }
    }
    dir = path.dirname(dir);
  }

  // Last resort: crate directory
  for (let i = 0; i < 4; i++) {
    for (const binaryName of binaryNames) {
      const candidate = path.resolve(__dirname, ...Array(i).fill(".."), "crates", "aiyou-team-napi", binaryName);
      try {
        const bindings = createRequire(candidate)(candidate) as NapiBindings;
        _napi = bindings;
        return bindings;
      } catch {
        continue;
      }
    }
  }

  throw new Error(
    "Cannot find aiyou-team-napi binary for " + process.platform + "-" + process.arch + ". " +
    "Run `npx napi build --platform --release --package aiyou-team-napi -o .` first.",
  );
}

function getBindings(): NapiBindings {
  return loadBindings();
}

export function parseAgentFile(filePath: string): Record<string, unknown> {
  return JSON.parse(getBindings().parseAgentFile(filePath)) as Record<string, unknown>;
}

export function parseTeamManifest(filePath: string): Record<string, unknown> {
  return JSON.parse(getBindings().parseTeamManifest(filePath)) as Record<string, unknown>;
}

export function parseTeamPolicy(filePath: string): Record<string, unknown> {
  return JSON.parse(getBindings().parseTeamPolicy(filePath)) as Record<string, unknown>;
}

export function loadTeamDirectory(dirPath: string): Record<string, unknown> {
  return JSON.parse(getBindings().loadTeamDirectory(dirPath)) as Record<string, unknown>;
}

export function validateAgentFile(filePath: string): Record<string, unknown>[] {
  return JSON.parse(getBindings().validateAgentFile(filePath)) as Record<string, unknown>[];
}

export function validateTeamDirectory(dirPath: string): Record<string, unknown>[] {
  return JSON.parse(getBindings().validateTeamDirectory(dirPath)) as Record<string, unknown>[];
}

export function validateTeamManifestFile(filePath: string): Record<string, unknown>[] {
  return JSON.parse(getBindings().validateTeamManifestFile(filePath)) as Record<string, unknown>[];
}

export function validateTeamPolicyFile(filePath: string): Record<string, unknown>[] {
  return JSON.parse(getBindings().validateTeamPolicyFile(filePath)) as Record<string, unknown>[];
}
