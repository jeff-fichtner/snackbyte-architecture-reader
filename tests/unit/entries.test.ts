import { describe, expect, it } from 'vitest';
import { reportOf } from '../report-of.js';

describe('entries', () => {
  const { report, part, trips } = reportOf('entries');
  const A = 'src/app.ts';
  const H = 'src/handed.ts';
  const ruleOf = (entry: string) => report.trips.find((t) => t.entry === entry)?.rule;

  it('finds an inline handler by the type the router expects for it', () => {
    expect(ruleOf(`${A}#createApp/1`)).toBe('route');
  });

  it('finds a named function handed where that type is expected', () => {
    expect(ruleOf(`${A}#named`)).toBe('route');
  });

  it('finds hooks anywhere inside the engine configuration type with `within`', () => {
    expect(ruleOf(`${A}#createApp.findAccount`)).toBe('hook');
    expect(ruleOf(`${A}#createApp.interactions.url`)).toBe('hook');
  });

  it('makes a named part an entry', () => {
    expect(ruleOf(`${A}#createApp`)).toBe('job');
  });

  it('walks a callback handed to outside code as a step where it is handed over', () => {
    expect(ruleOf(`${A}#createApp/2`)).toBeUndefined();
    expect(trips(`${A}#createApp`)).toEqual([
      [
        `${A}#createApp`,
        `${A}#createApp/2`,
        'src/audit.ts#audit',
        `${A}#register`,
        `${A}#stored`,
        `${A}#table.stored`,
      ],
    ]);
  });

  it('starts trips at a function used as a value the compiler cannot follow', () => {
    expect(ruleOf(`${A}#table.stored`)).toBe('value');
  });

  it('walks a function handed to a parameter where the parameter is called', () => {
    expect(ruleOf(`${A}#stored`)).toBeUndefined();
  });

  it('names the part that hands a value on: the function holding the place, or the file', () => {
    expect(part(`${A}#table.stored`).handedOnBy).toEqual([A]);
  });

  it('names the caller that hands a callback to a parameter holding more than one', () => {
    expect(ruleOf(`${H}#save/1`)).toBe('value');
    expect(part(`${H}#save/1`).handedOnBy).toEqual([`${H}#save`]);
  });

  it('names every part that hands a function on, sorted, each once', () => {
    // inTransaction's parameter holds save/1 and later, so neither call through it resolves.
    expect(part(`${H}#later`).handedOnBy).toEqual([`${H}#retry`, `${H}#save`]);
  });

  it('names the function that returns an object holding a method', () => {
    expect(part(`${H}#hooks.run`).handedOnBy).toEqual([`${H}#hooks`]);
  });

  it('gives no such list to a function that is not a value entry', () => {
    for (const id of [`${A}#createApp`, `${A}#named`, `${A}#createApp/2`, `${A}#mw/1`]) {
      expect(part(id).handedOnBy).toBeUndefined();
    }
    const values = new Set(report.trips.filter((t) => t.rule === 'value').map((t) => t.entry));
    const listed = report.parts.filter((p) => p.handedOnBy).map((p) => p.id);
    expect(new Set(listed)).toEqual(values);
  });

  it('stops when one function is matched by two rules', () => {
    expect(() => reportOf('entries', 'twice.json')).toThrow(
      /src\/app\.ts#named is matched by two entry rules/,
    );
  });

  it('stops when a rule matches no function', () => {
    expect(() => reportOf('entries', 'nomatch.json')).toThrow(/"request" matches no function/);
  });

  it('stops when a rule names a part that does not exist', () => {
    expect(() => reportOf('entries', 'notapart.json')).toThrow(/src\/app\.ts#missing.*not a part/);
  });
});

describe('entry types', () => {
  it('match a type that extends the named declaration', () => {
    const { report } = reportOf('entries');
    expect(report.trips.find((t) => t.entry === 'src/app.ts#mw/1')?.rule).toBe('middleware');
  });
});
