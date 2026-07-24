#!/usr/bin/env node
/**
 * CLI: status | stage | commit | gc | whoami | owners | plan | commit-each
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runStatus, runStage, runCommit, runGc } from "../lib/commit.mjs";
import {
  listOwnersIntersectingDiff,
  resolvePrimaryOwner,
  resolveOwnersForCli,
  readLastActiveOwner,
} from "../lib/resolve-owner.mjs";
import {
  buildOwnersWrapup,
  buildWrapupPlan,
  runCommitEach,
  DEFAULT_WRAPUP_MESSAGE,
} from "../lib/wrapup.mjs";
import { ownCliCmd } from "../lib/own-cli.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SELF = ownCliCmd();

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0];
  /** @type {Record<string, string | boolean>} */
  const opts = {};
  /** @type {string[]} */
  const positional = [];
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") opts.json = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--execute") opts.execute = true;
    else if (a === "--continue-on-error") opts.continueOnError = true;
    else if (a === "--list") opts.list = true;
    else if (a === "--owner" || a === "-o") opts.owner = args[++i] ?? "";
    else if (a === "--message" || a === "-m") opts.message = args[++i] ?? "";
    else if (a === "--include-owners") opts.includeOwners = args[++i] ?? "";
    else if (a === "--root") opts.root = args[++i] ?? "";
    else if (a === "--help" || a === "-h") opts.help = true;
    else positional.push(a);
  }
  return { cmd, opts, positional };
}

function usage() {
  console.log(`Usage: ${SELF} <command> [options]

Commands:
  status       List owned lines ∩ current git diff
  stage        Stage only your lines
  commit       Stage + commit your lines
  gc           Clear stale ledger entries
  whoami       Print resolved owner id and source (flag|env|auto)
  owners       List all owners with ledger∩diff (human + --json)
  plan         Parent wrap-up: one suggested commit cmd per owner
  commit-each  Serial per-owner commit (default --dry-run; use --execute)

Options:
  --owner <id>              conversation_id (optional if unique on diff)
  --include-owners <id,id>  extra owners to merge (subagents)
  -m, --message <msg>       commit message / template ({owner} {n} {short})
  --dry-run                 print actions without staging/committing
  --execute                 commit-each: really commit (requires -m with {owner})
  --continue-on-error       commit-each: keep going after one owner fails
  --json                    machine-readable output
  --list                    with whoami: list all owners on diff
  --root <path>             repo root (default: cwd)

Owner resolution: --owner → CURSOR_CONVERSATION_ID / FSX_OWNER_ID → auto ledger∩diff
  auto: exactly one owner with non-empty ledger∩diff; 0 or ≥2 → error (no guess)

Multi-owner wrap-up (parent agent):
  ${SELF} owners | plan
  ${SELF} commit-each
  ${SELF} commit-each --execute -m "chore(own): commit for {owner}"
`);
}

/**
 * @param {string} root
 * @param {Record<string, string | boolean>} opts
 * @param {{ requireOwners?: boolean }} [cli]
 */
function resolveOwners(root, opts, cli = {}) {
  const requireOwners = cli.requireOwners !== false;
  try {
    return resolveOwnersForCli(root, {
      owner: typeof opts.owner === "string" ? opts.owner : undefined,
      includeOwners:
        typeof opts.includeOwners === "string" ? opts.includeOwners : undefined,
    });
  } catch (err) {
    if (!requireOwners) throw err;
    const e = /** @type {Error & { code?: number }} */ (err);
    console.error(e.message);
    process.exit(typeof e.code === "number" ? e.code : 2);
  }
}

/**
 * @param {Record<string, string | boolean>} opts
 */
function messageTemplateFromOpts(opts) {
  return typeof opts.message === "string" && opts.message
    ? opts.message
    : DEFAULT_WRAPUP_MESSAGE;
}

/**
 * Human-readable multi-owner inventory.
 * @param {ReturnType<typeof buildOwnersWrapup>} payload
 * @param {{ title?: string, showCmds?: boolean }} [fmt]
 */
function printOwnersHuman(payload, fmt = {}) {
  const title = fmt.title ?? "owners on diff";
  const showCmds = fmt.showCmds !== false;
  if (payload.count === 0) {
    console.log("no owners with ledger∩diff on current git changes");
  } else {
    console.log(`${title} (${payload.count}):`);
    let i = 0;
    for (const c of payload.owners) {
      i += 1;
      const paths = c.files
        .map((f) => {
          const lines =
            f.lines.length <= 8
              ? f.lines.join(",")
              : `${f.lines.slice(0, 6).join(",")},…(+${f.lines.length - 6})`;
          return `${f.path}:${lines}`;
        })
        .join(" ");
      console.log(
        `  ${i}. ${c.owner}  short=${c.short}  ${c.lineCount} line(s)  ${paths}`,
      );
      if (showCmds) {
        console.log(`     ${c.suggested_commit_cmd}`);
      }
    }
  }
  if (payload.lastActive) {
    console.log(
      `last-active hint: ${payload.lastActive.owner} (${payload.lastActive.updated_at}) — not used for commit identity alone`,
    );
  }
}

/**
 * @param {string} root
 * @param {Record<string, string | boolean>} opts
 */
function runWhoami(root, opts) {
  const json = !!opts.json;
  const list = !!opts.list;
  const candidates = listOwnersIntersectingDiff(root);
  const lastActive = readLastActiveOwner(root);

  if (list) {
    const payload = buildOwnersWrapup(root, {
      messageTemplate: messageTemplateFromOpts(opts),
    });
    if (json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      printOwnersHuman(payload);
    }
    return payload;
  }

  try {
    const resolved = resolvePrimaryOwner(root, {
      owner: typeof opts.owner === "string" ? opts.owner : undefined,
    });
    const payload = {
      owner: resolved.owner,
      source: resolved.source,
      candidates: resolved.candidates,
      lastActive: resolved.lastActive,
    };
    if (json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      console.log(`owner: ${resolved.owner}`);
      console.log(`source: ${resolved.source}`);
      if (resolved.source === "auto") {
        console.log("(auto from ledger∩diff)");
      }
      if (lastActive && lastActive.owner !== resolved.owner) {
        console.log(
          `last-active hint: ${lastActive.owner} (hint only; identity uses flag/env/auto)`,
        );
      }
    }
    return payload;
  } catch (err) {
    const e = /** @type {Error & { code?: number, candidates?: unknown }} */ (
      err
    );
    if (json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            error: e.message,
            code: e.code ?? 2,
            candidates,
            lastActive,
          },
          null,
          2,
        )}\n`,
      );
    } else {
      console.error(e.message);
    }
    process.exit(typeof e.code === "number" ? e.code : 2);
  }
}

/**
 * @param {string} root
 * @param {Record<string, string | boolean>} opts
 */
function runOwners(root, opts) {
  return runWhoami(root, { ...opts, list: true });
}

/**
 * Parent agent wrap-up plan.
 * @param {string} root
 * @param {Record<string, string | boolean>} opts
 */
function runPlan(root, opts) {
  const payload = buildWrapupPlan(root, {
    messageTemplate: messageTemplateFromOpts(opts),
  });
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    if (payload.count === 0) {
      console.log("plan: no owners with ledger∩diff");
    } else {
      console.log(
        `plan: ${payload.count} owner(s) — template: ${payload.messageTemplate}`,
      );
      let i = 0;
      for (const c of payload.owners) {
        i += 1;
        console.log(`[${i}/${payload.count}] ${c.suggested_commit_cmd}`);
      }
      console.log(
        `\n# dry-run all: ${SELF} commit-each` +
          (opts.message ? ` -m ${JSON.stringify(opts.message)}` : ""),
      );
      console.log(
        `# execute:     ${SELF} commit-each --execute -m ` +
          JSON.stringify(payload.messageTemplate),
      );
    }
  }
  return payload;
}

async function main() {
  const { cmd, opts } = parseArgs(process.argv);
  if (!cmd || opts.help || cmd === "help" || cmd === "--help" || cmd === "-h") {
    usage();
    process.exit(0);
  }

  const root =
    (typeof opts.root === "string" && opts.root) || process.cwd();

  const json = !!opts.json;
  const dryRun = !!opts.dryRun;

  try {
    switch (cmd) {
      case "whoami":
        runWhoami(root, opts);
        break;
      case "owners":
        runOwners(root, opts);
        break;
      case "plan":
        runPlan(root, opts);
        break;
      case "commit-each":
        await runCommitEach(root, {
          message: typeof opts.message === "string" ? opts.message : undefined,
          execute: !!opts.execute,
          continueOnError: !!opts.continueOnError,
          json,
        });
        break;
      case "status": {
        const { owners } = resolveOwners(root, opts);
        await runStatus(root, owners, { json, dryRun });
        break;
      }
      case "stage": {
        const { owners } = resolveOwners(root, opts);
        await runStage(root, owners, { json, dryRun });
        break;
      }
      case "commit": {
        const message = typeof opts.message === "string" ? opts.message : "";
        if (!message && !dryRun) {
          console.error("error: commit requires -m / --message");
          process.exit(2);
        }
        const { owners } = resolveOwners(root, opts);
        await runCommit(root, owners, { message, json, dryRun });
        break;
      }
      case "gc": {
        const { owners } = resolveOwners(root, opts);
        await runGc(root, owners);
        break;
      }
      default:
        console.error(`unknown command: ${cmd}`);
        usage();
        process.exit(2);
    }
  } catch (err) {
    const e = /** @type {Error & { code?: number }} */ (err);
    console.error(`error: ${e.message}`);
    process.exit(typeof e.code === "number" ? e.code : 1);
  }
}

// Allow importing without running
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}

export {
  parseArgs,
  resolveOwners,
  main,
  runWhoami,
  runOwners,
  runPlan,
};
