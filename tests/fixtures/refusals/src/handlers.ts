import type { Request, Response } from 'fake-router';
import { fail } from './failure.js';

export class NotFound extends Error {}

const MESSAGE = 'not allowed';

/**
 * Turns away anyone without a session.
 * @checkpoint the session cookie is signed
 *   and current
 */
export function requireSession(req: Request): void {
  if (req.path === '') throw new Error('not signed in');
}

export function lookup(id: string): string {
  if (id === '') throw new NotFound(id);
  if (id === 'x') throw new Error(MESSAGE);
  return id;
}

export function rethrow(): void {
  try {
    lookup('');
  } catch (err) {
    throw err;
  }
}

export function answers(res: Response, code: 400 | 500, n: number): void {
  res.status(403).send('forbidden');
  res.status(200).send('ok');
  res.status(code).send();
  res.status(n).send();
  fail(res, 'gone');
  fail(res, String(n));
}

/** @checkpoint */
export function emptyTag(): void {}

/** @checkpoint misplaced on a class */
export class Tagged {}

export function plain(): number {
  return 1;
}
