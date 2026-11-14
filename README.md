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

The report is one JSON document: every part with its relationships, refusals and checkpoint (and,
for a function that starts trips of its own as a value, the parts that hand it on), and one trip per
distinct path from every entry. See [docs/report.md](docs/report.md). A consumer translates
it into whatever file it draws from.

| Exit | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| `0`  | The report was written.                                              |
| `1`  | The run stopped; standard error names the cause. Nothing is written. |
| `2`  | Wrong usage: an unknown option, or `--settings` missing.             |

## Install

The package is `@snackbyte/architecture-reader` on npm. Install one exact version; the lockfile
pins it, so `npm ci` installs the same bytes:

```text
npm install --save-dev --save-exact @snackbyte/architecture-reader@0.3.1
```

The package needs no build and runs no install script. Node.js 24 or later.

## Release

Set `version` in `package.json` and merge to `main`. The release workflow runs the gate, tags
`v<version>` and stages the version on npm, where it goes public once approved with 2FA. The steps,
and the one-time setup, are in
[RELEASING.md](https://github.com/jeff-fichtner/snackbyte-architecture-reader/blob/main/RELEASING.md).

## Develop

`npm run check:all` runs formatting, lint, type check, the build and every test. Each folder under
`tests/fixtures/` is a small codebase with its settings and, where it has one, the report it must
produce byte for byte. `npm run test:consumer` runs the reader on a real codebase named by
`CONSUMER_ROOT` and `CONSUMER_SETTINGS`.
