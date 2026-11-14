# Quickstart: proving the reader works

## Prerequisites

Node.js 24 or later, and `npm ci` in this repository.

## 1. The gate

`npm run check:all` runs formatting, lint, type check and every test. Every fixture under
`tests/fixtures/` holds a small codebase, its settings, and the report it must produce byte for
byte; the tests also run each fixture twice and compare the bytes.

## 2. One fixture by hand

```text
npm run build
node dist/cli.js --settings tests/fixtures/branches/architecture-reader.json
```

Expected: the report on standard output, identical to
`tests/fixtures/branches/expected.json`; a path that skips the check is its own trip.

## 3. The refusals

Each settings refusal in [contracts/settings.md](contracts/settings.md) and each command exit in
[contracts/cli.md](contracts/cli.md) has a test that reaches it; `npm test` covers them.

## 4. The first consumer's real code

`CONSUMER_ROOT` is the consumer's checkout and `CONSUMER_SETTINGS` its settings file (drafted
locally, never committed here). `npm run test:consumer` fails at once if either is unset; it runs
the reader twice on that code, compares the bytes, checks the run time, and checks that every
entry has at least one trip.

Then the consumer's own translation and check run in the consumer's repository, by the consumer.
