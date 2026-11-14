# snackbyte-architecture-reader

Reads a TypeScript codebase with the TypeScript compiler and reports, deterministically, how its
parts relate (who imports, calls, implements and extends whom), where each function turns a request
away, what each function marked as a checkpoint checks, and every path from each entry into the
code.

The same code, settings and reader version always give the same bytes. The compiler is the only
source: nothing is inferred from names or file layout, and the only hand-written marker is a
`@checkpoint <what>` tag in a function's doc comment, for the one thing a compiler cannot tell: that
a call is a check.

## Use

```text
architecture-reader --settings architecture-reader.json [--out report.json]
```

The settings file lives in the codebase being read and says which TypeScript projects make it up,
what counts as an entry into the code (a route handler, a hook handed to an engine, a scheduled
job) and what counts as an error answer. See [docs/settings.md](docs/settings.md).

The report is one JSON document: every part with its relationships, refusals and checkpoint, and one
trip per distinct path from every entry. See [docs/report.md](docs/report.md). A consumer translates
it into whatever file it draws from.

| Exit | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| `0`  | The report was written.                                              |
| `1`  | The run stopped; standard error names the cause. Nothing is written. |
| `2`  | Wrong usage: an unknown option, or `--settings` missing.             |

## Install

Each release carries the packed package, built, as an asset of its GitHub release. Install one
exact version from it; npm records the tarball's integrity, so `npm ci` installs the same bytes:

```text
npm install --save-dev https://github.com/jeff-fichtner/snackbyte-architecture-reader/releases/download/v0.1.1/snackbyte-architecture-reader-0.1.1.tgz
```

The package needs no build and runs no install script. Node.js 24 or later.

## Release

On `main`, at the commit to release, with `version` in `package.json` set to the release's
version: `npm pack` builds and packs `snackbyte-architecture-reader-<version>.tgz`, and
`gh release create v<version> snackbyte-architecture-reader-<version>.tgz` publishes it with its
tag.

## Develop

`npm run check:all` runs formatting, lint, type check, the build and every test. Each folder under
`tests/fixtures/` is a small codebase with its settings and, where it has one, the report it must
produce byte for byte. `npm run test:consumer` runs the reader on a real codebase named by
`CONSUMER_ROOT` and `CONSUMER_SETTINGS`.
