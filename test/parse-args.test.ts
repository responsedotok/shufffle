import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/cli/parse-args.js';

function run(...extra: string[]) {
  return parseArgs(['node', 'cli', ...extra]);
}

describe('parseArgs --env', () => {
  it('preserves "=" characters inside the value', () => {
    const { env } = run(
      '--env',
      'DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require',
    );
    expect(env.DATABASE_URL).toBe(
      'postgres://user:pass@host:5432/db?sslmode=require',
    );
  });

  it('preserves base64-style tokens with trailing "="', () => {
    const { env } = run('--env', 'TOKEN=YWxhZGRpbjpvcGVuc2VzYW1l==');
    expect(env.TOKEN).toBe('YWxhZGRpbjpvcGVuc2VzYW1l==');
  });

  it('accepts empty value (KEY=)', () => {
    const { env } = run('--env', 'EMPTY=');
    expect(env.EMPTY).toBe('');
  });

  it('rejects values without "="', () => {
    expect(() => run('--env', 'NOEQUALS')).toThrow('Invalid value for --env');
  });

  it('rejects values starting with "="', () => {
    expect(() => run('--env', '=value')).toThrow('Invalid value for --env');
  });

  it('accepts multiple --env flags', () => {
    const { env } = run('--env', 'A=1', '-e', 'B=two=words');
    expect(env).toEqual({ A: '1', B: 'two=words' });
  });

  it('throws when --env is missing its value', () => {
    expect(() => run('--env')).toThrow('Missing value for --env');
  });
});

describe('parseArgs core flags', () => {
  it('returns defaults when no args are passed', () => {
    const result = run();
    expect(result.configPath).toBe('./proxy.config.json');
    expect(result.logLevel).toBe('info');
    expect(result.help).toBe(false);
    expect(result.env).toEqual({});
    expect(result.balancer).toBeUndefined();
  });

  it('parses --help and -h', () => {
    expect(run('--help').help).toBe(true);
    expect(run('-h').help).toBe(true);
  });

  it('parses --config path', () => {
    expect(run('--config', '/etc/proxy.json').configPath).toBe(
      '/etc/proxy.json',
    );
  });

  it('parses --balancer', () => {
    expect(run('--balancer', 'random').balancer).toBe('random');
  });

  it('rejects unknown --balancer values', () => {
    expect(() => run('--balancer', 'sticky')).toThrow(
      'Invalid value for --balancer',
    );
  });

  it('rejects unknown --log-level values', () => {
    expect(() => run('--log-level', 'verbose')).toThrow(
      'Invalid value for --log-level',
    );
  });

  it('rejects unknown arguments', () => {
    expect(() => run('--nope')).toThrow('Unknown argument');
  });
});
