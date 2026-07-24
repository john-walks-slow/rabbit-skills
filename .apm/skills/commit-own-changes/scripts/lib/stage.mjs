import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectOwnerLines, gcFileLines } from "./ledger.mjs";
import {
  changedLinesForFile,
  git,
  parseUnifiedDiffU0,
} from "./diff.mjs";
import { logWarn } from "./log.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve git-stage-lines binary from repo node_modules.
 * @param {string} root
 */
function gitStageLinesBin(root) {
  /** @type {string[]} */
  const candidates = [
    path.join(root, "node_modules", "git-stage-lines", "dist", "cli.mjs"),
    path.join(root, "node_modules", ".bin", "git-stage-lines"),
  ];
  // Walk up from this file (skill install may be under .agents/skills or .cursor/hooks/…)
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    candidates.push(
      path.join(dir, "node_modules", "git-stage-lines", "dist", "cli.mjs"),
    );
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Build git-stage-lines FILE:REFS for owned new-side lines.
 * Prefer exact refs (`FILE:-N,N`) over range mode (`FILE N --mode both`):
 * range mode expands contiguous rewrite hunks and stages neighbor lines.
 * Replacements need both -N (old delete) and N (new add).
 * @param {string} root
 * @param {string} rel
 * @param {Set<number>} ownedNewLines
 * @returns {string} e.g. "-2,2,-8,8"
 */
export function buildStageRefs(root, rel, ownedNewLines) {
  const d = git(root, ["diff", "-U0", "HEAD", "--", rel]);
  const { newLines, oldLines } = parseUnifiedDiffU0(d.stdout || "");
  /** @type {string[]} */
  const refs = [];
  for (const line of [...ownedNewLines].sort((a, b) => a - b)) {
    if (!newLines.has(line)) continue;
    // Pair old-side delete when same line number was replaced (1:1 rewrite)
    if (oldLines.has(line)) refs.push(`-${line}`);
    refs.push(String(line));
  }
  return refs.join(",");
}

/**
 * New-side line numbers currently staged for a path (index vs HEAD).
 * @param {string} root
 * @param {string} rel
 * @returns {Set<number>}
 */
export function stagedNewLinesForFile(root, rel) {
  const d = git(root, ["diff", "--cached", "-U0", "HEAD", "--", rel]);
  return parseUnifiedDiffU0(d.stdout || "").newLines;
}

/**
 * True when every staged new-side line is in ownedLines (no foreign over-stage).
 * @param {string} root
 * @param {string} rel
 * @param {Set<number>} ownedLines
 */
export function stagedOnlyOwned(root, rel, ownedLines) {
  const staged = stagedNewLinesForFile(root, rel);
  if (staged.size === 0) return false;
  for (const line of staged) {
    if (!ownedLines.has(line)) return false;
  }
  return true;
}

/**
 * Drop path from the index (leave working tree).
 * @param {string} root
 * @param {string} rel
 */
function unstagePath(root, rel) {
  git(root, ["restore", "--staged", "--", rel]);
}

/**
 * Intersect owner ledger lines with current git diff.
 * @param {string} root
 * @param {string[]} owners
 * @returns {{ toStage: Map<string, Set<number>>, stale: Map<string, Set<number>>, warnings: string[] }}
 */
export function intersectOwnerDiff(root, owners) {
  const owned = collectOwnerLines(root, owners);
  /** @type {Map<string, Set<number>>} */
  const toStage = new Map();
  /** @type {Map<string, Set<number>>} */
  const stale = new Map();
  /** @type {string[]} */
  const warnings = [];

  for (const [rel, lineSet] of owned) {
    const { newLines, untracked, missing } = changedLinesForFile(root, rel);
    if (missing) {
      stale.set(rel, new Set(lineSet));
      warnings.push(`missing file, clearing ledger: ${rel}`);
      continue;
    }

    /** @type {Set<number>} */
    const inter = new Set();
    /** @type {Set<number>} */
    const staleLines = new Set();

    for (const line of lineSet) {
      if (newLines.has(line)) inter.add(line);
      else staleLines.add(line);
    }

    if (staleLines.size > 0) {
      stale.set(rel, staleLines);
      warnings.push(
        `stale ledger lines (no longer in diff) for ${rel}: ${[...staleLines].sort((a, b) => a - b).join(",")}`,
      );
    }

    if (untracked) {
      // MVP: stage whole file only if ALL file lines are owned by these owners
      // (newLines is 1..N; inter must equal newLines)
      if (inter.size === newLines.size && newLines.size > 0) {
        toStage.set(rel, inter);
      } else if (inter.size > 0) {
        // partial ownership of untracked — still stage owned lines via full add only if all owned
        // if not all, skip partial untracked (cannot partial-add new file easily)
        warnings.push(`untracked file not fully owned, skip: ${rel}`);
      }
      continue;
    }

    if (inter.size > 0) {
      toStage.set(rel, inter);
    }
  }

  return { toStage, stale, warnings };
}

/**
 * Stage lines for owners. Caller must hold git lock and have cleared index if desired.
 * @param {string} root
 * @param {string[]} owners
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function stageForOwners(root, owners, opts = {}) {
  const { toStage, stale, warnings } = intersectOwnerDiff(root, owners);

  // clean stale ledger entries
  for (const [rel, lines] of stale) {
    if (!opts.dryRun) {
      await gcFileLines(root, rel, lines);
    }
  }

  /** @type {Array<{ path: string, lines: number[], method: string }>} */
  const staged = [];

  for (const [rel, lineSet] of toStage) {
    const { newLines, untracked } = changedLinesForFile(root, rel);
    const allOwned =
      newLines.size > 0 &&
      [...newLines].every((l) => lineSet.has(l)) &&
      lineSet.size >= newLines.size;

    if (opts.dryRun) {
      staged.push({
        path: rel,
        lines: [...lineSet].sort((a, b) => a - b),
        method: allOwned || untracked ? "git-add" : "git-stage-lines",
      });
      continue;
    }

    if (allOwned || untracked) {
      const r = git(root, ["add", "--", rel]);
      if (r.status !== 0) {
        warnings.push(`git add failed for ${rel}: ${r.stderr}`);
        continue;
      }
      staged.push({
        path: rel,
        lines: [...lineSet].sort((a, b) => a - b),
        method: "git-add",
      });
      continue;
    }

    // Prefer FILE:REFS (-N,N) so replacements stage only owned lines (range mode can
    // expand a contiguous rewrite hunk and stage every neighbor line).
    const refs = buildStageRefs(root, rel, lineSet);
    if (!refs) {
      warnings.push(`stage failed for ${rel}: empty refs for owned lines`);
      continue;
    }

    const bin = gitStageLinesBin(root);
    let ok = false;
    let method = "git-stage-lines";

    if (bin) {
      const r = spawnSync(
        process.execPath,
        [bin, `${rel}:${refs}`, "--json"],
        {
          cwd: root,
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
          windowsHide: true,
        },
      );
      if (r.status === 0) {
        if (stagedOnlyOwned(root, rel, lineSet)) {
          ok = true;
        } else {
          // Over-stage (e.g. accidental range mode / tool bug): discard and fall back.
          logWarn("git-stage-lines over-staged foreign lines; unstaging", {
            rel,
            refs,
            owned: [...lineSet],
            staged: [...stagedNewLinesForFile(root, rel)],
          });
          unstagePath(root, rel);
        }
      } else {
        logWarn("git-stage-lines failed", {
          rel,
          refs,
          stderr: r.stderr,
          stdout: r.stdout,
        });
      }
    }

    if (!ok) {
      ok = stageViaApplyCached(root, rel, lineSet);
      method = "apply-cached";
      if (ok && !stagedOnlyOwned(root, rel, lineSet)) {
        logWarn("apply-cached over-staged foreign lines; unstaging", {
          rel,
          owned: [...lineSet],
          staged: [...stagedNewLinesForFile(root, rel)],
        });
        unstagePath(root, rel);
        ok = false;
      }
    }

    if (!ok) {
      warnings.push(
        `stage failed for ${rel}: git-stage-lines missing/failed and apply fallback failed (refs=${refs})`,
      );
      continue;
    }

    staged.push({
      path: rel,
      lines: [...lineSet].sort((a, b) => a - b),
      method,
    });
  }

  return { staged, warnings, toStage };
}

/**
 * Fallback: build a minimal unified patch for owned new-side lines and
 * `git apply --cached --unidiff-zero`.
 * @param {string} root
 * @param {string} rel
 * @param {Set<number>} ownedLines
 */
function stageViaApplyCached(root, rel, ownedLines) {
  const { newLines } = changedLinesForFile(root, rel);
  if (newLines.size > 0 && [...newLines].every((l) => ownedLines.has(l))) {
    const r = git(root, ["add", "--", rel]);
    return r.status === 0;
  }

  // For each owned new line that is a 1:1 replacement, emit a single-line hunk.
  const abs = path.join(root, ...rel.split("/"));
  let headText = "";
  const show = git(root, ["show", `HEAD:${rel}`]);
  if (show.status === 0) headText = show.stdout;
  else return false;

  let workText;
  try {
    workText = fs.readFileSync(abs, "utf8");
  } catch {
    return false;
  }

  const headLines = headText.split(/\r?\n/);
  if (headLines.length > 0 && headLines[headLines.length - 1] === "") {
    headLines.pop();
  }
  const workLines = workText.split(/\r?\n/);
  if (workLines.length > 0 && workLines[workLines.length - 1] === "") {
    workLines.pop();
  }

  /** @type {string[]} */
  const hunks = [];
  for (const line of [...ownedLines].sort((a, b) => a - b)) {
    if (!newLines.has(line)) continue;
    const oldContent = headLines[line - 1];
    const newContent = workLines[line - 1];
    if (oldContent === undefined || newContent === undefined) continue;
    if (oldContent === newContent) continue;
    // unidiff-zero single-line replace
    hunks.push(
      `@@ -${line},1 +${line},1 @@\n-${oldContent}\n+${newContent}`,
    );
  }

  if (hunks.length === 0) return false;

  const patch = [
    `diff --git a/${rel} b/${rel}`,
    `--- a/${rel}`,
    `+++ b/${rel}`,
    ...hunks,
    "",
  ].join("\n");

  const patchFile = path.join(
    root,
    ".agent-ownership",
    `stage-patch.${process.pid}.${Date.now()}.diff`,
  );
  try {
    fs.mkdirSync(path.dirname(patchFile), { recursive: true });
    fs.writeFileSync(patchFile, patch, "utf8");
    const r = git(root, [
      "apply",
      "--cached",
      "--unidiff-zero",
      "--whitespace=nowarn",
      patchFile,
    ]);
    return r.status === 0;
  } finally {
    try {
      fs.unlinkSync(patchFile);
    } catch {
      // ignore
    }
  }
}
