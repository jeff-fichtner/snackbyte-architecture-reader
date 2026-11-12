# Contract: the settings file, format 1

What a codebase tells the reader. It lives in the codebase; its folder is the codebase root that
every path and id is counted from. Every rule names declarations as the compiler reports them,
never a name pattern.

```json
{
  "format": 1,
  "projects": ["tsconfig.json"],
  "keep": ["@scope/client"],
  "entries": [
    { "name": "route", "type": { "module": "fake-router", "name": "Handler" } },
    { "name": "hook", "type": { "module": "fake-engine", "name": "Configuration" }, "within": true },
    { "name": "job", "declarations": ["src/job.ts#runJob"] }
  ],
  "errorAnswers": [
    {
      "name": "error status",
      "call": { "module": "fake-router", "name": "Response.status" },
      "status": { "argument": 0, "atLeast": 400 }
    },
    { "name": "failure page", "call": { "module": "src/failure.ts", "name": "fail" }, "what": { "argument": 1 } }
  ],
  "pathLimit": 1000
}
```

| Field | Rule |
|---|---|
| `format` | Required, `1`. |
| `projects` | Required, at least one TypeScript project file, relative to the settings file's folder. |
| `keep` | Optional. Package names whose targets are kept as `pkg:<name>` relationships. |
| `entries` | Required, at least one rule, each with a unique `name` (not `value`, which the reader uses). |
| `errorAnswers` | Optional. Rules, each with a unique `name`. |
| `pathLimit` | Optional, a whole number of at least 1000. |

## A declaration

`{ "module": …, "name": … }`. `module` is a package name, as the nearest `package.json` above the
declaration's file states it, or a codebase file's path from the root. `name` is the qualified
name inside it, members joined by `.` (`Response.status`).

## Entry rules

- `type` (+ optional `within`): every codebase function whose contextual type (the type the code it
  is handed to expects for it) is that declaration; with `within: true`, also every function whose
  contextual type is a member declared anywhere inside it (a configuration interface whose
  properties are hooks).
- `declarations`: the named codebase parts, by id.

## Error-answer rules

- `call`: every call whose resolved signature is declared by that declaration.
- `status` (optional): only when the argument at that position can, by its type, be at least
  `atLeast` (a literal, or a union with any member that high). A status the compiler types only as
  `number` does not match.
- `what` (optional): the refusal's words are the string literal at that argument; otherwise, and
  when it is not a literal, the rule's `name`.

## Refusals of the settings

The run stops, naming the field, when: the file is missing or not JSON; `format` is not `1`; a
required field is missing; a project file does not exist or does not compile; a rule name repeats
or is `value`; a declaration names a module or name the compiler cannot find; an entry rule, or an
error-answer rule, matches nothing; a function is matched by two entry rules; `pathLimit` is under
1000.
