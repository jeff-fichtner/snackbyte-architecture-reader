/**
 * Ids are derived only from where a part is written:
 * - a file: its path from the codebase root;
 * - a top-level declaration: `path#name`; a nested or member one: names joined by `.`;
 * - a function with no name of its own: its enclosing id, `/`, and its 1-based position among the
 *   unnamed functions directly inside that part (`path#/n` at a file's top level);
 * - a package target: `pkg:` and the package name.
 * Positions count unnamed functions, not lines, so an id holds while lines elsewhere change.
 * When two parts would share an id, the later ones in source order take `~2`, `~3`, and so on.
 */

/** The id of a named part inside `enclosing` (a file id or a part id). */
export function namedId(enclosing: string, enclosingIsFile: boolean, name: string): string {
  return enclosingIsFile ? `${enclosing}#${name}` : `${enclosing}.${name}`;
}

/** The id of the `position`th unnamed function directly inside `enclosing`. */
export function unnamedId(enclosing: string, enclosingIsFile: boolean, position: number): string {
  return enclosingIsFile ? `${enclosing}#/${position}` : `${enclosing}/${position}`;
}

export function packageId(name: string): string {
  return `pkg:${name}`;
}

/** Hands out ids, giving a repeated one the first free `~n` suffix. */
export class IdRegistry {
  private readonly taken = new Set<string>();

  claim(id: string): string {
    let candidate = id;
    for (let n = 2; this.taken.has(candidate); n++) candidate = `${id}~${n}`;
    this.taken.add(candidate);
    return candidate;
  }
}
