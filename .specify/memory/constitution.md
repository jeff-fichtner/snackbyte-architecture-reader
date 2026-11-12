# snackbyte-architecture-reader Constitution

## Core Principles

### I. Spec Stays in Spec Spaces

`specs/`, `.specify/` and `.claude/` are AI-assist scaffolding. Shipped code (`src/`, `tests/`,
`README`, `docs/`, scripts) MUST stand on its own: it MUST NOT reference specs, requirement
numbers or principle numbers. State the rule directly instead.

Rationale: readers of the shipped repo may not have the workflow those pointers lead into.

### II. Convention over Configuration

The tooling is set up and complete. A feature MUST NOT re-litigate it; a change to the tooling is
its own decision, made once, not per feature.

### III. Pinned, Linted, Type-Safe, Tested

One check gate (format + lint + typecheck + test) MUST be green on every change, not only at the
end of a feature. Dependencies are pinned.

### IV. Same Code, Same Bytes

The output MUST be deterministic: the same code gives the same bytes. It MUST NOT depend on the
machine, the time, file-system order or the order files were read. Every collection in the output
has a defined order, and a test proves that two runs produce identical bytes.

Rationale: the consumer's gate compares the output; any nondeterminism reads as a change that
did not happen.

### V. The Compiler Is the Only Source

Everything in the output MUST come from the TypeScript compiler's view of the code. Nothing is
inferred from names, file layout or comments, and nothing is guessed. What the compiler cannot
tell (for example, that a call is a checkpoint) comes only from an explicit marker written in the
code.

Rationale: a guess that is wrong is drawn as fact; an explicit marker is visible and reviewable.

### VI. The Reader Owns Its Format; Consumers Adapt

The reader describes any TypeScript codebase in a report whose format it defines and documents
here. It MUST NOT take the shape of any one consumer's file: each consumer translates the report
into its own format. What differs between codebases (what counts as an entry, what counts as an
error answer) is supplied per codebase, never built in for one of them. A change to the report's
format is a versioned change of the reader, announced to its consumers.

Rationale: a tool shaped to its first consumer has to change its output under that consumer to
serve a second one; a tool that owns its format serves each through the consumer's own
translation.

## Scope and Constraints

- A standalone command-line tool: it reads a codebase on disk and writes a file. It calls no
  service and holds no secrets.
- It applies to any TypeScript codebase. Each version is proven on a real consumer's code before
  it is handed over, the first consumer first.

## Development Workflow

- Unit tests accompany the code as it is written; the check gate stays green at every step.
- Before work is handed over, it is tested end to end against the consumer's real code, and the
  consumer's own checks are run against the output.
- Nothing merges without the owner's review and approval.

## Governance

This constitution supersedes other practices in this repository. Every spec, plan and review
checks compliance with it. Amendments are made with `/speckit-constitution`, approved by the
owner, and versioned: MAJOR for removing or redefining a principle, MINOR for adding a principle
or materially expanding guidance, PATCH for wording. Runtime guidance for agents lives in
`CLAUDE.md`.

**Version**: 2.0.0 | **Ratified**: 2026-11-11 | **Last Amended**: 2026-11-11
