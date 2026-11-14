#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { StopError } from './errors.js';
import { read } from './main.js';

const USAGE = 'usage: architecture-reader --settings <file> [--out <file>]';

function main(argv: string[]): number {
  let settings: string | undefined;
  let out: string | undefined;
  try {
    const { values } = parseArgs({
      args: argv,
      options: { settings: { type: 'string' }, out: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    });
    settings = values.settings;
    out = values.out;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n${USAGE}\n`);
    return 2;
  }
  if (settings === undefined) {
    process.stderr.write(`--settings is required\n${USAGE}\n`);
    return 2;
  }
  try {
    const report = read(settings);
    if (out === undefined) process.stdout.write(report);
    else writeFileSync(out, report);
    return 0;
  } catch (error) {
    if (error instanceof StopError) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

process.exitCode = main(process.argv.slice(2));
