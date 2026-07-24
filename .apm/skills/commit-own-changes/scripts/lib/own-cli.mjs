import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute path to bin/own.mjs (sibling of lib/).
 * @returns {string}
 */
export function ownCliPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "own.mjs");
}

/**
 * Agent-facing command prefix: `node <abs/path/to/own.mjs>`
 * @returns {string}
 */
export function ownCliCmd() {
  return `node ${ownCliPath().replace(/\\/g, "/")}`;
}
