import ts from 'typescript';
import type { Codebase } from './codebase.js';
import { unwrap, type Part, type PartIndex } from './parts.js';
import type { Resolver } from './relationships.js';
import { inTypePosition, isDeclarationName, isFunctionPart } from './syntax.js';

/** The deepest property path followed; a value held deeper is unknown. */
const DEPTH = 8;

type Path = readonly string[];

const keyOf = (path: Path): string => JSON.stringify(path);

function isPrefix(prefix: Path, path: Path): boolean {
  return prefix.length <= path.length && prefix.every((name, i) => path[i] === name);
}

/** What one parameter of one function can hold, and how the function uses it. */
interface Slot {
  fn: Part;
  /** The functions each property path can hold, from every call that passes one. */
  holds: Map<string, { path: Path; parts: Set<Part> }>;
  /** Paths at which the parameter can hold something the reader cannot follow. */
  unknown: Map<string, Path>;
  /** Calls through the parameter, by the path called. */
  calls: { path: Path; call: ts.CallExpression }[];
  /** Paths read in a way that lets what they hold go somewhere unfollowed. */
  escapes: Path[];
}

/** A parameter, or a property path of one, passed on as an argument or inside one. */
interface Edge {
  from: Slot;
  fromPath: Path;
  to: Slot;
  toPath: Path;
}

export interface Bindings {
  /** Calls through a parameter that can reach exactly one codebase function. */
  calls: Map<ts.CallExpression, Part>;
  /**
   * Whether a function handed at this call is traced: it is passed into a parameter, every call of
   * it through that parameter resolves to it alone, and nothing else takes it anywhere unfollowed.
   */
  traced(part: Part, at: ts.CallExpression | ts.NewExpression): boolean;
}

/**
 * Follows functions handed to codebase functions through their parameters. A function passed as an
 * argument, or as a property of an object literal passed as one, is held by that parameter at that
 * property path; a parameter passed on to another codebase function carries what it holds. A call
 * through a parameter (`deps.engine(…)`, in the function or in any function written inside it)
 * resolves to the function the parameter holds at that path, when it can hold exactly one and
 * nothing the reader cannot follow.
 *
 * Only a closed function's parameters are known: one written as a function, called only where the
 * compiler resolves the call to it, and never used as a value or named by an entry rule. Anything
 * else can be called with arguments the reader does not see.
 */
export function collectBindings(
  codebase: Codebase,
  index: PartIndex,
  resolver: Resolver,
  closed: (part: Part) => boolean,
): Bindings {
  const slots = new Map<Part, Slot[]>();
  const edges: Edge[] = [];
  /** Argument expressions that pass a parameter on along an edge. */
  const passedOn = new Set<ts.Node>();
  /** Each function handed into a parameter, by the calls that hand it. */
  const handed = new Map<Part, Set<ts.Node>>();
  /** Functions handed somewhere the reader does not follow. */
  const dirty = new Set<Part>();

  const slotOf = (fn: Part, i: number): Slot => {
    let list = slots.get(fn);
    if (!list) {
      list = [];
      slots.set(fn, list);
    }
    let slot = list[i];
    if (!slot) {
      slot = { fn, holds: new Map(), unknown: new Map(), calls: [], escapes: [] };
      list[i] = slot;
    }
    return slot;
  };

  /** Whether the last pass over the edges added anything; set by `hold` and `markUnknown`. */
  let changed: boolean;
  const hold = (slot: Slot, path: Path, parts: Iterable<Part>): void => {
    if (path.length > DEPTH) {
      markUnknown(slot, path.slice(0, DEPTH));
      return;
    }
    const key = keyOf(path);
    let entry = slot.holds.get(key);
    if (!entry) {
      entry = { path, parts: new Set() };
      slot.holds.set(key, entry);
    }
    for (const part of parts) {
      if (!entry.parts.has(part)) {
        entry.parts.add(part);
        changed = true;
      }
    }
  };
  function markUnknown(slot: Slot, path: Path): void {
    const at = path.slice(0, DEPTH);
    const key = keyOf(at);
    if (slot.unknown.has(key)) return;
    slot.unknown.set(key, at);
    changed = true;
  }
  const isUnknown = (slot: Slot, path: Path): boolean =>
    !closed(slot.fn) || [...slot.unknown.values()].some((u) => isPrefix(u, path));

  // Where each parameter's values come from: every call the compiler resolves to a codebase function.
  for (const file of codebase.files) {
    const { checker } = file;
    const visit = (node: ts.Node): void => {
      if (
        (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
        node.expression.kind !== ts.SyntaxKind.ImportKeyword
      ) {
        const target = resolver.callee(node, checker).part;
        if (target?.fn) argumentsOf(node, target, target.fn, checker);
      }
      if (
        (ts.isFunctionDeclaration(node) ||
          ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node) ||
          ts.isMethodDeclaration(node)) &&
        index.byNode.get(node)?.fn === node
      ) {
        patternsOf(index.byNode.get(node) as Part, node);
      }
      ts.forEachChild(node, visit);
    };
    visit(file.sourceFile);
  }

  // How each parameter is used: every reference to it, followed through its property accesses.
  for (const file of codebase.files) {
    const { checker } = file;
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) use(node, checker);
      ts.forEachChild(node, visit);
    };
    visit(file.sourceFile);
  }

  // What each parameter holds, carried along every edge until nothing changes.
  do {
    changed = false;
    for (const edge of edges) carry(edge);
  } while (changed);

  const calls = new Map<ts.CallExpression, Part>();
  for (const list of slots.values()) {
    for (const slot of list) {
      if (!slot) continue;
      for (const { path, call } of slot.calls) {
        if (isUnknown(slot, path)) continue;
        const parts = slot.holds.get(keyOf(path))?.parts;
        if (parts?.size === 1) calls.set(call, [...parts][0] as Part);
      }
    }
  }

  for (const list of slots.values()) {
    for (const slot of list) {
      if (!slot) continue;
      for (const { path, parts } of slot.holds.values()) {
        const clean =
          closed(slot.fn) &&
          !slot.escapes.some((e) => isPrefix(e, path)) &&
          slot.calls.every(({ path: called, call }) => {
            if (keyOf(called) === keyOf(path)) return parts.size === 1 && calls.has(call);
            return !isPrefix(called, path) && !isPrefix(path, called);
          });
        if (!clean) for (const part of parts) dirty.add(part);
      }
    }
  }

  return {
    calls,
    traced: (part, at) => (handed.get(part)?.has(at) ?? false) && !dirty.has(part),
  };

  function argumentsOf(
    call: ts.CallExpression | ts.NewExpression,
    target: Part,
    fn: ts.FunctionLikeDeclaration,
    checker: ts.TypeChecker,
  ): void {
    const args = call.arguments ?? ts.factory.createNodeArray();
    const spread = args.findIndex((a) => ts.isSpreadElement(a));
    fn.parameters.forEach((parameter, i) => {
      const slot = slotOf(target, i);
      if (parameter.dotDotDotToken || (spread !== -1 && spread <= i)) {
        markUnknown(slot, []);
        for (const arg of args.slice(i)) untraced(arg);
        return;
      }
      const arg = args[i];
      if (arg) flow(arg, slot, [], call, checker);
      else if (parameter.initializer) flow(parameter.initializer, slot, [], undefined, checker);
    });
    for (const arg of args.slice(fn.parameters.length)) untraced(arg);
  }

  /** Records what an expression puts into a parameter at a property path. */
  function flow(
    expression: ts.Expression,
    slot: Slot,
    path: Path,
    call: ts.CallExpression | ts.NewExpression | undefined,
    checker: ts.TypeChecker,
  ): void {
    const e = unwrap(expression);
    const fnPart = functionAt(e, checker);
    if (fnPart) {
      give(fnPart, slot, path, call);
      return;
    }
    const root = chainRoot(e, checker);
    if (root) {
      edges.push({ from: root.slot, fromPath: root.path, to: slot, toPath: path });
      passedOn.add(expression);
      return;
    }
    if (ts.isObjectLiteralExpression(e)) {
      for (const property of e.properties) {
        const name = property.name ? staticName(property.name) : undefined;
        if (ts.isSpreadAssignment(property) || name === undefined) {
          markUnknown(slot, path);
          untraced(property);
          continue;
        }
        const at = [...path, name];
        if (ts.isPropertyAssignment(property)) {
          flow(property.initializer, slot, at, call, checker);
        } else if (ts.isShorthandPropertyAssignment(property)) {
          const symbol = checker.getShorthandAssignmentValueSymbol(property);
          const declared = resolver.declarationOf(symbol, checker);
          const part = declared ? index.byNode.get(declared) : undefined;
          const parameter = declared ? parameterPath(declared) : undefined;
          if (isFunctionPart(part)) give(part, slot, at, call);
          else if (parameter) {
            edges.push({ from: parameter.slot, fromPath: parameter.path, to: slot, toPath: at });
            passedOn.add(property.name);
          } else markUnknown(slot, at);
        } else if (ts.isMethodDeclaration(property)) {
          const part = index.byNode.get(property);
          if (isFunctionPart(part)) give(part, slot, at, call);
          else markUnknown(slot, at);
        } else {
          markUnknown(slot, at);
        }
      }
      return;
    }
    if (isPlainData(e)) return;
    markUnknown(slot, path);
    untraced(e);
  }

  function give(
    part: Part,
    slot: Slot,
    path: Path,
    call: ts.CallExpression | ts.NewExpression | undefined,
  ): void {
    hold(slot, path, [part]);
    if (!call) return;
    const calls = handed.get(part) ?? new Set<ts.Node>();
    calls.add(call);
    handed.set(part, calls);
  }

  /** Marks every function written or named inside an expression the reader does not follow. */
  function untraced(node: ts.Node): void {
    const visit = (n: ts.Node): void => {
      const part = index.byNode.get(n);
      if (isFunctionPart(part) && (part.node === n || part.fn === n)) {
        dirty.add(part);
        return;
      }
      if (ts.isIdentifier(n)) {
        const file = codebase.file(n.getSourceFile().fileName);
        if (file) {
          const symbol = ts.isShorthandPropertyAssignment(n.parent)
            ? file.checker.getShorthandAssignmentValueSymbol(n.parent)
            : file.checker.getSymbolAtLocation(n);
          const declared = resolver.declarationOf(symbol, file.checker);
          const named = declared ? index.byNode.get(declared) : undefined;
          if (isFunctionPart(named)) dirty.add(named);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
  }

  /** A codebase function an expression is: one written in place, or a reference to one. */
  function functionAt(e: ts.Expression, checker: ts.TypeChecker): Part | undefined {
    if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) {
      const part = index.byNode.get(e);
      return isFunctionPart(part) ? part : undefined;
    }
    if (!ts.isIdentifier(e) && !ts.isPropertyAccessExpression(e)) return undefined;
    const declared = resolver.declarationOf(checker.getSymbolAtLocation(e), checker);
    const part = declared ? index.byNode.get(declared) : undefined;
    return isFunctionPart(part) ? part : undefined;
  }

  /** The parameter and property path an expression like `deps` or `deps.store` reads. */
  function chainRoot(
    e: ts.Expression,
    checker: ts.TypeChecker,
  ): { slot: Slot; path: Path } | undefined {
    const names: string[] = [];
    let n: ts.Expression = e;
    for (;;) {
      n = unwrap(n);
      if (ts.isPropertyAccessExpression(n)) {
        names.unshift(n.name.text);
        n = n.expression;
      } else if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression)) {
        names.unshift(n.argumentExpression.text);
        n = n.expression;
      } else break;
    }
    if (!ts.isIdentifier(n)) return undefined;
    const declared = checker.getSymbolAtLocation(n)?.valueDeclaration;
    const root = declared ? parameterPath(declared) : undefined;
    return root ? { slot: root.slot, path: [...root.path, ...names] } : undefined;
  }

  /** The parameter slot and property path a parameter, or a name destructured from one, stands for. */
  function parameterPath(declared: ts.Node): { slot: Slot; path: Path } | undefined {
    const names: string[] = [];
    let n: ts.Node = declared;
    while (ts.isBindingElement(n)) {
      const name = n.propertyName ?? n.name;
      const text = ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
      if (text === undefined || n.dotDotDotToken || !ts.isObjectBindingPattern(n.parent)) {
        return undefined;
      }
      names.unshift(text);
      n = n.parent.parent;
    }
    if (!ts.isParameter(n) || n.dotDotDotToken) return undefined;
    const fn = n.parent;
    const part = index.byNode.get(fn);
    if (!part || part.fn !== fn) return undefined;
    return { slot: slotOf(part, fn.parameters.indexOf(n)), path: names };
  }

  /**
   * A destructured parameter is read where it is written: a default, a rest element, a computed
   * name or an array pattern takes what it reads somewhere the reader does not follow.
   */
  function patternsOf(part: Part, fn: ts.FunctionLikeDeclaration): void {
    fn.parameters.forEach((parameter, i) => {
      if (ts.isIdentifier(parameter.name)) return;
      const walk = (pattern: ts.BindingPattern, path: Path): void => {
        if (ts.isArrayBindingPattern(pattern)) {
          slotOf(part, i).escapes.push(path);
          return;
        }
        for (const element of pattern.elements) {
          const name = element.propertyName ?? element.name;
          const text = ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
          if (element.dotDotDotToken || text === undefined) {
            slotOf(part, i).escapes.push(path);
            continue;
          }
          const at = [...path, text];
          if (element.initializer) markUnknown(slotOf(part, i), at);
          if (!ts.isIdentifier(element.name)) walk(element.name, at);
        }
      };
      walk(parameter.name, []);
    });
  }

  /** One reference to a parameter: a call through it, a pass along an edge, or an escape. */
  function use(node: ts.Identifier, checker: ts.TypeChecker): void {
    if (isDeclarationName(node) || inTypePosition(node)) return;
    if (ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node) {
      const declared = checker.getShorthandAssignmentValueSymbol(node.parent)?.valueDeclaration;
      const root = declared ? parameterPath(declared) : undefined;
      if (root && !passedOn.has(node)) root.slot.escapes.push(root.path);
      return;
    }
    const declared = checker.getSymbolAtLocation(node)?.valueDeclaration;
    const root = declared ? parameterPath(declared) : undefined;
    if (!root) return;
    const path = [...root.path];
    let top: ts.Node = node;
    for (;;) {
      const parent = top.parent;
      if (
        ts.isParenthesizedExpression(parent) ||
        ts.isAsExpression(parent) ||
        ts.isSatisfiesExpression(parent) ||
        ts.isNonNullExpression(parent) ||
        ts.isTypeAssertionExpression(parent)
      ) {
        top = parent;
      } else if (ts.isPropertyAccessExpression(parent) && parent.expression === top) {
        path.push(parent.name.text);
        top = parent;
      } else if (
        ts.isElementAccessExpression(parent) &&
        parent.expression === top &&
        ts.isStringLiteralLike(parent.argumentExpression)
      ) {
        path.push(parent.argumentExpression.text);
        top = parent;
      } else break;
    }
    const parent = top.parent;
    if (ts.isCallExpression(parent) && parent.expression === top) {
      root.slot.calls.push({ path, call: parent });
      return;
    }
    if (passedOn.has(top)) return;
    if (
      (ts.isBinaryExpression(parent) &&
        parent.left === top &&
        parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
      ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
        (parent.operator === ts.SyntaxKind.PlusPlusToken ||
          parent.operator === ts.SyntaxKind.MinusMinusToken)) ||
      ts.isDeleteExpression(parent) ||
      ts.isElementAccessExpression(parent)
    ) {
      markUnknown(root.slot, path);
    }
    root.slot.escapes.push(path);
  }

  function carry(edge: Edge): void {
    const { from, fromPath, to, toPath } = edge;
    if (!closed(from.fn)) {
      markUnknown(to, toPath);
      return;
    }
    for (const { path, parts } of [...from.holds.values()]) {
      if (isPrefix(fromPath, path)) hold(to, [...toPath, ...path.slice(fromPath.length)], parts);
    }
    for (const u of [...from.unknown.values()]) {
      if (isPrefix(u, fromPath)) markUnknown(to, toPath);
      else if (isPrefix(fromPath, u)) markUnknown(to, [...toPath, ...u.slice(fromPath.length)]);
    }
  }
}

function staticName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

/** A value that holds no function: a literal, a template, `undefined`. */
function isPlainData(e: ts.Expression): boolean {
  return (
    ts.isLiteralExpression(e) ||
    ts.isNoSubstitutionTemplateLiteral(e) ||
    ts.isTemplateExpression(e) ||
    e.kind === ts.SyntaxKind.TrueKeyword ||
    e.kind === ts.SyntaxKind.FalseKeyword ||
    e.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(e) && e.text === 'undefined')
  );
}
