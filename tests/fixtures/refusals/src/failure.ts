import type { Response } from 'fake-router';

export function fail(res: Response, reason: string): void {
  res.status(500).send(reason);
}
