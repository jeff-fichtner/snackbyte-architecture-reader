import { describe, expect, it } from 'vitest';
import { reportOf } from '../report-of.js';

describe('entries', () => {
  const { report, trips } = reportOf('entries');
  const A = 'src/app.ts';
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
      [`${A}#createApp`, `${A}#createApp/2`, 'src/audit.ts#audit', `${A}#register`],
    ]);
  });

  it('starts trips at a function used as a value the compiler cannot follow', () => {
    expect(ruleOf(`${A}#stored`)).toBe('value');
    expect(ruleOf(`${A}#table.stored`)).toBe('value');
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
