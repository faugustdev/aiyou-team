import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: node ./scripts/set-version.mjs <semver>");
  process.exit(1);
}

const root = process.cwd();

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function bumpManifest(filePath) {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  parsed.version = version;
  writeJson(filePath, parsed);
}

function bumpOptionalDependencies(rootManifestPath) {
  const parsed = JSON.parse(readFileSync(rootManifestPath, "utf8"));
  const optional = parsed.optionalDependencies ?? {};
  let changed = false;
  for (const depName of Object.keys(optional)) {
    if (depName.startsWith("@aiyou-dev/team-napi-")) {
      optional[depName] = version;
      changed = true;
    }
  }
  if (changed) {
    parsed.optionalDependencies = optional;
    writeJson(rootManifestPath, parsed);
  }
}

for (const relativePath of ["package.json", "package-lock.json"]) {
  const filePath = path.join(root, relativePath);
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  parsed.version = version;
  if (relativePath === "package-lock.json" && parsed.packages?.[""]) {
    parsed.packages[""].version = version;
  }
  writeJson(filePath, parsed);
}

// Sync version to every optional platform package directory.
const packagesRoot = path.join(root, "packages");
if (readdirSync(packagesRoot, { withFileTypes: true }).length > 0) {
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(packagesRoot, entry.name, "package.json");
    bumpManifest(manifestPath);
  }
}

// Keep optionalDependencies entries in the root manifest aligned with the
// platform packages we just versioned.
bumpOptionalDependencies(path.join(root, "package.json"));

console.log(`Updated package version to ${version} (root, lockfile, and platform packages)`);
