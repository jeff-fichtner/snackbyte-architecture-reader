---

description: "Tasks for the reader's first version"
---

# Tasks: The reader's first version

**Input**: Design documents from `/specs/001-reader-first-version/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: required. Every rule and every refusal has a fixture or unit test (spec SC-003,
constitution III). Within each story the test comes first and fails before the code is written.

**Organization**: by user story; stage one is US1 and US2, stage two is US3, US4 closes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story it serves

---

## Phase 1: Setup

**Purpose**: the package, the toolchain and a green gate on an empty reader.

- [x] T001 Create `package.json` (name `snackbyte-architecture-reader`, `"type": "module"`, `engines.node` `>=24`, `bin` `architecture-reader` → `dist/cli.js`, `files` `["dist"]`, exact pins: `typescript` `6.0.3` as a dependency; Vitest, ESLint, Prettier, `@types/node` as dev dependencies), scripts `build` (`tsc -p tsconfig.build.json`), `format`, `format:check`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`, excluding `tests/consumer.test.ts`), `test:consumer`, `check:all` (format:check → lint → typecheck → build → test, so the command tests run the built reader); run `npm install` and commit `package-lock.json`
- [x] T002 [P] Create `tsconfig.json` (strict, `module`/`moduleResolution` `nodenext`, target ES2023, covers `src` and `tests`, excludes `tests/fixtures`) and `tsconfig.build.json` (only `src`, emits to `dist`)
- [x] T003 [P] Create `eslint.config.js` (flat config, `@eslint/js` recommended + typescript-eslint recommended, prettier compatibility, ignores `dist`, `tests/fixtures`) and `.prettierrc` (printWidth 100, singleQuote) and `.prettierignore` (`dist`, `specs`, `.specify`, `.claude`, `tests/fixtures/**/expected.json` is formatted by the reader itself so it is ignored)
- [x] T004 [P] Update `.gitignore`: keep `node_modules/` and `dist/` ignored, add the exception `!tests/fixtures/**/node_modules/` so fixture stand-in packages are tracked; add `local/` (the first consumer's settings draft, never committed)
- [x] T005 Create `vitest.config.ts` (tests under `tests/`, `tests/consumer.test.ts` excluded unless run by `test:consumer`) and a placeholder `tests/smoke.test.ts`; run `npm run check:all` and see it green

---

## Phase 2: Foundational

**Purpose**: settings, program, codebase, ids, parts, the report writer and the command. Blocks every story.

- [x] T006 [P] Create `src/errors.ts`: `StopError` (message names the cause, and file:line:column where there is one) used for every stop; nothing else throws to the user
- [x] T007 [P] Write `tests/unit/settings.test.ts` first: every refusal in contracts/settings.md "Refusals of the settings" (missing file, not JSON, `format` not `1`, missing `projects`/`entries`, empty `entries`, a rule name repeated or `value`, `pathLimit` under 1000, a project file that does not exist) gives a `StopError` naming the field; a valid file loads with `keep` defaulting to `[]` and `pathLimit` to `1000`. Then create `src/settings.ts` until it passes. The default `pathLimit` is safe: exceeding it stops loudly (comment says so)
- [x] T008 Write `tests/unit/program.test.ts` first, with a fixture `tests/fixtures/compile-error/` holding a type error: building the program stops with the compiler's message and position. Then create `src/program.ts`: one `ts.Program` per project from `projects` (parsed with `ts.getParsedCommandLineOfConfigFile`), pre-emit diagnostics of every one stop the run
- [x] T009 Write `tests/unit/codebase.test.ts` first (fixture `tests/fixtures/packages/` with a two-project codebase and a stand-in package `node_modules/stand-in/` with `package.json` and `index.d.ts`): codebase files are the projects' source files minus `.d.ts` and `node_modules`, as `/`-separated paths from the settings folder; a declaration in the stand-in reports package `stand-in` from its nearest `package.json`. Then create `src/codebase.ts`
- [x] T010 Write `tests/unit/ids.test.ts` first (fixture `tests/fixtures/ids/`): file ids; `path#name`; nested `path#outer.inner`; members `path#Class.method`; `export const run = () => …` is `path#run`; unnamed functions `path#enclosing/n` counted 1-based in source order among unnamed functions directly inside the enclosing part, `path#/n` at top level; an overload set and its implementation share one id; a remaining collision stops naming both places. Then create `src/ids.ts`
- [x] T011 Write `tests/unit/parts.test.ts` first: every codebase file and every declaration in it, exported or not, is a part with `kind` one of `file`, `function`, `method`, `class`, `interface`, `type`, `enum`, `variable`, `namespace`. Then create `src/parts.ts`
- [x] T012 [P] Write `tests/unit/report.test.ts` first: keys in the contract's order; `parts` sorted by `id`, `trips` by `entry` then `steps` element by element; optional fields absent, never `null` or empty; two-space indent, LF, one final newline; serializing the same data twice gives the same bytes. Then create `src/report.ts`
- [x] T013 Write `tests/cli.test.ts` first (runs the built command against fixtures): exit `0` writes the report to standard output or to `--out`; exit `1` on a stop with the cause on standard error and nothing written; exit `2` on an unknown option or a missing `--settings`. Then create `src/cli.ts` (option parsing with `node:util` `parseArgs`)
- [x] T014 Create `tests/fixtures.test.ts`: for every folder under `tests/fixtures/` that holds `architecture-reader.json` and `expected.json`, run the reader twice, the second time from a different working directory with `TZ` and `LANG` set differently, and assert both outputs equal `expected.json` byte for byte; add fixture `tests/fixtures/minimal/` (one file with one function, settings with one `declarations` entry naming it) whose expected report has the file part, the function part and one trip; `npm run check:all` green

**Checkpoint**: an empty-ish codebase yields a valid report; the gate is green.

---

## Phase 3: User Story 1 - Every part says what it relates to (P1, stage one)

**Goal**: `rel` on every part: imports, calls, implements, extends; package targets kept or left out.

**Independent Test**: fixture `relationships` reports exactly the expected relationships, sorted, twice the same.

- [x] T015 [P] [US1] Create fixture `tests/fixtures/relationships/` with its settings and hand-written `expected.json`: file-to-file imports (static, `export … from`, dynamic `import('…')` with a literal, `import('…')` types); calls between exported and unexported functions, method calls (`calls` to `path#Class.method`), `new X()` (`calls` to the class), top-level code calling a function (from the file part); a class implementing an interface and extending a class; a call into a kept stand-in package (`pkg:kept`) and into an unkept one (left out); a duplicate call reported once
- [x] T016 [US1] Write `tests/unit/relationships.test.ts` covering each case in T015 one at a time, then create `src/relationships.ts` until it and the `relationships` fixture pass (calls attributed to the innermost containing function, method or file; targets resolved through aliases with the checker; `keep` from settings)
- [x] T017 [US1] Wire relationships into the report in `src/report.ts` and `src/cli.ts`; `npm run check:all` green

**Checkpoint**: stage one, half done: the part graph is complete.

---

## Phase 4: User Story 2 - Refusals and checkpoints (P1, stage one)

**Goal**: `refuses` and `checkpoint` on every function and method.

**Independent Test**: fixture `refusals` reports exactly the expected refusals in source order with the right words, and exactly the expected checkpoints.

- [x] T018 [P] [US2] Create fixture `tests/fixtures/refusals/` with settings and `expected.json`: `throw new Error('literal')` (`what` = the literal); `throw new CustomError(variable)` (class name); `throw err` in a `catch` with `err: unknown` (`unknown`); a stand-in router's `Response.status(403)` matched by an error-answer rule with `status` (refusal), `status(200)` (not), `status(code)` with `code: 400 | 500` (refusal), `status(n)` with `n: number` (not); a codebase `fail(res, 'gone')` matched by a `call` rule with `what` argument 1 (`what` = `gone`) and with a non-literal argument (`what` = the rule's name); several refusals in one function in source order; `@checkpoint the session is signed` on a function; an empty `@checkpoint`; a `@checkpoint` on a class (reported on the class as written); a function with neither
- [x] T019 [US2] Write `tests/unit/declarations.test.ts` first: a settings declaration `{ module, name }` resolves against compiler symbols for a package declaration and for a codebase file; a module or name the compiler cannot find stops naming it. Then create `src/declarations.ts`
- [x] T020 [US2] Write `tests/unit/refusals.test.ts` covering each case in T018 one at a time; an error-answer rule that matches no call stops naming the rule. Then create `src/refusals.ts` until it and the `refusals` fixture pass
- [x] T021 [US2] Wire refusals and checkpoints into the report; `npm run check:all` green

**Checkpoint**: stage one complete.

---

## Phase 5: User Story 3 - Every entry plays every path (P1, stage two)

**Goal**: one trip per distinct path from every entry.

**Independent Test**: fixture `branches` gives each distinct path its own trip in the expected order; the unchecked path is a trip of its own; an unresolvable call starts its own trip.

- [x] T022 [P] [US3] Create fixture `tests/fixtures/entries/` with settings and `expected.json` trips: an inline handler given to a stand-in router (`type` rule, contextual type `Handler`); a hook inside a stand-in engine's configuration object (`type` rule with `within: true`); a named job function (`declarations` rule); a function stored in an object and called through a parameter elsewhere (rule `value`); a callback given to an array's `forEach` (a step where it is handed over, not an entry); a function matched by two rules (stops naming both, in its own fixture `tests/fixtures/entries-twice/` checked by a unit test); an entry rule that matches nothing (stops naming the rule)
- [x] T023 [US3] Write `tests/unit/entries.test.ts` covering each case in T022, then create `src/entries.ts` (entry rules via the checker's contextual type; escaped function values found from every reference to a codebase function not in call position)
- [x] T024 [P] [US3] Create fixture `tests/fixtures/branches/` with settings and `expected.json`: straight-line calls (one trip); `if (x) { check(); keys(); } else { keys(); }` (two trips, one without `check`); a branch inside a called function dividing the caller's paths; `switch`, `?:`, `&&`/`||`/`??`, optional call; a loop body taken once and not taken; a guard that throws ends that path, the passing path continues; a throw caught in the walked code continues into the `catch`; `return` ends the path; recursion stops at the part already on the path; two branches with the same calls collapse into one trip; an error-answer call ends the path
- [x] T025 [US3] Write `tests/unit/paths.test.ts` covering each case in T024 one at a time, then create `src/paths.ts` until it and the `branches` fixture pass (steps listed once each, where first reached; distinct step lists kept as the walk goes)
- [x] T026 [US3] Write the path-limit test in `tests/unit/paths.test.ts` first (fixture `tests/fixtures/path-limit/`: an entry with eleven independent branches that each change the calls made, more than 1000 distinct paths): the run stops naming the entry and its path count once past the limit, without building every path first, and passes when the settings raise `pathLimit`. Then implement the limit in `src/paths.ts`
- [x] T027 [US3] Wire trips into the report; `npm run check:all` green

**Checkpoint**: stage two complete; every fixture passes twice with the same bytes.

---

## Phase 6: User Story 4 - Proven on the first consumer's real code (P1)

**Goal**: the reader runs on the first consumer's real code; the consumer adopts it and signs off.

**Independent Test**: `npm run test:consumer` passes; the consumer's feedback is addressed until it signs off.

- [x] T028 [US4] Create `tests/consumer.test.ts` and the `test:consumer` script: reads `CONSUMER_ROOT` and `CONSUMER_SETTINGS` and fails at once naming whichever is unset; runs the built reader twice on that code, asserts identical bytes, asserts the run takes under 30 seconds, asserts every entry rule produced at least one trip and every rule-matched function has at least one trip
- [x] T029 [US4] Draft the first consumer's settings in `local/` (never committed): its TypeScript projects, the packages it publishes itself under `keep`, entry rules for its route handlers, engine hooks and platform-identity entries, error-answer rules for its error statuses, error redirects and failure helpers; run the reader on its real code read-only; fix any reader defect found with a fixture test first; iterate until `npm run test:consumer` passes. Never change the consumer's repository
- [x] T030 [US4] (Done as far as possible: the consumer's schema-2 check does not exist yet, so the report's ids were checked against the consumer's current file; every exported declaration it draws has a part with the same id, and re-exports name their original declaration.) Check the report against what the first consumer's contract takes from the reader (relationships, refusals, checkpoints, trips per path) in a throwaway local translation under `local/` (never committed), and run the consumer's check on its output in a copy of the consumer's tree made under `local/` (never in the consumer's own checkout); record what passed and every gap
- [x] T031 [US4] Decide packaging and release (best guess on the deferred-review list: the packed package attached to each GitHub release, installed by tarball URL); wire it
- [x] T032 [US4] Write `README.md`: what the reader reports, the command, the settings file, the report format, with no reference to any other repository; link the format contract's content as shipped documentation in `docs/report.md` and `docs/settings.md` (stated directly, no spec references)
- [x] T033 [US4] (Done 2026-11-13: handed off in #f55ff2; feedback #ede778 addressed in #a18c56; the first consumer signed off in #fe4615 with its full check passing on the report; merged as 670c216 and released as v0.1.0.) MANUAL: hand off to the first consumer (`ops request` with the report and settings formats, the settings draft, and how to install the fixed version); hold in review; address each piece of its feedback here, each with a test; the consumer signs off; close together with its feature

---

## Phase 7: Polish

- [x] T034 [P] Add `tests/names.test.ts`: no file under `src/`, `tests/` (outside `tests/fixtures/**/node_modules`), `README.md` or `docs/` contains a framework or engine name the first consumer uses, and every fixture stand-in package is a stand-in
- [x] T035 Update `CLAUDE.md` with the code layout, the gate, `test:consumer`, and the fixture conventions
- [x] T036 Run quickstart.md end to end; `npm run check:all` green

---

## Dependencies & Execution Order

- Setup (T001–T005) → Foundational (T006–T014) → US1 (T015–T017) → US2 (T018–T021) → US3 (T022–T027) → US4 (T028–T033) → Polish (T034–T036).
- US2 needs US1's part graph only for wiring; its declarations matcher (T019) is reused by US3's entry rules.
- US3 needs US1's calls and US2's refusals (a refusal ends a path).
- US4 needs all three.

## Parallel Opportunities

- T002, T003, T004 together; T006, T007, T012 together.
- Fixture authoring (T015, T018, T022, T024) can be written ahead of the code that serves it.

## Implementation Strategy

- MVP is stage one (US1 + US2): a full part graph with refusals and checkpoints.
- Stage two (US3) adds trips. US4 proves it on real code and hands it over.
- `npm run check:all` stays green after every task.

---

## Phase 8: Convergence

- [x] T037 Name the count of distinct paths found when the walk stops at the path limit, alongside the entry, per FR-011b (partial)
