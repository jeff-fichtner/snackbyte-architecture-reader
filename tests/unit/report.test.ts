import { describe, expect, it } from 'vitest';
import { serialize, type Report } from '../../src/report.js';

const report: Report = {
  parts: [
    {
      id: 'src/b.ts',
      kind: 'file',
      rel: [
        { to: 'src/a.ts', kind: 'imports' },
        { to: 'src/z.ts#z', kind: 'calls' },
        { to: 'src/a.ts#a', kind: 'calls' },
        { to: 'src/a.ts#a', kind: 'calls' },
      ],
      refuses: [],
    },
    {
      id: 'src/a.ts#a',
      kind: 'function',
      rel: [],
      refuses: [{ what: 'second' }, { what: 'first' }],
      checkpoint: { what: 'the session is signed' },
    },
  ],
  trips: [
    { entry: 'src/b.ts#b', rule: 'route', steps: ['src/b.ts#b', 'src/c.ts#c'] },
    { entry: 'src/a.ts#a', rule: 'job', steps: ['src/a.ts#a'] },
    { entry: 'src/b.ts#b', rule: 'route', steps: ['src/b.ts#b'] },
  ],
};

describe('the report', () => {
  const text = serialize(report);
  const parsed = JSON.parse(text);

  it('puts keys in the documented order and leaves out empty optional fields', () => {
    expect(Object.keys(parsed)).toEqual(['format', 'parts', 'trips']);
    expect(parsed.format).toBe(1);
    expect(Object.keys(parsed.parts[0])).toEqual(['id', 'kind', 'refuses', 'checkpoint']);
    expect(Object.keys(parsed.parts[1])).toEqual(['id', 'kind', 'rel']);
    expect(Object.keys(parsed.trips[0])).toEqual(['entry', 'rule', 'steps']);
  });

  it('sorts parts by id, relationships by kind then target, and drops repeats', () => {
    expect(parsed.parts.map((p: { id: string }) => p.id)).toEqual(['src/a.ts#a', 'src/b.ts']);
    expect(parsed.parts[1].rel).toEqual([
      { to: 'src/a.ts#a', kind: 'calls' },
      { to: 'src/z.ts#z', kind: 'calls' },
      { to: 'src/a.ts', kind: 'imports' },
    ]);
  });

  it('keeps refusals in the order given, which is source order', () => {
    expect(parsed.parts[0].refuses).toEqual([{ what: 'second' }, { what: 'first' }]);
  });

  it('sorts trips by entry, then by steps element by element', () => {
    expect(parsed.trips.map((t: { steps: string[] }) => t.steps)).toEqual([
      ['src/a.ts#a'],
      ['src/b.ts#b'],
      ['src/b.ts#b', 'src/c.ts#c'],
    ]);
  });

  it('is two-space indented with LF and one final newline, and the same bytes every time', () => {
    expect(text).toContain('\n  "format": 1,\n');
    expect(text).not.toContain('\r');
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
    expect(serialize(report)).toBe(text);
  });
});
