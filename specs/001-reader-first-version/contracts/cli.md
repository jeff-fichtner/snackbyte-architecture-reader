# Contract: the command

```text
architecture-reader --settings <file> [--out <file>]
```

| Option | Meaning |
|---|---|
| `--settings <file>` | Required. The codebase's settings file ([settings.md](settings.md)). Its folder is the codebase root. |
| `--out <file>` | Optional. Write the report there instead of to standard output. |

| Exit | Meaning |
|---|---|
| `0` | The report was written. |
| `1` | The run stopped: compiler errors, a refused setting, a path limit passed. Standard error names the cause (file and position where there is one). Nothing is written to standard output or `--out`. |
| `2` | Wrong usage: an unknown option, or `--settings` missing. |

The command reads nothing from the environment and writes nothing but the report.
