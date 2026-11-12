import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { DeclarationMatcher, qualifiedName } from '../../src/declarations.js';
import { loadPrograms } from '../../src/program.js';
import { loadSettings } from '../../src/settings.js';
import { Codebase } from '../../src/codebase.js';
import { reportOf } from '../report-of.js';
import { settingsOf } from '../helpers.js';

function setup() {
  const settings = loadSettings(settingsOf('refusals'));
  const programs = loadPrograms(settings.projects, settings.root);
  const codebase = new Codebase(settings.root, programs);
  const program = programs[0] as ts.Program;
  const router = program
    .getSourceFiles()
    .find((f) => f.fileName.endsWith('fake-router/index.d.ts')) as ts.SourceFile;
  return { matcher: new DeclarationMatcher(codebase, programs), router };
}

function find(root: ts.Node, test: (node: ts.Node) => boolean): ts.Node {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node): void => {
    if (!found && test(node)) found = node;
    ts.forEachChild(node, visit);
  };
  visit(root);
  if (!found) throw new Error('not found');
  return found;
}

describe('declarations named in settings', () => {
  const { matcher, router } = setup();
  const status = find(router, (n) => ts.isMethodSignature(n) && n.name.getText() === 'status');

  it('have a qualified name inside their module', () => {
    expect(qualifiedName(status)).toBe('Response.status');
  });

  it('match by package and qualified name, and by being inside one with `within`', () => {
    expect(matcher.matches(status, { module: 'fake-router', name: 'Response.status' })).toBe(true);
    expect(matcher.matches(status, { module: 'other', name: 'Response.status' })).toBe(false);
    expect(matcher.matches(status, { module: 'fake-router', name: 'Response' })).toBe(false);
    expect(matcher.matches(status, { module: 'fake-router', name: 'Response' }, true)).toBe(true);
  });

  it('stop when the compiler cannot find the module or the name', () => {
    expect(() => matcher.requireExists({ module: 'fake-router', name: 'Nope' }, 'f')).toThrow(
      /cannot find/,
    );
    expect(() => matcher.requireExists({ module: 'nowhere', name: 'Response' }, 'f')).toThrow(
      /cannot find/,
    );
    expect(() =>
      matcher.requireExists({ module: 'fake-router', name: 'Response.status' }, 'f'),
    ).not.toThrow();
  });

  it('stop a run whose error-answer rule names something missing', () => {
    expect(() => reportOf('refusals', 'missing.json')).toThrow(/Response\.nope.*cannot find/);
  });
});
