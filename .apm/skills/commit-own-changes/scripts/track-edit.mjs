/**
 * afterFileEdit hook entry — best-effort ownership ledger update.
 * Always exits 0 (fail-open).
 */
import fs from "node:fs";
import {
  resolveProjectRoot,
  toRepoRelative,
  isIgnoredPath,
  ensureOwnershipDirs,
  normalizeFsPath,
} from "./lib/paths.mjs";
import { applyEditsToLedger } from "./lib/ledger.mjs";
import { recordLastActiveOwner } from "./lib/resolve-owner.mjs";
import { logEvent, logWarn } from "./lib/log.mjs";
import { parseHookStdinJson } from "./lib/stdin-json.mjs";

/**
 * @returns {Promise<string>}
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", reject);
  });
}

async function main() {
  let payload;
  try {
    const raw = await readStdin();
    payload = parseHookStdinJson(raw);
    if (payload == null) return;
    if (typeof payload !== "object" || Array.isArray(payload)) {
      logWarn("stdin JSON is not an object");
      return;
    }
  } catch (err) {
    logWarn("invalid stdin JSON", { err: String(err) });
    return;
  }

  try {
    const owner =
      payload.conversation_id ||
      payload.session_id ||
      process.env.CURSOR_CONVERSATION_ID ||
      process.env.FSX_OWNER_ID;
    if (!owner) {
      logWarn("no conversation_id; skip track");
      return;
    }

    const filePathRaw = payload.file_path;
    if (!filePathRaw || typeof filePathRaw !== "string") {
      logWarn("no file_path; skip track");
      return;
    }

    const rootsRaw =
      Array.isArray(payload.workspace_roots) && payload.workspace_roots.length > 0
        ? payload.workspace_roots.filter((r) => typeof r === "string")
        : [process.cwd()];
    const root = resolveProjectRoot(payload);
    const roots = rootsRaw.map((r) => normalizeFsPath(r));
    const filePath = normalizeFsPath(filePathRaw);
    const rel = toRepoRelative(filePath, [root, ...roots]);
    if (!rel) {
      logEvent(root, "path_outside", { filePath: filePathRaw });
      return;
    }
    if (isIgnoredPath(rel)) {
      logEvent(root, "path_ignored", { path: rel });
      return;
    }

    ensureOwnershipDirs(root);
    recordLastActiveOwner(root, owner);

    let text;
    try {
      text = fs.readFileSync(filePath, "utf8");
    } catch (err) {
      logWarn("cannot read file", { filePath, err: String(err) });
      return;
    }

    const edits = Array.isArray(payload.edits) ? payload.edits : [];
    // Full write with no edits array: claim all lines
    if (edits.length === 0) {
      await applyEditsToLedger({
        root,
        posixRelPath: rel,
        text,
        edits: [{ old_string: "", new_string: text }],
        owner,
        generation_id: payload.generation_id,
      });
      logEvent(root, "track_full", { path: rel, owner });
      return;
    }

    await applyEditsToLedger({
      root,
      posixRelPath: rel,
      text,
      edits,
      owner,
      generation_id: payload.generation_id,
    });
    logEvent(root, "track_ok", { path: rel, owner, edits: edits.length });
  } catch (err) {
    logWarn("track-edit failed", { err: String(err) });
  }
}

main()
  .catch((err) => {
    logWarn("track-edit fatal", { err: String(err) });
  })
  .finally(() => {
    // Cursor afterFileEdit expects a JSON object on stdout when configured as a response hook.
    try {
      process.stdout.write("{}\n");
    } catch {
      // ignore
    }
    process.exit(0);
  });
