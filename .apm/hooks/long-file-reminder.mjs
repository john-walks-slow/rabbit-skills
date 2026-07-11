#!/usr/bin/env node
/**
 * postToolUse (Write | StrReplace) — remind agent to split/refactor when file > 750 lines.
 */
import { existsSync, readFileSync } from "node:fs";

const MAX_LINES = 500;

const input = JSON.parse(readFileSync(0, "utf8").replace(/^\uFEFF/, ""));
const { tool_name, tool_input } = input;

if (tool_name !== "Write" && tool_name !== "StrReplace") {
  console.log("{}");
  process.exit(0);
}

const filePath = tool_input?.path;
if (!filePath || !existsSync(filePath)) {
  console.log("{}");
  process.exit(0);
}

const lineCount = readFileSync(filePath, "utf8").split("\n").length;
if (lineCount <= MAX_LINES) {
  console.log("{}");
  process.exit(0);
}

const rel = filePath.replace(/\\/g, "/");
const msg =
  `File length reminder: \`${rel}\` has ${lineCount} lines (>${MAX_LINES}). ` +
  "When continuing work on this file, consider splitting it into smaller, focused modules.";

console.log(JSON.stringify({ additional_context: msg }));
process.exit(0);
