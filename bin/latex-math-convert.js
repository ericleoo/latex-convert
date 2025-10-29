#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function printHelp() {
  const lines = [
    "",
    "latex-math-convert v0.1.0",
    "",
    "Convert LaTeX bracket-style math delimiters to dollar-style in Markdown files.",
    "",
    "Rewrites:",
    "  \\(" + " ... " + "\\)  ->  $ ... $",
    "  \\[" + " ... " + "\\]  ->  $$ ... $$",
    "",
    "Skips code blocks (``` and ~~~) and inline code (`...`).",
    "",
    "Usage:",
    "  latex-math-convert <file|dir> [more paths...]",
    "  latex-math-convert --stdin              Read markdown from stdin",
    "  latex-math-convert --write <paths>      Overwrite files in place",
    "  latex-math-convert --stdout <paths>     Print converted output to stdout (default when using --stdin)",
    "",
    "Options:",
    "  --write            Overwrite files in place (when paths are provided)",
    "  -q, --quiet        Suppress non-error logs",
    "  -v, --version      Print version",
    "  -h, --help         Show help",
  ];
  console.log(lines.join("\n"));
}

function printVersion() {
  console.log("0.1.0");
}

function parseArgs(argv) {
  const args = { paths: [], write: false, quiet: false, stdin: false, stdout: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--write") args.write = true;
    else if (a === "--stdin") args.stdin = true;
    else if (a === "--stdout") {
      args.stdout = true;
    } else if (a === "-q" || a === "--quiet") args.quiet = true;
    else if (a === "-v" || a === "--version") return { version: true };
    else if (a === "-h" || a === "--help") return { help: true };
    else args.paths.push(a);
  }
  return args;
}

// Convert text by replacing bracket-style math with dollar-style, skipping code regions
function convertMarkdown(md) {
  // We will scan linearly, tracking fenced code blocks and inline code.
  let i = 0;
  const n = md.length;
  let out = "";
  let inFence = false;
  let fenceMarker = null; // ``` or ~~~
  let fenceLang = "";
  let inInline = false; // inside single backticks

  while (i < n) {
    // Detect start/end of fenced code blocks at line starts
    if (!inInline) {
      const lineStart = i === 0 || md[i - 1] === "\n";
      if (lineStart) {
        // Skip leading spaces for fence detection
        let j = i;
        while (j < n && (md[j] === ' ' || md[j] === '\t')) j++;
        if (!inFence && (md.startsWith("```", j) || md.startsWith("~~~", j))) {
          inFence = true;
          fenceMarker = md.startsWith("```", j) ? "```" : "~~~";
          const eol = md.indexOf("\n", j);
          const line = md.slice(i, eol === -1 ? n : eol);
          out += line;
          i += line.length;
          if (i < n && md[i] === "\n") { out += "\n"; i++; }
          continue;
        } else if (inFence && fenceMarker) {
          let k = j;
          if (md.startsWith(fenceMarker, k)) {
            const eol = md.indexOf("\n", k);
            const line = md.slice(i, eol === -1 ? n : eol);
            out += line;
            i += line.length;
            if (i < n && md[i] === "\n") { out += "\n"; i++; }
            inFence = false;
            fenceMarker = null;
            fenceLang = "";
            continue;
          }
        }
      }
    }

    // If inside fenced code block, just copy until next newline (handled above) or char-by-char
    if (inFence) {
      out += md[i++];
      continue;
    }

    // Handle inline code `...`
    if (md[i] === "`") {
      // Toggle inline, but support consecutive backticks like ``code`` by capturing the run
      let tickCount = 0;
      while (i + tickCount < n && md[i + tickCount] === "`") tickCount++;
      const delimiter = "`".repeat(tickCount);
      out += delimiter;
      i += tickCount;

      if (!inInline) {
        // enter inline with this exact delimiter
        inInline = delimiter;
      } else if (inInline === delimiter) {
        // exit inline
        inInline = false;
      }
      continue;
    }

    if (inInline) {
      // copy literally inside inline code
      out += md[i++];
      continue;
    }

    // Outside code: perform conversions.
    // Handle \\( ... \\) and \\[ ... \\]

    // Inline math: \( ... \)
    if (md.startsWith("\\(", i)) {
      i += 2;
      let buf = "";
      while (i < n && !md.startsWith("\\)", i)) {
        buf += md[i++];
      }
      const trimmed = buf.trim();
      out += "$" + trimmed + "$";
      if (i < n && md.startsWith("\\)", i)) {
        i += 2;
      }
      continue;
    }

    // Display math: \[ ... \]
    if (md.startsWith("\\[", i)) {
      i += 2;
      let buf = "";
      while (i < n && !md.startsWith("\\]", i)) {
        buf += md[i++];
      }
      const trimmed = buf.trim();
      out += "$$" + trimmed + "$$";
      if (i < n && md.startsWith("\\]", i)) {
        i += 2;
      }
      continue;
    }

    // Default: copy char
    out += md[i++];
  }

  return out;
}

async function processFile(filePath, write, quiet, forceStdout) {
  const src = fs.readFileSync(filePath, "utf8");
  const converted = convertMarkdown(src);
  if (write && !forceStdout) {
    fs.writeFileSync(filePath, converted);
    if (!quiet) console.log(`updated: ${filePath}`);
  } else {
    process.stdout.write(converted);
    if (!quiet) console.error(`converted: ${filePath}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) return printHelp();
  if (args.version) return printVersion();

  if (args.stdin) {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) chunks.push(chunk);
    const input = chunks.join("");
    const out = convertMarkdown(input);
    process.stdout.write(out);
    return;
  }

  if (args.paths.length === 0) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  for (const p of args.paths) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      // recursively process .md/.markdown files in directory
      const walk = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) walk(full);
          else if (/\.(md|markdown)$/i.test(e.name)) {
            processFile(full, args.write, args.quiet, args.stdout);
          }
        }
      };
      walk(p);
    } else if (stat.isFile()) {
      await processFile(p, args.write, args.quiet, args.stdout);
    }
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exitCode = 1;
});
