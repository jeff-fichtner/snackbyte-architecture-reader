import { Square } from './shapes.js';
import type { Shape } from './shapes.js';
import { keptThing } from 'kept';
import { otherThing } from 'other';
export { Base } from './shapes.js';

export function total(shapes: Shape[]): number {
  let sum = 0;
  for (const s of shapes) sum += s.area();
  return sum + helper() + helper();
}

function helper(): number {
  return keptThing() + otherThing();
}

export async function later(): Promise<number> {
  const mod = await import('./shapes.js');
  return new mod.Square(2).area();
}

export function make(): Square {
  return new Square(3);
}

const created = make();

export type Lazy = import('./shapes.js').Shape;

export { created };
