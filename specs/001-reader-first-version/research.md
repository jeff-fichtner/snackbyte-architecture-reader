# Research: The reader's first version

## R1. Which TypeScript compiler

- **Decision**: depend on `typescript` **6.0.3**, pinned exactly, and use its programmatic API
  (`createProgram`, the type checker, control-flow of the syntax tree).
- **Rationale**: the report must come from the compiler's own view, including types (to recognize
  entries and error answers by declaration) and symbol resolution (to resolve calls). 6.0 is the
  last line with the stable JavaScript API. 7.x is the native rewrite; its package exports only
  `./unstable/*` API entry points (checked 2026-11-11 against 7.0.2), so building on it means
  building on an API that may change under us. The first consumer builds with 6.0.3, so its code
  is read by the compiler it is written for.
- **Pinned, carried by the reader**: the reader never uses the codebase's own installed compiler,
  so a codebase upgrading its compiler cannot change the report. Moving the reader to 7.x is its
  own later feature, once 7's API is stable.
- **Alternatives**: 7.x unstable API (rejected above); `ts-morph` (a wrapper over the same API,
  adds a dependency and a second version to pin, no capability the reader needs).

## R2. Language, runtime, toolchain

- **Decision**: TypeScript source under `src/`, compiled by `tsc` to `dist/` (what is installed
  and run), ES modules, Node.js >= 24. Check gate `npm run check:all`: Prettier check, ESLint,
  `tsc --noEmit`, Vitest. Exact versions pinned in `package.json`.
- **Rationale**: matches the toolchain of the owner's other published TypeScript tool, so nothing
  is re-decided (constitution II). Node runs `.ts` directly only outside `node_modules`, so an
  installed copy must be JavaScript.

## R3. What counts as the codebase, and outside it

- **Decision**: the codebase is every source file the settings' TypeScript projects include,
  excluding declaration files (`.d.ts`) and anything under `node_modules`. A declaration outside
  it belongs to a package, whose name is the `name` of the nearest `package.json` above the
  declaration's file.
- **Rationale**: the projects already state what is compiled; the nearest `package.json` is how
  Node itself names a package, so no name is guessed.

## R4. Ids

- **Decision**:
  - a file: its path from the codebase root, `/`-separated (`src/app.ts`);
  - a top-level declaration: `path#name` (`src/app.ts#createApp`);
  - a nested or member declaration: names joined by `.` (`src/store.ts#Store.open`,
    `src/app.ts#createApp.helper`);
  - a function with no name of its own: its enclosing id, then `/` and its 1-based position among
    the unnamed functions directly inside that enclosing part, in source order
    (`src/app.ts#createApp/3`); at the top level of a file, `path#/3`;
  - a function assigned to a variable or property takes that name (`export const run = () => …`
    is `path#run`);
  - a package target: `pkg:` and the package name (`pkg:@scope/client`).
- **Rationale**: derived only from where a part is written (FR-004). Ordinals instead of line
  numbers keep an id stable when lines are added elsewhere in the file; an id changes only when an
  unnamed function is added before it inside the same enclosing part. Names that coincide with the
  first consumer's own scheme (`path#name`) make its translation simple, without shaping the
  format for it.
- **Uniqueness**: overload signatures fold into their implementation. Any other two parts that would
  share an id (merged declarations, two object literals with the same property in one function) keep
  apart by suffix: the later ones in source order take `~2`, `~3`.

## R5. Recognizing entries and error answers without names

- **Decision**: rules in the settings name **declarations**, as the compiler reports them: a
  package (or a codebase file) and a qualified name inside it. An entry rule matches every
  codebase function whose contextual type (the type the code it is given to expects) is that
  declaration, or a member nested inside it when the rule says `within`. An error-answer rule
  matches every call whose resolved signature is declared by that declaration, optionally only
  when a status argument's type can be at least a given number.
- **Rationale**: a route handler is a function given where a router expects its handler type; a
  hook is a function given where the engine's configuration expects one. Both are facts of the
  type checker, not of names. A status argument's type is a literal or a union of literals
  whenever the code states it (`403`, or a field typed `400 | 500`), so "can this answer be an
  error" is read from the type too. Probe of the first consumer (2026-11-11): its engine hooks sit
  inside the engine's configuration object, its route handlers are inline functions handed to the
  router, and its scheduled job runs from one exported function, so every one of its entries is
  expressible this way.
- **Extended types**: a contextual type that extends the named declaration matches it too (a
  framework's handler interface that extends its core handler type), found through the checker's
  base types. Found on the first consumer's code, 2026-11-11.
- **Selector that matches nothing**: stops the run naming the rule (FR-012); a rule that matches
  nothing is a wrong rule, and a silent empty result would read as "no entries".

## R6. Paths

- **Decision**: per entry, walk the syntax tree of each function as control flow: statements in
  order; `if`/`else`, `switch`, `?:`, `&&`/`||`/`??`, optional calls and `try`/`catch`/`finally`
  divide the path; a loop body is walked taken once and not taken; `return`, a refusal (a `throw`
  not caught within the walk, or an error answer) ends the path. At each call that resolves to a
  codebase function, that function's own paths are walked in place. Steps are the parts reached,
  in order, each listed once per path (where first reached); a part already on the path is not
  walked again, which also ends recursion. Paths with the same steps collapse into one trip.
  Enumeration keeps the distinct step lists so far and stops as soon as an entry passes the path
  limit (FR-011b), so the run never builds the full product of branches before failing. The limit
  counts distinct step lists, as trips do: the same steps ending two ways (returning, throwing) are
  one path (found on the first consumer's code, where counting endings stopped an entry with 897
  trips).
- **Function values**: a codebase function handed to outside code is a step where it is handed
  over (FR-011a) unless an entry rule matches it. A codebase function used as a value in any
  other way (stored, handed to codebase code that calls it through a parameter) is a call the
  compiler cannot resolve at its call site, so it starts trips of its own (FR-011), recorded with
  the rule `value`. Every function that escapes as a value is accounted for this way, so no path
  can disappear.
- **Order**: trips are sorted by entry id, then by their steps compared element by element.

## R7. Output and determinism

- **Decision**: one JSON document on standard output (or to `--out`), keys in a fixed order,
  two-space indent, LF line endings, a final newline. No time, no absolute path, no machine name,
  no reader version in the report; `format` names the report format's version.
- **Rationale**: a consumer's out-of-date check compares bytes; anything that varies between runs
  or machines would read as a change that did not happen.

## R8. Testing the first consumer without naming it

- **Decision**: fixture codebases under `tests/fixtures/` use small stand-in packages (a fake
  router, a fake engine) committed under each fixture's `node_modules/`. The proof on the first
  consumer's real code is `npm run test:consumer`, which reads the codebase root and its settings
  file from `CONSUMER_ROOT` and `CONSUMER_SETTINGS` and fails loudly when either is unset. The
  first consumer's settings are drafted locally, never committed here, and handed to the consumer
  with the report contract.
- **Rationale**: tracked files never name another repository; the stand-ins exercise exactly the
  same compiler paths a real framework does.

## R9. Packaging and release

- **Decision (best guess, 2026-11-11, on the deferred-review list in `specs/reviews.md`)**: a
  consumer installs one exact version from a GitHub tag; the package builds itself on install
  (`prepare`), verified by installing from a git URL into an empty project. Publishing to npm was
  passed over for now: it needs the release flow wired and CI allowed to push tags.
