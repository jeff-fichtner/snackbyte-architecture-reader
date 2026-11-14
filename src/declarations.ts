import ts from 'typescript';
import type { Codebase } from './codebase.js';
import { StopError } from './errors.js';
import type { Declaration } from './settings.js';

function nameOf(node: ts.Node): string | undefined {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node) ||
    ts.isVariableDeclaration(node) ||
    ts.isEnumMember(node)
  ) {
    const name = node.name;
    if (!name) return undefined;
    if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
    if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
    return undefined;
  }
  if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
  return undefined;
}

/** Whether walking up stops here: a file, or a `declare module "…"` block, which is a module of its own. */
function isBoundary(node: ts.Node): boolean {
  return ts.isSourceFile(node) || (ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name));
}

/**
 * The qualified name of a declaration inside its module, as the compiler sees it: the names of the
 * declarations around it, outermost first, joined by `.` (`Response.status`). Unnamed layers (a call
 * signature, a type literal) add nothing.
 */
export function qualifiedName(declaration: ts.Node): string | undefined {
  const names: string[] = [];
  for (let n: ts.Node | undefined = declaration; n && !isBoundary(n); n = n.parent) {
    const name = nameOf(n);
    if (name !== undefined) names.unshift(name);
  }
  return names.length > 0 ? names.join('.') : undefined;
}

/** Matches the declarations settings name against what the compiler resolves. */
export class DeclarationMatcher {
  private readonly namesByFile = new Map<string, Set<string>>();

  constructor(
    private readonly codebase: Codebase,
    private readonly programs: ts.Program[],
  ) {}

  /** The module a declaration belongs to: its codebase file's path, or its package's name. */
  moduleOf(declaration: ts.Node): string | undefined {
    const fileName = declaration.getSourceFile().fileName;
    return this.codebase.file(fileName)?.path ?? this.codebase.packageOf(fileName);
  }

  /** Whether `declaration` is the named one, or with `within`, declared anywhere inside it. */
  matches(declaration: ts.Node, wanted: Declaration, within = false): boolean {
    const name = qualifiedName(declaration);
    if (name === undefined) return false;
    if (name !== wanted.name && !(within && name.startsWith(`${wanted.name}.`))) return false;
    return this.moduleOf(declaration) === wanted.module;
  }

  /** Stops, naming the field, when no declaration of the compiler has that module and name. */
  requireExists(wanted: Declaration, field: string): void {
    for (const program of this.programs) {
      for (const sourceFile of program.getSourceFiles()) {
        const fileName = sourceFile.fileName;
        const module = this.codebase.file(fileName)?.path ?? this.codebase.packageOf(fileName);
        if (module !== wanted.module) continue;
        if (this.namesIn(sourceFile).has(wanted.name)) return;
      }
    }
    throw new StopError(
      `${field} names ${wanted.module} ${wanted.name}, which the compiler cannot find`,
    );
  }

  private namesIn(sourceFile: ts.SourceFile): Set<string> {
    const cached = this.namesByFile.get(sourceFile.fileName);
    if (cached) return cached;
    const names = new Set<string>();
    const visit = (node: ts.Node): void => {
      const name = nameOf(node) !== undefined ? qualifiedName(node) : undefined;
      if (name !== undefined) names.add(name);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    this.namesByFile.set(sourceFile.fileName, names);
    return names;
  }
}
