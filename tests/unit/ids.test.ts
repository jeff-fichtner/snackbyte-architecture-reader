import { describe, expect, it } from 'vitest';
import { IdRegistry, namedId, packageId, unnamedId } from '../../src/ids.js';

describe('ids', () => {
  it('names parts in a file and inside other parts', () => {
    expect(namedId('src/a.ts', true, 'run')).toBe('src/a.ts#run');
    expect(namedId('src/a.ts#Store', false, 'open')).toBe('src/a.ts#Store.open');
  });

  it('numbers unnamed functions inside their enclosing part', () => {
    expect(unnamedId('src/a.ts', true, 1)).toBe('src/a.ts#/1');
    expect(unnamedId('src/a.ts#top', false, 2)).toBe('src/a.ts#top/2');
  });

  it('names a package target', () => {
    expect(packageId('@scope/client')).toBe('pkg:@scope/client');
  });

  it('gives a repeated id the first free suffix, in the order claimed', () => {
    const registry = new IdRegistry();
    expect(registry.claim('a')).toBe('a');
    expect(registry.claim('a')).toBe('a~2');
    expect(registry.claim('a')).toBe('a~3');
  });
});
