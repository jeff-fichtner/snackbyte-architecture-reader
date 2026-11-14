import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { StopError } from '../../src/errors.js';
import { loadSettings } from '../../src/settings.js';

function codebase(settings: unknown, raw?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'reader-settings-'));
  writeFileSync(join(root, 'tsconfig.json'), '{}');
  mkdirSync(join(root, 'src'));
  const file = join(root, 'architecture-reader.json');
  writeFileSync(file, raw ?? JSON.stringify(settings));
  return file;
}

const valid = {
  format: 1,
  projects: ['tsconfig.json'],
  entries: [{ name: 'job', declarations: ['src/job.ts#run'] }],
};

function refusal(file: string): string {
  try {
    loadSettings(file);
  } catch (error) {
    expect(error).toBeInstanceOf(StopError);
    return (error as Error).message;
  }
  throw new Error('expected the settings to be refused');
}

describe('settings', () => {
  it('loads a valid file with its defaults', () => {
    const file = codebase(valid);
    const settings = loadSettings(file);
    expect(settings.keep).toEqual([]);
    expect(settings.errorAnswers).toEqual([]);
    expect(settings.pathLimit).toBe(1000);
    expect(settings.projects).toHaveLength(1);
    expect(settings.entries).toEqual([{ name: 'job', declarations: ['src/job.ts#run'] }]);
  });

  it('reads every kind of rule', () => {
    const file = codebase({
      ...valid,
      keep: ['@scope/client'],
      entries: [
        { name: 'route', type: { module: 'router', name: 'Handler' } },
        { name: 'hook', type: { module: 'engine', name: 'Configuration' }, within: true },
      ],
      errorAnswers: [
        {
          name: 'error status',
          call: { module: 'router', name: 'Response.status' },
          status: { argument: 0, atLeast: 400 },
          what: { argument: 1 },
        },
      ],
      pathLimit: 5000,
    });
    const settings = loadSettings(file);
    expect(settings.entries[1]).toEqual({
      name: 'hook',
      type: { module: 'engine', name: 'Configuration' },
      within: true,
    });
    expect(settings.errorAnswers[0]?.status).toEqual({ argument: 0, atLeast: 400 });
    expect(settings.pathLimit).toBe(5000);
  });

  it('refuses a missing file', () => {
    expect(refusal('/nonexistent/architecture-reader.json')).toMatch(/settings file/);
  });

  it('refuses a file that is not JSON', () => {
    expect(refusal(codebase(null, '{ not json'))).toMatch(/not JSON/);
  });

  it('refuses a format it does not know', () => {
    expect(refusal(codebase({ ...valid, format: 2 }))).toMatch(/format/);
  });

  it('refuses missing projects', () => {
    expect(refusal(codebase({ format: 1, entries: valid.entries }))).toMatch(/projects/);
  });

  it('refuses a project file that does not exist', () => {
    expect(refusal(codebase({ ...valid, projects: ['missing.json'] }))).toMatch(/missing\.json/);
  });

  it('refuses missing or empty entries', () => {
    expect(refusal(codebase({ format: 1, projects: ['tsconfig.json'] }))).toMatch(/entries/);
    expect(refusal(codebase({ ...valid, entries: [] }))).toMatch(/entries/);
  });

  it('refuses a rule name used twice', () => {
    const entries = [valid.entries[0], valid.entries[0]];
    expect(refusal(codebase({ ...valid, entries }))).toMatch(/"job".*twice/);
  });

  it('refuses the rule name the reader keeps for itself', () => {
    const entries = [{ name: 'value', declarations: ['src/a.ts#a'] }];
    expect(refusal(codebase({ ...valid, entries }))).toMatch(/"value"/);
  });

  it('refuses a path limit under 1000', () => {
    expect(refusal(codebase({ ...valid, pathLimit: 999 }))).toMatch(/pathLimit/);
  });

  it('refuses a value of the wrong kind', () => {
    expect(refusal(codebase({ ...valid, keep: 'one' }))).toMatch(/keep/);
    const entries = [{ name: 'route', type: { module: 'router' } }];
    expect(refusal(codebase({ ...valid, entries }))).toMatch(/name/);
  });
});
