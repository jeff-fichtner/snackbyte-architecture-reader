# snackbyte-architecture-reader

A standalone tool that reads a TypeScript codebase with the TypeScript compiler and writes,
deterministically, how its parts relate (who imports, calls, implements and extends whom), where
each function turns a request away, and the path each entry point takes through the code. Its
output goes into the codebase's `architecture.json`, in the format its first consumer defines.

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
- The output format belongs to the consumer. Read it from the consumer; don't copy it here, and
  never change the consumer from here.

Spec Kit tooling:
- The speckit engine extensions (engine, git-lifecycle, review-loop, clickup) were installed with
  `specify extension add --dev`, which writes their `.claude/skills/speckit-*` mirrors as symlinks
  into the gitignored `.specify-dev/`. They are committed as real files. A re-install writes the
  symlinks back: replace them with files again afterwards
  (`find .claude/skills -type l -exec sh -c 'cp "$1" "$1.tmp" && mv "$1.tmp" "$1"' sh '{}' ';'`).
  A re-install is also the only way a `--dev` install updates.
