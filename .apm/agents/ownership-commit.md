# Ownership commit — subagent self-commit

After code review passes, commit **only your lines** with **own.mjs** (mandatory):

```bash
node {skill_dir}/scripts/bin/own.mjs commit -m "<conventional message>"
```

Prefer the absolute `node …/own.mjs` path injected by the sessionStart ownership hook when present.

**Do not** use `git add -A` or manual `git-stage-lines` — own.mjs already locks and stages owned lines.

No `--owner` needed when the working tree has **exactly one** owner with ledger∩diff.

## Resolve identity when needed

1. **`whoami`** — print resolved owner + source (`flag` | `env` | `auto`):
   ```bash
   node {skill_dir}/scripts/bin/own.mjs whoami
   ```
2. **`owners`** — list every owner that intersects the current git diff:
   ```bash
   node {skill_dir}/scripts/bin/own.mjs owners
   ```
3. **Explicit** — multi-active owners or cloud without ledger:
   ```bash
   node {skill_dir}/scripts/bin/own.mjs commit --owner <conversation_id> -m "<msg>"
   ```

Resolution order: **`--owner` → `CURSOR_CONVERSATION_ID` / `FSX_OWNER_ID` → auto ledger∩diff**.
Auto never guesses: 0 candidates → error; ≥2 → list + exit 2.

- Do **not** `git add -A`.
- Subagents are separate owners; if you are the **parent** wrapping many children, use [ownership-parent-wrapup.md](./ownership-parent-wrapup.md) (`plan` / `commit-each`), not a single bare commit.
- Full guide: `{skill_dir}/scripts/README.md`
