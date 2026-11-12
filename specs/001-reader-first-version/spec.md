# Feature Specification: The reader's first version

**Feature Branch**: `001-reader-first-version`

**Created**: 2026-11-11

**Status**: Draft

**Input**: A reader that runs on any TypeScript codebase and reports, deterministically and from
the TypeScript compiler alone, how its parts relate (who imports, calls, implements and extends
whom), where each function turns a request away, what each function marked as a checkpoint
checks, and every path from each entry into the code. The report is in a format the reader owns;
each consumer translates it into its own file. Proven first on the first consumer's real code.
Target: the reader's report, translated by the first consumer, gives the first consumer's
architecture file, and the consumer's checks accept it.

The readers of what the reader produces are the **owner**, who uses the drawn architecture to see
that every way inward is checked; the **agent** changing a codebase, whom a consumer's check stops
when a path goes deeper unchecked; and each consumer's **generator**, which runs the reader and
translates its report.

## Clarifications

### Session 2026-11-11

- Q: When the code hands one of its functions to outside code that runs it during the same
  request, is that function part of the walk? → A: Yes. It is a step at the point it is handed
  over, unless the settings say that hand-off is an entry (Jeff).
- Q: What should the reader do when one entry has more paths than is reasonable to list? → A:
  Stop with an error naming the entry once it passes a limit (1,000 paths per entry), which the
  settings can raise; never drop paths silently (Jeff).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every part says what it relates to (Priority: P1, stage one)

A consumer runs the reader on a codebase and gets, for every part, what it imports, calls,
implements and extends, so a drawing can show how the parts connect without anyone writing a link
by hand.

**Why this priority**: it is most of the report by volume and comes almost directly from the
compiler; it also settles the id scheme everything else builds on.

**Independent Test**: run the reader on a fixture codebase whose imports, calls, implementations
and extensions are known; every expected relationship is reported, nothing else is, and every list
is in its documented order.

**Acceptance Scenarios**:

1. **Given** a file that imports another file of the codebase, **When** the reader runs,
   **Then** the importing file carries an `imports` relationship to the imported file.
2. **Given** a function that calls another function of the codebase, **Then** the caller carries
   a `calls` relationship to the callee, whether either is exported or not.
3. **Given** a class that implements an interface or extends a class of the codebase, **Then** it
   carries an `implements` or `extends` relationship to it.
4. **Given** a call into a package outside the codebase, **Then** no relationship is reported,
   unless the codebase's settings name that package as one to keep, in which case the
   relationship names the package.
5. **Given** the same code, settings and reader version, **When** the reader runs twice, on any
   machine, **Then** the two reports are the same bytes.

---

### User Story 2 - Every function says where it turns a request away and what it checks (Priority: P1, stage one)

For every function, the reader reports each point where it turns a request away, in source order,
and what it checks when the code marks it as a checkpoint, so a drawing shows every refusal and a
consumer's check can tell whether a path passed a check.

**Why this priority**: checkpoints are what a consumer holds every path against; without them no
path into a deeper zone can be judged.

**Independent Test**: on a fixture with known throws, error answers and `@checkpoint` tags, the
reader reports exactly those refusals in source order, with the right words, and exactly those
checkpoints.

**Acceptance Scenarios**:

1. **Given** a function that throws an error built from a literal message, **Then** its refusal's
   `what` is that message.
2. **Given** a function that throws an error whose message is not a literal, **Then** its
   refusal's `what` is the error's class name.
3. **Given** a function that gives an answer the codebase's settings define as an error answer,
   **Then** that answer is a refusal at its place in source order.
4. **Given** a function whose doc comment carries `@checkpoint <what>`, **Then** it carries
   `checkpoint: { what }` with those words.
5. **Given** a function with no throw, no error answer and no tag, **Then** it carries neither.

---

### User Story 3 - Every entry into the code plays every path (Priority: P1, stage two)

For every entry into the code, as the codebase's settings define entries (in the first consumer:
route handlers, hooks handed to its embedded engine, and entries with the platform's own identity
such as a scheduled job), the reader reports one trip per path through the code, each listing the
parts it reaches in order, so choosing a door on a drawing plays its walks and a consumer's check
can judge each path on its own.

**Why this priority**: it is half of what the owner chose to see, and the check that no path goes
deeper unchecked runs on it; it is also most of the work.

**Independent Test**: on a fixture with known entries, branches and call paths, each distinct path
from each entry is exactly one trip, its steps are the expected parts in the expected order, and a
call through a function value the compiler cannot resolve starts a trip of its own.

**Acceptance Scenarios**:

1. **Given** an entry that calls three parts in turn, **Then** its one trip's steps are those three
   parts in that order.
2. **Given** code that branches (if X, check then reach the keys; otherwise reach the keys),
   **Then** each way through it is its own trip, so the path that skips the check is a trip of its
   own. A single flat list would read "check, keys, keys" and hide the unchecked path (Jeff,
   2026-11-11).
3. **Given** a branch inside a called function, **Then** it divides every path that reaches it.
4. **Given** a function value the compiler cannot resolve to one function, **Then** whatever is
   handed it begins its own trip and is not a step of the caller's.
5. **Given** a guard that turns the request away, **Then** the path that is turned away ends at
   that refusal and the path that passes continues.

---

### User Story 4 - Proven on the first consumer's real code (Priority: P1)

The reader runs on the first consumer's real code with that codebase's settings, and its report
holds everything the first consumer's contract asks of the reader, so the consumer's translation
can produce its file and the consumer's checks can accept it.

**Why this priority**: it is the target. Everything above is tested on fixtures; this is the proof
on real code.

**Independent Test**: run the reader on the first consumer's real code; every entry the consumer
draws has trips, every field the consumer's contract takes from the reader can be read from the
report, and a second run gives the same bytes. Then the consumer adopts it: it writes its
translation, runs its full check, and reports back. Each piece of its feedback is addressed in the
reader until the consumer signs off.

**Acceptance Scenarios**:

1. **Given** the first consumer's real code and settings, **When** the reader runs, **Then** every
   route handler, every hook handed to the engine and every platform-identity entry has at least
   one trip.
2. **Given** the report just made, **When** the reader runs again, **Then** the report is the same
   bytes.
3. **Given** a new `throw` added to a function on a path, **When** the reader runs, **Then** the
   report changes in that function's refusals and in the trips that pass through it, and nowhere
   else.

### Edge Cases

- A function with no name of its own (a handler written inline where it is registered): it gets
  an id derived from where it is written, stable while the code around it does not change.
- A call through a function value the compiler cannot resolve (a handler handed to a router, a
  hook handed to an engine): it starts its own trip; it is not a step of the caller's.
- A function of the codebase handed to outside code that runs it during the same request ("for
  each item, do this", "when this finishes, do that"): it is a step where it is handed over, so a
  check skipped inside it shows on the same path. A hand-off the settings define as an entry
  (registering a route) starts its own trips instead.
- A refusal or check inside a package outside the codebase: the reader does not open it; a
  consumer writes such things by hand.
- A check made by a package the codebase keeps (its own published library): the codebase's own
  function that calls it carries the `@checkpoint` tag; the reader reads the tag, not the package.
- A recursive or mutually recursive path: it ends when it would reach a part already reached on
  that path, so every trip is finite.
- A loop: its body is walked as taken once and as not taken, so the path that never enters it is
  its own trip and every trip is finite.
- Many independent branches on one entry: the paths multiply. Two paths that reach the same parts
  in the same order are one trip, since they cannot differ in what a consumer's check sees. Past
  the path limit the reader stops and names the entry; it never lists some paths and drops the
  rest.
- A `throw` caught within the code being walked: it is still a refusal of its function, and the
  path follows the code's own flow into the `catch` instead of ending there.
- A caught value thrown again (`throw err`): a refusal whose `what` is the type the compiler
  gives it, `unknown` included; the reader does not guess what was caught.
- A `@checkpoint` tag with no words, or on something other than a function: reported as written;
  refusing it is a consumer's check's job.
- Code the compiler reports errors in: the reader stops and names the errors rather than report
  from a partial picture.
- Settings that are missing, or name something the compiler cannot find: the reader stops and
  names the setting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The reader MUST read a codebase with the TypeScript compiler, using the TypeScript
  projects the codebase's settings name (one or more, in one report), and report only what the
  compiler shows. Nothing may be inferred
  from names, file layout or comments, except the `@checkpoint` tag.
- **FR-002**: The same code, settings and reader version MUST give the same bytes, regardless of
  machine, time, file-system order or the order files are read. The reader carries its own pinned
  TypeScript compiler, so the codebase's installed compiler cannot change the report. Every list
  in the report MUST have a documented order.
- **FR-003**: The report's format MUST be the reader's own, documented in this repository and
  versioned. It MUST NOT carry any one consumer's fields, ids or vocabulary.
- **FR-004**: Every part the report names (files, and every function, class, interface and other
  declaration, exported or not, including functions with no name) MUST have an id that is unique
  in the report and derived only from where the part is written.
- **FR-005**: For every part, the reader MUST report its relationships: `imports` file to file,
  and `calls`, `implements` and `extends` part to part.
- **FR-006**: A relationship to a target outside the codebase MUST be left out, except one into a
  package the codebase's settings name as kept, which MUST name the package.
- **FR-007**: For every function, the reader MUST report its refusals in source order: each
  `throw`, and each answer the codebase's settings define as an error answer. For a `throw`,
  `what` is the error's message when it is a literal, else the error's class name, else the type
  the compiler gives the thrown value. For an error answer, `what` comes from the place the
  settings name (such as the literal the answer carries), else the answer's own name in the
  settings.
- **FR-008**: For every function whose doc comment carries `@checkpoint <what>`, the reader MUST
  report the checkpoint with the tag's words.
- **FR-009**: What counts as an entry and what counts as an error answer MUST be supplied in the
  codebase's settings, in terms the compiler can check (types, declarations, call signatures),
  never built into the reader for one codebase.
- **FR-010**: For every entry, the reader MUST report one trip per distinct path through the code
  from that entry, each trip's steps being the parts that path reaches, in order, and naming the
  entry it starts from. A branch in a called function divides every path that reaches it. A loop's
  body is walked as taken once and as not taken. A refusal ends the path that reaches it, unless
  the code being walked catches it, in which case the path continues into the `catch`. Trips are
  listed in a documented order.
- **FR-011**: A call through a function value the compiler cannot resolve to a single function
  MUST start its own trip and MUST NOT continue the caller's.
- **FR-011a**: A function of the codebase handed to code outside it (a callback given to a
  package or a built-in) MUST be a step of the path at the point it is handed over, and its own
  steps follow there, unless the codebase's settings define that hand-off as an entry, in which
  case it starts its own trips instead.
- **FR-011b**: When one entry has more distinct paths than the path limit (1,000 unless the
  codebase's settings raise it), the reader MUST stop with an error naming the entry and its path
  count, and report nothing. It MUST NOT drop paths to stay under the limit. The built-in limit
  is safe to default because exceeding it fails loudly at once.
- **FR-012**: If the compiler reports errors in the code, or a setting is missing or names
  something the compiler cannot find, the reader MUST stop with the cause named, and report
  nothing.
- **FR-013**: A consumer MUST be able to install one exact version of the reader, so its
  out-of-date check gives the same answer on every machine and in its CI.

### Key Entities

- **Part**: a file or a declaration in it, exported or not, with an id derived from where it is
  written. Carries its relationships, and for a function its refusals and checkpoint.
- **Relationship**: a link from one part to another: imports, calls, implements, extends.
- **Refusal**: a point where a function turns a request away, with the words that say why.
- **Checkpoint**: what a function checks, from its doc-comment tag.
- **Entry**: a place where the code is entered from outside, as the codebase's settings define.
- **Trip**: one path from one entry, its steps as part ids in the order reached. An entry has as
  many trips as distinct paths.
- **Settings**: what a codebase tells the reader, in a file the codebase holds: its TypeScript
  projects (one or more; one report covers them all, with ids counted from the codebase's root),
  the packages to keep, what counts as an entry and as an error answer, and optionally a higher
  path limit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the first consumer's real code, the report holds every field the first
  consumer's contract takes from the reader; with the consumer's translation in place its full
  check passes; and the consumer has signed off.
- **SC-002**: Two runs on the same code, settings and reader version, on two different machines,
  produce byte-identical reports.
- **SC-003**: Every relationship, refusal, checkpoint, entry and trip rule above has a fixture
  test that reaches it, and every rule that leaves something out has a test proving it is left
  out.
- **SC-004**: Every entry in the first consumer's code has at least one trip, and every distinct
  path from it exactly one.
- **SC-005**: A full run on the first consumer's codebase (about 80 source files) finishes in
  under 30 seconds, short enough to sit in its check on every change.
- **SC-006**: No file of the reader names the first consumer, its framework's routes or its
  engine; everything specific to it lives in its own settings.

## Assumptions

- The reader applies to any TypeScript codebase; the first consumer is where each version is
  proven. Settings for other frameworks are written when a codebase using them adopts the reader.
- Two stages: stage one is User Stories 1 and 2 (relationships, refusals, checkpoints); stage two
  is User Story 3 (trips). User Story 4 closes the feature.
- The report names every part, exported or not. Which parts a consumer draws, and how it folds
  the rest into the parts it draws, is the consumer's translation.
- A call to a method is a `calls` relationship to that method.
- A part reached twice on one path is listed once, where it is first reached.
- Zones, doors, journeys, and which entry a door leads to are a consumer's, written by hand; the
  report gives each trip its entry and its steps, and nothing a consumer writes by hand.
- The first consumer's translation of the report into its file is the consumer's work. How this
  feature ends (Jeff, 2026-11-11): the reader is built and verified, then holds in review while
  the consumer adopts it. The consumer uses it and sends feedback; each piece is addressed here;
  the consumer signs off; this feature and the consumer's feature close together.
- How the reader is packaged and released for consumers to install is decided when the build is
  planned (parked, Jeff 2026-11-11).
- Tracked files in this repository never name another repository.
