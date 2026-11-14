import type { Response } from 'fake-router';
import { fail } from './failure.js';

const SECRET = 'SIGNING_KEY';

export function configured(name: string): void {
  if (name === '') throw new Error(`Missing required configuration: ${name}`);
  if (name === 'x') throw new Error(`${name} ${name.length} is not https`);
  throw new Error(`${name}${name} is unknown`);
}

export function secret(read: boolean): void {
  if (!read) throw new Error(`${SECRET} cannot be read`);
}

export function onlyValues(a: string, b: number): void {
  throw new Error(`${a}: ${b}`);
}

export function held(kind: string): void {
  const message = `no such ${kind}`;
  throw new Error(message);
}

export function joined(mode: string, limit: number): void {
  if (mode === '') throw new Error('unknown mode ' + mode);
  throw new Error('over the limit of ' + limit + ' requests');
}

export function thrownText(id: string): void {
  throw `refused ${id}`;
}

export function answered(res: Response, id: string): void {
  fail(res, `gone: ${id}`);
}
