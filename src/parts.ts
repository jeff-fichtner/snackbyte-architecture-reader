import ts from 'typescript';
import type { Codebase, CodebaseFile } from './codebase.js';
import { IdRegistry, namedId, unnamedId } from './ids.js';

export type PartKind =
  | 'file'
  | 'function'
  | 'method'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'namespace';

export interface Part {
  id: string;
  kind: PartKind;
  file: CodebaseFile;
  /** The declaration (or the file) this part is. */
  node: ts.Node;
  /** For a function or method: the function-like node holding its body. */
  fn?: ts.FunctionLikeDeclaration;
}

export interface PartIndex {
  parts: Part[];
  byId: Map<string, Part>;
  /** Every declaration node and function-like node that is a part, or stands for one. */
  byNode: Map<ts.Node, Part>;
  /** The part of each codebase file. */
  fileParts: Map<CodebaseFile, Part>;
}

type FunctionValue = ts.ArrowFunction | ts.FunctionExpression;

/** Strips parentheses and type assertions around an expression. */
export function unwrap(expression: ts.Expression): ts.Expression {
  let e = expression;
  for (;;) {
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) {
      e = e.expression;
    } else if (ts.isTypeAssertionExpression(e) || ts.isNonNullExpression(e)) {
      e = e.expression;
    } else {
      return e;
    }
  }
}

function functionValue(expression: ts.Expression | undefined): FunctionValue | undefined {
  if (!expression) return undefined;
  const e = unwrap(expression);
  return ts.isArrowFunction(e) || ts.isFunctionExpression(e) ? e : undefined;
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isBindingElement(element) ? bindingNames(element.name) : [],
  );
}

/** Walks every codebase file and gives each file and declaration in it a part and an id. */
export function collectParts(codebase: Codebase): PartIndex {
  const parts: Part[] = [];
  const byId = new Map<string, Part>();
  const byNode = new Map<ts.Node, Part>();
  const fileParts = new Map<CodebaseFile, Part>();
  const registry = new IdRegistry();
  const unnamedCounts = new Map<Part, number>();

  for (const file of codebase.files) {
    const filePart = add({ id: file.path, kind: 'file', file, node: file.sourceFile });
    fileParts.set(file, filePart);
    visitChildren(file.sourceFile, filePart, file);
  }
  foldOverloads();
  return { parts, byId, byNode, fileParts };

  function add(part: Part): Part {
    const claimed = { ...part, id: registry.claim(part.id) };
    parts.push(claimed);
    byId.set(claimed.id, claimed);
    byNode.set(claimed.node, claimed);
    if (claimed.fn) byNode.set(claimed.fn, claimed);
    return claimed;
  }

  function named(
    enclosing: Part,
    name: string,
    kind: PartKind,
    node: ts.Node,
    fn?: ts.FunctionLikeDeclaration,
  ): Part {
    const id = namedId(enclosing.id, enclosing.kind === 'file', name);
    return add({ id, kind, file: enclosing.file, node, ...(fn ? { fn } : {}) });
  }

  function unnamed(enclosing: Part, fn: ts.FunctionLikeDeclaration): Part {
    const position = (unnamedCounts.get(enclosing) ?? 0) + 1;
    unnamedCounts.set(enclosing, position);
    const id = unnamedId(enclosing.id, enclosing.kind === 'file', position);
    return add({ id, kind: 'function', file: enclosing.file, node: fn, fn });
  }

  function visitChildren(node: ts.Node, enclosing: Part, file: CodebaseFile): void {
    ts.forEachChild(node, (child) => visit(child, enclosing, file));
  }

  /** Whether a part at this place is a declaration the file or a namespace exposes. */
  function outerLevel(enclosing: Part): boolean {
    return enclosing.kind === 'file' || enclosing.kind === 'namespace';
  }

  function visitFunction(fn: ts.FunctionLikeDeclaration, part: Part, file: CodebaseFile): void {
    for (const parameter of fn.parameters) visit(parameter, part, file);
    if (fn.body) visit(fn.body, part, file);
  }

  function visitObjectLiteral(
    literal: ts.ObjectLiteralExpression,
    enclosing: Part,
    prefix: string,
    file: CodebaseFile,
  ): void {
    for (const property of literal.properties) {
      const name = property.name ? propertyName(property.name) : undefined;
      const path = name === undefined ? undefined : prefix === '' ? name : `${prefix}.${name}`;
      if (ts.isMethodDeclaration(property) || ts.isAccessor(property)) {
        if (path === undefined) {
          visitFunction(property, unnamed(enclosing, property), file);
        } else if (property.body) {
          visitFunction(property, named(enclosing, path, 'function', property, property), file);
        }
      } else if (ts.isPropertyAssignment(property)) {
        const fn = functionValue(property.initializer);
        const inner = unwrap(property.initializer);
        if (fn && path !== undefined && !(ts.isFunctionExpression(fn) && fn.name)) {
          visitFunction(fn, named(enclosing, path, 'function', property, fn), file);
        } else if (ts.isObjectLiteralExpression(inner) && path !== undefined) {
          visitObjectLiteral(inner, enclosing, path, file);
        } else {
          visit(property.initializer, enclosing, file);
        }
      } else {
        visit(property, enclosing, file);
      }
    }
  }

  function visitClassMembers(cls: ts.ClassLikeDeclaration, part: Part, file: CodebaseFile): void {
    for (const member of cls.members) {
      const name = member.name ? propertyName(member.name) : undefined;
      if (ts.isConstructorDeclaration(member)) {
        if (member.body)
          visitFunction(member, named(part, 'constructor', 'method', member, member), file);
        else for (const parameter of member.parameters) visit(parameter, part, file);
      } else if (ts.isMethodDeclaration(member) || ts.isAccessor(member)) {
        if (!member.body) continue;
        const method =
          name === undefined ? unnamed(part, member) : named(part, name, 'method', member, member);
        visitFunction(member, method, file);
      } else if (ts.isPropertyDeclaration(member)) {
        const fn = functionValue(member.initializer);
        if (fn && name !== undefined) {
          visitFunction(fn, named(part, name, 'method', member, fn), file);
        } else {
          const owner = name === undefined ? part : named(part, name, 'variable', member);
          if (member.initializer) visit(member.initializer, owner, file);
        }
      } else {
        visitChildren(member, part, file);
      }
    }
  }

  function visit(node: ts.Node, enclosing: Part, file: CodebaseFile): void {
    if (ts.isFunctionDeclaration(node)) {
      if (!node.body) return;
      const name = node.name?.text ?? 'default';
      visitFunction(node, named(enclosing, name, 'function', node, node), file);
    } else if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const name = node.name?.text ?? (ts.isClassDeclaration(node) ? 'default' : undefined);
      const part =
        name === undefined
          ? add({
              id: unnamedId(enclosing.id, enclosing.kind === 'file', nextUnnamed(enclosing)),
              kind: 'class',
              file,
              node,
            })
          : named(enclosing, name, 'class', node);
      visitClassMembers(node, part, file);
    } else if (ts.isInterfaceDeclaration(node)) {
      named(enclosing, node.name.text, 'interface', node);
    } else if (ts.isTypeAliasDeclaration(node)) {
      named(enclosing, node.name.text, 'type', node);
    } else if (ts.isEnumDeclaration(node)) {
      named(enclosing, node.name.text, 'enum', node);
    } else if (ts.isModuleDeclaration(node)) {
      const part = named(enclosing, node.name.text, 'namespace', node);
      if (node.body) visit(node.body, part, file);
    } else if (ts.isVariableDeclaration(node)) {
      visitVariable(node, enclosing, file);
    } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const part =
        ts.isFunctionExpression(node) && node.name
          ? named(enclosing, node.name.text, 'function', node, node)
          : unnamed(enclosing, node);
      visitFunction(node, part, file);
    } else if (ts.isObjectLiteralExpression(node)) {
      visitObjectLiteral(node, enclosing, '', file);
    } else {
      visitChildren(node, enclosing, file);
    }
  }

  function nextUnnamed(enclosing: Part): number {
    const position = (unnamedCounts.get(enclosing) ?? 0) + 1;
    unnamedCounts.set(enclosing, position);
    return position;
  }

  function visitVariable(node: ts.VariableDeclaration, enclosing: Part, file: CodebaseFile): void {
    const fn = functionValue(node.initializer);
    const init = node.initializer ? unwrap(node.initializer) : undefined;
    if (ts.isIdentifier(node.name) && fn && !(ts.isFunctionExpression(fn) && fn.name)) {
      visitFunction(fn, named(enclosing, node.name.text, 'function', node, fn), file);
      return;
    }
    if (ts.isIdentifier(node.name) && init && ts.isClassExpression(init) && !init.name) {
      visitClassMembers(init, named(enclosing, node.name.text, 'class', node), file);
      return;
    }
    if (!outerLevel(enclosing)) {
      if (node.initializer) visit(node.initializer, enclosing, file);
      return;
    }
    const names = bindingNames(node.name);
    const owners = names.map((name) => named(enclosing, name, 'variable', node));
    const owner = owners.length === 1 ? owners[0] : enclosing;
    if (node.initializer && owner) {
      if (init && ts.isObjectLiteralExpression(init) && owners.length === 1) {
        visitObjectLiteral(init, owner, '', file);
      } else {
        visit(node.initializer, owner, file);
      }
    }
  }

  /** Overload signatures have no body; calls that resolve to one belong to the implementation. */
  function foldOverloads(): void {
    for (const part of [...parts]) {
      if (!part.fn) continue;
      const checker = part.file.checker;
      const nameNode =
        ts.isFunctionDeclaration(part.fn) || ts.isMethodDeclaration(part.fn)
          ? part.fn.name
          : undefined;
      if (!nameNode) continue;
      const symbol = checker.getSymbolAtLocation(nameNode);
      for (const declaration of symbol?.declarations ?? []) {
        if (!byNode.has(declaration)) byNode.set(declaration, part);
      }
    }
  }
}

/** The part that code at `node` belongs to for calls: its innermost function or method, else its file. */
export function owningPart(node: ts.Node, index: PartIndex, file: CodebaseFile): Part {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    const part = index.byNode.get(n);
    if (part && (part.kind === 'function' || part.kind === 'method') && part.fn === n) return part;
  }
  const filePart = index.fileParts.get(file);
  if (!filePart) throw new Error(`no part for file ${file.path}`);
  return filePart;
}
