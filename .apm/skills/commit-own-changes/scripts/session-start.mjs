/**
 * sessionStart hook — inject owner id + commit instructions.
 * own CLI path is derived from this file's location (works for project + global install).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHookStdinJson } from "./lib/stdin-json.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OWN_CLI = path.join(__dirname, "bin", "own.mjs");
/** Prefer forward slashes in agent-facing commands (Windows Node accepts them). */
const OWN_CMD = `node ${OWN_CLI.replace(/\\/g, "/")}`;

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", reject);
  });
}

async function main() {
  let payload = {};
  try {
    const raw = await readStdin();
    const parsed = parseHookStdinJson(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed;
    }
  } catch {
    payload = {};
  }

  const id =
    payload.conversation_id ||
    payload.session_id ||
    process.env.CURSOR_CONVERSATION_ID ||
    "";

  const additional_context = id
    ? [
        `Ownership: your owner id is ${id}.`,
        "After review passes, commit ONLY your lines with:",
        `  ${OWN_CMD} commit -m "<conventional message>"`,
        "Default path needs no --owner when you are the only agent with ledger∩diff.",
        "If multiple agents have uncommitted owned lines: own owners, then --owner <id>.",
        "Cloud without ledger / ambiguous: pass --owner explicitly.",
        "Do not git add -A. Same-line edits are last-writer-wins in the ledger.",
        "Do not use manual git-stage-lines (own.mjs is mandatory).",
      ].join("\n")
    : [
        "Ownership hooks active. Commit with:",
        `  ${OWN_CMD} commit -m "<msg>"`,
        "Auto-picks owner from ledger∩diff when unique; else whoami / owners / --owner.",
        "Do not use manual git-stage-lines.",
      ].join("\n");

  /** @type {Record<string, unknown>} */
  const out = { additional_context };
  if (id) {
    out.env = {
      FSX_OWNER_ID: id,
      CURSOR_CONVERSATION_ID: id,
    };
  }

  process.stdout.write(`${JSON.stringify(out)}\n`);
}

main().catch(() => {
  process.stdout.write(
    `${JSON.stringify({
      additional_context: `Ownership hooks active. Commit with: ${OWN_CMD} commit -m "<msg>". Do not use manual git-stage-lines. Use whoami / owners / --owner when multi-owner or cloud.`,
    })}\n`,
  );
});
