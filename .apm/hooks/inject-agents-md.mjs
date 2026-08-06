#!/usr/bin/env node
/**
 * SessionStart — discover AGENTS.md files in the project and inject them
 * as session context with a reminder to read the relevant ones before work.
 *
 * Output contract:
 *   {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}
 * When no AGENTS.md files exist, outputs "{}" so the session continues normally.
 */
import { readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const MAX_DEPTH = 4;
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "apm_modules",
  ".apm",
  "dist",
  "build",
  "target",
  ".next",
  ".venv",
  "__pycache__",
]);

function findAgentsMd(dir, depth) {
  if (depth > MAX_DEPTH) return [];
  const found = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isFile() && entry === "AGENTS.md") {
      found.push(full.replaceAll(sep, "/"));
    } else if (st.isDirectory()) {
      found.push(...findAgentsMd(full, depth + 1));
    }
  }
  return found;
}

const files = findAgentsMd(process.cwd(), 0).sort();
if (files.length === 0) {
  process.stdout.write("{}");
  process.exit(0);
}

const list = files.map((f) => `  - ${f}`).join("\n");
const context =
  "AGENTS.md files in this project (per project convention, read these before doing related work):\n" +
  list;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  }),
);
process.exit(0);
