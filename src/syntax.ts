import ts from 'typescript';
import type { Part } from './parts.js';

export function isFunctionPart(part: Part | undefined): part is Part {
  return part !== undefined && (part.kind === 'function' || part.kind === 'method') && !!part.fn;
}

/** The expression whose position decides how a function value is used. */
export function outermost(node: ts.Node): ts.Node {
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

/** A call, a `new`, or a tagged template, which calls its tag. */
export type CallLike = ts.CallExpression | ts.NewExpression | ts.TaggedTemplateExpression;

export function isCallLike(node: ts.Node): node is CallLike {
  return (
    ts.isCallExpression(node) || ts.isNewExpression(node) || ts.isTaggedTemplateExpression(node)
  );
}

/** The expression a call-like node calls: a tagged template's tag, or a call's callee. */
export function calleeOf(call: CallLike): ts.Expression {
  return ts.isTaggedTemplateExpression(call) ? call.tag : call.expression;
}

/** The values a call-like node passes: a call's arguments, or a tagged template's substitutions. */
export function argumentsOf(call: CallLike): readonly ts.Expression[] {
  if (!ts.isTaggedTemplateExpression(call)) return call.arguments ?? [];
  const template = call.template;
  return ts.isTemplateExpression(template) ? template.templateSpans.map((s) => s.expression) : [];
}

export function isCallee(node: ts.Node): boolean {
  const n = outermost(node);
  const parent = n.parent;
  return !!parent && isCallLike(parent) && calleeOf(parent) === n;
}

/** Whether an identifier or property name is a declaration's own name rather than a use of it. */
export function isDeclarationName(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertyAccessExpression(parent) || ts.isQualifiedName(parent)) return false;
  return (parent as ts.Node & { name?: ts.Node }).name === node;
}

export function inTypePosition(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isTypeNode(n) && !ts.isExpressionWithTypeArguments(n)) return true;
    if (ts.isImportSpecifier(n) || ts.isExportSpecifier(n) || ts.isImportClause(n)) return true;
    if (ts.isStatement(n) || ts.isSourceFile(n)) return false;
  }
  return false;
}
