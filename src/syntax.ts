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

export function isCallee(node: ts.Node): boolean {
  const n = outermost(node);
  const parent = n.parent;
  return (
    !!parent &&
    (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
    parent.expression === n
  );
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
