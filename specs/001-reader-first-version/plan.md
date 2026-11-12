# Implementation Plan: The reader's first version

**Branch**: `001-reader-first-version` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-reader-first-version/spec.md`

## Summary

A command-line reader that loads a codebase through the TypeScript compiler (6.0.3, pinned and
carried by the reader), using the TypeScript projects its settings name, and writes one JSON report
in a format the reader owns: every part with its relationships, refusals and checkpoint, and every
distinct path from every entry as a trip. Entries and error answers are recognized by the
declarations the settings name, through the type checker, never by names. Built in two stages:
parts, relationships, refusals and checkpoints first; trips second. Proven on the first consumer's
real code through a local-only test, then held in review while the consumer adopts it.

## Technical Context

**Language/Version**: TypeScript, compiled to ES modules; Node.js >= 24

**Primary Dependencies**: `typescript` 6.0.3 (exact; the compiler API is the only source). No other
runtime dependency.

**Storage**: N/A (reads a codebase, writes one file or standard output)

**Testing**: Vitest; fixture codebases with expected reports byte for byte; a local-only test on
the first consumer's real code

**Target Platform**: any machine with Node.js 24+ (developer machines, CI)

**Project Type**: CLI tool, installable package

**Performance Goals**: a full run on a codebase of about 80 source files in under 30 seconds
(SC-005)

**Constraints**: same code, settings and reader version give the same bytes; stop loudly on
compiler errors, refused settings and passed path limits; no file names another repository

**Scale/Scope**: codebases of hundreds of files; up to 1000 trips per entry by default

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the plan meets it |
|---|---|
| I. Spec stays in spec spaces | `src/`, `tests/`, `README.md` state rules directly; no spec or requirement numbers in them. |
| II. Convention over configuration | Toolchain of the owner's other published TypeScript tool: Prettier, ESLint, `tsc`, Vitest, `check:all`. |
| III. Pinned, linted, type-safe, tested | Exact versions; `check:all` green at every task; fixture tests for every rule and every refusal. |
| IV. Same code, same bytes | Fixed key order and sorting everywhere; no time, path or version in the report; every fixture run twice and compared (research R7). |
| V. The compiler is the only source | Parts, calls, types, control flow and contextual types all come from the compiler API; the only hand-written marker is `@checkpoint`; entries and error answers by declaration, not name (R5). |
| VI. The reader owns its format | `contracts/report.md` is the reader's format, versioned by `format`; everything codebase-specific lives in that codebase's settings (`contracts/settings.md`). |
| Scope and constraints | A command-line tool: no service, no secrets. Proven on the first consumer's code by a local-only test that reads its location from the environment. |
| Workflow | Unit tests with the code; `test:consumer` end to end before hand-off; nothing merges without the owner. |

Post-design re-check: passes. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-reader-first-version/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── report.md
│   ├── settings.md
│   └── cli.md
├── checklists/requirements.md
└── tasks.md             (next: /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── cli.ts             command line: options, exit codes, writes the report
├── settings.ts        reads and refuses settings
├── program.ts         builds the compiler program(s) from the projects; compiler errors stop
├── codebase.ts        which files are the codebase; package name of an outside declaration
├── ids.ts             the id of every part
├── parts.ts           every file and declaration as a part
├── declarations.ts    matches settings declarations against compiler symbols
├── relationships.ts   imports, calls, implements, extends
├── refusals.ts        throws, error answers, checkpoints
├── entries.ts         entry rules and escaped function values
├── paths.ts           control-flow walk, trips, path limit
├── report.ts          assembles and serializes the report in its fixed order
└── errors.ts          the one error type that stops a run, with its message

tests/
├── fixtures/<name>/   small codebases: tsconfig.json, src/, node_modules/<stand-in>/,
│                      architecture-reader.json (settings), expected.json (the report)
├── unit/              one test file per src module
├── fixtures.test.ts   every fixture: report equals expected.json, twice, same bytes
├── cli.test.ts        exit codes and messages
└── consumer.test.ts   local only (npm run test:consumer): the first consumer's real code
```

**Structure Decision**: a single package. `dist/` (built, gitignored) is what is installed and run.
Fixture `node_modules/` folders are committed (an exception in `.gitignore`), since they are the
stand-in packages the fixtures depend on.

## Stages and order

1. **Setup**: package, toolchain, gate, an empty report for an empty codebase.
2. **Foundations**: settings, program, codebase, ids, parts, the report writer, the CLI.
3. **Stage one, User Story 1**: relationships.
4. **Stage one, User Story 2**: refusals, error answers, checkpoints.
5. **Stage two, User Story 3**: entries, escaped values, paths, collapse, limit.
6. **User Story 4**: draft the first consumer's settings locally, `test:consumer`, timing; decide
   packaging and release (parked); hand the report contract and the settings draft to the
   consumer; verify; hold in review for the consumer's feedback and sign-off.

## Complexity Tracking

None.
