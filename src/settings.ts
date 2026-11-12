import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { StopError } from './errors.js';

/** A declaration as the compiler reports it: a package name or a codebase file, and a name in it. */
export interface Declaration {
  module: string;
  name: string;
}

export interface TypeEntryRule {
  name: string;
  type: Declaration;
  within: boolean;
}

export interface DeclarationsEntryRule {
  name: string;
  declarations: string[];
}

export type EntryRule = TypeEntryRule | DeclarationsEntryRule;

export interface ErrorAnswerRule {
  name: string;
  call: Declaration;
  status?: { argument: number; atLeast: number };
  what?: { argument: number };
}

export interface Settings {
  /** The settings file's folder: every path and id is counted from here. */
  root: string;
  /** Absolute paths of the TypeScript project files. */
  projects: string[];
  keep: string[];
  entries: EntryRule[];
  errorAnswers: ErrorAnswerRule[];
  pathLimit: number;
}

/** The name the reader gives trips that start at a function value it cannot follow to a caller. */
export const VALUE_RULE = 'value';

/**
 * The fewest paths an entry may be allowed. A built-in default is safe here: an entry with more
 * paths stops the run at once, naming the entry, so a limit set too low is never silent.
 */
const MIN_PATH_LIMIT = 1000;

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function refuse(file: string, message: string): never {
  throw new StopError(`${file}: ${message}`);
}

function string(file: string, value: unknown, field: string): string {
  if (typeof value !== 'string' || value === '')
    refuse(file, `${field} must be a non-empty string`);
  return value;
}

function wholeNumber(file: string, value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    refuse(file, `${field} must be a whole number`);
  }
  return value;
}

function strings(file: string, value: unknown, field: string): string[] {
  if (!Array.isArray(value)) refuse(file, `${field} must be a list of strings`);
  return value.map((item, i) => string(file, item, `${field}[${i}]`));
}

function declaration(file: string, value: unknown, field: string): Declaration {
  if (!isObject(value)) refuse(file, `${field} must be { "module", "name" }`);
  return {
    module: string(file, value.module, `${field}.module`),
    name: string(file, value.name, `${field}.name`),
  };
}

function entryRule(file: string, value: unknown, field: string): EntryRule {
  if (!isObject(value)) refuse(file, `${field} must be an object`);
  const name = string(file, value.name, `${field}.name`);
  if (value.type !== undefined) {
    return {
      name,
      type: declaration(file, value.type, `${field}.type`),
      within: value.within === undefined ? false : boolean(file, value.within, `${field}.within`),
    };
  }
  if (value.declarations !== undefined) {
    const declarations = strings(file, value.declarations, `${field}.declarations`);
    if (declarations.length === 0)
      refuse(file, `${field}.declarations must name at least one part`);
    return { name, declarations };
  }
  return refuse(file, `${field} must have "type" or "declarations"`);
}

function boolean(file: string, value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') refuse(file, `${field} must be true or false`);
  return value;
}

function errorAnswerRule(file: string, value: unknown, field: string): ErrorAnswerRule {
  if (!isObject(value)) refuse(file, `${field} must be an object`);
  const rule: ErrorAnswerRule = {
    name: string(file, value.name, `${field}.name`),
    call: declaration(file, value.call, `${field}.call`),
  };
  if (value.status !== undefined) {
    if (!isObject(value.status)) refuse(file, `${field}.status must be { "argument", "atLeast" }`);
    rule.status = {
      argument: wholeNumber(file, value.status.argument, `${field}.status.argument`),
      atLeast: wholeNumber(file, value.status.atLeast, `${field}.status.atLeast`),
    };
  }
  if (value.what !== undefined) {
    if (!isObject(value.what)) refuse(file, `${field}.what must be { "argument" }`);
    rule.what = { argument: wholeNumber(file, value.what.argument, `${field}.what.argument`) };
  }
  return rule;
}

function uniqueNames(file: string, rules: { name: string }[]): void {
  const seen = new Set<string>();
  for (const { name } of rules) {
    if (name === VALUE_RULE) refuse(file, `rule name "${VALUE_RULE}" is the reader's own`);
    if (seen.has(name)) refuse(file, `rule name "${name}" is used twice`);
    seen.add(name);
  }
}

/** Reads a settings file, or stops naming what is wrong with it. */
export function loadSettings(settingsFile: string): Settings {
  const file = resolve(settingsFile);
  if (!existsSync(file)) throw new StopError(`settings file not found: ${file}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    refuse(file, 'the settings file is not JSON');
  }
  if (!isObject(raw)) refuse(file, 'the settings must be a JSON object');
  if (raw.format !== 1) refuse(file, 'format must be 1');

  const root = dirname(file);
  if (raw.projects === undefined) refuse(file, 'projects is required');
  const projects = strings(file, raw.projects, 'projects').map((project) => {
    const path = resolve(root, project);
    if (!existsSync(path)) refuse(file, `project file not found: ${project}`);
    return path;
  });
  if (projects.length === 0) refuse(file, 'projects must name at least one TypeScript project');

  const keep = raw.keep === undefined ? [] : strings(file, raw.keep, 'keep');

  if (raw.entries === undefined) refuse(file, 'entries is required');
  if (!Array.isArray(raw.entries)) refuse(file, 'entries must be a list of rules');
  const entries = raw.entries.map((rule, i) => entryRule(file, rule, `entries[${i}]`));
  if (entries.length === 0) refuse(file, 'entries must have at least one rule');

  let errorAnswers: ErrorAnswerRule[] = [];
  if (raw.errorAnswers !== undefined) {
    if (!Array.isArray(raw.errorAnswers)) refuse(file, 'errorAnswers must be a list of rules');
    errorAnswers = raw.errorAnswers.map((rule, i) =>
      errorAnswerRule(file, rule, `errorAnswers[${i}]`),
    );
  }
  uniqueNames(file, [...entries, ...errorAnswers]);

  let pathLimit = MIN_PATH_LIMIT;
  if (raw.pathLimit !== undefined) {
    pathLimit = wholeNumber(file, raw.pathLimit, 'pathLimit');
    if (pathLimit < MIN_PATH_LIMIT) refuse(file, `pathLimit must be at least ${MIN_PATH_LIMIT}`);
  }

  return { root, projects, keep, entries, errorAnswers, pathLimit };
}
