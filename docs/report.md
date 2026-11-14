# The report, format 2

What the reader writes. A consumer reads it and translates it into its own file; nothing in it is
shaped for one consumer. The same code, settings and reader version always give the same bytes.

## Encoding

JSON, UTF-8, two-space indent, LF line endings, one final newline. Keys appear in the order shown
below. Optional fields are absent, never `null` or empty. Lists are sorted in plain code-unit order,
the same on every machine and in every locale.

## Top level

```json
{
  "format": 2,
  "parts": [],
  "trips": []
}
```

| Field    | Meaning                                                                     |
| -------- | --------------------------------------------------------------------------- |
| `format` | `2`. A consumer refuses a format it does not know.                          |
| `parts`  | Every part of the codebase, sorted by `id`.                                 |
| `trips`  | Every trip, sorted by `entry`, then by `steps` compared element by element. |

## A part

```json
{
  "id": "src/app.ts#createApp/3",
  "kind": "function",
  "rel": [{ "to": "src/store.ts#Store.open", "kind": "calls" }],
  "refuses": [{ "what": "not signed in" }],
  "checkpoint": { "what": "the session cookie is signed and current" },
  "handedOnBy": ["src/app.ts#createApp"]
}
```

Every file of the codebase is a part, and so is every declaration in it, exported or not: functions,
methods, classes, interfaces, types, enums, namespaces, and variables at a file's or namespace's top
level or on a class. A local variable is a part only when it holds a function.

### `id`

Derived only from where the part is written:

- a file: its path from the codebase root, `/`-separated (`src/app.ts`);
- a top-level declaration: `path#name` (`src/app.ts#createApp`);
- a nested or member declaration: names joined by `.` (`src/store.ts#Store.open`);
- a function assigned to a variable, a class property or an object-literal property takes that
  name; nested object literals add their property names (`src/app.ts#config.interactions.url`);
- a function with no name: its enclosing id, `/`, and its 1-based position among the unnamed
  functions directly inside that part, in source order (`src/app.ts#createApp/3`; `path#/n` at a
  file's top level);
- a class constructor: `path#Class.constructor`;
- when two parts would share an id, the later ones in source order take `~2`, `~3`, and so on.

Positions count unnamed functions, not lines, so an id holds while lines elsewhere change.

### `kind`

`file`, `function`, `method`, `class`, `interface`, `type`, `enum`, `variable` or `namespace`.

### `rel`

`[{ to, kind }]`, sorted by `kind` then `to`, each pair once.

- `imports`: file to file, from import and export declarations, `import("…")` calls with a literal,
  and `import("…")` types.
- `calls`: from the innermost function or method holding the call (or the file, for top-level code)
  to the function, method or class the compiler resolves it to. `new X()` calls `X`'s constructor,
  or `X` when it has none. A call through a parameter goes to the one function the parameter holds
  there, when it holds exactly one (see
  [Functions passed through parameters](#functions-passed-through-parameters)); any other call
  through an interface or a function-typed value names no part and is left out.
- `implements` / `extends`: from a class or interface to what its heritage clauses name.

`to` is a part id, or `pkg:<name>` for a package the settings keep. Targets in any other package
are left out.

### `refuses`

On functions and methods: `[{ what }]`, each point where the function turns a request away, in
source order: every `throw`, and every call an error-answer rule of the settings matches.

- For a `throw`, `what` is the error's message, or the thrown value itself, when it is a written
  message (below); otherwise the class the compiler gives the thrown value; otherwise the compiler's
  name for its type (`unknown` for a rethrown caught value).
- For an error answer, `what` is the written message at the rule's `what` argument; otherwise the
  rule's name.

A written message is a string literal; a template literal; a concatenation of strings with `+`; or a
`const` declared as any of these. Its text is what the code writes, and each part filled in when the
code runs (a substitution, a variable, a call) reads as one `…`, adjacent ones as one:
`` `Missing required configuration: ${name}` `` reads `Missing required configuration: …`. A part
that is itself a written message keeps its text. A message with a `…` but no letter or digit of its
own (`` `${a}: ${b}` ``) is not a written message, and falls back to the class. A variable the
compiler has only narrowed to a literal is not a written message.

### `checkpoint`

`{ what }`: the words of the part's `@checkpoint` doc-comment tag, whitespace collapsed. Normally on
a function or method; a tag anywhere else, or with no words, is reported as written, so a consumer
can refuse it.

### `handedOnBy`

On a function that starts trips with the rule `value` (see [Entries](#entries)), and on no other
part: the ids of the parts whose code hands it on, sorted, each once. For each place the function is
used as a value, that is the innermost function or method holding the place, or the file for
top-level code, the same part a `calls` relationship would come from. A callback written in place as
an argument, `run(() => …)`, is handed on by the function holding that call; a function written in
an object literal is handed on by the function holding the literal, whoever later calls it.

A consumer can start such a function's trips where the paths of the parts that hand it on stood,
rather than from raw input.

## A trip

```json
{
  "entry": "src/app.ts#createApp/3",
  "rule": "route",
  "steps": ["src/app.ts#createApp/3", "src/session.ts#requireSession", "src/store.ts#Store.open"]
}
```

| Field   | Meaning                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| `entry` | The id of the function the trip starts in.                                                                         |
| `rule`  | The settings' entry rule that made it an entry, or `value` (below).                                                |
| `steps` | Part ids in the order this path reaches them, starting with the entry; each part listed once, where first reached. |

There is one trip per distinct path from an entry. Wherever the code branches (`if`, `switch`,
`?:`, `&&`, `||`, `??`, an optional call, `try`/`catch`), each way through is its own trip, so a path
that skips a check is a trip of its own. A branch inside a called function divides every path that
reaches it. A loop body is walked as taken once and as not taken. `return` ends a path; a `throw`
ends it unless the walked code catches it, in which case the path continues into the `catch`; an
error answer ends the trip. A part already on the call stack is not walked again, which ends
recursion. Paths that reach the same parts in the same order are one trip.

### Entries

- A function an entry rule of the settings matches.
- A function handed to code outside the codebase (a callback given to a package or a built-in) is
  not an entry: it is a step of the path where it is handed over, and its own steps follow there.
- A function passed into a parameter of a codebase function, and reached only through calls the
  reader resolves (below), is not an entry: it is a step of each path that calls it.
- A function used as a value in any other way (stored, returned, written in an object literal that
  is not passed straight into a parameter, or passed into a parameter the reader cannot resolve) is
  called where the compiler cannot follow, so it starts trips of its own, with the rule `value`.
  Every function that escapes as a value is accounted for this way, so no path can disappear.

### Functions passed through parameters

The reader follows a function from where it is passed to where it is called.

- A function passed as an argument to a codebase function, or as a property of an object literal
  passed as one (`createApp({ engine, mount: { log } })`), is held by that parameter at that
  property path (`engine`, `mount.log`). A function's parameter default counts the same way.
- A parameter passed on to another codebase function, whole or by a property path (`routes(deps)`,
  `routes(deps.mount)`), carries what it holds to that function's parameter. A name destructured
  from a parameter (`({ run }) => run()`) stands for that property path.
- A call through a parameter (`deps.engine(…)`), in the function or in any function written inside
  it, goes to the function the parameter holds at that path when, across every call that passes
  the parameter, it can hold only that one function there. Two different functions there, or
  anything the reader cannot follow, and the call names no part.
- A parameter's values are known only for a function written as a function (not a method or a
  constructor) that is called only where the compiler resolves the call to it: never used as a value,
  and not matched by an entry rule. Any other can be called with arguments the reader does not see.
  Only calls in the codebase are seen: a function also called from outside the codebase can receive
  other values there.
- What can reach a parameter's value unseen leaves it unknown: an object spread into the literal, a
  computed property name, an argument the reader cannot follow, a property written over, an index by
  a variable, a default in a destructured name. A function so passed is still followed where its
  calls resolve, but it also starts trips as a `value`.
- A function passed into a parameter stops being a `value` entry only when every place it is used as
  a value passes it into a parameter, every call through those parameters at that path resolves to
  it alone, and nothing reads the property path that holds it in any other way (returns it, stores
  it, hands it to code outside the codebase, takes it through a rest element or an array pattern).

### The path limit

When one entry has more distinct paths than the path limit (1000 unless the settings raise it), the
reader stops, naming the entry. It never lists some paths and drops the rest.

### What a path does not see

Two kinds of code are left off the paths. Following either one multiplies an entry's paths beyond
what a list of trips can hold.

- **A `catch` reached only from code the reader cannot follow.** A path continues into a `catch`
  only from a `throw` in walked code. A call into a package or a built-in, or through a value or a
  parameter that names no part, is not taken as able to throw. So a `catch` whose `try` throws only
  through such calls is on no path. Its calls still appear as `calls` relationships, but the parts
  it reaches appear on no trip from there.
- **A tagged template.** `` html`…` `` is a use of its tag as a value, not a call. A codebase
  function used as a tag is not a `calls` target and not a step where the template is written. It
  starts trips of its own with the rule `value`, and is handed on by the parts that hold the
  templates.

## What a consumer adds

Ids of its own, which parts it draws and how it folds the rest into them, trip ids, zones, doors,
journeys, and which door leads to which entry: all of that is the consumer's translation.
