import fs from "node:fs";
import path from "node:path";
import { ownershipPaths, ensureOwnershipDirs } from "./paths.mjs";

/**
 * @param {string} msg
 * @param {Record<string, unknown>} [extra]
 */
export function logWarn(msg, extra) {
  const line = extra ? `${msg} ${JSON.stringify(extra)}` : msg;
  console.error(`[agent-ownership] ${line}`);
}

/**
 * Append a JSONL event under .agent-ownership/logs (best-effort).
 * @param {string} root
 * @param {string} event
 * @param {Record<string, unknown>} [fields]
 */
export function logEvent(root, event, fields = {}) {
  try {
    ensureOwnershipDirs(root);
    const file = path.join(ownershipPaths(root).logsDir, "hook.jsonl");
    const rec = { ts: new Date().toISOString(), event, ...fields };
    fs.appendFileSync(file, `${JSON.stringify(rec)}\n`, "utf8");
  } catch {
    // ignore
  }
}
