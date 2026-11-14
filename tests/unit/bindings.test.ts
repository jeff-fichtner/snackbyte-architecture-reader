import { describe, expect, it } from 'vitest';
import { reportOf } from '../report-of.js';

describe('functions handed through parameters', () => {
  const { report, part, rel, trips } = reportOf('parameters');
  const A = 'src/app.ts';
  const M = 'src/main.ts';
  const ruleOf = (entry: string) => report.trips.find((t) => t.entry === entry)?.rule;

  it('resolves a call through a property of an object passed into a parameter', () => {
    expect(rel(`${A}#createApp/1`, 'calls')).toEqual([`${M}#engine`, `${M}#main.resolve`]);
  });

  it('resolves it in a function written inside the one the object is passed to', () => {
    expect(trips(`${A}#createApp/1`)).toEqual([
      [`${A}#createApp/1`, `${M}#main.resolve`, `${M}#lookup`, `${M}#engine`],
    ]);
  });

  it('follows a parameter passed on to another function, down a nested object', () => {
    expect(rel(`${A}#routes`, 'calls')).toEqual([`${M}#main.mount.log`]);
  });

  it('follows a name destructured from a parameter', () => {
    expect(rel(`${M}#destructured`, 'calls')).toEqual([`${M}#ran`]);
  });

  it('walks the resolved functions in place, so they are steps and not entries', () => {
    expect(trips(`${M}#main`)).toEqual([
      [
        `${M}#main`,
        `${A}#createApp`,
        `${A}#routes`,
        `${M}#main.mount.log`,
        `${M}#note`,
        `${M}#twice`,
        `${M}#keep`,
        `${M}#destructured`,
        `${M}#ran`,
      ],
    ]);
    for (const id of [`${M}#main.resolve`, `${M}#engine`, `${M}#main.mount.log`, `${M}#ran`]) {
      expect(ruleOf(id)).toBeUndefined();
      expect(part(id).handedOnBy).toBeUndefined();
    }
  });

  it('resolves nothing where a parameter can hold more than one function', () => {
    expect(rel(`${M}#twice`, 'calls')).toEqual([]);
    expect(ruleOf(`${M}#main/1`)).toBe('value');
    expect(ruleOf(`${M}#main/2`)).toBe('value');
  });

  it('keeps a function a value entry when what holds it is read and taken elsewhere', () => {
    expect(ruleOf(`${M}#kept`)).toBe('value');
    expect(part(`${M}#kept`).handedOnBy).toEqual([`${M}#main`]);
  });

  it('keeps a function returned from where it is written a value entry', () => {
    expect(ruleOf(`${A}#createApp/1`)).toBe('value');
  });

  describe('leaves a function a value entry, resolving nothing, when', () => {
    const E = 'src/edges.ts';

    it('the object passed in spreads another, so any property can come from it', () => {
      expect(rel(`${E}#withSpread`, 'calls')).toEqual([]);
      expect(ruleOf(`${E}#g1`)).toBe('value');
    });

    it('the property is written over before the call', () => {
      expect(rel(`${E}#written`, 'calls')).toEqual([]);
      expect(ruleOf(`${E}#g2`)).toBe('value');
      expect(ruleOf(`${E}#noop`)).toBe('value');
    });

    it('it is passed to a method, which other code can override or call unseen', () => {
      expect(rel(`${E}#Box.take`, 'calls')).toEqual([]);
      expect(ruleOf(`${E}#g3`)).toBe('value');
    });

    it('the property is handed to code outside the codebase', () => {
      expect(rel(`${E}#outward`, 'calls')).toEqual([]);
      expect(ruleOf(`${E}#g4`)).toBe('value');
    });
  });

  it('resolves a call to a parameter default, which still starts trips as a value', () => {
    const E = 'src/edges.ts';
    expect(rel(`${E}#withDefault`, 'calls')).toEqual([`${E}#g5`]);
    expect(ruleOf(`${E}#g5`)).toBe('value');
    expect(part(`${E}#g5`).handedOnBy).toEqual([`${E}#withDefault`]);
  });
});
