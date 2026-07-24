import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** @type {readonly string[]} */
export const DEFAULT_IGNORE_PREFIXES = [
  ".git/",
  ".agent-ownership/",
  "node_modules/",
  ".fsx/",
];

/**
 * @param {string} root
 * @returns {{ root: string, ownershipRoot: string, ledgerDir: string, ownersDir: string, logsDir: string, gitLockPath: string }}
 */
export function ownershipPaths(root) {
  const ownershipRoot = path.join(root, ".agent-ownership");
  return {
    root,
    ownershipRoot,
    ledgerDir: path.join(ownershipRoot, "ledger", "by-file"),
    ownersDir: path.join(ownershipRoot, "meta", "owners"),
    logsDir: path.join(ownershipRoot, "logs"),
    gitLockPath: path.join(ownershipRoot, "git.lock"),
  };
}

/**
 * @param {string} p
 * @returns {string}
 */
export function toForwardSlash(p) {
  return p.replace(/\\/g, "/");
}

/**
 * @param {string} posixRelPath
 * @returns {string}
 */
export function fileLedgerId(posixRelPath) {
  return createHash("sha256").update(posixRelPath).digest("hex").slice(0, 16);
}

/**
 * @param {string} root
 * @param {string} posixRelPath
 * @returns {string}
 */
export function fileLedgerPath(root, posixRelPath) {
  return path.join(ownershipPaths(root).ledgerDir, `${fileLedgerId(posixRelPath)}.json`);
}

/**
 * @param {string} root
 * @param {string} ownerId
 * @returns {string}
 */
export function ownerIndexPath(root, ownerId) {
  const safe = ownerId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(ownershipPaths(root).ownersDir, `${safe}.json`);
}

/**
 * Normalize paths Cursor may send:
 * - Unix-style Windows drive: `/x:/Coding/fsx` → `x:\Coding\fsx` (via resolve)
 * - Mixed separators
 * @param {string} p
 * @returns {string}
 */
export function normalizeFsPath(p) {
  if (typeof p !== "string" || !p) return p;
  let s = p.replace(/\\/g, "/");
  // `/x:/foo` or `/x:` only — Cursor workspace_roots on Windows
  const m = s.match(/^\/([A-Za-z]):(?:\/(.*))?$/);
  if (m) {
    const drive = m[1];
    const rest = m[2] ?? "";
    s = `${drive}:/${rest}`;
  }
  return path.resolve(s);
}

/**
 * @param {string} absPath
 * @param {string[]} workspaceRoots
 * @returns {string | null} repo-relative forward-slash path, or null if outside
 */
export function toRepoRelative(absPath, workspaceRoots) {
  const resolved = normalizeFsPath(absPath);
  for (const root of workspaceRoots) {
    const rootAbs = normalizeFsPath(root);
    const rel = path.relative(rootAbs, resolved);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) continue;
    return toForwardSlash(rel);
  }
  return null;
}

/**
 * @param {string} posixRelPath
 * @param {readonly string[]} [ignorePrefixes]
 * @returns {boolean}
 */
export function isIgnoredPath(posixRelPath, ignorePrefixes = DEFAULT_IGNORE_PREFIXES) {
  const p = posixRelPath.replace(/^\/+/, "");
  if (!p || p === ".") return true;
  for (const prefix of ignorePrefixes) {
    if (p === prefix.slice(0, -1) || p.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Ensure ownership dirs exist.
 * @param {string} root
 */
export function ensureOwnershipDirs(root) {
  const p = ownershipPaths(root);
  fs.mkdirSync(p.ledgerDir, { recursive: true });
  fs.mkdirSync(p.ownersDir, { recursive: true });
  fs.mkdirSync(p.logsDir, { recursive: true });
}

/**
 * Resolve project root for ledger placement.
 * Prefer workspace_roots first: Cursor often runs project hooks with cwd =
 * user config dir (e.g. ~/.cursor), not the git workspace.
 * @param {{ workspace_roots?: string[] }} payload
 * @returns {string}
 */
export function resolveProjectRoot(payload = {}) {
  const roots = payload.workspace_roots;
  if (Array.isArray(roots) && roots.length > 0 && typeof roots[0] === "string") {
    return normalizeFsPath(roots[0]);
  }
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, ".git")) || fs.existsSync(path.join(cwd, "package.json"))) {
    return cwd;
  }
  return cwd;
}
