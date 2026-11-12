# snackbyte-architecture-reader

Reads a TypeScript codebase with the TypeScript compiler and writes, deterministically, how its
parts relate: who imports, calls, implements and extends whom, where each function turns a
request away, and the path each entry point takes through the code. The output goes into the
codebase's `architecture.json`.

The same code always gives the same bytes. The compiler is the only source; nothing is inferred
from names or guessed.

Not yet built.
