import type { PartKind } from './parts.js';

export type RelationshipKind = 'calls' | 'extends' | 'implements' | 'imports';

export interface Relationship {
  to: string;
  kind: RelationshipKind;
}

export interface Refusal {
  what: string;
}

export interface ReportPart {
  id: string;
  kind: PartKind;
  rel: Relationship[];
  refuses: Refusal[];
  checkpoint?: { what: string };
}

export interface Trip {
  entry: string;
  rule: string;
  steps: string[];
}

export interface Report {
  parts: ReportPart[];
  trips: Trip[];
}

/** The report format's version. A consumer refuses a format it does not know. */
export const FORMAT = 1;

/** Plain code-unit order: the same on every machine and in every locale. */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareLists(a: readonly string[], b: readonly string[]): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const order = compare(a[i] as string, b[i] as string);
    if (order !== 0) return order;
  }
  return a.length - b.length;
}

function relationships(rel: Relationship[]): Relationship[] {
  const seen = new Set<string>();
  const unique: Relationship[] = [];
  for (const r of rel) {
    const key = `${r.kind}\u0000${r.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  return unique.sort((a, b) => compare(a.kind, b.kind) || compare(a.to, b.to));
}

/**
 * Writes the report in its one fixed form: keys in the documented order, lists in their documented
 * order, optional fields left out rather than empty, two-space indent, LF, one final newline. The
 * same report always gives the same bytes.
 */
export function serialize(report: Report): string {
  const parts = [...report.parts]
    .sort((a, b) => compare(a.id, b.id))
    .map((part) => {
      const out: Record<string, unknown> = { id: part.id, kind: part.kind };
      const rel = relationships(part.rel);
      if (rel.length > 0) out.rel = rel.map((r) => ({ to: r.to, kind: r.kind }));
      if (part.refuses.length > 0) out.refuses = part.refuses.map((r) => ({ what: r.what }));
      if (part.checkpoint) out.checkpoint = { what: part.checkpoint.what };
      return out;
    });
  const trips = [...report.trips]
    .sort((a, b) => compare(a.entry, b.entry) || compareLists(a.steps, b.steps))
    .map((trip) => ({ entry: trip.entry, rule: trip.rule, steps: [...trip.steps] }));
  return `${JSON.stringify({ format: FORMAT, parts, trips }, null, 2)}\n`;
}
