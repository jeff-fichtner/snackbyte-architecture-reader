import { read } from '../src/main.js';
import { settingsOf } from './helpers.js';

export interface ParsedPart {
  id: string;
  kind: string;
  rel?: { to: string; kind: string }[];
  refuses?: { what: string }[];
  checkpoint?: { what: string };
}

export interface ParsedTrip {
  entry: string;
  rule: string;
  steps: string[];
}

export interface ParsedReport {
  format: number;
  parts: ParsedPart[];
  trips: ParsedTrip[];
}

/** The report of a fixture, read in-process, with lookups for the assertions. */
export function reportOf(fixture: string, settingsFile = 'architecture-reader.json') {
  const settings = settingsOf(fixture).replace('architecture-reader.json', settingsFile);
  const report = JSON.parse(read(settings)) as ParsedReport;
  const part = (id: string): ParsedPart => {
    const found = report.parts.find((p) => p.id === id);
    if (!found) throw new Error(`no part ${id}`);
    return found;
  };
  const rel = (id: string, kind?: string): string[] =>
    (part(id).rel ?? []).filter((r) => kind === undefined || r.kind === kind).map((r) => r.to);
  const trips = (entry: string): string[][] =>
    report.trips.filter((t) => t.entry === entry).map((t) => t.steps);
  return { report, part, rel, trips };
}
