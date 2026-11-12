import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { settingsOf } from './helpers.js';

const cli = join(import.meta.dirname, '..', 'dist', 'cli.js');

function run(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

describe('the command', () => {
  const expected = readFileSync(
    join(import.meta.dirname, 'fixtures/minimal/expected.json'),
    'utf8',
  );

  it('writes the report to standard output and exits 0', () => {
    const result = run('--settings', settingsOf('minimal'));
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(expected);
    expect(result.stderr).toBe('');
  });

  it('writes the report to --out instead', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'reader-out-')), 'report.json');
    const result = run('--settings', settingsOf('minimal'), '--out', out);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(readFileSync(out, 'utf8')).toBe(expected);
  });

  it('exits 1 with the cause on standard error, writing nothing, when the run stops', () => {
    const result = run('--settings', settingsOf('compile-error'));
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/the compiler reports errors/);
  });

  it('exits 2 when --settings is missing', () => {
    const result = run();
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/--settings is required/);
  });

  it('exits 2 on an unknown option', () => {
    const result = run('--settings', settingsOf('minimal'), '--verbose');
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/usage:/);
  });
});
