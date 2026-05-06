import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ConfigType } from '../lib/types/config.js';
import { LoadBalancerStrategy } from '../lib/types/load-balancer-strategy.js';

const VALID_BALANCERS = new Set<string>(Object.values(LoadBalancerStrategy));
const VALID_PROTOCOLS = new Set(['http', 'https']);

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/**
 * Configure global settings.
 *
 * @property {number} port - The port number the server will listen on.
 * @property {string} [host] - The host address the server will bind to (default: '0.0.0.0').
 * @property {Route[]} routes - An array of route configurations.
 * @property {HeaderRules} [headers] - Optional header manipulation rules.
 * @property {LoadBalancerStrategy} [balancer] - Optional load balancing strategy.
 * @property {number} [timeout] - Optional request timeout in milliseconds.
 * @property {boolean} [forwardIp] - Whether to forward the client's IP address.
 * @property {number} [maxBodySize] - Maximum allowed size for request bodies in bytes.
 * @property {{ interval?: number; timeout?: number }} [healthCheck] - Optional health check configuration.
 *
 */

export class Config {
  readonly port: number;
  readonly host: string;
  readonly routes: ConfigType['routes'];
  readonly headers?: ConfigType['headers'];
  readonly balancer?: ConfigType['balancer'];
  readonly timeout?: ConfigType['timeout'];
  readonly forwardIp?: ConfigType['forwardIp'];
  readonly maxBodySize?: ConfigType['maxBodySize'];
  readonly healthCheck?: ConfigType['healthCheck'];

  private constructor(cfg: ConfigType) {
    this.port = cfg.port;
    this.host = cfg.host ?? '0.0.0.0';
    this.routes = cfg.routes;
    this.headers = cfg.headers;
    this.balancer = cfg.balancer;
    this.timeout = cfg.timeout;
    this.forwardIp = cfg.forwardIp;
    this.maxBodySize = cfg.maxBodySize;
    this.healthCheck = cfg.healthCheck;
  }

  static validate(raw: unknown, source: string): ConfigType {
    if (!raw || typeof raw !== 'object') {
      throw new Error(`Config in source ${source} must be an object`);
    }

    const conf = raw as Partial<ConfigType>;

    if (typeof conf.port !== 'number') {
      throw new Error(
        `Config in ${source} must have a numeric 'port' property`,
      );
    }
    if (conf.port < 1 || conf.port > 65535 || !Number.isInteger(conf.port)) {
      throw new Error(
        `Config in ${source} PORT must be an integer between 1 and 65535.`,
      );
    }

    if (conf.host !== undefined) {
      if (typeof conf.host !== 'string' || conf.host.length === 0) {
        throw new Error(
          `Config in ${source} 'host' must be a non-empty string`,
        );
      }
    }

    if (conf.balancer !== undefined && !VALID_BALANCERS.has(conf.balancer)) {
      throw new Error(
        `Config in ${source} 'balancer' must be one of ${[...VALID_BALANCERS].join(', ')}, got '${conf.balancer}'`,
      );
    }

    if (conf.timeout !== undefined && !isPositiveInt(conf.timeout)) {
      throw new Error(
        `Config in ${source} 'timeout' must be a positive integer (ms)`,
      );
    }

    if (conf.forwardIp !== undefined && typeof conf.forwardIp !== 'boolean') {
      throw new Error(`Config in ${source} 'forwardIp' must be a boolean`);
    }

    if (conf.maxBodySize !== undefined && !isNonNegativeInt(conf.maxBodySize)) {
      throw new Error(
        `Config in ${source} 'maxBodySize' must be a non-negative integer (bytes)`,
      );
    }

    if (conf.healthCheck !== undefined) {
      if (typeof conf.healthCheck !== 'object' || conf.healthCheck === null) {
        throw new Error(`Config in ${source} 'healthCheck' must be an object`);
      }
      const { interval, timeout } = conf.healthCheck;
      if (interval !== undefined && !isPositiveInt(interval)) {
        throw new Error(
          `Config in ${source} 'healthCheck.interval' must be a positive integer (ms)`,
        );
      }
      if (timeout !== undefined && !isPositiveInt(timeout)) {
        throw new Error(
          `Config in ${source} 'healthCheck.timeout' must be a positive integer (ms)`,
        );
      }
    }

    if (!Array.isArray(conf.routes) || conf.routes.length === 0) {
      throw new Error(
        `Config in ${source} must have a non-empty 'routes' array`,
      );
    }

    for (const [i, rte] of conf.routes.entries()) {
      if (rte.match === undefined || rte.match === null) {
        throw new Error(
          `Config in ${source} is required to have routes.match at index ${i}`,
        );
      }
      if (typeof rte.match !== 'string' && typeof rte.match !== 'function') {
        throw new Error(
          `Config in ${source} routes.match at index ${i} must be a string or function, got ${typeof rte.match}`,
        );
      }
      if (!Array.isArray(rte.upstreams) || rte.upstreams.length === 0) {
        throw new Error(
          `Config in ${source} is required to have routes.upstreams at index ${i}`,
        );
      }
      for (const [j, u] of rte.upstreams.entries()) {
        if (typeof u.host !== 'string' || u.host.length === 0) {
          throw new Error(
            `Config in ${source} routes[${i}].upstreams[${j}].host must be a non-empty string`,
          );
        }
        if (typeof u.port !== 'number') {
          throw new Error(
            `Config in ${source} routes[${i}].upstreams[${j}].port must be a number`,
          );
        }
        if (u.port < 1 || u.port > 65535 || !Number.isInteger(u.port)) {
          throw new Error(
            `Config in ${source} upstream port must be an integer between 1 and 65535.`,
          );
        }
        if (u.protocol !== undefined && !VALID_PROTOCOLS.has(u.protocol)) {
          throw new Error(
            `Config in ${source} routes[${i}].upstreams[${j}].protocol must be 'http' or 'https', got '${u.protocol}'`,
          );
        }
        if (
          u.weight !== undefined &&
          (typeof u.weight !== 'number' ||
            !Number.isFinite(u.weight) ||
            u.weight <= 0)
        ) {
          throw new Error(
            `Config in ${source} routes[${i}].upstreams[${j}].weight must be a positive number`,
          );
        }
      }

      if (rte.balancer !== undefined && !VALID_BALANCERS.has(rte.balancer)) {
        throw new Error(
          `Config in ${source} routes[${i}].balancer must be one of ${[...VALID_BALANCERS].join(', ')}, got '${rte.balancer}'`,
        );
      }
      if (rte.timeout !== undefined && !isPositiveInt(rte.timeout)) {
        throw new Error(
          `Config in ${source} routes[${i}].timeout must be a positive integer (ms)`,
        );
      }
      if (rte.maxBodySize !== undefined && !isNonNegativeInt(rte.maxBodySize)) {
        throw new Error(
          `Config in ${source} routes[${i}].maxBodySize must be a non-negative integer (bytes)`,
        );
      }
    }
    return conf as ConfigType;
  }

  static async fromFile(filePath: string): Promise<Config> {
    const absolutePath = path.resolve(filePath);
    const extension = path.extname(absolutePath).toLowerCase();
    let raw: unknown;

    if (extension === '.json') {
      const contents = await fs.readFile(absolutePath, 'utf-8');
      raw = JSON.parse(contents);
    } else if (
      extension === '.js' ||
      extension === '.mjs' ||
      extension === '.cjs'
    ) {
      const module = (await import(pathToFileURL(absolutePath).href)) as {
        default?: ConfigType;
      };
      raw = module.default ?? module;
    } else {
      throw new Error(
        `Unsupported config file extension: ${extension}. Supported: .json, .js, .mjs, .cjs. ` +
          `For TypeScript configs, compile to JavaScript first or run via a TS-aware runtime.`,
      );
    }

    const validated = Config.validate(raw, filePath);
    return new Config(validated);
  }

  static fromObject(data: unknown, source = 'inline'): Config {
    const validated = Config.validate(data, source);
    return new Config(validated);
  }
}
