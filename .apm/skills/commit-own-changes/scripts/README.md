# Agent line-level ownership (commit-own-changes scripts)

Track which Cursor conversation owns which lines, then commit **only your lines** after review.

Runtime data lives in the **current git workspace** under gitignored `.agent-ownership/` (not inside the skill install path).

## Layout (this skill)

```
commit-own-changes/
  SKILL.md
  scripts/
    session-start.mjs   # Cursor sessionStart
    track-edit.mjs      # Cursor afterFileEdit
    bin/own.mjs         # CLI
    lib/*               # ledger, locks, stage, commit, resolve-owner
    README.md           # this file
```

APM wires hooks via `.apm/hooks/ownership.json` → `${PLUGIN_ROOT}/.apm/skills/commit-own-changes/scripts/...`.

- **Project install**: commands rewritten relative to repo (under `.cursor/hooks/<pkg>/...` for hook copies; skill also at `.agents/skills/commit-own-changes/`).
- **Global install (`apm install -g`)**: `${PLUGIN_ROOT}` → absolute path under user scope; sessionStart injects absolute `node …/own.mjs` into the agent context.

## Requirements

- Node.js 24+
- `git-stage-lines` available when partial-file stage is needed (project `npm install` / `npx git-stage-lines`, or apply-cached fallback)
- Git workspace
- Cursor project or user hooks enabled for `sessionStart` + `afterFileEdit`

## Daily commands

Prefer the path from sessionStart. Otherwise from skill dir:

```bash
node {skill_dir}/scripts/bin/own.mjs status
node {skill_dir}/scripts/bin/own.mjs stage
node {skill_dir}/scripts/bin/own.mjs commit -m "feat: …"
node {skill_dir}/scripts/bin/own.mjs whoami
node {skill_dir}/scripts/bin/own.mjs owners
node {skill_dir}/scripts/bin/own.mjs plan
node {skill_dir}/scripts/bin/own.mjs commit-each
```

Options: `--dry-run`, `--json`, `--execute` (commit-each), `--continue-on-error`, `--include-owners id1,id2`, `--root <path>`, `--owner <id>`.

**Warning:** `own stage/commit` runs `git restore --staged .` under the git lock (clears the whole index, not the working tree).

## Owner resolution

Order: **`--owner` → `CURSOR_CONVERSATION_ID` / `FSX_OWNER_ID` → auto ledger∩diff**.

| Situation | Behavior |
|-----------|----------|
| Exactly **1** owner with non-empty ledger∩diff | Auto-use that owner |
| **0** owners | Exit 2 — nothing owned on diff |
| **≥2** owners | Exit 2 — list owners; never guess |

`last-active-owner.json` is a **hint only** — never sole commit identity.

## Multi-owner wrap-up (parent)

```bash
node {skill_dir}/scripts/bin/own.mjs owners
node {skill_dir}/scripts/bin/own.mjs plan
node {skill_dir}/scripts/bin/own.mjs commit-each              # dry-run
node {skill_dir}/scripts/bin/own.mjs commit-each --execute -m "chore(own): commit for {owner}"
```

**Forbidden:** merging multi-owner into one auto commit without explicit `--include-owners`.

## What is not tracked

- Tab / manual editor edits (`afterTabFileEdit` not registered)
- Paths under `.git/`, `.agent-ownership/`, `node_modules/`, `.fsx/`
- Automatic commit/push (never)
- Edits outside Cursor agent tools

## Debug

- Cursor **Output → Hooks**
- `.agent-ownership/logs/hook.jsonl`
- `track-edit` always exits 0 (fail-open)
