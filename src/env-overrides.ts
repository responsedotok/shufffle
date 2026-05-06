import type { ConfigType } from './lib/types/config.js';

export interface EnvOverrides {
  host?: string;
  port?: number;
}

export function envOverrides(): EnvOverrides {
  const overrides: EnvOverrides = {};
  const warnings: string[] = [];
  const rawPort = process.env.PORT;

  if (rawPort !== undefined) {
    const trimmed = rawPort.trim();
    const parsed = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      warnings.push(
        `PORT value must be an integer between 1 - 65535.\nRun picked up ${rawPort}`,
      );
    } else {
      overrides.port = parsed;
    }
  }

  const rawHost = process.env.HOST;

  if (rawHost !== undefined) {
    if (rawHost.trim() === '') {
      warnings.push(`HOST value cannot be empty.\nRun picked up ${rawHost}`);
    } else {
      overrides.host = rawHost.trim();
    }
  }

  for (const w of warnings) {
    process.stdout.write(`--- [shufffle] WARNING --- ${w}\n`);
  }

  return overrides;
}

/**
 * Apply any valid overrides from .env to the given config.
 *
 * @param config The config to apply overrides to.
 * @returns The config with any valid overrides applied.
 */
export function applyEnvOverrides(
  config: ConfigType,
  overrides: EnvOverrides,
): ConfigType {
  if (Object.keys(overrides).length === 0) return config;
  return { ...config, ...overrides };
}
