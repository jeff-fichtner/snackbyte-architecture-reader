# Data model: The reader's first version

Everything here is computed per run; nothing is stored. The shapes as written to disk are in
[contracts/report.md](contracts/report.md) and [contracts/settings.md](contracts/settings.md).

## Settings

| Field | Rule |
|---|---|
| `format` | `1`. Any other value stops the run. |
| `projects` | One or more TypeScript project files, relative to the settings file's folder, which is the codebase root. Each must exist and compile without errors. |
| `keep` | Package names whose targets are kept as `pkg:` relationships. Optional, default none. |
| `entries` | Entry rules, each with a unique `name`. At least one. Each must match at least one function. |
| `errorAnswers` | Error-answer rules, each with a unique `name`. Optional. Each listed rule must match at least one call. |
| `pathLimit` | Optional; at least 1000. |

## Part

- `id` (unique; see research R4), `kind`: `file`, `function`, `method`, `class`, `interface`,
  `type`, `enum`, `variable`, `namespace`.
- `rel`: relationships from this part, sorted by `kind` then `to`, no duplicates.
- `refuses`: functions and methods only; in source order.
- `checkpoint`: any part whose doc comment carries a `@checkpoint` tag (the first one); a tag on
  anything but a function or method is reported as written, for a consumer's check to refuse.
- A file part exists for every codebase file; a declaration part for every declaration in it,
  exported or not.

## Relationship

- `{ to, kind }`, `kind` one of `imports`, `calls`, `implements`, `extends`.
- `imports`: file to file, from import and export declarations, dynamic `import()` with a literal
  and `import("…")` types, resolved by the compiler.
- `calls`: from the innermost function, method or file (top-level code) containing the call, to
  the resolved callee; `new X()` calls `X`. A call into a kept package names `pkg:<name>`.
- `implements` / `extends`: from a class or interface to the declarations its heritage clauses
  resolve to.

## Refusal

- `{ what }`, in source order within its function.
- From `throw`: the message when the error is constructed with a string literal first argument;
  else the constructed class's name; else the compiler's type of the thrown value.
- From an error-answer rule: the literal at the rule's `what` argument; else the rule's `name`.

## Checkpoint

- On any part carrying the tag. `{ what }`: the words after `@checkpoint`, whitespace collapsed. An empty tag gives `what: ""`
  (reported as written; refusing it is a consumer's check's job).

## Entry

- A function matched by an entry rule (`rule` = its name), or a function that escapes as a value
  and is not a step where it is handed over (`rule` = `value`). A function matched by two entry
  rules stops the run naming both rules.

## Trip

- `{ entry, rule, steps }`; `steps` starts with the entry itself.
- One per distinct step list from that entry. Sorted by `entry`, then `steps` element by element.
- The number of distinct trips of one entry must not exceed `pathLimit` (default 1000).
