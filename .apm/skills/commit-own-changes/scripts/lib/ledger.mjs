import fs from "node:fs";
import path from "node:path";
import {
  ensureOwnershipDirs,
  fileLedgerPath,
  ownerIndexPath,
  toForwardSlash,
} from "./paths.mjs";
import { acquireLock, fileLockPath, ownerLockPath } from "./lock.mjs";
import { mapOneEdit, mapDeleteWithPreText, lineCount, normalizeEol } from "./map-edits.mjs";
import { writeJsonAtomic } from "./atomic-write.mjs";
import { logEvent, logWarn } from "./log.mjs";

/**
 * @typedef {{ owner: string, generation_id?: string, updated_at: string, source: "afterFileEdit" | "manual" }} LineOwner
 * @typedef {{ version: 1, path: string, updated_at: string, lines: Record<string, LineOwner> }} FileLedger
 * @typedef {{ version: 1, owner: string, updated_at: string, files: string[] }} OwnerIndex
 */

/**
 * @param {string} filePath
 * @param {string | object} data already-serialized JSON text, or object
 */
export function atomicWriteJson(filePath, data) {
  if (typeof data === "string") {
    writeJsonAtomic(filePath, JSON.parse(data));
    return;
  }
  writeJsonAtomic(filePath, data);
}

/**
 * @param {string} root
 * @param {string} posixRelPath
 * @returns {FileLedger}
 */
export function loadFileLedger(root, posixRelPath) {
  const fp = fileLedgerPath(root, posixRelPath);
  try {
    const raw = fs.readFileSync(fp, "utf8");
    const j = JSON.parse(raw);
    if (j && j.version === 1 && j.lines && typeof j.lines === "object") {
      return /** @type {FileLedger} */ (j);
    }
  } catch {
    // missing or corrupt → empty
  }
  return {
    version: 1,
    path: toForwardSlash(posixRelPath),
    updated_at: new Date().toISOString(),
    lines: {},
  };
}

/**
 * @param {string} root
 * @param {FileLedger} ledger
 */
export function saveFileLedger(root, ledger) {
  ledger.updated_at = new Date().toISOString();
  const fp = fileLedgerPath(root, ledger.path);
  atomicWriteJson(fp, `${JSON.stringify(ledger, null, 2)}\n`);
}

/**
 * Apply line-number transform for one mapped edit (plan §5.3).
 * @param {Record<string, LineOwner>} lines
 * @param {{ oldStart: number, oldEnd: number, newStart: number, newEnd: number }} mapped
 * @param {LineOwner} entry
 */
export function applyMappedEdit(lines, mapped, entry) {
  const { oldStart, oldEnd, newStart, newEnd } = mapped;
  const oldLen = oldEnd >= oldStart ? oldEnd - oldStart + 1 : 0;
  const newLen = newEnd >= newStart ? newEnd - newStart + 1 : 0;
  const delta = newLen - oldLen;

  /** @type {Record<string, LineOwner>} */
  const next = {};

  for (const [k, v] of Object.entries(lines)) {
    const line = Number(k);
    if (!Number.isFinite(line)) continue;
    if (oldLen > 0 && line >= oldStart && line <= oldEnd) {
      continue; // drop old range
    }
    let nl = line;
    if (oldLen === 0) {
      // pure insert: shift lines at/after insert point
      if (line >= newStart) nl = line + delta;
    } else if (line > oldEnd) {
      nl = line + delta;
    }
    if (nl >= 1) next[String(nl)] = v;
  }

  if (newLen > 0) {
    for (let line = newStart; line <= newEnd; line++) {
      next[String(line)] = { ...entry };
    }
  }

  return next;
}

/**
 * Mark entire file (1..N) as owned — for new file / Write full content.
 * @param {FileLedger} ledger
 * @param {number} lineCount
 * @param {LineOwner} entry
 */
export function claimAllLines(ledger, lineCount, entry) {
  /** @type {Record<string, LineOwner>} */
  const lines = {};
  for (let i = 1; i <= lineCount; i++) {
    lines[String(i)] = { ...entry };
  }
  ledger.lines = lines;
}

/**
 * @param {string} root
 * @param {string} ownerId
 * @returns {OwnerIndex}
 */
export function loadOwnerIndex(root, ownerId) {
  const fp = ownerIndexPath(root, ownerId);
  try {
    const j = JSON.parse(fs.readFileSync(fp, "utf8"));
    if (j && j.version === 1 && Array.isArray(j.files)) {
      return /** @type {OwnerIndex} */ (j);
    }
  } catch {
    // empty
  }
  return {
    version: 1,
    owner: ownerId,
    updated_at: new Date().toISOString(),
    files: [],
  };
}

/**
 * @param {string} root
 * @param {string} ownerId
 * @param {string} posixRelPath
 */
export async function addOwnerFile(root, ownerId, posixRelPath) {
  const lockP = ownerLockPath(root, ownerId);
  const release = await acquireLock(lockP, { retries: 30 });
  try {
    const idx = loadOwnerIndex(root, ownerId);
    const p = toForwardSlash(posixRelPath);
    if (!idx.files.includes(p)) {
      idx.files.push(p);
      idx.files.sort();
    }
    idx.updated_at = new Date().toISOString();
    atomicWriteJson(ownerIndexPath(root, ownerId), `${JSON.stringify(idx, null, 2)}\n`);
  } finally {
    release();
  }
}

/**
 * Apply afterFileEdit to ledger for one file.
 * @param {object} args
 * @param {string} args.root
 * @param {string} args.posixRelPath
 * @param {string} args.text post-edit content
 * @param {Array<{ old_string?: string, new_string?: string }>} args.edits
 * @param {string} args.owner
 * @param {string} [args.generation_id]
 * @param {string} [args.preText] optional pre-edit text for pure deletes
 */
export async function applyEditsToLedger(args) {
  const {
    root,
    posixRelPath,
    text,
    edits,
    owner,
    generation_id,
    preText,
  } = args;

  ensureOwnershipDirs(root);
  const fp = fileLedgerPath(root, posixRelPath);
  const release = await acquireLock(fileLockPath(fp));

  try {
    const ledger = loadFileLedger(root, posixRelPath);
    const now = new Date().toISOString();
    /** @type {LineOwner} */
    const entry = {
      owner,
      updated_at: now,
      source: "afterFileEdit",
    };
    if (generation_id) entry.generation_id = generation_id;

    // Normalize once: the file body may be CRLF (core.autocrlf) while the
    // Cursor edit payload is LF. Compare on a single normalized view so the
    // full-write claim path matches the same content the map functions see.
    const textNorm = normalizeEol(text);
    const preTextNorm = preText != null ? normalizeEol(preText) : undefined;

    // Full-file write: single edit that replaces entire content or empty old
    if (edits.length === 1) {
      const e = edits[0];
      const oldS = normalizeEol(e.old_string ?? "");
      const newS = normalizeEol(e.new_string ?? "");
      if (oldS === "" && newS === textNorm) {
        const n = lineCount(textNorm);
        claimAllLines(ledger, n, entry);
        saveFileLedger(root, ledger);
        await addOwnerFile(root, owner, posixRelPath);
        return { ok: true, claimedAll: true };
      }
    }

    let lines = { ...ledger.lines };
    for (const edit of edits) {
      const newS = edit.new_string ?? "";
      const oldS = edit.old_string ?? "";
      let mapped;
      if (newS === "" && oldS !== "" && preTextNorm != null) {
        mapped = mapDeleteWithPreText(preTextNorm, textNorm, oldS);
      } else {
        mapped = mapOneEdit(textNorm, edit);
      }
      if (mapped.skipped) {
        logEvent(root, mapped.reason ?? "map_miss", {
          path: posixRelPath,
          owner,
        });
        continue;
      }
      if (mapped.ambiguous) {
        logEvent(root, "map_ambiguous", { path: posixRelPath, owner });
      }
      lines = applyMappedEdit(lines, mapped, entry);
    }

    ledger.lines = lines;
    saveFileLedger(root, ledger);
    await addOwnerFile(root, owner, posixRelPath);
    return { ok: true };
  } finally {
    release();
  }
}

/**
 * Merge line set into path map.
 * @param {Map<string, Set<number>>} byPath
 * @param {string} rel
 * @param {number} line
 */
function addLine(byPath, rel, line) {
  let set = byPath.get(rel);
  if (!set) {
    set = new Set();
    byPath.set(rel, set);
  }
  set.add(line);
}

/**
 * Collect line sets for one or more owners.
 * Uses owner index first; falls back to full by-file scan when index empty or yields no lines.
 * @param {string} root
 * @param {string[]} owners
 * @returns {Map<string, Set<number>>} path → lines
 */
export function collectOwnerLines(root, owners) {
  /** @type {Map<string, Set<number>>} */
  const byPath = new Map();
  const ownerSet = new Set(owners);

  for (const owner of owners) {
    const idx = loadOwnerIndex(root, owner);
    let foundAny = false;

    if (idx.files.length > 0) {
      for (const rel of idx.files) {
        const ledger = loadFileLedger(root, rel);
        for (const [k, v] of Object.entries(ledger.lines)) {
          if (!ownerSet.has(v.owner)) continue;
          const line = Number(k);
          if (!Number.isFinite(line)) continue;
          addLine(byPath, rel, line);
          foundAny = true;
        }
      }
    }

    if (!foundAny) {
      const scanned = scanOwnerLines(root, owner);
      for (const [rel, lines] of scanned) {
        for (const line of lines) addLine(byPath, rel, line);
      }
    }
  }
  return byPath;
}

/**
 * Remove specific lines from ledgers after commit; prune empty owner files.
 * @param {string} root
 * @param {Map<string, Set<number>>} committed path → lines
 * @param {string[]} owners
 */
export async function clearCommittedLines(root, committed, owners) {
  for (const [rel, lineSet] of committed) {
    const fp = fileLedgerPath(root, rel);
    const release = await acquireLock(fileLockPath(fp));
    try {
      const ledger = loadFileLedger(root, rel);
      for (const line of lineSet) {
        delete ledger.lines[String(line)];
      }
      // also drop any line owned by these owners that is in set
      for (const [k, v] of Object.entries(ledger.lines)) {
        if (owners.includes(v.owner) && lineSet.has(Number(k))) {
          delete ledger.lines[k];
        }
      }
      if (Object.keys(ledger.lines).length === 0) {
        try {
          fs.unlinkSync(fp);
        } catch {
          // ignore
        }
      } else {
        saveFileLedger(root, ledger);
      }
    } finally {
      release();
    }
  }

  // prune owner index files that no longer have lines
  for (const owner of owners) {
    const byPath = collectOwnerLines(root, [owner]);
    const remaining = [...byPath.keys()];
    const release = await acquireLock(ownerLockPath(root, owner));
    try {
      const idx = loadOwnerIndex(root, owner);
      idx.files = remaining.sort();
      idx.updated_at = new Date().toISOString();
      atomicWriteJson(ownerIndexPath(root, owner), `${JSON.stringify(idx, null, 2)}\n`);
    } finally {
      release();
    }
  }
}

/**
 * GC: remove ledger lines listed as stale (no longer present in git diff).
 * @param {string} root
 * @param {string} posixRelPath
 * @param {Set<number>} staleLines line numbers to drop from the file ledger
 */
export async function gcFileLines(root, posixRelPath, staleLines) {
  const fp = fileLedgerPath(root, posixRelPath);
  const release = await acquireLock(fileLockPath(fp));
  try {
    const ledger = loadFileLedger(root, posixRelPath);
    let changed = false;
    for (const line of staleLines) {
      if (ledger.lines[String(line)]) {
        delete ledger.lines[String(line)];
        changed = true;
      }
    }
    if (changed) {
      if (Object.keys(ledger.lines).length === 0) {
        try {
          fs.unlinkSync(fp);
        } catch {
          // ignore
        }
      } else {
        saveFileLedger(root, ledger);
      }
    }
    return changed;
  } finally {
    release();
  }
}

/**
 * List all ledger files and scan (fallback if owner index missing).
 * @param {string} root
 * @param {string} owner
 * @returns {Map<string, Set<number>>}
 */
export function scanOwnerLines(root, owner) {
  ensureOwnershipDirs(root);
  const dir = path.join(root, ".agent-ownership", "ledger", "by-file");
  /** @type {Map<string, Set<number>>} */
  const byPath = new Map();
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return byPath;
  }
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      if (!j?.path || !j.lines) continue;
      for (const [k, v] of Object.entries(j.lines)) {
        if (v?.owner !== owner) continue;
        const line = Number(k);
        let set = byPath.get(j.path);
        if (!set) {
          set = new Set();
          byPath.set(j.path, set);
        }
        set.add(line);
      }
    } catch {
      logWarn("skip corrupt ledger", { file: f });
    }
  }
  return byPath;
}
