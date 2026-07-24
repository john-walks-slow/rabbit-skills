# Ownership parent wrap-up

Use this when you are the **parent agent** with many subagents leaving owned lines on the working tree.

CLI: `node {skill_dir}/scripts/bin/own.mjs` (or the absolute path from sessionStart).

## Goal

1. **See the list** — who owns what (scriptable).
2. **Commit per person** — serial, mechanical, no identity guessing.
3. **Never** merge multi-owner into one auto commit.

## Commands

```bash
# inventory
node {skill_dir}/scripts/bin/own.mjs owners
node {skill_dir}/scripts/bin/own.mjs owners --json
node {skill_dir}/scripts/bin/own.mjs plan
node {skill_dir}/scripts/bin/own.mjs plan --json -m "chore(own): commit for {owner}"

# dry-run (default — no git write)
node {skill_dir}/scripts/bin/own.mjs commit-each
node {skill_dir}/scripts/bin/own.mjs commit-each --json

# real serial commits (must pass -m with {owner})
node {skill_dir}/scripts/bin/own.mjs commit-each --execute -m "chore(own): commit for {owner}"
```

Template placeholders: `{owner}`, `{n}`, `{short}`.

Optional: `--continue-on-error` to keep going after one owner fails (default: stop, exit ≠ 0).

## Do not

- `git add -A` / stash / checkout / restore / reset --hard
- Bare `own commit` when ≥2 owners on the diff (exits 2 by design)
- `--execute` without reviewing the dry-run plan
- Manual `git-stage-lines`

## Subagent self-commit

If **you** are a leaf subagent committing only your lines after review, use [ownership-commit.md](./ownership-commit.md) instead.

Full guide: `{skill_dir}/scripts/README.md` → **Multi-owner wrap-up (parent agent)**.
