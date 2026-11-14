import { describe, expect, it } from 'vitest';
import { reportOf } from '../report-of.js';

const H = 'src/html.ts#';
const P = 'src/page.ts#';
const { report, part, rel, trips } = reportOf('tagged');

describe('a tagged template calls its tag', () => {
  it('gives a calls relationship to a codebase tag', () => {
    expect(rel(`${P}render`, 'calls')).toEqual([`${H}html`, `${P}escape`]);
  });

  it('makes the tag a step, after the substitutions are walked', () => {
    expect(trips(`${P}render`)).toEqual([[`${P}render`, `${P}escape`, `${H}html`]]);
  });

  it('walks a tagged template inside a substitution, and a tag reached through a property', () => {
    expect(trips(`${P}nested`)).toEqual([
      [`${P}nested`, `${P}escape`, `${H}tags.bold`, `${H}html`],
    ]);
  });

  it('does not make a tag used only as a tag a value entry', () => {
    expect(report.trips.some((t) => t.entry === `${H}html`)).toBe(false);
    expect(part(`${H}html`).handedOnBy).toBeUndefined();
  });

  it('gives a tag outside the codebase no relationship and no step', () => {
    expect(part(`${P}raw`).rel).toBeUndefined();
    expect(trips(`${P}raw`)).toEqual([[`${P}raw`]]);
  });
});
