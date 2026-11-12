import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { load } from '../helpers.js';

describe('codebase', () => {
  const { codebase } = load('packages');

  it('is every source file of every project, as paths from the settings folder', () => {
    expect(codebase.files.map((f) => f.path)).toEqual(['app/src/main.ts', 'lib/src/util.ts']);
  });

  it('names the package of an outside declaration from its nearest package.json', () => {
    const main = codebase.files[0];
    if (!main) throw new Error('no main file');
    const kept = main.program
      .getSourceFiles()
      .find((f) => f.fileName.endsWith('node_modules/kept/index.d.ts'));
    expect(kept).toBeDefined();
    expect(codebase.packageOf(kept?.fileName ?? '')).toBe('kept');
    expect(codebase.file(kept?.fileName ?? '')).toBeUndefined();
  });

  it('leaves the compiler library out of the codebase', () => {
    const main = codebase.files[0];
    const lib = main?.program
      .getSourceFiles()
      .find((f) => f.isDeclarationFile && !f.fileName.includes('fixtures'));
    expect(lib).toBeDefined();
    expect(codebase.file(lib?.fileName ?? '')).toBeUndefined();
    expect(codebase.packageOf(lib?.fileName ?? '')).toBe('typescript');
    expect(ts.version).toBe('6.0.3');
  });
});
