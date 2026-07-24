import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} root
 * @param {string[]} args
 * @returns {{ status: number | null, stdout: string, stderr: string }}
 */
export function git(root, args) {
  const r = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

/**
 * Parse `git diff -U0 -- path` for changed new-side line numbers (and old-side deletes).
 * Returns working-tree (new file) line numbers that are part of the change.
 *
 * @param {string} diffText
 * @returns {{ newLines: Set<number>, oldLines: Set<number> }}
 */
export function parseUnifiedDiffU0(diffText) {
  /** @type {Set<number>} */
  const newLines = new Set();
  /** @type {Set<number>} */
  const oldLines = new Set();

  const lines = diffText.split(/\r?\n/);
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      // @@ -l,s +l,s @@
      const m = line.match(/@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (!m) continue;
      oldLine = Number(m[1]);
      newLine = Number(m[3]);
      const oldCount = m[2] !== undefined ? Number(m[2]) : 1;
      const newCount = m[4] !== undefined ? Number(m[4]) : 1;
      // For pure delete hunks, new count may be 0 — newLine still points to insertion point
      void oldCount;
      void newCount;
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index ")) {
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      newLines.add(newLine);
      newLine += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      oldLines.add(oldLine);
      oldLine += 1;
      continue;
    }
    if (line.startsWith(" ") || line === "") {
      // context (shouldn't appear much with -U0) or empty
      if (line.startsWith(" ")) {
        oldLine += 1;
        newLine += 1;
      }
    }
  }

  return { newLines, oldLines };
}

/**
 * Get changed new-side lines for a path (working tree vs index/HEAD).
 * Untracked: all lines 1..N.
 *
 * @param {string} root
 * @param {string} posixRelPath
 * @returns {{ newLines: Set<number>, untracked: boolean, missing: boolean }}
 */
export function changedLinesForFile(root, posixRelPath) {
  const abs = path.join(root, ...posixRelPath.split("/"));
  if (!fs.existsSync(abs)) {
    return { newLines: new Set(), untracked: false, missing: true };
  }

  // untracked?
  const check = git(root, ["ls-files", "--error-unmatch", "--", posixRelPath]);
  if (check.status !== 0) {
    const text = fs.readFileSync(abs, "utf8");
    // Match map-edits / ledger lineCount (wc -l style)
    let n = 0;
    if (text !== "") {
      for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) === 10) n += 1;
      }
      if (!text.endsWith("\n")) n += 1;
    }
    /** @type {Set<number>} */
    const all = new Set();
    for (let i = 1; i <= n; i++) all.add(i);
    return { newLines: all, untracked: true, missing: false };
  }

  const d = git(root, ["diff", "-U0", "--", posixRelPath]);
  // also include staged? For own commit we restore --staged first, so only WT vs HEAD/index
  // After restore --staged, diff is WT vs HEAD. Use both unstaged:
  const d2 = git(root, ["diff", "-U0", "HEAD", "--", posixRelPath]);
  const text = (d2.stdout || d.stdout) || "";
  const { newLines } = parseUnifiedDiffU0(text);
  return { newLines, untracked: false, missing: false };
}

/**
 * Merge consecutive numbers into range strings "a-b" or "a".
 * @param {Iterable<number>} lines
 * @returns {string[]}
 */
export function mergeRanges(lines) {
  const sorted = [...lines].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  /** @type {string[]} */
  const ranges = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i];
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    ranges.push(start === prev ? String(start) : `${start}-${prev}`);
    start = n;
    prev = n;
  }
  ranges.push(start === prev ? String(start) : `${start}-${prev}`);
  return ranges;
}
