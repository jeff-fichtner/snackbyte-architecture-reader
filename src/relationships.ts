import ts from 'typescript';
import type { Codebase, CodebaseFile } from './codebase.js';
import { packageId } from './ids.js';
import { owningPart, type Part, type PartIndex } from './parts.js';
import type { Relationship } from './report.js';

/** What a call or a reference resolves to: a codebase part, a kept package, or nothing we report. */
export interface Target {
  part?: Part;
  /** The `pkg:` id of a kept package. */
  pkg?: string;
  /** The declaration the compiler resolved, wherever it lives. */
  declaration?: ts.Node;
}

function aliased(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

/** Resolves calls, references and module specifiers to the parts and packages they name. */
export class Resolver {
  constructor(
    private readonly codebase: Codebase,
    private readonly index: PartIndex,
    private readonly keep: Set<string>,
  ) {}

  /** The target a declaration node stands for. */
  targetOf(declaration: ts.Node | undefined): Target {
    if (!declaration) return {};
    const part = this.index.byNode.get(declaration);
    if (part) return { part, declaration };
    const fileName = declaration.getSourceFile().fileName;
    if (this.codebase.file(fileName)) return { declaration };
    const name = this.codebase.packageOf(fileName);
    if (name !== undefined && this.keep.has(name)) return { pkg: packageId(name), declaration };
    return { declaration };
  }

  /** The declaration a symbol resolves to, through import aliases. */
  declarationOf(symbol: ts.Symbol | undefined, checker: ts.TypeChecker): ts.Node | undefined {
    if (!symbol) return undefined;
    const resolved = aliased(symbol, checker);
    return resolved.valueDeclaration ?? resolved.declarations?.[0];
  }

  /** What a call or `new` resolves to. `new X()` without a constructor of its own names `X`. */
  callee(call: ts.CallExpression | ts.NewExpression, checker: ts.TypeChecker): Target {
    const signature = checker.getResolvedSignature(call);
    const declaration = signature?.declaration;
    if (declaration && !ts.isJSDocSignature(declaration)) return this.targetOf(declaration);
    const symbol = checker.getSymbolAtLocation(call.expression);
    return this.targetOf(this.declarationOf(symbol, checker));
  }

  /** The file a module specifier resolves to, as a target. */
  module(specifier: ts.Expression, checker: ts.TypeChecker): Target {
    const symbol = checker.getSymbolAtLocation(specifier);
    const declaration = symbol?.declarations?.find(ts.isSourceFile) ?? symbol?.declarations?.[0];
    if (!declaration) return {};
    if (ts.isSourceFile(declaration)) {
      const file = this.codebase.file(declaration.fileName);
      const part = file ? this.index.fileParts.get(file) : undefined;
      if (part) return { part, declaration };
    }
    return this.targetOf(declaration);
  }

  /** The declaration a heritage clause names. */
  heritage(type: ts.ExpressionWithTypeArguments, checker: ts.TypeChecker): Target {
    return this.targetOf(this.declarationOf(checker.getSymbolAtLocation(type.expression), checker));
  }
}

function idOf(target: Target): string | undefined {
  return target.part?.id ?? target.pkg;
}

function isImportCall(node: ts.Node): node is ts.CallExpression {
  return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
}

/**
 * Every part's relationships: `imports` file to file, `calls` from the innermost function, method
 * or file holding the call, and `implements` / `extends` from a class or interface.
 */
export function collectRelationships(
  codebase: Codebase,
  index: PartIndex,
  resolver: Resolver,
): Map<Part, Relationship[]> {
  const rel = new Map<Part, Relationship[]>();
  const add = (from: Part, to: string | undefined, kind: Relationship['kind']): void => {
    if (to === undefined || to === from.id) return;
    const list = rel.get(from) ?? [];
    list.push({ to, kind });
    rel.set(from, list);
  };

  for (const file of codebase.files) {
    const filePart = index.fileParts.get(file);
    if (!filePart) continue;
    const { checker } = file;
    const visit = (node: ts.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        add(filePart, idOf(resolver.module(node.moduleSpecifier, checker)), 'imports');
      } else if (isImportCall(node)) {
        const [specifier] = node.arguments;
        if (specifier && ts.isStringLiteralLike(specifier)) {
          add(filePart, idOf(resolver.module(specifier, checker)), 'imports');
        }
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        add(filePart, idOf(resolver.module(node.argument.literal, checker)), 'imports');
      } else if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        add(owningPart(node, index, file), idOf(resolver.callee(node, checker)), 'calls');
      } else if (ts.isClassLike(node) || ts.isInterfaceDeclaration(node)) {
        heritage(node, file);
      }
      ts.forEachChild(node, visit);
    };
    visit(file.sourceFile);
  }
  return rel;

  function heritage(
    node: ts.ClassLikeDeclaration | ts.InterfaceDeclaration,
    file: CodebaseFile,
  ): void {
    const from = index.byNode.get(node);
    if (!from) return;
    for (const clause of node.heritageClauses ?? []) {
      const kind = clause.token === ts.SyntaxKind.ImplementsKeyword ? 'implements' : 'extends';
      for (const type of clause.types) add(from, idOf(resolver.heritage(type, file.checker)), kind);
    }
  }
}
