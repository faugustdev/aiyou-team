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

function resolvePlatformPackageName(): string | null {
  // Map Node process.platform/process.arch to the matching
  // `@aiyou-dev/team-napi-<triple>` optional package, if any.
  if (process.platform === "darwin") {
    if (process.arch === "arm64") return "@aiyou-dev/team-napi-darwin-arm64";
    if (process.arch === "x64") return "@aiyou-dev/team-napi-darwin-x64";
    return null;
  }

  if (process.platform === "linux") {
    // napi-rs targets the GNU libc variants; musl falls back to the source build path below.
    if (process.arch === "x64") return "@aiyou-dev/team-napi-linux-x64-gnu";
    if (process.arch === "arm64") return "@aiyou-dev/team-napi-linux-arm64-gnu";
    return null;
  }

  return null;
}

function tryLoadFromOptionalPackage(): NapiBindings | null {
  const packageName = resolvePlatformPackageName();
  if (!packageName) return null;

  // `__filename` is provided by Node CommonJS; this module compiles to CJS
  // (the package does not declare `"type": "module"`), so we use it instead of
  // `import.meta.url` to remain compatible with the existing build output.
  const requireFromHere = createRequire(__filename);

  try {
    const mod = requireFromHere(packageName);
    if (mod && typeof mod === "object") {
      return mod as NapiBindings;
    }
  } catch {
    // optionalDependencies are best-effort; fall through to filesystem search
  }

  return null;
}

function loadBindings(): NapiBindings {
  if (_napi) return _napi;

  // 1. Optional platform-specific npm package (preferred; ships prebuilt .node).
  const fromOptional = tryLoadFromOptionalPackage();
  if (fromOptional) {
    _napi = fromOptional;
    return fromOptional;
  }

  const binaryNames = resolveBinaryNames();

  // 2. __dirname is either src/napi/ (dev) or dist/src/napi/ (prod).
  //    Walk up to find project root (contains package.json).
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

  // 3. Last resort: crate directory (local Rust source build).
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
