import { readFileSync, readdirSync, copyFileSync, existsSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

const packageRoot = process.cwd();
const packageJsonPath = path.join(packageRoot, "package.json");
const packagesRoot = path.join(packageRoot, "packages");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readCurrentVersion() {
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return parsed.version;
}

function bumpVersion(baseVersion, bump) {
  const stable = baseVersion.split("-")[0];
  const [major, minor, patch] = stable.split(".").map((value) => Number.parseInt(value, 10));

  if (bump === "major") {
    return `${major + 1}.0.0`;
  }

  if (bump === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

function fetchRegistryLatestVersion() {
  return new Promise((resolve) => {
    https.get("https://registry.npmjs.org/@aiyou-dev%2Fteam/latest", (response) => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        raw += chunk;
      });
      response.on("end", () => {
        try {
          const parsed = JSON.parse(raw);
          resolve(typeof parsed.version === "string" ? parsed.version : undefined);
        } catch {
          resolve(undefined);
        }
      });
    }).on("error", () => resolve(undefined));
  });
}

function resolveDistTag(version, explicitTag) {
  if (explicitTag) {
    return explicitTag;
  }

  const prerelease = version.match(/-([a-zA-Z][a-zA-Z0-9-]*)(?:\.|$)/);
  return prerelease ? prerelease[1] : "latest";
}

// Resolve which `.node` artifact to embed into each optional platform package.
// Each target triple from `package.json`#napi.targets maps to one of the
// platform package directories under `packages/`.
function resolveArtifactFilename(platformPackageName) {
  // Triples follow the napi-rs convention used by `napi build --platform`.
  if (platformPackageName.endsWith("darwin-arm64")) return "aiyou-team-napi.darwin-arm64.node";
  if (platformPackageName.endsWith("darwin-x64")) return "aiyou-team-napi.darwin-x64.node";
  if (platformPackageName.endsWith("linux-x64-gnu")) return "aiyou-team-napi.linux-x64-gnu.node";
  if (platformPackageName.endsWith("linux-arm64-gnu")) return "aiyou-team-napi.linux-arm64-gnu.node";
  return null;
}

function stagePlatformPackageArtifacts() {
  if (!existsSync(packagesRoot)) return [];

  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const optional = manifest.optionalDependencies ?? {};
  const entries = [];

  for (const dirEntry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!dirEntry.isDirectory()) continue;

    const packageDir = path.join(packagesRoot, dirEntry.name);
    const platformManifestPath = path.join(packageDir, "package.json");
    if (!existsSync(platformManifestPath)) continue;

    const platformManifest = JSON.parse(readFileSync(platformManifestPath, "utf8"));
    const artifactFilename = resolveArtifactFilename(platformManifest.name);
    if (!artifactFilename) {
      console.warn(`Skipping platform package '${platformManifest.name}': no artifact mapping.`);
      continue;
    }

    // Source artifact lives next to the root package.json after `napi build --platform --release`.
    const sourceArtifact = path.join(packageRoot, artifactFilename);
    if (!existsSync(sourceArtifact)) {
      console.warn(`Skipping platform package '${platformManifest.name}': artifact '${artifactFilename}' not found in package root. Build with \`napi build --platform --release --package aiyou-team-napi -o .\` first.`);
      continue;
    }

    copyFileSync(sourceArtifact, path.join(packageDir, artifactFilename));

    entries.push({
      name: platformManifest.name,
      expectedVersion: optional[platformManifest.name] ?? manifest.version,
      directory: packageDir
    });
  }

  return entries;
}

const args = parseArgs({
  options: {
    bump: { type: "string" },
    version: { type: "string" },
    tag: { type: "string" },
    publish: { type: "boolean" },
    dryRun: { type: "boolean" },
    // Skip local preflight (typecheck, test, simulators). Use this in CI where
    // the preflight has already been validated by a dedicated job, so the
    // release job only stages artifacts and publishes.
    skipPreflight: { type: "boolean" },
    // Skip pack:release and smoke:package. Useful in CI matrix jobs that only
    // need to publish a single platform package.
    skipPackage: { type: "boolean" },
    // Only stage and publish a single platform package by directory name
    // (e.g. "team-napi-darwin-arm64"). The root package is never published
    // in this mode. Use this to split platform publication across CI matrix
    // jobs that each compiled their own .node artifact.
    onlyPlatform: { type: "string" },
    // Skip the version bump entirely. Use this when CI has already updated
    // package.json to the target version (e.g. via set-version.mjs in a
    // previous job).
    noBump: { type: "boolean" },
  },
  allowPositionals: false,
});

const bump = args.values.bump ?? "patch";

if (!["patch", "minor", "major"].includes(bump)) {
  console.error(`Unsupported bump '${bump}'. Use patch, minor, or major.`);
  process.exit(1);
}

const currentVersion = readCurrentVersion();
const registryVersion = await fetchRegistryLatestVersion();
const nextVersion = args.values.version
  ?? bumpVersion(registryVersion ?? currentVersion, bump);
const distTag = resolveDistTag(nextVersion, args.values.tag);
const dryRun = Boolean(args.values.dryRun);
const shouldPublish = Boolean(args.values.publish) && !dryRun;
const skipPreflight = Boolean(args.values.skipPreflight);
const skipPackage = Boolean(args.values.skipPackage);
const onlyPlatform = args.values.onlyPlatform;
const noBump = Boolean(args.values.noBump);

if (skipPreflight && skipPackage) {
  console.warn("Both --skipPreflight and --skipPackage are set; running only stage + publish.");
}

console.log(`Current version: ${currentVersion}`);
console.log(`Registry latest: ${registryVersion ?? "unavailable"}`);
console.log(`Next version: ${nextVersion}`);
console.log(`Dist tag: ${distTag}`);
console.log(`Publish mode: ${shouldPublish ? "npm publish" : "prepare only"}`);
console.log(`Preflight: ${skipPreflight ? "skipped" : "enabled"}`);
console.log(`Pack + smoke: ${skipPackage ? "skipped" : "enabled"}`);
if (onlyPlatform) {
  console.log(`Only platform package: ${onlyPlatform}`);
}

if (!noBump) {
  run("node", ["./scripts/set-version.mjs", nextVersion]);
}

if (!skipPreflight) {
  run("npm", ["run", "typecheck"]);
  run("npm", ["run", "test"]);
  run("npm", ["run", "simulate:opencode"]);
  run("npm", ["run", "simulate:compact"]);
}

if (!skipPackage) {
  run("npm", ["run", "pack:release"]);
  run("npm", ["run", "smoke:package"]);
}

const allPlatformPackages = stagePlatformPackageArtifacts();
const platformPackages = onlyPlatform
  ? allPlatformPackages.filter((entry) => path.basename(entry.directory) === onlyPlatform)
  : allPlatformPackages;

if (onlyPlatform && platformPackages.length === 0) {
  console.error(`--onlyPlatform '${onlyPlatform}' did not match any platform package directory under ${packagesRoot}.`);
  console.error(`Available: ${allPlatformPackages.map((entry) => path.basename(entry.directory)).join(", ")}`);
  process.exit(1);
}

// In publish mode, every platform package listed in optionalDependencies MUST
// have its native artifact staged. Publishing the root without all platform
// packages would leave users on missing platforms with a broken install
// (the optional package would 404). In dry-run mode we keep the warning
// because the operator may be running locally without all toolchains.
if (shouldPublish && !onlyPlatform) {
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const optional = manifest.optionalDependencies ?? {};
  const missing = [];
  for (const pkgName of Object.keys(optional)) {
    const entry = allPlatformPackages.find((e) => e.name === pkgName);
    if (!entry) missing.push(pkgName);
  }
  if (missing.length > 0) {
    console.error(`::error::Cannot publish: missing native artifacts for platform packages:`);
    for (const name of missing) {
      console.error(`  - ${name} (expected aiyou-team-napi.${name.replace('@aiyou-dev/team-napi-', '')}.node)`);
    }
    console.error(`Build them with 'napi build --platform --release --package aiyou-team-napi -o .' on each target platform.`);
    process.exit(1);
  }
}

if (platformPackages.length > 0) {
  console.log(`\nStaged ${platformPackages.length} platform package(s) with native artifacts:`);
  for (const entry of platformPackages) {
    console.log(`  - ${entry.name}@${entry.expectedVersion}`);
  }
}

if (dryRun || !shouldPublish) {
  console.log("\nRelease preparation completed. No npm publish was performed.");
  if (!onlyPlatform) {
    console.log(`Next manual step: npm publish --access public --provenance --tag ${distTag}`);
  }
  if (platformPackages.length > 0) {
    console.log(`Then publish each platform package:`);
    for (const entry of platformPackages) {
      console.log(`  (cd ${path.relative(process.cwd(), entry.directory)} && npm publish --access public --provenance --tag ${distTag})`);
    }
  }
  process.exit(0);
}

if (!onlyPlatform) {
  run("npm", ["publish", "--access", "public", "--tag", distTag]);
  console.log(`\nPublished aiyou-team@${nextVersion} with dist-tag '${distTag}'.`);
}

for (const entry of platformPackages) {
  console.log(`\nPublishing ${entry.name}@${entry.expectedVersion} ...`);
  run("npm", ["publish", "--access", "public", "--provenance", "--tag", distTag], { cwd: entry.directory });
  console.log(`Published ${entry.name}@${entry.expectedVersion}.`);
}

console.log(`\nRelease ${nextVersion} complete (root + ${platformPackages.length} platform package(s)).`);
