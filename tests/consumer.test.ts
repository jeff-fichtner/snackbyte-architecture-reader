import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSettings } from '../src/settings.js';

/**
 * The proof on a real consumer's code. Where that code lives is a fact of this machine, so it comes
 * from the environment: CONSUMER_ROOT is the consumer's codebase root and CONSUMER_SETTINGS its
 * settings file. Either one missing stops the run at once.
 */
function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} must be set`);
  return value;
}

const root = required('CONSUMER_ROOT');
const settingsFile = required('CONSUMER_SETTINGS');
const cli = join(import.meta.dirname, '..', 'dist', 'cli.js');

interface Report {
  parts: { id: string }[];
  trips: { entry: string; rule: string; steps: string[] }[];
}

function run(): { text: string; seconds: number } {
  const started = process.hrtime.bigint();
  const result = spawnSync(process.execPath, [cli, '--settings', settingsFile], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  if (result.status !== 0) throw new Error(`the reader stopped:\n${result.stderr}`);
  return { text: result.stdout, seconds };
}

describe("the first consumer's real code", () => {
  const first = run();
  const report = JSON.parse(first.text) as Report;

  it('gives the same bytes on a second run', () => {
    expect(run().text).toBe(first.text);
  });

  it('finishes in under 30 seconds', () => {
    expect(first.seconds).toBeLessThan(30);
  });

  it('gives every entry rule at least one trip', () => {
    const settings = loadSettings(settingsFile);
    const rules = new Set(report.trips.map((t) => t.rule));
    for (const rule of settings.entries) expect(rules, rule.name).toContain(rule.name);
  });

  it('names only parts of the report in every trip', () => {
    const ids = new Set(report.parts.map((p) => p.id));
    for (const trip of report.trips) for (const step of trip.steps) expect(ids).toContain(step);
  });
});
