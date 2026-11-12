import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { read } from '../src/main.js';
import { fixtures } from './helpers.js';

const cli = join(import.meta.dirname, '..', 'dist', 'cli.js');

const cases = readdirSync(fixtures).filter(
  (name) =>
    existsSync(join(fixtures, name, 'architecture-reader.json')) &&
    existsSync(join(fixtures, name, 'expected.json')),
);

describe('every fixture', () => {
  it('has fixtures to run', () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
  });

  for (const name of cases) {
    it(`${name}: gives its expected report, byte for byte, on two runs in different surroundings`, () => {
      const settings = join(fixtures, name, 'architecture-reader.json');
      const expected = readFileSync(join(fixtures, name, 'expected.json'), 'utf8');
      expect(read(settings)).toBe(expected);
      const second = spawnSync(process.execPath, [cli, '--settings', settings], {
        cwd: tmpdir(),
        env: { ...process.env, TZ: 'Pacific/Chatham', LANG: 'tr_TR.UTF-8', LC_ALL: 'tr_TR.UTF-8' },
        encoding: 'utf8',
      });
      expect(second.status).toBe(0);
      expect(second.stdout).toBe(expected);
    });
  }
});
