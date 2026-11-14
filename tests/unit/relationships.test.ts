import { describe, expect, it } from 'vitest';
import { reportOf } from '../report-of.js';

describe('relationships', () => {
  const { rel } = reportOf('relationships');
  const M = 'src/main.ts';
  const S = 'src/shapes.ts';

  it('records each file a file imports once, however it is imported', () => {
    expect(rel(M, 'imports')).toContain(S);
    expect(rel(M, 'imports').filter((to) => to === S)).toHaveLength(1);
  });

  it('keeps a kept package as pkg:, and leaves any other package out', () => {
    expect(rel(M, 'imports')).toContain('pkg:kept');
    expect(rel(`${M}#helper`, 'calls')).toEqual(['pkg:kept']);
    expect(JSON.stringify(rel(M))).not.toContain('other');
  });

  it('attributes a call to the innermost function, or to the file for top-level code', () => {
    expect(rel(M, 'calls')).toEqual([`${M}#make`]);
    expect(rel(`${M}#total`, 'calls')).toEqual([`${M}#helper`]);
  });

  it('resolves `new` to the constructor, and methods to the method', () => {
    expect(rel(`${M}#make`, 'calls')).toEqual([`${S}#Square.constructor`]);
    expect(rel(`${M}#later`, 'calls')).toEqual([`${S}#Square.area`, `${S}#Square.constructor`]);
  });

  it('resolves `super()` without a base constructor to the base class', () => {
    expect(rel(`${S}#Square.constructor`, 'calls')).toEqual([`${S}#Base`]);
  });

  it('leaves out a call through an interface, which names no function', () => {
    expect(rel(`${M}#total`)).not.toContain(`${S}#Shape`);
  });

  it('records extends and implements', () => {
    expect(rel(`${S}#Square`, 'extends')).toEqual([`${S}#Base`]);
    expect(rel(`${S}#Square`, 'implements')).toEqual([`${S}#Shape`]);
  });

  it('calls unexported functions too', () => {
    expect(rel(`${S}#Square.area`, 'calls')).toEqual([`${S}#square`]);
  });
});
