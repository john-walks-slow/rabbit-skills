import fs from "node:fs";
import path from "node:path";
import { acquireGitLock } from "./lock.mjs";
import { stageForOwners, intersectOwnerDiff } from "./stage.mjs";
import { clearCommittedLines, gcFileLines } from "./ledger.mjs";
import { git } from "./diff.mjs";
import { ensureOwnershipDirs } from "./paths.mjs";

/**
 * @param {string} root
 * @param {string[]} owners
 * @param {{ message?: string, dryRun?: boolean, json?: boolean }} opts
 */
export async function runStatus(root, owners, opts = {}) {
  ensureOwnershipDirs(root);
  const { staged, warnings } = await stageForOwners(root, owners, {
    dryRun: true,
  });
  const result = {
    owners,
    files: staged,
    warnings,
    lineCount: staged.reduce((n, f) => n + f.lines.length, 0),
  };
  if (opts.json) {
    // Quiet for machine consumers; tests pass { json: true } without wanting console noise from commit path
    if (process.env.OWN_STATUS_PRINT !== "0") {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
  } else {
    console.log(`owners: ${owners.join(", ")}`);
    if (staged.length === 0) {
      console.log("nothing owned that intersects with current diff");
    } else {
      for (const f of staged) {
        console.log(`  ${f.path}  lines ${f.lines.join(",")}  (${f.method})`);
      }
    }
    for (const w of warnings) console.error(`warn: ${w}`);
  }
  return result;
}

/**
 * @param {string} root
 * @param {string[]} owners
 * @param {{ dryRun?: boolean, json?: boolean }} opts
 */
export async function runStage(root, owners, opts = {}) {
  ensureOwnershipDirs(root);
  const release = await acquireGitLock(root);
  try {
    if (!opts.dryRun) {
      git(root, ["restore", "--staged", "."]);
    }
    const result = await stageForOwners(root, owners, { dryRun: !!opts.dryRun });
    if (opts.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log(
        opts.dryRun
          ? `dry-run: would stage ${result.staged.length} file(s)`
          : `staged ${result.staged.length} file(s)`,
      );
      for (const f of result.staged) {
        console.log(`  ${f.path}  [${f.method}] lines ${f.lines.join(",")}`);
      }
      for (const w of result.warnings) console.error(`warn: ${w}`);
    }
    return result;
  } finally {
    release();
  }
}

/**
 * @param {string} root
 * @param {string[]} owners
 * @param {{ message: string, dryRun?: boolean, json?: boolean, quiet?: boolean }} opts
 */
export async function runCommit(root, owners, opts) {
  ensureOwnershipDirs(root);
  if (!opts.message && !opts.dryRun) {
    throw Object.assign(new Error("commit requires -m / --message"), { code: 2 });
  }

  const quiet = !!opts.quiet;
  const release = await acquireGitLock(root);
  try {
    if (opts.dryRun) {
      const preview = await stageForOwners(root, owners, { dryRun: true });
      const out = {
        dryRun: true,
        message: opts.message ?? "",
        staged: preview.staged,
        warnings: preview.warnings,
      };
      if (!quiet) {
        if (opts.json) process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
        else {
          console.log(`dry-run commit: ${opts.message ?? "(no message)"}`);
          for (const f of preview.staged) {
            console.log(`  ${f.path} lines ${f.lines.join(",")}`);
          }
        }
      }
      return out;
    }

    git(root, ["restore", "--staged", "."]);
    const result = await stageForOwners(root, owners, { dryRun: false });
    if (result.staged.length === 0) {
      throw Object.assign(new Error("nothing to commit for these owners"), {
        code: 1,
        warnings: result.warnings,
      });
    }

    const msgFile = path.join(root, ".agent-ownership", "COMMIT_MSG.tmp");
    fs.writeFileSync(msgFile, opts.message, "utf8");
    try {
      const r = git(root, ["commit", "-F", msgFile]);
      if (r.status !== 0) {
        throw new Error(`git commit failed: ${r.stderr || r.stdout}`);
      }
    } finally {
      try {
        fs.unlinkSync(msgFile);
      } catch {
        // ignore
      }
    }

    /** @type {Map<string, Set<number>>} */
    const committed = new Map();
    for (const f of result.staged) {
      committed.set(f.path, new Set(f.lines));
    }
    await clearCommittedLines(root, committed, owners);

    const out = {
      ok: true,
      staged: result.staged,
      warnings: result.warnings,
    };
    if (!quiet) {
      if (opts.json) process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
      else {
        console.log(
          `committed ${result.staged.length} file(s) for owner(s) ${owners.join(", ")}`,
        );
        for (const f of result.staged) {
          console.log(`  ${f.path}`);
        }
      }
    }
    return out;
  } finally {
    release();
  }
}

/**
 * GC stale ledger entries against current diffs for given owners.
 * @param {string} root
 * @param {string[]} owners
 */
export async function runGc(root, owners) {
  ensureOwnershipDirs(root);
  const inter = intersectOwnerDiff(root, owners);
  let cleared = 0;
  for (const [rel, lines] of inter.stale) {
    await gcFileLines(root, rel, lines);
    cleared += lines.size;
  }
  const out = { cleared, warnings: inter.warnings };
  console.log(`gc: cleared ${cleared} stale line(s)`);
  for (const w of inter.warnings) console.error(`warn: ${w}`);
  return out;
}
