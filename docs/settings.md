# The settings file, format 1

What a codebase tells the reader. It lives in the codebase; its folder is the codebase root that
every path and id is counted from. Every rule names declarations as the compiler reports them,
never a pattern over names.

```json
{
  "format": 1,
  "projects": ["tsconfig.json"],
  "keep": ["@scope/client"],
  "entries": [
    { "name": "route", "type": { "module": "router-types", "name": "Handler" } },
    {
      "name": "hook",
      "type": { "module": "engine-types", "name": "Configuration" },
      "within": true
    },
    { "name": "job", "declarations": ["src/job.ts#runJob"] }
  ],
  "errorAnswers": [
    {
      "name": "error status",
      "call": { "module": "router-types", "name": "Response.status" },
      "status": { "argument": 0, "atLeast": 400 }
    },
    {
      "name": "failure page",
      "call": { "module": "src/failure.ts", "name": "fail" },
      "what": { "argument": 1 }
    }
  ],
  "pathLimit": 1000
}
```

| Field          | Rule                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `format`       | Required, `1`.                                                                                                      |
| `projects`     | Required: one or more TypeScript project files, relative to the settings file's folder. One report covers them all. |
| `keep`         | Optional. Package names whose targets are kept as `pkg:<name>` relationships.                                       |
| `entries`      | Required, at least one rule, each with a unique `name` (not `value`, which the reader uses).                        |
| `errorAnswers` | Optional. Rules, each with a unique `name`.                                                                         |
| `pathLimit`    | Optional, a whole number of at least 1000.                                                                          |

The codebase is every source file the projects include, except declaration files and anything under
`node_modules`. Every file a project compiles must lie under the settings file's folder.

## A declaration

`{ "module": …, "name": … }`. `module` is a package name, as the nearest `package.json` above the
declaration's file states it (types from DefinitelyTyped are `@types/…`), or a codebase file's path
from the root. `name` is the qualified name inside it, members joined by `.` (`Response.status`,
`Configuration.interactions.url`).

## Entry rules

- `type`, with optional `within`: every codebase function whose contextual type (the type the code
  it is handed to expects for it) is that declaration, or an interface or class that extends it.
  With `within: true`, also every function whose contextual type, or the property it fills, is
  declared anywhere inside it: a configuration interface whose properties are hooks.
- `declarations`: the named codebase functions, by id.

## Error-answer rules

- `call`: every call whose resolved signature is declared by that declaration.
- `status` (optional): only when the argument at that position can, by its type, be at least
  `atLeast`: a number literal, or a union with any member that high. An argument the compiler types
  only as `number` does not match.
- `what` (optional): the refusal's words are the string literal (or `const` declared as one) at that
  argument; otherwise the rule's name.

## When the reader stops

The run stops, writing nothing and naming the cause, when: the file is missing or not JSON; `format`
is not `1`; a required field is missing or a value is of the wrong kind; a project file does not
exist; the compiler reports errors in the code; a rule name repeats or is `value`; a declaration
names a module or name the compiler cannot find; a `declarations` rule names something that is not
a function part; an entry rule, or an error-answer rule, matches nothing; a function is matched by
two entry rules; `pathLimit` is under 1000; an entry has more paths than the path limit.
