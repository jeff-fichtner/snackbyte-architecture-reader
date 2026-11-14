# snackbyte-architecture-reader

A standalone tool that reads a TypeScript codebase with the TypeScript compiler and writes,
deterministically, how its parts relate (who imports, calls, implements and extends whom), where
each function turns a request away, and the path each entry point takes through the code. Its
output is a report in a format the reader owns; each consumer translates it into its own
`architecture.json`. It applies to any TypeScript codebase, and is proven on the first consumer's
code first (Jeff, 2026-11-11).

Tracked files never name another repository: not in code, docs, specs, tests or commit messages
(Jeff, 2026-11-11). Say "the first consumer". The names, the contract's location and how to
reach the consumer are in `CLAUDE.local.md`, which is never committed.

Decided (Jeff, 2026-11-10):
- Repo `snackbyte-architecture-reader`. A descriptive name: only developers see it.
- Target: the reader writes the first consumer's architecture file, and the consumer's checks
  accept it.
- ClickUp: space `tools` › folder `architecture-reader` › list `Roadmap` (Jeff, 2026-11-11). IDs
  in `.specify/extensions/clickup/clickup-config.yml`.

Constraints:
- Deterministic: the same code gives the same bytes.
- The TypeScript compiler is the only source.
- The reader owns its report format, documented in this repository. Nothing in it is shaped for
  one consumer; what differs per codebase (entries, error answers) is supplied per codebase.
- The first consumer's contract is what its translation must reach. Read it there; don't copy it
  here, and never change the consumer from here.

Spec Kit tooling:
- The speckit engine extensions (engine, git-lifecycle, review-loop, clickup) were installed with
  `specify extension add --dev`, which writes their `.claude/skills/speckit-*` mirrors as symlinks
  into the gitignored `.specify-dev/`. They are committed as real files. A re-install writes the
  symlinks back: replace them with files again afterwards
  (`find .claude/skills -type l -exec sh -c 'cp "$1" "$1.tmp" && mv "$1.tmp" "$1"' sh '{}' ';'`).
  A re-install is also the only way a `--dev` install updates.

Code:
- `src/`: `cli.ts` (the command) → `main.ts` (one run: settings, programs, codebase, parts,
  relationships, refusals, entries, paths, report). `declarations.ts` matches the declarations
  settings name; `report.ts` owns the report's one fixed form.
- Gate: `npm run check:all` (format, lint, typecheck, build, tests). The command tests run the
  built `dist/`.
- Fixtures: `tests/fixtures/<name>/` is a small codebase with `architecture-reader.json` and,
  where it has one, `expected.json`, written by hand from the rules, never copied from the
  reader's output. Stand-in packages live in each fixture's committed `node_modules/`.
- `npm run test:consumer` runs the reader on a real codebase: `CONSUMER_ROOT` and
  `CONSUMER_SETTINGS` (both required). For the first consumer, `local/copy-consumer.sh` copies its
  tree into `local/consumer/` with the draft settings; `local/` is never committed.
- Deferred reviews: `specs/reviews.md`, read at every feature's close.
