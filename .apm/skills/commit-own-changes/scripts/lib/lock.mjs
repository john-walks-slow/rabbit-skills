import fs from "node:fs";
import path from "node:path";

/**
 * Simple mkdir-based advisory lock (zero dependency, Windows-friendly).
 * @param {string} lockPath absolute path to lock directory
 * @param {{ staleMs?: number, retries?: number, minTimeout?: number, maxTimeout?: number }} [opts]
 * @returns {Promise<() => void>} release function
 */
export async function acquireLock(lockPath, opts = {}) {
  const staleMs = opts.staleMs ?? 15_000;
  const retries = opts.retries ?? 50;
  const minTimeout = opts.minTimeout ?? 20;
  const maxTimeout = opts.maxTimeout ?? 200;

  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  for (let i = 0; i <= retries; i++) {
    try {
      fs.mkdirSync(lockPath);
      try {
        fs.writeFileSync(
          path.join(lockPath, "owner"),
          JSON.stringify({ pid: process.pid, at: new Date().toISOString() }),
          "utf8",
        );
      } catch {
        // ignore
      }
      return () => releaseLock(lockPath);
    } catch (err) {
      const code = /** @type {NodeJS.ErrnoException} */ (err).code;
      if (code !== "EEXIST") throw err;

      // stale recovery
      try {
        const st = fs.statSync(lockPath);
        if (Date.now() - st.mtimeMs > staleMs) {
          releaseLock(lockPath);
          continue;
        }
      } catch {
        // race: lock gone
      }

      if (i === retries) {
        throw new Error(`lock timeout: ${lockPath}`);
      }
      const delay = Math.min(maxTimeout, minTimeout + i * 5);
      await sleep(delay);
    }
  }
  throw new Error(`lock timeout: ${lockPath}`);
}

/**
 * @param {string} lockPath
 */
export function releaseLock(lockPath) {
  try {
    fs.rmSync(lockPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * @param {string} root
 * @param {string} ledgerFilePath absolute path of ledger JSON
 */
export function fileLockPath(ledgerFilePath) {
  return `${ledgerFilePath}.lock`;
}

/**
 * @param {string} root
 * @param {string} ownerId
 */
export function ownerLockPath(root, ownerId) {
  const safe = ownerId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(root, ".agent-ownership", "meta", "owners", `${safe}.json.lock`);
}

/**
 * Global git index lock for stage/commit.
 * @param {string} root
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function acquireGitLock(root, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const lockPath = path.join(root, ".agent-ownership", "git.lock");
  const start = Date.now();
  let attempt = 0;
  while (true) {
    try {
      return await acquireLock(lockPath, {
        staleMs: 120_000,
        retries: 0,
        minTimeout: 50,
        maxTimeout: 200,
      });
    } catch {
      if (Date.now() - start >= timeoutMs) {
        throw new Error(
          "git lock timeout: another agent is running git stage/commit (own.mjs). Retry later.",
        );
      }
      attempt += 1;
      await sleep(Math.min(200, 50 + attempt * 10));
    }
  }
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
