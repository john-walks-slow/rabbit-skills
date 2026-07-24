/**
 * Multi-owner wrap-up helpers for parent agents (plan + commit-each).
 * Never merges multiple owners into one auto commit.
 */
import { listOwnersIntersectingDiff, readLastActiveOwner } from "./resolve-owner.mjs";
import { runCommit } from "./commit.mjs";
import { ownCliCmd } from "./own-cli.mjs";

/** Default commit message template for plan / commit-each. */
export const DEFAULT_WRAPUP_MESSAGE = "chore(own): commit for {owner}";

/**
 * Short display id (UUID prefix or truncated).
 * @param {string} owner
 */
export function shortOwnerId(owner) {
  if (!owner) return "";
  const uuid = /^([0-9a-f]{8})-/i.exec(owner);
  if (uuid) return uuid[1];
  if (owner.length > 12) return owner.slice(0, 8);
  return owner;
}

/**
 * Replace {owner} {n} {short} in message template.
 * @param {string} template
 * @param {{ owner: string, n: number, short: string }} vars
 */
export function applyMessageTemplate(template, vars) {
  return template
    .replaceAll("{owner}", vars.owner)
    .replaceAll("{n}", String(vars.n))
    .replaceAll("{short}", vars.short);
}

/**
 * Build suggested CLI commit command for one owner.
 * @param {string} owner
 * @param {string} message
 */
export function suggestedCommitCmd(owner, message) {
  return `${ownCliCmd()} commit --owner ${owner} -m ${JSON.stringify(message)}`;
}

/**
 * Enrich ledger∩diff owners with short id + suggested commit command.
 * Stable schema for `owners --json` / `plan --json`.
 *
 * @param {string} root
 * @param {{ messageTemplate?: string }} [opts]
 * @returns {{
 *   owners: Array<{
 *     owner: string,
 *     short: string,
 *     lineCount: number,
 *     files: Array<{ path: string, lines: number[] }>,
 *     message: string,
 *     suggested_commit_cmd: string,
 *   }>,
 *   lastActive: { owner: string, updated_at: string } | null,
 *   count: number,
 *   messageTemplate: string,
 * }}
 */
export function buildOwnersWrapup(root, opts = {}) {
  const messageTemplate =
    typeof opts.messageTemplate === "string" && opts.messageTemplate
      ? opts.messageTemplate
      : DEFAULT_WRAPUP_MESSAGE;
  const candidates = listOwnersIntersectingDiff(root);
  const lastActive = readLastActiveOwner(root);
  const owners = candidates.map((c, i) => {
    const n = i + 1;
    const short = shortOwnerId(c.owner);
    const message = applyMessageTemplate(messageTemplate, {
      owner: c.owner,
      n,
      short,
    });
    return {
      owner: c.owner,
      short,
      lineCount: c.lineCount,
      files: c.files,
      message,
      suggested_commit_cmd: suggestedCommitCmd(c.owner, message),
    };
  });
  return {
    owners,
    lastActive,
    count: owners.length,
    messageTemplate,
  };
}

/**
 * Parent-agent wrap-up plan (one suggested command per owner).
 * @param {string} root
 * @param {{ messageTemplate?: string }} [opts]
 */
export function buildWrapupPlan(root, opts = {}) {
  return buildOwnersWrapup(root, opts);
}

/**
 * Serial per-owner commits. Default dry-run; real commits need --execute + -m template with {owner}.
 *
 * @param {string} root
 * @param {{
 *   message?: string,
 *   execute?: boolean,
 *   continueOnError?: boolean,
 *   json?: boolean,
 *   quiet?: boolean,
 * }} opts
 */
export async function runCommitEach(root, opts = {}) {
  const execute = !!opts.execute;
  const dryRun = !execute;
  const continueOnError = !!opts.continueOnError;
  const json = !!opts.json;
  const quiet = !!opts.quiet;

  const messageTemplate =
    typeof opts.message === "string" && opts.message
      ? opts.message
      : DEFAULT_WRAPUP_MESSAGE;

  if (execute) {
    if (typeof opts.message !== "string" || !opts.message.trim()) {
      throw Object.assign(
        new Error(
          "commit-each --execute requires -m / --message template (include {owner})",
        ),
        { code: 2 },
      );
    }
    if (!messageTemplate.includes("{owner}")) {
      throw Object.assign(
        new Error(
          'commit-each --execute message template must include "{owner}" so each commit is distinct',
        ),
        { code: 2 },
      );
    }
  }

  // Snapshot owner list once — do not re-scan mid-loop (identity must not drift).
  const plan = buildWrapupPlan(root, { messageTemplate });
  const total = plan.owners.length;

  /** @type {Array<{
   *   index: number,
   *   owner: string,
   *   short: string,
   *   lineCount: number,
   *   message: string,
   *   ok: boolean,
   *   error?: string,
   *   staged?: unknown,
   * }>} */
  const results = [];
  let stoppedEarly = false;

  if (total === 0) {
    const empty = {
      dryRun,
      execute,
      messageTemplate,
      count: 0,
      results: [],
      ok: true,
    };
    if (json) {
      process.stdout.write(`${JSON.stringify(empty, null, 2)}\n`);
    } else if (!quiet) {
      console.log("commit-each: no owners with ledger∩diff on current git changes");
    }
    return empty;
  }

  for (let i = 0; i < plan.owners.length; i++) {
    const step = plan.owners[i];
    const index = i + 1;
    if (!quiet) {
      process.stderr.write(
        `[${index}/${total}] owner=${step.owner} short=${step.short} lines=${step.lineCount}\n`,
      );
    }

    try {
      // Always one owner per commit — never merge identities.
      // quiet: parent owns progress + single JSON summary (no nested stdout).
      const out = await runCommit(root, [step.owner], {
        message: step.message,
        dryRun,
        quiet: true,
      });
      results.push({
        index,
        owner: step.owner,
        short: step.short,
        lineCount: step.lineCount,
        message: step.message,
        ok: true,
        staged: out?.staged,
      });
    } catch (err) {
      const e = /** @type {Error} */ (err);
      const entry = {
        index,
        owner: step.owner,
        short: step.short,
        lineCount: step.lineCount,
        message: step.message,
        ok: false,
        error: e.message,
      };
      results.push(entry);
      if (!quiet) {
        process.stderr.write(
          `error: [${index}/${total}] owner=${step.owner}: ${e.message}\n`,
        );
      }
      if (!continueOnError) {
        stoppedEarly = true;
        break;
      }
    }
  }

  const ok = results.every((r) => r.ok);
  const summary = {
    dryRun,
    execute,
    messageTemplate,
    count: total,
    completed: results.length,
    stoppedEarly,
    ok,
    results,
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else if (!quiet) {
    const mode = dryRun ? "dry-run" : "execute";
    console.log(
      `commit-each (${mode}): ${results.filter((r) => r.ok).length}/${total} ok` +
        (stoppedEarly ? " (stopped on error)" : ""),
    );
    for (const r of results) {
      const mark = r.ok ? "ok" : "FAIL";
      console.log(
        `  [${r.index}/${total}] ${mark}  ${r.owner}  ${r.message}`,
      );
    }
  }

  if (!ok) {
    throw Object.assign(
      new Error(
        stoppedEarly
          ? "commit-each stopped after first failure (use --continue-on-error to proceed)"
          : "commit-each finished with one or more failures",
      ),
      { code: 1, summary },
    );
  }

  return summary;
}
