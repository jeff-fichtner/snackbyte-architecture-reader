import ts from 'typescript';
import type { Codebase } from './codebase.js';
import type { DeclarationMatcher } from './declarations.js';
import { StopError } from './errors.js';
import { owningPart, unwrap, type Part, type PartIndex } from './parts.js';
import type { Resolver } from './relationships.js';
import type { Refusal } from './report.js';
import type { ErrorAnswerRule } from './settings.js';

export interface RefusalIndex {
  refuses: Map<Part, Refusal[]>;
  checkpoints: Map<Part, { what: string }>;
  /** Every call an error-answer rule matches, with the refusal it makes. */
  errorAnswers: Map<ts.Node, Refusal>;
}

/**
 * The text of a string literal, or of a `const` declared as one. A variable the compiler has only
 * narrowed to a literal (after `if (id === '')`) is not a literal message: its type says what it
 * equals on one path, not what the code wrote.
 */
function literalText(expression: ts.Expression, checker: ts.TypeChecker): string | undefined {
  const e = unwrap(expression);
  if (ts.isStringLiteralLike(e)) return e.text;
  if (!ts.isIdentifier(e)) return undefined;
  let symbol = checker.getSymbolAtLocation(e);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const declaration = symbol?.valueDeclaration;
  if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer)
    return undefined;
  const list = declaration.parent;
  if (!ts.isVariableDeclarationList(list) || !(list.flags & ts.NodeFlags.Const)) return undefined;
  const initializer = unwrap(declaration.initializer);
  return ts.isStringLiteralLike(initializer) ? initializer.text : undefined;
}

/** The number literals an expression's type can be: one literal, or a union's literal members. */
function numberLiterals(expression: ts.Expression, checker: ts.TypeChecker): number[] {
  const type = checker.getTypeAtLocation(expression);
  const members = type.isUnion() ? type.types : [type];
  return members.flatMap((member) => (member.isNumberLiteral() ? [member.value] : []));
}

/**
 * The words of a thrown value: an error constructed with a literal message gives the message;
 * otherwise the class the compiler gives the value; otherwise the compiler's name for its type.
 */
function thrownWhat(expression: ts.Expression, checker: ts.TypeChecker): string {
  const e = unwrap(expression);
  if (ts.isNewExpression(e) || ts.isCallExpression(e)) {
    const [first] = e.arguments ?? [];
    const message = first ? literalText(first, checker) : undefined;
    if (message !== undefined) return message;
  } else if (ts.isStringLiteralLike(e)) {
    return e.text;
  }
  const type = checker.getTypeAtLocation(e);
  const symbol = type.getSymbol();
  if (symbol && symbol.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Interface))
    return symbol.name;
  return checker.typeToString(type);
}

function checkpointOf(node: ts.Node): { what: string } | undefined {
  const tag = ts.getJSDocTags(node).find((t) => t.tagName.text === 'checkpoint');
  if (!tag) return undefined;
  const what = (ts.getTextOfJSDocComment(tag.comment) ?? '').replace(/\s+/g, ' ').trim();
  return { what };
}

/**
 * Every function's refusals in source order (each `throw`, and each call an error-answer rule
 * matches) and every part's `@checkpoint`. An error-answer rule that matches no call stops the run:
 * a rule that matches nothing is a wrong rule, and an empty result would read as "no refusals".
 */
export function collectRefusals(
  codebase: Codebase,
  index: PartIndex,
  resolver: Resolver,
  matcher: DeclarationMatcher,
  rules: ErrorAnswerRule[],
): RefusalIndex {
  rules.forEach((rule, i) => matcher.requireExists(rule.call, `errorAnswers[${i}].call`));
  const found = new Map<Part, { at: number; refusal: Refusal }[]>();
  const errorAnswers = new Map<ts.Node, Refusal>();
  const used = new Set<ErrorAnswerRule>();

  const record = (part: Part, at: number, refusal: Refusal): void => {
    if (part.kind !== 'function' && part.kind !== 'method') return;
    const list = found.get(part) ?? [];
    list.push({ at, refusal });
    found.set(part, list);
  };

  for (const file of codebase.files) {
    const { checker } = file;
    const visit = (node: ts.Node): void => {
      if (ts.isThrowStatement(node)) {
        const refusal = { what: thrownWhat(node.expression, checker) };
        record(owningPart(node, index, file), node.getStart(), refusal);
      } else if (ts.isCallExpression(node) && rules.length > 0) {
        const refusal = errorAnswer(node, checker);
        if (refusal) {
          errorAnswers.set(node, refusal);
          record(owningPart(node, index, file), node.getStart(), refusal);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file.sourceFile);
  }

  rules.forEach((rule, i) => {
    if (!used.has(rule)) throw new StopError(`errorAnswers[${i}] "${rule.name}" matches no call`);
  });

  const refuses = new Map<Part, Refusal[]>();
  for (const [part, list] of found) {
    refuses.set(
      part,
      list.sort((a, b) => a.at - b.at).map((entry) => entry.refusal),
    );
  }
  const checkpoints = new Map<Part, { what: string }>();
  for (const part of index.parts) {
    if (part.kind === 'file') continue;
    const checkpoint = checkpointOf(part.node);
    if (checkpoint) checkpoints.set(part, checkpoint);
  }
  return { refuses, checkpoints, errorAnswers };

  function errorAnswer(call: ts.CallExpression, checker: ts.TypeChecker): Refusal | undefined {
    const { declaration } = resolver.callee(call, checker);
    if (!declaration) return undefined;
    for (const rule of rules) {
      if (!matcher.matches(declaration, rule.call)) continue;
      if (rule.status) {
        const argument = call.arguments[rule.status.argument];
        const atLeast = rule.status.atLeast;
        if (!argument || !numberLiterals(argument, checker).some((n) => n >= atLeast)) continue;
      }
      used.add(rule);
      const whatArgument = rule.what ? call.arguments[rule.what.argument] : undefined;
      const what = whatArgument ? literalText(whatArgument, checker) : undefined;
      return { what: what ?? rule.name };
    }
    return undefined;
  }
}
