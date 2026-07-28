// Smoke test for the just-published @aiyou-dev/team package.
//
// Polls the npm registry document for the optional platform package that
// matches the current runner (os/cpu) and waits until both the version
// metadata AND the tarball are reachable before running a real end-user
// install. Racing registry propagation via `npm install` is unreliable: a
// missing optional dep is logged as a warning and silently skipped, so the
// install "succeeds" with 26 packages instead of 27 and the failure only
// surfaces in the follow-up assertion.
//
// Usage: node ./scripts/smoke-install-from-registry.mjs [version]
//   version (optional) — defaults to the version in ./package.json.
//
// Exit code 0 → registry + install + napi surface all healthy.
// Exit code 1 → either registry never propagated, install failed, or the
//                napi binary did not expose the expected API.

import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const packageRoot = process.cwd();
const REGISTRY = "https://registry.npmjs.org";
const MAX_ATTEMPTS = 18;
const RETRY_DELAY_MS = 15_000;

// `napi.targets` in package.json declares the 4 triples we publish. Map
// process.platform / process.arch to the matching @aiyou-dev/team-napi-*
// suffix. Keep this list in sync with package.json#napi.targets — the
// registry check below is meaningless if the suffix we wait for doesn't
// correspond to a published package.
function detectPlatformPackageSuffix() {
  const { platform, arch } = process;
  if (platform === "linux" && arch === "x64") return "linux-x64-gnu";
  if (platform === "linux" && arch === "arm64") return "linux-arm64-gnu";
  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "darwin-x64";
  throw new Error(`Unsupported runner platform: ${platform}-${arch}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    shell: process.platform === "win32",
    stdio: options.stdio ?? "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with status ${result.status ?? 1}`,
    );
  }
  return result;
}

function readVersion(arg) {
  if (arg) return arg;
  const manifest = JSON.parse(
    readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  );
  return manifest.version;
}

async function waitForPlatformPackage(packageName, version) {
  // encodeURIComponent encodes the slash in the scoped name as %2F, which is
  // the form the npm registry's package-level endpoint expects.
  const docUrl = `${REGISTRY}/${encodeURIComponent(packageName)}/${version}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let docOk = false;
    let unpackedSize = null;
    let tarball = null;
    let docStatus = null;
    let tarballStatus = null;

    try {
      const docRes = await fetch(docUrl, {
        headers: { accept: "application/json" },
      });
      docStatus = docRes.status;
      if (docRes.ok) {
        const doc = await docRes.json();
        const dist = doc?.dist ?? {};
        if (typeof dist.unpackedSize === "number" && dist.unpackedSize > 0) {
          unpackedSize = dist.unpackedSize;
        }
        if (typeof dist.tarball === "string" && dist.tarball.length > 0) {
          tarball = dist.tarball;
        }
        if (unpackedSize !== null && tarball !== null) {
          const tarballRes = await fetch(tarball, { method: "HEAD" });
          tarballStatus = tarballRes.status;
          if (tarballRes.ok) {
            docOk = true;
          }
        }
      }
    } catch (err) {
      // Network blip — treat as a transient failure and retry.
      console.log(`  registry fetch error: ${err.message}`);
    }

    if (docOk) {
      console.log(
        `Registry reports ${packageName}@${version} is fully available ` +
          `(metadata HTTP ${docStatus}, tarball HTTP ${tarballStatus}, ` +
          `unpackedSize=${unpackedSize}).`,
      );
      return;
    }

    const detail =
      `registry=${docStatus ?? "n/a"}, ` +
      `unpackedSize=${unpackedSize ?? "n/a"}, ` +
      `tarball=${tarballStatus ?? "n/a"}`;
    if (attempt < MAX_ATTEMPTS) {
      console.log(
        `Attempt ${attempt}/${MAX_ATTEMPTS}: ${packageName}@${version} not yet ` +
          `fully available (${detail}); retrying in ${RETRY_DELAY_MS / 1000}s...`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    } else {
      console.log(`Attempt ${attempt}/${MAX_ATTEMPTS}: ${detail}`);
    }
  }

  throw new Error(
    `Platform package ${packageName}@${version} did not become available ` +
      `after ${MAX_ATTEMPTS} attempts (~${(MAX_ATTEMPTS * RETRY_DELAY_MS) / 1000}s). ` +
      `The npm registry CDN may be slow to propagate the publish.`,
  );
}

async function verifyInstall(version, platformPackage) {
  const tempRoot = mkdtempSync(
    path.join(os.tmpdir(), "aiyou-team-registry-smoke-"),
  );
  try {
    writeFileSync(
      path.join(tempRoot, "package.json"),
      `${JSON.stringify({ name: "registry-smoke", version: "0.0.0", private: true }, null, 2)}\n`,
      "utf8",
    );

    // `--no-audit --no-fund` keep the install output focused on what we care
    // about. We deliberately do NOT pass `--omit=optional` so the platform
    // package is actually pulled.
    run(
      "npm",
      ["install", "--no-audit", "--no-fund", `@aiyou-dev/team@${version}`],
      { cwd: tempRoot },
    );

    const installed = readdirSync(path.join(tempRoot, "node_modules", "@aiyou-dev"), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("team-napi-"))
      .map((entry) => entry.name);

    if (installed.length === 0) {
      throw new Error(
        `After the registry confirmed ${platformPackage}@${version} was available, ` +
          `npm install did not place any team-napi-* package under node_modules/@aiyou-dev.`,
      );
    }
    console.log(`Installed optional platform package(s): ${installed.join(", ")}`);

    // The runner should have pulled exactly the package we waited for. If a
    // different team-napi-* landed (cross-arch install, or os/cpu filtering
    // redirected it), the napi binary won't load on this runner — fail loudly.
    const bareName = platformPackage.replace(/^@aiyou-dev\//, "");
    if (!installed.includes(bareName)) {
      throw new Error(
        `Expected ${bareName} to be installed for ${process.platform}-${process.arch}, ` +
          `but node_modules contains: ${installed.join(", ")}.`,
      );
    }

    const require = createRequire(import.meta.url);
    const napi = require(path.join(tempRoot, "node_modules", platformPackage));
    if (typeof napi.validateTeamManifestFile !== "function") {
      throw new Error(
        `Native napi binary from ${platformPackage} did not expose validateTeamManifestFile.`,
      );
    }

    console.log(
      `Installed package smoke OK; native napi loaded via ${platformPackage}.`,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const version = readVersion(process.argv[2]);
  const platformPackage = `@aiyou-dev/team-napi-${detectPlatformPackageSuffix()}`;
  console.log(
    `Detected runner platform: ${process.platform}-${process.arch} → ${platformPackage}@${version}`,
  );

  await waitForPlatformPackage(platformPackage, version);
  await verifyInstall(version, platformPackage);

  console.log("smoke-install-from-registry: PASS");
}

main().catch((err) => {
  console.error(`smoke-install-from-registry: FAIL — ${err.message}`);
  process.exit(1);
});
