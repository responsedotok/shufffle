import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Config } from '../src/config/config.js';

const loadConfig = (p: string) => Config.fromFile(p);

const validConfig = {
  port: 8080,
  routes: [{ match: '/api', upstreams: [{ host: 'localhost', port: 3000 }] }],
};

async function writeTempFile(content: string, ext: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'proxy-test-'));
  const filePath = path.join(dir, `${randomUUID()}${ext}`);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('loadConfig', () => {
  it('loads a valid JSON config', async () => {
    const filePath = await writeTempFile(JSON.stringify(validConfig), '.json');
    const config = await loadConfig(filePath);
    expect(config.port).toBe(8080);
    expect(config.routes).toHaveLength(1);
  });

  it('throws for an unsupported file extension', async () => {
    const filePath = await writeTempFile('{}', '.yaml');
    await expect(loadConfig(filePath)).rejects.toThrow(
      'Unsupported config file extension',
    );
  });

  it('rejects .ts config files with a helpful message', async () => {
    const filePath = await writeTempFile(
      'export default { port: 8080, routes: [] };',
      '.ts',
    );
    await expect(loadConfig(filePath)).rejects.toThrow(
      /Unsupported config file extension.*TypeScript/,
    );
  });

  it('loads a .mjs config that exports default', async () => {
    const body = `export default ${JSON.stringify(validConfig)};`;
    const filePath = await writeTempFile(body, '.mjs');
    const config = await loadConfig(filePath);
    expect(config.port).toBe(8080);
  });

  it('throws when config is not an object', async () => {
    const filePath = await writeTempFile('"just a string"', '.json');
    await expect(loadConfig(filePath)).rejects.toThrow('must be an object');
  });

  it('throws when port is missing', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow("numeric 'port'");
  });

  it('throws when port is not a number', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 'abc',
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow("numeric 'port'");
  });

  it('throws when routes is missing', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({ port: 8080 }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow("non-empty 'routes'");
  });

  it('throws when routes is an empty array', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({ port: 8080, routes: [] }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow("non-empty 'routes'");
  });

  it('throws when a route is missing match', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        routes: [{ upstreams: [{ host: 'a', port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow('routes.match');
  });

  it('throws when a route has an empty upstreams array', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({ port: 8080, routes: [{ match: '/', upstreams: [] }] }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow('routes.upstreams');
  });

  it('throws when an upstream is missing host', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        routes: [{ match: '/', upstreams: [{ port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow();
  });

  it('throws when an upstream port is not a number', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 'abc' }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow();
  });

  it('throws when server port is 0', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 0,
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow('1 and 65535');
  });

  it('throws when server port exceeds 65535', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 99999,
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow('1 and 65535');
  });

  it('throws when server port is a float', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 80.5,
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow('1 and 65535');
  });

  it('throws when upstream port is out of range', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 99999 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow('1 and 65535');
  });

  it('throws when host is an empty string', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        host: '',
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow("'host'");
  });

  it('throws when balancer is an unknown strategy', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        balancer: 'sticky',
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow("'balancer'");
  });

  it('throws when timeout is zero or negative', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        timeout: 0,
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow("'timeout'");
  });

  it('throws when forwardIp is not a boolean', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        forwardIp: 'yes',
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow("'forwardIp'");
  });

  it('throws when maxBodySize is negative', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        maxBodySize: -1,
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow("'maxBodySize'");
  });

  it('throws when healthCheck.interval is not a positive integer', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        healthCheck: { interval: -100 },
        routes: [{ match: '/', upstreams: [{ host: 'a', port: 80 }] }],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow('healthCheck.interval');
  });

  it('throws when upstream protocol is not http or https', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        routes: [
          {
            match: '/',
            upstreams: [{ host: 'a', port: 80, protocol: 'ftp' }],
          },
        ],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow('protocol');
  });

  it('throws when upstream weight is zero', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        routes: [
          { match: '/', upstreams: [{ host: 'a', port: 80, weight: 0 }] },
        ],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow('weight');
  });

  it('throws when route balancer is invalid', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        routes: [
          {
            match: '/',
            balancer: 'nope',
            upstreams: [{ host: 'a', port: 80 }],
          },
        ],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow('balancer');
  });

  it('throws when route timeout is not positive', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        routes: [
          {
            match: '/',
            timeout: 0,
            upstreams: [{ host: 'a', port: 80 }],
          },
        ],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow('timeout');
  });

  it('throws when route maxBodySize is negative', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        routes: [
          {
            match: '/',
            maxBodySize: -5,
            upstreams: [{ host: 'a', port: 80 }],
          },
        ],
      }),
      '.json',
    );
    await expect(loadConfig(filePath)).rejects.toThrow('maxBodySize');
  });

  it('accepts a fully populated valid config', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        port: 8080,
        host: '127.0.0.1',
        balancer: 'round-robin',
        timeout: 30000,
        forwardIp: true,
        maxBodySize: 1048576,
        healthCheck: { interval: 5000, timeout: 1000 },
        routes: [
          {
            match: '/api',
            balancer: 'weighted',
            timeout: 5000,
            maxBodySize: 1024,
            upstreams: [
              { host: 'a', port: 80, protocol: 'http', weight: 2 },
              { host: 'b', port: 443, protocol: 'https', weight: 1 },
            ],
          },
        ],
      }),
      '.json',
    );
    const cfg = await loadConfig(filePath);
    expect(cfg.balancer).toBe('round-robin');
    expect(cfg.routes[0].upstreams[1].protocol).toBe('https');
  });
});

describe('Config', () => {
  it('constructs from valid data', () => {
    const cfg = Config.fromObject(validConfig);
    expect(cfg.port).toBe(8080);
  });

  it('throws when constructed with invalid data', () => {
    expect(() =>
      Config.fromObject({ port: 'not-a-number', routes: [] }),
    ).toThrow();
  });

  it('loads from a file via Config.fromFile', async () => {
    const filePath = await writeTempFile(JSON.stringify(validConfig), '.json');
    const cfg = await Config.fromFile(filePath);
    expect(cfg.port).toBe(8080);
  });
});
