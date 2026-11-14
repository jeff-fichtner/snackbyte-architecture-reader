import { helper } from '../../lib/src/util.js';
import { keptThing } from 'kept';
import { otherThing } from 'other';

export function main(): number {
  return helper() + keptThing() + otherThing();
}
