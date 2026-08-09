#!/usr/bin/env node
/**
 * agents-md-loader — make Claude Code read AGENTS.md the way it reads CLAUDE.md.
 *
 * Two events, mirroring the official CLAUDE.md load semantics:
 *   - SessionStart (matcher: startup|clear|compact):
 *       inject every AGENTS.md on the path from the git root down to the
 *       working directory, root-first. Re-fires on "compact" so the
 *       instructions survive context compaction (PreCompact/PostCompact
 *       cannot inject context back — SessionStart(compact) is the only way).
 *       "resume" is intentionally excluded: the context is already loaded.
 *   - PreToolUse (matcher: Read|Edit|Write):
 *       when Claude touches a file in a subdirectory, inject any AGENTS.md
 *       on the path between that file and the working directory — once per
 *       directory per session (tracked in a temp state file). This is the
 *       on-demand nested-file behavior CLAUDE.md gets for free.
 *
 * Small files are inlined into context; files over MAX_INLINE_CHARS are
 * referenced with a preview and a Read instruction to save context.
 *
 * Output contract:
 *   {"hookSpecificOutput":{"hookEventName":"<event>","additionalContext":"..."}}
 * Prints "{}" when there is nothing to inject (exit 0 either way).
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname, basename, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const MAX_INLINE_CHARS = 6000; // inline content under this size; larger gets a Read pointer
const PREVIEW_CHARS = 600;    // preview length for oversized files
const SKIP_DIRS = new Set([
  ".git", "node_modules", "apm_modules", ".apm",
  "dist", "build", "target", ".next", ".venv",
  "__pycache__", ".turbo", ".cache", ".claude",
]);

// ---- stdin payload -------------------------------------------------------
let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  /* not JSON — treat as no-op */
}

const event = input.event;
const sessionId = String(input.session_id || "session").replace(/[^a-zA-Z0-9_-]/g, "_");
const cwd = resolve(input.cwd || process.cwd());

// ---- helpers -------------------------------------------------------------
function gitRoot(dir) {
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null; // not a git repo — fall back to filesystem root
  }
}

// ---- session state (per-session, tracks injected directories) ------------
function loadState() {
  const file = join(tmpdir(), `agents-md-${sessionId}.json`);
  try {
    return { file, dirs: new Set(JSON.parse(readFileSync(file, "utf8"))) };
  } catch {
    return { file, dirs: new Set() };
  }
}
function saveState(state) {
  try {
    writeFileSync(state.file, JSON.stringify([...state.dirs]));
  } catch {
    /* temp write failure is non-fatal */
  }
}

// ---- discovery -----------------------------------------------------------
// All AGENTS.md on the path from `start` up to `stop`, root-first.
function collectUpward(start, stop) {
  const found = [];
  let d = start;
  while (true) {
    const f = join(d, "AGENTS.md");
    if (existsSync(f)) found.push(f);
    if (stop && d === stop) break;
    const parent = dirname(d);
    if (parent === d) break; // reached filesystem root
    d = parent;
  }
  return found.reverse();
}

// AGENTS.md on the path from a file's directory up to `stop` (working dir),
// skipping directories already injected this session. Path can cross the
// working dir upward for --add-dir targets, so bound the walk at the git root.
// Returns root-first order (nearest directory last), matching CLAUDE.md's
// "closest file wins" loading.
function collectDownward(filePath, stop, state) {
  const target = resolve(cwd, filePath);
  if (!target.startsWith(cwd + sep) && target !== cwd) return { files: [], state };
  const found = [];
  const root = gitRoot(cwd) || stop;
  let d = dirname(target);
  while (true) {
    if (!SKIP_DIRS.has(basename(d))) {
      const f = join(d, "AGENTS.md");
      if (existsSync(f) && !state.dirs.has(d)) {
        found.push(f);
        state.dirs.add(d);
      }
    }
    if (d === stop) break;
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return { files: found.reverse(), state };
}

// ---- rendering -----------------------------------------------------------
function render(files) {
  const parts = [];
  for (const f of files) {
    let content;
    try {
      content = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    if (content.length <= MAX_INLINE_CHARS) {
      parts.push(`${f}:\n${content}`);
    } else {
      parts.push(
        `${f} (${content.length} chars) — Read this file for the full instructions before working in its directory.\n${content.slice(0, PREVIEW_CHARS)}…`,
      );
    }
  }
  if (parts.length === 0) return "";
  return `<agents-md>\n${parts.join("\n\n")}\n</agents-md>`;
}

function emit(context) {
  if (!context) {
    process.stdout.write("{}");
  } else {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: event,
          additionalContext: context,
        },
      }),
    );
  }
  process.exit(0);
}

// ---- dispatch ------------------------------------------------------------
if (event === "SessionStart") {
  const root = gitRoot(cwd);
  const files = collectUpward(cwd, root);
  // Mark the chain as injected so PreToolUse does not re-inject these later.
  const state = loadState();
  for (const f of files) state.dirs.add(dirname(f));
  saveState(state);
  emit(render(files));
} else if (event === "PreToolUse") {
  const fp = input.tool_input && (input.tool_input.file_path || input.tool_input.path);
  if (!fp) {
    emit("");
  } else {
    const state = loadState();
    const { files, state: next } = collectDownward(fp, cwd, state);
    saveState(next);
    emit(render(files));
  }
} else {
  emit(""); // unexpected event — never block the session
}
