# Contract: the report, format 1

The shipped description is `docs/report.md`; this copy is the feature's record of it.

What the reader writes. A consumer reads it and translates it into its own file; nothing in it is
shaped for one consumer. The same code, settings and reader version always give the same bytes.

## Encoding

JSON, UTF-8, two-space indent, LF line endings, one final newline. Keys appear in the order shown
below. Optional fields are absent, never `null` or empty. Lists are sorted in plain code-unit order,
the same on every machine and in every locale.

## Top level

```json
{
  "format": 1,
  "parts": [],
  "trips": []
}
```

| Field    | Meaning                                                                     |
| -------- | --------------------------------------------------------------------------- |
| `format` | `1`. A consumer refuses a format it does not know.                          |
| `parts`  | Every part of the codebase, sorted by `id`.                                 |
| `trips`  | Every trip, sorted by `entry`, then by `steps` compared element by element. |

## A part

```json
{
  "id": "src/app.ts#createApp/3",
  "kind": "function",
  "rel": [{ "to": "src/store.ts#Store.open", "kind": "calls" }],
  "refuses": [{ "what": "not signed in" }],
  "checkpoint": { "what": "the session cookie is signed and current" }
}
```

Every file of the codebase is a part, and so is every declaration in it, exported or not: functions,
methods, classes, interfaces, types, enums, namespaces, and variables at a file's or namespace's top
level or on a class. A local variable is a part only when it holds a function.

### `id`

Derived only from where the part is written:

- a file: its path from the codebase root, `/`-separated (`src/app.ts`);
- a top-level declaration: `path#name` (`src/app.ts#createApp`);
- a nested or member declaration: names joined by `.` (`src/store.ts#Store.open`);
- a function assigned to a variable, a class property or an object-literal property takes that
  name; nested object literals add their property names (`src/app.ts#config.interactions.url`);
- a function with no name: its enclosing id, `/`, and its 1-based position among the unnamed
  functions directly inside that part, in source order (`src/app.ts#createApp/3`; `path#/n` at a
  file's top level);
- a class constructor: `path#Class.constructor`;
- when two parts would share an id, the later ones in source order take `~2`, `~3`, and so on.

Positions count unnamed functions, not lines, so an id holds while lines elsewhere change.

### `kind`

`file`, `function`, `method`, `class`, `interface`, `type`, `enum`, `variable` or `namespace`.

### `rel`

`[{ to, kind }]`, sorted by `kind` then `to`, each pair once.

- `imports`: file to file, from import and export declarations, `import("…")` calls with a literal,
  and `import("…")` types.
- `calls`: from the innermost function or method holding the call (or the file, for top-level code)
  to the function, method or class the compiler resolves it to. `new X()` calls `X`'s constructor,
  or `X` when it has none. A call through an interface or a function-typed value names no part and
  is left out.
- `implements` / `extends`: from a class or interface to what its heritage clauses name.

`to` is a part id, or `pkg:<name>` for a package the settings keep. Targets in any other package
are left out.

### `refuses`

On functions and methods: `[{ what }]`, each point where the function turns a request away, in
source order: every `throw`, and every call an error-answer rule of the settings matches.

- For a `throw`, `what` is the error's message when it is a string literal or a `const` declared as
  one; otherwise the class the compiler gives the thrown value; otherwise the compiler's name for
  its type (`unknown` for a rethrown caught value).
- For an error answer, `what` is the string literal at the rule's `what` argument; otherwise the
  rule's name.

### `checkpoint`

`{ what }`: the words of the part's `@checkpoint` doc-comment tag, whitespace collapsed. Normally on
a function or method; a tag anywhere else, or with no words, is reported as written, so a consumer
can refuse it.

## A trip

```json
{
  "entry": "src/app.ts#createApp/3",
  "rule": "route",
  "steps": ["src/app.ts#createApp/3", "src/session.ts#requireSession", "src/store.ts#Store.open"]
}
```

| Field   | Meaning                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| `entry` | The id of the function the trip starts in.                                                                         |
| `rule`  | The settings' entry rule that made it an entry, or `value` (below).                                                |
| `steps` | Part ids in the order this path reaches them, starting with the entry; each part listed once, where first reached. |

There is one trip per distinct path from an entry. Wherever the code branches (`if`, `switch`,
`?:`, `&&`, `||`, `??`, an optional call, `try`/`catch`), each way through is its own trip, so a path
that skips a check is a trip of its own. A branch inside a called function divides every path that
reaches it. A loop body is walked as taken once and as not taken. `return` ends a path; a `throw`
ends it unless the walked code catches it, in which case the path continues into the `catch`; an
error answer ends the trip. A part already on the call stack is not walked again, which ends
recursion. Paths that reach the same parts in the same order are one trip.

### Entries

- A function an entry rule of the settings matches.
- A function handed to code outside the codebase (a callback given to a package or a built-in) is
  not an entry: it is a step of the path where it is handed over, and its own steps follow there.
- A function used as a value in any other way (stored, returned, written in an object literal, or
  handed to codebase code that calls it through a parameter) is called where the compiler cannot
  follow, so it starts trips of its own, with the rule `value`. Every function that escapes as a
  value is accounted for this way, so no path can disappear.

### The path limit

When one entry has more distinct paths than the path limit (1000 unless the settings raise it), the
reader stops, naming the entry. It never lists some paths and drops the rest.

## What a consumer adds

Ids of its own, which parts it draws and how it folds the rest into them, trip ids, zones, doors,
journeys, and which door leads to which entry: all of that is the consumer's translation.
