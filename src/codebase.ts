import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import type ts from 'typescript';
import { StopError } from './errors.js';

/** A source file of the codebase, with the program that compiled it. */
export interface CodebaseFile {
  /** Path from the codebase root, `/`-separated. */
  path: string;
  sourceFile: ts.SourceFile;
  program: ts.Program;
  checker: ts.TypeChecker;
}

/**
 * Which files are the codebase, and what everything outside it belongs to. The codebase is every
 * source file the projects include, except declaration files and anything under `node_modules`;
 * a file outside it belongs to the package named by the nearest `package.json` above it, which is
 * how Node itself names a package.
 */
export class Codebase {
  readonly files: CodebaseFile[];
  private readonly byFileName = new Map<string, CodebaseFile>();
  private readonly packageNames = new Map<string, string | undefined>();

  constructor(
    readonly root: string,
    programs: ts.Program[],
  ) {
    const files: CodebaseFile[] = [];
    for (const program of programs) {
      const checker = program.getTypeChecker();
      const roots = new Set(program.getRootFileNames());
      for (const sourceFile of program.getSourceFiles()) {
        const fileName = sourceFile.fileName;
        if (!roots.has(fileName) || this.byFileName.has(fileName)) continue;
        if (sourceFile.isDeclarationFile || fileName.split('/').includes('node_modules')) continue;
        const path = this.relativePath(fileName);
        const file = { path, sourceFile, program, checker };
        this.byFileName.set(fileName, file);
        files.push(file);
      }
    }
    files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    this.files = files;
  }

  private relativePath(fileName: string): string {
    const path = relative(this.root, fileName);
    if (path.startsWith('..') || isAbsolute(path)) {
      throw new StopError(
        `${fileName} is compiled by a project but lies outside the codebase root`,
      );
    }
    return path.split(sep).join('/');
  }

  /** The codebase file a compiler file name is, if it is one. */
  file(fileName: string): CodebaseFile | undefined {
    return this.byFileName.get(fileName);
  }

  /** The package a file outside the codebase belongs to, from its nearest `package.json`. */
  packageOf(fileName: string): string | undefined {
    let dir = dirname(fileName);
    const visited: string[] = [];
    let found: string | undefined;
    for (;;) {
      if (this.packageNames.has(dir)) {
        found = this.packageNames.get(dir);
        break;
      }
      visited.push(dir);
      const manifest = join(dir, 'package.json');
      if (existsSync(manifest)) {
        const name: unknown = JSON.parse(readFileSync(manifest, 'utf8')).name;
        if (typeof name === 'string' && name !== '') {
          found = name;
          break;
        }
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    for (const d of visited) this.packageNames.set(d, found);
    return found;
  }
}
