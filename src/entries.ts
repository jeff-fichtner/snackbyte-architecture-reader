import ts from 'typescript';
import type { Codebase } from './codebase.js';
import type { DeclarationMatcher } from './declarations.js';
import { StopError } from './errors.js';
import { unwrap, type Part, type PartIndex } from './parts.js';
import type { Resolver } from './relationships.js';
import { VALUE_RULE, type EntryRule, type TypeEntryRule } from './settings.js';

export interface EntryIndex {
  /** Each entry function, with the rule that makes it one. */
  entries: Map<Part, string>;
  /** Functions handed to outside code at a call, which run as steps at that call. */
  handedOver: Map<ts.Node, Part[]>;
}

function isFunctionPart(part: Part | undefined): part is Part {
  return part !== undefined && (part.kind === 'function' || part.kind === 'method') && !!part.fn;
}

/** The expression whose position decides how a function value is used. */
function outermost(node: ts.Node): ts.Node {
  let n = node;
  while (
    n.parent &&
    (ts.isParenthesizedExpression(n.parent) ||
      ts.isAsExpression(n.parent) ||
      ts.isSatisfiesExpression(n.parent) ||
      ts.isNonNullExpression(n.parent) ||
      ts.isTypeAssertionExpression(n.parent))
  ) {
    n = n.parent;
  }
  return n;
}

function isCallee(node: ts.Node): boolean {
  const n = outermost(node);
  const parent = n.parent;
  return (
    !!parent &&
    (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
    parent.expression === n
  );
}

/** Whether an identifier or property name is a declaration's own name rather than a use of it. */
function isDeclarationName(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertyAccessExpression(parent) || ts.isQualifiedName(parent)) return false;
  return (parent as ts.Node & { name?: ts.Node }).name === node;
}

function inTypePosition(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isTypeNode(n) && !ts.isExpressionWithTypeArguments(n)) return true;
    if (ts.isImportSpecifier(n) || ts.isExportSpecifier(n) || ts.isImportClause(n)) return true;
    if (ts.isStatement(n) || ts.isSourceFile(n)) return false;
  }
  return false;
}

/**
 * Every entry into the code, and every function handed to outside code.
 *
 * A function becomes an entry when an entry rule matches it: by the declaration of the type the code
 * it is given to expects for it, or by naming it. A function handed to code outside the codebase
 * (a callback given to a package or a built-in) runs as a step where it is handed over. A function
 * used as a value any other way (stored, or handed to codebase code that calls it through a
 * parameter) is called where the compiler cannot follow, so it starts trips of its own under the
 * rule `value`. Every function that escapes as a value is accounted for, so no path can disappear.
 */
export function collectEntries(
  codebase: Codebase,
  index: PartIndex,
  resolver: Resolver,
  matcher: DeclarationMatcher,
  rules: EntryRule[],
): EntryIndex {
  const entries = new Map<Part, string>();
  const valueParts = new Set<Part>();
  const handedOver = new Map<ts.Node, Part[]>();
  const typeRules = rules.filter((r): r is TypeEntryRule => 'type' in r);
  const matchedRules = new Set<string>();

  rules.forEach((rule, i) => {
    if ('type' in rule) matcher.requireExists(rule.type, `entries[${i}].type`);
  });

  const setEntry = (part: Part, rule: string): void => {
    const existing = entries.get(part);
    if (existing !== undefined && existing !== rule) {
      throw new StopError(`${part.id} is matched by two entry rules: "${existing}" and "${rule}"`);
    }
    entries.set(part, rule);
    matchedRules.add(rule);
  };

  rules.forEach((rule, i) => {
    if (!('declarations' in rule)) return;
    for (const id of rule.declarations) {
      const part = index.byId.get(id);
      if (!part)
        throw new StopError(`entries[${i}] "${rule.name}" names ${id}, which is not a part`);
      if (!isFunctionPart(part)) {
        throw new StopError(`entries[${i}] "${rule.name}" names ${id}, which is not a function`);
      }
      setEntry(part, rule.name);
    }
  });

  for (const file of codebase.files) {
    const { checker } = file;
    const visit = (node: ts.Node): void => {
      const use = functionUse(node, checker);
      if (use) consider(use.part, use.at, use.candidates, checker);
      ts.forEachChild(node, visit);
    };
    visit(file.sourceFile);
  }

  for (const part of valueParts) if (!entries.has(part)) entries.set(part, VALUE_RULE);

  rules.forEach((rule, i) => {
    if (!matchedRules.has(rule.name)) {
      throw new StopError(`entries[${i}] "${rule.name}" matches no function`);
    }
  });
  return { entries, handedOver };

  /** A place where a codebase function is used as a value, and the declarations its type there comes from. */
  function functionUse(
    node: ts.Node,
    checker: ts.TypeChecker,
  ): { part: Part; at: ts.Node; candidates: ts.Node[] } | undefined {
    // A function written in place: an arrow, a function expression, an object-literal member.
    const own = index.byNode.get(node);
    if (isFunctionPart(own) && own.node === node) {
      if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        if (isCallee(node)) return undefined;
        return { part: own, at: outermost(node), candidates: contextual(node, checker) };
      }
      if (ts.isMethodDeclaration(node) && ts.isObjectLiteralExpression(node.parent)) {
        return { part: own, at: node.parent, candidates: member(node, checker) };
      }
      if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.parent)) {
        const candidates = [...member(node, checker), ...contextual(node.initializer, checker)];
        return { part: own, at: node.parent, candidates };
      }
      return undefined;
    }
    // A reference to a function declared elsewhere.
    if (!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node)) return undefined;
    if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) return undefined;
    if (isDeclarationName(node) || inTypePosition(node) || isCallee(node)) return undefined;
    const symbol = ts.isShorthandPropertyAssignment(node.parent)
      ? checker.getShorthandAssignmentValueSymbol(node.parent)
      : checker.getSymbolAtLocation(node);
    const declaration = resolver.declarationOf(symbol, checker);
    const part = declaration ? index.byNode.get(declaration) : undefined;
    if (!isFunctionPart(part)) return undefined;
    const at = outermost(node);
    const candidates = contextual(at as ts.Expression, checker);
    const holder =
      ts.isShorthandPropertyAssignment(node.parent) || ts.isPropertyAssignment(at.parent);
    if (holder && ts.isObjectLiteralExpression(at.parent.parent)) {
      candidates.push(...member(at.parent as ts.ObjectLiteralElementLike, checker));
    }
    return { part, at, candidates };
  }

  function consider(part: Part, at: ts.Node, candidates: ts.Node[], checker: ts.TypeChecker): void {
    const matching = typeRules.filter((rule) =>
      candidates.some((declaration) => matcher.matches(declaration, rule.type, rule.within)),
    );
    for (const rule of matching) setEntry(part, rule.name);
    if (matching.length > 0) return;
    const call = handedTo(at);
    if (call && isOutside(call, checker)) {
      const list = handedOver.get(call) ?? [];
      if (!list.includes(part)) list.push(part);
      handedOver.set(call, list);
      return;
    }
    valueParts.add(part);
  }

  /** The call a value is an argument of, directly or inside object and array literals. */
  function handedTo(at: ts.Node): ts.CallExpression | ts.NewExpression | undefined {
    let n = at;
    for (;;) {
      const parent = n.parent;
      if (!parent) return undefined;
      if ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) && parent.expression !== n) {
        return parent.arguments?.includes(n as ts.Expression) ? parent : undefined;
      }
      if (
        ts.isObjectLiteralExpression(parent) ||
        ts.isArrayLiteralExpression(parent) ||
        ts.isPropertyAssignment(parent) ||
        ts.isShorthandPropertyAssignment(parent) ||
        ts.isSpreadElement(parent) ||
        ts.isSpreadAssignment(parent) ||
        ts.isParenthesizedExpression(parent)
      ) {
        n = parent;
        continue;
      }
      return undefined;
    }
  }

  function isOutside(call: ts.CallExpression | ts.NewExpression, checker: ts.TypeChecker): boolean {
    const { declaration } = resolver.callee(call, checker);
    if (!declaration) return false;
    return codebase.file(declaration.getSourceFile().fileName) === undefined;
  }

  /** The declarations of the type the code expects at an expression. */
  function contextual(expression: ts.Expression, checker: ts.TypeChecker): ts.Node[] {
    const type =
      checker.getContextualType(unwrap(expression)) ?? checker.getContextualType(expression);
    return type ? typeDeclarations(type, checker) : [];
  }

  /** The declarations of the property an object-literal member fills, and of that property's type. */
  function member(element: ts.ObjectLiteralElementLike, checker: ts.TypeChecker): ts.Node[] {
    const literal = element.parent as ts.ObjectLiteralExpression;
    const owner = checker.getContextualType(literal);
    const name =
      element.name && (ts.isIdentifier(element.name) || ts.isStringLiteral(element.name))
        ? element.name.text
        : undefined;
    if (!owner || name === undefined) return [];
    const out: ts.Node[] = [];
    for (const type of owner.isUnion() ? owner.types : [owner]) {
      const property = type.getProperty(name);
      if (!property) continue;
      out.push(...(property.declarations ?? []));
      out.push(...typeDeclarations(checker.getTypeOfSymbol(property), checker));
    }
    return out;
  }
}

/**
 * The declarations a type comes from: its alias, its own symbol, the members of a union or
 * intersection, and every interface or class it extends, so a type that extends the named one
 * matches it too.
 */
function typeDeclarations(type: ts.Type, checker: ts.TypeChecker): ts.Node[] {
  const out: ts.Node[] = [];
  const seen = new Set<ts.Type>();
  const pending = type.isUnion() || type.isIntersection() ? [type, ...type.types] : [type];
  while (pending.length > 0) {
    const member = pending.pop() as ts.Type;
    if (seen.has(member)) continue;
    seen.add(member);
    out.push(...(member.aliasSymbol?.declarations ?? []));
    out.push(...(member.getSymbol()?.declarations ?? []));
    const target = (member as ts.TypeReference).target ?? member;
    if (target.isClassOrInterface()) pending.push(...(checker.getBaseTypes(target) ?? []));
  }
  return out;
}
