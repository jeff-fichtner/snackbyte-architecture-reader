# Contract: the report, format 1

What the reader writes. Every consumer reads this and translates it into its own file; nothing in
it is shaped for one consumer. The same code, settings and reader version always give the same
bytes.

## Encoding

JSON, UTF-8, two-space indent, LF line endings, one final newline. Keys appear in the order shown
below. Optional fields are absent, never `null` or empty.

## Top level

```json
{
  "format": 1,
  "parts": [],
  "trips": []
}
```

| Field | Meaning |
|---|---|
| `format` | `1`. A consumer refuses a format it does not know. |
| `parts` | Every part of the codebase, sorted by `id` (plain code-unit order). |
| `trips` | Every trip, sorted by `entry`, then by `steps` compared element by element. |

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

| Field | Meaning |
|---|---|
| `id` | Unique. A file: its path from the codebase root. A declaration: `path#name`, nested names joined by `.`. A function with no name: its enclosing id, `/`, and its 1-based position among the unnamed functions directly inside that part (`path#/n` at a file's top level). |
| `kind` | `file`, `function`, `method`, `class`, `interface`, `type`, `enum`, `variable` or `namespace`. |
| `rel` | Optional. `[{ to, kind }]`, sorted by `kind` then `to`. `kind`: `imports` (file to file), `calls`, `implements`, `extends`. `to` is a part id, or `pkg:<name>` for a package the settings keep. Targets in any other package are left out. |
| `refuses` | Optional; functions and methods only. `[{ what }]`, each point where the function turns a request away, in source order: a `throw`, or a call an error-answer rule matches. For a `throw`, `what` is the error's literal message, else its class name, else the compiler's type of the thrown value. For an error answer, the literal at the rule's `what` argument, else the rule's name. |
| `checkpoint` | Optional. `{ what }`, the words of the part's `@checkpoint` doc-comment tag. Normally on a function or method; a tag on any other part is reported as written, so a consumer can refuse it. |

## A trip

```json
{
  "entry": "src/app.ts#createApp/3",
  "rule": "route",
  "steps": ["src/app.ts#createApp/3", "src/session.ts#requireSession", "src/store.ts#Store.open"]
}
```

| Field | Meaning |
|---|---|
| `entry` | The id of the function the trip starts in. |
| `rule` | The settings' entry rule that made it an entry, or `value` for a function that escapes as a value the compiler cannot follow to its caller. |
| `steps` | Part ids in the order this path reaches them, starting with the entry; each part listed once, where first reached. |

One trip per distinct path from an entry: wherever the code branches, each way through it is its
own trip, so a path that skips a check is a trip of its own. Paths that reach the same parts in the
same order are one trip. A refusal ends a path unless the walked code catches it. A loop body is
walked as taken once and as not taken.

## What a consumer adds

Ids of its own, which parts it draws and how it folds the rest into them, trip ids, zones, doors,
journeys, and which door leads to which entry: all of it is the consumer's translation.
