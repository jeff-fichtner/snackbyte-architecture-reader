import { Codebase } from './codebase.js';
import { DeclarationMatcher } from './declarations.js';
import { collectEntries } from './entries.js';
import { collectParts } from './parts.js';
import { collectTrips } from './paths.js';
import { loadPrograms } from './program.js';
import { collectRefusals } from './refusals.js';
import { collectRelationships, Resolver } from './relationships.js';
import { serialize, type Report } from './report.js';
import { loadSettings } from './settings.js';

/** Reads the codebase a settings file describes and returns its report, or stops naming why. */
export function read(settingsFile: string): string {
  const settings = loadSettings(settingsFile);
  const programs = loadPrograms(settings.projects, settings.root);
  const codebase = new Codebase(settings.root, programs);
  const index = collectParts(codebase);
  const resolver = new Resolver(codebase, index, new Set(settings.keep));
  const matcher = new DeclarationMatcher(codebase, programs);

  const rel = collectRelationships(codebase, index, resolver);
  const refusals = collectRefusals(codebase, index, resolver, matcher, settings.errorAnswers);
  const entries = collectEntries(codebase, index, resolver, matcher, settings.entries);
  const trips = collectTrips(index, entries, refusals, resolver, settings.pathLimit);

  const report: Report = {
    parts: index.parts.map((part) => {
      const checkpoint = refusals.checkpoints.get(part);
      return {
        id: part.id,
        kind: part.kind,
        rel: rel.get(part) ?? [],
        refuses: refusals.refuses.get(part) ?? [],
        ...(checkpoint ? { checkpoint } : {}),
      };
    }),
    trips,
  };
  return serialize(report);
}
