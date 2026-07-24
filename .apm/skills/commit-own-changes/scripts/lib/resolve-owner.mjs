import fs from "node:fs";
import path from "node:path";
import { ensureOwnershipDirs, ownershipPaths } from "./paths.mjs";
import { changedLinesForFile } from "./diff.mjs";
import { writeJsonAtomic } from "./atomic-write.mjs";

/**
 * @typedef {{ path: string, lines: number[] }} OwnerFileSummary
 * @typedef {{ owner: string, lineCount: number, files: OwnerFileSummary[] }} OwnerDiffSummary
 */

/**
 * Path of last-active-owner hint (not used for commit identity alone).
 * @param {string} root
 */
export function lastActiveOwnerPath(root) {
  return path.join(ownershipPaths(root).ownershipRoot, "meta", "last-active-owner.json");
}

/**
 * Best-effort hint after track-edit. Must not be sole commit identity.
 * @param {string} root
 * @param {string} ownerId
 */
export function recordLastActiveOwner(root, ownerId) {
  if (!ownerId) return;
  try {
    ensureOwnershipDirs(root);
    writeJsonAtomic(lastActiveOwnerPath(root), {
      version: 1,
      owner: ownerId,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore — fail-open
  }
}

/**
 * @param {string} root
 * @returns {{ owner: string, updated_at: string } | null}
 */
export function readLastActiveOwner(root) {
  try {
    const j = JSON.parse(fs.readFileSync(lastActiveOwnerPath(root), "utf8"));
    if (j && typeof j.owner === "string" && j.owner) {
      return {
        owner: j.owner,
        updated_at: typeof j.updated_at === "string" ? j.updated_at : "",
      };
    }
  } catch {
    // missing
  }
  return null;
}

/**
 * Scan file ledgers ∩ current git diff; group by owner.
 * Reuses the same line∩diff idea as intersectOwnerDiff / collectOwnerLines.
 * @param {string} root
 * @returns {OwnerDiffSummary[]}
 */
export function listOwnersIntersectingDiff(root) {
  ensureOwnershipDirs(root);
  const dir = ownershipPaths(root).ledgerDir;
  /** @type {Map<string, Map<string, Set<number>>>} owner → path → lines */
  const byOwner = new Map();
  /** @type {Map<string, Set<number>>} */
  const diffCache = new Map();

  /**
   * @param {string} rel
   * @returns {Set<number>}
   */
  function newLinesFor(rel) {
    let cached = diffCache.get(rel);
    if (cached) return cached;
    const { newLines, missing } = changedLinesForFile(root, rel);
    cached = missing ? new Set() : newLines;
    diffCache.set(rel, cached);
    return cached;
  }

  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      if (!j?.path || !j.lines || typeof j.lines !== "object") continue;
      const newLines = newLinesFor(j.path);
      if (newLines.size === 0) continue;

      for (const [k, v] of Object.entries(j.lines)) {
        if (!v || typeof v !== "object" || typeof v.owner !== "string" || !v.owner) {
          continue;
        }
        const line = Number(k);
        if (!Number.isFinite(line) || !newLines.has(line)) continue;

        let pathMap = byOwner.get(v.owner);
        if (!pathMap) {
          pathMap = new Map();
          byOwner.set(v.owner, pathMap);
        }
        let set = pathMap.get(j.path);
        if (!set) {
          set = new Set();
          pathMap.set(j.path, set);
        }
        set.add(line);
      }
    } catch {
      // skip corrupt ledger
    }
  }

  /** @type {OwnerDiffSummary[]} */
  const out = [];
  for (const [owner, pathMap] of byOwner) {
    /** @type {OwnerFileSummary[]} */
    const fileSummaries = [];
    let lineCount = 0;
    for (const [p, lines] of pathMap) {
      const arr = [...lines].sort((a, b) => a - b);
      fileSummaries.push({ path: p, lines: arr });
      lineCount += arr.length;
    }
    fileSummaries.sort((a, b) => a.path.localeCompare(b.path));
    out.push({ owner, lineCount, files: fileSummaries });
  }
  out.sort((a, b) => a.owner.localeCompare(b.owner));
  return out;
}

/**
 * Format multi-owner ambiguity for stderr.
 * @param {OwnerDiffSummary[]} candidates
 */
export function formatAmbiguousOwners(candidates) {
  const lines = [
    "error: multiple owners have uncommitted owned lines on the current diff.",
    "Refusing to guess. Pass --owner <id> (or set CURSOR_CONVERSATION_ID / FSX_OWNER_ID),",
    "or commit/stage other agents first. Candidates:",
  ];
  for (const c of candidates) {
    const paths = c.files
      .map((f) => `${f.path}[${f.lines.join(",")}]`)
      .join(" ");
    lines.push(`  ${c.owner}  ${c.lineCount} line(s)  ${paths}`);
  }
  // Lazy import path via own-cli would create a cycle; keep short generic hints.
  lines.push("Hint: own.mjs owners");
  lines.push("      own.mjs whoami --owner <id>");
  return lines.join("\n");
}

/**
 * Resolve primary owner id.
 * Priority: --owner flag → CURSOR_CONVERSATION_ID / FSX_OWNER_ID → auto ledger∩diff.
 *
 * @param {string} root
 * @param {{ owner?: string, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {{ owner: string, source: "flag" | "env" | "auto", candidates: OwnerDiffSummary[], lastActive: { owner: string, updated_at: string } | null }}
 */
export function resolvePrimaryOwner(root, opts = {}) {
  const env = opts.env ?? process.env;
  const flag =
    typeof opts.owner === "string" && opts.owner.trim() ? opts.owner.trim() : "";
  const envId =
    (typeof env.CURSOR_CONVERSATION_ID === "string" && env.CURSOR_CONVERSATION_ID.trim()) ||
    (typeof env.FSX_OWNER_ID === "string" && env.FSX_OWNER_ID.trim()) ||
    "";

  const candidates = listOwnersIntersectingDiff(root);
  const lastActive = readLastActiveOwner(root);

  if (flag) {
    return { owner: flag, source: "flag", candidates, lastActive };
  }
  if (envId) {
    return { owner: envId, source: "env", candidates, lastActive };
  }

  if (candidates.length === 0) {
    throw Object.assign(
      new Error(
        "no owned lines on the current git diff.\n" +
          "Edit files via the agent (hooks track ownership), or pass --owner <conversation_id>.\n" +
          "Check: hooks enabled, .agent-ownership/ledger, Output → Hooks.",
      ),
      { code: 2, reason: "none" },
    );
  }

  if (candidates.length > 1) {
    throw Object.assign(new Error(formatAmbiguousOwners(candidates)), {
      code: 2,
      reason: "ambiguous",
      candidates,
    });
  }

  return {
    owner: candidates[0].owner,
    source: "auto",
    candidates,
    lastActive,
  };
}

/**
 * Primary + optional --include-owners extras.
 * @param {string} root
 * @param {{ owner?: string, includeOwners?: string, env?: NodeJS.ProcessEnv, quiet?: boolean }} opts
 * @returns {{ owners: string[], primary: string, source: "flag" | "env" | "auto" }}
 */
export function resolveOwnersForCli(root, opts = {}) {
  const resolved = resolvePrimaryOwner(root, {
    owner: opts.owner,
    env: opts.env,
  });

  if (resolved.source === "auto" && !opts.quiet) {
    process.stderr.write(
      `using owner: ${resolved.owner} (auto from ledger∩diff)\n`,
    );
  }

  const owners = [resolved.owner];
  if (typeof opts.includeOwners === "string" && opts.includeOwners) {
    for (const id of opts.includeOwners.split(",")) {
      const t = id.trim();
      if (t && !owners.includes(t)) owners.push(t);
    }
  }
  return {
    owners,
    primary: resolved.owner,
    source: resolved.source,
  };
}
