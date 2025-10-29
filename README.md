# latex-math-convert

CLI to convert LaTeX bracket-style math delimiters in Markdown to dollar-style.

Converts:
- `\( ... \)` to `$ ... $`
- `\[ ... \]` to `$$ ... $$`

Skips:
- Fenced code blocks (``` or ~~~, with optional leading spaces)
- Inline code delimited by backticks (supports multiple backticks)

## Install

Using pnpm (recommended):

```
pnpm add -D latex-math-convert
```

Or globally:

```
pnpm add -g latex-math-convert
```

## Usage

Convert a file and print to stdout:

```
latex-math-convert README.md > README.conv.md
```

Overwrite files in place:

```
latex-math-convert --write docs/ notes.md
```

Read from stdin and write to stdout:

```
cat notes.md | latex-math-convert --stdin > notes.conv.md
```

## Notes

- The converter is a linear parser that tracks fenced blocks and inline code to avoid transforming math within code.
- It does not currently parse nested Markdown constructs beyond these protections.

