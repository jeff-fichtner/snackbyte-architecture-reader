import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = join(import.meta.dirname, '..');
const self = relative(repo, import.meta.filename);

/** Everything codebase-specific lives in a codebase's own settings, never in the reader. */
const forbidden = [/\bexpress\b/i, /oidc/i, /\bkoa\b/i, /snackbyte-(?!architecture-reader)/i];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return [path];
  });
}

describe('the reader names no consumer', () => {
  const checked = [
    ...files(join(repo, 'src')),
    ...files(join(repo, 'tests')),
    ...files(join(repo, 'docs')),
    join(repo, 'README.md'),
  ].filter((path) => relative(repo, path) !== self);

  it('checks the shipped code, the tests and the docs', () => {
    expect(checked.length).toBeGreaterThan(20);
  });

  for (const path of checked) {
    it(`${relative(repo, path)} names no consumer, framework or engine`, () => {
      const text = readFileSync(path, 'utf8');
      for (const pattern of forbidden) expect(text).not.toMatch(pattern);
    });
  }
});
