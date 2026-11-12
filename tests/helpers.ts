import { join } from 'node:path';
import { Codebase } from '../src/codebase.js';
import { collectParts, type PartIndex } from '../src/parts.js';
import { loadPrograms } from '../src/program.js';
import { loadSettings, type Settings } from '../src/settings.js';

export const fixtures = join(import.meta.dirname, 'fixtures');

export function settingsOf(fixture: string): string {
  return join(fixtures, fixture, 'architecture-reader.json');
}

export interface Loaded {
  settings: Settings;
  codebase: Codebase;
  index: PartIndex;
}

export function load(fixture: string): Loaded {
  const settings = loadSettings(settingsOf(fixture));
  const codebase = new Codebase(settings.root, loadPrograms(settings.projects, settings.root));
  return { settings, codebase, index: collectParts(codebase) };
}
