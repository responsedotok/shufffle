import process from 'node:process';
import { Config } from '../config/config.js';
import { applyEnvOverrides, envOverrides } from '../env-overrides.js';
import { ProxyServer } from '../lib/services/proxy/proxy-server.js';
import type { ConfigType } from '../lib/types/config.js';
import { Logger } from '../logger/logger.js';
import { printHelp } from './help.js';
import { parseArgs } from './parse-args.js';

/**
 * CLI entrypoint for the proxy server.
 *
 * Parses command-line arguments, optionally prints help, loads configuration,
 * applies environment overrides, starts the proxy server, and registers
 * graceful shutdown handlers.
 */
export async function main(): Promise<void> {
  const { configPath, logLevel, help, env, balancer } = parseArgs(process.argv);

  if (help) {
    printHelp();
    process.exit(0);
  }

  for (const [k, v] of Object.entries(env)) {
    process.env[k] = v;
  }

  const logger = new Logger(logLevel);

  let config: ConfigType;

  try {
    const loaded = await Config.fromFile(configPath);
    config = applyEnvOverrides({ ...loaded } as ConfigType, envOverrides());
    if (balancer) config = { ...config, balancer };
    logger.debug(`Config loaded from ${configPath}:`, { config: configPath });
  } catch (err) {
    logger.error(`Failed to load config from ${configPath}:`, {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  const server = new ProxyServer(config, {
    onRequest({ req, upstream, targetPath }) {
      logger.debug('→ request', {
        method: req.method,
        url: req.url,
        upstream: `${upstream.host}:${upstream.port}`,
        path: targetPath,
      });
      return true;
    },
    onResponse(ctx, statusCode) {
      logger.debug('← response', {
        statusCode,
        url: ctx.req.url,
        method: ctx.req.method,
        upstream: `${ctx.upstream.host}:${ctx.upstream.port}`,
        path: ctx.targetPath,
      });
    },
    onError(error, ctx) {
      logger.error('✗✗✗ proxy error ✗✗✗', {
        error: error.message,
        url: ctx?.req?.url,
        method: ctx?.req?.method,
        upstream: ctx?.upstream
          ? `${ctx.upstream.host}:${ctx.upstream.port}`
          : undefined,
        path: ctx?.targetPath,
      });
    },
  });

  await server.listen();
  logger.debug(
    `Proxy server is listening on ${config.host ?? ''}:${config.port}`,
    {
      port: config.port,
      host: config.host ?? '0.0.0.0',
      routes: config.routes.length,
    },
  );

  for (const sig of ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const) {
    process.on(sig, async () => {
      logger.debug(
        `✗✗✗ Shut Down Mode ✗✗✗\nReceived ${sig}, Commencing shut down!`,
        { signal: sig },
      );
      try {
        await server.close();
        logger.debug('✗✗✗ Graceful shutdown bye ✗✗✗');
        process.exit(0);
      } catch (err) {
        logger.error(
          '✗✗✗ Error during shutdown; what do you think mopopipo ✗✗✗',
          {
            error: err instanceof Error ? err.message : String(err),
          },
        );
      }
    });
  }
}

main().catch((err) => {
  console.error(
    '✗✗✗ Fatal error ✗✗✗',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
