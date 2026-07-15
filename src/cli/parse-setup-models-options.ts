export interface SetupModelsOptions {
  configPath?: string;
  globalConfigRoot?: string;
  dryRun: boolean;
}

function getOptionValue(argv: string[], index: number, name: string): string {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}.`);
  }

  return value;
}

export function parseSetupModelsOptions(argv: string[]): SetupModelsOptions {
  let configPath: string | undefined;
  let globalConfigRoot: string | undefined;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--config-path" || arg === "--config") {
      configPath = getOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--config-path=")) {
      configPath = arg.slice("--config-path=".length);
      continue;
    }

    if (arg.startsWith("--config=")) {
      configPath = arg.slice("--config=".length);
      continue;
    }

    if (arg === "--global-config-root") {
      globalConfigRoot = getOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--global-config-root=")) {
      globalConfigRoot = arg.slice("--global-config-root=".length);
      continue;
    }

    throw new Error(`Unknown setup-models option '${arg}'.`);
  }

  return {
    configPath,
    globalConfigRoot,
    dryRun,
  };
}
