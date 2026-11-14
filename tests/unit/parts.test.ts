import { describe, expect, it } from 'vitest';
import { load } from '../helpers.js';

describe('parts and their ids', () => {
  const { index } = load('ids');
  const kinds = Object.fromEntries(index.parts.map((part) => [part.id, part.kind]));

  it('gives every file and declaration, exported or not, an id derived from where it is written', () => {
    expect(kinds).toEqual({
      'src/a.ts': 'file',
      'src/a.ts#top': 'function',
      'src/a.ts#top.inner': 'function',
      'src/a.ts#top.local': 'function',
      'src/a.ts#top/1': 'function',
      'src/a.ts#top/2': 'function',
      'src/a.ts#run': 'function',
      'src/a.ts#Store': 'class',
      'src/a.ts#Store.count': 'variable',
      'src/a.ts#Store.handler': 'method',
      'src/a.ts#Store.constructor': 'method',
      'src/a.ts#Store.open': 'method',
      'src/a.ts#Store.size': 'method',
      'src/a.ts#Shape': 'interface',
      'src/a.ts#Id': 'type',
      'src/a.ts#Color': 'enum',
      'src/a.ts#Tools': 'namespace',
      'src/a.ts#Tools.hammer': 'function',
      'src/a.ts#over': 'function',
      'src/a.ts#config': 'variable',
      'src/a.ts#config.start': 'function',
      'src/a.ts#config.nested.stop': 'function',
      'src/a.ts#default': 'function',
      'src/a.ts#/1': 'function',
      'src/a.ts#first': 'variable',
      'src/a.ts#second': 'variable',
    });
  });

  it('leaves out local variables that hold no function', () => {
    expect(kinds['src/a.ts#top.notAPart']).toBeUndefined();
  });

  it('folds overload signatures into their implementation', () => {
    const over = index.byId.get('src/a.ts#over');
    const declarations = [...index.byNode.entries()].filter(([, part]) => part === over);
    expect(declarations.length).toBeGreaterThanOrEqual(3);
  });
});
