import ts from 'typescript';
import type { EntryIndex } from './entries.js';
import { StopError } from './errors.js';
import type { Part, PartIndex } from './parts.js';
import type { RefusalIndex } from './refusals.js';
import type { Resolver } from './relationships.js';
import { compare, compareLists, type Trip } from './report.js';

/**
 * How a stretch of code ends:
 * - `open`: it falls through to whatever comes next;
 * - `return`, `break`, `continue`: it leaves its function or loop;
 * - `throw`: an exception is on its way out, and walked code may still catch it;
 * - `stop`: the request is turned away by an error answer, and the trip ends there.
 */
type End = 'open' | 'return' | 'break' | 'continue' | 'throw' | 'stop';

interface Outcome {
  steps: readonly string[];
  end: End;
}

class PathLimit extends Error {}

const OPEN: Outcome = { steps: [], end: 'open' };

/** Steps of `suffix` appended to `prefix`, each part listed once, where first reached. */
function append(prefix: readonly string[], suffix: readonly string[]): readonly string[] {
  if (suffix.length === 0) return prefix;
  if (prefix.length === 0) return suffix;
  const seen = new Set(prefix);
  const added = suffix.filter((step) => !seen.has(step));
  return added.length === 0 ? prefix : [...prefix, ...added];
}

/**
 * Every distinct path from every entry, one trip each. A function is walked as control flow: a branch
 * divides the path, a loop body is walked taken once and not taken, `return` and an uncaught `throw`
 * end it, an error answer ends the trip. At each call into the codebase, the callee is walked in
 * place. A part already on the call stack is not walked again, which ends recursion.
 */
export function collectTrips(
  index: PartIndex,
  entries: EntryIndex,
  refusals: RefusalIndex,
  resolver: Resolver,
  pathLimit: number,
): Trip[] {
  const memo = new Map<string, Outcome[]>();
  const reach = new Map<Part, Set<Part>>();
  const trips: Trip[] = [];

  const entryParts = [...entries.entries.keys()].sort((a, b) => compare(a.id, b.id));
  for (const entry of entryParts) {
    const rule = entries.entries.get(entry) as string;
    let outcomes: Outcome[];
    try {
      outcomes = walkFunction(entry, [entry]);
    } catch (error) {
      if (error instanceof PathLimit) {
        throw new StopError(
          `${entry.id} has more than ${pathLimit} paths; raise pathLimit in the settings to allow more`,
        );
      }
      throw error;
    }
    const distinct = new Map<string, readonly string[]>();
    for (const outcome of outcomes) {
      const steps = append([entry.id], outcome.steps);
      distinct.set(steps.join('\u0000'), steps);
    }
    if (distinct.size > pathLimit) {
      throw new StopError(
        `${entry.id} has ${distinct.size} paths, more than ${pathLimit}; raise pathLimit in the settings to allow more`,
      );
    }
    for (const steps of [...distinct.values()].sort(compareLists)) {
      trips.push({ entry: entry.id, rule, steps: [...steps] });
    }
  }
  return trips;

  // Sets of outcomes, kept distinct and within the limit as they grow.

  function distinct(outcomes: Outcome[]): Outcome[] {
    const seen = new Map<string, Outcome>();
    for (const o of outcomes) seen.set(`${o.end}\u0001${o.steps.join('\u0000')}`, o);
    if (seen.size > pathLimit) throw new PathLimit();
    return [...seen.values()];
  }

  /** Runs `next` after every outcome still open; finished outcomes pass through unchanged. */
  function then(outcomes: Outcome[], next: () => Outcome[]): Outcome[] {
    if (!outcomes.some((o) => o.end === 'open')) return outcomes;
    const after = next();
    const out: Outcome[] = [];
    for (const o of outcomes) {
      if (o.end !== 'open') {
        out.push(o);
        continue;
      }
      for (const a of after) out.push({ steps: append(o.steps, a.steps), end: a.end });
    }
    return distinct(out);
  }

  function either(...branches: Outcome[][]): Outcome[] {
    return distinct(branches.flat());
  }

  function sequence(nodes: readonly ts.Node[], walk: (node: ts.Node) => Outcome[]): Outcome[] {
    let outcomes: Outcome[] = [OPEN];
    for (const node of nodes) outcomes = then(outcomes, () => walk(node));
    return outcomes;
  }

  function settle(outcomes: Outcome[], from: End[], to: End): Outcome[] {
    return distinct(outcomes.map((o) => (from.includes(o.end) ? { ...o, end: to } : o)));
  }

  // Functions.

  function walkFunction(part: Part, stack: Part[]): Outcome[] {
    const relevant = stack
      .filter((p) => reachable(part).has(p))
      .map((p) => p.id)
      .sort(compare);
    const key = `${part.id}\u0001${relevant.join('\u0000')}`;
    const cached = memo.get(key);
    if (cached) return cached;
    const fn = part.fn;
    let outcomes: Outcome[] = [OPEN];
    if (fn) {
      const walk = (node: ts.Node): Outcome[] => statement(node, part, stack);
      outcomes = sequence(
        fn.parameters.flatMap((p) => (p.initializer ? [p.initializer] : [])),
        (node) => expression(node, part, stack),
      );
      if (fn.body && ts.isBlock(fn.body)) {
        outcomes = then(outcomes, () =>
          sequence(fn.body ? (fn.body as ts.Block).statements : [], walk),
        );
      } else if (fn.body) {
        const body = fn.body;
        outcomes = then(outcomes, () => expression(body, part, stack));
      }
    }
    const result = settle(outcomes, ['return', 'break', 'continue'], 'open');
    memo.set(key, result);
    return result;
  }

  /** Every function a part can reach by calls and hand-overs, for keying the memo safely. */
  function reachable(part: Part): Set<Part> {
    const known = reach.get(part);
    if (known) return known;
    const found = new Set<Part>();
    reach.set(part, found);
    const pending = [part];
    while (pending.length > 0) {
      const current = pending.pop() as Part;
      for (const next of calledBy(current)) {
        if (!found.has(next)) {
          found.add(next);
          pending.push(next);
        }
      }
    }
    return found;
  }

  function calledBy(part: Part): Part[] {
    const out: Part[] = [];
    const fn = part.fn;
    if (!fn) return out;
    const visit = (node: ts.Node): void => {
      if (node !== fn && index.byNode.get(node)?.fn === node) return;
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const target = callTarget(node, part);
        if (target) out.push(target);
        out.push(...(entries.handedOver.get(node) ?? []));
      }
      ts.forEachChild(node, visit);
    };
    visit(fn);
    return out;
  }

  function callTarget(call: ts.CallExpression | ts.NewExpression, from: Part): Part | undefined {
    if (ts.isCallExpression(call) && call.expression.kind === ts.SyntaxKind.ImportKeyword)
      return undefined;
    const target = resolver.callee(call, from.file.checker).part;
    return target && target.kind !== 'file' ? target : undefined;
  }

  // Statements.

  function statement(node: ts.Node, part: Part, stack: Part[]): Outcome[] {
    const expr = (e: ts.Node | undefined): Outcome[] => (e ? expression(e, part, stack) : [OPEN]);
    const stmt = (s: ts.Node | undefined): Outcome[] => (s ? statement(s, part, stack) : [OPEN]);
    const block = (statements: readonly ts.Node[]): Outcome[] =>
      sequence(statements, (s) => statement(s, part, stack));
    const loopBody = (body: ts.Statement): Outcome[] =>
      either([OPEN], settle(stmt(body), ['break', 'continue'], 'open'));

    if (ts.isBlock(node)) return block(node.statements);
    if (ts.isExpressionStatement(node)) return expr(node.expression);
    if (ts.isVariableStatement(node)) {
      return sequence(
        node.declarationList.declarations.flatMap((d) => (d.initializer ? [d.initializer] : [])),
        (e) => expression(e, part, stack),
      );
    }
    if (ts.isIfStatement(node)) {
      return then(expr(node.expression), () =>
        either(stmt(node.thenStatement), stmt(node.elseStatement)),
      );
    }
    if (ts.isReturnStatement(node)) return settle(expr(node.expression), ['open'], 'return');
    if (ts.isThrowStatement(node)) return settle(expr(node.expression), ['open'], 'throw');
    if (ts.isTryStatement(node)) return tryStatement(node, block);
    if (ts.isSwitchStatement(node))
      return then(expr(node.expression), () => switchBody(node, block));
    if (ts.isForStatement(node)) {
      const init = node.initializer;
      const start =
        init && ts.isVariableDeclarationList(init)
          ? sequence(
              init.declarations.flatMap((d) => (d.initializer ? [d.initializer] : [])),
              (e) => expression(e, part, stack),
            )
          : expr(init);
      return then(
        then(start, () => expr(node.condition)),
        () =>
          either(
            [OPEN],
            then(settle(stmt(node.statement), ['break', 'continue'], 'open'), () =>
              expr(node.incrementor),
            ),
          ),
      );
    }
    if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
      return then(expr(node.expression), () => loopBody(node.statement));
    }
    if (ts.isWhileStatement(node))
      return then(expr(node.expression), () => loopBody(node.statement));
    if (ts.isDoStatement(node)) {
      return then(settle(stmt(node.statement), ['break', 'continue'], 'open'), () =>
        expr(node.expression),
      );
    }
    if (ts.isBreakStatement(node)) return [{ steps: [], end: 'break' }];
    if (ts.isContinueStatement(node)) return [{ steps: [], end: 'continue' }];
    if (ts.isLabeledStatement(node)) return stmt(node.statement);
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isModuleDeclaration(node) ||
      ts.isImportDeclaration(node) ||
      ts.isExportDeclaration(node) ||
      ts.isEmptyStatement(node) ||
      ts.isDebuggerStatement(node)
    ) {
      return [OPEN];
    }
    return children(node, part, stack);
  }

  function tryStatement(
    node: ts.TryStatement,
    block: (s: readonly ts.Node[]) => Outcome[],
  ): Outcome[] {
    let outcomes = block(node.tryBlock.statements);
    const handler = node.catchClause;
    if (handler) {
      const caught = outcomes
        .filter((o) => o.end === 'throw')
        .map((o) => ({ ...o, end: 'open' as End }));
      const rest = outcomes.filter((o) => o.end !== 'throw');
      outcomes = either(
        rest,
        caught.length > 0 ? then(caught, () => block(handler.block.statements)) : [],
      );
    }
    const finallyBlock = node.finallyBlock;
    if (finallyBlock) {
      const after = block(finallyBlock.statements);
      const out: Outcome[] = [];
      for (const o of outcomes) {
        for (const f of after) {
          out.push({ steps: append(o.steps, f.steps), end: f.end === 'open' ? o.end : f.end });
        }
      }
      outcomes = distinct(out);
    }
    return outcomes;
  }

  function switchBody(
    node: ts.SwitchStatement,
    block: (s: readonly ts.Node[]) => Outcome[],
  ): Outcome[] {
    const clauses = node.caseBlock.clauses;
    const results: Outcome[][] = [];
    for (let start = 0; start < clauses.length; start++) {
      let outcomes: Outcome[] = [OPEN];
      for (let i = start; i < clauses.length; i++) {
        const clause = clauses[i] as ts.CaseOrDefaultClause;
        outcomes = then(outcomes, () => block(clause.statements));
      }
      results.push(settle(outcomes, ['break'], 'open'));
    }
    if (!clauses.some(ts.isDefaultClause)) results.push([OPEN]);
    return either(...results);
  }

  // Expressions.

  function children(node: ts.Node, part: Part, stack: Part[]): Outcome[] {
    const kids: ts.Node[] = [];
    ts.forEachChild(node, (child) => {
      if (!ts.isTypeNode(child)) kids.push(child);
    });
    return sequence(kids, (child) => expression(child, part, stack));
  }

  function expression(node: ts.Node, part: Part, stack: Part[]): Outcome[] {
    if (
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassExpression(node) ||
      ts.isTypeNode(node) ||
      ts.isIdentifier(node) ||
      ts.isLiteralExpression(node)
    ) {
      return [OPEN];
    }
    if (ts.isObjectLiteralExpression(node)) {
      const values = node.properties.flatMap((p) => {
        if (ts.isPropertyAssignment(p)) return [p.initializer];
        if (ts.isSpreadAssignment(p)) return [p.expression];
        return [];
      });
      return sequence(values, (v) => expression(v, part, stack));
    }
    if (ts.isConditionalExpression(node)) {
      return then(expression(node.condition, part, stack), () =>
        either(expression(node.whenTrue, part, stack), expression(node.whenFalse, part, stack)),
      );
    }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      const shortCircuit =
        op === ts.SyntaxKind.AmpersandAmpersandToken ||
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken ||
        op === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
        op === ts.SyntaxKind.BarBarEqualsToken ||
        op === ts.SyntaxKind.QuestionQuestionEqualsToken;
      const left = expression(node.left, part, stack);
      return then(left, () =>
        shortCircuit
          ? either([OPEN], expression(node.right, part, stack))
          : expression(node.right, part, stack),
      );
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) return call(node, part, stack);
    return children(node, part, stack);
  }

  function call(node: ts.CallExpression | ts.NewExpression, part: Part, stack: Part[]): Outcome[] {
    const callee = node.expression;
    let outcomes: Outcome[] =
      ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)
        ? [OPEN]
        : expression(callee, part, stack);
    for (const argument of node.arguments ?? []) {
      outcomes = then(outcomes, () => expression(argument, part, stack));
    }
    const effect = (): Outcome[] => {
      let result: Outcome[] = [OPEN];
      for (const handed of entries.handedOver.get(node) ?? []) {
        result = then(result, () => enter(handed, stack));
      }
      const target = callTarget(node, part);
      if (target) result = then(result, () => enter(target, stack));
      const refusal = refusals.errorAnswers.get(node);
      if (refusal) result = settle(result, ['open'], 'stop');
      return result;
    };
    const optional =
      ts.isCallExpression(node) &&
      (node.questionDotToken !== undefined || isOptionalCallee(callee));
    return then(outcomes, () => (optional ? either([OPEN], effect()) : effect()));
  }

  function isOptionalCallee(callee: ts.Expression): boolean {
    return (
      (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) &&
      callee.questionDotToken !== undefined
    );
  }

  /** A step into a part, and its own paths walked in place, unless it is already on the stack. */
  function enter(target: Part, stack: Part[]): Outcome[] {
    if (stack.includes(target)) return [{ steps: [target.id], end: 'open' }];
    const inner = walkFunction(target, [...stack, target]);
    return distinct(inner.map((o) => ({ steps: append([target.id], o.steps), end: o.end })));
  }
}
